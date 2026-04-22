import _ from 'underscore';
import jQuery from 'jquery';

import {
	getProp,
	makeSubclass,
	setProp,
} from '../util/misc.js';
import { trans } from '../trans.js';
import { OrdMap } from 'datavis-ace';
import { PopupWindow } from './popup_window.js';
import { Tabs } from './tabs.js';

// TemplatesEditor {{{1

var TemplatesEditor = makeSubclass('TemplatesEditor', Object, function (grid, onSave, onCancel) {
	var self = this;

	self.grid = grid;
	self.win = new PopupWindow({
		title: trans('GRID.TEMPLATE_EDITOR.TITLE'),
		width: 'auto',
		buttons: [{
			icon: 'check',
			label: trans('DIALOG.OK'),
			callback: function () {
				// Update the configuration of the grid.

				self.tabData.each(function (v, k) {
					_.each(['empty', 'before', 'beforeGroup', 'item', 'afterGroup', 'after'], function (t) {
						if (v.inputs[t] != null) {
							setProp(v.inputs[t].val(), self.grid.defn, 'rendererOpts', k, t);
						}
					});
				});

				self.win.close();
				if (typeof onSave === 'function') {
					onSave();
				}
			}
		}, {
			icon: 'ban',
			label: trans('DIALOG.CANCEL'),
			callback: function () {
				self.win.close();
				if (typeof onCancel === 'function') {
					onCancel();
				}
			}
		}]
	});

	// Tabs {{{2

	var makeTab = function (name, displayName) {
		var inputs = {};
		var labels = {};

		var div = jQuery('<div>');

		_.each([
			{id: 'empty', label: trans('GRID.TEMPLATE_EDITOR.CONFIG.EMPTY'), rows: 2},
			{id: 'before', label: trans('GRID.TEMPLATE_EDITOR.CONFIG.BEFORE'), rows: 2},
			{id: 'beforeGroup', label: trans('GRID.TEMPLATE_EDITOR.CONFIG.BEFORE_GROUP'), rows: 2, modes: ['whenPivot']},
			{id: 'item', label: trans('GRID.TEMPLATE_EDITOR.CONFIG.ITEM'), rows: name === 'whenPlain' ? 8 : 4 },
			{id: 'afterGroup', label: trans('GRID.TEMPLATE_EDITOR.CONFIG.AFTER_GROUP'), rows: 2, modes: ['whenPivot']},
			{id: 'after', label: trans('GRID.TEMPLATE_EDITOR.CONFIG.AFTER'), rows: 2},
		], function (x) {
			if (x.modes != null && x.modes.indexOf(name) < 0) {
				return;
			}
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

		return { div: div, inputs: inputs };
	};

	self.tabData = new OrdMap();
	self.tabData.set('whenPlain', makeTab('whenPlain', trans('GRID.TEMPLATE_EDITOR.PLAIN')));
	self.tabData.set('whenGroup', makeTab('whenGroup', trans('GRID.TEMPLATE_EDITOR.GROUPED')));
	self.tabData.set('whenPivot', makeTab('whenPivot', trans('GRID.TEMPLATE_EDITOR.PIVOTTED')));

	var tabsContainer = jQuery('<div>');
	var tabsWidget = new Tabs(tabsContainer);
	self.tabData.each(function (x, k) {
		var displayName = k === 'whenPlain' ? trans('GRID.TEMPLATE_EDITOR.PLAIN')
			: k === 'whenGroup' ? trans('GRID.TEMPLATE_EDITOR.GROUPED')
			: trans('GRID.TEMPLATE_EDITOR.PIVOTTED');
		tabsWidget.addPage(displayName, x.div);
	});

	self.win.setContent(tabsContainer);
});

// #show {{{2

TemplatesEditor.prototype.show = function () {
	var self = this;

	// Setup the values of each textarea.

	self.tabData.each(function (v, k) {
		var config = getProp(self.grid.defn, 'rendererOpts', k);
		if (config != null) {
			_.each(['empty', 'before', 'beforeGroup', 'item', 'afterGroup', 'after'], function (t) {
				if (v.inputs[t] && config[t]) {
					v.inputs[t].val(config[t]);
				}
			});
		}
	});

	self.win.open();
};

export {
	TemplatesEditor
};
