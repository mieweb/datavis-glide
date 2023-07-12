const {assert} = require('chai');
const _ = require('lodash');
const {Promise} = require('bluebird');
const Grid = require('../lib/grid.js');
const {sleep} = require('../lib/util.js');
const setup = require('../lib/setup.js');

const {Builder, Browser, By, Key, until} = require('selenium-webdriver');
const {Preferences: LoggingPrefs, Type: LoggingType, Level: LoggingLevel} = require('selenium-webdriver/lib/logging');

describe('Aggregate', function() {
	setup.server();
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

	describe('Group', function () {
		let grid;

		let intSums = [13235, 64040, 41184, 150370, 132879, 61900, 34549, 18485, 1494];
		let intAvgs = [3308.75, 5821.818181818182, 4576, 6537.826086956522, 5315.16, 3641.176470588235, 4935.571428571428, 6161.666666666667, 1494];
		let floatSums = [25256.941694891266, 73079.95424647664, 55761.26734643026, 142747.91542607444, 128604.97102449852, 98297.13477028029, 31771.824698853292, 20767.12095699954, 9327.40540844484];
		let floatAvgs = [6314.235423722816, 6643.6322042251495, 6195.696371825584, 6206.431105481497, 5144.1988409799405, 5782.184398251782, 4538.832099836184, 6922.37365233318, 9327.40540844484];
		let intMins = [18, 1471, 230, 2334, 1031, 540, 1020, 4260, 1494];
		let intMaxs = [8086, 9298, 9861, 9882, 9769, 9031, 9052, 7815, 1494];
		let floatMins = [2438.8648579944324, 823.6475089782774, 2385.9206702235865, 804.3777397068015, 140.40295994002554, 11.427050324968356, 2604.662611609202, 2756.0655789999596, 9327.40540844484];
		let floatMaxs = [9096.552813426433, 9826.871974900494, 9020.757338445388, 9665.097071339816, 9229.901315761948, 9637.421621192036, 6183.071597756641, 9961.582135696373, 9327.40540844484];

		before(async function () {
			await driver.get('http://localhost:3000/grid/default.html');
			grid = new Grid(driver);
			await grid.waitForIdle();
			await grid.addGroup('fruit');
			await grid.waitForIdle();
			await grid.setGroupMode('summary');
			await grid.waitForIdle();
		});

		after(async function () {
			await driver.executeScript('window.localStorage.clear()');
		});

		let ts = [{
			fun: 'count',
			tests: [{
				results: ['4', '11', '9', '23', '25', '17', '7', '3', '1']
			}]
		}, {
			fun: 'countDistinct',
			tests: [{
				fields: ['string1'],
				results: ['4', '11', '9', '23', '25', '17', '7', '3', '1']
			}, {
				fields: ['int1'],
				results: ['4', '11', '9', '23', '25', '17', '7', '3', '1']
			}, {
				fields: ['int4'],
				results: ['4', '11', '9', '23', '25', '17', '7', '3', '1']
			}, {
				fields: ['int7'],
				results: ['4', '11', '9', '23', '25', '17', '7', '3', '1']
			}, {
				fields: ['float1'],
				results: ['4', '11', '9', '23', '25', '17', '7', '3', '1']
			}, {
				fields: ['float4'],
				results: ['4', '11', '9', '23', '25', '17', '7', '3', '1']
			}, {
				fields: ['float7'],
				results: ['4', '11', '9', '23', '25', '17', '7', '3', '1']
			}, {
				fields: ['date1'],
				results: ['4', '11', '9', '23', '25', '17', '7', '3', '1']
			}]
		}, {
			fun: 'values',
			tests: [{
				fields: ['string1'],
				results: ['unbetray, well-enacted, Hasinai, moanfully']
			}, {
				fields: ['int1'],
				results: ['3578, 1553, 18, 8086']
			}, {
				fields: ['int4'],
				results: ['3578, 1553, 18, 8086']
			}, {
				fields: ['int7'],
				results: ['3578, 1553, 18, 8086']
			}, {
				fields: ['float1'],
				results: ['5046.363871318085, 9096.552813426433, 8675.160152152315, 2438.8648579944324']
			}, {
				fields: ['float4'],
				// results: ['5046.363871318085, 9096.552813426433, 8675.160152152315, 2438.8648579944324']
				results: ['5046.363871318085, 9096.552813426431, 8675.160152152315, 2438.8648579944324']
			}, {
				fields: ['float7'],
				results: ['5046.363871318085, 9096.552813426433, 8675.160152152315, 2438.8648579944324']
			}, {
				fields: ['date1'],
				results: ['March 13, 2070, September 15, 1913, July 25, 1960, May 21, 1952']
			}]
		}, {
			fun: 'sum',
			resultType: 'number',
			tests: [{
				fields: ['int1'],
				results: intSums
			}, {
				fields: ['int2'],
				results: intSums
			}, {
				fields: ['int3'],
				results: intSums
			}, {
				fields: ['int4'],
				results: intSums
			}, {
				fields: ['int5'],
				results: intSums
			}, {
				fields: ['int6'],
				results: intSums
			}, {
				fields: ['int7'],
				results: intSums
			}, {
				fields: ['int8'],
				results: intSums
			}, {
				fields: ['int9'],
				results: intSums
			}, {
				fields: ['float1'],
				match: 'approximately',
				results: floatSums
			}, {
				fields: ['float2'],
				match: 'approximately',
				results: floatSums
			}, {
				fields: ['float3'],
				match: 'approximately',
				assertArgs: [0.01], // decreasing precision because inputs have three decimal places
				results: floatSums
			}, {
				fields: ['float4'],
				match: 'approximately',
				results: floatSums
			}, {
				fields: ['float5'],
				match: 'approximately',
				results: floatSums
			}, {
				fields: ['float6'],
				match: 'approximately',
				assertArgs: [0.01], // decreasing precision because inputs have three decimal places
				results: floatSums
			}, {
				fields: ['float7'],
				match: 'approximately',
				results: floatSums
			}, {
				fields: ['float8'],
				match: 'approximately',
				results: floatSums
			}, {
				fields: ['float9'],
				match: 'approximately',
				assertArgs: [0.01], // decreasing precision because inputs have three decimal places
				results: floatSums
			}]
		}, {
			fun: 'average',
			resultType: 'number',
			match: 'approximately',
			tests: [
				{ fields: ['int1'], results: intAvgs },
				{ fields: ['int2'], results: intAvgs },
				{ fields: ['int3'], results: intAvgs },
				{ fields: ['int4'], results: intAvgs },
				{ fields: ['int5'], results: intAvgs },
				{ fields: ['int6'], results: intAvgs },
				{ fields: ['int7'], results: intAvgs },
				{ fields: ['int8'], results: intAvgs },
				{ fields: ['int9'], results: intAvgs },
				{ fields: ['float1'], results: floatAvgs },
				{ fields: ['float2'], results: floatAvgs },
				{ fields: ['float3'], results: floatAvgs },
				{ fields: ['float4'], results: floatAvgs },
				{ fields: ['float5'], results: floatAvgs },
				{ fields: ['float6'], results: floatAvgs },
				{ fields: ['float7'], results: floatAvgs },
				{ fields: ['float8'], results: floatAvgs },
				{ fields: ['float9'], results: floatAvgs }
			]
		}, {
			fun: 'min',
			tests: [
				{ fields: ['string1'], results: ['Hasinai', 'apiarists', 'embracer', 'backtracker', 'bordrag', 'agitated', 'abidal', 'biali', 'malpighian'] },
				{ fields: ['int1'], results: intMins, resultType: 'number' },
				{ fields: ['int2'], results: intMins, resultType: 'number' },
				{ fields: ['int3'], results: intMins, resultType: 'number' },
				{ fields: ['int4'], results: intMins, resultType: 'number' },
				{ fields: ['int5'], results: intMins, resultType: 'number' },
				{ fields: ['int6'], results: intMins, resultType: 'number' },
				{ fields: ['int7'], results: intMins, resultType: 'number' },
				{ fields: ['int8'], results: intMins, resultType: 'number' },
				{ fields: ['int9'], results: intMins, resultType: 'number' },
				{ fields: ['float1'], results: floatMins, resultType: 'number', match: 'approximately' },
				{ fields: ['float2'], results: floatMins, resultType: 'number', match: 'approximately' },
				{ fields: ['float3'], results: floatMins, resultType: 'number', match: 'approximately', assertArgs: [0.01] },
				{ fields: ['float4'], results: floatMins, resultType: 'number', match: 'approximately' },
				{ fields: ['float5'], results: floatMins, resultType: 'number', match: 'approximately' },
				{ fields: ['float6'], results: floatMins, resultType: 'number', match: 'approximately', assertArgs: [0.01] },
				{ fields: ['float7'], results: floatMins, resultType: 'number', match: 'approximately' },
				{ fields: ['float8'], results: floatMins, resultType: 'number', match: 'approximately' },
				{ fields: ['float9'], results: floatMins, resultType: 'number', match: 'approximately', assertArgs: [0.01] },
				{ fields: ['date1'], results: ['September 15, 1913', 'November 30, 1901', 'December 3, 1964', 'December 12, 1902', 'March 19, 1911', 'January 29, 1933', 'April 5, 1945', 'May 18, 1935', 'May 10, 2089'] },
				{ fields: ['date2'], results: ['September 15, 1913', 'November 30, 1901', 'December 3, 1964', 'December 12, 1902', 'March 19, 1911', 'January 29, 1933', 'April 5, 1945', 'May 18, 1935', 'May 10, 2089'] },
				{ fields: ['date3'], results: ['September 15, 1913', 'November 30, 1901', 'December 3, 1964', 'December 12, 1902', 'March 19, 1911', 'January 29, 1933', 'April 5, 1945', 'May 18, 1935', 'May 10, 2089'] },
			]
		}, {
			fun: 'max',
			tests: [
				{ fields: ['string1'], results: ['well-enacted', 'zigzagged', 'Wilsall', 'wegotism', 'yellow-tailed', 'unwarier', 'solifidian', 'wolfskin', 'malpighian'] },
				{ fields: ['int1'], results: intMaxs, resultType: 'number' },
				{ fields: ['int2'], results: intMaxs, resultType: 'number' },
				{ fields: ['int3'], results: intMaxs, resultType: 'number' },
				{ fields: ['int4'], results: intMaxs, resultType: 'number' },
				{ fields: ['int5'], results: intMaxs, resultType: 'number' },
				{ fields: ['int6'], results: intMaxs, resultType: 'number' },
				{ fields: ['int7'], results: intMaxs, resultType: 'number' },
				{ fields: ['int8'], results: intMaxs, resultType: 'number' },
				{ fields: ['int9'], results: intMaxs, resultType: 'number' },
				{ fields: ['float1'], results: floatMaxs, resultType: 'number', match: 'approximately' },
				{ fields: ['float2'], results: floatMaxs, resultType: 'number', match: 'approximately' },
				{ fields: ['float3'], results: floatMaxs, resultType: 'number', match: 'approximately' },
				{ fields: ['float4'], results: floatMaxs, resultType: 'number', match: 'approximately' },
				{ fields: ['float5'], results: floatMaxs, resultType: 'number', match: 'approximately' },
				{ fields: ['float6'], results: floatMaxs, resultType: 'number', match: 'approximately' },
				{ fields: ['float7'], results: floatMaxs, resultType: 'number', match: 'approximately' },
				{ fields: ['float8'], results: floatMaxs, resultType: 'number', match: 'approximately' },
				{ fields: ['float9'], results: floatMaxs, resultType: 'number', match: 'approximately' },
				{ fields: ['date1'], results: ['March 13, 2070', 'May 20, 2077', 'April 11, 2061', 'June 24, 2086', 'May 12, 2080', 'May 19, 2090', 'January 10, 2094', 'January 19, 2047', 'May 10, 2089'] },
				{ fields: ['date2'], results: ['March 13, 2070', 'May 20, 2077', 'April 11, 2061', 'June 24, 2086', 'May 12, 2080', 'May 19, 2090', 'January 10, 2094', 'January 19, 2047', 'May 10, 2089'] },
				{ fields: ['date3'], results: ['March 13, 2070', 'May 20, 2077', 'April 11, 2061', 'June 24, 2086', 'May 12, 2080', 'May 19, 2090', 'January 10, 2094', 'January 19, 2047', 'May 10, 2089'] },
			]
		}];

		_.each(ts, function ({fun, resultType = 'string', match = 'equal', tests}) {
			let outerMatch = match;
			let outerResultType = resultType;
			describe(fun, function () {
				before(async function () {
					await grid.clearAggregates();
					await grid.waitForIdle();
					await grid.addAggregate(fun);
					await grid.waitForIdle();
				});
				_.each(tests, function ({fields, resultType = outerResultType, match = outerMatch, message, assertArgs = [], results}) {
					if (fields != null) {
						it(JSON.stringify(fields), async function () {
							await Promise.all(_.map(fields, async function (field) {
								await grid.setAggregate(fun, field);
								await grid.waitForIdle();
							}));
							return Promise.all(_.map(results, async function (r, ri) {
								let actual = await grid.getGroupCell(ri, 0);
								let expected = r;
								if (resultType === 'number') {
									actual = +actual;
									expected = +expected;
									if (assertArgs.length === 0) {
										assertArgs = [0.001];
									}
								}
								let args = [actual, expected].concat(assertArgs, message);
								//console.log(JSON.stringify(args));
								assert[match].apply(this, args);
							}));
						});
					}
					else {
						it('no fields', async function () {
							return Promise.all(_.map(results, async function (r, ri) {
								assert.equal(await grid.getGroupCell(ri, 0), r);
							}));
						});
					}
				});
			});
		});
	});

	describe('pivot', function () {
		let grid;

		before(async function () {
			await driver.get('http://localhost:3000/grid/default.html');
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

		it('has correct pivot aggregates', async function () {
			await Promise.each([
				[['Banana'], 4],
				[['Blueberry'], 11],
				[['Cherry'], 9],
				[['Grape'], 23],
				[['Kiwi'], 25],
				[['Mango'], 17],
				[['Orange'], 7],
				[['Pineapple'], 3],
				[['Strawberry'], 1],
			], async (t) => {
				const [cv, res] = t;
				assert.equal(await grid.getAggregateResult('pivot', null, cv, 0), res);
			});
		});

		//it('has correct cell aggregates', async function () { });
		//it('has correct all aggregates', async function () { });
	});
});
