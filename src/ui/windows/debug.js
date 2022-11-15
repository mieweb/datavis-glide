import _ from 'underscore';
import jQuery from 'jquery';
import JSONFormatter from '../../../third-party/json-formatter.esm.js';

import OrdMap from '../../util/ordmap.js';

import {
	fontAwesome,
	getPropDef,
	makeSubclass,
	moveArrayElement,
} from '../../util/misc.js';

// DebugWin {{{1

var DebugWin = makeSubclass('DebugWin', Object, function () {
	var self = this;
});

// #show {{{2

DebugWin.prototype.show = function (grid, view, source) {
	var self = this;

	var winEffect = {
		effect: 'fade',
		duration: 100
	};

	var win = jQuery('<div>', { title: 'Debug Info' }).css({
		'display': 'flex',
		'flex-direction': 'column'
	}).dialog({
		autoOpen: false,
		modal: true,
		width: 600,
		maxHeight: 600,
		position: {
			my: 'center',
			at: 'top',
			of: window
		},
		classes: {
			"ui-dialog": "ui-corner-all wcdv_dialog",
			"ui-dialog-titlebar": "ui-corner-all",
		},
		show: winEffect,
		hide: winEffect,
		close: function () {
			win.dialog('destroy');
		}
	});

	var tabs = [{
		name: 'Source',
		id: 'sourceConfigTab',
		elt: (function () {
			var info = new OrdMap();
			info.set('Source type', source.type);
			info.set('Source name', source.name);
			info.set('Source spec', source.origin.spec);
			return jQuery('<div>')
				.append(info.asHtmlDefnList());
// 				.append(new JSONFormatter(source.origin.spec, 0).render());
		})()
	}, {
		name: 'Params',
		id: 'paramsTab',
		elt: jQuery('<div>')
			.append(new JSONFormatter(source.params, 0).render())
	}, {
		name: 'Type Info',
		id: 'typeInfoTab',
		elt: jQuery('<div>')
			.append(new JSONFormatter(source.cache.typeInfo.asMap(), 0).render())
	}, {
		name: 'Col Config',
		id: 'colConfigTab',
		elt: jQuery('<div>')
			.append(new JSONFormatter(grid.colConfig.asMap(), 0).render())
	}];

	var tabsList = jQuery('<ul>').css({
		'flex-grow': '0',
		'flex-shrink': '0',
		'flex-basis': 'auto'
	});
	_.each(tabs, function (t) {
		var tabAnchor = jQuery('<a>', { href: '#' + t.id }).text(t.name);
		tabsList.append(jQuery('<li>').append(tabAnchor));
	});

	var tabsDiv = jQuery('<div>').css({
		'flex': 'auto',
		'overflow': 'hidden',
		'display': 'flex',
		'flex-direction': 'column'
	})
		.append(tabsList);
	_.each(tabs, function (t) {
		t.elt.attr({id: t.id}).css({
			'flex-grow': '1',
			'flex-shrink': '1',
			'flex-basis': 'auto',
			'overflow': 'scroll'
		});
		tabsDiv.append(t.elt);
	});
	tabsDiv.appendTo(win).tabs();

	var buttonBar = jQuery('<div>').css({
		'flex-grow': '0',
		'flex-shrink': '0',
		'flex-basis': 'auto',
		'padding-top': '2ex'
	})
		.addClass('wcdv_button_bar')
		.appendTo(win);

	var words = ['Very Cool', 'Thanks', 'Nice!', 'All Right', 'Whatever'];
	jQuery('<button>', {
		'type': 'button',
		'class': '',
		'title': 'Very Cool'
	})
		.append(fontAwesome('fa-thumbs-up'))
		.append(words[Math.floor(Math.random() * words.length)])
		.on('click', function () {
			win.dialog('close');
		})
		.appendTo(buttonBar);

	win.dialog('open');
};

export {
	DebugWin
};
