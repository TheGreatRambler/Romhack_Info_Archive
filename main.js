const fs     = require ("fs");
const axios  = require ("axios");
const moment = require ("moment");

const puppeteer = require ("puppeteer-extra");

const StealthPlugin = require ("puppeteer-extra-plugin-stealth");
puppeteer.use(StealthPlugin ());

const AdblockerPlugin = require ("puppeteer-extra-plugin-adblocker");
puppeteer.use(AdblockerPlugin ({ blockTrackers: true }));

var allHackEntries = [];

var csvWriter;

var browser;
var mainBrowserPage;
var cachePages = [];

var cacheSize      = 8;
var cacheFlushSize = cacheSize * 1000;

async function handleWebpageTemplate (links, pageCallback, type, dateFormat) {
	var i = 0;
	do {
		cachePagePromises = [];

		cachePages.forEach(function (page, index) {
			var ret = (async function (page, index) {
				var linkHere = links[i + index];
				if (linkHere) {
					var json;
					if (type === "html") {
						await page.goto(linkHere, {
							waitUntil: "domcontentloaded",
							timeout: 0
						});
					} else if (type === "json") {
						json = await axios.get(linkHere);
					}

					var hackEntry;

					try {
						if (type === "html") {
							hackEntry = await pageCallback (page, linkHere);
						} else if (type === "json") {
							hackEntry = await pageCallback (json.data, linkHere);
						}
					} catch (e) {
						// Last ditch
						// Some errors are just impossible to fix :)
						console.log(linkHere);
						console.error(e.toString());
						console.trace();
						return;
					}

					if (hackEntry) {
						if (type === "html") {
							hackEntry.url = linkHere;
						}

						// Handle date
						// Sometimes the release isn't defined
						if (hackEntry.release) {
							hackEntry.release = moment (hackEntry.release, dateFormat);
						}

						console.log(hackEntry);

						allHackEntries.push(hackEntry);
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
}

async function pokemonArchive1 () {
	await mainBrowserPage.goto("https://pokemonromhack.com/list", {
		waitUntil: "domcontentloaded",
		timeout: 0
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
};

async function generalArchive1 () {
	await mainBrowserPage.goto("https://www.romhacking.net/?page=hacks&perpage=200", {
		waitUntil: "domcontentloaded",
		timeout: 0
	});

	var links = [];
	var start = 15;

	while (true) {
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
		if (parts[2] === parts[4] || start === 17) {
			// This is the last page
			break;
		} else {
			console.log("Handled page " + start);
			start++;
			await mainBrowserPage.goto("https://www.romhacking.net/?page=hacks&perpage=200&startpage=" + start, {
				waitUntil: "domcontentloaded"
			});
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
}

async function smwArchive1 () {
	await mainBrowserPage.goto("https://www.smwcentral.net/?p=section&s=smwhacks", {
		waitUntil: "domcontentloaded",
		timeout: 0
	});

	var links = [];
	var start = 1;

	while (true) {
		var partialLinks = await mainBrowserPage.evaluate(() => {
			return Array.from(document.getElementsByClassName("gray small"), a => a.previousElementSibling.previousElementSibling.href);
		});

		links = links.concat(partialLinks);

		var nextButtonImg = await mainBrowserPage.evaluate(() => {
			return document.getElementsByTagName("img")[10].src;
		});

		if (nextButtonImg === "https://www.smwcentral.net/images/next_mono.gif") {
			// This is the last page
			break;
		} else {
			console.log("Handled page " + start);
			start++;
			await mainBrowserPage.goto("https://www.smwcentral.net/?p=section&s=smwhacks&n=" + start, {
				waitUntil: "domcontentloaded"
			});
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
}

async function sm64Archive1 () {
	await mainBrowserPage.goto("https://www.smwcentral.net/?p=section&s=sm64hacks", {
		waitUntil: "domcontentloaded",
		timeout: 0
	});

	var links = [];
	var start = 1;

	while (true) {
		var partialLinks = await mainBrowserPage.evaluate(() => {
			return Array.from(document.getElementsByClassName("gray small"), a => a.previousElementSibling.previousElementSibling.href);
		});

		links = links.concat(partialLinks);

		var nextButtonImg = await mainBrowserPage.evaluate(() => {
			return document.getElementsByTagName("img")[10].src;
		});

		if (nextButtonImg === "https://www.smwcentral.net/images/next_mono.gif") {
			// This is the last page
			break;
		} else {
			console.log("Handled page " + start);
			start++;
			await mainBrowserPage.goto("https://www.smwcentral.net/?p=section&s=sm64hacks&n=" + start, {
				waitUntil: "domcontentloaded"
			});
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
}

async function yoshisIslandArchive1 () {
	await mainBrowserPage.goto("https://www.smwcentral.net/?p=section&s=yihacks", {
		waitUntil: "domcontentloaded",
		timeout: 0
	});

	var links = [];
	var start = 1;

	while (true) {
		var partialLinks = await mainBrowserPage.evaluate(() => {
			return Array.from(document.getElementsByClassName("gray small"), a => a.previousElementSibling.previousElementSibling.href);
		});

		links = links.concat(partialLinks);

		var nextButtonImg = await mainBrowserPage.evaluate(() => {
			return document.getElementsByTagName("img")[10].src;
		});

		if (nextButtonImg === "https://www.smwcentral.net/images/next_mono.gif") {
			// This is the last page
			break;
		} else {
			console.log("Handled page " + start);
			start++;
			await mainBrowserPage.goto("https://www.smwcentral.net/?p=section&s=yihacks&n=" + start, {
				waitUntil: "domcontentloaded"
			});
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
}

async function sm64Archive2 () {
	await mainBrowserPage.goto("https://mario64hacks.fandom.com/wiki/List_of_N64_Hacks", {
		waitUntil: "domcontentloaded",
		timeout: 0
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
};

async function sm64DSArchive1 () {
	await mainBrowserPage.goto("https://mario64hacks.fandom.com/wiki/List_of_DS_Hacks", {
		waitUntil: "domcontentloaded",
		timeout: 0
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
};

async function pokemonArchive2 () {
	await mainBrowserPage.goto("https://www.gbahacks.com/p/pokemon-rom-hack-list.html", {
		waitUntil: "domcontentloaded",
		timeout: 0
	});

	var links = await mainBrowserPage.evaluate(() => {
		var allLinks = Array.from(document.getElementsByClassName("item"), a => a.parentElement.href);
		// Only include ones with pages
		allLinks = allLinks.filter(item => item.indexOf("www.gbahacks.com") !== -1);
		return allLinks;
	});

	console.log("Pokemon Archive 2 Length: " + links.length);
	console.log(links);

	await handleWebpageTemplate (links, async function returnHackEntry (page) {
		var hackEntry;

		var isNormalLayout = await page.evaluate(() => {
			return document.getElementsByClassName("pblock").length != 0;
		});

		if (isNormalLayout) {
			// New layout
			hackEntry = await page.evaluate(() => {
				var gameMapping = {
					": Fire Red": "Pokemon Fire Red",
					": FireRed": "Pokemon Fire Red",
					": Red": "Pokemon Fire Red",
					": Crystal": "Pokemon Crystal"
				};

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
			});
		} else {
			// Old layout
			hackEntry = await page.evaluate(() => {
				var gameMapping = {
					": Fire Red": "Pokemon Fire Red",
					": FireRed": "Pokemon Fire Red",
					": Red": "Pokemon Fire Red",
					": Crystal": "Pokemon Crystal",
					": Gold": "Pokemon Gold"
				};

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
			});
		}

		return hackEntry;
	}, "html", ["MMMMDDYYYY", "DDMMMMYYYY"]);
};

async function smspowerArchive1 () {
	await mainBrowserPage.goto("https://www.smspower.org/Hacks/GameModifications", {
		waitUntil: "domcontentloaded",
		timeout: 0
	});

	var links = await mainBrowserPage.evaluate(() => {
		var allLinks = Array.from(document.getElementsByTagName("h3"), a => a.firstElementChild.href);
		return allLinks;
	});

	console.log("Sega Archive 1 Length: " + links.length);
	console.log(links);

	await handleWebpageTemplate (links, async function returnHackEntry (page) {
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
	}, "html", "YYYY");
};

async function atari2600Archive () {
	await mainBrowserPage.goto("https://atariage.com/software_hacks.php?SystemID=2600", {
		waitUntil: "domcontentloaded",
		timeout: 0
	});

	var links = [];
	var start = 0;

	while (true) {
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

		if (shouldBreak) {
			// This is the last page
			break;
		} else {
			console.log("Handled page " + (start + 1));
			start++;
			await mainBrowserPage.goto("https://atariage.com/software_hacks.php?SystemID=2600&currentPage=" + start, {
				waitUntil: "domcontentloaded"
			});
		}
	}

	console.log("Atari 2600 1 Length: " + links.length);
	console.log(links);

	await handleWebpageTemplate (links, async function returnHackEntry (page) {
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
}

async function gamebananaProjectsArchive () {
	// TODO use https://gamebanana.com/projects/35468?api=StructuredDataModule
	// https://github.com/axios/axios
	// https://www.twilio.com/blog/5-ways-to-make-http-requests-in-node-js-using-async-await
	var projectList = (await axios.get("https://gamebanana.com/projects?vl[page]=1&mid=SubmissionsList&/projects=&api=SubmissionsListModule")).data;

	var links = [];
	var start = 1;

	while (true) {
		var partialLinks = projectList._aCellValues.filter(project => project._aGame._sName !== "GameBanana").map(project => "https://gamebanana.com/projects/" + project._idItemRow + "?api=StructuredDataModule");

		links = links.concat(partialLinks);

		if (projectList._aCellValues.length === 0) {
			// This is the last page
			break;
		} else {
			console.log("Handled page " + start);
			start++;
			var projectList = (await axios.get("https://gamebanana.com/projects?vl[page]=" + start + "&mid=SubmissionsList&/projects=&api=SubmissionsListModule")).data;
		}
	}

	console.log("Gamebanana Projects Length: " + links.length);
	console.log(links);

	await handleWebpageTemplate (links, async function returnHackEntry (jsondata, link) {
		if (typeof jsondata !== "string") {
			var id        = link.split("?")[0].replace("https://gamebanana.com/projects/", "");
			var statsData = (await axios.get("https://gamebanana.com/projects/" + id + "?api=StatsModule")).data;
			return {
				name: jsondata.name,
				author: jsondata.author.name,
				release: jsondata.datePublished.split("T")[0],
				originalgame: jsondata.isPartOf.name,
				// Always reports PC, it's so unreliable remove it entirely
				//system: jsondata.isPartOf.gamePlatform,
				system: null,
				// View count is an option?? Maybe use it???
				downloads: typeof statsData._aCellValues._nDownloadCount !== "undefined" ? statsData._aCellValues._nDownloadCount : null,
				type: (await axios.get("https://gamebanana.com/projects/" + id + "?api=CategoryModule")).data._aCellValues._aCategory._sName,
				url: "https://gamebanana.com/projects/" + id,
				source: "gamebanana projects"
			};
		} else {
			// Some projects are listed as private for some reason
			return undefined;
		}
	}, "json", "YYYYMMDD");
}

async function moddbModsArchive () {
	await mainBrowserPage.goto("https://www.moddb.com/mods", {
		waitUntil: "domcontentloaded",
		timeout: 0
	});

	var links = [];
	var start = 1;

	while (true) {
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

		if (shouldBreak || start === 10) {
			// This is the last page
			break;
		} else {
			console.log("Handled page " + start);
			start++;
			await mainBrowserPage.goto("https://www.moddb.com/mods/page/" + start + "#modsbrowse", {
				waitUntil: "domcontentloaded"
			});
		}
	}

	console.log("ModDB Mods Archive Length: " + links.length);
	console.log(links);

	await handleWebpageTemplate (links, async function returnHackEntry (page, link) {
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
			timeout: 0
		});

		part.downloads = await page.evaluate(() => {
			var rowList = Array.from(document.getElementsByClassName("row clear"));
			return parseInt (rowList.filter(item => item.firstElementChild.innerText === "Downloads")[0].children[1].innerText.split(" ")[0].replace(/\,/g, ""));
		});

		return part;
	}, "html", "MMMMDDYYYY");
}

async function moddbAddonsArchive () {
	await mainBrowserPage.goto("https://www.moddb.com/addons", {
		waitUntil: "domcontentloaded",
		timeout: 0
	});

	var links = [];
	var start = 1;

	while (true) {
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

		if (shouldBreak || start === 10) {
			// This is the last page
			break;
		} else {
			console.log("Handled page " + start);
			start++;
			await mainBrowserPage.goto("https://www.moddb.com/addons/page/" + start + "#addonsbrowse", {
				waitUntil: "domcontentloaded"
			});
		}
	}

	console.log("ModDB Addons Archive Length: " + links.length);
	console.log(links);

	await handleWebpageTemplate (links, async function returnHackEntry (page, link) {
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
			timeout: 0
		});

		part.downloads = await page.evaluate(() => {
			var rowList = Array.from(document.getElementsByClassName("row clear"));
			return parseInt (rowList.filter(item => item.firstElementChild.innerText === "Downloads")[0].children[1].innerText.split(" ")[0].replace(/\,/g, ""));
		});

		return part;
	}, "html", ["YYYY", "MMMMYYYY", "MMMMDDYYYY"]);
}

async function brawlVaultArchive () {
	await mainBrowserPage.goto("http://forums.kc-mm.com/Gallery/BrawlView.php?MainType=Pack", {
		waitUntil: "domcontentloaded",
		timeout: 0
	});

	var lastPage = await mainBrowserPage.evaluate(() => {
		var pagesArray = document.getElementsByClassName("hackPages")[0].children[0].children;
		return parseInt (document.getElementsByClassName("hackPages")[0].children[0].children[pagesArray.length - 1].dataset.page);
	});

	for (let page = 1; page <= lastPage; page++) {
		var pageLink = "http://forums.kc-mm.com/Gallery/BrawlView.php?MainType=Pack&action=changePage&Page=" + page + "&timeFrame=-1";
		console.log(pageLink);
		await mainBrowserPage.goto(pageLink, {
			waitUntil: "domcontentloaded",
			timeout: 0
		});

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
	}
}

async function quakeWikiArchive () {
	await mainBrowserPage.goto("https://web.archive.org/web/20200804200521/https://www.quakewiki.net/quake-1/mods/", {
		waitUntil: "domcontentloaded",
		timeout: 0
	});

	var links = await mainBrowserPage.evaluate(() => {
		var allLinks = Array.from(document.getElementsByClassName("w3p-subpages")[0].children).map(project => project.firstChild.href);
		return allLinks;
	});

	console.log("Quake Wiki Length: " + links.length);
	console.log(links);

	await handleWebpageTemplate (links, async function returnHackEntry (page, link) {
		var temp = await page.evaluate(() => {
			var downloadText          = document.getElementsByClassName("download-link")[0].innerText;
			var startDownloadTextSnip = document.getElementsByClassName("download-link")[0].innerText.indexOf("(") + 1;

			return {
				name: document.getElementsByClassName("post-title")[0].innerText,
				author: document.getElementsByClassName("post-info")[0].innerText.replace("Posted by ", "").split(" ")[0],
				release: document.getElementsByClassName("block-content")[0].children[0].children[2].innerText.replace("Released: ", ""),
				originalgame: "Quake 1",
				system: "PC",
				type: null,
				important: false,
				downloads: parseInt (downloadText.slice(startDownloadTextSnip, -1).replace(" downloads", "")),
				source: "archived quakewiki.net"
			};
		});
		temp.url = link;
		return temp;
	}, "html", "YYYYMMDD");
}

async function nexusModsArchive () {
	var link = "https://www.nexusmods.com/mods/";
	console.log(link);
	await mainBrowserPage.goto(link, {
		waitUntil: "networkidle2",
		timeout: 0
	});

	while (true) {
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

		var nextPage = await mainBrowserPage.evaluate(() => {
			var nextPage = document.getElementsByClassName("page-selected mfp-prevent-close")[0].parentElement.nextElementSibling;
			if (nextPage) {
				return nextPage.innerText;
			} else {
				return 0;
			}
		});

		if (nextPage) {
			await mainBrowserPage.evaluate((page) => {
				window.RH_ModList.Send('page', page.toString());
			}, page);

			await mainBrowserPage.waitFor(100);
			await mainBrowserPage.waitForSelector("loading-wheel", { hidden: true });
			await mainBrowserPage.waitFor(100);
		} else {
			return;
		}
	}
}

async function curseforgeArchive (type) {
	var urlBase;
	var game;
	var system;

	// Every game supported by curseforge
	var urlMatcher = {
		"mc-mod": ["https://www.curseforge.com/minecraft/mc-mods", "Minecraft", "PC"],
		"mc-plugin": ["https://www.curseforge.com/minecraft/bukkit-plugins", "Minecraft", "PC"],
		"wow": ["https://www.curseforge.com/wow/addons", "World of Warcraft", "PC"],
		"sc2": ["https://www.curseforge.com/sc2/assets", "StarCraft II", "PC"],
		"ksp": ["https://www.curseforge.com/kerbal/ksp-mods", "Kerbal Space Program", "PC"],
		"ws": ["https://www.curseforge.com/wildstar/ws-addons", "WildStar", "PC"],
		"terraria": ["https://www.curseforge.com/terraria/maps", "Terraria", "PC"],
		"wot": ["https://www.curseforge.com/worldoftanks/wot-mods", "World of Tanks", "PC"],
		"rom": ["https://www.curseforge.com/rom/addons", "Runes of Magic", "PC"],
		"rift": ["https://www.curseforge.com/rift/addons", "Rift", "PC"],
		"skyrim": ["https://www.curseforge.com/skyrim/mods", "Skyrim", "PC"],
		"tsw": ["https://www.curseforge.com/tsw/tsw-mods", "The Secret World", "PC"],
		"teso": ["https://www.curseforge.com/teso/teso-addons", "The Elder Scrolls Online", "PC"],
		"sv": ["https://www.curseforge.com/stardewvalley/mods", "Stardew Valley", "PC"],
		"swl": ["https://www.curseforge.com/swlegends/tswl-mods", "Secret World Legends", "PC"],
		"coa": ["https://www.curseforge.com/chronicles-of-arcadia/addons", "Chronicles of Arcadia", "PC"],
		"dd": ["https://www.curseforge.com/darkestdungeon/dd-mods", "Darkest Dungeon", "PC"],
		"sm": ["https://www.curseforge.com/surviving-mars/mods", "Surviving Mars", "PC"],
		"gta5": ["https://www.curseforge.com/gta5/gta-v-mods", "Grand Theft Auto V", "PC"],
		"staxel": ["https://www.curseforge.com/staxel/staxel-mods", "Staxel", "PC"]
	};

	if (urlMatcher[type]) {
		urlBase = urlMatcher[type][0];
		game    = urlMatcher[type][1];
		system  = urlMatcher[type][2];
	}

	await mainBrowserPage.goto(urlBase, {
		waitUntil: "domcontentloaded",
		timeout: 0
	});

	var lastPage = await mainBrowserPage.evaluate(() => {
		var pageListContainer = document.getElementsByClassName("pagination-top");
		if (pageListContainer.length === 0) {
			return 1;
		} else {
			var pagesArray = [0].children;
			return parseInt (pagesArray[pagesArray.length - 2].innerText);
		}
	});

	for (let page = 1; page <= lastPage; page++) {
		var pageLink = urlBase + "?page=" + page;
		console.log(pageLink);
		await mainBrowserPage.goto(pageLink, {
			waitUntil: "domcontentloaded",
			timeout: 0
		});

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
	}
}

function dumpCurrentData () {
	allHackEntries.forEach((input) => {
		var data = [
			input.name ? '"' + input.name + '"' : "",
			input.author ? '"' + input.author + '"' : "",
			input.release ? input.release.format("MMMM Do YYYY") : "",
			input.release ? input.release.valueOf() : "",
			input.originalgame ? '"' + input.originalgame + '"' : "",
			input.system ? '"' + input.system + '"' : "",
			typeof input.downloads !== "undefined" ? input.downloads : "",
			input.type ? '"' + input.type + '"' : "",
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

	browser         = await puppeteer.launch({ headless: true });
	mainBrowserPage = await (await browser.createIncognitoBrowserContext()).newPage();

	for (let i = 0; i < cacheSize; i++) {
		var newPage = await (await browser.createIncognitoBrowserContext()).newPage();
		cachePages.push(newPage);
	}

	console.log("Browser opened");

	csvWriter = fs.createWriteStream(name, {
		flags: "w"
	});

	csvWriter.write("Name,Author,Release,Release (UNIX Timestamp),Original Game,System,Downloads,Type,Important,Url,Source\n");

	// https://pokemonromhack.com/list
	await pokemonArchive1 ();
	dumpCurrentData ();

	// https://www.romhacking.net/?page=hacks
	await generalArchive1 ();
	dumpCurrentData ();

	// https://www.smwcentral.net/?p=section&s=smwhacks
	await smwArchive1 ();
	dumpCurrentData ();

	// https://www.smwcentral.net/?p=section&s=sm64hacks
	await sm64Archive1 ();
	dumpCurrentData ();

	// https://www.smwcentral.net/?p=section&s=yihacks
	await yoshisIslandArchive1 ();
	dumpCurrentData ();

	// https://mario64hacks.fandom.com/wiki/List_of_N64_Hacks
	await sm64Archive2 ();
	dumpCurrentData ();

	// https://mario64hacks.fandom.com/wiki/List_of_DS_Hacks
	await sm64DSArchive1 ();
	dumpCurrentData ();

	// ttps://www.gbahacks.com/p/pokemon-rom-hack-list.html
	await pokemonArchive2 ();
	dumpCurrentData ();

	// https://www.smspower.org/Hacks/GameModifications
	await smspowerArchive1 ();
	dumpCurrentData ();

	// https://atariage.com/software_hacks.php?SystemID=2600
	await atari2600Archive ();
	dumpCurrentData ();

	// https://gamebanana.com/projects?mid=SubmissionsList
	await gamebananaProjectsArchive ();
	dumpCurrentData ();

	// https://www.moddb.com/mods
	await moddbModsArchive ();
	dumpCurrentData ();

	// https://www.moddb.com/addons
	await moddbAddonsArchive ();
	dumpCurrentData ();

	// http://forums.kc-mm.com/Gallery/BrawlView.php?MainType=Pack
	await brawlVaultArchive ();
	dumpCurrentData ();

	// https://web.archive.org/web/20200804200521/https://www.quakewiki.net/quake-1/mods/
	await quakeWikiArchive ();
	dumpCurrentData ();

	// https://www.nexusmods.com/mods/
	await nexusModsArchive ();
	dumpCurrentData ();

	// https://www.curseforge.com/minecraft/mc-mods
	await curseforgeArchive ("mc-mod");
	dumpCurrentData ();

	// https://www.curseforge.com/minecraft/bukkit-plugins
	await curseforgeArchive ("mc-plugin");
	dumpCurrentData ();

	// https://www.curseforge.com/wow/addons
	await curseforgeArchive ("wow");
	dumpCurrentData ();

	// https://www.curseforge.com/sc2/assets
	await curseforgeArchive ("sc2");
	dumpCurrentData ();

	// https://www.curseforge.com/kerbal/ksp-mods
	await curseforgeArchive ("ksp");
	dumpCurrentData ();

	// https://www.curseforge.com/wildstar/ws-addons
	await curseforgeArchive ("ws");
	dumpCurrentData ();

	// https://www.curseforge.com/terraria/maps
	await curseforgeArchive ("terraria");
	dumpCurrentData ();

	// https://www.curseforge.com/worldoftanks/wot-mods
	await curseforgeArchive ("wot");
	dumpCurrentData ();

	// https://www.curseforge.com/rom/addons
	await curseforgeArchive ("rom");
	dumpCurrentData ();

	// https://www.curseforge.com/rift/addons
	await curseforgeArchive ("rift");
	dumpCurrentData ();

	// https://www.curseforge.com/skyrim/mods
	await curseforgeArchive ("skyrim");
	dumpCurrentData ();

	// https://www.curseforge.com/tsw/tsw-mods
	await curseforgeArchive ("tsw");
	dumpCurrentData ();

	// https://www.curseforge.com/teso/teso-addons
	await curseforgeArchive ("teso");
	dumpCurrentData ();

	// https://www.curseforge.com/stardewvalley/mods
	await curseforgeArchive ("sv");
	dumpCurrentData ();

	// https://www.curseforge.com/swlegends/tswl-mods
	await curseforgeArchive ("swl");
	dumpCurrentData ();

	// https://www.curseforge.com/chronicles-of-arcadia/addons
	await curseforgeArchive ("coa");
	dumpCurrentData ();

	// https://www.curseforge.com/darkestdungeon/dd-mods
	await curseforgeArchive ("dd");
	dumpCurrentData ();

	// https://www.curseforge.com/surviving-mars/mods
	await curseforgeArchive ("sm");
	dumpCurrentData ();

	// https://www.curseforge.com/gta5/gta-v-mods
	await curseforgeArchive ("gta5");
	dumpCurrentData ();

	// https://www.curseforge.com/staxel/staxel-mods
	await curseforgeArchive ("staxel");
	dumpCurrentData ();

	await browser.close();

	var additionalHacks = require ("./additional.js");
	additionalHacks.forEach(function (hack) {
		// Correct date
		hack.release = moment (hack.release, ["DDMMYYYY", "MMMMDDYYYY", "YYYY"]);
	});
	console.log("Additional Hacks Length: " + additionalHacks.length);

	additionalHacks.forEach(hack => console.log(hack));

	allHackEntries = additionalHacks;

	dumpCurrentData ();

	csvWriter.end();

	await (new Promise (res => csvWriter.on("finish", res)));
}) ();