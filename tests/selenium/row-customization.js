const {assert} = require('chai');
const _ = require('lodash');
const {Promise} = require('bluebird');
const Grid = require('../lib/grid.js');
const {setupServer, sleep, createDriver} = require('../lib/util.js');

const {Builder, Browser, By, Key, until} = require('selenium-webdriver');

describe('Row Customization', function() {
	setupServer();
	let driver;

	before(async function () {
		driver = await createDriver();
	});

	after(async function () {
		if (driver != null) {
			await driver.quit();
		}
	});

	describe('in group details', function () {
		let grid;

		before(async function () {
			await driver.get('http://localhost:3000/tests/pages/grid/row-customization.html');
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
