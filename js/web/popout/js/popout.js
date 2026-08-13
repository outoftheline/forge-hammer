/*
 * Copyright (C) 2026 Forge Hammer
 * Licensed under AGPL - see LICENSE.md for details.
 */

/*

Usage (per box, opt-in):

	FH.HTML.Box({
		id: 'MyBox',
		title: FH.t('Boxes.MyBox.Title'),
		popout: true                              // adds the pop-out button
        ///
		popout: {                                 // ... or with / hooks
			w: 1200, h: 700,
			onPopout: (win) => {},                // box moved into the pop-out window
			onDock:   () => {},                   // box moved back into the game window
			onResize: (win) => {}                 // pop-out window was resized
		}
	});

How it works:
	- the pop-out window runs no javascript, it is only a rendering surface
	- the live box element is moved (document.adoptNode) into the pop-out window,
	  so all handlers, jQuery data and DOM state stay intact
	- while at least one pop-out is open, document.getElementById()/querySelector()/jQuery
	  also search the open pop-out documents, so existing module code keeps working
	  ($('#MyBoxBody').html(...), if ($('#MyBox').length > 0) ...)
*/
{
const HTML = FH.HTML;

let Popout = {

	/** @type {Map<string, object>} id => {win, box, placeholder, observer, titleObserver, timer, style} */
	Windows: new Map(),
	pendingRestore: new Set(),
	restoreArmed: false,
	nativeFind: null,

	isPopped: (id) => Popout.Windows.has(id),

	/** all documents of currently open pop-out windows */
	documents: () => {
		let docs = [];
		for (const entry of Popout.Windows.values()) {
			if (entry.win && !entry.win.closed && entry.win.document) docs.push(entry.win.document);
		}
		return docs;
	},

	getState: (id) => {
		try {
			return JSON.parse(FH.Storage.getItem('Popout.' + id) || '{}');
		} catch (e) {
			return {};
		}
	},

	setState: (id, data) => {
		FH.Storage.setItem('Popout.' + id, JSON.stringify(Object.assign(Popout.getState(id), data)));
	},

	/**
	 * Remembers that this box was popped out in a previous session.
	 * window.open() requires user activation, so the restore is deferred
	 * until the user clicks somewhere in the game.
	 */
	queueRestore: (id) => {
		if (Popout.Windows.has(id) || !Popout.getState(id).open) return;

		Popout.pendingRestore.add(id);

		if (Popout.restoreArmed) return;
		Popout.restoreArmed = true;

		$(document).one('click.fhPopoutRestore', () => {
			Popout.restoreArmed = false;
			for (const boxId of [...Popout.pendingRestore]) {
				Popout.pendingRestore.delete(boxId);
				if (document.getElementById(boxId)) Popout.open(boxId);
			}
		});
	},


	// ------------------------------------------------------------------- open

	/**
	 * Moves the box into its own window. Must be called from a user gesture
	 * (click handler), otherwise the browser's popup blocker kills it.
	 *
	 * @param {string} id box id
	 * @returns {Window|null}
	 */
	open: async (id) => {
		let entry = Popout.Windows.get(id);

		if (entry) {
			if (!entry.win.closed) entry.win.focus();
			return entry.win;
		}

		let box = document.getElementById(id);
		if (!box || box.ownerDocument !== document) return null;

		let register = HTML.Boxes[id] || {},
			args     = register.args || {},
			hooks    = register.hooks || {},
			state    = Popout.getState(id);

		let width  = state.w || hooks.w || 900,
			height = state.h || hooks.h || 600,
			left   = (state.x !== undefined) ? state.x : 100,
			top    = (state.y !== undefined) ? state.y : 100;

		// a real document (blob url) instead of about:blank - some browsers (Vivaldi, ...)
		// label an about:blank window "Blank Page" and ignore its <title>
		let url = Popout.buildDocument(id, box),
			win = window.open(url, `FHPopout_${FH.World}_${id}`,
				`popup=yes,width=${width},height=${height},left=${left},top=${top}`);

		if (!win) {
			URL.revokeObjectURL(url);
			HTML.ShowToastMsg({
				head: FH.t('Boxes.PopOut.Title'),
				text: FH.t('Boxes.PopOut.Blocked'),
				type: 'error',
				hideAfter: 8000,
				show: true
			});
			return null;
		}

		// window.open() is synchronous (user gesture), the document is not
		let ready = await Popout.whenReady(win);
		URL.revokeObjectURL(url);

		if (!ready) {
			if (!win.closed) win.close();
			return null;
		}

		// note: everything below has to happen AFTER the document has loaded,
		// a navigation replaces the global object of the pop-out window
		Popout.prepareDocument(win, id, box);

		// detach everything that is bound to the game window
		let style = box.style.cssText;

		if (args['resize']) {
			try { $(box).resizable('destroy'); } catch (e) {}
			$(box).find('.window-grippy').remove();
		}

		let header = document.getElementById(id + 'Header');
		if (header) header.onpointerdown = null;

		for (const prop of ['--x', '--y', 'left', 'top', 'right', 'bottom', 'width', 'height', 'max-width', 'max-height', 'position']) {
			box.style.removeProperty(prop);
		}

		box.classList.add('popped-out');
		box.classList.remove('on-top', 'closed');
		box.classList.add('open');
		$(box).find('.window-body').css('visibility', 'visible');

		// leave a marker behind, so the box can be docked back into the same spot
		let placeholder = document.createElement('div');
		placeholder.className = 'fh-popout-placeholder';
		placeholder.dataset.for = id;
		box.replaceWith(placeholder);

		win.document.body.appendChild(win.document.adoptNode(box));

		// the box may be removed while it lives in the pop-out
		// (close button, CloseOpenBox(), MapActivityCheck, ...) => close the window with it
		let observer = new MutationObserver(() => {
			if (!box.isConnected) Popout.dock(id);
		});
		observer.observe(win.document.body, {childList: true});

		let titleObserver = Popout.watchTitle(win, id, box);

		let timer = setInterval(() => {
			if (win.closed) return;
			Popout.setState(id, {open: true, x: win.screenX, y: win.screenY, w: win.outerWidth, h: win.outerHeight});
		}, 1000);

		Popout.Windows.set(id, {win, box, placeholder, observer, titleObserver, timer, style});

		if (Popout.Windows.size === 1) Popout.installShims();

		Popout.setState(id, {open: true});

		try { FH.Tooltips.attach(win.document); } catch (e) { console.error('Popout: tooltips', e); }

		win.addEventListener('resize', () => {
			try { hooks.onResize && hooks.onResize(win); } catch (e) { console.error('Popout: onResize', e); }
		});
		win.addEventListener('pagehide', () => Popout.dock(id));

		try { hooks.onPopout && hooks.onPopout(win); } catch (e) { console.error('Popout: onPopout', e); }
		try { hooks.onResize && hooks.onResize(win); } catch (e) {}

		return win;
	},


	// ------------------------------------------------------------------- dock

	/**
	 * Moves the box back into the game window and closes the pop-out.
	 * Called automatically when the pop-out window is closed.
	 *
	 * @param {string} id box id
	 */
	dock: (id) => {
		let entry = Popout.Windows.get(id);
		if (!entry) return;

		Popout.Windows.delete(id);

		if (entry.observer) entry.observer.disconnect();
		if (entry.titleObserver) entry.titleObserver.disconnect();
		if (entry.timer) clearInterval(entry.timer);
		if (Popout.Windows.size === 0) Popout.removeShims();

		try { FH.Tooltips.detach(entry.win.document); } catch (e) {}

		let register = HTML.Boxes[id] || {},
			args     = register.args || {},
			hooks    = register.hooks || {};

		if (entry.box.isConnected) {
			// box is still alive => put it back where it came from
			entry.box.classList.remove('popped-out');

			if (entry.placeholder.isConnected) {
				entry.placeholder.replaceWith(document.adoptNode(entry.box));
			} else {
				document.body.appendChild(document.adoptNode(entry.box));
			}

			entry.box.style.cssText = entry.style;

			if (args['dragdrop']) HTML.DragBox(document.getElementById(id), args['saveCords']);
			if (args['resize']) HTML.Resizeable(id, args['keepRatio']);

			HTML.BringToFront($(entry.box));

			try { hooks.onDock && hooks.onDock(); } catch (e) { console.error('Popout: onDock', e); }
		}
		else if (entry.placeholder.isConnected) {
			// box was closed while popped out
			entry.placeholder.remove();
		}

		Popout.setState(id, {open: false});

		if (!entry.win.closed) entry.win.close();
	},


	/** closes the pop-out window of a box (the box itself survives, it is docked back) */
	close: (id) => {
		let entry = Popout.Windows.get(id);
		if (!entry) return;

		if (!entry.win.closed) entry.win.close();
		Popout.dock(id);
	},


	closeAll: () => {
		for (const id of [...Popout.Windows.keys()]) Popout.close(id);
	},


	/** convenience for the menu: open, or focus an already open window */
	toggle: (id) => {
		if (Popout.Windows.has(id)) Popout.close(id);
		else Popout.open(id);
	},


	// --------------------------------------------------------------- document

	/**
	 * Plain text of the box title, used as the window title of the pop-out
	 *
	 * @param box box element
	 * @param id  fallback if the box has no (or an empty) title
	 * @returns {string}
	 */
	boxTitle: (box, id) => {
		let title = box.querySelector('.window-head .title');
		if (!title) return id;

		// drop the hammer icon and any other decoration
		let clone = title.cloneNode(true);
		for (const deco of clone.querySelectorAll('small, svg, img')) deco.remove();

		let text = (clone.textContent || '').replace(/\s+/g, ' ').trim();

		return (text || id)+` - Forge Hammer`;
	},


	/** keeps the window title in sync with boxes that rename their header (e.g. citymap) */
	watchTitle: (win, id, box) => {
		let title = box.querySelector('.window-head > .title');
		if (!title) return null;

		let observer = new MutationObserver(() => {
			if (!win.closed) win.document.title = Popout.boxTitle(box, id);
		});
		observer.observe(title, {childList: true, characterData: true, subtree: true});

		return observer;
	},


	/**
	 * Builds the (empty) document of the pop-out and returns its blob url.
	 * Title, language and base url are baked in, so the browser shows them
	 * right away and does not fall back to a generic "Blank Page".
	 *
	 * @returns {string} object url, revoke it once the window has loaded
	 */
	buildDocument: (id, box) => {
		let html = '<!DOCTYPE html>'
			+ `<html lang="${HTML.escapeHtml(FH.BaseData.GuiLng || 'en')}">`
			+ '<head>'
			+ '<meta charset="utf-8">'
			+ `<base href="${HTML.escapeHtml(location.href)}">`
			+ `<title>${HTML.escapeHtml(Popout.boxTitle(box, id))}</title>`
			+ '</head>'
			+ '<body class="fh-popout-host" data-fh-popout="' + HTML.escapeHtml(id) + '"></body>'
			+ '</html>';

		return URL.createObjectURL(new Blob([html], {type: 'text/html;charset=utf-8'}));
	},


	/**
	 * Waits until the document built by buildDocument() is in place.
	 *
	 * @returns {Promise<boolean>} false if the window was closed or never loaded
	 */
	whenReady: (win, timeout = 10000) => {
		return new Promise((resolve) => {
			let waited = 0;

			let check = () => {
				if (win.closed) return resolve(false);

				try {
					if (win.document.body && win.document.body.dataset.fhPopout) return resolve(true);
				} catch (e) {} // still on about:blank / cross origin during the navigation

				waited += 25;
				if (waited >= timeout) return resolve(false);

				setTimeout(check, 25);
			};

			check();
		});
	},


	prepareDocument: (win, id, box) => {
		let doc = win.document;

		// title/base/lang come from buildDocument(), only refresh the title in case
		// the box was renamed between window.open() and the load event
		doc.title = Popout.boxTitle(box, id);
		doc.body.classList.add('fh-popout-host');

		Popout.syncCss(win);
		Popout.mirrorGlobals(win);
	},


	/**
	 * Mirrors all stylesheets of the game page into the pop-out.
	 * Called again whenever AddCssFile()/ChangeSkinCssFile() adds something.
	 */
	syncCss: (win) => {
		if (!win || win.closed || !win.document.head) return;

		let doc = win.document;

		for (const link of document.querySelectorAll('link[rel="stylesheet"]')) {
			if (!link.href) continue;
			if (doc.querySelector(`link[data-fh-href="${CSS.escape(link.href)}"]`)) continue;

			let copy = doc.createElement('link');
			copy.rel = 'stylesheet';
			copy.href = link.href;
			copy.dataset.fhHref = link.href;
			doc.head.appendChild(copy);
		}

		// remove sheets that are gone in the game window (e.g. after a skin change)
		let current = new Set([...document.querySelectorAll('link[rel="stylesheet"]')].map(l => l.href));
		for (const link of doc.querySelectorAll('link[data-fh-href]')) {
			if (!current.has(link.dataset.fhHref)) link.remove();
		}
	},

	syncCssAll: () => {
		for (const entry of Popout.Windows.values()) Popout.syncCss(entry.win);
	},


	/**
	 * Inline handlers (onclick="Productions.foo()") are compiled against the global
	 * object of the pop-out window - mirror the game window's globals into it.
	 */
	mirrorGlobals: (win) => {
		for (const key of Object.getOwnPropertyNames(window)) {
			if (key in win) continue; // filters out all built-ins

			try {
				Object.defineProperty(win, key, {
					configurable: true,
					get: () => window[key],
					set: (value) => { window[key] = value; }
				});
			} catch (e) {}
		}
	},


	// ------------------------------------------------------------------ shims

	/**
	 * While a box lives in a pop-out document, the game document does not contain it
	 * anymore. These shims let the existing selector based module code find it anyway.
	 * They are installed with the first and removed with the last pop-out.
	 */
	installShims: () => {
		if (Popout.nativeFind) return;

		const nativeGetById = Document.prototype.getElementById,
			  nativeQuery   = Document.prototype.querySelector,
			  nativeQueryAll= Document.prototype.querySelectorAll;

		Object.defineProperty(document, 'getElementById', {
			configurable: true, writable: true,
			value: function (id) {
				let el = nativeGetById.call(this, id);
				if (el) return el;

				for (const doc of Popout.documents()) {
					el = nativeGetById.call(doc, id);
					if (el) return el;
				}
				return null;
			}
		});

		Object.defineProperty(document, 'querySelector', {
			configurable: true, writable: true,
			value: function (selector) {
				let el = nativeQuery.call(this, selector);
				if (el) return el;

				for (const doc of Popout.documents()) {
					el = nativeQuery.call(doc, selector);
					if (el) return el;
				}
				return null;
			}
		});

		Object.defineProperty(document, 'querySelectorAll', {
			configurable: true, writable: true,
			value: function (selector) {
				let list = nativeQueryAll.call(this, selector);
				if (list.length) return list;

				for (const doc of Popout.documents()) {
					let popoutList = nativeQueryAll.call(doc, selector);
					if (popoutList.length) return popoutList;
				}
				return list;
			}
		});

		// $('#id') uses the getElementById fast path (see above),
		// everything else runs through jQuery.find(selector, document, results)
		Popout.nativeFind = jQuery.find;

		jQuery.find = Object.assign(function (selector, context, results, seed) {
			let start = results ? results.length : 0,
				found = Popout.nativeFind(selector, context, results, seed);

			if (context === document && found.length === start) {
				for (const doc of Popout.documents()) Popout.nativeFind(selector, doc, found, seed);
			}
			return found;
		}, Popout.nativeFind);
	},

	removeShims: () => {
		if (!Popout.nativeFind) return;

		delete document.getElementById;
		delete document.querySelector;
		delete document.querySelectorAll;

		jQuery.find = Popout.nativeFind;
		Popout.nativeFind = null;
	}
};

// no zombie windows when the game page is reloaded or left
window.addEventListener('pagehide', () => Popout.closeAll());

HTML.Popout = Popout;

// button styling in the game window + layout inside the pop-out windows
HTML.AddCssFile('popout');
}