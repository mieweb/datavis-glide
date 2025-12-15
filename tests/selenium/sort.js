const Promise = require('bluebird');
const assert = require('chai').assert;
const _ = require('lodash');
const Grid = require('../lib/grid.js');
const {asyncEach, setupServer, sleep} = require('../lib/util.js');

const {Builder, Browser, By, Key, until} = require('selenium-webdriver');
const {Preferences: LoggingPrefs, Type: LoggingType, Level: LoggingLevel} = require('selenium-webdriver/lib/logging');

describe('Sort', function() {
	setupServer();
	const logging = new LoggingPrefs();
	logging.setLevel(LoggingType.BROWSER, LoggingLevel.ALL);
	let driver;
	let grid;

	before(async function () {
		driver = new Builder().forBrowser('chrome').setLoggingPrefs(logging).build();
	});

	after(async function () {
		if (driver != null) {
			await driver.quit();
		}
	});

	const sortInfo = {
		plain: {
			// DATA FORMAT: [field, min, max, info, opts]
			//
			//   * field: What field to sort by.
			//   * min: Minimum value in that field.
			//   * max: Maximum value in that field.
			//   * info: What the field represents, used for test messages.
			//   * opts: Additional options for comparison.
			//     - delta: Triggers approximate equality checks using specified allowable delta.

			'string': [
				['string1', 'abidal', 'zigzagged', 'random dictionary word'],
			],
			'int': [
				['int1', '18', '9882', 'integer (number → number)'],
				['int2', '18', '9882', 'integer (string → number)'],
				['int3', '18', '9882', 'integer (string → numeral)'],
				['int4', '18', '9882', 'integer (number → numeral)'],
				['int5', '18', '9882', 'integer (string → numeral)'],
				['int6', '18', '9882', 'integer (string → numeral)'],
				['int7', '18', '9882', 'integer (number → bignumber)'],
				['int8', '18', '9882', 'integer (string → bignumber)'],
				['int9', '18', '9882', 'integer (string → bignumber)'],
			],
			'float': [
				['float1', '11.427050324968356', '9961.582135696373', 'float (number → number)'],
				['float2', '11.427050324968356', '9961.582135696373', 'float (string → number)'],
				['float3', '11.427', '9961.582', 'float (string w/ commas → number)'],
				['float4', '11.427050324968356', '9961.582135696373', 'float (number → numeral)', {delta: 0.0000000001}],
				['float5', '11.427050324968356', '9961.582135696373', 'float (string → numeral)', {delta: 0.0000000001}],
				['float6', '11.427', '9961.582', 'float (string w/ commas → numeral)'],
				['float7', '11.427050324968356', '9961.582135696373', 'float (number → bignumber)'],
				['float8', '11.427050324968356', '9961.582135696373', 'float (string → bignumber)'],
				['float9', '11.427', '9961.582', 'float (string w/ commas → bignumber)'],
			],
			'currency': [
				['currency1', '$11.43', '$9,961.58', 'currency (number : currency → number)'],
				['currency2', '$11.43', '$9,961.58', 'currency (string : currency → number)'],
				['currency3', '$11.43', '$9,961.58', 'currency (string : currency → numeral)'],
				['currency4', '$11.43', '$9,961.58', 'currency (string : string → numeral)'],
			],
			'date': [
				['date1', 'November 30, 1901', 'January 10, 2094', 'date (string → string)'],
				['date2', 'November 30, 1901', 'January 10, 2094', 'date (string → moment)'],
				['date3', 'November 30, 1901', 'January 10, 2094', 'date (string → moment)'],
			],
			'time': [
				['time1', '12:02:29 AM', '11:54:29 PM', 'time (string → string)'],
				['time2', '12:02:29 AM', '11:54:29 PM', 'time (string → moment)'],
				['time3', '12:02:29 AM', '11:54:29 PM', 'time (string → moment)'],
				['time4', '12:02:00 AM', '11:54:00 PM', 'time (string → string)'],
				['time5', '12:02:00 AM', '11:54:00 PM', 'time (string → moment)'],
				['time6', '12:02:00 AM', '11:54:00 PM', 'time (string → moment)'],
			],
			'datetime': [
				['datetime1', 'November 30, 1901 12:24 AM', 'January 10, 2094 10:31 PM', 'datetime'],
				['datetime2', 'November 30, 1901 12:24 AM', 'January 10, 2094 10:31 PM', 'datetime'],
				['datetime3', 'November 30, 1901 12:24 AM', 'January 10, 2094 10:31 PM', 'datetime'],
				['datetime16', 'January 1, 2010 10:39 AM', 'December 23, 2010 4:42 PM', 'datetime'],
				['datetime17', 'January 1, 2010 10:39 AM', 'December 23, 2010 4:42 PM', 'datetime'],
				['datetime18', 'January 1, 2010 10:39 AM', 'December 23, 2010 4:42 PM', 'datetime'],
			],
			'duration': [
				['duration1', '1y 304d 6h 44m 21s 163t 245u', '989y 29d 21h 10m 54s 165t 350u', 'duration'],
				['duration2', '00:05:46', '23:26:53', 'duration'],
				['duration3', '0 hours, 15 minutes', '1 hours, 0 minutes', 'duration']
			]
		},
		group: [{

			// DATA FORMAT: {...}
			//
			//   * groupBy: List of fields to group by.
			//   * spotCheck: List of rowvals w/ counts to check during each sort.
			//   * tests: Array of tests to run with that grouping.

			groupBy: ['fruit'],
			spotCheck: [
				{ rowVal: ['Apple'],      count: 9   },
				{ rowVal: ['Banana'],     count: 24  },
				{ rowVal: ['Blueberry'],  count: 79  },
				{ rowVal: ['Cherry'],     count: 135 },
				{ rowVal: ['Grape'],      count: 233 },
				{ rowVal: ['Kiwi'],       count: 248 },
				{ rowVal: ['Mango'],      count: 146 },
				{ rowVal: ['Orange'],     count: 85  },
				{ rowVal: ['Pineapple'],  count: 32  },
				{ rowVal: ['Strawberry'], count: 9   }
			],
			tests: [

				// DATA FORMAT: [sort, {col: [min, max], ...}]
				//
				//   * sort: Object telling how to sort.
				//     * 'groupField': Sort by this grouped field.
				//     * 'agg': Sort by this aggregate result.
				//   * col: Group field or aggregate to check.
				//
				// Tests automatically check both ascending and descending sorts.  It'll just look for the
				// values specified in reverse order.

				[{groupField: 'fruit'}, {
					fruit: ['Apple', 'Strawberry'],
					Count: ['9', '9']
				}],
				[{agg: 'Count'}, {
					fruit: ['Apple', 'Kiwi'],
					Count: ['9', '248']
				}],
			]
		}, {
			groupBy: ['fruit', 'country'],
			spotCheck: [
				{ rowVal: ['Apple', 'France'],          count: 2  },
				{ rowVal: ['Banana', 'Switzerland'],    count: 4  },
				{ rowVal: ['Blueberry', 'Germany'],     count: 10 },
				{ rowVal: ['Cherry', 'Japan'],          count: 17 },
				{ rowVal: ['Grape', 'China'],           count: 31 },
				{ rowVal: ['Kiwi', 'Mexico'],           count: 23 },
				{ rowVal: ['Mango', 'Canada'],          count: 18 },
				{ rowVal: ['Orange', 'United States'],  count: 8  },
				{ rowVal: ['Pineapple', 'South Korea'], count: 5  },
				{ rowVal: ['Strawberry', 'England'],    count: 3  }
			],
			tests: [
				[{groupField: 'fruit'}, {
					fruit: ['Apple', 'Strawberry'],
					country: ['China', 'Mexico']
				}],
				[{groupField: 'country'}, {
					fruit: ['Banana', 'Pineapple'],
					country: ['Canada', 'United States']
				}],
			]
		}],
		pivot: {}
	};

	describe('plain output', function () {
		_.each(sortInfo.plain, (tests, typeName) => {
			describe(`${typeName} type`, function () {
				before(async function () {
					await driver.get(`http://localhost:3000/tests/pages/grid/types/${typeName}.html`);
					grid = new Grid(driver, `test-grid-types-${typeName}`);
					await grid.waitForIdle();
				});

				after(async function () {
					await driver.executeScript('window.localStorage.clear()');
				});

				_.each(tests, (si) => {
					const [field, min, max, desc, opts] = si;

					it(`${field}, ${desc}`, async function () {
						await grid.sortByField(field, 'asc');
						await grid.waitForIdle();
						if (opts != null && opts.delta != null) {
							assert.approximately(+(await grid.getCell(field, 0)), +min, opts.delta);
							assert.approximately(+(await grid.getCell(field, -1)), +max, opts.delta);
						}
						else {
							assert.equal(await grid.getCell(field, 0), min);
							assert.equal(await grid.getCell(field, -1), max);
						}

						await grid.sortByField(field, 'desc');
						await grid.waitForIdle();

						if (opts != null && opts.delta != null) {
							assert.approximately(+(await grid.getCell(field, 0)), +max, opts.delta);
							assert.approximately(+(await grid.getCell(field, -1)), +min, opts.delta);
						}
						else {
							assert.equal(await grid.getCell(field, 0), max);
							assert.equal(await grid.getCell(field, -1), min);
						}
					});
				});
			});
		});
	});

	describe('group output', function () {
		_.each(sortInfo.group, (si) => {
			describe(`grouping by ${JSON.stringify(si.groupBy)}`, function () {
				before(async function () {
					await driver.get('http://localhost:3000/tests/pages/grid/basic/random1000.html');
					grid = new Grid(driver);
					await grid.waitForIdle();

					await Promise.each(si.groupBy, async (g) => {
						await grid.addGroup(g);
						await grid.waitForIdle();
					});

					await grid.setGroupMode('summary');
					await grid.waitForIdle();
				});

				after(async function () {
					await driver.executeScript('window.localStorage.clear()');
				});

				_.each(si.tests, (t) => {
					const [spec, results] = t;

					_.each(['asc', 'desc'], (dir) => {
						describe(`${JSON.stringify(spec)} ${dir}`, function () {
							before(async function () {
								if (spec.groupField != null) {
									await grid.sortByField(spec.groupField, dir);
								}
								else if (spec.agg != null) {
									await grid.sortByAgg(spec.agg, dir);
								}
								await grid.waitForIdle();
							});

							it('has correct min/max', async function () {
								await asyncEach(_.keys(results), async (col) => {
									const [min, max] = results[col];
									const gfi = si.groupBy.indexOf(col);
									if (gfi >= 0) {
										// we're checking one of the things we grouped by
										assert.deepEqual(await grid.getRowValElt(0, gfi), dir === 'asc' ? min : max, 'sort asc -> check min');
										assert.deepEqual(await grid.getRowValElt(-2, gfi), dir === 'asc' ? max : min, 'sort asc -> check max');
										//                                        ^ -2 because of the total row
									}
									else {
										// we're checking an aggregate function result
										assert.equal(await grid.getAggResult_byNum(0, null, col), dir === 'asc' ? min : max, 'sort asc -> check min');
										assert.equal(await grid.getAggResult_byNum(-1, null, col), dir === 'asc' ? max : min, 'sort asc -> check max');
									}
								});
							});

							// TODO This way of doing things is much simpler, but each spot check takes a long time,
							// so they timeout unless put into individual tests.
							//
							// if (si.spotCheck != null) {
							// 	await Promise.each(si.spotCheck, async (sc) => {
							// 		assert.equal(await grid.getAggResult_byVal(sc.rowVal), sc.count);
							// 	});
							// }

							if (si.spotCheck != null) {
								describe('passes spot checks', function () {
									_.each(si.spotCheck, (sc) => {
										it(`${JSON.stringify(sc.rowVal)}: ${sc.count}`, async function () {
											assert.equal(await grid.getAggResult_byVal(sc.rowVal), sc.count);
										});
									});
								});
							}
						});
					});
				});
			});
		});
	});
});
