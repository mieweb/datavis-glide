import _ from 'underscore';
import JSONFormatter from 'json-formatter-js';

import { OrdMap } from 'datavis-ace';

import jQuery from 'jquery';

import {
	makeSubclass,
	ordmapAsHtmlDefnList,
} from '../../util/misc.js';
import { PopupWindow } from '../popup_window.js';
import { Tabs } from '../tabs.js';
import { Collapsible } from '../collapsible.js';

// DebugWin {{{1

var DebugWin = makeSubclass('DebugWin', Object, function () {
	var self = this;
});

// #show {{{2

DebugWin.prototype.show = function (grid, view, source) {
	var self = this;

	var pw = new PopupWindow({
		title: 'Debug Info',
		width: 600,
		maxHeight: 600,
		position: {
			my: 'center',
			at: 'middle',
			of: window
		}
	});

	pw.on('close', function () {
		pw.destroy();
	});

	var tabs = [{
		name: 'Source',
		id: 'sourceTab',
		items: [{
			name: 'Configuration',
			elt: (function () {
				var info = new OrdMap();
				info.set('Source type', source.type);
				info.set('Source name', source.name);
				info.set('Source spec', source.origin.spec);
				return jQuery('<div>')
					.append(ordmapAsHtmlDefnList(info));
			})()
		}, {
			name: 'Params',
			elt: jQuery('<div>')
				.append(new JSONFormatter(source.params, 0).render())
		}, {
			name: 'Type Info',
			elt: jQuery('<div>')
				.append(new JSONFormatter(source.cache.typeInfo.asMap(), 0).render())
		}]
	}, {
		name: 'View',
		id: 'viewTab',
		items: [{
			name: 'Current Config',
			elt: (function () {
				var info = new OrdMap();
				info.set('View name', view.name);
				info.set('Filter config', view.getFilter());
				info.set('Group config', view.getGroup());
				info.set('Pivot config', view.getPivot());
				info.set('Aggregate config', view.getAggregate());
				return jQuery('<div>')
					.append(ordmapAsHtmlDefnList(info));
			})()
		}]
	}, {
		name: 'Grid',
		id: 'gridTab',
		items: [{
			name: 'Columns',
			elt: jQuery('<div>')
				.append(new JSONFormatter(grid.colConfig.asMap(), 0).render())
		}]
	}, {
		name: 'Prefs',
		id: 'prefsTab',
		items: [{
			name: 'Configuration',
			elt: (function () {
				var info = new OrdMap();
				info.set('Auto-Save', grid.prefs.opts.autoSave);
				info.set('Backend Type', grid.prefs.opts.backend.type);
				info.set('Current Perspective', jQuery('<span>' + grid.prefs.currentPerspective.id + '<br/><i>' + grid.prefs.currentPerspective.name + '</i></span>'));
				info.set('Bardo', grid.prefs.bardo);
				return jQuery('<div>')
					.append(ordmapAsHtmlDefnList(info));
			})()
		}, {
			name: 'Perspectives',
			elt: (function () {
				var info = new OrdMap();
				_.each(grid.prefs.perspectives, function (p) {
					info.set(p.id, {
						'Name': p.name,
						'Config': p.config,
						'Status': p.isUnsaved ? 'Modified' : 'Saved'
					});
				});
				return jQuery('<div>')
					.append(ordmapAsHtmlDefnList(info));
			})()
		}]
	}];

	var tabsDiv = jQuery('<div>').css({
		'flex': 'auto',
		'overflow': 'hidden',
		'display': 'flex',
		'flex-direction': 'column'
	});
	var tabsWidget = new Tabs(tabsDiv);
	_.each(tabs, function (t) {
		var container = jQuery('<div>').css({
			'flex-grow': '1',
			'flex-shrink': '1',
			'flex-basis': 'auto',
			'overflow': 'scroll'
		});
		var collapsible = new Collapsible(container);
		_.each(t.items, function (ti) {
			collapsible.addSection(ti.name, ti.elt);
		});
		tabsWidget.addPage(t.name, container);
	});

	var contentDiv = jQuery('<div>').css({
		'display': 'flex',
		'flex-direction': 'column',
		'flex': '1',
		'overflow': 'hidden',
		'min-height': '0'
	}).append(tabsDiv);

	pw.setContent(contentDiv);

	var words = ['Very Cool', 'Thanks', 'Nice!', 'All Right', 'Whatever'];
	pw.setButtons([{
		icon: 'thumbs-up',
		label: words[Math.floor(Math.random() * words.length)],
		callback: function () {
			pw.close();
		}
	}]);

	pw.open();
};

export {
	DebugWin
};
