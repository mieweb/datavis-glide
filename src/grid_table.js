// GridTable {{{1

var GridTable = function () {
};

GridTable.prototype = Object.create(Object.prototype);
GridTable.prototype.constructor = GridTable;

// #init {{{2
GridTable.prototype.init = function (defn, view, features, timing, id) {
	var self = this;

	self.id = id;
	self.defn = defn;
	self.view = view;
	self.features = features;
	self.timing = timing;

	self.needsRedraw = false;

	if (self.features.limit) {
		self._validateLimit();
	}

	self.colConfig = {};

	_.each(self.defn.table.columns, function (col) {
		self.colConfig[col.field] = col;
	});

	if (self.features.limit && self.defn.table.limit.method === 'more') {
		jQuery(window).on('DOMContentLoaded load resize scroll', function () {
			if (typeof self.moreVisibleHandler === 'function') {
				self.moreVisibleHandler();
			}
		});
	}
};

// #toString {{{2

GridTable.prototype.toString = function () {
	var self = this;

	return 'GridTable{id="' + self.id + '"}';
};

// .events {{{2

GridTable.events = objFromArray([
		'columnResize' // Fired when a column is resized.
	, 'unableToRender' // Fired when a grid table can't render the data in the view it's bound to.
]);

mixinEventHandling(GridTable, 'GridTable', GridTable.events);

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

		if (self.defn.sortSpec === undefined) {
			self.defn.sortSpec = {
				col: null,
				asc: false
			};
		}

		// Save the sort spec.  If we're resorting a column (i.e. we just sorted it) then
		// reverse the sort direction.  Otherwise, start in ascending order.

		self.defn.sortSpec.asc = (self.defn.sortSpec.col === colName ? !self.defn.sortSpec.asc : true);
		self.defn.sortSpec.col = colName;

		debug.info('SORTING', 'Column = ' + self.defn.sortSpec.col + ' ; Direction = ' + (self.defn.sortSpec.asc ? 'ASC' : 'DESC'));

		cloneSortSpan.html(fontAwesome(self.defn.sortSpec.asc ? 'F0D7' : 'F0D8'));

		self.view.setSort(self.defn.sortSpec.col,
											self.defn.sortSpec.asc ? 'ASC' : 'DESC',
											false,
											self.makeProgress('Sort'));
	};

	sortSpan.addClass('sort_indicator');
	sortSpan.css({'cursor': 'pointer', 'margin-right': '0.5ex'});
	sortSpan.on('click', onClick);

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
	// FIXME - This will cause problems with multiple grids (some supporting filtering, some not)
	// using the same view.

	self.view.off('filter');

	if (self.features.filter) {
		if (self.features.limit) {
			self.view.on(View.events.filterEnd, function () {
				debug.info('GRID TABLE // HANDLER (View.filterEnd)', 'Marking table to be redrawn');
				self.needsRedraw = true;
			}, { who: self });
		}
		else {
			var even = false; // Rows are 1-based to match our CSS zebra-striping.

			self.view.on(View.events.filter, function (rowNum, hide) {
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
	}
};

// #addWorkHandler {{{2

GridTable.prototype.addWorkHandler = function () {
	var self = this;

	self.view.on(View.events.workEnd, function (info, ops) {
		debug.info('GRID TABLE // HANDLER (View.workEnd)', 'View has finished doing work');

		if (ops.group || ops.pivot) {

			// If the data is grouped or pivotted, we can't render it.  Emit the "unable to render" event
			// so that our Grid instance can replace us with a GridTableGroup or GridTablePivot instance
			// which can render the data.

			self.fire(GridTable.events.unableToRender, ops);
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

// #draw {{{2

GridTable.prototype.draw = function (root, tableDoneCont, opts) {
	var self = this;

	self.root = root;

	return self.view.getData(function (data) {
		return self.view.getTypeInfo(function (typeInfo) {
			self.timing.start(['Grid Table', 'Draw']);

			debug.info('GRID TABLE // DRAW', 'Data = %O', data);
			debug.info('GRID TABLE // DRAW', 'TypeInfo = %O', typeInfo.asMap());

			var tr
				, srcIndex = 0;

			self.ui = {
				tbl: jQuery('<table>'),
				thead: jQuery('<thead>'),
				tbody: jQuery('<tbody>'),
				tfoot: jQuery('<tfoot>'),
				thMap: {},
				tr: [],
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

			self.drawHeader(columns, data, typeInfo);

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
			self.addFilterHandler();

			// Sets up callbacks responsible for correctly redrawing the grid when the view has done work
			// (e.g. sorting or filtering) that will change what is displayed.  This is only needed when
			// limiting output because otherwise, sort and filter callbacks don't need to redraw the whole
			// grid, and they are taken care of by the 'sort' and 'filter' events on a row-by-row basis.

			self.addWorkHandler();

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
		});
	});
};

// #clear {{{2

/**
 * Remove the table from page.
 */

GridTable.prototype.clear = function () {
	var self = this;

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

var GridTablePlain = function (defn, view, features, timing, id) {
	var self = this;

	self.super = makeSuper(self, GridTable);
	self.super.init(defn, view, features, timing, id);
};

GridTablePlain.prototype = Object.create(GridTable.prototype);
GridTablePlain.prototype.constructor = GridTablePlain;

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

GridTablePlain.prototype.drawHeader = function (columns, data, typeInfo) {
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
		self.defn.gridFilterSet = new GridFilterSet(self.defn, self.view, self, progress);
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
			.draggable({
				classes: {
					'ui-draggable-handle': 'wcdv_drag_handle'
				},
				distance: 8, // FIXME Deprecated [1.12]: replacement will be in 1.13
				helper: 'clone',
				revert: true,
				revertDuration: 0
			});

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

					self.defn.gridFilterSet.add(field, th, colConfig.filter, jQuery(this), onRemove, filterTh);

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

GridTablePlain.prototype.drawBody = function (data, typeInfo, columns, cont) {
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

				self.moreVisibleHandler = onVisibilityChange(td, function(isVisible) {
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

// GridTableGroup {{{1

var GridTableGroup = function (defn, view, features, timing, id) {
	var self = this;

	features = jQuery.extend(true, {}, features);
	features.limit = false;
	features.footer = false;

	self.super = makeSuper(self, GridTable);
	self.super.init(defn, view, features, timing, id);
};

GridTableGroup.prototype = Object.create(GridTable.prototype);
GridTableGroup.prototype.constructor = GridTableGroup;

// #drawHeader {{{2

GridTableGroup.prototype.drawHeader = function (columns, data, typeInfo) {
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

	_.each(columns, function (field, colIndex) {
		var colConfig = getPropDef({}, self.defn, 'table', 'columns', colIndex)

		if (data.groupFields.indexOf(field) >= 0) {
			return;
		}

		headingSpan = jQuery('<span>')
			.attr('data-wcdv-field', field)
			.text(field)
			.draggable({
				classes: {
					'ui-draggable-handle': 'wcdv_drag_handle'
				},
				distance: 8, // FIXME Deprecated [1.12]: replacement will be in 1.13
				helper: 'clone',
				revert: true,
				revertDuration: 0
			});

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

GridTableGroup.prototype.drawBody = function (data, typeInfo, columns, cont) {
	var self = this;

	if (!data.isGroup) {
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

		_.each(data.rowVals[groupNum], function (colVal, colIdx) {
			var attrs = {};

			if (colIdx === data.groupFields.length - 1) {
				attrs.colspan = columns.length - data.groupFields.length + 1;
			}

			jQuery('<th>', attrs).text(colVal).appendTo(tr);
		});

		self.ui.tr.push(tr);
		self.ui.tbody.append(tr);

		_.each(rowGroup, function (row, rowNum) {
			tr = jQuery('<tr>', {id: self.defn.table.id + '_' + rowNum});
			tr.append(jQuery('<td>', { colspan: data.groupFields.length }));

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
				else {
					td.text(value);
				}

				self.setCss(td, field);
				self.setAlignment(td, colConfig, typeInfo, field);

				tr.append(td);
			});

			self.ui.tr.push(tr);
			self.ui.tbody.append(tr);
		});
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
			self.fire(GridTable.events.unableToRender, ops);
			return;
		}

		debug.info('GRID TABLE - GROUP // HANDLER (View.workEnd)', 'Redrawing because the view has done work');
		self.clear();
		self.draw(self.root);
	}, { who: self });
};

// GridTablePivot {{{1

var GridTablePivot = function (defn, view, features, timing, id) {
	var self = this;

	features = jQuery.extend(true, {}, features);
	features.limit = false;
	features.footer = false;

	self.super = makeSuper(self, GridTable);
	self.super.init(defn, view, features, timing, id);
};

GridTablePivot.prototype = Object.create(GridTable.prototype);
GridTablePivot.prototype.constructor = GridTablePivot;

// #drawHeader {{{2

GridTablePivot.prototype.drawHeader = function (columns, data, typeInfo) {
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

// #drawBody {{{2

GridTablePivot.prototype.drawBody = function (data, typeInfo, columns, cont, opts) {
	var self = this;

	opts = opts || {};
	opts.pivotConfig = opts.pivotConfig || {};

	if (!data.isGroup) {
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
			var colConfig = opts.pivotConfig.aggField ? self.colConfig[opts.pivotConfig.aggField] : {};
			var colTypeInfo = opts.pivotConfig.aggField ? typeInfo.get(opts.pivotConfig.aggField) : {};

			var agg = AGGREGATES[opts.pivotConfig.aggFun || 'count'];
			var aggFun = agg.fun({field: opts.pivotConfig.aggField, type: colTypeInfo.type, colConfig: colConfig});
			var aggType = agg.type;
			var aggResult = format(colConfig, colTypeInfo, aggFun(colGroup), {
				alwaysFormat: true,
				overrideType: aggType
			});
			var td = jQuery('<td>').text(aggResult);
			// REMOVED: How do we let the user set sizes &c. when doing a pivot table?
			// self.setCss(td, col);
			td.appendTo(tr);
		});

		self.ui.tr.push(tr);
		self.ui.tbody.append(tr);
	});

	if (typeof cont === 'function') {
		return cont();
	}
};

