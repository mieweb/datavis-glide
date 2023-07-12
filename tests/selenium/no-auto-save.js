const assert = require('assert');
const Grid = require('../lib/grid.js');
const {sleep} = require('../lib/util.js');
const setup = require('../lib/setup.js');

const {Builder, Browser, By, Key, until} = require('selenium-webdriver');
const {Preferences: LoggingPrefs, Type: LoggingType, Level: LoggingLevel} = require('selenium-webdriver/lib/logging');

describe('Preferences (w/o Auto Save)', function() {
	setup.server();
	const logging = new LoggingPrefs();
	logging.setLevel(LoggingType.BROWSER, LoggingLevel.ALL);
	let driver;

	before(function () {
		driver = new Builder().forBrowser('chrome').setLoggingPrefs(logging).build();
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

	beforeEach(async function () {
		await driver.get('http://localhost:3000/grid/no-auto-save.html');
	});

	afterEach(async function () {
		await driver.executeScript('window.localStorage.clear()');
	});

	after(async function () {
		if (driver != null) {
			await driver.quit();
		}
	});

	it('test 1', async function () {
		let grid = new Grid(driver);
		await grid.waitForIdle();

		// Group by something.

		await grid.addGroup('country');
		await grid.waitForIdle();
		assert.deepEqual(await grid.getGroup(), ['country']);

		// Make sure the grouping stuck.

		await driver.navigate().refresh();
		await grid.waitForIdle();
		assert.equal(await grid.getPerspective(), 'Main Perspective');
		assert.deepEqual(await grid.getGroup(), []);
	});

	it('test 2', async function () {
		let grid = new Grid(driver);
		await grid.waitForIdle();

		// Group by something.

		await grid.addGroup('country');
		await grid.waitForIdle();
		assert.deepEqual(await grid.getGroup(), ['country']);
		assert.equal(await grid.getPerspective(), '[*] Main Perspective');

		// Save the perspective.

		await grid.savePrefs();

		// Make sure the perspective dropdown shows it was saved.

		await grid.waitForIdle();
		assert.equal(await grid.getPerspective(), 'Main Perspective');

		// Make sure the grouping stuck.

		await driver.navigate().refresh();
		await grid.waitForIdle();
		assert.deepEqual(await grid.getGroup(), ['country']);
		assert.equal(await grid.getPerspective(), 'Main Perspective');
	});

	it('test 3', async function () {
		let grid = new Grid(driver);
		await grid.waitForIdle();

		// Group by something.

		await grid.addGroup('country');
		await grid.waitForIdle();
		assert.deepEqual(await grid.getGroup(), ['country']);
		assert.equal(await grid.getPerspective(), '[*] Main Perspective');

		// Save the perspective.

		await grid.savePrefs();

		// Make sure the perspective dropdown shows it was saved.

		await grid.waitForIdle();
		assert.equal(await grid.getPerspective(), 'Main Perspective');

		// Pivot by something.

		await grid.addPivot('fruit');
		await grid.waitForIdle();
		assert.deepEqual(await grid.getPivot(), ['fruit']);
		assert.equal(await grid.getPerspective(), '[*] Main Perspective');

		// Make sure the grouping stuck, but not the pivotting.

		await driver.navigate().refresh();
		await grid.waitForIdle();
		assert.deepEqual(await grid.getGroup(), ['country']);
		assert.deepEqual(await grid.getPivot(), []);
		assert.equal(await grid.getPerspective(), 'Main Perspective');
	});
});
