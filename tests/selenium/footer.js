const {assert} = require('chai');
const _ = require('lodash');
const {Promise} = require('bluebird');
const Grid = require('../lib/grid.js');
const {setupServer, sleep} = require('../lib/util.js');

const {Builder, Browser, By, Key, until} = require('selenium-webdriver');
const {Preferences: LoggingPrefs, Type: LoggingType, Level: LoggingLevel} = require('selenium-webdriver/lib/logging');

describe('Footer', function() {
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

	describe('in plain output', function () {
		let grid;

		before(async function () {
			await driver.get('http://localhost:3000/tests/pages/grid/footer.html');
			grid = new Grid(driver);
			await grid.waitForIdle();
		});

		after(async function () {
			await driver.executeScript('window.localStorage.clear()');
		});

		it('has currency sum', async function () {
			const footer = await grid.getPlainFooter("Amount");
			assert.equal(footer, "Sum = $1,029,734.00");
		});

		it('has string values w/ counts', async function () {
			const footer = await grid.getPlainFooter("Category");
			assert.equal(footer, "Vegetables (67), Fruit (146)");
		});
	});
});
