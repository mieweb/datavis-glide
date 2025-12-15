const {assert} = require('chai');
const _ = require('lodash');
const {Promise} = require('bluebird');
const Grid = require('../lib/grid.js');
const {setupServer, sleep} = require('../lib/util.js');

const {Builder, Browser, By, Key, until} = require('selenium-webdriver');
const {Preferences: LoggingPrefs, Type: LoggingType, Level: LoggingLevel} = require('selenium-webdriver/lib/logging');

describe('Drill Down', function() {
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

	describe('in pivot table', function () {
		let grid;

		before(async function () {
			await driver.get('http://localhost:3000/tests/pages/grid/default.html');
			grid = new Grid(driver);
			await grid.waitForIdle();

			await grid.addGroup('country');
			await grid.waitForIdle();

			await grid.addPivot('fruit');
			await grid.waitForIdle();
		});

		after(async function () {
			await driver.executeScript('window.localStorage.clear()');
		});

		//it('has correct group aggregates', async function () { });

		it('in pivot aggregate', async function () {
			await grid.drillDown('pivot', null, ['Cherry']);
			// FIXME: The "wait for idle" here doesn't work, have to manually wait instead.
			await grid.waitForIdle();
			sleep(0.2);
			assert.equal(await grid.getNumRows(), 9);
			assert.deepEqual(_.map(await grid.getPlainData_asObjects(['rowId']), (row) => +row['rowId']), [20, 28, 40, 49, 51, 55, 58, 66, 88]);
		});

		//it('has correct cell aggregates', async function () { });
		//it('has correct all aggregates', async function () { });
	});
});
