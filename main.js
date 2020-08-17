const puppeteer = require("puppeteer");
const fs = require("fs");
const XLSX = require("node-xlsx");

var allHackEntries = [];

async function pokemonArchive1(browser) {
	const page = await browser.newPage();
	await page.goto("https://pokemonromhack.com/list", {
		waitUntil: "domcontentloaded"
	});

	var links = await page.evaluate(() => {
		var allLinks = Array.from(document.getElementsByTagName('a'), a => a.href);
		allLinks = allLinks.slice(21, allLinks.length - 125);
		return allLinks;
	});

	console.log(links);

	for (let i = 0; i < links.length; i++) {
		await page.goto(links[i], {
			waitUntil: "domcontentloaded"
		});

		var hackEntry = await page.evaluate(() => {
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
				important: false
			}
		});

		hackEntry.url = links[i];

		console.log(hackEntry);

		allHackEntries.push(hackEntry);
	}
};

async function generalArchive1(browser) {
	const page = await browser.newPage();
	await page.goto("https://www.romhacking.net/?page=hacks&perpage=200", {
		waitUntil: "domcontentloaded"
	});

	var links = [];
	var start = 1;

	while (true) {
		var partialLinks = await page.evaluate(() => {
			var allLinks = Array.from(document.getElementsByClassName("col_1 Title"), a => a.firstElementChild.href);
			allLinks = allLinks.slice(1, allLinks.length);
			return allLinks;
		});

		links = links.concat(partialLinks);

		var parts = await page.evaluate(() => {
			return document.getElementsByTagName("caption")[0].innerText.split(" ");
		});
		parts[2] = parts[2].slice(0, -1);
		if (parts[2] === parts[4]) {
			// This is the last page
			break;
		} else {
			console.log("Handled page " + start);
			start++;
			await page.goto("https://www.romhacking.net/?page=hacks&perpage=200&startpage=" + start, {
				waitUntil: "domcontentloaded"
			});
		}
	}

	console.log(links);

	for (let i = 0; i < links.length; i++) {
		await page.goto(links[i], {
			waitUntil: "domcontentloaded"
		});

		var hackEntry = await page.evaluate(() => {
			var temp = {
				name: document.getElementById("main").firstElementChild.firstElementChild.firstElementChild.innerText,
				author: document.getElementsByTagName("td")[1].firstElementChild.innerText,
				release: document.getElementsByTagName("td")[8].innerText,
				originalgame: document.getElementsByTagName("h4")[0].innerText.replace("Hack of ", ""),
				system: document.getElementsByTagName("td")[3].firstElementChild.innerText,
				downloads: document.getElementsByTagName("td")[10].innerText,
				type: document.getElementsByTagName("td")[5].innerText,
			};

			if (parseInt(temp.downloads) > 1000) {
				temp.important = true;
			} else {
				temp.important = false;
			}

			return temp;
		});

		hackEntry.url = links[i];

		console.log(hackEntry);

		allHackEntries.push(hackEntry);
	}
}

async function smwArchive1(browser) {
	const page = await browser.newPage();
	await page.goto("https://www.smwcentral.net/?p=section&s=smwhacks", {
		waitUntil: "domcontentloaded"
	});

	var links = [];
	var start = 1;

	while (true) {
		var partialLinks = await page.evaluate(() => {
			return Array.from(document.getElementsByClassName("gray small"), a => a.previousElementSibling.previousElementSibling.href);
		});

		links = links.concat(partialLinks);

		var nextButtonImg = await page.evaluate(() => {
			return document.getElementsByTagName("img")[10].src;
		});

		if (nextButtonImg === "https://www.smwcentral.net/images/next_mono.gif") {
			// This is the last page
			break;
		} else {
			console.log("Handled page " + start);
			start++;
			await page.goto("https://www.smwcentral.net/?p=section&s=smwhacks&n=" + start, {
				waitUntil: "domcontentloaded"
			});
		}
	}

	console.log(links);

	for (let i = 0; i < links.length; i++) {
		await page.goto(links[i], {
			waitUntil: "domcontentloaded"
		});

		var hackEntry = await page.evaluate(() => {
			var temp = {
				name: document.getElementsByClassName("cell2")[0].innerText,
				author: document.getElementsByClassName("cell2")[3].innerText,
				release: document.getElementsByClassName("cell2")[1].innerText.split(" ")[0],
				originalgame: "Super Mario World",
				system: "SNES",
				downloads: document.getElementsByClassName("small")[0].innerText.split(" ")[0].replace(/\,/g, "")
			}

			if (document.getElementsByClassName("cell1")[3].innerText === "Version History:") {
				temp.type = document.getElementsByClassName("cell2")[7].innerText;
				temp.author = document.getElementsByClassName("cell2")[3].innerText;
			} else {
				temp.type = document.getElementsByClassName("cell2")[6].innerText;
				temp.author = document.getElementsByClassName("cell2")[2].innerText;
			}

			if (parseInt(temp.downloads) > 1000) {
				temp.important = true;
			} else {
				temp.important = false;
			}

			return temp;
		});

		hackEntry.url = links[i];

		console.log(hackEntry);

		allHackEntries.push(hackEntry);
	}
}

async function sm64Archive1(browser) {
	const page = await browser.newPage();
	await page.goto("https://www.smwcentral.net/?p=section&s=sm64hacks", {
		waitUntil: "domcontentloaded"
	});

	var links = [];
	var start = 1;

	while (true) {
		var partialLinks = await page.evaluate(() => {
			return Array.from(document.getElementsByClassName("gray small"), a => a.previousElementSibling.previousElementSibling.href);
		});

		links = links.concat(partialLinks);

		var nextButtonImg = await page.evaluate(() => {
			return document.getElementsByTagName("img")[10].src;
		});

		if (nextButtonImg === "https://www.smwcentral.net/images/next_mono.gif") {
			// This is the last page
			break;
		} else {
			console.log("Handled page " + start);
			start++;
			await page.goto("https://www.smwcentral.net/?p=section&s=sm64hacks&n=" + start, {
				waitUntil: "domcontentloaded"
			});
		}
	}

	console.log(links);

	for (let i = 0; i < links.length; i++) {
		await page.goto(links[i], {
			waitUntil: "domcontentloaded"
		});

		var hackEntry = await page.evaluate(() => {
			var temp = {
				name: document.getElementsByClassName("cell2")[0].innerText,
				release: document.getElementsByClassName("cell2")[1].innerText.split(" ")[0],
				originalgame: "Super Mario 64",
				system: "N64",
				downloads: document.getElementsByClassName("small")[0].innerText.split(" ")[0].replace(/\,/g, "")
			}

			if (document.getElementsByClassName("cell1")[3].innerText === "Version History:") {
				temp.type = document.getElementsByClassName("cell2")[4].innerText + " " + document.getElementsByClassName("cell2")[6].innerText;
				temp.author = document.getElementsByClassName("cell2")[3].innerText;
			} else {
				temp.type = document.getElementsByClassName("cell2")[5].innerText + " " + document.getElementsByClassName("cell2")[7].innerText;
				temp.author = document.getElementsByClassName("cell2")[2].innerText;
			}

			if (parseInt(temp.downloads) > 1000) {
				temp.important = true;
			} else {
				temp.important = false;
			}

			return temp;
		});

		hackEntry.url = links[i];

		console.log(hackEntry);

		allHackEntries.push(hackEntry);
	}
}

async function yoshisIslandArchive1(browser) {
	const page = await browser.newPage();
	await page.goto("https://www.smwcentral.net/?p=section&s=yihacks", {
		waitUntil: "domcontentloaded"
	});

	var links = [];
	var start = 1;

	while (true) {
		var partialLinks = await page.evaluate(() => {
			return Array.from(document.getElementsByClassName("gray small"), a => a.previousElementSibling.previousElementSibling.href);
		});

		links = links.concat(partialLinks);

		var nextButtonImg = await page.evaluate(() => {
			return document.getElementsByTagName("img")[10].src;
		});

		if (nextButtonImg === "https://www.smwcentral.net/images/next_mono.gif") {
			// This is the last page
			break;
		} else {
			console.log("Handled page " + start);
			start++;
			await page.goto("https://www.smwcentral.net/?p=section&s=yihacks&n=" + start, {
				waitUntil: "domcontentloaded"
			});
		}
	}

	console.log(links);

	for (let i = 0; i < links.length; i++) {
		await page.goto(links[i], {
			waitUntil: "domcontentloaded"
		});

		var hackEntry = await page.evaluate(() => {
			var temp = {
				name: document.getElementsByClassName("cell2")[0].innerText,
				author: document.getElementsByClassName("cell2")[3].innerText,
				release: document.getElementsByClassName("cell2")[1].innerText.split(" ")[0],
				originalgame: "Super Mario World",
				system: "SNES",
				downloads: document.getElementsByClassName("small")[0].innerText.split(" ")[0].replace(/\,/g, "")
			}

			if (document.getElementsByClassName("cell1")[3].innerText === "Version History:") {
				temp.type = document.getElementsByClassName("cell2")[5].innerText;
				temp.author = document.getElementsByClassName("cell2")[3].innerText;
			} else {
				temp.type = document.getElementsByClassName("cell2")[4].innerText;
				temp.author = document.getElementsByClassName("cell2")[2].innerText;
			}

			if (parseInt(temp.downloads) > 1000) {
				temp.important = true;
			} else {
				temp.important = false;
			}

			return temp;
		});

		hackEntry.url = links[i];

		console.log(hackEntry);

		allHackEntries.push(hackEntry);
	}
}

async function sm64Archive2(browser) {
	const page = await browser.newPage();
	await page.goto("https://mario64hacks.fandom.com/wiki/List_of_N64_Hacks", {
		waitUntil: "domcontentloaded"
	});

	var links = await page.evaluate(() => {
		var allLinks = [];

		for (var tables = 0; tables < 4; tables++) {
			allLinks = allLinks.concat(Array.from(document.getElementsByTagName("table")[tables].firstElementChild.children).filter(function(element, index) {
				return index !== 0 && element.firstElementChild.firstElementChild && element.firstElementChild.firstElementChild.tagName === "A" && element.firstElementChild.firstElementChild.href !== "";
			}).map(element => element.firstElementChild.firstElementChild.href));
		}

		var haveReachedPoint = false;
		Array.from(document.getElementById("mw-content-text").children).forEach(function(element) {
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

	console.log(links);

	for (let i = 0; i < links.length; i++) {
		await page.goto(links[i], {
			waitUntil: "domcontentloaded"
		});

		var shouldInclude = await page.evaluate(() => {
			return document.getElementsByClassName("pi-data-value pi-font").length != 0;
		});

		if (shouldInclude) {
			var hackEntry = await page.evaluate(() => {
				var temp = {
					name: document.getElementsByClassName("page-header__title")[0].innerText,
					author: document.getElementsByClassName("pi-data-value pi-font")[0].innerText.split(" ")[0],
					originalgame: "Super Mario 64",
					system: "N64",
					downloads: null,
					type: null,
				};

				if (document.getElementsByClassName("pi-data-label pi-secondary-font")[1].innerText === "Published") {
					temp.release = document.getElementsByClassName("pi-data-value pi-font")[1].innerText;
					temp.important = parseInt(document.getElementsByClassName("pi-data-value pi-font")[2].innerText) >= 70;
				} else {
					temp.release = null;
					temp.important = parseInt(document.getElementsByClassName("pi-data-value pi-font")[1].innerText) >= 70;
				}

				return temp;
			});

			hackEntry.url = links[i];

			console.log(hackEntry);

			allHackEntries.push(hackEntry);
		}
	}
};

async function sm64DSArchive1(browser) {
	const page = await browser.newPage();
	await page.goto("https://mario64hacks.fandom.com/wiki/List_of_DS_Hacks", {
		waitUntil: "domcontentloaded"
	});

	var links = await page.evaluate(() => {
		var allLinks = [];

		for (var tables = 0; tables < 5; tables++) {
			allLinks = allLinks.concat(Array.from(document.getElementsByTagName("table")[tables].firstElementChild.children).filter(function(element, index) {
				return index !== 0 && element.firstElementChild.firstElementChild && element.firstElementChild.firstElementChild.tagName === "A" && element.firstElementChild.firstElementChild.href !== "";
			}).map(element => element.firstElementChild.firstElementChild.href));
		}

		return allLinks;
	});

	console.log(links);

	for (let i = 0; i < links.length; i++) {
		await page.goto(links[i], {
			waitUntil: "domcontentloaded"
		});

		var shouldInclude = await page.evaluate(() => {
			return document.getElementsByClassName("pi-data-value pi-font").length != 0;
		});

		if (shouldInclude) {
			var hackEntry = await page.evaluate(() => {
				var temp = {
					name: document.getElementsByClassName("page-header__title")[0].innerText,
					author: document.getElementsByClassName("pi-data-value pi-font")[0].innerText.split(" ")[0],
					originalgame: "Super Mario 64 DS",
					system: "NDS",
					downloads: null,
					type: null,
				};

				if (document.getElementsByClassName("pi-data-label pi-secondary-font")[1].innerText === "Published") {
					temp.release = document.getElementsByClassName("pi-data-value pi-font")[1].innerText.replace("Demo: ", "");
					temp.important = parseInt(document.getElementsByClassName("pi-data-value pi-font")[2].innerText) >= 70;
				} else {
					temp.release = null;
					temp.important = parseInt(document.getElementsByClassName("pi-data-value pi-font")[1].innerText) >= 70;
				}

				return temp;
			});

			hackEntry.url = links[i];

			console.log(hackEntry);

			allHackEntries.push(hackEntry);
		}
	}
};

async function pokemonArchive2(browser) {
	const page = await browser.newPage();
	await page.goto("https://www.gbahacks.com/p/pokemon-rom-hack-list.html", {
		waitUntil: "domcontentloaded"
	});

	var links = await page.evaluate(() => {
		var allLinks = Array.from(document.getElementsByClassName("item"), a => a.parentElement.href);
		// Only include ones with pages
		allLinks = allLinks.filter(item => item.indexOf("www.gbahacks.com") !== -1);
		return allLinks;
	});

	console.log(links);

	for (let i = 0; i < links.length; i++) {
		await page.goto(links[i], {
			waitUntil: "domcontentloaded"
		});

		var isNormalLayout = await page.evaluate(() => {
			return document.getElementsByClassName("pblock").length != 0;
		});

		var hackEntry;
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
						important: false
					};
				} else {
					return {
						name: document.getElementsByTagName("span")[1].innerText,
						author: document.getElementsByTagName("span")[4].innerText,
						// Not the release date sadly, only the update time
						release: document.getElementsByTagName("h4")[1].innerText.replace("Updated: ", ""),
						originalgame: gameMapping[document.getElementsByTagName("b")[2].nextSibling.textContent],
						system: document.getElementsByTagName("span")[2].innerText,
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

				function advanceForwards(element, numberOfElements) {
					for (let i = 0; i < numberOfElements; i++) {
						element = element.nextSibling;
					}
					return element;
				}

				return {
					name: advanceForwards(start, 1).textContent.replace("\nName: ", ""),
					author: advanceForwards(start, 7).textContent.replace("\nCreator: ", ""),
					// Not the release date sadly, only the update time
					release: document.getElementsByTagName("h4")[1].innerText.replace("Updated on- ", ""),
					originalgame: gameMapping[advanceForwards(start, 3).textContent.replace("\nHack of", "")],
					system: document.getElementsByClassName("post-title entry-title")[0].innerText.split(" ").pop(),
					downloads: null,
					type: null,
					// We can't know
					important: false
				}
			});
		}

		hackEntry.url = links[i];

		console.log(hackEntry);

		allHackEntries.push(hackEntry);
	}
};

(async () => {
	const browser = await puppeteer.launch();

	console.log("Browser opened");

	//await pokemonArchive1(browser);
	//await generalArchive1(browser);
	//await smwArchive1(browser);
	//await sm64Archive1(browser);
	//await yoshisIslandArchive1(browser);
	//await sm64Archive2(browser);
	await sm64DSArchive1(browser);
	//await pokemonArchive2(browser);

	var name = "database.xlsx";


	if (fs.existsSync(name)) fs.unlinkSync(name);

	allHackEntries = allHackEntries.map(obj => [
		obj.name,
		obj.author,
		obj.release,
		obj.originalgame,
		obj.system,
		obj.downloads,
		obj.type,
		obj.important,
		obj.url
	]);

	allHackEntries.unshift([
		"Name",
		"Author",
		"Release",
		"Original Game",
		"System",
		"Downloads",
		"Type",
		"Important",
		"Url"
	]);

	console.log(allHackEntries);

	fs.writeFileSync(name, XLSX.build(
		[{
			name: "allhacks",
			data: allHackEntries
		}]
	));

	await browser.close();
})();