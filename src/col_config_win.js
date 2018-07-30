// ColConfigWin {{{1

var ColConfigWin = makeSubclass(Object, function (colConfig) {
	var self = this;

	if (colConfig != null) {
		self.setColConfig(colConfig);
	}
});

// #setColConfig {{{2

ColConfigWin.prototype.setColConfig = function (colConfig) {
	var self = this;

	self.colConfig = colConfig.clone();
};

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
		position: {
			my: 'top',
			at: 'bottom',
			of: posElt
		},
		buttons: [{
			text: 'OK',
			icon: 'ui-icon-check',
			click: function () {
				// Overwrite the "initial" configuration with one derived from the current one, based on the
				// order of the keys saved by the reordering the table rows.

				self.colConfig = new OrdMap();
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

	var colTableBody = jQuery('<tbody>')
		._makeSortableTable(function (oldIndex, newIndex) {
			colTableBody.children('tr').eq(newIndex).effect('highlight', 750);
			moveArrayElement(keys, oldIndex, newIndex);
		})
		.appendTo(colTable);

	var keys = current.keys();

	current.each(function (colConfig, colName) {
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
			.text(colName)
			.appendTo(tr);

		td = jQuery('<td>')
			.addClass('wcdv_minimal_width')
			.appendTo(tr);

		var isHiddenCheckbox = jQuery('<input>', {'type': 'checkbox'})
			.prop('checked', !!getProp(colConfig, 'isHidden'))
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
				self.showConfigWin(colName);
			})
			.appendTo(td);
		*/

		tr.appendTo(colTableBody);
	});

	orderWin.dialog('open');
};
