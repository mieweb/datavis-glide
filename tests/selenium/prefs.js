const assert = require('assert');
const Grid = require('../lib/grid.js');
const {setupServer, sleep, createDriver} = require('../lib/util.js');

const {Builder, Browser, By, Key, until} = require('selenium-webdriver');

describe('Preferences', function() {
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
		await driver.get('http://localhost:3000/tests/pages/grid/default.html');
	});

	afterEach(async function () {
		await driver.executeScript('window.localStorage.clear()');
	});

	after(async function () {
		if (driver != null) {
			await driver.quit();
		}
	});

	it('has expected defaults', async function () {
		let grid = new Grid(driver);
		await grid.waitForIdle();

		assert.equal(await grid.getPerspective(), 'Main Perspective');
		assert.deepEqual(await grid.getGroup(), [], 'Expected no groups to be set');
		assert.deepEqual(await grid.getPivot(), [], 'Expected no pivots to be set');
	});

	it('can save grouping', async function () {
		let grid = new Grid(driver);
		await grid.waitForIdle();

		// Group by something.

		await grid.addGroup('country');
		await grid.waitForIdle();
		assert.deepEqual(await grid.getGroup(), ['country']);

		// Make sure the grouping stuck.

		await driver.navigate().refresh();
		await grid.waitForIdle();
		assert.equal(await grid.getPerspective(), 'Main Perspective');
		assert.deepEqual(await grid.getGroup(), ['country']);
	});

	it('can delete only perspective', async function () {
		let grid = new Grid(driver);
		await grid.waitForIdle();

		// Group by something.

		await grid.addGroup('country');
		await grid.waitForIdle();
		assert.deepEqual(await grid.getGroup(), ['country']);

		// Delete the perspective.

		await grid.deletePerspective();
		await grid.waitForIdle();
		assert.equal(await grid.getPerspective(), 'Main Perspective');
		assert.deepEqual(await grid.getGroup(), [], 'Expected no groups to be set');
	});

	it('can create a new perspective', async function () {
		let grid = new Grid(driver);
		await grid.waitForIdle();

		// Create new perspective.

		await grid.newPerspective('Test');
		await grid.waitForIdle();
		assert.equal(await grid.getPerspective(), 'Test');

		// Group by something.

		await grid.addGroup('country');
		await grid.waitForIdle();
		assert.deepEqual(await grid.getGroup(), ['country']);

		// Make sure the grouping stuck.

		await driver.navigate().refresh();
		await grid.waitForIdle();
		assert.equal(await grid.getPerspective(), 'Test');
		assert.deepEqual(await grid.getGroup(), ['country']);
	});

	it('can delete perspective', async function () {
		let grid = new Grid(driver);
		await grid.waitForIdle();

		// Create new perspective.

		await grid.newPerspective('Test');
		await grid.waitForIdle();
		assert.equal(await grid.getPerspective(), 'Test');

		// Group by something.

		await grid.addGroup('country');
		await grid.waitForIdle();
		assert.deepEqual(await grid.getGroup(), ['country']);

		// Delete it.

		await grid.deletePerspective();
		await grid.waitForIdle();
		assert.equal(await grid.getPerspective(), 'Main Perspective');
		assert.deepEqual(await grid.getGroup(), [], 'Expected no groups to be set');
	});

	it('can delete perspective, after refreshing', async function () {
		let grid = new Grid(driver);
		await grid.waitForIdle();

		// Create new perspective.

		await grid.newPerspective('Test');
		await grid.waitForIdle();
		assert.equal(await grid.getPerspective(), 'Test');

		// Group by something.

		await grid.addGroup('country');
		await grid.waitForIdle();
		assert.deepEqual(await grid.getGroup(), ['country']);

		// Refresh the page.

		await driver.navigate().refresh();
		await grid.waitForIdle();
		assert.equal(await grid.getPerspective(), 'Test');
		assert.deepEqual(await grid.getGroup(), ['country']);

		// Delete it.

		await grid.deletePerspective();
		await grid.waitForIdle();
		assert.equal(await grid.getPerspective(), 'Main Perspective');
		assert.deepEqual(await grid.getGroup(), [], 'Expected no groups to be set');
	});

	describe('Perspective Switching', function () {
		it('using dropdown', async function () {
			let grid = new Grid(driver);
			await grid.waitForIdle();

			// Create new perspective.

			await grid.newPerspective('Test');
			await grid.waitForIdle();
			assert.equal(await grid.getPerspective(), 'Test');

			// Group by something.

			await grid.addGroup('country');
			await grid.waitForIdle();
			assert.deepEqual(await grid.getGroup(), ['country']);

			// Switch to previous perspective.

			await grid.setPerspective('Main Perspective');
			await grid.waitForIdle();
			assert.equal(await grid.getPerspective(), 'Main Perspective');
			assert.deepEqual(await grid.getGroup(), [], 'Expected no groups to be set');

			// Switch to next perspective.

			await grid.setPerspective('Test');
			await grid.waitForIdle();
			assert.equal(await grid.getPerspective(), 'Test');
			assert.deepEqual(await grid.getGroup(), ['country']);
		});

		it('using back/forward buttons', async function () {
			let grid = new Grid(driver);
			await grid.waitForIdle();

			// Create new perspective.

			await grid.newPerspective('Test');
			await grid.waitForIdle();
			assert.equal(await grid.getPerspective(), 'Test');

			// Group by something.

			await grid.addGroup('country');
			await grid.waitForIdle();
			assert.deepEqual(await grid.getGroup(), ['country']);

			// Switch to previous perspective.

			await grid.prevPerspective();
			await grid.waitForIdle();
			assert.equal(await grid.getPerspective(), 'Main Perspective');
			assert.deepEqual(await grid.getGroup(), [], 'Expected no groups to be set');

			// Switch to next perspective.

			await grid.nextPerspective();
			await grid.waitForIdle();
			assert.equal(await grid.getPerspective(), 'Test');
			assert.deepEqual(await grid.getGroup(), ['country']);
		});

		// See DV-130 for a bug involving this test.

		it('after deleting', async function () {
			let grid = new Grid(driver);
			await grid.waitForIdle();

			// Create new perspective.

			await grid.newPerspective('Test');
			await grid.waitForIdle();
			assert.equal(await grid.getPerspective(), 'Test');
			assert.equal(await grid.ui.prefsBackBtn.isEnabled(), true, 'Expected back button to be enabled');
			assert.equal(await grid.ui.prefsForwardBtn.isEnabled(), false, 'Expected forward button to be disabled');

			// Group by something.

			await grid.addGroup('country');
			await grid.waitForIdle();
			assert.deepEqual(await grid.getGroup(), ['country']);

			// Switch to previous perspective.

			await grid.prevPerspective();
			await grid.waitForIdle();
			assert.equal(await grid.getPerspective(), 'Main Perspective');
			assert.deepEqual(await grid.getGroup(), [], 'Expected no groups to be set');
			assert.equal(await grid.ui.prefsBackBtn.isEnabled(), false, 'Expected back button to be disabled');
			assert.equal(await grid.ui.prefsForwardBtn.isEnabled(), true, 'Expected forward button to be enabled');

			// Switch to next perspective.

			await grid.nextPerspective();
			await grid.waitForIdle();
			assert.equal(await grid.getPerspective(), 'Test');
			assert.deepEqual(await grid.getGroup(), ['country']);
			assert.equal(await grid.ui.prefsBackBtn.isEnabled(), true, 'Expected back button to be enabled');
			assert.equal(await grid.ui.prefsForwardBtn.isEnabled(), false, 'Expected forward button to be disabled');

			// Delete new perspective.

			await grid.deletePerspective();
			await grid.waitForIdle();
			assert.equal(await grid.getPerspective(), 'Main Perspective');
			assert.deepEqual(await grid.getGroup(), [], 'Expected no groups to be set');
			assert.equal(await grid.ui.prefsBackBtn.isEnabled(), false, 'Expected back button to be disabled');
			assert.equal(await grid.ui.prefsForwardBtn.isEnabled(), false, 'Expected forward button to be disabled');
		});
	});
});
