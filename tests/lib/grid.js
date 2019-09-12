const _ = require('lodash');
const Promise = require("bluebird");
const {By, Key} = require('selenium-webdriver');
const until = require('selenium-webdriver/lib/until');
const {asyncMap, asyncFilter, selectByText, selectByValue, sleep} = require('./util.js');

const {Type: LoggingType} = require('selenium-webdriver/lib/logging');

// Grid UI {{{1

class GridUi {
	constructor(driver, id = 'grid') {
		this.driver = driver;
		this.id = id;
	}

	get prefsDeleteBtn() {
		return this.driver.findElement(By.css('div.wcdv_toolbar_view > button[title="Delete"]'));
	}

	get prefsResetBtn() {
		return this.driver.findElement(By.css('div.wcdv_toolbar_view > button[title="Reset"]'));
	}

	get prefsBackBtn() {
		return this.driver.findElement(By.css('div.wcdv_toolbar_view > button[title="Back"]'));
	}

	get prefsForwardBtn() {
		return this.driver.findElement(By.css('div.wcdv_toolbar_view > button[title="Forward"]'));
	}

	get prefsSaveBtn() {
		return this.driver.findElement(By.css('div.wcdv_toolbar_view > button[title="Save"]'));
	}

	get gearBtn() {
		return this.driver.findElement(By.css('div.wcdv_titlebar_controls > button[title="Show/Hide Options"]'));
	}

	get refreshBtn() {
		return this.driver.findElement(By.css('div.wcdv_titlebar_controls > button[title="Refresh"]'));
	}

	get table() {
		return this.driver.findElement(By.css('div.wcdv_grid div.wcdv_grid_table > table'));
	}
}

// Grid {{{1

class Grid {
	constructor(driver, id = 'grid') {
		this.driver = driver;
		this.id = id;
		this.ui = new GridUi(this.driver, this.id);
	}

	async dumpLogs() {
		(await this.driver.manage().logs().get(LoggingType.BROWSER)).forEach((l) => {
			console.log(l.message.replace(/\\u003C/g, '<'));
		});
	}

	async waitForIdle(opts = {}) {
		_.defaultsDeep(opts, {
			showLogs: false,
			debug: false,
			timeout: 2000
		});
		let attempt = 1;
		if (opts.debug) {
			process.stdout.write('Waiting for idle');
		}
		await this.driver.wait(async () => {
			if (opts.debug) {
				process.stdout.write('.');
			}
			const x = await this.driver.executeScript(`console.log('### IDLE [${attempt}]'); return MIE.WC_DataVis.grids['${this.id}'].isIdle()`);
			attempt += 1;
			if (opts.showLogs) {
				await this.dumpLogs();
			}
			return x;
		}, opts.timeout);
	}

	async refresh() {
		return this.ui.refreshBtn.click();
	}

	async toggleControls() {
		return this.ui.gearBtn.click();
	}

	async setSourceUrl(url) {
		return this.driver.executeScript(`MIE.WC_DataVis.grids['${this.id}'].view.source.origin.url = '${url}'`);
	}

	async getGroupCell(groupNum, colNum) {
		const trs = await this.driver.findElements(By.css('div.wcdv_grid div.wcdv_grid_table > table > tbody > tr'));
		const tds = await trs[groupNum].findElements(By.css('td'));
		return tds[colNum].getText();
	}

	async getNumRows() {
		const trs = await this.driver.findElements(By.css('div.wcdv_grid div.wcdv_grid_table > table > tbody > tr'));
		//const visible = await asyncFilter(trs, async (elt) => await elt.isDisplayed());
		return trs.length;
	}

	async setGroupMode(kind) {
		return this.driver.findElement(By.css(`input[type=radio][name=groupOutput][value=${kind}]`)).click();
	}

	// Sorting {{{2

	async sortBy(column, ordering) {
		const start = new Date();
		const header = await this.driver.findElement(By.xpath(`//span[@data-wcdv-field="${column}"]/../div`)).click();
		const sortMenus = await asyncFilter(await this.driver.findElements(By.className('context-menu-root')), (elt) => elt.isDisplayed());
		const sortItems = await sortMenus[0].findElements(By.className('context-menu-item'));
		const validSortItems = await asyncFilter(sortItems, async (elt) => await elt.getText() !== '');
		// data:[Promise<WebElement>], predicate:(WebElement)->Promise<bool>
		const orderingOptions = await asyncFilter(validSortItems, async (elt) => await elt.getText() === ordering);
		const end = new Date();

		//console.log(`Took ${end.valueOf() - start.valueOf()}ms to find sort menu item.`);

		if (orderingOptions.length !== 1) {
			throw new Error(`Invalid ordering "${ordering}", found: ${JSON.stringify(await asyncMap(validSortItems, (elt) => elt.getText()))}`);
		}

		return await orderingOptions[0].click();
	}

	// Group {{{2

	async getGroup() {
		const li = await this.driver.findElements(By.css('div.wcdv_group_control > div > ul > li[data-wcdv-field] > div.wcdv_field > span:first-of-type'));
		return Promise.all(_.map(li, (elt) => elt.getText()));
	}

	async setGroup() {
	}

	async addGroup(field, groupFun) {
		const control = this.driver.findElement(By.css('div.wcdv_group_control'));
		const dropdown = control.findElement(By.css('select.wcdv_control_addField'));
		if (groupFun == null) {
			return selectByText(dropdown, field);
		}
		else {
			await selectByText(dropdown, field);

			const wins = await this.driver.findElements(By.css('div.ui-dialog'));
			if (wins.length === 0) {
				throw new Error('Unable to find any jQuery UI windows');
			}
			const visibleWins = await asyncFilter(wins, (elt) => elt.isDisplayed());
			if (visibleWins.length === 0) {
				throw new Error('Unable to find any visible jQuery UI windows');
			}
			if (visibleWins.length > 1) {
				throw new Error('Found too many visible jQuery UI windows');
			}
			return visibleWins[0].findElement(By.css(`button.wcdv_option[data-wcdv-groupfunname=${groupFun}]`)).click();
		}
	}

	async removeGroup(field) {
		const groupFields = asyncFilter(this.driver.findElements(By.css('div.wcdv_group_control > div > ul > li[data-wcdv-field]')), async (li) => await li.getText() === field);

		if (groupFields.length !== 1) {
			throw new Error('grr');
		}

		return groupFields[0].findElements(By.css('button.wcdv_remove')).click();
	}

	async clearGroup() {
		return this.driver.findElement(By.css('div.wcdv_group_control .wcdv_control_clear_button')).click();
	}

	async setGroupFun(field, groupFunName) {
		const groupField = this.driver.findElement(By.css(`div.wcdv_group_control > div > ul > li[data-wcdv-field="${field}"]`));

		await groupField.findElement(By.css('button[data-wcdv-role=set-group-fun]')).click();

		const wins = await this.driver.findElements(By.css('div.ui-dialog'));
		if (wins.length === 0) {
			throw new Error('Unable to find any jQuery UI windows');
		}
		const visibleWins = await asyncFilter(wins, (elt) => elt.isDisplayed());
		if (visibleWins.length === 0) {
			throw new Error('Unable to find any visible jQuery UI windows');
		}
		if (visibleWins.length > 1) {
			throw new Error('Found too many visible jQuery UI windows');
		}
		return visibleWins[0].findElement(By.css(`button.wcdv_option[data-wcdv-groupfunname=${groupFunName}]`)).click();
	}

	// Pivot {{{2

	async getPivot() {
		const li = await this.driver.findElements(By.css('div.wcdv_pivot_control > div > ul > li[data-wcdv-field] > div.wcdv_field > span:first-of-type'));
		return Promise.all(_.map(li, (elt) => elt.getText()));
	}

	async setPivot() {
	}

	async addPivot(field) {
		const control = this.driver.findElement(By.css('div.wcdv_pivot_control'));
		const dropdown = control.findElement(By.css('select.wcdv_control_addField'));
		return selectByText(dropdown, field);
	}

	async removePivot(field) {
		const pivotFields = asyncFilter(this.driver.findElements(By.css('div.wcdv_pivot_control > div > ul > li[data-wcdv-field]')), async (li) => await li.getText() === field);

		if (pivotFields.length !== 1) {
			throw new Error('grr');
		}

		return pivotFields[0].findElements(By.css('button.wcdv_remove')).click();
	}

	async clearPivot() {
		return this.driver.findElement(By.css('div.wcdv_pivot_control .wcdv_control_clear_button')).click();
	}

	// Aggregates {{{2

	async addAggregate(funName, field) {
		const control = await this.driver.findElement(By.css('div.wcdv_aggregate_control'));
		const dropdown = await control.findElement(By.css('div > div > select'));
		await selectByValue(dropdown, funName);
	}

	async setAggregate(funName, field) {
		const control = await this.driver.findElement(By.css('div.wcdv_aggregate_control'));
		const fieldDropdown = await control.findElement(By.css('div.wcdv_field li.wcdv_aggregate_field > select'));
		await selectByValue(fieldDropdown, field);
	}

	async clearAggregates() {
		return this.driver.findElement(By.css('div.wcdv_aggregate_control .wcdv_control_clear_button')).click();
	}

	// Filter {{{2

	async addFilter(field) {
		const control = await this.driver.findElement(By.css('div.wcdv_filter_control'));
		const dropdown = await control.findElement(By.css('select.wcdv_control_addField'));
		return selectByText(dropdown, field);
	}

	async clearFilter() {
		const control = await this.driver.findElement(By.css('div.wcdv_filter_control'));
		return control.findElement(By.css('span.wcdv_control_clear_button')).click();
	}

	async setFilter(field, type, op, value) {
		async function sumoSelect_selectNone(sumoSelectDiv) {
			const optWrapper = await sumoSelectDiv.findElement(By.css('div.optWrapper'));
			/* BAD WAY OF DOING IT
			// First find a partially checked "select all" box.  Clicking this selects everything.
			let selectAll = await optWrapper.findElements(By.css('p.select-all.partial'));
			if (selectAll.length === 1) {
				await selectAll[0].click();
			}
			// Click the "select all" checkbox (again, if it was partially selected before).
			selectAll = await optWrapper.findElements(By.css('p.select-all.selected'));
			if (selectAll.length === 1) {
				await selectAll[0].click();
			}
			*/
			const selected = await optWrapper.findElements(By.css('ul.options > li.opt.selected'));
			if (selected.length > 0) {
				await Promise.each(selected, (s) => s.click());
			}
		}

		const control = await this.driver.findElement(By.css('div.wcdv_filter_control'));
		// Find the item in the filter control for this field.
		const controlField = await asyncFilter(await this.driver.findElements(By.css('div.wcdv_filter_control > div > ul > li[data-wcdv-field]')), async (li) => await li.getAttribute('data-wcdv-field') === field);

		if (controlField.length !== 1) {
			throw new Error('grr');
		}

		if (op != null) {
			const opDropdown = await controlField[0].findElement(By.css('div.wcdv_filter_control_filter > select'));
			await selectByValue(opDropdown, op);
		}

		switch (type) {
		case 'sumoselect': {
			const sumoselect = await controlField[0].findElement(By.css('div.wcdv_filter_control_filter > div.SumoSelect'));
			// Open the SumoSelect dropdown.
			await sumoselect.findElement(By.css('p.SelectBox')).click();
			const optWrapper = await sumoselect.findElement(By.css('div.optWrapper'));
			// Make sure everything is unselected first.
			await sumoSelect_selectNone(sumoselect);
			// Find the items in the dropdown that match what was requested...
			const labels = await optWrapper.findElements(By.css('ul.options > li > label'));
			const matchingLabels = await asyncFilter(labels, async (label) => value.indexOf(await label.getText()) >= 0);
			// ...and click on them!
			await Promise.all(_.map(matchingLabels, (elt) => elt.click()));
			// Click the "OK" button.
			await optWrapper.findElement(By.css('div.MultiControls > p.btnOk')).click();
			break;
		}
		case 'input': {
			const input = await controlField[0].findElement(By.css('div.wcdv_filter_control_filter > input'));
			await input.clear();
			await input.sendKeys(value, Key.ENTER);
			break;
		}
		default:
			throw new Error('unsupported filter type: ' + type);
		}
	}

	// Perspective {{{2

	async getPerspective() {
		const dropdown = this.driver.findElement(By.css('div.wcdv_toolbar_view select'));
		const value = await dropdown.getAttribute('value');
		const options = await dropdown.findElements(By.css('option'));
		const matchingOptions = await asyncFilter(options, async (o) => await o.getAttribute('value') === value);

		if (matchingOptions.length === 0) {
			throw new Error(`Select's value (${value}) does not correspond to any of its options`);
		}
		else if (matchingOptions.length > 1) {
			throw new Error(`Select's value (${value}) corresponds to more than one of its options`);
		}

		return matchingOptions[0].getText();
	}

	async setPerspective(toWhat) {
		const dropdown = await this.driver.findElement(By.css('div.wcdv_toolbar_view select'));
		return await selectByText(dropdown, toWhat);
	}

	async newPerspective(name) {
		await this.setPerspective('New Perspective...');
		let a = await this.driver.wait(until.alertIsPresent());
		await a.sendKeys(name);
		return a.accept();
	}

	async renamePerspective() {
	}

	async deletePerspective() {
		return this.ui.prefsDeleteBtn.click();
	}

	async resetPrefs() {
		return this.ui.prefsResetBtn.click();
	}

	async prevPerspective() {
		return this.ui.prefsBackBtn.click();
	}

	async nextPerspective() {
		return this.ui.prefsForwardBtn.click();
	}

	async savePrefs() {
		return this.ui.prefsSaveBtn.click();
	}

	// Selection {{{2

	async selectAll() {
		return this.driver.findElement(By.css('div.wcdv_grid div.wcdv_grid_table > table > thead > tr > th > input[name=checkAll][type=checkbox]')).click();
	}

	async selectRow(rowNum) {
		const table = await this.driver.findElement(By.css('div.wcdv_grid div.wcdv_grid_table > table'));
		const trs = await table.findElements(By.css('tbody > tr[data-row-num]'));
		const tr = trs[rowNum];
		if (tr == null) {
			throw new Error(`No such row: ${rowNum}`);
		}
		const input = await tr.findElement(By.css('td:nth-child(1) > input[type=checkbox]'));
		return input.click();
	}

	async selectGroup(path) {
	}

	async getSelection() {
		return this.driver.executeScript(`return MIE.WC_DataVis.grids['${this.id}'].getSelection().rows.map((row) => {
			var result = {};
			for (field in row) {
				if (row.hasOwnProperty(field)) {
					result[field] = row[field].orig;
				}
			}
			return result;
		});`);
	}

	// Data Checking - Plain {{{2

	/**
	 * Get a cell from a plain table, given the name of the column and the row number.
	 *
	 * @param {string} column
	 * Name of the column to look for.
	 *
	 * @param {number} row
	 * Which row to retrieve the value for.  The index is zero-based.  You can pass a negative number
	 * to read backwards from the end (e.g. -1 is the last row).
	 *
	 * @param {object} opts
	 * Additional options.
	 *
	 * @param {string} opts.result
	 * What kind of result do you want?  Can be:
	 *
	 *   - `text`: Gets the text of the cell.
	 *   - `element`: Returns the TD itself.
	 */

	async getCell(column, row, opts) {
		opts = _.defaults({}, opts, {
			result: 'text'
		});

		if (typeof column !== 'string')
			throw new Error('Call Error: `column` must be a string');
		if (typeof row !== 'number')
			throw new Error('Call Error: `row` must be a number');
		if (['text', 'element'].indexOf(opts.result) < 0)
			throw new Error('Call Error: `opts.result` must be: "text" or "element"');

		const table = await this.driver.findElement(By.css('div.wcdv_grid div.wcdv_grid_table > table'));
		const headers = await table.findElements(By.css('thead > tr > th'));
		const th = await asyncFilter(headers, async (elt) => await elt.getText() === column, {reportPosition: true});
		if (th.length === 0) {
			throw new Error(`No such column: ${column}`);
		}
		// Using the 'data-row-num' attribute here to prevent counting the "show more rows" TR.
		const trs = await table.findElements(By.css('tbody > tr[data-row-num]'));
		const tr = trs[row >= 0 ? row : trs.length + row];
		if (tr == null) {
			throw new Error(`No such row: ${row}`);
		}
		const tds = await tr.findElements(By.css('td'));
		const td = tds[th[0].pos];
		switch (opts.result) {
		case 'element':
			return td;
		case 'text':
			return await td.getText();
		}
	}

	async getColumns() {
		const table = await this.driver.findElement(By.css('div.wcdv_grid div.wcdv_grid_table > table'));
		const headers = await table.findElements(By.css('thead > tr > th > div.wcdv_heading_container > span.wcdv_heading_title'));
		return Promise.all(_.map(headers, (elt) => elt.getText()));
	}

	async getPlainData() {
		const trs = await this.ui.table.findElements(By.css('tbody > tr'));
		return Promise.all(_.map(trs, async (tr) => {
			let tds = await tr.findElements(By.css('td'));
			return Promise.all(_.map(tds, async (td) => {
				let t = await td.getText();
				// In DataVis, an empty cell is actually rendered as a lone "&nbsp;" so that a row of all
				// empty cells still renders at full height, and not squished down.  However, when we do
				// getText() on such an empty cell, instead of "\u00A0" we get a single regular space. We
				// check for that single space and pretend it's truly empty.  But that means we technically
				// can't distinguish between an empty cell and one that contains a single regular space.
				return t === ' ' ? '' : t;
			}));
		}));
	}

	// Data Checking - Group {{{2

	/**
	 * Get rowval cells from a group summary table, given the row number.
	 *
	 * @param {number} rowValIdx
	 * What rowval index to look for, which translates to a TR in the table.
	 *
	 * @param {object} opts
	 * Additional options.
	 *
	 * @param {string} opts.result
	 * What kind of result do you want?  Can be:
	 *
	 *   - `text`: Gets the text of the cell.
	 *   - `element`: Returns the TH itself.
	 */

	async getRowVal(rowValIdx, opts) {
		opts = _.defaults({}, opts, {
			result: 'text'
		});

		if (typeof rowValIdx !== 'number')
			throw new Error('Call Error: `rowValIdx` must be a number');
		if (['text', 'element'].indexOf(opts.result) < 0)
			throw new Error('Call Error: `opts.result` must be: "text" or "element"');

		const trs = await this.driver.findElements(By.css('div.wcdv_grid div.wcdv_grid_table > table > tbody > tr'));

		if (rowValIdx >= trs.length || (rowValIdx < 0 && rowValIdx < trs.length * -1)) {
			throw new Error(`Test Error: Looking for rowValIdx = ${rowValIdx}, but only ${trs.length} rowVals were found`);
		}

		if (rowValIdx < 0) {
			rowValIdx = trs.length + rowValIdx;
		}

		const ths = await trs[rowValIdx].findElements(By.css('th > div.wcdv_heading_container > span.wcdv_heading_title'));

		return Promise.mapSeries(ths, async (th) => {
			switch (opts.result) {
			case 'element':
				return th;
			case 'text':
				return await th.getText();
			}
		});
	}

	/**
	 * Get a rowval cell from a group summary table, given the row and column numbers.
	 *
	 * @param {number} rowValIdx
	 * What rowval index to look for, which translates to a TR in the table.
	 *
	 * @param {number} groupFieldIdx
	 * The index of the element of the rowval to find, corresponding to an index in list of fields
	 * we're grouping by.  For example, grouping by `['state', 'last_name']` and passing 1 extracts
	 * the `last_name` element of the rowval.
	 *
	 * @param {object} opts
	 * Additional options.
	 *
	 * @param {string} opts.result
	 * What kind of result do you want?  Can be:
	 *
	 *   - `text`: Gets the text of the cell.
	 *   - `element`: Returns the TH itself.
	 */

	async getRowValElt(rowValIdx, groupFieldIdx, opts) {
		opts = _.defaults({}, opts, {
			result: 'text'
		});

		if (typeof rowValIdx !== 'number')
			throw new Error('Call Error: `rowValIdx` must be a number');
		if (typeof groupFieldIdx !== 'number')
			throw new Error('Call Error: `groupFieldIdx` must be a number');
		if (['text', 'element'].indexOf(opts.result) < 0)
			throw new Error('Call Error: `opts.result` must be: "text" or "element"');

		const trs = await this.driver.findElements(By.css('div.wcdv_grid div.wcdv_grid_table > table > tbody > tr'));

		if (rowValIdx >= trs.length || (rowValIdx < 0 && rowValIdx < trs.length * -1)) {
			throw new Error(`Test Error: Looking for rowValIdx = ${rowValIdx}, but only ${trs.length} rowVals were found`);
		}

		if (rowValIdx < 0) {
			rowValIdx = trs.length + rowValIdx;
		}

		const ths = await trs[rowValIdx].findElements(By.css('th > div.wcdv_heading_container > span.wcdv_heading_title'));
		const th = ths[groupFieldIdx];
		switch (opts.result) {
		case 'element':
			return th;
		case 'text':
			return await th.getText();
		}
	}

	// Data Checking - Aggregates {{{2

	/**
	 * Get the result of an aggregate function for the specified rowval (and colval, if pivotted).
	 *
	 * @param {string} rowVal The rowval we're looking for.
	 * @param {string} [colVal] The colval we're looking for.
	 * @param {number} [aggNum=0] Index of the aggregate we're looking for.
	 */

	async getAggResult_byVal(rowVal, colVal, aggNum = 0) {
		const table = await this.driver.findElement(By.css('div.wcdv_grid div.wcdv_grid_table > table'));
		if (colVal != null) {
			// TODO
			throw new Error('not implemented');
		}
		else if (rowVal.length > 1) {
			// TODO
			throw new Error('not implemented');
		}
		else {
			const trs = await table.findElements(By.css('tbody > tr'));
			const rowValHeaders = await table.findElements(By.css('tbody > tr > th'));
			const th = await asyncFilter(rowValHeaders, async (elt) => await elt.getText() === rowVal[0], {reportPosition: true});
			if (th.length === 0) {
				throw new Error(`No such rowval: ${rowVal[0]}`);
			}
			if (th.length > 1) {
				throw new Error(`Too many matching rowvals: ${rowVal[0]}`);
			}
			const tds = await trs[th[0].pos].findElements(By.css(`tbody > tr > td[data-rowval-index]`));
			if (tds.length === 0) {
				throw new Error(`No cell for rowval: ${rowVal[0]}`);
			}
			if (tds.length < aggNum + 1) {
				throw new Error(`No such aggnum: ${aggNum}`);
			}
			return tds[aggNum].getText();
		}
	}

	/**
	 * Get the result of an aggregate function for the specified rowval (and colval, if pivotted).
	 *
	 * @param {number} rowValIdx Index of the rowval we're looking for.
	 * @param {number} [colValIdx] Index of the colval we're looking for.
	 * @param {number} [aggNum=0] Index of the aggregate we're looking for.
	 */

	async getAggResult_byNum(rowValIdx, colValIdx, aggNum = 0) {
		const table = await this.driver.findElement(By.css('div.wcdv_grid div.wcdv_grid_table > table'));
		if (colValIdx != null) {
			// TODO
			throw new Error('not implemented');
		}
		else {
			const tds = await table.findElement(By.css(`tbody > tr > td[data-rowval-index=${rowValIdx}]`));
			if (tds.length === 0) {
				throw new Error(`No such rowval index: ${rowValIdx}`);
			}
			if (tds.length < aggNum + 1) {
				throw new Error(`No such aggnum: ${aggNum}`);
			}
			return tds[aggNum].getText();
		}
	}

	// }}}2
}

// }}}1

module.exports = Grid;
