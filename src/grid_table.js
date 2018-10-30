// Csv {{{1

/**
 * @typedef {object} Csv~Row
 *
 * @property {number} rowId
 * @property {boolean} hidden
 * @property {any[]} rowData
 */

/**
 * Represents the data that will be output by exporting the grid table to a spreadsheet format like
 * CSV.  This is used by grid table rendering functions to build the exported data while rendering
 * the HTML data shown onscreen.
 *
 * @property {number} lastRowId
 * The row ID of the last-added row.
 *
 * @property {Csv~Row} lastRow
 * The last-added row.
 *
 * @property {Csv~Row[]} data
 * All rows.
 *
 * @property {object} opts
 * Options for serializing the data to a string.
 *
 * @property {string} opts.separator
 * Column separator used when serializing.
 */

var Csv = makeSubclass(Object, function (opts) {
	var self = this;

	self.lastRowId = -2;
	self.opts = opts || {};

	_.defaults(self.opts, {
		separator: ','
	});

	self.clear();
});

// #addRow {{{2

/**
 * Add a row to the data set.
 *
 * @param {number} [rowId]
 * Row ID of the newly added row; if omitted, the last number is just incremented.
 */

Csv.prototype.addRow = function (rowId) {
	var self = this;

	if (rowId == null) {
		rowId = ++self.lastRowId;
	}

	self.lastRow = {
		rowId: rowId,
		rowData: [],
		hidden: false
	};
	self.data.push(self.lastRow);
};

// #addCol {{{2

/**
 * Add a column to the current row.
 *
 * @param {string} x
 * The value to add.
 */

Csv.prototype.addCol = function (x) {
	var self = this;

	if (x == null) {
		x = '';
	}
	else if (typeof x !== 'string') {
		x = x.toString();
	}

	// In case you didn't add a row before you added the first column.  Shame on you.

	if (self.lastRow == null) {
		self.addRow();
	}

	self.lastRow.rowData.push(x);
};

// #clear {{{2

/**
 * Reset the CSV data buffer.
 */

Csv.prototype.clear = function () {
	var self = this;

	self.lastRowId = -2;
	self.data = [];
	self.lastRow = null;
	self.order = null;
};

// #toString {{{2

/**
 * Render the entire set of data accumulated to a string.
 */

Csv.prototype.toString = function () {
	var self = this;

	var s = '';
	var sep = '"' + self.opts.separator + '"';
	var len = self.order != null ? self.order.length : self.data.length;

	for (i = 0; i < len; i += 1) {
		row = self.order != null ? self.getRowById(self.order[i]) : self.data[i];
		if (i > 0) {
			s += '\r\n';
		}
		s += '"' + row.rowData.map(function (s) {
			return s.replace('"', '""');
		}).join(sep) + '"';
	}

	return s;
};

// #getRowById {{{2

Csv.prototype.getRowById = function (rowId) {
	var self = this;

	return self.data[rowId].rowId === rowId
		? self.data[rowId]
		: _.findWhere(self.data, {rowId: rowId});
};

// #updateVisibility {{{2

Csv.prototype.updateVisibility = function (rowId, hide) {
	var self = this;
	var row = self.getRowById(rowId);

	if (row != null) {
		row.hidden = hide;
	}
};

// #setOrder {{{2

Csv.prototype.setOrder = function (rowId, pos) {
	var self = this;

	if (self.order == null) {
		self.order = [];
	}

	self.order[pos] = rowId;
};

// GridTable {{{1
// Constructor {{{2

/**
 * @class
 * @extends GridRenderer
 *
 * An abstract base class for all grid tables (which are responsible for building the DOM elements
 * to represent the data in a tabular format).  Concrete subclasses must implement the following
 * methods:
 *
 *   - `drawHeader(columns, data, typeInfo, opts)`
 *   - `drawBody(data, typeInfo, columns, cont, opts)`
 *   - `addWorkHandler()`
 *   - `canRender()`
 *
 * @property {number} UNIQUE_ID
 * A unique number for this grid table, used to generate namespaces for event handlers.
 *
 * @property {string} id
 *
 * @property {Grid} grid
 *
 * @property {object} defn
 *
 * @property {View} view
 *
 * @property {object} features
 *
 * @property {object} opts
 *
 * @property {Timing} timing
 *
 * @property {Array.<number>} selection
 * An array of the row IDs of selected rows.  The row ID here refers to that used by the source, so
 * the selection maps directly back to the underlying source data.
 *
 * @property {boolean} needsRedraw
 * If true, then the view has done something that requires us to be redrawn.
 *
 * @property {OrdMap} colConfig
 */

var GridTable = makeSubclass(GridRenderer, function () {
	var self = this;

	self.super.ctor.apply(self, arguments);

	self.selection = [];
	self.needsRedraw = false;

	_.defaults(self.opts, {
		drawInternalBorders: true,
		zebraStriping: true,
		generateCsv: true
	});
});

// Events {{{2

/**
 * Fired when columns have been resized automatically.  No longer used.
 *
 * @event GridTable#columnResize
 */

/**
 * Fired when the current GridRenderer subclass instance is unable to render the data from the view,
 * potentially because the view performed an operation (e.g. pivot) that this renderer is not able
 * to show the result of.
 *
 * @event GridTable#unableToRender
 *
 * @param {View~OperationsPerformed} ops
 * The operations performed by the view.
 */

/**
 * Fired when the output has been limited according to the renderer's limit configuration.
 *
 * @event GridTable#limited
 */

/**
 * Fired when all output is being shown, even though the grid is configured to limit output.  Most
 * likely, this is due to the number of rows not reaching the threshold configured for limiting.
 *
 * @event GridTable#unlimited
 */

/**
 * Fired when asynchronous CSV generation is finished.
 *
 * @event GridTable#csvReady
 */

/**
 * Fired periodically while generating the CSV file to indicate progress.  Before rendering starts,
 * it will be fired with a `progress` value of 0.  After rendering is done, it will be fired with a
 * `progress` value of 100.
 *
 * @event GridTable#generateCsvProgress
 *
 * @param {number} progress
 * The progress on a scale from 0 to 100.
 */

/**
 * Fired when rendering has started.
 *
 * @event GridTable#renderBegin
 */

/**
 * Fired when rendering has finished.
 *
 * @event GridTable#renderEnd
 */

mixinEventHandling(GridTable, 'GridTable', [
		'columnResize'        // A column is resized.
	, 'unableToRender'      // A grid table can't render the data in the view it's bound to.
	, 'limited'             // The grid table isn't rendering all possible rows.
	, 'unlimited'           // The grid table is rendering all possible rows.
	, 'csvReady'            // CSV data has been generated.
	, 'generateCsvProgress' // CSV generation progress.
	, 'renderBegin'
	, 'renderEnd'
	, 'selectionChange'
]);

// #_validateFeatures {{{2

GridTable.prototype._validateFeatures = function () {
	var self = this;

	if (self.features.block && !jQuery.blockUI) {
		log.error('GRID TABLE // CONFIG',
							'Feature "block" requires BlockUI library, which is not present');
		self.features.block = false;
	}

	if (self.features.limit) {
		self._validateLimit();

		self.scrollEvents = ['DOMContentLoaded', 'load', 'resize', 'scroll'].map(function (x) {
			return x + '.wcdv_gt_' + self.UNIQUE_ID;
		}).join(' ');
	}

	if (self.features.floatingHeader) {
		self._validateFloatTableHeader();
	}
};

// #_validateLimit {{{2

/**
 * Make sure the limit configuration is good.  If there's anything wrong, the limit feature is
 * disabled automatically.
 */

GridTable.prototype._validateLimit = function () {
	var self = this;

	if (self.features.limit) {
		if (self.defn.table.limit.threshold === undefined) {
			debug.warn('GRID TABLE - PLAIN // DRAW', 'Disabling limit feature because no limit threshold was provided');
			self.features.limit = false;
		}
	}
};

// #_validateFloatTableHeader {{{2

GridTable.prototype._validateFloatTableHeader = function () {
	var self = this;

	if (!self.features.floatingHeader) {
		return;
	}

	var config = getPropDef({}, self.defn, 'table', 'floatingHeader');

	if (config.method != null) {

		// The user requested a specific method for doing the floating header, make sure that the
		// library required is actually available.

		switch (config.method) {
		case 'floatThead':
			if (jQuery.prototype.floatThead == null) {
				log.error('GRID TABLE // CONFIG', 'Requested floating header method "floatThead" is not available');
				self.features.floatingHeader = false;
			}
			break;
		case 'fixedHeaderTable':
			if (jQuery.prototype.fixedHeaderTable == null) {
				log.error('GRID TABLE // CONFIG', 'Requested floating header method "fixedHeaderTable" is not available');
				self.features.floatingHeader = false;
			}
			break;
		case 'tabletool':
			if (window.TableTool == null) {
				log.error('GRID TABLE // CONFIG', 'Requested floating header method "tabletool" is not available');
				self.features.floatingHeader = false;
			}
			break;
		default:
			log.error('GRID TABLE // CONFIG', 'Unrecognized floating header method: ' + config.method);
			self.features.floatingHeader = false;
		}
	}
	else {

		// The user didn't request a specific method for doing the floating header, so let's look at
		// what libraries are available and pick based on that.

		if (jQuery.prototype.floatThead) {
			config.method = 'floatThead';
		}
		else if (jQuery.prototype.fixedHeaderTable) {
			config.method = 'fixedHeaderTable';
		}
		else if (window.TableTool) {
			config.method = 'tabletool';
		}
		else {
			self.features.floatingHeader = false;
		}
	}

	self.defn.table.floatingHeader = config;
};

// #setCss {{{2

GridTable.prototype.setCss = function (elt, field) {
	var self = this;
	var fcc = self.colConfig.get(field);

	if (fcc == null) {
		return;
	}

	var css = [
		{ configName: 'width'        , cssName: 'width'      },
		{ configName: 'minWidth'     , cssName: 'min-width'  },
		{ configName: 'maxWidth'     , cssName: 'max-width'  },
		{ configName: 'cellAlignment', cssName: 'text-align' }
	];

	for (var i = 0; i < css.length; i += 1) {
		if (fcc[css[i].configName] !== undefined) {
			elt.css(css[i].cssName, fcc[css[i].configName]);
		}
	}
};

// #setAlignment {{{2

GridTable.prototype.setAlignment = function (elt, fcc, fti, overrideType, fallback) {
	fcc = fcc || {};
	fti = fti || {};

	var type = overrideType || fti.type;
	var alignment = fcc.cellAlignment || fallback;

	if (alignment == null && (type === 'number' || type === 'currency')) {
		alignment = 'right';
	}

	switch (alignment) {
	case 'left':
		elt.addClass('wcdvgrid_textLeft');
		break;

	case 'right':
		elt.addClass('wcdvgrid_textRight');
		break;

	case 'center':
		elt.addClass('wcdvgrid_textCenter');
		break;

	case 'justify':
		elt.addClass('wcdvgrid_textJustify');
		break;

	default:
		// We don't have a class for every possible value, so just set the style rule on the
		// element in those cases.

		elt.css('text-align', alignment);
	}
};

// #_addSortingToHeader {{{2

/**
 * Attaches a sort icon to the given table header element, which (1) indicates the current sort, and
 * (2) when clicked brings up a menu to allow sorting by that header.
 *
 * @param {any} data
 *
 * @param {string} orientation
 * Indicates whether the sorting is `horizontal` (i.e. sorting reorders columns) or `vertical` (i.e.
 * sorting reorders rows).
 *
 * @param {View~SortSpec} spec
 * The sort spec.
 *
 * @param {Element} th
 * Where to place the sort icon.
 *
 * @param {Array.<View~AggInfo>} agg
 * Aggregate functions which we can sort by their results.
 */

GridTable.prototype._addSortingToHeader = function (data, orientation, spec, container, agg) {
	var self = this;

	if (!self.features.sort) {
		return;
	}

	var sortIcon_orientationClass = 'wcdv_sort_icon_' + orientation;

	/**
	 * @param {Element|jQuery} span
	 * The sort indicator span to replace.
	 *
	 * @param {string} [dir]
	 * What direction we're sorting by, ascending or descending.
	 */

	var replaceSortIndicator = function (span, dir) {
		if (!(span instanceof jQuery || span instanceof Element)) {
			throw new Error('Call Error: `span` must be either an Element or a jQuery');
		}

		if (dir != null && !_.isString(dir)) {
			throw new Error('Call Error: `dir` must be a string');
		}
		else if (dir != null && dir.toUpperCase() !== 'ASC' && dir.toUpperCase() !== 'DESC') {
			throw new Error('Call Error: `dir` must be either "ASC" or "DESC"');
		}

		if (span instanceof Element) {
			span = jQuery(span);
		}

		span.children().removeClass('wcdv_sort_arrow_active');
		container.closest('th').removeClass('wcdv_sort_column_active wcdv_bg-primary');

		if (dir != null) {
			container.closest('th').addClass('wcdv_sort_column_active wcdv_bg-primary');

			// Yes, this is backwards.  The FontAwesome icon for "ascending" points upwards, but I want to
			// color the one that points dowards, indicating that is the direction of increasing values.

			span.children().removeClass('wcdv_sort_arrow_active');
			span.children('.fa-sort-desc').addClass('wcdv_sort_arrow_' + (dir.toUpperCase() === 'ASC' ? 'active' : 'inactive'));
			span.children('.fa-sort-asc').addClass('wcdv_sort_arrow_' + (dir.toUpperCase() === 'DESC' ? 'active' : 'inactive'));
		}
	};

	/**
	 * Set the sorting for the view to the current orientation/spec, on the specified aggregate number
	 * and in the specified direction.
	 *
	 * @param {string} dir
	 *
	 * @param {number} [aggNum]
	 * If missing, no aggregate number is added to the sort spec.  Used when sorting directly by the
	 * field (e.g. in plain output) or by the group field index (e.g. in group detail output).
	 */

	var setSort = function (dir, aggNum) {
		if (!_.isString(dir)) {
			throw new Error('Call Error: `dir` must be a string');
		}
		else if (dir.toUpperCase() !== 'ASC' && dir.toUpperCase() !== 'DESC') {
			throw new Error('Call Error: `dir` must be either "ASC" or "DESC"');
		}

		if (aggNum != null && !_.isNumber(aggNum)) {
			throw new Error('Call Error: `aggNum` must be a number');
		}

		jQuery('span.' + sortIcon_orientationClass + '.fa-stack').each(function (i, elt) {
			replaceSortIndicator(elt);
		});

		jQuery('span.' + sortIcon_class).each(function (i, elt) {
			replaceSortIndicator(elt, dir);
		});

		spec.aggNum = aggNum;
		spec.dir = dir;

		var sortSpec = self.view.getSort() || {};
		sortSpec[orientation] = deepCopy(spec);
		self.view.setSort(sortSpec, self.makeProgress('Sort'));
	};

	var sortIcon_class = gensym();
	var sortIcon_span = fontAwesome('fa-stack', orientation === 'horizontal' ? 'fa-rotate-270' : null)
		.addClass(sortIcon_class)
		.addClass(sortIcon_orientationClass)
		.addClass('wcdv_sort_icon');

	// Set the sort direction in the arrow icon.  The way we do this is by building a single
	// FontAwesome "stack" from the up and down carets.  Then we can style the one we want.

	jQuery('<span>').addClass('fa fa-sort-asc fa-stack-1x').appendTo(sortIcon_span);
	jQuery('<span>').addClass('fa fa-sort-desc fa-stack-1x').appendTo(sortIcon_span);

	var sortIcon_menu_items = {};

	if (spec.field != null || spec.groupFieldIndex != null) {

		// We're sorting by a field.  This can occur in these situations:
		//
		//   1. Sorting plain output by any column.
		//   2. Sorting group output by a field that we've grouped by.

		var name = spec.field != null
			? spec.field
			: spec.groupFieldIndex != null
			? data.groupFields[spec.groupFieldIndex]
			: 'Unknown'
		;

		sortIcon_menu_items[gensym()] = {
			name: name + ', Ascending',
			icon: 'fa-sort-amount-asc',
			callback: function () {
				setSort('asc')
			}
		};
		sortIcon_menu_items[gensym()] = {
			name: name + ', Descending',
			icon: 'fa-sort-amount-desc',
			callback: function () {
				setSort('desc')
			}
		};
		sortIcon_menu_items[gensym()] = '----';
	}
	else {

		// We're sorting by the result of an aggregate function.

		_.each(agg, function (aggInfo, aggNum) {
			if (spec.aggType != null && spec.aggNum !== aggNum) {
				return;
			}

			var aggType = aggInfo.instance.getType();
			sortIcon_menu_items[gensym()] = {
				name: aggInfo.instance.getFullName() + ', Ascending',
				icon: 'fa-sort-amount-asc',
				callback: function () {
					setSort('asc', aggNum)
				}
			};
			sortIcon_menu_items[gensym()] = {
				name: aggInfo.instance.getFullName() + ', Descending',
				icon: 'fa-sort-amount-desc',
				callback: function () {
					setSort('desc', aggNum)
				}
			};
			sortIcon_menu_items[gensym()] = '----';
		});
	}

	// Include an option to reset the sort.  This is just as much to fluff up the all-too-common
	// two-entry menu as anything else.

	sortIcon_menu_items.reset = {
		name: 'Reset Sort',
		icon: 'fa-ban',
		callback: function () {
			self.view.clearSort();
		}
	};

	// Create the context menu.
	//
	// TODO The plugin allow the reuse of the menu among multiple targets.  See if we can use that
	// within the grid.
	//
	// TODO Does spawning a bunch of these (i.e. every time the table is redrawn) use a bunch of
	// memory?  Is there a way to destroy the menu to reclaim it?

	var sortIcon_menu = jQuery.contextMenu({
		selector: '.' + sortIcon_class,
		trigger: 'left',
		callback: function (itemKey, opt) {
			console.log(itemKey);
		},
		items: sortIcon_menu_items
	});

	container.append(sortIcon_span);

	// Now check the existing sort specification in the view to see if any of the sort icons that we
	// just created should be lit up.

	var sortSpec_copy = deepCopy(self.view.getSort());
	var spec_copy = deepCopy(spec);

	if (sortSpec_copy[orientation]) {
		var currentDir = sortSpec_copy[orientation].dir;

		// Delete things that would be in the view's spec that aren't in the spec we were provided by
		// the caller (because they're independent of the user interface reflecting the sort).  This way
		// we can just do an object-object comparison to see if what we just made corresponds to the
		// sort that is already set in the view.  Crucially, for grid tables that redraw when the view
		// is updated, this is the only way you're ever going to see what the sort is.

		delete sortSpec_copy[orientation].dir;

		// Note that `aggNum` is an important part of the spec when sorting group or pivot aggregates
		// (i.e. total rows/columns) because they have their own row/column, and aren't thrown together
		// like cell aggregates are.

		if (spec.aggType == null) {
			delete sortSpec_copy[orientation].aggNum;
			delete spec_copy.aggNum;
		}

		//debug.info('GRID TABLE // ADD SORTING', 'orientation = %s ; spec = %O ; current = %O ; dir = %s',
		//	orientation, spec_copy, sortSpec_copy[orientation], currentDir);

		if (_.isEqual(sortSpec_copy[orientation], spec_copy)) {
			replaceSortIndicator(sortIcon_span, currentDir);
		}
	}
};

// #_addFilterToHeader {{{2

GridTable.prototype._addFilterToHeader = function (container, field, displayText) {
	var self = this;

	if (self.grid.filterControl == null) {
		return;
	}

	jQuery(fontAwesome('fa-filter', 'wcdv_filter_icon', 'Click to add a filter for "' + field + '"'))
		.on('click', function () {
			self.grid.filterControl.addField(field, displayText, {
				openControls: true
			});
		})
		.tooltip({
			classes: {
				'ui-tooltip': 'ui-corner-all ui-widget-shadow wcdv_info_tooltip wcdv_border-primary'
			},
			show: { delay: 1000 }
		})
		.appendTo(container);
};

// #_addDrillDownHandler {{{2

GridTable.prototype._addDrillDownHandler = function (tbl, data) {
	var self = this;

	tbl.on('mousedown', function (evt) {
		if (evt.detail > 1) {
			evt.preventDefault();
		}
	});
	tbl.on('dblclick', 'td.wcdv_drill_down', function () {
		if (window.getSelection) {
			window.getSelection().removeAllRanges();
		}
		else if (document.selection) {
			document.selection.empty();
		}

		var elt = jQuery(this);
		var filter = deepCopy(self.view.getFilter());
		var rowValIndex = elt.attr('data-rowval-index');
		var colValIndex = elt.attr('data-colval-index');

		if (rowValIndex != null) {
			_.each(data.rowVals[rowValIndex], function (x, i) {
				filter[data.groupFields[i]] = {
					'$eq': x
				};
			});
		}

		if (colValIndex != null) {
			_.each(data.colVals[colValIndex], function (x, i) {
				filter[data.pivotFields[i]] = {
					'$eq': x
				};
			});
		}

		debug.info('GRID TABLE - PIVOT // DRILL DOWN',
			'Creating new perspective: filter = %O', filter);

		window.setTimeout(function () {
			self.view.prefs.addPerspective('Drill Down', { view: { filter: filter } }, { isTemporary: true }, null, { onDuplicate: 'replace' });
		});
	});
};

// #_addDrillDownClass {{{2

GridTable.prototype._addDrillDownClass = function (elt) {
	elt.addClass('wcdv_drill_down');
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
//		if (self.features.limit) {
			self.view.on('sortEnd', function () {
				debug.info('GRID TABLE // HANDLER (View.sortEnd)', 'Marking table to be redrawn');
				self.needsRedraw = true;
			}, { who: self });
//		}
//		else {
//			self.view.on('sort', function (rowNum, position) {
//				var elt = jQuery(document.getElementById(self.defn.table.id + '_' + rowNum));
//
//				// Add one to the position (which is 0-based) to match the 1-based row number in CSS.
//
//				elt.removeClass('even odd');
//				elt.addClass((position + 1) % 2 === 0 ? 'even' : 'odd');
//				self.ui.tbody.append(elt);
//
//				self.csv.setOrder(rowNum, position);
//			}, { who: self });
//		}
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
	// We also can't use this approach when we're using preferences, because those can cause the data
	// to be filtered down before our grid actually creates all the rows.  (The prefs are applied
	// before the grid table is created.)  At that point, showing or hiding rows is irrelevant because
	// the grid table doesn't event know what the unfiltered ones are, it's only ever seen the data
	// with filters applied.

	self.view.off('filter');

//	if (self.features.limit || self.view.opts.saveViewConfig) {
		self.view.on(View.events.filterEnd, function () {
			debug.info('GRID TABLE // HANDLER (View.filterEnd)', 'Marking table to be redrawn');
			self.needsRedraw = true;
		}, { who: self });
//	}
//	else {
//		var even = false; // Rows are 1-based to match our CSS zebra-striping.
//
//		self.view.on(View.events.filter, function (rowNum, hide) {
//			if (isNothing(self.ui.tr[rowNum])) {
//				debug.info('GRID TABLE // HANDLER (View.filter)', 'We were told to ' + (hide ? 'hide' : 'show') + ' row ' + rowNum + ', but it doesn\'t exist');
//				return;
//			}
//
//			self.ui.tr[rowNum].removeClass('even odd');
//			if (hide) {
//				self.ui.tr[rowNum].hide();
//			}
//			else {
//				self.ui.tr[rowNum].show();
//				self.ui.tr[rowNum].addClass(even ? 'even' : 'odd');
//				even = !even;
//			}
//
//			self.csv.updateVisibility(rowNum, hide);
//		}, { who: self });
//	}
};

// #_addRowReorderHandler {{{2

GridTable.prototype._addRowReorderHandler = function () {
	var self = this;

	self.ui.tbody._makeSortableTable(_.bind(self.view.source.swapRows, self.view.source));
};

// #_addRowSelectHandler {{{2

/**
 * Add an event handler for the row select checkboxes.  The event is bound on `self.ui.tbody` and
 * looks for checkbox inputs inside TD elements with class `wcdv-row-select-col` to actually handle
 * the events.  The handler calls `self.select(ROW_NUM)` or `self.unselect(ROW_NUM)` when the
 * checkbox is changed.
 */

GridTable.prototype._addRowSelectHandler = function () {
	var self = this;

	self.ui.tbody.on('change', 'td.wcdv-row-select-col > input[type="checkbox"]', function () {
		if (this.checked) {
			self.select(+(jQuery(this).attr('data-row-num')));
		}
		else {
			self.unselect(+(jQuery(this).attr('data-row-num')));
		}
	});
};

// #_getAggInfo {{{2

GridTable.prototype._getAggInfo = function (data) {
	var ai = objFromArray(['cell', 'group', 'pivot', 'all'], [[]]);
	ai = _.mapObject(ai, function (val, key) {
		return _.filter(
			getPropDef([], data, 'agg', 'info', key),
			function (aggInfo) {
				return !aggInfo.isHidden;
			}
		);
	});
	return ai;
};

// #draw {{{2

GridTable.prototype.draw = function (root, opts, cont) {
	var self = this;

	return self.super.draw(root, opts, function (data, typeInfo) {
		if (self.features.limit && self.defn.table.limit.method === 'more') {
			self.scrollEventElement = self.opts.fixedHeight ? self.root : window;
			jQuery(self.scrollEventElement).on(self.scrollEvents, function () {
				if (typeof self.moreVisibleHandler === 'function') {
					self.moreVisibleHandler();
				}
			});
		}

		var tr;
		var srcIndex = 0;

		self.csv = new Csv();

		self.ui = {
			tbl: jQuery('<table>'),
			thead: jQuery('<thead>'),
			tbody: jQuery('<tbody>'),
			tfoot: jQuery('<tfoot>'),
			thMap: {},
			tr: {},
			progress: jQuery('<div>')
		};

		self._addDrillDownHandler(self.ui.tbl, data);

		if (self.features.block) {
			var blockConfig = {
				overlayCSS: {
					opacity: 0.9,
					backgroundColor: '#FFF'
				}
			};

			if (self.features.progress && getProp(self.defn, 'table', 'progress', 'method') === 'jQueryUI') {
				blockConfig.message = jQuery('<div>')
					.append(jQuery('<h1>').text('Working...'))
					.append(self.ui.progress);
			}
		}

		self.view.on(View.events.workBegin, function () {
			if (self.features.block) {
				debug.info('GRID TABLE // HANDLER (View.workBegin)', 'Blocking table body');
				if (getProp(self.defn, 'table', 'block', 'wholePage')) {
					jQuery.blockUI(blockConfig);
				}
				else {
					self.ui.tbl.block(blockConfig);
				}
			}
			if (self.features.floatingHeader) {
				switch (getProp(self.defn, 'table', 'floatingHeader', 'method')) {
				case 'tabletool':
					TableTool.update();
					break;
				}
			}
		}, { who: self });

		self.view.on(View.events.workEnd, function () {
			if (self.features.block) {
				debug.info('GRID TABLE // HANDLER (View.workEnd)', 'Unblocking table body');
				if (getProp(self.defn, 'table', 'block', 'wholePage')) {
					jQuery.unblockUI();
				}
				else {
					self.ui.tbl.unblock();
				}
			}
			if (self.features.floatingHeader) {
				switch (getProp(self.defn, 'table', 'floatingHeader', 'method')) {
				case 'tabletool':
					TableTool.update();
					break;
				}
			}
		}, { who: self });

		/*
		 * Determine what columns will be in the table.  This comes from the user, or from the data
		 * itself.  We may then add columns for extra features (like row selection or reordering).
		 */

		var columns = determineColumns(self.colConfig, data, typeInfo);
		var numCols = columns.length;

		if (self.features.rowSelect) {
			numCols += 1; // Add a column for the row selection checkbox.
		}

		if (self.features.rowReorder) {
			numCols += 1; // Add a column for the reordering button.
		}

		self.drawHeader(columns, data, typeInfo, opts);

		if (self.features.footer) {
			self.drawFooter(columns, data, typeInfo);
		}

		self.addSortHandler();

		if (self.features.rowSelect) {
			if (typeof self._addRowSelectHandler !== 'function') {
				log.warn('Requested feature "rowSelect" is not available: `_addRowSelectHandler` method does not exist');
			}
			else {
				self._addRowSelectHandler();
			}
		}

		if (self.features.rowReorder) {
			self._addRowReorderHandler();
		}

		if (self.opts.zebraStriping) {
			self.ui.tbl.addClass('zebra');
		}

		if (getProp(self.opts, 'addClass', 'table')) {
			self.ui.tbl.addClass(getProp(self.opts, 'addClass', 'table'));
		}

		self.ui.tbl.append(self.ui.thead);

		if (!getProp(self.defn, 'table', 'incremental', 'appendBodyLast')) {
			self.ui.tbl.append(self.ui.tbody);

			if (self.features.footer) {
				self.ui.tbl.append(self.ui.tfoot);
			}
		}

		// IMPORTANT: We use appendChild() here instead of jQuery's append() because the latter will
		// re-run any <script> elements in the footer, which we don't want.

		self.root.get(0).appendChild(self.ui.tbl.get(0));

		/*
		 * Draw the body.
		 */

		self.drawBody(data, typeInfo, columns, function () {
			if (getProp(self.defn, 'table', 'incremental', 'appendBodyLast')) {
				self.ui.tbl.append(self.ui.tbody);

				if (self.features.footer) {
					self.ui.tbl.append(self.ui.tfoot);
				}
			}

			self.timing.stop(['Grid Table', 'Draw']);

			if (typeof tableDone === 'function') {
				window.setTimeout(function () {
					tableDone();
				});
			}
		}, opts);

		// Activate TableTool using this attribute, if the user asked for it.

		if (self.features.floatingHeader) {
			debug.info('GRID TABLE // DRAW', 'Enabling floating header using method "%s"',
				getProp(self.defn, 'table', 'floatingHeader', 'method'));
			switch (getProp(self.defn, 'table', 'floatingHeader', 'method')) {
			case 'floatThead':
				var floatTheadConfig = {
					zIndex: 1
				};
				if (self.opts.fixedHeight) {
					floatTheadConfig.position = 'fixed';
					floatTheadConfig.scrollContainer = true;
					self.grid.on(Grid.events.showControls, function () {
						self.ui.tbl.floatThead('reflow');
					}, { who: self });
					self.grid.on(Grid.events.hideControls, function () {
						self.ui.tbl.floatThead('reflow');
					}, { who: self });
					self.grid.filterControl.on(['fieldAdded', 'fieldRemoved'], function () {
						self.ui.tbl.floatThead('reflow');
					}, { who: self });
					self.grid.aggregateControl.on(['fieldAdded', 'fieldRemoved'], function () {
						self.ui.tbl.floatThead('reflow');
					}, { who: self });
				}
				self.ui.tbl.floatThead(floatTheadConfig);
				break;
			case 'tabletool':
				if (self.opts.fixedHeight) {
					self.ui.tbl.attr('data-tttype', 'fixed');
				}
				else {
					self.ui.tbl.attr('data-tttype', 'sticky');
				}
				break;
			}
		}

		self.addWorkHandler();

		self.fire('renderEnd');
		self.drawLock.unlock();

		if (typeof cont === 'function') {
			return cont();
		}
	});
};

// #drawHeader_aggregates {{{2

/**
 * Add TH elements for all the aggregates to the specified TR.
 *
 * @param {Object} data
 *
 * @param {Element} tr
 * Where to put the TH elements.
 */

GridTable.prototype.drawHeader_aggregates = function (data, tr, displayOrderIndex, displayOrderMax) {
	var self = this;
	var ai = self._getAggInfo(data);

	_.each(ai.group, function (aggInfo, aggIndex) {
		var aggNum = aggInfo.aggNum,
			text = aggInfo.instance.getFullName(),
			span = jQuery('<span>')
				.addClass('wcdv_heading_title')
				.text(text),
			headingThControls = jQuery('<div>'),
			headingThContainer = jQuery('<div>')
				.addClass('wcdv_heading_container')
				.append(span, headingThControls),
			th = jQuery('<th>')
				.append(headingThContainer)
				.appendTo(tr);

		if (self.opts.drawInternalBorders || data.agg.info.group.length > 1) {
			if (displayOrderIndex > 0 && aggIndex === 0) {
				th.addClass('wcdv_bld'); // border-left: double
			}
			if (displayOrderIndex < displayOrderMax - 1 && aggIndex === ai.group.length - 1) {
				th.addClass('wcdv_brd'); // border-right: double
			}
			if (aggIndex > 0) {
				th.addClass('wcdv_pivot_colval_boundary');
			}
		}
		self.csv.addCol(text);
		self._addSortingToHeader(data, 'vertical', {aggType: 'group', aggNum: aggNum}, headingThControls, ai.group);
		self.setAlignment(th, aggInfo.colConfig[0], aggInfo.typeInfo[0], aggInfo.instance.getType());
	});
};

// #drawHeader_addCols {{{2

GridTable.prototype.drawHeader_addCols = function (tr, typeInfo, opts) {
	var self = this;

	if (self.opts.addCols) {
		_.each(self.opts.addCols, function (addCol) {
			span = jQuery('<span>')
				.text(addCol.name);
			th = jQuery('<th>')
				.append(span)
				.appendTo(tr);
			self.csv.addCol(addCol.name);
			if (getProp(opts, 'pivotConfig', 'aggField')) {
				self.setAlignment(th, self.colConfig.get(opts.pivotConfig.aggField), typeInfo.get(opts.pivotConfig.aggField));
			}
		});
	}
};

// #drawBody_rowVals {{{2

/**
 * Draw the rowvals from a single group.  For example, if grouping by "State" and "County", group
 * number 0 might be the rowval `["Alabama", "Autauga"]` — and that's what this function would put
 * out as TH elements.
 *
 * @param {object} data
 *
 * @param {Element} tr
 * The row to attach the TH elements to.
 *
 * @param {number} groupNum
 * What group number you want to print out.
 */

GridTable.prototype.drawBody_rowVals = function (data, tr, groupNum) {
	var self = this;

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

	_.each(data.rowVals[groupNum], function (rowVal, rowValIndex) {
		var groupField = data.groupFields[rowValIndex];
		var fcc = self.colConfig.get(groupField) || {};

		rowVal = format(fcc, self.typeInfo.get(groupField), rowVal);

		var th = jQuery('<th>');
		var span = jQuery('<span>').addClass('wcdv_heading_title');

		var headingThControls = jQuery('<div>');

		var headingThContainer = jQuery('<div>')
			.addClass('wcdv_heading_container')
			.append(span, headingThControls);

		if (rowVal instanceof Element || rowVal instanceof jQuery) {
			span.append(rowVal);
		}
		else if (fcc.allowHtml) {
			span.html(rowVal);
		}
		else {
			span.text(rowVal);
		}

		headingThContainer.appendTo(th);
		th.appendTo(tr);
		self.csv.addCol(span.text());

		if (data.isPivot && rowValIndex === data.groupFields.length - 1) {
			self._addSortingToHeader(data, 'horizontal', {rowVal: data.rowVals[groupNum], aggNum: 0}, headingThControls, getPropDef([], data, 'agg', 'info', 'cell'));
		}
	});
};

// #drawBody_groupAggregates {{{2

GridTable.prototype.drawBody_groupAggregates = function (data, tr, groupNum, displayOrderIndex, displayOrderMax) {
	var self = this;
	var ai = self._getAggInfo(data);

	_.each(ai.group, function (aggInfo, aggGroupIndex) {
		var aggNum = aggInfo.aggNum;
		var aggType = aggInfo.instance.getType();
		var aggResult = data.agg.results.group[aggNum][groupNum];
		var text;

		if (aggInfo.instance.inheritFormatting) {
			text = format(aggInfo.colConfig[0], aggInfo.typeInfo[0], aggResult, {
				overrideType: aggType
			});
		}
		else {
			text = format(null, null, aggResult, {
				overrideType: aggType
			});
		}

		var td = jQuery('<td>').text(text).attr({
			'data-rowval-index': groupNum
		});

		self._addDrillDownClass(td);

		if (self.opts.drawInternalBorders || data.agg.info.group.length > 1) {
			if (displayOrderIndex > 0 && aggGroupIndex === 0) {
				td.addClass('wcdv_bld'); // border-left: double
			}
			if (displayOrderIndex < displayOrderMax - 1 && aggGroupIndex === ai.group.length - 1) {
				td.addClass('wcdv_brd'); // border-right: double
			}
			if (aggGroupIndex > 0) {
				td.addClass('wcdv_pivot_colval_boundary');
			}
		}

		self.csv.addCol(text);
		self.setAlignment(td, aggInfo.colConfig[0], aggInfo.typeInfo[0], aggInfo.instance.getType());
		td.appendTo(tr);
	});
};

// #clear {{{2

/**
 * Remove the table from page.
 */

GridTable.prototype.clear = function () {
	var self = this;

	if (self.features.limit && self.defn.table.limit.method === 'more') {
		jQuery(self.scrollEventElement).off(self.scrollEvents);
	}

	self.view.off('*', self, {silent: true});

	if (self.opts.footer != null && self.opts.stealGridFooter) {
		self.grid.ui.content.get(0).appendChild(self.opts.footer.get(0));
	}

	self.root.children().remove();
};

// #makeProgress {{{2

GridTable.prototype.makeProgress = function (thing) {
	var self = this;

	if (!self.features.progress) {
		return;
	}

	if (getProp(self.defn, 'table', 'progress', 'method') === 'NProgress') {
		return {
			begin: function () {
				debug.info('GRID TABLE - PLAIN // PROGRESS (' + thing + ')', 'Begin');
				if (window.NProgress !== undefined) {
					window.NProgress.start();
				}
			},
			update: function (amount, estTotal) {
				debug.info('GRID TABLE - PLAIN // PROGRESS (' + thing + ')', sprintf('Update: %d / %d = %.0f%%', amount, estTotal, (amount / estTotal) * 100));
				if (window.NProgress !== undefined) {
					window.NProgress.set(amount / estTotal);
				}
			},
			end: function () {
				debug.info('GRID TABLE - PLAIN // PROGRESS (' + thing + ')', 'End');
				if (window.NProgress !== undefined) {
					window.NProgress.done();
					jQuery('.nprogress-custom-parent').removeClass('nprogress-custom-parent');
				}
			}
		};
	}
	else if (getProp(self.defn, 'table', 'progress', 'method') === 'jQueryUI') {
		return {
			begin: function () {
				debug.info('GRID TABLE - PLAIN // PROGRESS (' + thing + ')', 'Begin');
				self.ui.progress.progressbar({
					'classes': {
						'ui-progressbar': 'wcdvgrid_progressbar',
						'ui-progressbar-value': 'wcdvgrid_progressbar'
					}
				});
			},
			update: function (amount, estTotal) {
				debug.info('GRID TABLE - PLAIN // PROGRESS (' + thing + ')', sprintf('Update: %d / %d = %.0f%%', amount, estTotal, (amount / estTotal) * 100));
				self.ui.progress.progressbar('value', (amount / estTotal) * 100);
			},
			end: function () {
				debug.info('GRID TABLE // PROGRESS (' + thing + ')', 'End');
				self.ui.progress.progressbar('destroy');
			}
		};
	}
};

// #getCsv {{{2

GridTable.prototype.getCsv = function () {
	var self = this;

	return self.csv.toString();
};

// #getSelection {{{2

/**
 * Get the currently selected rows.
 *
 * @return {object}
 * Information on what rows are selected.  Contains the following properties:
 *
 * - `rowIds` — An array of the unique IDs of the selected rows.  Probably not that useful to you,
 *   but it's available.
 *
 * - `rows` — An array of the data represented by each row.  Each row is an object, each key in the
 *   object is a field in the source data.  Values are references to the actual data used by the
 *   grid, so don't mess with their internal structures.
 *
 * The ordering of the results is not guaranteed to have any relationship to the order of the rows
 * from the source, or the order in which they were checked.
 */

GridTable.prototype.getSelection = function () {
	var self = this;

	return {
		rowIds: self.selection,
		rows: _.map(self.selection, function (rowId) {
			return self.data.dataByRowId[rowId];
		})
	};
};

// #setSelection {{{2

/**
 * Set the currently selected rows.  This is different from {@link GridTable#select} and {@link
 * GridTable#unselect} because this straight-up sets the selection (the other methods add to and
 * remove from the selection).
 *
 * @param {number[]} [what]
 * Set the selection to the specified row IDs, or select nothing if not specified.
 */

GridTable.prototype.setSelection = function (what) {
	var self = this;
	var data = self.data.data;

	if (self.data.isGroup) {
		data = _.flatten(data);
	}
	else if (self.data.isPivot) {
		log.error('Selection is not supported for pivotted data, because there is no way to see or change the selection in the user interface');
		return;
	}

	if (what == null) {
		self.selection = [];
	}
	else if (_.isArray(what)) {
		self.selection = what;
	}
	else {
		log.error('GridTable#setSelection(): parameter `what` must be null/undef or an array');
		return false;
	}

	// Try to reflect these changes in the user interface.

	if (typeof self._updateSelectionGui === 'function') {
		self._updateSelectionGui();
	}

	self.fire('selectionChange', null, _.map(self.selection, function (i) {
		return data[i];
	}));
};

// #select {{{2

/**
 * Adds to the current selection.
 *
 * To add all rows where the field "Model" is Civic, Fit, or Accord:
 *
 * ```
 * grid.select((row) => { ['Civic', 'Fit', 'Accord'].indexOf(row['Model'].value) >= 0 });
 * ```
 *
 * @param {number|number[]|function} [what]
 * Behaves as follows:
 *
 * - When not specified, adds all rows to the selection.
 * - When a number or array of numbers, adds all those row IDs to the selection.
 * - When a function, adds all rows that pass that filter to the selection.
 */

GridTable.prototype.select = function (what) {
	var self = this;
	var data = self.data.data;

	if (self.data.isGroup) {
		data = _.flatten(data);
	}
	else if (self.data.isPivot) {
		log.error('Selection is not supported for pivotted data, because there is no way to see or change the selection in the user interface');
		return;
	}

	if (what == null) {
		// Select all.
		self.selection = _.pluck(data, 'rowNum');
	}
	else if (_.isArray(what)) {
		// Add elements to the selection.
		self.selection = _.union(self.selection, what);
	}
	else if (typeof what === 'function') {
		// Add passing rows to the selection.
		var passing = _.filter(data, function (d) {
			return what(d.rowData);
		});
		self.selection = _.union(self.selection, _.pluck(passing, 'rowNum'));
	}
	else if (!_.contains(self.selection, what)) {
		// Add item to ths selection.
		self.selection.push(what);
	}

	// Try to reflect these changes in the user interface.

	if (typeof self._updateSelectionGui === 'function') {
		self._updateSelectionGui();
	}

	self.fire('selectionChange', null, _.map(self.selection, function (i) {
		return data[i];
	}));
};

// #unselect {{{2

/**
 * Removes from the current selection.
 *
 * To remove all rows where the field "Make" is Honda:
 *
 * ```
 * grid.unselect((row) => { row['Make'].value === 'Honda' });
 * ```
 *
 * @param {number|number[]|function} [what]
 * Behaves as follows:
 *
 * - When not specified, removes all rows from the selection.
 * - When a number or array of numbers, removes all those row IDs from the selection.
 * - When a function, removes all rows that pass that filter from the selection.
 */

GridTable.prototype.unselect = function (what) {
	var self = this;
	var data = self.data.data;

	if (self.data.isGroup) {
		data = _.flatten(data);
	}
	else if (self.data.isPivot) {
		log.error('Selection is not supported for pivotted data, because there is no way to see or change the selection in the user interface');
		return;
	}

	if (what == null) {
		// Unselect all.
		self.selection = [];
	}
	else if (_.isArray(what)) {
		// Remove elements from the selection.
		self.selection = _.difference(self.selection, what);
	}
	else if (typeof what === 'function') {
		// Remove passing elements from the selection.
		self.selection = _.reject(self.selection, function (x) {
			return what(self.data.dataByRowId[x]);
		});
	}
	else {
		// Remove item from the selection.
		self.selection = _.without(self.selection, what);
	}

	// Try to reflect these changes in the user interface.

	if (typeof self._updateSelectionGui === 'function') {
		self._updateSelectionGui();
	}

	self.fire('selectionChange', null, _.map(self.selection, function (i) {
		return data[i];
	}));
};

// #isSelected {{{2

/**
 * Tells if a row is selected.
 *
 * @param {number} what
 * Row ID to check.
 *
 * @return {boolean}
 * True if the row is selected, false if it isn't.
 */

GridTable.prototype.isSelected = function (what) {
	var self = this;

	return self.selection.indexOf(what) >= 0;
};

// #_updateSelectionGui {{{2

GridTable.prototype._updateSelectionGui = function () {
	log.error('GridTable#_updateSelectionGui(): Must be implemented by subclass');
}

// GridTablePlain {{{1
// Constructor {{{2

/**
 * The GridTablePlain is in charge of displaying the HTML table of data.
 *
 * @class
 * @extends GridTable
 *
 * @property {Grid~Features} features
 *
 * @property {object} defn
 *
 * @property {View} view
 *
 * @property {Element} root
 *
 * @property {object} colConfig Map associating field name with the configuration of the
 * corresponding column in this grid table.
 *
 * @property {Timing} timing
 *
 * @property {boolean} needsRedraw True if the grid needs to redraw itself when the view is done
 * working.
 */

var GridTablePlain = makeSubclass(GridTable, function (grid, defn, view, features, opts, timing, id) {
	var self = this;

	self.super.ctor.apply(self, arguments);

	self.features.filter = false;

	debug.info('GRID TABLE - PLAIN', 'Constructing grid table; features = %O', features);

	self.addFilterHandler();
});

// #canRender {{{2

/**
 * Responds whether or not this grid table can render the type of data requested.
 *
 * @param {string} what
 * The kind of data the caller wants us to show.  Must be one of: plain, group, or pivot.
 *
 * @return {boolean}
 * True if this grid table can render that kind of data, false if it can't.
 */

GridTablePlain.prototype.canRender = function (what) {
	switch (what) {
	case 'plain':
		return true;
	case 'group':
	case 'pivot':
		return false;
	}
};

// #drawHeader {{{2

/**
 * Render the header columns of a GridTablePlain.
 *
 * @param {Array.<string>} columns A list of the fields that are to be included as columns within
 * the GridTablePlain.
 *
 * @param {View~Data} data
 *
 * @param {Source~TypeInfo} typeInfo
 */

GridTablePlain.prototype.drawHeader = function (columns, data, typeInfo, opts) {
	var self = this;

	var headingTr, headingSpan, headingTh;

	var headingThCss = {
		'white-space': 'nowrap'
	};

	var filterThCss = {
		'white-space': 'nowrap',
		'padding-top': 4,
		'vertical-align': 'top'
	};

	headingTr = jQuery('<tr>');
	filterTr = jQuery('<tr>', {
		'class': 'wcdv_grid_filterrow'
	});

	self.csv.addRow();

	/*
	 * Create the checkbox that allows the user to select all rows.
	 */

	if (self.features.rowSelect) {
		self.ui.checkAll_thead = jQuery('<input>', { 'name': 'checkAll', 'type': 'checkbox' })
			.on('change', function (evt) {
				self.checkAll(evt);
			});

		headingTh = jQuery('<th>')
			.addClass('wcdv_group_col_spacer')
			.append(self.ui.checkAll_thead)
			.appendTo(headingTr);
		if (self.opts.drawInternalBorders) {
			headingTh.addClass('wcdv_pivot_colval_boundary');
		}

		if (self.features.filter) {
			filterTr.append(jQuery('<th>').css(filterThCss));
		}
	}

	var progress = self.makeProgress('Filter');

	/*
	 * Set up the GridFilterSet instance that manages the (potentially multiple) filters on each
	 * column of the View that belongs to this GridTablePlain.
	 */

	if (self.features.filter) {
		self.defn.gridFilterSet = new GridFilterSet(self.view, null, self, progress);
	}

	/*
	 * Configure every column which comes from the data (i.e. not the "select all" checkbox, and not
	 * the editing "options" column).
	 */

	_.each(columns, function (field, colIndex) {
		var fcc = self.colConfig.get(field) || {};

		if (self.features.rowSelect) {
			colIndex += 1; // Add a column for the row selection checkbox.
		}

		var headingText = fcc.displayText || field;

		// headingTh <TH>
		//   headingThContainer <DIV>
		//     headingThSpan <SPAN>
		//     headingThControls <DIV>

		var headingSpan = jQuery('<span>', {
			'class': 'wcdv_heading_title',
			'data-wcdv-field': field,
			'data-wcdv-draggable-origin': 'GRID_TABLE_HEADER',
		})
			.text(headingText)
			._makeDraggableField();

		self.csv.addCol(headingText);

		var headingThControls = jQuery('<div>');

		var headingThContainer = jQuery('<div>')
			.addClass('wcdv_heading_container')
			.append(headingSpan, headingThControls);

		var headingTh = jQuery('<th>', { id: gensym() })
			.css(headingThCss)
			.append(headingThContainer);

		// In the plain grid table output, the only way to sort is vertically by field.

		self._addSortingToHeader(data, 'vertical', {field: field}, headingThControls);

		self._addFilterToHeader(headingThControls, field, headingText);


		if (self.opts.drawInternalBorders) {
			headingTh.addClass('wcdv_pivot_colval_boundary');
		}

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

			var filterThId = gensym();
			var filterTh = jQuery('<th>', { id: filterThId }).addClass('wcdv_grid_filtercol filter_col_' + colIndex).css(filterThCss);
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

					var thead = jQuery(this).closest('thead');
					var tr = thead.children('tr:eq(1)');
					var th = tr.children('th.filter_col_' + colIndex);

					var adjustTableToolHeight = function () {
						if (self.features.floatingHeader) {
							// Update the height of the original, non-floating header to be the same as that of
							// the floating header.  This is needed because otherwise the floating header will
							// cover up the first rows of the table body as we add filters.  TableTool does not
							// keep the heights of the original and clone in sync on its own (using the `update`
							// function only synchronizes the widths).

							var trHeight = tr.innerHeight();

							debug.info('GRID TABLE - PLAIN // ADD FILTER', 'Adjusting original table header height to ' + trHeight + 'px to match floating header height');
							filterTr.innerHeight(trHeight);
						}
					};

					var onRemove = adjustTableToolHeight;

					self.defn.gridFilterSet.add(field, th, {
						filterType: fcc.filter,
						filterButton: jQuery(this),
						makeRemoveButton: true,
						onRemove: onRemove,
						autoUpdateInputWidth: true,
						sizingElement: filterTh
					});

					adjustTableToolHeight();
				})
				.appendTo(headingTh);
		}

		self.setCss(headingTh, field);
		self.setAlignment(headingTh, fcc, typeInfo.get(field));

		self.ui.thMap[field] = headingTh;
		headingTr.append(headingTh);
	});

	/*
	 * Create a column with buttons that allows the user to reorder the rows.
	 */

	if (self.features.rowReorder) {
		headingTh = jQuery('<th>')
			.text('Options')
			.appendTo(headingTr);
		if (self.opts.drawInternalBorders) {
			headingTh.addClass('wcdv_pivot_colval_boundary');
		}

		if (self.features.filter) {
			headingTh = jQuery('<th>').css(filterThCss).appendTo(filterTr);
			if (self.opts.drawInternalBorders) {
				headingTh.addClass('wcdv_pivot_colval_boundary');
			}
		}
	}

	self.ui.thead.append(headingTr);

	if (self.features.filter) {
		self.ui.thead.append(filterTr);
	}
};

// #drawBody {{{2

GridTablePlain.prototype.drawBody = function (data, typeInfo, columns, cont, opts) {
	var self = this;
	var useLimit = self.features.limit;
	var limitConfig = getPropDef({}, self.defn, 'table', 'limit');

	if (self.features.limit && limitConfig && data.data.length > limitConfig.threshold) {
		debug.info('GRID TABLE - PLAIN // DRAW', 'Limiting output to first ' + limitConfig.threshold + ' rows');
	}

	if (self.opts.generateCsv) {
		self.addDataToCsv(data);
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

		debug.info('GRID TABLE - PLAIN // DRAW', 'Rendering rows '
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

			if (!self.features.incremental
					&& useLimit
					&& limitConfig.method === 'more'
					&& ((startIndex === 0 && rowNum === limitConfig.threshold - 1) // [1]
							|| (startIndex > 0 && rowNum === startIndex + limitConfig.chunkSize - 1))) { // [2]

				// Condition [1]: We've reached the initial threshold for showing the more button.
				// Condition [2]: We're showing additional rows because they clicked the more button.

				atLimit = true;

				self.fire('limited');

				tr = jQuery('<tr>').addClass('wcdvgrid_more');

				var colSpan = columns.length
					+ (self.features.rowSelect ? 1 : 0)
					+ (self.features.rowReorder ? 1 : 0);

				var showMore = function () {
					tr.remove(); // Eliminate the "more" row.
					render(rowNum, limitConfig.chunkSize, nextChunk);
				};

				var td = jQuery('<td>', {
					colspan: colSpan
				})
					.on('click', showMore)
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

				self.moreVisibleHandler = onVisibilityChange(self.scrollEventElement, td, function(isVisible) {
					if (isVisible && getProp(self.defn, 'table', 'limit', 'autoShowMore')) {
						debug.info('GRID TABLE - PLAIN // MORE', '"Show More Rows" button scrolled into view');
						showMore();
					}
				});

				tr.append(td);
			}
			else {
				tr = jQuery('<tr>', {id: self.defn.table.id + '_' + rowNum, 'data-row-num': row.rowNum});

				// Create the check box which selects the row.

				if (self.features.rowSelect) {
					var checkbox = jQuery('<input>', {
						'type': 'checkbox',
						'data-row-num': row.rowNum,
					});
					td = jQuery('<td>').addClass('wcdv_group_col_spacer').append(checkbox).appendTo(tr);
					if (self.opts.drawInternalBorders) {
						td.addClass('wcdv_pivot_colval_boundary');
					}
				}

				// Create the data cells.

				_.each(columns, function (field, colIndex) {
					var fcc = self.colConfig.get(field) || {};
					var cell = row.rowData[field];

					var td = jQuery('<td>');
					var value = format(fcc, typeInfo.get(field), cell);

					if (value instanceof Element || value instanceof jQuery) {
						td.append(value);
					}
					else if (fcc.allowHtml && typeInfo.get(field).type === 'string') {
						td.html(value);
					}
					else if (value === '') {
						td.html('&nbsp;');
					}
					else {
						td.text(value);
					}

					self.setCss(td, field);
					self.setAlignment(td, fcc, typeInfo.get(field));

					if (self.opts.drawInternalBorders) {
						td.addClass('wcdv_pivot_colval_boundary');
					}

					tr.append(td);
				});

				// Create button used as the "handle" for dragging/dropping rows.

				if (self.features.rowReorder) {
					tr.append(jQuery('<td>').append(self.makeRowReorderBtn()));
				}
			}

			self.ui.tr[rowNum] = tr;
			self.ui.tbody.append(tr);
		}

		if (!atLimit) {
			self.fire('unlimited');
		}

		self._updateSelectionGui();

		if (self.features.floatingHeader) {
			switch (getProp(self.defn, 'table', 'floatingHeader', 'method')) {
			case 'tabletool':
				TableTool.update();
				break;
			}
		}

		if (rowNum === data.data.length) {
			// All rows have been produced, so we're done!

			delete self.moreVisibleHandler;

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

		if (typeof cont === 'function') {
			return cont();
		}

		// Nothing to do next, but we're done here.

		return;
	};

	if (self.features.incremental) {
		var incrementalConfig = self.defn.table.incremental;
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
			throw new GridTablePlainError('Invalid value for `table.incremental.method` (' + incrementalConfig.method + ') - must be either "setTimeout" or "requestAnimationFrame"');
		}
	}
	else {
		render();
	}

	//self.ui.tbl.css({'table-layout': 'fixed'}); // XXX - Does nothing?!
};

// #drawFooter {{{2

GridTablePlain.prototype.drawFooter = function (columns, data, typeInfo) {
	var self = this;
	var tr = jQuery('<tr>');

	if (self.features.rowSelect) {
		self.ui.checkAll_tfoot = jQuery('<input>', { 'name': 'checkAll', 'type': 'checkbox' })
			.on('change', function (evt) {
				self.checkAll(evt);
			});
		tr.append(jQuery('<td>').append(self.ui.checkAll_tfoot));
	}

	if (self.opts.footer != null && self.opts.stealGridFooter) {
		jQuery('<td>', {'colspan': columns.length}).appendTo(tr).get(0).appendChild(self.opts.footer.get(0));
	}
	else {
		var didFooterCell = false;

		tr.append(_.map(columns, function (field, colIndex) {
			var fcc = self.colConfig.get(field) || {};
			var colTypeInfo = typeInfo.get(field);
			var td = jQuery('<td>');
			var footerConfig = getProp(self.defn, 'table', 'footer', field);
			var agg;
			var aggFun;
			var aggResult;
			var footerVal;

			self.setCss(td, field);
			self.setAlignment(td, fcc, typeInfo.get(field));

			if (footerConfig == null) {
				if (didFooterCell) {
					td.addClass('wcdv_divider');
				}

				didFooterCell = false;
			}
			else {
				if (colIndex > 0) {
					td.addClass('wcdv_divider');
				}

				didFooterCell = true;

				// Although the footer config is an aggregate spec, there is one place we allow more
				// flexibility.  If the fields aren't set, use the field for the column in which we're
				// displaying this footer.  This is merely a convenience for the most common case.

				if (footerConfig.fields == null) {
					footerConfig.fields = [field];
				}

				debug.info('GRID TABLE - PLAIN // FOOTER - ' + field, 'Creating footer using config: %O', footerConfig);

				var aggInfo = new AggregateInfo('all', footerConfig, 0, self.colConfig, typeInfo, function (tag, fti) {
					if (fti.needsDecoding) {
						debug.info('GRID TABLE - PLAIN // FOOTER - ' + field + ' // ' + tag, 'Converting data: { field = "%s", type = "%s" }',
							fti.field, fti.type);

						self.view.source.convertAll(data.dataByRowId, fti.field);
					}

					fti.deferDecoding = false;
					fti.needsDecoding = false;
				});
				var aggResult = aggInfo.instance.calculate(data.data);
				var aggResult_formatted;

				if (aggInfo.instance.inheritFormatting) {
					aggResult_formatted = format(aggInfo.colConfig[0], aggInfo.typeInfo[0], aggResult, {
						overrideType: aggInfo.instance.getType(),
						debug: true
					});
				}
				else {
					aggResult_formatted = format(null, null, aggResult, {
						overrideType: aggInfo.instance.getType(),
						debug: true
					});
				}

				if (aggInfo.debug) {
					debug.info('GRID TABLE - PLAIN // FOOTER - ' + field, 'Aggregate result: %s',
						JSON.stringify(aggResult));
				}

				switch (typeof footerConfig.format) {
				case 'function':
					footerVal = footerConfig.format(aggResult_formatted);
					break;
				case 'string':
					footerVal = sprintf(footerConfig.format, aggResult_formatted);
					break;
				default:
					throw new Error('Footer config for field "' + field + '": `format` must be a function or a string');
				}

				if (footerVal instanceof Element || footerVal instanceof jQuery) {
					td.append(footerVal);
				}
				else {
					td.text(footerVal);
				}
			}

			return td;
		}));
	}

	if (self.features.rowReorder) {
		tr.append(jQuery('<td>').text('Options'));
	}

	self.ui.tfoot.append(tr);
};

// #makeRowReorderBtn {{{2

GridTablePlain.prototype.makeRowReorderBtn = function () {
	var self = this;

	return jQuery('<button type="button" class="drag-handle fa">')
		.html(fontAwesome('f07d',null,'Drag or press up/down arrows to move'));
};

// #updateFeatures {{{2

/**
 * Change the features of this grid table, then redraw the grid table.
 *
 * @param {Object} f
 * The new features to apply.  Any features not indicated will maintain their current settings.
 *
 * @method
 */

GridTablePlain.prototype.updateFeatures = function (f) {
	var self = this;

	_.each(f, function (v, k) {
		self.features[k] = v;
	});

	self.draw(self.root);
};

// #addWorkHandler {{{2

GridTablePlain.prototype.addWorkHandler = function () {
	var self = this;

	self.view.on(View.events.workEnd, function (info, ops) {
		debug.info('GRID TABLE - PLAIN // HANDLER (View.workEnd)', 'View has finished doing work');

		if (ops.group || ops.pivot) {
			debug.info('GRID TABLE - PLAIN // HANDLER (View.workEnd)', 'Unable to render this data: %O', ops);
			self.fire('unableToRender', null, ops);
			return;
		}

		debug.info('GRID TABLE - PLAIN // HANDLER (View.workEnd)', 'Redrawing because the view has done work');
		self.draw(self.root);
	}, { who: self });
};

//GridTablePlain.prototype.addWorkHandler = function () {
//	var self = this;
//
//	// Sets up callbacks responsible for correctly redrawing the grid when the view has done work
//	// (e.g. sorting or filtering) that will change what is displayed.  This is only needed when
//	// limiting output because otherwise, sort and filter callbacks don't need to redraw the whole
//	// grid, and they are taken care of by the 'sort' and 'filter' events on a row-by-row basis.
//
//	self.view.on(View.events.workEnd, function (info, ops) {
//		debug.info('GRID TABLE // HANDLER (View.workEnd)', 'View has finished doing work');
//
//		if (ops.group || ops.pivot) {
//
//			// If the data is grouped or pivotted, we can't render it.  Emit the "unable to render" event
//			// so that our Grid instance can replace us with a GridTableGroup or GridTablePivot instance
//			// which can render the data.
//
//			self.fire(GridTable.events.unableToRender);
//			return;
//		}
//
//		if (self.needsRedraw) {
//			debug.info('GRID TABLE // HANDLER (View.workEnd)', 'Redrawing because the view has done work');
//
//			self.needsRedraw = false;
//
//			return self.view.getData(function (data) {
//				return self.view.getTypeInfo(function (typeInfo) {
//					self.timing.start(['Grid Table', 'Redraw triggered by view']);
//
//					// Determine what columns will be in the table.  This comes from the user, or from the
//					// data itself.  We may then add columns for extra features (like row selection or
//					// reordering).
//
//					var columns = determineColumns(self.defn, data, typeInfo);
//
//					// Draw the body.
//
//					self.drawBody(data, typeInfo, columns, function () {
//						self.timing.stop(['Grid Table', 'Redraw triggered by view']);
//
//						// Potentially the columns resized as a result of sorting, filtering, or adding new data.
//						self.fire(GridTable.events.columnResize);
//					});
//				});
//			});
//		}
//		else {
//			// Potentially the columns resized as a result of sorting, filtering, or adding new data.
//			self.fire(GridTable.events.columnResize);
//		}
//	}, { who: self });
//};

// #addDataToCsv {{{2

/**
 * Add all data to the CSV file.  Because plain tables frequently don't show all the data, it's not
 * enough to perform the CSV generation inside the `render()` method like we do with other GridTable
 * implementations.
 *
 * @param {object} data
 */

GridTablePlain.prototype.addDataToCsv = function (data) {
	var self = this;
	var columns = determineColumns(self.colConfig, data, self.typeInfo);

	debug.info('GRID TABLE - PLAIN // GENERATE CSV', 'Started generating CSV file');
	self.fire('generateCsvProgress', null, 0);

	self.csv.clear();

	self.csv.addRow();
	_.each(columns, function (field, colIndex) {
		var fcc = self.colConfig.get(field) || {};
		self.csv.addCol(fcc.displayText || field);
	});

	howMany = data.data.length / 10;

	var f = function (startIndex) {
		var endIndex = Math.min(data.data.length, startIndex + howMany);
		for (var i = startIndex; i < endIndex; i += 1) {
			var row = data.data[i];

			self.csv.addRow();
			_.each(columns, function (field, colIndex) {
				var fcc = self.colConfig.get(field) || {};
				var cell = row.rowData[field];
				var value = format(fcc, self.typeInfo.get(field), cell);

				if (value instanceof Element) {
					self.csv.addCol(jQuery(value).text());
				}
				else if (value instanceof jQuery) {
					self.csv.addCol(value.text());
				}
				else if (fcc.allowHtml && self.typeInfo.get(field).type === 'string' && value.charAt(0) === '<') {
					self.csv.addCol(jQuery(value).text());
				}
				else {
					self.csv.addCol(value);
				}
			});
		}

		if (i === data.data.length) {
			debug.info('GRID TABLE - PLAIN // GENERATE CSV', 'Finished generating CSV file');
			self.fire('generateCsvProgress', null, 100);
			self.fire('csvReady');
		}
		else {
			self.fire('generateCsvProgress', null, Math.floor((i / data.data.length) * 100));
			setTimeout(function () {
				return f(i);
			}, 100);
		}
	};

	return f(0);
};

// #_updateSelectionGui {{{2

/**
 * Update the checkboxes in the grid table to match what the current selection is.
 */

GridTablePlain.prototype._updateSelectionGui = function () {
	var self = this;

	// True if there are no rows to select.
	var isDisabled = self.data.data.length === 0;

	// True if all rows are selected.
	var isAllChecked = !isDisabled && self.selection.length === self.data.data.length;

	// True if some rows are selected, but not all of them.
	var isIndeterminate = !isDisabled && !isAllChecked && self.selection.length > 0;

	var updateCheckboxState = function (elt) {
		elt.prop('disabled', isDisabled);
		elt.prop('checked', isAllChecked);
		elt.prop('indeterminate', isIndeterminate);
	};

	// First, deselect all rows (remove "selected" class and uncheck the box).

	self.root.find('tbody td.wcdv_selected_row').removeClass('wcdv_selected_row');
	self.root.find('tbody td:first-child input[type="checkbox"]').prop('checked', false);

	// Next, find all the TR elements which correspond to selected rows.

	var trs = self.root.find('tbody tr').filter(function (_idx, elt) {
		return self.selection.indexOf(+(jQuery(elt).attr('data-row-num'))) >= 0;
	});

	// Set the "check all" input in the header.

	if (self.ui.checkAll_thead) {
		updateCheckboxState(self.ui.checkAll_thead);
		updateCheckboxState(self.ui.checkAll_thead.parents('div.tabletool').find('input[name="checkAll"]'));
	}

	// Set the "check all" input in the footer.

	if (self.ui.checkAll_tfoot) {
		updateCheckboxState(self.ui.checkAll_tfoot);
		updateCheckboxState(self.ui.checkAll_tfoot.parents('div.tabletool').find('input[name="checkAll"]'));
	}

	// Finally, select appropriate rows (add "selected" class and check the box).

	trs.children('td').addClass('wcdv_selected_row');
	trs.find('td:first-child input[type="checkbox"]').prop('checked', true);
};

// #checkAll {{{2

/**
 * Event handler for using the "check all" checkbox.
 *
 * @param {Event} evt
 * The event generated by the browser when the checkbox is changed.
 */

GridTablePlain.prototype.checkAll = function (evt) {
	var self = this;

	// Synchronize with floating header clone.
	jQuery(evt.target).parents('div.tabletool').find('input[name="checkAll"]').prop('checked', evt.target.checked);

	// Either select or unselect all rows.
	if (evt.target.checked) {
		self.select();
	}
	else {
		self.unselect();
	}
}

// #_addRowReorderHandler {{{2

GridTablePlain.prototype._addRowReorderHandler = function () {
	var self = this;

	configureRowReordering(self.ui.tbody, _.bind(self.view.source.swapRows, self.view.source));
};

// #_addRowSelectHandler {{{2

/**
 * Add an event handler for the row select checkboxes.  The event is bound on `self.ui.tbody` and
 * looks for checkbox inputs inside TD elements with class `wcdv_group_col_spacer` to actually handle
 * the events.  The handler calls `self.select(ROW_NUM)` or `self.unselect(ROW_NUM)` when the
 * checkbox is changed.
 */

GridTablePlain.prototype._addRowSelectHandler = function () {
	var self = this;

	self.ui.tbody.on('change', '.wcdv_group_col_spacer > input[type="checkbox"]', function () {
		if (this.checked) {
			self.select(+(jQuery(this).attr('data-row-num')));
		}
		else {
			self.unselect(+(jQuery(this).attr('data-row-num')));
		}
	});
};

// GridTableGroupDetail {{{1
// Constructor {{{2

/**
 * @class
 * @extends GridTable
 */

var GridTableGroupDetail = makeSubclass(GridTable, function (grid, defn, view, features, opts, timing, id) {
	var self = this;

	self.super.ctor.apply(self, arguments);

	self.features.footer = false;

	debug.info('GRID TABLE - GROUP - DETAIL', 'Constructing grid table; features = %O', features);
});

// #canRender {{{2

/**
 * Responds whether or not this grid table can render the type of data requested.
 *
 * @param {string} what
 * The kind of data the caller wants us to show.  Must be one of: plain, group, or pivot.
 *
 * @return {boolean}
 * True if this grid table can render that kind of data, false if it can't.
 */

GridTableGroupDetail.prototype.canRender = function (what) {
	switch (what) {
	case 'group':
		return true;
	case 'plain':
	case 'pivot':
		return false;
	}
};

// #drawHeader {{{2

GridTableGroupDetail.prototype.drawHeader = function (columns, data, typeInfo, opts) {
	var self = this,
		headingTr,
		headingSpan,
		headingTh,
		headingThContainer,
		headingThControls,
		headingThCss = {
			'white-space': 'nowrap'
		},
		filterThCss = {
			'white-space': 'nowrap',
			'padding-top': 4,
			'vertical-align': 'top'
		};

	_.each(data.groupFields, function (field, fieldIdx) {
		var fcc = self.colConfig.get(field) || {};

		headingTr = jQuery('<tr>');

		if (self.features.rowSelect) {
			if (fieldIdx === 0) {
				self.ui.checkAll_thead = jQuery('<input>', {
					'name': 'checkAll',
					'type': 'checkbox',
					'class': 'wcdv_select_group',
					'data-group-id': '0'
				})
					.on('change', function (evt) {
						self.checkAll(evt);
					});

				headingTh = jQuery('<th>')
					.addClass('wcdv_group_col_spacer')
					.append(self.ui.checkAll_thead)
					.appendTo(headingTr);
			}
			else {
				jQuery('<th>')
					.addClass('wcdv_group_col_spacer')
					.appendTo(headingTr);
			}
		}

		// Add spacers for the previous group fields.

		for (var i = 0; i < fieldIdx + 1; i += 1) {
			jQuery('<th>')
				.addClass('wcdv_group_col_spacer')
				.appendTo(headingTr)
			;
		}

		// headingTh <TH>
		//   headingThContainer <DIV>
		//     headingSpan <SPAN>
		//     headingThControls <DIV>

		headingSpan = jQuery('<span>')
			.attr({
				'data-wcdv-field': field,
				'data-wcdv-draggable-origin': 'GRID_TABLE_HEADER'
			})
			.addClass('wcdv_heading_title')
			.text(fcc.displayText || field)
			._makeDraggableField()
		;

		headingThControls = jQuery('<div>');

		headingThContainer = jQuery('<div>')
			.addClass('wcdv_heading_container')
			.append(headingSpan, headingThControls);

		headingTh = jQuery('<th>')
			.attr('colspan', columns.length - fieldIdx)
			.css(headingThCss)
			.append(headingThContainer)
		;

		self._addSortingToHeader(data, 'vertical', {groupFieldIndex: fieldIdx}, headingThControls);

		self.setCss(headingTh, field);

		self.ui.thMap[field] = headingTh;

		headingTr.append(headingTh);
		self.ui.thead.append(headingTr);
	});

	headingTr = jQuery('<tr>');

	// Add spacers for all the group fields.

	if (self.features.rowSelect) {
		jQuery('<th>')
			.addClass('wcdv_group_col_spacer')
			.appendTo(headingTr);
	}

	for (var i = 0; i < data.groupFields.length + 1; i += 1) {
		jQuery('<th>')
			.addClass('wcdv_group_col_spacer')
			.appendTo(headingTr)
		;
	}

	// Make headers for all the normal (non-grouped) columns.

	_.each(columns, function (field, colIndex) {
		var fcc = self.colConfig.get(field) || {};

		if (data.groupFields.indexOf(field) >= 0) {
			return;
		}

		headingSpan = jQuery('<span>')
			.attr({
				'data-wcdv-field': field,
				'data-wcdv-draggable-origin': 'GRID_TABLE_HEADER'
			})
			.addClass('wcdv_heading_title')
			.text(fcc.displayText || field)
			._makeDraggableField()
		;

		headingThControls = jQuery('<div>');

		headingThContainer = jQuery('<div>')
			.addClass('wcdv_heading_container')
			.append(headingSpan, headingThControls);

		headingTh = jQuery('<th>')
			.css(headingThCss)
			.append(headingThContainer);

		if (colIndex > 0) {
			headingTh.addClass('wcdv_pivot_colval_boundary');
		}

		self._addSortingToHeader(data, 'vertical', {field: field}, headingThControls);

		self.setCss(headingTh, field);
		self.setAlignment(headingTh, fcc, typeInfo.get(field));

		self.ui.thMap[field] = headingTh;
		headingTr.append(headingTh);
	});

	self.ui.thead.append(headingTr);
};

// #drawBody {{{2

GridTableGroupDetail.prototype.drawBody = function (data, typeInfo, columns, cont, opts) {
	var self = this;

	// TYPES OF CHECKBOXES:
	//
	//   .wcdv_select_row
	//     * data-row-num = What the rowNum for this data row is.
	//     * [tr] data-wcdv-rowValIndex = What rowVal this row is in.
	//
	//   .wcdv_select_group

	if (!data.isGroup) {
		if (typeof cont === 'function') {
			return cont();
		}
		else {
			return;
		}
	}

	if (self.opts.generateCsv) {
		self.addDataToCsv(data);
	}

	// percolateUp() {{{3

	function percolateUp(node /* groupInfo elt */) {
		var disabled = false;
		var checked = false;
		var indeterminate = false;

		// When a node has no children ...
		//
		//   - it contains data rows in the UI
		//   - its height in the metadata tree is the # of group fields
		//   - it represents a complete rowval
		//
		// ... the number of selected rows is meant to be determined by the caller.

		if (node.metadata.children != null) {
			node.numSelected = 0;
			_.each(node.metadata.children, function (child) {
				node.numSelected += self.groupInfo[child.id].numSelected;
			});
		}

		if (node.metadata.numRows === 0) {
			disabled = true;
			checked = false;
		}
		else {
			if (node.numSelected === 0) {
				checked = false;
			}
			else if (node.numSelected === node.metadata.numRows) {
				checked = true;
			}
			else {
				indeterminate = true;
			}
		}

		node.checkbox.prop('disabled', disabled);
		node.checkbox.prop('checked', checked);
		node.checkbox.prop('indeterminate', indeterminate);

		if (node.metadata.parent) {
			percolateUp(self.groupInfo[node.metadata.parent.id]);
		}
	}

	// percolateDown() {{{3

	function percolateDown(node /* groupInfo elt */, isChecked) {
		node.checkbox.prop('disabled', false);
		node.checkbox.prop('checked', isChecked);
		node.checkbox.prop('indeterminate', false);

		node.numSelected = isChecked ? node.metadata.numRows : 0;

		if (node.metadata.children == null) {
			self.ui.tbody
				.find('tr[data-wcdv-in-group=' + node.metadata.id + ']')
				.find('input[type="checkbox"].wcdv_select_row')
				.prop('checked', isChecked);
			_.each(data.data[node.metadata.rowValIndex], function (row) {
				if (isChecked) {
					self.select(row.rowNum);
				}
				else {
					self.unselect(row.rowNum);
				}
			});
		}
		else {
			_.each(node.metadata.children, function (child) {
				percolateDown(self.groupInfo[child.id], isChecked);
			});
		}
	}

	// }}}3

	/*
	self.ui.tbody.on('change', 'input[type="checkbox"].wcdv_select_row', function () {
		var elt = jQuery(this);
		var tr = elt.closest('tr');
		var isChecked = elt.prop('checked');
		var rowNum = +tr.attr('data-row-num');
		var rowValIndex = +tr.attr('data-wcdv-rowValIndex');
		var rowValMetadata = data.groupMetadata.lookup.byRowValIndex[rowValIndex];

		debug.info('GRID TABLE // GROUP - DETAIL // SELECT',
			'Selecting data row: rowNum = %d, rowValIndex = %d, parentGroupId = %s, parentGroupInfo = %O',
			rowNum, rowValIndex, rowValMetadata.id, self.groupInfo[rowValMetadata.id]);

		self.groupInfo[rowValMetadata.id].numSelected += isChecked ? 1 : -1;

		percolateUp(self.groupInfo[rowValMetadata.id]);
	});

	self.ui.tbody.on('change', 'input[type="checkbox"].wcdv_select_group', function () {
		var elt = jQuery(this);
		var tr = elt.closest('tr');
		var isChecked = elt.prop('checked');
		var groupMetadataId = +tr.attr('data-wcdv-toggles-group');

		percolateDown(self.groupInfo[groupMetadataId], isChecked);
		percolateUp(self.groupInfo[groupMetadataId]);
	});
	*/

	var isRendered = {}; // isRendered[metadataId] => boolean
	var lastRenderedTr = {}; // lastRenderedTr[metadataId] => jQuery <TR>

	// groupInfo {{{3

	// groupInfo[id] -> {
	//   metadata
	//   numSelected
	//   checkbox
	// }

	self.groupInfo = (function () {
		var mapping = {};

		function recur(node) {
			mapping[node.id] = info = {
				metadata: node,
				numSelected: 0
			};
			if (node.children != null) {
				_.each(node.children, recur);
			}
		}

		recur(data.groupMetadata);
		mapping[0].checkbox = self.ui.checkAll_thead;
		return mapping;
	})();

	// toggleGroup() {{{3

	/*
	 * Toggle a sub-group open/closed.  This is meant to be used as a jQuery event handler, e.g. for a
	 * click event.
	 */

	function toggleGroup() {

		/*
		 * Toggle the visibility of the subgroup.
		 *
		 *   - metadataId: number
		 *     What group we are expanding/collapsing.
		 *
		 *   - show: boolean
		 *     If true, show the rows in the group; otherwise hide them.
		 *
		 *   - tr: jQuery (TR)
		 *     The table row for the subgroup header.
		 */

		function toggle(metadataId, show, tr) {
			// Within the group metadata, the rowValIndex is only defined for things which are leaves in
			// the grouping tree and therefore complete a rowVal.

			var rowValIndex = self.data.groupMetadata.lookup.byId[metadataId].rowValIndex;

			debug.info('GRID TABLE // GROUP (DETAIL) // TOGGLE', 'show = %s, id = %s, rowValIndex = %s', show, metadataId, rowValIndex);

			// Check if we're expanding a leaf, thus fully expanding an entire group, and see if we need
			// to render table rows for all the records in that group.

			if (show && !isRendered[metadataId]) {
				debug.info('GRID TABLE // GROUP (DETAIL) // TOGGLE', 'Rendering: group metadata ID = %s', metadataId);
				render(metadataId, 0, tr);
			}

			// Set the visibility for all affected table rows.  These can be for children of the current
			// node in the tree (i.e. when expanding the current node does not complete a group), or for
			// records in a fully expanded group: we don't distinguish between these two when it comes to
			// showing/hiding as the attributes used on the elements are the same.

			self.ui.tbody
				.find('tr')
				.filter(function (i, elt) {
					return jQuery(elt).attr('data-wcdv-in-group') === '' + metadataId;
				})
				.each(function (i, elt) {
					elt = jQuery(elt);
					if (elt.attr('data-wcdv-toggles-group')) {
						toggle(+elt.attr('data-wcdv-toggles-group'), show && elt.attr('data-wcdv-expanded') === '1', elt);
					}
					if (show) {
						elt.show();
					}
					else {
						elt.hide();
					}
				})
			;

			if (self.ui.tbl.floatThead) {
				self.ui.tbl.floatThead('reflow');
			}
		}

		var elt = jQuery(this);
		var tr = elt.closest('tr');
		var op = tr.attr('data-wcdv-expanded') === '0' ? 'show' : 'hide';

		if (op === 'show') {
			tr.find('.spinner').show();
		}
		window.setTimeout(function () {
			toggle(+tr.attr('data-wcdv-toggles-group'), op === 'show', tr);
			if (op === 'show') {
				tr.find('.spinner').hide();
			}
			tr.attr('data-wcdv-expanded', op === 'show' ? '1' : '0');
			elt.attr('data-wcdv-expanded', op === 'show' ? '1' : '0');
			elt.html(fontAwesome(op === 'show' ? 'fa-minus-square-o' : 'fa-plus-square-o'));
		});
	}

	// render() {{{3

	/**
	 * @param {number} [metadataId=0]
	 * @param {number} [startIndex=0]
	 * @param {jQuery} [afterElement]
	 */

	function render(metadataId, startIndex, afterElement, showAll) {
		if (metadataId != null && typeof metadataId !== 'number')
			throw new Error('Call Error: `metadataId` must be null or a number');
		if (startIndex != null && typeof startIndex !== 'number')
			throw new Error('Call Error: `startIndex` must be null or a number');
		if (afterElement != null && !(afterElement instanceof jQuery))
			throw new Error('Call Error: `afterElement` must be null or an instance of jQuery');

		if (metadataId == null) metadataId = 0;
		if (startIndex == null) startIndex = 0;

		if (startIndex > 0 && afterElement == null)
			throw new Error('Call Error: `afterElement` required when `startIndex` > 0');

		var metadataNode = data.groupMetadata.lookup.byId[metadataId];

		if (metadataNode == null)
			throw new Error('No group metadata for specified ID: ' + metadataId);

		var limitConfig = self.defn.table.limit;

		var showMoreTr;

		if (afterElement != null && startIndex > 0) {
			showMoreTr = afterElement.nextAll('tr.wcdvgrid_more[data-wcdv-in-group="' + metadataId + '"]');
			afterElement = showMoreTr.prev();
			showMoreTr.remove();
		}

		if (metadataNode.children) {
			// We're rendering sub-groups.

			var i, j;
			var childMetadataNode;
			var childTr;
			var checkbox;
			var expandBtn;
			var infoText, infoTextSpan;
			var fcc;
			var rowValElt, rowValEltSpan, rowValEltTh;
			var showMoreTd;
			var colSpan;

			var trans = {
				'group:singular': 'group',
				'group:plural': 'groups',
				'row:singular': 'row',
				'row:plural': 'rows'
			};

			var childRowValElts = mergeSort2(_.pluck(metadataNode.children, 'rowValElt'));
			var childRowValEltsLen = childRowValElts.length;

			var howMany = !self.features.limit || showAll ? childRowValEltsLen
				: startIndex === 0 ? limitConfig.threshold
				: limitConfig.chunkSize;

			for (i = startIndex; i < childRowValEltsLen && i < startIndex + howMany; i += 1) {
				childMetadataNode = metadataNode.children[childRowValElts[i]];

				childTr = jQuery('<tr>')
					.attr('data-wcdv-in-group', metadataNode.id)
					.attr('data-wcdv-toggles-group', childMetadataNode.id)
					.attr('data-wcdv-expanded', '0')
				;

				// Insert spacer columns for previous group fields.

				for (j = 0; j < childMetadataNode.groupFieldIndex; j += 1) {
					jQuery('<th>', {'class': 'wcdv_group_col_spacer'})
						.appendTo(childTr);
				}

				var disabled = childMetadataNode.children == null && childMetadataNode.rows.length === 0;

				expandBtn = jQuery('<button>', {
					'type': 'button',
					'class': 'wcdv_icon_button wcdv_expand_button',
					'data-wcdv-expanded': '0',
					'disabled': disabled
				})
					.html(fontAwesome(disabled ? 'fa-square-o' : 'fa-plus-square-o'));

				jQuery('<th>', {'class': 'wcdv_group_col_spacer'})
					.append(expandBtn)
					.appendTo(childTr);

				// Create the check box which selects the row.

				if (self.features.rowSelect) {
					checkbox = jQuery('<input>', {
						'type': 'checkbox',
						'class': 'wcdv_select_group',
						'data-group-id': childMetadataNode.id,
					});
					self.groupInfo[childMetadataNode.id].checkbox = checkbox;
					jQuery('<th>', {'class': 'wcdv_group_col_spacer'})
						.append(checkbox)
						.appendTo(childTr);
				}

				fcc = self.colConfig.get(childMetadataNode.groupField) || {};

				rowValElt = format(fcc, self.typeInfo.get(childMetadataNode.groupField), childMetadataNode.rowValCell || childMetadataNode.rowValElt);
				rowValEltSpan = jQuery('<span>');

				if (rowValElt instanceof Element || rowValElt instanceof jQuery) {
					rowValEltSpan.append(rowValElt);
				}
				else if (fcc.allowHtml) {
					rowValEltSpan.html(rowValElt);
				}
				else {
					rowValEltSpan.text(rowValElt);
				}

				infoText = '(';
				if (childMetadataNode.children != null) {
					infoText += childMetadataNode.numChildren + ' ';
					infoText += (childMetadataNode.numChildren === 1 ? trans['group:singular'] : trans['group:plural']) + ', ';
				}
				infoText += childMetadataNode.numRows + ' ';
				infoText += childMetadataNode.numRows === 1 ? trans['row:singular'] : trans['row:plural'];
				infoText += ')';

				infoTextSpan = jQuery('<span>').css({'margin-left': '0.5em'}).text(infoText);

				spinnerDiv = jQuery('<div>', {'class': 'spinner'})
					.append(jQuery('<div>', {'class': 'bounce1'}))
					.append(jQuery('<div>', {'class': 'bounce2'}))
					.append(jQuery('<div>', {'class': 'bounce3'}))
					.hide();

				jQuery('<th>', {
					'class': 'wcdv_group_value',
					'data-wcdv-field': childMetadataNode.groupField,
					'colspan': columns.length - childMetadataNode.groupFieldIndex
				})
					.append(rowValEltSpan)
					.append(infoTextSpan)
					.append(spinnerDiv)
					.appendTo(childTr);

				if (afterElement != null) {
					afterElement.after(childTr);
				}
				else {
					self.ui.tbody.append(childTr);
				}

				afterElement = childTr;

				var rowRenderCb = getProp(self.opts, 'events', 'rowRender');
				if (typeof rowRenderCb === 'function') {
					rowRenderCb(childTr, {
						isGroup: true,
						groupMode: 'detail',
						groupField: childMetadataNode.groupField,
						rowValElt: childMetadataNode.rowValCell.value,
						groupMetadata: childMetadataNode
					});
				}
			}

			isRendered[metadataNode.id] = true;

			if (i < childRowValEltsLen - 1) {
				// Not all children were rendered.

				lastRenderedTr[metadataNode.id] = childTr;
				for (var p = metadataNode.parent; p != null; p = p.parent) {
					lastRenderedTr[p.id] = childTr;
				}

				showMoreTr = jQuery('<tr>', {'class': 'wcdvgrid_more', 'data-wcdv-in-group': metadataNode.id});

				// Insert spacer columns for previous group fields.

				for (j = 0; j < childMetadataNode.groupFieldIndex; j += 1) {
					jQuery('<th>', {'class': 'wcdv_group_col_spacer'})
						.appendTo(showMoreTr);
				}

				colSpan = columns.length
					+ 1 // for the "expand" button column
					+ (self.features.rowSelect ? 1 : 0)
					+ (self.features.rowReorder ? 1 : 0)
					- (metadataNode.groupFieldIndex || 0);

				spinnerDiv = jQuery('<div>', {'class': 'spinner'})
					.append(jQuery('<div>', {'class': 'bounce1'}))
					.append(jQuery('<div>', {'class': 'bounce2'}))
					.append(jQuery('<div>', {'class': 'bounce3'}))
					.hide();

				showMoreTd = jQuery('<td>', {
					'class': 'wcdv_show_more',
					'data-wcdv-in-group': metadataNode.id,
					'data-wcdv-show-more-start': i,
					'colspan': colSpan
				})
					.append(fontAwesome('F13A'))
					.append(jQuery('<span>Showing rows ' + '1–' + i + ' of ' + childRowValEltsLen + '.</span>')
						.css({'padding-left': '0.5em'}))
					.append(jQuery('<button type="button">Load ' + limitConfig.chunkSize + ' more rows.</button>')
						.css({'margin-left': '0.5em'}))
					.append(jQuery('<button type="button" class="wcdv_show_all">Load all rows.</button>')
						.css({'margin-left': '0.5em'})
					)
					.append(spinnerDiv)
					.appendTo(showMoreTr);

				childTr.after(showMoreTr);
			}
		}
		else if (metadataNode.rows) {
			// We're rendering data rows.

			var isSelected;
			var checkbox;
			var row;
			var rowTr;
			var showMoreTd;
			var colSpan;

			var howMany = (!self.features.limit || showAll) ? metadataNode.rows.length - startIndex
				: startIndex === 0 ? limitConfig.threshold
				: limitConfig.chunkSize;

			for (i = startIndex; i < metadataNode.rows.length && i < startIndex + howMany; i += 1) {
				row = metadataNode.rows[i];

				rowTr = jQuery('<tr>', {
					'id': self.defn.table.id + '_' + i,
					'data-row-num': row.rowNum,
					'data-wcdv-in-group': metadataNode.id,
					'data-wcdv-rowValIndex': metadataNode.rowValIndex
				});

				// Spacer to "indent" the data.

				jQuery('<td>', {'colspan': data.groupFields.length + 1}).appendTo(rowTr);

				// Create the check box which selects the row.

				if (self.features.rowSelect) {
					isSelected = self.isSelected(row.rowNum);
					checkbox = jQuery('<input>', {
						'type': 'checkbox',
						'data-row-num': row.rowNum,
						'class': 'wcdv_select_row',
						'checked': isSelected
					});
					jQuery('<td>', {'class': 'wcdv_group_col_spacer'}).append(checkbox).appendTo(rowTr);
				}

				// Create the data cells.

				_.each(columns, function (field, colIndex) {
					if (data.groupFields.indexOf(field) >= 0) {
						return;
					}

					var fcc = self.colConfig.get(field) || {};
					var cell = row.rowData[field];

					var td = jQuery('<td>', {'data-wcdv-field': field});
					if (colIndex > 0) {
						td.addClass('wcdv_pivot_colval_boundary');
					}
					var value = format(fcc, typeInfo.get(field), cell);

					if (value instanceof Element || value instanceof jQuery) {
						td.append(value);
					}
					else if (fcc.allowHtml && typeInfo.get(field).type === 'string') {
						td.html(value);
					}
					else if (value === '') {
						td.html('&nbsp;');
					}
					else {
						td.text(value);
					}

					self.setCss(td, field);
					self.setAlignment(td, fcc, typeInfo.get(field));

					rowTr.append(td);
				});

				if (self.features.rowSelect && isSelected) {
					rowTr.children('td').addClass('wcdv_selected_row');
				}

				self.ui.tr[i] = rowTr;
				afterElement.after(rowTr);
				afterElement = rowTr;

				var rowRenderCb = getProp(self.opts, 'events', 'rowRender');
				if (typeof rowRenderCb === 'function') {
					rowRenderCb(rowTr, {
						isGroup: true,
						groupMode: 'details',
						rowData: row.rowData,
						rowNum: row.rowNum
					});
				}
			}

			isRendered[metadataNode.id] = true;

			if (i < metadataNode.rows.length - 1) {
				// Not all children were rendered.

				lastRenderedTr[metadataNode.id] = rowTr;
				for (var p = metadataNode.parent; p != null; p = p.parent) {
					lastRenderedTr[p.id] = rowTr;
				}

				showMoreTr = jQuery('<tr>', {'class': 'wcdvgrid_more', 'data-wcdv-in-group': metadataNode.id});

				// Insert spacer columns for previous group fields.

				for (j = 0; j < metadataNode.groupFieldIndex + 1; j += 1) {
					jQuery('<th>', {'class': 'wcdv_group_col_spacer'})
						.appendTo(showMoreTr);
				}

				colSpan = columns.length
					+ 1 // for the "expand" button column
					+ (self.features.rowSelect ? 1 : 0)
					+ (self.features.rowReorder ? 1 : 0)
					- (metadataNode.groupFieldIndex + 1);

				spinnerDiv = jQuery('<div>', {'class': 'spinner'})
					.append(jQuery('<div>', {'class': 'bounce1'}))
					.append(jQuery('<div>', {'class': 'bounce2'}))
					.append(jQuery('<div>', {'class': 'bounce3'}))
					.hide();

				showMoreTd = jQuery('<td>', {
					'class': 'wcdv_show_more',
					'data-wcdv-in-group': metadataNode.id,
					'data-wcdv-show-more-start': i,
					'colspan': colSpan
				})
					.append(fontAwesome('F13A'))
					.append(jQuery('<span>Showing rows ' + '1–' + i + ' of ' + metadataNode.rows.length + '.</span>')
						.css({'padding-left': '0.5em'}))
					.append(jQuery('<button type="button">Load ' + limitConfig.chunkSize + ' more rows.</button>')
						.css({'margin-left': '0.5em'}))
					.append(jQuery('<button type="button" class="wcdv_show_all">Load all rows.</button>')
						.css({'margin-left': '0.5em'})
					)
					.append(spinnerDiv)
					.appendTo(showMoreTr);

				rowTr.after(showMoreTr);
			}
		}

		self._updateSelectionGui();

		if (self.features.floatingHeader) {
			switch (getProp(self.defn, 'table', 'floatingHeader', 'method')) {
			case 'tabletool':
				TableTool.update();
				break;
			}
		}
	}

	// showMore() {{{3

	function showMore(showAll) {
		var elt = jQuery(this).closest('td');
		var metadataId = +(elt.attr('data-wcdv-in-group'));
		var startIndex = +(elt.attr('data-wcdv-show-more-start'));
		var afterElement = lastRenderedTr[metadataId];

		afterElement.nextAll('tr.wcdvgrid_more[data-wcdv-in-group="' + metadataId + '"]').find('.spinner').show();

		window.setTimeout(function () {
			render(metadataId, startIndex, afterElement, showAll);
			// No need to hide the spinner because the "show more" row should be gone.
		});
	}

	// }}}3

	render();
	self.ui.tbody.on('click', 'button.wcdv_expand_button', toggleGroup);
	self.ui.tbody.on('click', 'td.wcdv_show_more button.wcdv_show_all', function (evt) {
		evt.stopPropagation();
		showMore.call(this, true);
	});
	self.ui.tbody.on('click', 'td.wcdv_show_more', function (evt) {
		showMore.call(this, false);
	});

	self._updateSelectionGui();

	if (self.features.floatingHeader) {
		switch (getProp(self.defn, 'table', 'floatingHeader', 'method')) {
		case 'tabletool':
			TableTool.update();
			break;
		}
	}

	if (typeof cont === 'function') {
		return cont();
	}
};

// #addWorkHandler {{{2

GridTableGroupDetail.prototype.addWorkHandler = function () {
	var self = this;

	self.view.on(View.events.workEnd, function (info, ops) {
		debug.info('GRID TABLE - GROUP - DETAIL // HANDLER (View.workEnd)', 'View has finished doing work');

		if (!ops.group || ops.pivot) {
			self.fire('unableToRender', null, ops);
			return;
		}

		debug.info('GRID TABLE - GROUP - DETAIL // HANDLER (View.workEnd)', 'Redrawing because the view has done work');
		self.draw(self.root);
	}, { who: self });
};

// #_addRowSelectHandler {{{2

/**
 * Add an event handler for the row select checkboxes.  The event is bound on `self.ui.tbody` and
 * looks for checkbox inputs inside TD elements with class `wcdv_group_col_spacer` to actually handle
 * the events.  The handler calls `self.select(ROW_NUM)` or `self.unselect(ROW_NUM)` when the
 * checkbox is changed.
 */

GridTableGroupDetail.prototype._addRowSelectHandler = function () {
	var self = this;

	self.ui.tbody.on('change', 'input[type="checkbox"].wcdv_select_row', function () {
		var elt = jQuery(this);
		var rowNum = +elt.attr('data-row-num');
		var isChecked = elt.prop('checked');

		if (isChecked) {
			self.select(rowNum);
		}
		else {
			self.unselect(rowNum);
		}
	});

	self.ui.tbody.on('change', 'input[type="checkbox"].wcdv_select_group', function () {
		var elt = jQuery(this);
		var isChecked = elt.prop('checked');
		var groupMetadataId = +elt.attr('data-group-id');
		var rowNums = [];

		// Find all rows that are a descendant of the selected group.

		function recur(node) {
			if (node.children == null) {
				rowNums = rowNums.concat(_.pluck(self.data.data[node.rowValIndex], 'rowNum'));
			}
			else {
				_.each(node.children, recur);
			}
		};

		recur(self.data.groupMetadata.lookup.byId[groupMetadataId]);

		if (isChecked) {
			self.select(rowNums);
		}
		else {
			self.unselect(rowNums);
		}
	});
};

// #_updateSelectionGui {{{2

/**
 * Update the checkboxes in the grid table to match what the current selection is.
 */

GridTableGroupDetail.prototype._updateSelectionGui = function () {
	var self = this;

	var updateCheckboxState = function (elt) {
		elt.prop('disabled', isDisabled);
		elt.prop('checked', isAllChecked);
		elt.prop('indeterminate', isIndeterminate);
	};

	// First, deselect all rows (remove "selected" class and uncheck the box).

	self.root.find('tbody td.wcdv_selected_row').removeClass('wcdv_selected_row');
	self.root.find('tbody input[type="checkbox"].wcdv_select_row').prop('checked', false);
	self.root.find('tbody input[type="checkbox"].wcdv_select_group').prop('checked', false);

	// Next, find all the TR elements which correspond to selected rows.

	var trs = self.root.find('tbody tr').filter(function (_idx, elt) {
		return self.selection.indexOf(+(jQuery(elt).attr('data-row-num'))) >= 0;
	});

	// Select appropriate rows (add "selected" class and check the box).

	trs.children('td').addClass('wcdv_selected_row');
	trs.find('input[type="checkbox"].wcdv_select_row').prop('checked', true);

	// ===============================================================================================
	//
	//   DETERMINE GROUPING (HIERARCHICAL, PARENT) CHECKBOX STATES
	//
	// ===============================================================================================

	// Initialize the structure with no rows selected in any leaf.

	var numSelected = {};

	_.each(_.keys(self.data.groupMetadata.lookup.byId), function (id) {
		numSelected[id] = 0;
	});

	// Determine how many are selected in each leaf of the tree.

	for (var i = 0; i < self.selection.length; i += 1) {
		var s = self.selection[i];
		var id = getProp(self.data, 'groupMetadata', 'lookup', 'byRowNum', s, 'id');

		if (id == null) {
			// This can happen when the selected row has been filtered out, so there's no group metadata
			// entry for that row number.

			continue;
		}

		if (numSelected[id] == null) {
			numSelected[id] = 0;
		}

		numSelected[id] += 1;
	}

	// Determine how many are selected at all non-leaf nodes.

	(function () {
		function postorder(node) {
			if (node.children != null) {
				numSelected[node.id] = 0;
				_.each(node.children, function (c) {
					postorder(c);
					numSelected[node.id] += numSelected[c.id];
				});
			}
		}

		postorder(self.data.groupMetadata);
	})();

	_.each(numSelected, function (count, id) {
		var numRows = self.data.groupMetadata.lookup.byId[id].numRows;
		var checkbox = self.root.find('input[type="checkbox"][data-group-id="' + id + '"].wcdv_select_group');

		if (checkbox.length === 0) {
			// This can happen when the rows for the sub-groups haven't been rendered yet.

			return;
		}

		if (numRows === 0) {
			checkbox.prop({
				disabled: true,
				indeterminate: false,
				checked: false,
			});
		}
		else if (count === 0) {
			checkbox.prop({
				disabled: false,
				indeterminate: false,
				checked: false,
			});
		}
		else if (numRows === count) {
			checkbox.prop({
				disabled: false,
				indeterminate: false,
				checked: true,
			});
		}
		else {
			checkbox.prop({
				disabled: false,
				indeterminate: true,
				checked: false,
			});
		}
	});
};

// #checkAll {{{2

/**
 * Event handler for using the "check all" checkbox.
 *
 * @param {Event} evt
 * The event generated by the browser when the checkbox is changed.
 */

GridTableGroupDetail.prototype.checkAll = function (evt) {
	var self = this;

	// Synchronize with floating header clone.
	jQuery(evt.target).parents('div.tabletool').find('input[name="checkAll"]').prop('checked', evt.target.checked);

	// Either select or unselect all rows.
	if (evt.target.checked) {
		self.select();
	}
	else {
		self.unselect();
	}
}

// #addDataToCsv {{{2

/**
 * Add all data to the CSV file.  Because plain tables frequently don't show all the data, it's not
 * enough to perform the CSV generation inside the `render()` method like we do with other GridTable
 * implementations.
 *
 * @param {object} data
 */

GridTableGroupDetail.prototype.addDataToCsv = function (data) {
	var self = this;
	var columns = determineColumns(self.colConfig, data, self.typeInfo);

	debug.info('GRID TABLE - GROUP DETAIL // GENERATE CSV', 'Started generating CSV file');
	self.fire('generateCsvProgress', null, 0);

	self.csv.clear();

	self.csv.addRow();

	_.each(data.groupFields, function (fieldName) {
		var fcc = self.colConfig.get(fieldName) || {};
		self.csv.addCol(fcc.displayText || fieldName);
	});
	_.each(_.difference(columns, data.groupFields), function (fieldName) {
		var fcc = self.colConfig.get(fieldName) || {};
		self.csv.addCol(fcc.displayText || fieldName);
	});

	function recur(depth, metadataNode) {
		if (metadataNode.children != null) {
			_.each(_.keys(metadataNode.children).sort(), function (childName) {
				self.csv.addRow();
				for (var j = 0; j < depth; j += 1) {
					self.csv.addCol();
				}
				self.csv.addCol(childName);
				for (var j = depth + 1; j < columns.length; j += 1) {
					self.csv.addCol();
				}
				recur(depth + 1, metadataNode.children[childName]);
			});
		}
		else {
			_.each(metadataNode.rows, function (row) {
				self.csv.addRow();
				for (var j = 0; j < depth; j += 1) {
					self.csv.addCol();
				}
				_.each(_.difference(columns, data.groupFields), function (field, colIndex) {
					var fcc = self.colConfig.get(field) || {};
					var cell = row.rowData[field];
					var value = format(fcc, self.typeInfo.get(field), cell);

					if (value instanceof Element) {
						self.csv.addCol(jQuery(value).text());
					}
					else if (value instanceof jQuery) {
						self.csv.addCol(value.text());
					}
					else if (fcc.allowHtml && self.typeInfo.get(field).type === 'string' && value.charAt(0) === '<') {
						self.csv.addCol(jQuery(value).text());
					}
					else {
						self.csv.addCol(value);
					}
				});
			});
		}
	}

	recur(0, data.groupMetadata);

	debug.info('GRID TABLE - PLAIN // GENERATE CSV', 'Finished generating CSV file');
	self.fire('generateCsvProgress', null, 100);
	self.fire('csvReady');
};

// GridTableGroupSummary {{{1
// Constructor {{{2

/**
 * @class
 * @extends GridTable
 */

var GridTableGroupSummary = makeSubclass(GridTable, function (grid, defn, view, features, opts, timing, id) {
	var self = this;

	self.super.ctor.apply(self, arguments);

	self.features.limit = false;
	self.features.footer = false;

	debug.info('GRID TABLE - GROUP - SUMMARY', 'Constructing grid table; features = %O', features);

	setPropDef(['rowVals', 'groupAggregates'], self.opts, 'displayOrder');
});

// #canRender {{{2

/**
 * Responds whether or not this grid table can render the type of data requested.
 *
 * @param {string} what
 * The kind of data the caller wants us to show.  Must be one of: plain, group, or pivot.
 *
 * @return {boolean}
 * True if this grid table can render that kind of data, false if it can't.
 */

GridTableGroupSummary.prototype.canRender = function (what) {
	switch (what) {
	case 'group':
		return true;
	case 'plain':
	case 'pivot':
		return false;
	}
};

// #drawHeader {{{2

GridTableGroupSummary.prototype.drawHeader = function (columns, data, typeInfo, opts) {
	var self = this,
		tr = jQuery('<tr>'),
		headingSpan,
		headingTh,
		headingThControls,
		headingThContainer;

	self.csv.addRow();

	_.each(self.opts.displayOrder, function (what, displayOrderIndex) {
		if (typeof what === 'string') {
			if (what === 'rowVals') {
				_.each(data.groupFields, function (field, fieldIdx) {
					var fcc = self.colConfig.get(field) || {};
					var headingText = fcc.displayText || field;

					// headingTh <TH>
					//   headingThContainer <DIV>
					//     headingThSpan <SPAN>
					//     headingThControls <DIV>

					headingSpan = jQuery('<span>', {
						'class': 'wcdv_heading_title',
						'data-wcdv-field': field,
						'data-wcdv-draggable-origin': 'GRID_TABLE_HEADER',
					})
						.text(headingText)
						._makeDraggableField();

					headingThControls = jQuery('<div>');

					headingThContainer = jQuery('<div>')
						.addClass('wcdv_heading_container')
						.append(headingSpan, headingThControls);

					headingTh = jQuery('<th>')
						.append(headingThContainer);

					self.csv.addCol(fcc.displayText || field);

					self._addSortingToHeader(data, 'vertical', {groupFieldIndex: fieldIdx}, headingThControls, getProp(data, 'agg', 'info', 'group'));

					self.setCss(headingTh, field);

					self.ui.thMap[field] = headingTh;
					tr.append(headingTh);
				});
			}
			else if (what === 'groupAggregates') {
				self.drawHeader_aggregates(data, tr, displayOrderIndex, self.opts.displayOrder.length);
			}
			else if (what === 'addCols') {
				self.drawHeader_addCols(tr, typeInfo, opts);
			}
		}
	});

	// Add the row for this pivot field to the THEAD.
	self.ui.thead.append(tr);
};

// #drawBody {{{2

GridTableGroupSummary.prototype.drawBody = function (data, typeInfo, columns, cont, opts) {
	var self = this;
	var ai = self._getAggInfo(data);

	_.each(data.data, function (rowGroup, groupNum) {
		var tr = jQuery('<tr>');
		self.csv.addRow();

		_.each(self.opts.displayOrder, function (what, displayOrderIndex) {
			if (typeof what === 'string') {
				if (what === 'rowVals') {
					self.drawBody_rowVals(data, tr, groupNum);
				}
				else if (what === 'groupAggregates') {
					self.drawBody_groupAggregates(data, tr, groupNum, displayOrderIndex, self.opts.displayOrder.length);
				}
				else if (what === 'addCols') {
					// Generate the user's custom-defined additional columns.  If the `value` function returns an
					// Element or jQuery instance, we just put that in the <TD> that we make.  Otherwise (e.g. it
					// returns a string or number) we format it according to the type of the field that the pivot
					// function was operating on.
					//
					// EXAMPLE:
					//
					// Aggregate Function = sum
					// Aggregate Field    = Amount : number -> $0,0.00
					//
					// If the `value` function adds up the sums, yielding a grand total of them all, then we format
					// that using Numeral exactly as specified for the "Amount" field.

					_.each(self.opts.addCols, function (addCol) {
						var addColResult = addCol.value(data.data, groupNum, rowAgg, aggType);

						if (addColResult instanceof Element || addColResult instanceof jQuery) {
							var td = jQuery('<td>').append(addColResult);
						}
						else {
							var addColText;

							if (aggInfo.instance.inheritFormatting) {
								addColText = format(aggInfo.colConfig[0], aggInfo.typeInfo[0], addColResult, {
									alwaysFormat: true
								});
							}
							else {
								addColText = format(null, null, addColResult, {
									alwaysFormat: true
								});
							}
							var td = jQuery('<td>').text(addColText);
						}

						if (getProp(opts, 'pivotConfig', 'aggField')) {
							self.setAlignment(td, self.colConfig.get(opts.pivotConfig.aggField), typeInfo.get(opts.pivotConfig.aggField));
						}

						td.appendTo(tr);
						self.csv.addCol(td.text());
					});
				}
			}
		});

		self.ui.tbody.append(tr);
	});

	var renderTotalRow = function () {
		var tr;

		tr = jQuery('<tr>', {'class': 'wcdv_btd'});
		self.csv.addRow();

		_.each(self.opts.displayOrder, function (what) {
			switch (what) {
			case 'rowVals':
				self.csv.addCol('Total');

				var span = jQuery('<span>', {'class': 'wcdv_heading_title'})
					.text('Total');
				var headingThControls = jQuery('<div>');
				var headingThContainer = jQuery('<div>')
					.addClass('wcdv_heading_container')
					.append(span, headingThControls);
				var th = jQuery('<th>')
					.attr({'colspan': data.groupFields.length})
					.append(headingThContainer)
					.appendTo(tr);

				break;
			case 'groupAggregates':
				_.each(ai.all, function (aggInfo, aiAllIndex) {
					var aggResult
						, text
						, td;

					aggResult = data.agg.results.all[aggInfo.aggNum];

					if (aggInfo.instance.inheritFormatting) {
						text = format(aggInfo.colConfig[0], aggInfo.typeInfo[0], aggResult, {
							overrideType: aggInfo.instance.getType()
						});
					}
					else {
						text = format(null, null, aggResult, {
							overrideType: aggInfo.instance.getType()
						});
					}

					td = jQuery('<td>').text(text);

					if (self.opts.drawInternalBorders || ai.cell.length > 1) {
						td.addClass(aiAllIndex === 0 ? 'wcdv_pivot_aggregate_boundary' : 'wcdv_pivot_colval_boundary');
					}

					self.csv.addCol(text);
					self.setAlignment(td, aggInfo.colConfig[0], aggInfo.typeInfo[0], aggInfo.instance.getType());
					td.appendTo(tr);
				});
				break;
			}
		});

		tr.appendTo(self.ui.tbody);
	};

	if (ai.all.length > 0) {
		renderTotalRow();
	}

	if (self.features.floatingHeader) {
		switch (getProp(self.defn, 'table', 'floatingHeader', 'method')) {
		case 'tabletool':
			TableTool.update();
			break;
		}
	}

	self.fire('csvReady');

	if (typeof cont === 'function') {
		return cont();
	}
};

// #addWorkHandler {{{2

GridTableGroupSummary.prototype.addWorkHandler = function () {
	var self = this;

	self.view.on(View.events.workEnd, function (info, ops) {
		debug.info('GRID TABLE - GROUP - SUMMARY // HANDLER (View.workEnd)', 'View has finished doing work');

		if (!ops.group || ops.pivot) {
			self.fire('unableToRender', null, ops);
			return;
		}

		debug.info('GRID TABLE - GROUP - SUMMARY // HANDLER (View.workEnd)', 'Redrawing because the view has done work');
		self.draw(self.root);
	}, { who: self });
};

// GridTablePivot {{{1
// Constructor {{{2

/**
 * A grid table used for showing data that's been pivotted by the view.
 *
 * @class
 * @extends GridTable
 */

var GridTablePivot = makeSubclass(GridTable, function (grid, defn, view, features, opts, timing, id) {
	var self = this;

	self.super.ctor.apply(self, arguments);

	self.features.limit = false;
	self.features.footer = false;

	debug.info('GRID TABLE - PIVOT', 'Constructing grid table; features = %O', features);

	setPropDef(['rowVals', 'cells', 'groupAggregates'], self.opts, 'displayOrder');
});

// #canRender {{{2

/**
 * Responds whether or not this grid table can render the type of data requested.
 *
 * @param {string} what
 * The kind of data the caller wants us to show.  Must be one of: plain, group, or pivot.
 *
 * @return {boolean}
 * True if this grid table can render that kind of data, false if it can't.
 */

GridTablePivot.prototype.canRender = function (what) {
	switch (what) {
	case 'pivot':
		return true;
	case 'plain':
	case 'group':
		return false;
	}
};

// #drawHeader {{{2

GridTablePivot.prototype.drawHeader = function (columns, data, typeInfo, opts) {
	var self = this,
		aggInfo,
		tr,
		span,
		headingThControls,
		headingThContainer,
		th;

	var addGroupFields = function (tr) {
		_.each(data.groupFields, function (field, fieldIdx) {
			var fcc = self.colConfig.get(field) || {};
			span = jQuery('<span>').addClass('wcdv_heading_title').text(fcc.displayText || field);
			self.csv.addCol(fcc.displayText || field);

			headingThControls = jQuery('<div>');

			headingThContainer = jQuery('<div>')
				.addClass('wcdv_heading_container')
				.append(span, headingThControls);

			th = jQuery('<th>')
				.attr({
					'data-wcdv-field': field,
					'data-wcdv-draggable-origin': 'GRID_TABLE_HEADER'
				})
				.append(headingThContainer)
				._makeDraggableField();

			self._addSortingToHeader(data, 'vertical', {groupFieldIndex: fieldIdx}, headingThControls, getPropDef([], data, 'agg', 'info', 'cell'));

			self.setCss(th, field);

			self.ui.thMap[field] = th;
			tr.append(th);
		});
	};

	// +---------------------------+--------------------------------------+-----------+
	// |                           | COLVAL 1.1              | COLVAL 1.2 |           |
	// +-------------+-------------+------------+------------+------------+-----------+
	// | GROUP FIELD | GROUP FIELD | COLVAL 2.1 | COLVAL 2.2 | COLVAL 2.1 | GROUP AGG |
	// +-------------+-------------+------------+------------+------------+-----------+
	//  ^^^^^^^^^^^^^^^^^^^^^^^^^^^

	var displayRowVals = function (tr, pivotFieldNum, displayOrderIndex) {
		if (pivotFieldNum === data.pivotFields.length - 1) {
			addGroupFields(tr);
		}
		else {
			tr.append(jQuery('<th>', { colspan: data.groupFields.length }));
			for (var i = 0; i < data.groupFields.length; i += 1) {
				self.csv.addCol('');
			}
		}
	};

	// +---------------------------+--------------------------------------+-----------+
	// |                           | COLVAL 1.1              | COLVAL 1.2 |           |
	// +-------------+-------------+------------+------------+------------+-----------+
	// | GROUP FIELD | GROUP FIELD | COLVAL 2.1 | COLVAL 2.2 | COLVAL 2.1 | GROUP AGG |
	// +-------------+-------------+------------+------------+------------+-----------+
	//                              ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^

	var displayCells = function (tr, pivotFieldNum, displayOrderIndex) {
		var colVal, colValIndex;
		var ai = self._getAggInfo(data);
		// Indicates that we're on the last pivot field, i.e. the last row of the table header.
		var isLastPivotField = pivotFieldNum === data.pivotFields.length - 1;
		var pivotField = data.pivotFields[pivotFieldNum];

		// Create headers for the fields that we've pivotted by.  The headers are the column values for
		// those fields.
		//
		// +--------------------------------------------------+----------------+
		// | PIVOT COLVAL 1                                   | PIVOT COLVAL 2 | < PIVOT FIELD #1
		// +----------------+----------------+----------------+----------------+
		// | PIVOT COLVAL A | PIVOT COLVAL B | PIVOT COLVAL C | PIVOT COLVAL A | < PIVOT FIELD #2
		// +----------------+----------------+----------------+----------------+
		//
		// Col Vals = [[1,A], [1,B], [2,A]]
		//
		// When rendering the headers for Pivot Field #1, we go through the col vals and find that "1"
		// is repeated three times.  We don't make a cell for each one, instead we just increment
		// lastColValCount.  When the col val changes to "2", we set the colspan on the previous cell to
		// be however many of that col val we found.

		var lastColVal = null;
		var lastColValCount = 0;

		for (colValIndex = 0; colValIndex < data.colVals.length; colValIndex += 1) {
			colVal = data.colVals[colValIndex][pivotFieldNum];
			colVal = format(self.colConfig.get(pivotField), typeInfo.get(pivotField), colVal);

			if (colVal !== lastColVal || isLastPivotField) {
				if (lastColVal !== null) {
					// The we've hit a different colVal so count up how many of the last one we had to
					// determine the column span.  In the above example, there are three "Kennedy" and two
					// "Roosevelt" so those are the colspans that we would set.

					var colSpan = lastColValCount;

					if (ai.cell.length >= 2) {
						colSpan *= ai.cell.length;
					}

					th.attr('colspan', colSpan);
					tr.append(th);

					for (var i = 0; i < colSpan - 1; i += 1) {
						self.csv.addCol('');
					}
				}

				// Update the tracking information and reset the counter to one.

				lastColVal = colVal;
				lastColValCount = 1;

				span = jQuery('<span>').addClass('wcdv_heading_title').text(colVal);
				self.csv.addCol(colVal);

				headingThControls = jQuery('<div>');

				headingThContainer = jQuery('<div>')
					.addClass('wcdv_heading_container')
					.append(span, headingThControls);

				th = jQuery('<th>')
					.append(headingThContainer);

				self.setCss(th, colVal);

				// We only allow sorting on the final

				if (isLastPivotField) {
					self._addSortingToHeader(data, 'vertical', {colVal: data.colVals[colValIndex], aggNum: 0}, headingThControls, getPropDef([], data, 'agg', 'info', 'cell'));
				}

				if (ai.cell.length === 1) {
					aggInfo = data.agg.info.cell[0];
					self.setAlignment(th, aggInfo.colConfig[0], aggInfo.typeInfo[0], aggInfo.instance.getType());
				}
				else if (ai.cell.length > 1) {
					self.setAlignment(th, null, null, null, 'center');
				}

				if (self.opts.drawInternalBorders || ai.cell.length > 1) {
					th.addClass('wcdv_pivot_colval_boundary');
				}
			}
			else {
				lastColValCount += 1;
			}
		}

		// Same logic as when the colVal changes.

		var colSpan = lastColValCount;

		if (ai.cell.length >= 2) {
			colSpan *= ai.cell.length;
		}

		if (th != null) {
			th.attr('colspan', colSpan);
			tr.append(th);
		}

		for (var i = 0; i < colSpan - 1; i += 1) {
			self.csv.addCol('');
		}
	};

	// +---------------------------+--------------------------------------+-----------+
	// |                           | COLVAL 1.1              | COLVAL 1.2 |           |
	// +-------------+-------------+------------+------------+------------+-----------+
	// | GROUP FIELD | GROUP FIELD | COLVAL 2.1 | COLVAL 2.2 | COLVAL 2.1 | GROUP AGG |
	// +-------------+-------------+------------+------------+------------+-----------+
	//                                                                     ^^^^^^^^^^^

	var displayGroupAggregates = function (tr, pivotFieldNum, displayOrderIndex, displayOrderMax) {
		var isLastPivotField = pivotFieldNum === data.pivotFields.length - 1;

		if (!isLastPivotField) {
			var numExtraCols = getPropDef(0, data, 'agg', 'info', 'group', 'length')
				+ getPropDef(0, opts, 'addCols', 'length');
			if (numExtraCols > 0) {
				var th = jQuery('<th>', { colspan: numExtraCols });
				if (displayOrderIndex > 0) {
					th.addClass('wcdv_bld'); // border-left: double
				}
				if (displayOrderIndex < displayOrderMax - 1) {
					th.addClass('wcdv_brd'); // border-right: double
				}
				tr.append(th);
			}
		}
		else {
			// Render the user's custom-defined additional columns at the end of the last row of pivot field
			// column values.

			self.drawHeader_aggregates(data, tr, displayOrderIndex, displayOrderMax);
			self.drawHeader_addCols(tr, typeInfo, opts);
		}
	};

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

	for (var pivotFieldNum = 0; pivotFieldNum < data.pivotFields.length; pivotFieldNum += 1) {
		self.csv.addRow();

		tr = jQuery('<tr>');

		_.each(self.opts.displayOrder, function (what, displayOrderIndex) {
			if (typeof what === 'string') {
				switch (what) {
				case 'rowVals':
					displayRowVals(tr, pivotFieldNum);
					break;
				case 'cells':
					displayCells(tr, pivotFieldNum);
					break;
				case 'groupAggregates':
					displayGroupAggregates(tr, pivotFieldNum, displayOrderIndex, self.opts.displayOrder.length);
					break;
				}
			}
		});

		tr.appendTo(self.ui.thead);
	}
};

// #drawBody {{{2

GridTablePivot.prototype.drawBody = function (data, typeInfo, columns, cont, opts) {
	var self = this;

	opts = opts || {};
	opts.pivotConfig = opts.pivotConfig || {};

	var ai = self._getAggInfo(data);

	if (data.groupFields.length === 0) {
		if (typeof cont === 'function') {
			return cont();
		}
		else {
			return;
		}
	}

	_.each(data.data, function (rowGroup, groupNum) {
		self.csv.addRow();

		var tr = jQuery('<tr>');

		_.each(self.opts.displayOrder, function (what, displayOrderIndex) {
			if (typeof what === 'string') {
				switch (what) {
				case 'rowVals':
					self.drawBody_rowVals(data, tr, groupNum);
					break;
				case 'cells':
					var rowAgg = [];

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

					_.each(rowGroup, function (colGroup, pivotNum) {
						if (ai.cell.length === 0) {
							// There's no cell aggregate functions, so there isn't anything to put in the cell.
							tr.append(document.createElement('td'));
						}
						else {
							// Every cell aggregate function is going to make a separate cell.
							_.each(ai.cell, function (aggInfo, aiCellIndex) {
								var aggNum = aggInfo.aggNum;
								var aggType = aggInfo.instance.getType();
								var agg = data.agg.results.cell[aggNum];
								var aggResult = agg[groupNum][pivotNum];

								rowAgg.push(aggResult);

								var text;

								if (aggInfo.instance.inheritFormatting) {
									text = format(aggInfo.colConfig[0], aggInfo.typeInfo[0], aggResult, {
										overrideType: aggType
									});
								}
								else {
									text = format(null, null, aggResult, {
										overrideType: aggType
									});
								}

								var td = jQuery('<td>')
									.addClass('wcdv_pivot_cell')
									.attr({
										'data-rowval-index': groupNum,
										'data-colval-index': pivotNum
									})
									.text(text)
								;

								self._addDrillDownClass(td);

								if ((self.opts.drawInternalBorders || ai.cell.length > 1) && aiCellIndex === 0) {
									td.addClass('wcdv_pivot_colval_boundary');
								}

								self.csv.addCol(text);
								// REMOVED: How do we let the user set sizes &c. when doing a pivot table?
								// self.setCss(td, col);

								self.setAlignment(td, aggInfo.colConfig[0], aggInfo.typeInfo[0], aggType);

								td.appendTo(tr);
							});
						}
					});
					break;
				case 'groupAggregates':
					self.drawBody_groupAggregates(data, tr, groupNum, displayOrderIndex, self.opts.displayOrder.length);
					break;
				case 'addCols':
					// Generate the user's custom-defined additional columns.  If the `value` function returns an
					// Element or jQuery instance, we just put that in the <TD> that we make.  Otherwise (e.g. it
					// returns a string or number) we format it according to the type of the field that the pivot
					// function was operating on.
					//
					// EXAMPLE:
					//
					// Aggregate Function = sum
					// Aggregate Field    = Amount : number -> $0,0.00
					//
					// If the `value` function adds up the sums, yielding a grand total of them all, then we format
					// that using Numeral exactly as specified for the "Amount" field.

					_.each(self.opts.addCols, function (addCol) {
						var addColResult = addCol.value(data.data, groupNum, rowAgg, aggType);

						if (addColResult instanceof Element || addColResult instanceof jQuery) {
							var td = jQuery('<td>').append(addColResult);
						}
						else {
							var addColText;

							if (false && aggInfo.instance.inheritFormatting) {
								addColText = format(aggInfo.colConfig[0], aggInfo.typeInfo[0], addColResult, {
									alwaysFormat: true
								});
							}
							else {
								addColText = format(null, null, addColResult, {
									alwaysFormat: true
								});
							}
							var td = jQuery('<td>').text(addColText);
						}

						if (getProp(opts, 'pivotConfig', 'aggField')) {
							self.setAlignment(td, self.colConfig.get(opts.pivotConfig.aggField), typeInfo.get(opts.pivotConfig.aggField));
						}

						td.appendTo(tr);
						self.csv.addCol(td.text());
					});
					break;
				}
			}
		});

		tr.appendTo(self.ui.tbody);
	});

	// ===========================================================================
	//  PIVOT AGGREGATES
	// ===========================================================================

	_.each(ai.pivot, function (aggInfo, aiPivotIndex) {
		var span,
			text,
			aggNum = aggInfo.aggNum,
			headingThControls,
			headingThContainer,
			th;

		tr = jQuery('<tr>');
		self.csv.addRow();

		// Add a class to the first row so it gets the double-bar outline.

		if (aiPivotIndex === 0) {
			tr.addClass('wcdv_btd'); // border-top: double
		}

		_.each(self.opts.displayOrder, function (what) {
			if (typeof what === 'string') {
				switch (what) {
				case 'rowVals':

					// Insert the name of the aggregate function in the header.  This will take up as many columns
					// as there are group fields.

					if (data.groupFields.length > 1) {
						for (var i = 0; i < data.groupFields.length - 1; i += 1) {
							self.csv.addCol('');
						}
					}

					self.csv.addCol(aggInfo.instance.getFullName());
					span = jQuery('<span>').addClass('wcdv_heading_title').text(aggInfo.instance.getFullName());

					headingThControls = jQuery('<div>');

					headingThContainer = jQuery('<div>')
						.addClass('wcdv_heading_container')
						.append(span, headingThControls);

					th = jQuery('<th>')
						.attr({'colspan': data.groupFields.length})
						.append(headingThContainer)
						.appendTo(tr);

					// Add sorting to the header we just created.

					self._addSortingToHeader(data, 'horizontal', {aggType: 'pivot', aggNum: aggNum}, headingThControls, getPropDef([], data, 'agg', 'info', 'cell'));

					break;
				case 'cells':
					_.each(data.colVals, function (colVal, colValIdx) {
						// Add padding cells in the CSV output so that the pivot aggregates appear staggered.  Since
						// we can't do rowspan in CSV like we can in HTML.

						for (var i = 0; i < aiPivotIndex; i += 1) {
							self.csv.addCol('');
						}

						var aggResult = data.agg.results.pivot[aggNum][colValIdx];
						if (aggInfo.instance.inheritFormatting) {
							text = format(aggInfo.colConfig[0], aggInfo.typeInfo[0], aggResult, {
								overrideType: aggInfo.instance.getType()
							});
						}
						else {
							text = format(null, null, aggResult, {
								overrideType: aggInfo.instance.getType()
							});
						}

						var td = jQuery('<td>').text(text).attr({
							'data-colval-index': colValIdx
						});
						self._addDrillDownClass(td);

						if (ai.cell.length > 1) {
							td.attr('colspan', ai.cell.length);
						}

						if (self.opts.drawInternalBorders || ai.cell.length > 1) {
							td.addClass('wcdv_pivot_colval_boundary');
						}

						self.csv.addCol(text);
						self.setAlignment(td, aggInfo.colConfig[0], aggInfo.typeInfo[0], aggInfo.instance.getType());
						td.appendTo(tr);

						// Add padding cells in the CSV output so that the pivot aggregates appear staggered.  Since
						// we can't do rowspan in CSV like we can in HTML.

						for (var i = aiPivotIndex + 1; i < ai.pivot.length; i += 1) {
							self.csv.addCol('');
						}
					});
					break;
				case 'groupAggregates':

					// =========================================================================
					//  ALL AGGREGATES
					// =========================================================================

					if (getProp(data, 'agg', 'info', 'all', aggNum)) {
						for (var i = 0; i < aiPivotIndex; i += 1) {
							td = jQuery('<td><div>&nbsp;</div></td>');
							if (self.opts.drawInternalBorders || ai.cell.length > 1) {
								td.addClass(i === 0 ? 'wcdv_pivot_aggregate_boundary' : 'wcdv_pivot_colval_boundary');
							}
							td.addClass('wcdv_cell_empty');
							self.csv.addCol('');
							td.appendTo(tr);
						}

						aggInfo = data.agg.info.all[aggNum];
						aggResult = data.agg.results.all[aggNum];

						if (aggInfo.instance.inheritFormatting) {
							text = format(aggInfo.colConfig[0], aggInfo.typeInfo[0], aggResult, {
								overrideType: aggInfo.instance.getType()
							});
						}
						else {
							text = format(null, null, aggResult, {
								overrideType: aggInfo.instance.getType()
							});
						}

						td = jQuery('<td>').text(text);

						if (self.opts.drawInternalBorders || ai.cell.length > 1) {
							td.addClass(aiPivotIndex === 0 ? 'wcdv_pivot_aggregate_boundary' : 'wcdv_pivot_colval_boundary');
						}

						self.csv.addCol(text);
						self.setAlignment(td, aggInfo.colConfig[0], aggInfo.typeInfo[0], aggInfo.instance.getType());
						td.appendTo(tr);

						for (var i = aiPivotIndex + 1; i < ai.cell.length; i += 1) {
							td = jQuery('<td><div>&nbsp;</div></td>');
							if (self.opts.drawInternalBorders || ai.cell.length > 1) {
								td.addClass('wcdv_pivot_colval_boundary');
							}
							td.addClass('wcdv_cell_empty');
							self.csv.addCol('');
							td.appendTo(tr);
						}
					}
					break;
				}
			}
		});

		tr.appendTo(self.ui.tbody);
	});

	self.fire('csvReady');

	if (typeof cont === 'function') {
		return cont();
	}
};

// #addWorkHandler {{{2

GridTablePivot.prototype.addWorkHandler = function () {
	var self = this;

	self.view.on(View.events.workEnd, function (info, ops) {
		debug.info('GRID TABLE - PIVOT // HANDLER (View.workEnd)', 'View has finished doing work');

		if (!ops.pivot) {
			debug.info('GRID TABLE - PIVOT // HANDLER (View.workEnd)', 'Unable to render this data: %O', ops);
			self.fire('unableToRender', null, ops);
			return;
		}

		debug.info('GRID TABLE - PIVOT // HANDLER (View.workEnd)', 'Redrawing because the view has done work');
		self.draw(self.root);
	}, { who: self });
};

// Registry {{{1

GridRenderer.registry = OrdMap.fromArray([{
	name: 'table_plain',
	cls: GridTablePlain
}, {
	name: 'table_group_detail',
	cls: GridTableGroupDetail
}, {
	name: 'table_group_summary',
	cls: GridTableGroupSummary
}, {
	name: 'table_pivot',
	cls: GridTablePivot
}, {
	name: 'handlebars',
	cls: GridRendererHandlebars
}], 'name');
