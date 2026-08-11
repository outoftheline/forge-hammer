# Changelog
 
## Version 1.5.0
### New
- New window color added: Titan

### Update
- Added data for the next era
- Building Efficiency: Reworked the UI and added a filter for ascended buildings
- City Overview: Search now shows the amount of buildings found and can filter by entity id
- City Planner: added building info when only one is selected

### Bug Fixes
- GB Calculator sometimes didn't update after leveling (really fixed now!)
- Tooltips: Guild goods were calculated wrong

---
 
## Version 1.4.2
### New
- New Color added: Quantum
- A slightly different menu option was added, thanks to W0LFI

### Update
- Settings: Menu length and position now update without reloading the game
- Menu: The right and bottom menu now also slide when you scroll
- Added attrition to the GBG player view
- Changed the setting that disabled most of the GB calculator to just disable the custom inputs instead
- City Overview: The building lists now highlight the building on mouse over instead of clickling on the eye icon
- GBG Building Reccomendation: Options that will give 80%+ are now highlighted

### Bug Fixes
- GBG window could be empty
- GB Calculator sometimes didn't update after leveling

---
 
## Version 1.4.0
### New
- New contributions to your own GBs since your last login are now tracked via a new tab in the investment tracker. Click on the GB icon in the top bar when in your city. You can remove the icon in the windows settings. Thank you, Arklur
- Building Efficiency: You can now add or substract a number from the calculated score to modify it. Again, thanks to Arklur!
- GB Contribution List: A window will show up with all GBs you want to contribute to based on your message sent in a thread once you open a GB and the calculator. Cross out GBs you contributed to with a click and disable it in the general settings under Pop Ups

### Update
- City Planner: Improvements for building selection and map movement, added a selection filter to the map
- City Map: You can now also grab a list of all ascendable buildings
- GB Calculator: Got a facelift to make both views more similar. When the window is minimized, you will now see the GB and player name
- GBG Overview: Added Guild results to previous seasons when there is data
- GBG List: Added attrition when hovering the time and a highlight in the last 10 minutes before a province unlocks if the attrition is below 20%. Please note that at all times only *current* attrtion is shown, it can change any time.
- GBG Map: Now interacts with the list. Also, when hovering a province adjacent provinces that unlock earlier, will be highlighted
- Reconstruction Mode: Building list and map are now always available via buttons in the top left corner
- Added building tooltips to the production overview

### Bug Fixes
- Final improvements to the building database
- Added ally unit production
- FP in your inventory weren't updated anymore due to a game update
- Settings (local storage) can now be transferred to other worlds (on the same server) again
- Multiple bug fixes for the recurring quest tracker
- The Blue Galaxy Helper slowed down ingame collection
- GB Calculator: Max level was set to zero when switching views

---
 
## Version 1.3.4
### Update
- GBG Targets: Added color for attack type

### Bug Fixes
- Further fixes for the building database

---
 
## Version 1.3.3
### Updated
- City Planner: Added mouse wheel zoom and a smaller font size for buildings
- GBG Targets: You can set up notifications via the target, just hover the image to see it
- Sets & Chains: Should always update automatically now
- Efficiency: You can filter by building entity id now by using an underscore in front: e.g. _expedition or _gr2 for QI buildings

### Bug Fixes
- The Building database never completed on older devices or with bad internet connection which made the extension unusable 
- QI: Progress filter was on by default
- Stats: CSV Download didn't quite match the previous format

---
 
## Version 1.3.1
### Updated
- Reconstruction Mode: You can now load saved plans from the city planner into the minimap. If you place buildings of the same size and with the same street requirements / type on the same spot, they will be highlighted in green
- City Overview: Send other players cities to the planner
- City Planner: Move the map with WASD, move or delete multiple buildings at once, remove streets by using the street placement over them, plans can now be renamed
- Translations: PL (Thanks to Kafo) and FR (Thanks @Damrus le Cruel) updated
- Tooltips: When a military or goods building is collected or a production is started, the current stock is given:
    - Includes the currently started production
    - If the unit window was not opened yet, after the unit amount a +? indicates that the amount of units in stock is unknown
    - If an expansion can be bought with goods, it's cost is indicated in the tooltip and a progress bar indicates the already produced amount of these costs
- Changed the default position of the GBG targets to the top bar

### Bug Fixes
- GB Calculator: A change on Beta broke it for own GBs
- Goods productions were calculated wrong
- City Planner: Goods buildings had the wrong color
- Some windows settings were broken
- Dropdowns in the Statistics and Infobox were adjusted so they better fit the window
- Efficiency: Icons for buildings that can be ascended are back! No idea where they went
- Improved Building of the Building Meta Database
- Tooltips: Building tooltip was missing the special goods at times
- Translations: Translation data was partially not read correctly

---
 
## Version 1.2
### New
- GBG Log: The action log will now be saved when you open it. Please be aware that the game only saves the last 200 entries, so you need to collect data regularly for it to be somewhat accurate. You can access it from the GBG Overview
- GBG Targets: A bunch of the next targeted sectors will be shown on the map. Disable them or change their position in the GBG window.
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