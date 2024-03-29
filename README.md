# Romhack/Mod Gigalist Creator

A script to download info from many different sites and compile a massive `csv` file containing info about romhacks and mods that could be useful to data analysis. The script is expected to take many hours, based on your internet speed and processor speed, and is completely dependent on website layout (if it updates) and whether you are rate limited. To install, either `git clone` this repo or download the source. Use a terminal in the project directory and run `npm i`. To run, find a computer you aren't using and run `node main.js`. Once done, a `database.csv` file will be created that you can then inspect and analyze.

A `config.json` can be used to specify which scrapers you would like to put to use.

# Included sites
* [pokemonromhack.com](https://pokemonromhack.com/list) (key 1)
* [romhacking.net](https://www.romhacking.net/?page=hacks) (key 2)
* [smwcentral.net Super Mario World hacks](https://www.smwcentral.net/?p=section&s=smwhacks) (key 3)
* [smwcentral.net Super Mario 64 hacks](https://www.smwcentral.net/?p=section&s=sm64hacks) (key 4)
* [smwcentral.net Yoshi's Island hacks](https://www.smwcentral.net/?p=section&s=yihacks) (key 5)
* [mario64hacks.fandom.com List of N64 Hacks](https://mario64hacks.fandom.com/wiki/List_of_N64_Hacks) (key 6)
* [SM64DS Romhacking Wiki List of DS Hacks](https://sm64dsromhacking.miraheze.org/wiki/List_of_Hacks) (key 7)
* [gbahacks.com](https://www.gbahacks.com/p/pokemon-rom-hack-list.html) (key 8)
* [smspower.org](https://www.smspower.org/Hacks/GameModifications) (key 9)
* [atariage.com](https://atariage.com/software_hacks.php?SystemID=2600) (key 10)
* [gamebanana.com mods](https://gamebanana.com/mods?mid=SubmissionsList) (key 11)
* [gamebanana.com maps](https://gamebanana.com/maps?mid=SubmissionsList) (key 12)
* [gamebanana.com skins](https://gamebanana.com/skins?mid=SubmissionsList) (key 13)
* [moddb.com mods](https://www.moddb.com/mods) (key 14)
* [moddb.com addons](https://www.moddb.com/addons) (key 15)
* [BrawlVault](http://forums.kc-mm.com/Gallery/BrawlView.php?MainType=Pack) (key 16)
* [quakewiki.net (archived)](https://web.archive.org/web/20200804200521/https://www.quakewiki.net/quake-1/mods/) (key 17)
* [nexusmods.com](https://www.nexusmods.com/mods/) (key 18)
* [curseforge.com Minecraft mods](https://www.curseforge.com/minecraft/mc-mods) (key 19)
* [curseforge.com Minecraft Bukkit plugins](https://www.curseforge.com/minecraft/bukkit-plugins) (key 20)
* [curseforge.com World of Warcraft](https://www.curseforge.com/wow/addons) (key 21)
* [curseforge.com Starcraft II](https://www.curseforge.com/sc2/assets) (key 22)
* [curseforge.com Kerbal Space Program](https://www.curseforge.com/kerbal/ksp-mods) (key 23)
* [curseforge.com WildStar](https://www.curseforge.com/wildstar/ws-addons) (key 24)
* [curseforge.com Terraria](https://www.curseforge.com/terraria/maps) (key 25)
* [curseforge.com World of Tanks](https://www.curseforge.com/worldoftanks/wot-mods) (key 26)
* [curseforge.com Runes of Magic](https://www.curseforge.com/rom/addons) (key 27)
* [curseforge.com Rift](https://www.curseforge.com/rift/addons) (key 28)
* [curseforge.com Skyrim](https://www.curseforge.com/skyrim/mods) (key 29)
* [curseforge.com The Secret World](https://www.curseforge.com/tsw/tsw-mods) (key 30)
* [curseforge.com The Elder Scrolls Online](https://www.curseforge.com/teso/teso-addons) (key 31)
* [curseforge.com Stardew Valley](https://www.curseforge.com/stardewvalley/mods) (key 32)
* [curseforge.com Secret World Legends](https://www.curseforge.com/swlegends/tswl-mods) (key 33)
* [curseforge.com Chronicles of Arcadia](https://www.curseforge.com/chronicles-of-arcadia/addons) (key 34)
* [curseforge.com Darkest Dungeon](https://www.curseforge.com/darkestdungeon/dd-mods) (key 35)
* [curseforge.com Surviving Mars](https://www.curseforge.com/surviving-mars/mods) (key 36)
* [curseforge.com GTA V](https://www.curseforge.com/gta5/gta-v-mods) (key 37)
* [curseforge.com Staxel](https://www.curseforge.com/staxel/staxel-mods) (key 38)
* [wolfenvault.com](http://www.wolfenvault.com/mods.html) (key 39)
* [half-life.fandom.com](https://half-life.fandom.com/wiki/Mods) (key 40)
* [runthinkshootlive.com Half Life](https://www.runthinkshootlive.com/hl) (key 41)
* [runthinkshootlive.com Opposing Force](https://www.runthinkshootlive.com/of) (key 42)
* [runthinkshootlive.com Half Life 2](https://www.runthinkshootlive.com/hl2) (key 43)
* [runthinkshootlive.com Half Life 2, Episode 1](https://www.runthinkshootlive.com/ep1) (key 44)
* [runthinkshootlive.com Half Life 2, Episode 2](https://www.runthinkshootlive.com/ep2) (key 45)
* [runthinkshootlive.com Black Mesa](https://www.runthinkshootlive.com/bm) (key 46)
* [gta5-mods.com](https://www.gta5-mods.com/all/most-downloaded) (key 47)

Each key can be used to choose what scrapers you would like to enable for a given session.

In addition, a small list of mods that are not present on any list are present in the `additional.js` file (key 0). If you wish to add a new list or a new additional item, please PR.