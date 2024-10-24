/** @module util */

const _ = require('lodash');
const {By, Key} = require('selenium-webdriver');
const child_process = require('child_process');
const Promise = require("bluebird");

/**
 * Gives a single promise that resolves all the promises created when mapping the given function
 * over the given data.
 *
 * @alias module:util.asyncMap
 *
 * @param {any[]} data
 * An array of data items.
 *
 * @param {function} f
 * An asynchronous function to apply to each element in `data`.
 *
 * @returns {Promise}
 * A single promise that resolves all the promises resulting from mapping `f` over `data`.
 */

async function asyncMap(data, f) {
	return Promise.all(_.map(data, f));
}

/**
 * Iterate through all the items, invoking the specified callback on each.
 *
 * @alias module:util.asyncEach
 *
 * @param {any[]} data
 * An array of items.  If any item is a promise then it's resolved first.
 *
 * @param {function} callback
 * A function to invoke on each data item.  If it produces a promise, then it's resolved before
 * moving onto the next item, and any exception causes processing to stop.
 */

async function asyncEach(data, callback) {
	if (!_.isArray(data)) {
		throw new Error('Call Error: `data` must be an array');
	}
	if (!(callback instanceof Function)) {
		throw new Error('Call Error: `callback` must be a function');
	}

	let i = 0;
	const recur = async (resolve, reject) => {
		if (i == data.length) {
			return resolve();
		}

		const d = data[i] instanceof Promise ? await data[i] : data[i];
		const p = callback(d);
		if (typeof p.then === 'function') {
			return p.then(() => {
				i += 1;
				return recur(resolve, reject);
			}).catch((error) => {
				reject(error);
			});
		}
		else {
			i += 1;
			return recur(resolve, reject);
		}
	};
	return new Promise((resolve, reject) => {
		recur(resolve, reject);
	});
}

/**
 * Filters out items from an array.
 *
 * @alias module:util.asyncFilter
 *
 * @param {any[]} data
 * List of items to filter.  If an item is a promise, it's resolved first.
 *
 * @param {function} predicate
 * A function that returns true when the item passes, and false otherwise.  Can return a promise, in
 * which case it's resolved immediately (errors count as "not passing").
 *
 * @param {object} opts
 * Additional options.
 *
 * @param {boolean} [opts.reportPosition=false]
 * If true, then the result is an array of objects like this: `{data: data[x], pos: x}` which allows
 * you to track which items were removed by the filter.
 *
 * @returns {any[]}
 * The input `data` but with non-passing items removed.
 *
 * @example
 * let allOptions = await dropdown.findElements(By.css("option"));
 * let matchingOption = await asyncFilter(allOptions, async (o) => await o.getAttribute('value') === value);
 */

async function asyncFilter(data, predicate, opts = {}) {
	if (opts.reportPosition == null) {
		opts.reportPosition = false;
	}

	if (!_.isArray(data)) {
		throw new Error('Call Error: `data` must be an array');
	}
	if (!(predicate instanceof Function)) {
		throw new Error('Call Error: `predicate` must be a function');
	}
	let i = 0;
	const result = [];
	const recur = async (done) => {
		if (i == data.length) {
			return done(result);
		}

		const d = data[i] instanceof Promise ? await data[i] : data[i];
		const p = predicate(d);
		if (typeof p.then === 'function') {
			return p.then((passes) => {
				if (passes) {
					result.push(opts.reportPosition ? {data: d, pos: i} : d);
				}
			}).catch((error) => {
				console.error(error);
			}).finally(() => {
				i += 1;
				return recur(done);
			});
		}
		else {
			if (p) {
				result.push(opts.reportPosition ? {data: d, pos: i} : d);
			}
			i += 1;
			return recur(done);
		}
	};
	return new Promise((resolve, reject) => {
		recur(resolve);
	});
}

/**
 * Selects an item from a dropdown that has matching text.
 *
 * @alias module:util.selectByText
 *
 * @param {selenium-webdriver.WebElement} dropdown
 * The dropdown to search.
 *
 * @param {string} text
 * The text to look for, which must match exactly.
 */

async function selectByText(dropdown, text) {
	let allOptions = await dropdown.findElements(By.css("option"));
	let matchingOption = await asyncFilter(allOptions, async (o) => await o.getText() === text);

	if (matchingOption.length !== 1) {
		throw new Error('No such option: text = "' + text + '"');
	}

	return matchingOption[0].click();
}

/**
 * Selects an item from a dropdown by value.
 *
 * @alias module:util.selectByValue
 *
 * @param {selenium-webdriver.WebElement} dropdown
 * The dropdown to search.
 *
 * @param {string} value
 * The value of the item to select.
 */

async function selectByValue(dropdown, value) {
	let allOptions = await dropdown.findElements(By.css("option"));
	let matchingOption = await asyncFilter(allOptions, async (o) => await o.getAttribute('value') === value);

	if (matchingOption.length !== 1) {
		throw new Error('No such option: value = "' + value + '"');
	}

	return matchingOption[0].click();
}

/**
 * Selects a radio button by value.
 *
 * @alias module:util.radioByValue
 *
 * @param {selenium-webdriver.WebElement} inputs
 * The list of radio buttons to search through (typically these should all have the same `name`
 * attribute).
 *
 * @param {string} value
 * The value of the item to select.
 */

async function radioByValue(inputs, value) {
	let matchingRadio = await asyncFilter(inputs, async (o) => await o.getAttribute('value') === value);

	if (matchingRadio.length !== 1) {
		throw new Error('No such option: value = "' + value + '"');
	}

	return matchingRadio[0].click();
}

/**
 * Selects checkboxes by value.
 *
 * @alias module:util.checkboxByValue
 *
 * @param {selenium-webdriver.WebElement} inputs
 * The list of checkboxes to search through (typically these should all have the same `name`
 * attribute).  These are all unchecked first, so only the matching ones end up checked.
 *
 * @param {string} values
 * The values of the checkboxes to select.
 */

async function checkboxByValue(inputs, values) {
	// Uncheck all inputs.

	await Promise.each(inputs, async (input) => {
		if (await input.getAttribute('checked')) {
			await input.click();
		}
	});

	if (values == null) {
		return;
	}

	// Check the right ones.

	return Promise.each(inputs, async (input) => {
		if (values.indexOf(await input.getAttribute('value')) >= 0) {
			await input.click();
		}
	});
}

async function blur(driver) {
	return driver.executeScript('!!document.activeElement ? document.activeElement.blur() : 0');
}

/**
 * Pauses execution.
 *
 * @alias module:util.sleep
 *
 * @param {int} time
 * Number of seconds to sleep for.
 */

function sleep(time) {
	child_process.spawnSync('sleep', [time]);
}

module.exports = {
	asyncMap,
	asyncEach,
	asyncFilter,
	selectByText,
	selectByValue,
	radioByValue,
	checkboxByValue,
	blur,
	sleep,
};
