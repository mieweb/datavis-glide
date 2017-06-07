// Determine Columns {{{1

/**
 * Determine which columns should be shown in plain or grouped output, based on information from
 * several sources.
 *
 * If the user has set `defn.table.columns`, then it will be used to figure out what fields are to
 * be shown.  Otherwise, the fields come from the source's type info, and fields starting with an
 * underscore are omitted.
 *
 * @todo What do we do when the data has been pivotted?
 *
 * @param {Grid~Defn} defn
 *
 * @param {array} data
 *
 * @param {Source~TypeInfo} typeInfo
 *
 * @returns {Array.<string>} An array of the names of the fields that should constitute the columns
 * in the output.  This is not necessarily the same as the headers to be shown in the output.
 */

function determineColumns(defn, data, typeInfo) {
	var columns = [];

	// Error checking for `defn.table.columns` to make sure it:
	//
	//   1. Has the correct format.
	//   2. Only defines fields which actually exist.

	if (defn.table.columns !== undefined) {
		if (!_.isArray(defn.table.columns)) {
			throw new GridTableError('Determine Columns / (table.columns) must be an array');
		}

		_.each(defn.table.columns, function (elt, i) {
			if (elt.field === undefined) {
				throw new GridTableError('Determine Columns / Missing (table.columns[' + i + '].field)');
			}
		});

		if ((data.isPlain && data.data.length === 0)
				|| (data.isGroup && (data.data.length === 0 || data.data[0].length === 0))) {
			log.warn('Unable to check column configuration using data with no rows');
			return;
		}

		_.each(defn.table.columns, function (elt, i) {
			if ((data.isPlain && data.data[0].rowData[elt.field] === undefined)
					|| (data.isGroup && data.data[0][0].rowData[elt.field] === undefined)) {
				log.warn('Column configuration refers to field "' + elt.field + '" which does not exist in the data');
			}
		});
	}

	if (defn.table.columns) {
		columns = _.pluck(defn.table.columns, 'field');
	}
	else {
		columns = _.reject(typeInfo.keys(), function (field) {
			return field.charAt(0) === '_';
		});
	}

	debug.info('DETERMINE COLUMNS', 'Columns = %O', columns);

	return columns;
};

// Server-Side Filter/Sort {{{1

/*
 * Here's the list of filter conditions supported by jQWidgets:
 *
 *   - NULL
 *   - NOT_NULL
 *   - EQUAL
 *
 * These only apply to strings:
 *
 *   - EMPTY
 *   - NOT_EMPTY
 *   - CONTAINS
 *   - CONTAINS_CASE_SENSITIVE
 *   - DOES_NOT_CONTAIN
 *   - DOES_NOT_CONTAIN_CASE_SENSITIVE
 *   - STARTS_WITH
 *   - STARTS_WITH_CASE_SENSITIVE
 *   - ENDS_WITH
 *   - ENDS_WITH_CASE_SENSITIVE
 *   - EQUAL_CASE_SENSITIVE
 *
 * These only apply to numbers and dates:
 *
 *   - NOT_EQUAL
 *   - LESS_THAN
 *   - LESS_THAN_OR_EQUAL
 *   - GREATER_THAN
 *   - GREATER_THAN_OR_EQUAL
 *
 * I find it weird that strings can't be NOT_EQUAL, but I'm just going by what their documentation
 * says they do.
 */

function makeJsonHaving(filters) {
	var having = {};
	var numClauses = 0;
	_.each(filters, function (f) {
		var h = having[f.datafield] = {};
		var numItems = 0;
		_.each(f.filter.getfilters(), function (filter) {
			var isSupported = true;
			switch (filter.condition) {
				case 'EQUAL':
				case 'EQUAL_CASE_SENSITIVE':
					if (h['$eq']) {
						h['$in'] = [h['$eq']];
						delete h['$eq'];
					}
					if (h['$in']) {
						h['$in'].push(filter.value);
					}
					else {
						h['$eq'] = filter.value;
					}
					break;
				case 'CONTAINS':
				case 'CONTAINS_CASE_SENSITIVE':
					h['$like'] = '%' + filter.value + '%';
					break;
				case 'EMPTY':
					h['$eq'] = '';
					break;
				case 'NOT_EMPTY':
					h['$ne'] = '';
					break;
				default:
					log.error('Unsupported filter condition "' + filter.condition + '" for type "' + filter.type + '"');
					isSupported = false;
			}
			if (isSupported) {
				numItems += 1;
			}
		});
		if (numItems > 0) {
			numClauses += 1;
		}
		else {
			delete having[f.datafield];
		}
	});
	return numClauses > 0 ? having : null;
}

/**
 * Make a JSON ORDER BY object based on sort information from jQWidgets.
 *
 * @param {object} o A description of the sort from a jqxGrid.
 *
 * @return {object} A description of the sort that can be used by the system report code.
 */

function makeJsonOrderBy(o) {
	if (o.sortcolumn === null) {
		return null;
	}
	return [{
		column: o.sortcolumn,
		direction: o.sortdirection.ascending ? 'ASC' : 'DESC'
	}];
}

/**
 * Change the data in the definition without breaking any references.  This is only used by
 * dynamic server-side filtering.
 */

function updateDefnDataInPlace(defn, srcIndex, data) {
	var i;
	var l;

	/*
	 * We need to change the data that the grid uses.  You would think that one would do this using
	 * the data adapter, but there's no API to change the local data.  So instead we have to change
	 * the object that it refers to out from underneath it.  This means that we must alter the
	 * defn._data[srcIndex] object in place.  To clear it out, we shift() all the current rows out
	 * of it.  Then we can push() the new rows into it.  This changes the data in the array without
	 * breaking the reference from the data adapter.
	 */

	l = defn._data[srcIndex].length;

	for (i = 0; i < l; i += 1) {
		defn._data[srcIndex].shift();
	}

	for (i = 0; i < data[srcIndex].length; i += 1) {
		defn._data[srcIndex].push(data[srcIndex][i]);
	}

	if (data[srcIndex].length > 0) {
		_.each(data[srcIndex][0], function (value, colName) {
			var sqlType = defn._typeInfo[srcIndex][colName];
			if (sqlType === 'string') {
				// This will do the work necessary to create the _ORIG_ properties.
				makeLinkConfig(data[srcIndex], colName, defn._dataFieldConfig);
			}
		});
	}
}

// Row Reordering {{{1

function rowSwapIndex(defn, oldIndex, newIndex) {
	if (defn.source instanceof Source) {
		defn.source.swapRows(oldIndex, newIndex);
	}
	else {
		throw new NotImplementedError('Using a Source is required to reorder rows');
	}
}

function helperClone(e, tr) {
	var originals = tr.children();
	clonedRow = tr.clone(),
		start_idx = tr.index(),
		all_rows = tr.parent().children(),
		all_select = tr.find('select');

	// first set the size of the row that was cloned (clonedRow).
	// This keeps the table rows shape.
	clonedRow.children().each(function(index, val) {
		jQuery(val).width(originals.eq(index).width());
		//_.each(['box-sizing'], function (cssProp) {
		//	jQuery(val).css(cssProp, originals.eq(index).css(cssProp));
		//});
	});
	// second set the 'selected' value of any selects
	// found during the clone.  Seems jquery has a
	// bug that will not be fixed.
	clonedRow.find('select').val(function(index) {
		return all_select.eq(index).val();
	});
	// third lets place a temp class on all the rows
	// to keep the zerba striping, during the drag
	for (var i = start_idx+1; i < all_rows.length; i++) {
		if ((i % 2) == 0) {
			// this row should really be even but because
			// the clonedRow is hidden we need to make it
			// odd to avoid the 'shifting of colors in the zebra'
			jQuery(all_rows[i]).addClass('odd');
		} else {
			jQuery(all_rows[i]).addClass('even');
		}
	}
	// lastly put the correct zebra strip on the cloned row
	// that gets dragged around
	if ((start_idx % 2) == 0) {
		clonedRow.addClass('odd');
	} else {
		clonedRow.addClass('even');
	}
	return clonedRow;
}

function configureRowReordering(defn, tbody) {
	tbody.sortable({
		forcePlaceholderSize: true,
		placeholder: 'sortable-ghost',
		axis: 'y',
		cancel: 'input,textarea,select,option',
		helper: helperClone,
		handle: '.drag-handle',
		containment: '#' + defn.table.id,
		// This event is triggered when sorting starts.
		start: function(event, ui) {
			// set the height of the placeholder row on start
			ui.placeholder.height(ui.helper.height());
			ui.item.data('originIndex', ui.item.index());
		},
		// This event is triggered when sorting has stopped.
		stop: function(event, ui) {
			var oldIndex = ui.item.data('originIndex'),
				newIndex = ui.item.index();
			// the drag has stopped so remove the classes that 'override'
			// the even/odd strips
			ui.item.parent().children().removeClass('even odd');

			if ( (typeof oldIndex !== 'undefined') &&
				(typeof newIndex !== 'undefined') &&
				(oldIndex !== newIndex) ) {
				// swap the rows in our internal data structure
				rowSwapIndex(defn, oldIndex, newIndex);
			} else {
				// strange some bad data so just call the 'cancel' method
				jQuery(this).sortable('cancel');
			}
		}
	});
}

// Row Selection {{{1

function rowSelect_checkAll(evt, elt) {
	elt.tbl.parents('div.tabletool').find('input[name="checkAll"]').prop('checked', this.checked);
	elt.tbody
		.find('input[type="checkbox"]:visible')
		.prop('checked', this.checked)
		.trigger('change');
}


// GridError {{{1

/**
 * @class
 *
 * @property {string} name
 * @property {object} stack
 * @property {string} message
 */

var GridError = function (msg) {
	this.name = 'GridError';
	this.stack = (new Error()).stack;
	this.message = msg;
}

GridError.prototype = Object.create(Error.prototype);
GridError.prototype.constructor = GridError;


// GridTable {{{1

// Constructor {{{2

/**
 * The GridTable is in charge of displaying the HTML table of data.
 *
 * @param {object} defn
 *
 * @param {Grid~Features} features
 *
 * @param {Timing} timing
 *
 * @class
 *
 * @property {Grid~Features} features
 *
 * @property {object} defn
 *
 * @property {View} view
 *
 * @property {Element} container
 *
 * @property {object} colConfig Map associating field name with the configuration of the
 * corresponding column in this grid table.
 *
 * @property {Timing} timing
 *
 * @property {boolean} needsRedraw True if the grid needs to redraw itself when the view is done
 * working.
 */

var GridTable = function (defn, view, features, timing) {
	var self = this;

	self.defn = defn;
	self.view = view;
	self.features = features;
	self.timing = timing;

	self.needsRedraw = false;

	self.validateLimit();

	self.colConfig = {};

	_.each(self.defn.table.columns, function (col) {
		self.colConfig[col.field] = col;
	});
};

GridTable.prototype = Object.create(Object.prototype);
GridTable.prototype.constructor = GridTable;

// #validateLimit {{{2

/**
 * Make sure the limit configuration is good.  If there's anything wrong, the limit feature is
 * disabled automatically.
 */

GridTable.prototype.validateLimit = function () {
	var self = this;

	if (self.features.limit) {
		if (self.defn.table.limit.threshold === undefined) {
			debug.info('GRID TABLE // DRAW', 'Disabling limit feature because no limit threshold was provided');
			self.features.limit = false;
		}
	}
};

// #clear {{{2

/**
 * Remove the table from page.
 */

GridTable.prototype.clear = function () {
	var self = this;

	self.container.children().remove();
};

// #draw {{{2

/**
 * Render the table within the page.
 *
 * @param {jQuery} container An element to append the result to.
 *
 * @param {function} tableDone A function to call once the table has been added to the page.  Useful
 * if you want to do something like select some rows after it has been created.
 *
 * @returns {undefined} Nothing.  This function is asynchronous, as rendering the table may require
 * obtaining data from the source.
 */

GridTable.prototype.draw = function (container, tableDone) {
	var self = this;

	self.container = container;

	return self.view.getData(function (data) {
		return self.view.getTypeInfo(function (typeInfo) {
			self.timing.start(['Grid Table', 'Draw']);

			debug.info('GRID TABLE // DRAW', 'Data = %O', data);
			debug.info('GRID TABLE // DRAW', 'TypeInfo = %O', typeInfo);

			var tr
				, srcIndex = 0;

			self.ui = {
				tbl: jQuery('<table>'),
				thead: jQuery('<thead>'),
				tbody: jQuery('<tbody>'),
				tfoot: jQuery('<tfoot>'),
				thMap: {},
				tr: []
			};

			/*
			 * Determine what columns will be in the table.  This comes from the user, or from the data
			 * itself.  We may then add columns for extra features (like row selection or reordering).
			 */

			var columns = determineColumns(self.defn, data, typeInfo)
				, numCols = columns.length;

			if (self.features.rowSelect) {
				numCols += 1; // Add a column for the row selection checkbox.
			}

			if (self.features.rowReorder) {
				numCols += 1; // Add a column for the reordering button.
			}

			self.draw_header(columns, data, typeInfo);

			if (self.features.footer) {
				self.draw_footer(columns, data, typeInfo);
			}

			/*
			 * Draw the body.
			 */

			self.draw_body(data, typeInfo, columns, function () {
				if (getProp(self.defn, 'table', 'incremental', 'appendBodyLast')) {
					self.ui.tbl.append(self.ui.tbody);
				}

				self.timing.stop(['Grid Table', 'Draw']);

				if (typeof tableDone === 'function') {
					window.setTimeout(function () {
						tableDone();
					});
				}
			});

			self.addSortHandler();
			self.addFilterHandler();

			// Sets up callbacks responsible for correctly redrawing the grid when the view has done work
			// (e.g. sorting or filtering) that will change what is displayed.  This is only needed when
			// limiting output because otherwise, sort and filter callbacks don't need to redraw the whole
			// grid, and they are taken care of by the 'sort' and 'filter' events on a row-by-row basis.

			if (self.features.limit) {
				self.addWorkHandler();
			}

			if (self.features.rowReorder) {
				configureRowReordering(self.defn, self.ui.tbody);
			}

			self.ui.tbl.attr('class', 'newui zebra');

			self.ui.tbl.append(self.ui.thead);

			if (!getProp(self.defn, 'table', 'incremental', 'appendBodyLast')) {
				self.ui.tbl.append(self.ui.tbody);
			}

			if (self.features.footer) {
				self.ui.tbl.append(self.ui.tfoot);
			}

			container.append(self.ui.tbl);

			// Activate TableTool using this attribute, if the user asked for it.

			if (self.features.tabletool) {
				debug.info('GRID TABLE // DRAW', 'Enabling TableTool');
				self.ui.tbl.attr('data-tttype', 'sticky');
			}
		});
	});
};

// #addSortHandler {{{2

GridTable.prototype.addSortHandler = function () {
	var self = this;

	// Register the event handler for when a sort occurs in the view.  The way this works is that
	// the view will invoke the callback for each row in order.  We just append them to the table
	// body in that same order, and boom: all the rows are sorted.
	//
	// However, we DON'T want to do this if we're limiting the output because we're currently only
	// showing part of the data.  So, when we sort, we need to completely redraw the window (e.g.
	// rows 21-40) that we're showing.
	//
	// FIXME - This will cause problems with multiple grids (some supporting sorting, some not)
	// using the same view.

	self.view.off('sort');

	if (self.features.sort) {
		if (self.features.limit) {
			self.view.on('sortEnd', function () {
				debug.info('GRID TABLE // HANDLER (sortEnd)', 'Marking table to be redrawn');
				self.needsRedraw = true;
			});
		}
		else {
			self.view.on('sort', function (rowNum, position) {
				var elt = jQuery(document.getElementById(self.defn.table.id + '_' + rowNum));

				// Add one to the position (which is 0-based) to match the 1-based row number in CSS.

				elt.removeClass('even odd');
				elt.addClass((position + 1) % 2 === 0 ? 'even' : 'odd');
				self.ui.tbody.append(elt);
			});
		}
	}
};

// #addFilterHandler {{{2

GridTable.prototype.addFilterHandler = function () {
	var self = this;

	// Register the event handler for when a filter occurs in the view.  The way this works is that
	// the view will invoke the callback for each row and indicate if it should be shown or hidden.
	//
	// However, we DON'T want to do this if we're limiting the output because we're currently only
	// showing part of the data.  So, when we filter, we need to completely redraw the window (e.g.
	// rows 21-40) that we're showing.
	//
	// FIXME - This will cause problems with multiple grids (some supporting filtering, some not)
	// using the same view.

	self.view.off('filter');

	if (self.features.filter) {
		if (self.features.limit) {
			self.view.on('filterEnd', function () {
				debug.info('GRID TABLE // HANDLER (filterEnd)', 'Marking table to be redrawn');
				self.needsRedraw = true;
			});
		}
		else {
			var even = false; // Rows are 1-based to match our CSS zebra-striping.

			self.view.on('filter', function (rowNum, hide) {
				self.ui.tr[rowNum].removeClass('even odd');
				if (hide) {
					self.ui.tr[rowNum].hide();
				}
				else {
					self.ui.tr[rowNum].show();
					self.ui.tr[rowNum].addClass(even ? 'even' : 'odd');
					even = !even;
				}
			});
		}
	}
};

// #addWorkHandler {{{2

GridTable.prototype.addWorkHandler = function () {
	var self = this;

	self.view.on('workEnd', function () {
		if (self.needsRedraw) {
			debug.info('GRID TABLE // HANDLER (workEnd)', 'Redrawing because the view has done work');

			self.needsRedraw = false;

			return self.view.getData(function (data) {
				return self.view.getTypeInfo(function (typeInfo) {
					self.timing.start(['Grid Table', 'Redraw triggered by view']);

					// Determine what columns will be in the table.  This comes from the user, or from the
					// data itself.  We may then add columns for extra features (like row selection or
					// reordering).

					var columns = determineColumns(self.defn, data, typeInfo);

					// Draw the body.

					self.draw_body(data, typeInfo, columns, function () {
						self.timing.stop(['Grid Table', 'Redraw triggered by view']);
					});
				});
			});
		}
	});
};

// #draw_header {{{2

/**
 * Render the header columns of a GridTable.
 *
 * @param {Array.<string>} columns A list of the fields that are to be included as columns within
 * the GridTable.
 *
 * @param {View~Data} data
 *
 * @param {Source~TypeInfo} typeInfo
 */

GridTable.prototype.draw_header = function (columns, data, typeInfo) {
	var self = this;

	var headingTr, headingSpan, headingTh;

	var headingThCss = {
		'white-space': 'nowrap',
		'padding-bottom': 0
	};

	var filterThCss = {
		'white-space': 'nowrap',
		'padding-top': 4,
		'padding-bottom': 0,
		'vertical-align': 'top'
	};

	// Pivot Headers (Column Values) {{{3

	var drawPivot = function () {
		// This produces separate rows in the header for each pivot field.  That's what allows you to
		// see the combinations of column values, like this:
		//
		// Example
		// -------
		//
		//   pivotFields = ["Last Name", "First Name"]
		//   colVals = [["Kennedy", "John"], ["Kennedy", "Robert"], ["Kennedy", "Ted"],
		//              ["Roosevelt", "Franklin"], ["Roosevelt", "Teddy"]]
		//
		// +---------------------+------------------+
		// | Kennedy             | Roosevelt        |
		// +------+--------+-----+----------+-------+
		// | John | Robert | Ted | Franklin | Teddy |
		// +------+--------+-----+----------+-------+

		var pivotFieldNum, colValNum;
		var lastColVal = null, lastColValCount = 0, colVal;

		for (pivotFieldNum = 0; pivotFieldNum < data.pivotFields.length; pivotFieldNum += 1) {
			headingTr = jQuery('<tr>'); // Create the row for the pivot field.

			// Create dummy cells to take up the columns that will be used below by the headers for the
			// group fields.

			_.each(data.groupFields, function () {
				jQuery('<td>').appendTo(headingTr);
			});

			lastColVal = null;
			lastColValCount = 0;
			for (colValNum = 0; colValNum < data.colVals.length; colValNum += 1) {
				colVal = data.colVals[colValNum][pivotFieldNum];
				if (colVal !== lastColVal || pivotFieldNum === data.pivotFields.length - 1) {
					if (lastColVal !== null) {
						// The we've hit a different colVal so count up how many of the last one we had to
						// determine the column span.  In the above example, there are three "Kennedy" and two
						// "Roosevelt" so those are the colspans that we would set.

						headingTh.attr('colspan', lastColValCount);
						headingTr.append(headingTh);
					}

					// Update the tracking information and reset the counter to one.

					lastColVal = colVal;
					lastColValCount = 1;

					headingSpan = jQuery('<span>').text(colVal);

					headingTh = jQuery('<th>')
						.css(headingThCss)
						.append(headingSpan);

					self._addSortingToHeader(colVal, headingSpan, headingTh);

					self.setCss(headingTh, colVal);
					// REMOVED: I'm not sure how this would function in the pivot table.
					// self.ui.thMap[colName] = headingTh;
				}
				else {
					lastColValCount += 1;
				}
			}

			// Same logic as when the colVal changes.

			headingTh.attr('colspan', lastColValCount);
			headingTr.append(headingTh);

			// Add the row for this pivot field to the THEAD.
			self.ui.thead.append(headingTr);
		}
	};

	// Group Headers (Row Values) {{{3

	var drawGroup = function () {
		headingTr = jQuery('<tr>');

		_.each(data.groupFields, function (fieldName) {
			headingSpan = jQuery('<span>').text(fieldName);

			headingTh = jQuery('<th>')
				.css(headingThCss)
				.append(headingSpan);

			self._addSortingToHeader(fieldName, headingSpan, headingTh);

			self.setCss(headingTh, fieldName);

			self.ui.thMap[fieldName] = headingTh;
			headingTr.append(headingTh);
		});

		if (!data.isPivot) {
			_.each(columns, function (colName) {
				headingSpan = jQuery('<span>').text(colName);

				headingTh = jQuery('<th>')
					.css(headingThCss)
					.append(headingSpan);

				self._addSortingToHeader(colName, headingSpan, headingTh);

				self.setCss(headingTh, colName);

				self.ui.thMap[colName] = headingTh;
				headingTr.append(headingTh);
			});
		}

		self.ui.thead.append(headingTr);
	};

	// Plain Headers (Column Fields) {{{3

	var drawPlain = function () {
		headingTr = jQuery('<tr>');
		filterTr = jQuery('<tr>');

		/*
		 * Create the checkbox that allows the user to select all rows.
		 */

		if (self.features.rowSelect) {
			self.ui.checkAll_thead = jQuery('<input>', { 'name': 'checkAll', 'type': 'checkbox' })
				.on('change', function (evt) {
					rowSelect_checkAll.call(this, evt, self.ui);
				});
			headingTr.append(jQuery('<th>').append(self.ui.checkAll_thead));
			if (self.features.filter) {
				filterTr.append(jQuery('<th>').css(filterThCss));
			}
		}

		/*
		 * Set up the sorting specification for the View that belongs to this GridTable.
		 */

		if (self.features.sort) {
			self.defn.sortSpec = {
				col: null,
				asc: false
			};
		}

		/*
		 * Set up the GridFilterSet instance that manages the (potentially multiple) filters on each
		 * column of the View that belongs to this GridTable.
		 */

		if (self.features.filter) {
			self.defn.gridFilterSet = new GridFilterSet(self.defn, self.view);
		}

		/*
		 * Configure every column which comes from the data (i.e. not the "select all" checkbox, and not
		 * the editing "options" column).
		 */

		_.each(columns, function (field, colIndex) {
			var colConfig = self.defn.table.columns[colIndex] || {};

			if (self.features.rowSelect) {
				colIndex += 1; // Add a column for the row selection checkbox.
			}

			var headingSpan = jQuery('<span>').text(colConfig.displayText || field);

			var headingTh = jQuery('<th>', { id: gensym() })
				.css(headingThCss)
				.append(headingSpan);

			self._addSortingToHeader(field, headingSpan, headingTh);

			/*
			 * Configure filtering for this column.  This mainly involves creating a button, which when
			 * clicked adds (for this column) a filter to the GridFilterSet instance.
			 */

			if (self.features.filter) {

				// Add a TH to the TR that will contain the filters.  Every filter will actually be a DIV
				// inside this TH.
				//
				// The ID attribute here is used to provide a selector to NProgress, so the progress bar
				// will be drawn in the header cell for the column we're filtering by.  You can't pass an
				// element to NProgress for this, it needs to be a selector string.  Passing ('#' + id) was
				// the easiest way to do it.
				//
				// Unfortunately, the ID attribute is copied when using TableTool so this might mess us up.

				var filterTh = jQuery('<th>', { id: gensym() }).addClass('filter_col_' + colIndex).css(filterThCss);
				self.setCss(filterTh, field);
				filterTr.append(filterTh);

				// Create the "button" (really a SPAN) that will add the filter to the grid, and stick it
				// onto the end of the column heading TH.

				jQuery(fontAwesome('F0B0', null, 'Click to add a filter on this column'))
					.css({'cursor': 'pointer', 'margin-left': '0.5ex'})
					.on('click', function () {
						// When using TableTool, we need to put the filter UI into the floating (clone) header,
						// instead of the original (variable `filterTh` holds the original).  This jQuery will
						// always do the right thing.

						var thead = $(this).closest('thead');
						var tr = thead.children('tr:eq(1)');
						var th = tr.children('th.filter_col_' + colIndex);

						var adjustTableToolHeight = function () {
							if (self.features.tabletool) {
								// Update the height of the original, non-floating header to be the same as that of
								// the floating header.  This is needed because otherwise the floating header will
								// cover up the first rows of the table body as we add filters.  TableTool does not
								// keep the heights of the original and clone in sync on its own (using the `update`
								// function only synchronizes the widths).

								var trHeight = tr.innerHeight();

								debug.info('GRID TABLE // ADD FILTER', 'Adjusting original table header height to ' + trHeight + 'px to match floating header height');
								filterTr.innerHeight(trHeight);
							}
						};

						var onRemove = adjustTableToolHeight;

						self.defn.gridFilterSet.add(field, th, colConfig.filter, jQuery(this), onRemove);

						adjustTableToolHeight();
					})
					.appendTo(headingTh);
			}

			self.setCss(headingTh, field);

			var alignment = colConfig.headerAlignment
				|| (['number', 'currency'].indexOf(typeInfo.get(field).type) >= 0 && 'right');

			if (alignment !== undefined) {
				headingTh.css('text-align', alignment);
			}

			self.ui.thMap[field] = headingTh;
			headingTr.append(headingTh);
		});

		/*
		 * Create a column with buttons that allows the user to reorder the rows.
		 */

		if (self.features.rowReorder) {
			headingTr.append(jQuery('<th>').text('Options'));
			if (self.features.filter) {
				filterTr.append(jQuery('<th>').css(filterThCss));
			}
		}

		self.ui.thead.append(headingTr);

		if (self.features.filter) {
			self.ui.thead.append(filterTr);
		}
	};

	if (self.features.pivot && data.isPivot) {
		drawPivot();
	}

	if (self.features.group) {
		drawGroup();
	}
	else {
		drawPlain();
	}
};

// #draw_footer {{{2

GridTable.prototype.draw_footer = function (columns, data, typeInfo) {
	var tr = jQuery('<tr>');

	if (getProp(self.defn, 'table', 'footer') === undefined) {
		if (self.features.rowSelect) {
			self.ui.checkAll_tfoot = jQuery('<input>', { 'name': 'checkAll', 'type': 'checkbox' })
				.on('change', function (evt) {
					rowSelect_checkAll.call(this, evt, self.ui);
				});
			tr.append(jQuery('<td>').append(self.ui.checkAll_tfoot));
		}

		tr.append(_.map(columns, function (field, colIndex) {
			var colConfig = self.defn.table.columns[colIndex] || {};
			var td = jQuery('<td>').text(colConfig.displayText || field);
			self.setCss(td, field);
			return td;
		}));

		if (self.features.rowReorder) {
			tr.append(jQuery('<td>').text('Options'));
		}

		self.ui.tfoot.append(tr);
	}
};

// #makeRowReorderBtn {{{2

GridTable.prototype.makeRowReorderBtn = function () {
	return jQuery('<button type="button" class="drag-handle fa">')
		.html(fontAwesome('f07d',null,'Drag or press up/down arrows to move'))
	// When the drag button has focus, add the keydown handler
	// to allow up/down arrows to work!
		.focus( function() {
			jQuery(this).on('keydown', function(event) {
				var jobj = jQuery(event.currentTarget).closest('tr'),
					oldIndex = jobj.index(),
					newIndex = oldIndex;

				// Reposition if one of the directional keys is pressed
				switch (event.keyCode) {
				case 38: // Up
					if (jobj.prev().length) {
						jobj.insertBefore(jobj.prev());
					} else {
						// already at the top so exit
						return true;
					}
					break;
				case 40: // Down
					if (jobj.next().length) {
						jobj.insertAfter(jobj.next());
					} else {
						// already at the bottom so exit
						return true;
					}
					break;
				default:
					return true; // Exit
				}
				newIndex = jobj.index();
				if (oldIndex !== newIndex) {
					rowSwapIndex(self.defn, oldIndex, newIndex);
				}
				// keep focus on the button after move
				jQuery(event.currentTarget).focus();
			});
		})
	// Remove the keydown handler when focus is lost
		.focusout( function() {
			jQuery(this).off('keydown');
		});
};

// #draw_body_plain {{{2

GridTable.prototype.draw_body_plain = function (data, typeInfo, columns, cont) {
	var self = this;

	var check_handler = function () {
		var tds = jQuery(jQuery(this).parents('tr').get(0)).children('td');
		if (this.checked) {
			tds.addClass('selected_row');
		}
		else {
			tds.removeClass('selected_row');
		}
	};

	var useLimit = self.features.limit;
	var limitConfig = getPropDef({}, self.defn, 'table', 'limit');

	if (limitConfig && data.data.length > limitConfig.threshold) {
		debug.info('GRID TABLE // DRAW', 'Limiting output to first ' + limitConfig.threshold + ' rows');
	}

	/*
	 * Check to see if we should be rendering incrementally (add a few rows at a time).
	 */

	var useIncremental = false;
	var incrementalConfig;

	if (self.defn.table.incremental) {
		useIncremental = true;
		incrementalConfig = self.defn.table.incremental;
	}

	// Clear out the body of the table.  We do this in case somebody invokes this function multiple
	// times.  This function draws the entirety of the data, we certainly don't want to just tack rows
	// on to the end.

	self.ui.tbody.children().remove();

	var render = function (startIndex, howMany, nextChunk) {
		var atLimit = false;

		if (isNothing(startIndex)) {
			startIndex = 0;
		}

		if (isNothing(howMany)) {
			howMany = data.data.length;
		}

		debug.info('GRID TABLE // DRAW', 'Rendering rows '
							 + startIndex
							 + ' - '
							 + Math.min(useLimit && startIndex === 0 ? limitConfig.threshold - 1 : Number.POSITIVE_INFINITY
													, startIndex + howMany - 1
													, data.data.length - 1)
							 + ' '
							 + (data.data.length - 1 <= startIndex + howMany - 1
									? '[END]'
									: ('/ ' + data.data.length - 1)));

		for (var rowNum = startIndex; rowNum < data.data.length && rowNum < startIndex + howMany && !atLimit; rowNum += 1) {
			var row = data.data[rowNum];
			var tr;

			if (useLimit
					&& limitConfig.method === 'more'
					&& ((startIndex === 0 && rowNum === limitConfig.threshold - 1) // [1]
							|| (startIndex > 0 && rowNum === startIndex + limitConfig.chunkSize - 1))) { // [2]

				// Condition [1]: We've reached the initial threshold for showing the more button.
				// Condition [2]: We're showing additional rows because they clicked the more button.

				atLimit = true;

				tr = jQuery('<tr>').addClass('wcdvgrid_more');

				var colSpan = columns.length
					+ (self.features.rowSelect ? 1 : 0)
					+ (self.features.rowReorder ? 1 : 0);

				var td = jQuery('<td>', {
					colspan: colSpan
				})
					.on('click', function () {
						tr.remove(); // Eliminate the "more" row.
						render(rowNum, limitConfig.chunkSize, nextChunk);
					})
					.append(fontAwesome('F13A'))
					.append(jQuery('<span>Showing rows '
												 + '1–'
												 + rowNum
												 + ' of '
												 + (data.data.length + 1)
												 + '.</span>')
									.css({
										'padding-left': '0.5em',
									}))
					.append(jQuery('<span>Click to load ' + limitConfig.chunkSize + ' more rows.</span>')
									.css({
										'padding-left': '0.5em',
										'padding-right': '0.5em'
									}))
					.append(fontAwesome('F13A'));

				tr.append(td);
			}
			else {
				tr = jQuery('<tr>', {id: self.defn.table.id + '_' + rowNum});

				// Create the check box which selects the row.

				if (self.features.rowSelect) {
					var checkbox = jQuery('<input>', {
						'type': 'checkbox',
						'data-row-num': rowNum
					})
						.on('change', check_handler);
					tr.append(jQuery('<td>').append(checkbox));
				}

				// Create the data cells.

				_.each(columns, function (field, colIndex) {
					var colConfig = self.defn.table.columns[colIndex] || {};
					var cell = row.rowData[field];

					var td = jQuery('<td>');
					var value = cell.orig || cell.value;

					// For types that support formatting, use that instead of the value.

					if (['number', 'currency', 'date', 'time', 'datetime'].indexOf(typeInfo.get(field).type) >= 0
							&& colConfig.format) {

						// The value here could be either from NumeralJS or from Moment, but fortunately it doesn't
						// matter because they both have the format() method.

						value = cell.value.format(colConfig.format);
					}

					// If there's a rendering function, pass the (possibly formatted) value through it to get the
					// new value to display.

					if (cell.render) {
						value = cell.render(value);
					}

					if (value instanceof Element || value instanceof jQuery) {
						td.append(value);
					}
					else {
						td.text(value);
					}

					self.setCss(td, field);

					var alignment = colConfig.cellAlignment;

					if (alignment === undefined
							&& (typeInfo.get(field).type === 'number'
									|| typeInfo.get(field).type === 'currency')) {
						alignment = 'right';
					}

					switch (alignment) {
					case 'left':
						td.addClass('wcdvgrid_textLeft');
						break;

					case 'right':
						td.addClass('wcdvgrid_textRight');
						break;

					case 'center':
						td.addClass('wcdvgrid_textCenter');
						break;

					case 'justify':
						td.addClass('wcdvgrid_textJustify');
						break;

					default:
						// We don't have a class for every possible value, so just set the style rule on the
						// element in those cases.

						td.css('text-align', alignment);
					}

					tr.append(td);
				});

				// Create button used as the "handle" for dragging/dropping rows.

				if (self.features.rowReorder) {
					tr.append(jQuery('<td>').append(self.makeRowReorderBtn()));
				}
			}

			self.ui.tr.push(tr);
			self.ui.tbody.append(tr);
		}

		if (self.features.tabletool && window.TableTool !== undefined) {
			TableTool.update();
		}

		if (rowNum === data.data.length) {
			// All rows have been produced, so we're done!

			//self.ui.tbl.css({'table-layout': 'auto'}); // XXX - Does nothing?!

			if (typeof cont === 'function') {
				return cont();
			}

			// Nothing to do next, but we're done here.

			return;
		}
		else if (typeof nextChunk === 'function') {
			return nextChunk(startIndex, howMany);
		}

		// Nothing to do next, but we're done here.

		return;
	};

	if (useIncremental) {
		if (incrementalConfig.method === 'setTimeout') {
			var nextChunk = function (startIndex, howMany) {
				window.setTimeout(function () {
					render(startIndex + howMany, howMany, nextChunk);
				}, incrementalConfig.delay);
			};

			// Kick off the initial render starting at index 0.

			window.setTimeout(function () {
				render(0, incrementalConfig.chunkSize, nextChunk);
			}, incrementalConfig.delay);
		}
		else if (incrementalConfig.method === 'requestAnimationFrame') {
			var nextChunk = function (startIndex, howMany) {
				window.requestAnimationFrame(function () {
					render(startIndex + howMany, howMany, nextChunk);
				});
			};

			// Kick off the initial render starting at index 0.

			window.requestAnimationFrame(function () {
				render(0, incrementalConfig.chunkSize, nextChunk);
			});
		}
		else {
			throw new GridTableError('Invalid value for `table.incremental.method` (' + incrementalConfig.method + ') - must be either "setTimeout" or "requestAnimationFrame"');
		}
	}
	else {
		render();
	}

	//self.ui.tbl.css({'table-layout': 'fixed'}); // XXX - Does nothing?!
};

// #draw_body_group {{{2

GridTable.prototype.draw_body_group = function (data, typeInfo, columns) {
	var self = this;

	_.each(data.data, function (rowGroup, groupNum) {
		var tr = jQuery('<tr>');

		// Create the cells that show the values of the grouped columns.
		//
		// EXAMPLE
		// -------
		//
		//   groupFields = ["First Name", "Last Name"]
		//   rowVals = [["Luke", "Skywalker"], ...]
		//
		// <tr>
		//   <th>Luke</th>
		//   <th>Skywalker</th>
		//   ... row[col] | col ∉ groupFields ...
		// </tr>

		_.each(data.rowVals[groupNum], function (rowVal) {
			jQuery('<th>').text(rowVal).appendTo(tr);
		});

		if (data.isPivot) {

			// Create the cells that show the result of the aggregate function for all rows matching the
			// column values at the same index.
			//
			// EXAMPLE
			// -------
			//
			//   pivotFields = ["State"]
			//   colVals = ["IL", "IN", "MI", "OH"]
			//
			// Column #1: agg(rowGroup[0]) - rows in the group w/ State = "IL"
			// Column #2: agg(rowGroup[1]) - rows in the group w/ State = "IN"
			// Column #3: agg(rowGroup[2]) - rows in the group w/ State = "MI"
			// Column #4: agg(rowGroup[3]) - rows in the group w/ State = "OH"

			_.each(rowGroup, function (colGroup) {
				var td = jQuery('<td>').text(colGroup.length);
				// REMOVED: How do we let the user set sizes &c. when doing a pivot table?
				// self.setCss(td, col);
				td.appendTo(tr);
			});
		}
		else {
			var hrefTextVal = function (x) {
				x = x instanceof Element ? jQuery(x) : x;

				if (!(x instanceof jQuery)) {
					return x;
				}

				return x.attr('href') || x.text();
			};

			_.each(columns, function (field, colIndex) {
				var uniqueVals = [];
				var colConfig = self.defn.table.columns[colIndex] || {};

				_.each(rowGroup, function (row) {
					var cell = row.rowData[field];
					var value = cell.orig || cell.value;

					// For types that support formatting, use that instead of the value.

					if (['number', 'currency', 'date', 'time', 'datetime'].indexOf(typeInfo.get(field).type) >= 0
							&& colConfig.format) {

						// The value here could be either from NumeralJS or from Moment, but fortunately it doesn't
						// matter because they both have the format() method.

						value = cell.value.format(colConfig.format);
					}

					// If there's a rendering function, pass the (possibly formatted) value through it to get the
					// new value to display.

					if (cell.render) {
						value = cell.render(value);
					}

					uniqueVals.push(value);
				});

				// Sort the values - we need to be careful of when they're elements (e.g. links) instead of
				// just plain old text.

				uniqueVals = _.sortBy(uniqueVals, function (x) {
					return x instanceof Element ? jQuery(x).text() : x instanceof jQuery ? x.text() : x;
				});

				// Make sure we get rid of any duplicates.

				uniqueVals = _.uniq(uniqueVals, true, hrefTextVal);

				var td = jQuery('<td>');

				_.each(uniqueVals, function (x, i) {
					if (i > 0) {
						td.append(', ');
					}
					td.append(x);
				});

				self.setCss(td, field);
				td.appendTo(tr);
			});
		}

		self.ui.tr.push(tr);
		self.ui.tbody.append(tr);
	});
};

// #draw_body {{{2

GridTable.prototype.draw_body = function (data, typeInfo, columns, cont) {
	var self = this;

	if (self.features.group && data.isGroup) {
		self.draw_body_group(data, typeInfo, columns);
		if (typeof cont === 'function') {
			cont();
		}
	}
	else {
		self.draw_body_plain(data, typeInfo, columns, cont);
	}
};

// #_addSortingToHeader {{{2

GridTable.prototype._addSortingToHeader = function (colName, headingSpan, headingTh) {
	var self = this;

	if (!self.features.sort) {
		return;
	}

	var sortSpan = jQuery('<span>').css({'font-size': '1.2em'});

	var onClick = function () {
		var cloneSortSpan = $(this).siblings('span.sort_indicator');
		jQuery('span.sort_indicator').hide();
		cloneSortSpan.show();

		// Save the sort spec.  If we're resorting a column (i.e. we just sorted it) then
		// reverse the sort direction.  Otherwise, start in ascending order.

		self.defn.sortSpec.asc = (self.defn.sortSpec.col === colName ? !self.defn.sortSpec.asc : true);
		self.defn.sortSpec.col = colName;

		debug.info('SORTING', 'Column = ' + self.defn.sortSpec.col + ' ; Direction = ' + (self.defn.sortSpec.asc ? 'ASC' : 'DESC'));

		cloneSortSpan.html(fontAwesome(self.defn.sortSpec.asc ? 'F0D7' : 'F0D8'));

		self.view.setSort(self.defn.sortSpec.col,
											self.defn.sortSpec.asc ? 'ASC' : 'DESC',
											false,
											{
												start: function () {
													if (window.NProgress !== undefined) {
														window.NProgress.configure({
															parent: '#' + headingTh.attr('id'),
															showSpinner: false
														});
														window.NProgress.start();
													}
												},
												update: function (amount, estTotal) {
													console.log(sprintf('Sort progress: %.0f%%', (amount / estTotal) * 100));
													if (window.NProgress !== undefined) {
														window.NProgress.set(amount / estTotal);
													}
												},
												done: function () {
													if (window.NProgress !== undefined) {
														window.NProgress.done();
													}
												}
											});
	};

	sortSpan.addClass('sort_indicator');
	sortSpan.css({'cursor': 'pointer'});
	sortSpan.on('click', onClick);

	headingSpan.css({'cursor': 'pointer', 'margin-left': '0.5ex'});
	headingSpan.on('click', onClick);

	headingTh.prepend(sortSpan);
};

// #setCss {{{2

GridTable.prototype.setCss = function (elt, colName) {
	var self = this;

	if (self.colConfig[colName] === undefined) {
		return;
	}

	var css = [
		{ configName: 'width'        , cssName: 'width'      },
		{ configName: 'minWidth'     , cssName: 'min-width'  },
		{ configName: 'maxWidth'     , cssName: 'max-width'  },
		{ configName: 'cellAlignment', cssName: 'text-align' }
	];
	
	for (var i = 0; i < css.length; i += 1) {
		if (self.colConfig[css[i].configName] !== undefined) {
			elt.css(css[i].cssName, self.colConfig[css[i].configName]);
		}
	}
};

// #getSelectedRows {{{2

/**
 * Find what rows were selected in the grid.
 *
 * @method
 * @memberof GridTable
 *
 * @param {function} cb If present, this function is called for each row that was selected.  It
 * receives the row data (as an object), and the row index.
 *
 * @returns {number | Array<Object>} If `cb` is provided, the return value is the number of selected
 * rows.  Otherwise, the return value is an array of objects representing the row data.
 *
 * @example <caption>Retrieve data on the rows selected.</caption>
 * > window.wcgrid.example.getSelectedRows()
 * ==> [{a: 1, b: 2}, {a: 3, b: 4}]
 *
 * @example <caption>Get information on row data and row number selected.</caption>
 * > var obj = {};
 * > window.wcgrid.example.getSelectedRows((data, index) => {
 *     obj["IDX" + index] = data;
 *   });
 * ==> 2
 *
 * > obj.IDX1
 * ==> {a: 1, b: 2}
 *
 * > obj.IDX2
 * ==> {a: 3, b: 4}
 */

GridTable.prototype.getSelectedRows = function (f) {
	var self = this
		, selectedIndices = []
		, selectedRowData = []
		, table = jQuery(document.getElementById(self.defn.table.id));

	selectedIndices = table
		.find('table tbody input[type="checkbox"]:checked')
		.map(function () {
			return +this.dataset.rowNum;
		})
		.get();
	_.each(selectedIndices, function (i) {
		selectedRowData.push(self.defn._data[0][i]);
	});

	if (typeof f === 'function') {
		_.each(selectedIndices, function (i) {
			f(selectedRowData[i], i);
		});
		return selectedIndices.length;
	}
	else {
		return selectedRowData;
	}
};

// #setSelectedRows {{{2

GridTable.prototype.setSelectedRows = function (r) {
	var self = this;

	throw new NotImplementedError();
};

// GridFilterError {{{1

/**
 * Represents an error that occurs when creating or using a grid filter.
 *
 * @memberof wcgraph_int
 * @class
 *
 * @param {string} msg The error message.
 */

function GridFilterError(msg) {
	this.name = 'GridFilterError';
	this.stack = (new Error()).stack;
	this.message = msg;
}

GridFilterError.prototype = Object.create(Error.prototype);
GridFilterError.prototype.constructor = GridError;

// GridFilter {{{1

// Superclass {{{2

/**
 * Base class for all grid filter widgets.
 *
 * @class
 *
 * @property {string} field
 *
 * @property {string} filterType
 *
 * @property {string} filterBtn
 *
 * @property {GridFilterSet} gridFilterSet
 *
 * @property {number} limit
 *
 * @property {boolean} applyImmediately
 *
 * @property {jQuery} div
 *
 * @property {jQuery} input
 *
 * @property {jQuery} removeBtn
 *
 * @property {string} id
 *
 */

var GridFilter = (function () {
	var id = 0;

	var genId = function () {
		return 'GridFilter_' + id++;
	};

	return function (field, filterType, filterBtn, gridFilterSet, th, onRemove) {
		var self = this;

		self.field = field;
		self.filterType = filterType;
		self.filterBtn = filterBtn;
		self.gridFilterSet = gridFilterSet;
		self.limit = 0;
		self.applyImmediately = false;
		self.div = jQuery('<div>')
			.css({'white-space': 'nowrap', 'padding-top': 2, 'padding-bottom': 2});
		self.removeBtn = self.makeRemoveBtn();
		self.onRemove = onRemove;
		self.id = genId();
		self.progress = {
			start: function () {
				console.log('Configuring NProgress');
				if (window.NProgress !== undefined) {
					window.NProgress.configure({
						parent: '#' + th.attr('id'),
						showSpinner: false
					});
					window.NProgress.start();
				}
			},
			update: function (amount, estTotal) {
				console.log(sprintf('Filter progress: %.0f%%', (amount / estTotal) * 100));
				if (window.NProgress !== undefined) {
					window.NProgress.set(amount / estTotal);
				}
			},
			done: function () {
				if (window.NProgress !== undefined) {
					window.NProgress.done();
				}
			}
		};
	};
})();

GridFilter.prototype = Object.create(Object.prototype);
GridFilter.prototype.constructor = GridFilter;

// #getValue {{{3

/**
 * This represents an exact value to use with a filter operator to decide what to show in the grid.
 *
 * @typedef {string|Moment|Numeral} GridFilter~Value
 */

/**
 * This represents a range of allowed values; anything within the range should be shown in the grid.
 *
 * @typedef {Object} GridFilter~RangeValue
 *
 * @property {GridFilter~Value} start The starting number / date in the range (inclusive).
 * @property {GridFilter~Value} end The ending number / date in the range (inclusive).
 */

/**
 * Gives the value that should be used when building the filters for the View from the user's
 * input in the GridFilter.  A GridFilter can return either a single value (which should be combined
 * with the operator, e.g. "greater than 40") or a range value (where the operators are implicitly
 * greater-than-or-equal and less-than-or-equal, e.g. "between January 1st and March 31st").
 *
 * @returns {GridFilter~Value|GridFilter~RangeValue} The value of the filter; you can tell whether
 * or not it will be a range by checking the result of #isRange().
 */

GridFilter.prototype.getValue = function () {
	var self = this;

	switch (self.gridFilterSet.view.typeInfo.get(self.field).type) {
	case 'date':
	case 'time':
	case 'datetime':
		return moment(this.input.val());
	case 'number':
	case 'currency':
		return numeral(this.input.val());
	case 'string':
	default:
		return this.input.val();
	}
};

// #getOperator {{{3

GridFilter.prototype.getOperator = function () {
	return this.operatorDrop.val();
};

// #getId {{{3

GridFilter.prototype.getId = function () {
	return this.id;
};

// #makeOperatorDrop {{{3

/**
 * Construct a SELECT that allows the user to pick the operator.
 *
 * @param {Array<string>} include If present, only include operators that correspond to those
 * operations requested.  This should be an array like ``['$eq', '$ne']`` to only show equality and
 * inequality operators.
 */

GridFilter.prototype.makeOperatorDrop = function (include) {
	var self = this;

	// These are all the operators that are possible.

	var operators = [['$contains', '∈'], ['$notcontains', '∉'], ['$eq', '='], ['$ne', '≠'], ['$gt', '>'], ['$gte', '≥'], ['$lt', '<'], ['$lte', '≤']];

	// Remove anything that user didn't ask for.

	if (include !== undefined && _.isArray(include)) {
		operators = _.reject(operators, function (elt) {
			return include.indexOf(elt[0]) < 0;
		});
	}

	var operatorDrop = jQuery('<select>');

	operatorDrop.css({'margin-right': '0.5em'});

	// Add all the operators as options within the <SELECT>.

	_.each(operators, function (op) {
		var value = op[0]
			, name = op[1];
		operatorDrop.append(jQuery('<option>', { value: value }).text(name));
	});

	// Hook up the event to update the filter when the operator is changed.

	operatorDrop.on('change', function () {
		if (self.getValue() !== '') {
			self.gridFilterSet.update(false, self.progress);
		}
	});

	// Return the <SELECT> so that the caller can put it where they want.

	return operatorDrop;
};

// #makeRemoveBtn {{{3

GridFilter.prototype.makeRemoveBtn = function () {
	var self = this;

	var removeBtn = jQuery(fontAwesome('F00D', null, 'Click to remove filter'));

	removeBtn.css({'cursor': 'pointer', 'margin-left': '0.5em'})
	removeBtn.on('click', function () {
		self.gridFilterSet.remove(self.getId(), self.filterBtn);
		if (typeof self.onRemove === 'function') {
			self.onRemove();
		}
	});

	return removeBtn;
};

// #remove {{{3

GridFilter.prototype.remove = function () {
	var self = this;

	self.div.remove();
	self.gridFilterSet.update(false, self.progress);
};

// #isRange {{{3

GridFilter.prototype.isRange = function () {
	return false;
};

// StringTextboxGridFilter {{{2

/**
 * Represents a filter on a single string.
 *
 * @class
 * @extends GridFilter
 */

var StringTextboxGridFilter = function () {
	var self = this;

	GridFilter.apply(self, arguments);

	self.input = jQuery('<input type="text">');
	self.input.on('change', function (evt) {
		self.gridFilterSet.update(false, self.progress);
	});

	self.operatorDrop = self.makeOperatorDrop(/*['$eq', '$ne']*/);

	/*
	self.strictChkbox = jQuery('<input>', {id: gensym(), type: 'checkbox'})
		.on('change', function () {
			self.gridFilterSet.update();
		});
	*/

	self.div
		.append(self.operatorDrop)
		.append(self.input)
		.append(self.removeBtn);
};

StringTextboxGridFilter.prototype = Object.create(GridFilter.prototype);

/*
StringTextboxGridFilter.prototype.getOperator = function () {
	var self = this;

	var op = GridFilter.prototype.getOperator.call(self);

	if (self.strictChkbox[0].checked) {
		return op;
	}
	else {
		switch (op) {
		case '$eq':
			return '$contains';
		case '$ne':
			return '$notcontains';
		default:
			throw new GridFilterError('<< TSNH >> Unable to determine corresponding non-strict operator for ' + op);
		}
	}
}
*/

// StringDropdownGridFilter {{{2

/**
 * Represents a filter for multiple strings.
 *
 * @class
 * @extends GridFilter
 */

var StringDropdownGridFilter = function () {
	var self = this;

	GridFilter.apply(self, arguments);

	self.super = makeSuper(self, GridFilter);
	self.limit = 1;
	self.input = jQuery('<select>').attr({
		'multiple': true
	});
	self.input.on('change', function (evt) {
		self.gridFilterSet.update(false, self.progress);
	});

	self.div
		.append(self.input)
		.append(self.removeBtn);

	self.afterAdd = function (target) {
		self.gridFilterSet.view.getUniqueVals(function (uniqueVals) {
			_.each(uniqueVals[self.field].values, function (val) {
				jQuery('<option>').attr({
					'value': val
				}).text(val).appendTo(self.input);
			});
			self.input.chosen({'width': self.div.innerWidth() - self.removeBtn.outerWidth()});
		});
	};
};

StringDropdownGridFilter.prototype = Object.create(GridFilter.prototype);

// #getOperator {{{3

StringDropdownGridFilter.prototype.getOperator = function () {
	return '$in';
};

// #getValue {{{3

StringDropdownGridFilter.prototype.getValue = function () {
	var self = this
		, val = self.super.getValue(self);

	return val === null ? undefined : val;
};

// StringCheckedListGridFilter {{{2

var StringCheckedlistGridFilter = function () {
};

// NumberTextboxGridFilter {{{2

var NumberTextboxGridFilter = function () {
	var self = this;

	GridFilter.apply(self, arguments);

	self.input = jQuery('<input type="text">');
	self.input.on('change', function (evt) {
		self.gridFilterSet.update(false, self.progress);
	});

	self.operatorDrop = self.makeOperatorDrop(['$eq', '$ne', '$lt', '$lte', '$gt', '$gte']);

	self.div
		.append(self.operatorDrop)
		.append(self.input)
		.append(self.removeBtn);
};

NumberTextboxGridFilter.prototype = Object.create(GridFilter.prototype);

// NumberCheckboxGridFilter {{{2

var NumberCheckboxGridFilter = function () {
	var self = this;

	GridFilter.apply(self, arguments);

	self.input = jQuery('<input>', {'id': gensym(), 'type': 'checkbox'});
	self.input.on('change', function () {
		self.gridFilterSet.update(false, self.progress);
	});

	self.div
		.append(jQuery('<label>')
			.append(self.input)
			.append(' Filter'))
		.append(self.removeBtn);

	self.applyImmediately = true;
	self.limit = 1;
};

NumberCheckboxGridFilter.prototype = Object.create(GridFilter.prototype);

NumberCheckboxGridFilter.prototype.getValue = function () {
	return this.input[0].checked ? 1 : 0;
};

NumberCheckboxGridFilter.prototype.getOperator = function () {
	return '$eq';
};

// DateSingleGridFilter {{{2

/**
 * Represents a filter for a single date.
 *
 * @class
 * @extends GridFilter
 */

var DateSingleGridFilter = function () {
	var self = this;

	GridFilter.apply(self, arguments);

	self.input = jQuery('<input>').attr({
		'type': 'text',
		'placeholder': 'Select date...'
	});
	
	self.input.flatpickr({
		'altInput': false,
		'onChange': function (selectedDates, dateStr, instance) {
			console.log(selectedDates, dateStr);
			//self.gridFilterSet.update();
		}
	});

	self.div
		.append(self.input)
		.append(self.removeBtn);
};

DateSingleGridFilter.prototype = Object.create(GridFilter.prototype);

// DateRangeGridFilter {{{2

/**
 * Represents a filter for a range of dates.
 *
 * @class
 * @extends GridFilter
 */

var DateRangeGridFilter = function () {
	var self = this;

	GridFilter.apply(self, arguments);

	self.limit = 1;

	self.input = jQuery('<input>').attr({
		'type': 'text',
		'placeholder': 'Click here; pick start/end dates.',
		'size': 28
	});
	
	self.widget = self.input.flatpickr({
		'altInput': false,
		'mode': 'range',
		'onChange': function (selectedDates, dateStr, instance) {
			self.gridFilterSet.update(false, self.progress);
		}
	});

	self.div
		.append(self.input)
		.append(self.removeBtn);
};

DateRangeGridFilter.prototype = Object.create(GridFilter.prototype);

// #getValue {{{3

/**
 * Get the value(s) for this date range filter.  After you bring up the calendar, when you select
 * the start date, the "onChange" event handler is run.  When you select the end date, the event is
 * fired again.  So, we use #isRange() to decide if you've only selected one date, or if you've just
 * picked the second.  When it's a range, we need to produce an object, instead of a simple value.
 *
 * @returns {GridFilter~Value|GridFilter~RangeValue} The value that should be used for filtering all
 * the data in the grid.
 */

DateRangeGridFilter.prototype.getValue = function () {
	var self = this;

	if (self.isRange()) {
		return {
			'start': moment(self.widget.selectedDates[0]),
			'end': moment(self.widget.selectedDates[1])
		};
	}
	else {
		return moment(self.widget.selectedDates[0]);
	}
};

// #getOperator {{{3

DateRangeGridFilter.prototype.getOperator = function () {
	var self = this;

	if (self.isRange()) {
		log.error('<< TSNH >> GridFilterSet called #getOperator() on a range');
	}

	return '$gte';
};

// #isRange {{{3

DateRangeGridFilter.prototype.isRange = function () {
	var self = this;

	return self.widget.selectedDates.length > 1;
};

// BooleanCheckboxGridFilter {{{2

BooleanCheckboxGridFilter = function (field, gridFilter) {
};

BooleanCheckboxGridFilter.prototype.getValue = function () {
	return this.input.val();
};

BooleanCheckboxGridFilter.prototype.getOperator = function () {
	return '$eq';
};

BooleanCheckboxGridFilter.prototype.getId = function () {
	return this.input.attr('id');
};


// Widget Map {{{2

// Type -> Filter Widget -> Constructor

GridFilter.widgets = {
	'string': {
		'textbox': StringTextboxGridFilter,
		'dropdown': StringDropdownGridFilter
	},
	'number': {
		'textbox': NumberTextboxGridFilter
	},
	'currency': {
		'textbox': NumberTextboxGridFilter
	},
	'date': {
		'single': DateSingleGridFilter,
		'range': DateRangeGridFilter
	}
};

GridFilter.defaultWidgets = {
	'string': 'dropdown',
	'number': 'textbox',
	'currency': 'textbox',
	'date': 'range'
};

// GridFilterSet {{{1

/**
 * @memberof wcgraph_int
 *
 * @class
 * @property {object} defn
 *
 * @property {View} view
 *
 * @property {Element} thead
 *
 * @property {Object} filters Stores the filters that are within this set, with different properties
 * to facilitate different lookup methods.
 *
 * @property {Array} filters.all An array of all the filters.
 *
 * @property {Object} filters.byId An object indexing all the filters by its internal ID.
 *
 * @property {Object.<Array>} filters.byCol An object indexing all the filters by the column that
 * they're filtering.
 *
 * @property {boolean} delayUpdate If true, calls to the update() method do nothing.  This is used
 * internally when loading preferences to avoid updating for every single filter.
 */

var GridFilterSet = function (defn, view) {
	var self = this;

	if (defn === undefined) {
		throw new Error('GridFilterSet(): Missing required argument: defn');
	}

	self.defn = defn;
	self.view = view;

	self.filters = {
		all: [],
		byId: {},
		byCol: {}
	};

	self.delayUpdate = false;
};

// .events {{{2

GridFilterSet.events = objFromArray([
		'filterAdded'
	, 'filterRemoved'
]);

mixinEventHandling(GridFilterSet, 'GridFilterSet', GridFilterSet.events);

// #add {{{2

/**
 * Add a new filter to this set.  This creates the user interface elements and places them in the
 * appropriate place in the grid.
 *
 * @param {string} field Name of the column to filter on.
 *
 * @param {Element} target Where to place the filter widget.
 *
 * @param {string} [filterType] The developer's requested filter type.  If missing, we use the first
 * one from the "allowed" list.  If present, and not in the allowed list, you'll get an error.
 *
 * @param {Element} filterBtn The "add filter" button from the column header.  Needed so we can hide
 * it, if we've reached the maximum number of filters allowed on the column.
 */

GridFilterSet.prototype.add = function (field, target, filterType, filterBtn, onRemove) {
	var self = this
		, filter;

	filter = self.build(field, filterType, filterBtn, target, onRemove);

	// Make sure that requisite data structures are there.

	if (self.filters.byCol[field] === undefined) {
		self.filters.byCol[field] = [];
	}

	// Add the filter to all of our data structures.

	self.filters.all.push(filter);
	self.filters.byCol[field].push(filter);
	self.filters.byId[filter.getId()] = filter;

	// Add the filter to the user interface.

	target.append(filter.div);

	if (typeof filter.afterAdd === 'function') {
		filter.afterAdd(target);
	}

	// Hide the "add filter" button if we've reached the limit of the number of filters we're allowed
	// to have for this column.

	if (self.filters.byCol[field].length === filter.limit) {
		filterBtn.hide();
	}

	self.fire(GridFilterSet.events.filterAdded);

	// Check to see if this filter should take effect as soon as it is created.

	if (filter.applyImmediately) {
		self.update();
	}
};

// #build {{{2

GridFilterSet.prototype.build = function (field, filterType, filterBtn, target, onRemove) {
	var self = this
		, colType
		, ctor;

	// We use a data source to get the type information, so if the grid was built without a data
	// source, this isn't going to work.

	if (!(self.defn.source instanceof Source)) {
		throw new GridFilterError('This can only be used with a Source');
	}

	colType = self.defn.source.cache.typeInfo.get(field).type;

	// Make sure that we are able to get the column type.

	if (isNothing(colType)) {
		throw new GridFilterError('Unable to determine type of column "' + field + '"');
	}

	// Make sure that we know what kinds of filters are allowed for the column type.

	if (GridFilter.widgets[colType] === undefined) {
		throw new GridFilterError('Unknown type "' + colType + '" for column "' + field + '"');
	}

	// When the user didn't request a filter type, just use the first one in the allowed list.
	// Otherwise, make sure that the filter type they asked for makes sense for the column type.

	if (isNothing(filterType)) {
		filterType = GridFilter.defaultWidgets[colType];
		ctor = GridFilter.widgets[colType][filterType];
	}
	else {
		ctor = GridFilter.widgets[colType][filterType];
	}

	if (ctor === undefined) {
		throw new GridFilterError('Invalid filter type "' + filterType + '" for type "' + colType + '" of column "' + field + '"');
	}

	debug.info('GRID FILTER', 'Creating new widget: column type = "' + colType + '" ; filter type = "' + filterType + '"');

	return new ctor(field, filterType, filterBtn, self, target, onRemove);
};

// #remove {{{2

GridFilterSet.prototype.remove = function (id, filterBtn) {
	var self = this
		, filter = self.filters.byId[id];

	// Make sure that a filter with that ID exists.

	if (filter === undefined) {
		log.warn('Attempted to remove filter with ID "' + id + '" from the grid, but it doesn\'t exist');
		return;
	}

	var sameId = function (elt) { return elt.getId() === id };
	var allIndex = _.findIndex(self.filters.all, sameId);
	var colIndex = _.findIndex(self.filters.byCol[filter.field], sameId);

	delete self.filters.byId[id];
	self.filters.all.splice(allIndex, 1);
	self.filters.byCol[filter.field].splice(colIndex, 1);

	filter.remove();

	// Show the "add filter" button if we're below the limit of the number of filters we're allowed to
	// have for this column.

	if (self.filters.byCol[filter.field].length < filter.limit) {
		filterBtn.show();
	}

	self.fire(GridFilterSet.events.filterRemoved);
};

// #reset {{{2

GridFilterSet.prototype.reset = function () {
	var self = this;

	// Remove every filter from the user interface.

	_.each(self.filters.all, function (filter) {
		filter.remove();
	});

	// Reset our internal data structures.

	self.filters = {
		all: [],
		byId: {},
		byCol: {}
	};

	self.view.clearFilter();
};

// #update {{{2

/**
 * @param {boolean} dontSavePrefs If true, don't save preferences.
 */

GridFilterSet.prototype.update = function (dontSavePrefs, progress) {
	var self = this
		, spec = {};

	// Check for the "don't actually update" property, set when we're loading prefs to prevent any
	// `applyImmediately` filters from causing unnecessary updates until we're done.

	if (self.delayUpdate) {
		return;
	}

	if (self.filters.all.length === 0) {
		self.view.setFilter(null);
		return;
	}

	_.each(self.filters.byCol, function (filterList, field) {
		_.each(filterList, function (filter) {
			var value = filter.getValue();

			if (value === undefined) {
				return;
			}

			if (spec[field] === undefined) {
				spec[field] = {};
			}

			if (filter.isRange()) {
				spec[field]['$gte'] = value.start;
				spec[field]['$lte'] = value.end;
			}
			else {
				var operator = filter.getOperator();

				if (spec[field][operator] === undefined) {
					spec[field][operator] = value;
				}
				else if (_.isArray(spec[field][operator])) {
					spec[field][operator].push(value);
				}
				else if (['$eq', '$ne', '$contains'].indexOf(operator) >= 0) {
					spec[field][operator] = [spec[field][operator], value];
				}
				else {
					spec[field][operator] = value;
				}
			}
		});
	});

	debug.info('GRID FILTER SET', 'Updating with ' + self.filters.all.length + ' filters: ', spec);

	self.view.setFilter(spec, false, progress);

	if (getProp(self.defn, 'table', 'prefs', 'enableSaving') && !dontSavePrefs) {
		self.savePrefs();
	}
};

// #savePrefs {{{2

/**
 * Store preferences for the filters on this grid.
 */

GridFilterSet.prototype.savePrefs = function () {
	var self = this
		, filters = [];

	// Make sure that there's a way to save prefs.

	if (isNothing(self.defn.prefs)) {
		log.error('Unable to save prefs: [defn.prefs] does not exist');
		return;
	}

	// Make sure the API we're expecting is going to be there.

	if (!(self.defn.prefs instanceof Prefs)) {
		log.error('Unable to save prefs: [defn.prefs] is not a Prefs instance');
		return;
	}

	_.each(self.filters.all, function (filter) {
		var filterPref = {};

		filterPref.field = filter.field;
		filterPref.filterType = filter.filterType;
		filterPref.operator = filter.getOperator();
		filterPref.value = filter.getValue();

		filters.push(filterPref);
	});

	self.defn.prefs.setUserData('html/filters', filters);
	self.defn.prefs.save();
};

// #loadPrefs {{{2

/**
 * Load filter data from preferences and apply it to the grid.
 *
 * @param {object} prefs The whole preferences object.
 */

GridFilterSet.prototype.loadPrefs = function (prefs) {
	_.each(prefs.filters, function (filterPref) {
		self.add();
	});

	self.update(true); // No need to save prefs, we just loaded them!
};

// Grid {{{1
// JSDoc Types {{{2

/**
 * @typedef Grid~Defn
 *
 * @property {Object} table
 * @property {string} table.id
 * @property {Array.<Grid~Defn_Column>} [table.columns]
 */

/**
 * @typedef Grid~Defn_Column
 *
 * @property {string} field The name of the field (from the data source) we're describing.
 * @property {string} displayText What to show in the column header (instead of the field name).
 */

/**
 * @typedef Grid~Features
 *
 * @property {boolean} [footer=false] If true, then a footer is shown at the bottom of the table.
 * This is automatically enabled if `defn.table.footer` is provided.
 *
 * @property {boolean} [sort=false] If true, the user is allowed to sort the data by clicking the
 * column header.
 *
 * @property {boolean} [filter=false] If true, the user is allowed to filter the data by clicking
 * the "add filter" button in the column header.
 *
 * @property {boolean} [group=false] If true, the user is allowed to group the data.
 *
 * @property {boolean} [pivot=false] If true, the user is allowed to pivot the data.
 *
 * @property {boolean} [rowSelect=false] If true, the user is allowed to select rows by using the
 * checkbox in the first column.
 *
 * @property {boolean} [rowReorder=false] If true, the user is allowed to manually reorder the rows
 * using the handle in the last column.
 *
 * @property {boolean} [add=false] Unused
 *
 * @property {boolean} [edit=false] Unused
 *
 * @property {boolean} [delete=false] Unused
 *
 * @property {boolean} [limit=false] If true, then limit the amount of rows output by some method.
 *
 * @property {boolean} [tabletool=false] If true, then use TableTool to create a floating header for
 * the table.
 */

// Constructor {{{2

/**
 * Create a new Grid and place it somewhere in the page.  A Grid consists of two major parts: the
 * decoration (e.g. titlebar and toolbar), and the underlying grid (e.g. jQWidgets or Tablesaw).
 *
 * @param {string} id The ID of a DIV (which must already exist in the page) where we will put the
 * grid and its decoration.  This DIV is also known as the "tag container" because it's typically
 * created by the <WCGRID> layout tag.
 *
 * @param {Grid~Defn} defn The definition of the grid itself.
 *
 * @param {object} tagOpts Configuration of the decoration of the grid.
 *
 * @param {boolean} [tagOpts.runImmediately=true] If true, then show the grid immediately.
 *
 * @param {number} [tagOpts.height] If present, sets the height of the grid.
 *
 * @param {string} [tagOpts.title] If present, create a title bar for the grid.
 *
 * @param {string} [tagOpts.helpText] If present, create a help bubble with this text.
 *
 * @param {function} cb A function that will be called after the grid has finished rendering, with
 * the underlying output method grid object (e.g. the jqxGrid instance) being passed.
 *
 * @example <caption>Getting the grid object using a callback.</caption>
 * var grid = new MIE.Grid('test', {...}, {...}, (grid) => {
 *   grid.jqxGrid('autoresizecolumns');
 * });
 *
 * @class
 *
 * @property {string} id The ID of the div that contains the whole tag output.
 * @property {Grid~Defn} defn The definition object used to create the grid.
 * @property {wcgrid_tagOpts} tagOpts Options for the grid's container.
 * @property {object} grid The underlying grid object (e.g. a jqxGrid instance).
 * @property {object} ui Contains various user interface components which are tracked for convenience.
 * @property {Grid~Features} features
 * @property {Timing} timing
 */

var Grid = function (id, view, source, defn, tagOpts, cb) {
	var self = this;

	var tagContainer = null; // Container div for the contents of the whole tag.
	var gridContainer = null; // Container div for the grid.
	var rowCount = null; // Container span for the row counter.
	var clearFilter = null; // Container span for the "clear filter" link.
	var gridToolBar = null;
	var gridToolBarHeading = null;
	var gridToolBarButtons = null;
	var doingServerFilter = getProp(defn, 'server', 'filter') && getProp(defn, 'server', 'limit') !== -1;
	var viewDropdown = null;
	var prefsCallback = null;

	self.timing = new Timing();

	// Clean up the inputs that we received.

	normalizeDefn(defn);

	debug.info('GRID', 'Definition: %O', defn);

	if (isNothing(view)) {
		throw new GridError('The `view` argument is required');
	}

	if (!(view instanceof View)) {
		throw new GridError('The `view` argument must be an instance of MIE.View');
	}

	if (tagOpts === undefined) {
		tagOpts = $.extend(true, {}, {
			runImmediately: true
		});
	}

	self.defn = defn; // Definition used to retrieve data and output grid.
	self.tagOpts = tagOpts; // Other tag options, not related to the grid.
	self.grid = null; // List of all grids generated as a result.
	self.ui = {}; // User interface elements.
	self.selected = {}; // Information about what rows are selected.
	self.source = source;
	self.view = view;

	self.defn.grid = self;

	self._validateFeatures();
	self._validateId(id);

	/*
	 * Set up other container elements.
	 */

	tagContainer = jQuery(document.getElementById(id));
	self.ui.grid = jQuery('<div>');
	self.ui.gridContainer = jQuery('<div>', {
		id: defn.table.id
	});
	tagContainer.addClass('gridwrapper');
	tagContainer.attr('data-title', id + '_title');

	if (tagOpts.title) {
		if (!_.isString(tagOpts.title)) {
			throw '<tagOpts.title> is not a string';
		}
		gridToolBar = jQuery('<div class="gridtoolbar">').appendTo(tagContainer);
		gridToolBarHeading = jQuery('<div class="heading">')
			.attr('title', MIE.trans('SHOWHIDE'))
			.on('click', function (evt) {
				evt.stopPropagation();
				self.toggleGrid();
			})
			.appendTo(gridToolBar);
		gridToolBarButtons = jQuery('<div class="buttons">').appendTo(gridToolBar);

		self._addHeaderWidgets(gridToolBarHeading, doingServerFilter, !!self.tagOpts.runImmediately, id);
		self._addCommonButtons(gridToolBarButtons);

		if (getProp(self.defn, 'table', 'prefs', 'enableSaving')) {
			prefsCallback = self._addPrefsButtons(gridToolBarButtons);
		}
	}

	self.ui.gridContainer.appendTo(self.ui.grid);

	if (document.getElementById(id + '_footer')) {
		// There was a footer which was printed out by dashboard.c which we are now going to move
		// inside the structure that we've been creating.

		self.ui.footer = jQuery(document.getElementById(id + '_footer'))
			.css('display', 'block')
			.appendTo(self.ui.grid);
	}

	self.ui.grid.appendTo(tagContainer);

	var initialRender = true;

	self.tableDoneCont = function (grid, srcIndex) {
		self.grid = grid;

		// This just makes sure that we populate the "views" dropdown.  It's only needed the very
		// first time that we show the grid.  Subsequent refreshes may call this code again, but
		// there's no need to change the view dropdown when that happens.

		if (initialRender) {
			if (prefsCallback !== null) {
				prefsCallback();
			}
			initialRender = false;
		}

		// Invoke the callback for the Grid constructor, after the grid has been created.  Sometimes
		// people want to start manipulating the grid from JS right away.

		if (typeof cb === 'function') {
			cb(self.grid);
		}
	};

	self.view.on(View.events.workBegin, function () {
		self.showSpinner();
	});

	self.view.on(View.events.workEnd, function (rowCount, totalRowCount) {
		self.hideSpinner();
		self.updateRowCount(rowCount, totalRowCount);
	});

	self.view.on(View.events.dataUpdated, function () {
		self.refresh();
	});

	if (self.tagOpts.runImmediately) {
		self.showGrid();
	}
	else {
		self.hasRun = false;
		self.hideGrid();
	}

	/*
	 * Store self object so it can be accessed from other JavaScript in the page.
	 */

	window.MIE.WC_DataVis.grids = window.MIE.WC_DataVis.grids || {};
	window.MIE.WC_DataVis.grids[id] = self;
};

// #_validateFeatures {{{2

Grid.prototype._validateFeatures = function () {
	var self = this;

	self.features = {};

	var availableFeatures = [
		'footer',
		'sort',
		'filter',
		'group',
		'pivot',
		'rowSelect',
		'rowReorder',
		'add',
		'edit',
		'delete',
		'limit',
		'tabletool'
	];

	// When the user has specified the `footer` option, enable the footer feature (if it hasn't
	// already been set by the user - in other words, the user can override this automatic behavior).

	if (getProp(self.defn, 'table', 'footer') !== undefined) {
		setPropDef(true, self.defn, 'table', 'features', 'footer');
	}

	_.each(availableFeatures, function (feat) {
		self.features[feat] = getPropDef(false, self.defn, 'table', 'features', feat);
	});

	debug.info('GRID', 'Features =', self.features);
};

// #_validateId {{{2

Grid.prototype._validateId = function (id) {
	var self = this;

	// If the ID was specified as a jQuery object, extract the ID from the element.

	if (_.isArray(id) && id[0] instanceof jQuery) {
		id = id[0];
	}

	if (id instanceof jQuery) {
		id = id.attr('id');
	}

	if (typeof id !== 'string') {
		throw '<grid> "id" is not a string';
	}

	if (document.getElementById(id) === null) {
		throw 'No element exists with given ID: ' + id;
	}

	self.id = id;
	setProp(id + '_gridContainer', self.defn, 'table', 'id');
};

// #addHeaderWidgets {{{2

/**
 * Add widgets to the header of the grid.
 *
 * @method
 * @memberof Grid
 * @private
 *
 * @param {object} header
 * @param {boolean} doingServerFilter If true, then we are filtering and sorting on the server.
 * @param {boolean} runImmediately If true, then the grid will be refreshed right away.
 * @param {string} id
 */

Grid.prototype._addHeaderWidgets = function (header, doingServerFilter, runImmediately, id) {
	var self = this;
	var notHeader = jQuery('<span>', {'class': 'headingInfo'})
		.on('click', function (evt) {
			evt.stopPropagation();
		});

	self.ui.spinner = jQuery('<strong>').css({'font-weight': 'normal', 'margin-right': '0.5em'}).appendTo(header);
	self.setSpinner(self.tagOpts.runImmediately ? 'loading' : 'not-loaded');

	jQuery('<strong>', {'id': id + '_title', 'data-parent': id})
		.text(self.tagOpts.title)
		.appendTo(header);

	if (typeof self.tagOpts.helpText === 'string' && self.tagOpts.helpText !== '') {
		notHeader.append(' ');
		jQuery(fontAwesome('F059'))
			.jqxTooltip({
				content: self.tagOpts.helpText,
				width: '400',
				autoHideDelay: 10000,
				opacity: 1
			})
			.appendTo(notHeader);
	}

	notHeader.append(' ');

	self.ui.rowCount = jQuery('<span>').appendTo(notHeader);

	/*
	 * For SOME REASON, doing 'clearfilters' messes up our whole fragile logic around the filter
	 * event handlers getting called twice each time you do server-side filtering.  I mean, they get
	 * called twice UP UNTIL YOU DO 'clearfilters', after which they only get called once.  Instead
	 * of trying to figure out what twisted logic jQWidgets is using, and then working around it,
	 * just don't allow people this shortcut to clear the filters if we're doing it on the server.
	 * They'll have to clear them out column-by-column.
	 */

	if (!doingServerFilter || true /* FILTER_MULTI_CALL */ ) {
		self.ui.clearFilter = jQuery('<span>')
			.hide()
			.append(' (')
			.append(
				jQuery('<span>', {'class': 'link'})
					.text('reset')
					.on('click', function (evt) {
						evt.stopPropagation();
						self.ui.clearFilter.hide();
						if (self.defn.gridFilterSet !== undefined) {
							self.defn.gridFilterSet.reset();
						}
					})
			)
			.append(')')
			.appendTo(notHeader);
	}

	notHeader.appendTo(header);

	self.ui.showHideButton = jQuery('<button type="button">')
		.append(fontAwesome(runImmediately ? 'f077' : 'f078'))
		.addClass('showhide pull-right')
		.attr('title', MIE.trans('SHOWHIDEOPTS'))
		.click(function (evt) {
			evt.stopPropagation();
			self.toggleGrid();
		})
		.appendTo(header);

	// Create the down-chevron button that opens the grid toolbar.

	jQuery('<button type="button">')
		.append(fontAwesome('f013'))
		.addClass('showhide pull-right')
		.attr('title', MIE.trans('SHOWHIDEOPTS'))
		.click(function (evt) {
			evt.stopPropagation();
			jQuery(this).parents('.gridwrapper').find('.buttons').toggle();
		})
		.appendTo(header);
};

// #addCommonButtons {{{2

/**
 * @method
 * @memberof Grid
 * @private
 */

Grid.prototype._addCommonButtons = function (toolbar) {
	var self = this;
	var isVisible = true; // If true, the grid is not currently hidden.

	self.ui.refreshLink = jQuery('<button type="button">')
		.append(fontAwesome('F021'))
		.append(' Refresh')
		.on('click', function () {
			self.refresh();
		})
		.appendTo(toolbar);
};

// #addPrefsButtons {{{2

/**
 * @method
 * @memberof Grid
 * @private
 */

Grid.prototype._addPrefsButtons = function (toolbar) {
	var self = this;

	jQuery('<button type="button">')
		.text('Clear Prefs')
		.on('click', function () {
			self.defn.prefs.save(null, false, function () {
				self.refresh();
			});
		})
		.appendTo(toolbar);

	jQuery('<button type="button">')
		.text('Set Defaults')
		.on('click', function () {
			self.defn.prefs.save(undefined, true, null);
		})
		.appendTo(toolbar);

	var viewDropdown =
		$('<select>')
			.append($('<option>', { value: 'NEW' }).text('New View...'))
			.append($('<option>', { value: 'Main' }).text('Main'));

	var curView =
		$('<div>')
			.css({'display': 'inline-block'})
			.appendTo(toolbar)
			.append($('<span>').text('Current View: '))
			.append(viewDropdown);

	var newViewInput = $('<input>', { 'type': 'text' });

	var newViewButton =
		$('<button>', { 'type': 'button' })
			.html(fontAwesome('F0FE'))
			.on('click', function () {
				var viewName = newViewInput.val();
				newViewInput.val('');
				viewDropdown.append($('<option>', { value: viewName }).text(viewName));
				viewDropdown.val(viewName);
				self.defn.prefs.setView(viewName);
				newView.hide();
				curView.show();
			});

	var newViewCancel =
		$('<button>', { 'type': 'button' })
			.html(fontAwesome('F05E'))
			.on('click', function () {
				newViewInput.val('');
				newView.hide();
				curView.show();
			});

	var newView =
		$('<div>')
			.css({'display': 'inline-block'})
			.hide()
			.appendTo(toolbar)
			.append($('<span>').text('New View: '))
			.append(newViewInput)
			.append(newViewButton)
			.append(newViewCancel);

	viewDropdown.on('change', function () {
		if (viewDropdown.val() === 'NEW') {
			curView.hide();
			newView.show();
		}
		else {
			self.defn.prefs.load(viewDropdown.val(), function (prefsLoadedOk) {
				if (prefsLoadedOk) {
					self.defn.prefs.saveInitial();
				}
			});
		}
	});

	return function () {
		debug.info('PREFS', 'Loading the names of all the views...');

		$.ajax({
			url: 'webchart.cgi',
			method: 'GET',
			dataType: 'json',
			data: {
				f: 'ajaxget',
				s: 'grid_views',
				response_format: 'json',
				grid_id: self.defn.table.prefs.gridId
			},
			error: self.defn.error,
			success: function (response) {
				response = response.results;
				if (response.result === 'ok') {
					_.each(response.views, function (viewName) {
						if (viewName === self.id) {
							return;
						}
						viewName = viewName.replace(/^[^.]+\./g, '');
						if (viewName !== 'Main') {
							viewDropdown.append($('<option>', {value: viewName}).text(viewName));
						}
					});
					//debug.info('PREFS', 'Setting dropdown to reflect initial view:', self.defn.prefs.view);
					viewDropdown.val(self.defn.prefs.view);
				}
			}
		});
	};
};

// #refresh {{{2

/**
 * Refresh the data shown in a grid.  If the grid is not visible, this function does nothing (i.e.
 * you cannot use it to retrieve data for an invisible grid).
 *
 * @method
 * @memberof Grid
 */

Grid.prototype.refresh = function () {
	var self = this;

	if (!self.isGridVisible()) {
		return;
	}

	if (self.tagOpts.title) {
		self.setSpinner('loading');
		self.showSpinner();
		self.ui.rowCount.text('');
	}

	delete self.defn._data;

	if (self.tagOpts.filterInput) {
		self.tagOpts.filterInput.store();
	}

	if (self.features.pivot) {
		if (self.pivotControl !== undefined) {
			self.pivotControl.clear();
		}
		else {
			debug.info('GRID', 'Creating PivotControl for pivot table output');
			self.pivotControl = new PivotControl(self.defn, self.view, self.features);
		}
		self.pivotControl.draw(self.ui.gridContainer, self.tableDoneCont);
	}
	else {
		if (self.gridTable !== undefined) {
			self.gridTable.clear();
		}
		else {
			debug.info('GRID', 'Creating GridTable for normal output');
			self.gridTable = new GridTable(self.defn, self.view, self.features, self.timing);
		}
		self.gridTable.draw(self.ui.gridContainer, self.tableDoneCont); // TODO load prefs
	}
};

// #redraw {{{2

/**
 * Redraws the data from the data view in the grid.
 *
 * @method
 * @memberof Grid
 */

Grid.prototype.redraw = function () {
	var self = this;

	if (!self.isGridVisible()) {
		return;
	}

	generateTable(self.defn, false, self.tableDoneCont, self.allDoneCont);
};

// #updateRowCount {{{2

/**
 * Set the number of rows shown in the titlebar.  You can provider the number yourself!
 *
 * @method
 * @memberof Grid
 *
 * @param {number} numRows The number of rows, filtered.
 * @param {number} totalRows The total number of rows.
 */

Grid.prototype.updateRowCount = function (numRows, totalRows) {
	var self = this
		, doingServerFilter = getProp(self.defn, 'server', 'filter') && getProp(self.defn, 'server', 'limit') !== -1;

	debug.info('GRID', 'Updating row count');
	self.setSpinner('working');

	// When there's no titlebar, there's nothing for us to do here.

	if (!self.tagOpts.title) {
		return;
	}

	self.hideSpinner();

	// When arguments are provided, use those instead of trying to figure out the number of rows
	// ourselves.  This makes life a lot easier.
	//
	//   - If we only get one value, there's no filtering going on and that's just the number of
	//     rows there are.  The reset link should not be shown.
	//
	//   - If we get both values, then a filter is in effect and we need to show the reset link.

	if (!isNothing(numRows)) {
		if (!isNothing(totalRows) && totalRows !== numRows) {
			self.ui.rowCount.text(numRows + ' / ' + totalRows + ' row(s), filtered');

			if (self.ui.clearFilter) {
				self.ui.clearFilter.show();
			}
		}
		else {
			self.ui.rowCount.text(numRows + ' row(s)');

			if (self.ui.clearFilter) {
				self.ui.clearFilter.hide();
			}
		}
		return;
	}

	self.ui.rowCount.text(self.defn._data[0].length + ' row(s)');
};

// #hideGrid {{{2

/**
 * Hide the grid.
 *
 * @method
 * @memberof Grid
 */

Grid.prototype.hideGrid = function () {
	var self = this;
	self.ui.grid.slideUp({
		done: function () {
			if (self.tagOpts.title) {
				self.ui.showHideButton.removeClass('open').html(fontAwesome('f078'));
			}
		}
	});
};

// #showGrid {{{2

/**
 * Make the grid visible.  If the grid has not been "run" yet, it will be done now.
 *
 * @method
 * @memberof Grid
 */

Grid.prototype.showGrid = function () {
	var self = this;
	self.ui.grid.slideDown({
		done: function () {
			if (self.tagOpts.title) {
				self.ui.showHideButton.addClass('open').html(fontAwesome('f077'));
			}
			if (! self.hasRun) {
				self.hasRun = true;
				self.refresh();
			}
		}
	});
};

// #toggleGrid {{{2

/**
 * Toggle grid visibility.
 *
 * @method
 * @memberof Grid
 */

Grid.prototype.toggleGrid = function () {
	if (this.ui.grid.css('display') === 'none') {
		this.showGrid();
	}
	else {
		this.hideGrid();
	}
};

// #isGridVisible {{{2

/**
 * Determine if the grid is currently visible.
 *
 * @method
 * @memberof Grid
 *
 * @returns {boolean} True if the grid is currently visible, false if it is not.
 */

Grid.prototype.isGridVisible = function () {
	return this.ui.grid.css('display') !== 'none';
};

// #setSpinner {{{2

Grid.prototype.setSpinner = function (what) {
	var self = this;

	switch (what) {
	case 'loading':
		self.ui.spinner.html(fontAwesome('F021', 'fa-spin', 'Loading...'));
		break;
	case 'not-loaded':
		self.ui.spinner.html(fontAwesome('F05E', null, 'Not Loaded'));
		break;
	case 'working':
		self.ui.spinner.html(fontAwesome('F1CE', 'fa-spin', 'Working...'));
		break;
	}
};

// #showSpinner {{{2

Grid.prototype.showSpinner = function () {
	var self = this;

	if (self.tagOpts.title) {
		self.ui.spinner.show();
	}
};

// #hideSpinner {{{2

Grid.prototype.hideSpinner = function () {
	var self = this;

	if (self.tagOpts.title) {
		self.ui.spinner.hide();
	}
};

// #enablePivot {{{2

Grid.prototype.enablePivot = function () {
	var self = this;

	if (self.features.pivot) {
		return;
	}

	self.togglePivot();
};

// #disablePivot {{{2

Grid.prototype.disablePivot = function () {
	var self = this;

	if (!self.features.pivot) {
		return;
	}

	self.togglePivot();
};

// #togglePivot {{{2

Grid.prototype.togglePivot = function () {
	var self = this;

	self.features.pivot = !self.features.pivot;
	self.refresh();
};

// #drawPivotControl {{{2

/**
 * Draw the areas at the top and left of the data table which allow the user to manipulate the data
 * table as a pivot table.
 */

Grid.prototype.drawPivotControl = function () {
};

// PivotControl {{{1

/**
 * @class PivotControl
 *
 * @property {Object} defn
 *
 * @property {View} view
 *
 * @property {GridTable} gridTable
 *
 * @property {GridFilterSet} gridFilterSet The set of all filters applied to the data before
 * performing the pivot operation.  The view takes care of doing this in the right order, but we
 * need to have this for the sake of handling the user interface (i.e. adding filters).
 *
 * @property {Array.<PivotControlField>} fields A list of all pivot control fields.
 *
 * @property {Array.<PivotControlFields>} groupFields A list of all fields that we are grouping by.
 *
 * @property {Array.<PivotControlFields>} pivotFields A list of all fields that we are pivotting by.
 *
 * @property {Object} ui
 *
 * @property {Element} ui.container 
 *
 * @property {Element} ui.available A DIV that contains all available fields (those which haven't
 * been assigned to be grouped or pivotted by).
 *
 * @property {Element} ui.rows A DIV that contains all fields which are being grouped by.
 *
 * @property {Element} ui.cols A DIV that contains all fields which are being pivotted by.
 */

// Constructor {{{2

/**
 * The part of the user interface that constructs a pivot table, and allows the user to interact
 * with it (e.g. changing what rows/columns are in the pivot, filtering data).
 *
 * @param {Object} defn
 *
 * @param {Element} container
 *
 * @param {View} view
 */

function PivotControl(defn, view, features) {
	var self = this;

	if (defn === undefined) {
		throw new Error('PivotControl(): Missing required argument: defn');
	}

	if (view === undefined) {
		throw new Error('PivotControl(): Missing required argument: view');
	}
	else if (!(view instanceof View)) {
		throw new Error('PivotControl(): Argument "view" must be an instance of View');
	}

	if (features === undefined) {
		throw new Error('PivotControl(): Missing required argument: features');
	}

	self.defn = defn;
	self.view = view;
	self.features = features;

	// Create a new grid table to show the pivotted data.  Make sure that we disable some of the
	// features that don't make sense when showing a pivot table.

	self.gridTable = new GridTable(self.defn, self.view, _.extend({}, self.features, {
		filter: false,
		rowSelect: false,
		rowReorder: false
	}));

	self.gridFilterSet = new GridFilterSet(self.defn, self.view);
	self.fields = [];
	self.groupFields = [];
	self.pivotFields = [];
}

PivotControl.prototype = Object.create(Object.prototype);
PivotControl.prototype.name = 'PivotControl';
PivotControl.prototype.constructor = PivotControl;

// #addGroup {{{2

/**
 * Add a field to the current list of fields to group by.
 *
 * @param {PivotControlField} pcf
 */

PivotControl.prototype.addGroup = function (pcf) {
	var self = this;

	self.groupFields.push(pcf.fieldName);
	self.ui.rows.append(pcf.div);
	self.updateGroup();
};

// #removeGroup {{{2

PivotControl.prototype.removeGroup = function (pcf) {
	var self = this
		, index = self.groupFields.indexOf(pcf.fieldName);

	if (index < 0) {
		log.error('Tried to remove field "' + pcf.fieldName + '" from the group, but we\'re not using it!');
		return;
	}

	self.groupFields.splice(index, 1);
	self.ui.available.append(pcf.div);
	self.updateGroup();
};

// #updateGroup {{{2

PivotControl.prototype.updateGroup = function () {
	var self = this;

	self.gridTable.clear();

	if (self.groupFields.length > 0) {
		self.view.setGroup({fieldNames: self.groupFields});
	}
	else {
		self.view.clearGroup();
	}

	self.gridTable.draw(self.ui.table); // TODO load prefs
};

// #addPivot {{{2

PivotControl.prototype.addPivot = function (pcf) {
	var self = this;

	self.pivotFields.push(pcf.fieldName);
	self.ui.cols.append(pcf.div);
	self.updatePivot();
};

// #removePivot {{{2

PivotControl.prototype.removePivot = function (pcf) {
	var self = this
		, index = self.pivotFields.indexOf(pcf.fieldName);

	if (index < 0) {
		log.error('Tried to remove field "' + pcf.fieldName + '" from the pivot, but we\'re not using it!');
		return;
	}

	self.pivotFields.splice(index, 1);
	self.ui.available.append(pcf.div);
	self.updatePivot();
};

// #updatePivot {{{2

PivotControl.prototype.updatePivot = function () {
	var self = this;

	self.gridTable.clear();

	if (self.pivotFields.length > 0) {
		self.view.setPivot({fieldNames: self.pivotFields});
	}
	else {
		self.view.clearPivot();
	}

	self.gridTable.draw(self.ui.table); // TODO load prefs
};

// #draw {{{2

/**
 * Create the user interface.
 */

PivotControl.prototype.draw = function (container, tableDoneCont) {
	var self = this;

	self.ui = {};

	self.ui.container = container;
	self.ui.container.children().remove(); // Remove existing content.
	self.ui.available = jQuery('<div>').text('AVAILABLE').appendTo(self.ui.container);
	self.ui.rows = jQuery('<div>').text('ROWS').appendTo(self.ui.container);
	self.ui.cols = jQuery('<div>').text('COLS').appendTo(self.ui.container);
	self.ui.table = jQuery('<div>').text('TABLE').appendTo(self.ui.container);

	self.view.getData(function (data) {
		self.view.getTypeInfo(function (typeInfo) {
			var cols = determineColumns(self.defn, data, typeInfo);

			_.each(cols, function (fieldName) {
				self.fields[fieldName] = new PivotControlField(self, fieldName, self.features);
				self.fields[fieldName].appendTo(self.ui.available);
			});
			self.gridTable.draw(self.ui.table, tableDoneCont); // TODO load prefs
		});
	});
};

// #update {{{2

/**
 * Called when a pivot control field is moved to/from either the "group by" or "pivot by" areas.
 * This function updates the view with the new group and/or pivot configuration.
 */

PivotControl.prototype.update = function () {
	var self = this;

	self.view.setGroup();
	self.view.setPivot();
};

// PivotControlField {{{1

/**
 * @class PivotControlField
 *
 * @property {PivotControl} pivotControl
 *
 * @property {string} fieldName Name of the field which this widget controls.
 *
 * @property {Element} div Contains all elements that make up this widget.
 *
 * @property {Element} addGroupBtn
 *
 * @property {Element} addPivotBtn
 *
 * @property {Element} removeGroupBtn
 *
 * @property {Element} removePivotBtn
 */

// Constructor {{{2

function PivotControlField(pivotControl, fieldName, features) {
	var self = this;

	self.pivotControl = pivotControl;
	self.fieldName = fieldName;

	self.div = jQuery('<div>').css({
		'display': 'inline-block',
		'border': 'dotted 2px black',
		'background-color': '#CCC',
		'margin': '2px',
		'padding': '4px'
	});

	self.addGroupBtn = jQuery('<button>')
		.text('G')
		.on('click', function () {
			self.pivotControl.addGroup(self);
			self.removeGroupBtn.show();
			self.addGroupBtn.hide();
			self.addPivotBtn.hide();
		})
		.appendTo(self.div);

	self.removeGroupBtn = jQuery('<button>', {
		title: 'Remove from grouping'
	})
		.text('X')
		.on('click', function () {
			self.pivotControl.removeGroup(self);
			self.addGroupBtn.show();
			self.addPivotBtn.show();
			self.removeGroupBtn.hide();
		})
		.appendTo(self.div)
		.hide();

	self.addPivotBtn = jQuery('<button>')
		.text('P')
		.on('click', function () {
			self.pivotControl.addPivot(self);
			self.removePivotBtn.show();
			self.addGroupBtn.hide();
			self.addPivotBtn.hide();
		})
		.appendTo(self.div);

	self.removePivotBtn = jQuery('<button>')
		.text('X')
		.on('click', function () {
			self.pivotControl.removePivot(self);
			self.addGroupBtn.show();
			self.addPivotBtn.show();
			self.removePivotBtn.hide();
		})
		.appendTo(self.div)
		.hide();

	self.label = jQuery('<span>').text(fieldName).appendTo(self.div);

	if (features.filtering) {
		jQuery(fontAwesome('F0B0', null, 'Click to add a filter on this field'))
			.css({'cursor': 'pointer', 'margin-left': '0.5ex'})
			.on('click', function () {
				var filterType = getProp(self.pivotControl.defn, 'table', 'columnConfig', fieldName, 'filter');
				self.pivotControl.gridFilterSet.add(fieldName, self.div, filterType, jQuery(this));
			})
			.appendTo(self.div);
	}
}

PivotControlField.prototype = Object.create(Object.prototype);
PivotControlField.prototype.name = 'PivotControlField';
PivotControlField.prototype.constructor = PivotControlField;

// #appendTo {{{2

PivotControlField.prototype.appendTo = function (elt) {
	var self = this;

	elt.append(self.div);
};
