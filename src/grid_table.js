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

	return function (defn, view, features, opts, timing, id) {
		var self = this;

		self.UNIQUE_ID = UNIQUE_ID++;

		self.id = id;
		self.defn = defn;
		self.view = view;
		self.features = deepCopy(features);
		self.opts = opts;
		self.timing = timing;

		self.needsRedraw = false;

		if (self.features.limit) {
			self._validateLimit();

			self.scrollEvents = ['DOMContentLoaded', 'load', 'resize', 'scroll'].map(function (x) {
				return x + '.wcdv_gt_' + self.UNIQUE_ID;
			}).join(' ');
		}

		self.colConfig = {};

		_.each(self.defn.table.columns, function (col) {
			self.colConfig[col.field] = col;
		});
	};
})();

GridTable.prototype = Object.create(Object.prototype);
GridTable.prototype.constructor = GridTable;

mixinEventHandling(GridTable, 'GridTable', [
		'columnResize' // Fired when a column is resized.
	, 'unableToRender' // Fired when a grid table can't render the data in the view it's bound to.
]);

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

GridTable.prototype.setAlignment = function (elt, colConfig, typeInfo, field) {
	var alignment = colConfig.cellAlignment;

	if (alignment === undefined
			&& (typeInfo.get(field).type === 'number'
					|| typeInfo.get(field).type === 'currency')) {
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

		var sortSpec = self.view.sortSpec || {};

		// Save the sort spec.  If we're resorting a column (i.e. we just sorted it) then
		// reverse the sort direction.  Otherwise, start in ascending order.

		sortSpec.dir = sortSpec.col !== colName ? 'ASC' : sortSpec.dir === 'ASC' ? 'DESC' : 'ASC';
		sortSpec.col = colName;

		debug.info('GRID TABLE // SORT',
							 'Setting to sort by "%s" (%s)', sortSpec.col, sortSpec.dir);

		cloneSortSpan.html(fontAwesome(sortSpec.dir === 'ASC' ? 'F0D7' : 'F0D8'));

		self.view.setSort(sortSpec.col,
											sortSpec.dir,
											self.makeProgress('Sort'));
	};

	self.ui.sortArrow[colName] = sortSpan;

	sortSpan.addClass('sort_indicator');
	sortSpan.css({'cursor': 'pointer', 'margin-right': '0.5ex'});
	sortSpan.on('click', onClick);

	if (self.view.sortSpec && self.view.sortSpec.col === colName) {
		sortSpan.html(fontAwesome(self.view.sortSpec.dir === 'ASC' ? 'F0D7' : 'F0D8'));
	}

	headingSpan.css({'cursor': 'pointer'});
	headingSpan.on('click', onClick);

	headingTh.prepend(sortSpan);
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

			self.timing.start(['Grid Table', 'Draw']);

			var tr
				, srcIndex = 0;

			self.ui = {
				tbl: jQuery('<table>'),
				thead: jQuery('<thead>'),
				tbody: jQuery('<tbody>'),
				tfoot: jQuery('<tfoot>'),
				thMap: {},
				tr: {},
				progress: jQuery('<div>'),
				sortArrow: {}
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
				if (self.features.tabletool) {
					TableTool.update();
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
				if (self.features.tabletool) {
					TableTool.update();
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

			self.ui.tbl.attr('class', 'newui zebra');

			self.ui.tbl.append(self.ui.thead);

			if (!getProp(self.defn, 'table', 'incremental', 'appendBodyLast')) {
				self.ui.tbl.append(self.ui.tbody);
			}

			if (self.features.footer) {
				self.ui.tbl.append(self.ui.tfoot);
			}

			self.root.append(self.ui.tbl);

			// Activate TableTool using this attribute, if the user asked for it.

			if (self.features.tabletool) {
				debug.info('GRID TABLE // DRAW', 'Enabling TableTool');
				self.ui.tbl.attr('data-tttype', 'sticky');
			}

			self.addWorkHandler();
		});
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

var GridTablePlain = makeSubclass(GridTable, function (defn, view, features, opts, timing, id) {
	var self = this;

	features = deepCopy(features);
	features.filter = false;

	debug.info('GRID TABLE - PLAIN', 'Constructing grid table; features = %O', features);

	self.super = makeSuper(self, GridTable);
	self.super.ctor(defn, view, features, opts, timing, id);
	self.addFilterHandler();
});

// #_validateLimit {{{2

/**
 * Make sure the limit configuration is good.  If there's anything wrong, the limit feature is
 * disabled automatically.
 */

GridTablePlain.prototype._validateLimit = function () {
	var self = this;

	if (self.features.limit) {
		if (self.defn.table.limit.threshold === undefined) {
			debug.warn('GRID TABLE - PLAIN // DRAW', 'Disabling limit feature because no limit threshold was provided');
			self.features.limit = false;
		}
	}
};

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

		var headingSpan = jQuery('<span>')
			.attr('data-wcdv-field', field)
			.text(colConfig.displayText || field)
			._makeDraggableField();

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
		self.setAlignment(headingTh, colConfig, typeInfo, field);

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
					self.setAlignment(td, colConfig, typeInfo, field);

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

		if (self.features.tabletool && window.TableTool !== undefined) {
			TableTool.update();
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
				rowSelect_checkAll.call(this, evt, self.ui);
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
		self.setAlignment(td, colConfig, typeInfo, field);

		if (footerConfig !== undefined) {
			debug.info('GRID TABLE - PLAIN // FOOTER { field = "' + field + '" }', 'Creating footer using config: %O', footerConfig);
			switch (typeof footerConfig.aggregate) {
			case 'function':
				agg = footerConfig.aggregate;
				break;
			case 'string':
				if (typeof AGGREGATES[footerConfig.aggregate] === undefined) {
					throw new Error('Footer config for field "' + field + '": requested aggregate function "' + footerConfig.aggregate + '" does not exist; supported aggregates are: ' + JSON.stringify(_.keys(AGGREGATES)));
				}
				else {
					agg = AGGREGATES[footerConfig.aggregate];
				}
				break;
			default:
				throw new Error('Footer config for field "' + field + '": `aggregate` must be a function or string');
			}

			aggFun = agg.fun({field: field, type: colTypeInfo.type});
			aggType = agg.type;
			aggResult = format(colConfig, typeInfo.get(field), aggFun(data.data), {
				alwaysFormat: true,
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

// #getSelectedRows {{{2

/**
 * Find what rows were selected in the grid.
 *
 * @method
 * @memberof GridTablePlain
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

GridTablePlain.prototype.getSelectedRows = function (f) {
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

GridTablePlain.prototype.setSelectedRows = function (r) {
	var self = this;

	throw new NotImplementedError();
};

// #updateFeatures {{{2

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

			self.fire(GridTable.events.unableToRender, null, ops);
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

// GridTableGroup {{{1
// Constructor {{{2

var GridTableGroup = makeSubclass(GridTable, function (defn, view, features, opts, timing, id) {
	var self = this;

	features = deepCopy(features);
	features.limit = false;
	features.footer = false;

	debug.info('GRID TABLE - GROUP', 'Constructing grid table; features = %O', features);

	self.super = makeSuper(self, GridTable);
	self.super.ctor(defn, view, features, opts, timing, id);
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

GridTableGroup.prototype.canRender = function (what) {
	switch (what) {
	case 'group':
		return true;
	case 'plain':
	case 'pivot':
		return false;
	}
};

// #drawHeader {{{2

GridTableGroup.prototype.drawHeader = function (columns, data, typeInfo, opts) {
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

		self._addSortingToHeader(fieldName, headingSpan, headingTh);

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

		self._addSortingToHeader(field, headingSpan, headingTh);

		self.setCss(headingTh, field);
		self.setAlignment(headingTh, colConfig, typeInfo, field);

		self.ui.thMap[field] = headingTh;
		headingTr.append(headingTh);
	});

	self.ui.thead.append(headingTr);
};

// #drawBody {{{2

GridTableGroup.prototype.drawBody = function (data, typeInfo, columns, cont, opts) {
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
				self.setAlignment(td, colConfig, typeInfo, field);

				tr.append(td);
			});

			self.ui.tr[rowNum] = tr;
			placeAfter.after(tr);
		});

		if (self.features.tabletool && window.TableTool !== undefined) {
			TableTool.update();
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

	if (self.features.tabletool && window.TableTool !== undefined) {
		TableTool.update();
	}

	if (typeof cont === 'function') {
		return cont();
	}
};

// #addWorkHandler {{{2

GridTableGroup.prototype.addWorkHandler = function () {
	var self = this;

	self.view.on(View.events.workEnd, function (info, ops) {
		debug.info('GRID TABLE - GROUP // HANDLER (View.workEnd)', 'View has finished doing work');

		if (!ops.group || ops.pivot) {
			self.fire(GridTable.events.unableToRender, null, ops);
			return;
		}

		debug.info('GRID TABLE - GROUP // HANDLER (View.workEnd)', 'Redrawing because the view has done work');
		self.clear();
		self.draw(self.root);
	}, { who: self });
};

// GridTablePivot {{{1
// Constructor {{{2

/**
 * A grid table used for showing data that's been pivotted by the view.
 */

var GridTablePivot = makeSubclass(GridTable, function (defn, view, features, opts, timing, id) {
	var self = this;

	features = deepCopy(features);
	features.limit = false;
	features.footer = false;

	debug.info('GRID TABLE - GROUP', 'Constructing grid table; features = %O', features);

	self.super = makeSuper(self, GridTable);
	self.super.ctor(defn, view, features, opts, timing, id);
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
	var colVal;

	for (pivotFieldNum = 0; pivotFieldNum < data.pivotFields.length; pivotFieldNum += 1) {
		headingTr = jQuery('<tr>'); // Create the row for the pivot field.

		// Create headers for the fields that we've grouped by.  The headers are the names of those
		// fields.  We only do this for the last row of the header, i.e. the final pivot field.
		//
		// +---------------------------+--------------------------------------------------+
		// | ( not here )              | PIVOT COLVAL 1                  | PIVOT COLVAL 2 |
		// +-------------+-------------+----------------+----------------+----------------+
		// | GROUP FIELD | GROUP FIELD | PIVOT COLVAL A | PIVOT COLVAL B | PIVOT COLVAL A |
		// +-------------+-------------+----------------+----------------+----------------+

		if (pivotFieldNum === data.pivotFields.length - 1) {
			_.each(data.groupFields, function (field) {
				headingSpan = jQuery('<span>').text(field);

				headingTh = jQuery('<th>')
					.attr('data-wcdv-field', field)
					.css(headingThCss)
					.append(headingSpan)
					._makeDraggableField();

				self._addSortingToHeader(field, headingSpan, headingTh);

				self.setCss(headingTh, field);

				self.ui.thMap[field] = headingTh;
				headingTr.append(headingTh);
			});
		}
		else {
			headingTr.append(jQuery('<th>', { colspan: data.groupFields.length }));
		}

		// Create headers for the fields that we've pivotted by.  The headers are the column values for
		// those fields.

		var lastColVal = null;
		var lastColValCount = 0;

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

				self.setCss(headingTh, colVal);

				self._addSortingToHeader(colVal, headingSpan, headingTh);

				if (getProp(opts, 'pivotConfig', 'aggField')) {
					self.setAlignment(headingTh, self.colConfig[opts.pivotConfig.aggField], typeInfo, opts.pivotConfig.aggField);
				}
			}
			else {
				lastColValCount += 1;
			}
		}

		// Same logic as when the colVal changes.

		headingTh.attr('colspan', lastColValCount);
		headingTr.append(headingTh);

		// Render the user's custom-defined additional columns at the end of the first row of pivot
		// field column values.

		if (pivotFieldNum === 0 && self.opts.addCols) {
			_.each(self.opts.addCols, function (addCol) {
				headingSpan = jQuery('<span>')
					.text(addCol.name);
				headingTh = jQuery('<th>')
					.css(headingThCss)
					.append(headingSpan)
					.appendTo(headingTr);
				if (getProp(opts, 'pivotConfig', 'aggField')) {
					self.setAlignment(headingTh, self.colConfig[opts.pivotConfig.aggField], typeInfo, opts.pivotConfig.aggField);
				}
			});
		}

		// Add the row for this pivot field to the THEAD.
		self.ui.thead.append(headingTr);
	}
};

// #drawBody {{{2

GridTablePivot.prototype.drawBody = function (data, typeInfo, columns, cont, opts) {
	var self = this;

	opts = opts || {};
	opts.pivotConfig = opts.pivotConfig || {};

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

		var rowAgg = [];
		var pivotAggColConfig = opts.pivotConfig.aggField ? self.colConfig[opts.pivotConfig.aggField] : {};
		var pivotAggColTypeInfo = opts.pivotConfig.aggField ? typeInfo.get(opts.pivotConfig.aggField) : {};

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

			var agg = AGGREGATES[opts.pivotConfig.aggFun || 'count'];
			var aggFun = agg.fun({field: opts.pivotConfig.aggField, type: pivotAggColTypeInfo.type, colConfig: pivotAggColConfig});
			var aggType = agg.type;
			var aggResult = aggFun(colGroup);
			rowAgg.push(aggResult);
			var text = format(pivotAggColConfig, pivotAggColTypeInfo, aggResult, {
				alwaysFormat: true,
				overrideType: aggType
			});
			var td = jQuery('<td>').text(text);
			// REMOVED: How do we let the user set sizes &c. when doing a pivot table?
			// self.setCss(td, col);
			
			if (getProp(opts, 'pivotConfig', 'aggField')) {
				self.setAlignment(td, self.colConfig[opts.pivotConfig.aggField], typeInfo, opts.pivotConfig.aggField);
			}

			td.appendTo(tr);
		});

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
			var addColResult = addCol.value(data.data, groupNum, rowAgg);

			if (addColResult instanceof Element || addColResult instanceof jQuery) {
				var td = jQuery('<td>').append(addColResult);
			}
			else {
				var addColText = format(pivotAggColConfig, pivotAggColTypeInfo, addColResult, {
					alwaysFormat: true
				});
				var td = jQuery('<td>').text(addColText);
			}

			if (getProp(opts, 'pivotConfig', 'aggField')) {
				self.setAlignment(td, self.colConfig[opts.pivotConfig.aggField], typeInfo, opts.pivotConfig.aggField);
			}

			td.appendTo(tr);
		});

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

