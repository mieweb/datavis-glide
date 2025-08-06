const {assert} = require('chai');
const _ = require('lodash');
const Grid = require('../lib/grid.js');
const {setupServer, asyncEach, sleep, isVisible} = require('../lib/util.js');

const {Builder, Browser, By, Key, until} = require('selenium-webdriver');
const {Preferences: LoggingPrefs, Type: LoggingType, Level: LoggingLevel} = require('selenium-webdriver/lib/logging');

describe('Auto Limit', function () {
	setupServer();
	const logging = new LoggingPrefs();
	logging.setLevel(LoggingType.BROWSER, LoggingLevel.ALL);
	let driver;
	let grid;

	before(function () {
		driver = new Builder().forBrowser('chrome').setLoggingPrefs(logging).build();
	});

	before(async function () {
		await driver.get('http://localhost:3000/tests/pages/grid/server-auto-limit.html');
		grid = new Grid(driver);
		await grid.waitForIdle();
	});

	// We need to clear the local storage before each test.  However:
	//
	//   1. It can't be done before navigating to the page, because the browser starts on a data: URL
	//   and you're not allowed to mess with local storage there.
	//
	//   2. It can't be done after navigating to the page, because some stuff is written there before
	//   we get to run any code, which removes the prefs initialization.
	//
	// Therefore, we clear local storage after the test is done instead.  SO DON'T MOVE IT HERE!

	after(async function () {
		await driver.executeScript('window.localStorage.clear()');
	});

	after(async function () {
		if (driver != null) {
			await driver.quit();
		}
	});

	it('is auto-limited right off the bat', async function () {
		assert.equal(await grid.getNumRows(), 50);
		assert.equal(await isVisible(grid.ui.autoLimitWarning), true);
	});

	it('is not auto-limited when it has less than 50 rows', async function () {
		await driver.findElement(By.css('input[name="state"]')).click();
		await grid.refresh();
		await grid.waitForIdle();
		assert.equal(await grid.getNumRows(), 22);
		assert.equal(await isVisible(grid.ui.autoLimitWarning), false);
	});

	it('goes back to being auto-limited after removing filter', async function () {
		await driver.findElement(By.css('input[name="state"]')).click();
		await grid.refresh();
		await grid.waitForIdle();
		assert.equal(await grid.getNumRows(), 50);
		assert.equal(await isVisible(grid.ui.autoLimitWarning), true);
	});
});
