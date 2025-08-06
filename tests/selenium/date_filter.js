const assert = require('assert');
const _ = require('lodash');
const Grid = require('../lib/grid.js');
const {setupServer} = require('../lib/util.js');

const {Builder, Browser, By, Key, until} = require('selenium-webdriver');
const {Preferences: LoggingPrefs, Type: LoggingType, Level: LoggingLevel} = require('selenium-webdriver/lib/logging');

describe('Date Filter', function() {
	setupServer();
	const logging = new LoggingPrefs();
	logging.setLevel(LoggingType.BROWSER, LoggingLevel.ALL);
	let driver;
	let grid;

	before(async function () {
		driver = new Builder().forBrowser('chrome').setLoggingPrefs(logging).build();
	});

	before(async function () {
		await driver.get('http://localhost:3000/tests/pages/grid/filters/date.html');
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

	_.each(['string', 'moment', 'native'], t => {
		describe(`internal representation = ${t}`, function () {
			before(async function () {
				await grid.addFilter(`date_${t}`);
			});

			after(async function () {
				await grid.clearFilter();
				await grid.waitForIdle();
			});

			it('can filter exact date (op = $eq)', async function () {
				await grid.setFilter(`date_${t}`, 'input', '$eq', '05152024');
				await grid.waitForIdle();
				assert.equal(await grid.getNumRows(), 1);
			});

			it('can filter before (op = $lte)', async function () {
				await grid.setFilter(`date_${t}`, 'input', '$lte', '05152024');
				await grid.waitForIdle();
				assert.equal(await grid.getNumRows(), 3);
			});

			it('can filter after (op = $gte)', async function () {
				await grid.setFilter(`date_${t}`, 'input', '$gte', '05152024');
				await grid.waitForIdle();
				assert.equal(await grid.getNumRows(), 4);
			});

			describe('current (op = $this)', function () {
				it('can filter date', async function () {
					await grid.setFilter(`date_${t}`, 'date', '$this', 'DATE');
					await grid.waitForIdle();
					assert.equal(await grid.getNumRows(), 1);
				});
				it('can filter week', async function () {
					await grid.setFilter(`date_${t}`, 'date', '$this', 'WEEK');
					await grid.waitForIdle();
					assert.equal(await grid.getNumRows(), 2);
				});
				it('can filter month', async function () {
					await grid.setFilter(`date_${t}`, 'date', '$this', 'MONTH');
					await grid.waitForIdle();
					assert.equal(await grid.getNumRows(), 3);
				});
				it('can filter quarter', async function () {
					await grid.setFilter(`date_${t}`, 'date', '$this', 'QUARTER');
					await grid.waitForIdle();
					assert.equal(await grid.getNumRows(), 4);
				});
				it('can filter year', async function () {
					await grid.setFilter(`date_${t}`, 'date', '$this', 'YEAR');
					await grid.waitForIdle();
					assert.equal(await grid.getNumRows(), 5);
				});
			});

			describe('last (op = $last)', function () {
				it('can filter date', async function () {
					await grid.setFilter(`date_${t}`, 'date', '$last', 'DATE');
					await grid.waitForIdle();
					assert.equal(await grid.getNumRows(), 1);
				});
				it('can filter week', async function () {
					await grid.setFilter(`date_${t}`, 'date', '$last', 'WEEK');
					await grid.waitForIdle();
					assert.equal(await grid.getNumRows(), 1);
				});
				it('can filter month', async function () {
					await grid.setFilter(`date_${t}`, 'date', '$last', 'MONTH');
					await grid.waitForIdle();
					assert.equal(await grid.getNumRows(), 1);
				});
				it('can filter quarter', async function () {
					await grid.setFilter(`date_${t}`, 'date', '$last', 'QUARTER');
					await grid.waitForIdle();
					assert.equal(await grid.getNumRows(), 1);
				});
				it('can filter year', async function () {
					await grid.setFilter(`date_${t}`, 'date', '$last', 'YEAR');
					await grid.waitForIdle();
					assert.equal(await grid.getNumRows(), 1);
				});
			});
		});
	});

	// describe('blank filters', function () {
	// 	beforeEach(async function () {
	// 		await driver.executeScript('window.localStorage.clear()');
	// 		driver.navigate().refresh();
	// 		await grid.waitForIdle();
	// 	});

	// 	it('number filter is blank', async function () {
	// 		await grid.addFilter('int1');
	// 		await grid.addFilter('country');
	// 		await grid.setFilter('country', 'sumoselect', '$in', ['Canada']);
	// 		await grid.waitForIdle();

	// 		assert.equal(await grid.getNumRows(), 10);
	// 		assert.equal(await grid.getCell('country', 0), 'Canada');
	// 		assert.equal(await grid.getCell('country', -1), 'Canada');
	// 	});

	// 	it('date filter is blank', async function () {
	// 		await grid.addFilter('date1');
	// 		await grid.addFilter('country');
	// 		await grid.setFilter('country', 'sumoselect', '$in', ['Canada']);
	// 		await grid.waitForIdle();

	// 		assert.equal(await grid.getNumRows(), 10);
	// 		assert.equal(await grid.getCell('country', 0), 'Canada');
	// 		assert.equal(await grid.getCell('country', -1), 'Canada');
	// 	});
	// });
});
