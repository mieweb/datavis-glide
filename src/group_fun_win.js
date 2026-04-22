import { OrdMap } from 'datavis-ace';

import jQuery from 'jquery';

import { trans } from './trans.js';
import {
	makeSubclass,
} from './util/misc.js';
import { PopupWindow } from './ui/popup_window.js';

// GroupFunWin {{{1

var GroupFunWin = makeSubclass('GroupFunWin', Object, function (title, groupFuns) {
	var self = this;

	var selected = null;

	self.win = new PopupWindow({
		title: title,
		width: 600
	});

	self.win.on('open', function () {
		selected = null;
	});

	self.win.on('close', function () {
		self.cb(selected);
	});

	var contentDiv = jQuery('<div>');

	var root = jQuery('<div>').css({
		'display': 'flex'
	}).appendTo(contentDiv);

	// These are the columns that contain related group function buttons.

	var categories = new OrdMap();
	categories.set('repeating', { display: trans('GRID.GROUP_FUN.DIALOG.REPEATING') });
	categories.set('date', { display: trans('GRID.GROUP_FUN.DIALOG.DATE') });
	categories.set('datetime', { display: trans('GRID.GROUP_FUN.DIALOG.DATE_TIME') });
	categories.set('time', { display: trans('GRID.GROUP_FUN.DIALOG.TIME') });
	categories.set('other', { display: trans('GRID.GROUP_FUN.DIALOG.OTHER') });

	// Create the UI for each category.

	categories.each(function (c) {
		c.div = jQuery('<div>', {'class': 'wcdv_groupfun_buttons'});
		c.root = jQuery('<div>').css({ 'flex': '1 1 auto' });
		c.root.append(jQuery('<h1>', {'class': 'wcdv_groupfun_header'}).text(c.display));
		c.root.append(c.div);
		c.members = 0;
	});

	self.buttons = {};

	// Go through each group function and create the UI for it, plus add it to the appropriate column.

	groupFuns.each(function (gf, gfName) {
		self.buttons[gfName] = jQuery('<button>', {
			'type': 'button',
			'class': 'wcdv_option',
			'data-wcdv-groupfunname': gfName,
			'title': gf.getTransName()
		})
			.text(gf.getTransName())
			.on('click', function () {
				selected = gfName;
				self.win.close();
			});

		var c = categories.get(gf.category) || categories.get('other');
		c.div.append(self.buttons[gfName]);
		c.members += 1;
	});

	// Only show categories that have group functions inside them.  Mostly, this prevents showing the
	// "Other" column unless someone has made their own group functions.

	categories.each(function (c) {
		if (c.members > 0) {
			root.append(c.root);
		}
	});

	// Add the "None" button to use no function.

	self.buttons['none'] = jQuery('<button>', {
		'type': 'button',
		'class': 'wcdv_option',
		'data-wcdv-groupfunname': 'none',
		'title': trans('GRID.GROUP_FUN.NONE')
	})
		.text(trans('GRID.GROUP_FUN.NONE'))
		.on('click', function () {
			selected = 'none';
			self.win.close();
		});

	contentDiv.append(jQuery('<div>').append(self.buttons['none']));

	self.win.setContent(contentDiv);
});

// #show {{{2

GroupFunWin.prototype.show = function (gfName, cb) {
	var self = this;
	self.cb = cb;

	self.win.open();

	if (gfName != null && self.buttons[gfName] != null) {
		self.buttons[gfName].focus();
	}
};

export {
	GroupFunWin
};
