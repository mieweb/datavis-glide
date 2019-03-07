const _ = require('lodash');
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

	async toggleControls() {
		return this.driver.findElement(By.css('div.wcdv_titlebar_controls > button[title="Show/Hide Options"]')).click();
	}

	async getCell(column, row) {
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
		return await td.getText();
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

	async addGroup(field) {
		const dropdown = this.driver.findElement(By.css('div.wcdv_group_control select'));
		return selectByText(dropdown, field);
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

	// Pivot {{{2

	async getPivot() {
		const li = await this.driver.findElements(By.css('div.wcdv_pivot_control > div > ul > li[data-wcdv-field] > div.wcdv_field > span:first-of-type'));
		return Promise.all(_.map(li, (elt) => elt.getText()));
	}

	async setPivot() {
	}

	async addPivot(field) {
		const control = this.driver.findElement(By.css('div.wcdv_pivot_control'));
		const dropdown = control.findElement(By.css('div > div > select'));
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
		const dropdown = await control.findElement(By.css('div > div > select'));
		return selectByText(dropdown, field);
	}

	async setFilter(field, type, op, value) {
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
		case 'sumoselect':
			const sumoselect = await controlField[0].findElement(By.css('div.wcdv_filter_control_filter > div.SumoSelect'));
			// Open the SumoSelect dropdown.
			await sumoselect.findElement(By.css('p.SelectBox')).click();
			// Find the items in the dropdown that match what was requested...
			const labels = await sumoselect.findElements(By.css('div.optWrapper > ul.options > li > label'));
			const matchingLabels = await asyncFilter(labels, async (label) => value.indexOf(await label.getText()) >= 0);
			// ...and click on them!
			await Promise.all(_.map(matchingLabels, (elt) => elt.click()));
			// Click the "OK" button.
			await sumoselect.findElement(By.css('div.optWrapper > div.MultiControls > p.btnOk')).click();
			break;
		case 'input':
			const input = await controlField[0].findElement(By.css('div.wcdv_filter_control_filter > input'));
			await input.sendKeys(value, Key.ENTER);
			break;
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

	// }}}2
}

// }}}1

module.exports = Grid;
