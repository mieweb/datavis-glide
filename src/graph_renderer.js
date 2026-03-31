import _ from 'underscore';
import moment from 'moment';
import numeral from 'numeral';

import {
	dataURItoBlob,
	deepCopy,
	deepDefaults,
	getProp,
	loadScript,
	makeSubclass,
	mixinEventHandling,
	mixinLogging,
	setProp,
} from './util/misc.js';
import {AggregateInfo} from 'datavis-ace/src/aggregates';
import {GROUP_FUNCTION_REGISTRY} from 'datavis-ace/src/group_fun.js';

// GraphRenderer {{{1

var GraphRenderer = (function () {
	var instanceId = 0;

	return makeSubclass('GraphRenderer', Object, function (graph, elt, view, opts) {
		var self = this;

		self.graph = graph;
		self.elt = elt;
		self.view = view;
		self.opts = opts;
		self._instanceId = instanceId++;
	});
})();

mixinEventHandling(GraphRenderer, [
'draw'
]);
mixinLogging(GraphRenderer);

// #toString {{{2

GraphRenderer.prototype.toString = function () {
	var self = this;

	return '<GraphRenderer #' + self._instanceId + ' id="' + self.graph.id + '">';
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

GraphRenderer.prototype.addRedrawHandlers = function () {
	var self = this;

	self.logDebug(self.makeLogTag('addRedrawHandlers') + ' Adding redraw handlers');

	self.view.on('workEnd', function () {
		self.logDebug(self.makeLogTag('handler:View(workEnd)') + ' Redrawing graph because the view has finished doing work');
		self.draw(self.graph.devConfig, self.graph.userConfig);
	}, { who: self });
};

// #destroy {{{2

GraphRenderer.prototype.destroy = function () {
	var self = this;

	self.view.off('workEnd', self);
	self.elt.children().remove();
};

// Exports {{{1

export {
	GraphRenderer,
};
