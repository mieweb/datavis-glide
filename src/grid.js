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
				var sqlType = defn._typeInfo[srcIndex].byName[colName];
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

	// jQWidgets Grid Column Groups {{{1

	/**
	 * Handle setting the column groups for data that hasn't been auto-grouped.
	 *
	 * @param {object} gridConfig An object produced by the convertDataFromStrings() function above,
	 * which contains grid column configuration data.
	 *
	 * @returns {array} An array that can be used for the grid's [columngroups] property.  Modifies
	 * the [columns] property of the `gridConfig` parameter in place.
	 */

	function makeColumnGroups(defn, gridConfig) {
		var columngroups = [];

		function walk(node, path) {
			if (_.isString(node)) {
				node = {
					dataColumn: node
				};
			}
			if (_.isUndefined(node.children)) {
				if (_.isUndefined(node.dataColumn)) {
					throw defn.error('[table.columnGroups] leaf [dataColumn] property is missing');
				}

				if (!_.isString(node.dataColumn)) {
					throw defn.error('[table.columnGroups] leaf [dataColumn] property must be a string');
				}

				if (!gridConfig.columnsByName[node.dataColumn]) {
					throw defn.error('[table.columnGroups] leaf "' + node.dataColumn + '" refers to non-existent data column');
				}

				gridConfig.columnsByName[node.dataColumn].columnGroup = path[path.length - 1];

				if (!_.isUndefined(node.displayText)) {
					if (!_.isString(node.displayText)) {
						throw defn.error('[table.columnGroups] leaf "' + node.dataColumn + '" [displayText] must be a string');
					}
					gridConfig.columnsByName[node.dataColumn].text = node.displayText;
				}
			}
			else if (!_.isArray(node.children)) {
				throw defn.error('[table.columnGroups] non-leaf [child] property must be an array');
			}
			else {
				var newPath;
				var cgObj;

				/*
				 * For now, there's no real difference between [name] and [displayText] other than
				 * whatever meaning the user is trying to convey when only one of the two fields is
				 * present (either not caring about what something is called internally, or not
				 * caring about how it's shown).
				 */

				if (_.isUndefined(node.name) && _.isUndefined(node.displayText)) {
					throw defn.error('[table.columnGroups] must have either [name] or [displayText]');
				}

				node.name = node.name || node.displayText;
				node.displayText = node.displayText || node.name;
				newPath = path.slice();
				cgObj = {
					text: node.displayText,
					align: 'center',
					name: node.name
				};

				if (path.length > 0) {
					cgObj.parentgroup = path[path.length - 1];
				}

				columngroups.push(cgObj);

				newPath.push(node.name);
				_.each(node.children, function (c) {
					walk(c, newPath);
				});
			}
		}

		_.each(defn.table.columnGroups, function (colGroup) {
			walk(colGroup, []);
		});

		return columngroups;
	}


	// jQWidgets Grid Grouping {{{1
	/**
	 * Make a groups rendering function using the supplied headerline configuration.
	 *
	 * @param object hl Headerline configuration object.  See the documentation for full details of
	 * what this should contain.
	 *
	 * @returns function A function that can be used for the groupsrenderer property of the jQWidgets
	 * grid constructor.
	 */
	function makeGroupsRendererFn(hl) {
		return function (text, group, expanded, data) {
			var grid = this;
			var theme;
			var getAggregateResults;
			var separator;

			function toThemeProperty(className) {
				if (!_.isUndefined(theme) && theme !== null) {
					return className + ' ' + className + '-' + theme;
				}
				else {
					return className;
				}
			}
			if (hl.useGridAggregates) {
				getAggregateResults = function (col, fun, data) {
					return grid.getcolumnaggregateddata(col, fun, true, data);
				};
			}
			else {
				getAggregateResults = function (col, fun, data, extra) {
					var results = {};
					_.each(fun, function (f) {
						results[f] = Aggregates[f].fun(_.defaults({
							field: col
						}, extra))(data);
					});
					return results;
				};
			}
			// We're going to use the jQWidgets Grid to calculate all the aggregate functions.
			// This was old functionality that we had before had got all the nice custom
			// aggregates, so we leave it around but can toggle it on/off using the variable.
			var hlIndex = null;
			var i;
			for (i = 0; i < hl.config.length; i += 1) {
				if (hl.config[i].groupBy === data.groupcolumn.datafield) {
					hlIndex = i;
					break;
				}
			}
			text = data.groupcolumn.text + ': ' + group;
			var hlConfig;
			// Make sure we always get the count somehow... either by straight up asking for it
			// ourselves (when the user didn't specify any aggregates), or by adding it to
			// whatever the user requested.
			if (hlIndex === null) {
				hlConfig = [{
					col: data.groupcolumn.datafield,
					fun: ['count']
				}];
				separator = '; ';
			}
			else {
				hlConfig = _.clone(hl.config[hlIndex].aggregates);
				hlConfig.push({
					col: data.groupcolumn.datafield,
					fun: ['count']
				});
				separator = isNothing(hl.config[hlIndex].separator) ? '; ' : hl.config[hlIndex].separator;
			}
			var count = null;
			var aggregates = [];
			_.each(hlConfig, function (elt) {
				var aggregate;
				if (data.subItems.length > 0) {
					aggregate = getAggregateResults(elt.col, elt.fun, data.subItems, elt);
				}
				else {
					var rows = [];

					var getRows = function(group, rows) {
						if (group.subGroups.length > 0) {
							_.each(group.subGroups, function (subGroup) {
								getRows(subGroup, rows);
							});
						}
						else {
							_.each(group.subItems, function (subItem) {
								rows.push(subItem);
							});
						}
					};

					getRows(data, rows);
					aggregate = getAggregateResults(elt.col, elt.fun, rows, elt);
				}
				_.each(elt.fun, function (fun) {
					if (fun === 'count') {
						count = aggregate.count;
					}
					else {
						aggregates.push({
							col: elt.col,
							fun: fun,
							agg: aggregate[fun],
							displayText: elt.displayText
						});
					}
				});
			});
			var html = '<div class="' + toThemeProperty('jqx-grid-groups-row') + '" style="position: absolute;">';
			html += '<span>' + text + '</span>';
			html += '<span class="' + toThemeProperty('jqx-grid-groups-row-details') + '"> — ';
			_.each(aggregates, function (elt) {
				html += separator + (isNothing(elt.displayText) ? elt.fun + '(' + elt.col + ') = ' : elt.displayText) + elt.agg;
			});
			if (count !== null) {
				html += (aggregates.length > 0 ? ' — ' : '') + count + ' row(s)';
			}
			html += '</span></div>';
			return html;
		};
	}
	/**
	 * Creates a function suitable for use as the 'groupsrenderer' property of a grid.
	 */
	function makeGroupsRenderer(defn, srcIndex, gridConfig) {
		var hl = defn.table.grouping.headerLine;
		if (_.isArray(hl)) {
			defn.table.grouping.headerLine = {
				config: hl
			};
			hl = defn.table.grouping.headerLine;
		}
		else if (hl === '<AUTO//NUMBER>') {
			// Using the string <AUTO//NUMBER> is a shortcut for saying that all numeric columns
			// should show the sum and average.  Thus, we turn that into:
			//
			// [ { groupBy: 'A', fun: ['sum', 'avg'] },
			//   { groupBy: 'B', fun: ['sum', 'avg'] }, ... ]
			//
			// Where A, B, ... are all columns with numeric types.
			var newHeaderLine = [];
			var newHeaderLineConfig = [];
			_.each(defn._typeInfo[srcIndex].byIndex, function (elt) {
				if (elt.type === 'number' && gridConfig.columnsByName[elt.name]) {
					newHeaderLineConfig.push({
						col: elt.name,
						fun: ['sum', 'avg']
					});
				}
			});
			_.each(defn._typeInfo[srcIndex].byIndex, function (elt) {
				newHeaderLine.push({
					groupBy: elt.name,
					aggregates: newHeaderLineConfig
				});
			});
			defn.table.grouping.headerLine = {
				config: newHeaderLine
			};
			hl = defn.table.grouping.headerLine;
		}
		if (!_.isObject(hl)) {
			throw defn.error('headerLine: must be an object, an array, or the string "<AUTO//NUMBER>"');
		}
		if (_.isUndefined(hl.useGridAggregates)) {
			hl.useGridAggregates = true;
		}
		if (_.isUndefined(hl.config)) {
			throw defn.error('headerLine: missing [config]');
		}
		_.each(hl.config, function (hlConfig, hlIndex) {
			if (_.isUndefined(hlConfig.aggregates)) {
				if (_.isUndefined(hlConfig.fun)) {
					throw defn.error('headerLine.config[' + hlIndex + ']: missing [fun] in absence of [aggregates]');
				}
				if (_.isString(hlConfig.fun)) {
					hlConfig.fun = [hlConfig.fun];
				}
				if (!_.isArray(hlConfig.fun)) {
					throw defn.error('headerLine.config[' + hlIndex + ']: property [fun] must be a string or array of strings');
				}
				hlConfig.aggregates = [{
					fun: hlConfig.fun,
					col: hlConfig.groupBy
				}];
				delete hlConfig.fun;
			}
			else {
				hlConfig.aggregates = _.map(hlConfig.aggregates, function (agg) {
					if (_.isString(agg.fun)) {
						agg.fun = [agg.fun];
					}
					if (!_.isArray(agg.fun)) {
						throw defn.error('headerLine.config[' + hlIndex + ']: property [aggregates.fun] must be a string or array of strings');
					}
					return agg;
				});
			}
		});
		return makeGroupsRendererFn(hl);
	}

	// jQWidgets Grid Configuration {{{1

	function isColumnHidden(defn, colName) {
		var colHiddenProp = getProp(defn, 'table', 'columnConfig', colName, 'hidden');
		var defaultHiddenProp = getPropDef(false, defn, 'table', 'columnConfig', '_DEFAULT', 'hidden');

		if (colHiddenProp !== undefined) {
			return colHiddenProp;
		}

		return defaultHiddenProp;
	}

	/**
	 * Set whether the column should be hidden or not.
	 *
	 * @param {object} defn The grid definition.
	 * @param {number} srcIndex Which source number we're on.
	 * @param {string} dataField Name of the field from the data source we're configuring.
	 * @param {object} columnObj Configuration object for this column in the jqxGrid.
	 */

	function setColumnHidden(defn, srcIndex, dataField, columnObj) {
		columnObj.hidden = isColumnHidden(defn, dataField);
	}

	/**
	 * Set the type of the column within the grid.
	 *
	 * @param {object} defn The grid definition.
	 * @param {number} srcIndex Which source number we're on.
	 * @param {string} dataField Name of the field from the data source we're configuring.
	 * @param {object} columnObj Configuration object for this column in the jqxGrid.
	 */

	function setColumnType(defn, srcIndex, dataField, columnObj) {
		var widget = getProp(defn, 'table', 'columnConfig', dataField, 'widget');
		var userType = getProp(defn, 'table', 'columnConfig', dataField, 'type');

		if (widget !== undefined) {
			// User told us what kind of widget they want to use.
			columnObj.columntype = widget;
		}
		else if (userType === 'bool') {
			// This is the only kind of widget that makes sense for boolean data.
			columnObj.columntype = 'checkbox';
		}
		else {
			// Use something reasonable based on the type.
			switch (getProp(defn, '_typeInfo', srcIndex, 'byName', dataField)) {
			case 'number':
				columnObj.columntype = 'numberinput';
				break;
			case 'date':
			case 'datetime':
			case 'time':
				columnObj.columntype = 'datetimeinput';
				break;
			case 'string':
			default:
				columnObj.columntype = 'textbox';
			}
		}
	}

	/**
	 * Set appropriate properties on the column to adjust the formatting of the data.  We're mostly
	 * interested in cellsformat (used for numbers, currency, dates) and cellsrenderer (used by us to
	 * build links).
	 *
	 * @param {object} defn The grid definition.
	 * @param {number} srcIndex Which source number we're on.
	 * @param {string} dataField Name of the field from the data source we're configuring.
	 * @param {object} columnObj Configuration object for this column in the jqxGrid.
	 */

	function setColumnFormat(defn, srcIndex, dataField, columnObj) {
		var example = getProp(defn, '_data', srcIndex, 0, dataField);
		var type = getPropDef('string', defn, '_typeInfo', srcIndex, 'byName', dataField);
		var forceType = null;

		if (getProp(defn, 'table', 'columnConfig', dataField, 'type')) {
			forceType = defn.table.columnConfig[dataField].type;
		}

		// Anything coming from the server as a string might be a link, so use the cell renderer that
		// would make it into a link.

		if (type === 'string') {
			columnObj.cellsrenderer = makeCellRenderer(defn);
		}

		if (forceType === null) {
			if (type === 'string' && example !== undefined) {
				// Try to guess the format based on the example value.
				if (isInt(example)) {
					columnObj.cellsformat = 'n';
				}
				else if (isFloat(example)) {
					columnObj.cellsformat = 'f';
				}
			}
		}
		else {
			type = forceType;
		}

		// Set the formatting string accordingly, depending on whether the user wants to see just the
		// date or the full date-with-time.

		if (type === 'date') {
			columnObj.cellsformat = dateFormatString;
		}
		else if (type === 'datetime') {
			columnObj.cellsformat = dateFormatString + ' ' + timeFormatString;
		}
	}

	/**
	 * Set other properties of the column.  This is called last so that anything directly specified by
	 * the user will override the "smarter" choices we may have made earlier.
	 */

	function setColumnOther(defn, srcIndex, dataField, columnObj) {
		var map = {
			'pinned': 'pinned',
			'width': 'width',
			'minWidth': 'minwidth',
			'maxWidth': 'maxwidth',
			'cellAlignment': 'cellsalign',
			'headerAlignment': 'align',
			'resizable': 'resizable',
			'movable': 'draggable',
			'editable': 'editable',
			'format': 'cellsformat'
		};

		_.each(map, function (jqxProp, ourProp) {
			var p = getProp(defn, 'table', 'columnConfig', dataField, ourProp);
			if (p === undefined) {
				p = getProp(defn, 'table', 'columnConfig', '_DEFAULT', ourProp);
			}
			if (p !== undefined) {
				columnObj[jqxProp] = p;
			}
		});
	}

	/**
	 * Set filter configuration on the columns.
	 *
	 * @param {object} defn The grid definition.
	 * @param {number} srcIndex Which source number we're on.
	 * @param {string} dataField Name of the field from the data source we're configuring.
	 * @param {object} columnObj Configuration object for this column in the jqxGrid.
	 */

	function setColumnFilter(defn, srcIndex, dataField, columnObj) {
		var type = getProp(defn, '_typeInfo', srcIndex, 'byName', dataField);
		var data;
		var userFilterConfig;

		// Allow the user to override the data source's type for the field.  For example, a system
		// report may produce an integer, but we may know that it's either 0 or 1, so we want to treat
		// it like a Boolean value instead.

		if (getProp(defn, 'table', 'columnConfig', dataField, 'type')) {
			type = defn.table.columnConfig[dataField].type;
		}

		// Automatically use a checkbox for the filter when the column represents a Boolean value.

		if (type === 'bool') {
			columnObj.filtertype = 'bool'; // [2016-01-06] Documentation says it should be "checkbox" but that doesn't work.
		}

		else if (type === 'string') {
			if (getProp(defn, 'table', 'filters', dataField) || getProp(defn.table, 'columnConfig', dataField, 'filter')) {
				userFilterConfig = getProp(defn.table, 'columnConfig', dataField, 'filter') || getProp(defn, 'table', 'filters', dataField);
				if (_.isString(userFilterConfig)) {
					userFilterConfig = {
						widget: userFilterConfig
					};
				}
				if (userFilterConfig.splitAt) {
					data = _.pluck(defn._data[srcIndex], dataField);

					// When using a checkedlist, we observed marked speed improvements when setting the items
					// to show in the list ourselves, even if it comes out to be exactly the same thing as the
					// jqxGrid would have found on its own.

					columnObj.filtertype = 'checkedlist';
					columnObj.filteritems = _.uniq(data.join(userFilterConfig.splitAt).split(userFilterConfig.splitAt).sort(), true);

					if (defn.table.filterRow) {
						columnObj.createfilterwidget = function (column, columnElement, widget) {
							window.setTimeout(function () {
								widget.off('close');
								var checkedAtOpen = [];
								widget.on('open', function () {
									checkedAtOpen = _.pluck(widget.jqxDropDownList('getCheckedItems'), 'value');
								});
								widget.on('close', function () {
									var grid = $(document.getElementById(defn.table.id)).children('.jqx-grid');
									var filterGroup = new $.jqx.filter();
									var checkedItems = _.pluck(widget.jqxDropDownList('getCheckedItems'), 'value');
									if (arrayCompare(checkedAtOpen, checkedItems)) {
										// Nothing was changed, so there's no need to mess with filters.
										return;
									}
									if (checkedItems.length === widget.jqxDropDownList('getItems').length) {
										// They selected all the items, so we just remove the filter.
										grid.jqxGrid('removefilter', dataField);
										return;
									}
									_.each(checkedItems, function (checkedItem) {
										if (checkedItem === '') {
											filterGroup.addfilter(1, filterGroup.createfilter('stringfilter', checkedItem, 'EQUAL'));
										}
										else {
											filterGroup.addfilter(1, filterGroup.createfilter('stringfilter', checkedItem, 'CONTAINS'));
										}
									});
									grid.jqxGrid('removefilter', dataField);
									grid.jqxGrid('addfilter', dataField, filterGroup);
									grid.jqxGrid('applyfilters');
									_.each(checkedItems, function (checkedItem) {
										widget.jqxDropDownList('checkItem', checkedItem);
									});
								});
							});
						};
					}
				}
				else if (userFilterConfig.widget) {

					// It would be nice if this worked, but for whatever reason the filter list boxes don't
					// work correctly when you have the search text box.  When a regular list box, it selects
					// based on the index (searching and picking the first item actually filters according to
					// the first item in the list).  When a checked list box, it doesn't let you check the box
					// for an item you've searched for.  (jQWidgets 3.8.0)

					/*
					if (userFilterConfig.widget.type === 'checkedlist' || userFilterConfig.widget.type === 'list') {
						if (userFilterConfig.widget.searchable) {
							columnObj.createfilterwidget = function (column, columnElement, widget) {
								widget.jqxDropDownList({'filterable': true});
							};
						}
					}
					*/
					if (_.isString(userFilterConfig.widget)) {
						columnObj.filtertype = userFilterConfig.widget;
					}
					else if (_.isObject(userFilterConfig.widget) && _.isString(userFilterConfig.widget.type)) {
						columnObj.filtertype = userFilterConfig.widget.type;
					}
				}
			}
			else {

				// The user didn't specify what filter widget they want to use, so we will try to pick it
				// for them.  If there are only 20 different things to choose from, make a checked list (in
				// Excel style) for the filter.  Otherwise, make it a free text input.

				if (defn.table.filterRow) {
					columnObj.filtertype = 'input';
				}
				else {
					columnObj.filtertype = 'textbox';
				}

				if (!getProp(defn, 'server', 'filter')) {

					// If there are 20 or fewer distinct data values, use a checkedlist by default.  When
					// there are more than 20, the list gets too unwieldy.  This is only when we're not doing
					// dynamic server-side filtering, because if we are... then we don't know how many
					// distinct data values there are!
					//
					// When using a checkedlist, we observed marked speed improvements when setting the items
					// to show in the list ourselves, even if it comes out to be exactly the same thing as the
					// jqxGrid would have found on its own.

					var uniqElts = _.uniq(_.map(_.pluck(defn._data[srcIndex], dataField), stripLinkCode));
					if (uniqElts.length <= 20) {
						columnObj.filtertype = 'checkedlist';
						columnObj.filteritems = uniqElts.sort();
					}
				}
			}
		}
		else if (type === 'date' || type === 'datetime') {
			// BUG [jQWidgets 4.2.1] The "range" filter type is buggy. #52004
//	  if (defn.table.filterRow) {
//		columnObj.filtertype = 'range';
//	  }
//	  else {
				columnObj.filtertype = 'date';
//	  }
		}
		else if (type === 'number' && defn.table.filterRow) {
			columnObj.filtertype = 'number';
		}
	}

	/**
	 * Set an appropriate editing widget for the column.
	 *
	 * MAY SET THE COLUMNTYPE PROPERTY ON THE COLUMN OBJECT.  This is because using a dropdown list
	 * for the editor requires setting the column type to allow it.  For this reason, it needs to be
	 * called after setColumnType().
	 */

	function setColumnEditor(defn, srcIndex, dataField, columnObj) {
		var type = getProp(defn, '_typeInfo', srcIndex, 'internal', dataField)
			, enumSetRegexp = new RegExp("^(enum|set)\\('([^)]+)'\\)$")
			, matchData
			, enumSetItems;

		if (type === undefined) {
			return;
		}

		debug.info('EDITING // CONFIGURE COLUMN', 'DataField =', dataField, '; Type =', type);

		matchData = enumSetRegexp.exec(type);
		if (matchData !== null) {
			enumSetItems = matchData[2].split("','");
			columnObj.columntype = 'dropdownlist';
			columnObj.createeditor = function (row, col, editor) {
				editor.jqxDropDownList({
					autoDropDownHeight: true,
					source: enumSetItems
				});
			};
		}
	}

	function preprocessShowHideColumns(defn) {
		if (isNothing(defn.table.showColumns) && isNothing(defn.table.hideColumns)) {
			return;
		}

		deprecated(defn, 'Usage of [showColumns] and [hideColumns] is deprecated.', 'Showing_.26_Hiding_Columns');

		if (isNothing(defn.table.columnConfig)) {
			defn.table.columnConfig = {};
		}

		var show = defn.table.showColumns;
		var hide = defn.table.hideColumns;

		// You can't explicitly show some columns and hide some others.  What do you expect us to do
		// with the ones you didn't mention?  So if you tell us to show some columns, we hide the rest.
		// And if you tell us to hide some columns, we show the rest.  Explicit showing takes priority,
		// as that's the more common use case.

		if (!isNothing(show) && ((_.isArray(show) && show.length > 0) || (_.isString(show) && show !== '*'))) {
			defn.table.hideColumns = '*';
		}
		else if (!isNothing(hide) && ((_.isArray(hide) && hide.length > 0) || (_.isString(hide) && hide !== '*'))) {
			defn.table.showColumns = '*';
		}

		function f(x, y) {
			if (_.isString(defn.table[x])) {
				if (defn.table[x] === '*') {
					if (!defn.table.columnConfig._DEFAULT) {
						defn.table.columnConfig._DEFAULT = {};
					}
					defn.table.columnConfig._DEFAULT.hidden = y;
				}
				else {
					throw new InvalidReportDefinitionError('table.' + x, defn.table[x], 'must either be an array or the string "*"');
				}
			}
			else if (_.isArray(defn.table[x])) {
				_.each(defn.table[x], function (col) {
					if (defn.table.columnConfig[col] === undefined) {
						defn.table.columnConfig[col] = {};
					}
					if (defn.table.columnConfig[col].hidden === undefined) {
						defn.table.columnConfig[col].hidden = y;
					}
				});
			}
			else {
				throw new InvalidReportDefinitionError('table.' + x, defn.table[x], 'must either be an array or the string "*"');
			}
		}
		f('showColumns', false);
		f('hideColumns', true);
	}

	/**
	 * Take the data from all sources and try to determine what columns are available and what
	 * their types are.  This matters especially for grids because of the sorting abilities.
	 *
	 * @param array columns An array of all the column names.
	 *
	 * @returns object The column configuration object for a jQWidgets grid.
	 */

	function makeGridConfig(defn, data, columns, srcIndex) {
		var dataFieldConfig = {
			byIndex: [],
			byName: {}
		};

		var columnConfig = {
			byIndex: [],
			byName: {}
		};

		defn._dataFieldConfig = dataFieldConfig;

		// Convert the older [showColumns] and [hideColumns] properties into the newer [columnConfig]
		// property sub-objects.  After we phase out the older approach, we can remove this.

		preprocessShowHideColumns(defn);

		_.each(columns, function (datafield) {
			var text = datafield;
			var newColumnConfig;

			if (defn.dataSeries === 'multiple' && defn._dataColsBySource[datafield]) {

				// The datafield is a sourced column name, so we need to get the abstract column name to use
				// as the text. Otherwise we'd end up showing a column in the table called ":0:VisitType."

				text = defn._dataColsBySource[datafield].originalName;
			}

			// Configure the grid columns here.  If the SQL column starts with an underscore, we don't
			// make a grid column for it.

			if (datafield.charAt(0) !== '_') {
				newColumnConfig = {
					text: text,
					datafield: datafield
				};

				setColumnHidden(defn, srcIndex, datafield, newColumnConfig); // Set whether columns are shown or hidden.
				setColumnType(defn, srcIndex, datafield, newColumnConfig);   // Set the data type.
				setColumnFormat(defn, srcIndex, datafield, newColumnConfig); // Set the output widget or formatting.
				setColumnFilter(defn, srcIndex, datafield, newColumnConfig); // Set the filter type.
				setColumnEditor(defn, srcIndex, datafield, newColumnConfig); // Set the editor.
				setColumnOther(defn, srcIndex, datafield, newColumnConfig);  // Set any other options from the user.

				columnConfig.byIndex.push(newColumnConfig);
				columnConfig.byName[datafield] = newColumnConfig;
			}

			var newDataFieldConfig = {
				name: datafield
			};

			dataFieldConfig.byIndex.push(newDataFieldConfig);
			dataFieldConfig.byName[datafield] = newDataFieldConfig;
		});

		// Try to guess the data types of some of the data. By default everything is treated as a
		// string, which screws up sorting. Since we don't yet have the server-side infrastructure to
		// indicate the types of the columns in the result set, we have to use some heuristics to
		// determine what types are being used.

		_.each(columnConfig.byIndex, function (columnConfigElt) {
			var colName = columnConfigElt.datafield;
			var sample = getProp(data, srcIndex, 0, colName); // Used to guess column info based on example value.
			var sqlType = getProp(defn, '_typeInfo', srcIndex, 'byName', colName);
			var forceType = null;
			var dataFieldConfigElt = dataFieldConfig.byName[colName];

			if (getProp(defn, 'table', 'columnConfig', colName, 'type') !== undefined) {
				forceType = defn.table.columnConfig[colName].type;
			}

			// Allow the column name to be different from the field that it comes from in the data source
			// (e.g. result set column from a system report or property from the JSON API).

			if (getProp(defn, 'table', 'columnConfig', colName, 'displayText') !== undefined) {
				// The user has overridden the name through the layout tag.
				columnConfigElt.text = getProp(defn, 'table', 'columnConfig', colName, 'displayText');
			}
			else if (getProp(defn, '_displayName', srcIndex, colName) !== undefined) {
				// The name is coming from the data source somehow (e.g. labels in the model when using the
				// JSON API to access a table directly [resource db/*]).
				columnConfigElt.text = getProp(defn, '_displayName', srcIndex, colName);
			}

			if (sqlType === 'string') {

				// Even though the "string" data field type is the default, if we don't explicitly set it
				// here, we trigger a bug in jQWidgets where it changes the filter type of a column from a
				// text filter to a date filter.

				dataFieldConfigElt.type = 'string';
				makeLinkConfig(data[srcIndex], colName, dataFieldConfig);
			}

			// concatLog.info('Column =', colName, '; SQL Type =', sqlType, '; Forced Type =', forcedType, '; Sample =', valueInfo(sample));

			if (forceType !== null) {
				dataFieldConfigElt.type = forceType;
			}
			else if (sqlType === 'number' || _.isNumber(sample)) {
				dataFieldConfigElt.type = 'number';
			}
			else if (sqlType === 'datetime' || sqlType === 'date') {
				dataFieldConfigElt.type = 'date';
			}
		});

		return {
			datafields: dataFieldConfig.byIndex,
			columns: columnConfig.byIndex,
			columnsByName: columnConfig.byName
		};
	}

	/**
	 * Configure the jqxGrid for deferred scrolling, given the information in the column configuration
	 * object.
	 *
	 * @param {object} defn The grid definition.
	 *
	 * @param {object} tableConfig The jqxGrid configuration object, which we will update to configure
	 * deferred scrolling.
	 */

	function configureDeferredScrolling(defn, tableConfig) {
		var colConfig = getProp(defn, 'table', 'columnConfig');
		var deferredColumns = [];
		if (colConfig !== undefined) {
			_.each(colConfig, function (config, colName) {
				if (colName === '_DEFAULT') {
					return;
				}
				if (config.deferredTooltipIndex !== undefined) {
					deferredColumns[config.deferredTooltipIndex] = colName;
				}
			});
		}
		if (deferredColumns.length > 0) {
			tableConfig.deferreddatafields = deferredColumns;
			tableConfig.scrollmode = 'deferred';
		}
	}


	// jQWidgets Grid Editing {{{1

	/**
	 * The following definition properties are used:
	 *
	 *   - table / editing / resource = What JSON API resource to call.
	 *   - table / editing / keyCol   = What column contains the key.
	 *
	 * @param {string} key The key used to identify the row (e.g. pat_id).
	 * @param {string} valCol The column whose value was changed.
	 * @param {string} val The new value for that column.
	 */

	function performEdit_jsonApi(defn, grid, key, valCol, val, oldVal) {
		var req = {};

		req[getProp(defn, 'table', 'editing', 'keyCol')] = key;
		req[valCol] = val;

		mieapi.post(getProp(defn, 'table', 'editing', 'resource'), req, function (res) {
			if (res.meta.status !== '200') {
				// Find a way to reset the value to oldVal.
			}
		});
	};

	function performDelete_jsonApi(grid, resource, keyCol, key, flagCol, flag, row) {
		debug.info('EDIT', 'Deleting row:', row);
		var x = {};
		x[keyCol] = key;
		x[flagCol] = flag;
		mieapi.post(resource, x, function (res) {
			if (res.meta.status !== '200') {
				// It doesn't really matter, we can't do anything.
			}
			grid.refresh();
		});
	}

	function addEditConfig(defn, colConfig) {
		var delConfig = getProp(defn, 'table', 'editing', 'deleting');
		var delEnabled = true;

		// Make sure all the necessary configuration is provided.

		if (isNothing(delConfig) || isNothing(delConfig.keyCol) || isNothing(delConfig.resource)) {
			delEnabled = false;
		}
		else if (delConfig.keyCol && defn._data[0][0][delConfig.keyCol] === undefined) {
			log.error('Deleting will not be possible because definition references non-existent key column "' + delConfig.keyCol + '"');
			delEnabled = false;
		}
		else if (delConfig.flagCol && defn._data[0][0][delConfig.flagCol] === undefined) {
			log.error('Deleting will not be possible because definition references non-existent flag column "' + delConfig.flagCol + '"');
			delEnabled = false;
		}

		// We need to use the following parts of the jQWidgets Grid API:
		//
		//   - columns[].createeditor(row, cellvalue, editor, celltext, cellwidth, cellheight)
		//   - columns[].createeverpresentrowwidget(datafield, htmlElement, popup, addRowCallback)
		//
		//   - columns[].cellbeginedit(row, datafield, columntype)
		//   - columns[].cellendedit(row, datafield, columntype, oldvalue, newvalue)
		//
		// We also need to add the last column which will be for the "delete" button.  This is a fake
		// column which isn't bound to any actual datafield, and we will use the cellsrenderer to make
		// the buttons inside it.
		// Add a column that's just for the "edit" and "delete" buttons.
		if (delEnabled) {
		colConfig.push({
			text: 'Options',
			columntype: 'template',
			editable: true,
			cellsrenderer: function (row, columnfield, value, defaulthtml, columproperties, rowdata) {
				var delSpan = '';
				var grid = "window.wcgrid['" + defn.id + "']";
				var onClickFn = grid + ".grid.jqxGrid('beginrowedit', " + row + ")";
				var editSpan = '<span class="fa link" onclick="' + onClickFn + '">' + String.fromCharCode(parseInt('F040', 16)) + '</span>';
				if (delConfig) {
					var commitFn = 'window.wcgraph.performDelete_jsonApi';
					var isDeleted = delConfig.flagCol && delConfig.flagVal.deleted && rowdata[delConfig.flagCol] == delConfig.flagVal.deleted;
					onClickFn = commitFn + "(" + grid + ", '" + getProp(defn, 'table', 'editing', 'deleting', 'resource') + "', '" + delConfig.keyCol + "', '" + rowdata[delConfig.keyCol] + "', '" + delConfig.flagCol + "', '" + (isDeleted ? delConfig.flagVal.normal : delConfig.flagVal.deleted) + "', " + row + ")";
					delSpan = ' <span class="fa link" onclick="' + onClickFn + '">' + String.fromCharCode(parseInt(isDeleted ? 'F1DA' : 'F014', 16)) + '</span>';
				}
				return '<div style="margin: 4px">' /* + editSpan */ + delSpan + '</div>';
			}
			/*
			createeditor: function (row, column, editor) {
				var grid = this;
				jQuery('<div>')
					.css('margin', '4px')
					.append(jQuery(fontAwesome('F0C7')).click(function () {
						grid.jqxGrid('endrowedit', row);
					}))
					.append(' ')
					.append(jQuery(fontAwesome('F05E')).click(function () {
						grid.jqxGrid('endrowedit', row, true);
					}))
					.appendTo(editor);
			}
			*/
		});
		}
	}

// Grid {{{1
// Errors {{{2
// GridError {{{3

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

/**
 * @class GridTable
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

// GridTableError {{{2

/**
 *
 */

function GridTableError() {
}

GridTableError.prototype = Object.create(Error.prototype);
GridTableError.prototype.constructor = GridTableError;

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

GridTable.prototype.clear = function () {
	var self = this;

	self.container.children().remove();
};

// #draw {{{2

GridTable.prototype.draw = function (container, tableDone) {
	var self = this;

	self.container = container;

	return self.dataView.getData(function (data) {
		return self.dataView.getTypeInfo(function (typeInfo) {
			debug.info('GRIDTABLE', 'Data = %O', data);
			debug.info('GRIDTABLE', 'TypeInfo = %O', typeInfo.byName);

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

	var columns = [];

	// Error checking {{{4

	if (self.defn.table.columns !== undefined) {
		if (!(self.defn.table.columns instanceof Array)) {
			throw self.defn.error('[table.columns] must be an array');
		}
		_.each(self.defn.table.columns, function (elt, i) {
			if (typeof elt !== 'string') {
				throw self.defn.error('[table.columns] element #' + i + ' is not a string');
			}
			if (elt !== '_DEFAULT' && data.data[0] !== undefined && data.data[0]['rowData'][elt] === undefined) {
				emailWarning(self.defn, 'Configuration for column "' + elt + '" refers to something not present in the data.  With jQWidgets output, this can result in empty columns.  Did the data source (e.g. system report) change?');
			}
		});
	}

	// }}}4

	columns = _.keys(typeInfo.byName);

	if (self.defn.table.columns !== undefined) {
		columns = _.union(_.reject(self.defn.table.columns, function (x) { return x === '_DEFAULT'; }), columns);
	}

	columns = _.reject(columns, function (colName) {
		return colName.charAt(0) === '_' || isColumnHidden(self.defn, colName);
	});

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

		_.each(columns, function (colName, colIndex) {
			if (self.features.rowSelection) {
				colIndex += 1; // Add a column for the row selection checkbox.
			}

			var headingSpan = jQuery('<span>').text(colName);

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
			}

			// Filtering {{{4

			if (self.features.filtering) {
				// Add a TH to the TR that will contain the filters.  Every filter will actually be a DIV
				// inside this TH.

				var filterTh = jQuery('<th>').css(filterThCss);
				self.setCss(filterTh, colName);
				filterTr.append(filterTh);

				// Create the button that will add the filter to the grid, and stick it onto the end of
				// the column heading TH.

				jQuery(fontAwesome('F0B0', null, 'Click to add a filter on this column'))
					.css({'cursor': 'pointer', 'margin-left': '0.5ex'})
					.on('click', function () {
						self.defn.gridFilterSet.add(colName, filterTh, self.getColConfig(colName, 'filter'), jQuery(this));
					})
					.appendTo(headingTh);
			}

			// }}}4

			self.setCss(headingTh, colName);
			self.ui.thMap[colName] = headingTh;
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

		tr.append(_.map(columns, function (colName) {
			var td = jQuery('<td>').text(colName);
			self.setCss(td, colName);
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

		_.each(columns, function (col) {
			var td;
			var date;
			var elt;

			if (row.rowData[col] instanceof Element) {

				// This has to be a copy of the original element.  Here's why: if the element contains a
				// MySQL formatted date, we want to format that date according to the user's preference.
				// However, once we do that, it won't look like a MySQL date anymore.  So subsequent
				// "redrawings" of the same data won't be the same (they won't look like MySQL dates, so
				// they won't get parsed and have the original date attached in an attribute).

				elt = deepCopy(jQuery(row.rowData[col]));

				// When the data is a date or datetime, we parse that value into a JavaScript Date
				// object, and store it in the element.  Then we set the text of the element to the
				// value as formatted according to the user's preferences.  The Date object can be used
				// for sorting (e.g. we do this with Tablesaw using custom sort functions).

				if (self.getColConfig(col, 'type') === 'date') {
					if (dateRegexp.test(elt.text())) {
						date = new Date(elt.text());
						elt.attr('data-internal-value', date);
						elt.text(formatDate(date));
					}
					else if (dateTimeRegexp.test(elt.text())) {
						date = new Date(elt.text().replace(dateTimeRegexp, '$1T$2'));
						elt.attr('data-internal-value', date);
						elt.text(formatDate(date));
					}
				}
				else if (self.getColConfig(col, 'type') === 'datetime') {
					date = new Date(elt.text());
					elt.attr('data-internal-value', date);
					elt.text(formatDateTime(date));
				}

				td = jQuery('<td>').append(elt);
			}
			else {
				if (self.getColConfig(col, 'widget') === 'checkbox') {
					td = jQuery('<td>').append(jQuery('<i>', {
						'class': +row.rowData[col] ? 'fa fa-check-square-o' : 'fa fa-square-o',
						'data-internal-value': +row.rowData[col] ? 1 : 0
					}));
				}
				else {
					if (self.getColConfig(col, 'type') === 'date') {
						td = jQuery('<td>').text(formatDate(new Date(row.rowData[col])));
					}
					else if (self.getColConfig(col, 'type') === 'datetime') {
						td = jQuery('<td>').text(formatDateTime(new Date(row.rowData[col])));
					}
					else {
						td = jQuery('<td>').text(row.rowData[col]);
					}
				}
			}

			self.setCss(td, col);
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
		//'data-tttype': 'sticky' // XXX Just for now!
	});

	container.append(self.ui.tbl.append(self.ui.thead).append(self.ui.tfoot).append(self.ui.tbody));
};

// #drawGroupPivot {{{2

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

		columns = _.keys(typeInfo.byName);

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
		//'data-tttype': 'sticky' // XXX Just for now!
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

GridTable.prototype.getColConfig = function () {
	var self = this
		, args = Array.prototype.slice.call(arguments);

	return getProp.apply(undefined, Array.prototype.concat.call([self.defn, 'table', 'columnConfig'], args));
};

// #setColConfig {{{2

GridTable.prototype.setColConfig = function () {
	var self = this
		, args = Array.prototype.slice.call(arguments)
		, value = args.shift();

	return setProp.apply(undefined, Array.prototype.concat.call([value], [self.defn, 'table', 'columnConfig'], args));
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

// GridFilter {{{1

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

// Superclass {{{2

/**
 * Base class for all grid filter widgets.
 *
 * @memberof wcgraph_int
 * @class
 *
 * @property {number} limit If greater than zero, the maximum number of filters of this type that
 * can be created on a column at the same time.
 *
 * @property {boolean} applyImmediately If true, then the filter applies as soon as it is created,
 * using the default value of the widget (e.g. checkbox widgets apply immediately).
 */

function GridFilter(colName, filterType, filterBtn, gridFilterSet) {
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
}

GridFilter.prototype = Object.create(Object.prototype);
GridFilter.prototype.constructor = GridFilter;

// #getValue {{{3

GridFilter.prototype.getValue = function () {
	return this.input.val();
};

// #getOperator {{{3

GridFilter.prototype.getOperator = function () {
	return this.operatorDrop.val();
};

// #getId {{{3

GridFilter.prototype.getId = function () {
	return this.input.attr('id');
};

// #makeOperatorDrop {{{3

/**
 * Construct a <SELECT> that allows the user to pick the operator.
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

// StringTextboxGridFilter {{{2

StringTextboxGridFilter = function () {
	var self = this;
	var row1 = jQuery('<div>');
	var row2 = jQuery('<div>');

	GridFilter.apply(self, arguments);

	self.input = jQuery('<input type="text">').jqxInput();
	self.input.on('change', function (evt) {
		// Make sure the event came from jQWidgets.
		if (evt.args !== undefined) {
			self.gridFilterSet.update();
		}
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

StringDropdownGridFilter = function () {
};

// StringCheckedListGridFilter {{{2

StringCheckedlistGridFilter = function () {
};

// NumberTextboxGridFilter {{{2

NumberTextboxGridFilter = function () {
};

// NumberCheckboxGridFilter {{{2

NumberCheckboxGridFilter = function () {
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

// DateInputGridFilter {{{2

DateInputGridFilter = function () {
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
		, ctor
		, allowed
		, allowedIndex;

	allowed = {
		'string': [
			{ fltr: 'textbox', ctor: StringTextboxGridFilter },
			{ fltr: 'dropdown', ctor: StringDropdownGridFilter },
			{ fltr: 'checkedlist', ctor: StringCheckedlistGridFilter }
		],
		'number': [
			{ fltr: 'textbox', ctor: NumberTextboxGridFilter },
			{ fltr: 'checkbox', ctor: NumberCheckboxGridFilter }
		],
		'date': [
			{ fltr: 'input', ctor: DateInputGridFilter }
		],
		'boolean': [
			{ fltr: 'checkbox', ctor: BooleanCheckboxGridFilter }
		]
	};

	// We use a data source to get the type information, so if the grid was built without a data
	// source, this isn't going to work.

	if (!(self.defn.source instanceof DataSource)) {
		throw new GridFilterError('This can only be used with a DataSource');
	}

	colType = self.defn.source.cache.typeInfo.byName[colName];

	// Make sure that we are able to get the column type.

	if (isNothing(colType)) {
		throw new GridFilterError('Unable to determine type of column "' + colName + '"');
	}

	// Make sure that we know what kinds of filters are allowed for the column type.

	if (allowed[colType] === undefined) {
		throw new GridFilterError('Unknown type "' + colType + '" for column "' + colName + '"');
	}

	// When the user didn't request a filter type, just use the first one in the allowed list.
	// Otherwise, make sure that the filter type they asked for makes sense for the column type.

	if (isNothing(filterType)) {
		allowedIndex = 0;
	}
	else {
		allowedIndex = _.findIndex(allowed[colType], function (elt) {
			return elt.fltr === filterType;
		});

		if (allowedIndex < 0) {
			throw new GridFilterError('Invalid filter type "' + filterType + '" for type "' + colType + '" of column "' + colName + '"');
		}
	}

	filterType = allowed[colType][allowedIndex].fltr;
	ctor = allowed[colType][allowedIndex].ctor;

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
			var operator = filter.getOperator()
				, value = filter.getValue();

			if (spec[colName] === undefined) {
				spec[colName] = {};
			}

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

	// Generate Table {{{1

	/**
	 * Generate tables of data.
	 *
	 * @param object defn The report definition.
	 *
	 * @param array data Array of the data obtained by each source.
	 *
	 * @param function tableDoneCont Callback to execute when each table (one per source) is done
	 * being built.
	 *
	 * @param function allDoneCont Callback to execute when this function is finished.  It will
	 * probably be called before the tables are finished being built.
	 *
	 * @param {boolean} fromScratch If true, we're rebuilding the table with nothing already present
	 * in the table div.
	 */

	function reallyGenerateTable(defn, data, tableDoneCont, allDoneCont, fromScratch) {
		var buildTableMap = {
			jqwidgets: buildTableJqwidgets,
			pivot: buildTablePivot,
			html: buildTableHtml,
			tablesaw: buildTableTablesaw
		}
			, errmsg
			, removedColumns = {}
			, outputMethod = getProp(defn, 'table', 'output', 'method')
			, buildTableFn = buildTableMap[outputMethod]
			, numTablesBuilt = 0;

		// FIXME: Do we want to deprecate defn.table.filter?

		if (defn.table.filter && _.isArray(defn.table.filter)) {
			_.each(defn.table.filter, function (col) {
				removedColumns[col] = true;
			});
		}

		// Use the specified filter list to remove keys (columns) from the system report results; add
		// "RECORD_INDEX" (something added by the XML producer on the server) to that list.

		removedColumns['RECORD_INDEX'] = true;

		// Remove any objectionable items from the report results.

		removeColumns(defn, data, removedColumns);

		// For each source in the report definition, build a form with a button that will open up a new
		// window showing the corresponding system report with all filters already in place. If a source
		// wasn't processed (because of a failing 'continuePred') or didn't return any results, then
		// don't show a button for it. Clicking this button does NOT trigger popup blocking.
		//
		// This ONLY works when using a filter set, it does not work for the params array/object method
		// of using filters.

		var buildSystemReportButtons = function () {
			var f = function (src) {
				if (_.isObject(src.filterSet)) {
					var title = 'Show System Report using Filter Set #' + (i + 1);
					var form = buildSubmissionForm(src).appendTo(jQuery('<div>').appendTo(document.getElementById(defn.table.id)));
					jQuery('<input>').attr({
						type: 'submit'
					}).val(title).appendTo(form);
				}
			};
			for (var i = 0; i < defn.source.length && i < defn._data.length; i += 1) {
				if (defn._data[i].length > 0) {
					f(defn.source[i]);
				}
			}
		};

		// buildSystemReportButtons();
		// repetitiveFilterIsRepetitive(defn);

		if (buildTableFn === undefined) {
			errmsg = 'must be one of: [' + _.keys(buildTableMap).join(', ') + ']';
			throw defn.error(new InvalidReportDefinitionError('table.output.method', outputMethod, errmsg));
		}

		_.each(data, function (d, i) {
			debug.info('GENERATE TABLE', 'Calling build table function for ' + outputMethod + ' output on source #' + (i + 1));
			var result = buildTableFn(defn, data, i, data.length > 1 ? 'Source #' + (i + 1) : null, tableDoneCont, fromScratch);

			if (result) {
				numTablesBuilt += 1;
				debug.info('GENERATE TABLE', 'Successfully built ' + numTablesBuilt + ' / ' + data.length + ' tables');
			}
		});

		if (typeof allDoneCont === 'function') {
			debug.info('GENERATE TABLE', 'Last table finished, calling user\'s and allDoneCont() function');
			allDoneCont(numTablesBuilt);
		}
	}

	/**
	 * Produce a table from a "graph definition." I know, we've gone a bit beyond graphs now, haven't
	 * we? Maybe we should call it something else.
	 *
	 * @param {object} defn The report definition.
	 *
	 * @param {boolean} fromScratch If true, start over from scratch by removing what's already within
	 * the table div first.
	 *
	 * @param {function} tableDone Callback to execute when we're done rendering a single table.
	 *
	 * @param {function} processingDone Callback to execute when we're done rendering all the tables.
	 */

	function generateTable(defn, fromScratch, tableDone, processingDone) {
		normalizeDefn(defn);
		return init(function () {
			// Just give up if there's no table ID provided.

			if (!defn.table || !defn.table.id) {
				return;
			}

			setBadStuffHandlers(defn);

			if (document.getElementById(defn.table.id) === null) {
				log.warn('No element on page with specified table.id "' + defn.table.id + '"');
				return;
			}

			if (fromScratch) {
				jQuery(document.getElementById(defn.table.id)).children().remove();
			}

			_.defaults(defn.table, {
				autoResizeColumns: true,
				guessColumnTypes: false
			});

			if (defn._data) {
				debug.info('GENERATE TABLE', 'Reusing cached data to generate table');

				if (defn.view !== undefined) {
					return defn.view.getData(function (data) {
						defn._data = [data];
						return reallyGenerateTable(defn, defn._data, tableDone, processingDone, fromScratch);
					});
				}

				return reallyGenerateTable(defn, defn._data, tableDone, processingDone, fromScratch);
			}
			else {
				debug.info('GENERATE TABLE', 'Retrieving data before generating table');
				return getData(defn, function (allSources) {
					var data = allSources.data
						, typeInfo = allSources.typeInfo
						, uniqElts = allSources.uniqElts
						, displayName = allSources.displayName;
					return storeDataInDefn(defn, data, typeInfo, uniqElts, displayName, function () {
						defn._sourceCount = allSources.length;
						return reallyGenerateTable(defn, data, tableDone, processingDone, fromScratch);
					});
				});
			}
		});
	}

	// Table Output Modes {{{1

	// jQWidgets {{{2

	/**
	 * Transform configuration options supported by wcgraph into those supported by jQWidgets.
	 *
	 * @param {array} overrides Description of the configuration options allowed.  Each element is
	 * either a string (meaning both the definition property and the output configuration property are
	 * the same) or an object.  If it's an object, it has a property [defn] (which indicates the
	 * definition property path) and a property named after the output (which indicates the output
	 * configuration property path).  In every case, the property path can be a string or an array.
	 *
	 * Example:
	 *
	 *   ['foo', {defn: 'bar', jqx: 'rab'}]
	 *
	 * @param {object} defn The object of the report definition under consideration.
	 *
	 * @param {object} tableConfig jQWidgets configuration object, which will be updated if translatable
	 * options are found in `defn`.
	 */

	function checkOverrides(overrides, defn, tableConfig) {
		_.each(overrides, function (override) {
			var defnField; // Field path in the grid definition.
			var libField;  // Field path in the output method's configuration object.
			var val;       // The value to configure.

			if (_.isString(override)) {
				defnField = override;
				libField = override;
			}
			else if (_.isObject(override)) {
				defnField = override.defn;
				libField = override.jqx;
			}

			if (_.isUndefined(defnField) || _.isUndefined(libField)) {
				log.error('Bad override value: defnField = %s, libField = %s', defnField, libField);
			}
			else {
				if (!_.isArray(defnField)) {
					defnField = [defnField];
				}
				val = getProp.apply(null, _.flatten([defn, 'table', defnField]));
				if (val !== undefined) {
					tableConfig[libField] = val;
				}
			}
		});
	}

	/**
	 * Build a jQWidgets table for the data in a specific source.
	 *
	 * @param object defn The report definition.
	 *
	 * @param array data The data used to generate the table.  Each element is the complete result set
	 * (i.e. an array of rows) for a source.
	 *
	 * @param number srcIndex Index of what source to build a table for; zero-based.
	 *
	 * @param string title The title shown above the grid.
	 *
	 * @param function tableDone A callback function to execute after jQWidgets is done rendering the
	 * grid.  It is passed the grid object itself.
	 */

	function buildTableJqwidgets(defn, data, srcIndex, title, tableDone) {
		var columnGroups; // jQWidgets grid config: 'columngroups' property.
		var groupsRenderer = null; // jQWidgets grid config: 'groupsrenderer' property.
		var columnConfig; // jQWidgets grid config: 'columns' property.
		var columns;

		if (defn.table.columns !== undefined) {
			if (!(defn.table.columns instanceof Array)) {
				throw defn.error('[table.columns] must be an array');
			}
			_.each(defn.table.columns, function (elt, i) {
				if (typeof elt !== 'string') {
					throw defn.error('[table.columns] element #' + i + ' is not a string');
				}
				if (elt !== '_DEFAULT' && data[srcIndex][0] !== undefined && data[srcIndex][0][elt] === undefined) {
					emailWarning(defn, 'Configuration for column "' + elt + '" refers to something not present in the data.  With jQWidgets output, this can result in empty columns.  Did the data source (e.g. system report) change?');
				}
			});
		}

		if (getProp(defn, '_typeInfo', srcIndex)) {
			columns = _.keys(defn._typeInfo[srcIndex].byName);
		}
		else if (data[srcIndex].length > 0) {
			columns = _.keys(data[srcIndex][0]);
		}

		if (defn.table.columns !== undefined) {
			columns = _.union(_.reject(defn.table.columns, function (x) { return x === '_DEFAULT'; }), columns);
		}

		var gridConfig = makeGridConfig(defn, data, columns, srcIndex);

		if (defn.table.columnGroups) {
			columnGroups = makeColumnGroups(defn, gridConfig);
		}

		columnConfig = gridConfig.columns;
		var dataFieldConfig = gridConfig.datafields;
		if (defn.table.grouping && defn.table.grouping.headerLine) {
			groupsRenderer = makeGroupsRenderer(defn, srcIndex, gridConfig);
		}
		if (defn.table.editing) {
			addEditConfig(defn, columnConfig);
		}
		// var report = {
		//   table: {
		//     grouping: {
		//       headerLine: {
		//         useGridAggregates: false,
		//         config: [{
		//           groupBy: 'A',
		//           aggregates: [{ fun: 'countDistinct', col: 'X' }, { fun: ['sum', 'avg'], col: 'Y' }]
		//         }, {
		//           groupBy: 'B',
		//           aggregates: [{ fun: ['sum', 'avg'], col: 'B' }]
		//         }, {
		//           /* THIS IS THE SAME AS THE PRECEDING OBJECT */
		//           groupBy: 'B',
		//           fun: ['sum', 'avg']
		//         }
		//       }
		//     }
		//   }
		// }

		var tableConfig = {
			sortable: true,
			autoheight: false,
			altrows: true,
			enabletooltips: true,
			groupable: true,
			filterable: true,
			filtermode: 'excel',
			selectionmode: 'multiplecellsextended',
			columns: columnConfig,
			columnsresize: true,
			columnsreorder: true,
			width: '100%',
			columngroups: columnGroups,
			// BUG [jQWidgets 3.4.0] Does nothing; state is saved/loaded anyway.
			autosavestate: false,
			autoloadstate: false,
			// BUG [jQWidgets 4.1.0] Does nothing; columns end up being fixed at their initial sizes.
			// columnsautoresize: !!defn.table.autoResizeColumns,
		};

		// When the user has provided the necessary information, set a custom
		// group renderer based on the function we created earlier.
		if (groupsRenderer !== null) {
			tableConfig.groupsrenderer = groupsRenderer;
		}
		unlock(defn, 'prefs');

		var grid = jQuery('<div>')
			.css({'visibility': 'hidden'})
			.appendTo(jQuery(document.getElementById(defn.table.id)));

		// Callback for when the grid is done populating its data and is ready to be shown.  There's no
		// need to block the grid because it's not visible yet.  So we need to do the following tasks:
		//
		//   * load preferences
		//   * auto-resize columns
		//   * make grid visible
		//   * run caller's "tableDone" callback
		//
		// Then we're done!

		tableConfig.ready = function () {
			var afterLoad = function () {
				var timingEvtArc = [defn._id || defn.table.id, 'Auto-Resize Columns / Performing auto-resize columns'];
				debug.info('READY', 'Making grid visible for the first time');
				grid.css({'visibility': 'visible'});

				// BUG [jQWidgets 4.2.1] Using the visibility trick to hide the grid before it has been
				// completely set up causes the horizontal scrollbar to overlap the bottom row of the grid
				// when there's no vertical scrollbar.  This can be "fixed" by using 'updatebounddata'
				// immediately after making the grid visible.

				grid.jqxGrid('updatebounddata', 'data');

				// With the visibility trick, we need to perform the ARC after the grid has become visible.
				// Otherwise, nothing happens and the columns retain their initial size.

				//GRID_TIMING.start(timingEvtArc);
				maybeAutoResizeColumns({dontBlock: true});
				//GRID_TIMING.stop(timingEvtArc);

				if (_.isFunction(tableDone)) {
					tableDone(grid, srcIndex);
				}

				// Decrement data-change on the grid's div, because we're done with a change.  If
				// data-change is 1, remove the attribute.

				var curDataChange = grid.attr('data-change') || 1;
				if (curDataChange == 1) {
					grid.removeAttr('data-change');
				}
				else {
					grid.attr('data-change', curDataChange - 1);
				}
			};

			if (defn.table.prefs && defn.table.prefs.enableSaving) {
				defn.prefs.setUserData('grid', grid);
				defn.prefs.loadInitial(afterLoad);
			}
			else {
				afterLoad();
			}
		};

		if (defn.table.enablePaging === 'AUTO') {
			defn.table.enablePaging = (defn._data[srcIndex].length * columnConfig.length > 1000);
		}

		var configTranslation = [
			'width',
			'height', {
				jqx: 'groupable',
				defn: 'enableGrouping'
			}, {
				jqx: 'pageable',
				defn: 'enablePaging'
			}, {
				jqx: 'editable',
				defn: 'enableEditing'
			}, {
				jqx: 'pagesize',
				defn: 'pageSize'
			}, {
				jqx: 'selectionmode',
				defn: 'selectionMode'
			}, {
				jqx: 'filtermode',
				defn: 'filterMode'
			}, {
				jqx: 'showfilterrow',
				defn: 'filterRow'
			}, {
				jqx: 'enabletooltips',
				defn: 'enableTooltips'
			},
			'autoheight',
			'autorowheight', {
				jqx: 'groups',
				defn: 'initialGroups'
			}, {
				jqx: 'groupsexpandedbydefault',
				defn: ['grouping', 'startExpanded']
			}
		];
		checkOverrides(configTranslation, defn, tableConfig);

		/*
		 * Try wheel.  If we are using autoheight, then there's no vertical scroll bar.  If there's only
		 * a horizontal scroll bar, then using the mouse wheel in the grid will scroll horizontally.
		 * This is weird, especially if you're trying the scroll the page and the grid hijacks the event
		 * to scroll horizontally instead.  Therefore, when using autoheight, disable the mouse wheel
		 * event handling in the grid.
		 */
		if (tableConfig.autoheight) {
			tableConfig.enablemousewheel = false;
		}
		if (defn.table.aggregates) {
			var columnConfigMap = {};
			for (var i = 0; i < columnConfig.length; i += 1) {
				columnConfigMap[columnConfig[i].text] = columnConfig[i];
			}
			_.each(defn.table.aggregates, function (agg) {
				if (!_.isString(agg.column) || !_.isArray(agg.types)) {
					return;
				}
				columnConfigMap[agg.column].aggregates = agg.types;
			});
			tableConfig.showstatusbar = true;
			tableConfig.showaggregates = true;
		}
		/*
		 * Title Configuration
		 */
		if (title) {
			jQuery('<div>')
				.appendTo(jQuery(document.getElementById(defn.table.id)))
				.text(title);
		}
		tableConfig.source = new jQuery.jqx.dataAdapter({
			datatype: 'json',
			datafields: dataFieldConfig,
			localdata: defn._data[srcIndex],
			formatData: function (data) {
				// Increment data-change on the grid's div.
				// If data-change does not exist, add it.
				var current_data_change = grid.attr('data-change');
				if (typeof(current_data_change) === 'undefined') {
					grid.attr('data-change', 1);
				} else {
					grid.attr('data-change', parseInt(current_data_change, 10) + 1);
				}

				// return the data, we don't actually want to change it
				return data;
			}
		});
		configureDeferredScrolling(defn, tableConfig);

		// BUG [jQWidgets 4.1.0] Calling "autoresizecolumns" when width is set to "100%" often does nothing.

		if (tableConfig.width === '100%' && defn.table.autoResizeColumns) {
			log.warn('BUG [jQWidgets 4.1.0] Auto-Resize Columns feature is very unreliable when width = "100%"');
		}

		debug.info('FINAL CONFIG', tableConfig);

		grid.jqxGrid(tableConfig);

		if (getProp(defn, 'table', 'enableEditing')) {
			grid.on('cellendedit', function (evt) {
				performEdit_jsonApi(defn, grid, evt.args.row[getProp(defn, 'table', 'editing', 'keyCol')], evt.args.datafield, evt.args.value, evt.args.oldvalue);
			});
		}

		/**
		 * If the user has enabled auto-resize columns, call the jQWidgets function to resize the
		 * columns.  Doing this will trigger the "column resize" event, so we need to lock the
		 * preferences so they don't get saved as they would if the user had manually resized a column
		 * (this event is fired for each column).  Since the operation could potentially take a while,
		 * we also lock to prevent multiple "ARC" (auto-resize columns) commands from being executed.
		 *
		 * @param {object} opts Options
		 * @param {boolean} opts.dontBlock If true, don't block the grid with an overlay when performing
		 * the operation.  An overlay is generally used for non-paged grids because the operation can
		 * take up to a second, or longer.
		 */

		function maybeAutoResizeColumns(opts) {
			opts = opts || {};
			if (defn.table.autoResizeColumns) {
				if (!isLocked(defn, 'arc')) {
					lock(defn, 'arc');
					lock(defn, 'prefs');

					debug.info('ARC', 'Performing auto-resize columns');

					// Using paging really reduces the amount of work that jQWidgets does to determine the
					// correct column sizes, so there's no reason to block out the grid (it usually goes so
					// quickly that it appears as a flash).

					if (getProp(defn, 'table', 'enablePaging') || opts.dontBlock) {
						grid.jqxGrid('autoresizecolumns');
						unlock(defn, 'prefs');
						unlock(defn, 'arc');
					}
					else {
						withGridBlock(defn, function () {
							grid.jqxGrid('autoresizecolumns');
							unlock(defn, 'prefs');
							unlock(defn, 'arc');
						}, 'MAYBE AUTO-RESIZE');
					}
				}
			}
		}

		// Grid Events {{{3

		defn._events = {};

		// Filter {{{4

		defn._events.filter = function (evt) {
			debug.info('FILTER', evt);
			var having;
			var doingServerFilter = getProp(defn, 'server', 'filter') && getProp(defn, 'server', 'limit') !== -1;
			var filterInfo;
			defn.prefs.save();
			if (isLocked(defn, 'filter')) {
				if (doingServerFilter) {
					unblockGrid(defn, 'SERVER FILTER');
				}
				unlock(defn, 'filter');
				return;
			}
			if (! doingServerFilter) {
				maybeAutoResizeColumns();
			}
			else {
				blockGrid(defn, null, 'SERVER FILTER');
				filterInfo = grid.jqxGrid('getfilterinformation');
				having = makeJsonHaving(filterInfo);
				if (having === null) {
					delete defn.source[srcIndex].having;
					delete defn.server._limit;
				}
				else {
					defn.source[srcIndex].having = {
						model: having
					};
					defn.server._limit = -1;
				}
				/*
				 * When this event handler gets called as a result of somebody typing something into the
				 * filter row and hitting <ENTER>, we need to lock the filter because the event handler will
				 * get called again after we refresh the data.
				 *
				 * SOMETIMES, though, the event handler WON'T GET CALLED AGAIN.  We can't tell here whether
				 * that's going to happen or not, so we rely upon the other parts of code that CAN trigger
				 * that behavior to set a flag... which is [defn._lockInfo].  If that's set, we don't lock
				 * the filter here, because we're not going to get called again; locking it would mess up
				 * subsequent filter operations by the user (i.e. they would be locked out).
				 *
				 * This event handler also won't get called multiple times if all filters have been removed.
				 */
				if (defn._lockInfo === 'dontlock' || having === null || true /* FILTER_MULTI_CALL */ ) {
					delete defn._lockInfo;
				}
				else {
					lock(defn, 'filter');
				}
				getData(defn, function (allSources) {
					var data = allSources.data;
					var i;
					var left = null;
					var columnHeaderDivs;
					var filterRowDivs;
					updateDefnDataInPlace(defn, srcIndex, data);
					//tableConfig.source.dataBind(); // Seems to be unnecessary?
					grid.jqxGrid('updatebounddata', 'data');
					maybeAutoResizeColumns();
					if (!isLocked(defn, 'filter')) {
						unblockGrid(defn, 'SERVER FILTER');
						if (typeof defn._filterCallback === 'function') {
							defn._filterCallback();
						}
						// This chunk of convoluted logic is trying to figure out where to put the focus after
						// we've finished filtering the data and updating the grid.  We want to put the focus
						// into the filter input text box of the appropriate column.
						//
						// Unfortunately, there is no way to determine the correct input text box using the
						// filtered property name alone.  So we need to find the column header first (matching
						// with the name of the property we filtered by), then get the corresponding input box,
						// which is a sibling element to the column header.  We would like to associate these by
						// index, except that the column header divs are in a different order from the filter
						// input text boxes.  So instead we use the CSS "left" property, which will be the same
						// (because one is right under the other).
						if (filterInfo.length > 0) {
							columnHeaderDivs = grid.find('div[role="columnheader"]');
							for (i = 0; i < columnHeaderDivs.length; i += 1) {
								if (jQuery(columnHeaderDivs[i]).find('div > div > span').text() === filterInfo[filterInfo.length - 1].datafield) {
									left = jQuery(columnHeaderDivs[i]).css('left');
									break;
								}
							}
							if (left !== null) {
								filterRowDivs = grid.find('div.jqx-grid-cell-filter-row');
								for (i = 0; i < filterRowDivs.length; i += 1) {
									if ($(filterRowDivs[i]).css('left') === left) {
										$(filterRowDivs[i]).find('div > input').focus();
										break;
									}
								}
							}
						}
					}
					/*
					var m = defn.table.id.search(/_gridContainer$/);
					if (m !== -1) {
						var wcgrid = window.wcgrid[defn.table.id.substr(0, defn.table.id.length - m - 2)];
						if (wcgrid) {
							wcgrid.updateRowCount(data[srcIndex].length);
						}
					}
					*/
				});
			}
		};

		// Sort {{{4

		defn._events.sort = function () {
			if (!isLocked(defn, 'prefs')) {
				debug.info('SORT');
				var orderBy;
				var doingServerSort = getProp(defn, 'server', 'sort') && getProp(defn, 'server', 'limit') !== -1;

				if (doingServerSort && defn.table.enablePaging) {
					// With paging enabled, changing a server-side sort may cause totally different data to
					// appear, which invalidates whatever width had been automatically chosen for the columns.
					// New data may be longer or shorter than what we were already showing.

					maybeAutoResizeColumns();
				}

				defn.prefs.save();
				if (isLocked(defn, 'sort')) {
					if (doingServerSort) {
						unblockGrid(defn, 'SERVER SORT');
					}
					unlock(defn, 'sort');
					return;
				}
				if (doingServerSort) {
					blockGrid(defn, null, 'SERVER SORT');
					orderBy = makeJsonOrderBy(grid.jqxGrid('getsortinformation'));
					if (orderBy === null) {
						delete defn.source[srcIndex].orderBy;
					}
					else {
						defn.source[srcIndex].orderBy = orderBy;
					}
					lock(defn, 'sort');
					getData(defn, function (allSources) {
						var data = allSources.data;
						updateDefnDataInPlace(defn, srcIndex, data);
						//tableConfig.source.dataBind(); // Seems to be unnecessary?
						grid.jqxGrid('updatebounddata', 'sort');
						unblockGrid(defn, 'SERVER SORT');
						/*
					var m = defn.table.id.search(/_gridContainer$/);
					if (m !== -1) {
						var wcgrid = window.wcgrid[defn.table.id.substr(0, defn.table.id.length - m - 2)];
						if (wcgrid) {
							wcgrid.updateRowCount(data[srcIndex].length);
						}
					}
					*/
					});
				}
			}
		};

		// Column Reordered {{{4

		defn._events.columnreordered = function (evt) {
			if (!isLocked(defn, 'prefs')) {
				debug.info('REORDER COLUMN', '%s (#%d -> #%d)', evt.args.columntext, evt.args.oldindex, evt.args.newindex);
				defn.prefs.save();
			}
		};

		// Column Resized {{{4

		defn._events.columnresized = function (evt) {
			if (!isLocked(defn, 'arc') && !isLocked('prefs')) {
				debug.info('RESIZE COLUMN', '%s (%d -> %d)', evt.args.columntext, evt.args.oldwidth, evt.args.newwidth);
				defn.prefs.save();
			}
		};

		// Grouping Changed {{{4

		defn._events.groupschanged = function () {
			debug.info('CHANGE GROUPING');
			maybeAutoResizeColumns();
			defn.prefs.save();
		};

		// Group Expanded {{{4


		defn._events.groupexpand = function () {
			debug.info('EXPAND GROUP');
			maybeAutoResizeColumns();
			defn.prefs.save();
		};

		// Group Collapsed {{{4

		defn._events.groupcollapse = function () {
			debug.info('COLLAPSE GROUP');
			maybeAutoResizeColumns();
			defn.prefs.save();
		};

		// Page Changed {{{4

		defn._events.pagechanged = function () {
			debug.info('CHANGE PAGE');
			maybeAutoResizeColumns();
			// BUG [jQWidgets 4.1.2] Column sizes can get reset after call to 'autoresizecolumns' very
			// similar to the problem fixed by patch #04.
			defn.prefs.save();
		};

		// Page Size Changed {{{4

		defn._events.pagesizechanged = function () {
			debug.info('CHANGE PAGE SIZE');
			/*
			 * This particular event handler doesn't work for auto-resizing the columns, because it
			 * gets invoked before the current page is actually updated to match the new page size.
			 *
			 * After this handler is done, the current page is updated, and the column sizes are all
			 * reset.  There's no way to get in afterwards and auto-resize them.  Even using a hack
			 * like setTimeout() doesn't help things.
			 *
			 * As a result, whenever you change the page size (either by manually clicking it, or by
			 * loading a preference that contains a page size), your column sizes are going to get
			 * really messed up.
			 */
			maybeAutoResizeColumns();
			defn.prefs.save();
		};

		// }}}4

		// Register all the event handlers on the grid at the same time.

		_.each(defn._events, function (handler, eventName) {
			grid.on(eventName, handler);
		});

		// }}}3

		return grid;
	}

	// Pivot Table {{{2

	function installPivotHandlers(defn, pivot) {
		pivot.find('.pvtRenderer').on('change', function () {
			defn.prefs.save();
		});

		pivot.find('.pvtAggregator').on('change', function () {
			// Changing the aggregator creates the aggregator parameter dropdowns, so we need to add the
			// event handlers to monitor them for changes here.  The delay is necessary because they won't
			// exist until a brief moment after this function returns.

			window.setTimeout(function () {
				pivot.find('.pvtAttrDropdown').on('change', function () {
					defn.prefs.save();
				});
			}, 500);

			defn.prefs.save();
		});
	}

	/**
	 * Build a pivot table for the data in a specific source.
	 *
	 * @param object defn The report definition.
	 *
	 * @param array data The data used to generate the table.  Each element is the complete result set
	 * (i.e. an array of rows) for a source.
	 *
	 * @param number srcIndex Index of what source to build a table for; zero-based.
	 *
	 * @param string title The title shown above the grid.
	 *
	 * @param function tableDone A callback function to execute after jQWidgets is done rendering the
	 * grid.  It is passed the grid object itself.
	 */

	function buildTablePivot(defn, data, srcIndex, title, tableDone) {
		var config = $.extend(true, getPropDef({}, defn, 'table', 'pivot'), getPropDef({}, defn, 'table', 'output', 'config'));

		if (getProp(defn, 'graph', 'stack', 'field')) {
			config.cols = [defn.graph.stack.field];
		}
		else {
			config.cols = getProp(defn, 'table', 'pivot', 'cols');
		}

		if (getProp(defn, 'graph', 'categories', 'field')) {
			config.rows = [defn.graph.categories.field];
		}
		else {
			config.rows = getProp(defn, 'table', 'pivot', 'rows');
		}

		// This function should be called by Prefs#loadInitial() to receive the saved preferences of the
		// initial view.  With this method, we can apply the user's saved preferences when we first
		// create the pivot table output.

		var f = function (savedPrefs) {
			var pivot;
			var finalPrefs;
			var initialRender;

			// Set the pivottable library to call our preference saving function whenever anything is
			// changed through the user interface.

			initialRender = true;

			finalPrefs = _.extend({}, config, getPropDef({}, savedPrefs, 'pivot'));

			debug.info('RENDER // PIVOT', 'Final configuration:', finalPrefs);

			finalPrefs.onRefresh = function (prefs) {
				if (! initialRender) {
					defn.prefs.setUserData('pivot/prefs', prefs);
					defn.prefs.save();
				}
				else {
					initialRender = false;
				}
			};

			defn.prefs.setUserData('pivot/default', config);
			defn.prefs.setUserData('pivot/data', data[srcIndex]);

			pivot = $(document.getElementById(defn.table.id)).wcPivotUI(data[srcIndex], finalPrefs, true);

			if (typeof tableDone === 'function') {
				window.setTimeout(function () {
					tableDone(pivot);
				});
			}
		};

		// Load the initial view's preferences, and pass them along to the function above so it can
		// create the pivot table using them.

		defn.prefs.loadInitial(f, true);
		return true;
	}

	// Plain HTML {{{2

	/**
	 * @typedef {Object} BuildTableHtml_Result
	 * @property {object} tbl The <TABLE> element.
	 * @property {object} thead The <THEAD> element.
	 * @property {object} tfoot The <TFOOT> element.
	 * @property {object} tbody The <TBODY> element.
	 * @property {object} thMap A map of each column name to it's <TH> element.
	 * @property {object} checkAll_thead
	 * @property {object} checkAll_tfoot
	 */

	/**
	 * Build the structure that underlies both plain HTML and Tablesaw output modes.
	 *
	 * @returns {BuildTableHtml_Result} An object containing all the elements constructed.
	 */

	function buildTableHtml_Internal(defn, data, srcIndex, title, rowSelection, rowReordering, fromScratch) {
		var result
			, tr
			, dataView
			, enableFiltering = getProp(defn, 'table', 'enableFiltering')
			, enableSorting = getProp(defn, 'table', 'enableSorting')
			, filterThCss = {
				'white-space': 'nowrap',
				'padding-top': 0,
				'padding-bottom': 0,
				'vertical-align': 'top'
			};

		var sortIcons = {
			number: {
				'ASC': 'F162',
				'DESC': 'F163'
			},
			string: {
				'ASC': 'F15D',
				'DESC': 'F15E'
			}
		};

		sortIcons.date = sortIcons.number;
		sortIcons.time = sortIcons.number;
		sortIcons.datetime = sortIcons.number;

		// Helpers {{{3

		var getColConfig = function () {
			var args = Array.prototype.slice.call(arguments);
			return getProp.apply(undefined, _.flatten([[defn, 'table', 'columnConfig'], args]));
		};

		var setColConfig = function () {
			var args = Array.prototype.slice.call(arguments);
			var value = args.shift();
			return setProp.apply(undefined, _.flatten([[value], [defn, 'table', 'columnConfig'], args]));
		};

		/*
		var getColConfig = (function () {
			var cache = {};

			// Avoid object traversal using the cache.  It helps with very large grids.

			return function getColConfig2(colName, prop) {
				if (cache[colName + '.' + prop] !== undefined) {
					return cache[colName + '.' + prop].value;
				}

				var result = getProp(defn, 'table', 'columnConfig', colName, prop);
				cache[colName + '.' + prop] = {value: result};
				return result;
			};
		})();
		*/

		// Configure Style {{{3
		// Most of the grid's column configuration options come from jQWidgets, which is why they're
		// named the way they are.  This function looks at that configuration, and produces CSS that has
		// the same effect.  The properties that we support in plain HTML output are:
		//
		//   - width
		//   - minimum width
		//   - maximum width
		//   - horizontal text alignment

		var setCss = function (elt, colName) {
			if (getProp(defn, 'table', 'output', 'method') === 'tablesaw') {
				return;
			}

			_.each([
				['width'],
				['minWidth', 'min-width'],
				['maxWidth', 'max-width'],
				['cellAlignment', 'text-align']
			], function (css) {
				if (getColConfig(colName, css[0]) !== undefined) {
					elt.css(css[1] || css[0], getColConfig(colName, css[0]));
					if (css[2]) {
						elt.attr(css[2], getColConfig(colName, css[0]));
					}
				}
			});
		};

		// Build result object {{{3

		if (fromScratch) {
			result = {
				tbl: jQuery('<table>'),
				thead: jQuery('<thead>'),
				tbody: jQuery('<tbody>'),
				tfoot: jQuery('<tfoot>'),
				thMap: {},
				tr: []
			};
		}
		else {
			result = defn._buildTableResult;
		}

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

		var columns = [];

		// Error checking {{{4

		if (defn.table.columns !== undefined) {
			if (!(defn.table.columns instanceof Array)) {
				throw defn.error('[table.columns] must be an array');
			}
			_.each(defn.table.columns, function (elt, i) {
				if (typeof elt !== 'string') {
					throw defn.error('[table.columns] element #' + i + ' is not a string');
				}
				if (elt !== '_DEFAULT' && data[srcIndex][0] !== undefined && data[srcIndex][0][elt] === undefined) {
					emailWarning(defn, 'Configuration for column "' + elt + '" refers to something not present in the data.  With jQWidgets output, this can result in empty columns.  Did the data source (e.g. system report) change?');
				}
			});
		}

		// }}}4

		if (getProp(defn, '_typeInfo', srcIndex)) {
			columns = _.keys(defn._typeInfo[srcIndex].byName);
		}
		else if (data[srcIndex].length > 0) {
			columns = _.keys(data[srcIndex][0]);
		}

		if (defn.table.columns !== undefined) {
			columns = _.union(_.reject(defn.table.columns, function (x) { return x === '_DEFAULT'; }), columns);
		}

		columns = _.reject(columns, function (colName) {
			return colName.charAt(0) === '_' || isColumnHidden(defn, colName);
		});

		var numCols = columns.length;

		if (rowSelection) {
			numCols += 1; // Add a column for the row selection checkbox.
		}

		if (rowReordering) {
			numCols += 1; // Add a column for the reordering button.
		}

		// Create the <TH> elements that go inside the <THEAD>. {{{3

		if (fromScratch) {
			headingTr = jQuery('<tr>');
			filterTr = jQuery('<tr>');

			// Row Selection Setup {{{4

			if (rowSelection) {
				result.checkAll_thead = jQuery('<input>', { 'name': 'checkAll', 'type': 'checkbox' })
					.on('change', function (evt) {
						rowSelect_checkAll.call(this, evt, result);
					});
				headingTr.append(jQuery('<th>').append(result.checkAll_thead));
				if (enableFiltering) {
					filterTr.append(jQuery('<th>').css(filterThCss));
				}
			}

			// Sorting Setup {{{4

			if (enableSorting) {
				defn.sortSpec = {
					col: null,
					asc: false
				};
			}

			// Filtering Setup {{{4

			if (enableFiltering) {
				defn.gridFilterSet = new GridFilterSet(defn, result.thead);
			}

			// }}}4

			_.each(columns, function (colName, colIndex) {
				if (rowSelection) {
					colIndex += 1; // Add a column for the row selection checkbox.
				}

				var headingSpan = jQuery('<span>').text(colName);

				var headingTh = jQuery('<th>')
					.css({'white-space': 'nowrap'})
					.append(headingSpan);

				// Sorting {{{4

				if (enableSorting) {
					var sortSpan = jQuery('<span>').css({'font-size': '1.2em'});

					var onClick = function () {
						jQuery('span.sort_indicator').hide();
						headingTh.find('span.sort_indicator').show();

						// Save the sort spec.  If we're resorting a column (i.e. we just sorted it) then
						// reverse the sort direction.  Otherwise, start in ascending order.

						defn.sortSpec.asc = (defn.sortSpec.col === colName ? !defn.sortSpec.asc : true);
						defn.sortSpec.col = colName;

						debug.info('SORTING', 'Column = ' + defn.sortSpec.col + ' ; Direction = ' + (defn.sortSpec.asc ? 'ASC' : 'DESC'));

						// sortSpan.html(fontAwesome(sortIcons[defn.view.typeInfo.byName[colName]][defn.sortSpec.asc ? 'ASC' : 'DESC']));
						sortSpan.html(fontAwesome(defn.sortSpec.asc ? 'F0D7' : 'F0D8'));

						defn.view.setSort(defn.sortSpec.col, defn.sortSpec.asc ? 'ASC' : 'DESC');
					};

					sortSpan.addClass('sort_indicator');
					sortSpan.css({'cursor': 'pointer'});
					sortSpan.on('click', onClick);

					headingSpan.css({'cursor': 'pointer', 'margin-left': '0.5ex'});
					headingSpan.on('click', onClick);

					headingTh.prepend(sortSpan);
				}

				// Filtering {{{4

				if (enableFiltering) {

					// Create the button that will add the filter to the grid, and stick it onto the end of
					// the column heading TH.

					jQuery(fontAwesome('F0B0', null, 'Click to add a filter on this column'))
						.css({'cursor': 'pointer', 'margin-left': '0.5ex'})
						.on('click', function () {
							defn.gridFilterSet.add(colName, colIndex, getColConfig(colName, 'filter'), jQuery(this));
						})
						.appendTo(headingTh);

					// Add a TH to the TR that will contain the filters.  Every filter will actually be a DIV
					// inside this TH.

					var filterTh = jQuery('<th>').css(filterThCss);
					setCss(filterTh, colName);
					filterTr.append(filterTh);
				}

				// }}}4

				setCss(headingTh, colName);
				result.thMap[colName] = headingTh;
				headingTr.append(headingTh);
			});

			if (rowReordering) {
				headingTr.append(jQuery('<th>').text('Options'));
				if (enableFiltering) {
					filterTr.append(jQuery('<th>').css(filterThCss));
				}
			}

			result.thead.append(headingTr);

			if (enableFiltering) {
				result.thead.append(filterTr);
			}
		}

		// Create the <TD> elements that go inside the <TFOOT>. {{{3

		if (fromScratch) {
			tr = jQuery('<tr>');

			if (rowSelection) {
				result.checkAll_tfoot = jQuery('<input>', { 'name': 'checkAll', 'type': 'checkbox' })
					.on('change', function (evt) {
						rowSelect_checkAll.call(this, evt, result);
					});
				tr.append(jQuery('<td>').append(result.checkAll_tfoot));
			}

			tr.append(_.map(columns, function (colName) {
				var td = jQuery('<td>').text(colName);
				setCss(td, colName);
				return td;
			}));

			if (rowReordering) {
				tr.append(jQuery('<td>').text('Options'));
			}

			result.tfoot.append(tr);
		}

		// Create the elements that go inside the <TBODY>. {{{3

		// When we're reusing something we already built before, we need to get rid of the body of the
		// table so that we can recreate it.  Everything else gets reused, but obviously we don't want
		// to reuse the data itself.

		if (!fromScratch) {
			result.tbody.children().remove();
		}

		_.each(data, function (datum, srcNum) {
			if (srcNum > 0) {
				result.tbody.append(jQuery('<tr>').append(jQuery('<td>', {
					colspan: columns.length
				}).css('border-top', 'solid 1px black')));
			}

			_.each(datum, function (row, rowNum) {
				var dateRegexp = /^\d{4}-\d{2}-\d{2}$/;
				var dateTimeRegexp = /^(\d{4}-\d{2}-\d{2}) (\d{2}:\d{2}:\d{2})$/;
				var tr = jQuery('<tr>', {id: defn.table.id + '_' + rowNum});

				if (rowSelection) {
					var checkbox = jQuery('<input>', {
						'type': 'checkbox',
						'data-source-num': srcNum,
						'data-row-num': rowNum
					})
						.on('change', check_handler);
					tr.append(jQuery('<td>').append(checkbox));
				}

				_.each(columns, function (col) {
					var td;
					var date;
					var elt;

					if (row[col] instanceof Element) {

						// This has to be a copy of the original element.  Here's why: if the element contains a
						// MySQL formatted date, we want to format that date according to the user's preference.
						// However, once we do that, it won't look like a MySQL date anymore.  So subsequent
						// "redrawings" of the same data won't be the same (they won't look like MySQL dates, so
						// they won't get parsed and have the original date attached in an attribute).

						elt = deepCopy(jQuery(row[col]));

						// When the data is a date or datetime, we parse that value into a JavaScript Date
						// object, and store it in the element.  Then we set the text of the element to the
						// value as formatted according to the user's preferences.  The Date object can be used
						// for sorting (e.g. we do this with Tablesaw using custom sort functions).

						if (getColConfig(col, 'type') === 'date') {
							if (dateRegexp.test(elt.text())) {
								date = new Date(elt.text());
								elt.attr('data-internal-value', date);
								elt.text(formatDate(date));
							}
							else if (dateTimeRegexp.test(elt.text())) {
								date = new Date(elt.text().replace(dateTimeRegexp, '$1T$2'));
								elt.attr('data-internal-value', date);
								elt.text(formatDate(date));
							}
						}
						else if (getColConfig(col, 'type') === 'datetime') {
							date = new Date(elt.text());
							elt.attr('data-internal-value', date);
							elt.text(formatDateTime(date));
						}

						td = jQuery('<td>').append(elt);
					}
					else {
						if (getColConfig(col, 'widget') === 'checkbox') {
							td = jQuery('<td>').append(jQuery('<i>', {
								'class': +row[col] ? 'fa fa-check-square-o' : 'fa fa-square-o',
								'data-internal-value': +row[col] ? 1 : 0
							}));
						}
						else {
							if (getColConfig(col, 'type') === 'date') {
								td = jQuery('<td>').text(formatDate(new Date(row[col])));
							}
							else if (getColConfig(col, 'type') === 'datetime') {
								td = jQuery('<td>').text(formatDateTime(new Date(row[col])));
							}
							else {
								td = jQuery('<td>').text(row[col]);
							}
						}
					}

					setCss(td, col);
					tr.append(td);
				});

				if (rowReordering) {
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
									rowSwapIndex(defn, oldIndex, newIndex);
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

				result.tr.push(tr);
				result.tbody.append(tr);
			});
		});

		// Register filter event handler {{{3

		if (fromScratch && enableFiltering) {
			var evenOdd = [];
			var even = false; // Rows are 1-based to match our CSS zebra-striping.

			defn.view.off('filter');
			defn.view.on('filter', function (rowNum, hide) {
				result.tr[rowNum].removeClass('even odd');
				if (hide) {
					result.tr[rowNum].hide();
				}
				else {
					result.tr[rowNum].show();
					result.tr[rowNum].addClass(even ? 'even' : 'odd');
					even = !even;
				}
			});
		}

		// Register sort event handler {{{3

		if (fromScratch && enableSorting) {
			defn.view.off('sort');
			defn.view.on('sort', function (rowNum, position) {
				var elt = jQuery(document.getElementById(defn.table.id + '_' + rowNum));

				// Add one to the position (which is 0-based) to match the 1-based row number in CSS.

				elt.removeClass('even odd');
				elt.addClass((position + 1) % 2 === 0 ? 'even' : 'odd');
				result.tbody.append(elt);
			});
		}

		// }}}3

		return result;
	}

	/**
	 * Build a plain HTML table for the data in a specific source.
	 */

	function buildTableHtml(defn, data, srcIndex, title, tableDone, fromScratch) {
		var rowSelection = getPropDef(false, defn, 'table', 'enableRowSelection');
		var rowReordering = getPropDef(false, defn, 'table', 'enableRowReordering');
		var elt = buildTableHtml_Internal(defn, data, srcIndex, title, rowSelection, rowReordering, fromScratch);
		var div = jQuery(document.getElementById(defn.table.id));

		if (fromScratch) {
			defn._buildTableResult = elt;

			if (rowReordering) {
				configureRowReordering(defn, elt.tbody);
			}

			elt.tbl.attr({
				'class': 'newui zebra',
				//'data-tttype': 'sticky' // XXX Just for now!
			});

			div.append(elt.tbl.append(elt.thead).append(elt.tfoot).append(elt.tbody));
		}

		window.setTimeout(function () {
			tableDone();
		});

		return true;
	}

	// Tablesaw {{{2

	/**
	 *
	 */

	function buildTableTablesaw(defn, data, srcIndex, title, tableDone) {
		var rowSelection = getPropDef(false, defn, 'table', 'enableRowSelection');
		var rowReordering = getPropDef(false, defn, 'table', 'enableRowReordering');
		var elt = buildTableHtml_Internal(defn, data, srcIndex, title, rowSelection, rowReordering);
		var mode = getPropDef('stack', defn, 'table', 'output', 'tablesaw', 'mode');

		switch (mode) {
		case 'stack':
			elt.tbl.attr('data-tablesaw-mode', 'stack');
			break;
		case 'toggle':
			elt.tbl.attr('data-tablesaw-mode', 'columntoggle');
			elt.tbl.attr('data-tablesaw-minimap', '');
			_.each(elt.thMap, function (th, colName) {
				th.attr('data-tablesaw-priority', getPropDef('1', defn, 'table', 'columnConfig', colName, 'tablesawPriority'));
			});
			break;
		case 'swipe':
			elt.tbl.attr('data-tablesaw-mode', 'swipe');
			elt.tbl.attr('data-tablesaw-minimap', '');
			_.each(elt.thMap, function (th, colName) {
				var prio = getProp(defn, 'table', 'columnConfig', colName, 'tablesawPriority');
				if (prio === 'persist') {
					th.attr('data-tablesaw-priority', prio);
				}
			});
			break;
		}

		elt.tbl.attr('class', 'newui zebra tablesaw');

		if (getProp(defn, 'table', 'enableSorting')) {
			elt.tbl.attr('data-tablesaw-sortable', '');
			elt.tbl.attr('data-tablesaw-sortable-switch', '');

			var dateSort = function (asc) {
				return function (a, b) {
					var date1 = new Date($(a.element.children[1].children[0]).attr('data-internal-value'));
					var date2 = new Date($(b.element.children[1].children[0]).attr('data-internal-value'));
					return asc ? (date1.getTime() < date2.getTime() ? 1 : -1) : (date1.getTime() > date2.getTime() ? 1 : -1);
				};
			};

			var checkboxSort = function (asc) {
				return function (a, b) {
					var cb1 = $(a.element.children[1].children[0]).attr('data-internal-value');
					var cb2 = $(b.element.children[1].children[0]).attr('data-internal-value');
					return asc ? (cb1 < cb2 ? 1 : -1) : (cb1 > cb2 ? 1 : -1);
				};
			};

			_.each(elt.thMap, function (th, colName) {
				var type = getProp(defn, 'table', 'columnConfig', colName, 'type');
				var widget = getProp(defn, 'table', 'columnConfig', colName, 'widget');

				if (type === 'date' || type === 'datetime') {
					th.data('tablesaw-sort', dateSort);
				}
				else if (widget === 'checkbox') {
					th.data('tablesaw-sort', checkboxSort);
				}

				th.attr('data-tablesaw-sortable-col', '');
			});
		}
		else {
			// The floating headers only work when sorting is disabled.
			elt.tbl.attr('data-tttype', 'sticky');
		}

		elt.tbl.append(elt.thead);
		elt.tbl.append(elt.tbody);

		jQuery(document.getElementById(defn.table.id)).append(elt.tbl);

		elt.tbl.table(); // Initialize Tablesaw.

		if (rowReordering) {
			configureRowReordering(defn, elt.tbody);
		}

		window.setTimeout(function () {
			tableDone();
		});
		return true;
	}

	// jQWidgets Grid Hacks {{{1
	/*
	 * This is the code from jqxgrid.selection.js in version 3.7.0 - modified to only select all in
	 * expanded groups when there are groups set.  The reason it's here and not in a patch is because
	 * patching jQWidgets after every release is more difficult.
	 */
	// jshint ignore:start
	jQuery.extend(jQuery.jqx._jqxGrid.prototype, {
		selectallrows: function () {
			this._trigger = false;
			var length = this.virtualmode ? this.dataview.totalrecords : this.dataview.loadedrecords.length;
			this.selectedrowindexes = new Array();
			var rows = this.dataview.loadedrecords;
			var q = this;
			if (this.groupable && this.groups.length > 0) {
				var x = 0;
				_.each(this.getrootgroups(), function (g, i) {
					x += 1;
					_.each(g.subrows, function (r, j) {
						if (g.expanded) {
							var boundindex = q.getboundindex(rows[x]);
							if (boundindex !== undefined) {
								q.selectedrowindexes[x] = boundindex;
							}
						}
						x += 1;
					});
				});
			}
			else {
				for (var i = 0; i < length; i++) {
					var row = rows[i];
					if (!row) {
						this.selectedrowindexes[i] = i;
						continue;
					}
					var boundindex = this.getboundindex(row);
					if (boundindex !== undefined) {
						this.selectedrowindexes[i] = boundindex;
					}
				}
			}
			if (this.selectionmode === 'checkbox' && !this._checkboxcolumnupdating) {
				if (this._checkboxcolumn) {
					this._checkboxcolumn.checkboxelement.jqxCheckBox({
						checked: true
					});
				}
			}
			this._renderrows(this.virtualsizeinfo);
			this._trigger = true;
			if (this.selectionmode === 'checkbox') {
				this._raiseEvent(2, {
					rowindex: this.selectedrowindexes
				});
			}
		}
	});
	// jshint ignore:end

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
			.attr('title', mietrans('SHOWHIDE'))
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

		if (output === 'jqwidgets') {
			self._addJqwidgetsButtons(gridToolBarButtons);
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
		.attr('title', mietrans('SHOWHIDEOPTS'))
		.click(function (evt) {
			evt.stopPropagation();
			self.toggleGrid();
		})
		.appendTo(header);

	// Create the down-chevron button that opens the grid toolbar.

	jQuery('<button type="button">')
		.append(fontAwesome('f013'))
		.addClass('showhide pull-right')
		.attr('title', mietrans('SHOWHIDEOPTS'))
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

// #addJqwidgetsButtons {{{2

/**
 * @method
 * @memberof WCGRID
 * @private
 */

WCGrid.prototype._addJqwidgetsButtons = function (toolbar) {
	var self = this;

	// Auto-Resize Columns

	jQuery('<button type="button">')
		.append(fontAwesome('F07E'))
		.append(' Auto-Resize Columns')
		.on('click', function () {
			blockGrid(self.defn, function () {
				lock(self.defn, 'arc');
				lock(self.defn, 'prefs');
				self.grid.jqxGrid('autoresizecolumns');
				unlock(self.defn, 'prefs');
				unlock(self.defn, 'arc');
				unblockGrid(self.defn, 'AUTO-RESIZE');
			}, 'AUTO-RESIZE');
		})
		.appendTo(toolbar);

	// Auto Row Height

	jQuery('<button type="button">')
		.append(fontAwesome('F07D'))
		.append(' ' + (self.defn.table.autorowheight ? 'Disable' : 'Enable') + ' Auto Row Height')
		.on('click', function () {
			self.defn.table.autorowheight = !self.defn.table.autorowheight;
			jQuery(this)
				.html('')
				.append(fontAwesome('F07D'))
				.append(' ' + (self.defn.table.autorowheight ? 'Disable' : 'Enable') + ' Auto Row Height');
			generateTable(self.defn, true, self.tableDoneCont, self.allDoneCont);
		})
		.appendTo(toolbar);

	// Export

	var windowContent = jQuery('<div>')
			.text('Select the format of the data export from the menu below.  Your brower will then download the exported data as a file.');

	self.ui.exportWindow = jQuery('<div>')
		.append(jQuery('<div>').append(jQuery('<span>').text('Export Grid')))
		.append(windowContent)
		.jqxWindow({
			isModal: true,
			autoOpen: false,
			width: 300,
			height: 160
		})
		.appendTo(jQuery('#wc_body'));

	jQuery('<button type="button">')
		.append(fontAwesome('F14C'))
		.append(' Export')
		.on('click', function () {
			self.ui.exportWindow.jqxWindow('open');
		})
		.appendTo(toolbar);

	var dropdown = jQuery('<div>')
		.css({
			'margin-top': '1ex'
		})
		.jqxDropDownList({
			source: [{
				format: 'csv',
				name: 'Comma-Separated Values (CSV)'
			}, {
				format: 'html',
				name: 'HTML'
			}, {
				format: 'json',
				name: 'JSON'
			}, {
				format: 'pdf',
				name: 'Portable Document Format (PDF)'
			}, {
				format: 'tsv',
				name: 'Tab-Separated Values (TSV)'
			}, {
				format: 'xls',
				name: 'Microsoft Excel Spreadsheet'
			}, {
				format: 'xml',
				name: 'XML'
			}],
			displayMember: 'name',
			valueMember: 'format',
			width: 250
		})
		.appendTo(windowContent);

	jQuery('<div>')
		.css({
			'text-align': 'right'
		})
		.append(jQuery('<input>', {
			type: 'button',
			value: 'OK'
		})
		.css({
			'margin-left': '4px',
			'margin-top': '4px',
			'margin-bottom': '4px'
		})
		.jqxButton()
		.on('click', function () {
			self.grid.jqxGrid('exportdata', dropdown.val(), self.id || 'export', true, null, true, 'grid-export.php');
			self.ui.exportWindow.jqxWindow('close');
		}))
		.append(jQuery('<input>', {
			type: 'button',
			value: 'Cancel'
		})
		.css({
			'margin-left': '4px',
			'margin-top': '4px',
			'margin-bottom': '4px'
		})
		.jqxButton()
		.on('click', function () {
			self.ui.exportWindow.jqxWindow('close');
		}))
		.appendTo(windowContent);
};

// #addPivotButtons {{{2

/**
 * @method
 * @memberof WCGRID
 * @private
 */

WCGrid.prototype._addPivotButtons = function (toolbar) {
	var self = this;

	$('<input>', { 'id': self.defn.table.id + '_toggleRowTotalsChk', 'type': 'checkbox', 'checked': true })
		.on('change', function () {
			if (this.checked) {
				$('.pvtTotalLabel').show();
				$('.pvtTotal').show();
				$('.pvtGrandTotal').show();
			}
			else {
				$('.pvtTotalLabel').hide();
				$('.pvtTotal').hide();
				$('.pvtGrandTotal').hide();
			}
		})
		.appendTo(toolbar);
	$('<label>', { 'for': self.defn.table.id + '_toggleRowTotalsChk' })
		.text('Row/Column Totals')
		.appendTo(toolbar);
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

// Pivot {{{1

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
			var cols = _.keys(typeInfo.byName);

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

window.MIE.WCGrid = WCGrid;
