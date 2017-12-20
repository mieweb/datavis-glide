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

var View = function (source, name, opts) {
	var self = this;

	opts = deepDefaults(opts, {
		saveViewConfig: true,
		groupIsPivot: false
	});

	self.opts = opts;

	if (!(source instanceof Source)) {
		throw new ViewError('Source must be an instance of MIE.WC_DataVis.Source');
	}

	self.source = source;
	self.source.on(Source.events.dataUpdated, function () {
		self.clearCache();
		self.fire(View.events.dataUpdated);
	});

	self.name = name || source.getName() || gensym();

	self.eventHandlers = {};
	_.each(_.keys(View.events), function (evt) {
		self.eventHandlers[evt] = [];
	});

	self.timing = new Timing();

	self.lock = new Lock('View Lock (' + self.name + ')');

	if (self.opts.saveViewConfig) {
		self.prefs = new LocalStoragePrefs(self);
	}

	self.aggregateSpec = {
		group: [{
			fun: 'count'
		}],
		pivot: [{
			fun: 'count'
		}],
		cell: [{
			fun: 'count'
		}],
		all: [{
			fun: 'count'
		}]
	};
};

View.prototype = Object.create(Object.prototype);
View.prototype.constructor = View;

mixinEventHandling(View, function (self) {
	return 'VIEW (' + self.name + ')';
}, [
		'getTypeInfo'  // Type information has been retrieved from the source.
	, 'workBegin'    // ???
	, 'workEnd'      // ???
	, 'dataUpdated'  // The data has changed in the source.

	, 'sortSet'      // When the sort has been set.  Args: (field, direction)
	, 'filterSet'    // When the filter has been set.  Args: (spec)
	, 'groupSet'     // When the grouping has been set.  Args: (spec)
	, 'pivotSet'     // When the pivot config has been set.  Args: (spec)
	, 'aggregateSet' // When the aggregate config has been set.  Args: (spec)

	, 'sortBegin'    // A sort operation has started.
	, 'sort'         // Sort information for a row is available.
	, 'sortEnd'      // A sort operation has finished.
	, 'filterBegin'  // A filter operation has started.
	, 'filter'       // Filter information for a row is available.
	, 'filterEnd'    // A filter operation has finished.
]);

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
 * @param {GridTable~Progress} progress
 */

View.prototype.setSort = function (spec, progress, noUpdate, dontTell) {
	var self = this
		, args = Array.prototype.slice.call(arguments);

	if (self.lock.isLocked()) {
		return self.lock.onUnlock(function () {
			self.setSort.apply(self, args);
		}, 'Waiting to set sort: ' + JSON.stringify(spec));
	}

	debug.info('VIEW (' + self.name + ') // SET SORT', 'spec = %O', spec);

	self.sortSpec = spec;
	self.sortProgress = progress;

	self.fire(View.events.sortSet, {
		notTo: dontTell
	}, spec);

	if (noUpdate) {
		return true;
	}

	self.clearCache();
	self.getData();

	return true;
};

// #getSort {{{2

View.prototype.getSort = function () {
	var self = this;

	return self.sortSpec;
};

// #clearSort {{{2

/**
 * Clear the sort spec for the view.
 */

View.prototype.clearSort = function (noUpdate, dontTell) {
	return this.setSort(null, null, noUpdate, dontTell);
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
		, conv = I
		, aggInfo = getProp(self.data, 'agg', 'info');

	if (self.sortSpec == null) {
		return cont(false);
	}

	debug.info('VIEW (' + self.name + ') // SORT', 'Beginning sort: %s', JSON.stringify(self.sortSpec));

	var determineCmp = function (spec, fti) {
		var cmp;

		if (fti == null) {
			log.error('Unable to sort: no type information {spec = %O}', spec);
			return null;
		}

		if (typeof fti === 'string' || fti instanceof String) {
			fti = {
				type: fti
			};
		}

		if (fti.type == null) {
			log.error('Unable to sort: type unknown {spec = %O, fti = %O}', spec, fti);
			return null;
		}

		cmp = getComparisonFn.byType(fti.type);

		if (cmp == null) {
			log.error('Unable to sort: no comparison function for type {spec = %O, type = %s}', spec, fti.type);
			return null;
		}

		if (typeof cmp !== 'function') {
			log.error('Unable to sort: invalid comparison function for type {spec = %O, type = %s}', spec, fti.type);
			return null;
		}

		if (fti.needsDecoding) {
			if (!fti.field) {
				log.error('Unable to sort: cannot decode unknown field {spec = %O, typeInfo = %O}', spec, fti);
				return null;
			}

			debug.info('VIEW (' + self.name + ') // SORT', 'Decoding data before sorting {spec = %O, typeInfo = %O}', spec, fti);

			if (self.data.isPlain) {
				self.source.convertAll(self.data.data, fti.field);
			}
			else {
				_.each(self.data.data, function (groupedRows) {
					if (self.data.isGroup) {
						self.source.convertAll(groupedRows, fti.field);
					}
					else {
						_.each(groupedRows, function (pivottedRows) {
							self.source.convertAll(pivottedRows, fti.field);
						});
					}
				});
			}

			fti.deferDecoding = false;
			fti.needsDecoding = false;
		}

		return cmp;
	};



	var packBundle = function (spec, orientation, sortSourceFn) {
		var bundle, len;

		if (sortSourceFn == null) {
			log.error('Unable to sort: no sort source function given {spec = %O}', spec);
			return null;
		}

		switch (orientation) {
		case 'vertical':
			len = self.data.isPlain ? self.data.data.length : self.data.rowVals.length;
			break;
		case 'horizontal':
			len = self.data.isPlain ? self.data.data.length : self.data.colVals.length;
			break;
		default:
			return null;
		}

		bundle = new Array(len);

		for (var i = 0; i < len; i += 1) {
			bundle[i] = {
				oldIndex: i,
				sortSource: sortSourceFn(i)
			};
		}

		return bundle;
	};



	/*
	 * Unpack the sorted "bundle" that comes back from mergesort.  We use that to reconstruct the
	 * data, row/col values, and aggregate results in the new sorted order.
	 */

	var unpackBundle = function (orientation) {
		return function (sorted) {
			debug.info('VIEW (' + self.name + ') // SORT // UNPACK',
								 'Unpacking bundle of %d sorted chunks in %s orientation',
								 sorted.length, orientation);

			var origData = self.data.data;
			var origRowVals = getProp(self.data, 'rowVals');
			var origColVals = getProp(self.data, 'colVals');
			var origCellAgg = getProp(self.data, 'agg', 'results', 'cell');
			var origGroupAgg = getProp(self.data, 'agg', 'results', 'group');
			var origPivotAgg = getProp(self.data, 'agg', 'results', 'pivot');

			var ai // Aggregate Index
				, rvi // Row Value Index
			;

			switch (orientation) {
			case 'vertical':
				self.data.data = [];

				if (origRowVals != null) {
					self.data.rowVals = [];
				}

				if (origCellAgg != null) {
					self.data.agg.results.cell = [];
				}

				if (origGroupAgg != null) {
					self.data.agg.results.group = [];
				}

				_.each(sorted, function (s, newIndex) {
					// For plain output, fire the "sort" event so that the rows (if the grid table is showing
					// all of them) can just be shuffled around, and the table doesn't have to be recreated.

					if (self.data.isPlain) {
						self.fire(View.events.sort, {
							silent: true
						}, origData[s.oldIndex].rowNum, newIndex);
					};

					self.data.data[newIndex] = origData[s.oldIndex];
					if (origRowVals != null) {
						self.data.rowVals[newIndex] = origRowVals[s.oldIndex];
					}
				});

				if (origCellAgg != null) {
					for (ai = 0; ai < origCellAgg.length; ai += 1) {
						self.data.agg.results.cell[ai] = [];
						_.each(sorted, function (s, newIndex) {
							self.data.agg.results.cell[ai][newIndex] = origCellAgg[ai][s.oldIndex];
						});
					}
				}

				if (origGroupAgg != null) {
					for (ai = 0; ai < origGroupAgg.length; ai += 1) {
						self.data.agg.results.group[ai] = [];
						_.each(sorted, function (s, newIndex) {
							self.data.agg.results.group[ai][newIndex] = origGroupAgg[ai][s.oldIndex];
						});
					}
				}

				break;
			case 'horizontal':
				self.data.data = [];

				if (origColVals != null) {
					self.data.colVals = [];
				}

				if (origCellAgg != null) {
					self.data.agg.results.cell = [];
				}

				if (origPivotAgg != null) {
					self.data.agg.results.pivot = [];
				}

				_.each(sorted, function (s, newIndex) {
					self.data.colVals[newIndex] = origColVals[s.oldIndex];
					if (origColVals != null) {
						for (var rvi = 0; rvi < self.data.rowVals.length; rvi += 1) {
							if (self.data.data[rvi] === undefined) {
								self.data.data[rvi] = [];
							}
							self.data.data[rvi][newIndex] = origData[rvi][s.oldIndex];
						}
					}
				});

				if (origCellAgg != null) {
					for (ai = 0; ai < origCellAgg.length; ai += 1) {
						self.data.agg.results.cell[ai] = new Array(self.data.rowVals.length);
						for (rvi = 0; rvi < self.data.rowVals.length; rvi += 1) {
							self.data.agg.results.cell[ai][rvi] = new Array(self.data.colVals.length);
							_.each(sorted, function (s, newIndex) {
								self.data.agg.results.cell[ai][rvi][newIndex] = origCellAgg[ai][rvi][s.oldIndex];
							});
						}
					}
				}

				if (origPivotAgg != null) {
					for (var ai = 0; ai < origPivotAgg.length; ai += 1) {
						self.data.agg.results.pivot[ai] = new Array(self.data.colVals.length);
						_.each(sorted, function (s, newIndex) {
							self.data.agg.results.pivot[ai][newIndex] = origPivotAgg[ai][s.oldIndex];
						});
					}
				}

				break;
			}
		};
	};

	var makeFinishCb = function (postProcess, next) {
		return function (sorted) {
			// Run any function that might've been specified to manipulate the data after the fact.

			if (typeof postProcess === 'function') {
				postProcess(sorted);
			}
			else {
				self.data.data = sorted;
			}

			return next(true);
		};
	};



	var performSort = function (orientation, next) {
		var fti
			, sortSourceFn
			, spec = getProp(self, 'sortSpec', orientation);

		var rvi, cvi;

		if (spec == null) {
			return next(false);
		}

		spec = deepCopy(spec);

		if (self.data.isPlain) {
			if (spec.field) {
				fti = self.typeInfo.get(spec.field);
				sortSourceFn = function (i) {
					return self.data.data[i].rowData[spec.field].value;
				};
			}
		}
		else if (self.data.isGroup) {
			if (spec.groupFieldIndex != null) {
				if (spec.groupFieldIndex < 0 || spec.groupFieldIndex >= self.data.groupFields.length) {
					log.error('Unable to sort: groupFieldIndex out of range {spec = %O, range = [0,%d]}',
										spec, self.data.groupFields.length);
					return next(false);
				}
				fti = self.typeInfo.get(self.data.groupFields[spec.groupFieldIndex]);
				sortSourceFn = function (i) {
					return self.data.rowVals[i][spec.groupFieldIndex];
				};
			}
			else if (spec.aggType === 'group' && spec.aggNum != null) {
				if (spec.aggNum < 0 || spec.aggNum >= aggInfo.group.length) {
					log.error('Unable to sort: aggNum out of range {spec = %O, range = [0,%d]}',
										spec, aggInfo.group.length);
					return next(false);
				}
				fti = aggInfo_type(aggInfo.group[spec.aggNum]);
				sortSourceFn = function (i) {
					return self.data.agg.results.group[spec.aggNum][i];
				};
			}
		}
		else if (self.data.isPivot) {
			if (spec.groupFieldIndex != null) { // #1
				if (spec.groupFieldIndex < 0 || spec.groupFieldIndex >= self.data.groupFields.length) {
					log.error('Unable to sort: groupFieldIndex out of range {spec = %O, range = [0,%d]}',
										spec, self.data.groupFields.length);
					return next(false);
				}
				fti = self.typeInfo.get(self.data.groupFields[spec.groupFieldIndex]);
				sortSourceFn = function (i) {
					return self.data.rowVals[i][spec.groupFieldIndex];
				};
			}
			else if ((spec.rowVal || spec.rowValIndex != null) && spec.aggNum != null) { // #2
				if (spec.rowVal) {
					spec.rowValIndex = -1;
					for (rvi = 0; rvi < self.data.rowVals.length; rvi += 1) {
						if (_.isEqual(self.data.rowVals[rvi], spec.rowVal)) {
							spec.rowValIndex = rvi;
							break;
						}
					}
					if (spec.rowValIndex === -1) {
						log.error('Unable to sort: invalid rowVal {spec = %O}', spec);
						return next(false);
					}
				}
				if (spec.rowValIndex < 0 || spec.rowValIndex >= self.data.rowVals.length) {
					log.error('Unable to sort: rowValIndex out of range {spec = %O, range = [0,%d]}',
										spec, self.data.rowVals.length);
					return next(false);
				}
				if (spec.aggNum < 0 || spec.aggNum >= aggInfo.cell.length) {
					log.error('Unable to sort: aggNum out of range {spec = %O, range = [0,%d]}',
										spec, aggInfo.cells.length);
					return next(false);
				}
				fti = aggInfo_type(aggInfo.cell[spec.aggNum]);
				sortSourceFn = function (i) {
					return self.data.agg.results.cell[spec.aggNum][spec.rowValIndex][i];
				};
			}
			else if (spec.pivotFieldIndex != null) { // #3
				if (spec.pivotFieldIndex < 0 || spec.pivotFieldIndex >= self.data.pivotFields.length) {
					log.error('Unable to sort: pivotFieldIndex out of range {spec = %O, range = [0,%d]}',
										spec, self.data.pivotFields.length);
					return next(false);
				}
				fti = self.typeInfo.get(self.data.pivotFields[spec.pivotFieldIndex]);
				sortSourceFn = function (i) {
					return self.data.rowVals[i][spec.pivotFieldIndex];
				};
			}
			else if ((spec.colVal || spec.colValIndex != null) && spec.aggNum != null) { // #4
				if (spec.colVal) {
					spec.colValIndex = -1;
					for (cvi = 0; cvi < self.data.colVals.length; cvi += 1) {
						if (_.isEqual(self.data.colVals[cvi], spec.colVal)) {
							spec.colValIndex = cvi;
							break;
						}
					}
					if (spec.colValIndex === -1) {
						log.error('Unable to sort: invalid colVal {spec = %O}', spec);
						return next(false);
					}
				}
				if (spec.colValIndex < 0 || spec.colValIndex >= self.data.colVals.length) {
					log.error('Unable to sort: colValIndex out of range {spec = %O, range = [0,%d]}',
										spec, self.data.colVals.length);
					return next(false);
				}
				if (spec.aggNum < 0 || spec.aggNum >= aggInfo.cell.length) {
					log.error('Unable to sort: aggNum out of range {spec = %O, range = [0,%d]}',
										spec, aggInfo.cell.length);
					return next(false);
				}
				fti = aggInfo_type(aggInfo.cell[spec.aggNum]);
				sortSourceFn = function (i) {
					return self.data.agg.results.cell[spec.aggNum][i][spec.colValIndex];
				};
			}
			else if (spec.aggType === 'pivot' && spec.aggNum != null) { // #5
				if (spec.aggNum < 0 || spec.aggNum >= aggInfo.pivot.length) {
					log.error('Unable to sort: aggNum out of range {spec = %O, range = [0,%d]}',
										spec, aggInfo.pivot.length);
					return next(false);
				}
				fti = aggInfo_type(aggInfo.pivot[spec.aggNum]);
				sortSourceFn = function (i) {
					return self.data.agg.results.pivot[spec.aggNum][i];
				};
			}
			else if (spec.aggType === 'group' && spec.aggNum != null) { // #6
				if (spec.aggNum < 0 || spec.aggNum >= aggInfo.group.length) {
					log.error('Unable to sort: aggNum out of range {spec = %O, range = [0,%d]}',
										spec, aggInfo.group.length);
					return next(false);
				}
				fti = aggInfo_type(aggInfo.group[spec.aggNum]);
				sortSourceFn = function (i) {
					return self.data.agg.results.group[spec.aggNum][i];
				};
			}
			else {
				log.error('Invalid sort spec for pivotted data: ' + JSON.stringify(spec));
				return next(false);
			}
		}

		//console.log(self.typeInfo.asMap());
		//console.log(self.data.agg);

		var cmp = determineCmp(spec, fti);
		if (cmp == null) {
			return next(false);
		}

		var bundle = packBundle(spec, orientation, sortSourceFn);
		if (bundle == null) {
			return next(false);
		}

		//console.log(fti);
		//console.log(cmp);
		//console.log(bundle);

		var comparison = function (a, b) {
			return !!(cmp(a.sortSource, b.sortSource) ^ (spec.dir === 'DESC'));
		};

		var finish = makeFinishCb(unpackBundle(orientation), next);

		return mergeSort4(bundle, comparison, finish, self.sortProgress && self.sortProgress.update);
	};



	self.fire(View.events.sortBegin);
	self.timing.start(timingEvt);

	if (self.sortProgress
			&& typeof self.sortProgress.begin === 'function') {
		self.sortProgress.begin();
	}

	performSort('horizontal', function (didHorizontal) {
		performSort('vertical', function (didVertical) {
			if (self.sortProgress
					&& typeof self.sortProgress.end === 'function') {
				self.sortProgress.end();
			}

			self.timing.stop(timingEvt);
			self.fire(View.events.sortEnd);

			return cont(didHorizontal || didVertical);
		});
	});
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

View.prototype.setFilter = function (spec, progress, opts) {
	var self = this
		, args = Array.prototype.slice.call(arguments)
		, opts = deepCopy(opts) || {};

	_.defaults(opts, {
		notify: false,
		update: true
	});

	if (self.lock.isLocked()) {
		return self.lock.onUnlock(function () {
			self.setFilter.apply(self, args);
		}, 'Waiting to set filter: ' + JSON.stringify(spec));
	}

	debug.info('VIEW (' + self.name + ') // SET FILTER', 'spec = %O ; options = %O', spec, opts);

	if (!isNothing(self.filterSpec) && isNothing(spec)) {
		self.wasPreviouslyFiltered = true;
	}

	if (spec != null) {
		if (self.typeInfo == null) {
			return self.getTypeInfo(function () {
				self.setFilter.apply(self, args);
			});
		}

		_.each(spec, function (fieldSpec, field) {
			if (self.typeInfo.get(field) == null) {
				log.error('Ignoring filter on field "' + field + '" because it doesn\'t exist in the data');
				delete spec[field];
			}
		});
	}

	self.filterSpec = spec;
	self.filterProgress = progress;

	if (opts.notify) {
		self.fire(View.events.filterSet, {
			notTo: opts.dontTell
		}, spec);
	}

	if (opts.update) {
		self.clearCache();
		self.getData();
	}

	return true;
};

// #getFilter {{{2

View.prototype.getFilter = function () {
	var self = this;

	return self.filterSpec;
};

// #clearFilter {{{2

/**
 * Clear the spec used to filter this view.
 */

View.prototype.clearFilter = function (opts) {
	this.setFilter(null, null, opts);
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

	if (isNothing(self.filterSpec)) {
		if (!self.wasPreviouslyFiltered) {
			return cont(false, self.data.data);
		}
		else {
			self.wasPreviouslyFiltered = false;
		}
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
			debug.info('VIEW (' + self.name + ') // FILTER',
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

		self.fire(View.events.filter, {
			silent: true
		}, row.rowNum, !passes);

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
	}, i_step = self.filterProgress ? 100 : self.data.data.length;
	var newData = [];

	var doFilter = function () {
		//debug.info('VIEW (' + self.name + ') // FILTER',
		//					 'Filtering rows ' + i0.val + ' through ' + (i0.val + i_step));

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

View.prototype.setGroup = function (spec, noUpdate, dontTell) {
	var self = this
		, args = Array.prototype.slice.call(arguments);

	if (self.lock.isLocked()) {
		return self.lock.onUnlock(function () {
			self.setGroup.apply(self, args);
		}, 'Waiting to set group: ' + JSON.stringify(spec));
	}

	debug.info('VIEW (' + self.name + ') // SET GROUP', 'spec = %O', spec);

	if (isNothing(spec) && !isNothing(self.pivotSpec)) {
		log.warn('VIEW (' + self.name + ') // SET GROUP', 'Having a pivot without a group is not allowed');
		self.clearPivot(true);
	}

	if (spec != null) {
		// Make sure we have typeInfo so we can perform the next check.

		if (self.typeInfo == null) {
			return self.getTypeInfo(function () {
				self.setFilter.apply(self, args);
			});
		}

		// Remove any fields that don't exist in the data (according to typeInfo).

		spec.fieldNames = _.filter(spec.fieldNames, function (field) {
			if (self.typeInfo.get(field) == null) {
				log.error('Ignoring group on field "' + field + '" because it doesn\'t exist in the data');
				return false;
			}
			return true;
		});

		// Don't do anything if we're not grouping by any fields.

		if (spec.fieldNames.length === 0) {
			return false;
		}
	}

	self.groupSpec = spec;

	self.fire(View.events.groupSet, {
		notTo: dontTell
	}, spec);

	if (noUpdate) {
		return true;
	}

	self.clearCache();
	self.getData();

	return true;
};

// #getGroup {{{2

View.prototype.getGroup = function () {
	var self = this;

	return self.groupSpec;
};

// #clearGroup {{{2

/**
 * Remove any grouping that had been set.
 */

View.prototype.clearGroup = function (noUpdate, dontTell) {
	return this.setGroup(null, noUpdate, dontTell);
};

// #group {{{2

/**
 * Perform grouping on the data.  This modifies the data in place; it's not asynchronous and there's
 * no return value.
 */

View.prototype.group = function () {
	var self = this;

	if (isNothing(self.groupSpec)) {
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

	var metadata = {};

	var tree = (function RECUR(fieldNames, data, metadata) {
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

		_.each(tmp, function (groupedRows, value) {
			metadata[value] = {
				_count: groupedRows.length
			};
			if (fieldNames.length > 1) {
				tmp[value] = RECUR(cdr(fieldNames), groupedRows, metadata[value]);
			};
			metadata[value]._children = _.keys(tmp[value]).length;
		});

		return tmp;
	})(self.groupSpec.fieldNames, self.data.data, metadata);

	debug.info('VIEW (' + self.name + ') // GROUP', 'Tree Form: %O', tree);
	debug.info('VIEW (' + self.name + ') // GROUP', 'Metadata: %O', metadata);

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
	self.data.groupMetadata = metadata;
	self.data.rowVals = rowVals;
	self.data.data = newData;

	return true;
};

// #setPivot {{{2

View.prototype.setPivot = function (spec, noUpdate, dontTell) {
	var self = this
		, args = Array.prototype.slice.call(arguments);

	if (self.lock.isLocked()) {
		return self.lock.onUnlock(function () {
			self.setPivot.apply(self, args);
		}, 'Waiting to set pivot: ' + JSON.stringify(spec));
	}

	debug.info('VIEW (' + self.name + ') // SET PIVOT', 'spec = %O', spec);

	if (isNothing(self.groupSpec) && !isNothing(spec)) {
		log.warn('VIEW (' + self.name + ') // SET PIVOT', 'Having a pivot without a group is not allowed');
		self.clearPivot(noUpdate, dontTell);
	}

	if (spec != null) {
		// Make sure we have typeInfo so we can perform the next check.

		if (self.typeInfo == null) {
			return self.getTypeInfo(function () {
				self.setFilter.apply(self, args);
			});
		}

		// Remove any fields that don't exist in the data (according to typeInfo).

		spec.fieldNames = _.filter(spec.fieldNames, function (field) {
			if (self.typeInfo.get(field) == null) {
				log.error('Ignoring pivot on field "' + field + '" because it doesn\'t exist in the data');
				return false;
			}
			return true;
		});

		// Don't do anything if we're not grouping by any fields.

		if (spec.fieldNames.length === 0) {
			return false;
		}
	}

	self.pivotSpec = spec;

	self.fire(View.events.pivotSet, {
		notTo: dontTell
	}, spec);

	if (noUpdate) {
		return true;
	}

	self.clearCache();
	self.getData();

	return true;
};

// #getPivot {{{2

View.prototype.getPivot = function () {
	var self = this;

	return self.pivotSpec;
};

// #clearPivot {{{2

View.prototype.clearPivot = function (noUpdate, dontTell) {
	return this.setPivot(null, noUpdate, dontTell);
};

// #pivot {{{2

View.prototype.pivot = function () {
	var self = this
		, pivotFields // Array of field names to pivot by.
		, colValsTree // Tree of all possible column value combinations.
		, colVals     // Array of all possible column value combinations.
	;

	// FIXME Allow pivot without group.

	if (!self.data.isGroup) {
		return false;
	}

	var buildColValsTree = function (pivotFields) {
		var colValsTree = {};

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

		return colValsTree;
	};

	var buildColVals = function (colValsTree) {
		var colVals = [];

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

		return colVals;
	};

	var buildData = function (data) {
		var result = [];

		_.each(data, function (groupedRows, groupNum) {
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
			result.push(newData);
		});

		return result;
	};

	if (!isNothing(self.pivotSpec)) {
		pivotFields = self.pivotSpec.fieldNames;
		colValsTree = buildColValsTree(pivotFields);
		colVals = buildColVals(colValsTree);
		self.data.data = buildData(self.data.data, colVals);
	}
	else if (self.data.isGroup && self.opts.groupIsPivot) {
		pivotFields = [];
		colValsTree = {};
		colVals = [];
		_.each(self.data.data, function (group, groupNum) {
			self.data.data[groupNum] = [group];
		});
	}
	else {
		return false;
	}

	debug.info('VIEW (' + self.name + ') // PIVOT', 'Col Vals Tree: %O', colValsTree);
	debug.info('VIEW (' + self.name + ') // PIVOT', 'Col Vals: %O', colVals);
	debug.info('VIEW (' + self.name + ') // PIVOT', 'New Data: %O', self.data);

	self.data.isPlain = false;
	self.data.isGroup = false;
	self.data.isPivot = true;
	self.data.pivotFields = pivotFields;
	self.data.colVals = colVals;

	return true;
};

// #setAggregate {{{2

View.prototype.setAggregate = function (spec, opts) {
	var self = this
		, args = Array.prototype.slice.call(arguments);

	opts = opts || {};
	_.defaults(opts, {
		sendEvent: true,
		dontSendEventTo: [],
		updateData: true
	});

	if (self.lock.isLocked()) {
		self.lock.onUnlock(function () {
			self.setAggregate.apply(self, args);
		}, 'Waiting to set aggregate: ' + JSON.stringify(spec));
		return false;
	}

	debug.info('VIEW (' + self.name + ') // SET AGGREGATE', 'spec = %O ; options = %O', spec, opts);

	if (spec == null) {
		self.aggregateSpec = {};
	}
	else {
		if (!self.aggregateSpec) {
			self.aggregateSpec = {};
		}

		// Make sure we have typeInfo so we can perform the next check.

		/*
		if (self.typeInfo == null) {
			return self.getTypeInfo(function () {
				self.setFilter.apply(self, args);
			});
		}
		*/

		// Remove any fields that don't exist in the data (according to typeInfo).

		_.each(spec, function (aggSpec, aggType) {
			aggSpec = _.filter(aggSpec, function(agg) {
				var a = AGGREGATE_REGISTRY.get(agg.fun);
				if (a == null) {
					log.error('Ignoring aggregate "' + agg.fun + '" because no such aggregate function exists');
					return false;
				}
				/*
				if (a.prototype.fieldCount > 0) {
					if (agg.fields == null) {
						log.error('Ignoring aggregate "' + agg.fun + '" because no fields have been specified');
						return false;
					}
					if (agg.fields.length < a.prototype.fieldCount) {
						log.error('Ignoring aggregate "' + agg.fun + '" because there aren\'t enough fields');
						return false;
					}
					for (var i = 0; i < agg.fields.length; i += 1) {
						if (self.typeInfo.get(agg.fields[i]) == null) {
							log.error('Ignoring aggregate "' + agg.fun + '" because field "' + agg.fields[i] + '" doesn\'t exist in the data');
							return false;
						}
					}
				}
				*/
				return true;
			});
			spec[aggType] = aggSpec;
		});

		_.extend(self.aggregateSpec, spec);
	}

	if (opts.sendEvent) {
		self.fire(View.events.aggregateSet, {
			notTo: opts.dontSendEventTo
		}, spec);
	}

	if (!opts.updateData) {
		return true;
	}

	self.clearCache();
	self.getData();

	return true;
};

// #getAggregate {{{2

View.prototype.getAggregate = function () {
	var self = this;

	return self.aggregateSpec;
};

// #clearAggregate {{{2

View.prototype.clearAggregate = function (opts) {
	var self = this;

	return self.setAggregate(null, opts);
};

// #aggregate {{{2

View.prototype.aggregate = function (cont) {
	var self = this;

	if (typeof cont !== 'function') {
		throw new Error('Call Error: `cont` must be a function');
	}

	if (!(self.aggregateSpec && (self.data.isGroup || self.data.isPivot))) {
		return cont(false);
	}

	_.each(['group', 'pivot', 'cell', 'all'], function (what) {
		debug.info('VIEW // AGGREGATE', 'Computing %s aggregate functions: %s',
							 what,
							 _.pluck(getProp(self, 'aggregateSpec', what), 'fun').join(', '));
	});

	// Data structures for storing aggregate function results.

	var groupResults = []; // groupResults[i][n] -> agg over rows w/ rowval[n]
	var pivotResults = []; // pivotResults[i][m] -> agg over columns w/ colval[m]
	var cellResults = []; // cellResults[i][n][m] -> agg over cells w/ rowval[n] -AND- colval[m]
	var allResults = []; // allResults[i] -> agg over all cells

	var info = {
		group: [],
		pivot: [],
		cell: [],
		all: []
	};

	// Initialize the informational data structures.

	_.each(['group', 'pivot', 'cell', 'all'], function (what) {
		_.each(self.aggregateSpec[what], function (spec, aggNum) {
			if (AGGREGATE_REGISTRY.get(spec.fun) == null) {
				throw new Error('No such aggregate function: "' + spec.fun + '"' +
					(spec.name ? ' (output name = "' + spec.name + '")' : ''));
			}

			info[what][aggNum] = {
				name: spec.name,
				fields: [],
				colConfig: [],
				typeInfo: []
			};

			var ctorOpts = {};

			if (spec.fields) {
				info[what][aggNum].fields = spec.fields;
				info[what][aggNum].colConfig = _.map(spec.fields, function (f) {
					return self.colConfig[f];
				});
				info[what][aggNum].typeInfo = _.map(spec.fields, function (f) {
					return self.typeInfo.get(f);
				});

				// Perform type decoding if needed, before we calculate the aggregate results.  This is
				// needed when doing aggregates like "values" and "distinct values" to make sure they're
				// formatted right by the aggregate function itself.

				_.each(info[what][aggNum].typeInfo, function (fti) {
					if (fti.needsDecoding) {
						if (!fti.field) {
							log.error('Unable to sort: cannot decode unknown field {typeInfo = %O}', fti);
							return;
						}

						debug.info('VIEW (' + self.name + ') // AGGREGATE', 'Decoding data {typeInfo = %O}', fti);

						if (self.data.isPlain) {
							self.source.convertAll(self.data.data, fti.field);
						}
						else {
							_.each(self.data.data, function (groupedRows) {
								if (self.data.isGroup) {
									self.source.convertAll(groupedRows, fti.field);
								}
								else {
									_.each(groupedRows, function (pivottedRows) {
										self.source.convertAll(pivottedRows, fti.field);
									});
								}
							});
						}

						fti.deferDecoding = false;
						fti.needsDecoding = false;
					}
				});

				ctorOpts.fields = info[what][aggNum].fields;
				ctorOpts.colConfig = info[what][aggNum].colConfig;
				ctorOpts.typeInfo = info[what][aggNum].typeInfo;
			}

			info[what][aggNum].instance = new (AGGREGATE_REGISTRY.get(spec.fun))(ctorOpts);
		});
	});

	_.each(self.data.rowVals, function (rowVal, rowValIdx) {
		_.each(self.aggregateSpec.group, function (spec, aggNum) {
			if (groupResults[aggNum] === undefined) {
				groupResults[aggNum] = [];
			}
			var aggResult = info.group[aggNum].instance.calculate(_.flatten(self.data.data[rowValIdx]));
			groupResults[aggNum][rowValIdx] = aggResult;
			debug.info('VIEW // AGGREGATE', 'Group aggregate [%d] (%s) : Group [%s] = %O',
				aggNum,
				info.group[aggNum].instance.name + (info.group[aggNum].name ? ' -> ' + info.group[aggNum].name : ''),
				rowVal.join(', '),
				aggResult);
		});

		if (self.data.isPivot) {
			_.each(self.aggregateSpec.cell, function (spec, aggNum) {
				if (cellResults[aggNum] === undefined) {
					cellResults[aggNum] = [];
				}
				cellResults[aggNum][rowValIdx] = [];

				_.each(self.data.colVals, function (colVal, colValIdx) {
					var aggResult = info.cell[aggNum].instance.calculate(self.data.data[rowValIdx][colValIdx]);

					debug.info('VIEW // AGGREGATE', 'Pivot aggregate [%d] (%s) : Cell [%s ; %s] = %O',
						aggNum,
						info.cell[aggNum].instance.name + (info.cell[aggNum].name ? ' -> ' + info.cell[aggNum].name : ''),
						rowVal.join(', '),
						colVal.join(', '),
						aggResult);

					cellResults[aggNum][rowValIdx][colValIdx] = aggResult;
				});
			});
		}
	});

	if (self.data.isPivot && self.aggregateSpec.pivot) {
		_.each(self.aggregateSpec.pivot, function (spec, aggNum) {
			pivotResults[aggNum] = [];

			_.each(self.data.colVals, function (colVal, colValIdx) {
				var aggResult = info.pivot[aggNum].instance.calculate(_.flatten(_.pluck(self.data.data, colValIdx)));
				pivotResults[aggNum][colValIdx] = aggResult;
				debug.info('VIEW // AGGREGATE', 'Pivot aggregate [%d] (%s) : Col Val [%s] = %O',
					aggNum,
					info.pivot[aggNum].instance.name + (info.pivot[aggNum].name ? ' -> ' + info.pivot[aggNum].name : ''),
					colVal.join(', '),
					aggResult);
			});
		});
	}

	if (self.data.isPivot && self.aggregateSpec.all) {
		_.each(self.aggregateSpec.all, function (spec, aggNum) {
			var aggResult = info.all[aggNum].instance.calculate(_.flatten(self.data.data));
			debug.info('VIEW // AGGREGATE', 'All aggregate [%d] (%s) = %O',
				aggNum,
				info.all[aggNum].instance.name + (info.all[aggNum].name ? ' -> ' + info.all[aggNum].name : ''),
				aggResult);
			allResults[aggNum] = aggResult;
		});
	}

	self.data.agg = {
		info: info,
		results: {
			group: groupResults,
			pivot: pivotResults,
			cell: cellResults,
			all: allResults
		}
	};

	cont(true);
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
		return self.getTypeInfo(function (typeInfo) {
			self.typeInfo = typeInfo;

			if (self.opts.saveViewConfig && !self.prefsLoaded) {
				return self.prefs.load(function () {
					self.prefsLoaded = true;
					self.lock.unlock();
					self.getData(cont);
				});
			}

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
				data: [],
				dataByRowId: []
			};

			_.each(data, function (rowData, rowNum) {
				self.data.data.push({
					rowNum: rowNum,
					rowData: rowData
				});
				self.data.dataByRowId[rowNum] = rowData;
			});

			return self.filter(function (didFilter, filteredData) {
				ops.filter = didFilter;
				self.data.data = filteredData;
				ops.group = self.group();
				ops.pivot = self.pivot();
				return self.aggregate(function () {
					return self.sort(function (didSort) {
						ops.sort = didSort;

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

						if (self.opts.saveViewConfig) {
							self.prefs.save();
						}

						self.lastOps = ops;
						self.fire(View.events.workEnd, null, workEndObj, ops);

						self.lock.unlock();
						debug.info('VIEW (' + self.name + ')', 'Got new data: %O', self.data);
						if (typeof cont === 'function') {
							return cont(self.data);
						}
					});
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

	self.fire(View.events.getTypeInfo, null, self.typeInfo);

	if (typeof cont === 'function') {
		return cont(self.typeInfo);
	}
};

// #clearCache {{{2

View.prototype.clearCache = function () {
	var self = this;

	self.data = undefined;
	self.typeInfo = undefined;

	debug.info('VIEW (' + self.name + ')', 'Cleared cache');
};

// #reset {{{2

/**
 * Reset the view to reflect the data with no transformations.  This calls all the individual
 * "clear" functions, but doesn't notify consumers that there's been work done until the end.
 */

View.prototype.reset = function (noUpdate) {
	var self = this;

	self.clearSort(true, true);
	self.clearFilter({ update: false });
	self.clearGroup(true, true);
	self.clearPivot(true, true);
	self.clearAggregate({
		sendEvent: false,
		updateData: false
	});

	if (noUpdate) {
		delete self.lastOps;
		return;
	}

	self.getData();
};

// #getUniqueVals {{{2

View.prototype.getUniqueVals = function (cont) {
	var self = this;

	return self.source.getUniqueVals(cont);
};

// #getLastOps {{{2

View.prototype.getLastOps = function () {
	var self = this;

	return self.lastOps;
};

// Utilities {{{1

function aggInfo_type(aggInfo) {
	var aggType;
	
	// Set the type of the aggregate result.  Sometimes this is fixed (e.g. count is always a number).
	// If that's the case, it's given by the Aggregate instance itself.

	aggType = aggInfo.instance.type;

	// When the Aggregate instance doesn't specify, then it's considered to be the type of the field
	// (e.g. min, max, first, last all just reuse a value so the type of the aggregate function is
	// just whatever the type of the value is).  Since we now support multiple fields, this logic only
	// works when there's only one field.
	//
	// XXX Should we fix this?  Maybe allow it if all fields have the same type?
	
	if (aggType == null && aggInfo.fields.length === 1) {
		aggType = aggInfo.instance.opts.typeInfo[0].type;
	}

	// Default to a string type.
	
	if (aggType == null) {
		aggType = 'string';
	}

	return aggType;
}
