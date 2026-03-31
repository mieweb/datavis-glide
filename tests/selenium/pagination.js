const {assert} = require('chai');
const Grid = require('../lib/grid.js');
const {setupServer, sleep, createDriver} = require('../lib/util.js');

const {By} = require('selenium-webdriver');

describe('Pagination', function () {
	setupServer();
	let driver;
	let grid;

	const ROWS_PER_PAGE = 40;
	const TOTAL_ROWS = 1000;
	const TOTAL_PAGES = Math.ceil(TOTAL_ROWS / ROWS_PER_PAGE); // 25

	before(async function () {
		driver = await createDriver();
	});

	before(async function () {
		await driver.get('http://localhost:3000/tests/pages/grid/pagination.html');
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

	// Helper: count visible data rows (display !== 'none').
	async function getVisibleRowCount() {
		return driver.executeScript(`
			var rows = document.querySelectorAll('div.wcdv_grid_table > table > tbody > tr[data-row-num]');
			var count = 0;
			for (var i = 0; i < rows.length; i++) {
				if (rows[i].style.display !== 'none') count++;
			}
			return count;
		`);
	}

	// Helper: count total data rows in the DOM (including hidden ones).
	async function getTotalRowCount() {
		return driver.executeScript(`
			return document.querySelectorAll('div.wcdv_grid_table > table > tbody > tr[data-row-num]').length;
		`);
	}

	// Helper: get the pagination nav element.
	async function getPaginationNav() {
		return driver.findElement(By.css('nav.wcdv_pagination'));
	}

	// Helper: get all pagination button labels.
	async function getPageButtonLabels() {
		const nav = await getPaginationNav();
		const buttons = await nav.findElements(By.css('button.wcdv_pagination_btn'));
		const labels = [];
		for (const btn of buttons) {
			labels.push(await btn.getText());
		}
		return labels;
	}

	// Helper: get the current (active) page button label.
	async function getCurrentPageLabel() {
		const nav = await getPaginationNav();
		const current = await nav.findElement(By.css('button.wcdv_pagination_current'));
		return current.getText();
	}

	// Helper: click a page button by its visible label text.
	async function clickPageButton(label) {
		const nav = await getPaginationNav();
		const buttons = await nav.findElements(By.css('button.wcdv_pagination_btn'));
		for (const btn of buttons) {
			if ((await btn.getText()) === label) {
				await btn.click();
				return;
			}
		}
		throw new Error('No page button with label "' + label + '" found');
	}

	// Helper: count ellipsis elements.
	async function getEllipsisCount() {
		const nav = await getPaginationNav();
		const ellipses = await nav.findElements(By.css('span.wcdv_pagination_ellipsis'));
		return ellipses.length;
	}

	describe('initial state', function () {
		it('renders all rows into the DOM', async function () {
			const totalRows = await getTotalRowCount();
			assert.equal(totalRows, TOTAL_ROWS, 'all 1000 rows should be in the DOM');
		});

		it('shows only the first page of rows', async function () {
			const visibleRows = await getVisibleRowCount();
			assert.equal(visibleRows, ROWS_PER_PAGE, 'only 40 rows should be visible on the first page');
		});

		it('displays pagination controls', async function () {
			const nav = await getPaginationNav();
			assert.isTrue(await nav.isDisplayed(), 'pagination nav should be visible');
		});

		it('highlights page 1 as the current page', async function () {
			const label = await getCurrentPageLabel();
			assert.equal(label, '1', 'page 1 should be the current page');
		});

		it('shows correct page buttons around page 1', async function () {
			// On page 1: [1] [2] [3] ... [25]
			const labels = await getPageButtonLabels();
			assert.include(labels, '1');
			assert.include(labels, '2');
			assert.include(labels, '3');
			assert.include(labels, String(TOTAL_PAGES));
		});

		it('shows an ellipsis between the range and the last page', async function () {
			const count = await getEllipsisCount();
			assert.isAtLeast(count, 1, 'should have at least one ellipsis');
		});

		it('current page button is disabled', async function () {
			const nav = await getPaginationNav();
			const current = await nav.findElement(By.css('button.wcdv_pagination_current'));
			const disabled = await current.getAttribute('disabled');
			assert.isNotNull(disabled, 'current page button should be disabled');
		});
	});

	describe('page navigation', function () {
		it('navigates to page 2 when clicking "2"', async function () {
			await clickPageButton('2');
			const label = await getCurrentPageLabel();
			assert.equal(label, '2', 'current page should be 2');

			const visibleRows = await getVisibleRowCount();
			assert.equal(visibleRows, ROWS_PER_PAGE, 'page 2 should show 40 rows');
		});

		it('navigates to the last page', async function () {
			await clickPageButton(String(TOTAL_PAGES));
			const label = await getCurrentPageLabel();
			assert.equal(label, String(TOTAL_PAGES), 'current page should be the last page');

			const visibleRows = await getVisibleRowCount();
			assert.equal(visibleRows, TOTAL_ROWS % ROWS_PER_PAGE || ROWS_PER_PAGE,
				'last page should show the remaining rows');
		});

		it('navigates back to page 1', async function () {
			await clickPageButton('1');
			const label = await getCurrentPageLabel();
			assert.equal(label, '1', 'current page should be 1');

			const visibleRows = await getVisibleRowCount();
			assert.equal(visibleRows, ROWS_PER_PAGE, 'page 1 should show 40 rows');
		});

		it('navigates to a middle page and shows correct surrounding buttons', async function () {
			// Go to page 10 (roughly in the middle).
			// First go somewhere near it so page 10 is clickable.
			await clickPageButton('3');
			await clickPageButton('5');
			await clickPageButton('7');
			await clickPageButton('9');
			await clickPageButton('10');

			const label = await getCurrentPageLabel();
			assert.equal(label, '10', 'current page should be 10');

			// Should show: [1] ... [8] [9] [10] [11] [12] ... [25]
			const labels = await getPageButtonLabels();
			assert.include(labels, '1', 'first page button should be present');
			assert.include(labels, '8', 'page 8 button should be present');
			assert.include(labels, '9', 'page 9 button should be present');
			assert.include(labels, '10', 'page 10 button should be present');
			assert.include(labels, '11', 'page 11 button should be present');
			assert.include(labels, '12', 'page 12 button should be present');
			assert.include(labels, String(TOTAL_PAGES), 'last page button should be present');

			const ellipses = await getEllipsisCount();
			assert.equal(ellipses, 2, 'should have two ellipses on a middle page');
		});
	});

	describe('row visibility', function () {
		it('shows different rows on different pages', async function () {
			// Go to page 1 and get the first visible row's data-row-num.
			await clickPageButton('1');
			const page1RowNums = await driver.executeScript(`
				var rows = document.querySelectorAll('div.wcdv_grid_table > table > tbody > tr[data-row-num]');
				var result = [];
				for (var i = 0; i < rows.length; i++) {
					if (rows[i].style.display !== 'none') {
						result.push(rows[i].getAttribute('data-row-num'));
					}
				}
				return result;
			`);

			// Go to page 2 and get visible row nums.
			await clickPageButton('2');
			const page2RowNums = await driver.executeScript(`
				var rows = document.querySelectorAll('div.wcdv_grid_table > table > tbody > tr[data-row-num]');
				var result = [];
				for (var i = 0; i < rows.length; i++) {
					if (rows[i].style.display !== 'none') {
						result.push(rows[i].getAttribute('data-row-num'));
					}
				}
				return result;
			`);

			assert.equal(page1RowNums.length, ROWS_PER_PAGE, 'page 1 should have 40 visible rows');
			assert.equal(page2RowNums.length, ROWS_PER_PAGE, 'page 2 should have 40 visible rows');

			// The two pages should have completely different rows.
			const overlap = page1RowNums.filter((r) => page2RowNums.includes(r));
			assert.equal(overlap.length, 0, 'pages 1 and 2 should have no overlapping rows');
		});

		it('all rows remain in the DOM regardless of the page', async function () {
			await clickPageButton('3');
			const totalRows = await getTotalRowCount();
			assert.equal(totalRows, TOTAL_ROWS, 'all rows should remain in the DOM on page 3');
		});
	});

	describe('interaction with sort', function () {
		it('resets to page 1 after sorting', async function () {
			// Navigate to page 3 first.
			await clickPageButton('1');
			await clickPageButton('3');
			let label = await getCurrentPageLabel();
			assert.equal(label, '3', 'should start on page 3');

			// Click the "rowId" column header to sort.
			const headers = await driver.findElements(
				By.css('div.wcdv_grid_table > table > thead > tr > th')
			);
			// Find the "rowId" header and click it.
			for (const header of headers) {
				const text = await header.getText();
				if (text.includes('rowId')) {
					await header.click();
					break;
				}
			}
			await grid.waitForIdle();

			// After sort, the grid redraws and pagination should reset to page 1.
			label = await getCurrentPageLabel();
			assert.equal(label, '1', 'should reset to page 1 after sorting');

			const visibleRows = await getVisibleRowCount();
			assert.equal(visibleRows, ROWS_PER_PAGE, 'page 1 after sort should show 40 rows');
		});
	});
});
