import _ from 'underscore';
import moment from 'moment';
import numeral from 'numeral';
import jQuery from 'jquery';

import {
	dataURItoBlob,
	debug,
	deepCopy,
	deepDefaults,
	getProp,
	loadScript,
	log,
	makeSubclass,
	setProp,
} from './util/misc.js';
import {AggregateInfo} from './aggregates';
import {GROUP_FUNCTION_REGISTRY} from './group_fun.js';

// GraphRenderer {{{1

var GraphRenderer = makeSubclass('GraphRenderer', Object, function (graph, elt, view, opts) {
	var self = this;

	self.graph = graph;
	self.elt = elt;
	self.view = view;
	self.opts = opts;
});

// #toString {{{2

GraphRenderer.prototype.toString = function () {
	var self = this;

	return '#<GraphRenderer "' + self.graph.id + '">';
};

// #_validateConfig {{{2

GraphRenderer.prototype._validateConfig = function () {

	_.each(['Plain', 'Group', 'Pivot'], function (kind) {
		var propName = 'when' + kind;

		if (config[propName] == null) {
			return; // It's OK to be undefined.
		}

		var config = config[propName];

		if (typeof config !== 'function' && typeof config !== 'object') {
			//self.error(kind + ' configuration must be a function or an object');
			config[propName] = null;
			return;
		}
	});
};

// #addRedrawHandlers {{{2

GraphRenderer.prototype.addRedrawHandlers = function (f) {
	var self = this;

	console.debug('[DataVis // Graph(Google) // Render] Adding redraw handlers');

	self.view.off('workEnd', self);
	self.view.on('workEnd', function () {
		console.debug('[DataVis // Graph(Google) // Handler(View.dataUpdated)] Redrawing graph because the view has finished doing work');
		f();
	}, { who: self });
};

// #draw {{{2

GraphRenderer.prototype.draw = function (devConfig, userConfig) {
	var self = this;

	var reallyDraw = function () {
		self._draw(devConfig, userConfig);
	};

	self.addRedrawHandlers(reallyDraw);
	reallyDraw();
};

// GraphRendererGoogle {{{1

var GraphRendererGoogle = makeSubclass('GraphRendererGoogle', GraphRenderer);

// #draw_plain {{{2

GraphRendererGoogle.prototype.draw_plain = function (data, typeInfo, dt, config) {
	var self = this;

	if (config == null) {
		return null;
	}

	var convertType = function (t) {
		switch (t) {
		case 'currency':
			return 'number';
		default:
			return t;
		}
	};

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

	switch (config.graphType) {
	case 'gantt':
		if (config.nameField == null) {
			throw new Error('Configuration option `nameField` must exist');
		}

		var timeConfigStr = '' + (+config.startField) + (+config.endField) + (+config.durationField);
		if (timeConfigStr === '100' || timeConfigStr === '010' || timeConfigStr === '000') {
			throw new Error('Time configuration is insufficient to determine offsets');
		}

		dt.addColumn('string', 'ID');
		dt.addColumn('string', 'Name');
		dt.addColumn('string', 'Resource');
		dt.addColumn('date', 'Start');
		dt.addColumn('date', 'End');
		dt.addColumn('number', 'Duration');
		dt.addColumn('number', 'Completion');
		dt.addColumn('string', 'Dependencies');

		var configOpts = [
			{ name: 'id', default: (function () { var x = 0; return function () { return x++; }; }) },
			{ name: 'name' },
			{ name: 'resource', default: null },
			{ name: 'start', default: null },
			{ name: 'end', default: null },
			{ name: 'duration', default: null },
			{ name: 'completion', default: 0 },
			{ name: 'dependencies', default: null }
		];

		_.each(configOpts, function (opt) {
			if (config[opt.name + 'Field'] != null) {
				self.view.source.convertAll(data.dataByRowId, config[opt.name + 'Field']);
			}
		});

		_.each(data.data, function (row) {
			var newRow = [];
			_.each(configOpts, function (opt) {
				if (config[opt.name + 'Field'] != null) {
					newRow.push(getRealValue(config[opt.name + 'Field'], row.rowData[config[opt.name + 'Field']]));
				}
				else if (opt.default === undefined) {
					throw new Error();
				}
				else if (typeof opt.default === 'function') {
					newRow.push(opt.default());
				}
				else {
					newRow.push(opt.default);
				}
			});
			dt.addRow(newRow);
		});

		break;
	default:
		dt.addColumn(convertType(typeInfo.get(config.categoryField).type), config.categoryField);

		_.each(config.valueFields, function (field) {
			dt.addColumn(convertType(typeInfo.get(field).type), field);
		});

		_.each(config.valueFields, function (field) {
			self.view.source.convertAll(data.dataByRowId, field);
		});

		_.each(data.data, function (row) {
			var newRow;

			newRow = _.map([config.categoryField].concat(config.valueFields), function (f) {
				return getRealValue(f, row.rowData[f]);
			});

			dt.addRow(newRow);
		});
	}

	return config;
};

// #draw_group {{{2

GraphRendererGoogle.prototype.draw_group = function (data, typeInfo, dt, config) {
	var self = this;

	if (typeof config === 'function') {
		config = config(data.groupFields);
	}

	config = deepDefaults(config, {
		graphType: 'column',
		categoryField: data.groupFields[0],
		valueFields: [{
			name: 'Count',
			fun: 'count'
		}]
	});

	var valueAxis = config.graphType === 'bar' ? 'hAxis' : 'vAxis';

	// dt.addColumn(typeInfo.get(config.categoryField).type, config.categoryField);
	dt.addColumn('string', config.categoryField);

	if (config.aggType != null && config.aggNum != null) {
		var aggInfo = getProp(data, 'agg', 'info', config.aggType, config.aggNum);
		if (aggInfo == null) {
			log.error('The specified aggregate does not exist: ' + config.aggType + '[' + config.aggNum + ']');
			return null;
		}
		if (data.agg.results[config.aggType][config.aggNum] == null) {
			log.error('No results exist for the specified aggregate: ' + config.aggType + '[' + config.aggNum + ']');
			return null;
		}
		var name = aggInfo.name || aggInfo.instance.getFullName();
		var aggResultType = aggInfo.instance.getType();

		if (aggResultType === 'currency') {
			aggResultType = 'number';
			setProp('currency', config, 'options', valueAxis, 'format');
		}

		dt.addColumn(aggResultType, name);
		setProp(name, config, 'options', valueAxis, 'title');

		_.each(data.rowVals, function (rowVal, rowValIdx) {
			var newRow = [rowVal.join(', ')];

			var aggResult = data.agg.results[config.aggType][config.aggNum][rowValIdx];
			if (aggResultType === 'number') {
				aggResult = +aggResult;
			}
			newRow.push(aggResult);
			dt.addRow(newRow);
		});
	}
	else {
		var ai = [];

		// For each value field, create the AggregateInfo instance that will manage it.  Also create a
		// column for the result in the data table.

		_.each(config.valueFields, function (v) {
			var aggInfo = new AggregateInfo('group', v, 0, null /* colConfig */, self.typeInfo, null /* convert */);
			dt.addColumn(aggInfo.instance.getType(), v.name || aggInfo.instance.getFullName());
			ai.push(aggInfo);
		});

		// Go through each rowval and create a row for it in the data table.  Every value field gets its
		// own column, which is the result of the corresponding aggregate function specified above.

		_.each(data.rowVals, function (rowVal, rowValIdx) {
			var newRow = [rowVal.join(', ')];

			_.each(ai, function (aggInfo) {
				var aggResult = aggInfo.instance.calculate(_.flatten(data.data[rowValIdx]));
				newRow.push(aggResult);
				if (aggInfo.debug) {
					console.debug('[DataVis // Graph // Group // Aggregate] Group aggregate (%s) : Group [%s] = %s',
						aggInfo.instance.name + (aggInfo.name ? ' -> ' + aggInfo.name : ''),
						rowVal.join(', '),
						JSON.stringify(aggResult));
				}
			});

			dt.addRow(newRow);
		});
	}

	return config;
};

// #draw_pivot {{{2

GraphRendererGoogle.prototype.draw_pivot = function (data, typeInfo, dt, config) {
	var self = this

	if (typeof config === 'function') {
		config = config(data.groupFields, data.pivotFields);
	}

	config = deepDefaults(config, {
		graphType: 'column',
		categoryField: data.groupFields[0],
		valueFields: [{
			fun: 'count'
		}],
		options: {
			isStacked: true
		}
	});

	var valueAxis = config.graphType === 'bar' ? 'hAxis' : 'vAxis';

	dt.addColumn('string', config.categoryField);

	if (config.aggType != null && config.aggNum != null) {
		var aggInfo = getProp(data, 'agg', 'info', config.aggType, config.aggNum);
		if (aggInfo == null) {
			log.error('The specified aggregate does not exist: ' + config.aggType + '[' + config.aggNum + ']');
			return null;
		}
		if (data.agg.results[config.aggType][config.aggNum] == null) {
			log.error('No results exist for the specified aggregate: ' + config.aggType + '[' + config.aggNum + ']');
			return null;
		}
		var name = aggInfo.name || aggInfo.instance.getFullName();
		var aggResultType = aggInfo.instance.getType();

		if (aggResultType === 'currency') {
			aggResultType = 'number';
			setProp('currency', config, 'options', valueAxis, 'format');
		}

		switch (config.aggType) {
		case 'cell':
			_.each(data.colVals, function (colVal) {
				dt.addColumn(aggResultType, colVal.join(', '));
			});

			setProp(name, config, 'options', valueAxis, 'title');

			_.each(data.rowVals, function (rowVal, rowValIdx) {
				var newRow = [rowVal.join(', ')];

				_.each(data.colVals, function (colVal, colValIdx) {
					var aggResult = data.agg.results[config.aggType][config.aggNum][rowValIdx][colValIdx];
					if (aggResultType === 'number') {
						aggResult = +aggResult;
					}
					newRow.push(aggResult);
				});

				dt.addRow(newRow);
			});
			break;
		case 'group':
			dt.addColumn(aggResultType, name);
			setProp(name, config, 'options', valueAxis, 'title');

			_.each(data.rowVals, function (rowVal, rowValIdx) {
				var newRow = [rowVal.join(', ')];

				var aggResult = data.agg.results[config.aggType][config.aggNum][rowValIdx];
				if (aggResultType === 'number') {
					aggResult = +aggResult;
				}
				newRow.push(aggResult);
				dt.addRow(newRow);
			});
			break;
		case 'pivot':
			dt.addColumn(aggResultType, name);
			setProp(name, config, 'options', valueAxis, 'title');

			_.each(data.colVals, function (colVal, colValIdx) {
				var newRow = [colVal.join(', ')];

				var aggResult = data.agg.results[config.aggType][config.aggNum][colValIdx];
				if (aggResultType === 'number') {
					aggResult = +aggResult;
				}
				newRow.push(aggResult);
				dt.addRow(newRow);
			});
			break;
		}
	}
	else {
		var ai = [];

		// For each value field, create the AggregateInfo instance that will manage it.  Also create
		// columns for the results (one for each colval) in the data table.

		_.each(config.valueFields, function (v) {
			var aggInfo = new AggregateInfo('cell', v, 0, null /* colConfig */, self.typeInfo, null /* convert */);

			_.each(data.colVals, function (colVal) {
				dt.addColumn(aggInfo.instance.getType(), colVal.join(', '));
			});

			ai.push(aggInfo);
		});

		_.each(data.rowVals, function (rowVal, rowValIndex) {
			var newRow = [rowVal.join(', ')];

			_.each(data.colVals, function (colVal, colValIndex) {
				_.each(ai, function (aggInfo) {
					var aggResult = aggInfo.instance.calculate(data.data[rowValIndex][colValIndex]);
					newRow.push(aggResult);
					if (aggInfo.debug) {
						console.debug('[DataVis // Graph // Group // Aggregate] Group aggregate (%s) : RowVal [%s] x ColVal [%s] = %s',
							aggInfo.instance.name + (aggInfo.name ? ' -> ' + aggInfo.name : ''),
							rowVal.join(', '),
							colVal.join(', '),
							JSON.stringify(aggResult));
					}
				});
			});

			dt.addRow(newRow);
		});
	}

	return config;
};

// #_ensureGoogleChartsLoaded {{{2

GraphRendererGoogle.prototype._ensureGoogleChartsLoaded = function (cont) {
	return loadScript('https://www.gstatic.com/charts/loader.js', function (wasAlreadyLoaded, k) {
		var cb = function () {
			k();
			cont();
		};
		if (!wasAlreadyLoaded) {
			console.debug('[DataVis // Graph(Google) // Draw] Loading support for Google Charts');
			window.google.charts.load('current', {'packages': ['corechart', 'gantt']});
			window.google.charts.setOnLoadCallback(cb);
		}
		else {
			cb();
		}
	}, {
		needAsyncSetup: true
	});
};

// #draw {{{2

GraphRendererGoogle.prototype._draw = function (devConfig, userConfig) {
	var self = this;

	devConfig = devConfig || {};
	userConfig = userConfig || {};

	self._ensureGoogleChartsLoaded(function () {
		self.view.getData(function (ok, data) {
			self.view.getTypeInfo(function (ok, typeInfo) {
				self.elt.children().remove();

				var makeMessage = function (msg) {
					jQuery('<div>')
						.addClass('wcdv_graph_message_container')
						.css({ 'height': self.opts.height + 'px' })
						.append(
							jQuery('<div>')
								.addClass('wcdv_graph_message')
								.text(msg)
						)
						.appendTo(self.elt);
				};

				if (data.data.length === 0) {
					makeMessage('No Data');
					return;
				}

				var config = null;
				var dt = new google.visualization.DataTable();

				if (data.isPlain) {
					config = self.draw_plain(data, typeInfo, dt, getProp(userConfig, 'plain', 'graphs', getProp(userConfig, 'plain', 'current')) || devConfig.whenPlain);
				}
				else if (data.isGroup) {
					config = self.draw_group(data, typeInfo, dt, getProp(userConfig, 'group', 'graphs', getProp(userConfig, 'group', 'current')) || devConfig.whenGroup);
				}
				else if (data.isPivot) {
					config = self.draw_pivot(data, typeInfo, dt, getProp(userConfig, 'pivot', 'graphs', getProp(userConfig, 'pivot', 'current')) || devConfig.whenPivot);
				}

				if (config == null) {
					makeMessage('Nothing to Graph');
					return;
				}

				var ctor = {
					area: 'AreaChart',
					bar: 'BarChart',
					column: 'ColumnChart',
					line: 'LineChart',
					pie: 'PieChart',
					gantt: 'Gantt'
				};

				// This is the object that's actually passed to the chart's draw() method.  All the options
				// in the Google documentation should go into this object.

				var options = {
					title: self.opts.title,
					width: self.opts.width,
					height: self.opts.height,
					isStacked: config.stacked,
				};

				var categoryAxis = config.graphType === 'bar' ? 'vAxis' : 'hAxis';

				if (config.graphType === 'pie') {
					options.chartArea = {
						top: '5%',
						left: '5%',
						width: '90%',
						height: '90%'
					};
				}

				setProp(config.categoryField, options, categoryAxis, 'title');

				jQuery.extend(true, options, config.options);

				var chart = new google.visualization[ctor[config.graphType]](self.elt.get(0));

				google.visualization.events.addListener(chart, 'ready', function () {
					var blob = null;
					if (typeof chart.getImageURI === 'function') {
						blob = dataURItoBlob(chart.getImageURI());
					}
					self.graph._setExportBlob(blob);
				});

				google.visualization.events.addListener(chart, 'select', function () {
					var sel = chart.getSelection();
					_.each(sel, function (o) {
						console.debug('[DataVis // Graph // Drill Down] User selected element in graph: row = %s, column = %s, value = %s, formattedValue = %s', o.row, o.column, dt.getValue(o.row, o.column), dt.getFormattedValue(o.row, o.column));

						var filter = deepCopy(self.view.getFilter());

						_.each(data.rowVals[o.row], function (x, i) {
							var gs = data.groupSpec[i];
							filter[data.groupFields[i]] = gs.fun != null
								? GROUP_FUNCTION_REGISTRY.get(gs.fun).valueToFilter(x)
								: { '$eq': x };
						});

						if (data.isPivot) {
							// Offset column by one because the category is stored in the first column of the Google
							// DataTable, but that obviously doesn't exist in the View.

							_.each(data.colVals[o.column - 1], function (x, i) {
								var ps = data.pivotSpec[i];
								filter[data.pivotFields[i]] = ps.fun != null
									? GROUP_FUNCTION_REGISTRY.get(ps.fun).valueToFilter(x)
									: { '$eq': x };
							});
						}

						console.debug('[DataVis // Graph // Drill Down] Creating new perspective: filter = %O', filter);

						window.setTimeout(function () {
							self.view.prefs.addPerspective(null, 'Drill Down', { view: { filter: filter } }, { isTemporary: true }, null, { onDuplicate: 'replace' });
						});
					});
				});

				console.debug('[DataVis // Graph(Google) // Draw] Starting draw: [config = %O ; options = %O]', config, options);

				chart.draw(dt, options);
			});
		}, 'Drawing Google graph');
	});
};

// GraphRendererJit {{{1

var GraphRendererJit = makeSubclass('GraphRendererJit', GraphRenderer);

// #draw {{{2

GraphRendererJit.prototype.draw = function () {
	var self = this;

	elt.children().remove();

	self.view.getData(function (ok, data) {
		self.view.getTypeInfo(function () {
			var ctor = {
				area: 'AreaChart',
				bar: 'BarChart',
				line: 'LineChart'
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
				injectInto: elt.attr('id')
			};

			jQuery.extend(true, options, self.opts.options);

			var chart = new $jit[ctor[self.opts.type]](options);
			chart.loadJSON(json);
		});
	}, 'Drawing JIT graph');
};

// Exports {{{1

export {
	GraphRenderer,
	GraphRendererGoogle,
	GraphRendererJit,
};
