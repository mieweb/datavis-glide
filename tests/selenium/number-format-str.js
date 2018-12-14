const assert = require('assert');
const Grid = require('../lib/grid.js');
const {asyncEach} = require('../lib/util.js');
const child_process = require('child_process');

const {Builder, Browser, By, Key, until} = require('selenium-webdriver');
const {Preferences: LoggingPrefs, Type: LoggingType, Level: LoggingLevel} = require('selenium-webdriver/lib/logging');

describe('number formatting', function() {
	const logging = new LoggingPrefs();
	logging.setLevel(LoggingType.BROWSER, LoggingLevel.ALL);
	const driver = new Builder().forBrowser('chrome').setLoggingPrefs(logging).build();
	const grid = new Grid(driver);

	before(() => driver.get('https://zeus.med-web.com/~tvenable/datavis/tests/grid/number-format-str.html'));

	it('formats numbers represented as primitives', async function() {
		await grid.waitForIdle();
		assert.equal(await grid.getCell('number-primitive-0', 0), '8443.374093398956');
		assert.equal(await grid.getCell('number-primitive-1', 0), '8443');
		assert.equal(await grid.getCell('number-primitive-2', 0), '8443.4');
		assert.equal(await grid.getCell('number-primitive-3', 0), '8443.37');
		assert.equal(await grid.getCell('number-primitive-4', 0), '8,443');
		assert.equal(await grid.getCell('number-primitive-5', 0), '8,443.4');
		assert.equal(await grid.getCell('number-primitive-6', 0), '8,443.37');
	});

	it('formats numbers represented as numeral objects', async function() {
		await grid.waitForIdle();
		assert.equal(await grid.getCell('number-numeral-0', 0), '8443.374093398956');
		assert.equal(await grid.getCell('number-numeral-1', 0), '8443');
		assert.equal(await grid.getCell('number-numeral-2', 0), '8443.4');
		assert.equal(await grid.getCell('number-numeral-3', 0), '8443.37');
		assert.equal(await grid.getCell('number-numeral-4', 0), '8,443');
		assert.equal(await grid.getCell('number-numeral-5', 0), '8,443.4');
		assert.equal(await grid.getCell('number-numeral-6', 0), '8,443.37');
	});

	it('formats numbers represented as bignumber objects', async function() {
		await grid.waitForIdle();
		assert.equal(await grid.getCell('number-bignumber-0', 0), '8443.374093398956');
		assert.equal(await grid.getCell('number-bignumber-1', 0), '8443');
		assert.equal(await grid.getCell('number-bignumber-2', 0), '8443.4');
		assert.equal(await grid.getCell('number-bignumber-3', 0), '8443.37');
		assert.equal(await grid.getCell('number-bignumber-4', 0), '8,443');
		assert.equal(await grid.getCell('number-bignumber-5', 0), '8,443.4');
		assert.equal(await grid.getCell('number-bignumber-6', 0), '8,443.37');
	});

	it('formats currency represented as primitives', async function() {
		await grid.waitForIdle();
		assert.equal(await grid.getCell('currency-primitive-0', 0), '$8,443.37');
		assert.equal(await grid.getCell('currency-primitive-1', 0), '$8443');
		assert.equal(await grid.getCell('currency-primitive-2', 0), '$8443.4');
		assert.equal(await grid.getCell('currency-primitive-3', 0), '$8443.37');
		assert.equal(await grid.getCell('currency-primitive-4', 0), '$8,443');
		assert.equal(await grid.getCell('currency-primitive-5', 0), '$8,443.4');
		assert.equal(await grid.getCell('currency-primitive-6', 0), '$8,443.37');
	});

	it('formats currency represented as numeral objects', async function() {
		await grid.waitForIdle();
		assert.equal(await grid.getCell('currency-numeral-0', 0), '$8,443.37');
		assert.equal(await grid.getCell('currency-numeral-1', 0), '$8443');
		assert.equal(await grid.getCell('currency-numeral-2', 0), '$8443.4');
		assert.equal(await grid.getCell('currency-numeral-3', 0), '$8443.37');
		assert.equal(await grid.getCell('currency-numeral-4', 0), '$8,443');
		assert.equal(await grid.getCell('currency-numeral-5', 0), '$8,443.4');
		assert.equal(await grid.getCell('currency-numeral-6', 0), '$8,443.37');
	});

	it('formats currency represented as bignumber objects', async function() {
		await grid.waitForIdle();
		assert.equal(await grid.getCell('currency-bignumber-0', 0), '$8,443.37');
		assert.equal(await grid.getCell('currency-bignumber-1', 0), '$8443');
		assert.equal(await grid.getCell('currency-bignumber-2', 0), '$8443.4');
		assert.equal(await grid.getCell('currency-bignumber-3', 0), '$8443.37');
		assert.equal(await grid.getCell('currency-bignumber-4', 0), '$8,443');
		assert.equal(await grid.getCell('currency-bignumber-5', 0), '$8,443.4');
		assert.equal(await grid.getCell('currency-bignumber-6', 0), '$8,443.37');
	});

	after(() => driver.quit());
});
