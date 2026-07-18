# Changelog
 
## Version 1.3.2
### Update
- Stadtplaner: Man kann jetzt auch mit dem Mausrad zoomen
- Ketten & Sets: Sollten jetzt keine manuellen Updates mehr benötigen
- Effizienz: Man kann jetzt auch nach Gebäude-EntityId filtern: Unterstrich und dann (Teil-)Begriff eingeben, z.B. _Expedition für Gebäude aus der Expedition, _GR2 für Gebäude aus der QI

### Bug Fixes
- Die Gebäudedatenbank hat sich auf älteren Geräten oder bei schlechter Internetverbindung nie fertig aufgebaut, was die Erweiterung nicht mehr nutzbar gemacht hat 
- QI: Der Filter für Fortschritt war standardmäßig aktiv
- Statistiken: CSV Download hat nicht ganz zum vorherigen Format gepasst

---
 
## Version 1.3.1
### Update
- Umbaumodus: In der Karte können jetzt auch gespeicherte Stadtpläne geladen werden. Wenn ihr Gebäude in derselben Größe und mit dem gleichen Typ bzw gleichen Bedingung für Straßen übereinanderlegt, wird das Gebäude grün markiert
- Stadtübersicht: Schicke Städte anderer Spieler an den Stadtplaner
- Stadtplaner: Verbesserungen an der Steuerung, z.B. Karte bewegen mit WASD Tasten, mehrere Gebäude gleichzeitig bewegen/löschen, Straßen können durch überbauen mit der passenden Straße gelöscht werden. Man kann jetzt auch Pläne umbenennen
- Übersetzungen: PL (Danke an Kafo) und FR (Danke an Damrus le Cruel) aktualisiert
- Tooltips: Wird in den QI ein Güter- oder Militärgebäude geerntet oder eine Produktion angestoßen, wird der Vorrat für diese Produktion angezeigt
    - Die Summe enthält die aktuell angestoßene Produktion
    - Wenn das Einheitenfenster noch nicht geöffnet wurde, steht ein +? hinter der Anzahl der Einheiten, um anzugeben, dass die Anzahl der Einheiten im Vorrat unbekannt ist
    - Wenn eine Erweiterung mit Gütern gekauft werden kann, werden die Kosten dafür im Tooltip angegeben und es wird ein Fortschrittsbalken angezeigt, der angibt, welcher Anteil von den Kosten bereits produziert wurde
- Die Standard-Position für GG Ziele ist nun oben

### Bug Fixes
- LG Rechner: Eine Änderung auf Beta hat den Rechner für eigene LG kaputt gemacht
- Stadtplaner: Gütergebäude hatten die Farbe von Straßen
- Güterproduktionen wurden falsch berechnet
- Die Einstellungen an manchen Fenstern waren kaputt
- Dropdowns wurde in der Infobox und den Statistiken ein wenig gekürzt, damit sie vollständig sichtbar bleiben
- Effizienzrechner: Die Symbole für Gebäude, die man auf eine erhabene Version upgraden kann, sind wieder zurück
- Aufbau der Gebäudedatenbank verbessert
- Tooltips: Im Gebäudetooltip konnten die Spezialgüter fehlen
- Links: Gildenlinks waren kaputt
- Übersetzungen: Die Übersetzungsdaten wurden teilweise nicht korrekt gelesen

---
 
## Version 1.2
### Neu
- Gefechtslog: Der Gefechtslog wird nun ausgelesen und gespeichert, dank Arklur! Ihr findet den Button in der Gefechtsübersicht. Bitte beachtet, dass das Spiel nur die letzten 200 Einträge speichert und der Log deshalb nicht vollständig sein wird, wenn die Daten nicht regelmäßig abgerufen werden.
- GG Ziele: Die nächsten vier markierten Sektoren auf der Karte werden angezeigt. Deaktiviere sie oder ändere die Position in den Einstellungen am GG Fenster
- Stadtplaner: Eine erste Version des Stadtplaners ist da! Schickt eure Daten in der Stadtübersicht an den Planer und fangt an zu bauen. Aktuell sind alle Beschreibungen noch auf Englisch.

### Update
- Statistiken: CSV Export (wieder) hinzugefügt für: Ressourcen, Gildenkasse, Einheiten, GG Siegpunkte, GG Spielerfortschritt
- Der GG Spielerfortschritt ist nun im GG Fenster in den Statistiken zu finden und zeigt nur noch den Fortschritt der aktuellen Runde
- GG Statistiken: Siegpunkte können jetzt auf einen Blick verglichen werden
- Gefechte: Option zum automatischen Öffnen hinzugefügt
- Shops: Suchfeld hinzugefügt
- Notizen: Einstellung für automatisches Öffnen beim Spielstart hinzugefügt
- Gebäudetooltips: Es wird nun angezeigt, dass Gebäude nicht mit SPA beschleunigt werden können und ob sie sich automatisch dem Zeitaler anpassen (Danke an WOLFI) weiterhin wurde ein Hinweis ergänzt, wenn ein Gebäude keine Straße benötigt
- Übersetzungen: FR (Danke an Damrus le Cruel) und IT (Danke an Alej92415) aktualisiert

### Bug Fixes
- Gefechte: Es konnten leere Einträge in der Gefechtshistorie und manchmal leere Fenster angezeigt werden
- Übersetzungen: Wurden unter anderem nicht korrekt gespeichert

---
 
## Version 1.1
### Neu
- Warnung hinzugefügt, wenn der FoE-Helfer erkannt wurde

### Update
- Statistiken: Datumsauswahl nur noch bei den Belohnungen - in den anderen Diagrammen kann der Zoom per Mausrad benutzt werden
- GBG: Wenn in der Provinzliste auf eine Provinz gezeigt wird, wird diese nun in der Karte hervorgehoben

### Bug Fixes
- Statistiken: Tooltip konnte aus dem Diagramm herauslaufen

---

## Version 1.0
### Neu
- Notizen/To Dos: Mach dir Listen, um dich an deine wichtigsten Vorhaben zu erinnern
- Gefechte: Schau dir den Punkteverlauf einer Runde in den Statistiken an

### Update
- Statistiken: Der Code, der für die Darstellung der Statistiken benutzt wird, kommt nun von ChartJS. Man kann nun scrollen und zoomen anstatt wie bisher mit der Maus bereiche zu markieren. Daten-Export ist im Moment nicht möglich, wird aber demnächst wieder hinzugefügt

### Bug Fixes
- Forschung: Ein Spielupdate hat dafür gesorgt, dass die FP nicht mehr gezählt wurden oder das Fenster leer war
- GG Benachrichtungen: Laufen wieder wie gewollt, statt mal doppelt, mal gar nicht
- Einstellungen: Der ausgewählte Ton konnte unter Umständen wieder verschwinden
- Einstellungen: Tooltips vom Menü sind in manchen Sprachen kaputt gewesen
- Einstellungen: Der Moppelhelfer wurde nicht ins Menü geladen, wenn man die Aktivitäten nicht gespeichert hat. Das funktioniert jetzt anders

---
 
## Version 0.9
### Neu
- Themes! Schau in die Einstellungen bei "Farben", um andere Farb-Schemata für alle Fenster auszuwählen
- Spielfilter! Du kannst in den Einstellungen nun auch ein paar Spielfarben verändern
- Ändere den Ton! In den Einstellungen kann man jetzt zwischen sieben Tönen aussuchen
- Pop Ups: Teste eine erste Version des Features im Effizienz-Fenster und erfreu dich am gewonnenen Platz im Spiel. Es funktioniert leider (noch) nicht alles im Pop Up

### Update
- LG Rechner: Button in der oberen Leiste hinzugefügt, um die Ansicht mit einem Klick zu ändern
- Stadt Übersicht: Neue Filter für Gebäude, die eingesammelt werden können, und Gebäude, die noch motiviert werden müssen
- Stadt Übersicht: Man kann die Ansicht jetzt auch um 90° in die andere (manche sagen "richtige") Richtung drehen
- Stadt Übersicht: Es wird nun ein Fenster geöffnet, wenn man auf erhabene Gebäude klickt, das eine Liste von allen öffnet
- Gefechte: In den Einstellungen des Fensters kann die Zeit für Benachrichtungen angepasst werden

### Bug Fixes
- Stadtübersicht: Hervorgehobene Gebäude waren nicht immer im Blickfeld

### Entfernt
- Alle Links zur FoE Helper Website, inklusive Stadtübertragung
- Notizen: Die Daten wurden auf der Website gespeichert, weshalb das Modul entfernt werden musste. Wir werden nach anderen Möglichkeiten gucken, aber wahrscheinlich werden wir nichts anbieten, das Daten in der Cloud speichert, also wird es keine Synchronisation zwischen verschiedenen Geräten geben