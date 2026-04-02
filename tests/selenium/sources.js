const assert = require('assert');
const Grid = require('../lib/grid.js');
const {setupServer, sleep, createDriver} = require('../lib/util.js');

const {Builder, Browser, By, Key, until} = require('selenium-webdriver');

describe('Sources', function() {
	setupServer();
	let driver;

	before(async function () {
		driver = await createDriver();
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

	// beforeEach(async function () {
	// 	await driver.get('http://localhost:3000/tests/pages/grid/no-auto-save.html');
	// });

	afterEach(async function () {
		await driver.executeScript('window.localStorage.clear()');
	});

	after(async function () {
		if (driver != null) {
			await driver.quit();
		}
	});

	describe('HTTP/JSON', function () {
		before(async function () {
			await driver.get('http://localhost:3000/tests/pages/grid/source/http-json.html');
		});

		it('loads correctly', async function () {
			let grid = new Grid(driver);
			await grid.waitForIdle();
			assert.equal(await grid.getNumRows(), 100);
		});
	});

	describe('HTTP/XML', function () {
		before(async function () {
			await driver.get('http://localhost:3000/tests/pages/grid/source/http-xml.html');
		});

		it('loads correctly', async function () {
			let grid = new Grid(driver);
			await grid.waitForIdle();
			assert.equal(await grid.getNumRows(), 100);
		});
	});

	describe('HTTP/CSV', function () {
		before(async function () {
			await driver.get('http://localhost:3000/tests/pages/grid/source/http-csv.html');
		});

		it('loads correctly', async function () {
			let grid = new Grid(driver);
			await grid.waitForIdle();
			assert.equal(await grid.getNumRows(), 100);
		});
	});

	describe('Local', function () {
		before(async function () {
			await driver.get('http://localhost:3000/tests/pages/grid/source/local.html');
		});

		it('loads correctly', async function () {
			let grid = new Grid(driver);
			await grid.waitForIdle();
			assert.equal(await grid.getNumRows(), 20);
		});
	});

	describe('Table', function () {
		before(async function () {
			await driver.get('http://localhost:3000/tests/pages/grid/source/table.html');
		});

		it('loads correctly', async function () {
			await driver.findElement(By.id('convert')).click();
			let grid = new Grid(driver);
			await grid.waitForIdle();
			assert.equal(await grid.getNumRows(), 100);
		});
	});
});
