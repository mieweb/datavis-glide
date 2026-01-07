/**
 * Contains classes and methods for directly interacting with a DataVis grid on a page.
 */

const _ = require('lodash');
const Promise = require("bluebird");
const {By, Key} = require('selenium-webdriver');
const until = require('selenium-webdriver/lib/until');
const {asyncFirst, asyncMap, asyncEach, asyncFilter, blur, selectByText, selectByValue, hasClass, getClass, sleep} = require('./util.js');

const {Type: LoggingType} = require('selenium-webdriver/lib/logging');

// Grid UI {{{1

/**
 * @class
 * Provides basic functions for locating items within the grid's user interface.
 */

class GridUi {
	/**
	 * Construct a view of the grid's user interface on a page.
	 *
	 * @param {selenium-webdriver.ThenableWebDriver} driver
	 * @param {string} [id="grid"]
	 */

	constructor(driver, id = 'grid') {
		this.driver = driver;
		this.id = id;
	}

	get grid() {
		return this.driver.findElement(By.id(this.id));
	}

	/**
	 * Locate the button to delete the current perspective.
	 *
	 * @example
	 * let g = new Grid(driver);
	 * await g.ui.prefsDeleteBtn.click();
	 */

	get prefsDeleteBtn() {
		return this.driver.findElement(By.css('div.wcdv_toolbar_view > button[title="Delete"]'));
	}

	/**
	 * Locate the button to reset preferences.
	 *
	 * @example
	 * let g = new Grid(driver);
	 * await g.ui.prefsResetBtn.click();
	 */

	get prefsResetBtn() {
		return this.driver.findElement(By.css('div.wcdv_toolbar_view > button[title="Reset"]'));
	}

	/**
	 * Locate the button to switch to the previous perspective.
	 *
	 * @example
	 * let g = new Grid(driver);
	 * await g.ui.prefsBackBtn.click();
	 */

	get prefsBackBtn() {
		return this.driver.findElement(By.css('div.wcdv_toolbar_view > button[title="Back"]'));
	}

	/**
	 * Locate the button to switch to the next perspective.
	 *
	 * @example
	 * let g = new Grid(driver);
	 * await g.ui.prefsForwardBtn.click();
	 */

	get prefsForwardBtn() {
		return this.driver.findElement(By.css('div.wcdv_toolbar_view > button[title="Forward"]'));
	}

	/**
	 * Locate the button to save the perspective.
	 *
	 * @example
	 * let g = new Grid(driver);
	 * await g.ui.prefsSaveBtn.click();
	 */

	get prefsSaveBtn() {
		return this.driver.findElement(By.css('div.wcdv_toolbar_view > button[title="Save"]'));
	}

	get colConfigBtn() {
		return this.driver.findElement(By.css('div.wcdv_grid_toolbar > div.wcdv_toolbar_section > button[title="Columns"]'));
	}

	get colConfigWin() {
		return this.driver.findElement(By.xpath('//div[@role="dialog"]//span[text()="Columns"]//ancestor::div[@role="dialog"]'));
	}

	get colConfigSave() {
		return this.colConfigWin.findElement(By.css('button[title="OK"]'));
	}

	/**
	 * Locate configuration (gear) button.
	 *
	 * @example
	 * let g = new Grid(driver);
	 * await g.ui.gearBtn.click();
	 */

	get gearBtn() {
		return this.driver.findElement(By.css('div.wcdv_titlebar_controls > button[title="Show/Hide Options"]'));
	}

	/**
	 * Locate the refresh button to reload data.
	 *
	 * @example
	 * let g = new Grid(driver);
	 * await g.ui.refreshBtn.click();
	 */

	get refreshBtn() {
		return this.driver.findElement(By.css('div.wcdv_titlebar_controls > button[title="Refresh"]'));
	}

	/**
	 * Locate the table that contains the data.
	 *
	 * @example
	 * let g = new Grid(driver);
	 * let trs = await this.ui.table.findElements(By.css('tbody > tr'));
	 */

	get table() {
		return this.driver.findElement(By.css('div.wcdv_grid div.wcdv_grid_table > table'));
	}

	/**
	 * Locate the plain table headers.
	 */

	get plainDataHeaders() {
		return this.table.findElements(By.css(`thead > tr > th > div.wcdv_heading_container > span.wcdv_heading_title`));
	}

	/**
	 * Locate the plain table data rows.
	 */

	get plainDataRows() {
		return this.table.findElements(By.css(`tbody > tr`));
	}

	/**
	 * Locate the auto-limit header.
	 */

	get autoLimitWarning() {
		return this.driver.findElement(By.css('.auto_limit_warning'));
	}

	get aggregateControl() {
		return this.driver.findElement(By.css('div.wcdv_aggregate_control'));
	}

	/**
	 * Locate the active row slider.
	 */

	get slider() {
		return this.grid.findElement(By.css('div.wcdv-slider'));
	}
}

// Grid {{{1

/**
 * @class
 * Provides a convenient way of interacting with a grid.
 */

class Grid {

	// Constructor {{{2

	/**
	 * Construct a proxy to a grid on a page.
	 *
	 * @param {selenium-webdriver.ThenableWebDriver} driver
	 * @param {string} [id="grid"]
	 */

	constructor(driver, id = 'grid') {
		this.driver = driver;
		this.id = id;
		this.ui = new GridUi(this.driver, this.id);
	}

	// #dumpLogs {{{2

	/**
	 * Print out console messages from the browser.  Prints all the messages that were produced since
	 * the last time this method was called.
	 */

	async dumpLogs() {
		(await this.driver.manage().logs().get(LoggingType.BROWSER)).forEach((l) => {
			console.log(l.message.replace(/\\u003C/g, '<'));
		});
	}

	// #waitForIdle {{{2

	/**
	 * Wait for the grid to become idle.
	 *
	 * @param {object} [opts]
	 *
	 * @param {boolean} [opts.showLogs=false]
	 * If true, show console messages from the browser, including messages produced by this method as
	 * we check to see if the grid is idle.
	 *
	 * @param {boolean} [opts.debug=false]
	 * If true, print a message on stdout indicating that we are waiting.
	 *
	 * @param {number} [opts.timeout=2000]
	 * Number of milliseconds between idle checks.
	 */

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
			const x = await this.driver.executeScript(`console.log('### IDLE [${attempt}]'); try { return MIE.WC_DataVis.grids['${this.id}'].isIdle() } catch (e) { return false }`);
			attempt += 1;
			if (opts.showLogs) {
				await this.dumpLogs();
			}
			return x;
		}, opts.timeout);
	}

	// #refresh {{{2

	/**
	 * Refresh the grid.
	 */

	async refresh() {
		return this.ui.refreshBtn.click();
	}

	// #toggleControls {{{2

	/**
	 * Toggle the control panel.
	 */

	async toggleControls() {
		return this.ui.gearBtn.click();
	}

	// #setSourceUrl {{{2

	/**
	 * Set the source URL.  Useful for simulating when data changes on the server.  You'll still need
	 * to call `refresh()` to obtain it.
	 *
	 * @param {string} url
	 * The absolute URL (including protocol) to retrieve data from.
	 */

	async setSourceUrl(url) {
		return this.driver.executeScript(`MIE.WC_DataVis.grids['${this.id}'].view.source.origin.url = '${url}'`);
	}

	// Sorting {{{2

	// Sorting works by (1) using a specific method to click the appropriate UI element to show the
	// sort menu, then (2) using this generic method to select an item from whatever sort menu is
	// currently shown.

	/**
	 * Select an item from the active sort menu.
	 *
	 * @param {string} item Whatever item in the menu to click.
	 */

	async clickActiveSortMenu(item) {
		const sortMenus = await asyncFilter(await this.driver.findElements(By.className('context-menu-root')), (elt) => elt.isDisplayed());
		const sortItems = await sortMenus[0].findElements(By.className('context-menu-item'));
		const validSortItems = await asyncFilter(sortItems, async (elt) => await elt.getText() !== '');
		// data:[Promise<WebElement>], predicate:(WebElement)->Promise<bool>
		const correctItem = await asyncFilter(validSortItems, async (elt) => await elt.getText() === item);

		if (correctItem.length !== 1) {
			throw new Error(`Invalid item "${item}", found: ${JSON.stringify(await asyncMap(validSortItems, (elt) => elt.getText()))}`);
		}

		return correctItem[0].click();
	}

	/**
	 * Sort by a field.
	 *
	 * @param {string} field
	 * Name of the column to sort by.
	 *
	 * @param {string} ordering
	 * The item in the sort menu to click.  For example, when sorting by "Grade" you can say `Grade,
	 * Ascending` because that's the menu item you'd click.
	 */

	async sortByField(field, dir) {
		await this.driver.findElement(By.xpath(`//span[@data-wcdv-field="${field}"]/../div`)).click();
		return this.clickActiveSortMenu(`${field}, ${dir === 'asc' ? 'Ascending' : 'Descending'}`);
	}

	/**
	 * Sort by aggregate result.
	 *
	 * @param {string} agg Name of the aggregate to sort by.
	 */

	async sortByAgg(agg, dir) {
		await this.driver.findElement(By.xpath(`//span[contains(@class, 'wcdv_heading_title') and text() = "${agg}"]/../div`)).click();
		return this.clickActiveSortMenu(`${agg}, ${dir === 'asc' ? 'Ascending' : 'Descending'}`);
	}

	// Group {{{2

	// #setGroupMode {{{3

	/**
	 * Set the group mode between summary and detail.
	 *
	 * @param {string} kind
	 * The group mode.  Must be either "summary" or "detail."
	 */

	async setGroupMode(kind) {
		return this.driver.findElement(By.css(`input[type=radio][name=groupOutput][value="${kind}"]`)).click();
	}

	// #getGroup {{{3

	/**
	 * Get the current group configuration.
	 *
	 * @returns {string[]} List of columns that we've grouped by.
	 */

	async getGroup() {
		const li = await this.driver.findElements(By.css('div.wcdv_group_control > div > ul > li[data-wcdv-field] > div.wcdv_field > span:first-of-type'));
		return Promise.all(_.map(li, (elt) => elt.getText()));
	}

	// #setGroup {{{3

	async setGroup() {
	}

	// #addGroup {{{3

	/**
	 * Add a grouping.
	 *
	 * @param {string} field
	 * The field (not column!) to add grouping by.
	 *
	 * @param {string} [groupFun]
	 * Name of the group function to apply.  Using this means waiting for the group function jQuery UI
	 * window to pop up, then selecting it.  You have to know whether or not the window will pop up
	 * when adding the group: if it does, you must provide a value for this, otherwise you must not.
	 * In short, if you're grouping by a date/time, provide a value for this parameter.
	 */

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
			return visibleWins[0].findElement(By.css(`button.wcdv_option[data-wcdv-groupfunname="${groupFun}"]`)).click();
		}
	}

	// #removeGroup {{{3

	/**
	 * Remove a grouping.
	 *
	 * @param {string} column
	 * Name of the column to remove.
	 */

	async removeGroup(column) {
		const groupFields = asyncFilter(this.driver.findElements(By.css('div.wcdv_group_control > div > ul > li[data-wcdv-field]')), async (li) => await li.getText() === column);

		if (groupFields.length !== 1) {
			throw new Error('grr');
		}

		return groupFields[0].findElements(By.css('button.wcdv_remove')).click();
	}

	// #clearGroup {{{3

	/**
	 * Clear all grouping.
	 */

	async clearGroup() {
		return this.driver.findElement(By.css('div.wcdv_group_control .wcdv_control_clear_button')).click();
	}

	// #setGroupFun {{{3

	/**
	 * Set the group function on a field that's part of a group.
	 *
	 * @param {string} field
	 * Name of the field to set the group function on.
	 *
	 * @param {string} groupFunName
	 * The group function to set.
	 */

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
		return visibleWins[0].findElement(By.css(`button.wcdv_option[data-wcdv-groupfunname="${groupFunName}"]`)).click();
	}

	// #getGroupCell {{{3

	async getGroupCell(groupNum, colNum) {
		const trs = await this.driver.findElements(By.css('div.wcdv_grid div.wcdv_grid_table > table > tbody > tr'));
		const tds = await trs[groupNum].findElements(By.css('td'));
		return tds[colNum].getText();
	}

	// #forEachGroup {{{3

	/**
	 * Navigates the group tree.
	 *
	 * @param {function} [eachFn]
	 * A function to call for each TR representing a rowValElt in the group.
	 *
	 * @param {function} [endFn]
	 * A function to call for the final TR representing a rowValElt in the group.  Note that if you
	 * provide both this and `eachFn` then both are called on the last rowValElt.
	 *
	 * @param {string[]} path
	 * A rowVal representing the group to expand.  Example: `['Grape', 'South Korea']` when grouping
	 * by "Fruit" and "Country."
	 */

	async forEachGroup(eachFn, endFn, path) {
		let groupId = 0;
		let traversedPath = [];
		let groupRows = [];
		for (let i = 0; i < path.length; i += 1) {
			traversedPath.push(`${path[i]} (${groupId})`);
			groupRows = await asyncFilter(
				await this.driver.findElements(By.css(`tr[data-wcdv-in-group="${groupId}"]`)),
				async (elt) => {
					return await elt.findElement(By.css('th.wcdv_group_value > span')).getText() === path[i];
				});

			if (groupRows.length === 0) {
				throw new Error(`Unable to locate group row in path: ${traversedPath.join(' → ')}`);
			}
			if (groupRows.length > 1) {
				throw new Error(`Found too many group rows in path: ${traversedPath.join(' → ')}`);
			}

			if (typeof eachFn === 'function') {
				await eachFn(groupRows[0]);
			}

			groupId = await groupRows[0].getAttribute('data-wcdv-toggles-group');
		}

		return typeof endFn === 'function' ? endFn(groupRows[0]) : async () => undefined;
	}

	// #expandGroup {{{3

	/**
	 * Expand the grouping given by the specified path.
	 *
	 * @param {string[]} path
	 * The path to expand.  Example: when grouping by "Country" then "Fruit", use:
	 *
	 * ```
	 * grid.expandGroup("England", "Strawberry")
	 * ```
	 */

	async expandGroup(...path) {
		return this.forEachGroup(async (elt) => {
			await elt.findElement(By.css('button.wcdv_expand_button[data-wcdv-expanded="0"]')).click();
			return this.waitForIdle();
		}, null, path);
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

	async findColValIdx(colVal) {
		let cviMin = 0, cviMax = 9999;
		for (let i = 0; i < colVal.length; i += 1) {
			let tr = await this.driver.findElement(By.css(`tr[data-wcdv-pfi="${i}"]`));
			let th = await asyncFilter(await tr.findElements(By.css(`th[data-wcdv-cvi]`)), async (elt) => {
				let span = await elt.findElement(By.css('div.wcdv_heading_container > span.wcdv_heading_title'));
				return await span.getText() === colVal[i]
					&& await elt.getAttribute('data-wcdv-cvi') >= cviMin
					&& await elt.getAttribute('data-wcdv-cvi') <= cviMax;
			});
			if (th.length === 0) {
				throw new Error(`Unable to locate a header named "${colVal[i]}" with a CVI in [${cviMin}, ${cviMax}]`);
			}
			if (th.length > 1) {
				throw new Error(`Found too many headers named "${colVal[i]}" with a CVI in [${cviMin}, ${cviMax}]`);
			}
			cviMin = +(await th[0].getAttribute('data-wcdv-cvi'));
			cviMax = +(await th[0].getAttribute('colspan')) + cviMin - 1;
		}
		return cviMin;
	}

	// Aggregates {{{2

	async addAggregate(funName, field) {
		const control = await this.driver.findElement(By.css('div.wcdv_aggregate_control'));
		const newAggDropdown = await control.findElement(By.css('select.wcdv_control_addField'));
		await selectByValue(newAggDropdown, funName);

		if (field != null) {
			const fieldDropdown = await control.findElement(By.css('ul.wcdv_control_vertical > li:last-of-type select'));
			await selectByValue(fieldDropdown, field);
		}
	}

	async setAggregate(funName, field) {
		const control = await this.driver.findElement(By.css('div.wcdv_aggregate_control'));
		const fieldDropdown = await control.findElement(By.css('div.wcdv_field li.wcdv_aggregate_field > select'));
		await selectByValue(fieldDropdown, field);
	}

	async clearAggregates() {
		return this.driver.findElement(By.css('div.wcdv_aggregate_control .wcdv_control_clear_button')).click();
	}

	/**
	 * Find the table cell for an aggregate result.
	 *
	 * @param {string} type
	 * What type of aggregate to drill down into.  Must be one of: group, pivot, cell, all.
	 *
	 * @param {string[]} rowVal
	 * If `type` is "group" or "cell," the rowVal to look for.
	 *
	 * @param {string[]} colVal
	 * If `type` is "pivot" or "cell," the colVal to look for.
	 *
	 * @param {number} aggNum
	 * Which aggregate to look for, starting at zero.
	 *
	 * @returns Promise
	 * The table cell that contains the aggregate result.
	 */

	async findAggregateResult(type, rowVal, colVal, aggNum) {
		switch (type) {
		case 'group':
			break;
		case 'pivot': {
			let cvi = await this.findColValIdx(colVal);
			return this.driver.findElement(By.css(`td[data-wcdv-agg-scope=pivot][data-wcdv-cvi="${cvi}"][data-wcdv-agg-num="${aggNum}"]`));
		}
		case 'cell':
			break;
		case 'all':
			break;
		default:
			throw new Error('Call Error: `type` must be one of: [group, pivot, cell, all]');
		}
	}

	async getAggregateResult(type, rowVal, colVal, aggNum) {
		let td = await this.findAggregateResult(type, rowVal, colVal, aggNum);
		return td.getText();
	}

	/**
	 * Drill down into an aggregate result by double-clicking its table cell.  Drilling down actually
	 * happens for a specific aggregate function, but at the moment they all have the same population,
	 * so this function just picks the first one to double-click on.
	 *
	 * @param {string} type
	 * What type of aggregate to drill down into.  Must be one of: group, pivot, cell.  I mean,
	 * technically there is an "all" aggregate type, but you can't drill down into it because nothing
	 * would change, you're already looking at all the data.
	 *
	 * @param {string[]} rowVal
	 * If `type` is "group" or "cell," the rowVal to look for.
	 *
	 * @param {string[]} colVal
	 * If `type` is "pivot" or "cell," the colVal to look for.
	 */

	async drillDown(type, rowVal, colVal) {
		let td = await this.findAggregateResult(type, rowVal, colVal, 0);
		return this.driver.actions().doubleClick(td).perform();
	}

	// Filter {{{2

	async addFilter(field) {
		const control = await this.driver.findElement(By.css('div.wcdv_filter_control'));
		const dropdown = await control.findElement(By.css('select.wcdv_control_addField'));
		return selectByText(dropdown, field);
	}

	async clearFilter() {
		const control = await this.driver.findElement(By.css('div.wcdv_filter_control'));
		return control.findElement(By.css('.wcdv_control_clear_button')).click();
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
			await input.sendKeys(value);
			await blur(this.driver);
			break;
		}
		case 'date': {
			const input = await controlField[0].findElement(By.css('div.wcdv_filter_control_filter > select:nth-of-type(2)'));
			await selectByValue(input, value);
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
		await this.ui.prefsDeleteBtn.click();
		let a = await this.driver.wait(until.alertIsPresent());
		return a.accept();
	}

	async resetPrefs() {
		await this.ui.prefsResetBtn.click();
		let a = await this.driver.wait(until.alertIsPresent());
		return a.accept();
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

	// #selectAll {{{3

	async selectAll() {
		const input = this.driver.findElement(By.css('div.wcdv_grid div.wcdv_grid_table > table > thead > tr > th > input[name=checkAll][type=checkbox]'));

		if (await input.getAttribute('checked')) {
			throw Error('All items already checked');
		}

		// For the partially checked state, you need to click it twice. The first unchecks it.
		if (await input.getAttribute('indeterminate')) {
			await input.click();
		}

		return input.click();
	}

	// #unselectAll {{{3

	/**
	 * Unselect all checkboxes.
	 */

	async unselectAll() {
		const input = this.driver.findElement(By.css('div.wcdv_grid div.wcdv_grid_table > table > thead > tr > th > input[name=checkAll][type=checkbox]'));

		if (await input.getAttribute('checked') === false && await input.getAttribute('indeterminate') === false) {
			throw Error('All items already unchecked');
		}

		// For the partially checked state, clicking it once unchecks it.
		return input.click();
	}

	// #selectRow {{{3

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

	// #selectGroup {{{3

	async selectGroup(...path) {
		return this.forEachGroup(null, async (elt) => {
			return elt.findElement(By.css('input.wcdv_select_group[type="checkbox"]')).click();
		}, path);
	}

	// #getSelection {{{3

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

	// Operations {{{2

	// #getOperations {{{3

	/**
	 * Get the operations.
	 *
	 * @param {string} type What type of operations to glean from the grid.
	 *
	 * - `all` = Get the names of all operations from the palette in the control panel.
	 * - `row` = Get the names operations shown in the operations column on the left side of the table.
	 * - `cell` = Get the names operations within the specified cell.
	 *
	 * @param {object} [opts] Additional options.
	 * @param {string} [opts.rowNum] When `type = 'cell'`: what row to check.
	 * @param {string} [opts.colName] When `type = 'cell'`: what column to check.
	 */

	async getOperations(type, opts) {
		switch (type) {
		case 'all': {
			const panes = await this.driver.findElements(By.css('div.wcdv_control_pane'));
			const operationsPanes = await asyncFilter(panes, async (elt) => {
				const titles = await elt.findElements(By.css('span.wcdv_control_title'));
				return titles.length === 1 && await titles[0].getText() === 'OPERATIONS';
			});
			if (operationsPanes.length !== 1) {
				throw new Error('Unable to locate operations pane');
			}
			const categories = await operationsPanes[0].findElements(By.css('div.wcdv_operations_category'));
			let result = {};
			await asyncEach(categories, async (elt) => {
				const categoryName = await elt.findElement(By.css('span')).getText() || '';
				const operationButtons = await elt.findElements(By.css('button.wcdv_operation'));
				result[categoryName] = await asyncMap(operationButtons, async (btn) =>
					(await hasClass(btn, 'no_label'))
						? (await getClass(btn.findElement(By.css('span')), /fa-/))[0]
						: await btn.getText());
			});
			return result;
		}
		case 'row': {
			const tr = await this.ui.table.findElement(By.css(`tbody > tr[data-row-num="${opts.row}"]`));
			if (tr == null) {
				throw new Error(`No such row: ${opts.row}`);
			}
			const operationButtons = await tr.findElements(By.css('td.wcdv_row_operations > button'));
			return await asyncMap(operationButtons, async (btn) =>
				await btn.getAttribute('title') ||(await getClass(btn.findElement(By.css('span')), /fa-/))[0]);
		}
		case 'cell': {
			const td = await this.getCell(opts.col, opts.row, {result: 'element'});
			const operationButtons = await td.findElements(By.css('button.wcdv_operation'));
			return await asyncMap(operationButtons, async (btn) =>
				await btn.getAttribute('title') ||(await getClass(btn.findElement(By.css('span')), /fa-/))[0]);
		}
		}
	}

	// Data Checking - Plain {{{2

	// #getNumRows {{{3

	/**
	 * Tells how many rows there are in the table.  Includes any total rows at the bottom, if the data
	 * has been grouped or pivotted.  Also includes any "show more" rows, in limited plain output.
	 *
	 * @returns {number}
	 * Number of rows in the table.
	 */

	async getNumRows() {
		const trs = await this.driver.findElements(By.css('div.wcdv_grid div.wcdv_grid_table > table > tbody > tr'));
		//const visible = await asyncFilter(trs, async (elt) => await elt.isDisplayed());
		return trs.length;
	}

	// #getColumns {{{3

	async getColumns() {
		const table = await this.driver.findElement(By.css('div.wcdv_grid div.wcdv_grid_table > table'));
		const headers = await table.findElements(By.css('thead > tr > th > div.wcdv_heading_container > span.wcdv_heading_title'));
		return Promise.all(_.map(headers, (elt) => elt.getText()));
	}

	// #getCell {{{3

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

	// #getPlainData_asArrays {{{3

	async getPlainData_asArrays() {
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

	// #getPlainData_asObjects {{{3

	async getPlainData_asObjects(fields, opts) {
		opts = _.defaults({}, opts, {
			result: 'text'
		});

		const ths = await this.ui.plainDataHeaders;
		const trs = await this.ui.plainDataRows;

		const headers = await Promise.map(ths, async (th) => th.getText());

		fields = fields != null
			? _.map(fields, (f) => headers.indexOf(f))
			: _.range(headers.length);

		return Promise.map(trs, async (tr) => {
			let row = {};
			const tds = await tr.findElements(By.css(`td:not(.wcdv_group_col_spacer)`));
			await Promise.each(fields, async (i) => {
				switch (opts.result) {
				case 'text': {
					const t = await tds[i].getText();
					row[headers[i]] = (t === ' ' ? '' : t);
					break;
				}
				case 'element':
					row[headers[i]] = tds[i];
					break;
				}
			});
			return row;
		});
	}

	// #getPlainFooter {{{3

	async getPlainFooter(column) {
		if (typeof column !== 'string') {
			throw new Error('Call Error: `column` must be a string');
		}

		const ths = await this.ui.table.findElements(By.css('thead > tr > th'));
		const th = await asyncFilter(ths, async (elt) => await elt.getText() === column, {reportPosition: true});
		if (th.length === 0) {
			throw new Error(`No such column: ${column}`);
		}
		const tds = await this.ui.table.findElements(By.css('tfoot > tr > td'));
		if (tds.length === 0) {
			throw new Error('Unable to locate footer TD elements');
		}
		if (th[0].pos >= tds.length) {
			throw new Error(`Found "${column}" header at position ${th[0].pos} but there are only ${tds.length} footer cells`);
		}
		return await tds[th[0].pos].getText();
	}

	// Data Checking - Group {{{2

	// #getRowVal {{{3

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

	// #getGroupDetailsHeader {{{3

	/**
	 * Get the header for a grouping in details mode.
	 *
	 * @param {string[]} path
	 * A series of row val elts to expand. The header of the last one is returned. For example:
	 * `["United States", "Fruit"]` returns the TH element for the header "Fruit" under "United
	 * States."
	 *
	 * @returns {WebElement}
	 * The TH of the header for the last thing expanded.
	 *
	 * @example
	 * const th = grid.getGroupDetailsHeader(["United States", "Fruit"]);
	 * assert.equal(await th.getText(), "Fruit(3 rows)");
	 */

	async getGroupDetailsHeader(path) {
		let groupId = 0
			, tr = this.ui.table;

		for (let i = 0; i < path.length; i += 1) {
			tr = await tr.findElements(By.xpath(`//tr[@data-wcdv-in-group="${groupId}"][contains(., "${path[i]}")]`));

			if (tr.length === 0) {
				throw new Error(`Unable to locate header: ${path.slice(0, i - 1).join(' / ')}`);
			}

			tr = tr[0];

			if (i < path.length - 1) {
				groupId = await tr.getAttribute('data-wcdv-toggles-group');

				// Expand the header if it's not already.

				if (await tr.getAttribute('data-wcdv-expanded') === '0') {
					await tr.findElement(By.css('th.wcdv_group_col_spacer >button.wcdv_expand_button')).click();
					await this.waitForIdle();
				}
			}
		}

		return await tr.findElement(By.css('th.wcdv_group_value'));
	}

	// #getRowValElt {{{3

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
	 * Converts an aggregate name into the aggNum.
	 *
	 * @param {string} name Name of the aggregate function as displayed in the UI.
	 */

	async aggNameToNum(name) {
		const aggregates = await this.ui.aggregateControl.findElements(By.css('ul > li'));
		const matching = await asyncFirst(aggregates, async (elt) => {
			return await elt.findElement(By.css('span.wcdv_field_name')).getText() === name;
		});
		if (matching == null) {
			throw new Error(`No such aggregate found: ${name}`);
		}
		return matching.idx;
	}

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
		else {
			const trs = await table.findElements(By.css('tbody > tr'));
			let rowValPos;

			for (let trIdx = 0; trIdx < trs.length; trIdx += 1) {
				let ths = await trs[trIdx].findElements(By.css('th'));
				let checks = await Promise.mapSeries(ths, async (th, thIdx) => await th.getText() === rowVal[thIdx]);
				if (_.every(checks)) {
					rowValPos = trIdx;
					break;
				}
			}

			if (rowValPos == null) {
				throw new Error(`No such rowval: ${JSON.stringify(rowVal)}`);
			}

			const tds = await trs[rowValPos].findElements(By.css(`tbody > tr > td[data-wcdv-rvi]`));
			if (tds.length === 0) {
				throw new Error(`No cell for rowval: ${JSON.stringify(rowVal)}`);
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
	 * @param {number} [agg] Index of the aggregate we're looking for.
	 */

	async getAggResult_byNum(rowValIdx, colValIdx, agg) {
		const aggNum = agg == null ? 0
			: _.isNumber(agg) ? agg
			: await this.aggNameToNum(agg);

		if (colValIdx != null) {
			// TODO
			throw new Error('not implemented');
		}
		else {
			const trs = await this.ui.table.findElements(By.css('tbody > tr[data-wcdv-rvi]'));
			if (rowValIdx < 0) {
				rowValIdx = trs.length - (rowValIdx * -1);
			}
			if (trs.length === 0) {
				throw new Error('Unable to find any rowvals');
			}
			if (trs.length < rowValIdx) {
				throw new Error(`No such rowval index: ${rowValIdx}`);
			}
			const tds = await trs[rowValIdx].findElements(By.css('td'));
			if (tds.length === 0) {
				throw new Error('Unable to find any aggregate columns');
			}
			if (tds.length < aggNum) {
				throw new Error(`No such aggnum: ${aggNum}`);
			}
			return tds[aggNum].getText();
		}
	}

	// }}}2

	async editColConfig(field, prop, val) {
		const table = await this.ui.colConfigWin.findElement(By.xpath('//table[@class="wcdv_colconfigwin_table"]'));
		const tr = table.findElement(By.css(`tr[data-field="${field}"]`));
		const td = tr.findElement(By.css(`td[data-prop="${prop}"]`));
		const checkbox = td.findElement(By.css('input[type="checkbox"]'));
		if (checkbox != null) {
			// the checked property is either 'true' or null; transform val to match
			val = val ? 'true' : null;
			if (await checkbox.getAttribute('checked') !== val) {
				// clicking the button changes the checkbox
				await td.findElement(By.css('button')).click();
				if (await checkbox.getAttribute('checked') !== val) {
					throw new Error(`Unable to set ${prop} to ${val} for ${field}`);
				}
			}
		}
	}
}

// }}}1

module.exports = Grid;
