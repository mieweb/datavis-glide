const _ = require('lodash');
const {By} = require('selenium-webdriver');
const child_process = require('child_process');

async function asyncMap(data, f) {
	return Promise.all(_.map(data, f));
}

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

async function selectByText(dropdown, text) {
	let allOptions = await dropdown.findElements(By.css("option"));
	let matchingOption = await asyncFilter(allOptions, async (o) => await o.getText() === text);

	if (matchingOption.length !== 1) {
		throw new Error('No such option: text = "' + text + '"');
	}

	return matchingOption[0].click();
}

async function selectByValue(dropdown, value) {
	let allOptions = await dropdown.findElements(By.css("option"));
	let matchingOption = await asyncFilter(allOptions, async (o) => await o.getAttribute('value') === value);

	if (matchingOption.length !== 1) {
		throw new Error('No such option: value = "' + value + '"');
	}

	return matchingOption[0].click();
}

function sleep(time) {
	child_process.spawnSync('sleep', [time]);
}

exports.asyncMap = asyncMap;
exports.asyncEach = asyncEach;
exports.asyncFilter = asyncFilter;
exports.selectByText = selectByText;
exports.selectByValue = selectByValue;
exports.sleep = sleep;
