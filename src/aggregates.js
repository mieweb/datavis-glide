/* ===============================================================================================
 *  Aggregates
 * ===============================================================================================
 *
 * Aggregate functions are invoked over an array of data.  Each aggregate function is basically a
 * reduction, but we aren't using the Underscore reduce() function because of its limitations.
 *
 *
 *
 * Implementation of the aggregate functions inside the `aggregate` variable will seem awkward and
 * unconventional to programmers without a background in functional programming.  Please use this
 * explanation to help understand how the pieces fit together:
 *
 *   1. Properties of the `aggregates` variable are functions that are called directly based on
 *   user configuration of the report definition.  Most take only a single argument, which is the
 *   field to aggregate.  Some (like 'groupConcat') take additional arguments that affect their
 *   output.
 *
 *   2. Each of these `aggregates` properties return a function that takes the row data, which is
 *   all rows to aggregate.  It's an array of objects, each having a property corresponding to the
 *   field argument explained above.
 *
 *   3. When that function is applied to the row data to be aggregated, it more than likely calls
 *   invokeAggregate(), which is a convenience function to iterate over the row data.  This is
 *   basically a reduction.
 *
 *   4. The reduction function may be a simple function, or it might be a call to makeAggregate(),
 *   which builds an aggregate (i.e. reduction function) by closing over some userdata.  The
 *   userdata can be used for anything you want, e.g. building the sets used by aggregates like
 *   'countDistinct.'
 *
 * The presence of makeAggregate() isn't strictly necessary, as we can use the function from step
 * #2 as the closure over userdata, but it does make the architecture more flexible and easier to
 * adapt to build your own aggregates.
 *
 * -----------------------------------------------------------------------------------------------
 *  EXAMPLE
 * -----------------------------------------------------------------------------------------------
 *
 * var report = {
 *   table: {
 *     grouping: {
 *       headerLine: [
 *         { func: 'average', field: 'Age' },
 *         { func: 'countDistinct', field: 'First Name', separator: ', ' }
 *       ]
 *     }
 *   }
 * }
 */

function makeAggregate(userdata, aggregate) {
	var u = userdata;
	return function (acc, next, data, index) {
		return aggregate(acc, next, data, index, u);
	};
}

/**
 * Invoke the core implementation of an aggregate function.  This is used by most aggregate
 * functions (properties of `AGGREGATES`) to perform the data traversal.
 *
 * - The implementation may throw an exception to abort the process at any time (e.g. if an item
 *   doesn't match the expected type or is in some other way borked).
 *
 * - The implementation may not use all of the arguments that it receives (e.g. `sum` only needs the
 *   accumulator and the item, it doesn't care about the data or index).
 *
 * - There is currently no way for an implementation to indicate successful premature termination
 *   (e.g. no need to continue traversing the data).  If this is needed (e.g. `first`), it's
 *   recommended to not use `invokeAggregate` - and to instead just traverse the data yourself.
 *
 * @param {Array.<any>} data
 * @param {function} aggregate Called like this: `agg(acc, item, data, index)`
 * @param {any} init
 */

function invokeAggregate(data, aggregate, init) {
	var i, i0, len, acc;
	if (!_.isArray(data)) {
		throw 'Cannot invoke aggregate over non-array';
	}
	len = data.length;
	if (!_.isUndefined(init)) {
		acc = init;
		i0 = 0;
	}
	else {
		acc = data[0].rowData;
		i0 = 1;
	}
	for (i = i0; i < len; i += 1) {
		try {
			acc = aggregate(acc, data[i].rowData, data, i);
		}
		catch (e) {
			if (_.isString(e)) {
				throw e + ' // data index = ' + i;
			}
			else {
				throw e;
			}
		}
	}
	return acc;
}

function getRealValue(cell) {
	if (_.isString(cell)) {
		return cell;
	}
	else if (_.isNumber(cell)) {
		return cell;
	}
	else if (_.isObject(cell)) {
		if (cell.value !== undefined) {
			return cell.value;
		}
		else if (cell.orig !== undefined) {
			return cell.orig;
		}
		else {
			throw new Error('Unable to get real value of cell');
		}
	}
}

function getRealValueAsKey(cell) {
	var val = getRealValue(cell);

	if (window.numeral && window.numeral.isNumeral(val)) {
		return val.value();
	}
	else if (window.moment && window.moment.isMoment(val)) {
		return val.unix();
	}
	else {
		return val;
	}
}

/**
 * @typedef {Object} Aggregate
 *
 * @property {function} fun Call this with the options for the aggregate function to get a function
 * back.  The return value should be called, passing the data as the only argument; its result is
 * the final value of the aggregate function.
 *
 * Example:
 *
 * ```
 * var findAverageAge = AGGREGATES.average.fun({field: 'age'});
 * var averageAge1 = findAverageAge(data1);
 * var averageAge2 = findAverageAge(data2);
 * ```
 *
 * @property {string} type The type of the result of the aggregate function (e.g. `groupConcat` is
 * string, `sum` is number).  When undefined, the type is dependent on the data being consumed (e.g.
 * `min` and `max`).
 */

/**
 * Registry for all the known types of aggregate functions.
 *
 * @type {Object.<string, Aggregate>}
 *
 * @property {Aggregate} count Returns the number of items in the data.
 *
 * @property {Aggregate} countDistinct Returns the number of items in the data with distinct values
 * for the specified field.
 *
 * Required config properties:
 *
 *   - field
 *
 * @property {Aggregate} sum Returns the sum of the numeric values of the specified field, across
 * all items in the data.  An error will occur if there are any items where the value of the field
 * is not a number.
 *
 * Required config properties:
 *
 *   - field
 *
 * @property {Aggregate} average Returns the average of the numeric values of the specified field,
 * across all items in the data.  An error will occur if there are any items where the value of the
 * field is not a number.
 *
 * Required config properties:
 *
 *   - field
 *
 * @property {Aggregate} groupConcat
 *
 * Required config properties:
 *
 *   - field
 *
 * Optional config properties:
 *
 *   - separator
 *
 * @property {Aggregate} groupConcatDistinct
 *
 * Required config properties:
 *
 *   - field
 *
 * Optional config properties:
 *
 *   - separator
 *
 * @property {Aggregate} first
 *
 * Required config properties:
 *
 *   - field
 *
 * @property {Aggregate} last
 *
 * Required config properties:
 *
 *   - field
 *
 * @property {Aggregate} nth
 *
 * Required config properties:
 *
 *   - field
 *   - index
 *
 * @property {Aggregate} min
 *
 * Required config properties:
 *
 *   - field
 *
 * @property {Aggregate} max
 *
 * Required config properties:
 *
 *   - field
 */
var AGGREGATES = {};

// .count {{{1

AGGREGATES.count = {
	fun: function (opts) {
		opts = opts || {};
		return function (data) {
			return numeral(data.length);
		};
	},
	canBePivotCell: true,
	needsField: false,
	type: 'number',
	inheritFormatting: false
};

// .countDistinct {{{1

AGGREGATES.countDistinct = {
	fun: function (opts) {
		opts = opts || {};
		if (_.isUndefined(opts.field)) {
			throw 'countDistinct aggregate: missing [field] argument';
		}
		return function (data) {
			return invokeAggregate(data, makeAggregate({}, function (acc, next, _1, _2, set) {
				var key = getRealValueAsKey(next[opts.field].value);
				if (set[key]) {
					return acc;
				}
				else {
					set[key] = true;
					return acc.add(1);
				}
			}), numeral(0));
		};
	},
	canBePivotCell: true,
	needsField: true,
	type: 'number',
	inheritFormatting: false
};

// .sum {{{1

AGGREGATES.sum = {
	fun: function (opts) {
		opts = opts || {};
		if (_.isUndefined(opts.field)) {
			throw 'sum aggregate: missing [field] property';
		}
		return function (data) {
			var result = invokeAggregate(data, function (acc, next) {
				var val = next[opts.field].value;

				if (window.numeral && window.numeral.isNumeral(val)) {
					// Check to see if this is a plain number, or a number wrapped by the Numeral library.  It
					// should always be the latter, but we check anyway, because there's no reason not to.

					val = val.value();
				}
				else if (_.isString(val)) {
					// We can also handle when it's a number represented as a string.  We'll try to convert it
					// either to an integer or a float.

					if (isInt(val)) {
						val = toInt(val);
					}
					else if (isFloat(val)) {
						val = toFloat(val);
					}
					else {
						//log.error('Unable to interpret value as a number: { field = "%s", value = "%s" }', opts.field, JSON.stringify(val));
						val = 0;
					}
				}

				if (!_.isNumber(val)) {
					log.error('Unable to interpret value as a number: { field = "%s", value = "%s" }', opts.field, JSON.stringify(val));
				}

				return acc.add(val);
			}, numeral(0));

			return result;
		};
	},
	canBePivotCell: true,
	needsField: true,
	type: 'number',
	inheritFormatting: true
};

// .average {{{1

AGGREGATES.average = {
	fun: function (opts) {
		opts = opts || {};
		if (_.isUndefined(opts.field)) {
			throw 'average aggregate: missing [field] property';
		}
		return function (data) {
			return numeral(AGGREGATES.sum.fun(opts)(data).value() / data.length);
		};
	},
	canBePivotCell: true,
	needsField: true,
	type: 'number',
	inheritFormatting: true
};

// .groupConcat {{{1

AGGREGATES.groupConcat = {
	fun: function (opts) {
		opts = opts || {};
		if (_.isUndefined(opts.field)) {
			throw 'groupConcat aggregate: missing [field] property';
		}
		if (_.isUndefined(opts.separator)) {
			opts.separator = ', ';
		}
		if (!_.isString(opts.separator)) {
			throw 'groupConcat aggregate separator must be a string';
		}
		return function (data) {
			return invokeAggregate(data, function (acc, next) {
				var str = format(opts.colConfig, null, next[opts.field], {
					alwaysFormat: true,
					overrideType: opts.type
				});
				return acc === '' ? str : acc + opts.separator + str;
			}, '');
		};
	},
	canBePivotCell: true,
	needsField: true,
	type: 'string'
};

// .groupConcatDistinct {{{1

AGGREGATES.groupConcatDistinct = {
	fun: function (opts) {
		opts = opts || {};
		if (_.isUndefined(opts.field)) {
			throw 'groupConcatDistinct aggregate: missing [field] property';
		}
		if (_.isUndefined(opts.separator)) {
			opts.separator = ', ';
		}
		if (!_.isString(opts.separator)) {
			throw 'groupConcat aggregate separator must be a string';
		}
		return function (data) {
			return invokeAggregate(data, makeAggregate({}, function (acc, next, _1, _2, set) {
				var str = format(opts.colConfig, null, next[opts.field], {
					alwaysFormat: true,
					overrideType: opts.type
				});
				if (set[str]) {
					return acc;
				}
				else {
					set[str] = true;
					return acc === '' ? str : acc + opts.separator + str;
				}
			}), '');
		};
	},
	canBePivotCell: true,
	needsField: true,
	type: 'string'
};

// .first {{{1

AGGREGATES.first = {
	fun: function (opts) {
		opts = opts || {};
		if (_.isUndefined(opts.field)) {
			throw 'first aggregate: missing [field] property';
		}
		return function (data) {
			return data.length > 0 ? getRealValue(data[0].rowData[opts.field]) : '';
		};
	},
	canBePivotCell: true,
	needsField: true,
	type: undefined,
	inheritFormatting: true
};

// .last {{{1

AGGREGATES.last = {
	fun: function (opts) {
		opts = opts || {};
		if (_.isUndefined(opts.field)) {
			throw 'last aggregate: missing [field] property';
		}
		return function (data) {
			return data.length > 0 ? getRealValue(data[data.length - 1].rowData[opts.field]) : '';
		};
	},
	canBePivotCell: true,
	needsField: true,
	type: undefined,
	inheritFormatting: true
};

// .nth {{{1

AGGREGATES.nth = {
	fun: function (opts) {
		opts = opts || {};
		if (_.isUndefined(opts.field)) {
			throw 'nth aggregate: missing [field] property';
		}
		if (_.isUndefined(opts.index)) {
			throw 'nth aggregate: missing [index] property';
		}
		else if (parseInt(opts.index, 10) !== opts.index) {
			throw 'nth aggregate: [index] property must be an interger';
		}
		return function (data) {
			return opts.index >= data.length ? (opts.nonExistent || '[ERROR:OUT-OF-RANGE]') : getRealValue(data[opts.index].rowData[opts.field]);
		};
	},
	needsField: true,
	type: undefined,
	inheritFormatting: true
};

// .min {{{1

AGGREGATES.min = {
	fun: function (opts) {
		opts = _.defaults(opts || {}, {
			type: 'string'
		});

		if (opts.field === undefined) {
			throw 'min aggregate: missing [field] property';
		}

		if (typeof opts.type !== 'string') {
			throw 'min aggregate: [type] property must be a string';
		}

		if (opts.compare === undefined) {
			opts.compare = getComparisonFn.byType(opts.type);
		}

		if (typeof opts.compare !== 'function') {
			throw 'min aggregate: [compare] property must be a function';
		}

		return function (data) {
			return invokeAggregate(data, function (acc, next) {
				var n = getRealValue(next[opts.field]);
				return opts.compare(n, acc) ? n : acc;
			}, getRealValue(data[0].rowData[opts.field]));
		};
	},
	canBePivotCell: true,
	needsField: true,
	type: undefined,
	inheritFormatting: true
};

// .max {{{1

AGGREGATES.max = {
	fun: function (opts) {
		opts = _.defaults(opts || {}, {
			type: 'string'
		});

		if (opts.field === undefined) {
			throw 'max aggregate: missing [field] property';
		}

		if (typeof opts.type !== 'string') {
			throw 'max aggregate: [type] property must be a string';
		}

		if (opts.compare === undefined) {
			opts.compare = getComparisonFn.byType(opts.type);
		}

		if (typeof opts.compare !== 'function') {
			throw 'max aggregate: [compare] property must be a function';
		}

		return function (data) {
			return invokeAggregate(data, function (acc, next) {
				var n = getRealValue(next[opts.field]);
				return opts.compare(n, acc) ? acc : n;
			}, getRealValue(data[0].rowData[opts.field]));
		};
	},
	canBePivotCell: true,
	needsField: true,
	type: undefined,
	inheritFormatting: true
};

/**
 * Make sure a user-specified aggregate conforms to the required data structure.
 */

function checkAggregate(defn, agg, source) {
	if (!_.isObject(agg)) {
		throw defn.error(new InvalidReportDefinitionError(source, agg, 'must be an object'));
	}
	// INPUT VALIDATION: [fun]
	if (_.isUndefined(agg.fun)) {
		throw defn.error(new InvalidReportDefinitionError(source + '.fun', agg.fun, 'must be present'));
	}
	if (!_.isString(agg.fun)) {
		throw defn.error(new InvalidReportDefinitionError(source + '.fun', agg.fun, 'must be a string'));
	}
	if (!AGGREGATES[agg.fun]) {
		throw defn.error(new InvalidReportDefinitionError(source + '.fun', agg.fun, 'must be a valid builtin aggregate function'));
	}
	// INPUT VALIDATION: [displayText]
	if (_.isUndefined(agg.displayText)) {
		agg.displayText = agg.fun;
	}
	if (!_.isString(agg.displayText)) {
		throw defn.error(new InvalidReportDefinitionError(source + '.displayText', agg.displayText, 'must be a string'));
	}
}
