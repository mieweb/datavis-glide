import _ from 'underscore';
import jQuery from 'jquery';

import {
	deepCopy,
	fontAwesome,
	makeRadioButtons,
	makeSubclass,
	makeToggleCheckbox,
} from '../../util/misc.js';

import {ToolbarSection} from '../toolbar.js';
import {PrefsBackendTemporary} from '../../prefs.js';

// PlainToolbar {{{1

var PlainToolbar = makeSubclass('PlainToolbar', ToolbarSection, function (grid) {
	var self = this;

	self.super.ctor.apply(self, []);
	self.ui.root.addClass('wcdv_toolbar_section');

	self.grid = grid;

	grid.ui.limit_div = jQuery('<div>').css({'display': 'inline-block'}).appendTo(self.ui.root);

	// Create a checkbox that will toggle the "automatically show more" feature for the grid table.

	self.ui.autoShowMore = makeToggleCheckbox(
		grid.defn,
		['table', 'limit', 'autoShowMore'],
		true,
		'Show More on Scroll',
		grid.ui.limit_div
	);

	// Create a button that will show all the rows when clicked.  We fake this a little bit by just
	// turning off the "limit" feature and letting the grid table be redrawn (changing the features
	// causes it to be redrawn).
	//
	// TODO: This should disable the "automatically show more" checkbox (need to make sure it gets
	// re-enabled if we switch grid tables and come back - as "limit" feature will be reset to its
	// default value).

	jQuery('<button>', {'type': 'button'})
		.on('click', function (evt) {
			grid.renderer.updateFeatures({
				'block': true,
				'progress': true,
				'limit': false
			});
		})
		.text('Show All Rows')
		.appendTo(grid.ui.limit_div)
	;

	self.ui.columnConfig = jQuery('<button>', {
		'type': 'button'
	})
		.append(fontAwesome('fa-columns'))
		.append('Columns')
		.on('click', function (evt) {
			grid.colConfigWin.show(grid.ui.controls, function (colConfig) {
				grid.setColConfig(colConfig, {
					from: 'ui'
				});
			});
		})
		.appendTo(self.ui.root)
	;

	self.ui.handlebarsEditor = jQuery('<button>', {
		'type': 'button'
	})
		.append(fontAwesome('fa-pencil'))
		.append('Handlebars Editor')
		.on('click', function (evt) {
			grid.handlebarsEditor.show();
		})
		.appendTo(self.ui.root)
	;
});

// #update {{{2

PlainToolbar.prototype.update = function () {
	var self = this;

	if (self.grid.renderer.features.limit) {
		self.grid.ui.limit_div.show();
		self.ui.autoShowMore.show();
	}
	else {
		self.grid.ui.limit_div.hide();
		self.ui.autoShowMore.hide();
	}

	switch (self.grid.rendererName) {
	case 'table':
		self.ui.columnConfig.show();
		self.ui.handlebarsEditor.hide();
		break;
	case 'handlebars':
		self.ui.columnConfig.hide();
		self.ui.handlebarsEditor.show();
		break;
	}
};

// GroupToolbar {{{1

var GroupToolbar = makeSubclass('GroupToolbar', ToolbarSection, function (grid) {
	var self = this;

	self.super.ctor.apply(self, []);
	self.ui.root.addClass('wcdv_toolbar_section');

	self.grid = grid;

	var aggSpec;

	grid.view.on('aggregateSet', function (a) {
		aggSpec = deepCopy(a);
	});

	var enableDisable = function (selected) {
		switch (selected) {
		case 'summary':
			self.ui.showTotalRow.prop('disabled', false);
			self.ui.pinRowVals.prop('disabled', false);
			self.ui.columnConfig.prop('disabled', true);
			break;
		case 'detail':
			self.ui.showTotalRow.prop('disabled', true);
			self.ui.pinRowVals.prop('disabled', true);
			self.ui.columnConfig.prop('disabled', false);
			break;
		}
	};

	// Create radio buttons to switch between summary and detail group grid tables.

	self.ui.groupMode = makeRadioButtons(
		grid.defn
		, ['table', 'groupMode']
		, 'detail'
		, null
		, 'groupOutput'
		, [{label: 'Summary', value: 'summary'}
			, {label: 'Detail', value: 'detail'}]
		, null
		, function (selected) {
			enableDisable(selected);
			grid.redraw();
		}
		, self.ui.root
	);

	self.ui.showTotalRow = makeToggleCheckbox(
		grid.defn,
		['table', 'whenGroup', 'showTotalRow'],
		true,
		'Total Row',
		self.ui.root,
		function (isChecked) {
			var agg = grid.view.getAggregate();

			if (!isChecked) {
				aggSpec = deepCopy(agg);
				delete agg.all;
			}
			else {
				agg.all = aggSpec.all;
			}

			grid.view.setAggregate(agg, {
				sendEvent: false
			});
		}
	);

	self.ui.pinRowVals = makeToggleCheckbox(
		grid.defn,
		['table', 'whenGroup', 'pinRowvals'],
		false,
		'Pin Groups',
		self.ui.root,
		function (isChecked) {
			grid.redraw();
		}
	);

	self.ui.columnConfig = jQuery('<button>', {
		'type': 'button'
	})
		.append(fontAwesome('fa-columns'))
		.append('Columns')
		.on('click', function (evt) {
			grid.colConfigWin.show(grid.ui.controls, function (colConfig) {
				grid.setColConfig(colConfig, {
					from: 'ui'
				});
			});
		})
		.appendTo(self.ui.root)
	;

	self.ui.handlebarsEditor = jQuery('<button>', {
		'type': 'button'
	})
		.append(fontAwesome('fa-pencil'))
		.append('Handlebars Editor')
		.on('click', function (evt) {
			grid.handlebarsEditor.show();
		})
		.appendTo(self.ui.root)
	;

	enableDisable(grid.defn.table.groupMode);
});

// #update {{{2

GroupToolbar.prototype.update = function () {
	var self = this;

	switch (self.grid.rendererName) {
	case 'table':
		self.ui.groupMode.show();
		self.ui.showTotalRow.show();
		self.ui.pinRowVals.show();
		self.ui.columnConfig.show();
		self.ui.handlebarsEditor.hide();
		break;
	case 'handlebars':
		self.ui.groupMode.hide();
		self.ui.showTotalRow.hide();
		self.ui.pinRowVals.hide();
		self.ui.columnConfig.hide();
		self.ui.handlebarsEditor.show();
		break;
	}
};

// PivotToolbar {{{1

var PivotToolbar = makeSubclass('PivotToolbar', ToolbarSection, function (grid) {
	var self = this;

	self.super.ctor.apply(self, []);
	self.ui.root.addClass('wcdv_toolbar_section');

	self.grid = grid;

	var aggSpec;

	grid.view.on('aggregateSet', function (a) {
		aggSpec = deepCopy(a);
	});

	self.ui.showTotals = makeToggleCheckbox(
		grid.defn,
		['table', 'whenPivot', 'showTotalCol'],
		true,
		'Total Row/Column',
		self.ui.root,
		function (isChecked) {
			var agg = grid.view.getAggregate();

			if (!isChecked) {
				aggSpec = deepCopy(agg);
				delete agg.group;
				delete agg.pivot;
				delete agg.all;
			}
			else {
				agg.group = aggSpec.group;
				agg.pivot = aggSpec.pivot;
				agg.all = aggSpec.all;
			}

			grid.view.setAggregate(agg, {
				sendEvent: false
			});
		}
	);

	self.ui.pinRowVals = makeToggleCheckbox(
		grid.defn,
		['table', 'whenGroup', 'pinRowvals'],
		false,
		'Pin Groups',
		self.ui.root,
		function (isChecked) {
			grid.redraw();
		}
	);

	self.ui.handlebarsEditor = jQuery('<button>', {
		'type': 'button'
	})
		.append(fontAwesome('fa-pencil'))
		.append('Handlebars Editor')
		.on('click', function (evt) {
			grid.handlebarsEditor.show();
		})
		.appendTo(self.ui.root)
	;
});

// #update {{{2

PivotToolbar.prototype.update = function () {
	var self = this;

	switch (self.grid.rendererName) {
	case 'table':
		self.ui.showTotals.show();
		self.ui.pinRowVals.show();
		self.ui.handlebarsEditor.hide();
		break;
	case 'handlebars':
		self.ui.showTotals.hide();
		self.ui.pinRowVals.hide();
		self.ui.handlebarsEditor.show();
		break;
	}
};

// PrefsToolbar {{{1

var PrefsToolbar = makeSubclass('PrefsToolbar', ToolbarSection, function (grid) {
	var self = this;

	self.super.ctor.apply(self, []);
	self.ui.root.addClass('wcdv_toolbar_section');

	self.grid = grid;

	var div = jQuery('<div>')
		.addClass('wcdv_toolbar_view')
		.css({'display': 'inline-block'})
		.appendTo(self.ui.root)
	;

	var options = {};

	var showHideBtns = function () {
		var p = grid.prefs.getPerspective(dropdown.val());

		if (p == null) {
			throw new Error('No such perspective: ' + dropdown.val());
		}

		if (p.opts.isTemporary) {
			saveAsBtn.show();
		}
		else {
			saveAsBtn.hide();
		}

		if (p.opts.isEssential) {
			renameBtn.hide();
			deleteBtn.hide();
		}
		else {
			renameBtn.show();
			deleteBtn.show();
		}
	};

	var removePerspectiveFromDropdown = function (name) {
		options[name].remove();
		delete options[name];
	};

	// Clicking this button will reset all preferences back to the initial set (i.e. just "Main
	// Perspective" and no changes in the view from its default).  Perhaps useful when you have too
	// many different perspectives set, but I feel better having it as a safety in case your prefs
	// somehow get really messed up and don't work at all anymore.  This button is always shown.

	var resetBtn = jQuery('<button>', {'type': 'button', 'title': 'Reset'})
		.addClass('wcdv_icon_button wcdv_text-primary')
		.append(fontAwesome('fa-undo'))
		.on('click', function () {
			grid.prefs.reset();
		})
		.appendTo(div)
	;

	var backBtn = jQuery('<button>', {'type': 'button'})
		.append(fontAwesome('fa-chevron-circle-left'))
		.attr('title', 'Back')
		.attr('disabled', true)
		.addClass('wcdv_icon_button wcdv_text-primary')
		.on('click', function () {
			grid.prefs.back();
		})
		.appendTo(div)
	;

	var forwardBtn = jQuery('<button>', {'type': 'button'})
		.append(fontAwesome('fa-chevron-circle-right'))
		.attr('title', 'Forward')
		.attr('disabled', true)
		.addClass('wcdv_icon_button wcdv_text-primary')
		.on('click', function () {
			grid.prefs.forward();
		})
		.appendTo(div)
	;

	/*
	var historyBtn = jQuery(fontAwesome('fa-clock-o', 'wcdv_button', 'History'))
		.on('click', function () {
			grid.prefs._historyDebug();
		})
		.appendTo(div)
	;
	*/

	// Dropdown of all the available perspectives, plus an entry that (when selected) prompts for the
	// name of a new perspective.

	var dropdown = jQuery('<select>')
		.append(jQuery('<option>', { value: 'NEW' }).text('New Perspective...'))
		.on('change', function (evt) {
			if (dropdown.val() === 'NEW') {
				var name = prompt('Enter new perspective name', grid.prefs.currentPerspective.name);
				if (name) {
					grid.prefs.addPerspective(null, name);
					grid.prefs.save();
				}
				else {
					// User cancelled the dialog, so just put the dropdown back to whatever the current
					// perspective is.
					dropdown.val(grid.prefs.currentPerspective.id);
				}
				return;
			}

			grid.prefs.setCurrentPerspective(dropdown.val());
			showHideBtns();
		})
		.appendTo(div)
	;

	var warnMsgText = jQuery('<span>');

	var warnMsgContent = jQuery('<div>')
		.append(fontAwesome('fa-info-circle').css('padding-right', '0.25em').addClass('wcdv_text-primary'))
		.append(warnMsgText);

	var warnMsg = fontAwesome('fa-info-circle', 'wcdv_info_icon')
		.attr({'title': 'Info'})
		.hide()
		.tooltip({
			classes: {
				'ui-tooltip': 'ui-corner-all ui-widget-shadow wcdv_info_tooltip wcdv_border-primary'
			},
			show: { delay: 1000 },
			content: warnMsgContent,
		})
		.appendTo(div)
	;

	if (grid.prefs.backend instanceof PrefsBackendTemporary) {
		warnMsgText.text('The preferences system is not configured to permanently save perspectives.');
		warnMsg.show();
	}

	var saveAsBtnTooltipContent = jQuery('<div>')
		.append(fontAwesome('fa-info-circle').css('padding-right', '0.25em').addClass('wcdv_text-primary'))
		.append('This pre-defined perspective cannot be saved with this name.  Click to save with a new name.  After that, any changes will be saved under the new name.');

	var saveAsBtn = jQuery('<button>', {'type': 'button', 'title': 'Save As...'})
		.append(fontAwesome('fa-save'))
		.addClass('wcdv_icon_button wcdv_text-primary')
		.tooltip({
			classes: {
				'ui-tooltip': 'ui-corner-all ui-widget-shadow wcdv_info_tooltip wcdv_border-primary'
			},
			show: { delay: 1000 },
			content: saveAsBtnTooltipContent
		})
		.on('click', function () {
			var name = prompt('Enter new perspective name', grid.prefs.currentPerspective.name);
			if (name != null) {
				grid.prefs.addPerspective(name);
				grid.prefs.save();
			}
		})
		.appendTo(div)
	;

	var saveBtnTooltipContent = jQuery('<div>')
		.append(fontAwesome('fa-info-circle').css('padding-right', '0.25em').addClass('wcdv_text-primary'))
		.append('Click to save the current configuration.  The next time this grid is visited, the previously saved configuration will automatically be used.');

	var saveBtn = jQuery('<button>', {'type': 'button', 'title': 'Save'})
		.append(fontAwesome('fa-save'))
		.addClass('wcdv_icon_button wcdv_text-primary')
		.hide()
		.tooltip({
			classes: {
				'ui-tooltip': 'ui-corner-all ui-widget-shadow wcdv_info_tooltip wcdv_border-primary'
			},
			show: { delay: 1000 },
			content: saveBtnTooltipContent
		})
		.on('click', function () {
			grid.prefs.reallySave();
		})
		.appendTo(div)
	;

	// Clicking this button will show a prompt to rename the currently selected perspective.  If you
	// cancel the prompt, nothing will happen.  This button is only shown when the currently selected
	// perspective is not "Main Perspective" as it cannot be renamed.
	//
	// XXX: What if the user types in the name of an existing perspective?
	// XXX: What if the user types in "Main Perspective" ?
	// XXX: What if the user types in "NEW" ?

	var renameBtn = jQuery('<button>', {'type': 'button', 'title': 'Rename'})
		.addClass('wcdv_icon_button wcdv_text-primary')
		.append(fontAwesome('fa-pencil'))
		.on('click', function () {
			var id = dropdown.val();
			var p = grid.prefs.getPerspective(id);

			if (p.opts.isEssential) {
				alert('Cannot rename essential perspective!');
			}
			else {
				var newName = prompt('Rename view "' + p.name + '" to what?');
				if (newName) {
					grid.prefs.renamePerspective(id, newName);
				}
			}
		})
		.appendTo(div)
	;

	// Clicking this button will delete the currently selected perspective and switch back to "Main
	// Perspective".  It is only shown when the currently selected perspective is not "Main
	// Perspective" as it cannot be deleted.

	var deleteBtn = jQuery('<button>', {'type': 'button', 'title': 'Delete'})
		.addClass('wcdv_icon_button wcdv_text-primary')
		.append(fontAwesome('fa-trash'))
		.on('click', function () {
			grid.prefs.deletePerspective(dropdown.val());
		})
		.appendTo(div)
	;

	// Get the list of available perspectives from the Prefs instance and put them into the dropdown.
	// The initial perspective will be selected by default.  This DOES NOT actually load that
	// perspective, it's just for the UI.
	//
	// XXX: Is it possible for perspectives to change by some other route so that we need to know
	// about it to update the UI?

	setTimeout(function () {
		grid.prefs.prime(function () {
			grid.prefs.getPerspectives(function (ids) {
				_.each(_.sortBy(_.map(ids, function (id) {
					return grid.prefs.getPerspective(id);
				}), 'name'), function (o) {
					if (options[o.id] == null) {
						options[o.id] = jQuery('<option>', { 'value': o.id })
							.text(o.name)
							.appendTo(dropdown);
					}
				});

				dropdown.val(grid.prefs.currentPerspective.id);
				showHideBtns();
			});

			grid.prefs.on('perspectiveAdded', function (id) {
				if (options[id] == null) {
					var p = grid.prefs.getPerspective(id);
					options[id] = jQuery('<option>', { value: id })
						.text(p.name)
						.appendTo(dropdown);
				}
			}, {
				info: 'Adding new perspective to dropdown'
			});

			grid.prefs.on('perspectiveDeleted', function (id) {
				if (options[id] == null) {
					throw new Error(sprintf.sprintf('Received `perspectiveDeleted` event that references unknown perspective: id = "%s"', id));
				}
				options[id].remove();
				delete options[id];
			}, {
				info: 'Removing perspective from dropdown'
			});

			grid.prefs.on('perspectiveRenamed', function (id, newName) {
				if (options[id] == null) {
					throw new Error(sprintf.sprintf('Received `perspectiveRenamed` event that references unknown perspective: id = "%s"', id));
				}
				options[id].text(newName);
			}, {
				info: 'Changing perspective name in dropdown'
			});

			grid.prefs.on('perspectiveChanged', function (id) {
				if (options[id] == null) {
					throw new Error(sprintf.sprintf('Received `perspectiveChanged` event that references unknown perspective: id = "%s"', id));
				}
				if (grid.prefs.currentPerspective.isUnsaved) {
					saveBtn.show();
				}
				else {
					saveBtn.hide();
				}
				dropdown.val(id);
				showHideBtns();
				grid.redraw();
			}, {
				info: 'Changing dropdown to reflect new current perspective'
			});

			grid.prefs.on('prefsReset', function () {
				_.each(options, function (elt) {
					elt.remove();
				});
				options = {};
			}, {
				info: 'Deleting all perspectives from the dropdown'
			});

			grid.prefs.on('prefsChanged', function () {
				var cp = grid.prefs.currentPerspective;
				var o = options[cp.id];
				o.text('[*] ' + cp.name);
				saveBtn.show();
			});

			grid.prefs.on('prefsSaved', function () {
				var cp = grid.prefs.currentPerspective;
				var o = options[cp.id];
				o.text(cp.name);
				saveBtn.hide();
			});

			grid.prefs.on('prefsHistoryStatus', function (back, forward) {
				backBtn.attr('disabled', !back);
				forwardBtn.attr('disabled', !forward);
			});
		});
	});
});

// Exports {{{1

export {
	PlainToolbar,
	GroupToolbar,
	PivotToolbar,
	PrefsToolbar,
};
