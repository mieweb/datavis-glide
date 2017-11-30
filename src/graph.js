// Error Handling {{{1

function setBadStuffHandlers(defn) {
	if (isNothing(defn.error) || typeof defn.error !== 'function') {
		defn.error = function (e) {
			if (e instanceof Error && _.isString(e.message)) {
				emailError(defn, e.message);
			}
			else if (_.isString(e)) {
				emailError(defn, e);
			}
			return e;
		};
	}

	if (isNothing(defn.warning) || typeof defn.warning !== 'function') {
		defn.warning = function (e) {
			if (e instanceof Error && _.isString(e.message)) {
				emailWarning(defn, e.message);
			}
			else if (_.isString(e)) {
				emailWarning(defn, e);
			}
			return e;
		};
	}
}


// Links {{{1

function linkHandlerAddTarget(elt, opts) {
	if (!opts.no_popup) {
		elt.attr('target', '_blank');
	}
}

var linkHandler = (function () {
	var warningEmitted = {}; // Used to keep track of what we've already warned about.
	var emitWarning = function (defn, flag, msg) {
		var tableId = getPropDef('UNKNOWN', defn, 'table', 'id');

		if (warningEmitted[tableId] === undefined) {
			warningEmitted[tableId] = {};
		}

		if (warningEmitted[tableId][flag] === undefined) {
			emailWarning(defn, msg);
			warningEmitted[tableId][flag] = true;
		}
	};

	return {
		u: function (defn, text, userId, opts) {
			var elt = jQuery('<a>', {
				href: '?f=admin&s=users&opp=vuser&user_id=' + userId + (opts.add_url ? opts.add_url : '')
			}).text(text);
			linkHandlerAddTarget(elt, opts);
			return outerHtml(elt);
		},
		p: function (defn, text, patId, opts) {
			var elt = jQuery('<a>', {
				href: '?f=chart&s=pat&pat_id=' + patId + (opts.add_url ? opts.add_url : '')
			}).text(text);
			linkHandlerAddTarget(elt, opts);
			return outerHtml(elt);
		},
		d: function (defn, text, docId, opts, row) {
			if (_.isUndefined(row._PATIENT_ID)) {
				emitWarning(defn, 'd', 'Usage of {$d} in grid without _PATIENT_ID column');
				return text;
			}
			var elt = jQuery('<a>', {
				href: '?f=chart&s=doc&doc_id=' + docId + '&pat_id=' + row._PATIENT_ID + (opts.add_url ? opts.add_url : '')
			}).text(text);
			linkHandlerAddTarget(elt, opts);
			return outerHtml(elt);
		},
		w: function (defn, text, url, opts) {
			var elt = jQuery('<a>', {
				href: url
			}).text(text);
			linkHandlerAddTarget(elt, opts);
			return outerHtml(elt);
		},
		e: function (defn, text, encId, opts, row) {
			var elt;

			var params = {
				f: 'chart',
				s: 'pat',
				v: 'encounter',
				encopp: 'properties',
				encounter_id: encId
			};

			if (_.isUndefined(row._PATIENT_ID)) {
				emitWarning(defn, 'e', 'Usage of {$e} in grid without _PATIENT_ID column');
				return text;
			}

			params.pat_id = row._PATIENT_ID;

			if (opts.exam) {
				if (isNothing(row._EXAM_LAYOUT)) {
					emitWarning(defn, 'e|exam', 'Usage of {$e|exam} in grid without _EXAM_LAYOUT column');
					return text;
				}
				params.encopp = 'exam';
				params.enc_lay_id = row._EXAM_LAYOUT;
			}

			elt = jQuery('<a>', {
				href: '?' + $.param(params) + (opts.add_url ? opts.add_url : '')
			}).text(text);
			linkHandlerAddTarget(elt, opts);
			return outerHtml(elt);
		},
		a: function (defn, text, aptId, opts) {
			var elt = jQuery('<a>', {
				href: '?f=scheduler&apt_id=' + aptId + (opts.add_url ? opts.add_url : '')
			}).text(text);
			linkHandlerAddTarget(elt, opts);
			return outerHtml(elt);
		},
		o: function (defn, text, obsId, opts, row) {
			if (_.isUndefined(row._PATIENT_ID)) {
				emitWarning(defn, 'o', 'Usage of {$o} in grid without _PATIENT_ID column');
				return text;
			}
			var elt = jQuery('<a>', {
				href: '?f=chart&s=pat&t=obs&obopp=edit&pat_id=' + row._PATIENT_ID + '&obs_id=' + obsId + (opts.add_url ? opts.add_url : '')
			}).text(text);
			linkHandlerAddTarget(elt, opts);
			return outerHtml(elt);
		},
		i: function (defn, text, incId, opts, row) {
			if (_.isUndefined(row._PATIENT_ID)) {
				emitWarning(defn, 'i', 'Usage of {$i} in grid without _PATIENT_ID column');
				return text;
			}
			var elt = jQuery('<a>', {
				href: '?f=chart&s=pat&v=dashboard&t=ViewIncident&pat_id=' + row._PATIENT_ID + '&inc_id=' + incId + (opts.add_url ? opts.add_url : '')
			}).text(text);
			linkHandlerAddTarget(elt, opts);
			return outerHtml(elt);
		}
	};
})();

function stripLinkCode(x) {
	if (!_.isString(x)) {
		return x;
	}
	var m = x.match(/\{\$([A-Za-z]+)([^}]*)\}(.*)$/);
	if (m === null) {
		return x;
	}
	return x.substr(0, x.length - m[0].length);
}

function makeCellRenderer(defn) {
	return function (rowIndex, dataField, value, defaultHtml, columnProps, row) {
		var delConfig;

		/**
		 * Convert from a string with special formatting to HTML.  Normally the output is a link to a
		 * patient or encounter, but it could be something else.  The formatting of the input looks
		 * like this:
		 *
		 *   {$FLAG|OPT|...}
		 *
		 * FLAG is a single character, referencing keys from linkHandler (which see).  OPTs are passed
		 * to the linkHandler function, thus their interpretation is dependent on FLAG.
		 *
		 * @param string value The value of the cell.
		 *
		 * @param object row The entire row.  We need this in case the link needs to know more
		 * information that is stored in other columns (typically _PATIENT_ID).
		 *
		 * @param string displayText This is what the grid already computed as the display text for
		 * the field.  We use this because it already takes cellsformat into account.  Otherwise, we'd
		 * be starting from scratch here because we'd be looking at the _ORIG_ field which is what we
		 * got from the data source and isn't formatted according to cellsformat.
		 *
		 * @returns string HTML for the link that we want to produce.  Not a DOM node, just the text
		 * of the HTML that would make a link.
		 */

		var buildLink = function (value, row, displayText) {
			if (!_.isString(value)) {
				return value;
			}
			var m = value.match(/\{\$([A-Za-z]+)([^}]*)\}(.*)$/);
			if (m === null) {
				return value;
			}
			var text = value.substr(0, value.length - m[0].length);
			var flag = m[1],
				options = m[2],
				arg = m[3];
			var optionsMap = {};
			if (_.isUndefined(linkHandler[flag])) {
				log.warn('Unhandled link flag: ' + flag);
				return text;
			}
			_.each(options.split('|'), function (opt) {
				var optRegexpMatch = opt.match(/^([^=]*)=(.*)$/);
				if (optRegexpMatch) {
					optionsMap[optRegexpMatch[1]] = optRegexpMatch[2];
				}
				else {
					optionsMap[opt] = true;
				}
			});
			return linkHandler[flag](defn, displayText, arg, optionsMap, row);
		};

		if (defaultHtml === undefined || row === undefined) {
			// This situation arises when we're being called because the user activated the "auto-resize
			// this column" functionality by double-clicking on the column border.  I don't know why we
			// get called in this scenario, but there's nothing for us to do.

			return defaultHtml;
		}

		var node = jQuery(defaultHtml);

		if (getProp(defn, 'table', 'enableEditing')) {
			delConfig = getProp(defn, 'table', 'editing', 'deleting');
			// Coercive comparison here ("==") is INTENTIONAL.
			if (delConfig && delConfig.flagCol && row[delConfig.flagCol] == delConfig.flagVal.deleted) {
				node.addClass('wc_deleted');
			}
		}

		var link = buildLink(row['_ORIG_' + dataField] || value, row, node.text());
		node.text('');
		node.append(link);
		var dummy = jQuery('<div>');
		dummy.append(node);
		return dummy.html();
	};
}

/**
 * Configure the grid for supporting links, which turn specially formatted text into clickable
 * links that take you to patient chart, document info, etc.
 *
 * When we find link formatting, we create data field configuration for a new column that holds
 * the original specially formatted string.  Then we replace the cell with the text part that will
 * show up in the grid.  This means that the "value" of the cell in the grid is just the text,
 * without the special link formatting.  The cell renderer looks for the new column, and uses that
 * to build the HTML for the link.
 *
 * EXAMPLE:
 *
 *   Before --
 *
 *     Name = Taylor{$p}666
 *
 *   After --
 *
 *     Name = Taylor
 *     _ORIG_Name = Taylor{$p}666
 *
 * @param array data The data from a single source.
 * @param string colName Name of the column we're creating configuration for.
 * @param array dataFieldConfig The grid's data field configuration, as an array.
 * @param object dataFieldConfigByName The grid's data field configuration, as an object.
 */

function makeLinkConfig(data, colName, dataFieldConfig) {
	_.each(data, function (row) {
		var newDataField;
		var matchData;
		var origField;
		var value = row[colName];
		if (!_.isString(value)) {
			return;
		}
		matchData = value.match(/\{\$([A-Za-z]+)([^}]*)\}(.*)$/);
		if (matchData === null) {
			return;
		}
		var text = value.substr(0, value.length - matchData[0].length);
		var flag = matchData[1];
		row[colName] = text;
		if (isNothing(linkHandler[flag])) {
			log.warn('Unhandled link flag: ' + flag);
			return;
		}
		origField = '_ORIG_' + colName;
		row[origField] = value;
		if (!isNothing(dataFieldConfig) && isNothing(dataFieldConfig.byName[origField])) {
			newDataField = {
				name: origField
			};
			dataFieldConfig.byIndex.push(newDataField);
			dataFieldConfig.byName[origField] = newDataField;
		}
	});
}

/**
 * When you want to show a link in the grid, you do it by having a column with special formatting
 * in it.  We need to keep track of not only that formatting (which tells the cell renderer how to
 * build the link in HTML) but also the plain text that we want to see instead.  Both of these are
 * used by the grid.
 *
 * Here we build a conversion function that will replace the data column with the plain text, and
 * create a new column with the formatted text.  The cell renderer will later make use of the
 * formatted text column.
 */

function linkConvert(value, row, colName, defn) {
	var matchData;
	var html;

	// For obvious reasons, only strings can be links, so if we're not dealing with some kind of
	// string, there's nothing for us to do.  However, the caller should've already prevented this.

	if (!_.isString(value)) {
		return value;
	}

	matchData = value.match(/\{\$([A-Za-z]+)([^}]*)\}(.*)$/);

	if (matchData === null) {
		return value;
	}

	var text = value.substr(0, value.length - matchData[0].length);

	var flag = matchData[1],
		options = matchData[2],
		arg = matchData[3];

	if (_.isUndefined(linkHandler[flag])) {
		log.warn('Unhandled link flag: ' + flag);
		return text;
	}

	// Link options are separated by pipes.  These will be passed to the link handler.

	var optionsMap = {};
	_.each(options.split('|'), function (opt) {
		optionsMap[opt] = true;
	});

	// Store the text value somewhere so we can do stuff with it later (like filtering and sorting).

	if (row['_ORIG_' + colName] === undefined) {
		row['_ORIG_' + colName] = text;
	}

	// Convert the link specification into HTML to get the desired effect.

	html = linkHandler[flag](defn, text, arg, optionsMap, row);

	// Unless we're using the pivot table, we want an HTML element, not the HTML code.  The pivot
	// table renderer wants the HTML code.  Elements are easier to work with, but that's how the
	// pivot table renderer works.

	var outputMethod = getProp(defn, 'table', 'output', 'method');
	if (outputMethod !== 'pivot' && html.charAt(0) === '<') {
		html = jQuery(html)[0];
	}

	return html;
}


// Graph Auto-Grouping {{{1

/**
 * Build a new data object that summarizes the original data by grouping it as indicated and
 * counting the number of elements in the result.
 *
 * @param {array} ungroupedData The graph data object as it was obtained from the source.
 *
 * @param {array} groups An array of the groups in order.
 *
 * @param {array} aggregates An array of objects indicating the kind of aggregate functions to
 * compute.  This is expressed in the same way that they are for the header line aggregates in the
 * grid, only we can only use builtin aggregates (not jQWidgets grid aggregates).
 */

function groupData(ungroupedData, groups, aggregates) {
	var result = []; // [srcIndex → [rowNum → {column × value}]]
	var groupedData; // {groupColumnValue × ... {groupColumnValue × [groupRowNum → {column × value}]}}
	var groupFieldName = groups.join(' / ');

	function storeGroupRow(groupedData, row) {
		var localGroup = groupedData;
		_.each(groups, function (g, i) {
			if (!localGroup[row[g]]) {
				localGroup[row[g]] = i < groups.length - 1 ? {} : [];
			}
			localGroup = localGroup[row[g]];
		});
		localGroup.push(row);
	}
	_.each(ungroupedData, function (src, srcIndex) {
		var groupedData = {};
		result[srcIndex] = [];

		// Figure out how the row should be grouped and store it into the intermediate object.

		_.each(src, function (row) {
			storeGroupRow(groupedData, row);
		});

		// Process the intermediate object to produce an array of data that can be consumed by the
		// grid or graph.  There is a field for the group, and one for each aggregate you asked for.

		walkObj(groupedData, function (groupedRow, groupValues) {
			var obj = {};
			obj[groupFieldName] = groupValues.join(' / ');
			_.each(aggregates, function (agg) {
				obj[agg.displayText || agg.fun] = Aggregates[agg.fun].fun(_.defaults({
					field: agg.col
				}, agg))(groupedRow);
			});
			result[srcIndex].push(obj);
		});
	});
	return result;
}

function groupGraph(defn, groups, aggregates) {
	var newDefn = deepCopy(defn);
	newDefn._data = groupData(newDefn._data, groups, aggregates);
	newDefn.graph.categories = {
		title: getPropDef('Grouping', defn, 'graph', 'categories', 'title'),
		field: groups.join(' / '),
		type: 'string'
	};
	newDefn.graph.values = {
		title: getPropDef(aggregates[0].displayText, defn, 'graph', 'values', 'title'),
		field: aggregates[0].displayText
	};
	_.defaults(newDefn.graph.values, defn.graph.values);
	return newDefn;
}

// Graph {{{1
// Errors {{{2
// GraphError {{{3

/**
 * @memberof wcgraph
 *
 * @class
 *
 * @property {string} name
 * @property {object} stack
 * @property {string} message
 */

var GraphError = function (defn, msg) {
	this.name = 'GraphError';
	this.stack = (new Error()).stack;
	this.message = "Graph " + defn.graph.id + ": " + msg;
}

GraphError.prototype = Object.create(Error.prototype);
GraphError.prototype.constructor = GraphError;

// Graph.jQWidgetsError {{{3

/**
 * Errors specific to using jQWidgets.
 *
 * @memberof wcgraph
 *
 * @class
 *
 * @property {string} name
 * @property {object} stack
 * @property {string} message
 */

GraphError.jQWidgetsError = function (defn, msg) {
	this.name = 'jQWidgetsError';
	this.stack = (new Error()).stack;
	this.message = "Graph " + defn.graph.id + ": " + msg;
				}

GraphError.jQWidgetsError.prototype = Object.create(GraphError.prototype);
GraphError.jQWidgetsError.prototype.constructor = GraphError.jQWidgetsError;

// Graph.GoogleError {{{3

/**
 * Errors specific to using Google Charts.
 *
 * @memberof wcgraph
 * @class
 *
 * @property {string} name
 * @property {object} stack
 * @property {string} message
 */

GraphError.GoogleError = function (defn, msg) {
	this.name = 'GoogleError';
	this.stack = (new Error()).stack;
	this.message = "Graph " + defn.graph.id + ": " + msg;
				}

GraphError.GoogleError.prototype = Object.create(GraphError.prototype);
GraphError.GoogleError.prototype.constructor = GraphError.GoogleError;

// Graph {{{2

/**
 * @memberof wcgraph
 * @class
 *
 * @property {object} defn
 * @property {string} output
 * @property {function} error
 * @property {Element} div
 * @property {DataSource} source
 */

var Graph = function (defn) {
	var self = this
	, exn = curryCtor(GraphError, defn);

	normalizeDefn(defn);
	setBadStuffHandlers(defn);

	needProp(exn, defn, 'graph', 'id');
	needPropIn(exn, defn, 'graph', 'output', ['jqwidgets', 'google_charts']);

	if (document.getElementById(defn.graph.id) === null) {
	throw new GraphError('Div tag with id = ' + defn.graph.id + ' doesn\'t exist.');
			}

	self.defn = defn;
	self.output = defn.graph.output;
	self.error = exn;
	self.div = jQuery(document.getElementById(defn.graph.id));

	if (self.defn.source instanceof DataSource) {
	self.source = self.defn.source;
				}

	switch (self.output) {
	case 'jqwidgets':
	self.impl = new Graph.jQWidgets(self);
	break;
	case 'google_charts':
	self.impl = new Graph.Google(self);
	break;
			}
};

Graph.prototype.constructor = Graph;

// #draw {{{3

Graph.prototype.draw = function () {
	return this.impl.draw();
			};

// Graph.jQWidgets {{{2

/**
 * @memberof wcgraph
 * @class
 *
 * @param graph
 */

Graph.jQWidgets = function (graph) {
	var self = this;

	self.error = curryCtor(GraphError.jQWidgetsError, graph.defn);

	self.defn = needProp(self.error, graph, 'defn');
	self.div = needPropInst(self.error, graph, 'div', jQuery);
};

Graph.jQWidgets.prototype.constructor = Graph.jQWidgets;

// #autoSeriesGroups {{{3

	/**
 * Automatically extracting the series groups implies that the user wants all non-category
 * columns to be separate series groups.
 *
 * @method
 * @memberof Graph.jQWidgets
	 */

Graph.jQWidgets.prototype.autoSeriesGroups = function (spec, data) {
	var self = this
	, defn = self.defn;

	var group = self.buildSeriesGroup();
	spec.valueAxis = self.buildValueAxis();
		group.series = [];
		_.each(data[0], function (v, k) {
			if (k !== defn.graph.categories.field) {
				group.series.push({
					dataField: k,
					displayText: k
				});
			}
		});

		return group;
};

// #buildValueAxis {{{3

/**
 * @method
 * @memberof Graph.jQWidgets
 */

Graph.jQWidgets.prototype.buildValueAxis = function () {
	var self = this
	, defn = self.defn;

	var valueAxis = {
		displayValueAxis: true,
		axisSize: 'auto'
	};

	needProp(self.error, self.defn, 'graph', 'values');

	if (getProp(defn, 'graph', 'values', 'title') === undefined && getProp(defn, 'graph', 'values', 'field') === undefined) {
		throw new InvalidReportDefinitionError('Need to specify either graph.values.title or graph.values.field to build a series group');
	}

	valueAxis.description = defn.graph.values.title || defn.graph.values.field;

	if (defn.graph.values.min !== undefined) {
	valueAxis.minValue = +defn.graph.values.min;
	}

	if (defn.graph.values.max !== undefined) {
	valueAxis.maxValue = +defn.graph.values.max;
	}

	if (defn.graph.values.step !== undefined) {
	valueAxis.unitInterval = +defn.graph.values.step;
	}

	return valueAxis;
};

// #buildSeriesGroup {{{3

	/**
 * Build a series group object from the definition.  This code is common across all graph types,
 * regardless of whether a singular series or multiple series are being used.
 *
 * @method
 * @memberof Graph.jQWidgets
	 *
	 * @param defn The definition of the graph.
	 */

Graph.jQWidgets.prototype.buildSeriesGroup = function () {
	var self = this
	, defn = self.defn;

	needPropIn(self.error, self.defn, 'graph', 'type', [
	'column',		'stackedcolumn',	   'stackedcolumn100',		 'rangecolumn',
	'line',			'stackedline',		   'stackedline100',
	'spline',		'stackedspline',	   'stackedspline100',
	'stepline',		'stackedstepline',	   'stackedstepline100',
	'area',			'stackedarea',		   'stackedarea100',		 'rangearea',
	'splinearea',	'stackedsplinearea',   'stackedsplinearea100',
	'steplinearea', 'stackedsteplinearea', 'stackedsteplinearea100',
	'pie',			'donut',
	'scatter',		'bubble',
	'candlestick',	'ohlc',
	'waterfall',	'stackedwaterfall'
	]);

		var group = {
			type: defn.graph.type,
		};

	if (getProp(defn, 'graph', 'labels') !== undefined) {
			group.showLabels = !!defn.graph.labels;
		}

		return group;
	}

// #setCategoryAxis {{{3

/**
 * @method
 * @memberof Graph.jQWidgets
 */

Graph.jQWidgets.prototype.setCategoryAxis = function (spec) {
	var self = this
	, defn = self.defn;

	var sqlType = getProp(self.defn, '_typeInfo', 0, 'byName', defn.graph.categories.field) || 'string';
		var graphType = defn.graph.categories.type || 'string';

		if (sqlType === 'date') {
			if (graphType === 'string/date') {
		_.extend(spec.xAxis, { type: 'basic', formatFunction: formatDateString });
			}
			else if (graphType === 'date') {
		_.extend(spec.xAxis, { type: 'date', formatFunction: formatDate });
			}
		}
		else if (sqlType === 'datetime') {
			if (graphType === 'string/date') {
				_.extend(spec.xAxis, {
					type: 'basic',
					formatFunction: formatDateString
				});
			}
			else if (graphType === 'string/datetime') {
				_.extend(spec.xAxis, {
					type: 'basic',
					formatFunction: formatDateTimeString
				});
			}
			else if (graphType === 'date') {
				_.extend(spec.xAxis, {
					type: 'date',
					formatFunction: formatDate
				});
			}
			else if (graphType === 'datetime') {
				_.extend(spec.xAxis, {
					type: 'date',
					formatFunction: formatDateTime
				});
			}
		}
};

// #stackConversion {{{3

	/**
 * Convert data into a format readily consumable by the stacked bar chart type in jQWidgets.
 *
 * @method
 * @memberof Graph.jQWidgets
	 *
 * @param {array} data The original data.
	 *
 * @param {string} field Name of the field to use from the source object, the value of which
 * becomes the field in the converted object. For example, if you use something like the
 * "visit_type" field of a representation of an encounter, then the converted object will
 * contain fields like "IC", "PHYS", etc.
		 *
 * @param {string} label Field containing the value to display instead of the field.  Continuing
 * the example above, using "description" might show "Initial Inpatient Consultation" and
 * "Physical Exam" in the output.
 *
 * @param {string} disc Discriminant used to determine if different objects should be grouped
 * together. To group by date, for example, maybe something like "serv_date" is warranted.
 *
 * @param {string} value Name of the field from the source object which contains the value. When
 * doing grouping with totals, name your count(*) output field "total" and use "total" here, for
 * example.
		 *
 * @param {object} spec The jQWidgets spec object to modify.
		 *
 * @param {function} cmp Function used to compare the discriminant field; if this function
 * returns true the two discriminant values are equivalent. If not provided, simple JavaScript
 * type-identical equality will be used.
		 */

// For all examples in this code, let's assume that two separate sources generate report results
// that look like this (trust me, this makes things a lot easier):
//
// Source 0
// ========================================
//
// |	   date | visit_type | encounters |
// |------------+------------+------------|
// | 2010-10-10 | alpha		 |		   20 |
// | 2010-10-10 | beta		 |			5 |
// | 2011-11-11 | alpha		 |		   30 |
// | 2011-11-11 | beta		 |		   15 |
//
// Source 1
// ========================================
//
// |	   date | visit_type | encounters |
// |------------+------------+------------|
// | 2010-10-10 | alpha		 |		   80 |
// | 2010-10-10 | beta		 |		   35 |
// | 2011-11-11 | alpha		 |		   90 |
// | 2011-11-11 | beta		 |		   45 |
//
// At this point, the data for a multiple-series graph will look like this:
//
// data = [
//	 {date: '2010-10-10', ':0:visit_type': 'alpha', ':0:encounters': 20},
//	 {date: '2010-10-10', ':0:visit_type':	'beta', ':0:encounters':  5},
//	 {date: '2011-11-11', ':0:visit_type': 'alpha', ':0:encounters': 30},
//	 {date: '2011-11-11', ':0:visit_type':	'beta', ':0:encounters': 15},
//	 {date: '2010-10-10', ':1:visit_type': 'alpha', ':1:encounters': 80},
//	 {date: '2010-10-10', ':1:visit_type':	'beta', ':1:encounters': 35},
//	 {date: '2011-11-11', ':1:visit_type': 'alpha', ':1:encounters': 90},
//	 {date: '2011-11-11', ':1:visit_type':	'beta', ':1:encounters': 45}
// ];
//
// First thing we do is sort it by 'date' which is the category field. That gives us this:
//
// data = [
//	 {date: '2010-10-10', ':0:visit_type': 'alpha', ':0:encounters': 20},
//	 {date: '2010-10-10', ':0:visit_type':	'beta', ':0:encounters':  5},
//	 {date: '2010-10-10', ':1:visit_type': 'alpha', ':1:encounters': 80},
//	 {date: '2010-10-10', ':1:visit_type':	'beta', ':1:encounters': 35},
//	 {date: '2011-11-11', ':0:visit_type': 'alpha', ':0:encounters': 30},
//	 {date: '2011-11-11', ':0:visit_type':	'beta', ':0:encounters': 15},
//	 {date: '2011-11-11', ':1:visit_type': 'alpha', ':1:encounters': 90},
//	 {date: '2011-11-11', ':1:visit_type':	'beta', ':1:encounters': 45}
// ];
//
// Next we need to do the proper "stack conversion" that will end up giving us the data that we
// really need.
//
// data = [
//	 {date: '2010-10-10', ':0:alpha': 20, ':0:beta':  5, ':1:alpha': 80, ':1:beta': 35},
//	 {date: '2011-11-11', ':0:alpha': 30, ':0:beta': 15, ':1:alpha': 90, ':1:beta': 45}
// ];
//
// If we're only dealing with a single series then we're done. BUT if we're doing multiple series
// then we need to define those series groups. We need to have the configuration for the graph end
// up like this:
//
// seriesGroups: [{
//	 series: [
//	   {dataField: ':0:alpha', displayText: 'alpha'},
//	   {dataField:	':0:beta', displayText:  'beta'}
//	 ]
// }, {
//	 series: [
//	   {dataField: ':1:alpha', displayText: 'alpha'},
//	   {dataField:	':1:beta', displayText:  'beta'}
//	 ]
// }]

Graph.jQWidgets.prototype.stackConversion = function (data, spec, cont) {
	var self = this
	, defn = self.defn
	, field = defn.graph.stack.field
	, label = defn.graph.stack.label
	, disc = defn.graph.stack.discriminant
	, value = defn.graph.stack.value
	, cmp = defn.graph.stack.comparison;

	if (typeof cont !== 'function') {
	throw new InvalidCallError('<cont> must be a function');
	}

	function stackConversionCB(data) {
	var categories = [];
	var newData = [];
	var lastDisc = null;
	var lastObj = null;
	var i, j, k, key, obj; // iterators
	var srcIndex, dataIndex, datum;
	var enumValue;
	var enumLabel;
	var fieldKey, valueKey;
	var dataLen = data.length;

	// Loop through every source, then through every data object in order to determine the set of
	// possible values for that specific source. At the end of this, we'll be able to tell that
	// (for example) source 0 contained two different visit types, but source 1 contained five
	// different visit types. When we're using multiple series, we configure the graph using this
	// data (separated for each source). With just a single series we merge all the data together
	// and configure a single series in the graph for all sources.

	for (srcIndex = 0; srcIndex < defn._sourceCount; srcIndex += 1) {
		var seriesIndex = defn.dataSeries === 'single' ? 0 : srcIndex;
		var group = spec.seriesGroups[seriesIndex];
		if (!group) {
		// We haven't visited this series group before, so we need to build the basic structure
		// first.

		spec.seriesGroups[seriesIndex] = self.buildSeriesGroup();
		spec.valueAxis = self.buildValueAxis();
		group = spec.seriesGroups[seriesIndex];
		}
		if (!_.isArray(group.series)) {
		group.series = [];
		categories[seriesIndex] = {};
		}
		for (dataIndex = 0; dataIndex < dataLen; dataIndex += 1) {
		if (defn.dataSeries === 'single') {
			key = field;
			datum = data[dataIndex];
			enumValue = datum[key];
			enumLabel = datum[label];
		}
		else {
			key = addSrcInfo(srcIndex, field);
			datum = data[dataIndex];
			enumValue = addSrcInfo(srcIndex, datum[key]);
			enumLabel = datum[addSrcInfo(srcIndex, label)];
		}
		if (datum[key] === undefined || datum[key] === null) {
			// Most likely this is because the source didn't get processed, or
			// didn't return any results. Could also be because there's a
			// mistake and the field is wrong, but we wouldn't be able to tell.
			continue;
		}
		else if (datum[key].toString() !== '' && !categories[seriesIndex][enumValue]) {
			categories[seriesIndex][enumValue] = true;
			group.series.push({
			dataField: enumValue,
			displayText: enumLabel
			});
		}
		}
	}
	// Go through all the data and build the converted objects.
	function storeObj() {
		if (lastObj !== null) {
		// Fill in any categories that are missing with zero. I'm not sure
		// that this is strictly necessary, but the jQWidgets examples do
		// this, and it does make the objects a little more readable when
		// you're debugging them. We may need to revisit this strategy though,
		// as it means that objects cannot be "sparse" and as the number of
		// categories increases, the amount of memory we waste also increases.
		if ((_.isUndefined(defn.graph.stack.addZeroFields) && defn.graph.type !== 'stackedcolumn') || defn.graph.stack.addZeroFields) {
			for (srcIndex = 0; srcIndex < defn._sourceCount; srcIndex += 1) {
			for (k in categories[srcIndex]) {
				if (!_.isNumber(lastObj[k])) {
				lastObj[k] = 0;
				}
			}
			}
		}
		newData.push(lastObj);
		}
	}
	for (dataIndex = 0; dataIndex < dataLen; dataIndex += 1) {
		datum = data[dataIndex];
		if (lastDisc === null || cmp(datum[disc], lastDisc) !== 0) {
		// The discriminant has changed, which means that we need to store the
		// information accumulated from all prior objects with the previous
		// discriminant.
		storeObj();
		lastObj = {};
		lastObj[disc] = datum[disc];
		lastDisc = datum[disc];
		}
		// Go through all the sources and save the value for each field, per
		// source. The result (which we'll turn around and store when the
		// discriminant changes), is an object that contains a property for each
		// category in each source.
		for (srcIndex = 0; srcIndex < defn._sourceCount; srcIndex += 1) {
		if (defn.dataSeries === 'single') {
			fieldKey = field;
			valueKey = value;
			enumValue = datum[fieldKey];
		}
		else {
			fieldKey = addSrcInfo(srcIndex, field);
			valueKey = addSrcInfo(srcIndex, value);
			enumValue = addSrcInfo(srcIndex, datum[fieldKey]);
		}
		if (_.isString(datum[fieldKey]) || _.isNumber(datum[fieldKey])) {
			lastObj[enumValue] = +datum[valueKey];
		}
		}
	}
	storeObj();
	return cont(newData);
	}
	cmp = cmp || universalCmp;
	mergeSort(data, cmpObjField([disc], cmp), stackConversionCB);
}

// #stackedGraph {{{3

/**
 * @method
 * @memberof Graph.jQWidgets
 */

Graph.jQWidgets.prototype.stackedGraph = function (data, spec, cont) {
	var self = this
	, exn = curryCtor(GraphError, self.defn);

	if (typeof cont !== 'function') {
	throw new InvalidCallError('<cont> must be a function');
	}

	needProp(exn, self.defn, 'graph', 'stack', 'field');
	needProp(exn, self.defn, 'graph', 'stack', 'discriminant');
	needProp(exn, self.defn, 'graph', 'stack', 'value');

	// Reuse the field value as the label value if no label is specified.

	if (!self.defn.graph.stack.label) {
	self.defn.graph.stack.label = self.defn.graph.stack.field;
	}

	return self.stackConversion(data, spec, function (data) {
	if (self.defn.graph.stack.callback) {
		self.defn.graph.stack.callback(data, spec);
	}
	spec.source = data;
	_.each(spec.seriesGroups, function (g) {
		g.click = function (e) {
		var x = data[e.elementIndex][spec.xAxis.dataField];
		var y = e.elementValue;
		var s = e.serie.dataField;
		log.info(e);
		log.info(data);
		log.info(data[e.elementIndex]);
		log.info('data[%s][%s] = %s', x, s, y);
		};
	});
	return cont(spec);
	});
}

// #normalGraph {{{3

/**
 * @method
 * @memberof Graph.jQWidgets
 */

Graph.jQWidgets.prototype.normalGraph = function (data, spec, cont) {
	var self = this
	, defn = self.defn;

	function buildSeriesGroupsNonStacked() {

					// We're building a non-stacked graph with potentially multiple series deriving from
					// different sources.

					for (var srcIndex = 0; srcIndex < defn._sourceCount; srcIndex += 1) {
						var seriesIndex = defn.dataSeries === 'single' ? 0 : srcIndex;
						var group = spec.seriesGroups[seriesIndex];
						if (!group) {

							// We haven't visited this series group before, so we need to build the basic
							// structure first.

		spec.seriesGroups[seriesIndex] = self.buildSeriesGroup();
		spec.valueAxis = self.buildValueAxis();
							group = spec.seriesGroups[seriesIndex];
						}
						if (!_.isArray(group.series)) {
							group.series = [];
						}
						var seriesObj = {};
						if (defn.dataSeries === 'single') {
							seriesObj.dataField = defn.graph.values.field;
						}
						else {
							seriesObj.dataField = addSrcInfo(srcIndex, defn.graph.values.field);
						}
						// For pie charts, the 'displayText' property contains the name of
						// the field to use in the legend.
						if (defn.graph.type === 'pie') {
							var _srcIndex = srcIndex;
							seriesObj.displayText = defn.graph.categories.field;
							seriesObj.formatFunction = function (a, b) {
								// jQWidgets uses this function both for generating the labels that go on the graph,
								// and for generating the elements of the legend.  With a pie chart, the arguments
								// look like this:
								//
								//   Label: (value, index)
								//   Legend: (category, index)
								//
								// Thus we need to handle these cases separately.  We assume that if we get two
								// integers, then we're being called to produce a label.  Otherwise, we're being
								// called to produce an item in the legend.
								if (isInt(a) && isInt(b)) {
									if (defn.graph.labels && defn.graph.labels.pie && defn.graph.labels.pie.showCategory) {
										return defn._data[_srcIndex][b][defn.graph.categories.field] + ' (' + a + ')';
									}
									else {
										return a;
									}
								}
								else {
									return a + ' (' + defn._data[_srcIndex][b][seriesObj.dataField] + ')';
								}
							};
						}
						else {
							seriesObj.displayText = defn.graph.values.title || defn.graph.values.field;
						}
						group.series.push(seriesObj);
					}
				}
				if (!defn.graph.values.field) {
					defn.error('Graph definition for non-stacked graph needs [values.field] definition');
				}
				buildSeriesGroupsNonStacked();
				_.each(spec.seriesGroups, function (sg) {
					_.each(sg.series, function (s) {
						// For pie charts, set the initial angle to make it look more like the
						// kinds of pie charts that Excel produces.
						if (sg.type === 'pie') {
							_.extend(s, {
								initialAngle: 90
							});
						}
					});
				});
				spec.source = data;
	return cont(spec);
};

// #generateSpec {{{3

/**
 * @method
 * @memberof Graph.jQWidgets
 */

Graph.jQWidgets.prototype.generateSpec = function (data, spec, cont) {
	var self = this
	, defn = self.defn;

	self.setCategoryAxis(spec);

			// For stacked graph types, automatically perform conversion from a relational database result
			// to the result (unless the report definition has set [autoStackConversion] = false).

			if (/^stacked/.test(defn.graph.type)) {
				if (defn.graph.autoStackConversion !== false) {
		return self.stackedGraph(data, spec, cont);
				}
				else {
					// Why you would ever want to do this is beyond me, but it is allowed to have the user
		// perform their own conversion for stacked data.  This dates back to when this library was
		// new.  Nowadays, the auto conversion is so useful, you probably just want to take
					// advantage of it.

					spec.source = data;
		spec.seriesGroups = [self.autoSeriesGroups(spec, data)];
		return cont(spec);
				}
			}
			else {
	return self.normalGraph(data, spec, cont);
		}
};

// #autoGroup {{{3

/**
 * Perform auto-grouping on the data, if that's what the user asked for.  When we do
 * auto-grouping, we construct a new graph instead of the one we were going to do.
 *
 * @method
 * @memberof Graph.jQWidgets
 *
 * @param function cont Zero-arity function that is the continuation to perform if there is no
 * auto-grouping.
 */

Graph.jQWidgets.prototype.autoGroup = function (cont) {
	var self = this
	, defn = self.defn;

	var dga, dgaa, dgas, aggregates, sortSpec = null;

	if (getProp(defn, 'graph', 'autoGroup') === undefined) {
	return cont();
			}

	needPropObj(self.error, self.defn, 'graph', 'autoGroup');
	needPropArr(self.error, self.defn, 'graph', 'autoGroup', 'groups');

	debug.info('AUTOGROUP', 'Performing auto-group for: [' + self.defn.graph.autoGroup.groups.join(', ') + ']');

	// When the user asks us to do the grouping for them (e.g. when they are using a details system
	// report to get the data, but want to show a graph of counts grouped by category), send the
	// definition and data through the appropriate function.	Then we're going to go through the whole
	// thing over again, only this time using the cached data that we just fetched and then grouped.
	// We have to remove the directive to automatically group the data, because we already did that.

	dga = defn.graph.autoGroup;

	if (dga.aggregate === undefined) {
	dga.aggregate = {
		fun: 'count'
	};
		}

	checkAggregate(defn, dga.aggregate, 'graph.autoGroup.aggregate');

	dgaa = dga.aggregate;
	aggregates = [dgaa];

	if (dga.sort !== undefined) {
	needPropObj(self.error, self.defn, 'graph', 'autoGroup', 'sort');
	dgas = dga.sort;
	if (dgas.field !== undefined) {
		if (dgas.type === undefined && dgas.field === dgaa.displayText) {
		dgas.type = Aggregates[dgaa.fun].type;
				}
		sortSpec = dgas;
			}
	else if (dgas.aggregate !== undefined) {
		checkAggregate(defn, dgas.aggregate, 'graph.autoGroup.sort.aggregate');
		aggregates.push(dgas.aggregate);
		sortSpec = {
		field: dgas.aggregate.displayText,
		type: dgas.type || Aggregates[dgas.aggregate.fun].type,
		order: dgas.order
		};
	}
	else {
		throw new self.error('Property [graph.autoGroup.sort] must contain either "field" or "aggregate" property');
				}
			}

	var newDefn = groupGraph(defn, dga.groups, aggregates);
	newDefn.graph.values.min = 0;

	if (sortSpec === null) {
	delete newDefn.graph.autoGroup;
	self.defn = newDefn;
	debug.info('GRAPH // AUTO-GROUP', 'Calling draw() with new definition');
	return self.draw();
	}
	else {
	return sort(newDefn._data[0], sortSpec, function (data) {
		newDefn._data = [data];
		delete newDefn.graph.autoGroup;
		self.defn = newDefn;
		debug.info('GRAPH // AUTO-GROUP', 'Calling draw() with new definition after sort');
		return self.draw();
		});
		}
};

// #draw {{{3

/**
 * @method
 * @memberof Graph.jQWidgets
 */

Graph.jQWidgets.prototype.draw = function (cont) {
	var self = this
	, defn = self.defn;

	function buildGraph(spec) {
	self.div.children().remove();
	debug.info('FINAL CONFIG', spec);
	self.div.jqxChart(spec);

	// Unblock the graph now that we're done building it. Of course, jQWidgets might not be done
	// rendering it, but we don't have any way to hook into that event.

	self.div.unblock();

	if (typeof cont === 'function') {
		cont();
	}
		}

	init(function () {
	var generateGraphUserCont = cont;

	// If blockUI is available in the page, block off the graph div before proceeding (so that it
	// is blocked while we're getting the data and manipulating it).

	self.div.block(BLOCK_CONFIG);

		// This is the least common denominator for the jqxChart specification.

		var baseSpec = {
			description: '',
			enableAnimations: true,
			showLegend: true,
			padding: {
				left: 5,
				top: 5,
				right: 5,
				bottom: 5
			},
			xAxis: {
				textRotationAngle: -90,
				textRotationPoint: 'right',
				verticalTextAlignment: 'left',
				textOffset: {
					x: 0,
					y: 8
				}
			},
			seriesGroups: []
		};

		var spec = baseSpec;

		/*
		 * Graph Title and Subtitle
		 */

		if (!defn.graph.title) {
			defn.error('Graph spec is missing title');
		}

		spec.title = defn.graph.title;

		if (defn.graph && defn.graph.subtitle) {
			if (!_.isString(defn.graph.subtitle)) {
				throw defn.error('Graph subtitle is not a string');
			}
			spec.description = defn.graph.subtitle;
		}

		// Extend the base spec with customization from the report definition if the definition
		// specifies an extension object.

		if (defn.extension) {
			spec = _.extend(baseSpec, defn.extension);
		}

		if (!_.isString(defn.dataSeries)) {
			defn.dataSeries = 'single';
		}
		if (defn.dataSeries !== 'single' && defn.dataSeries !== 'multiple') {
			throw defn.error(new InvalidReportDefinitionError('dataSeries', defn.dataSeries, 'must be either "single" or "multiple"'));
		}
		defn.graph = defn.graph || {};

		/*
		 * Legend Configuration
		 */

		if (defn.dataSeries === 'single' && !(/^stacked/.test(defn.graph.type)) && defn.graph.type !== 'pie') {
			spec.showLegend = false;
		}
		if (!_.isUndefined(defn.graph.legend)) {
			spec.showLegend = !!defn.graph.legend;
		}
		if (_.isString(defn.graph.legend)) {
			spec.legendLayout = defn.graph.legend;
		}

		// Make sure that when the user has asked us to group things automatically, they're not telling
		// us something else contradictory.  We outlaw the following things:
		//
		//   - category axis configuration
		//   - value axis configuration
		//   - graph type other than bar, column, and pie
		//   - multiple series

		if (defn.graph.autoGroup) {
			if (defn.graph.categories && defn.graph.categories.field) {
		throw new self.error('Cannot use both [autoGroup] and [categories.field] at the same time');
			}
			if (defn.graph.values && defn.graph.values.field) {
		throw new self.error('Cannot use both [autoGroup] and [values.field] at the same time');
			}
			if (defn.graph.type !== 'bar' && defn.graph.type !== 'column' && defn.graph.type !== 'pie') {
		throw new self.error('Cannot use [autoGroup] with a graph that is not a bar, column, or pie chart');
			}
			if (defn.dataSeries !== 'single') {
		throw new self.error('Cannot use [autoGroup] with multiple data series');
			}
		}
		else {
			if (!defn.graph.categories) {
				return defn.error('Report definition missing [categories]');
			}
			if (_.isUndefined(defn.graph.categories.field)) {
				return defn.error('Report definition missing [categories.field]');
			}
			spec.xAxis.dataField = defn.graph.categories.field;
		}

		if (defn.graph.categories) {
			spec.xAxis.title = {
				text: defn.graph.categories.title || defn.graph.categories.field
			};
			if (defn.graph.categories.type === 'date') {
				_.extend(spec.xAxis, {
					type: 'date',
					baseUnit: defn.graph.categories.unit,
					formatFunction: defn.graph.categories.format
				});
			}
			else if (defn.graph.categories.type === 'string') {
				if (defn.graph.categories.format) {
					_.extend(spec.xAxis, {
			formatFunction: defn.graph.categories.format
					});
				}
		spec.xAxis.type = 'basic';
			}
		}

		if (defn._data) {
			debug.info('GRAPH // DRAW', 'Using existing data for graph');
			defn._sourceCount = defn._sourceCount || 1;
			return self.autoGroup(function () {
				return self.generateSpec(_.flatten(defn._data), spec, buildGraph);
			});
		}
		else {
			debug.info('GRAPH // DRAW', 'Retrieving data for graph');
			return getData(defn, function (allSources) {
				var data = allSources.data
					, typeInfo = allSources.typeInfo
					, uniqElts = allSources.uniqElts
					, displayName = allSources.displayName;
				storeDataInDefn(defn, data, typeInfo, uniqElts, displayName, function () {
					defn._sourceCount = allSources.length;
					return self.autoGroup(function () {
						return self.generateSpec(_.flatten(defn._data), spec, buildGraph);
					});
				});
			});
		}
	});
};

// Graph.Google {{{2

/**
 * @memberof wcgraph
 * @class
 *
 * @param graph
 */

Graph.Google = function (graph) {
	var self = this;

	self.error = curryCtor(GraphError.GoogleError, graph.defn);

	self.defn = needProp(self.error, graph, 'defn');
	self.div = needPropInst(self.error, graph, 'div', jQuery);
	self.source = needPropInst(self.error, graph, 'source', DataSource);
};

Graph.Google.prototype.constructor = Graph.Google;

// #timeline {{{3

Graph.Google.prototype.timeline = function () {
	var self = this
	, rowLabel = needProp(self.error, self.defn, 'graph', 'timeline', 'row_label')
	, barLabel = needProp(self.error, self.defn, 'graph', 'timeline', 'bar_label')
	, rangeStart = needProp(self.error, self.defn, 'graph', 'timeline', 'range_start')
	, rangeEnd = needProp(self.error, self.defn, 'graph', 'timeline', 'range_end');

	self.source.getData(function (data) {
	var newData = [];

	_.each(data, function (row, rowNum) {
		var start, end;

		if (row[rowLabel] === undefined) {
		throw new GraphError(self.defn, 'Row label field "' + rowLabel + '" does not exist in data on row ' + rowNum);
		}
		if (row[barLabel] === undefined) {
		throw new GraphError(self.defn, 'Bar label field "' + barLabel + '" does not exist in data on row ' + rowNum);
		}
		if (row[rangeStart] === undefined) {
		throw new GraphError(self.defn, 'Range start field "' + rangeStart + '" does not exist in data on row ' + rowNum);
		}
		if (row[rangeEnd] === undefined) {
		throw new GraphError(self.defn, 'Range end field "' + rangeEnd + '" does not exist in data on row ' + rowNum);
	}

		var start = new Date(row[rangeStart]);
		var end = new Date(row[rangeEnd]);

		if (getPropDef(false, self.defn, 'graph', 'timeline', 'fixBackwardsRange') && start > end) {
		newData.push([row[rowLabel] + '', row[barLabel] + '', end, start]);
		}
		else {
		newData.push([row[rowLabel] + '', row[barLabel] + '', start, end]);
		}
	});

	var chart = new google.visualization.Timeline(self.div[0]); // Want the element itself, not the jQuery wrapper.
	var dataTable = new google.visualization.DataTable();

	dataTable.addColumn({id: rowLabel, type: 'string'});
	dataTable.addColumn({id: barLabel, type: 'string'});
	dataTable.addColumn({id: rangeStart, type: 'date'});
	dataTable.addColumn({id: rangeEnd, type: 'date'});

	dataTable.addRows(newData);

	chart.draw(dataTable);
		});
};

// #draw {{{3

Graph.Google.prototype.draw = function () {
	var self = this
	, type = needPropIn(self.error, self.defn, 'graph', 'type', ['timeline']);

	if (self.source === undefined) {
	throw new GraphError(self.defn, 'Google Charts requires using a data source');
	}

	self[type]();
};

// <WCGRAPH> {{{1

/**
 * @typedef wcgraph_tagOpts
 * @type {object}
 * @property {boolean} [runImmediately=true] If true, then show the graph immediately.
 * @property {number} [height] If present, sets the height of the graph.
 * @property {string} [title] If present, create a title bar for the graph.
 * @property {string} [helpText] If present, create a help bubble with this text.
 */

/**
 * Create a new graph.
 *
 * @global
 *
 * @param {string} id
 * @param {object} defn
 * @param {object} tagOpts
 * @param {function} cb
 *
 * @class
 * @property {string} id The ID of the div that contains the whole tag output.
 * @property {object} defn The definition object used to create the graph.
 * @property {wcgraph_tagOpts} tagOpts Options for the graph's container.
 */

// Constructor {{{2

var WCGraph = function (id, defn, tagOpts, cb) {
	var self = this;

	var tagContainer        = null; // Container div for the contents of the whole tag.
	var graphContainer      = null; // Container div for the graph.
	var graphToolBar        = null;
	var graphToolBarHeading = null;
	var graphToolBarButtons = null;

	// Clean up the inputs that we received.

	normalizeDefn(defn);

	// Set default options.

	if (tagOpts === undefined) {
		tagOpts = $.extend(true, {}, {
			runImmediately: true
		});
	}

	// Initialize member properties.

	self.id         = id;      // ID of the div that contains the whole tag output.
	self.defn       = defn;    // Definition used to retrieve data and output grid.
	self.tagOpts    = tagOpts; // Other tag options, not related to the grid.
	self.graph      = null;    // List of all graphs generated as a result.
	self.ui         = {};      // User interface elements.

	// If the ID was specified as a jQuery object, extract the ID from the element.

	if (_.isArray(id) && id[0] instanceof jQuery) {
		id = id[0];
	}

	if (id instanceof jQuery) {
		id = id.attr('id');
	}

	// Sanity check ID and make sure element exists.

	if (typeof id !== 'string') {
		throw '<wcgraph> "id" is not a string';
	}

	if (document.getElementById(id) === null) {
		throw 'No element exists with given ID: ' + id;
	}

	defn.graph.id = id + '_graphContainer';

	/*
	 * Set up other container elements.
	 */

	tagContainer = jQuery(document.getElementById(id));
	self.ui.graphContainer = jQuery('<div>', {
		id: defn.graph.id,
		height: tagOpts.height
	});
	tagContainer.addClass('graphwrapper');
	tagContainer.attr('data-title', id + '_title');

	if (tagOpts.title) {
		if (!_.isString(tagOpts.title)) {
			throw '<tagOpts.title> is not a string';
		}
		graphToolBar = jQuery('<div class="graphtoolbar">').appendTo(tagContainer);
		graphToolBarHeading = jQuery('<div class="heading">')
			.attr('title', mietrans('SHOWHIDE'))
			.on('click', function (evt) {
				evt.stopPropagation();
				self.toggleGraph();
			})
			.appendTo(graphToolBar);
		graphToolBarButtons = jQuery('<div class="buttons">').appendTo(graphToolBar);

		self._addHeaderWidgets(graphToolBarHeading, !!self.tagOpts.runImmediately, id);
		self._addCommonButtons(graphToolBarButtons);
	}

	self.ui.graphContainer.appendTo(tagContainer);

	self.graphDoneCont = function (graph) {
		self.graph = graph;
	};

	self.allDoneCont = function (numTables) {
		if (typeof cb === 'function') {
			cb(self.grid);
		}
	};

	if (self.tagOpts.runImmediately) {
		self.showGraph();
	}
	else {
		self.hasRun = false;
		self.hideGraph();
	}

	if (self.defn.source instanceof DataSource) {
		self.defn.source.subscribe(function () {
			var args = Array.prototype.slice.call(arguments);
			var ds = args[0]
				, msg = args[1]
				, rest = args.slice(2);

			debug.info('WCGRAPH', 'Received message "%s" from data source "%s": %O', msg, ds.name, rest);
			switch (msg) {
			case DataSource.messages.DATA_UPDATED:
				self.refresh();
				break;
			}
		});
	}

	/*
	 * Store self object so it can be accessed from other JavaScript in the page.
	 */

	window.wcgraph = window.wcgraph || {};
	window.wcgraph[id] = self;
};

// #addHeaderWidgets {{{2

WCGraph.prototype._addHeaderWidgets = function (header, runImmediately, id) {
	var self = this;
	var notHeader = jQuery('<span>', {'class': 'headingInfo'})
		.on('click', function (evt) {
			evt.stopPropagation();
		});

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

	notHeader.appendTo(header);

	self.ui.showHideButton = jQuery('<button type="button">')
		.append(fontAwesome(runImmediately ? 'f077' : 'f078'))
		.addClass('showhide pull-right')
		.attr('title', mietrans('SHOWHIDEOPTS'))
		.click(function (evt) {
			evt.stopPropagation();
			self.toggleGraph();
		})
		.appendTo(header);

	// Create the down-chevron button that opens the grid toolbar.

	jQuery('<button type="button">')
		.append(fontAwesome('f013'))
		.addClass('showhide pull-right')
		.attr('title', mietrans('SHOWHIDEOPTS'))
		.click(function (evt) {
			evt.stopPropagation();
			jQuery(this).parents('.graphwrapper').find('.buttons').toggle();
		})
		.appendTo(header);
};

// #addCommonButtons {{{2

WCGraph.prototype._addCommonButtons = function (toolbar) {
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

// #refresh {{{2

WCGraph.prototype.refresh = function () {
	var self = this;

	if (!self.isGraphVisible()) {
		return;
	}

	delete self.defn._data;

	self.graph = new Graph(self.defn);
	self.graph.draw(self.allDoneCont);
};

// #redraw {{{2

WCGraph.prototype.redraw = function () {
	var self = this;

	if (!self.isGraphVisible()) {
		return;
	}

	// Make sure that there's a graph to redraw.

	if (self.graph === undefined) {
		self.graph = new Graph(self.defn);
	}

	self.graph.draw(self.allDoneCont);
};

// #hideGraph {{{2

WCGraph.prototype.hideGraph = function () {
	var self = this;
	self.ui.graphContainer.slideUp({
		done: function () {
			if (self.tagOpts.title) {
				self.ui.showHideButton.removeClass('open').html(fontAwesome('f078'));
			}
		}
	});
};

// #showGraph {{{2

WCGraph.prototype.showGraph = function () {
	var self = this;
	self.ui.graphContainer.slideDown({
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

// #toggleGraph {{{2

WCGraph.prototype.toggleGraph = function () {
	if (this.ui.graphContainer.css('display') === 'none') {
		this.showGraph();
	}
	else {
		this.hideGraph();
	}
};

// #isGraphVisible {{{2

WCGraph.prototype.isGraphVisible = function () {
	return this.ui.graphContainer.css('display') !== 'none';
};

	// Other Stuff {{{1

	/**
	 * Construct a new hidden input. Just a convenience function to remove a few extra lines of code
	 * every time we want to build a hidden input.
	 *
	 * @param {string} name Name of the input element.
	 * @param {string} value Value for the input element.
	 *
	 * @return {object} The jQuery-wrapped DOM node created.
	 */

	function buildHiddenInput(name, value) {
		return jQuery('<input>', {
			type: 'hidden',
			name: name,
			value: value
		});
	}

	/**
	 * Constructs a form that can be used to POST a request to run a system report using specified
	 * filters.
	 *
	 * @param {object} src The report definition source for the system report we want to run. Only the
	 * name is really used. Supplying a source that doesn't get its data from a system report will
	 * result in an error.
	 *
	 * @return {object} A jQuery-wrapped DOM node for the form element built. You can add more inputs
	 * to it using buildHiddenInput() to set filter values.
	 */

	function buildSubmissionForm(src) {
		if (src.type !== 'report') {
			throw 'Unable to build submission form for non-report source';
		}
		if (!_.isObject(src.filterSet)) {
			throw 'Unable to build submission form without filterSet';
		}
		var form = src.filterSet.buildForm().attr({
			target: '_blank'
		});
		_.each({
			f: 'admin',
			s: 'system_report',
			opp: 'query',
			submit_query: 'yup',
			report_name: src.name
		}, function (val, key) {
			form.append(buildHiddenInput(key, val));
		});
		return form;
	}

	function removeColumns(defn, data, cols) {
		_.each(data, function (srcData, srcDataIndex) {
			_.each(srcData, function (row, rowIndex) {
				_.each(cols, function (value, colName) {
					if (defn.dataSeries === 'multiple') {
						if (!defn._abstractDataCols[colName]) {
							// The filter is not a registered abstract column name, so it's probably something the
							// user added later, and not a column coming directly out of the report. Just try to
							// delete it.
							delete row[colName];
						}
						else {
							// The filter is registered as an abstract column name, so we need to remove any
							// corresponding sourced columns from the data before we can display it.
							_.each(defn._abstractDataCols[colName], function (realCol) {
								delete row[realCol];
							});
						}
					}
					else {
						delete row[colName];
					}
				});
			});
		});
	}
	/**
	 * Display the filters that the user has set for each source. If a source contains a filter that
	 * is identical for the previous source, it will be omitted. If a source has no filters (or no
	 * different filters) then it is omitted completely. Sources are numbered, so you can see which
	 * filters applied for each source.
	 */
	function repetitiveFilterIsRepetitive(defn) {
		var sourceParams = [];
		var i;
		for (i = 0; i < defn.source.length; i += 1) {
			if (defn.source[i].filterSet) {
				sourceParams.push({
					arr: defn.source[i].filterSet.filters,
					obj: defn.source[i].filterSet.filterMap
				});
			}
			else if (defn.source[i].params) {
				sourceParams.push(getParamsFromPageToDisplay(defn.source[i].params));
			}
		}

		for (i = 0; i < sourceParams.length; i += 1) {
			var ul = jQuery('<ul>');
			var filtersToShow = 0;
			// Go through each filter. We do this using the array representation because then we're
			// guaranteed to have them come out in the same order that they're specified in the graph
			// definition. Therefore, if you want to show these in a certain order, put them in that order
			// in the graph definition.
			for (var j = 0; j < sourceParams[i].arr.length; j += 1) {
				var param = sourceParams[i].arr[j];
				var dispName = param.displayName;
				var val = param.value;
				var text = null;
				if (param.type === 'multi-autocomplete') {
					val = param.internalValue;
				}
				// If the filter value is the same as it was in the last source (keyed off the display name)
				// then just skip over this filter.
				if (i > 0 && ((_.isString(val) && val === sourceParams[i - 1].obj[dispName]) || (_.isArray(val) && arrayCompare(val, sourceParams[i - 1].obj[dispName])))) {
					continue;
				}
				if (_.isString(val) && val !== '') {
					text = val;
				}
				else if (_.isArray(val) && val.length > 0) {
					text = val.join(', ');
				}
				if (text !== null) {
					filtersToShow += 1;
					ul.append(jQuery('<li>').text(dispName + ': ' + text));
				}
			}
			if (filtersToShow > 0) {
				jQuery(document.getElementById(defn.table.id)).append(jQuery('<div>').text('Filters #' + (i + 1))).append(ul);
			}
		}
	}

// Graph {{{1

var Graph = function (id, view, opts) {
	var self = this;

	self.normalize(opts);
	
	debug.info('GRAPH', 'opts = %O', opts);
	self.renderer = new GraphRendererGoogle(id, view, opts);

	/*
	if (window.google) {
		self.renderer = new GraphRendererGoogle(id, view, opts);
	}
	else if (window.$jit) {
		self.renderer = new GraphRendererJit(id, view, opts);
	}
	*/

	self.draw();
};

Graph.prototype = Object.create(Object.prototype);
Graph.prototype.constructor = Graph;

// #draw {{{2

Graph.prototype.draw = function () {
	var self = this;

	self.renderer.draw();
}

// #normalize {{{2

Graph.prototype.normalize = function (opts) {
	_.each(['whenPlain', 'whenGroup', 'whenPivot'], function (dataFormat) {
		if (opts[dataFormat] === undefined) {
			return;
		}

		var config = opts[dataFormat];

		// Check the "graphType" property.

		if (!isNothing(config.graphType)) {
			if (!_.isString(config.graphType)) {
				throw new Error('Graph config error: data format "' + dataFormat + '": `graphType` must be a string');
			}

			if (['area', 'bar', 'column', 'pie'].indexOf(config.graphType) === -1) {
				throw new Error('Graph config error: data format "' + dataFormat + '": invalid `graphType`: ' + config.graphType);
			}
		}

		switch (config.graphType) {
		case 'area':
		case 'bar':
		case 'column':
		case 'pie':
			if (!isNothing(config.valueField) && !isNothing(config.valueFields)) {
				throw new Error('Graph config error: data format "' + dataFormat + '": can\'t define both `valueField` and `valueFields`');
			}

			// Turn the singular "valueField" into the plural "valueFields."

			if (!isNothing(config.valueField)) {
				if (!_.isString(config.valueField)) {
					throw new Error('Graph config error: data format "' + dataFormat + '": `valueField` must be a string');
				}
				config.valueFields = [config.valueField];
				delete config.valueField;
			}

			// Check the "valueFields" property, if it exists.

			if (!isNothing(config.valueFields)) {
				if (!_.isArray(config.valueFields)) {
					throw new Error('Graph config error: data format "' + dataFormat + '": `valueFields` must be an array');
				}

				_.each(config.valueFields, function (f, i) {
					if (!_.isString(f)) {
						throw new Error('Graph config error: data format "' + dataFormat + '": `valueFields[' + i + ']` must be a string');
					}
				});
			}
		}
	});
};

// GraphRenderer {{{1

GraphRenderer = makeSubclass(Object, function (id, view, opts) {
	var self = this;

	self.id = id;
	self.view = view;
	self.opts = opts;
	self.addRedrawHandlers();
});

// #addRedrawHandlers {{{2

GraphRenderer.prototype.addRedrawHandlers = function () {
	var self = this;

	self.view.on(View.events.workEnd, function () {
		debug.info('GRAPH RENDERER // HANDLER (View.workEnd)',
							 'Redrawing graph because the view has finished doing work');
		self.draw();
	}, {
		who: self
	});
};

// GraphRendererGoogle {{{1

GraphRendererGoogle = makeSubclass(GraphRenderer);

// #draw_plain {{{2

GraphRendererGoogle.prototype.draw_plain = function (data, typeInfo, dt) {
	var self = this
		, graphConfig;

	var convertType = function (t) {
		switch (t) {
		case 'currency':
			return 'number';
		default:
			return t;
		}
	};

	if (self.opts.whenPlain === undefined) {
		debug.info('GRAPH RENDERER', 'No graph configuration defined for plain data');
		return;
	}

	graphConfig = self.opts.whenPlain;

	dt.addColumn(convertType(typeInfo.get(graphConfig.categoryField).type), graphConfig.categoryField);

	_.each(graphConfig.valueFields, function (field) {
		dt.addColumn(convertType(typeInfo.get(field).type), field);
	});

	var getRealValue = function (f, x) {
		if (typeInfo.get(f).type === 'date' && moment.isMoment(x.value)) {
			return {v: x.value.toDate(), f: x.orig};
		}
		else if (['number', 'currency'].indexOf(typeInfo.get(f).type) >= 0 && numeral.isNumeral(x.value)) {
			return {v: x.value._value, f: x.orig};
		}
		else {
			return x.value;
		}
	};

	_.each(data.data, function (row) {
		var newRow;

		newRow = _.map([graphConfig.categoryField].concat(graphConfig.valueFields), function (f) {
			return getRealValue(f, row.rowData[f]);
		});

		dt.addRow(newRow);
	});

	return graphConfig;
};

// #draw_group {{{2

GraphRendererGoogle.prototype.draw_group = function (data, typeInfo, dt) {
	var self = this
		, graphConfig;

	graphConfig = deepCopy(self.opts.whenGroup || {});
	_.defaults(graphConfig, {
		graphType: 'column',
		categoryField: data.groupFields[0],
		valueFields: [{
			name: 'Count',
			aggFun: 'count'
		}]
	});

	// dt.addColumn(typeInfo.get(graphConfig.categoryField).type, graphConfig.categoryField);
	dt.addColumn('string', graphConfig.categoryField);

	_.each(graphConfig.valueFields, function (f) {
		var agg, aggType;

		if (typeof f === 'string') {
			dt.addColumn(typeInfo.get(f).type, f);
		}
		else if (typeof f === 'object') {
			if (f.aggFun) {
				agg = AGGREGATE_REGISTRY.get(f.aggFun);

				if (agg.type) {
					aggType = agg.type;
				}
				else if (f.aggField) {
					aggType = typeInfo.get(f.aggField).type;
				}
				else {
					// Aggregate function doesn't have a specified type, but it isn't being applied to a
					// specific field, so there's no way to tell what the output type is going to be.
					//
					// TODO Choose a default type like 'string' instead of throwing.

					throw new Error('Unable to determine type of value aggregate');
				}

				dt.addColumn(aggType, f.aggFun + '(' + (f.aggField || '') + ')');
			}
			else {
				// The only configuration allowed when not a string is to specify an aggregate function,
				// which they didn't do.

				throw new Error('Invalid value specification');
			}
		}
		else {
			// Not a string (field name) and not an object (aggregate function), so it's some other
			// weird thing that we don't know what to do with.

			throw new Error('Invalid value specification');
		}
	});

	_.each(data.data, function (group, groupNum) {
		var newRow;

		newRow = [data.rowVals[groupNum].join(', ')];
		newRow = newRow.concat([group.length]);
		/*
		newRow = newRow.concat(_.map(graphConfig.valueFields, function (f) {
			if (typeof f === 'string') {
				// FIXME
				throw new Error('Not sure what to do here');
			}
			else if (typeof f === 'object') {
				var agg = AGGREGATES[f.aggFun];
				var aggFun = agg.fun({field: f.aggField});
				var aggType = agg.type;
				var aggResult = format(colConfig, colTypeInfo, aggFun(colGroup), {
					alwaysFormat: true,
					overrideType: aggType
				});
				// Calculate the aggregate function result from the data in the group.
				//
			}
			else {
				// Not a string (field name) and not an object (aggregate function), so it's some other
				// weird thing that we don't know what to do with.

				throw new Error('Invalid value specification');
			}
		}));
		*/

		dt.addRow(newRow);
	});

	return graphConfig;
};

// #draw_pivot {{{2

GraphRendererGoogle.prototype.draw_pivot = function (data, typeInfo, dt) {
	var self = this
		, graphConfig;

	graphConfig = deepCopy(self.opts.whenPivot || {});
	_.defaults(graphConfig, {
		graphType: 'column',
		categoryField: data.groupFields[0],
		valueFields: [],
		options: {
			isStacked: true
		}
	});

	dt.addColumn(typeInfo.get(graphConfig.categoryField).type, graphConfig.categoryField);

	_.each(data.colVals, function (colVal) {
		dt.addColumn('number', colVal.join(', '));
	});

	_.each(data.data, function (group, groupNum) {
		var newRow;

		newRow = [data.rowVals[groupNum].join(', ')];
		newRow = newRow.concat(_.map(group, function (pivot) {
			return pivot.length;
		}));
		/*
		newRow = newRow.concat(_.map(graphConfig.valueFields, function (f) {
			if (typeof f === 'string') {
				// FIXME
				throw new Error('Not sure what to do here');
			}
			else if (typeof f === 'object') {
				var agg = AGGREGATES[f.aggFun];
				var aggFun = agg.fun({field: f.aggField});
				var aggType = agg.type;
				var aggResult = format(colConfig, colTypeInfo, aggFun(colGroup), {
					alwaysFormat: true,
					overrideType: aggType
				});
				// Calculate the aggregate function result from the data in the group.
				//
			}
			else {
				// Not a string (field name) and not an object (aggregate function), so it's some other
				// weird thing that we don't know what to do with.

				throw new Error('Invalid value specification');
			}
		}));
		*/

		dt.addRow(newRow);
	});

	return graphConfig;
};

// #draw {{{2

GraphRendererGoogle.prototype.draw = function () {
	var self = this;

	var drawLikeForRealThisTime = function () {
		jQuery(document.getElementById(self.id)).children().remove();

		self.view.getData(function (data) {
			self.view.getTypeInfo(function (typeInfo) {
				var graphConfig
					, dt = new google.visualization.DataTable();

				if (data.isPlain) {
					graphConfig = self.draw_plain(data, typeInfo, dt);
				}
				else if (data.isGroup && !data.isPivot) {
					graphConfig = self.draw_group(data, typeInfo, dt);
				}
				else if (data.isPivot) {
					graphConfig = self.draw_pivot(data, typeInfo, dt);
				}

				if (graphConfig === undefined) {
					return;
				}

				var ctor = {
					area: 'AreaChart',
					bar: 'BarChart',
					column: 'ColumnChart',
					pie: 'PieChart'
				};

				var options = {
					title: self.opts.title,
					width: self.opts.width,
					height: self.opts.height,
					isStacked: graphConfig.stacked,
					hAxis: {
						title: graphConfig.categoryField
					},
					vAxis: {
						title: graphConfig.valueFields[0]
					}
				};

				jQuery.extend(true, options, graphConfig.options);

				console.log(options);

				var chart = new google.visualization[ctor[graphConfig.graphType]](document.getElementById(self.id));
				chart.draw(dt, options);
			});
		});
	};

	debug.info('GRAPH // GOOGLE // DRAW', 'Starting draw...');

	return loadScript('https://www.gstatic.com/charts/loader.js', function (wasAlreadyLoaded, k) {
		var cb = function () {
			k();
			drawLikeForRealThisTime();
		};
		if (!wasAlreadyLoaded) {
			debug.info('GRAPH // GOOGLE // DRAW', 'Loading support for Google Charts');
			google.charts.load('current', {'packages':['corechart']});
			google.charts.setOnLoadCallback(cb);
		}
		else {
			cb();
		}
	}, {
		needAsyncSetup: true
	});
};

// GraphRendererJit {{{1

GraphRendererJit = makeSubclass(GraphRenderer);

// #draw {{{2

GraphRendererJit.prototype.draw = function () {
	var self = this;

	jQuery(document.getElementById(self.id)).children().remove();

	self.view.getData(function (data) {
		self.view.getTypeInfo(function (typeInfo) {
			var ctor = {
				area: 'AreaChart',
				bar: 'BarChart'
			};

			var json = {
				label: [],
				values: []
			};

			_.each(self.opts.valueFields, function (f) {
				json.label.push(f);
			});

			_.each(data.data, function (row) {
				var newRow = {};
				newRow.label = row.rowData[self.opts.categoryField].value;
				newRow.values = _.map(self.opts.valueFields, function (f) {
					return row.rowData[f].value;
				});
				json.values.push(newRow);
			});

			var options = {
				injectInto: self.id
			};

			jQuery.extend(true, options, self.opts.options);

			console.log(options);

			var chart = new $jit[ctor[self.opts.type]](options);
			chart.loadJSON(json);
		});
	});
};

// GraphControl {{{1

var GraphControl = function () {
	var self = this;

	self.ui = {};
};

GraphControl.prototype = Object.create(Object.prototype);
GraphControl.prototype.constructor = GraphControl;

// #draw {{{2

GraphControl.prototype.draw = function () {
	var self = this;

	self.view.on('getTypeInfo', function (typeInfo) {
		var fields = [];

		_.each(availableFields(self.defn, null, typeInfo), function (fieldName) {
			var text = getProp(self.colConfig, fieldName, 'displayText') || fieldName;
			fields.push({ fieldName: fieldName, displayText: text });
		});

		// Graph Type Dropdown

		var graphTypes = {
			'area': 'Area Chart',
			'bar': 'Bar Chart',
			'column': 'Column Chart'
		};

		self.ui.graphType = jQuery('<select>');

		_.each(graphTypes, function (graphType, graphTypeName) {
			self.ui.graphType.append(jQuery('<option>', { 'value': graphType }).text(graphTypeName));
		});

		self.ui.root.append(jQuery('<div>').append(self.ui.graphType));

		// Plain Data Configuration

		self.ui.plainCheckbox = jQuery('<input>', { 'type': 'checkbox', 'checked': 'checked' })
			.on('change', function () {
				if (self.ui.plainCheckbox.prop('checked')) {
					self.ui.plainConfig.show();
				}
				else {
					self.ui.plainConfig.hide();
				}
			});

		self.ui.root.append(
			jQuery('<span>', { 'class': 'wcdv_title' })
			.append(plainCheckbox)
			.append('Plain Data')
		);

		self.ui.plainCategoryField = jQuery('<select>')
			.on('change', function () {
				self.defn.whenPlain.categoryField = self.ui.plainCategoryField.val();
			});
		self.ui.plainValueField = jQuery('<select>')
			.on('change', function () {
				self.defn.whenPlain.valueField = self.ui.plainValueField.val();
			});

		_.each(fields, function (f) {
			self.ui.plainCategoryField.append(
				jQuery('<option>', { 'value': f.fieldName }).text(f.displayText)
			);
			self.ui.plainValueField.append(
				jQuery('<option>', { 'value': f.fieldName }).text(f.displayText)
			);
		});

		self.ui.plainConfig = jQuery('<div>')
			.append(
				jQuery('<div>')
				.append('Category Field: ')
				.append(self.ui.plainCategoryField)
			)
			.append(
				jQuery('<div>')
				.append('Value Field: ')
				.append(self.ui.plainValueField)
			)
			.appendTo(self.ui.root);

		// Group Data Configuration



		// Pivot Data Configuration
	}, { limit: 1 });
};

// GraphControlField {{{1

var GraphControlField = function () {
	var self = this;

	self.ui = {};
};

GraphControlField.prototype = Object.create(Object.prototype);
GraphControlField.prototype.constructor = GraphControlField;
