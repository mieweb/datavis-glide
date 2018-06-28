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
 * @typedef {object} Grid~Defn
 *
 * @property {Object} table
 *
 * @property {string} table.id
 *
 * @property {Array.<Grid~ColConfig>} [table.columns]
 * Specifies the order that fields are rendered in plain output.  If not provided, all fields are
 * rendered in the order received from the source; fields with names starting with an underscore are
 * not shown.  If provided, only those fields specified are rendered, and in the order indicated.
 *
 * @property {Grid~Features} [table.features]
 * The features that are enabled for this grid.
 *
 * @property {object} [table.limit]
 *
 * @property {object} [table.floatingHeader]
 * Configuration for the "floating header" feature.
 *
 * @property {string} [table.floatingHeader.method]
 * What library to use to create the floating table header.  Must be one of the following:
 *
 *   - `floatThead`
 *   - `fixedHeaderTable`
 *   - `tabletool`
 *
 * If this is not specified, the default is based on what library is available in the page, in the
 * order listed above.
 *
 * @property {object} [table.limit]
 * Configuration for the "limit" feature.
 *
 * @property {string} [table.limit.method="more"]
 * How to limit the output.  Must be one of the following:
 *
 *   - `more` — Show a row at the bottom, which when clicked, loads more rows.
 *
 * @property {number} table.limit.threshold
 * The total number of rows must exceed this in order to trigger using the limit method.  If
 * omitted, then the "limit" feature is effectively disabled.
 *
 * @property {number} table.limit.chunkSize
 * When using the "more" limit method, how many additional rows to load each time.
 */

/**
 * @typedef {object} Grid~ColConfig
 *
 * @property {string} field
 * We're configuring the output of this field.
 *
 * @property {string} [displayText]
 * What to show as the name of the column; the default is to show the field name.
 *
 * @property {string} [format]
 * If the value is a number or currency: a Numeral format string used to render the value.  If the
 * value is a date, datetime, or time: a Moment format string used to render the value.  Otherwise,
 * this option is not used.  The default format strings are:
 *
 *   - number: [none]
 *   - currency: `$0,0.00` (e.g. "$1,000.23")
 *   - date: `LL` (e.g. "September 4, 1986")
 *   - datetime: `LLL` (e.g. "September 4, 1986 8:30 PM")
 *
 * @property {string} [format_dateOnly="LL"]
 * When `hideMidnight = true` this is the Moment format string used to display just the date
 * component of the datetime.  Note that the time component is still present in the value when it is
 * formatted, so don't reference the hours/minutes/seconds from the format string.
 *
 * @property {boolean} [hideMidnight=false]
 * If the value is a datetime, and this value is true, then the time component is not rendered when
 * it's midnight (00:00:00).  If the value is not a datetime, this option is not used.
 *
 * @property {string} [cellAlignment]
 * How to align the value within the cell horizontally.  Possible values:
 *
 *   - `left`
 *   - `center`
 *   - `right`
 *
 * The default depends on the type of the field.  Strings, dates, datetimes, and times are
 * left-aligned by default.  Numbers and currencies are right-aligned by default.
 *
 * @property {boolean} [allowHtml=false]
 * If true and the type of the field is a string, the value is interpreted as HTML and the resulting
 * nodes are inserted into the table result.  When exporting to CSV, the value emitted will be the
 * text nodes only.
 */

/**
 * @typedef {object} Grid~Features
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
 *
 * @borrows GridTable#getSelection
 * @borrows GridTable#setSelection
 * @borrows GridTable#select
 * @borrows GridTable#unselect
 * @borrows GridTable#isSelected
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

	defn = defn || {};
	self._normalize(defn);

	// HACK The *only* reason we need this is so that the aggregate functions which do formatting
	// (e.g. group concat) know how to format non-string values like currency.  There's got to be a
	// better way to do this.

	view.setColConfig(self.colConfig);

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

	self.view.addClient(self, 'grid');

	self.defn.grid = self;

	self._validateFeatures();
	self._validateId(id);

	if (defn.prefs != null && !(defn.prefs instanceof Prefs)) {
		throw new Error('Call Error: `defn.prefs` must be null or an instance of MIE.WC_DataVis.Prefs');
	}

	if (defn.prefs != null) {
		self.prefs = defn.prefs;
	}
	else if (self.view.prefs != null) {
		debug.info('GRID (' + self.id + ') // PREFS', 'Using prefs from connected view');
		self.prefs = self.view.prefs;
	}
	else {
		debug.info('GRID (' + self.id + ') // PREFS', 'Creating new prefs');
		self.prefs = new Prefs(self.id);
	}

	self.prefs.bind('grid', self);

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

	self.ui.titlebar = jQuery('<div class="wcdv_grid_titlebar">').appendTo(self.ui.root);

	self._addTitleWidgets(self.ui.titlebar, doingServerFilter, !!self.tagOpts.runImmediately, id);

	self.ui.content = jQuery('<div>', {
		'class': 'wcdv_grid_content'
	}).appendTo(self.ui.root);

	self.ui.toolbar = jQuery('<div>')
		.addClass('wcdv_grid_toolbar')
		.droppable({
			over: function (evt, ui) {
				self.ui.controls.show();

				// Need to recalculate the position of the droppable targets, because they are now
				// guaranteed to be visible (they may have been hidden within the grid control before).

				ui.draggable.draggable('option', 'refreshPositions', true);
			}
		})
		.appendTo(self.ui.content)
	;

	self.ui.toolbar_prefs = jQuery('<div>')
		.addClass('wcdv_toolbar_section')
		.appendTo(self.ui.toolbar);
	self._addPrefsButtons(self.ui.toolbar_prefs);

	if (self.features.limit) {
		self.ui.toolbar_limit = jQuery('<div>')
			.addClass('wcdv_toolbar_section')
			.hide()
			.appendTo(self.ui.toolbar);
		self._addLimitButtons(self.ui.toolbar_limit);
	}

	self.ui.toolbar_group = jQuery('<div>')
		.addClass('wcdv_toolbar_section')
		.hide()
		.appendTo(self.ui.toolbar);
	self._addGroupButtons(self.ui.toolbar_group);

	self.ui.toolbar_pivot = jQuery('<div>')
		.addClass('wcdv_toolbar_section')
		.hide()
		.appendTo(self.ui.toolbar);
	self._addPivotButtons(self.ui.toolbar_pivot);

	self.ui.controls = jQuery('<div>', { 'class': 'wcdv_grid_control' });
	self.ui.filterControl = jQuery('<div>', { 'class': 'wcdv_filter_control' });
	self.ui.groupControl = jQuery('<div>', { 'class': 'wcdv_group_control' });
	self.ui.pivotControl = jQuery('<div>', { 'class': 'wcdv_pivot_control' });
	self.ui.aggregateControl = jQuery('<div>', { 'class': 'wcdv_aggregate_control' });
	self.ui.grid = jQuery('<div>', { 'id': defn.table.id, 'class': 'wcdv_grid_table' });

	if (!self.tagOpts.showControls) {
		self.ui.controls.hide();
	}

	// The user has fixed the height of the containing grid, so we will need to have the browser put
	// in some scrollbars for the overflow.

	if (self.rootHasFixedHeight) {
		self.ui.grid.css({ 'overflow': 'auto' });
	}
	else if (!self.features.floatingHeader || self.defn.table.floatingHeader.method !== 'tabletool') {
		self.ui.grid.css({ 'overflow-x': 'auto' });
	}

	if (document.getElementById(id + '_footer')) {
		// There was a footer which was printed out by dashboard.c which we are now going to move
		// inside the structure that we've been creating.

		self.ui.footer = jQuery(document.getElementById(id + '_footer'))
			.css('display', 'block');
	}

	self.ui.root
		.append(self.ui.titlebar)
		.append(self.ui.content
			.append(self.ui.toolbar)
			.append(self.ui.controls
				.append(self.ui.filterControl)
				.append(self.ui.groupControl)
				.append(self.ui.pivotControl)
				.append(self.ui.aggregateControl))
			.append(self.ui.grid)
			.append(self.ui.footer))
	;

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

	self.view.on(View.events.fetchDataBegin, function () {
		self._setSpinner('loading');
		self._showSpinner();
	});
	self.view.on(View.events.fetchDataEnd, function () {
		self._hideSpinner();
	});

	self.view.on(View.events.workBegin, function () {
		self._setSpinner('working');
		self._showSpinner();
	});
	self.view.on(View.events.workEnd, function (info, ops) {
		self._hideSpinner();
		self._updateRowCount(info, ops);
	});

	self.view.on(View.events.dataUpdated, function () {
		if (self.tagOpts.showOnDataChange && !self.isVisible()) {
			self.show({ redraw: false });
		}
		self.redraw();
	});

	if (self.tagOpts.runImmediately) {
		self.show();
	}
	else {
		self.hasRun = false;
		self.hide();
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

// Delegate {{{2

delegate(Grid, 'gridTable', ['setSelection', 'getSelection', 'select', 'unselect', 'isSelected']);

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

// #_addTitleWidgets {{{2

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

Grid.prototype._addTitleWidgets = function (titlebar, doingServerFilter, runImmediately, id) {
	var self = this;

	self.ui.spinner = jQuery('<strong>').css({'font-weight': 'normal', 'margin-right': '0.5em'}).appendTo(titlebar);
	self._setSpinner(self.tagOpts.runImmediately ? 'loading' : 'not-loaded');

	jQuery('<strong>', {'id': id + '_title', 'data-parent': id})
		.text(self.tagOpts.title + ',')
		.appendTo(titlebar);

	var notHeader = jQuery('<span>', {'class': 'headingInfo'})
		.on('click', function (evt) {
			evt.stopPropagation();
		})
		.appendTo(titlebar);

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
	
	// Create container to hold all the controls in the titlebar
	
	self.ui.titlebar_controls = jQuery('<div>')
		.addClass('wcdv_titlebar_controls pull-right')
		.appendTo(titlebar);
	
	// Create the Export button
		
	self.ui.exportBtn = jQuery(fontAwesome('f019'))
		.addClass('wcdv_text-primary')
		.attr('title', 'Export')
		.on('click', function () {
			self.export();
		})
		.appendTo(self.ui.titlebar_controls);
	
	// Create the Refresh button
	
	self.ui.refreshBtn = jQuery(fontAwesome('f021'))
		.addClass('wcdv_text-primary')
		.attr('title', 'Refresh')
		.on('click', function () {
			self.refresh();
		})
		.appendTo(self.ui.titlebar_controls);
		
	// This is the "gear" icon that shows/hides the controls below the toolbar.  The controls are used
	// to set the group, pivot, aggregate, and filters.  Ideally the user only has to utilize these
	// once, and then switches between perspectives to get the same effect.

	jQuery(fontAwesome('f013'))
		.addClass('wcdv_text-primary')
		.attr('title', MIE.trans('SHOWHIDEOPTS'))
		.click(function (evt) {
			self.toggleControls();
		})
		.appendTo(self.ui.titlebar_controls);
		
	// Create the down-chevron button that shows/hides everything under the titlebar.

	self.ui.showHideButton = jQuery(fontAwesome('f078'))
		.addClass('showhide wcdv_text-primary')
		.attr('title', MIE.trans('SHOWHIDE'))
		.click(function (evt) {
			evt.stopPropagation();
			self.toggle();
		})
		.appendTo(self.ui.titlebar_controls);		
};

// #_addLimitButtons {{{2

/**
 * Add plain-related controls to the grid's toolbar.
 *
 * @method
 *
 * @param {jQuery} toolbar
 * Toolbar section that will contain the buttons.
 */

Grid.prototype._addLimitButtons = function (toolbar) {
	var self = this;

	if (self.features.limit) {

		// Create a checkbox that will toggle the "automatically show more" feature for the grid table.

		makeToggleCheckbox(self.defn, ['table', 'limit', 'autoShowMore'], true, 'Show More on Scroll', toolbar);

		// Create a button that will show all the rows when clicked.  We fake this a little bit by just
		// turning off the "limit" feature and letting the grid table be redrawn (changing the features
		// causes it to be redrawn).
		//
		// TODO: This should disable the "automatically show more" checkbox (need to make sure it gets
		// re-enabled if we switch grid tables and come back - as "limit" feature will be reset to its
		// default value).

		jQuery('<button>', {'type': 'button'})
			.on('click', function (evt) {
				self.gridTable.updateFeatures({
					'block': true,
					'progress': true,
					'limit': false
				});
			})
			.text('Show All Rows')
			.appendTo(toolbar);
	}
};

// #_addGroupButtons {{{2

/**
 * Add group-related controls to the grid's toolbar.
 *
 * @method
 *
 * @param {jQuery} toolbar
 * Toolbar section that will contain the buttons.
 */

Grid.prototype._addGroupButtons = function (toolbar) {
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
		, toolbar
	);
};

// #_addPivotButtons {{{2

/**
 * Add pivot-related controls to the grid's toolbar.
 *
 * @method
 *
 * @param {jQuery} toolbar
 * Toolbar section that will contain the buttons.
 */

Grid.prototype._addPivotButtons = function (toolbar) {
	var self = this;
	var aggSpec;

	self.view.on(View.events.aggregateSet, function (a) {
		aggSpec = deepCopy(a);
	});

	makeToggleCheckbox(
		self.defn,
		['table', 'whenPivot', 'showTotalCol'],
		true,
		'Total Row/Column',
		toolbar,
		function (isChecked) {
			var agg = self.view.getAggregate();

			if (!isChecked) {
				aggSpec = deepCopy(agg);
				delete agg.group;
				delete agg.pivot;
				delete agg.all;
			}
			else {
				agg.group = aggSpec.group;
				agg.pivot = aggSpec.pivot;
				agg.all = aggSpec.all;
			}

			self.view.setAggregate(agg, {
				sendEvent: false
			});
		}
	);
};

// #_addPrefsButtons {{{2

/**
 * Add preference-related controls to the grid's toolbar.
 *
 * @method
 *
 * @param {jQuery} toolbar
 * Toolbar section that will contain the buttons.
 */

Grid.prototype._addPrefsButtons = function (toolbar) {
	var self = this;

	var div = jQuery('<div>')
		.addClass('wcdv_toolbar_view')
		.css({'display': 'inline-block'})
		.appendTo(toolbar)
	;

	var options = {};

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

	var backBtn = jQuery('<button>', {'type': 'button'})
		.append(fontAwesome('fa-chevron-circle-left'))
		.attr('title', 'Back')
		.attr('disabled', true)
		.addClass('wcdv_icon_button')
		.css('margin', 0)
		.on('click', function () {
			self.prefs.back();
		})
		.appendTo(div)
	;

	var forwardBtn = jQuery('<button>', {'type': 'button'})
		.append(fontAwesome('fa-chevron-circle-right'))
		.attr('title', 'Forward')
		.attr('disabled', true)
		.addClass('wcdv_icon_button')
		.css('margin', 0)
		.on('click', function () {
			self.prefs.forward();
		})
		.appendTo(div)
	;

	/*
	var historyBtn = jQuery(fontAwesome('fa-clock-o', 'wcdv_button', 'History'))
		.on('click', function () {
			self.prefs._historyDebug();
		})
		.appendTo(div)
	;
	*/

	div.append(jQuery('<span>').text('View '))

	// Dropdown of all the available perspectives, plus an entry that (when selected) prompts for the
	// name of a new perspective.

	var dropdown = jQuery('<select>')
		.append(jQuery('<option>', { value: 'NEW' }).text('New View...'))
		.on('change', function (evt) {
			if (dropdown.val() === 'NEW') {
				var name = prompt('Enter new view name', self.prefs.getCurrentPerspective());
				if (name) {
					if (options[name] != null) {
						self.prefs.setCurrentPerspective(name);
					}
					else {
						self.prefs.addPerspective(name);
					}
				}
				else {
					dropdown.val(self.prefs.getCurrentPerspective());
				}
				return;
			}

			showHideBtns();
			self.prefs.setCurrentPerspective(dropdown.val());
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

	var renameBtn = jQuery(fontAwesome('F040', 'wcdv_button wcdv_text-primary', 'Rename'))
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
					self.prefs.renamePerspective(oldName, newName);
				}
			}
		})
		.appendTo(div)
	;

	// Clicking this button will delete the currently selected perspective and switch back to the
	// "Main" perspective.  It is only shown when the currently selected perspective is not "Main" as
	// it cannot be deleted.

	var deleteBtn = jQuery(fontAwesome('F1F8', 'wcdv_button wcdv_text-primary', 'Delete'))
		.on('click', function () {
			if (dropdown.val() === 'Main') {
				alert('Cannot delete "Main" view!');
			}
			else {
				var toDelete = dropdown.val();
				self.prefs.deletePerspective(toDelete);
				dropdown.children().filter(function (i, elt) {
					return elt.value === toDelete;
				}).remove();
				dropdown.val(self.prefs.getCurrentPerspective());
				showHideBtns();
			}
		})
		.appendTo(div)
	;

	// Clicking this button will reset all preferences back to the initial set (i.e. just "Main" and
	// no changes in the view from its default).  Perhaps useful when you have too many different
	// perspectives set, but I feel better having it as a safety in case your prefs somehow get really
	// messed up and don't work at all anymore.  This button is always shown.

	var resetBtn = jQuery(fontAwesome('F0E2', 'wcdv_button wcdv_text-primary', 'Reset'))
		.on('click', function () {
			self.prefs.reset();
			dropdown.children().filter(function (i, elt) {
				return elt.value !== self.prefs.getCurrentPerspective() && elt.value !== 'NEW';
			}).remove();
			dropdown.val(self.prefs.getCurrentPerspective());
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

	self.prefs.prime(function () {
		self.prefs.getPerspectives(function (perspectives) {
			_.each(perspectives.sort(), function (name) {
				if (options[name] == null) {
					options[name] = jQuery('<option>', { 'value': name })
						.text(name)
						.appendTo(dropdown);
				}
			});

			dropdown.val(self.prefs.getCurrentPerspective());
			showHideBtns();
		});

		self.prefs.on('perspectiveAdded', function (name) {
			if (options[name] == null) {
				options[name] = jQuery('<option>', {
					value: name
				}).text(name);
				dropdown.append(options[name]);
			}
		});

		self.prefs.on('perspectiveDeleted', function (name) {
			if (options[name] != null) {
				options[name].remove();
				delete options[name];
			}
		});

		self.prefs.on('perspectiveRenamed', function (oldName, newName) {
			if (options[oldName] != null) {
				options[oldName].attr('value', newName);
				options[oldName].text(newName);
				options[newName] = options[oldName];
				delete options[oldName];
			}
		});

		self.prefs.on('perspectiveChanged', function (name) {
			dropdown.val(name);
			showHideBtns();
		});

		self.prefs.on('prefsHistoryStatus', function (back, forward) {
			backBtn.attr('disabled', !back);
			forwardBtn.attr('disabled', !forward);
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

	debug.info('GRID', 'Redrawing...');

	if (self.tagOpts.title) {
		self.ui.rowCount.text('');
	}

	if (self.tagOpts.filterInput) {
		self.tagOpts.filterInput.store();
	}

	if (self.filterControl === undefined) {
		self.filterControl = new FilterControl(self, self.colConfig, self.view, self.features, self.timing);
		self.ui.filterControl.children().remove();
		self.filterControl.draw(self.ui.filterControl);
		self.ui.filterControl.show();
	}

	if (self.groupControl === undefined) {
		self.groupControl = new GroupControl(self, self.colConfig, self.view, self.features, self.timing);
		self.groupControl.on('fieldAdded', function (fieldAdded, fields) {
			self.ui.pivotControl.show();
			self.ui.aggregateControl.show();
		});
		self.groupControl.on('fieldRemoved', function (fieldRemoved, fields) {
			if (fields.length === 0) {
				self.ui.pivotControl.hide();
				self.ui.aggregateControl.hide();
			}
		});
		self.groupControl.on('cleared', function () {
			self.ui.pivotControl.hide();
			self.ui.aggregateControl.hide();
		});
		self.ui.groupControl.children().remove();
		self.groupControl.draw(self.ui.groupControl);
		self.ui.groupControl.show();
	}

	if (self.pivotControl === undefined) {
		self.pivotControl = new PivotControl(self, self.colConfig, self.view, self.features, self.timing);
		self.ui.pivotControl.children().remove();
		self.pivotControl.draw(self.ui.pivotControl);
		self.ui.pivotControl.hide();
	}

	if (EXPERIMENTAL_FEATURES['Reorder Control Fields']) {
		self.groupControl.getListElement().sortable({
			connectWith: '#' + self.pivotControl.getListElement().attr('id')
		})
			._addEventDebugging('sort', 'GROUP')
			.on('sortupdate', function () {
				self.groupControl.updateView();
			});

		self.pivotControl.getListElement().sortable({
			connectWith: '#' + self.groupControl.getListElement().attr('id')
		})
			._addEventDebugging('sort', 'PIVOT')
			.on('sortupdate', function () {
				self.pivotControl.updateView();
			});
	}

	if (self.aggregateControl === undefined) {
		self.aggregateControl = new AggregateControl(self, self.colConfig, self.view, self.features, self.timing);
		self.ui.aggregateControl.children().remove();
		self.aggregateControl.draw(self.ui.aggregateControl);
		self.ui.aggregateControl.hide();
	}

	var makeGridTable = function () {
		var gridTableCtor
			, gridTableOpts
			, ops = self.view.getLastOps()

		if (ops) {
			debug.info('GRID', 'Creating grid table with view opertions: %O', ops);
		}

		if (ops && ops.pivot) {
			gridTableCtor = GridTablePivot;
			gridTableOpts = deepCopy(self.defn.table.whenPivot);

			debug.info('GRID', 'Creating pivot grid table');

			if (self.features.limit) {
				self.ui.toolbar_limit.hide();
			}
			self.ui.toolbar_group.hide();
			self.ui.toolbar_pivot.show();
		}
		else if (ops && ops.group) {
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

			if (self.features.limit) {
				self.ui.toolbar_limit.hide();
			}
			self.ui.toolbar_group.show();
			self.ui.toolbar_pivot.hide();
		}
		else {
			gridTableCtor = GridTablePlain;
			gridTableOpts = deepCopy(self.defn.table.whenPlain);

			debug.info('GRID', 'Creating plain grid table');

			if (self.features.limit) {
				self.ui.toolbar_limit.hide();
			}
			self.ui.toolbar_group.hide();
			self.ui.toolbar_pivot.hide();
		}

		if (self.gridTable) {
			self.gridTable.clear();
		}

		gridTableOpts.fixedHeight = self.rootHasFixedHeight;

		self.ui.exportBtn.attr('disabled', true);
		self.gridTable = new gridTableCtor(self, self.defn, self.view, self.features, gridTableOpts, self.timing, self.id);
		self.gridTable.on(GridTable.events.unableToRender, makeGridTable);
		if (self.features.limit) {
			self.gridTable.on(GridTable.events.limited, function () {
				self.ui.toolbar_limit.show();
			});
			self.gridTable.on(GridTable.events.unlimited, function () {
				self.ui.toolbar_limit.hide();
			});
		}
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

	if (!self.isVisible()) {
		return;
	}

	self.view.clearSourceData();
};

// #_updateRowCount {{{2

/**
 * Set the number of rows shown in the titlebar.  You can provider the number yourself!
 *
 * @method
 * @memberof Grid
 */

Grid.prototype._updateRowCount = function (info, ops) {
	var self = this
		, doingServerFilter = getProp(self.defn, 'server', 'filter') && getProp(self.defn, 'server', 'limit') !== -1;

	debug.info('GRID', 'Updating row count');

	// When there's no titlebar, there's nothing for us to do here.

	if (!self.tagOpts.title) {
		return;
	}

	self._hideSpinner();

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
		self.ui.rowCount.text('pivoted');
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

// #hide {{{2

/**
 * Hide the grid.
 *
 * @method
 * @memberof Grid
 */

Grid.prototype.hide = function () {
	var self = this;

	debug.info('GRID', 'Hiding...');

	self.ui.content.hide({
		duration: 0,
		done: function () {
			if (self.tagOpts.title) {
				self.ui.showHideButton.removeClass('open fa-rotate-180');
			}
		}
	});
};

// #show {{{2

/**
 * Make the grid visible.  If the grid has not been "run" yet, it will be done now.
 *
 * @param {object} [opts]
 *
 * @param {boolean} [opts.redraw=true]
 * If true, automatically redraw the grid after it has been shown.  This is almost always what you
 * want, unless you intend to manually call `redraw()` or `refresh()` immediately after showing it.
 */

Grid.prototype.show = function (opts) {
	var self = this;

	opts = deepDefaults(opts, {
		redraw: true
	});

	debug.info('GRID', 'Showing...');

	self.ui.content.show({
		duration: 0,
		done: function () {
			if (self.tagOpts.title) {
				self.ui.showHideButton.addClass('open fa-rotate-180');
			}
			if (!self.hasRun && opts.redraw) {
				self.hasRun = true;
				self.redraw();
			}
		}
	});
};

// #toggle {{{2

/**
 * Toggle grid visibility.
 */

Grid.prototype.toggle = function () {
	var self = this;

	if (self.ui.content.css('display') === 'none') {
		self.show();
	}
	else {
		self.hide();
	}
};

// #isVisible {{{2

/**
 * Determine if the grid is currently visible.
 *
 * @returns {boolean}
 * True if the grid is currently visible, false if it is not.
 */

Grid.prototype.isVisible = function () {
	var self = this;

	return self.ui.content.css('display') !== 'none';
};

// hideControls {{{2

Grid.prototype.hideControls = function () {
	var self = this;

	if (self.ui.controls._isHidden()) {
		return;
	}

	self.ui.controls.hide({
		duration: 0,
		complete: function () {
			self.fire(Grid.events.hideControls);
		}
	});
	
	//Hide the toolbar
	self.ui.toolbar.hide({
		duration: 0,
		complete: function () {
			//self.fire(Grid.events.hideToolbar);
		}
	});
};

// showControls {{{2

Grid.prototype.showControls = function () {
	var self = this;

	if (!self.ui.controls._isHidden()) {
		return;
	}

	self.ui.controls.show({
		duration: 0,
		complete: function () {
			self.fire(Grid.events.showControls);
		}
	});
	
	//Show the toolbar
	self.ui.toolbar.show({
		duration: 0,
		complete: function () {
			//self.fire(Grid.events.showToolbar);
		}
	});
};

// toggleControls {{{2

Grid.prototype.toggleControls = function () {
	var self = this;

	if (self.ui.controls._isHidden()) {
		self.showControls();
	}
	else {
		self.hideControls();
	}
};

// #_setSpinner {{{2

/**
 * Set the type of the spinner icon.
 *
 * @param {string} what
 * The kind of spinner icon to show.  Must be one of: loading, not-loaded, working.
 */

Grid.prototype._setSpinner = function (what) {
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

// #_showSpinner {{{2

/**
 * Show the spinner icon.
 */

Grid.prototype._showSpinner = function () {
	var self = this;

	if (self.tagOpts.title) {
		self.ui.spinner.show();
	}
};

// #_hideSpinner {{{2

/**
 * Hide the spinner icon.
 */

Grid.prototype._hideSpinner = function () {
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

// #_normalize {{{2

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

Grid.prototype._normalize = function (defn) {
	var self = this;

	if (defn.normalized) {
		return;
	}

	defn.normalized = true;

	deepDefaults(true, defn, {
		prefs: null,
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
			},
			floatingHeader: {
				method: 'tabletool'
			}
		}
	});

	self._normalizeColumns(defn);
};

// #_normalizeColumns {{{2

Grid.prototype._normalizeColumns = function (defn) {
	var self = this;

	self.colConfig = new OrdMap();

	if (getProp(defn, 'table', 'columns')) {
		for (var i = 0; i < defn.table.columns.length; i += 1) {
			var cc = defn.table.columns[i];

			if (_.isString(cc)) {
				cc = { field: cc };
			}

			if (typeof cc.field !== 'string') {
				log.warn('Column Configuration: `field` must be a string');
				continue;
			}

			cc = deepDefaults(cc, {
				hideMidnight: false,
				format_dateOnly: 'LL',
				allowHtml: false
			});

			self.colConfig.set(cc.field, cc);
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
};

// #export {{{2

/**
 * Export whatever this grid is currently showing as a CSV file for the user to download.
 */

Grid.prototype.export = function () {
	var self = this;

	var fileName = (self.tagOpts.title || self.id) + '.csv';
	var csv = self.gridTable.getCsv();
	var contentType = 'text/csv';
	var blob = new Blob([csv], {'type': contentType});

	presentDownload(blob, fileName);
};
