# Changelog
 
## Version 1.3
### Updated
- Translations: PL (Thanks to Kafo) updated

### Bug Fixes
- GB Calculator: A change on Beta broke it for own GBs
- City Planner: Goods buildings had the wrong color

---
 
## Version 1.2
### New
- GBG Log: The action log will now be saved when you open it. Please be aware that the game only saves the last 200 entries, so you need to collect data regularly for it to be somewhat accurate. You can access it from the GBG Overview
- City planner: A first version is ready! Use the City Overview to send data over. Any descriptions are currently only available in English.

### Updated
- Stats: CSV export added to all line graphs: player resources, guild resources, units, GBG guild victory points, GBG player progression
- Stats: GBG player progression was moved to the GBG window and only current season will be shown from now on
- GBG Stats: Guild victory point difference can now be compared more easily
- GBG: Added option to open the window automatically when you visit the map
- Shop Assistant: Added search
- Notes: Added setting to open them automatically on game start
- Building Tooltips: now displays when a buildings production can not be accelerated by FSP and whether it upgrades automatically to current era (Thanks @WOLFI). Furthermore, it is now indicated when a building does not require a road
- Translations: FR (Thanks @Damrus le Cruel) and IT (Thanks @Alej92415) were updated

### Bug fixes
- GBG Overview: Data without entries could be shown in the history
- Translations: were not properly saved

---
 
## Version 1.1
### New
- Added a warning, when FoE Helper was detected

### Updated
- Stats: Date picker removed for line graphs - you can zoom and drag areas instead
- GBG: Map now shows what Province is hovered in the list

### Bug fixes
- Stats: Tooltip could overflow the graph

---

## Version 1.0
### New
- Notes/To Dos: Create lists for your most important plans
- GBG Stats: Guild progress is now tracked every time you open the leaderboard. It will be displayed in a chart when you click on "Stats"

### Updated
- Stats: Changed the graphs to ChartJS. You can now drag and zoom instead of selecting sections with your mouse. Data export is not a feature included with ChartJS, so this is currently gone, but will be implemented soon
- Translations: 
    - The reference string corresponding to a translated string is now saved - when the reference changes, this can be highlighted in the tool
    - When changes are stored temporarily, the updated strings will be used directly in the extension - some might need a reload though

### Bug fixes
- Technologies: A game change broke it
- GBG notifications: Work as expected again instead of sometimes doubling or just being forgotten
- Settings: Sound settings could get lost
- Settings: Menu tooltips were broken for some languages
- Settings: The Motivate/polish tracker was not added to the menu if you deactivated tracking. It now works differently

---
 
## Version 0.9
### New
- Themes! Check the settings to choose a different skin for the addon
- Game Filters! You can adjust some basic game colors in the settings now
- Change notification sound! Check the settings to choose from seven different sound effects
- Window Pop Outs: You can try an alpha version of it in the efficiency window. It will not have full functionality
- Translations: to replace weblate, a translation tool was added - it can be accessed in the Settings' language option

### Updated
- GB Calculator: Added a button at the top to easily switch views
- City Overview: New highlights for buildings that are not motivated and buildings that can be collected
- City Overview: Turn the view 90° around. Some might say this is the only true way to look at your city
- City Overview: Clicking on ascended buildings now opens a window with a list of all of them
- GBG: You can now change the time the notification shows up before a province opens in the windows settings

### Bug fixes
- City Overview: Highlighted buildings weren't always in focus

### Removed
- Any Links to FoE Helper, including city transmission
- Notes: They relied on the website for storage, so the had to go for now. We'll look for other options, but they will likely not be synced between different devices