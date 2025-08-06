const {assert} = require('chai');
const _ = require('lodash');
const Grid = require('../lib/grid.js');
const {setupServer, sleep} = require('../lib/util.js');

const {Builder, Browser, By, Key, until} = require('selenium-webdriver');
const {Preferences: LoggingPrefs, Type: LoggingType, Level: LoggingLevel} = require('selenium-webdriver/lib/logging');

describe('Selection', function() {
	setupServer();
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
		await driver.get('http://localhost:3000/tests/pages/grid/default.html');
	});

	afterEach(async function () {
		await driver.executeScript('window.localStorage.clear()');
	});

	after(async function () {
		if (driver != null) {
			await driver.quit();
		}
	});

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

	describe('after grouping', function () {
		it('can select all', async function () {
			let grid = new Grid(driver);
			await grid.waitForIdle();

			await grid.addGroup('fruit');

			await grid.selectAll();
			let selection = await grid.getSelection();

			assert.equal(selection.length, 100);
		});

		it('can select one group', async function () {
			let grid = new Grid(driver);
			await grid.waitForIdle();

			await grid.addGroup('fruit');

			await grid.selectGroup('Banana');
			let selection = await grid.getSelection();
			assert.equal(selection.length, 4);
			assert.equal(selection[0]['rowId'], 12);
			assert.equal(selection[3]['rowId'], 44);

			await grid.selectGroup('Banana');
			selection = await grid.getSelection();
			assert.equal(selection.length, 0);

			await grid.selectGroup('Blueberry');
			selection = await grid.getSelection();
			assert.equal(selection.length, 11);
			assert.equal(selection[0]['rowId'], 6);
			assert.equal(selection[10]['rowId'], 98);
		});

		it('can select a nested group', async function () {
			let grid = new Grid(driver);
			await grid.waitForIdle();

			await grid.addGroup('fruit');
			await grid.addGroup('country');

			await grid.expandGroup('Grape');
			let selection;

			// Add "South Korea"

			await grid.selectGroup('Grape', 'South Korea');
			selection = await grid.getSelection();
			assert.equal(selection.length, 5);
			assert.deepEqual(_.map(selection, 'rowId'), [10, 30, 60, 70, 80]);

			// Add "England"

			await grid.selectGroup('Grape', 'England');
			selection = await grid.getSelection();
			assert.equal(selection.length, 8);
			assert.deepEqual(_.map(selection, 'rowId'), [10, 30, 60, 70, 80, 4, 74, 84]);

			// Remove "South Korea"

			await grid.selectGroup('Grape', 'South Korea');
			selection = await grid.getSelection();
			assert.equal(selection.length, 3);
			assert.deepEqual(_.map(selection, 'rowId'), [4, 74, 84]);

			// Remove "England"

			await grid.selectGroup('Grape', 'England');
			selection = await grid.getSelection();
			assert.equal(selection.length, 0);
		});
	});
});
