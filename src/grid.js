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

	if (getProp(defn, 'table', 'columns')) {
		columns = _.pluck(defn.table.columns, 'field');
	}
	else if (typeInfo.size() > 0) {
		columns = _.reject(typeInfo.keys(), function (field) {
			return field.charAt(0) === '_';
		});
	}
	else if (data.isPlain && data.data.length > 0) {
		columns = _.keys(data.data[0].rowData);
	}
	else if (data.isGroup && data.data[0].length > 0) {
		columns = _.keys(data.data[0][0].rowData);
	}
	else if (data.isPivot && data.data[0][0].length > 0) {
		columns = _.keys(data.data[0][0][0].rowData);
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
 *
 * @property {boolean} rootHasFixedHeight
 * If true, then the root DIV element has a fixed height (e.g. "600px") and the grid must fit within
 * that size.  Basically, this controls the "overflow" CSS property of the grid table, and also the
 * scroll handler for when a grid table automatically shows more rows.
 */

var Grid = function (id, view, defn, tagOpts, cb) {
	var self = this;

	var rowCount = null; // Container span for the row counter.
	var clearFilter = null; // Container span for the "clear filter" link.
	var doingServerFilter = getProp(defn, 'server', 'filter') && getProp(defn, 'server', 'limit') !== -1;
	var viewDropdown = null;

	self.rootHasFixedHeight = false;
	self.timing = new Timing();

	// Clean up the inputs that we received.

	self.normalize(defn);

	// HACK The *only* reason we need this is so that the aggregate functions which do formatting
	// (e.g. group concat) know how to format non-string values like currency.  There's got to be a
	// better way to do this.

	view.colConfig = self.colConfig;

	debug.info('GRID', 'Definition: %O', defn);

	if (isNothing(view)) {
		throw new GridError('The `view` argument is required');
	}

	if (!(view instanceof View)) {
		throw new GridError('The `view` argument must be an instance of MIE.View');
	}

	deepDefaults(true, tagOpts, {
		runImmediately: true
	});

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

	self.ui.root.children().remove();

	if (self.ui.root.height() !== 0) {
		self.rootHasFixedHeight = true;
	}

	if (self.view.source.origin instanceof FileSource) {
		self.ui.root._onFileDrop(function (files) {
			self.view.source.origin.setFiles(files);
		});
	}

	if (tagOpts.title) {
		if (!_.isString(tagOpts.title)) {
			throw '<tagOpts.title> is not a string';
		}

		self.ui.gridToolBar = jQuery('<div>')
			.addClass('wcdv_grid_toolbar')
			.appendTo(self.ui.root)
			.droppable({
				over: function (evt, ui) {
					self.ui.controls.show();

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

		self.ui.gridToolBarButtons = jQuery('<div class="buttons">')
			.appendTo(self.ui.gridToolBar);

		self.addHeaderWidgets(self.ui.gridToolBarHeading, doingServerFilter, !!self.tagOpts.runImmediately, id);

		self.ui.toolbar = {};

		self.ui.toolbar.source = jQuery('<div>')
			.addClass('wcdv_toolbar_section')
			.appendTo(self.ui.gridToolBarButtons);
		self.addSourceButtons(self.ui.toolbar.source);
		self.view.source.setToolbar(self.ui.toolbar.source);

		self.ui.toolbar.common = jQuery('<div>')
			.addClass('wcdv_toolbar_section')
			.appendTo(self.ui.gridToolBarButtons);
		self.addCommonButtons(self.ui.toolbar.common);

		if (self.view.opts.saveViewConfig) {
			self.ui.toolbar.prefs = jQuery('<div>')
				.addClass('wcdv_toolbar_section')
				.appendTo(self.ui.gridToolBarButtons);
			self.addPrefsButtons(self.ui.toolbar.prefs);
		}

		self.ui.toolbar.plain = jQuery('<div>')
			.addClass('wcdv_toolbar_section')
			.hide()
			.appendTo(self.ui.gridToolBarButtons);
		self.addPlainButtons(self.ui.toolbar.plain);

		self.ui.toolbar.group = jQuery('<div>')
			.addClass('wcdv_toolbar_section')
			.hide()
			.appendTo(self.ui.gridToolBarButtons);
		self.addGroupButtons(self.ui.toolbar.group);

		self.ui.toolbar.pivot = jQuery('<div>')
			.addClass('wcdv_toolbar_section')
			.hide()
			.appendTo(self.ui.gridToolBarButtons);
		self.addPivotButtons(self.ui.toolbar.pivot);

		// This is the "gear" icon that shows/hides the controls below the toolbar.  The controls are
		// used to set the group, pivot, aggregate, and filters.  Ideally the user only has to utilize
		// these once, and then switches between perspectives to get the same effect.

		jQuery(fontAwesome('f013'))
			.addClass('wcdv_button pull-right')
			.attr('title', MIE.trans('SHOWHIDEOPTS'))
			.click(function (evt) {
				self.ui.controls.slideToggle();
				self.fire(Grid.events.showControls);
			})
			.appendTo(self.ui.gridToolBarButtons);
	}

	self.ui.controls = jQuery('<div>', { 'class': 'wcdv_grid_control' });
	self.ui.filterControl = jQuery('<div>', { 'class': 'wcdv_filter_control' });
	self.ui.groupControl = jQuery('<div>', { 'class': 'wcdv_group_control' });
	self.ui.pivotControl = jQuery('<div>', { 'class': 'wcdv_pivot_control' });
	self.ui.aggregateControl = jQuery('<div>', { 'class': 'wcdv_aggregate_control' });
	self.ui.grid = jQuery('<div>', { 'id': defn.table.id, 'class': 'wcdv_grid_table' });

	// The user has fixed the height of the containing grid, so we will need to have the browser put
	// in some scrollbars for the overflow.

	if (self.rootHasFixedHeight) {
		self.ui.grid.css({ 'overflow': 'auto' });
	}

	self.ui.controls
		.append(self.ui.filterControl)
		.append(self.ui.groupControl)
		.append(self.ui.pivotControl)
		.append(self.ui.aggregateControl)
		.appendTo(self.ui.gridToolBarButtons);

	self.ui.grid.appendTo(self.ui.root);

	if (document.getElementById(id + '_footer')) {
		// There was a footer which was printed out by dashboard.c which we are now going to move
		// inside the structure that we've been creating.

		self.ui.footer = jQuery(document.getElementById(id + '_footer'))
			.css('display', 'block')
			.appendTo(self.ui.controls);
	}

	var initialRender = true;

	self.tableDoneCont = function (grid, srcIndex) {
		debug.info('GRID', 'Finished drawing grid table!');

		// This just makes sure that we populate the "views" dropdown.  It's only needed the very
		// first time that we show the grid.  Subsequent refreshes may call this code again, but
		// there's no need to change the view dropdown when that happens.

		if (initialRender) {
			initialRender = false;
		}

		// Invoke the callback for the Grid constructor, after the grid has been created.  Sometimes
		// people want to start manipulating the grid from JS right away.

		if (typeof cb === 'function') {
			cb();
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
		self.redraw();
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

// Events {{{2

mixinEventHandling(Grid, 'Grid', [
		'showControls'
	, 'hideControls'
]);

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
		'floatingHeader',
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

Grid.prototype.addHeaderWidgets = function (header, doingServerFilter, runImmediately, id) {
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
								self.view.clearFilter({ notify: true });
							})
			)
			.append(')')
			.appendTo(notHeader);
	}

	notHeader.appendTo(header);

	// Create the down-chevron button that opens the grid toolbar.

	self.ui.showHideButton = jQuery('<button type="button">')
		.append(fontAwesome(runImmediately ? 'f077' : 'f078'))
		.addClass('showhide pull-right')
		.attr('title', MIE.trans('SHOWHIDEOPTS'))
		.click(function (evt) {
			evt.stopPropagation();
			self.toggleGrid();
		})
		.appendTo(header);
};

// #addSourceButtons {{{2

Grid.prototype.addSourceButtons = function (toolbar) {
	var self = this;

	self.ui.refreshLink = jQuery('<button>')
		.append(fontAwesome('F021'))
		.append('Refresh')
		.on('click', function () {
			self.refresh();
		})
		.appendTo(toolbar);
};

// #addCommonButtons {{{2

/**
 * Add common controls to the grid's toolbar.
 *
 * @param {Element} parent
 * Where to attach this toolbar section (i.e. the toolbar div).
 *
 * @method
 */

Grid.prototype.addCommonButtons = function (toolbar) {
	var self = this;

	self.ui.exportBtn = jQuery('<button>', {'disabled': true})
		.append(fontAwesome('F14C'))
		.append('Export')
		.on('click', function () {
			self.export();
		})
		.appendTo(toolbar);
};

// #addPlainButtons {{{2

/**
 * Add plain-related controls to the grid's toolbar.
 *
 * @param {Element} parent
 * Where to attach this toolbar section (i.e. the toolbar div).
 *
 * @method
 */

Grid.prototype.addPlainButtons = function (parent) {
	var self = this;

	if (self.features.limit) {

		// Create a checkbox that will toggle the "automatically show more" feature for the grid table.

		makeToggleCheckbox(self.defn, ['table', 'limit', 'autoShowMore'], true, 'Show More on Scroll', parent);

		// Create a button that will show all the rows when clicked.  We fake this a little bit by just
		// turning off the "limit" feature and letting the grid table be redrawn (changing the features
		// causes it to be redrawn).
		//
		// TODO: This should disable the "automatically show more" checkbox (need to make sure it gets
		// re-enabled if we switch grid tables and come back - as "limit" feature will be reset to its
		// default value).

		jQuery('<button>')
			.on('click', function (evt) {
				self.gridTable.updateFeatures({
					'block': true,
					'progress': true,
					'limit': false
				});
			})
			.text('Show All Rows')
			.appendTo(parent);
	}
};

// #addGroupButtons {{{2

/**
 * Add group-related controls to the grid's toolbar.
 *
 * @param {Element} parent
 * Where to attach this toolbar section (i.e. the toolbar div).
 *
 * @method
 */

Grid.prototype.addGroupButtons = function (parent) {
	var self = this;

	// Create radio buttons to switch between summary and detail group grid tables.

	makeRadioButtons(
		self.defn
		, ['table', 'groupMode']
		, 'detail'
		, null
		, 'groupOutput'
		, [{label: 'Summary', value: 'summary'}
			, {label: 'Detail', value: 'detail'}]
		, null
		, function () { self.redraw() }
		, parent
	);
};

// #addPivotButtons {{{2

/**
 * Add pivot-related controls to the grid's toolbar.
 *
 * @param {Element} parent
 * Where to attach this toolbar section (i.e. the toolbar div).
 *
 * @method
 */

Grid.prototype.addPivotButtons = function (parent) {
	var self = this;
	/*
	var userAddCols = getPropDef([], self.defn, 'table', 'whenPivot', 'addCols');
	var totalCol = {
		name: 'Total',
		value: function (data, rowNum, rowAgg, aggType) {
			return _.reduce(rowAgg, function (acc, cur) {
				if (aggType === 'string') {
					if (acc === '') {
						return cur;
					}
					else if (cur === '') {
						return acc;
					}
					else {
						return acc + ', ' + cur;
					}
				}
				else if (numeral.isNumeral(cur)) {
					return acc + cur._value;
				}
				else {
					return acc + cur;
				}
			}, aggType === 'string' ? '' : 0);
		},
		isTotalCol: true
	};
	var newAddCols = userAddCols.concat([totalCol]);

	setProp(newAddCols, self.defn, 'table', 'whenPivot', 'addCols');
	*/

	var aggSpec;

	self.view.on(View.events.aggregateSet, function (a) {
		aggSpec = deepCopy(a);
	});

	makeToggleCheckbox(
		self.defn,
		['table', 'whenPivot', 'showTotalCol'],
		true,
		'Total Row/Col',
		parent,
		function (isChecked) {
			/*
			setProp(isChecked ? newAddCols : userAddCols, self.defn, 'table', 'whenPivot', 'addCols');
			var gridTableOpts = {};

			if (self.pivotAggConfig) {
				gridTableOpts.pivotConfig = {
					aggFun: self.pivotAggConfig.aggFun,
					aggField: self.pivotAggConfig.aggField
				};
			}
			*/

			var agg = self.view.getAggregate();

			if (!isChecked) {
				aggSpec = deepCopy(agg);
				delete agg.group;
				delete agg.pivot;
				delete agg.all;
			}
			else {
				console.log(aggSpec);
				agg.group = aggSpec.group;
				agg.pivot = aggSpec.pivot;
				agg.all = aggSpec.all;
			}

			self.view.setAggregate(agg, {
				sendEvent: false
			});
			//self.gridTable.clear();
			//self.gridTable.draw(self.ui.grid, self.tableDoneCont/*, gridTableOpts*/);
		}
	);
};

// #addPrefsButtons {{{2

/**
 * Add preference-related controls to the grid's toolbar.
 *
 * @param {Element} parent
 * Where to attach this toolbar section (i.e. the toolbar div).
 *
 * @method
 */

Grid.prototype.addPrefsButtons = function (parent) {
	var self = this;

	var div = jQuery('<div>')
		.css({'display': 'inline-block'})
		.append(jQuery('<span>').text('View: '))
		.appendTo(parent)
	;

	// A shortcut for doing the "right thing" with the rename & delete buttons, which are only shown
	// when the currently selected perspective isn't "Main".

	var showHideBtns = function () {
		if (dropdown.val() === 'Main') {
			deleteBtn.hide();
			renameBtn.hide();
		}
		else {
			deleteBtn.show();
			renameBtn.show();
		}
	};


	// Dropdown of all the available perspectives, plus an entry that (when selected) prompts for the
	// name of a new perspective.

	var dropdown = jQuery('<select>')
		.append(jQuery('<option>', { value: 'NEW' }).text('New View...'))
		.on('change', function (evt) {
			if (dropdown.val() === 'NEW') {
				var perspectiveName = prompt('Enter new view name', self.view.prefs.getCurrentPerspective());
				if (perspectiveName) {
					dropdown.append(jQuery('<option>', { value: perspectiveName }).text(perspectiveName));
					dropdown.val(perspectiveName);
					showHideBtns();
					self.view.prefs.setCurrentPerspective(dropdown.val());
					self.view.prefs.save();
				}
				else {
					dropdown.val(self.view.prefs.getCurrentPerspective());
				}
				return;
			}

			showHideBtns();
			self.view.prefs.setCurrentPerspective(dropdown.val());
			self.view.prefs.load();
		})
		.appendTo(div)
	;

	// Clicking this button will show a prompt to rename the currently selected perspective.  If you
	// cancel the prompt, nothing will happen.  This button is only shown when the currently selected
	// perspective is not "Main" as it cannot be renamed.
	//
	// XXX: What if the user types in the name of an existing perspective?
	// XXX: What if the user types in "Main" ?
	// XXX: What if the user types in "NEW" ?

	var renameBtn = jQuery(fontAwesome('F040', 'wcdv_button', 'Rename'))
		.on('click', function () {
			var oldName = dropdown.val();

			if (oldName === 'Main') {
				alert('Cannot rename "Main" view!');
			}
			else {
				var newName = prompt('Rename view "' + oldName + '" to what?');

				if (newName) {
					dropdown.children().filter(function (i, elt) {
						return elt.value === oldName;
					}).attr('value', newName).text(newName);
					self.view.prefs.renamePerspective(oldName, newName);
				}
			}
		})
		.appendTo(div)
	;

	// Clicking this button will delete the currently selected perspective and switch back to the
	// "Main" perspective.  It is only shown when the currently selected perspective is not "Main" as
	// it cannot be deleted.

	var deleteBtn = jQuery(fontAwesome('F1F8', 'wcdv_button', 'Delete'))
		.on('click', function () {
			if (dropdown.val() === 'Main') {
				alert('Cannot delete "Main" view!');
			}
			else {
				var toDelete = dropdown.val();
				self.view.prefs.deletePerspective(toDelete);
				dropdown.children().filter(function (i, elt) {
					return elt.value === toDelete;
				}).remove();
				dropdown.val(self.view.prefs.getCurrentPerspective());
				showHideBtns();
			}
		})
		.appendTo(div)
	;

	// Clicking this button will reset all preferences back to the initial set (i.e. just "Main" and
	// no changes in the view from its default).  Perhaps useful when you have too many different
	// perspectives set, but I feel better having it as a safety in case your prefs somehow get really
	// messed up and don't work at all anymore.  This button is always shown.

	var resetBtn = jQuery(fontAwesome('F0E2', 'wcdv_button', 'Reset'))
		.on('click', function () {
			self.view.prefs.reset();
			dropdown.children().filter(function (i, elt) {
				return elt.value !== self.view.prefs.getCurrentPerspective() && elt.value !== 'NEW';
			}).remove();
			dropdown.val(self.view.prefs.getCurrentPerspective());
			showHideBtns();
		})
		.appendTo(div)
	;

	// Get the list of available perspectives from the Prefs instance and put them into the dropdown.
	// The initial perspective will be selected by default.  This DOES NOT actually load that
	// perspective, it's just for the UI.
	//
	// XXX: Is it possible for perspectives to change by some other route so that we need to know
	// about it to update the UI?

	self.view.prefs.getPerspectives(function (perspectives) {
		self.view.prefs.getInitialPerspective(function (initial) {
			_.each(perspectives.sort(), function (perspective) {
				jQuery('<option>', { 'value': perspective })
					.text(perspective)
					.appendTo(dropdown);
			});
			dropdown.val(initial);
			showHideBtns();
		});
	});
};

// #clear {{{2

Grid.prototype.clear = function () {
	var self = this;

	self.ui.root.children().remove();
};
// #redraw {{{2

/**
 * Redraw the data shown in a grid.  If the grid is not visible, this function does nothing (i.e.
 * you cannot use it to retrieve data for an invisible grid).
 *
 * @method
 * @memberof Grid
 */

Grid.prototype.redraw = function () {
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

	if (self.tagOpts.filterInput) {
		self.tagOpts.filterInput.store();
	}

	if (self.groupControl === undefined) {
		self.groupControl = new GroupControl(self, self.defn, self.view, self.features, self.timing);
		self.groupControl.on(GridControl.events.fieldAdded, function (fieldAdded, fields) {
			self.ui.pivotControl.show();
			self.ui.aggregateControl.show();
		});
		self.groupControl.on(GridControl.events.fieldRemoved, function (fieldRemoved, fields) {
			if (fields.length === 0) {
				self.ui.pivotControl.hide();
				self.ui.aggregateControl.hide();
			}
		});
		self.groupControl.on(GridControl.events.cleared, function () {
			self.ui.pivotControl.hide();
			self.ui.aggregateControl.hide();
		});
		self.ui.groupControl.children().remove();
		self.groupControl.draw(self.ui.groupControl);
		self.ui.groupControl.show();
	}

	if (self.aggregateControl === undefined) {
		self.aggregateControl = new AggregateControl(self.view, self.defn);
		self.ui.aggregateControl.children().remove();
		self.aggregateControl.draw(self.ui.aggregateControl);
		self.ui.aggregateControl.hide();
	}

	if (self.filterControl === undefined) {
		self.filterControl = new FilterControl(self, self.defn, self.view, self.features, self.timing);
		self.ui.filterControl.children().remove();
		self.filterControl.draw(self.ui.filterControl);
		self.ui.filterControl.show();
	}

	if (self.pivotControl === undefined) {
		self.pivotControl = new PivotControl(self, self.defn, self.view, self.features, self.timing);
		self.ui.pivotControl.children().remove();
		self.pivotControl.draw(self.ui.pivotControl);
		self.ui.pivotControl.hide();
	}

	var makeGridTable = function () {
		var gridTableCtor
			, gridTableOpts
			, ops = self.view.getLastOps()

		if (ops) {
			debug.info('GRID', 'Creating grid table with view opertions: %O', ops);
		}

		if ((ops && ops.pivot) || self.view.getPivot()) {
			gridTableCtor = GridTablePivot;
			gridTableOpts = deepCopy(self.defn.table.whenPivot);

			debug.info('GRID', 'Creating pivot grid table');

			self.ui.toolbar.plain.hide();
			self.ui.toolbar.group.hide();
			self.ui.toolbar.pivot.show();
		}
		else if ((ops && ops.group) || self.view.getGroup()) {
			switch (self.defn.table.groupMode) {
			case 'summary':
				gridTableCtor = GridTableGroupSummary;
				break;
			case 'detail':
				gridTableCtor = GridTableGroupDetail;
				break;
			}

			gridTableOpts = deepCopy(self.defn.table.whenGroup);

			debug.info('GRID', 'Creating group grid table');

			self.ui.toolbar.plain.hide();
			self.ui.toolbar.group.show();
			self.ui.toolbar.pivot.hide();
		}
		else {
			gridTableCtor = GridTablePlain;
			gridTableOpts = deepCopy(self.defn.table.whenPlain);
			gridTableOpts.rootHasFixedHeight = self.rootHasFixedHeight;

			debug.info('GRID', 'Creating plain grid table');

			self.ui.toolbar.plain.show();
			self.ui.toolbar.group.hide();
			self.ui.toolbar.pivot.hide();
		}

		if (self.gridTable) {
			self.gridTable.clear();
		}

		gridTableOpts.fixedHeight = self.rootHasFixedHeight;

		self.ui.exportBtn.attr('disabled', true);
		self.gridTable = new gridTableCtor(self, self.defn, self.view, self.features, gridTableOpts, self.timing, self.id);
		self.gridTable.on(GridTable.events.unableToRender, makeGridTable);
		self.gridTable.draw(self.ui.grid, function () {
			self.ui.exportBtn.attr('disabled', false);
			self.tableDoneCont();
		});
	};

	makeGridTable();
};

// #refresh {{{2

/**
 * Refreshes the data from the data view in the grid.
 *
 * @method
 * @memberof Grid
 */

Grid.prototype.refresh = function () {
	var self = this;

	if (!self.isGridVisible()) {
		return;
	}

	self.view.reset(true);
	self.view.source.clearCachedData();
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

	self.ui.grid.hide({
		duration: 0,
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

	self.ui.grid.show({
		duration: 0,
		done: function () {
			if (self.tagOpts.title) {
				self.ui.showHideButton.addClass('open').html(fontAwesome('f077'));
			}
			if (! self.hasRun) {
				self.hasRun = true;
				self.redraw();
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

	self.redraw();
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

	self.redraw();
};

// #normalize {{{2

/**
 * The point of "normalizing" a definition is to expand shortcut configurations.  For example, lots
 * of properties can be a string (the shortcut) or an object which contains the same info plus some
 * additional configuration.  This function would convert the string into the object.  This way,
 * later code only has to check for the object version.  It also adds a layer of backwards
 * compatibility.
 *
 * You only need to normalize a definition once; after doing so, we flag it so we won't mess with it
 * again, even though it should be possible to normalize something that's already been done.
 */

Grid.prototype.normalize = function (defn) {
	var self = this;

	if (defn.normalized) {
		return;
	}

	defn.normalized = true;

	deepDefaults(true, defn, {
		table: {
			groupMode: 'detail',
			features: {
				sort: true,
				filter: true,
				group: true,
				pivot: true,
				rowSelect: false,
				rowReorder: false,
				add: false,
				edit: false,
				delete: false,
				limit: true,
				floatingHeader: true,
				block: false,
				progress: false
			},
			limit: {
				method: 'more',
				threshold: 100,
				chunkSize: 50
			}
		}
	});

	self.normalizeColumns(defn);

	if (getProp(defn, 'table', 'columns') !== undefined) {
		defn.table.columns_map = _.indexBy(defn.table.columns, 'field');
	}
};

// #normalizeColumns {{{2

Grid.prototype.normalizeColumns = function (defn) {
	var self = this;

	// If the column configuration is just a string, that's just the name of a column to show.  Let's
	// convert it into the object format.

	if (getProp(defn, 'table', 'columns')) {
		for (var i = 0; i < defn.table.columns.length; i += 1) {
			var colConfig = defn.table.columns[i];
			if (_.isString(colConfig)) {
				defn.table.columns[i] = {
					field: colConfig
				};
			}
		}
	}

	_.each(getPropDef([], defn, 'table', 'columnConfig'), function (colConfig, colName) {

		// When you want to show a checkbox to represent the value, it only makes sense to have a
		// checkbox for the filter widget.

		if (colConfig.widget === 'checkbox') {
			if (colConfig.filter !== undefined && colConfig.filter !== 'checkbox') {
				log.warn('Overriding configuration to use filter type "' + colConfig.filter + '" for checkbox widgets.');
			}
			colConfig.filter = 'checkbox';
		}
	});

	self.colConfig = {};

	_.each(getPropDef([], defn, 'table', 'columns'), function (col) {
		self.colConfig[col.field] = col;
	});
};

// #export {{{2

Grid.prototype.export = function () {
	var self = this;

	var fileName = (self.tagOpts.title || self.id) + '.csv';
	var csv = self.gridTable.getCsv();
	var contentType = 'text/csv';

	if (window.Blob == null /* old browser */) {
		var form = jQuery('<form>', {'method': 'POST', 'action': MIE.WC_DataVis.EXPORT_URL}).appendTo(document.body);
		jQuery('<input>', {'type': 'hidden', 'name': 'format'}).val('csv').appendTo(form);
		jQuery('<input>', {'type': 'hidden', 'name': 'filename'}).val(fileName).appendTo(form);
		jQuery('<input>', {'type': 'hidden', 'name': 'content'}).val(csv).appendTo(form);
		form.submit();
		form.remove();
	}
	else {
		var a = document.createElement('a');
		a.download = fileName;
		a.href = URL.createObjectURL(new Blob([csv], {'type': contentType}));
		jQuery(document.body).append(a);
		a.click();
		a.remove();
	}
};

// GridControl {{{1

// Constructor {{{2

/**
 * @class
 *
 * An abstract class that represents some kind of interface that the user can operate over the
 * available fields.
 *
 * Subclasses should implement the following functions:
 *
 * - `draw(TARGET)`
 *   Called to create all required user interface components.
 *
 * - `updateView()`
 *   Use `self.fields` to set whatever properties are needed on the view.
 *
 * @property {Array.<string>} fields
 * List of all the fields selected by the user.
 *
 * @property {object} ui
 * Object containing different user interface components.
 *
 * @property {jQuery} ui.dropdown
 * The SELECT element containing the available fields.
 */

function GridControl() {
}

GridControl.prototype = Object.create(Object.prototype);
GridControl.prototype.constructor = GridControl;

// Events {{{2

mixinEventHandling(GridControl, 'GridControl', [
		'fieldAdded'
	, 'fieldRemoved'
	, 'cleared'
]);

// #init {{{2

GridControl.prototype.init = function (grid, defn, view, features, timing) {
	var self = this;

	self.defn = defn;
	self.view = view;
	self.features = features;
	self.timing = timing;
	self.ui = {};
	self.colConfig = _.indexBy(getPropDef({}, self.defn, 'table', 'columns'), 'field');
	self.fields = [];
};

// #makeAddButton {{{2

/**
 * Make a button that calls the `addField` method when clicked.
 *
 * @param {jQuery} target
 * Where to append the button.
 *
 * @returns {jQuery}
 * The button created.
 */

GridControl.prototype.makeAddButton = function (target) {
	var self = this;

	return jQuery(fontAwesome('F0FE'))
		.addClass('wcdv_button')
		.css({'margin-left': '4px'})
		.on('click', function () {
			self.addField(self.ui.dropdown.val());
		})
		.appendTo(target);
};

// #makeClearButton {{{2

/**
 * Make a button that calls the `clear` method when clicked.
 *
 * @param {jQuery} target
 * Where to append the button.
 *
 * @returns {jQuery}
 * The button created.
 */

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

/**
 * Add a field to this control.  Automatically updates the view afterwards.
 *
 * @param {string} field
 * Name of the field to add.
 */

GridControl.prototype.addField = function (field, opts) {
	var self = this;

	opts = opts || {};

	_.defaults(opts, {
		noUpdate: false,
		silent: false
	});

	if (isNothing(field) || field === '' || self.fields.indexOf(field) >= 0) {
		return;
	}

	var cf = new self.controlFieldCtor(self, field, self.colConfig[field] || {});

	self.ui.clearBtn.show();

	var li = jQuery('<li>');

	if (self.ui.fields.data('isHorizontal')) {// && self.ui.fields.children('li').size() > 0) {
		li.append(fontAwesome('F178'));
	}

	li.append(cf.draw());
	li.appendTo(self.ui.fields); // Add it to the DOM.

	self.ui.dropdown.find('option').filter(function () {
		return jQuery(this).val() === field;
	}).prop('disabled', true);
	self.ui.dropdown.val('');

	self.fields.push(field); // Add it to the fields array.

	if (!opts.noUpdate) {
		self.updateView();
	}

	if (!opts.silent) {
		self.fire(GridControl.events.fieldAdded, null, field, self.fields);
	}
};

// #removeField {{{2

/**
 * Remove a field from this control.  Automatically updates the view afterwards.
 *
 * @param {ControlField} cf
 * The field to remove.
 */

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
	self.fire(GridControl.events.fieldRemoved, null, cf.field, self.fields);
};

// #clear {{{2

/**
 * Removes all fields from the control.  Automatically updates the view afterwards.
 */

GridControl.prototype.clear = function (opts) {
	var self = this;

	opts = opts || {};

	self.fields = [];
	self.ui.fields.children().remove();
	self.ui.dropdown.find('option:disabled').filter(function () {
		return jQuery(this).val() !== '';
	}).prop('disabled', false);
	self.ui.clearBtn.hide();

	if (!opts.noUpdate) {
		self.updateView();
	}

	self.fire(GridControl.events.cleared);
};

// #destroy {{{2

GridControl.prototype.destroy = function () {
	var self = this;

	debug.info('GRID // CONTROL', 'Good-bye, cruel world!');

	self.view.off('*', self);
	self.ui.root.remove();
};

// #addViewConfigChangeHandler {{{2

GridControl.prototype.addViewConfigChangeHandler = function (kind) {
	var self = this;

	var synchronize = function (spec) {
		var fields = (spec && spec.fieldNames) || [];

		self.clear({ noUpdate: true });

		debug.info('GRID // ' + kind.toUpperCase() + ' CONTROL',
							 'View set ' + kind + ' fields to: ' + JSON.stringify(fields));

		_.each(fields, function (field) {
			self.addField(field, { noUpdate: true });
		});
	};

	self.view.on(View.events[kind + 'Set'], function (spec) {
		synchronize(spec)
	}, { who: self });

	var methodName = 'get' + kind.substr(0, 1).toUpperCase() + kind.substr(1);
	//synchronize(self.view[methodName]());
};

// GroupControl {{{1

// Constructor {{{2

/**
 * Part of the user interface which governs the fields that are part of the group, including
 * filtering.
 */

function GroupControl() {
	var self = this;

	self.super = makeSuper(self, GridControl);
	self.super.init.apply(self, arguments);
}

GroupControl.prototype = Object.create(GridControl.prototype);
GroupControl.prototype.constructor = GroupControl;

GroupControl.prototype.controlFieldCtor = GroupControlField;

// #addField {{{2

GroupControl.prototype.addField = function (field, opts) {
	var self = this;

	self.super.addField(field, opts);
};

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
	self.ui.fields = jQuery('<ul>')
		.data('isHorizontal', true)
		.appendTo(self.ui.root);

	var dropdownContainer = jQuery('<div>').appendTo(self.ui.root);
	self.ui.dropdown = jQuery('<select>').appendTo(dropdownContainer);
	self.makeAddButton(dropdownContainer);

	jQuery('<option>', { 'value': '', 'disabled': true, 'selected': true })
		.text('Select Field')
		.appendTo(self.ui.dropdown);

	self.view.on('getTypeInfo', function (typeInfo) {
		_.each(availableFields(self.defn, null, typeInfo), function (fieldName) {
			var text = getProp(self.colConfig, fieldName, 'displayText') || fieldName;
			jQuery('<option>', { 'value': fieldName }).text(text).appendTo(self.ui.dropdown);
		});
	}, { limit: 1 });

	self.addViewConfigChangeHandler('group');

	return self.ui.root;
};

// #updateView {{{2

GroupControl.prototype.updateView = function () {
	var self = this;

	debug.info('GRID // GROUP CONTROL', 'Setting group fields to: %O', self.fields);

	if (self.fields.length > 0) {
		self.view.setGroup({fieldNames: self.fields}, false, self);
	}
	else {
		self.view.clearGroup();
	}
};

// PivotControl {{{1

// Constructor {{{2

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
 * @property {string[]} fields
 * Names of the fields
 */

function PivotControl() {
	var self = this
		, args = Array.prototype.slice.call(arguments);

	self.super = makeSuper(self, GridControl);
	self.super.init.apply(self, args);
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
	jQuery('<span>')
		.addClass('wcdv_control_title')
		.text('Pivot Fields')
		.appendTo(self.ui.title);
	self.ui.clearBtn = self.makeClearButton(self.ui.title);
	self.ui.fields = jQuery('<ul>')
		.data('isHorizontal', true)
		.appendTo(self.ui.root);

	var dropdownContainer = jQuery('<div>').appendTo(self.ui.root);
	self.ui.dropdown = jQuery('<select>').appendTo(dropdownContainer);
	self.makeAddButton(dropdownContainer);

	jQuery('<option>', { 'value': '', 'disabled': true, 'selected': true })
		.text('Select Field')
		.appendTo(self.ui.dropdown);

	self.view.on('getTypeInfo', function (typeInfo) {
		_.each(availableFields(self.defn, null, typeInfo), function (fieldName) {
			var text = getProp(self.colConfig, fieldName, 'displayText') || fieldName;
			jQuery('<option>', { 'value': fieldName }).text(text).appendTo(self.ui.dropdown);
		});
	}, { limit: 1 });

	self.addViewConfigChangeHandler('pivot');

	return self.ui.root;
};

// #addField {{{2

PivotControl.prototype.addField = function (field, opts) {
	var self = this;

	self.super.addField(field, opts);
};

// #removeField {{{2

PivotControl.prototype.removeField = function (cf) {
	var self = this;

	self.super.removeField(cf);
};

// #clear {{{2

PivotControl.prototype.clear = function (opts) {
	var self = this;

	self.super.clear(opts);
};

// #updateView {{{2

/**
 * Set the pivot configuration on the View.  The pivot configuration consists of:
 *
 *   - Fields that are part of the pivot.
 */

PivotControl.prototype.updateView = function () {
	var self = this;

	debug.info('GRID // PIVOT CONTROL', 'Setting pivot fields to: %O', self.fields);

	if (self.fields.length > 0) {
		if (!self.view.setPivot({fieldNames: self.fields}, false, self)) {
			self.clear({ noUpdate: true });
		}
	}
	else {
		self.view.clearPivot();
	}
};

// AggregateControl {{{1

// Constructor {{{2

/**
 * Part of the user interface which governs the aggregate function (and potentially its arguments)
 * that produces the values in (1) group summary columns, (2) pivot cells.
 *
 * @class
 *
 * @property {string[]} fields
 * Names of the fields
 */

var AggregateControl = makeSubclass(Object, function (view, defn) {
	var self = this;

	self.view = view;
	self.defn = defn;

	self.ui = {};
});

// #draw {{{2

/**
 * Create a DIV element that can be placed within the Grid instance to hold the user interface for
 * the AggregateControl.  The caller must add the result to the DOM somewhere.
 *
 * @returns {jQuery} The DIV element that holds the entire UI.
 */

AggregateControl.prototype.draw = function (parent) {
	var self = this;

	self.ui.root = jQuery('<div>').appendTo(parent);

	self.ui.title = jQuery('<div>')
		.addClass('wcdv_control_title_bar')
		.appendTo(self.ui.root);
	jQuery('<span>')
		.addClass('wcdv_control_title')
		.text('Aggregate')
		.appendTo(self.ui.title);
	self.ui.fun = jQuery('<div>').css({'margin-top': '7px'}).appendTo(self.ui.root);
	jQuery('<label>').text('Function:').appendTo(self.ui.fun);
	self.ui.funDropdown = jQuery('<select>')
		.appendTo(self.ui.fun)
		.on('change', function () {
			self.triggerAggChange();
		})
	;

	_.each(AGGREGATES, function (aggObj, aggFunName) {
		if (aggObj.canBePivotCell) {
			jQuery('<option>', {
				value: aggFunName
			})
				.text(aggObj.name || aggFunName)
				.appendTo(self.ui.funDropdown);
		}
	});

	self.ui.field = jQuery('<div>').css({'margin-top': '4px'}).appendTo(self.ui.root).hide();
	jQuery('<label>').text('Field:').appendTo(self.ui.field);
	self.ui.fieldDropdown = jQuery('<select>')
		.appendTo(self.ui.field)
		.on('change', function () {
			self.triggerAggChange();
		})
	;

	self.view.on('getTypeInfo', function (typeInfo) {
		_.each(availableFields(self.defn, null, typeInfo), function (fieldName) {
			var text = getProp(self.colConfig, fieldName, 'displayText') || fieldName;
			jQuery('<option>', { 'value': fieldName }).text(text).appendTo(self.ui.fieldDropdown);
		});
	}, { limit: 1 });

	var syncAgg = function (spec) {
		if (getProp(spec, 'cell', 0, 'fun')) {
			self.ui.funDropdown.val(spec.cell[0].fun);
			if (AGGREGATES[spec.cell[0].fun].needsField) {
				self.ui.field.show();
			}
		}
		if (getProp(spec, 'cell', 0, 'field')) {
			self.ui.fieldDropdown.val(spec.cell[0].field);
		}

		debug.info('GRID // AGGREGATE CONTROL',
							 'View set aggregate to: ' + JSON.stringify(spec));
	};

	self.view.on(View.events.aggregateSet, function (spec) {
		syncAgg(spec)
	}, { who: self });

	return self.ui.root;
};

// #triggerAggChange {{{2

/**
 * Perform necessary actions when the aggregate function is changed.
 *
 *   - Update the UI to show/hide field argument.
 */

AggregateControl.prototype.triggerAggChange = function () {
	var self = this;
	var agg = AGGREGATES[self.ui.funDropdown.val()];
	var aggText = (agg.name || self.ui.funDropdown.val())
		+ (agg.needsField ? (' of ' + self.ui.fieldDropdown.val()) : '');
	var aggSpec = objFromArray(['group', 'pivot', 'cell', 'all'], [[{
		fun: self.ui.funDropdown.val(),
		field: agg.needsField && self.ui.fieldDropdown.val(),
		name: aggText
	}]]);

	if (agg.needsField) {
		self.ui.field.show();
	}
	else {
		self.ui.field.hide();
	}

	self.view.setAggregate(aggSpec, {
		dontSendEventTo: self
	});
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

var FilterControl = function () {
	var self = this;

	self.super = makeSuper(self, GridControl);
	self.super.init.apply(self, arguments);
	self.gfs = new GridFilterSet(self.view);
};

FilterControl.prototype = Object.create(GridControl.prototype);
FilterControl.prototype.constructor = FilterControl;

FilterControl.prototype.controlFieldCtor = FilterControlField;

// #draw {{{2

/**
 * Create a DIV element that can be placed within the Grid instance to hold the user interface for
 * the FilterControl.  The caller must add the result to the DOM somewhere.
 *
 * @returns {jQuery} The DIV element that holds the entire UI.
 */

FilterControl.prototype.draw = function (parent) {
	var self = this;

	parent.resizable({
		handles: 'e',
		minWidth: 100
	});

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
		.text('Filters')
		.appendTo(self.ui.title);
	self.ui.clearBtn = self.makeClearButton(self.ui.title);
	self.ui.fields = jQuery('<ul>').appendTo(self.ui.root);

	var dropdownContainer = jQuery('<div>').appendTo(self.ui.root);
	self.ui.dropdown = jQuery('<select>').appendTo(dropdownContainer);
	self.makeAddButton(dropdownContainer);

	jQuery('<option>', { 'value': '', 'disabled': true, 'selected': true })
		.text('Select Field')
		.appendTo(self.ui.dropdown);

	self.view.on('getTypeInfo', function (typeInfo) {
		_.each(availableFields(self.defn, null, typeInfo), function (fieldName) {
			var text = getProp(self.colConfig, fieldName, 'displayText') || fieldName;
			jQuery('<option>', { 'value': fieldName }).text(text).appendTo(self.ui.dropdown);
		});
	}, { limit: 1 });

	self.addViewConfigChangeHandler();

	return self.ui.root;
};

// #addField {{{2

FilterControl.prototype.addField = function (field) {
	var self = this;

	self.super.addField(field, { noUpdate: true });	
};

// #removeField {{{2

FilterControl.prototype.removeField = function (cf) {
	var self = this;

	self.gfs.removeField(cf.field);
	self.super.removeField(cf);
};

// #clear {{{2

FilterControl.prototype.clear = function (opts) {
	var self = this;

	self.gfs.reset(opts);
	self.super.clear(opts);
};

// #updateView {{{2

FilterControl.prototype.updateView = function () {
	var self = this;
};

// #addViewConfigChangeHandler {{{2

FilterControl.prototype.addViewConfigChangeHandler = function (kind) {
	var self = this;

	var synchronize = function (spec) {
		debug.info('GRID // FILTER CONTROL', 'View set filter to: %O', spec);

		self.clear({ noUpdate: true });
		_.each(spec, function (fieldSpec, field) {
			self.addField(field, { noUpdate: true });
			self.gfs.set(field, fieldSpec);
		});
	};

	self.view.on(View.events.filterSet, function (spec) {
		synchronize(spec)
	}, { who: self });

	synchronize(self.view.getFilter());
};
// GridControlField {{{1

// Constructor {{{2

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

	self.ui.removeButton = jQuery(fontAwesome('F146'))
		.attr('title', 'Remove')
		.addClass('wcdv_button wcdv_remove')
		.on('click', function () {
			self.control.removeField(self);
		})
	;

	self.ui.root = jQuery('<div>', { 'class': 'wcdv_field' })
		.append(self.ui.removeButton)
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

// Constructor {{{2

function GroupControlField() {
	var self = this;

	self.super = makeSuper(self, GridControlField);
	self.super.init.apply(self, arguments);
};

GroupControlField.prototype = Object.create(GridControlField.prototype);
GroupControlField.prototype.constructor = GroupControlField;

// PivotControlField {{{1

// Constructor {{{2

function PivotControlField() {
	var self = this;

	self.super = makeSuper(self, GridControlField);
	self.super.init.apply(self, arguments);
};

PivotControlField.prototype = Object.create(GridControlField.prototype);
PivotControlField.prototype.constructor = PivotControlField;
// FilterControlField {{{1
// Constructor {{{2

function FilterControlField() {
	var self = this;

	self.super = makeSuper(self, GridControlField);
	self.super.init.apply(self, arguments);
};

FilterControlField.prototype = Object.create(GridControlField.prototype);
FilterControlField.prototype.constructor = FilterControlField;

// #draw {{{2

FilterControlField.prototype.draw = function () {
	var self = this;

	self.super.draw();
	self.ui.filterContainer = jQuery('<div>')
		.addClass('wcdv_filter_control_filter_container')
		.appendTo(self.ui.root);
	self.control.gfs.add(self.field, self.ui.filterContainer);

	return self.ui.root;
};
