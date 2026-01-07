const {assert} = require('chai');
const _ = require('lodash');
const Grid = require('../lib/grid.js');
const {setupServer, asyncEach, sleep, createDriver} = require('../lib/util.js');

const {Builder, By} = require('selenium-webdriver');

describe('Allow HTML', function () {
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

	let tests = [{
		name: 'No Defn, No Prefs',
		url: 'nodefn-noprefs.html',
		phases: [{
      field: 'link1',
      expected: 'text'
    }, {
      field: 'link2',
      expected: 'text'
    }, {
      field: 'link3',
      expected: 'link'
    }, {
      field: 'link4',
      expected: 'link'
    }]
  }, {
    name: 'Defn Only',
    url: 'defn-noprefs.html',
    phases: [{
      field: 'link1',
      expected: 'link'
    }, {
      field: 'link2',
      expected: 'text'
    }, {
      field: 'link3',
      expected: 'link'
    }, {
      field: 'link4',
      expected: 'link'
    }]
  }, {
    name: 'Defn and Prefs',
    url: 'defn-prefs.html',
    phases: [{
      field: 'link1',
      expected: 'link'
    }, {
      field: 'link2',
      expected: 'text'
    }, {
      field: 'link3',
      expected: 'link'
    }, {
      field: 'link4',
      expected: 'link'
		}]
	}];

  async function check(cell, expected) {
    let children = await cell.findElements(By.css('*'));
    switch (expected) {
    case 'text':
      assert.equal(children.length, 0);
      break;
    case 'link':
      assert.equal(children.length, 1);
      assert.equal(await children[0].getTagName(), 'a');
      break;
    }
  }

	_.each(tests, function (t) {
		describe(`${t.name} (${t.url})`, function () {
			before(async function () {
				await driver.get(`http://localhost:3000/tests/pages/grid/allowHtml/${t.url}`);
				grid = new Grid(driver);
				await grid.waitForIdle();
			});
			after(async function () {
				await driver.executeScript('window.localStorage.clear()');
			});
      afterEach(async function () {
        await grid.clearGroup();
        await grid.waitForIdle();
      });
			_.each(t.phases, function (p) {
				it(`column ${p.field}`, async function () {
          let cell = await grid.getCell(p.field, 0, {result: 'element'});
          check(cell, p.expected);

          await grid.addGroup(p.field);
          await grid.waitForIdle();
          await grid.setGroupMode('summary');
          await grid.waitForIdle();
          cell = await grid.getRowValElt(0, 0, {result: 'element'});
          check(cell, p.expected);
				});
			});
		});
	});
});
