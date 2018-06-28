// Graph {{{1

// JSDoc Types {{{2

/**
 * @typedef {object} Graph~Config
 *
 * @property {Graph~Config_When} whenPlain
 * Tells how to configure the graph when the data is plain (has not been grouped or pivotted).
 *
 * @property {Graph~Config_When} whenGroup
 * Tells how to configure the graph when the data is grouped.
 *
 * @property {Graph~Config_When} whenPivot
 * Tells how to configure the graph when the data is pivotted.
 */

/**
 * @typedef {object} Graph~Config_When
 * Can either be a function that returns an object, or just an object.  If it's a function, it
 * receives the group fields and pivot fields as arguments.
 *
 * @mixes View~AggregateSpec
 */

// Constructor {{{2

/**
 * Creates a new graph.
 *
 * @param {string} id
 *
 * @param {View} view
 *
 * @param {Graph~Config} opts
 *
 * @class
 *
 * Represents a graph.
 *
 * @property {string} id
 * @property {View} view
 * @property {object} devConfig
 * @property {object} userConfig
 * @property {object} opts
 * @property {GraphRenderer} renderer
 */

var Graph = function (id, view, devConfig, opts) {
	var self = this;

	self.id = id;
	self.view = view;
	self.devConfig = devConfig || {};
	self.userConfig = {
		plain: {},
		group: {},
		pivot: {}
	};
	self.opts = deepDefaults(opts, {
		title: 'Graph',
		runImmediately: true,
		showToolbar: true,
		showOnDataChange: false,
	});

	if (typeof id !== 'string') {
		throw new Error('Call Error: `id` must be a string');
	}

	if (!(view instanceof View)) {
		throw new Error('Call Error: `view` must be an instance of MIE.WC_DataVis.View');
	}

	if (self.opts.prefs != null && !(self.opts.prefs instanceof Prefs)) {
		throw new Error('Call Error: `opts.prefs` must be an instance of MIE.WC_DataVis.Prefs');
	}

	if (self.opts.prefs != null) {
		self.prefs = self.opts.prefs;
	}
	else if (self.view.prefs != null) {
		self.prefs = self.view.prefs;
	}
	else {
		self.prefs = new Prefs(self.id);
	}

	self.prefs.bind('graph', self);

	self._makeUserInterface();

	self.view.addClient(self, 'graph');

	self.view.on('dataUpdated', function () {
		if (self.opts.showOnDataChange && !self.isVisible()) {
			self.view.off('dataUpdated', self.renderer);
			self.show();
		}
	});

	self.view.on('fetchDataBegin', function () {
		self._setSpinner('loading');
		self._showSpinner();
	});
	self.view.on('fetchDataEnd', function () {
		self._hideSpinner();
	});

	self.view.on('workBegin', function () {
		self._setSpinner('working');
		self._showSpinner();
	});
	self.view.on('workEnd', function (info, ops) {
		self._hideSpinner();
	});

	self.view.on('workEnd', function (info, ops) {
		var config;

		if (ops.pivot) {
			config = getProp(self.userConfig, 'pivot', 'graphs', getProp(self.userConfig, 'pivot', 'current'))
				|| self.devConfig.whenPivot;
		}
		else if (ops.group) {
			config = getProp(self.userConfig, 'group', 'graphs', getProp(self.userConfig, 'group', 'current'))
				|| self.devConfig.whenGroup;
		}
		else {
			config = getProp(self.userConfig, 'plain', 'graphs', getProp(self.userConfig, 'plain', 'current'))
				|| self.devConfig.whenPlain;
		}

		if (config != null) {
			debug.info('GRAPH // HANDLER (View.workEnd)',
				'Matching configuration: %O', config);

			var graphType = config.graphType;
			var axis = graphType === 'bar' ? 'hAxis' : 'vAxis';
			self.ui.graphTypeDropdown.val(config.graphType);
		}

		if (ops.group) {
			self.ui.toolbar_aggregates.show();
			if (config != null) {
				self.ui.aggDropdown.val(config.aggNum);
				self.ui.zeroAxisCheckbox.prop('checked', getProp(config, 'options', axis, 'minValue') == 0);
			}
		}
		else {
			self.ui.toolbar_aggregates.hide();
		}

		if (ops.pivot) {
			self.ui.toolbar_pivot.show();
			if (config != null) {
				self.ui.stackCheckbox.prop('checked', !!getProp(config, 'options', 'isStacked'));
			}
		}
		else {
			self.ui.toolbar_pivot.hide();
		}
	});

	self.checkGraphConfig();
	self.renderer = new GraphRendererGoogle(self, self.ui.graph, self.view, self.opts);

	if (self.opts.runImmediately) {
		self.show();
	}
	else {
		self.hide();
	}
};

Graph.prototype = Object.create(Object.prototype);
Graph.prototype.constructor = Graph;

// #_makeUserInterface {{{2

Graph.prototype._makeUserInterface = function () {
	var self = this;

	// div.wcdv_graph (ui.root)
	// |
	// +-- div.wcdv_grid_titlebar (ui.titlebar)
	// |   |
	// |   +-- strong (ui.spinner)
	// |   +-- strong [[ the title ]]
	// |   `-- button [[ show/hide button ]]
	// |
	// `-- div.wcdv_grid_content (ui.content)
	//     |
	//     +-- div.wcdv_grid_toolbar (ui.toolbar)
	//     +-- div.wcdv_toolbar_section (ui.toolbar_source)
	//     +-- div.wcdv_toolbar_section (ui.toolbar_common)
	//     +-- div.wcdv_toolbar_section (ui.toolbar_aggregate)
	//     `-- div.wcdv_graph_render (ui.graph)

	self.ui = {};
	self.ui.root = jQuery(document.getElementById(self.id));

	self.ui.root.addClass('wcdv_graph');
	self.ui.root.children().remove();

	self.ui.titlebar = jQuery('<div>')
		.addClass('wcdv_grid_titlebar')
		.on('click', function (evt) {
			evt.stopPropagation();
			self.toggle();
		})
		.appendTo(self.ui.root);

	self._addTitleWidgets(self.ui.titlebar);

	self.ui.content = jQuery('<div>', {
		'class': 'wcdv_grid_content'
	}).appendTo(self.ui.root);

	self.ui.toolbar = jQuery('<div>')
		.addClass('wcdv_grid_toolbar')
		.appendTo(self.ui.content)
	;

	if (!self.opts.showToolbar) {
		self.ui.toolbar.hide();
	}

	// The "aggregates" toolbar section lets the user control what is drawn based on the aggregate
	// functions calculated by the view.

	self.ui.toolbar_aggregates = jQuery('<div>')
		.addClass('wcdv_toolbar_section pull-right')
		.hide()
		.appendTo(self.ui.toolbar);
	self._addAggregateButtons(self.ui.toolbar_aggregates);

	// The "pivot" toolbar section lets the user decide if colvals should show up stacked or as
	// separate bars (for bar & column charts).

	self.ui.toolbar_pivot = jQuery('<div>')
		.addClass('wcdv_toolbar_section')
		.hide()
		.appendTo(self.ui.toolbar);
	self._addPivotButtons(self.ui.toolbar_pivot);

	self.ui.graph = jQuery('<div>', { 'id': self.id, 'class': 'wcdv_graph_render' });

	self.ui.root
		.append(self.ui.titlebar)
		.append(self.ui.content
			.append(self.ui.toolbar)
			.append(self.ui.graph))
	;
};

// #_addTitleWidgets {{{2

/**
 * Add widgets to the header of the graph.
 *
 * @private
 *
 * @param {jQuery} titlebar
 */

Graph.prototype._addTitleWidgets = function (titlebar) {
	var self = this;

	self.ui.spinner = jQuery('<strong>').css({'font-weight': 'normal', 'margin-right': '0.5em'}).appendTo(titlebar);
	self._setSpinner(self.opts.runImmediately ? 'loading' : 'not-loaded');

	jQuery('<strong>')
		.text(self.opts.title + ',')
		.appendTo(titlebar);

	// The "notHeader" is the extension point for adding information into the titlebar.  It's really
	// just a place where clicking doesn't trigger the expand/collapse behavior that the rest of the
	// titlebar has.  Anything that you'd want to shown in the title, which could be interactive,
	// should be added under here.

	var notHeader = jQuery('<span>', {'class': 'headingInfo'})
		.on('click', function (evt) {
			evt.stopPropagation();
		})
		.appendTo(titlebar);

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
		.addClass('wcdv_button wcdv_text-primary')
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

// #_addAggregateButtons {{{2

Graph.prototype._addAggregateButtons = function (toolbar) {
	var self = this;

	var graphTypeDropdownId = gensym();
	jQuery('<label>', { 'for': graphTypeDropdownId }).text('Graph Type: ').appendTo(toolbar);
	self.ui.graphTypeDropdown = jQuery('<select>', { 'id': graphTypeDropdownId })
		.on('change', function () {
			self.drawInteractive();
		})
		.appendTo(toolbar);

	GRAPH_TYPES.each(function (gt) {
		self.ui.graphTypeDropdown.append(jQuery('<option>', { 'value': gt.value }).text(gt.name));
	});

	var aggDropdownId = gensym();
	jQuery('<label>', { 'for': aggDropdownId }).text('Aggregate: ').appendTo(toolbar);
	self.ui.aggDropdown = jQuery('<select>', { 'id': aggDropdownId })
		.on('change', function () {
			self.drawInteractive();
		})
		.appendTo(toolbar);

	self.ui.zeroAxisCheckbox = makeToggleCheckbox(
		null,
		null,
		false,
		'Y-Axis Starts at Zero',
		toolbar,
		function (isChecked) {
			self.drawInteractive()
		}
	);

	self.view.on('workEnd', function () {
		self._updateAggDropdown();
	});
};

// #_addPivotButtons {{{2

Graph.prototype._addPivotButtons = function (toolbar) {
	var self = this;

	self.ui.stackCheckbox = makeToggleCheckbox(
		null,
		null,
		true,
		'Stack',
		toolbar,
		function (isChecked) {
			self.drawInteractive()
		}
	);
};

// #_udpateAggDropdown {{{2

Graph.prototype._updateAggDropdown = function () {
	var self = this;

	var addOption = function (aggInfo) {
		var name = aggInfo.name || aggInfo.instance.getFullName();
		var num = aggInfo.aggNum;
		var option = jQuery('<option>', { 'value': num }).text(name);

		self.ui.aggDropdown.append(option);
	};

	self.view.getData(function (data) {
		self.ui.aggDropdown.children().remove();

		if (data.isGroup) {
			_.each(getPropDef([], data, 'agg', 'info', 'group'), addOption);
		}
		else if (data.isPivot) {
			_.each(getPropDef([], data, 'agg', 'info', 'pivot'), addOption);
		}
	});
};

// #export {{{2

Graph.prototype.export = function () {
	var self = this;

	if (self.exportBlob == null) {
		return;
	}

	var fileName = (self.opts.title || self.id) + '.png';
	presentDownload(self.exportBlob, fileName);
};

// #_setExportBlob {{{2

Graph.prototype._setExportBlob = function (blob) {
	var self = this;

	self.exportBlob = blob;
	self.ui.exportBtn.prop('disabled', blob == null);
};

// #_clearExportBlob {{{2

Graph.prototype._clearExportBlob = function () {
	var self = this;

	self.exportBlob = null;
	self.ui.exportBtn.prop('disabled', true);
};

// #drawFromConfig {{{2

Graph.prototype.drawFromConfig = function () {
	var self = this;

	self.renderer.draw(self.devConfig, self.userConfig);
}

// #drawInteractive {{{2

Graph.prototype.drawInteractive = function () {
	var self = this;

	var graphType = self.ui.graphTypeDropdown.val();
	var minValue = self.ui.zeroAxisCheckbox.prop('checked') ? 0 : null;

	var config = {
		group: {
			graphs: {},
			current: graphType
		},
		pivot: {
			graphs: {},
			current: graphType
		}
	};

	// NOTE The `graphType` field here is useless except that it makes the rendering function (e.g.
	// GraphRendererGoogle#draw_plain) more convenient to implement.

	config.group.graphs[graphType] = {
		graphType: graphType,
		aggNum: toInt(self.ui.aggDropdown.val()),
		options: {}
	};

	// At least with Google Charts, you have to swap the horizontal and vertical axis configuration
	// for bar charts (since they're on their side).

	switch (graphType) {
	case 'bar':
		config.group.graphs[graphType].options = {
			vAxis: {
				minValue: minValue
			}
		};
		break;
	default:
		config.group.graphs[graphType].options = {
			vAxis: {
				minValue: minValue
			}
		};
	}

	// Copy everything... not strictly necessary AFAIK, but it's safe.
	config.pivot = deepCopy(config.group);

	// Make sure to add the stack setting for pivot mode.
	config.pivot.graphs[graphType].options.isStacked = self.ui.stackCheckbox.prop('checked');

	// Store this configuration in the userConfig so that it can be saved with prefs.
	_.extend(self.userConfig, config);

	if (self.prefs != null) {
		self.prefs.save();
	}

	debug.info('GRAPH', 'Drawing graph based on interactive config [userConfig = %O]', self.userConfig);

	self.renderer.draw(self.devConfig, self.userConfig);
};

// #checkGraphConfig {{{2

Graph.prototype.checkGraphConfig = function () {
	if (self.devConfig == null) {
		return;
	}

	_.each(['whenPlain', 'whenGroup', 'whenPivot'], function (dataFormat) {
		if (self.devConfig[dataFormat] === undefined) {
			return;
		}

		var config = self.devConfig[dataFormat];

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

// #refresh {{{2

/**
 * Refreshes the data from the data view in the grid.
 *
 * @method
 * @memberof Grid
 */

Graph.prototype.refresh = function () {
	var self = this;

	self.view.clearSourceData();
};

// #hide {{{2

/**
 * Hide the grid.
 *
 * @method
 * @memberof Grid
 */

Graph.prototype.hide = function () {
	var self = this;

	debug.info('GRAPH', 'Hiding...');

	self.ui.content.hide({
		duration: 0,
		done: function () {
			if (self.opts.title) {
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

Graph.prototype.show = function (opts) {
	var self = this;

	opts = deepDefaults(opts, {
		redraw: true
	});

	debug.info('GRAPH', 'Showing...');

	self.ui.content.show({
		duration: 0,
		done: function () {
			if (self.opts.title) {
				self.ui.showHideButton.addClass('open fa-rotate-180');
			}
			if (opts.redraw) {
				self.drawFromConfig();
			}
		}
	});
};

// #toggle {{{2

/**
 * Toggle graph visibility.
 */

Graph.prototype.toggle = function () {
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
 * Determine if the graph is currently visible.
 *
 * @returns {boolean}
 * True if the graph is currently visible, false if it is not.
 */

Graph.prototype.isVisible = function () {
	var self = this;

	return self.ui.content.css('display') !== 'none';
};

// #_setSpinner {{{2

/**
 * Set the type of the spinner icon.
 *
 * @param {string} what
 * The kind of spinner icon to show.  Must be one of: loading, not-loaded, working.
 */

Graph.prototype._setSpinner = function (what) {
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

Graph.prototype._showSpinner = function () {
	var self = this;

	self.ui.spinner.show();
};

// #_hideSpinner {{{2

/**
 * Hide the spinner icon.
 */

Graph.prototype._hideSpinner = function () {
	var self = this;

	self.ui.spinner.hide();
};

// #setUserConfig {{{2

Graph.prototype.setUserConfig = function (config) {
	var self = this;

	self.userConfig = config;

	// When the constructor binds to prefs, this method can be called before the renderer is created.
	// That's not a big deal, just don't do anything here if that's the case.

	if (self.renderer != null) {
		self.renderer.draw(self.devConfig, self.userConfig);
	}
};

// GraphRenderer {{{1

GraphRenderer = makeSubclass(Object, function (graph, elt, view, opts) {
	var self = this;

	self.graph = graph;
	self.elt = elt;
	self.view = view;
	self.opts = opts;
});

// #_validateConfig {{{2

GraphRenderer.prototype._validateConfig = function (config) {
	var self = this;

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

	debug.info('GRAPH // RENDER (GOOGLE)', 'Adding redraw handlers');

	self.view.off('dataUpdated', self);
	self.view.on('dataUpdated', function () {
		debug.info('GRAPH RENDERER // HANDLER (View.dataUpdated)',
			'Redrawing graph because the view has finished doing work');
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

GraphRendererGoogle = makeSubclass(GraphRenderer);

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

	if (config.aggNum != null) {
		var aggInfo = data.agg.info.group[config.aggNum];
		var name = aggInfo.name || aggInfo.instance.getFullName();
		var aggType = aggInfo.instance.getType();

		if (aggType === 'currency') {
			aggType = 'number';
			setProp('currency', config, 'options', valueAxis, 'format');
		}

		dt.addColumn(aggType, name);
		setProp(name, config, 'options', valueAxis, 'title');

		_.each(data.rowVals, function (rowVal, rowValIdx) {
			newRow = [rowVal.join(', ')];

			var aggResult = data.agg.results.group[config.aggNum][rowValIdx];
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
			newRow = [rowVal.join(', ')];

			_.each(ai, function (aggInfo) {
				var aggResult = aggInfo.instance.calculate(_.flatten(data.data[rowValIdx]));
				newRow.push(aggResult);
				if (aggInfo.debug) {
					debug.info('GRAPH // GROUP // AGGREGATE', 'Group aggregate (%s) : Group [%s] = %s',
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

	if (config.aggNum != null) {
		var aggInfo = data.agg.info.cell[config.aggNum];
		var name = aggInfo.name || aggInfo.instance.getFullName();
		var aggType = aggInfo.instance.getType();

		if (aggType === 'currency') {
			aggType = 'number';
			setProp('currency', config, 'options', valueAxis, 'format');
		}

		_.each(data.colVals, function (colVal) {
			dt.addColumn(aggType, colVal.join(', '));
		});

		setProp(name, config, 'options', valueAxis, 'title');

		_.each(data.rowVals, function (rowVal, rowValIdx) {
			newRow = [rowVal.join(', ')];

			_.each(data.colVals, function (colVal, colValIdx) {
				var aggResult = data.agg.results.cell[config.aggNum][rowValIdx][colValIdx];
				newRow.push(aggResult);
			});

			dt.addRow(newRow);
		});
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
						debug.info('GRAPH // GROUP // AGGREGATE', 'Group aggregate (%s) : RowVal [%s] x ColVal [%s] = %s',
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
			debug.info('GRAPH // GOOGLE // DRAW', 'Loading support for Google Charts');
			google.charts.load('current', {'packages':['corechart','gantt']});
			google.charts.setOnLoadCallback(cb);
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
		self.view.getData(function (data) {
			self.view.getTypeInfo(function (typeInfo) {
				self.elt.children().remove();

				var makeMessage = function (msg) {
					jQuery('<div>')
						.css({
							'height': self.opts.height + 'px'
						})
						.append(
							jQuery('<div>', { 'class': 'wcdv_graph_message' })
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
					chartArea: {
						top: '5%',
						left: '5%',
						width: '90%',
						height: '90%'
					}
				};

				var categoryAxis = config.graphType === 'bar' ? 'vAxis' : 'hAxis';

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

				debug.info('GRAPH // GOOGLE // DRAW', 'Starting draw: [config = %O ; options = %O]', config, options);

				chart.draw(dt, options);
			});
		});
	});
};

// GraphRendererJit {{{1

GraphRendererJit = makeSubclass(GraphRenderer);

// #draw {{{2

GraphRendererJit.prototype.draw = function () {
	var self = this;

	elt.children().remove();

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
				injectInto: elt.attr('id')
			};

			jQuery.extend(true, options, self.opts.options);

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

		_.each(determineColumns(null, null, typeInfo), function (fieldName) {
			var text = getProp(self.colConfig, fieldName, 'displayText') || fieldName;
			fields.push({ fieldName: fieldName, displayText: text });
		});

		// Graph Type Dropdown

		self.ui.graphType = jQuery('<select>');

		GRAPH_TYPES.each(function (gt) {
			self.ui.graphType.append(jQuery('<option>', { 'value': gt.value }).text(gt.name));
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

// GRAPH_TYPES {{{1

var GRAPH_TYPES = OrdMap.fromArray([{
	value: 'area',
	name: 'Area Chart',
	modes: ['plain'],
	renderers: [GraphRendererGoogle],
}, {
	value: 'bar',
	name: 'Bar Chart',
	modes: ['plain', 'group', 'pivot'],
	renderers: [GraphRendererGoogle],
}, {
	value: 'column',
	name: 'Column Chart',
	modes: ['plain', 'group', 'pivot'],
	renderers: [GraphRendererGoogle],
}, {
	value: 'pie',
	name: 'Pie Chart',
	modes: ['plain', 'group', 'pivot'],
	renderers: [GraphRendererGoogle],
}, {
	value: 'gantt',
	name: 'Gantt Chart',
	modes: ['plain'],
	renderers: [GraphRendererGoogle],
}], 'value');

