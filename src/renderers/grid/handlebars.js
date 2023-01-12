import _ from 'underscore';
import Handlebars from 'handlebars';

import {
	debug,
	deepCopy,
	format,
	makeSubclass,
	outerHtml,
} from '../../util/misc.js';

import {GridRenderer} from '../../grid_renderer.js';

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

// #_validateFeatures {{{2

GridRendererHandlebars.prototype._validateFeatures = function () {
	var self = this;
	self.features.limit = false;
};


// #canRender {{{2

GridRendererHandlebars.prototype.canRender = function (what) {
	return true;
};

// #_draw_plain {{{2

GridRendererHandlebars.prototype._draw_plain = function (root, data, typeInfo, opts) {
	var self = this;
	var html = '';

	if (data.data.length === 0) {
		if (self.empty != null) {
			html += self.empty();
		}
	}
	else {
		if (self.before != null) {
			html += self.before();
		}

		if (self.item != null) {
			_.each(data.data, function (row) {
				var context = {};
				_.each(row.rowData, function (cell, field) {
					var fcc = self.colConfig.get(field) || {};
					var value = format(fcc, typeInfo.get(field), cell);
					if (value instanceof Element || value instanceof jQuery) {
						value = outerHtml(value);
					}
					context[field] = value;
				});
				html += self.item(context);
			});
		}

		if (self.after != null) {
			html += self.after();
		}
	}

	root.html(html);
};

// #_draw_group {{{2

GridRendererHandlebars.prototype._draw_group = function (root, data, typeInfo, opts) {
	var self = this;
	var html = '';

	if (data.data.length === 0) {
		if (self.empty != null) {
			html += self.empty();
		}
	}
	else {
		if (self.before != null) {
			html += self.before();
		}

		if (self.item != null) {
			_.each(data.data, function (group, rowValIndex) {
				var context = {
					rowValIndex: rowValIndex
				};
				html += self.item(context);
			});
		}

		if (self.after != null) {
			html += self.after();
		}
	}

	root.html(html);
};

// #_draw_pivot {{{2

GridRendererHandlebars.prototype._draw_pivot = function (root, data, typeInfo, opts) {
	var self = this;
	var html = '';

	if (data.data.length === 0) {
		if (self.empty != null) {
			html += self.empty();
		}
	}
	else {
		if (self.before != null) {
			html += self.before();
		}

		if (self.item != null) {
			_.each(data.data, function (group, rowValIndex) {
				_.each(group, function (pivot, colValIndex) {
					var div = jQuery('<div>').appendTo(root);
					var context = {
						rowValIndex: rowValIndex,
						colValIndex: colValIndex
					};
					html += self.item(context);
				});
			});
		}

		if (self.after != null) {
			html += self.after();
		}
	}

	root.html(html);
};

// #draw {{{2

GridRendererHandlebars.prototype.draw = function (root, cont, opts) {
	var self = this;

	if (cont != null && typeof cont !== 'function') {
		throw new Error('Call Error: `cont` must be null or a function');
	}

	return self.super.draw(root, opts, function (ok, data, typeInfo) {
		if (!ok) {
			return cont();
		}

		var k1 = data.isPlain ? 'plain'
			: data.isGroup ? 'group'
			: data.isPivot ? 'pivot'
			: null;

		var configKey = data.isPlain ? 'whenPlain'
			: data.isGroup ? 'whenGroup'
			: data.isPivot ? 'whenPivot'
			: null;

		var config = self.opts[configKey] || {};

		if (config.empty != null) {
			self.empty = Handlebars.compile(config.empty);
		}

		if (config.before != null) {
			self.before = Handlebars.compile(config.before);
		}

		if (config.item != null) {
			self.item = Handlebars.compile(config.item);
		}

		if (config.after != null) {
			self.after = Handlebars.compile(config.after);
		}

		self['_draw_' + k1](root, data, typeInfo, opts);

		self.addWorkHandler();

		self.fire('renderEnd');
		self.drawLock.unlock();

		if (typeof cont === 'function') {
			return cont();
		}
	});
};

// #addWorkHandler {{{2

GridRendererHandlebars.prototype.addWorkHandler = function () {
	var self = this;

	self.view.on('workEnd', function (info, ops) {
		self.draw(self.root, null, self.drawOpts);
	}, { who: self, limit: 1 });
};

// Registry

GridRenderer.registry.set('handlebars', GridRendererHandlebars);
