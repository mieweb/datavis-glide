const {assert} = require('chai');
const {By, Key} = require('selenium-webdriver');

const Grid = require('../lib/grid.js');
const {setupServer, createDriver} = require('../lib/util.js');

describe('Copy Selection to Clipboard', function () {
	setupServer();

	let driver;
	const copyModifier = process.platform === 'darwin' ? Key.COMMAND : Key.CONTROL;

	const installClipboardSpy = async function () {
		return driver.executeScript(`
			window.__wcdv_clipboardWrites = [];
			var clipboard = {
				writeText: function (text) {
					window.__wcdv_clipboardWrites.push(text);
					return Promise.resolve();
				}
			};

			try {
				Object.defineProperty(navigator, 'clipboard', {
					configurable: true,
					get: function () {
						return clipboard;
					}
				});
			}
			catch (e) {
				try {
					navigator.clipboard = clipboard;
				}
				catch (e2) {
					// No-op; tests below assert writes so failures will still surface.
				}
			}
		`);
	};

	const getClipboardWrites = async function () {
		return driver.executeScript('return window.__wcdv_clipboardWrites || [];');
	};

	const getLastClipboardWrite = async function () {
		return driver.executeScript('var writes = window.__wcdv_clipboardWrites || []; return writes.length > 0 ? writes[writes.length - 1] : null;');
	};

	before(async function () {
		driver = await createDriver();
	});

	beforeEach(async function () {
		await driver.get('http://localhost:3000/tests/pages/grid/selection/cell-copy.html');
		const grid = new Grid(driver);
		await grid.waitForIdle();
		await installClipboardSpy();
	});

	afterEach(async function () {
		await driver.executeScript('window.localStorage.clear()');
	});

	after(async function () {
		if (driver != null) {
			await driver.quit();
		}
	});

	it('copies selected rows with headers and updates copy-button state', async function () {
		const grid = new Grid(driver);
		await grid.waitForIdle();

		assert.isTrue(await grid.isCopySelectionDisabled());

		await grid.selectRow(0);
		await grid.selectRow(1);
		await grid.selectRow(2);

		assert.isFalse(await grid.isCopySelectionDisabled());

		await grid.clickCopySelection();

		const copied = await getLastClipboardWrite();
		assert.isString(copied);
		assert.include(copied, '"rowId"\t"string1"');

		const lines = copied.split('\r\n');
		assert.equal(lines.length, 4);
	});

	it('copies a marquee cell range without a header and keeps row/cell selection exclusive', async function () {
		const grid = new Grid(driver);
		await grid.waitForIdle();

		await grid.selectRow(0);
		assert.equal((await grid.getSelection()).length, 1);

		await grid.selectCellRange('rowId', 0, 'country', 2);

		assert.equal((await grid.getSelection()).length, 0);

		const cellSelection = await grid.getCellSelection();
		assert.equal(cellSelection.cells.length, 9);

		await grid.clickCopySelection();
		const copied = await getLastClipboardWrite();
		assert.isString(copied);

		const lines = copied.split('\r\n');
		assert.equal(lines.length, 3);
		assert.equal(lines[0].split('\t').length, 3);
		assert.notInclude(lines[0], '"rowId"');

		await grid.selectRow(1);
		assert.equal((await grid.getCellSelection()).cells.length, 0);
	});

	it('supports keyboard copy and clears cell selection after sort redraw', async function () {
		const grid = new Grid(driver);
		await grid.waitForIdle();
		await driver.executeScript(`
			var g = MIE.WC_DataVis.grids['grid'];
			g.unselect();
			g.clearCellSelection();
		`);

		assert.equal((await grid.getSelection()).length, 0);
		assert.equal((await grid.getCellSelection()).cells.length, 0);

		await driver.executeScript(`
			document.getElementById('grid').dispatchEvent(new MouseEvent('click', {
				bubbles: true,
				cancelable: true,
				view: window
			}));
		`);

		await driver.actions().keyDown(copyModifier).sendKeys('c').keyUp(copyModifier).perform();
		assert.equal((await getClipboardWrites()).length, 0);

		await grid.selectCellRange('rowId', 0, 'string1', 0);
		await driver.actions().keyDown(copyModifier).sendKeys('c').keyUp(copyModifier).perform();

		const copied = await getLastClipboardWrite();
		const expected = await driver.executeScript(`return MIE.WC_DataVis.grids['grid'].renderer.getSelectedCellsAsTsv();`);
		assert.equal(copied, expected);

		await grid.sortByField('rowId', 'asc');
		await grid.waitForIdle();

		assert.equal((await grid.getCellSelection()).cells.length, 0);
		assert.isTrue(await grid.isCopySelectionDisabled());
	});
});
