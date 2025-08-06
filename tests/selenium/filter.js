const assert = require('assert');
const _ = require('lodash');
const Grid = require('../lib/grid.js');
const {setupServer, sleep} = require('../lib/util.js');

const {Builder, Browser, By, Key, until} = require('selenium-webdriver');
const {Preferences: LoggingPrefs, Type: LoggingType, Level: LoggingLevel} = require('selenium-webdriver/lib/logging');

describe('Filter', function() {
	setupServer();
	const logging = new LoggingPrefs();
	logging.setLevel(LoggingType.BROWSER, LoggingLevel.ALL);
	let driver;
	let grid;

	before(async function () {
		driver = new Builder().forBrowser('chrome').setLoggingPrefs(logging).build();
	});

	before(async function () {
		await driver.get('http://localhost:3000/tests/pages/grid/default.html');
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

	describe('string filter', function () {
		before(async function () {
			await grid.addFilter('country');
		});

		after(async function () {
			await grid.clearFilter();
			await grid.waitForIdle();
		});

		it('can filter one in', async function () {
			await grid.setFilter('country', 'sumoselect', '$in', ['Canada']);
			await grid.waitForIdle();

			assert.equal(await grid.getNumRows(), 10);
			assert.equal(await grid.getCell('country', 0), 'Canada');
			assert.equal(await grid.getCell('country', -1), 'Canada');
		});

		it('can filter one not-in', async function () {
			await grid.setFilter('country', 'sumoselect', '$nin', ['Canada']);
			await grid.waitForIdle();

			assert.equal(await grid.getNumRows(), 90);
		});

		it('can filter multiple in', async function () {
			await grid.setFilter('country', 'sumoselect', '$in', ['Canada', 'Japan']);
			await grid.waitForIdle();

			assert.equal(await grid.getNumRows(), 20);
			assert.equal(await grid.getCell('country', 0), 'Canada');
			assert.equal(await grid.getCell('country', -1), 'Japan');
		});

		it('can filter multiple not-in', async function () {
			await grid.setFilter('country', 'sumoselect', '$nin', ['Canada', 'Japan']);
			await grid.waitForIdle();

			assert.equal(await grid.getNumRows(), 80);
		});
	});

	describe('number filter', async function () {
		var expected = {
			'int': {
				value: '6311',
				results: [
					{ name: 'equality',                 op: '$eq',  expected: 1  },
					{ name: 'inequality',               op: '$ne',  expected: 99 },
					{ name: 'less-than',                op: '$lt',  expected: 61 },
					{ name: 'greater-than',             op: '$gt',  expected: 38 },
					{ name: 'less-than or equal-to',    op: '$lte', expected: 62 },
					{ name: 'greater-than or equal-to', op: '$gte', expected: 39 }
				],
			},
			'float_full': {
				value: '8443.374',
				results: [
					{ name: 'equality',                 op: '$eq',  expected: 0   },
					{ name: 'inequality',               op: '$ne',  expected: 100 },
					{ name: 'less-than',                op: '$lt',  expected: 77  },
					{ name: 'greater-than',             op: '$gt',  expected: 23  },
					{ name: 'less-than or equal-to',    op: '$lte', expected: 77  },
					{ name: 'greater-than or equal-to', op: '$gte', expected: 23  }
				]
			},
			'float_fixed': {
				value: '8443.374',
				results: [
					{ name: 'equality',                 op: '$eq',  expected: 1  },
					{ name: 'inequality',               op: '$ne',  expected: 99 },
					{ name: 'less-than',                op: '$lt',  expected: 77 },
					{ name: 'greater-than',             op: '$gt',  expected: 22 },
					{ name: 'less-than or equal-to',    op: '$lte', expected: 78 },
					{ name: 'greater-than or equal-to', op: '$gte', expected: 23 }
				]
			}
		};
		_.each([
			{ field: 'int1', source: 'number', rep: 'primitive', ex: 'int' },
			{ field: 'int2', source: 'string', rep: 'primitive', ex: 'int' },
			{ field: 'int3', source: 'string w/ commas', rep: 'primitive', ex: 'int' },
			{ field: 'int4', source: 'number', rep: 'numeral', ex: 'int' },
			{ field: 'int5', source: 'string', rep: 'numeral', ex: 'int' },
			{ field: 'int6', source: 'string w/ commas', rep: 'numeral', ex: 'int' },
			{ field: 'int7', source: 'number', rep: 'bignumber', ex: 'int' },
			{ field: 'int8', source: 'string', rep: 'bignumber', ex: 'int' },
			{ field: 'int9', source: 'string w/ commas', rep: 'bignumber', ex: 'int' },
			{ field: 'float1', source: 'number', rep: 'primitive', ex: 'float_full' },
			{ field: 'float2', source: 'string', rep: 'primitive', ex: 'float_full' },
			{ field: 'float3', source: 'string w/ commas', rep: 'primitive', ex: 'float_fixed' },
			{ field: 'float4', source: 'number', rep: 'numeral', ex: 'float_full' },
			{ field: 'float5', source: 'string', rep: 'numeral', ex: 'float_full' },
			{ field: 'float6', source: 'string w/ commas', rep: 'numeral', ex: 'float_fixed' },
			{ field: 'float7', source: 'number', rep: 'bignumber', ex: 'float_full' },
			{ field: 'float8', source: 'string', rep: 'bignumber', ex: 'float_full' },
			{ field: 'float9', source: 'string w/ commas', rep: 'bignumber', ex: 'float_fixed' }
		], function ({field, source, rep, ex}) {
			describe(field + ' (' + source + ' --> ' + rep + ')', function () {
				before(async function () {
					await grid.addFilter(field);
				});

				after(async function () {
					await grid.clearFilter();
					await grid.waitForIdle();
				});

				_.each(expected[ex].results, function (r) {
					it('can filter ' + r.name, async function () {
						await grid.setFilter(field, 'input', r.op, expected[ex].value);
						await grid.waitForIdle();

						assert.equal(await grid.getNumRows(), r.expected);
					});
				});
			});
		});
	});

	describe('blank filters', function () {
		beforeEach(async function () {
			await driver.executeScript('window.localStorage.clear()');
			driver.navigate().refresh();
			await grid.waitForIdle();
		});

		it('number filter is blank', async function () {
			await grid.addFilter('int1');
			await grid.addFilter('country');
			await grid.setFilter('country', 'sumoselect', '$in', ['Canada']);
			await grid.waitForIdle();

			assert.equal(await grid.getNumRows(), 10);
			assert.equal(await grid.getCell('country', 0), 'Canada');
			assert.equal(await grid.getCell('country', -1), 'Canada');
		});

		it('date filter is blank', async function () {
			await grid.addFilter('date1');
			await grid.addFilter('country');
			await grid.setFilter('country', 'sumoselect', '$in', ['Canada']);
			await grid.waitForIdle();

			assert.equal(await grid.getNumRows(), 10);
			assert.equal(await grid.getCell('country', 0), 'Canada');
			assert.equal(await grid.getCell('country', -1), 'Canada');
		});
	});
});
