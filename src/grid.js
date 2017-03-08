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
	if (defn.source instanceof DataSource) {
		defn.source.swapRows(oldIndex, newIndex);
	}
	else {
		throw new NotImplementedError('Using a DataSource is required to reorder rows');
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

// Other {{{1

function isColumnHidden(defn, colName) {
	var colHiddenProp = getProp(defn, 'table', 'columnConfig', colName, 'hidden');
	var defaultHiddenProp = getPropDef(false, defn, 'table', 'columnConfig', '_DEFAULT', 'hidden');

	if (colHiddenProp !== undefined) {
		return colHiddenProp;
	}

	return defaultHiddenProp;
}

// GridError {{{1

/**
 * @class
 *
 * @property {string} name
 * @property {object} stack
 * @property {string} message
 */

var GridError = function (defn, msg) {
	this.name = 'GridError';
	this.stack = (new Error()).stack;
	this.message = 'Grid ' + defn.table.id + ': ' + msg;
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
 * @param {object} features Turn features on/off.
 *
 * @param {object} features.rowSelection If true, a new column is added on the far left of the grid.
 * This column contains a checkbox that "selects" the row.
 *
 * @param {object} features.rowReordering If true, a new column is added on the far right of the
 * grid.  This column contains a button that the user can drag to move the entire row up and down
 * relative to the other rows of the grid.
 *
 * @param {object} features.sorting If true, clicking the column heading sorts the whole grid by
 * that column.
 *
 * @param {object} features.filtering If true, a button is added within each column heading.
 * Clicking this button adds a filter on that column.  When the filter is changed, only rows which
 * match the filter are shown.
 *
 * @class
 *
 * @property {object} features An object of which features are turned on in the GridTable.  In some
 * situations, a feature may be disabled but handled by a wrapper object (e.g. PivotControl handles
 * the filter feature when the GridTable is acting as the output of a pivot table).
 *
 * @property {boolean} features.rowSelection If true, then the GridTable allows the user to select
 * rows.  A column will be added on the far left which contains a checkbox; clicking this selects or
 * unselects the row.  There is an API for accessing which rows are currently selected.
 *
 * @property {boolean} features.rowReordering If true, then the GridTable allows the user to drag
 * and drop rows to reorder them.  A column will be added on the far right which contains a button
 * that acts as the drag handle.
 *
 * @property {boolean} features.sorting If true, then the GridTable allows the user to sort it by
 * clicking the header columns; an arrow will be displayed in the header column indicating the sort
 * direction.
 *
 * @property {boolean} features.filtering If true, then the GridTable supports filtering directly by
 * including an "add filter" icon in the header columns of the table.
 *
 * @property {object} defn
 *
 * @property {DataView} dataView
 *
 * @property {Element} container
 */

function GridTable(defn, dataView, features) {
	var self = this;

	if (features === undefined) {
		features = {};
	}

	self.defn = defn;
	self.dataView = dataView;

	self.features = {
		rowSelection: !!either(features.rowSelection, self.defn.table.enableRowSelection),
		rowReordering: !!either(features.rowReordering, self.defn.table.enableRowReordering),
		sorting: !!either(features.sorting, self.defn.table.enableSorting),
		filtering: !!either(features.filtering, self.defn.table.enableFiltering)
	};
}

GridTable.prototype = Object.create(Object.prototype);
GridTable.prototype.constructor = GridTable;

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

	return self.dataView.getData(function (data) {
		return self.dataView.getTypeInfo(function (typeInfo) {
			debug.info('GRIDTABLE', 'Data = %O', data);
			debug.info('GRIDTABLE', 'TypeInfo = %O', typeInfo);

			// There are three lenses through which we can view the data:
			//
			//   1. Plain (no groups)
			//   2. Grouped (row groups)
			//   3. Pivotted (row and column groups)

			if (data.isPlain) {
				return self.drawPlain(container, data, typeInfo);
			}
			else if (data.isGroup || data.isPivot) {
				return self.drawGroupPivot(container, data, typeInfo);
			}

			if (typeof tableDone === 'function') {
				window.setTimeout(function () {
					tableDone();
				});
			}
		});
	});
};

// #drawPlain {{{2

/**
 * Render a plain (non-grouped, non-pivotted) table.
 *
 * @param {jQuery} container
 *
 * @param {Object} data
 *
 * @param {Object} typeInfo
 */

GridTable.prototype.drawPlain = function (container, data, typeInfo) {
	var self = this
		, tr
		, filterThCss = {
			'white-space': 'nowrap',
			'padding-top': 0,
			'padding-bottom': 0,
			'vertical-align': 'top'
		}
		, srcIndex = 0;

	// Build result object {{{3

	self.ui = {
		tbl: jQuery('<table>'),
		thead: jQuery('<thead>'),
		tbody: jQuery('<tbody>'),
		tfoot: jQuery('<tfoot>'),
		thMap: {},
		tr: []
	};

	// Callback for using a regular checkbox. {{{3

	var check_handler = function () {
		var tds = jQuery(jQuery(this).parents('tr').get(0)).children('td');
		if (this.checked) {
			tds.addClass('selected_row');
		}
		else {
			tds.removeClass('selected_row');
		}
	};

	// Determine columns in order {{{3

	// This is an array of the names of the *fields* that make up the columns.  If the user specified
	// defn.table.columns, then it comes from the fields in there.  Otherwise, it comes from the keys
	// of the data source's typeInfo object.

	var columns = [];

	// Error checking {{{4

	if (self.defn.table.columns !== undefined) {
		if (!_.isArray(self.defn.table.columns)) {
			throw new GridTableError('Grid Table / Draw / (table.columns) must be an array');
		}
		_.each(self.defn.table.columns, function (elt, i) {
			if (elt.field === undefined) {
				throw new GridTableError('Grid Table / Draw / Missing (table.columns[' + i + '].field)');
			}
			else if (data.data[0].rowData[elt.field] === undefined) {
				log.warn('Grid Table / Draw / (table.columns[' + i + ']) refers to field "' + elt.field + '" which does not exist in the data');
			}
		});
	}

	// }}}4

	if (self.defn.table.columns) {
		columns = _.pluck(self.defn.table.columns, 'field');
	}
	else {
		columns = _.reject(_.keys(typeInfo), function (field) {
			return field.charAt(0) === '_';
		});
	}

	debug.info('GRIDTABLE', 'Columns = %O', columns);

	var numCols = columns.length;

	if (self.features.rowSelection) {
		numCols += 1; // Add a column for the row selection checkbox.
	}

	if (self.features.rowReordering) {
		numCols += 1; // Add a column for the reordering button.
	}

	// Create the <TH> elements that go inside the <THEAD>. {{{3

	headingTr = jQuery('<tr>');
	filterTr = jQuery('<tr>');

	// Row Selection Setup {{{4

	if (self.features.rowSelection) {
		self.ui.checkAll_thead = jQuery('<input>', { 'name': 'checkAll', 'type': 'checkbox' })
			.on('change', function (evt) {
				rowSelect_checkAll.call(this, evt, self.ui);
			});
		headingTr.append(jQuery('<th>').append(self.ui.checkAll_thead));
		if (self.features.filtering) {
			filterTr.append(jQuery('<th>').css(filterThCss));
		}
	}

	// Sorting Setup {{{4

	if (self.features.sorting) {
		self.defn.sortSpec = {
			col: null,
			asc: false
		};
	}

	// Filtering Setup {{{4

	if (self.features.filtering) {
		self.defn.gridFilterSet = new GridFilterSet(self.defn, self.ui.thead);
	}

	// }}}4

	_.each(columns, function (field, colIndex) {
		var colConfig = self.defn.table.columns[colIndex] || {};

		if (self.features.rowSelection) {
			colIndex += 1; // Add a column for the row selection checkbox.
		}

		var headingSpan = jQuery('<span>').text(colConfig.displayText || field);

		var headingTh = jQuery('<th>')
			.css({'white-space': 'nowrap'})
			.append(headingSpan);

		// Sorting {{{4

		if (self.features.sorting) {
			var sortSpan = jQuery('<span>').css({'font-size': '1.2em'});

			var onClick = function () {
				jQuery('span.sort_indicator').hide();
				headingTh.find('span.sort_indicator').show();

				// Save the sort spec.  If we're resorting a column (i.e. we just sorted it) then
				// reverse the sort direction.  Otherwise, start in ascending order.

				self.defn.sortSpec.asc = (self.defn.sortSpec.col === field ? !self.defn.sortSpec.asc : true);
				self.defn.sortSpec.col = field;

				debug.info('SORTING', 'Column = ' + self.defn.sortSpec.col + ' ; Direction = ' + (self.defn.sortSpec.asc ? 'ASC' : 'DESC'));

				sortSpan.html(fontAwesome(self.defn.sortSpec.asc ? 'F0D7' : 'F0D8'));

				self.defn.view.setSort(self.defn.sortSpec.col, self.defn.sortSpec.asc ? 'ASC' : 'DESC');
			};

			sortSpan.addClass('sort_indicator');
			sortSpan.css({'cursor': 'pointer'});
			sortSpan.on('click', onClick);

			headingSpan.css({'cursor': 'pointer', 'margin-left': '0.5ex'});
			headingSpan.on('click', onClick);

			headingTh.prepend(sortSpan);
		}

		// Filtering {{{4

		if (self.features.filtering) {
			// Add a TH to the TR that will contain the filters.  Every filter will actually be a DIV
			// inside this TH.

			var filterTh = jQuery('<th>').css(filterThCss);
			self.setCss(filterTh, field);
			filterTr.append(filterTh);

			// Create the button that will add the filter to the grid, and stick it onto the end of
			// the column heading TH.

			jQuery(fontAwesome('F0B0', null, 'Click to add a filter on this column'))
				.css({'cursor': 'pointer', 'margin-left': '0.5ex'})
				.on('click', function () {
					self.defn.gridFilterSet.add(field, filterTh, colConfig.filter, jQuery(this));
				})
				.appendTo(headingTh);
		}

		// }}}4

		self.setCss(headingTh, field);
		self.ui.thMap[field] = headingTh;
		headingTr.append(headingTh);
	});

	if (self.features.rowReordering) {
		headingTr.append(jQuery('<th>').text('Options'));
		if (self.features.filtering) {
			filterTr.append(jQuery('<th>').css(filterThCss));
		}
	}

	self.ui.thead.append(headingTr);

	if (self.features.filtering) {
		self.ui.thead.append(filterTr);
	}

	// Create the <TD> elements that go inside the <TFOOT>. {{{3

	tr = jQuery('<tr>');

	if (self.features.rowSelection) {
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

	if (self.features.rowReordering) {
		tr.append(jQuery('<td>').text('Options'));
	}

	self.ui.tfoot.append(tr);

	// Create the elements that go inside the <TBODY>. {{{3

	_.each(data.data, function (row, rowNum) {
		var dateRegexp = /^\d{4}-\d{2}-\d{2}$/;
		var dateTimeRegexp = /^(\d{4}-\d{2}-\d{2}) (\d{2}:\d{2}:\d{2})$/;
		var tr = jQuery('<tr>', {id: self.defn.table.id + '_' + rowNum});

		// Create the check box which selects the row {{{4

		if (self.features.rowSelection) {
			var checkbox = jQuery('<input>', {
				'type': 'checkbox',
				'data-source-num': srcNum,
				'data-row-num': rowNum
			})
				.on('change', check_handler);
			tr.append(jQuery('<td>').append(checkbox));
		}

		// Create the data cells {{{4

		_.each(columns, function (field, colIndex) {
			var colConfig = self.defn.table.columns[colIndex] || {};
			var cell = row.rowData[field];

			var td = jQuery('<td>');
			var value = cell.orig || cell.value;

			// For types that support formatting, use that instead of the value.

			if (['number', 'currency', 'date', 'time', 'datetime'].indexOf(typeInfo[field].type) >= 0
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
			tr.append(td);
		});

		// Create button used as the "handle" for dragging/dropping rows {{{4

		if (self.features.rowReordering) {
			var drag = jQuery('<button type="button" class="drag-handle fa">')
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
			tr.append(jQuery('<td>').append(drag));
		}

		// }}}4

		self.ui.tr.push(tr);
		self.ui.tbody.append(tr);
	});

	// Register filter event handler {{{3
	//
	// Even if we don't have the "filtering" feature turned on, we still need to do this because
	// somebody else might be causing the view to be filtered.

	var evenOdd = [];
	var even = false; // Rows are 1-based to match our CSS zebra-striping.

	self.defn.view.off('filter');
	self.defn.view.on('filter', function (rowNum, hide) {
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

	// Register sort event handler {{{3
	//
	// Even if we don't have the "sorting" feature turned on, we still need to do this because
	// somebody else might be causing the view to be sorted.

	self.defn.view.off('sort');
	self.defn.view.on('sort', function (rowNum, position) {
		var elt = jQuery(document.getElementById(self.defn.table.id + '_' + rowNum));

		// Add one to the position (which is 0-based) to match the 1-based row number in CSS.

		elt.removeClass('even odd');
		elt.addClass((position + 1) % 2 === 0 ? 'even' : 'odd');
		self.ui.tbody.append(elt);
	});

	// }}}3

	if (self.features.rowReordering) {
		configureRowReordering(self.defn, self.ui.tbody);
	}

	self.ui.tbl.attr({
		'class': 'newui zebra',
		// 'data-tttype': 'sticky' // BUG BREAKS FILTERS
	});

	container.append(self.ui.tbl.append(self.ui.thead).append(self.ui.tfoot).append(self.ui.tbody));
};

// #drawGroupPivot {{{2

/**
 * Draw a table that has been grouped or pivotted.
 *
 * @param {jQuery} container
 *
 * @param {Object} data
 *
 * @param {Object} typeInfo
 */

GridTable.prototype.drawGroupPivot = function (container, data, typeInfo) {
	var self = this
		, tr
		, columns
		, srcIndex = 0;

	// Build result object {{{3

	self.ui = {
		tbl: jQuery('<table>'),
		thead: jQuery('<thead>'),
		tbody: jQuery('<tbody>'),
		tfoot: jQuery('<tfoot>'),
		thMap: {},
		tr: []
	};

	if (!data.isPivot) {
		var columns = [];

		if (self.defn.table.columns !== undefined) {
			if (!(self.defn.table.columns instanceof Array)) {
				throw self.defn.error('[table.columns] must be an array');
			}
			_.each(self.defn.table.columns, function (elt, i) {
				if (typeof elt !== 'string') {
					throw self.defn.error('[table.columns] element #' + i + ' is not a string');
				}
				if (elt !== '_DEFAULT' && data.data[0][0] !== undefined && data.data[0][0]['rowData'][elt] === undefined) {
					emailWarning(self.defn, 'Configuration for column "' + elt + '" refers to something not present in the data.  With jQWidgets output, this can result in empty columns.  Did the data source (e.g. system report) change?');
				}
			});
		}

		columns = _.keys(typeInfo);

		if (!isNothing(getProp(self.defn, 'table', 'columns'))) {
			columns = _.union(_.reject(self.defn.table.columns, function (x) { return x === '_DEFAULT'; }), columns);
		}

		columns = _.reject(columns, function (colName) {
			return colName.charAt(0) === '_' || isColumnHidden(self.defn, colName);
		});

		debug.info('GRIDTABLE // GROUP', 'Columns = %O', columns);

		var numCols = columns.length;
	}

	// Create the <TH> elements that go inside the <THEAD>. {{{3

	var headingTr, headingSpan, headingTh;

	if (data.isPivot) {
		// Create headers for the colVals. {{{4
		//
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
						.css({'white-space': 'nowrap'})
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

		// }}}4
	}

	// Create headers for the grouped fields. {{{4

	headingTr = jQuery('<tr>');

	_.each(data.groupFields, function (fieldName) {
		headingSpan = jQuery('<span>').text(fieldName);

		headingTh = jQuery('<th>')
			.css({'white-space': 'nowrap'})
			.append(headingSpan);

		self._addSortingToHeader(fieldName, headingSpan, headingTh);

		self.setCss(headingTh, fieldName);

		self.ui.thMap[fieldName] = headingTh;
		headingTr.append(headingTh);
	});

	if (!data.isPivot) {
		// Create headers for the non-grouped fields. {{{5

		_.each(columns, function (colName) {
			headingSpan = jQuery('<span>').text(colName);

			headingTh = jQuery('<th>')
				.css({'white-space': 'nowrap'})
				.append(headingSpan);

			self._addSortingToHeader(colName, headingSpan, headingTh);

			self.setCss(headingTh, colName);

			self.ui.thMap[colName] = headingTh;
			headingTr.append(headingTh);
		});

		// }}}5
	}

	self.ui.thead.append(headingTr);

	// }}}4
	// }}}3

	if (self.features.sorting) {
		self.defn.sortSpec = {
			col: null,
			asc: false
		};
	}

	// Create the elements that go inside the <TBODY>. {{{3

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

			_.each(columns, function (colName) {
				var uniqueVals = [];

				_.each(rowGroup, function (row) {
					uniqueVals.push(row.rowData[colName]);
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

				self.setCss(td, colName);
				td.appendTo(tr);
			});
		}

		self.ui.tr.push(tr);
		self.ui.tbody.append(tr);
	});

	// Register sort event handler {{{3
	//
	// Even if we don't have the "sorting" feature turned on, we still need to do this because
	// somebody else might be causing the view to be sorted.

	self.defn.view.off('sort');
	self.defn.view.on('sort', function (rowNum, position) {
		var elt = jQuery(document.getElementById(self.defn.table.id + '_' + rowNum));

		// Add one to the position (which is 0-based) to match the 1-based row number in CSS.

		elt.removeClass('even odd');
		elt.addClass((position + 1) % 2 === 0 ? 'even' : 'odd');
		self.ui.tbody.append(elt);
	});

	// }}}3

	self.ui.tbl.attr({
		'class': 'newui zebra',
		// 'data-tttype': 'sticky' // BUG BREAKS FILTERS
	});

	container.append(self.ui.tbl.append(self.ui.thead).append(self.ui.tbody));
};

// #_addSortingToHeader

GridTable.prototype._addSortingToHeader = function (colName, headingSpan, headingTh) {
	var self = this;

	if (!self.features.sorting) {
		return;
	}

	var sortSpan = jQuery('<span>').css({'font-size': '1.2em'});

	var onClick = function () {
		jQuery('span.sort_indicator').hide();
		sortSpan.show();

		// Save the sort spec.  If we're resorting a column (i.e. we just sorted it) then
		// reverse the sort direction.  Otherwise, start in ascending order.

		self.defn.sortSpec.asc = (self.defn.sortSpec.col === colName ? !self.defn.sortSpec.asc : true);
		self.defn.sortSpec.col = colName;

		debug.info('SORTING', 'Column = ' + self.defn.sortSpec.col + ' ; Direction = ' + (self.defn.sortSpec.asc ? 'ASC' : 'DESC'));

		sortSpan.html(fontAwesome(self.defn.sortSpec.asc ? 'F0D7' : 'F0D8'));

		self.defn.view.setSort(self.defn.sortSpec.col, self.defn.sortSpec.asc ? 'ASC' : 'DESC');
	};

	sortSpan.addClass('sort_indicator');
	sortSpan.css({'cursor': 'pointer'});
	sortSpan.on('click', onClick);

	headingSpan.css({'cursor': 'pointer', 'margin-left': '0.5ex'});
	headingSpan.on('click', onClick);

	headingTh.prepend(sortSpan);
};

// #getColConfig {{{2

/**
 *
 */

GridTable.prototype.getColConfig = function (field) {
	var self = this
		, args = Array.prototype.slice.call(arguments);

	for (var i = 0; i < self.defn.table.columns; i += 1) {
		if (self.defn.table.columns[i].field === field) {
			return self.defn.table.columns[i];
		}
	}
};

// #setCss {{{2

GridTable.prototype.setCss = function (elt, colName) {
	var self = this;

	_.each([
		['width'],
		['minWidth', 'min-width'],
		['maxWidth', 'max-width'],
		['cellAlignment', 'text-align']
	], function (css) {
		if (self.getColConfig(colName, css[0]) !== undefined) {
			elt.css(css[1] || css[0], self.getColConfig(colName, css[0]));
			if (css[2]) {
				elt.attr(css[2], self.getColConfig(colName, css[0]));
			}
		}
	});
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
 * @property {number} limit If greater than zero, the maximum number of filters of this type that
 * can be created on a column at the same time.
 *
 * @property {boolean} applyImmediately If true, then the filter applies as soon as it is created,
 * using the default value of the widget (e.g. checkbox widgets apply immediately).
 */

var GridFilter = (function () {
	var id = 0;

	var genId = function () {
		return 'GridFilter_' + id++;
	};

	return function (colName, filterType, filterBtn, gridFilterSet) {
		var self = this;

		self.colName = colName;
		self.filterType = filterType;
		self.filterBtn = filterBtn;
		self.gridFilterSet = gridFilterSet;
		self.limit = 0;
		self.applyImmediately = false;
		self.div = jQuery('<div>')
			.css({'white-space': 'nowrap', 'padding-top': 2, 'padding-bottom': 2});
		self.removeBtn = self.makeRemoveBtn();
		self.id = genId();
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
 * Gives the value that should be used when building the filters for the DataView from the user's
 * input in the GridFilter.  A GridFilter can return either a single value (which should be combined
 * with the operator, e.g. "greater than 40") or a range value (where the operators are implicitly
 * greater-than-or-equal and less-than-or-equal, e.g. "between January 1st and March 31st").
 *
 * @returns {GridFilter~Value|GridFilter~RangeValue} The value of the filter; you can tell whether
 * or not it will be a range by checking the result of #isRange().
 */

GridFilter.prototype.getValue = function () {
	return this.input.val();
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
			self.gridFilterSet.update();
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
	});

	return removeBtn;
};

// #remove {{{3

GridFilter.prototype.remove = function () {
	var self = this;

	self.div.remove();
	self.gridFilterSet.update();
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
	var row1 = jQuery('<div>');
	var row2 = jQuery('<div>');

	GridFilter.apply(self, arguments);

	self.input = jQuery('<input type="text">');
	self.input.on('change', function (evt) {
		self.gridFilterSet.update();
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
};

// StringCheckedListGridFilter {{{2

var StringCheckedlistGridFilter = function () {
};

// NumberTextboxGridFilter {{{2

var NumberTextboxGridFilter = function () {
};

// NumberCheckboxGridFilter {{{2

var NumberCheckboxGridFilter = function () {
	var self = this;

	GridFilter.apply(self, arguments);

	self.input = jQuery('<input>', {'id': gensym(), 'type': 'checkbox'});
	self.input.on('change', function () {
		self.gridFilterSet.update();
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

	self.input = jQuery('<input>').attr({
		'type': 'text',
		'placeholder': 'Click here; pick start/end dates.',
		'size': 28
	});
	
	self.widget = self.input.flatpickr({
		'altInput': false,
		'mode': 'range',
		'onChange': function (selectedDates, dateStr, instance) {
			self.gridFilterSet.update();
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

BooleanCheckboxGridFilter = function (colName, gridFilter) {
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
	'date': {
		'single': DateSingleGridFilter,
		'range': DateRangeGridFilter
	}
};

GridFilter.defaultWidgets = {
	'string': 'dropdown',
	'number': 'textbox',
	'date': 'range'
};

// GridFilterSet {{{1

/**
 * @memberof wcgraph_int
 *
 * @class
 * @property {object} defn
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

var GridFilterSet = function (defn) {
	var self = this;

	if (defn === undefined) {
		throw new Error('GridFilterSet(): Missing required argument: defn');
	}

	self.defn = defn;

	self.filters = {
		all: [],
		byId: {},
		byCol: {}
	};

	self.delayUpdate = false;
};

// #add {{{2

/**
 * Add a new filter to this set.  This creates the user interface elements and places them in the
 * appropriate place in the grid.
 *
 * @param {string} colName Name of the column to filter on.
 *
 * @param {Element} target Where to place the filter widget.
 *
 * @param {string} [filterType] The developer's requested filter type.  If missing, we use the first
 * one from the "allowed" list.  If present, and not in the allowed list, you'll get an error.
 *
 * @param {Element} filterBtn The "add filter" button from the column header.  Needed so we can hide
 * it, if we've reached the maximum number of filters allowed on the column.
 */

GridFilterSet.prototype.add = function (colName, target, filterType, filterBtn) {
	var self = this
		, filter;

	filter = self.build(colName, filterType, filterBtn);

	// Make sure that requisite data structures are there.

	if (self.filters.byCol[colName] === undefined) {
		self.filters.byCol[colName] = [];
	}

	// Add the filter to all of our data structures.

	self.filters.all.push(filter);
	self.filters.byCol[colName].push(filter);
	self.filters.byId[filter.getId()] = filter;

	// Add the filter to the user interface.

	target.append(filter.div);

	// Hide the "add filter" button if we've reached the limit of the number of filters we're allowed
	// to have for this column.

	if (self.filters.byCol[colName].length === filter.limit) {
		filterBtn.hide();
	}

	// Check to see if this filter should take effect as soon as it is created.

	if (filter.applyImmediately) {
		self.update();
	}
};

// #build {{{2

GridFilterSet.prototype.build = function (colName, filterType, filterBtn) {
	var self = this
		, colType
		, ctor;

	// We use a data source to get the type information, so if the grid was built without a data
	// source, this isn't going to work.

	if (!(self.defn.source instanceof DataSource)) {
		throw new GridFilterError('This can only be used with a DataSource');
	}

	colType = self.defn.source.cache.typeInfo[colName].type;

	// Make sure that we are able to get the column type.

	if (isNothing(colType)) {
		throw new GridFilterError('Unable to determine type of column "' + colName + '"');
	}

	// Make sure that we know what kinds of filters are allowed for the column type.

	if (GridFilter.widgets[colType] === undefined) {
		throw new GridFilterError('Unknown type "' + colType + '" for column "' + colName + '"');
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
		throw new GridFilterError('Invalid filter type "' + filterType + '" for type "' + colType + '" of column "' + colName + '"');
	}

	debug.info('GRID FILTER', 'Creating new widget: column type = "' + colType + '" ; filter type = "' + filterType + '"');

	return new ctor(colName, filterType, filterBtn, self);
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
	var colIndex = _.findIndex(self.filters.byCol[filter.colName], sameId);

	delete self.filters.byId[id];
	self.filters.all.splice(allIndex, 1);
	self.filters.byCol[filter.colName].splice(colIndex, 1);

	filter.remove();

	// Show the "add filter" button if we're below the limit of the number of filters we're allowed to
	// have for this column.

	if (self.filters.byCol[filter.colName].length < filter.limit) {
		filterBtn.show();
	}
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

	self.defn.view.clearFilter();
};

// #update {{{2

/**
 * @param {boolean} dontSavePrefs If true, don't save preferences.
 */

GridFilterSet.prototype.update = function (dontSavePrefs) {
	var self = this
		, spec = {};

	// Check for the "don't actually update" property, set when we're loading prefs to prevent any
	// `applyImmediately` filters from causing unnecessary updates until we're done.

	if (self.delayUpdate) {
		return;
	}

	if (self.filters.all.length === 0) {
		self.defn.view.setFilter(null);
		return;
	}

	_.each(self.filters.byCol, function (filterList, colName) {
		_.each(filterList, function (filter) {
			var value = filter.getValue();

			if (spec[colName] === undefined) {
				spec[colName] = {};
			}

			if (filter.isRange()) {
				spec[colName]['$gte'] = value.start;
				spec[colName]['$lte'] = value.end;
			}
			else {
				var operator = filter.getOperator();

				if (spec[colName][operator] === undefined) {
					spec[colName][operator] = value;
				}
				else if (_.isArray(spec[colName][operator])) {
					spec[colName][operator].push(value);
				}
				else if (['$eq', '$ne', '$contains'].indexOf(operator) >= 0) {
					spec[colName][operator] = [spec[colName][operator], value];
				}
				else {
					spec[colName][operator] = value;
				}
			}
		});
	});

	debug.info('GRID FILTER SET', 'Updating with ' + self.filters.all.length + ' filters: ', spec);

	self.defn.view.setFilter(spec);

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

		filterPref.colName = filter.colName;
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

// WCGRID {{{1

/**
 * Create a new WCGrid and place it somewhere in the page.  A WCGrid consists of two major parts:
 * the decoration (e.g. titlebar and toolbar), and the underlying grid (e.g. jQWidgets or Tablesaw).
 *
 * @memberof wcgraph
 *
 * @param {string} id The ID of a DIV (which must already exist in the page) where we will put the
 * grid and its decoration.  This DIV is also known as the "tag container" because it's typically
 * created by the <WCGRID> layout tag.
 *
 * @param {object} defn The definition of the grid itself.
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
 * var wcgrid = new WCGrid('test', {...}, {...}, (grid) => {
 *   grid.jqxGrid('autoresizecolumns');
 * });
 *
 * @class
 *
 * @property {string} id The ID of the div that contains the whole tag output.
 * @property {object} defn The definition object used to create the grid.
 * @property {wcgrid_tagOpts} tagOpts Options for the grid's container.
 * @property {object} grid The underlying grid object (e.g. a jqxGrid instance).
 * @property {object} ui Contains various user interface components which are tracked for convenience.
 * @property {string} output Name of the output mode being used.
 * @property {boolean} isPivot If true, then we're using a pivot table for output.
 * @property {object} features
 * @property {boolean} features.sorting
 * @property {boolean} features.filtering
 * @property {boolean} features.editing
 * @property {boolean} features.grouping
 * @property {boolean} features.pivot
 *
 */

// Constructor {{{2

var WCGrid = function (id, defn, tagOpts, cb) {
	var self = this;

	var tagContainer = null; // Container div for the contents of the whole tag.
	var gridContainer = null; // Container div for the grid.
	var rowCount = null; // Container span for the row counter.
	var clearFilter = null; // Container span for the "clear filter" link.
	var gridToolBar = null;
	var gridToolBarHeading = null;
	var gridToolBarButtons = null;
	var doingServerFilter = getProp(defn, 'server', 'filter') && getProp(defn, 'server', 'limit') !== -1;
	var output = getProp(defn, 'table', 'output', 'method');
	var viewDropdown = null;
	var prefsCallback = null;

	// Clean up the inputs that we received.

	normalizeDefn(defn);

	debug.info('WCGRID', 'Definition: %O', defn);

	if (tagOpts === undefined) {
		tagOpts = $.extend(true, {}, {
			runImmediately: true
		});
	}

	self.id = id; // ID of the div that contains the whole tag output.
	self.defn = defn; // Definition used to retrieve data and output grid.
	self.tagOpts = tagOpts; // Other tag options, not related to the grid.
	self.grid = null; // List of all grids generated as a result.
	self.ui = {}; // User interface elements.
	self.selected = {}; // Information about what rows are selected.
	self.output = output;
	self.isPivot = (self.output === 'pivot' ? true : false);

	self.defn.wcgrid = self;

	self.features = {
		editing: getPropDef(false, self.defn, 'table', 'enableEditing'),
		filtering: getPropDef(false, self.defn, 'table', 'enableFiltering'),
		sorting: getPropDef(false, self.defn, 'table', 'enableSorting'),
		grouping: getPropDef(false, self.defn, 'table', 'enableGrouping'),
		rowSelection: getPropDef(false, self.defn, 'table', 'enableRowSelection'),
		rowReordering: getPropDef(false, self.defn, 'table', 'enableRowReordering'),
	};

	// If the ID was specified as a jQuery object, extract the ID from the element.

	if (_.isArray(id) && id[0] instanceof jQuery) {
		id = id[0];
	}

	if (id instanceof jQuery) {
		id = id.attr('id');
	}

	if (typeof id !== 'string') {
		throw '<wcgrid> "id" is not a string';
	}

	if (document.getElementById(id) === null) {
		throw 'No element exists with given ID: ' + id;
	}

	defn._id = id;

	defn.table = defn.table || {};

	defn.table.id = id + '_gridContainer';

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

		// Invoke the callback for the WCGRID constructor, after the grid has been created.  Sometimes
		// people want to start manipulating the grid from JS right away.

		if (typeof cb === 'function') {
			cb(self.grid);
		}
	};

	if (self.defn.source instanceof DataSource) {
		if (self.defn.view === undefined) {
			self.defn.view = new DataView(self.defn.source, defn, self);
		}

		self.defn.view.subscribe(function () {
			var args = Array.prototype.slice.call(arguments);
			var dv = args[0]
				, msg = args[1]
				, info = args[2];

			debug.info('WCGRID', 'Received message "%s" from data view: %O', msg, info);
		});

		self.defn.source.subscribe(function () {
			var args = Array.prototype.slice.call(arguments);
			var ds = args[0]
				, msg = args[1]
				, rest = args.slice(2);

			debug.info('WCGRID', 'Received message "%s" from data source "%s": %O', msg, ds.name, rest);
			switch (msg) {
			case DataSource.messages.DATA_UPDATED:
				self.refresh();
				break;
			}
		});
	}

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

	window.wcgrid = window.wcgrid || {};
	window.wcgrid[id] = self;
};

// #addHeaderWidgets {{{2

/**
 * Add widgets to the header of the grid.
 *
 * @method
 * @memberof WCGRID
 * @private
 *
 * @param {object} header
 * @param {boolean} doingServerFilter If true, then we are filtering and sorting on the server.
 * @param {boolean} runImmediately If true, then the grid will be refreshed right away.
 * @param {string} id
 */

WCGrid.prototype._addHeaderWidgets = function (header, doingServerFilter, runImmediately, id) {
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
						switch (self.output) {
						case 'jqwidgets':
							self.grid.jqxGrid('clearfilters');
							break;
						default:
							if (self.defn.gridFilterSet !== undefined) {
								self.defn.gridFilterSet.reset();
							}
							break;
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
 * @memberof WCGRID
 * @private
 */

WCGrid.prototype._addCommonButtons = function (toolbar) {
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
 * @memberof WCGRID
 * @private
 */

WCGrid.prototype._addPrefsButtons = function (toolbar) {
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
 * @memberof WCGRID
 */

WCGrid.prototype.refresh = function () {
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

	delete self.gridTable;
	delete self.pivotControl;

	if (self.isPivot) {
		debug.info('WCGRID', 'Creating PivotControl for pivot table output');
		self.pivotControl = new PivotControl(self.defn, self.defn.view, self.features);
		self.pivotControl.draw(self.ui.gridContainer, self.tableDoneCont);
	}
	else {
		debug.info('WCGRID', 'Creating GridTable for normal output');
		self.gridTable = new GridTable(self.defn, self.defn.view, self.features);
		self.gridTable.draw(self.ui.gridContainer, self.tableDoneCont);
	}
};

// #redraw {{{2

/**
 * Redraws the data from the data view in the grid.
 *
 * @method
 * @memberof WCGRID
 */

WCGrid.prototype.redraw = function () {
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
 * @memberof WCGRID
 *
 * @param {number} numRows The number of rows, filtered.
 * @param {number} totalRows The total number of rows.
 */

WCGrid.prototype.updateRowCount = function (numRows, totalRows) {
	var self = this
		, doingServerFilter = getProp(self.defn, 'server', 'filter') && getProp(self.defn, 'server', 'limit') !== -1;

	debug.info('WCGRID', 'Updating row count');

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

	if (getProp(self.defn, 'table', 'output', 'method') === 'jqwidgets') {
		numRows = self.grid.jqxGrid('getrows').length;
		if (self.grid.jqxGrid('getfilterinformation').length !== 0) {
			if (doingServerFilter || totalRows === undefined || totalRows === null) {
				self.ui.rowCount.text(numRows + ' row(s), filtered');
			}
			else {
				self.ui.rowCount.text(numRows + ' / ' + totalRows + ' row(s), filtered');
			}
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
	}
	else {
		self.ui.rowCount.text(self.defn._data[0].length + ' row(s)');
	}
};

// #hideGrid {{{2

/**
 * Hide the grid.
 *
 * @method
 * @memberof WCGRID
 */

WCGrid.prototype.hideGrid = function () {
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
 * @memberof WCGRID
 */

WCGrid.prototype.showGrid = function () {
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
 * @memberof WCGRID
 */

WCGrid.prototype.toggleGrid = function () {
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
 * @memberof WCGRID
 *
 * @returns {boolean} True if the grid is currently visible, false if it is not.
 */

WCGrid.prototype.isGridVisible = function () {
	return this.ui.grid.css('display') !== 'none';
};

// #setSpinner {{{2

WCGrid.prototype.setSpinner = function (what) {
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

WCGrid.prototype.showSpinner = function () {
	var self = this;

	if (self.tagOpts.title) {
		self.ui.spinner.show();
	}
};

// #hideSpinner {{{2

WCGrid.prototype.hideSpinner = function () {
	var self = this;

	if (self.tagOpts.title) {
		self.ui.spinner.hide();
	}
};

// #enablePivot {{{2

WCGrid.prototype.enablePivot = function () {
	var self = this;

	if (self.isPivot) {
		return;
	}

	self.togglePivot();
};

// #disablePivot {{{2

WCGrid.prototype.disablePivot = function () {
	var self = this;

	if (!self.isPivot) {
		return;
	}

	self.togglePivot();
};

// #togglePivot {{{2

WCGrid.prototype.togglePivot = function () {
	var self = this;

	self.isPivot = !self.isPivot;
	self.refresh();
};

// #drawPivotControl {{{2

/**
 * Draw the areas at the top and left of the data table which allow the user to manipulate the data
 * table as a pivot table.
 */

WCGrid.prototype.drawPivotControl = function () {
};

// PivotControl {{{1

/**
 * @class PivotControl
 *
 * @property {Object} defn
 *
 * @property {DataView} view
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
 * @param {DataView} view
 */

function PivotControl(defn, view, features) {
	var self = this;

	if (defn === undefined) {
		throw new Error('PivotControl(): Missing required argument: defn');
	}

	if (view === undefined) {
		throw new Error('PivotControl(): Missing required argument: view');
	}
	else if (!(view instanceof DataView)) {
		throw new Error('PivotControl(): Argument "view" must be an instance of DataView');
	}

	if (features === undefined) {
		throw new Error('PivotControl(): Missing required argument: features');
	}

	self.defn = defn;
	self.view = view;
	self.features = features;

	// Create a new grid table to show the pivotted data.  Make sure that we disable some of the
	// features that don't make sense when showing a pivot table.

	self.gridTable = new GridTable(self.defn, self.view, {
		filtering: false,
		rowSelection: false,
		rowReordering: false
	});

	self.gridFilterSet = new GridFilterSet(self.defn);
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

	self.gridTable.draw(self.ui.table);
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

	self.gridTable.draw(self.ui.table);
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

	self.view.getData(function () {
		self.view.getTypeInfo(function (typeInfo) {
			var cols = _.keys(typeInfo);

			if (self.defn.table.columns !== undefined) {
				cols = _.union(_.reject(self.defn.table.columns, function (x) { return x === '_DEFAULT'; }), cols);
			}

			cols = _.reject(cols, function (colName) {
				return colName.charAt(0) === '_' || isColumnHidden(self.defn, colName);
			});

			debug.info('GRIDTABLE', 'Columns = %O', cols);

			_.each(cols, function (fieldName) {
				self.fields[fieldName] = new PivotControlField(self, fieldName, self.features);
				self.fields[fieldName].appendTo(self.ui.available);
			});
			self.gridTable.draw(self.ui.table, tableDoneCont);
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

// Exports {{{1

window.MIE = window.MIE || {};

window.MIE.trans = I;
window.MIE.WCGrid = WCGrid;
