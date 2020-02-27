import _ from 'underscore';
import jQuery from 'jquery';

import {
	fontAwesome,
	getProp,
	getPropDef,
	makeSubclass,
	moveArrayElement,
	setProp,
} from '../util/misc.js';

import OrdMap from '../util/ordmap.js';

// HandlebarsEditor {{{1

var HandlebarsEditor = makeSubclass('HandlebarsEditor', Object, function (grid, onSave) {
	var self = this;

	var winEffect = {
		effect: 'fade',
		duration: 100
	};

	self.grid = grid;
	self.win = jQuery('<div>', { title: 'Handlebars Configuration' }).dialog({
		autoOpen: false,
		modal: true,
		width: 'auto',
		position: {
			my: 'center',
			at: 'center',
			of: window
		},
		classes: {
			"ui-dialog": "ui-corner-all wcdv_dialog",
			"ui-dialog-titlebar": "ui-corner-all",
		},
		buttons: [{
			text: 'OK',
			icon: 'ui-icon-check',
			click: function () {
				// Update the configuration of the grid.

				self.tabData.each(function (v, k) {
					_.each(['empty', 'before', 'item', 'after'], function (t) {
						setProp(v.inputs[t].val(), self.grid.defn, 'rendererOpts', k, t);
					});
				});

				self.win.dialog('close');
				if (typeof onSave === 'function') {
					onSave();
				}
			}
		}, {
			text: 'Cancel',
			icon: 'ui-icon-cancel',
			click: function () {
				self.win.dialog('close');
				if (typeof onCancel === 'function') {
					onCancel();
				}
			}
		}],
		show: winEffect,
		hide: winEffect,
	});

	// Tabs {{{2

	var makeTab = function (name, displayName) {
		var inputs = {};
		var labels = {};

		var li = jQuery('<li>').append(jQuery('<a>', {href: '#wcdv_hbe_' + name}).text(displayName));
		var div = jQuery('<div>', {id: 'wcdv_hbe_' + name});

		_.each([
			{id: 'empty', label: 'Empty', rows: 4},
			{id: 'before', label: 'Before', rows: 4},
			{id: 'item', label: 'Item', rows: 8},
			{id: 'after', label: 'After', rows: 4}
		], function (x) {
			labels[x.id] = jQuery('<label>', {
				for: 'wcdv_hbe_' + name + '_' + x.id
			})
				.css('display', 'block')
				.text(x.label + ':');
			inputs[x.id] = jQuery('<textarea>', {
				id: 'wcdv_hbe_' + name + '_' + x.id,
				rows: x.rows,
				cols: 80
			})
				.css('font-family', 'monospace');
			div.append(labels[x.id]);
			div.append(inputs[x.id]);
		});

		return { li: li, div: div, inputs: inputs };
	};

	self.tabData = new OrdMap();
	self.tabData.set('whenPlain', makeTab('whenPlain', 'Plain'));
	self.tabData.set('whenGroup', makeTab('whenGroup', 'Grouped'));
	self.tabData.set('whenPivot', makeTab('whenPivot', 'Pivotted'));

	var tabs = jQuery('<div>').appendTo(self.win);
	var ul = jQuery('<ul>').appendTo(tabs);
	self.tabData.each(function (x) {
		ul.append(x.li);
		tabs.append(x.div);
	});
	tabs.tabs();
});

// #show {{{2

HandlebarsEditor.prototype.show = function () {
	var self = this;

	// Setup the values of each textarea.

	self.tabData.each(function (v, k) {
		var config = getProp(self.grid.defn, 'rendererOpts', k);
		if (config != null) {
			_.each(['empty', 'before', 'item', 'after'], function (t) {
				v.inputs[t].val(config[t]);
			});
		}
	});

	self.win.dialog('open');
};

export {
	HandlebarsEditor
};
