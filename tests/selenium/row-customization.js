const {assert} = require('chai');
const _ = require('lodash');
const {Promise} = require('bluebird');
const Grid = require('../lib/grid.js');
const {setupServer, sleep} = require('../lib/util.js');

const {Builder, Browser, By, Key, until} = require('selenium-webdriver');
const {Preferences: LoggingPrefs, Type: LoggingType, Level: LoggingLevel} = require('selenium-webdriver/lib/logging');

describe('Row Customization', function() {
	setupServer();
	const logging = new LoggingPrefs();
	logging.setLevel(LoggingType.BROWSER, LoggingLevel.ALL);
	let driver;

	before(function () {
		driver = new Builder().forBrowser('chrome').setLoggingPrefs(logging).build();
	});

	after(async function () {
		if (driver != null) {
			await driver.quit();
		}
	});

	describe('in group details', function () {
		let grid;

		before(async function () {
			await driver.get('http://localhost:3000/grid/row-customization.html');
			grid = new Grid(driver);
			await grid.waitForIdle();

			await grid.addGroup('Country');
			await grid.waitForIdle();

			await grid.addGroup('Category');
			await grid.waitForIdle();

			await grid.setGroupMode('detail');
			await grid.waitForIdle();
		});

		after(async function () {
			await driver.executeScript('window.localStorage.clear()');
		});

		it('has flag emojis', async function () {
			const australia = await grid.getGroupDetailsHeader(['Australia']);
			assert((await australia.findElements(By.xpath('//button[contains(., "🇦🇺")]'))).length === 1, 'Could not find Australian flag button');
		});

		it('has red & green categories', async function () {
			const australiaFruit = await grid.getGroupDetailsHeader(['Australia', 'Fruit']);
			const australiaVegetables = await grid.getGroupDetailsHeader(['Australia', 'Vegetables']);

			assert(await australiaFruit.getCssValue('color') === 'rgba(255, 0, 0, 1)', 'Fruit header should be red');
			assert(await australiaVegetables.getCssValue('color') === 'rgba(0, 128, 0, 1)', 'Vegetables header should be green');
		});
	});
});
