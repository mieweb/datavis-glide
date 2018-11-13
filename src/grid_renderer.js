import _ from 'underscore';
import Handlebars from 'handlebars';
import jQuery from 'jquery';

import {debug, deepCopy, I, Lock, makeSubclass, mixinEventHandling} from './util.js';

import {OrdMap} from './ordmap.js';
import {View} from './view.js';

// GridRenderer {{{1

// Constructor {{{2

/**
 * @param {Grid} grid
 *
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
 */

var GridRenderer = (function () {
	var UNIQUE_ID = 0;

	return makeSubclass('GridRenderer', Object, function (grid, defn, view, features, opts, timing, id, colConfig) {
		var self = this;

		self.UNIQUE_ID = UNIQUE_ID++;

		self.id = id;
		self.grid = grid;
		self.defn = defn;
		self.view = view;
		self.features = deepCopy(features);
		self.opts = opts;
		self.timing = timing;
		self.colConfig = colConfig;
		self.hasRendered = false;

		self._validateFeatures();

		self.drawLock = new Lock('Draw');

		self.grid.on('colConfigUpdate', function (newColConfig) {
			debug.info('GRID RENDERER', 'Received new colConfig: %O', newColConfig);
			self.colConfig = newColConfig;
			if (self.hasRendered) {
				debug.info('GRID RENDERER', 'Redrawing with new colConfig');
				self.draw(self.root, self.drawOpts);
			}
		}, { who: self });
	});
})();

// FIXME: We don't need all these, we only need "unableToRender."  However, mixinEventHandling()
// can't traverse the class hierarchy, so trying to subscribe to "unableToRender" from a GridTable
// will not work (because "unableToRender" isn't in the GridTable subclass' event list).  So for a
// quick workaround, we just put all the events that any subclass may use here.  But the real fix
// should be to make mixinEventHandling() traverse up the superclass chain.

mixinEventHandling(GridRenderer, 'GridRenderer', [
		'columnResize'        // A column is resized.
	, 'unableToRender'      // A grid renderer can't render the data in the view it's bound to.
	, 'limited'             // The grid table isn't rendering all possible rows.
	, 'unlimited'           // The grid table is rendering all possible rows.
	, 'csvReady'            // CSV data has been generated.
	, 'generateCsvProgress' // CSV generation progress.
	, 'renderBegin'
	, 'renderEnd'
	, 'selectionChange'
]);

// #canRender {{{2

GridRenderer.prototype.canRender = function () {
	throw new Error('ABSTRACT');
};

// #draw {{{2

GridRenderer.prototype.draw = function (root, opts, cont) {
	var self = this;
	var args = Array.prototype.slice.call(arguments);

	debug.info('GRID RENDERER // DRAW', 'Beginning draw operation; opts = %O', opts);

	opts = opts || {};

	self.root = root;
	self.drawOpts = opts;

	if (self.drawLock.isLocked()) {
		return self.drawLock.onUnlock(function () {
			GridRenderer.prototype.draw.apply(self, args);
		});
	}

	self.drawLock.lock();

	self.clear();

	return self.view.getData(function (ok, data) {
		if (!ok) {
			return cont(false);
		}

		debug.info('GRID RENDERER // DRAW', 'Data = %O', data);

		return self.view.getTypeInfo(function (ok, typeInfo) {
			if (!ok) {
				return cont(false);
			}

			debug.info('GRID RENDERER // DRAW', 'TypeInfo = %O', typeInfo.asMap());

			if ((data.isPlain && !self.canRender('plain'))
					|| (data.isGroup && !self.canRender('group'))
					|| (data.isPivot && !self.canRender('pivot'))) {

				debug.info('GRID RENDERER // DRAW', 'Unable to render data using current grid table: { isPlain = %s ; isGroup = %s ; isPivot = %s }', data.isPlain, data.isGroup, data.isPivot);

				return self.fire('unableToRender');
			}

			self.hasRendered = true;
			self.fire('renderBegin');

			self.data = data;
			self.typeInfo = typeInfo;

			self.timing.start(['Grid Renderer', 'Draw']);

			return cont(true, data, typeInfo);
		});
	});
};

// #clear {{{2

/**
 * Remove the table from page.
 */

GridRenderer.prototype.clear = function () {
	var self = this;

	self.root.children().remove();
};

// #destroy {{{2

GridRenderer.prototype.destroy = function () {
	var self = this;

	self.clear();
	self.grid.off('*', self);
};

// #toString {{{2

GridRenderer.prototype.toString = function () {
	var self = this;

	return '#<GridRenderer ' + self.UNIQUE_ID + '>';
};

// #_validateFeatures {{{2

GridRenderer.prototype._validateFeatures = function () {
	return true;
};

// GridRendererHandlebars {{{1

var GridRendererHandlebars = makeSubclass('GridRendererHandlebars', GridRenderer, function () {
	var self = this;

	self.super.ctor.apply(self, arguments);

	Handlebars.registerHelper('rowval', function (groupField) {
		if (['number', 'string'].indexOf(typeof groupField) < 0) {
			throw new Error('In Handlebars "rowval" helper, `groupField` must be a number or string');
		}

		var groupFieldIndex;

		if (typeof groupField === 'number') {
			groupFieldIndex = groupField;

			if (groupFieldIndex < 0) {
				throw new Error('In Handlebars "rowval" helper, group field index "' + groupField + '" out of range');
			}
		}
		else {
			groupFieldIndex = self.data.groupFields.indexOf(groupField);

			if (groupFieldIndex < 0) {
				throw new Error('In Handlebars "rowval" helper, specified field "' + groupField + '" is not part of group');
			}
		}

		return self.data.rowVals[this.rowValIndex][groupFieldIndex];
	});

	Handlebars.registerHelper('colval', function (pivotField) {
		if (['number', 'string'].indexOf(typeof pivotField) < 0) {
			throw new Error('In Handlebars "rowval" helper, `pivotField` must be a number or string');
		}

		var pivotFieldIndex;

		if (typeof pivotField === 'number') {
			pivotFieldIndex = pivotField;

			if (pivotFieldIndex < 0) {
				throw new Error('In Handlebars "rowval" helper, pivot field index "' + pivotField + '" out of range');
			}
		}
		else {
			pivotFieldIndex = self.data.pivotFields.indexOf(pivotField);

			if (pivotFieldIndex < 0) {
				throw new Error('In Handlebars "rowval" helper, specified field "' + pivotField + '" is not part of pivot');
			}
		}

		return self.data.colVals[this.colValIndex][pivotFieldIndex];
	});
});

// #canRender {{{2

GridRendererHandlebars.prototype.canRender = function (what) {
	return true;
};

// #_draw_plain {{{2

GridRendererHandlebars.prototype._draw_plain = function (root, data, typeInfo, opts) {
	var self = this;

	_.each(data.data, function (row) {
		var div = jQuery('<div>').appendTo(root);
		var context = {};
		_.each(row.rowData, function (v, k) {
			context[k] = v.value;
		});
		div.html(self.template(context));
	});
};

// #_draw_group {{{2

GridRendererHandlebars.prototype._draw_group = function (root, data, typeInfo, opts) {
	var self = this;

	_.each(data.data, function (group, rowValIndex) {
		var div = jQuery('<div>').appendTo(root);
		var context = {
			rowValIndex: rowValIndex
		};
		div.html(self.template(context));
	});
};

// #_draw_pivot {{{2

GridRendererHandlebars.prototype._draw_pivot = function (root, data, typeInfo, opts) {
	var self = this;

	_.each(data.data, function (group, rowValIndex) {
		_.each(group, function (pivot, colValIndex) {
			var div = jQuery('<div>').appendTo(root);
			var context = {
				rowValIndex: rowValIndex,
				colValIndex: colValIndex
			};
			div.html(self.template(context));
		});
	});
};

// #draw {{{2

GridRendererHandlebars.prototype.draw = function (root, cont, opts) {
	var self = this;

	if (cont != null && typeof cont !== 'function') {
		throw new Error('Call Error: `cont` must be null or a function');
	}

	cont = cont || I;

	return self.super.draw(root, opts, function (ok, data, typeInfo) {
		if (!ok) {
			return cont();
		}

		if (data.isPlain) {
			self.template = Handlebars.compile(self.opts.whenPlain.template);
			self._draw_plain(root, data, typeInfo, opts);
		}
		else if (data.isGroup) {
			self.template = Handlebars.compile(self.opts.whenGroup.template);
			self._draw_group(root, data, typeInfo, opts);
		}
		else if (data.isPivot) {
			self.template = Handlebars.compile(self.opts.whenPivot.template);
			self._draw_group(root, data, typeInfo, opts);
		}
		self.addWorkHandler();
		return cont();
	});
};

// #addWorkHandler {{{2

GridRendererHandlebars.prototype.addWorkHandler = function () {
	var self = this;

	self.view.on(View.events.workEnd, function (info, ops) {
		self.draw(self.root, self.drawOpts);
	}, { who: self, limit: 1 });
};

// Registry {{{1

GridRenderer.registry = new OrdMap();
GridRenderer.registry.set('handlebars', GridRendererHandlebars);

// Exports {{{1

export {
	GridRenderer,
	GridRendererHandlebars
};
