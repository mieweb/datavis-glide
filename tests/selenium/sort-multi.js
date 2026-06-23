const assert = require('chai').assert;
const Grid = require('../lib/grid.js');
const {setupServer, createDriver} = require('../lib/util.js');
const {By} = require('selenium-webdriver');

const PAGE = 'http://localhost:3000/tests/pages/grid/sorting/multi-column.html';

// Comparison helpers {{{1

// Strings are compared case-insensitively: the sample data uses Title-Case single words and known
// country names, so this matches the engine's order while being robust to any case folding.
function cmpStr(a, b) {
	const x = String(a).toLowerCase();
	const y = String(b).toLowerCase();
	return x < y ? -1 : x > y ? 1 : 0;
}

// Numbers may be rendered with grouping commas (e.g. "8,443"); strip them before comparing.
function cmpNum(a, b) {
	const x = parseFloat(String(a).replace(/,/g, ''));
	const y = parseFloat(String(b).replace(/,/g, ''));
	return x < y ? -1 : x > y ? 1 : 0;
}

/**
 * Assert that an array of rows is ordered by a compound (multi-column) sort key.  This verifies the
 * exact behavior of a multi-column sort: rows are ordered by the first key, ties broken by the
 * second, and so on.
 *
 * @param {Array.<object|Array>} rows
 * The rows to check, in display order.  Each row is indexed by the `col` of each key (a property
 * name for objects, or an index for arrays).
 *
 * @param {Array.<{col: (string|number), dir: string, cmp: function}>} keys
 * The sort keys, in priority order.  `dir` is "asc" or "desc"; `cmp` compares two cell values.
 *
 * @param {string} [msg]
 * Message prefix used when an ordering violation is found.
 */
function assertCompoundSorted(rows, keys, msg) {
	for (let i = 1; i < rows.length; i++) {
		const prev = rows[i - 1];
		const cur = rows[i];
		for (let k = 0; k < keys.length; k++) {
			const key = keys[k];
			let c = key.cmp(prev[key.col], cur[key.col]);
			if (key.dir === 'desc') {
				c = -c;
			}
			if (c < 0) {
				break; // correctly ordered by this key; no need to check finer keys
			}
			if (c > 0) {
				assert.fail(`${msg || 'rows out of order'}: row ${i - 1} before row ${i} violates key "${key.col}" ${key.dir} (${JSON.stringify(prev)} vs ${JSON.stringify(cur)})`);
			}
			// Tie on this key: fall through to the next, finer key.
		}
	}
}

describe('Multi-Column Sort', function () {
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

	beforeEach(async function () {
		await driver.get(PAGE);
		grid = new Grid(driver);
		await grid.waitForIdle();
	});

	afterEach(async function () {
		await driver.executeScript('window.localStorage.clear()');
	});

	// Read every group-summary rowval row (excluding the trailing total row) as an array of its
	// rowval cell texts.  Used to verify the order of grouped output under a compound sort.
	async function getGroupRowVals(numFields) {
		const trs = await driver.findElements(By.css('div.wcdv_grid div.wcdv_grid_table > table > tbody > tr[data-wcdv-rvi]'));
		const out = [];
		for (let i = 0; i < trs.length; i++) {
			const ths = await trs[i].findElements(By.css('th > div.wcdv_heading_container > span.wcdv_heading_title'));
			const vals = [];
			for (let j = 0; j < numFields; j++) {
				vals.push(await ths[j].getText());
			}
			out.push(vals);
		}
		return out;
	}

	// Read the view's vertical sort chain straight from the engine.  Useful for asserting that the
	// chain has the expected length (e.g. no duplicate entries).
	function getVerticalChain() {
		return driver.executeScript(`var s = MIE.WC_DataVis.grids['grid'].view.getSort(); return (s && s.vertical) ? s.vertical : []`);
	}

	// Plain output {{{1

	describe('plain output', function () {
		it('sorts by a 3-column compound key (all ascending)', async function () {
			await grid.sortByField('fruit', 'asc');
			await grid.waitForIdle();
			await grid.addSortByField('country', 'asc');
			await grid.waitForIdle();
			await grid.addSortByField('int1', 'asc');
			await grid.waitForIdle();

			const rows = await grid.getPlainData_asObjects(['fruit', 'country', 'int1']);
			assertCompoundSorted(rows, [
				{col: 'fruit', dir: 'asc', cmp: cmpStr},
				{col: 'country', dir: 'asc', cmp: cmpStr},
				{col: 'int1', dir: 'asc', cmp: cmpNum}
			], 'plain 3-column asc');
		});

		it('honors a per-column direction in a compound sort (asc then desc)', async function () {
			await grid.sortByField('fruit', 'asc');
			await grid.waitForIdle();
			await grid.addSortByField('int1', 'desc');
			await grid.waitForIdle();

			const rows = await grid.getPlainData_asObjects(['fruit', 'int1']);
			assertCompoundSorted(rows, [
				{col: 'fruit', dir: 'asc', cmp: cmpStr},
				{col: 'int1', dir: 'desc', cmp: cmpNum}
			], 'plain asc/desc');
		});

		it('renders numbered priority badges on each sorted header', async function () {
			await grid.sortByField('fruit', 'asc');
			await grid.waitForIdle();
			await grid.addSortByField('country', 'asc');
			await grid.waitForIdle();
			await grid.addSortByField('int1', 'asc');
			await grid.waitForIdle();

			assert.deepEqual(await grid.getSortPriorityBadge('fruit'), {text: '1', label: 'Sort priority 1'});
			assert.deepEqual(await grid.getSortPriorityBadge('country'), {text: '2', label: 'Sort priority 2'});
			assert.deepEqual(await grid.getSortPriorityBadge('int1'), {text: '3', label: 'Sort priority 3'});
		});

		it('shows no priority badge for a single-column sort', async function () {
			await grid.sortByField('fruit', 'asc');
			await grid.waitForIdle();

			assert.isNull(await grid.getSortPriorityBadge('fruit'));
		});

		it('replaces the sort when a row is clicked, appends when its add button is clicked', async function () {
			await grid.sortByField('fruit', 'asc');
			await grid.waitForIdle();
			await grid.addSortByField('country', 'asc');
			await grid.waitForIdle();

			// Both columns now participate, with priority badges.
			assert.equal((await grid.getSortPriorityBadge('fruit')).text, '1');
			assert.equal((await grid.getSortPriorityBadge('country')).text, '2');
			assert.lengthOf(await getVerticalChain(), 2);

			// Clicking a different column's row (not its add button) replaces the whole chain.
			await grid.sortByField('int1', 'desc');
			await grid.waitForIdle();

			assert.lengthOf(await getVerticalChain(), 1);
			assert.isNull(await grid.getSortPriorityBadge('fruit'));
			assert.isNull(await grid.getSortPriorityBadge('country'));
			assert.isNull(await grid.getSortPriorityBadge('int1'));

			const rows = await grid.getPlainData_asObjects(['int1']);
			assertCompoundSorted(rows, [{col: 'int1', dir: 'desc', cmp: cmpNum}], 'replace -> single col');
		});

		it('updates direction instead of duplicating when re-adding a column already in the chain', async function () {
			await grid.sortByField('fruit', 'asc');
			await grid.waitForIdle();
			await grid.addSortByField('country', 'asc');
			await grid.waitForIdle();

			// Re-add the same column with the opposite direction.
			await grid.addSortByField('country', 'desc');
			await grid.waitForIdle();

			// Chain still has exactly two entries (no duplicate), with country now descending.
			const chain = await getVerticalChain();
			assert.lengthOf(chain, 2, 'chain should not gain a duplicate entry');
			assert.equal(chain[1].dir, 'desc');

			assert.equal((await grid.getSortPriorityBadge('fruit')).text, '1');
			assert.equal((await grid.getSortPriorityBadge('country')).text, '2');

			const rows = await grid.getPlainData_asObjects(['fruit', 'country']);
			assertCompoundSorted(rows, [
				{col: 'fruit', dir: 'asc', cmp: cmpStr},
				{col: 'country', dir: 'desc', cmp: cmpStr}
			], 're-add updates direction');
		});

		it('clears the entire chain with Reset Sort', async function () {
			await grid.sortByField('fruit', 'asc');
			await grid.waitForIdle();
			await grid.addSortByField('country', 'asc');
			await grid.waitForIdle();
			await grid.addSortByField('int1', 'asc');
			await grid.waitForIdle();
			assert.lengthOf(await getVerticalChain(), 3);

			await grid.resetSort('fruit');
			await grid.waitForIdle();

			assert.lengthOf(await getVerticalChain(), 0);
			assert.isNull(await grid.getSortPriorityBadge('fruit'));
			assert.isNull(await grid.getSortPriorityBadge('country'));
			assert.isNull(await grid.getSortPriorityBadge('int1'));
		});

		it('round-trips a multi-column sort through reload (localStorage)', async function () {
			await grid.sortByField('fruit', 'asc');
			await grid.waitForIdle();
			await grid.addSortByField('country', 'desc');
			await grid.waitForIdle();
			await grid.addSortByField('int1', 'asc');
			await grid.waitForIdle();

			const before = await grid.getPlainData_asObjects(['fruit', 'country', 'int1']);

			await driver.navigate().refresh();
			grid = new Grid(driver);
			await grid.waitForIdle();

			const after = await grid.getPlainData_asObjects(['fruit', 'country', 'int1']);
			assert.deepEqual(after, before, 'row order should be identical after reload');

			// Priority badges are restored after the reload too.
			assert.equal((await grid.getSortPriorityBadge('fruit')).text, '1');
			assert.equal((await grid.getSortPriorityBadge('country')).text, '2');
			assert.equal((await grid.getSortPriorityBadge('int1')).text, '3');
		});
	});

	// Group output {{{1

	describe('group output (summary)', function () {
		describe('grouped by fruit, country', function () {
			beforeEach(async function () {
				await grid.addGroup('fruit');
				await grid.waitForIdle();
				await grid.addGroup('country');
				await grid.waitForIdle();
				await grid.setGroupMode('summary');
				await grid.waitForIdle();
			});

			it('sorts grouped output by two group fields', async function () {
				await grid.sortByField('fruit', 'asc');
				await grid.waitForIdle();
				await grid.addSortByField('country', 'asc');
				await grid.waitForIdle();

				const rows = await getGroupRowVals(2);
				assertCompoundSorted(rows, [
					{col: 0, dir: 'asc', cmp: cmpStr},
					{col: 1, dir: 'asc', cmp: cmpStr}
				], 'group 2-field sort');

				assert.equal((await grid.getSortPriorityBadge('fruit')).text, '1');
				assert.equal((await grid.getSortPriorityBadge('country')).text, '2');
			});

			it('honors a per-field direction in grouped output (fruit asc, country desc)', async function () {
				await grid.sortByField('fruit', 'asc');
				await grid.waitForIdle();
				await grid.addSortByField('country', 'desc');
				await grid.waitForIdle();

				const rows = await getGroupRowVals(2);
				assertCompoundSorted(rows, [
					{col: 0, dir: 'asc', cmp: cmpStr},
					{col: 1, dir: 'desc', cmp: cmpStr}
				], 'group asc/desc sort');
			});
		});

		describe('grouped by fruit', function () {
			beforeEach(async function () {
				await grid.addGroup('fruit');
				await grid.waitForIdle();
				await grid.setGroupMode('summary');
				await grid.waitForIdle();
			});

			it('shows no badge for a lone aggregate (Count) sort', async function () {
				await grid.sortByAgg('Count', 'desc');
				await grid.waitForIdle();

				assert.isNull(await grid.getAggSortPriorityBadge('Count'));
				assert.isNull(await grid.getSortPriorityBadge('fruit'));
			});

			it('numbers a group-field + Count compound sort as 1, 2', async function () {
				await grid.sortByField('fruit', 'asc');
				await grid.waitForIdle();
				await grid.addSortByAgg('Count', 'desc');
				await grid.waitForIdle();

				assert.equal((await grid.getSortPriorityBadge('fruit')).text, '1');
				assert.equal((await grid.getAggSortPriorityBadge('Count')).text, '2');
			});
		});
	});

	// Cross-output-mode regressions {{{1

	describe('cross-output-mode behavior', function () {
		it('does not carry priority badges across output modes', async function () {
			// Build a 2-column sort in PLAIN mode first.
			await grid.sortByField('string1', 'asc');
			await grid.waitForIdle();
			await grid.addSortByField('int1', 'asc');
			await grid.waitForIdle();

			// Switch to a group-by-fruit summary view.
			await grid.addGroup('fruit');
			await grid.waitForIdle();
			await grid.setGroupMode('summary');
			await grid.waitForIdle();

			// Build a fresh compound sort within group mode: Fruit, then Count.
			await grid.sortByField('fruit', 'asc');
			await grid.waitForIdle();
			await grid.addSortByAgg('Count', 'desc');
			await grid.waitForIdle();

			// Badges reflect only the group-mode chain (1, 2) — not inflated by the stale plain sort.
			assert.equal((await grid.getSortPriorityBadge('fruit')).text, '1');
			assert.equal((await grid.getAggSortPriorityBadge('Count')).text, '2');
		});

		it('does not crash when removing a grouped column with a stale sort spec', async function () {
			// Plain output: sort by Country ascending.
			await grid.sortByField('country', 'asc');
			await grid.waitForIdle();

			// Group by Fruit and switch to summary output.
			await grid.addGroup('fruit');
			await grid.waitForIdle();
			await grid.setGroupMode('summary');
			await grid.waitForIdle();

			// Add a group-field sort by Fruit (the Country plain sort is preserved for plain output).
			await grid.sortByField('fruit', 'asc');
			await grid.waitForIdle();

			// Remove the Fruit group field — this must not crash the grid.
			const removeBtn = await driver.findElement(By.css('div.wcdv_group_control li[data-wcdv-field="fruit"] button.wcdv_remove'));
			await removeBtn.click();
			await grid.waitForIdle();

			// The grid refreshes back to plain output, silently skipping the now-inapplicable group
			// sort, and the remaining Country sort is preserved with correct order.
			const rows = await grid.getPlainData_asObjects(['country']);
			assert.isAbove(rows.length, 0, 'grid should still render rows (did not crash)');
			assertCompoundSorted(rows, [{col: 'country', dir: 'asc', cmp: cmpStr}], 'country preserved after remove');
		});
	});
});
