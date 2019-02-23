const assert = require('assert');
const Grid = require('../lib/grid.js');
const {sleep} = require('../lib/util.js');

const {Builder, Browser, By, Key, until} = require('selenium-webdriver');
const {Preferences: LoggingPrefs, Type: LoggingType, Level: LoggingLevel} = require('selenium-webdriver/lib/logging');

describe('Selection', function() {
	const logging = new LoggingPrefs();
	logging.setLevel(LoggingType.BROWSER, LoggingLevel.ALL);
	const driver = new Builder().forBrowser('chrome').setLoggingPrefs(logging).build();

	// We need to clear the local storage before each test.  However:
	//
	//   1. It can't be done before navigating to the page, because the browser starts on a data: URL
	//   and you're not allowed to mess with local storage there.
	//
	//   2. It can't be done after navigating to the page, because some stuff is written there before
	//   we get to run any code, which removes the prefs initialization.
	//
	// Therefore, we clear local storage after the test is done instead.  SO DON'T MOVE IT HERE!

	beforeEach(async () => {
		await driver.get('https://zeus.med-web.com/~tvenable/datavis/tests/grid/default.html');
	});

	afterEach(async () => {
		await driver.executeScript('window.localStorage.clear()');
	});

	after(() => driver && driver.quit());

	it('is correct without selection', async function () {
		let grid = new Grid(driver);
		await grid.waitForIdle();

		let selection = await grid.getSelection();

		assert.equal(selection.length, 0);
	});

	it('can select a single row', async function () {
		let grid = new Grid(driver);
		await grid.waitForIdle();

		await grid.selectRow(0);
		let selection = await grid.getSelection();

		assert.equal(selection.length, 1);
		assert.equal(selection[0]['string1'], 'ungrumbling');
	});

	it('can select all rows', async function () {
		let grid = new Grid(driver);
		await grid.waitForIdle();

		await grid.selectAll();
		let selection = await grid.getSelection();

		assert.equal(selection.length, 100);
		assert.equal(selection[0]['string1'], 'ungrumbling');
		assert.equal(selection[99]['string1'], 'cabbalize');
	});

	/*
	describe('after filtering', function () {
		it('can select a single row', async function () {
		});

		it('can select all rows', async function () {
		});

		it('maintains selection across filters', async function () {
		});
	});
	*/
});
