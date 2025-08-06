const {assert} = require('chai');
const _ = require('lodash');
const {Promise} = require('bluebird');
const Grid = require('../lib/grid.js');
const Graph = require('../lib/graph.js');
const {setupServer, sleep, unhover} = require('../lib/util.js');

const {Builder, Browser, By, Key, until} = require('selenium-webdriver');
const {Preferences: LoggingPrefs, Type: LoggingType, Level: LoggingLevel} = require('selenium-webdriver/lib/logging');

describe('Google Chart', function() {
	setupServer();
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

	describe('with pivot data', function () {
		let grid, graph;

		before(async function () {
			await driver.get('http://localhost:3000/tests/pages/graph/google.html');
			grid = new Grid(driver);
			graph = new Graph(driver);
			await grid.waitForIdle();

			await grid.addGroup('Category');
			await grid.waitForIdle();

			await grid.addPivot('Country');
			await grid.waitForIdle();

			await grid.addAggregate('sum', 'Amount');
			await grid.waitForIdle();
			sleep(0.5);
		});

		after(async function () {
			await driver.executeScript('window.localStorage.clear()');
		});

		it('has the right title', async function () {
			assert.equal(await graph.ui.chart.title, 'Test - Graph - Google');
		});

		describe('bar chart', function () {
			before(async function () {
				await graph.setGraphType('Bar Chart');
			});

			describe('has the right sum values', function () {
				before(async function () {
					await graph.setAggregate('Sum of Amount');
					await graph.setStacked(false);
				});
				afterEach(async function () {
					// Getting the tooltip in each test hovers the "mouse" over a bar in the graph.
					// However, this changes the SVG structure; we must "move the mouse away" to reset it.
					await unhover(driver);
					sleep(0.2);
				});

				it('test 1', async function () {
					let t = await graph.getTooltip(0, 0);
					assert.equal(t.group, 'Fruit');
					assert.equal(t.pivot, 'Australia');
					assert.equal(t.value, '91,221');
				});

				it('test 2', async function () {
					let t = await graph.getTooltip(1, 0);
					assert.equal(t.group, 'Vegetables');
					assert.equal(t.pivot, 'Australia');
					assert.equal(t.value, '40,492');
				});

				it('test 3', async function () {
					let t = await graph.getTooltip(0, 6);
					assert.equal(t.group, 'Fruit');
					assert.equal(t.pivot, 'United States');
					assert.equal(t.value, '176,971');
				});

				it('test 4', async function () {
					let t = await graph.getTooltip(1, 6);
					assert.equal(t.group, 'Vegetables');
					assert.equal(t.pivot, 'United States');
					assert.equal(t.value, '90,162');
				});
			});
		});
	});
});
