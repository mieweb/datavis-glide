const {assert} = require('chai');
const _ = require('lodash');
const Grid = require('../lib/grid.js');
const {setupServer, sleep, createDriver} = require('../lib/util.js');

const {By, until} = require('selenium-webdriver');

describe('Drag and Drop', function () {
	setupServer();
	let driver;
	let grid;

	before(async function () {
		driver = await createDriver();
		await driver.get('http://localhost:3000/tests/pages/grid/vite.html?dnd');
		grid = new Grid(driver);
		await grid.waitForIdle();
	});

	after(async function () {
		if (driver != null) {
			await driver.quit();
		}
	});

	afterEach(async function () {
		await driver.executeScript('window.localStorage.clear()');
	});

	describe('Group fields control panel', function () {
		it('should allow dragging column header to group fields panel', async function () {
			// Controls should be visible by default on vite.html
			await sleep(0.5);

			// Find the column header to drag (e.g., 'fruit') by its text
			const columnHeader = await driver.findElement(By.xpath('//span[contains(@class, "wcdv_heading_title") and text() = "fruit"]'));
			
			// Find the group fields control panel
			const groupControl = await driver.findElement(By.css('div.wcdv_group_control'));

			// Perform drag and drop
			await driver.actions()
				.dragAndDrop(columnHeader, groupControl)
				.perform();

			await grid.waitForIdle();

			// Verify that the field was added to the group control
			const groupFields = await grid.getGroup();
			assert.include(groupFields, 'fruit');
		});
	});

	describe('Pivot to group drag and drop', function () {
		before(async function () {
			// Reset state - controls should be visible by default
			await driver.navigate().refresh();
			await grid.waitForIdle();
			await sleep(0.5);
		});

		it('should allow dragging pivot field to group fields panel', async function () {
			// First add a group so we can add pivots
			await grid.addGroup('fruit');
			await grid.waitForIdle();

			// Add a pivot field using the dropdown
			await grid.addPivot('country');
			await grid.waitForIdle();

			// Verify pivot was added
			const pivotFields = await grid.getPivot();
			assert.include(pivotFields, 'country');

			// Find the pivot field element
			const pivotField = await driver.findElement(By.css('div.wcdv_pivot_control > div > ul > li[data-wcdv-field="country"]'));
			
			// Find the group control panel
			const groupControl = await driver.findElement(By.css('div.wcdv_group_control > div > ul'));

			// Drag from pivot to group
			await driver.actions()
				.dragAndDrop(pivotField, groupControl)
				.perform();

			await grid.waitForIdle();

			// Verify that the field was removed from pivot and added to group
			const newPivotFields = await grid.getPivot();
			assert.notInclude(newPivotFields, 'country');

			const groupFields = await grid.getGroup();
			assert.include(groupFields, 'country');
		});
	});

	describe('Column reordering', function () {
		before(async function () {
			// Reset state and hide controls for clean grid
			await driver.navigate().refresh();
			await grid.waitForIdle();
		});

		it('should allow dragging column header to reorder columns', async function () {
			// Get initial column order
			const initialColumns = await grid.getColumns();
			assert.include(initialColumns, 'fruit');
			assert.include(initialColumns, 'rowId');

			// Get initial positions
			const initialFruitIndex = initialColumns.indexOf('fruit');
			const initialRowIdIndex = initialColumns.indexOf('rowId');

			// Fruit should start after rowId
			assert.isAbove(initialFruitIndex, initialRowIdIndex, 'fruit should start after rowId');

			// Find the drag handle (the heading title span)
			const fruitDragHandle = await driver.findElement(
				By.xpath('//span[contains(@class, "wcdv_heading_title") and text() = "fruit"]')
			);

			// Find the target column header th element
			const rowIdTitleSpan = await driver.findElement(
				By.xpath('//span[contains(@class, "wcdv_heading_title") and text() = "rowId"]')
			);
			const rowIdHeader = await rowIdTitleSpan.findElement(By.xpath('ancestor::th'));

			// Perform drag with granular mouse events to trigger jQuery UI properly
			// This simulates: click and hold on source -> move to target -> release
			await driver.actions()
				.move({origin: fruitDragHandle})
				.press()
				.pause(100)
				.move({origin: rowIdHeader})
				.pause(100)
				.release()
				.perform();

			await sleep(1);

			// Verify column order changed
			const newColumns = await grid.getColumns();
			const newFruitIndex = newColumns.indexOf('fruit');
			const newRowIdIndex = newColumns.indexOf('rowId');

			// Fruit should now be immediately after rowId
			assert.equal(newFruitIndex, newRowIdIndex + 1, 'fruit should be immediately after rowId');
		});
	});

	describe('Column resizing', function () {
		before(async function () {
			// Reset state
			await driver.navigate().refresh();
			await grid.waitForIdle();
		});

		it('should allow dragging resize handle to change column width', async function () {
			// Find a column header with a resize handle
			const columnField = 'fruit';
			let columnTitleSpan = await driver.findElement(By.xpath(`//span[contains(@class, "wcdv_heading_title") and text() = "${columnField}"]`));
			// Navigate up to the th element
			let columnHeader = await columnTitleSpan.findElement(By.xpath('ancestor::th'));
			
			// Get initial width
			const initialWidth = await columnHeader.getCssValue('width');
			const initialWidthPx = parseInt(initialWidth.replace('px', ''), 10);

			// Find the resize handle (usually at the right edge of the header)
			const resizeHandle = await columnHeader.findElement(By.css('div.wcdv_column_resize_handle'));

			// Drag the resize handle to the right to increase width
			await driver.actions()
				.move({origin: resizeHandle})
				.press()
				.move({x: 50, y: 0, origin: 'pointer'})
				.release()
				.perform();

			await sleep(0.5);

			// Re-find the element to avoid stale reference
			columnTitleSpan = await driver.findElement(By.xpath(`//span[contains(@class, "wcdv_heading_title") and text() = "${columnField}"]`));
			columnHeader = await columnTitleSpan.findElement(By.xpath('ancestor::th'));

			// Get new width
			const newWidth = await columnHeader.getCssValue('width');
			const newWidthPx = parseInt(newWidth.replace('px', ''), 10);

			// Verify width increased
			assert.isAbove(newWidthPx, initialWidthPx, 'Column width should have increased');
			assert.approximately(newWidthPx, initialWidthPx + 50, 20, 'Width should have increased by approximately 50px');
		});
	});
});
