const {assert} = require('chai');
const _ = require('lodash');
const Grid = require('../lib/grid.js');
const {setupServer, asyncEach, selectByValue, radioByValue, checkboxByValue, sleep, clearTextInput, createDriver} = require('../lib/util.js');

const {Builder, By, Key} = require('selenium-webdriver');

describe('Source Parameters', function () {
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

	function befores(url) {
		before(async function () {
			await driver.get(url);
			grid = new Grid(driver);
			await grid.waitForIdle();
		});
	}

	function afters() {
		after(async function () {
			await driver.executeScript('window.localStorage.clear()');
		});
	}

	const commonTests = ({sendEmpty = false, emptyValue = '', toggleCheckbox = true} = {}) => {
		describe('changes when you update <input type="text">', function () {
			it('and make it empty', async function () {
				let input = await driver.findElement(By.css('input[name="text"]'));
				await input.clear();
				if (emptyValue !== '') {
					await input.sendKeys(emptyValue);
				}
				await grid.refresh();
				await grid.waitForIdle();
				let actual = _.map(await grid.getPlainData_asArrays(), '0');
				if (sendEmpty) {
					assert.include(actual, 'text');
				}
				else {
					assert.notInclude(actual, 'text');
				}
			});

			it('and put something in it', async function () {
				let input = await driver.findElement(By.css('input[name="text"]'));
				await input.clear();
				await input.sendKeys('gojira');
				await grid.refresh();
				await grid.waitForIdle();
				assert.deepInclude(await grid.getPlainData_asArrays(), ['text', 'gojira']);
			});
		});

		describe('changes when you update <textarea>', function () {
			it('and make it empty', async function () {
				let input = await driver.findElement(By.css('textarea[name="textarea"]'));
				await input.clear();
				if (emptyValue !== '') {
					await input.sendKeys(emptyValue);
				}
				await grid.refresh();
				await grid.waitForIdle();
				let actual = _.map(await grid.getPlainData_asArrays(), '0');
				if (sendEmpty) {
					assert.include(actual, 'textarea');
				}
				else {
					assert.notInclude(actual, 'textarea');
				}
			});

			it('and put something in it', async function () {
				let input = await driver.findElement(By.css('textarea[name="textarea"]'));
				await input.clear();
				await input.sendKeys('valley of the kings');
				await grid.refresh();
				await grid.waitForIdle();
				assert.deepInclude(await grid.getPlainData_asArrays(), ['textarea', 'valley of the kings']);
			});
		});

		describe('changes when you update <select>', function () {
			it('and make it empty', async function () {
				let input = await driver.findElement(By.css('select[name="select"]'));
				await selectByValue(input, emptyValue);
				await grid.refresh();
				await grid.waitForIdle();
				let actual = _.map(await grid.getPlainData_asArrays(), '0');
				if (sendEmpty) {
					assert.include(actual, 'select');
				}
				else {
					assert.notInclude(actual, 'select');
				}
			});

			it('and just change the value', async function () {
				let input = await driver.findElement(By.css('select[name="select"]'));
				await selectByValue(input, 'hot-honey');
				await grid.refresh();
				await grid.waitForIdle();
				assert.deepInclude(await grid.getPlainData_asArrays(), ['select', 'hot-honey']);
			});
		});

		if (sendEmpty || emptyValue !== '') {
			return;
		}

		describe('changes when you update <input type="checkbox">', function () {
			it('and leave all unchecked', async function () {
				let inputs = await driver.findElements(By.css('input[name="checkbox"]'));
				await checkboxByValue(inputs);
				await grid.refresh();
				await grid.waitForIdle();
				// The parameter should not be sent, so it should not show up in response.
				let actual = _.map(await grid.getPlainData_asArrays(), '0');
				assert.notInclude(actual, 'checkbox');
			});

			it('and check one', async function () {
				let inputs = await driver.findElements(By.css('input[name="checkbox"]'));
				await checkboxByValue(inputs, ['ham']);
				await grid.refresh();
				await grid.waitForIdle();
				// The parameter should be sent, so it should be in the response.
				let data = await grid.getPlainData_asArrays();
				assert.include(_.map(data, '0'), 'checkbox');
				// The parameter should have a single value.
				let checkboxData = _.find(data, {'0': 'checkbox'})[1].split(',');
				assert.deepEqual(checkboxData, ['ham']);
			});

			it('and check multiple', async function () {
				let inputs = await driver.findElements(By.css('input[name="checkbox"]'));
				await checkboxByValue(inputs, ['ham', 'pineapple']);
				await grid.refresh();
				await grid.waitForIdle();
				// The parameter should be sent, so it should be in the response.
				let data = await grid.getPlainData_asArrays();
				assert.include(_.map(data, '0'), 'checkbox');
				// The parameter should have multiple values.
				let checkboxData = _.find(data, {'0': 'checkbox'})[1].split(',');
				assert.include(checkboxData, 'ham');
				assert.include(checkboxData, 'pineapple');
			});
		});

		describe('changes when you update <input type="radio">', function () {
			it('and just change the value', async function () {
				let input = await driver.findElements(By.css('input[name="radio"]'));
				await radioByValue(input, 'pan');
				await grid.refresh();
				await grid.waitForIdle();
				assert.deepInclude(await grid.getPlainData_asArrays(), ['radio', 'pan']);
			});
		});

		if (toggleCheckbox) {
			describe('changes when you update <input type="checkbox"> as a toggle', function () {
				it ('and check it', async function () {
					let input = await driver.findElement(By.css('input[name="toggle-checkbox"]:not(:checked)'));
					await input.click();
					await grid.refresh();
					await grid.waitForIdle();
					assert.deepInclude(await grid.getPlainData_asArrays(), ['toggle-checkbox', 'on']);
				});
				it ('and uncheck it', async function () {
					let input = await driver.findElement(By.css('input[name="toggle-checkbox"]:checked'));
					await input.click();
					await grid.refresh();
					await grid.waitForIdle();
					assert.deepInclude(await grid.getPlainData_asArrays(), ['toggle-checkbox', 'off']);
				});
			});
		}
	};

	describe('using the whole form (with CGI)', function () {
		befores('http://localhost:3000/tests/pages/grid/sourceParams/form-cgi.html');
		afters();
		it('shows initial values of all form elements', async function () {
			let actual = await grid.getPlainData_asArrays();
			let expected = [
				['checkbox', 'pepperoni,mushrooms'],
				['hidden', 'hidden'],
				['select', 'garlic-parm'],
				['text', 'test'],
				['textarea', 'hello frendo'],
			];
			assert.deepEqual(actual, expected);
		});

		// Forms don't use the toggle checkbox, this submission method is meant to work like a regular
		// HTML form where no value will be sent.

		commonTests({toggleCheckbox: false});
	});

	describe('using the whole form (with CGI, send empty)', function () {
		befores('http://localhost:3000/tests/pages/grid/sourceParams/form-cgi.html?send-empty');
		afters();
		commonTests({sendEmpty: true, toggleCheckbox: false});
	});

	describe('using the whole form (with CGI, empty value)', function () {
		befores('http://localhost:3000/tests/pages/grid/sourceParams/form-cgi.html?empty-value=[empty-value]');
		afters();
		commonTests({emptyValue: '[empty-value]', toggleCheckbox: false});
	});

	describe('using the whole form (with JSON WHERE)', function () {
		befores('http://localhost:3000/tests/pages/grid/sourceParams/form-json-where.html');
		afters();
		it('shows initial values of all form elements', async function () {
			let actual = await grid.getPlainData_asArrays();
			let expected = [
				['checkbox', 'pepperoni,mushrooms'],
				['hidden', 'hidden'],
				['select', 'garlic-parm'],
				['text', 'test'],
				['textarea', 'hello frendo'],
			];
			assert.deepEqual(actual, expected);
		});

		// Forms don't use the toggle checkbox, this submission method is meant to work like a regular
		// HTML form where no value will be sent.

		commonTests({toggleCheckbox: false});
	});

	describe('using the whole form (with JSON WHERE, send empty)', function () {
		befores('http://localhost:3000/tests/pages/grid/sourceParams/form-json-where.html?send-empty');
		afters();
		commonTests({sendEmpty: true, toggleCheckbox: false});
	});

	describe('using the whole form (with JSON WHERE, empty value)', function () {
		befores('http://localhost:3000/tests/pages/grid/sourceParams/form-json-where.html?empty-value=[empty-value]');
		afters();
		commonTests({emptyValue: '[empty-value]', toggleCheckbox: false});
	});

	describe('using individual inputs (with CGI)', function () {
		befores('http://localhost:3000/tests/pages/grid/sourceParams/inputs-cgi.html');
		afters();
		it('shows initial values of specified inputs', async function () {
			let actual = await grid.getPlainData_asArrays();
			let expected = [
				['checkbox', 'pepperoni,mushrooms'],
				['hidden', 'hidden'],
				['select', 'garlic-parm'],
				['text', 'test'],
				['textarea', 'hello frendo'],
				['toggle-checkbox', 'off'],
			];
			assert.deepEqual(actual, expected);
		});
		commonTests();
	});

	describe('using individual inputs (with CGI, send empty)', function () {
		befores('http://localhost:3000/tests/pages/grid/sourceParams/inputs-cgi.html?send-empty');
		afters();
		commonTests({sendEmpty: true});
	});

	describe('using individual inputs (with CGI, empty value)', function () {
		befores('http://localhost:3000/tests/pages/grid/sourceParams/inputs-cgi.html?empty-value=[empty-value]');
		afters();
		commonTests({emptyValue: '[empty-value]'});
	});

	describe('using individual inputs (with JSON WHERE)', function () {
		befores('http://localhost:3000/tests/pages/grid/sourceParams/inputs-json-where.html');
		afters();
		it('shows initial values of specified inputs', async function () {
			let actual = await grid.getPlainData_asArrays();
			let expected = [
				['checkbox', 'pepperoni,mushrooms'],
				['hidden', 'hidden'],
				['select', 'garlic-parm'],
				['text', 'test'],
				['textarea', 'hello frendo'],
				['toggle-checkbox', 'off'],
			];
			assert.deepEqual(actual, expected);
		});
		commonTests();
	});

	describe('using individual inputs (with JSON WHERE, send empty)', function () {
		befores('http://localhost:3000/tests/pages/grid/sourceParams/inputs-json-where.html?send-empty');
		afters();
		commonTests({sendEmpty: true});
	});

	describe('using individual inputs (with JSON WHERE, empty value)', function () {
		befores('http://localhost:3000/tests/pages/grid/sourceParams/inputs-json-where.html?empty-value=[empty-value]');
		afters();
		commonTests({emptyValue: '[empty-value]'});
	});
});
