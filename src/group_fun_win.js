import _ from 'underscore';
import jQuery from 'jquery';

import {
	fontAwesome,
	getPropDef,
	makeSubclass,
	moveArrayElement,
} from './util.js';

// GroupFunWin {{{1

var GroupFunWin = makeSubclass('GroupFunWin', Object, function (groupFuns, cb) {
	var self = this;

	var winEffect = {
		effect: 'fade',
		duration: 100
	};

	var selected = null;

	self.win = jQuery('<div>', { title: 'Apply Function' }).dialog({
		autoOpen: false,
		modal: true,
		position: {
			my: 'center',
			at: 'center',
			of: window
		},
		classes: {
			"ui-dialog": "ui-corner-all wcdv_dialog",
			"ui-dialog-titlebar": "ui-corner-all",
		},
		show: winEffect,
		hide: winEffect,
		open: function () {
			selected = null;
		},
		close: function () {
			cb(selected);
		}
	});

	self.buttons = {};

	groupFuns.each(function (gf, gfName) {
		self.buttons[gfName] = jQuery('<button>', {
			'type': 'button',
			'class': 'wcdv_option',
			'title': gf.displayName
		})
			.text(gf.displayName)
			.on('click', function () {
				selected = gfName;
				self.win.dialog('close');
			});

		self.win.append(jQuery('<div>').append(self.buttons[gfName]));
	});

	// Add the "None" button to use no function.

	self.buttons['none'] = jQuery('<button>', {
		'type': 'button',
		'class': 'wcdv_option',
		'title': 'None'
	})
		.text('None')
		.on('click', function () {
			selected = 'none';
			self.win.dialog('close');
		});

	self.win.append(jQuery('<div>').append(self.buttons['none']));
});

// #show {{{2

GroupFunWin.prototype.show = function (gfName) {
	var self = this;

	self.win.dialog('open');

	if (gfName != null && self.buttons[gfName] != null) {
		self.buttons[gfName].focus();
	}
};

export {
	GroupFunWin
};
