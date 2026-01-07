const {assert} = require('chai');
const _ = require('lodash');
const Grid = require('../lib/grid.js');
const {setupServer, sleep, createDriver} = require('../lib/util.js');

const {Builder, Browser, By, Key, until} = require('selenium-webdriver');

describe('Active Row', function() {
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

	describe('basic', function () {
		before(async function () {
			await driver.get('http://localhost:3000/tests/pages/grid/active-row/basic.html');
			grid = new Grid(driver, 'test-grid-active-row');
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

		it('handles clicking right', async function () {
			const td = await grid.getCell('rowId', 0, {result: 'element'});
			const tr = await td.findElement(By.xpath('parent::tr'));
			await td.click();
			assert.include(await tr.getAttribute('class'), 'wcdv-active-row');
		});

		it('handles j to move down', async function () {
			await (await grid.getCell('rowId', 0, {result: 'element'})).click();
			await driver.findElement(By.css('body')).sendKeys('j');
			const td = await grid.getCell('rowId', 1, {result: 'element'});
			const tr = await td.findElement(By.xpath('parent::tr'));
			assert.include(await tr.getAttribute('class'), 'wcdv-active-row');
		});

		it('handles k to move up', async function () {
			await (await grid.getCell('rowId', 1, {result: 'element'})).click();
			await driver.findElement(By.css('body')).sendKeys('k');
			const td = await grid.getCell('rowId', 0, {result: 'element'});
			const tr = await td.findElement(By.xpath('parent::tr'));
			assert.include(await tr.getAttribute('class'), 'wcdv-active-row');
		});

		it('wraps around when you use k at the top', async function () {
			await (await grid.getCell('rowId', 0, {result: 'element'})).click();
			await driver.findElement(By.css('body')).sendKeys('k');
			const td = await grid.getCell('rowId', 99, {result: 'element'});
			const tr = await td.findElement(By.xpath('parent::tr'));
			assert.include(await tr.getAttribute('class'), 'wcdv-active-row');
		});

		it('wraps around when you use j at the bottom', async function () {
			await (await grid.getCell('rowId', 99, {result: 'element'})).click();
			await driver.findElement(By.css('body')).sendKeys('j');
			const td = await grid.getCell('rowId', 0, {result: 'element'});
			const tr = await td.findElement(By.xpath('parent::tr'));
			assert.include(await tr.getAttribute('class'), 'wcdv-active-row');
		});
	});

	describe('default-slider', function () {
		before(async function () {
			await driver.get('http://localhost:3000/tests/pages/grid/active-row/default-slider.html');
			grid = new Grid(driver, 'test-grid-active-row-default-slider');
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

		it('handles clicking', async function () {
			const td = await grid.getCell('rowId', 0, {result: 'element'});
			const tr = await td.findElement(By.xpath('parent::tr'));
			await td.click();
			assert.include(await tr.getAttribute('class'), 'wcdv-active-row');
			assert.include(await grid.ui.slider.getAttribute('class'), 'show');
			assert.equal(await grid.ui.slider.findElement(By.xpath('//dt[text()="string1"]/following-sibling::dd[1]')).getText(), 'ungrumbling');
		});

		it('handles j to move down', async function () {
			await (await grid.getCell('rowId', 0, {result: 'element'})).click();
			await driver.findElement(By.css('body')).sendKeys('j');
			const td = await grid.getCell('rowId', 1, {result: 'element'});
			const tr = await td.findElement(By.xpath('parent::tr'));
			assert.include(await tr.getAttribute('class'), 'wcdv-active-row');
			assert.include(await grid.ui.slider.getAttribute('class'), 'show');
			assert.equal(await grid.ui.slider.findElement(By.xpath('//dt[text()="string1"]/following-sibling::dd[1]')).getText(), 'irreplaceableness');
		});

		it('handles k to move up', async function () {
			await (await grid.getCell('rowId', 1, {result: 'element'})).click();
			await driver.findElement(By.css('body')).sendKeys('k');
			const td = await grid.getCell('rowId', 0, {result: 'element'});
			const tr = await td.findElement(By.xpath('parent::tr'));
			assert.include(await tr.getAttribute('class'), 'wcdv-active-row');
			assert.include(await grid.ui.slider.getAttribute('class'), 'show');
			assert.equal(await grid.ui.slider.findElement(By.xpath('//dt[text()="string1"]/following-sibling::dd[1]')).getText(), 'ungrumbling');
		});

		it('wraps around when you use k at the top', async function () {
			await (await grid.getCell('rowId', 0, {result: 'element'})).click();
			await driver.findElement(By.css('body')).sendKeys('k');
			const td = await grid.getCell('rowId', 99, {result: 'element'});
			const tr = await td.findElement(By.xpath('parent::tr'));
			assert.include(await tr.getAttribute('class'), 'wcdv-active-row');
			assert.include(await grid.ui.slider.getAttribute('class'), 'show');
			assert.equal(await grid.ui.slider.findElement(By.xpath('//dt[text()="string1"]/following-sibling::dd[1]')).getText(), 'cabbalize');
		});

		it('wraps around when you use j at the bottom', async function () {
			await (await grid.getCell('rowId', 99, {result: 'element'})).click();
			await driver.findElement(By.css('body')).sendKeys('j');
			const td = await grid.getCell('rowId', 0, {result: 'element'});
			const tr = await td.findElement(By.xpath('parent::tr'));
			assert.include(await tr.getAttribute('class'), 'wcdv-active-row');
			assert.include(await grid.ui.slider.getAttribute('class'), 'show');
			assert.equal(await grid.ui.slider.findElement(By.xpath('//dt[text()="string1"]/following-sibling::dd[1]')).getText(), 'ungrumbling');
		});
	});

	describe('custom-slider', function () {
		before(async function () {
			await driver.get('http://localhost:3000/tests/pages/grid/active-row/custom-slider.html');
			grid = new Grid(driver, 'test-grid-active-row-custom-slider');
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

		it('handles clicking', async function () {
			const td = await grid.getCell('rowId', 0, {result: 'element'});
			const tr = await td.findElement(By.xpath('parent::tr'));
			await td.click();
			assert.include(await tr.getAttribute('class'), 'wcdv-active-row');
			assert.include(await grid.ui.slider.getAttribute('class'), 'show');
			assert.equal(await grid.ui.slider.findElement(By.css('div.wcdv-slider-body > div > p')).getText(), 'On December 5, 2014, me and Jimmy went to United States and bought $8,443.37 worth of Grape.');
		});

		it('handles j to move down', async function () {
			await (await grid.getCell('rowId', 0, {result: 'element'})).click();
			await driver.findElement(By.css('body')).sendKeys('j');
			const td = await grid.getCell('rowId', 1, {result: 'element'});
			const tr = await td.findElement(By.xpath('parent::tr'));
			assert.include(await tr.getAttribute('class'), 'wcdv-active-row');
			assert.include(await grid.ui.slider.getAttribute('class'), 'show');
			assert.equal(await grid.ui.slider.findElement(By.css('div.wcdv-slider-body > div > p')).getText(), 'On March 29, 1957, me and Jimmy went to Canada and bought $7,578.79 worth of Kiwi.');
		});

		it('handles k to move up', async function () {
			await (await grid.getCell('rowId', 1, {result: 'element'})).click();
			await driver.findElement(By.css('body')).sendKeys('k');
			const td = await grid.getCell('rowId', 0, {result: 'element'});
			const tr = await td.findElement(By.xpath('parent::tr'));
			assert.include(await tr.getAttribute('class'), 'wcdv-active-row');
			assert.include(await grid.ui.slider.getAttribute('class'), 'show');
			assert.equal(await grid.ui.slider.findElement(By.css('div.wcdv-slider-body > div > p')).getText(), 'On December 5, 2014, me and Jimmy went to United States and bought $8,443.37 worth of Grape.');
		});

		it('wraps around when you use k at the top', async function () {
			await (await grid.getCell('rowId', 0, {result: 'element'})).click();
			await driver.findElement(By.css('body')).sendKeys('k');
			const td = await grid.getCell('rowId', 99, {result: 'element'});
			const tr = await td.findElement(By.xpath('parent::tr'));
			assert.include(await tr.getAttribute('class'), 'wcdv-active-row');
			assert.include(await grid.ui.slider.getAttribute('class'), 'show');
			assert.equal(await grid.ui.slider.findElement(By.css('div.wcdv-slider-body > div > p')).getText(), 'On July 18, 1968, me and Jimmy went to South Korea and bought $4,863.96 worth of Kiwi.');
		});

		it('wraps around when you use j at the bottom', async function () {
			await (await grid.getCell('rowId', 99, {result: 'element'})).click();
			await driver.findElement(By.css('body')).sendKeys('j');
			const td = await grid.getCell('rowId', 0, {result: 'element'});
			const tr = await td.findElement(By.xpath('parent::tr'));
			assert.include(await tr.getAttribute('class'), 'wcdv-active-row');
			assert.include(await grid.ui.slider.getAttribute('class'), 'show');
			assert.equal(await grid.ui.slider.findElement(By.css('div.wcdv-slider-body > div > p')).getText(), 'On December 5, 2014, me and Jimmy went to United States and bought $8,443.37 worth of Grape.');
		});

		it('the custom "next row" button works', async function () {
			await (await grid.getCell('rowId', 0, {result: 'element'})).click();
			assert.include(await grid.ui.slider.getAttribute('class'), 'show');
			assert.equal(await grid.ui.slider.findElement(By.css('div.wcdv-slider-body > div > p')).getText(), 'On December 5, 2014, me and Jimmy went to United States and bought $8,443.37 worth of Grape.');
			await grid.ui.slider.findElement(By.xpath('//button[text()="Next Row"]')).click();
			const td = await grid.getCell('rowId', 1, {result: 'element'});
			const tr = await td.findElement(By.xpath('parent::tr'));
			assert.include(await tr.getAttribute('class'), 'wcdv-active-row');
			assert.include(await grid.ui.slider.getAttribute('class'), 'show');
			assert.equal(await grid.ui.slider.findElement(By.css('div.wcdv-slider-body > div > p')).getText(), 'On March 29, 1957, me and Jimmy went to Canada and bought $7,578.79 worth of Kiwi.');
		});

		it('the custom "close" button works', async function () {
			const td = await grid.getCell('rowId', 0, {result: 'element'});
			const tr = await td.findElement(By.xpath('parent::tr'));
			await td.click();
			assert.include(await tr.getAttribute('class'), 'wcdv-active-row');
			assert.include(await grid.ui.slider.getAttribute('class'), 'show');
			await grid.ui.slider.findElement(By.xpath('//button[text()="Close"]')).click();
			assert.notInclude(await grid.ui.slider.getAttribute('class'), 'show');
			assert.equal((await grid.ui.table.findElements(By.css('tr.wcdv-active-row'))).length, 0);
		});
	});
});
