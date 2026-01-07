const assert = require('assert');
const Grid = require('../lib/grid.js');
const {setupServer, asyncEach, createDriver} = require('../lib/util.js');

const {Builder, Browser, By, Key, until} = require('selenium-webdriver');

describe('Number Formatting', function() {
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

	beforeEach(async function () {
		await driver.get('http://localhost:3000/tests/pages/grid/number-format-str.html');
	});

	afterEach(async function () {
		await driver.executeScript('window.localStorage.clear()');
	});

	after(async function () {
		if (driver != null) {
			await driver.quit();
		}
	});

	it('formats numbers represented as primitives', async function() {
		const grid = new Grid(driver);
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
		const grid = new Grid(driver);
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
		const grid = new Grid(driver);
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
		const grid = new Grid(driver);
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
		const grid = new Grid(driver);
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
		const grid = new Grid(driver);
		await grid.waitForIdle();
		assert.equal(await grid.getCell('currency-bignumber-0', 0), '$8,443.37');
		assert.equal(await grid.getCell('currency-bignumber-1', 0), '$8443');
		assert.equal(await grid.getCell('currency-bignumber-2', 0), '$8443.4');
		assert.equal(await grid.getCell('currency-bignumber-3', 0), '$8443.37');
		assert.equal(await grid.getCell('currency-bignumber-4', 0), '$8,443');
		assert.equal(await grid.getCell('currency-bignumber-5', 0), '$8,443.4');
		assert.equal(await grid.getCell('currency-bignumber-6', 0), '$8,443.37');
	});
});
