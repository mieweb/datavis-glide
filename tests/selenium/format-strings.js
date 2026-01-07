const {assert} = require('chai');
const _ = require('lodash');
const Grid = require('../lib/grid.js');
const {setupServer, rgbToHex, asyncEach, sleep, isVisible, createDriver} = require('../lib/util.js');

const {Builder, Browser, By, Key, until} = require('selenium-webdriver');

describe('Format Strings', function () {
	setupServer();
	let driver;
	let grid;
	let data;

	before(async function () {
		driver = await createDriver();
	});

	before(async function () {
		await driver.get('http://localhost:3000/tests/pages/grid/format-strings.html');
		grid = new Grid(driver);
		await grid.waitForIdle();
		data = await grid.getPlainData_asObjects(['test'], {result: 'element'});
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

	/*
		expected: {
			[key]: {
				name: (* test description *)
				data: [{
					i: (* row index *)
					code: (* data value taken from CSV file *)
					? text: (* what text should display *)
				}]
			}
		}
	*/

	let expected = {
		noFormatting: {
			name: 'when there are no formatting string markers',
			data: [
					{i: 0, code: 'no formatting'}
			]
		},
		invalid: {
			name: 'invalid formatting string markers',
			data: [
					{i: 1, code: '{{bad'}
				, {i: 2, code: '{{dv}}bad'}
				, {i: 3, code: '{{dv.fmt}}bad'}
				, {i: 4, code: '{{dv.fmt}}bad{{'}
				, {i: 5, code: '{{dv.fmt}}bad{{}}'}
				, {i: 6, code: '{{dv.fmt}}bad{{/}}'}
			]
		},
		valid: {
			name: 'valid formatting string markers',
			data: [
					{ i: 7,
						code: '{{dv.fmt:}}bad{{/}}',
						text: 'bad'
					}
				, { i: 8,
						code: '{{dv.fmt:bg=CC0000}}red background{{/}}',
						text: 'red background',
						style: [['background-color: #CC0000']]
					}
				, { i: 9,
						code: '{{dv.fmt:bg=00CC00}}green background{{/}}',
						text: 'green background',
						style: [['background-color: #00CC00']]
					}
				, { i: 10,
						code: '{{dv.fmt:fg=CC0000}}red text{{/}}',
						text: 'red text',
						style: [['color: #CC0000']]
					}
				, { i: 11,
						code: '{{dv.fmt:fg=00CC00}}green text{{/}}',
						text: 'green text',
						style: [['color: #00CC00']]
					}
				, { i: 12,
						code: '{{dv.fmt:bg=0000CC,fg=FFFFFF}}white on blue{{/}}',
						text: 'white on blue',
						style: [['background-color: #0000CC', 'color: #FFFFFF']]
					}
				, { i: 13,
						code: '{{dv.fmt:ts=i}}italic{{/}}',
						text: 'italic',
						style: [['font-style: italic']]
					}
				, { i: 14,
						code: '{{dv.fmt:ts=b}}bold{{/}}',
						text: 'bold',
						style: [['font-weight: bold']]
					}
				, { i: 15,
						code: '{{dv.fmt:ts=u}}underscore{{/}}',
						text: 'underscore',
						style: [['text-decoration: underline']]
					}
				, { i: 16,
						code: '{{dv.fmt:ts=s}}strike-thru{{/}}',
						text: 'strike-thru',
						style: [['text-decoration: line-through']]
					}
				, { i: 17,
						code: '{{dv.fmt:ts=biu}}bold, italic, underscore{{/}}',
						text: 'bold, italic, underscore',
						style: [['font-weight: bold', 'font-style: italic', 'text-decoration: underline']]
					}
				, { i: 18,
						code: '{{dv.fmt:bg=00CC00,fg=FFFFFF,ts=b}}bold white on green{{/}}',
						text: 'bold white on green',
						style: [['font-weight: bold', 'color: #FFFFFF', 'background-color: #00CC00']]
					}
				, { i: 19,
						code: '{{dv.fmt:fg=CC0000}}red{{/}} {{dv.fmt:fg=00CC00}}green{{/}}',
						text: 'red green',
						style: [['color: #CC0000'], ['color: #00CC00']]
					}
			]
		},
		injection: {
			name: 'does not permit HTML injection',
			data: [
					{ i: 20,
						code: 'html <b>inject</b>'
					}
				, { i: 21,
						code: '{{dv.fmt:ts=i}}italic{{/}} html <b>inject</b> {{dv.fmt:ts=i}}italic{{/}}',
						text: 'italic html <b>inject</b> italic',
						style: [['font-style: italic'], ['font-style: italic']]
					}
				, { i: 22,
						code: '{{dv.fmt:ts=i}}html <b>inject</b>{{/}}',
						text: 'html <b>inject</b>',
						style: [['font-style: italic']]
					}
			]
		},
		clsFormatter: {
			name: 'cls formatter',
			data: [
					{ i: 23,
						code: '{{dv.fmt:cls=pink-box}}pink box{{/}}',
						text: 'pink box',
						cls: [['pink-box']]
					}
				, { i: 24,
						code: '{{dv.fmt:cls=highlight}}highlight{{/}}',
						text: 'highlight',
						cls: [['highlight']]
					}
				, { i: 25,
						code: '{{dv.fmt:cls=pink-box highlight}}pink box highlight{{/}}',
						text: 'pink box highlight',
						cls: [['pink-box', 'highlight']]
					}
				, { i: 26,
						code: '{{dv.fmt:cls=pink-box,cls=highlight}}pink box highlight{{/}}',
						text: 'pink box highlight',
						cls: [['pink-box', 'highlight']]
					}
			]
		}
	};

	function runTestOn() {
		_.each(expected, (t) => {
			it(t.name, async () => {
				await asyncEach(t.data, async (d) => {
					const actual = await data[d.i]['test'].getText()
						, expected = d.text || d.code;
					assert.equal(actual, expected);
					// loop through all the elements we're checking styles on
					await asyncEach(d.style || [], async (ss, si) => {
						// get the element as the nth child of the td
						const se = await data[d.i]['test'].findElement(By.xpath(`.//span[contains(@class, 'wcdv_format_string')][${si+1}]`));
						const styles = (await se.getAttribute('style')).split(';').map((x) => {
							return rgbToHex(x.trim());
						});
						// loop through all the styles we're checking on this element
						_.each(ss, (s) => {
							assert.include(styles, s);
						});
					});
					// loop through all the elements we're checking classes on
					await asyncEach(d.cls || [], async (cs, ci) => {
						// get the element as the nth child of the td
						const ce = await data[d.i]['test'].findElement(By.xpath(`.//span[contains(@class, 'wcdv_format_string')][${ci+1}]`));
						const classes = (await ce.getAttribute('class')).split(' ');
						// loop through all the classes we're checking on this element
						_.each(cs, (c) => {
							assert.include(classes, c);
						});
					});
				});
			});
		});
	}

	function runTestOff() {
		_.each(expected, (t) => {
			it(t.name, async () => {
				await asyncEach(t.data, async (d) => {
					const actual = await data[d.i]['test'].getText()
						, expected = d.code;
					assert.equal(actual, expected);
				});
			});
		});
	}

	describe('works initially', () => {
		runTestOn();
	});

	describe('does not format when turned off', () => {
		before(async () => {
			// turn off formatting in colconfig win
			await grid.ui.colConfigBtn.click();
			await grid.editColConfig('test', 'allowFormatting', false);
			await grid.ui.colConfigSave.click();
			await grid.waitForIdle();
			data = await grid.getPlainData_asObjects(['test'], {result: 'element'});
		});
		runTestOff();
	});

	describe('works when turned back on', () => {
		before(async () => {
			// turn on formatting in colconfig win
			await grid.ui.colConfigBtn.click();
			await grid.editColConfig('test', 'allowFormatting', true);
			await grid.ui.colConfigSave.click();
			await grid.waitForIdle();
			data = await grid.getPlainData_asObjects(['test'], {result: 'element'});
		});
		runTestOn();
	});
});
