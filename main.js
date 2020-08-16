const puppeteer = require("puppeteer");
const fs = require("fs");

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
				downloads: null
			}
		});

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
			return {
				name: document.getElementById("main").firstElementChild.firstElementChild.firstElementChild.innerText,
				author: document.getElementsByTagName("td")[1].firstElementChild.innerText,
				release: document.getElementsByTagName("td")[8].innerText,
				originalgame: document.getElementsByTagName("h4")[0].innerText.replace("Hack of ", ""),
				system: document.getElementsByTagName("td")[3].firstElementChild.innerText,
				downloads: document.getElementsByTagName("td")[10].innerText
			}
		});

		console.log(hackEntry);

		allHackEntries.push(hackEntry);
	}
}



(async () => {
	const browser = await puppeteer.launch();

	console.log("Browser opened");

	//await pokemonArchive1(browser);
	await generalArchive1(browser);

	var hackData = fs.createWriteStream("hacks.txt");

	allHackEntries.forEach(function (hack) {
		hackData.write(hack.name + "|" + hack.originalgame + "|" + hack.system + "|" + hack.release + "|" + hack.author + "|" + hack.downloads);
	});

	hackData.close();

	await browser.close();
})();