const {assert} = require('chai');
const _ = require('lodash');
const Grid = require('../lib/grid.js');
const {setupServer, asyncEach, sleep, createDriver} = require('../lib/util.js');

const {Builder, Browser, By, Key, until} = require('selenium-webdriver');

describe('Group Functions', function () {
	setupServer();
	let driver;
	let grid;

	before(async function () {
		driver = await createDriver();
	});

	after(async function () {
		if (driver != null) {
			await driver.quit();
		}
	});

	let fields = {
		date: ['date1', 'date2', 'date3'],
		datetime: ['datetime1', 'datetime2', 'datetime3'],
	};
	let groupFuns = {
		date: ['year', 'quarter', 'month', 'week_iso', 'day_of_week', 'year_and_quarter', 'year_and_month', 'year_and_week_iso'],
		datetime: ['year', 'quarter', 'month', 'week_iso', 'day', 'day_of_week', 'year_and_quarter', 'year_and_month', 'year_and_week_iso'],
	};
	let expected = {
		year: {
			first: '1901',
			last: '2094',
			counts: {
				'1901': 1,
				'2094': 1,
				'1978': 3,
			}
		},
		quarter: {
			counts: {
				'Q1': 27,
				'Q2': 30,
				'Q3': 21,
				'Q4': 22,
			}
		},
		month: {
			counts: {
				'Jan': 13,
				'Feb': 5,
				'Mar': 9,
				'Apr': 9,
				'May': 14,
				'Jun': 7,
				'Jul': 8,
				'Aug': 8,
				'Sep': 5,
				'Oct': 4,
				'Nov': 9,
				'Dec': 9
			}
		},
		day_of_week: {
			counts: {
				'Mon': 12,
				'Tue': 13,
				'Wed': 11,
				'Thu': 14,
				'Fri': 21,
				'Sat': 13,
				'Sun': 16,
			}
		},
	};

	_.each(fields, function (fs, t) {
		_.each(fs, function (f) {
			describe(`grouping by ${f} (${t})`, function () {
				before(async function () {
					await driver.get('http://localhost:3000/tests/pages/grid/default.html');
					grid = new Grid(driver);
					await grid.waitForIdle();
					await grid.addGroup(f, 'none');
					sleep(1); // give a sec for the jQuery UI dialog to go away
					await grid.waitForIdle();
					await grid.setGroupMode('summary');
					await grid.waitForIdle();
				});
				after(async function () {
					await driver.executeScript('window.localStorage.clear()');
				});
				_.each(groupFuns[t], (gf) => {
					describe(`${gf}`, async function () {
						before(async function () {
							await grid.setGroupFun(f, gf);
							sleep(1); // give a sec for the jQuery UI dialog to go away
							await grid.waitForIdle();
						});
						// it()
						//await grid.sortBy(f, 'asc');
						// it()
						//await grid.sortBy(f, 'desc');
						if (expected[gf] == null) {
							return;
						}
						it('has correct counts', async function () {
							let ts = [];
							_.each(expected[gf].counts, (c, rv) => {
								ts.push({
									rowval: rv,
									count: c
								});
							});
							await asyncEach(ts, async (t) => {
								let actual = await grid.getAggResult_byVal([t.rowval]);
								assert.equal(actual, t.count, `rowval = ${t.rowval}, exepcted = ${t.count}, actual = ${actual}`);
							});
						});
					});
				});
			});
		});
	});
});
