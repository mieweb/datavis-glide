// Csv {{{1

var Csv = makeSubclass(Object, function (opts) {
	var self = this;

	self.opts = opts || {};

	_.defaults(self.opts, {
		separator: ','
	});

	self.clear();
});

// #addRow {{{2

Csv.prototype.addRow = function () {
	var self = this;

	self.lastRow = [];
	self.data.push(self.lastRow);
};

// #addCol {{{2

Csv.prototype.addCol = function (x) {
	var self = this;

	if (self.lastRow == null) {
		// LMGTFY
		self.addRow();
	}

	self.lastRow.push(x);
};

// #clear {{{2

Csv.prototype.clear = function () {
	var self = this;

	self.data = [];
	self.lastRow = null;
};

// #toString {{{2

Csv.prototype.toString = function () {
	var self = this;

	var s = '';
	var sep = '"' + self.opts.separator + '"';
	for (var i = 0; i < self.data.length; i += 1) {
		if (i > 0) {
			s += '\r\n';
		}
		s += '"' + self.data[i].map(function (s) {
			return s.replace('"', '""');
		}).join(sep) + '"';
	}

	return s;
};

// GridTable {{{1
// Constructor {{{2

/**
 * @param {object} defn
 *
 * @param {View} view
 *
 * @param {object} features
 *
 * @param {object} opts
 *
 * @param {Timing} timing
 *
 * @param {string} id
 *
 * @class
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
 * @property {boolean} needsRedraw
 * If true, then the view has done something that requires us to be redrawn.
 *
 * @property {Object.<string, ColConfig>} colConfig
 */

var GridTable = (function () {
	var UNIQUE_ID = 0;

	return function (grid, defn, view, features, opts, timing, id) {
		var self = this;

		self.UNIQUE_ID = UNIQUE_ID++;

		self.id = id;
		self.grid = grid;
		self.defn = defn;
		self.view = view;
		self.features = deepCopy(features);
		self.opts = opts;
		self.timing = timing;
		self.selection = [];

		self.needsRedraw = false;

		self._validateFeatures();

		self.colConfig = {};

		_.each(self.defn.table.columns, function (col) {
			self.colConfig[col.field] = col;
		});

		_.defaults(self.opts, {
			drawInternalBorders: true,
			zebraStriping: true
		});
	};
})();

GridTable.prototype = Object.create(Object.prototype);
GridTable.prototype.constructor = GridTable;

mixinEventHandling(GridTable, 'GridTable', [
		'columnResize' // Fired when a column is resized.
	, 'unableToRender' // Fired when a grid table can't render the data in the view it's bound to.
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

	if (config.method === undefined) {
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

// #toString {{{2

GridTable.prototype.toString = function () {
	var self = this;

	return 'GridTable{id="' + self.id + '"}';
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

// #setAlignment {{{2

GridTable.prototype.setAlignment = function (elt, colConfig, typeInfo, overrideType, fallback) {
	colConfig = colConfig || {};
	typeInfo = typeInfo || {};

	var type = overrideType || typeInfo.type;
	var alignment = colConfig.cellAlignment || fallback;

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

GridTable.prototype._addSortingToHeader = function (orientation, spec, headingSpan) {
	var self = this;

	if (!self.features.sort) {
		return;
	}

	var sortIndicatorClass = 'wcdv_sort_indicator_' + orientation;
	var sortSpan = jQuery('<span>');

	var getIconCode = function (dir) {
		return orientation === 'vertical'
			? (dir === 'ASC' ? 'F0AB' : 'F0AA')
			: (dir === 'ASC' ? 'F0A9' : 'F0A8');
	};

	var onClick = function () {
		var cloneSortSpan = jQuery(this).siblings('span.' + sortIndicatorClass);
		jQuery('span.' + sortIndicatorClass).hide();
		cloneSortSpan.show();

		var sortSpec = self.view.getSort() || {};

		// Save the sort spec.  If we're resorting a column (i.e. we just sorted it) then
		// reverse the sort direction.  Otherwise, start in ascending order.

		var currentDir
			, newDir = 'ASC';

		if (sortSpec[orientation]) {
			currentDir = sortSpec[orientation].dir;
			delete sortSpec[orientation].dir;

			newDir = !_.isEqual(sortSpec[orientation], spec) ? 'ASC'
				: (currentDir === 'ASC' ? 'DESC' : 'ASC');
		}

		sortSpec[orientation] = deepCopy(spec);
		sortSpec[orientation].dir = newDir;

		cloneSortSpan.html(fontAwesome(getIconCode(newDir)));

		self.view.setSort(sortSpec, self.makeProgress('Sort'));
	};

	sortSpan.addClass(sortIndicatorClass);
	sortSpan.addClass('wcdv_sort_indicator');
	sortSpan.on('click', onClick);

	var sortSpec = deepCopy(self.view.getSort());

	if (sortSpec[orientation]) {
		var currentDir = sortSpec[orientation].dir;
		delete sortSpec[orientation].dir;

		if (_.isEqual(sortSpec[orientation], spec)) {
			sortSpan.html(fontAwesome(getIconCode(currentDir)));
		}
	}

	headingSpan.css({'cursor': 'pointer'});
	headingSpan.on('click', onClick);

	if (orientation === 'vertical') {
		headingSpan.before(sortSpan);
	}
	else {
		headingSpan.after(sortSpan);
	}
};

// #_addSortingToHeader2 {{{2

GridTable.prototype._addSortingToHeader2 = function (orientation, spec, th, agg) {
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
		th.removeClass('wcdv_sort_column_active');

		if (dir != null) {
			th.addClass('wcdv_sort_column_active');

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
		sortIcon_menu_items[gensym()] = {
			name: (spec.field || spec.groupFieldIndex) + ', Ascending',
			icon: 'fa-sort-amount-asc',
			callback: function () {
				setSort('asc')
			}
		};
		sortIcon_menu_items[gensym()] = {
			name: (spec.field || spec.groupFieldIndex) + ', Descending',
			icon: 'fa-sort-amount-desc',
			callback: function () {
				setSort('desc')
			}
		};
		sortIcon_menu_items[gensym()] = '----';
	}
	else {
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

	th.append(sortIcon_span);

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

		debug.info('GRID TABLE // ADD SORTING', 'orientation = %s ; spec = %O ; current = %O ; dir = %s',
			orientation, spec_copy, sortSpec_copy[orientation], currentDir);

		if (_.isEqual(sortSpec_copy[orientation], spec_copy)) {
			replaceSortIndicator(sortIcon_span, currentDir);
		}
	}
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
				debug.info('GRID TABLE // HANDLER (View.sortEnd)', 'Marking table to be redrawn');
				self.needsRedraw = true;
			}, { who: self });
		}
		else {
			self.view.on('sort', function (rowNum, position) {
				var elt = jQuery(document.getElementById(self.defn.table.id + '_' + rowNum));

				// Add one to the position (which is 0-based) to match the 1-based row number in CSS.

				elt.removeClass('even odd');
				elt.addClass((position + 1) % 2 === 0 ? 'even' : 'odd');
				self.ui.tbody.append(elt);
			}, { who: self });
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
	// We also can't use this approach when we're using preferences, because those can cause the data
	// to be filtered down before our grid actually creates all the rows.  (The prefs are applied
	// before the grid table is created.)  At that point, showing or hiding rows is irrelevant because
	// the grid table doesn't event know what the unfiltered ones are, it's only ever seen the data
	// with filters applied.

	self.view.off('filter');

	if (self.features.limit || self.view.opts.saveViewConfig) {
		self.view.on(View.events.filterEnd, function () {
			debug.info('GRID TABLE // HANDLER (View.filterEnd)', 'Marking table to be redrawn');
			self.needsRedraw = true;
		}, { who: self });
	}
	else {
		var even = false; // Rows are 1-based to match our CSS zebra-striping.

		self.view.on(View.events.filter, function (rowNum, hide) {
			if (isNothing(self.ui.tr[rowNum])) {
				debug.info('GRID TABLE // HANDLER (View.filter)', 'We were told to ' + (hide ? 'hide' : 'show') + ' row ' + rowNum + ', but it doesn\'t exist');
				return;
			}

			self.ui.tr[rowNum].removeClass('even odd');
			if (hide) {
				self.ui.tr[rowNum].hide();
			}
			else {
				self.ui.tr[rowNum].show();
				self.ui.tr[rowNum].addClass(even ? 'even' : 'odd');
				even = !even;
			}
		}, { who: self });
	}
};

// #draw {{{2

GridTable.prototype.draw = function (root, tableDoneCont, opts) {
	var self = this;

	debug.info('GRID TABLE // DRAW', 'Beginning draw operation; opts = %O', opts);

	opts = opts || self.drawOpts;

	self.root = root;

	if (self.features.limit && self.defn.table.limit.method === 'more') {
		self.scrollEventElement = self.opts.rootHasFixedHeight ? self.root : window;
		jQuery(self.scrollEventElement).on(self.scrollEvents, function () {
			if (typeof self.moreVisibleHandler === 'function') {
				self.moreVisibleHandler();
			}
		});
	}

	return self.view.getData(function (data) {
		debug.info('GRID TABLE // DRAW', 'Data = %O', data);

		return self.view.getTypeInfo(function (typeInfo) {
			debug.info('GRID TABLE // DRAW', 'TypeInfo = %O', typeInfo.asMap());

			if ((data.isPlain && !self.canRender('plain'))
					|| (data.isGroup && !self.canRender('group'))
					|| (data.isPivot && !self.canRender('pivot'))) {

				debug.info('GRID TABLE // DRAW', 'Unable to render data using current grid table: { isPlain = %s ; isGroup = %s ; isPivot = %s }', data.isPlain, data.isGroup, data.isPivot);

				return self.fire(GridTable.events.unableToRender);
			}

			self.data = data;
			self.typeInfo = typeInfo;

			self.timing.start(['Grid Table', 'Draw']);

			var tr
				, srcIndex = 0;

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

			var columns = determineColumns(self.defn, data, typeInfo)
				, numCols = columns.length;

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

			/*
			 * Draw the body.
			 */

			self.drawBody(data, typeInfo, columns, function () {
				if (getProp(self.defn, 'table', 'incremental', 'appendBodyLast')) {
					self.ui.tbl.append(self.ui.tbody);
				}

				self.timing.stop(['Grid Table', 'Draw']);

				if (typeof tableDone === 'function') {
					window.setTimeout(function () {
						tableDone();
					});
				}
			}, opts);

			self.addSortHandler();

			if (self.features.rowReorder) {
				configureRowReordering(self.defn, self.ui.tbody);
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
			}

			if (self.features.footer) {
				self.ui.tbl.append(self.ui.tfoot);
			}

			self.root.append(self.ui.tbl);

			// Activate TableTool using this attribute, if the user asked for it.

			if (self.features.floatingHeader) {
				debug.info('GRID TABLE // DRAW', 'Enabling floating header using method "%s"',
									 getProp(self.defn, 'table', 'floatingHeader', 'method'));
				switch (getProp(self.defn, 'table', 'floatingHeader', 'method')) {
				case 'floatThead':
					var floatTheadConfig = {};
					if (self.opts.fixedHeight) {
						floatTheadConfig.position = 'fixed';
						floatTheadConfig.scrollContainer = true;
						self.grid.on(Grid.events.showControls, function () {
							self.ui.tbl.floatThead('reflow');
						});
						self.grid.on(Grid.events.hideControls, function () {
							self.ui.tbl.floatThead('reflow');
						});
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

			if (typeof tableDoneCont === 'function') {
				return tableDoneCont();
			}
		});
	});
};

// #drawHeader_aggregates {{{2

/**
 * Add TH elements for all the aggregates to the specified TR.
 *
 * @param {Object} data
 *
 * @param {string} what
 * What kind of aggregate to draw, either "group" or "pivot".
 *
 * @param {Element} tr
 * Where to put the TH elements.
 */

GridTable.prototype.drawHeader_aggregates = function (data, what, tr) {
	var self = this;

	_.each(getPropDef([], data, 'agg', 'info', what), function (aggInfo, aggNum) {
		var text = aggInfo.instance.getFullName();
		var span = jQuery('<span>')
			.text(text);
		var th = jQuery('<th>')
			.append(span)
			.appendTo(tr);
		if (self.opts.drawInternalBorders || data.agg.info.group.length > 1) {
			if (what === 'group' && aggNum === 0) {
				th.addClass('wcdv_pivot_aggregate_boundary');
			}
			else {
				th.addClass('wcdv_pivot_colval_boundary');
			}
		}
		self.csv.addCol(text);
		self._addSortingToHeader2('vertical', {aggType: what, aggNum: aggNum}, th, getPropDef([], data, 'agg', 'info', 'group'));
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
				self.setAlignment(th, self.colConfig[opts.pivotConfig.aggField], typeInfo.get(opts.pivotConfig.aggField));
			}
		});
	}
};

// #drawBody_aggregates {{{2

GridTable.prototype.drawBody_aggregates = function (data, tr, groupNum) {
	var self = this;

	_.each(getPropDef([], data, 'agg', 'info', 'group'), function (aggInfo, aggNum) {
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

		var td = jQuery('<td>').text(text);

		if (self.opts.drawInternalBorders || data.agg.info.group.length > 1) {
			if (aggNum === 0) {
				td.addClass('wcdv_pivot_aggregate_boundary');
			}
			else {
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

	self.view.off('*', self);

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

// #setDrawOptions {{{2

GridTable.prototype.setDrawOptions = function (opts) {
	var self = this;

	self.drawOpts = opts;
};

// #clearDrawOptions {{{2

GridTable.prototype.clearDrawOptions = function () {
	var self = this;

	delete self.drawOpts;
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
 * Set the currently selected rows.
 *
 * @param {number[]} [what]
 * Set the selection to the specified row IDs, or select nothing if not specified.
 */

GridTable.prototype.setSelection = function (what) {
	var self = this;

	if (!self.data.isPlain) {
		log.error('GridTable#select(): Only works for plain data');
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

	self._updateSelectionGui();
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

	if (!self.data.isPlain) {
		log.error('GridTable#select(): Only works for plain data');
		return;
	}

	if (what == null) {
		// Select all.
		self.selection = _.pluck(self.data.data, 'rowNum');
	}
	else if (_.isArray(what)) {
		// Add elements to the selection.
		self.selection = _.intersection(self.selection, what);
	}
	else if (typeof what === 'function') {
		// Add passing rows to the selection.
		var passing = _.filter(self.data.data, function (d) {
			return what(d.rowData);
		});
		self.selection = _.union(self.selection, _.pluck(passing, 'rowNum'));
	}
	else if (!_.contains(self.selection, what)) {
		// Add item to ths selection.
		self.selection.push(what);
	}

	self._updateSelectionGui();
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

	if (!self.data.isPlain) {
		log.error('GridTable#unselect(): Only works for plain data');
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

	self._updateSelectionGui();
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

	features = deepCopy(features);
	features.filter = false;

	debug.info('GRID TABLE - PLAIN', 'Constructing grid table; features = %O', features);

	self.super = makeSuper(self, GridTable);
	self.super.ctor(grid, defn, view, features, opts, timing, id);
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
		'white-space': 'nowrap',
		'padding-bottom': 0
	};

	var filterThCss = {
		'white-space': 'nowrap',
		'padding-top': 4,
		'padding-bottom': 0,
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
		headingTr.append(jQuery('<th>').append(self.ui.checkAll_thead));
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
		var colConfig = getPropDef({}, self.defn, 'table', 'columns', colIndex);

		if (self.features.rowSelect) {
			colIndex += 1; // Add a column for the row selection checkbox.
		}

		var headingText = colConfig.displayText || field;

		var headingSpan = jQuery('<span>')
			.attr('data-wcdv-field', field)
			.text(headingText)
			._makeDraggableField();

		self.csv.addCol(headingText);

		var headingTh = jQuery('<th>', { id: gensym() })
			.css(headingThCss)
			.append(headingSpan);

		// In the plain grid table output, the only way to sort is vertically by field.

		self._addSortingToHeader2('vertical', {field: field}, headingTh);

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
						filterType: colConfig.filter,
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
		self.setAlignment(headingTh, colConfig, typeInfo.get(field));

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

// #drawBody {{{2

GridTablePlain.prototype.drawBody = function (data, typeInfo, columns, cont, opts) {
	var self = this;

	var check_handler = function () {
		var tds = jQuery(jQuery(this).parents('tr').get(0)).children('td');
		if (this.checked) {
			tds.addClass('wcdv_selected_row');
		}
		else {
			tds.removeClass('wcdv_selected_row');
		}
	};

	var useLimit = self.features.limit;
	var limitConfig = getPropDef({}, self.defn, 'table', 'limit');

	if (self.features.limit && limitConfig && data.data.length > limitConfig.threshold) {
		debug.info('GRID TABLE - PLAIN // DRAW', 'Limiting output to first ' + limitConfig.threshold + ' rows');
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
				tr = jQuery('<tr>', {id: self.defn.table.id + '_' + rowNum, 'data-row-num': rowNum});
				self.csv.addRow();

				// Create the check box which selects the row.

				if (self.features.rowSelect) {
					td = jQuery('<td>');
					
					var checkbox = jQuery('<input>', { 'type': 'checkbox', 'data-row-num': rowNum })
						.on('change', function () {
							if (this.checked) {
								self.select(+this.dataset.rowNum);
							}
							else {
								self.unselect(+this.dataset.rowNum);
							}
						});
					tr.append(jQuery('<td>').append(checkbox));
				}

				// Create the data cells.

				_.each(columns, function (field, colIndex) {
					var colConfig = getPropDef({}, self.defn, 'table', 'columns', colIndex);
					var cell = row.rowData[field];

					var td = jQuery('<td>');
					var value = format(colConfig, typeInfo.get(field), cell);

					if (value instanceof Element || value instanceof jQuery) {
						td.append(value);
					}
					else if (colConfig.allowHtml && typeInfo.get(field).type === 'string') {
						td.html(value);
					}
					else {
						td.text(value);
					}

					self.csv.addCol(td.text());
					self.setCss(td, field);
					self.setAlignment(td, colConfig, typeInfo.get(field));

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
	var self = this
		, tr = jQuery('<tr>');

	if (self.features.rowSelect) {
		self.ui.checkAll_tfoot = jQuery('<input>', { 'name': 'checkAll', 'type': 'checkbox' })
			.on('change', function (evt) {
				self.checkAll(evt);
			});
		tr.append(jQuery('<td>').append(self.ui.checkAll_tfoot));
	}

	tr.append(_.map(columns, function (field, colIndex) {
		var colConfig = getPropDef({}, self.defn, 'table', 'columns', colIndex)
			, colTypeInfo = typeInfo.get(field)
			, td = jQuery('<td>')
			, footerConfig = getProp(self.defn, 'table', 'footer', field)
			, agg
			, aggFun
			, aggResult
			, footerVal;

		self.setCss(td, field);
		self.setAlignment(td, colConfig, typeInfo.get(field));

		if (footerConfig !== undefined) {
			debug.info('GRID TABLE - PLAIN // FOOTER { field = "' + field + '" }', 'Creating footer using config: %O', footerConfig);
			switch (typeof footerConfig.aggregate) {
			case 'function':
				agg = footerConfig.aggregate;
				break;
			case 'string':
				if (typeof AGGREGATE_REGISTRY.get(footerConfig.aggregate) === undefined) {
					throw new Error('Footer config for field "' + field + '": requested aggregate function "' + footerConfig.aggregate + '" does not exist; supported aggregates are: ' + JSON.stringify(AGGREGATE_REGISTRY.keys()));
				}
				else {
					agg = AGGREGATE_REGISTRY.get(footerConfig.aggregate);
				}
				break;
			default:
				throw new Error('Footer config for field "' + field + '": `aggregate` must be a function or string');
			}

			aggFun = agg.fun({field: field, type: colTypeInfo.type});
			aggType = agg.type;
			aggResult = format(colConfig, typeInfo.get(field), aggFun(data.data), {
				overrideType: aggType
			});

			switch (typeof footerConfig.format) {
			case 'function':
				footerVal = footerConfig.format(aggResult);
				break;
			case 'string':
				footerVal = sprintf(footerConfig.format, aggResult);
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

	if (self.features.rowReorder) {
		tr.append(jQuery('<td>').text('Options'));
	}

	self.ui.tfoot.append(tr);
};

// #makeRowReorderBtn {{{2

GridTablePlain.prototype.makeRowReorderBtn = function () {
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

	self.clear();
	self.draw(self.root);
};

// #addWorkHandler {{{2

GridTablePlain.prototype.addWorkHandler = function () {
	var self = this;

	// Sets up callbacks responsible for correctly redrawing the grid when the view has done work
	// (e.g. sorting or filtering) that will change what is displayed.  This is only needed when
	// limiting output because otherwise, sort and filter callbacks don't need to redraw the whole
	// grid, and they are taken care of by the 'sort' and 'filter' events on a row-by-row basis.

	self.view.on(View.events.workEnd, function (info, ops) {
		debug.info('GRID TABLE // HANDLER (View.workEnd)', 'View has finished doing work');

		if (ops.group || ops.pivot) {

			// If the data is grouped or pivotted, we can't render it.  Emit the "unable to render" event
			// so that our Grid instance can replace us with a GridTableGroup or GridTablePivot instance
			// which can render the data.

			self.fire(GridTable.events.unableToRender);
			return;
		}

		if (self.needsRedraw) {
			debug.info('GRID TABLE // HANDLER (View.workEnd)', 'Redrawing because the view has done work');

			self.needsRedraw = false;

			return self.view.getData(function (data) {
				return self.view.getTypeInfo(function (typeInfo) {
					self.timing.start(['Grid Table', 'Redraw triggered by view']);

					// Determine what columns will be in the table.  This comes from the user, or from the
					// data itself.  We may then add columns for extra features (like row selection or
					// reordering).

					var columns = determineColumns(self.defn, data, typeInfo);

					// Draw the body.

					self.drawBody(data, typeInfo, columns, function () {
						self.timing.stop(['Grid Table', 'Redraw triggered by view']);

						// Potentially the columns resized as a result of sorting, filtering, or adding new data.
						self.fire(GridTable.events.columnResize);
					});
				});
			});
		}
		else {
			// Potentially the columns resized as a result of sorting, filtering, or adding new data.
			self.fire(GridTable.events.columnResize);
		}
	}, { who: self });
};

// #getCsv {{{2

GridTablePlain.prototype.getCsv = function () {
	var self = this;
	var columns = determineColumns(self.defn, self.data, self.typeInfo);

	self.csv.clear();

	self.csv.addRow();
	_.each(columns, function (field, colIndex) {
		var colConfig = getPropDef({}, self.defn, 'table', 'columns', colIndex);
		self.csv.addCol(colConfig.displayText || field);
	});

	_.each(self.data.data, function (row) {
		self.csv.addRow();
		_.each(columns, function (field, colIndex) {
			var colConfig = getPropDef({}, self.defn, 'table', 'columns', colIndex);
			var cell = row.rowData[field];
			var value = format(colConfig, self.typeInfo.get(field), cell);

			if (value instanceof Element) {
				self.csv.addCol(jQuery(value).text());
			}
			else if (value instanceof jQuery) {
				self.csv.addCol(value.text());
			}
			else if (colConfig.allowHtml && typeInfo.get(field).type === 'string') {
				self.csv.addCol(jQuery(value).text());
			}
			else {
				self.csv.addCol(value);
			}
		});
	});

	return self.csv.toString();
};

// #_updateSelectionGui {{{2

/**
 * Update the checkboxes in the grid table to match what the current selection is.
 */

GridTablePlain.prototype._updateSelectionGui = function () {
	var self = this;
	var isAllChecked = self.selection.length === self.data.data.length;
	var isIndeterminate = !isAllChecked && self.selection.length > 0;

	var updateCheckboxState = function (elt) {
		elt.prop('checked', isAllChecked);
		elt.prop('indeterminate', isIndeterminate);
	};

	self.root.find('tbody td.wcdv_selected_row').removeClass('wcdv_selected_row');
	self.root.find('tbody td:first-child input[type="checkbox"]').prop('checked', false);
	var trs = self.root.find('tbody tr').filter(function (_idx, elt) {
		return self.selection.indexOf(+elt.dataset.rowNum) >= 0;
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

// GridTableGroupDetail {{{1
// Constructor {{{2

var GridTableGroupDetail = makeSubclass(GridTable, function (grid, defn, view, features, opts, timing, id) {
	var self = this;

	features = deepCopy(features);
	features.limit = false;
	features.footer = false;

	debug.info('GRID TABLE - GROUP - DETAIL', 'Constructing grid table; features = %O', features);

	self.super = makeSuper(self, GridTable);
	self.super.ctor(grid, defn, view, features, opts, timing, id);
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

	_.each(data.groupFields, function (fieldName, fieldIdx) {
		headingTr = jQuery('<tr>');

		// Add spacers for the previous group fields.

		for (var i = 0; i < fieldIdx + 1; i += 1) {
			jQuery('<th>')
				.addClass('wcdv_group_col_spacer')
				.appendTo(headingTr)
			;
		}

		headingSpan = jQuery('<span>')
			.attr('data-wcdv-field', fieldName)
			.text(fieldName)
			._makeDraggableField()
		;

		headingTh = jQuery('<th>')
			.attr('colspan', columns.length - fieldIdx)
			.css(headingThCss)
			.append(headingSpan)
		;

		self._addSortingToHeader2('vertical', {groupFieldIndex: fieldIdx}, headingTh);

		self.setCss(headingTh, fieldName);

		self.ui.thMap[fieldName] = headingTh;

		headingTr.append(headingTh);
		self.ui.thead.append(headingTr);
	});

	headingTr = jQuery('<tr>');

	// Add spacers for all the group fields.

	for (var i = 0; i < data.groupFields.length + 1; i += 1) {
		jQuery('<th>')
			.addClass('wcdv_group_col_spacer')
			.appendTo(headingTr)
		;
	}

	// Make headers for all the normal (non-grouped) columns.

	_.each(columns, function (field, colIndex) {
		var colConfig = getPropDef({}, self.defn, 'table', 'columns', colIndex)

		if (data.groupFields.indexOf(field) >= 0) {
			return;
		}

		headingSpan = jQuery('<span>')
			.attr('data-wcdv-field', field)
			.text(field)
			._makeDraggableField()
		;

		headingTh = jQuery('<th>')
			.css(headingThCss)
			.append(headingSpan);

		self._addSortingToHeader2('vertical', {field: field}, headingTh);

		self.setCss(headingTh, field);
		self.setAlignment(headingTh, colConfig, typeInfo.get(field));

		self.ui.thMap[field] = headingTh;
		headingTr.append(headingTh);
	});

	self.ui.thead.append(headingTr);
};

// #drawBody {{{2

GridTableGroupDetail.prototype.drawBody = function (data, typeInfo, columns, cont, opts) {
	var self = this;

	if (!data.isGroup) {
		if (typeof cont === 'function') {
			return cont();
		}
		else {
			return;
		}
	}

	var groupIds = {};
	var revGroupIds = [];
	var isRendered = [];
	var groupId = 0;
	_.each(data.rowVals, function (rowVal, rowValIdx) {
		setProp(0, groupIds, rowVal, '_groupId');
		setProp(rowValIdx, groupIds, rowVal, '_rowValIdx');
	});

	(function RECUR(o) {
		_.each(o, function (v, k) {
			if (typeof v === 'object') {
				v._groupId = groupId++;
				revGroupIds[v._groupId] = v._rowValIdx;
				RECUR(v);
			}
		});
	})(groupIds, []);

	var lastRowVal = [];

	var render = function (groupNum, placeAfter) {
		var rowGroup = data.data[groupNum];
		var rowVal = data.rowVals[groupNum];
		var tr;

		// Create the cells that show the rows in this group.
		//
		// EXAMPLE
		// -------
		//
		// <tr>
		//   <td colspan="2"></td>
		//   ... row[col] | col ∉ groupFields ...
		// </tr>

		_.each(rowGroup, function (row, rowNum) {
			tr = jQuery('<tr>', {id: self.defn.table.id + '_' + rowNum})
				.attr('data-wcdv-group', getProp(groupIds, rowVal, '_groupId'))
				.hide()
				.append(jQuery('<td>', { colspan: data.groupFields.length + 1 }))
			;

			// Create the data cells.

			_.each(columns, function (field, colIndex) {
				if (data.groupFields.indexOf(field) >= 0) {
					return;
				}

				var colConfig = getPropDef({}, self.defn, 'table', 'columns', colIndex);
				var cell = row.rowData[field];

				var td = jQuery('<td>');
				var value = format(colConfig, typeInfo.get(field), cell);

				if (value instanceof Element || value instanceof jQuery) {
					td.append(value);
				}
				else if (colConfig.allowHtml && typeInfo.get(field).type === 'string') {
					td.html(value);
				}
				else {
					td.text(value);
				}

				self.setCss(td, field);
				self.setAlignment(td, colConfig, typeInfo.get(field));

				tr.append(td);
			});

			self.ui.tr[rowNum] = tr;
			placeAfter.after(tr);
		});

		if (self.features.floatingHeader) {
			switch (getProp(self.defn, 'table', 'floatingHeader', 'method')) {
			case 'tabletool':
				TableTool.update();
				break;
			}
		}
	};

	var toggleGroup = function () {
		var toggle = function (groupId, show, tr) {
			if (show && revGroupIds[groupId] !== undefined && !isRendered[groupId]) {
				render(revGroupIds[groupId], tr);
				isRendered[groupId] = true;
			}
			self.ui.tbody
				.find('tr')
				.filter(function (i, elt) {
					return elt.dataset.wcdvGroup === groupId;
				})
				.each(function (i, elt) {
					if (elt.dataset.wcdvTogglesGroup) {
						toggle(elt.dataset.wcdvTogglesGroup, show && elt.dataset.wcdvCollapsed === '0', jQuery(elt));
					}
					if (show) {
						jQuery(elt).show();
					}
					else {
						jQuery(elt).hide();
					}
				});
		};

		var elt = jQuery(this);
		var tr = elt.closest('tr');
		var wasCollapsed = tr.attr('data-wcdv-collapsed');

		toggle(tr.attr('data-wcdv-toggles-group'), wasCollapsed === '1', tr);

		tr.attr('data-wcdv-collapsed', wasCollapsed === '1' ? '0' : '1');
		elt.html(fontAwesome(wasCollapsed === '1' ? 'F147' : 'F196'));
	};

	_.each(data.data, function (rowGroup, groupNum) {
		var tr;
		var rowVal = data.rowVals[groupNum];

		// Create the cells that show the rowVal for this group.
		//
		// EXAMPLE
		// -------
		//
		//   groupFields = ["First Name", "Last Name"]
		//   rowVals = [["Luke", "Skywalker"], ...]
		//                ^^^^    ^^^^^^^^^ = rowValElt
		//                0       1         = rowValIdx
		//
		// <tr>
		//   <th colspan="N">Luke</th>
		// </tr>
		// <tr>
		//   <td></td>
		//   <th colspan="N-1">Skywalker</th>
		// </tr>

		_.each(rowVal, function (rowValElt, rowValIdx) {
			if (lastRowVal[rowValIdx] === rowValElt) {
				return;
			}

			//console.log(rowVal.slice(0, rowValIdx + 1).join(', ')
			//						+ ' { group = ' + getProp(groupIds, rowVal.slice(0, rowValIdx), '_groupId')
			//						+ ' ; toggles = ' + getProp(groupIds, rowVal.slice(0, rowValIdx + 1), '_groupId') + ' }');

			tr = jQuery('<tr>')
				.attr('data-wcdv-group', getProp(groupIds, rowVal.slice(0, rowValIdx), '_groupId'))
				.attr('data-wcdv-toggles-group', getProp(groupIds, rowVal.slice(0, rowValIdx + 1), '_groupId'))
				.attr('data-wcdv-collapsed', '1')
			;

			if (rowValIdx > 0) {
				tr.hide();
			}

			// Insert spacer columns for previous group fields.

			for (var i = 0; i < rowValIdx; i += 1) {
				jQuery('<th>')
					.addClass('wcdv_group_col_spacer')
					.appendTo(tr)
				;
			}

			var expandBtn = jQuery('<div>')
				.addClass('wcdv_button wcdv_expand_button')
				.html(fontAwesome('F196'))
				.on('click', toggleGroup)
			;

			jQuery('<th>')
				.append(expandBtn)
				.addClass('wcdv_group_col_spacer')
				.appendTo(tr)
			;

			var infoText = ' (';

			if (rowValIdx < data.groupFields.length - 1) {
				var numSubGroups = getProp(data.groupMetadata, data.rowVals[groupNum].slice(0, rowValIdx + 1), '_children');
				infoText += '' + numSubGroups + ' group' + (numSubGroups > 1 ? 's' : '');
				infoText += ', ';
			}

			infoText += '' + getProp(data.groupMetadata, data.rowVals[groupNum].slice(0, rowValIdx + 1), '_count') + ' rows';

			infoText += ')';

			jQuery('<th>')
				.addClass('wcdv_group_value')
				.attr('colspan', columns.length - rowValIdx)
				.append(jQuery('<span>').addClass('wcdv_group_value').text(rowValElt))
				.append(infoText)
				.appendTo(tr)
			;

			self.ui.tbody.append(tr);
		});

		lastRowVal = arrayCopy(rowVal);
	});

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
			self.fire(GridTable.events.unableToRender);
			return;
		}

		debug.info('GRID TABLE - GROUP - DETAIL // HANDLER (View.workEnd)', 'Redrawing because the view has done work');
		self.clear();
		self.draw(self.root);
	}, { who: self });
};

// GridTableGroupSummary {{{1
// Constructor {{{2

var GridTableGroupSummary = makeSubclass(GridTable, function (grid, defn, view, features, opts, timing, id) {
	var self = this;

	features = deepCopy(features);
	features.limit = false;
	features.footer = false;

	debug.info('GRID TABLE - GROUP - SUMMARY', 'Constructing grid table; features = %O', features);

	self.super = makeSuper(self, GridTable);
	self.super.ctor(grid, defn, view, features, opts, timing, id);
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
	var self = this;

	var tr = jQuery('<tr>')
		, span
		, th;

	self.csv.addRow();

	_.each(data.groupFields, function (field, fieldIdx) {
		span = jQuery('<span>').text(field);

		th = jQuery('<th>')
			.attr('data-wcdv-field', field)
			.append(span)
			._makeDraggableField();

		self.csv.addCol(field);

		self._addSortingToHeader2('vertical', {groupFieldIndex: fieldIdx}, th, getProp(data, 'agg', 'info', 'group'));

		self.setCss(th, field);

		self.ui.thMap[field] = th;
		tr.append(th);
	});

	self.drawHeader_aggregates(data, 'group', tr);
	self.drawHeader_addCols(tr, typeInfo, opts);

	// Add the row for this pivot field to the THEAD.
	self.ui.thead.append(tr);
};

// #drawBody {{{2

GridTableGroupSummary.prototype.drawBody = function (data, typeInfo, columns, cont, opts) {
	var self = this;

	_.each(data.data, function (rowGroup, groupNum) {
		var tr = jQuery('<tr>');
		var td;
		var rowVal = data.rowVals[groupNum];

		self.csv.addRow();

		_.each(rowVal, function (rowValElt, rowValIdx) {
			jQuery('<th>')
				.addClass('wcdv_group_value')
				.append(jQuery('<span>').addClass('wcdv_group_value').text(rowValElt))
				.appendTo(tr)
			;
			self.csv.addCol(rowValElt);
		});

		self.drawBody_aggregates(data, tr, groupNum);

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
				self.setAlignment(td, self.colConfig[opts.pivotConfig.aggField], typeInfo.get(opts.pivotConfig.aggField));
			}

			td.appendTo(tr);
			self.csv.addCol(td.text());
		});

		self.ui.tbody.append(tr);
	});

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

GridTableGroupSummary.prototype.addWorkHandler = function () {
	var self = this;

	self.view.on(View.events.workEnd, function (info, ops) {
		debug.info('GRID TABLE - GROUP - SUMMARY // HANDLER (View.workEnd)', 'View has finished doing work');

		if (!ops.group || ops.pivot) {
			self.fire(GridTable.events.unableToRender);
			return;
		}

		debug.info('GRID TABLE - GROUP - SUMMARY // HANDLER (View.workEnd)', 'Redrawing because the view has done work');
		self.clear();
		self.draw(self.root);
	}, { who: self });
};

// GridTablePivot {{{1
// Constructor {{{2

/**
 * A grid table used for showing data that's been pivotted by the view.
 */

var GridTablePivot = makeSubclass(GridTable, function (grid, defn, view, features, opts, timing, id) {
	var self = this;

	features = deepCopy(features);
	features.limit = false;
	features.footer = false;

	debug.info('GRID TABLE - PIVOT', 'Constructing grid table; features = %O', features);

	self.super = makeSuper(self, GridTable);
	self.super.ctor(grid, defn, view, features, opts, timing, id);
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
	var self = this;
	var aggInfo;

	var tr, span, th;

	var addGroupFields = function (tr) {
		_.each(data.groupFields, function (field, fieldIdx) {
			span = jQuery('<span>').text(field);
			self.csv.addCol(field);

			var th = jQuery('<th>')
				.attr('data-wcdv-field', field)
				.append(span)
				._makeDraggableField();

			self._addSortingToHeader2('vertical', {groupFieldIndex: fieldIdx}, th, getPropDef([], data, 'agg', 'info', 'cell'));

			self.setCss(th, field);

			self.ui.thMap[field] = th;
			tr.append(th);
		});
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

	var pivotFieldNum, colValIndex;
	var colVal;
	var numCellAggregates = getPropDef(0, data, 'agg', 'info', 'cell', 'length');

	for (pivotFieldNum = 0; pivotFieldNum < data.pivotFields.length; pivotFieldNum += 1) {
		// Indicates that we're on the last pivot field, i.e. the last row of the table header.
		var lastPivotField = pivotFieldNum === data.pivotFields.length - 1;
		var pivotField = data.pivotFields[pivotFieldNum];

		tr = jQuery('<tr>'); // Create the row for the pivot field.
		self.csv.addRow();

		// WHEN THERE IS ONLY ONE AGGREGATE FUNCTION:
		//
		// +---------------------------+--------------------------------------------------------+
		// |                           | PIVOT COLVAL 1.1                    | PIVOT COLVAL 1.2 |
		// +-------------+-------------+------------------+------------------+------------------+
		// | GROUP FIELD | GROUP FIELD | PIVOT COLVAL 2.1 | PIVOT COLVAL 2.2 | PIVOT COLVAL 2.1 |
		// +-------------+-------------+-------+----------+-------+----------+------------------+
		//
		// WHEN THERE ARE MULTIPLE AGGREGATE FUNCTIONS:
		//
		// +---------------------------+--------------------------------------------------------+
		// |                           | PIVOT COLVAL 1.1                    | PIVOT COLVAL 1.2 |
		// +---------------------------+------------------+------------------+------------------+
		// |                           | PIVOT COLVAL 2.1 | PIVOT COLVAL 2.2 | PIVOT COLVAL 2.1 |
		// +-------------+-------------+-------+----------+-------+----------+------------------+
		// | GROUP FIELD | GROUP FIELD | AGG 1 | AGG 2    | AGG 1 | AGG 2    | AGG 1 | AGG 2    |
		// +-------------+-------------+-------+----------+-------+----------+-------+----------+

		if (lastPivotField && numCellAggregates <= 1) {
			addGroupFields(tr);
		}
		else {
			tr.append(jQuery('<th>', { colspan: data.groupFields.length }));
			for (var i = 0; i < data.groupFields.length; i += 1) {
				self.csv.addCol('');
			}
		}

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
			colVal = format(self.colConfig[pivotField], typeInfo.get(pivotField), colVal);

			if (colVal !== lastColVal || lastPivotField) {
				if (lastColVal !== null) {
					// The we've hit a different colVal so count up how many of the last one we had to
					// determine the column span.  In the above example, there are three "Kennedy" and two
					// "Roosevelt" so those are the colspans that we would set.

					var colSpan = lastColValCount;
					
					if (numCellAggregates >= 2) {
						colSpan *= numCellAggregates;
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

				span = jQuery('<span>').text(colVal);
				self.csv.addCol(colVal);

				th = jQuery('<th>')
					.append(span);

				self.setCss(th, colVal);

				// We only allow sorting on the final 

				if (lastPivotField) {
					self._addSortingToHeader2('vertical', {colVal: data.colVals[colValIndex], aggNum: 0}, th, getPropDef([], data, 'agg', 'info', 'cell'));
				}

				if (numCellAggregates === 1) {
					aggInfo = data.agg.info.cell[0];
					self.setAlignment(th, aggInfo.colConfig[0], aggInfo.typeInfo[0], aggInfo.instance.getType());
				}
				else if (numCellAggregates > 1) {
					self.setAlignment(th, null, null, null, 'center');
				}

				if (self.opts.drawInternalBorders || numCellAggregates > 1) {
					th.addClass('wcdv_pivot_colval_boundary');
				}
			}
			else {
				lastColValCount += 1;
			}
		}

		// Same logic as when the colVal changes.

		var colSpan = lastColValCount;

		if (numCellAggregates >= 2) {
			colSpan *= numCellAggregates;
		}

		th.attr('colspan', colSpan);
		tr.append(th);

		for (var i = 0; i < lastColValCount - 1; i += 1) {
			self.csv.addCol('');
		}

		// Add space for the extra columns that get inserted off to the right.

		if (!lastPivotField) {
			var numExtraCols = getPropDef(0, data, 'agg', 'info', 'group', 'length')
				+ getPropDef(0, opts, 'addCols', 'length');
			if (numExtraCols > 0) {
				jQuery('<th>', { colspan: numExtraCols }).appendTo(tr).addClass('wcdv_pivot_aggregate_boundary');
			}
		}

		// Render the user's custom-defined additional columns at the end of the last row of pivot field
		// column values.

		if (lastPivotField/* && numCellAggregates <= 1*/) {
			self.drawHeader_aggregates(data, 'group', tr);
			self.drawHeader_addCols(tr, typeInfo, opts);
		}

		// Add the row for this pivot field to the THEAD.
		self.ui.thead.append(tr);
	}

	/*
	if (numCellAggregates >= 2) {
		tr = jQuery('<tr>');
		self.csv.addRow();
		addGroupFields(tr);
		self.drawHeader_aggregates(data, 'group', tr);
		self.drawHeader_addCols(tr, typeInfo, opts);
		self.ui.thead.append(tr);
	}
	*/
};

// #drawBody {{{2

GridTablePivot.prototype.drawBody = function (data, typeInfo, columns, cont, opts) {
	var self = this;

	opts = opts || {};
	opts.pivotConfig = opts.pivotConfig || {};
	var numCellAggregates = getPropDef(0, data, 'agg', 'info', 'cell', 'length');

	if (data.groupFields.length === 0) {
		if (typeof cont === 'function') {
			return cont();
		}
		else {
			return;
		}
	}

	_.each(data.data, function (rowGroup, groupNum) {
		var tr = jQuery('<tr>');
		self.csv.addRow();

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
			var th = jQuery('<th>');
			var span = jQuery('<span>');
			if (rowVal instanceof Element || rowVal instanceof jQuery) {
				span.append(rowVal);
			}
			else if (getProp(self.colConfig, data.groupFields[rowValIndex], 'allowHtml')) {
				span.innerHtml(rowVal);
			}
			else {
				span.text(rowVal);
			}
			span.appendTo(th);
			th.appendTo(tr);
			self.csv.addCol(span.text());

			if (rowValIndex === data.groupFields.length - 1) {
				self._addSortingToHeader2('horizontal', {rowVal: data.rowVals[groupNum], aggNum: 0}, th, getPropDef([], data, 'agg', 'info', 'cell'));
			}
		});

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
			if (numCellAggregates === 0) {
				tr.append(document.createElement('td'));
			}
			else {
				_.each(data.agg.results.cell, function (agg, aggNum) {
					var aggInfo = data.agg.info.cell[aggNum];
					var aggType = aggInfo.instance.getType();
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

					var td = jQuery('<td>').text(text);

					if ((self.opts.drawInternalBorders || numCellAggregates > 1) && aggNum === 0) {
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

		self.drawBody_aggregates(data, tr, groupNum);

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
				self.setAlignment(td, self.colConfig[opts.pivotConfig.aggField], typeInfo.get(opts.pivotConfig.aggField));
			}

			td.appendTo(tr);
			self.csv.addCol(td.text());
		});

		self.ui.tbody.append(tr);
	});

	// ===========================================================================
	//  PIVOT AGGREGATES
	// ===========================================================================

	_.each(getPropDef([], data, 'agg', 'info', 'pivot'), function (aggInfo, aggNum) {
		var span;
		var text;

		tr = jQuery('<tr>');
		self.csv.addRow();

		// Add a class to the first row so it gets the double-bar outline.

		if (aggNum === 0) {
			tr.addClass('wcdv_gridtable_agg_pivot');
		}

		// Insert the name of the aggregate function in the header.  This will take up as many columns
		// as there are group fields.

		if (data.groupFields.length > 1) {
			for (var i = 0; i < data.groupFields.length - 1; i += 1) {
				self.csv.addCol('');
			}
		}

		self.csv.addCol(aggInfo.instance.getFullName());

		var th = jQuery('<th>')
			.attr({'colspan': data.groupFields.length})
			.append(jQuery('<span>')
				.text(aggInfo.instance.getFullName()))
			.appendTo(tr)
		;

		// Add sorting to the header we just created.

		self._addSortingToHeader2('horizontal', {aggType: 'pivot', aggNum: aggNum}, th, getPropDef([], data, 'agg', 'info', 'cell'));

		_.each(data.colVals, function (colVal, colValIdx) {
			var aggResult = data.agg.results.pivot[aggNum][colValIdx];
			if (aggInfo.instance.inheritFormatting) {
				text = format(aggInfo.colConfig[0], aggInfo.typeInfo[0], aggResult, {
					overrideType: aggInfo.instance.getType(),
					debug: true
				});
			}
			else {
				text = format(null, null, aggResult, {
					overrideType: aggInfo.instance.getType()
				});
			}

			var td = jQuery('<td>').text(text);

			if (numCellAggregates > 1) {
				td.attr('colspan', numCellAggregates);
			}

			if (self.opts.drawInternalBorders || numCellAggregates > 1) {
				td.addClass('wcdv_pivot_colval_boundary');
			}

			self.csv.addCol(text);
			self.setAlignment(td, aggInfo.colConfig[0], aggInfo.typeInfo[0], aggInfo.instance.getType());
			td.appendTo(tr);
		});

		// =========================================================================
		//  ALL AGGREGATES
		// =========================================================================

		if (getProp(data, 'agg', 'info', 'all', aggNum)) {
			for (var i = 0; i < aggNum; i += 1) {
				td = jQuery('<td><div>&nbsp;</div></td>');
				if (self.opts.drawInternalBorders || numCellAggregates > 1) {
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

			if (self.opts.drawInternalBorders || numCellAggregates > 1) {
				td.addClass(aggNum === 0 ? 'wcdv_pivot_aggregate_boundary' : 'wcdv_pivot_colval_boundary');
			}

			self.csv.addCol(text);
			self.setAlignment(td, aggInfo.colConfig[0], aggInfo.typeInfo[0], aggInfo.instance.getType());
			td.appendTo(tr);

			for (var i = aggNum + 1; i < getPropDef(0, data, 'agg', 'info', 'all', 'length'); i += 1) {
				td = jQuery('<td><div>&nbsp;</div></td>');
				if (self.opts.drawInternalBorders || numCellAggregates > 1) {
					td.addClass('wcdv_pivot_colval_boundary');
				}
				td.addClass('wcdv_cell_empty');
				self.csv.addCol('');
				td.appendTo(tr);
			}
		}

		self.ui.tbody.append(tr);
	});

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
			self.fire(GridTable.events.unableToRender, null, ops);
			return;
		}

		debug.info('GRID TABLE - PIVOT // HANDLER (View.workEnd)', 'Redrawing because the view has done work');
		self.clear();
		self.draw(self.root);
	}, { who: self });
};
