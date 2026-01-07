const {assert} = require('chai');
const _ = require('lodash');
const Grid = require('../lib/grid.js');
const {setupServer, asyncEach, sleep, createDriver} = require('../lib/util.js');

const {Builder, By} = require('selenium-webdriver');

describe('Operations', function () {
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

  function runTest() {
    it('works', async function () {
      const allOps = await grid.getOperations('all');
      assert.deepEqual(allOps, {
        '': ['Take Ye Flask'],
        'Power': ['fa-battery-0', 'fa-battery-1', 'fa-battery-2', 'fa-battery-3', 'fa-battery-4'],
        'Rating': ['fa-thumbs-o-up', 'fa-thumbs-o-down']
      });
      assert.deepEqual(await grid.getOperations('row', {row: 0}), ['Inspect', 'Delete']);
      assert.deepEqual(await grid.getOperations('cell', {row: 0, col: 'string1'}), ['Like', 'Look Up']);
    });
  }

  describe('configured as part of the grid', function () {
    before(async function () {
      await driver.get(`http://localhost:3000/tests/pages/grid/operations/basic.html`);
      grid = new Grid(driver);
      await grid.waitForIdle();
    });
    // after(async function () {
    //   await driver.executeScript('window.localStorage.clear()');
    // });
    runTest();
  });

  describe('configured immediately after grid was created', function () {
    before(async function () {
      await driver.get(`http://localhost:3000/tests/pages/grid/operations/delayed.html`);
      grid = new Grid(driver);
      await grid.waitForIdle();
      sleep(5); // This sucks but there's no other way (right now) to know when the operations have been asynchronously applied.
    });
    // after(async function () {
    //   await driver.executeScript('window.localStorage.clear()');
    // });
    runTest();
  });

  describe('when data is retrieved', function () {
    before(async function () {
      await driver.get(`http://localhost:3000/tests/pages/grid/operations/on-view-getTypeInfo.html`);
      grid = new Grid(driver);
      await grid.waitForIdle();
    });
    // after(async function () {
    //   await driver.executeScript('window.localStorage.clear()');
    // });
    runTest();
  });
});
