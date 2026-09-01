'use strict';

window.PlannerApp = window.PlannerApp || {};

(function (app) {
    const dom = app.dom;

    const MAX_DETAIL_ITEMS = 12;
    const AUTO_DISMISS_MS = 7000;

    function t(key, fallback) {
        return app.t ? app.t(key, fallback) : fallback;
    }

    function setText(el, text) {
        if (el) el.textContent = text == null ? '' : String(text);
    }

    let activeLoads = 0;
    let failed = false;

    function showLoading(title) {
        activeLoads++;
        if (activeLoads === 1) clearIssues();
        if (!dom.loadingOverlay) return;

        failed = false;
        dom.loadingOverlay.classList.remove('failed');
        setText(dom.loadingTitle, title || t('XPlan.PlanList.Loading'));
        setText(dom.loadingStep, '');
        if (dom.loadingDismiss) dom.loadingDismiss.classList.add('hidden');
        dom.loadingOverlay.classList.remove('hidden');
    }

    function loadingStep(text) {
        if (!dom.loadingOverlay || failed) return;
        setText(dom.loadingStep, text);
    }

    function hideLoading() {
        activeLoads = Math.max(0, activeLoads - 1);
        if (activeLoads > 0 || failed) return;

        if (dom.loadingOverlay) dom.loadingOverlay.classList.add('hidden');
        flushIssues();
    }

    function failLoading(message) {
        activeLoads = 0;
        failed = true;
        if (!dom.loadingOverlay) return;

        dom.loadingOverlay.classList.add('failed');
        dom.loadingOverlay.classList.remove('hidden');
        setText(dom.loadingTitle, t('XPlan.Loading.Failed'));
        setText(dom.loadingStep, message || '');
        if (dom.loadingDismiss) dom.loadingDismiss.classList.remove('hidden');
        flushIssues();
    }

    function dismissLoading() {
        activeLoads = 0;
        failed = false;
        if (dom.loadingOverlay) dom.loadingOverlay.classList.add('hidden');
    }


    function showDetails(items) {
        const list = document.createElement('ul');
        list.className = 'note-details';

        items.slice(0, MAX_DETAIL_ITEMS).forEach(item => {
            const li = document.createElement('li');
            li.textContent = String(item);
            list.appendChild(li);
        });

        if (items.length > MAX_DETAIL_ITEMS) {
            const li = document.createElement('li');
            li.className = 'more';
            li.textContent = t('XPlan.Issues.More', '+{0}')
                .replace('{0}', items.length - MAX_DETAIL_ITEMS);
            list.appendChild(li);
        }

        return list;
    }

    function notify(options) {
        const opts = options || {};
        const level = opts.level || 'info';
        const items = Array.isArray(opts.items) ? opts.items : [];

        if (!dom.notifications) {
            console[level === 'error' ? 'error' : 'log']('[Planner]', opts.title, opts.message, items);
            return null;
        }

        const note = document.createElement('div');
        note.className = 'note note-' + level;

        const close = document.createElement('button');
        close.className = 'btn note-close';
        close.type = 'button';
        close.textContent = '✕';
        close.title = t('General.Dismiss');
        close.addEventListener('click', () => note.remove());
        note.appendChild(close);

        if (opts.title) {
            const title = document.createElement('div');
            title.className = 'note-title';
            title.textContent = opts.title;
            note.appendChild(title);
        }

        if (opts.message) {
            const message = document.createElement('div');
            message.className = 'note-message';
            message.textContent = opts.message;
            note.appendChild(message);
        }

        if (items.length) {
            const details = document.createElement('details');
            const summary = document.createElement('summary');
            summary.textContent = t('General.Details', 'Details')
                + ' (' + items.length + ')';
            details.appendChild(summary);
            details.appendChild(showDetails(items));
            note.appendChild(details);
        }

        dom.notifications.appendChild(note);

        if (level === 'info' && !opts.sticky) {
            setTimeout(() => note.remove(), AUTO_DISMISS_MS);
        }

        return note;
    }

    function clearNotifications() {
        if (dom.notifications) dom.notifications.innerHTML = '';
    }

    let issues = [];

    function clearIssues() {
        issues = [];
    }

    function reportDataIssue(issue) {
        if (!issue || !issue.code) return;

        const existing = issues.find(i => i.code === issue.code);
        if (existing) {
            existing.items = existing.items.concat(issue.items || []);
            return;
        }

        issues.push({
            code: issue.code,
            level: issue.level || 'warn',
            title: issue.title || '',
            message: issue.message || '',
            items: (issue.items || []).slice()
        });
    }

    function hasIssues() {
        return issues.length > 0;
    }

    function flushIssues() {
        const pending = issues;
        issues = [];

        pending.forEach(issue => {
            const items = Array.from(new Set(issue.items.map(String)));
            console.warn('[Planner] ' + issue.code + ':', issue.message, items);
            notify({
                level: issue.level,
                title: issue.title,
                message: issue.message,
                items
            });
        });

        return pending.length;
    }

    function bindStatusEvents() {
        if (dom.loadingDismiss) {
            dom.loadingDismiss.addEventListener('click', dismissLoading);
        }
    }

    app.loading = {
        show: showLoading,
        step: loadingStep,
        hide: hideLoading,
        fail: failLoading,
        dismiss: dismissLoading
    };

    app.notify = notify;
    app.clearNotifications = clearNotifications;
    app.reportDataIssue = reportDataIssue;
    app.clearDataIssues = clearIssues;
    app.flushDataIssues = flushIssues;
    app.hasDataIssues = hasIssues;
    app.bindStatusEvents = bindStatusEvents;
})(window.PlannerApp);