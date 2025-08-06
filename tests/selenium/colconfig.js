const {assert} = require('chai');
const _ = require('lodash');
const Grid = require('../lib/grid.js');
const {setupServer, asyncEach, sleep} = require('../lib/util.js');

const {Builder} = require('selenium-webdriver');
const {Preferences: LoggingPrefs, Type: LoggingType, Level: LoggingLevel} = require('selenium-webdriver/lib/logging');

describe('Column Configuration', function () {
	setupServer();
	const logging = new LoggingPrefs();
	logging.setLevel(LoggingType.BROWSER, LoggingLevel.ALL);
	let driver;
	let grid;

	before(function () {
		driver = new Builder().forBrowser('chrome').setLoggingPrefs(logging).build();
	});

	after(async function () {
		if (driver != null) {
			await driver.quit();
		}
	});

	let tests = [{
		name: 'No Defn, No Prefs',
		url: 'normal-nodefn-noprefs.html',
		phases: [{
			source: 'abc.csv',
			expected: 'ABC'
		}, {
			note: 'add column',
			source: 'abcd.csv',
			expected: 'ABCD'
		}, {
			note: 'remove column',
			source: 'abc.csv',
			expected: 'ABC'
		}, {
			note: 'completely different',
			source: 'xyz.csv',
			expected: 'XYZ'
		}]
	}, {
		name: 'Defn Only',
		url: 'normal-defn-noprefs.html',
		phases: [{
			source: 'a.csv',
			expected: 'A'
		}, {
			source: 'ab.csv',
			expected: 'BA'
		}, {
			source: 'abc.csv',
			expected: 'BA'
		}, {
			source: 'xyz.csv',
			expected: ''
		}]
	}, {
		name: 'Prefs Only',
		url: 'normal-nodefn-prefs.html',
		phases: [{
			source: 'abc.csv',
			expected: 'CBA'
		}, {
			source: 'abcd.csv',
			expected: 'CBAD'
		}, {
			source: 'xyz.csv',
			expected: 'XYZ'
		}]
	}, {
		name: 'Defn and Prefs',
		url: 'normal-defn-prefs.html',
		phases: [{
			source: 'a.csv',
			expected: 'A'
		}, {
			source: 'ab.csv',
			expected: 'BA'
		}, {
			source: 'abc.csv',
			expected: 'BA'
		}, {
			source: 'abcd.csv',
			expected: 'BA'
		}, {
			source: 'xyz.csv',
			expected: ''
		}]
	}, {
		name: 'Defn and Prefs 2',
		url: 'normal-defn-prefs-2.html',
		phases: [{
			source: 'a.csv',
			expected: 'A'
		}, {
			source: 'ab.csv',
			expected: 'AB'
		}, {
			source: 'abc.csv',
			expected: 'AB'
		}, {
			source: 'abcd.csv',
			expected: 'AB'
		}, {
			source: 'xyz.csv',
			expected: ''
		}]
	}];

	_.each(tests, function (t) {
		describe(`${t.name} (${t.url})`, function () {
			before(async function () {
				await driver.get(`http://localhost:3000/tests/pages/grid/colconfig/${t.url}`);
				grid = new Grid(driver);
				await grid.waitForIdle();
			});
			after(async function () {
				await driver.executeScript('window.localStorage.clear()');
			});
			_.each(t.phases, function (p) {
				var e = p.expected.split('');
				it(`test ${p.source} -> ${JSON.stringify(e)}`, async function () {
					await grid.setSourceUrl(`data/${p.source}`);
					await grid.refresh();
					await grid.waitForIdle();
					let a = await grid.getColumns();
					assert.deepEqual(a, e);
				});
			});
		});
	});
});
