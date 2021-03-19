const fs            = require ("fs");
const axios         = require ("axios");
const moment        = require ("moment");
const puppeteer     = require ("puppeteer-extra");
const StealthPlugin = require ("puppeteer-extra-plugin-stealth");
const CommentJSON   = require ("comment-json");
const isPi          = require ("detect-rpi");
puppeteer.use(StealthPlugin ());

var config = {};
if (fs.existsSync("config.json")) {
	config = CommentJSON.parse(fs.readFileSync("./config.json").toString())
} else {
	config = CommentJSON.parse(fs.readFileSync("./default_config.json").toString())
}

var allHackEntries = [];

var csvWriter;

var browser;

var cacheSize      = 1;
var cacheFlushSize = cacheSize * 1000;

function sleepForTime (ms) {
	return new Promise (resolve => setTimeout (resolve, ms));
}

async function handleWebpageTemplate (links, pageCallback, type, dateFormat) {
	var i          = 0;
	var cachePages = [];

	for (let i = 0; i < cacheSize; i++) {
		var newPage = await (await browser.createIncognitoBrowserContext()).newPage();
		cachePages.push(newPage);
	}

	i = 0;

	do {
		cachePagePromises = [];

		cachePages.forEach(function (page, index) {
			var ret = (async function (page, index) {
				var linkHere = links[i + index];
				if (linkHere) {
					try {
						var json;
						if (type === "html") {
							await page.goto(linkHere, {
								waitUntil: "domcontentloaded",
								timeout: 300000
							});
						} else if (type === "json") {
							json = await axios.get(linkHere);
						}

						var hackEntry;
						if (type === "html") {
							hackEntry = await pageCallback (page, linkHere);
						} else if (type === "json") {
							hackEntry = await pageCallback (json.data, linkHere);
						}

						if (hackEntry) {
							if (type === "html") {
								hackEntry.url = linkHere;
							}

							// Handle date
							// Sometimes the release isn't defined
							if (hackEntry.release) {
								hackEntry.release = moment (hackEntry.release, dateFormat);
								if (!hackEntry.release.isValid())
									hackEntry.release = null;
							}

							console.log(hackEntry);

							allHackEntries.push(hackEntry);
						}

					} catch (e) {
						// Last ditch
						// Some errors are just impossible to fix :)
						console.log(linkHere);
						console.error(e.toString());
						console.trace();
						return;
					}
				}
			}) (page, index);

			cachePagePromises.push(ret);
		});

		await Promise.all(cachePagePromises);

		// Occassionally, to preserve memory
		if (i % cacheFlushSize === 0) {
			dumpCurrentData ();
		}

		i += cacheSize;
	} while (i < links.length);

	dumpCurrentData ();
}

async function pokemonArchive1 () {
	if (!config.included_scrapers.includes(1))
		return;

	var mainBrowserPage = await (await browser.createIncognitoBrowserContext()).newPage();

	await mainBrowserPage.goto("https://pokemonromhack.com/list", {
		waitUntil: "domcontentloaded",
		timeout: 300000
	});

	var links = await mainBrowserPage.evaluate(() => {
		var allLinks = Array.from(document.getElementsByTagName('a'), a => a.href);
		allLinks     = allLinks.slice(21, allLinks.length - 125);
		return allLinks;
	});

	console.log("Pokemon Archive 1 Length: " + links.length);
	console.log(links);

	await handleWebpageTemplate (links, async function returnHackEntry (page) {
		return page.evaluate(() => {
			var system = document.getElementsByClassName("entry-categories")[0].firstElementChild.innerText.split(" ")[0];
			return {
				name: document.getElementsByTagName("h1")[0].innerText,
					author: document.getElementsByTagName("b")[0].innerText,
					// Release here lacks quite a bit of accuracy
					release: document.getElementsByTagName("td")[4].innerText,
					originalgame: document.getElementsByTagName("td")[6].innerText,
					system: system,
					downloads: null,
					type: null,
					// We can't know
					important: false,
					source: "pokemonromhack list"
			}
		});
	}, "html", "YYYY");

	console.log("Done pokemonArchive1");
};

async function generalArchive1 () {
	if (!config.included_scrapers.includes(2))
		return;

	var mainBrowserPage = await (await browser.createIncognitoBrowserContext()).newPage();

	var links = [];
	var start = config.ranges[2].start_page;
	var end   = config.ranges[2].end_page;

	while (true) {
		await mainBrowserPage.goto("https://www.romhacking.net/?page=hacks&perpage=200&startpage=" + start, {
			waitUntil: "domcontentloaded",
			timeout: 300000
		});

		var partialLinks = await mainBrowserPage.evaluate(() => {
			var allLinks = Array.from(document.getElementsByClassName("col_1 Title"), a => a.firstElementChild.href);
			allLinks     = allLinks.slice(1, allLinks.length);
			return allLinks;
		});

		links = links.concat(partialLinks);

		var parts = await mainBrowserPage.evaluate(() => {
			return document.getElementsByTagName("caption")[0].innerText.split(" ");
		});
		parts[2]  = parts[2].slice(0, -1);
		if (parts[2] === parts[4] || start === end) {
			// This is the last page
			break;
		} else {
			console.log("Handled page " + start);
			start++;
		}
	}

	console.log("General Archive 1 Length: " + links.length);
	console.log(links);

	await handleWebpageTemplate (links, async function returnHackEntry (page) {
		return page.evaluate(() => {
			// There's occassionally an error, I don't know why
			// Perhaps rate limiting
			var temp = {
				name: document.getElementById("main").firstElementChild.firstElementChild.firstElementChild.innerText,
				author: document.getElementsByTagName("td")[1].firstElementChild.innerText,
				release: document.getElementsByTagName("td")[8].innerText,
				originalgame: document.getElementsByTagName("h4")[0].innerText.replace("Hack of ", ""),
				system: document.getElementsByTagName("td")[3].firstElementChild.innerText,
				downloads: document.getElementsByTagName("td")[10].innerText,
				type: document.getElementsByTagName("td")[5].innerText,
				source: "romhacking.net"
			};

			if (parseInt (temp.downloads) > 1000) {
				temp.important = true;
			} else {
				temp.important = false;
			}

			return temp;
		});
	}, "html", "DDMMMMY");

	console.log("Done generalArchive1");
}

async function smwArchive1 () {
	if (!config.included_scrapers.includes(3))
		return;

	var mainBrowserPage = await (await browser.createIncognitoBrowserContext()).newPage();

	var links = [];
	var start = config.ranges[3].start_page;
	var end   = config.ranges[3].end_page;

	while (true) {
		await mainBrowserPage.goto("https://www.smwcentral.net/?p=section&s=smwhacks&n=" + start, {
			waitUntil: "domcontentloaded",
			timeout: 300000
		});

		var partialLinks = await mainBrowserPage.evaluate(() => {
			return Array.from(document.getElementsByClassName("gray small"), a => a.previousElementSibling.previousElementSibling.href);
		});

		links = links.concat(partialLinks);

		var nextButtonImg = await mainBrowserPage.evaluate(() => {
			return document.getElementsByTagName("img")[10].src;
		});

		if (nextButtonImg === "https://www.smwcentral.net/images/next_mono.gif" || start === end) {
			// This is the last page
			break;
		} else {
			console.log("Handled page " + start);
			start++;
		}
	}

	console.log("Super Mario World 1 Length: " + links.length);
	console.log(links);

	await handleWebpageTemplate (links, async function returnHackEntry (page) {
		return page.evaluate(() => {
			var temp = {
				name: document.getElementsByClassName("cell2")[0].innerText,
				author: document.getElementsByClassName("cell2")[3].innerText,
				release: document.getElementsByClassName("cell2")[1].innerText.split(" ")[0],
				originalgame: "Super Mario World",
				system: "SNES",
				downloads: document.getElementsByClassName("small")[0].innerText.split(" ")[0].replace(/\,/g, ""),
				source: "smwcentral.net smw"
			}

			if (document.getElementsByClassName("cell1")[3].innerText === "Version History:") {
				temp.type   = document.getElementsByClassName("cell2")[7].innerText;
				temp.author = document.getElementsByClassName("cell2")[3].innerText;
			}
			else {
				temp.type   = document.getElementsByClassName("cell2")[6].innerText;
				temp.author = document.getElementsByClassName("cell2")[2].innerText;
			}

			if (parseInt (temp.downloads) > 1000) {
				temp.important = true;
			} else {
				temp.important = false;
			}

			return temp;
		});
	}, "html", "YYYYMMDD");

	console.log("Done smwArchive1");
}

async function sm64Archive1 () {
	if (!config.included_scrapers.includes(4))
		return;

	var mainBrowserPage = await (await browser.createIncognitoBrowserContext()).newPage();

	var links = [];
	var start = config.ranges[4].start_page;
	var end   = config.ranges[4].end_page;

	while (true) {
		await mainBrowserPage.goto("https://www.smwcentral.net/?p=section&s=sm64hacks&n=" + start, {
			waitUntil: "domcontentloaded",
			timeout: 300000
		});

		var partialLinks = await mainBrowserPage.evaluate(() => {
			return Array.from(document.getElementsByClassName("gray small"), a => a.previousElementSibling.previousElementSibling.href);
		});

		links = links.concat(partialLinks);

		var nextButtonImg = await mainBrowserPage.evaluate(() => {
			return document.getElementsByTagName("img")[10].src;
		});

		if (nextButtonImg === "https://www.smwcentral.net/images/next_mono.gif" || start === end) {
			// This is the last page
			break;
		} else {
			console.log("Handled page " + start);
			start++;
		}
	}

	console.log("Super Mario 64 1 Length: " + links.length);
	console.log(links);

	await handleWebpageTemplate (links, async function returnHackEntry (page) {
		return page.evaluate(() => {
			var temp = {
				name: document.getElementsByClassName("cell2")[0].innerText,
				release: document.getElementsByClassName("cell2")[1].innerText.split(" ")[0],
				originalgame: "Super Mario 64",
				system: "N64",
				downloads: document.getElementsByClassName("small")[0].innerText.split(" ")[0].replace(/\,/g, ""),
				source: "smwcentral.net sm64"
			}

			if (document.getElementsByClassName("cell1")[3].innerText === "Version History:") {
				temp.type   = document.getElementsByClassName("cell2")[4].innerText + " " + document.getElementsByClassName("cell2")[6].innerText;
				temp.author = document.getElementsByClassName("cell2")[3].innerText;
			}
			else {
				temp.type   = document.getElementsByClassName("cell2")[5].innerText + " " + document.getElementsByClassName("cell2")[7].innerText;
				temp.author = document.getElementsByClassName("cell2")[2].innerText;
			}

			if (parseInt (temp.downloads) > 1000) {
				temp.important = true;
			} else {
				temp.important = false;
			}

			return temp;
		});
	}, "html", "YYYYMMDD");

	console.log("Done sm64Archive1");
}

async function yoshisIslandArchive1 () {
	if (!config.included_scrapers.includes(5))
		return;

	var mainBrowserPage = await (await browser.createIncognitoBrowserContext()).newPage();

	var links = [];
	var start = config.ranges[5].start_page;
	var end   = config.ranges[5].end_page;

	while (true) {
		await mainBrowserPage.goto("https://www.smwcentral.net/?p=section&s=yihacks&n=" + start, {
			waitUntil: "domcontentloaded",
			timeout: 300000
		});

		var partialLinks = await mainBrowserPage.evaluate(() => {
			return Array.from(document.getElementsByClassName("gray small"), a => a.previousElementSibling.previousElementSibling.href);
		});

		links = links.concat(partialLinks);

		var nextButtonImg = await mainBrowserPage.evaluate(() => {
			return document.getElementsByTagName("img")[10].src;
		});

		if (nextButtonImg === "https://www.smwcentral.net/images/next_mono.gif" || start === end) {
			// This is the last page
			break;
		} else {
			console.log("Handled page " + start);
			start++;
		}
	}

	console.log("Yoshi's Island 1 Length: " + links.length);
	console.log(links);

	await handleWebpageTemplate (links, async function returnHackEntry (page) {
		return page.evaluate(() => {
			var temp = {
				name: document.getElementsByClassName("cell2")[0].innerText,
				author: document.getElementsByClassName("cell2")[3].innerText,
				release: document.getElementsByClassName("cell2")[1].innerText.split(" ")[0],
				originalgame: "Super Mario World",
				system: "SNES",
				downloads: document.getElementsByClassName("small")[0].innerText.split(" ")[0].replace(/\,/g, ""),
				source: "smwcentral.net yoshi's island"
			}

			if (document.getElementsByClassName("cell1")[3].innerText === "Version History:") {
				temp.type   = document.getElementsByClassName("cell2")[5].innerText;
				temp.author = document.getElementsByClassName("cell2")[3].innerText;
			}
			else {
				temp.type   = document.getElementsByClassName("cell2")[4].innerText;
				temp.author = document.getElementsByClassName("cell2")[2].innerText;
			}

			if (parseInt (temp.downloads) > 1000) {
				temp.important = true;
			} else {
				temp.important = false;
			}

			return temp;
		});
	}, "html", "YYYYMMDD");

	console.log("Done yoshisIslandArchive1");
}

async function sm64Archive2 () {
	if (!config.included_scrapers.includes(6))
		return;

	var mainBrowserPage = await (await browser.createIncognitoBrowserContext()).newPage();

	await mainBrowserPage.goto("https://mario64hacks.fandom.com/wiki/List_of_N64_Hacks", {
		waitUntil: "domcontentloaded",
		timeout: 300000
	});

	var links = await mainBrowserPage.evaluate(() => {
		var allLinks = [];

		for (var tables = 0; tables < 4; tables++) {
			allLinks = allLinks.concat(Array.from(document.getElementsByTagName("table")[tables].firstElementChild.children).filter(function (element, index) {
																																return index !== 0 && element.firstElementChild.firstElementChild && element.firstElementChild.firstElementChild.tagName === "A" && element.firstElementChild.firstElementChild.href !== "";
																															})
										   .map(element => element.firstElementChild.firstElementChild.href));
		}

		var haveReachedPoint = false;
		Array.from(document.getElementById("mw-content-text").children).forEach(function (element) {
			if (haveReachedPoint) {
				if (element.firstElementChild && element.firstElementChild.tagName === "A") {
					var href = element.firstElementChild.href;
					if (href != "") {
						allLinks.push(href);
					}
				}
			} else {
				if (element.firstElementChild && element.firstElementChild.id === "Hacks_to_be_added_to_this_list:") {
					haveReachedPoint = true;
				}
			}
		})

		return allLinks;
	});

	console.log("Super Mario 64 2 Length: " + links.length);
	console.log(links);

	await handleWebpageTemplate (links, async function returnHackEntry (page) {
		var shouldInclude = await page.evaluate(() => {
			return document.getElementsByClassName("pi-data-value pi-font").length != 0;
		});

		if (shouldInclude) {
			return page.evaluate(() => {
				var temp = {
					name: document.getElementsByClassName("page-header__title")[0].innerText,
					author: document.getElementsByClassName("pi-data-value pi-font")[0].innerText.split(" ")[0],
					originalgame: "Super Mario 64",
					system: "N64",
					downloads: null,
					type: null,
					source: "mario64hacks wiki sm64"
				};

				if (document.getElementsByClassName("pi-data-label pi-secondary-font")[1].innerText === "Published") {
					temp.release   = document.getElementsByClassName("pi-data-value pi-font")[1].innerText;
					temp.important = parseInt (document.getElementsByClassName("pi-data-value pi-font")[2].innerText) >= 70;
				} else {
					temp.release   = null;
					temp.important = parseInt (document.getElementsByClassName("pi-data-value pi-font")[1].innerText) >= 70;
				}

				return temp;
			});
		} else {
			return undefined;
		}
	}, "html", ["MMMMDDYYYY", "DDMMMMYYYY"]);

	console.log("Done sm64Archive2");
};

async function sm64DSArchive1 () {
	if (!config.included_scrapers.includes(7))
		return;

	var mainBrowserPage = await (await browser.createIncognitoBrowserContext()).newPage();

	await mainBrowserPage.goto("https://mario64hacks.fandom.com/wiki/List_of_DS_Hacks", {
		waitUntil: "domcontentloaded",
		timeout: 300000
	});

	var links = await mainBrowserPage.evaluate(() => {
		var allLinks = [];

		for (var tables = 0; tables < 5; tables++) {
			allLinks = allLinks.concat(Array.from(document.getElementsByTagName("table")[tables].firstElementChild.children).filter(function (element, index) {
																																return index !== 0 && element.firstElementChild.firstElementChild && element.firstElementChild.firstElementChild.tagName === "A" && element.firstElementChild.firstElementChild.href !== "";
																															})
										   .map(element => element.firstElementChild.firstElementChild.href));
		}

		return allLinks;
	});

	console.log("Super Mario 64 DS 1 Length: " + links.length);
	console.log(links);

	await handleWebpageTemplate (links, async function returnHackEntry (page) {
		var shouldInclude = await page.evaluate(() => {
			return document.getElementsByClassName("pi-data-value pi-font").length != 0;
		});

		if (shouldInclude) {
			return page.evaluate(() => {
				var temp = {
					name: document.getElementsByClassName("page-header__title")[0].innerText,
					author: document.getElementsByClassName("pi-data-value pi-font")[0].innerText.split(" ")[0],
					originalgame: "Super Mario 64 DS",
					system: "NDS",
					downloads: null,
					type: null,
					source: "mario64hacks wiki sm64ds"
				};

				if (document.getElementsByClassName("pi-data-label pi-secondary-font")[1].innerText === "Published") {
					temp.release   = document.getElementsByClassName("pi-data-value pi-font")[1].innerText.replace("Demo: ", "");
					temp.important = parseInt (document.getElementsByClassName("pi-data-value pi-font")[2].innerText) >= 70;
				} else {
					temp.release   = null;
					temp.important = parseInt (document.getElementsByClassName("pi-data-value pi-font")[1].innerText) >= 70;
				}

				return temp;
			});
		} else {
			return undefined;
		}
	}, "html", ["MMMMDDYYYY", "DDMMMMYYYY"]);

	console.log("Done sm64DSArchive1");
};

async function pokemonArchive2 () {
	if (!config.included_scrapers.includes(8))
		return;

	var mainBrowserPage = await (await browser.createIncognitoBrowserContext()).newPage();

	await mainBrowserPage.goto("https://www.gbahacks.com/p/pokemon-rom-hack-list.html", {
		waitUntil: "domcontentloaded",
		timeout: 300000
	});

	var links = await mainBrowserPage.evaluate(() => {
		var allLinks = Array.from(document.getElementsByClassName("item"), a => a.parentElement.href);
		// Only include ones with pages
		allLinks = allLinks.filter(item => item && item.indexOf("www.gbahacks.com") !== -1);
		return allLinks;
	});

	console.log("Pokemon Archive 2 Length: " + links.length);
	console.log(links);

	await handleWebpageTemplate (links, async function returnHackEntry (page) {
		var hackEntry;

		var isNormalLayout = await page.evaluate(() => {
			return document.getElementsByClassName("pblock").length != 0;
		});

		var gameMapping = {
			": Fire Red": "Pokemon Fire Red",
			": FireRed": "Pokemon Fire Red",
			": Red": "Pokemon Fire Red",
			": Crystal": "Pokemon Crystal",
			": Gold": "Pokemon Gold",
			": Emerald(?)": "Pokemon Emerald",
			": Gold": "Pokemon Gold",
			": Ruby": "Pokemon Ruby",
			": Red": "Pokemon Red",
			": Emerald": "Pokemon Emerald"
		};

		if (isNormalLayout) {
			// New layout
			hackEntry = await page.evaluate((gameMapping) => {
				if (document.querySelector("[itemprop='name']")) {
					return {
						name: document.querySelector("[itemprop='name']").innerText,
						author: document.querySelector("[itemprop='author']").innerText,
						// Not the release date sadly, only the update time
						release: document.getElementsByTagName("h4")[1].innerText.replace("Updated: ", ""),
						originalgame: gameMapping[document.getElementsByTagName("b")[2].nextSibling.textContent],
						system: document.querySelector("[itemprop='gamePlatform']").innerText,
						downloads: null,
						type: null,
						// We can't know
						important: false,
						source: "gbahacks.com"
					};
				} else {
					return {
						name: document.getElementsByClassName("post-title entry-title")[0].innerText,
							author: document.getElementsByClassName("pblock")[0].children[14].innerText,
							// Not the release date sadly, only the update time
							release: document.getElementsByTagName("h4")[1].innerText.replace("Updated: ", ""),
							originalgame: gameMapping[document.getElementsByClassName("pblock")[0].children[8].nextSibling],
							system: document.getElementsByClassName("pblock")[0].children[6].innerText,
							downloads: null,
							type: null,
							// We can't know
							important: false
					}
				}
			}, gameMapping);
		} else {
			// Old layout
			hackEntry = await page.evaluate((gameMapping) => {
				var start = document.getElementsByTagName("h4")[3];

				function advanceForwards (element, numberOfElements) {
					for (let i = 0; i < numberOfElements; i++) {
						element = element.nextSibling;
					}
					return element;
				}

				return {
					name: advanceForwards (start, 1).textContent.replace("\nName: ", ""),
						author: advanceForwards (start, 7).textContent.replace("\nCreator: ", ""),
						// Not the release date sadly, only the update time
						release: document.getElementsByTagName("h4")[1].innerText.replace("Updated on- ", ""),
						originalgame: gameMapping[advanceForwards (start, 3).textContent.replace("\nHack of", "")],
						system: document.getElementsByClassName("post-title entry-title")[0].innerText.split(" ").pop(),
						downloads: null,
						type: null,
						// We can't know
						important: false,
						source: "gbahacks.com"
				}
			}, gameMapping);
		}

		return hackEntry;
	}, "html", ["MMMMDDYYYY", "DDMMMMYYYY"]);

	console.log("Done pokemonArchive2");
};

async function smspowerArchive1 () {
	if (!config.included_scrapers.includes(9))
		return;

	var mainBrowserPage = await (await browser.createIncognitoBrowserContext()).newPage();

	await mainBrowserPage.goto("https://www.smspower.org/Hacks/GameModifications", {
		waitUntil: "domcontentloaded",
		timeout: 300000
	});

	var links = await mainBrowserPage.evaluate(() => {
		var allLinks = Array.from(document.getElementsByTagName("h3"), a => a.firstElementChild.href);
		return allLinks;
	});

	console.log("Sega Archive 1 Length: " + links.length);
	console.log(links);

	await handleWebpageTemplate (links, async function returnHackEntry (page) {
		await sleepForTime (10 * 1000);

		return page.evaluate(() => {
			var systemMapping = {
				"Mod (SMS)": "Sega Master System",
				"Mod (GG)": "Sega Game Gear"
			};

			var parts = document.getElementsByClassName("pagetitle")[0].innerText.split(" - ");
			return {
				name: parts[1],
					author: document.getElementsByTagName("td")[5].innerText,
					release: document.getElementsByTagName("td")[4].innerText,
					originalgame: parts[0],
					system: systemMapping[parts[2]],
					downloads: null,
					type: null,
					// We can't know
					important: false,
					source: "smspower.org"
			}
		});
	}, "html", ["YYYY", "DDMMMMYYYY"]);

	console.log("Done smspowerArchive1");
};

async function atari2600Archive () {
	if (!config.included_scrapers.includes(10))
		return;

	var mainBrowserPage = await (await browser.createIncognitoBrowserContext()).newPage();
	var cachePages      = [];

	for (let i = 0; i < cacheSize; i++) {
		var newPage = await (await browser.createIncognitoBrowserContext()).newPage();
		cachePages.push(newPage);
	}

	var links = [];
	var start = config.ranges[10].start_page;
	var end   = config.ranges[10].end_page;

	while (true) {
		await mainBrowserPage.goto("https://atariage.com/software_hacks.php?SystemID=2600&currentPage=" + (start - 1), {
			waitUntil: "domcontentloaded",
			timeout: 300000
		});

		var partialLinks = await mainBrowserPage.evaluate(() => {
			var allLinks = Array.from(document.getElementsByTagName("tbody")[17].children);
			allLinks     = allLinks.slice(1, allLinks.length - 1).map(a => a.firstElementChild.firstElementChild.href);
			return allLinks;
		});

		links = links.concat(partialLinks);

		var shouldBreak = await mainBrowserPage.evaluate(() => {
			var table = document.querySelector("[valign='top'][align='left']").children;
			return table[table.length - 4].innerText !== "Next";
		});

		if (shouldBreak || start === end) {
			// This is the last page
			break;
		} else {
			console.log("Handled page " + start);
			start++;
		}

		await sleepForTime (10 * 1000);
	}

	console.log("Atari 2600 1 Length: " + links.length);
	console.log(links);

	await handleWebpageTemplate (links, async function returnHackEntry (page) {
		await sleepForTime (10 * 1000);

		return page.evaluate(() => {
			var infoTable = document.querySelector("[cellspacing='0'][cellpadding='4']").firstElementChild.children;

			var temp = {
				name: document.getElementsByTagName("h1")[0].innerText.split(" - ")[1],
				author: infoTable[1].children[1].innerText,
				release: infoTable[3].children[1].innerText,
				originalgame: infoTable[0].children[1].innerText.slice(0, -1),
				system: "Atari 2600",
				type: infoTable[2].children[1].firstElementChild.alt,
				downloads: null,
				important: false,
				source: "atariage.com 2600"
			}

			return temp;
		});
	}, "html", "YYYY");

	console.log("Done atari2600Archive");
}

async function gamebananaArchive (category) {
	var indices = {
		projects: 11,
		maps: 12,
		skins: 13
	};

	if (!config.included_scrapers.includes(indices[category]))
		return;

	var links = [];
	var start = config.ranges[indices[category]].start_page;
	var end   = config.ranges[indices[category]].end_page;

	while (true) {
		var projectList = (await axios.get("https://gamebanana.com/" + category + "?vl[page]=" + start + "&mid=SubmissionsList&/" + category + "=&api=SubmissionsListModule")).data;

		var partialLinks = projectList._aCellValues.filter(project => !(project._aGame._sName === "GameBanana" || project._aGame._sName === "Steam" || project._aGame._sName === "Unity 3D" || project._aGame._sName === "Unreal Engine 4")).map(project => "https://gamebanana.com/" + category + "/" + project._idItemRow + "?api=StructuredDataModule");

		links = links.concat(partialLinks);

		if (projectList._aCellValues.length === 0 || start === end) {
			// This is the last page
			break;
		} else {
			console.log("Handled page " + start);
			start++;
		}

		await sleepForTime (20 * 1000);
	}

	console.log("Gamebanana " + category + " Length: " + links.length);
	console.log(links);

	await handleWebpageTemplate (links, async function returnHackEntry (jsondata, link) {
		await sleepForTime (20 * 1000);

		if (typeof jsondata !== "string") {
			var id        = link.split("?")[0].replace("https://gamebanana.com/" + category + "/", "");
			var statsData = (await axios.get("https://gamebanana.com/" + category + "/" + id + "?api=StatsModule")).data;
			var temp      = {
                name: jsondata.name,
                author: jsondata.author.name,
                release: jsondata.datePublished.split("T")[0],
                originalgame: jsondata.isPartOf.name,
                // Always reports PC, it's so unreliable remove it entirely
                //system: jsondata.isPartOf.gamePlatform,
                system: null,
                // View count is an option?? Maybe use it???
                downloads: typeof statsData._aCellValues._nDownloadCount !== "undefined" ? statsData._aCellValues._nDownloadCount : null,
                type: (await axios.get("https://gamebanana.com/" + category + "/" + id + "?api=CategoryModule")).data._aCellValues._aCategory._sName,
                url: "https://gamebanana.com/" + category + "/" + id,
                source: "gamebanana "
			};
			temp.source += category;
			return temp;
		} else {
			// Some projects are listed as private for some reason
			return undefined;
		}
	}, "json", "YYYYMMDD");

	console.log("Done gamebananaArchive(" + category + ")");
}

async function moddbModsArchive () {
	if (!config.included_scrapers.includes(14))
		return;

	var mainBrowserPage = await (await browser.createIncognitoBrowserContext()).newPage();

	var links = [];
	var start = config.ranges[14].start_page;
	var end   = config.ranges[14].end_page;

	while (true) {
		await mainBrowserPage.goto("https://www.moddb.com/mods/page/" + start + "#modsbrowse", {
			waitUntil: "domcontentloaded",
			timeout: 300000
		});

		var partialLinks = await mainBrowserPage.evaluate(() => {
			// Some addons are bundled with mods, we don't need that
			var allLinks = Array.from(document.getElementsByClassName("rowcontent")).map(project => project.children[1].children[1].firstElementChild.href);
			return allLinks;
		});

		links = links.concat(partialLinks);

		var shouldBreak = await mainBrowserPage.evaluate(() => {
			var parts = document.getElementsByClassName("heading")[0].innerText.split(" ");
			return parts[3] === parts[5].replace(",", "").replace(")", "");
		});

		if (shouldBreak || start === end) {
			// This is the last page
			break;
		} else {
			console.log("Handled page " + start);
			start++;
		}

		await sleepForTime (60 * 1000);
	}

	console.log("ModDB Mods Archive Length: " + links.length);
	console.log(links);

	await handleWebpageTemplate (links, async function returnHackEntry (page, link) {
		await sleepForTime (60 * 1000);

		var part = await page.evaluate(() => {
			var rowList = Array.from(document.getElementsByClassName("row clear"));

			var release        = null;
			var releaseElement = rowList.filter(item => item.firstElementChild.innerText === "Release date")[0].children[1].firstElementChild;
			if (releaseElement.innerText !== "TBD") {
				release = releaseElement.dateTime;
			}

			var typeString = Array.from(document.getElementById("tagsform").children[1].firstElementChild.children).slice(1).map(tag => tag.innerText).join(", ");
			if (typeString.includes(" has not been tagged yet")) {
				typeString = null;
			}

			var temp = {
				name: document.getElementsByClassName("title")[0].firstElementChild.textContent,
				author: rowList.filter(item => item.firstElementChild.innerText === "Creator" || item.firstElementChild.innerText === "Developer")[0].children[1].innerText,
				release: release === "TBD" ? null : release,
				originalgame: rowList.filter(item => item.firstElementChild.innerText === "Game")[0].children[1].innerText,
				// I couldn't find it
				system: null,
				type: typeString,
				important: false,
				source: "moddb mods"
			}

			return temp;
		});

		await page.goto(link + "/downloads", {
			waitUntil: "domcontentloaded",
			timeout: 300000
		});

		part.downloads = await page.evaluate(() => {
			var rowList = Array.from(document.getElementsByClassName("row clear"));
			return parseInt (rowList.filter(item => item.firstElementChild.innerText === "Downloads")[0].children[1].innerText.split(" ")[0].replace(/\,/g, ""));
		});

		return part;
	}, "html", "MMMMDDYYYY");

	console.log("Done moddbModsArchive");
}

async function moddbAddonsArchive () {
	if (!config.included_scrapers.includes(15))
		return;

	var mainBrowserPage = await (await browser.createIncognitoBrowserContext()).newPage();

	var links = [];
	var start = config.ranges[15].start_page;
	var end   = config.ranges[15].end_page;

	while (true) {
		await mainBrowserPage.goto("https://www.moddb.com/addons/page/" + start + "#addonsbrowse", {
			waitUntil: "domcontentloaded",
			timeout: 300000
		});

		var partialLinks = await mainBrowserPage.evaluate(() => {
			// Some addons are bundled with mods, we don't need that
			var allLinks = Array.from(document.getElementsByClassName("rowcontent")).map(project => project.children[1].children[1].firstElementChild.href).filter(link => link && !link.includes("/mods/"))
			return allLinks;
		});

		links = links.concat(partialLinks);

		var shouldBreak = await mainBrowserPage.evaluate(() => {
			var parts = document.getElementsByClassName("heading")[0].innerText.split(" ");
			return parts[3] === parts[5].replace(",", "").replace(")", "");
		});

		if (shouldBreak || start === end) {
			// This is the last page
			break;
		} else {
			console.log("Handled page " + start);
			start++;
		}

		await sleepForTime (60 * 1000);
	}

	console.log("ModDB Addons Archive Length: " + links.length);
	console.log(links);

	await handleWebpageTemplate (links, async function returnHackEntry (page, link) {
		await sleepForTime (60 * 1000);

		var part = await page.evaluate(() => {
			var rowList = Array.from(document.getElementsByClassName("row clear"));

			var typeString = Array.from(document.getElementById("tagsform").children[1].firstElementChild.children).slice(1).map(tag => tag.innerText).join(", ");
			if (typeString.includes(" has not been tagged yet")) {
				typeString = null;
			}

			var release = rowList.filter(item => item.firstElementChild.innerText === "Added")[0].children[1].innerText;

			var temp = {
				name: document.getElementsByClassName("heading")[0].innerText,
				author: rowList.filter(item => item.firstElementChild.innerText === "Uploader")[0].children[1].innerText,
				release: release === "TBD" ? null : release,
				originalgame: document.getElementsByClassName("title")[0].firstElementChild.innerText,
				system: rowList.filter(item => item.firstElementChild.innerText === "Platforms")[0].children[1].innerText,
				type: typeString,
				important: false,
				downloads: rowList.filter(item => item.firstElementChild.innerText === "Downloads")[0].children[1].innerText.split(" ")[0].replace(/\,/g, ""),
				source: "moddb addons"
			}

			return temp;
		});

		await page.goto(link + "/downloads", {
			waitUntil: "domcontentloaded",
			timeout: 300000
		});

		part.downloads = await page.evaluate(() => {
			var rowList = Array.from(document.getElementsByClassName("row clear"));
			return parseInt (rowList.filter(item => item.firstElementChild.innerText === "Downloads")[0].children[1].innerText.split(" ")[0].replace(/\,/g, ""));
		});

		return part;
	}, "html", ["YYYY", "MMMMYYYY", "MMMMDDYYYY"]);

	console.log("Done moddbAddonsArchive");
}

async function brawlVaultArchive () {
	if (!config.included_scrapers.includes(16))
		return;

	var mainBrowserPage = await (await browser.createIncognitoBrowserContext()).newPage();

	await mainBrowserPage.goto("http://forums.kc-mm.com/Gallery/BrawlView.php?MainType=Pack", {
		waitUntil: "networkidle2",
		timeout: 300000
	});

	var lastPage = await mainBrowserPage.evaluate(() => {
		var pagesArray = document.getElementsByClassName("hackPages")[0].children[0].children;
		return parseInt (document.getElementsByClassName("hackPages")[0].children[0].children[pagesArray.length - 1].dataset.page);
	});

	var start = config.ranges[16].start_page;
	var end   = config.ranges[16].end_page;

	for (let page = start; page <= (end === -1 ? lastPage : end); page++) {
		var pageLink = "http://forums.kc-mm.com/Gallery/BrawlView.php?MainType=Pack&action=changePage&Page=" + page + "&timeFrame=-1";
		console.log(pageLink);
		await mainBrowserPage.goto(pageLink, {
			waitUntil: "domcontentloaded",
			timeout: 300000
		});
		try {
			var tempData = await mainBrowserPage.evaluate(() => {
				var tempData = [];
				var hackList = document.getElementById("hackHolder").children;
				Array.from(hackList).forEach(function (hackContainer) {
					var authors     = [];
					var authorIndex = 2;
					var readAuthors = true;
					while (readAuthors) {
						if (hackContainer.children[authorIndex].tagName === "BR") {
							readAuthors = false;
						} else {
							authors.push(hackContainer.children[authorIndex].innerText);
							authorIndex++;
						}
					}

					tempData.push({
						name: hackContainer.children[1].innerText,
						author: authors.join(", "),
						release: hackContainer.children[0].children[2].nextSibling.textContent.trimLeft(),
						originalgame: "Super Smash Bros Brawl",
						system: "Wii",
						downloads: parseInt (hackContainer.children[0].children[0].nextSibling.nextSibling.innerText),
						type: hackContainer.children[authors.length + 4].innerText.slice(1, -1),
						// None have dedicated pages, redirect to master page
						url: "http://forums.kc-mm.com/Gallery/BrawlView.php?MainType=Pack",
						source: "brawlvault"
					});
				});

				return tempData;
			});

			tempData.forEach(function (hack) {
				hack.release = moment (hack.release, "MMMMDDYYYY");
				console.log(hack);
				allHackEntries.push(hack);
			});

			dumpCurrentData ();

			// Wait a minute
			await sleepForTime (60 * 1000);
		} catch (e) {
			// Last ditch
			// Some errors are just impossible to fix :)
			console.log(pageLink);
			console.error(e.toString());
			console.trace();
		}
	}

	dumpCurrentData ();

	console.log("Done brawlVaultArchive");
}

async function quakeWikiArchive () {
	if (!config.included_scrapers.includes(17))
		return;

	var mainBrowserPage = await (await browser.createIncognitoBrowserContext()).newPage();

	await mainBrowserPage.goto("https://web.archive.org/web/20200804200521/https://www.quakewiki.net/quake-1/mods/", {
		waitUntil: "networkidle2",
		timeout: 300000
	});

	var links = await mainBrowserPage.evaluate(() => {
		var allLinks = Array.from(document.getElementsByClassName("w3p-subpages")[0].children).map(project => project.firstChild.href);
		return allLinks;
	});

	console.log("Quake Wiki Length: " + links.length);
	console.log(links);

	await handleWebpageTemplate (links, async function returnHackEntry (page, link) {
		await sleepForTime (10 * 1000);

		var temp = await page.evaluate(() => {
			var downloadLinks = document.getElementsByClassName("download-link");
			var downloads     = null;
			if (downloadLinks.length !== 0) {
				var downloadText          = downloadLinks[0].innerText;
				var startDownloadTextSnip = document.getElementsByClassName("download-link")[0].innerText.indexOf("(") + 1;
				downloads                 = parseInt (downloadText.slice(startDownloadTextSnip, -1).replace(" downloads", ""));
			}

			return {
				name: document.getElementsByClassName("post-title")[0].innerText,
				author: document.getElementsByClassName("post-info")[0].innerText.replace("Posted by ", "").split(" ")[0],
				release: document.getElementsByClassName("block-content")[0].children[0].children[2].innerText.replace("Released: ", ""),
				originalgame: "Quake 1",
				system: "PC",
				type: null,
				important: false,
				downloads: downloads,
				source: "archived quakewiki.net"
			};
		});
		temp.url = link;
		return temp;
	}, "html", "YYYYMMDD");

	console.log("Done quakeWikiArchive");
}

async function nexusModsArchive () {
	if (!config.included_scrapers.includes(18))
		return;

	var mainBrowserPage = await (await browser.createIncognitoBrowserContext()).newPage();

	var link = "https://www.nexusmods.com/mods/";
	console.log(link);
	await mainBrowserPage.goto(link, {
		waitUntil: "networkidle2",
		timeout: 300000
	});

	var start = config.ranges[18].start_page;
	var end   = config.ranges[18].end_page;

	while (true) {
		await mainBrowserPage.evaluate((page) => {
			window.RH_ModList.Send('page', page.toString());
		}, start);

		await mainBrowserPage.waitFor(100);
		await mainBrowserPage.waitForSelector("loading-wheel", {
			hidden: true
		});
		await mainBrowserPage.waitFor(1000);

		try {
			var tempData = await mainBrowserPage.evaluate(() => {
				var tempData = [];
				var hackList = document.getElementsByClassName("tiles")[0].children;
				Array.from(hackList).forEach(function (hackContainer) {
					var container = hackContainer.children[1];

					var downloadsString = container.children[3].firstElementChild.children[2].innerText;
					var downloadNumber;
					if (downloadsString === "--") {
						downloadNumber = 0;
					} else if (downloadsString.endsWith("k")) {
						downloadNumber = parseFloat (downloadsString.slice(0, -1)) * 1000;
					} else if (downloadsString.endsWith("M")) {
						downloadNumber = parseFloat (downloadsString.slice(0, -1)) * 1000000;
					} else {
						downloadNumber = parseInt (downloadsString);
					}

					tempData.push({
						name: container.children[2].children[1].children[0].innerText,
						author: container.children[2].children[1].children[1].children[3].innerText.replace("Author: ", ""),
						release: container.children[2].children[1].children[1].children[1].dateTime,
						originalgame: container.children[2].children[1].children[1].children[0].children[0].innerText,
						system: "PC",
						downloads: downloadNumber,
						type: container.children[2].children[1].children[1].children[0].children[1].innerText,
						url: container.children[2].children[1].children[0].firstChild.href,
						source: "nexusmods"
					});
				});

				return tempData;
			});

			tempData.forEach(function (hack) {
				hack.release = moment (hack.release, "YYYYMMDD HHSS");
				console.log(hack);
				allHackEntries.push(hack);
			});

			dumpCurrentData ();
		} catch (e) {
			// Last ditch
			// Some errors are just impossible to fix :)
			console.log(pageLink);
			console.error(e.toString());
			console.trace();
		}

		var canFlip = await mainBrowserPage.evaluate(() => {
			var nextPage = document.getElementsByClassName("page-selected mfp-prevent-close")[0].parentElement.nextElementSibling;
			return nextPage ? true : false;
		});

		if (!canFlip || nextPage === (end + 1)) {
			break;
		} else {
			console.log("Handled page " + start);
			start++;
		}

		// Sleep for 1 minute
		await sleepForTime (60 * 1000);
	}

	dumpCurrentData ();

	console.log("Done nexusModsArchive");
}

async function curseforgeArchive (type) {
	var urlBase;
	var game;
	var system;

	// Every game supported by curseforge
	var urlMatcher = {
		"mc-mod": ["https://www.curseforge.com/minecraft/mc-mods", "Minecraft", "PC", 19],
		"mc-plugin": ["https://www.curseforge.com/minecraft/bukkit-plugins", "Minecraft", "PC", 20],
		"wow": ["https://www.curseforge.com/wow/addons", "World of Warcraft", "PC", 21],
		"sc2": ["https://www.curseforge.com/sc2/assets", "StarCraft II", "PC", 22],
		"ksp": ["https://www.curseforge.com/kerbal/ksp-mods", "Kerbal Space Program", "PC", 23],
		"ws": ["https://www.curseforge.com/wildstar/ws-addons", "WildStar", "PC", 24],
		"terraria": ["https://www.curseforge.com/terraria/maps", "Terraria", "PC", 25],
		"wot": ["https://www.curseforge.com/worldoftanks/wot-mods", "World of Tanks", "PC", 26],
		"rom": ["https://www.curseforge.com/rom/addons", "Runes of Magic", "PC", 27],
		"rift": ["https://www.curseforge.com/rift/addons", "Rift", "PC", 28],
		"skyrim": ["https://www.curseforge.com/skyrim/mods", "Skyrim", "PC", 29],
		"tsw": ["https://www.curseforge.com/tsw/tsw-mods", "The Secret World", "PC", 30],
		"teso": ["https://www.curseforge.com/teso/teso-addons", "The Elder Scrolls Online", "PC", 31],
		"sv": ["https://www.curseforge.com/stardewvalley/mods", "Stardew Valley", "PC", 32],
		"swl": ["https://www.curseforge.com/swlegends/tswl-mods", "Secret World Legends", "PC", 33],
		"coa": ["https://www.curseforge.com/chronicles-of-arcadia/addons", "Chronicles of Arcadia", "PC", 34],
		"dd": ["https://www.curseforge.com/darkestdungeon/dd-mods", "Darkest Dungeon", "PC", 35],
		"sm": ["https://www.curseforge.com/surviving-mars/mods", "Surviving Mars", "PC", 36],
		"gta5": ["https://www.curseforge.com/gta5/gta-v-mods", "Grand Theft Auto V", "PC", 37],
		"staxel": ["https://www.curseforge.com/staxel/staxel-mods", "Staxel", "PC", 38]
	};

	if (urlMatcher[type]) {
		urlBase = urlMatcher[type][0];
		game    = urlMatcher[type][1];
		system  = urlMatcher[type][2];

		if (!config.included_scrapers.includes(urlMatcher[type][3]))
			return;
	}

	var mainBrowserPage = await (await browser.createIncognitoBrowserContext()).newPage();

	await mainBrowserPage.goto(urlBase, {
		waitUntil: "domcontentloaded",
		timeout: 300000
	});

	var lastPage = await mainBrowserPage.evaluate(() => {
		var pageListContainer = document.getElementsByClassName("pagination-top");
		if (pageListContainer.length === 0) {
			return 1;
		} else {
			var pagesArray = pageListContainer[0].children;
			return parseInt (pagesArray[pagesArray.length - 2].innerText);
		}
	});

	var start = config.ranges[urlMatcher[type][3]].start_page;
	var end   = config.ranges[urlMatcher[type][3]].end_page;

	for (let page = start; page <= (end === -1 ? lastPage : end); page++) {
		var pageLink = urlBase + "?page=" + page;
		console.log(pageLink);
		await mainBrowserPage.goto(pageLink, {
			waitUntil: "domcontentloaded",
			timeout: 300000
		});

		try {
			var tempData = await mainBrowserPage.evaluate(() => {
				var tempData = [];
				var hackList = document.getElementsByClassName("my-4")[0].previousElementSibling.firstElementChild.children;
				Array.from(hackList).forEach(function (hackContainer) {
					var container = hackContainer.firstElementChild;

					var downloadsString = container.children[1].children[1].children[0].innerText.replace(" Downloads", "");
					var downloadNumber;
					if (downloadsString.endsWith("K")) {
						downloadNumber = parseFloat (downloadsString.slice(0, -1)) * 1000;
					} else if (downloadsString.endsWith("M")) {
						downloadNumber = parseFloat (downloadsString.slice(0, -1)) * 1000000;
					} else {
						downloadNumber = parseInt (downloadsString);
					}

					var types = Array.from(container.children[2].children[1].children).map(function (typeImage) {
						return typeImage.firstElementChild.firstElementChild.title;
					});

					tempData.push({
						name: container.children[0].children[1].children[0].innerText,
						author: container.children[0].children[1].children[2].innerText,
						release: container.children[1].children[1].children[2].innerText.replace("Created ", ""),
						downloads: downloadNumber,
						type: types.join(", "),
						url: container.children[0].children[1].children[0].href,
						source: "curseforge"
					});
				});

				return tempData;
			});

			tempData.forEach(function (hack) {
				hack.release      = moment (hack.release, "MMMMDDYYYY");
				hack.originalgame = game;
				hack.system       = system;
				console.log(hack);
				allHackEntries.push(hack);
			});
		} catch (e) {
			// Last ditch
			// Some errors are just impossible to fix :)
			console.log(pageLink);
			console.error(e.toString());
			console.trace();
		}

		dumpCurrentData ();

		// Sleep for 1 minute
		await sleepForTime (60 * 1000);
	}

	dumpCurrentData ();

	console.log("Done curseforgeArchive(" + type + ")");
}

async function wolfenVaultArchive () {
	if (!config.included_scrapers.includes(39))
		return;

	var mainBrowserPage = await (await browser.createIncognitoBrowserContext()).newPage();

	await mainBrowserPage.goto("http://www.wolfenvault.com/mods.html", {
		waitUntil: "networkidle2",
		timeout: 300000
	});

	var links = await mainBrowserPage.evaluate(() => {
		var allLinks = [];

		function addToTotalLinks (item) {
			allLinks = allLinks.concat(Array.from(item.children).map(item => item.firstElementChild.href));
			item     = item.nextElementSibling;
			allLinks = allLinks.concat(Array.from(item.children).map(item => item.firstElementChild.href));
			item     = item.nextElementSibling;
			allLinks = allLinks.concat(Array.from(item.children).map(item => item.firstElementChild.href));
		}

		addToTotalLinks (document.querySelector("table.auto-style17:nth-child(2) > tbody:nth-child(1) > tr:nth-child(2)"));
		addToTotalLinks (document.querySelector("table.auto-style17:nth-child(4) > tbody:nth-child(1) > tr:nth-child(2)"));
		addToTotalLinks (document.querySelector("table.auto-style17:nth-child(6) > tbody:nth-child(1) > tr:nth-child(2)"));
		addToTotalLinks (document.querySelector("table.auto-style17:nth-child(8) > tbody:nth-child(1) > tr:nth-child(2)"));

		return allLinks;
	});

	console.log("Wolfen Vault Sub-page Length: " + links.length);
	console.log(links);

	for (var i = 0; i < links.length; i++) {
		link = links[i];

		console.log(link);
		await mainBrowserPage.goto(link, {
			waitUntil: "domcontentloaded",
			timeout: 300000
		});

		try {
			var tempData = await mainBrowserPage.evaluate(() => {
				var tempData = [];
				var hackList = Array.from(document.querySelectorAll(".auto-style26, .auto-style25, .auto-style32")).filter(item => !!item.firstElementChild)[0].firstElementChild.children;
				Array.from(hackList).forEach(function (hackContainer, index) {
					if (index === 0) {
						return
					}

					var offset = !hackContainer.children[0].innerText.trim() ? 1 : 0;

					tempData.push({
						name: hackContainer.children[0 + offset].innerText,
						author: hackContainer.children[1 + offset].innerText,
						release: hackContainer.children[2 + offset].innerText,
						downloads: null,
						type: hackContainer.children[3 + offset].innerText + ", " + hackContainer.children[4 + offset].innerText + " levels",
						source: "wolfen vault"
					});
				});

				return tempData;
			});

			var gameName;
			if (link.includes("tcs")) {
				gameName = "Wolfenstein 3D";
			} else if (link.includes("reg")) {
				gameName = "Wolfenstein 3D";
			} else if (link.includes("sod")) {
				gameName = "Spear of Destiny";
			} else if (link.includes("shw")) {
				gameName = "Shareware Wolfenstein 3D";
			}

			tempData.forEach(function (hack) {
				hack.release      = moment (hack.release, "MMDDYY");
				hack.originalgame = gameName;
				hack.system       = "PC";
				hack.url          = link;
				if (link.includes("tcs"))
					hack.type += ", Modified EXE";
				console.log(hack);
				allHackEntries.push(hack);
			});
		} catch (e) {
			// Last ditch
			// Some errors are just impossible to fix :)
			console.log(pageLink);
			console.error(e.toString());
			console.trace();
		}

		dumpCurrentData ();

		// Sleep for 1 minute
		await sleepForTime (60 * 1000);
	}

	dumpCurrentData ();

	console.log("Done wolfenVaultArchive");
}

async function halfLifeWikiArchive () {
	if (!config.included_scrapers.includes(40))
		return;

	var mainBrowserPage = await (await browser.createIncognitoBrowserContext()).newPage();

	await mainBrowserPage.goto("https://half-life.fandom.com/wiki/Mods", {
		waitUntil: "domcontentloaded",
		timeout: 300000
	});

	var links = await mainBrowserPage.evaluate(() => {
		var allLinks = Array.from(document.getElementById("GoldSrc").parentElement.nextElementSibling.children).map(item => item.firstElementChild.firstElementChild ? item.firstElementChild.firstElementChild.href : null).filter(item => item && item.includes("half-life.fandom"));

		return allLinks.concat(Array.from(document.getElementById("Source").parentElement.nextElementSibling.children).map(item => item.firstElementChild ? (item.firstElementChild.firstElementChild ? item.firstElementChild.firstElementChild.href : null) : null).filter(item => item && item.includes("half-life.fandom")));
	});

	console.log("Half Life Wiki Length: " + links.length);
	console.log(links);

	await handleWebpageTemplate (links, async function returnHackEntry (page, link) {
		var temp = await page.evaluate(() => {
			return {
				name: document.querySelector("[data-source='name']").innerText,
				author: document.querySelector("[data-source='developer']").children[1].innerText.replace("\n", ", "),
				release: document.querySelector("[data-source='date']").children[1].innerText,
				// Embarrasing
				originalgame: null,
				system: document.querySelector("[data-source='platform']").children[1].innerText.replace("wikipedia:", ""),
				type: document.querySelector("[data-source='genre']").children[1].innerText + ", " + document.querySelector("[data-source='input']").children[1].innerText + ", " + document.querySelector("[data-source='mode']").children[1].innerText + ", " + document.querySelector("[data-source='engine']").children[1].innerText,
				important: false,
				downloads: null,
				source: "half-life wiki"
			};
		});
		temp.url = link;
		return temp;
	}, "html", "MMMMYYYY");

	console.log("Done halfLifeWikiArchive");
}

async function runthinkshootliveArchive (type) {
	var urlMatcher = {
		"hl": ["https://www.runthinkshootlive.com/hl", "Half Life", "PC", 41],
		"of": ["https://www.runthinkshootlive.com/of", "Opposing Force", "PC", 42],
		"hl2": ["https://www.runthinkshootlive.com/hl2", "Half Life 2", "PC", 43],
		"ep1": ["https://www.runthinkshootlive.com/ep1", "Half Life 2, Episode 1", "PC", 44],
		"ep2": ["https://www.runthinkshootlive.com/ep2", "Half Life 2, Episode 2", "PC", 45],
		"bm": ["https://www.runthinkshootlive.com/bm", "Black Mesa", "PC", 46]
	};

	if (urlMatcher[type]) {
		urlBase = urlMatcher[type][0];
		game    = urlMatcher[type][1];
		system  = urlMatcher[type][2];

		if (!config.included_scrapers.includes(urlMatcher[type][3]))
			return;
	}

	var mainBrowserPage = await (await browser.createIncognitoBrowserContext()).newPage();
	var cachePages      = [];

	for (let i = 0; i < cacheSize; i++) {
		var newPage = await (await browser.createIncognitoBrowserContext()).newPage();
		cachePages.push(newPage);
	}

	var urlBase;
	var game;
	var system;

	await mainBrowserPage.goto(urlBase, {
		waitUntil: "networkidle2",
		timeout: 300000
	});

	await mainBrowserPage.waitFor(200);

	var lastPage = await mainBrowserPage.evaluate(() => {
		var pageListContainer = document.getElementsByClassName("dataTables_paginate paging_simple_numbers")[0].children[1].children;
		return parseInt (pageListContainer[pageListContainer.length - 1].innerText);
	});

	for (let page = 1; page <= lastPage; page++) {
		try {
			var tempData = await mainBrowserPage.evaluate(() => {
				var tempData = [];
				var hackList = document.getElementsByClassName("display dataTable")[0].children[2].children;
				Array.from(hackList).forEach(function (hackContainer) {
					var date = hackContainer.children[3].innerText;
					if (date === "01 Jan 1998") {
						// Impossible guess, the game wasn't released by then
					} else if (date === "08 Nov 0215") {
						// Somebody mistyped
						date = "08 Nov 2015";
					}

					tempData.push({
						name: hackContainer.children[0].innerText,
						author: hackContainer.children[4].innerText,
						release: date,
						downloads: parseInt (hackContainer.children[5].innerText),
						type: hackContainer.children[10].innerText + ", " + hackContainer.children[11].innerText + ", " + hackContainer.children[12].innerText,
						url: hackContainer.children[0].firstElementChild.href,
						source: "runthinkshootlive"
					});
				});

				return tempData;
			});

			tempData.forEach(function (hack) {
				hack.release      = moment (hack.release, "DDMMMMYYYY");
				hack.originalgame = game;
				hack.system       = system;
				console.log(hack);
				allHackEntries.push(hack);
			});
		} catch (e) {
			// Last ditch
			// Some errors are just impossible to fix :)
			console.log(pageLink);
			console.error(e.toString());
			console.trace();
		}

		if (page != lastPage) {
			await mainBrowserPage.click(".next");
		}

		// Sleep for 1 minute
		await sleepForTime (60 * 1000);
	}

	dumpCurrentData ();

	console.log("Done runthinkshootliveArchive");
}

async function gta5Archive () {
	if (!config.included_scrapers.includes(47))
		return;

	var mainBrowserPage = await (await browser.createIncognitoBrowserContext()).newPage();
	var cachePages      = [];

	for (let i = 0; i < cacheSize; i++) {
		var newPage = await (await browser.createIncognitoBrowserContext()).newPage();
		cachePages.push(newPage);
	}

	await mainBrowserPage.goto("https://www.gta5-mods.com/all/most-downloaded", {
		waitUntil: "networkidle2",
		timeout: 300000
	});

	var links = [];
	var start = config.ranges[47].start_page;
	var end   = config.ranges[47].end_page;

	while (true) {
		await mainBrowserPage.goto("https://www.gta5-mods.com/all/most-downloaded/" + start, {
			waitUntil: "domcontentloaded",
			timeout: 300000
		});

		var partialLinks = await mainBrowserPage.evaluate(() => {
															  return Array.from(document.getElementsByClassName("file-list")[0].firstElementChild.children).map(item => item.firstElementChild.firstElementChild.href) });

		links = links.concat(partialLinks);

		var shouldBreak = await mainBrowserPage.evaluate(() => {
			document.getElementsByClassName("next disabled").length !== 0;
		});

		if (shouldBreak || start === end) {
			// This is the last page
			break;
		} else {
			console.log("Handled page " + start);
			start++;
		}

		// Sleep for 1 minute
		await sleepForTime (60 * 1000);
	}

	console.log("GTAV Mods Archive Length: " + links.length);
	console.log(links);

	await handleWebpageTemplate (links, async function returnHackEntry (page, link) {
		var part = await page.evaluate(() => {
			return {
				name: document.getElementsByClassName("clearfix")[1].innerText.trim(),
					author: document.getElementsByClassName("username")[0].innerText,
					release: document.getElementById("file-dates").children[1].innerText.replace("\nFirst Uploaded:\n", "").replace("\n", ""),
					originalgame: "GTA V",
					system: "PC",
					type: document.getElementById("tag-list").innerText.trim().replace(/\s+/g, ", "),
					important: false,
					downloads: parseInt (document.getElementsByClassName("file-stat file-downloads pull-left")[0].firstElementChild.innerText.replace(/\,/g, "")),
					source: "gtav mods"
			}
		});
		part.url = link;
		return part;
	}, "html", "MMMMDDYYYY");

	console.log("Done gta5Archive");
}

function dumpCurrentData () {
	allHackEntries.forEach((input) => {
		var data = [
			input.name ? '"' + input.name.replace(/\"/g, "'") + '"' : "",
			input.author ? '"' + input.author.replace(/\"/g, "'") + '"' : "",
			input.release ? (input.release.isValid() ? input.release.format("MMMM Do YYYY") : "") : "",
			input.release ? input.release.valueOf() || "" : "",
			input.originalgame ? '"' + input.originalgame.replace(/\"/g, "'") + '"' : "",
			input.system ? '"' + input.system.replace(/\"/g, "'") + '"' : "",
			typeof input.downloads !== "undefined" ? input.downloads : "",
			input.type ? '"' + input.type.replace(/\"/g, "'") + '"' : "",
			input.important ? "TRUE" : "FALSE",
			input.url ? '"' + input.url + '"' : "",
			input.source ? input.source : "",
		];

		csvWriter.write(data.join(",") + "\n");
	});
	allHackEntries.length = 0;
}

(async () => {
	var name = "database.csv";

	browser = await puppeteer.launch({
		headless: true,
		// https://github.com/puppeteer/puppeteer/issues/550#issuecomment-635718872
		executablePath: isPi () ? "chromium-browser" : undefined,
		args: [
			"—-timeout=300000", // 5 minute timeout LUL
			"--headless",
			"--no-sandbox",
			"--ignore-certificate-errors",
			"--no-sandbox",
			"--disable-setuid-sandbox",
			"--disable-accelerated-2d-canvas",
			"--disable-gp",
			"--disable-dev-shm-usage",
			"--no-first-run",
			"--no-zygote",
			"--disable-gpu"
		]
	});

	console.log("Browser opened");

	csvWriter = fs.createWriteStream(name, {
		flags: "w"
	});

	csvWriter.write("Name,Author,Release,Release (UNIX Timestamp),Original Game,System,Downloads,Type,Important,Url,Source\n");

	// https://pokemonromhack.com/list
	await pokemonArchive1 ();

	// https://www.romhacking.net/?page=hacks
	await generalArchive1 ();

	// https://www.smwcentral.net/?p=section&s=smwhacks
	await smwArchive1 ();

	// https://www.smwcentral.net/?p=section&s=sm64hacks
	await sm64Archive1 ();

	// https://www.smwcentral.net/?p=section&s=yihacks
	await yoshisIslandArchive1 ();

	// https://mario64hacks.fandom.com/wiki/List_of_N64_Hacks
	await sm64Archive2 ();

	// https://mario64hacks.fandom.com/wiki/List_of_DS_Hacks
	await sm64DSArchive1 ();

	// ttps://www.gbahacks.com/p/pokemon-rom-hack-list.html
	await pokemonArchive2 ();

	// https://www.smspower.org/Hacks/GameModifications
	await smspowerArchive1 ();

	// https://atariage.com/software_hacks.php?SystemID=2600
	await atari2600Archive ();

	// https://gamebanana.com/projects?mid=SubmissionsList
	await gamebananaArchive ("projects");

	// https://gamebanana.com/maps?mid=SubmissionsList
	await gamebananaArchive ("maps");

	// https://gamebanana.com/skins?mid=SubmissionsList
	await gamebananaArchive ("skins");

	// https://www.moddb.com/mods
	await moddbModsArchive ();

	// https://www.moddb.com/addons
	await moddbAddonsArchive ();

	// http://forums.kc-mm.com/Gallery/BrawlView.php?MainType=Pack
	await brawlVaultArchive ();

	// https://web.archive.org/web/20200804200521/https://www.quakewiki.net/quake-1/mods/
	await quakeWikiArchive ();

	// https://www.nexusmods.com/mods/
	await nexusModsArchive ();

	// https://www.curseforge.com/minecraft/mc-mods
	await curseforgeArchive ("mc-mod");

	// https://www.curseforge.com/minecraft/bukkit-plugins
	await curseforgeArchive ("mc-plugin");

	// https://www.curseforge.com/wow/addons
	await curseforgeArchive ("wow");

	// https://www.curseforge.com/sc2/assets
	await curseforgeArchive ("sc2");

	// https://www.curseforge.com/kerbal/ksp-mods
	await curseforgeArchive ("ksp");

	// https://www.curseforge.com/wildstar/ws-addons
	await curseforgeArchive ("ws");

	// https://www.curseforge.com/terraria/maps
	await curseforgeArchive ("terraria");

	// https://www.curseforge.com/worldoftanks/wot-mods
	await curseforgeArchive ("wot");

	// https://www.curseforge.com/rom/addons
	await curseforgeArchive ("rom");

	// https://www.curseforge.com/rift/addons
	await curseforgeArchive ("rift");

	// https://www.curseforge.com/skyrim/mods
	await curseforgeArchive ("skyrim");

	// https://www.curseforge.com/tsw/tsw-mods
	await curseforgeArchive ("tsw");

	// https://www.curseforge.com/teso/teso-addons
	await curseforgeArchive ("teso");

	// https://www.curseforge.com/stardewvalley/mods
	await curseforgeArchive ("sv");

	// https://www.curseforge.com/swlegends/tswl-mods
	await curseforgeArchive ("swl");

	// https://www.curseforge.com/chronicles-of-arcadia/addons
	await curseforgeArchive ("coa");

	// https://www.curseforge.com/darkestdungeon/dd-mods
	await curseforgeArchive ("dd");

	// https://www.curseforge.com/surviving-mars/mods
	await curseforgeArchive ("sm");

	// https://www.curseforge.com/gta5/gta-v-mods
	await curseforgeArchive ("gta5");

	// https://www.curseforge.com/staxel/staxel-mods
	await curseforgeArchive ("staxel");

	// http://www.wolfenvault.com/mods.html
	await wolfenVaultArchive ();

	// https://half-life.fandom.com/wiki/Mods
	await halfLifeWikiArchive ();

	// https://www.runthinkshootlive.com/hl
	await runthinkshootliveArchive ("hl");

	// https://www.runthinkshootlive.com/of
	await runthinkshootliveArchive ("of");

	// https://www.runthinkshootlive.com/hl2
	await runthinkshootliveArchive ("hl2");

	// https://www.runthinkshootlive.com/ep1
	await runthinkshootliveArchive ("ep1");

	// https://www.runthinkshootlive.com/ep2
	await runthinkshootliveArchive ("ep2");

	// https://www.runthinkshootlive.com/bm
	await runthinkshootliveArchive ("bm");

	// https://www.gta5-mods.com/all/most-downloaded
	await gta5Archive ();

	await browser.close();

	if (config.included_scrapers.includes(0)) {
		var additionalHacks = require ("./additional.js");
		additionalHacks.forEach(function (hack) {
			// Correct date
			hack.release = moment (hack.release, ["DDMMYYYY", "MMMMDDYYYY", "YYYY"]);
		});
		console.log("Additional Hacks Length: " + additionalHacks.length);

		additionalHacks.forEach(hack => console.log(hack));

		allHackEntries = additionalHacks;

		dumpCurrentData ();
	}

	csvWriter.end();

	await (new Promise (res => csvWriter.on("finish", res)));
}) ();