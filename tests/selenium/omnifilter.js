const {assert} = require('chai');
const Grid = require('../lib/grid.js');
const {setupServer, sleep, createDriver} = require('../lib/util.js');

const {Key} = require('selenium-webdriver');

describe('Omnifilter', function () {
	setupServer();
	let driver;
	let grid;

	before(async function () {
		driver = await createDriver();
	});

	before(async function () {
		await driver.get('http://localhost:3000/tests/pages/grid/omnifilter.html');
		grid = new Grid(driver);
		await grid.waitForIdle();
	});

	after(async function () {
		await driver.executeScript('window.localStorage.clear()');
	});

	after(async function () {
		if (driver != null) {
			await driver.quit();
		}
	});

	describe('visibility', function () {
		it('toggle button is visible in plain mode', async function () {
			const toggle = await grid.ui.omnifilterToggle;
			assert.isTrue(await toggle.isDisplayed(), 'toggle button should be visible in plain mode');
		});

		it('input is hidden initially', async function () {
			const container = await grid.ui.omnifilterContainer;
			assert.isFalse(await container.isDisplayed(), 'omnifilter input should be hidden initially');
		});

		it('input is revealed when toggle is clicked', async function () {
			const toggle = await grid.ui.omnifilterToggle;
			await toggle.click();
			await sleep(0.1);

			const container = await grid.ui.omnifilterContainer;
			assert.isTrue(await container.isDisplayed(), 'omnifilter input should be visible after clicking toggle');
		});

		it('toggle clears input and hides omnifilter', async function () {
			// Type something into the (already open) omnifilter.
			await grid.typeInOmnifilter('Canada');
			const filteredCount = await grid.getVisibleRowCount();
			assert.isBelow(filteredCount, 1000);

			// Clicking the toggle should clear the input and hide it.
			const toggle = await grid.ui.omnifilterToggle;
			await toggle.click();
			await sleep(0.1);

			const container = await grid.ui.omnifilterContainer;
			assert.isFalse(await container.isDisplayed(), 'omnifilter should be hidden after clicking toggle');

			const restoredCount = await grid.getVisibleRowCount();
			assert.equal(restoredCount, 1000, 'all rows should reappear after toggle clears the filter');
		});

		it('toggle is hidden when grouped', async function () {
			await grid.addGroup('country');
			await grid.waitForIdle();

			const toggle = await grid.ui.omnifilterToggle;
			assert.isFalse(await toggle.isDisplayed(), 'toggle should be hidden when grouped');

			await grid.clearGroup();
			await grid.waitForIdle();
		});
	});

	describe('filtering', function () {
		it('shows all rows when the input is empty', async function () {
			const count = await grid.getVisibleRowCount();
			assert.equal(count, 1000, 'all 1000 rows should be visible with empty omnifilter');
		});

		it('filters rows by text content', async function () {
			// "United States" appears in the country column for some rows.
			await grid.typeInOmnifilter('United States');
			const count = await grid.getVisibleRowCount();
			assert.isAbove(count, 0, 'some rows should match "United States"');
			assert.isBelow(count, 1000, 'not all rows should match "United States"');
		});

		it('is case insensitive', async function () {
			await grid.typeInOmnifilter('united states');
			const countLower = await grid.getVisibleRowCount();

			await grid.typeInOmnifilter('United States');
			const countOriginal = await grid.getVisibleRowCount();

			assert.equal(countLower, countOriginal, 'case should not affect filtering');
		});

		it('shows zero rows for a nonsense query', async function () {
			await grid.typeInOmnifilter('zzzzNOTINDATA12345');
			const count = await grid.getVisibleRowCount();
			assert.equal(count, 0, 'no rows should match a nonsense query');
		});

		it('restores all rows when input is cleared', async function () {
			await grid.typeInOmnifilter('United States');
			const filteredCount = await grid.getVisibleRowCount();
			assert.isBelow(filteredCount, 1000);

			await grid.typeInOmnifilter('');
			const restoredCount = await grid.getVisibleRowCount();
			assert.equal(restoredCount, 1000, 'all rows should reappear after clearing the input');
		});

		it('maintains correct zebra striping on visible rows', async function () {
			await grid.typeInOmnifilter('United States');
			const classes = await driver.executeScript(`
				var rows = document.querySelectorAll('div.wcdv_grid_table > table > tbody > tr[data-row-num]');
				var result = [];
				for (var i = 0; i < rows.length; i++) {
					if (rows[i].style.display !== 'none') {
						result.push(rows[i].className);
					}
				}
				return result;
			`);
			assert.isAbove(classes.length, 1, 'need at least 2 visible rows to check striping');

			for (let i = 0; i < classes.length; i++) {
				const expectedClass = (i % 2 === 0) ? 'odd' : 'even';
				assert.include(classes[i], expectedClass,
					'row ' + i + ' should have class "' + expectedClass + '"');
			}

			await grid.typeInOmnifilter('');
		});
	});

	describe('clear button', function () {
		it('is hidden when omnifilter input is empty', async function () {
			await grid.openOmnifilter();
			await grid.typeInOmnifilter('');
			const clearBtn = await grid.ui.omnifilterClearBtn;
			assert.isFalse(await clearBtn.isDisplayed(), 'clear button should be hidden when input is empty');
		});

		it('appears when text is typed', async function () {
			await grid.typeInOmnifilter('Canada');
			const clearBtn = await grid.ui.omnifilterClearBtn;
			assert.isTrue(await clearBtn.isDisplayed(), 'clear button should appear when input has text');
		});

		it('clears the filter and restores all rows when clicked', async function () {
			await grid.typeInOmnifilter('Canada');
			const filteredCount = await grid.getVisibleRowCount();
			assert.isBelow(filteredCount, 1000);

			const clearBtn = await grid.ui.omnifilterClearBtn;
			await clearBtn.click();
			await sleep(0.1);

			const input = await grid.ui.omnifilterInput;
			assert.equal(await input.getAttribute('value'), '', 'input should be empty after clicking clear');

			const restoredCount = await grid.getVisibleRowCount();
			assert.equal(restoredCount, 1000, 'all rows should reappear after clicking clear');
		});
	});

	describe('escape key', function () {
		it('clears the input, hides omnifilter, and restores all rows', async function () {
			await grid.typeInOmnifilter('Japan');
			const filteredCount = await grid.getVisibleRowCount();
			assert.isAbove(filteredCount, 0);
			assert.isBelow(filteredCount, 1000);

			const input = await grid.ui.omnifilterInput;
			await input.sendKeys(Key.ESCAPE);
			await sleep(0.1);

			assert.equal(await input.getAttribute('value'), '', 'input should be empty after pressing Escape');

			const container = await grid.ui.omnifilterContainer;
			assert.isFalse(await container.isDisplayed(), 'omnifilter should be hidden after pressing Escape');

			const restoredCount = await grid.getVisibleRowCount();
			assert.equal(restoredCount, 1000, 'all rows should reappear after pressing Escape');
		});
	});

	describe('interaction with view', function () {
		it('does not affect the record count in the titlebar', async function () {
			await grid.typeInOmnifilter('Japan');
			const count = await grid.getVisibleRowCount();
			assert.isAbove(count, 0);
			assert.isBelow(count, 1000);

			// The titlebar should still show 1000 records because
			// the omnifilter is a visual-only filter.
			const numRecords = await grid.getNumRecords();
			assert.equal(numRecords, '1000', 'titlebar record count should not be affected by omnifilter');

			await grid.typeInOmnifilter('');
		});

		it('reapplies after data refresh', async function () {
			await grid.typeInOmnifilter('Canada');
			const countBefore = await grid.getVisibleRowCount();
			assert.isAbove(countBefore, 0);

			await grid.refresh();
			await grid.waitForIdle();
			await sleep(0.2);

			const countAfter = await grid.getVisibleRowCount();
			assert.equal(countAfter, countBefore, 'omnifilter should be reapplied after refresh');

			await grid.typeInOmnifilter('');
		});
	});
});
