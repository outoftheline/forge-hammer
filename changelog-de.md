# Changelog
 
## Version 1.3
### Update
- Übersetzungen: PL (Danke an Kafo) aktualisiert

### Bug Fixes
- LG Rechner: Eine Änderung auf Beta hat den Rechner fpr eigene LG kaputt gemacht
- Stadtplaner: Gütergebäude hatten die Farbe von Straßen

---
 
## Version 1.2
### Neu
- Gefechtslog: Der Gefechtslog wird nun ausgelesen und gespeichert, dank Arklur! Ihr findet den Button in der Gefechtsübersicht. Bitte beachtet, dass das Spiel nur die letzten 200 Einträge speichert und der Log deshalb nicht vollständig sein wird, wenn die Daten nicht regelmäßig abgerufen werden.
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