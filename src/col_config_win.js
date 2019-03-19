import _ from 'underscore';
import jQuery from 'jquery';

import {
	fontAwesome,
	getPropDef,
	makeSubclass,
	moveArrayElement,
} from './util.js';

// ColConfigWin {{{1

var ColConfigWin = makeSubclass('ColConfigWin', Object, function (grid, colConfig) {
	var self = this;

	self.grid = grid;
	self.colConfig = colConfig;

	grid.on('colConfigUpdate', function (colConfig) {
		self.colConfig = colConfig;
	});
});

// #show {{{2

ColConfigWin.prototype.show = function (posElt, onSave) {
	var self = this;

	var current = self.colConfig.clone();

	var orderWinEffect = {
		effect: 'fade',
		duration: 100
	};

	var orderWin = jQuery('<div>', { title: 'Columns' }).dialog({
		autoOpen: false,
		modal: true,
		width: 600,
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
				// Overwrite the "initial" configuration with one derived from the current one, based on the
				// order of the keys saved by the reordering the table rows.

				self.colConfig.clear();
				_.each(keys, function (k) {
					self.colConfig.set(k, current.get(k));
				});

				orderWin.dialog('close');
				onSave(self.colConfig);
			}
		}, {
			text: 'Cancel',
			icon: 'ui-icon-cancel',
			click: function () {
				orderWin.dialog('close');
			}
		}],
		show: orderWinEffect,
		hide: orderWinEffect,
		close: function () {
			orderWin.dialog('destroy');
		}
	});

	var colTable = jQuery('<table>')
		.addClass('wcdv_colconfigwin_table')
		.appendTo(orderWin);

	var colTableHeader = jQuery('<thead><th></th><th>Field</th><th>Display</th><th></th><th></th>')
		.appendTo(colTable);

	var keys = current.keys();

	var colTableBody = jQuery('<tbody>')
		._makeSortableTable(function (oldIndex, newIndex) {
			colTableBody.children('tr').eq(newIndex).effect('highlight', 750);
			moveArrayElement(keys, oldIndex, newIndex);
		})
		.appendTo(colTable);

	current.each(function (colConfig, field) {
		var tr, td;

		tr = jQuery('<tr>');
		td = jQuery('<td>')
			.addClass('wcdv_minimal_width')
			.appendTo(tr);

		var dragButton = jQuery('<button>', {'type': 'button', 'title': 'Click and drag to reorder columns'})
			.addClass('wcdv_icon_button drag-handle')
			.append(fontAwesome('fa-bars'))
			.appendTo(td);

		td = jQuery('<td>')
			.text(field)
			.appendTo(tr);

		td = jQuery('<td>')
			.css('color', colConfig.displayText ? '#000000' : '#C0C0C0')
			.text(colConfig.displayText || field)
			.appendTo(tr);
		var displayTextTd = td;

		td = jQuery('<td>')
			.addClass('wcdv_minimal_width')
			.appendTo(tr);

		var renameBtn = jQuery('<button>', {'type': 'button', 'title': 'Rename'})
			.addClass('wcdv_icon_button')
			.append(fontAwesome('fa-pencil'))
			.on('click', function () {
				var newName = prompt('Rename field "' + field + '" to what?');

				if (newName) {
					colConfig.displayText = newName;
					displayTextTd
						.css('color', colConfig.displayText ? '#000000' : '#C0C0C0')
						.text(newName);
				}
			})
			.appendTo(td)
		;

		td = jQuery('<td>')
			.addClass('wcdv_minimal_width')
			.appendTo(tr);

		var isHiddenCheckbox = jQuery('<input>', {'type': 'checkbox'})
			.prop('disabled', !getPropDef(true, colConfig, 'canHide'))
			.prop('checked', getPropDef(false, colConfig, 'isHidden'))
			.on('change', function () {
				colConfig.isHidden = isHiddenCheckbox.prop('checked');
			})
			.appendTo(td)
			._makeIconCheckbox('fa-eye-slash', 'fa-eye');

		/*
		td = jQuery('<td>')
			.addClass('wcdv_minimal_width')
			.appendTo(tr);

		var configBtn = jQuery('<button>', {'type': 'button', 'title': 'Click to configure column'})
			.addClass('wcdv_icon_button')
			.append(fontAwesome('fa-gear'))
			.on('click', function () {
				self.showConfigWin(field);
			})
			.appendTo(td);
		*/

		tr.appendTo(colTableBody);
	});

	orderWin.dialog('open');
};

export {
	ColConfigWin
};
