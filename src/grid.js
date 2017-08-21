// Determine Columns {{{1

function validateUserColumnSpec(defn, data, typeInfo) {

	// Error checking for `defn.table.columns` to make sure it:
	//
	//   1. Has the correct format.
	//   2. Only defines fields which actually exist.

	if (defn.table.columns !== undefined) {
		if (!_.isArray(defn.table.columns)) {
			throw new GridTablePlainError('Determine Columns / (table.columns) must be an array');
		}

		_.each(defn.table.columns, function (elt, i) {
			if (elt.field === undefined) {
				throw new GridTablePlainError('Determine Columns / Missing (table.columns[' + i + '].field)');
			}
		});

		// Check the user's column specification against the data, if it's available.

		if (!isNothing(data)) {
			if ((data.isPivot && (data.data.length === 0 || data.data[0].length === 0 || data.data[0][0].length === 0))
					|| (!data.isPivot && data.isGroup && (data.data.length === 0 || data.data[0].length === 0))
					|| (data.isPlain && (data.data.length === 0))) {
				log.warn('Unable to check column configuration using data with no rows');
				return false;
			}
			else {
				_.each(defn.table.columns, function (elt, i) {
					if ((data.isPivot && data.data[0][0][0].rowData[elt.field] === undefined)
							|| (!data.isPivot && data.isGroup && data.data[0][0].rowData[elt.field] === undefined)
							|| (data.isPlain && data.data[0].rowData[elt.field] === undefined)) {
						log.warn('Column configuration refers to field "' + elt.field + '" which does not exist in the data');
						return false;
					}
				});
			}
		}
	}

	return true;
}

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

	validateUserColumnSpec(defn, data, typeInfo);

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

function availableFields(defn, data, typeInfo) {
	var fields = [];

	if (defn.table.columns && validateUserColumnSpec(defn, data, typeInfo)) {
		fields = _.pluck(defn.table.columns, 'field');
	}
	else {
		fields = _.reject(typeInfo.keys(), function (field) {
			return field.charAt(0) === '_';
		});
	}

	return fields;
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
 *
 * @property {boolean} [blockUI=false] If true, use BlockUI to prevent interaction with the table
 * while the View is doing something.
 *
 * @property {boolean} [nprogress=false] If true, use nprogress to show the progress of sort/filter
 * operations that the View is performing.
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

var Grid = function (id, view, defn, tagOpts, cb) {
	var self = this;

	var rowCount = null; // Container span for the row counter.
	var clearFilter = null; // Container span for the "clear filter" link.
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
	self.view = view;

	self.defn.grid = self;

	self._validateFeatures();
	self._validateId(id);

	/*
	 * Set up other container elements.
	 */

	self.ui.root = jQuery(document.getElementById(id))
		.addClass('wcdv_grid')
		.attr('data-title', id + '_title');

	if (tagOpts.title) {
		if (!_.isString(tagOpts.title)) {
			throw '<tagOpts.title> is not a string';
		}
		
		self.ui.gridToolBar = jQuery('<div>')
			.addClass('wcdv_grid_toolbar')
			.appendTo(self.ui.root)
			.droppable({
				over: function (evt, ui) {
					self.ui.gridToolBarButtons.show();
					self.ui.gridControl.show();

					// Need to recalculate the position of the droppable targets, because they are now
					// guaranteed to be visible (they may have been hidden within the grid control before).

					ui.draggable.draggable('option', 'refreshPositions', true);
				}
			});

		self.ui.gridToolBarHeading = jQuery('<div class="heading">')
			.attr('title', MIE.trans('SHOWHIDE'))
			.on('click', function (evt) {
				evt.stopPropagation();
				self.toggleGrid();
			})
			.appendTo(self.ui.gridToolBar);
		self.ui.gridToolBarButtons = jQuery('<div class="buttons">').appendTo(self.ui.gridToolBar);

		self._addHeaderWidgets(self.ui.gridToolBarHeading, doingServerFilter, !!self.tagOpts.runImmediately, id);
		self._addCommonButtons(self.ui.gridToolBarButtons);

		if (getProp(self.defn, 'table', 'prefs', 'enableSaving')) {
			prefsCallback = self._addPrefsButtons(self.ui.gridToolBarButtons);
		}
	}

	self.ui.gridControl = jQuery('<div>', { 'class': 'wcdv_grid_control' });
	self.ui.groupControl = jQuery('<div>', { 'class': 'wcdv_group_control' });
	self.ui.filterControl = jQuery('<div>', { 'class': 'wcdv_filter_control' });
	self.ui.pivotControl = jQuery('<div>', { 'class': 'wcdv_pivot_control' });
	self.ui.grid = jQuery('<div>', { 'id': defn.table.id, 'class': 'wcdv_grid_table' });

	self.ui.gridControl
		.append(self.ui.groupControl)
		.append(self.ui.filterControl)
		.append(self.ui.pivotControl)
		.appendTo(self.ui.gridToolBarButtons);

	self.ui.grid.appendTo(self.ui.root);

	if (document.getElementById(id + '_footer')) {
		// There was a footer which was printed out by dashboard.c which we are now going to move
		// inside the structure that we've been creating.

		self.ui.footer = jQuery(document.getElementById(id + '_footer'))
			.css('display', 'block')
			.appendTo(self.ui.gridControl);
	}

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
		self.setSpinner('working');
		self.showSpinner();
	});

	self.view.on(View.events.workEnd, function (info, ops) {
		self.hideSpinner();
		self.updateRowCount(info, ops);
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

Grid.prototype = Object.create(Object.prototype);
Grid.prototype.constructor = Grid;

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
		'tabletool',
		'block',
		'progress'
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
			jQuery(this).parents('.wcdv_grid').find('.buttons').toggle();
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

	var makeCheckbox = function (init, onClick, text, parent) {
		jQuery('<label>')
			.append(jQuery('<input>', { 'type': 'checkbox', 'checked': init })
							.on('change', onClick))
			.append(text)
			.appendTo(parent);
	};

	self.ui.refreshLink = jQuery('<button>')
		.append(fontAwesome('F021'))
		.text('Refresh')
		.on('click', function () {
			self.refresh();
		})
		.appendTo(toolbar);

	setPropDef(true, self.defn, 'table', 'limit', 'autoShowMore');

	makeCheckbox(self.defn.table.limit.autoShowMore, function () {
		var isChecked = jQuery(this).prop('checked');
		debug.info('GRID // TOOLBAR', 'Setting `table.limit.autoShowMore` to ' + isChecked);
		self.defn.table.limit.autoShowMore = isChecked;
	}, 'Show More Rows on Scroll', toolbar);

	jQuery('<button>')
		.on('click', function (evt) {
			self.gridTable.updateFeatures({
				'blockUI': true,
				'progress': true,
				'limit': false
			});
		})
		.text('Show All Rows')
		.appendTo(toolbar);

	/*
	makeCheckbox(self.features.group, function () {
		if (jQuery(this).prop('checked')) {
			self.enableGroup();
		}
		else {
			self.disableGroup();
		}
	}, 'Enable Grouping', toolbar);

	makeCheckbox(self.features.pivot, function () {
		if (jQuery(this).prop('checked')) {
			self.enablePivot();
		}
		else {
			self.disablePivot();
		}
	}, 'Enable Pivot', toolbar);
	*/
};

// #addPrefsButtons {{{2

/**
 * @method
 * @memberof Grid
 * @private
 */

Grid.prototype._addPrefsButtons = function (toolbar) {
	var self = this;

	jQuery('<button>')
		.text('Clear Prefs')
		.on('click', function () {
			self.defn.prefs.save(null, false, function () {
				self.refresh();
			});
		})
		.appendTo(toolbar)

	jQuery('<button>')
		.text('Set Defaults')
		.on('click', function () {
			self.defn.prefs.save(undefined, true, null);
		})
		.appendTo(toolbar)

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
		})

	var newViewCancel =
		$('<button>', { 'type': 'button' })
		.html(fontAwesome('F05E'))
		.on('click', function () {
			newViewInput.val('');
			newView.hide();
			curView.show();
		})

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

	debug.info('GRID', 'Refreshing...');

	if (self.tagOpts.title) {
		self.setSpinner('loading');
		self.showSpinner();
		self.ui.rowCount.text('');
	}

	self.view.clearCache();

	if (self.tagOpts.filterInput) {
		self.tagOpts.filterInput.store();
	}

	if (self.features.group) {
		self.groupControl = new GroupControl(self.defn, self.view, self.features, self.timing);
		self.ui.groupControl.children().remove();
		self.groupControl.draw(self.ui.groupControl);
		self.ui.groupControl.show();
	}
	else {
		self.ui.groupControl.hide();
	}

	if (false && self.features.filter) { // XXX
		self.filterControl = new FilterControl(self.defn, self.view, self.features, self.timing);
		self.ui.filterControl.children().remove();
		self.filterControl.draw(self.ui.filterControl);
		self.ui.filterControl.show();
	}
	else {
		self.ui.filterControl.hide();
	}

	if (self.features.pivot) {
		self.pivotControl = new PivotControl(self.defn, self.view, self.features, self.timing, {
			onAggregateChange: function (aggFun, aggField) {
				if (!(self.gridTable instanceof GridTablePivot)) {
					return;
				}

				debug.info('GRID // ON AGGREGATE CHANGE', 'Redrawing pivot table: { aggFun = "%s", aggField = "%s" }', aggFun, aggField);
				self.gridTable.clear();
				self.gridTable.draw(self.ui.grid, self.tableDoneCont, {
					pivotConfig: {
						aggFun: aggFun,
						aggField: aggField
					}
				});
			}
		});
		self.ui.pivotControl.children().remove();
		self.pivotControl.draw(self.ui.pivotControl);
		self.ui.pivotControl.show();
	}
	else {
		self.ui.pivotControl.hide();
	}

	/*
	if (self.features.pivot) {
		debug.info('GRID', 'Creating GridTablePivot for pivot table output');
		self.gridTable = new GridTablePivot(self.defn, self.view, self.features, self.timing, self.id);
	}
	else if (self.features.group) {
		debug.info('GRID', 'Creating GridTableGroup for group table output');
		self.gridTable = new GridTableGroup(self.defn, self.view, self.features, self.timing, self.id);
	}
	else {
		debug.info('GRID', 'Creating GridTablePlain for plain table output');
		self.gridTable = new GridTablePlain(self.defn, self.view, self.features, self.timing, self.id);
	}
	*/

	var makeGridTable = function (viewOps) {
		debug.info('GRID', 'Creating grid table to handle the data: { group = %s, pivot = %s }', viewOps.group, viewOps.pivot);
		var ctor = viewOps.pivot ? GridTablePivot : viewOps.group ? GridTableGroup : GridTablePlain;

		if (self.gridTable) {
			self.gridTable.clear();
		}

		self.gridTable = new ctor(self.defn, self.view, self.features, self.timing, self.id);
		self.gridTable.on(GridTable.events.unableToRender, makeGridTable);
		self.gridTable.draw(self.ui.grid, self.tableDoneCont); // TODO load prefs
	};

	makeGridTable(false, false);
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
 */

Grid.prototype.updateRowCount = function (info, ops) {
	var self = this
		, doingServerFilter = getProp(self.defn, 'server', 'filter') && getProp(self.defn, 'server', 'limit') !== -1;

	debug.info('GRID', 'Updating row count');
	self.setSpinner('working');

	// When there's no titlebar, there's nothing for us to do here.

	if (!self.tagOpts.title) {
		return;
	}

	self.hideSpinner();

	if (info.isPlain) {
		if (info.totalRows) {
			self.ui.rowCount.text(info.numRows + ' / ' + info.totalRows + ' row(s), filtered');
		}
		else {
			self.ui.rowCount.text(info.numRows + ' row(s)');
		}
	}
	else if (info.isGroup) {
		self.ui.rowCount.text(info.numGroups + ' group(s)');
	}
	else if (info.isPivot) {
		self.ui.rowCount.text('Pivotted');
	}

	if (self.ui.clearFilter) {
		if (info.totalRows) {
			self.ui.clearFilter.show();
		}
		else {
			self.ui.clearFilter.hide();
		}
	}
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

	debug.info('GRID', 'Hiding...');

	self.ui.gridControl.slideUp({
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

	debug.info('GRID', 'Showing...');

	self.ui.gridControl.slideDown({
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
	if (this.ui.gridControl.css('display') === 'none') {
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

// #enableGroup {{{2

Grid.prototype.enableGroup = function () {
	var self = this;

	if (self.features.group) {
		return;
	}

	self.toggleGroup();
};

// #disableGroup {{{2

Grid.prototype.disableGroup = function () {
	var self = this;

	if (!self.features.group) {
		return;
	}

	self.toggleGroup();
};

// #toggleGroup {{{2

Grid.prototype.toggleGroup = function () {
	var self = this;

	self.features.group = !self.features.group;

	if (!self.features.group) {
		self.view.clearGroup();
	}

	self.refresh();
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

	if (!self.features.group) {
		self.view.clearGroup();
	}

	self.refresh();
};

// GridControl {{{1

function GridControl() {
}

GridControl.prototype = Object.create(Object.prototype);
GridControl.prototype.constructor = GridControl;

// #init {{{2

GridControl.prototype.init = function (defn, view, features, timing) {
	var self = this;

	self.defn = defn;
	self.view = view;
	self.features = features;
	self.timing = timing;
	self.ui = {};
	self.colConfig = _.indexBy(getPropDef({}, self.defn, 'table', 'columns'), 'field');
};

// #makeAddButton {{{2

GridControl.prototype.makeAddButton = function (target) {
	var self = this;

	jQuery(fontAwesome('F0FE'))
		.addClass('wcdv_button')
		.css({'margin-left': '4px'})
		.on('click', function () {
			self.addField(self.ui.dropdown.val());
		})
		.appendTo(target);
};

// #makeClearButton {{{2

GridControl.prototype.makeClearButton = function (target) {
	var self = this;

	return jQuery(fontAwesome('F05E'))
		.addClass('wcdv_button')
		.css('margin-left', '4px')
		.hide()
		.on('click', function () {
			jQuery(this).hide();
			self.clear();
		})
		.appendTo(target);
};

// #addField {{{2

GridControl.prototype.addField = function (field) {
	var self = this
		, gcf = new self.controlFieldCtor(self, field, self.colConfig[field] || {});

	self.ui.clearBtn.show();

	jQuery('<li>').append(gcf.draw()).appendTo(self.ui.fields); // Add it to the DOM.

	self.ui.dropdown.find('option').filter(function () {
		return jQuery(this).val() === field;
	}).prop('disabled', true);

	self.fields.push(field); // Add it to the fields array.
	self.updateView();
};

// #removeField {{{2

GridControl.prototype.removeField = function (cf) {
	var self = this
		, fieldIndex = self.fields.indexOf(cf.field);

	cf.getElement().parent('li').remove(); // Remove it from the DOM.
	self.fields.splice(fieldIndex, 1); // Remove it from the fields array.

	self.ui.dropdown.find('option').filter(function () {
		return jQuery(this).val() === cf.field;
	}).prop('disabled', false);

	if (self.fields.length === 0) {
		self.ui.clearBtn.hide();
	}

	self.updateView();
};

// #clear {{{2

GridControl.prototype.clear = function () {
	var self = this;

	self.fields = [];
	self.ui.fields.children().remove();
	self.ui.dropdown.find('option:disabled').prop('disabled', false);
	self.updateView();
};

// GroupControl {{{1

// Constructor {{{2

/**
 * Part of the user interface which governs the fields that are part of the group, including
 * filtering.
 *
 * @param {object} defn
 *
 * @param {View} view
 *
 * @param {Grid~Features} features
 *
 * @param {object} timing
 */

function GroupControl() {
	var self = this;

	self.super = makeSuper(self, GridControl);
	self.super.init.apply(self, arguments);

	self.fields = [];
}

GroupControl.prototype = Object.create(GridControl.prototype);
GroupControl.prototype.constructor = GroupControl;

GroupControl.prototype.controlFieldCtor = GroupControlField;

// #draw {{{2

/**
 * Create a DIV element that can be placed within the Grid instance to hold the user interface for
 * the GroupControl.  The caller must add the result to the DOM somewhere.
 *
 * @returns {jQuery} The DIV element that holds the entire UI.
 */

GroupControl.prototype.draw = function (parent) {
	var self = this;

	parent.droppable({
		classes: {
			'ui-droppable-hover': 'wcdv_drop_target_hover'
		},
		drop: function (evt, ui) {
			// Turn this off for the sake of efficiency.
			ui.draggable.draggable('option', 'refreshPositions', false);

			self.addField(ui.draggable.attr('data-wcdv-field'));
		}
	});

	self.ui.root = jQuery('<div>').appendTo(parent);
	self.ui.title = jQuery('<div>')
		.addClass('wcdv_control_title_bar')
		.appendTo(self.ui.root);
	jQuery('<span>', { 'class': 'wcdv_control_title' })
		.text('Group Fields')
		.appendTo(self.ui.title);
	self.ui.clearBtn = self.makeClearButton(self.ui.title);
	self.ui.fields = jQuery('<ul>').appendTo(self.ui.root);

	var dropdownContainer = jQuery('<div>').appendTo(self.ui.root);
	self.ui.dropdown = jQuery('<select>').appendTo(dropdownContainer);
	self.makeAddButton(dropdownContainer);

	self.view.on('getTypeInfo', function (typeInfo) {
		self.ui.dropdown.children().remove();
		_.each(availableFields(self.defn, null, typeInfo), function (fieldName) {
			var text = getProp(self.colConfig, fieldName, 'displayText') || fieldName;
			jQuery('<option>', { 'value': fieldName }).text(text).appendTo(self.ui.dropdown);
		});
	}, { limit: 1 });

	return self.ui.root;
};

// #updateView {{{2

GroupControl.prototype.updateView = function () {
	var self = this;

	if (self.fields.length > 0) {
		self.view.setGroup({fieldNames: self.fields});
	}
	else {
		self.view.clearGroup();
	}
};

// PivotControl {{{1

// Constructor {{{2

/**
 * Used to inform other parties of the aggregate function configuration.  For example, it can be
 * used to have the grid table redraw its contents (rendering cells with the new aggregate function
 * and field).
 *
 * @callback PivotControl~onAggregateChange
 *
 * @param {string} aggFun
 * Name of the aggregate function to use.
 *
 * @param {string} aggField
 * Name of the field to apply the function on (if applicable; decided by the `needsField` property
 * of the aggregate object).
 */

/**
 * Part of the user interface which governs: (1) the fields that are part of the pivot, including
 * filtering; (2) the aggregate function [and potentially its arguments] that produces the values in
 * the pivot table.
 *
 * @class
 *
 * @property {GridControl} super
 * Proxy to call prototype ("superclass") methods even if we override them.
 *
 * @property {object} opts
 *
 * @property {PivotControl~onAggregateChange} opts.onAggregateChange
 * If set, this function will be called when the aggregate configuration is changed.  It is
 * currently used to redraw the grid table with the new aggregate function results in its cells.
 *
 * @property {string[]} fields
 * Names of the fields 
 */

function PivotControl() {
	var self = this
		, args = Array.prototype.slice.call(arguments)
		, opts = args.pop();

	self.super = makeSuper(self, GridControl);
	self.super.init.apply(self, args);
	self.opts = opts;

	self.fields = [];
}

PivotControl.prototype = Object.create(GridControl.prototype);
PivotControl.prototype.constructor = PivotControl;

PivotControl.prototype.controlFieldCtor = PivotControlField;

// #draw {{{2

/**
 * Create a DIV element that can be placed within the Grid instance to hold the user interface for
 * the PivotControl.  The caller must add the result to the DOM somewhere.
 *
 * @returns {jQuery} The DIV element that holds the entire UI.
 */

PivotControl.prototype.draw = function (parent) {
	var self = this;

	self.ui.root = jQuery('<div>').appendTo(parent);

	self.ui.aggContainer = jQuery('<div>', { 'class': 'wcdv_aggregate_container' }).appendTo(self.ui.root).hide();
	self.ui.aggregateTitle = jQuery('<div>')
		.addClass('wcdv_control_title_bar')
		.appendTo(self.ui.aggContainer);
	jQuery('<span>')
		.addClass('wcdv_control_title')
		.text('Pivot Aggregate')
		.appendTo(self.ui.aggregateTitle);
	self.ui.aggFun = jQuery('<div>').css({'margin-top': '7px'}).appendTo(self.ui.aggContainer);
	jQuery('<label>').text('Function:').appendTo(self.ui.aggFun);
	self.ui.aggFunDropdown = jQuery('<select>')
		.appendTo(self.ui.aggFun)
		.on('change', function () {
			self.triggerAggChange();
		})
	;

	_.each(AGGREGATES, function (aggObj, aggFunName) {
		if (aggObj.canBePivotCell) {
			jQuery('<option>').text(aggFunName).appendTo(self.ui.aggFunDropdown);
		}
	});

	self.ui.aggField = jQuery('<div>').css({'margin-top': '4px'}).appendTo(self.ui.aggContainer).hide();
	jQuery('<label>').text('Field:').appendTo(self.ui.aggField);
	self.ui.aggFieldDropdown = jQuery('<select>')
		.appendTo(self.ui.aggField)
		.on('change', function () {
			self.triggerAggChange();
		})
	;
	
	self.ui.fieldsContainer = jQuery('<div>')
		.droppable({
			classes: {
				'ui-droppable-hover': 'wcdv_drop_target_hover'
			},
			drop: function (evt, ui) {
				// Turn this off for the sake of efficiency.
				ui.draggable.draggable('option', 'refreshPositions', false);

				self.addField(ui.draggable.attr('data-wcdv-field'));
			}
		})
		.addClass('wcdv_pivot_fields_container')
		.appendTo(self.ui.root);
	self.ui.fieldsTitle = jQuery('<div>')
		.addClass('wcdv_control_title_bar')
		.appendTo(self.ui.fieldsContainer);
	jQuery('<span>')
		.addClass('wcdv_control_title')
		.text('Pivot Fields')
		.appendTo(self.ui.fieldsTitle);
	self.ui.clearBtn = self.makeClearButton(self.ui.fieldsTitle);
	self.ui.fields = jQuery('<ul>')
		.appendTo(self.ui.fieldsContainer);

	var dropdownContainer = jQuery('<div>').appendTo(self.ui.fieldsContainer);
	self.ui.dropdown = jQuery('<select>').appendTo(dropdownContainer);
	self.makeAddButton(dropdownContainer);

	self.view.on('getTypeInfo', function (typeInfo) {
		self.ui.dropdown.children().remove();
		_.each(availableFields(self.defn, null, typeInfo), function (fieldName) {
			var text = getProp(self.colConfig, fieldName, 'displayText') || fieldName;
			jQuery('<option>', { 'value': fieldName }).text(text).appendTo(self.ui.aggFieldDropdown);
			jQuery('<option>', { 'value': fieldName }).text(text).appendTo(self.ui.dropdown);
		});
	}, { limit: 1 });

	return self.ui.root;
};

// #updateView {{{2

/**
 * Set the pivot configuration on the View.  The pivot configuration consists of:
 *
 *   - Fields that are part of the pivot.
 */

PivotControl.prototype.updateView = function () {
	var self = this;

	if (self.fields.length > 0) {
		self.ui.aggContainer.show();
		self.view.setPivot({fieldNames: self.fields});
	}
	else {
		self.view.clearPivot();
		self.ui.aggContainer.hide();
	}
};

// #triggerAggChange {{{2

/**
 * Perform necessary actions when the aggregate function is changed.
 *
 *   - Update the UI to show/hide field argument.
 *   - Invoke the `onAggregateChange` function.
 */

PivotControl.prototype.triggerAggChange = function () {
	var self = this
		, agg = AGGREGATES[self.ui.aggFunDropdown.val()];

	if (agg.needsField) {
		self.ui.aggField.show();
		if (typeof self.opts.onAggregateChange === 'function') {
			self.opts.onAggregateChange(self.ui.aggFunDropdown.val(), self.ui.aggFieldDropdown.val());
		}
	}
	else {
		self.ui.aggField.hide();
		if (typeof self.opts.onAggregateChange === 'function') {
			self.opts.onAggregateChange(self.ui.aggFunDropdown.val());
		}
	}
};

// FilterControl {{{1

// Constructor {{{2

/**
 * Part of the user interface which lets users filter columns.
 *
 * @param {object} defn
 *
 * @param {View} view
 *
 * @param {Grid~Features} features
 *
 * @param {object} timing
 */

function FilterControl() {
	var self = this;

	self.super = makeSuper(self, GridControl);
	self.super.init.apply(self, arguments);
}

FilterControl.prototype = Object.create(GridControl.prototype);
FilterControl.prototype.constructor = FilterControl;

// #draw {{{2

/**
 * Create a DIV element that can be placed within the Grid instance to hold the user interface for
 * the FilterControl.  The caller must add the result to the DOM somewhere.
 *
 * @returns {jQuery} The DIV element that holds the entire UI.
 */

FilterControl.prototype.draw = function () {
	var self = this;

	self.ui.root = jQuery('<div>');
	self.ui.title = jQuery('<span>', { 'class': 'wcdv_title' }).text('Filter').appendTo(self.ui.root);
	self.ui.fields = jQuery('<ul>').appendTo(self.ui.root);

	var dropdownContainer = jQuery('<div>').appendTo(self.ui.root);
	self.ui.dropdown = jQuery('<select>').appendTo(dropdownContainer);
	self.makeAddButton(dropdownContainer);

	self.view.on('getTypeInfo', function (typeInfo) {
		self.ui.dropdown.children().remove();
		_.each(availableFields(self.defn, null, typeInfo), function (fieldName) {
			var text = getProp(self.colConfig, fieldName, 'displayText') || fieldName;
			jQuery('<option>', { 'value': fieldName }).text(text).appendTo(self.ui.dropdown);
		});
	}, { limit: 1 });

	return self.ui.root;
};


// #updateView {{{2

FilterControl.prototype.updateView = function () {
	var self = this;

	if (self.fields.length > 0) {
		self.view.setGroup({fieldNames: self.fields});
	}
	else {
		self.view.clearGroup();
	}
};

// GridControlField {{{1

function GridControlField() {
}

GridControlField.prototype = Object.create(Object.prototype);
GridControlField.prototype.constructor = GridControlField;

// #init {{{2

GridControlField.prototype.init = function (control, field, colConfig) {
	var self = this;

	self.control = control;
	self.field = field;
	self.colConfig = colConfig;
	self.ui = {};
};

// #draw {{{2

GridControlField.prototype.draw = function () {
	var self = this;

	self.ui.root = jQuery('<div>', { 'class': 'wcdv_field' })
		.append(
			jQuery(fontAwesome('F146'))
			.attr('title', 'Remove')
			.addClass('wcdv_button wcdv_remove')
			.on('click', function () {
				self.control.removeField(self);
			})
		)
		.append(jQuery('<span>').text(self.colConfig.displayText || self.field))
	;

	return self.ui.root;
};

// #getElement {{{2

GridControlField.prototype.getElement = function () {
	var self = this;

	return self.ui.root;
};

// GroupControlField {{{1

function GroupControlField() {
	var self = this;

	self.super = makeSuper(self, GridControlField);
	self.super.init.apply(self, arguments);
};

GroupControlField.prototype = Object.create(GridControlField.prototype);
GroupControlField.prototype.constructor = GroupControlField;

// PivotControlField {{{1

function PivotControlField() {
	var self = this;

	self.super = makeSuper(self, GridControlField);
	self.super.init.apply(self, arguments);
};

PivotControlField.prototype = Object.create(GridControlField.prototype);
PivotControlField.prototype.constructor = PivotControlField;
