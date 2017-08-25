// ViewError {{{1

function ViewError(msg) {
	this.message = msg;
}

ViewError.prototype = Object.create(Error.prototype);
ViewError.prototype.name = 'ViewError';
ViewError.prototype.constructor = ViewError;

// View {{{1
// JSDoc Types {{{2

/**
 * @typedef View~Data
 *
 * @property {boolean} isPlain
 * @property {boolean} isGroup
 * @property {boolean} isPivot
 * @property {Array.<View~Data_Row>} data
 */

/**
 * @typedef View~Data_Row
 *
 * @property {number} rowNum A unique row number, which is used to track rows when they are moved
 * within the GridTable instance, e.g. by reordering the rows manually, or by sorting.
 *
 * @property {Object.<string, View~Data_Field>} rowData Contains the data for the row; keys are
 * field names, and values are objects representing the value of that field within the row.
 */

/**
 * @typedef View~Data_Field
 *
 * @property {any} orig The original representation of the data as it came from the data source.
 * This is mostly only useful when displaying the value, when no `render` function has been
 * provided.
 *
 * @property {any} value The internal representation of the field's value, which is used for sorting
 * and filtering.  This corresponds to the type of the field, e.g. when the field has a type of
 * "date," this property contains a Moment instance.
 *
 * @property {View~Data_Field_Render} [render] If this property exists, it specifies a function
 * that is used to turn the internal representation into a printable value that will be placed into
 * the cell when the table is output.
 */

/**
 * A function called by the GridTable instance to produce a value that will be placed into a cell in
 * the table output.  An example usage would be to create a link based on the value of the cell.
 *
 * @callback View~Data_Field_Render
 *
 * @returns {Element|jQuery|string} What should be put into the cell in the table output.
 */

var DATA_VIEW_ID = 1;

// Constructor {{{2

/**
 * This represents a view of the data obtained by a data source.  While the pool of available data
 * is the same, the way its represented to the user (filtered, sorted, grouped, or pivotted)
 * changes.
 *
 * @class
 *
 * @property {Source} source
 *
 * @property {Object} sortSpec
 *
 * @property {string} sortSpec.col The name of the column to sort by.
 *
 * @property {string} sortSpec.dir The direction of the sort, either "ASC" or "DESC."
 *
 * @property {Object} groupSpec
 *
 * @property {Array.<string>} groupSpec.fieldNames
 *
 * @property {Function} groupSpec.aggregate
 *
 * @property {Object.<string, Array.<Function>>} eventHandlers
 *
 * @property {Array.<Function>} eventHandlers.filter
 *
 * @property {Array.<Function>} eventHandlers.getTypeInfo
 *
 * @property {Array.<Function>} eventHandlers.sort
 *
 * @property {Timing} timing For keeping track of how long it takes to do things in the view.
 */

var View = function (source, name) {
	var self = this;

	if (!(source instanceof Source)) {
		throw new ViewError('Source must be an instance of MIE.WC_DataVis.Source');
	}

	self.source = source;
	self.source.on(Source.events.dataUpdated, function () {
		self.clearCache();
		self.fire(View.events.dataUpdated);
	});

	self.name = name ||gensym();

	self.eventHandlers = {};
	_.each(_.keys(View.events), function (evt) {
		self.eventHandlers[evt] = [];
	});

	self.timing = new Timing();

	self.lock = new Lock('View Lock (' + self.name + ')');
};

View.prototype = Object.create(Error.prototype);
View.prototype.name = 'View';
View.prototype.constructor = View;

// .events {{{2

View.events = objFromArray([
		'getTypeInfo' // ???
	, 'workBegin'   // ???
	, 'workEnd'     // ???
	, 'dataUpdated' // The data has changed in the source.
	, 'sortBegin'   // A sort operation has started.
	, 'sort'        // Sort information for a row is available.
	, 'sortEnd'     // A sort operation has finished.
	, 'filterBegin' // A filter operation has started.
	, 'filter'      // Filter information for a row is available.
	, 'filterEnd'   // A filter operation has finished.
]);

mixinEventHandling(View, function (self) {
	return 'VIEW (' + self.name + ')';
}, View.events);

// #getRowCount {{{2

/**
 * Get the number of rows currently being shown by the view.
 *
 * @return {number} The number of rows shown in the table output.
 */

View.prototype.getRowCount = function () {
	var self = this;

	if (self.data.isPlain) {
		return self.data.data.length;
	}
	else if (self.data.isGroup) {
		return _.reduce(self.data, function (prev1, groupedData, rowValNum) {
			if (self.data.isPivot) {
				return prev1 + _.reduce(groupedData, function (prev2, pivottedData, colValNum) {
					return prev2 + pivottedData.length;
				}, 0);
			}
			else {
				return prev1 + groupedData.length;
			}
		}, 0);
	}
	else {
		throw new Error('Unable to determine row count when data is not plain, but also not grouped.');
	}
};

// #getTotalRowCount {{{2

/**
 * Get the number of rows that could be shown by the view.
 *
 * @return {number} The total number of rows in the data, including those which aren't currently
 * being sorted (e.g. because they have been filtered out).
 */

View.prototype.getTotalRowCount = function () {
	return this.source.cache.data.length;
};

// #setSort {{{2

/**
 * Set the sorting spec for the view.
 *
 * @param {string} col Name of the field to sort by.
 *
 * @param {string} dir Direction to sort by, either "ASC" or "DESC."
 *
 * @param {boolean} dontNotify If true, don't fire off the message notifying subscribers that the
 * view has been sorted.
 *
 * @param {GridTable~Progress} progress
 */

View.prototype.setSort = function (col, dir, dontNotify, progress) {
	var self = this
		, args = Array.prototype.slice.call(arguments);

	if (self.lock.isLocked()) {
		return self.lock.onUnlock(function () {
			self.setSort.apply(self, args);
		}, 'Waiting to set sort: ' + col + ' (' + desc + ')');
	}

	self.clearCache();

	if (isNothing(col) || isNothing(dir)) {
		self.sortSpec = null;
	}
	else {
		self.sortSpec = {
			col: col,
			dir: dir
		};
		self.sortProgress = progress;
	}

	self.getData();
};

// #clearSort {{{2

/**
 * Clear the sort spec for the view.
 *
 * @param {boolean} dontNotify If true, don't fire off the message notifying subscribers that the
 * view has been sorted.
 */

View.prototype.clearSort = function (dontNotify) {
	return this.setSort(null, null, dontNotify);
};

// #sort {{{2

/**
 * Sort this view of the data by the specified column name, in the specified direction.  This is
 * asynchronous because long running sorts need to keep the user interface responsive.
 *
 * @param {function} cont Continuation function to which the sorted data is passed.
 */

View.prototype.sort = function (cont) {
	var self = this
		, timingEvt = ['Data Source "' + self.source.name + '" : ' + self.name, 'Sorting']
		, conv = I;

	if (self.sortSpec === undefined) {
		return cont(false, self.data.data);
	}

	var fti = self.typeInfo.get(self.sortSpec.col);

	// Check to make sure we have enough information about the type of the field that the user wants
	// us to sort by.

	if (fti === undefined) {
		throw new ViewError('Unable to sort by field "' + self.sortSpec.col + '" - no type information available');
	}

	if (fti.type === undefined) {
		throw new ViewError('Unable to sort by field "' + self.sortSpec.col + '" - type is not provided');
	}

	if (fti.needsDecoding) {
		debug.info('VIEW (' + self.name + ') // SORT',
							 'Decoding data before sorting: { field = "%s", type = "%s" }',
							 fti.field, fti.type);
		self.source.convertAll(self.data.data, fti.field);
		fti.deferDecoding = false;
		fti.needsDecoding = false;
	}

	var cmp = getComparisonFn.byType(fti.type);

	// Check to make sure that we have a valid function registered to use for comparing values in the
	// domain of the type of the field that the user wants us to sort by.

	if (cmp === undefined) {
		throw new ViewError('Unable to sort by field "' + self.sortSpec.col + '" - no function registered to compare values of type "' + fti.type + '"');
	}

	if (typeof cmp !== 'function') {
		throw new ViewError('Unable to sort by field "' + self.sortSpec.col + '" - function registered to compare values of type "' + fti.type + '" is not actually a function');
	}

	// Start the timer for the sort.

	self.timing.start(timingEvt);

	// If there's a progress callback, perform its start event.

	if (self.sortProgress
			&& typeof self.sortProgress.begin === 'function') {
		self.sortProgress.begin();
	}

	// Fire the event for starting the sort.

	self.fire(View.events.sortBegin);

	if (self.data.isPlain) {
		mergeSort3(self.data.data,
							 function (a, b) {
								 return !!(cmp(a.rowData[self.sortSpec.col].value, b.rowData[self.sortSpec.col].value)
													 ^ (self.sortSpec.dir === 'DESC'));
							 },
							 function (sorted) {
								 _.each(sorted, function (row, position) {
									 self.fireQuietly(View.events.sort, row.rowNum, position);
								 });

								 // If there's a progress callback, perform its done event.

								 if (self.sortProgress
										 && typeof self.sortProgress.end === 'function') {
									 self.sortProgress.end();
								 }

								 // Fire the event for finishing the sort.

								 self.fire(View.events.sortEnd);

								 // Stop the timer for the sort.

								 self.timing.stop(timingEvt);

								 // Pass the sorted data to the continuation.

								 return cont(true, sorted);
							 },
							 self.sortProgress && self.sortProgress.update);
	}
	else if (self.data.isGroup) {
		// There are two ways to sort grouped data: by a field that is part of the group (changes the
		// ordering of the groups), and by a field that isn't part of the group (changes the ordering of
		// the rows within each group).

		return cont(false, self.data.data);
	}
	else if (self.data.isPivot) {
		return cont(false, self.data.data);
	}
};

// #setFilter {{{2

/**
 * @typedef {Object<string,string>|Object<string,View_Filter_Spec_Value>} View_Filter_Spec
 * The specification used for filtering within a data view.  The keys are column names, and the
 * values are either strings (implying an equality relationship) or objects indicating a more
 * complex relationship.
 */

/**
 * @typedef {Object<string,any>} View_Filter_Spec_Value
 * A value within the filter spec object.  In order for a row to "pass" the filter, all of the
 * conditions supplied must be true.  At least one of the following must be provided.
 *
 * @property {string|number|Date} [$eq] Allow things equal to the value.
 * @property {string|number|Date} [$ne] Allow things not equal to the value.
 * @property {string|number|Date} [$gt] Allow things greater than the value.
 * @property {string|number|Date} [$gte] Allow things greater than or equal to the value.
 * @property {string|number|Date} [$lt] Allow things less than the value.
 * @property {string|number|Date} [$lte] Allow things less than or equal to the value.
 * @property {Array.<string|number>} [$in] Allow things that are elements of the set value.
 * @property {Array.<string|number>} [$nin] Allow things that are not elements of the set value.
 */

/**
 * Set the filtering that will be used by this view.  The object spec is the same as we support for
 * server-side filtering using JSON.  It's based on MongoDB.  Every key is the name of a column to
 * filter.  Every value is either a string (the column must be equal to that value), or an object
 * --- in which every key is an operator and every value an operand.  Operators are:
 *
 *   - $eq, $ne, $gt, $gte, $lt, $lte, $contains, $notcontains
 *   - $in, $nin
 *
 * @method
 * @memberof View
 *
 * @param {View_Filter_Spec} spec How to perform filtering.
 */

View.prototype.setFilter = function (spec, dontNotify, progress) {
	var self = this
		, args = Array.prototype.slice.call(arguments);

	if (self.lock.isLocked()) {
		return self.lock.onUnlock(function () {
			self.setFilter.apply(self, args);
		}, 'Waiting to set filter: ' + JSON.stringify(spec));
	}

	self.clearCache();
	self.filterSpec = spec;
	self.filterProgress = progress;
	self.getData();

	return true;
};

// #clearFilter {{{2

/**
 * Clear the spec used to filter this view.
 *
 * @param {boolean} dontNotify If true, don't send the notification message to subscribers that this
 * view has been filtered.
 */

View.prototype.clearFilter = function (dontNotify) {
	this.setFilter(null, dontNotify);
};

// #isFiltered {{{2

/**
 * Tell if this view has been filtered.
 *
 * @returns {boolean} True if the view has been filtered.
 */

View.prototype.isFiltered = function () {
	return !isNothing(this.filterSpec);
};

// #filter {{{2

/**
 * Apply the filter previously set.
 *
 * @param {function} cont Continuation function to which the filtered data is passed.
 */

View.prototype.filter = function (cont) {
	var self = this
		, timingEvt = ['Data Source "' + self.source.name + '" : ' + self.name, 'Filtering'];

	if (self.filterSpec === undefined) {
		return cont(false, self.data.data);
	}

	// Make sure that each column that we're filtering has been type decoded, if necessary.

	_.each(_.keys(self.filterSpec), function (filterField) {
		var fti = self.typeInfo.get(filterField);

		// Check to make sure we have enough information about the type of the field that the user wants
		// us to filter.

		if (fti === undefined) {
			throw new ViewError('Unable to filter field "' + filterField + '" - no type information available');
		}

		if (fti.type === undefined) {
			throw new ViewError('Unable to filter field "' + filterField + '" - type is not provided');
		}

		if (fti.needsDecoding) {
			debug.info('VIEW (' + self.name + ') // SORT',
								 'Decoding data before filtering: { field = "%s", type = "%s" }',
								 fti.field, fti.type);
			self.source.convertAll(self.data.data, fti.field);
			fti.deferDecoding = false;
			fti.needsDecoding = false;
		}
	});

	// Checks to see if the given filter passes for the given row.

	function passesFilter(fltr, field, row) {
		var datum = row[field].value;

		// When there's no such column, automatically fail.

		if (datum === undefined) {
			debug.warn('VIEW (' + self.name + ') // FILTER',
								 'Attempted to filter by non-existent column: ' + field);
			return false;
		}

		var isMoment = window.moment && window.moment.isMoment(datum);
		var isNumeral = window.numeral && window.numeral.isNumeral(datum);
		var isString = typeof datum === 'string';
		var isNumber = typeof datum === 'number';

		var pred = {};

		pred['$eq'] = function (operand) {
			return ( isMoment && datum.isSame(operand))
				|| ( isNumeral && datum._value === operand._value )
				|| ( isString && datum.toString().toLowerCase() === operand.toString().toLowerCase() )
				|| ( isNumber && datum === operand )
			;
		};

		pred['$ne'] = function (operand) {
			return !pred['$eq'](operand);
		};

		pred['$contains'] = function (operand) {
			return ( isMoment && false )
				|| ( isNumeral && false )
				|| ( isString && datum.indexOf(operand.toString().toLowerCase()) >= 0 )
				|| ( isNumber && false )
			;
		};

		pred['$notcontains'] = function (operand) {
			return !pred['$notcontains'](operand);
		};

		pred['$gt'] = function (operand) {
			return ( isMoment && datum.isAfter(operand) )
				|| ( isNumeral && datum._value > operand._value )
				|| ( isString && datum.toLowerCase() > operand.toLowerCase() )
				|| ( isNumber && datum > operand )
			;
		};

		pred['$gte'] = function (operand) {
			return pred['$gt'](operand) || pred['$eq'](operand);
		};

		pred['$lt'] = function (operand) {
			return ( isMoment && datum.isBefore(operand) )
				|| ( isNumeral && datum._value < operand._value )
				|| ( isString && datum.toLowerCase() < operand.toLowerCase() )
				|| ( isNumber && datum < operand )
			;
		};

		pred['$lte'] = function (operand) {
			return pred['$lt'](operand) || pred['$eq'](operand);
		};

		for (var operator in fltr) {
			if (!fltr.hasOwnProperty(operator)) {
				continue;
			}

			var operand = fltr[operator];
			// debug.info('DATA VIEW // FILTER', 'field = ' + field + ' ; Datum = ' + datum + ' ; Operator = ' + operator + ' ; Operand = ' + operand);

			if (pred[operator] !== undefined) {
				if (_.isArray(operand)) {
					if (_.every(operand, pred[operator]) === false) {
						return false;
					}
				}
				else if (pred[operator](operand) === false) {
					return false;
				}
			}
			else {
				switch (operator) {
				case '$in':
					if (!_.isArray(operand)) {
						throw new ViewError('Invalid filter spec, operator "$in" for column "' + field + '" requires array value');
					}

					if (_.map(operand, function (elt) { return elt.toString().toLowerCase(); }).indexOf(datum.toString().toLowerCase()) < 0) {
						return false;
					}
					break;

				case '$nin':
					if (!_.isArray(operand)) {
						throw new ViewError('Invalid filter spec, operator "$nin" for column "' + field + '" requires array value');
					}

					if (_.map(operand, function (elt) { return elt.toString().toLowerCase(); }).indexOf(datum.toString().toLowerCase()) >= 0) {
						return false;
					}
					break;

				default:
					throw new ViewError('Invalid operator "' + operator + '" for column "' + field + '"');
				}
			}
		}

		return true;
	}

	// Checks to see if all filters from the spec pass on the given row.

	function passesAllFilters(row) {
		// Iterate over all elements in the filter spec, testing each in turn, until one fails.  Pass
		// the row along as "extra data" because that's what the predicate is actually testing.

		var passes = isNothing(self.filterSpec) ? true : eachUntilObj(self.filterSpec, passesFilter, false, row.rowData);

		self.fireQuietly(View.events.filter, row.rowNum, !passes);

		return passes;
	}

	/*
	if (self.data === undefined) {
		return self.getData(function () {
			return self.filter();
		});
	}
	else if (self.typeInfo === undefined) {
		return self.getTypeInfo(function () {
			return self.filter();
		});
	}
	else {
		self.timing.start(timingEvt);
		self.data = _.filter(self.data, passesAllFilters);
		self.timing.stop(timingEvt);
	}
	*/

	var i0 = {
		val: 0
	}, i_step = 100;
	var newData = [];

	var doFilter = function () {
		debug.info('VIEW (' + self.name + ') // FILTER',
							 'Filtering rows ' + i0.val + ' through ' + (i0.val + i_step));

		for (i = i0.val; i < self.data.data.length && i < i0.val + i_step; i += 1) {
			if (passesAllFilters(self.data.data[i])) {
				newData.push(self.data.data[i]);
			}
		}

		if (i < self.data.data.length) {
			i0.val = i;

			if (self.filterProgress
					&& typeof self.filterProgress.update === 'function') {
				self.filterProgress.update(i, self.data.data.length);
			}

			return window.setTimeout(doFilter);
		}
		else {
			// If there's a progress callback, perform its done event.
			if (self.filterProgress
					&& typeof self.filterProgress.end === 'function') {
				self.filterProgress.end();
			}

			// Fire the event for finishing the filter.
			self.fire(View.events.filterEnd);

			// Stop the timer for the filter.
			self.timing.stop(timingEvt);

			// Pass the filtered data to the continuation.
			return cont(true, newData);
		}
	};

	// Start the timer for the filter operation.
	self.timing.start(timingEvt);

	// If there's a progress callback, perform its start event.
	if (self.filterProgress
			&& typeof self.filterProgress.begin === 'function') {
		self.filterProgress.begin();
	}

	// Fire the event for starting the filter.
	self.fire(View.events.filterBegin);

	return doFilter();
};

// #setGroup {{{2

/**
 * Set the specification for how the data will be grouped.
 *
 * @param {object} spec
 *
 * @param {Array.<string>} spec.fieldNames
 *
 * @param {Function} spec.aggregate
 */

View.prototype.setGroup = function (spec) {
	var self = this
		, args = Array.prototype.slice.call(arguments);

	if (self.lock.isLocked()) {
		return self.lock.onUnlock(function () {
			self.setGroup.apply(self, args);
		}, 'Waiting to set group: ' + JSON.stringify(spec));
	}

	self.clearCache();
	self.groupSpec = spec;
	self.getData();

	return true;
};

// #clearGroup {{{2

/**
 * Remove any grouping that had been set.
 */

View.prototype.clearGroup = function () {
	return this.setGroup(null);
};

// #group {{{2

/**
 * Perform grouping on the data.  This modifies the data in place; it's not asynchronous and there's
 * no return value.
 */

View.prototype.group = function () {
	var self = this;

	if (self.groupSpec === undefined) {
		return false;
	}

	var groupFields = self.groupSpec.fieldNames;

	// The variable `tree` contains all the rows of data, grouped according to the fields given, and
	// organized into a tree structure.
	//
	// Example
	// -------
	//
	// fieldNames = [Last Name, First Name]
	// A, B, C, ... = {row objects}
	//
	// tree = {
	//   Kennedy: {
	//     John: [A, B],
	//     Robert: [C, D],
	//     Ted: [E, F]
	//   },
	//   Roosevelt: {
	//     Franklin: [G, H],
	//     Teddy: [I, J]
	//   }
	// }
	//
	// {A,B,C,D,E,F}[Last Name] = Kennedy
	// {A,B}[First Name] = John
	// {C,D}[First Name] = Robert
	// {E,F}[First Name] = Ted

	var tree = (function RECUR(fieldNames, data) {
		var field = car(fieldNames)
			, tmp = {};

		// Assemble all the rows grouped by value for the current field.

		_.each(data, function (row) {
			var value = row.rowData[field].orig || row.rowData[field].value;

			if (tmp[value] === undefined) {
				tmp[value] = [];
			}

			tmp[value].push(row);
		});

		if (fieldNames.length > 1) {
			_.each(tmp, function (groupedRows, value) {
				tmp[value] = RECUR(cdr(fieldNames), groupedRows);
			});
		}

		return tmp;
	})(self.groupSpec.fieldNames, self.data.data);

	debug.info('VIEW (' + self.name + ') // GROUP',
						 'Tree Form: %O',
						 tree);

	var rowVals = [];
	var newData = [];

	// Convert the tree structure above into linear structure.  The advantage of the linear structure
	// is that everything is associated by index.
	//
	// Example
	// -------
	//
	// tree = < AS ABOVE >
	//
	// rowVals = [[Kennedy, John], [Kennedy, Robert], [Kennedy, Ted],
	//            [Roosevelt, Franklin], [Roosevelt, Teddy]]
	//
	// newData = [[A, B], [C, D], [E, F],
	//            [G, H], [I, J]]
	//
	// newData[2][1] = F
	// rowVals[2] = [Kennedy, Ted]
	// fieldNames[0] = Last Name  -> newData[2][1][Last Name]  = Kennedy
	// fieldNames[1] = First Name -> newData[2][1][First Name] = Ted

	(function RECUR(tree, level, path) {
		if (level === self.groupSpec.fieldNames.length) {
			_.each(_.keys(tree).sort(), function (value) {
				var rows = tree[value];
				rowVals.push(path.concat([value]));
				newData.push(rows);
			});
		}
		else {
			_.each(tree, function (subtree, value) {
				RECUR(subtree, level + 1, path.concat([value]));
			});
		}
	})(tree, 1, []);

	debug.info('VIEW (' + self.name + ') // GROUP', 'Row Vals: %O', rowVals);
	debug.info('VIEW (' + self.name + ') // GROUP', 'New Data: %O', newData);

	self.data.isPlain = false;
	self.data.isGroup = true;
	self.data.groupFields = groupFields;
	self.data.rowVals = rowVals;
	self.data.data = newData;

	return true;
};

// #setPivot {{{2

View.prototype.setPivot = function (spec) {
	var self = this
		, args = Array.prototype.slice.call(arguments);

	if (self.groupSpec === undefined) {
		alert("Come on, you're just doing this on purpose now!");
		return false;
	}

	if (self.lock.isLocked()) {
		return self.lock.onUnlock(function () {
			self.setPivot.apply(self, args);
		}, 'Waiting to set pivot: ' + JSON.stringify(spec));
	}

	self.clearCache();
	self.pivotSpec = spec;
	self.getData();

	return true;
};

// #clearPivot {{{2

View.prototype.clearPivot = function () {
	return this.setPivot(null);
};

// #pivot {{{2

View.prototype.pivot = function () {
	var self = this
		, pivotFields // Array of field names to pivot by.
		, colValsTree // Tree of all possible column value combinations.
		, colVals     // Array of all possible column value combinations.
	;

	if (self.pivotSpec === undefined) {
		return false;
	}

	pivotFields = self.pivotSpec.fieldNames;
	colValsTree = {};
	colVals = [];

	_.each(self.data.data, function (groupedRows) {
		(function RECUR(fieldNames, data, tree) {
			var field = car(fieldNames)
				, tmp = {};

			_.each(data, function (row) {
				var value = row.rowData[field].orig || row.rowData[field].value;

				if (tree[value] === undefined) {
					tree[value] = fieldNames.length > 1 ? {} : true;
				}

				if (tmp[value] === undefined) {
					tmp[value] = [];
				}

				tmp[value].push(row);
			});

			if (fieldNames.length > 1) {
				_.each(tmp, function (pivottedRows, value) {
					RECUR(cdr(fieldNames), pivottedRows, tree[value]);
				});
			}
		})(pivotFields, groupedRows, colValsTree);
	});

	// Construct the array of column value combinations from the tree form.

	(function RECUR(tree, level, path) {
		if (level === self.pivotSpec.fieldNames.length) {
			_.each(_.keys(tree).sort(), function (value) {
				colVals.push(path.concat([value]));
			});
		}
		else {
			_.each(tree, function (subtree, value) {
				RECUR(subtree, level + 1, path.concat([value]));
			});
		}
	})(colValsTree, 1, []);

	// Pivot the data using the information obtained above.
	//
	// TODO Make this work when the data isn't grouped.

	_.each(self.data.data, function (groupedRows, groupNum) {
		var newData = [];
		_.each(colVals, function (colVal) {
			var tmp = [];
			_.each(groupedRows, function (row) {
				if (_.every(colVal, function (colValElt, colValNum) {
					var pivotField = pivotFields[colValNum];
					return colValElt === (row.rowData[pivotField].orig || row.rowData[pivotField].value);
				})) {
					tmp.push(row);
				}
			});
			newData.push(tmp);
		});
		self.data.data[groupNum] = newData;
	});

	debug.info('VIEW (' + self.name + ') // PIVOT', 'Col Vals Tree: %O', colValsTree);
	debug.info('VIEW (' + self.name + ') // PIVOT', 'Col Vals: %O', colVals);
	debug.info('VIEW (' + self.name + ') // PIVOT', 'New Data: %O', self.data);

	self.data.isPivot = true;
	self.data.pivotFields = pivotFields;
	self.data.colVals = colVals;

	return true;
};

// #getData {{{2

/**
 * Retrieves a fresh copy of the data for this view from the data source.
 *
 * @param {function} cont What to do next.
 */

View.prototype.getData = function (cont) {
	var self = this;

	if (self.lock.isLocked()) {
		return self.lock.onUnlock(function () {
			self.getData(cont);
		}, 'Waiting to get data');
	}

	if (self.data !== undefined) {
		debug.info('VIEW (' + self.name + ')', 'Got cached data: %O', self.data);
		if (typeof cont === 'function') {
			return cont(self.data);
		}
	}

	self.lock.lock();

	self.fire(View.events.workBegin);
	return self.source.getData(function (data) {
		return self.source.getTypeInfo(function (typeInfo) {
			var ops = {
				filter: false,
				group: false,
				pivot: false,
				sort: false
			};

			self.data = {
				isPlain: true,
				isGroup: false,
				isPivot: false,
				data: _.map(data, function (rowData, rowNum) {
					return {
						rowNum: rowNum,
						rowData: rowData
					};
				})
			};
			self.typeInfo = typeInfo;
			return self.filter(function (didFilter, filteredData) {
				ops.filter = didFilter;
				self.data.data = filteredData;
				ops.group = self.group();
				ops.pivot = self.pivot();
				return self.sort(function (didSort, sortedData) {
					ops.sort = didSort;
					self.data.data = sortedData;

					var workEndObj = {
						isPlain: self.data.isPlain,
						isGroup: self.data.isGroup,
						isPivot: self.data.isPivot
					};

					if (self.data.isPlain) {
						workEndObj.numRows = self.getRowCount();
						if (self.isFiltered()) {
							workEndObj.totalRows = self.getTotalRowCount();
						}
					}
					else if (self.data.isGroup) {
						workEndObj.numGroups = self.data.data.length;
					}
					else if (self.data.isPivot) {
						workEndObj.numPivots = 0;
					}

					self.fire(View.events.workEnd, workEndObj, ops);

					self.lock.unlock();
					debug.info('VIEW (' + self.name + ')', 'Got new data: %O', self.data);
					if (typeof cont === 'function') {
						return cont(self.data);
					}
				});
			});
		});
	});
};

// #getTypeInfo {{{2

/**
 *
 */

View.prototype.getTypeInfo = function (cont) {
	var self = this;

	if (self.typeInfo === undefined) {
		return self.source.getTypeInfo(function (typeInfo) {
			self.typeInfo = typeInfo;
			return self.getTypeInfo(cont);
		});
	}

	self.fire('getTypeInfo', self.typeInfo);

	if (typeof cont === 'function') {
		return cont(self.typeInfo);
	}
};

// #clearCache {{{2

View.prototype.clearCache = function () {
	this.data = undefined;
	this.typeInfo = undefined;

	debug.info('VIEW (' + self.name + ')', 'Cleared cache');
};

// #reset {{{2

/**
 * Reset the view to reflect the data source with no transformations.  This is the same as calling
 * all the "clear" functions.
 */

View.prototype.reset = function (dontNotify) {
	var self = this;

	self.clearCache();
	self.clearSort(true);
	self.clearFilter(true);

	if (!dontNotify) {
		self.fire(View.messages.reset, {
			rowCount: self.source.cache.data.length
		});
	}
};

// #getUniqueVals {{{2

View.prototype.getUniqueVals = function (cont) {
	var self = this;

	return self.source.getUniqueVals(cont);
};

