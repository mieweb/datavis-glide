/*
 * Grid controls are the rounded boxes that appear between the toolbar and the grid.  They allow
 * dynamic configuration of the view to which the grid is bound.
 *
 *   - Filters
 *   - Group Fields
 *   - Pivot Fields
 *   - Aggregates
 *
 * Each control is basically a list of things that have been added to it, e.g. for grouping, it's a
 * list of fields to group by.  Internally, the control is an instance of a subclass of GridControl,
 * and the items are corresponding instances of a subclass of GridControlField.  The name "Field"
 * here is historical, before aggregates were specified this way, all controls managed fields from
 * the source data.
 */

// GridControlField {{{1

// Constructor {{{2

/**
 * Represents an individual field added to a control.  In an older iteration, this literally
 * corresponded to a field in the data (e.g. because the control was a filter, group, or pivot).
 * Now that aggregate functions are also managed through a GridControl subclass, the "field" name is
 * no longer strictly accurate.
 *
 *
 *
 * @param {GridControl} control
 *
 * @param {string} field
 *
 * @param {string} displayText
 *
 * @param {object} colConfig
 *
 *
 *
 * @property {GridControl} control
 *
 * @property {string} field
 *
 * @property {string} displayText
 *
 * @property {object} colConfig
 *
 * @property {object} ui
 * Refers to all user interface constructs that we might need to use later.
 *
 * @property {Element} ui.root
 * The DIV that completely contains the control field.
 *
 * @property {Element} ui.removeButton
 * A button that is used to remove the control field.
 */

var GridControlField = makeSubclass(Object, function (control, field, displayText, colConfig) {
	var self = this;

	self.control = control;
	self.field = field;
	self.displayText = displayText;
	self.colConfig = colConfig;
	self.ui = {};
});

// #draw {{{2

/**
 * Renders the control field into a DIV.
 *
 * @returns {Element}
 * A newly created DIV that contains everything needed by the control field.
 */

GridControlField.prototype.draw = function () {
	var self = this;

	self.ui.removeButton = jQuery('<button>')
		.append(fontAwesome('F146'))
		.attr('title', 'Remove')
		.addClass('wcdv_icon_button wcdv_remove')
		.on('click', function () {
			self.control.removeField(self);
		})
	;

	self.ui.root = jQuery('<div>', { 'class': 'wcdv_field' })
		.append(self.ui.removeButton)
		.append(jQuery('<span>').text(self.displayText || (self.colConfig && self.colConfig.displayText) || self.field))
	;

	return self.ui.root;
};

// #getElement {{{2

/**
 * Gets the DIV that contains the UI for this control field.
 *
 * @returns {Element}
 * The DIV that this control field was rendered into.
 */

GridControlField.prototype.getElement = function () {
	var self = this;

	return self.ui.root;
};

// #destroy {{{2

/**
 * Called when the control field is removed; should be used to clean up resources like DOM nodes and
 * event handlers.
 */

GridControlField.prototype.destroy = function () {
	// DO NOTHING
};

// GroupControlField {{{1

// Constructor {{{2

var GroupControlField = makeSubclass(GridControlField);

// PivotControlField {{{1

// Constructor {{{2

var PivotControlField = makeSubclass(GridControlField);

// FilterControlField {{{1
// Constructor {{{2

var FilterControlField = makeSubclass(GridControlField);

// #draw {{{2

FilterControlField.prototype.draw = function () {
	var self = this;

	self.super.draw();
	self.ui.filterContainer = jQuery('<div>')
		.addClass('wcdv_filter_control_filter_container')
		.appendTo(self.ui.root);
	self.control.gfs.add(self.field, self.ui.filterContainer);

	return self.ui.root;
};
// AggregateControlField {{{1
// Constructor {{{2

var AggregateControlField = makeSubclass(GridControlField, function () {
	var self = this;

	self.super.ctor.apply(self, arguments);
	self.fieldDropdowns = [];
});

// #draw {{{2

AggregateControlField.prototype.draw = function () {
	var self = this;

	self.super.draw();

	var aggDefn = AGGREGATE_REGISTRY.get(self.field);

	if (aggDefn.prototype.options != null) {
		jQuery('<button>', {
			title: 'Edit Options'
		})
			.addClass('wcdv_icon_button wcdv_button_left')
			.on('click', function () {
				self.ui.optionsDialog.dialog('open');
			})
			.append(fontAwesome('F044'))
			.appendTo(self.ui.root)
		;
		self._makeOptionsDialog(aggDefn);
	}

	var fieldList = jQuery('<ul>').appendTo(self.ui.root);

	for (var i = 0; i < aggDefn.prototype.fieldCount; i += 1) {
		var li = jQuery('<li>').addClass('wcdv_aggregate_field').appendTo(fieldList);
		var select = jQuery('<select>')
			.on('change', function () {
				self.control.updateView();
			})
			.appendTo(li);
		self.fieldDropdowns.push(select);
	}

	_.each(availableFields(self.control.defn, null, self.control.typeInfo), function (fieldName) {
		var text = getProp(self.control.colConfig, fieldName, 'displayText') || fieldName;
		_.each(self.fieldDropdowns, function (dropdown) {
			jQuery('<option>', { 'value': fieldName }).text(text).appendTo(dropdown);
		});
	});

	return self.ui.root;
};

// #_makeOptionsDialog {{{2

AggregateControlField.prototype._makeOptionsDialog = function (aggDefn) {
	var self = this;

	self.ui.optionsDiv = jQuery('<div>')
		.css('display', 'none')
		.appendTo(document.body);

	var table = jQuery('<table>').appendTo(self.ui.optionsDiv);
	var opts = {};

	_.each(aggDefn.prototype.options, function (optConfig, optName) {
		optConfig = deepDefaults(optConfig, {
			type: 'string',
			widget: 'text',
			displayText: optName
		});
		var id = gensym();
		var input = jQuery('<input>', {
			'type': 'text',
			'id': id
		});
		opts[optName] = input;
		var label = jQuery('<label>', {
			'for': id
		}).text(optConfig.displayText);
		jQuery('<tr>')
			.append(jQuery('<td>').append(label))
			.append(jQuery('<td>').append(input))
			.appendTo(table);
	});

	jQuery('<div>')
		.css({
			'text-align': 'center',
			'margin-top': '1ex'
		})
		.append(jQuery('<button>')
			.append(fontAwesome('F00C'))
			.append('OK')
			.on('click', function () {
				console.log('OK!');
				self.opts = opts;
				self.control.updateView();
				self.ui.optionsDialog.dialog('close');
			}))
		.append(jQuery('<button>')
			.css('margin-left', '1em')
			.append(fontAwesome('F05E'))
			.append('Cancel')
			.on('click', function () {
				console.log('CANCEL!');
				self.ui.optionsDialog.dialog('close');
			}))
		.appendTo(self.ui.optionsDiv)
	;

	self.ui.optionsDialog = self.ui.optionsDiv.dialog({
		autoOpen: false,
		modal: true,
		title: aggDefn.prototype.name + ' — Options',
		minHeight: 0
	});
};

// #destroy {{{2

AggregateControlField.prototype.destroy = function () {
	var self = this;

	if (self.ui.optionsDiv != null) {
		self.ui.optionsDialog.dialog('destroy');
		self.ui.optionsDiv.remove();
	}

	self.super.destroy();
};

// #getInfo {{{2

AggregateControlField.prototype.getInfo = function () {
	var self = this;

	return {
		fun: self.field,
		fields: _.map(self.fieldDropdowns, function (dropdown) {
			return dropdown.val();
		}),
		name: null,
		opts: _.mapObject(self.opts, function (input, optName) {
			return input.val();
		})
	};
};

// GridControl {{{1

// Constructor {{{2

/**
 * @class
 *
 * An abstract class that represents some kind of interface that the user can operate over the
 * available fields.
 *
 * Subclasses should implement the following functions:
 *
 * - `draw(TARGET)`
 *   Called to create all required user interface components.
 *
 * - `updateView()`
 *   Use `self.fields` to set whatever properties are needed on the view.
 *
 * @property {Array.<string>} fields
 * List of all the fields selected by the user.
 *
 * @property {Array.<ControlField>} controlFields
 * List of all the control fields currently in the UI.
 *
 * @property {object} ui
 * Object containing different user interface components.
 *
 * @property {jQuery} ui.dropdown
 * The SELECT element containing the available fields.
 */

var GridControl = makeSubclass(Object, function (grid, defn, view, features, timing) {
	var self = this;

	self.defn = defn;
	self.view = view;
	self.features = features;
	self.timing = timing;
	self.ui = {};

	if (self.useColConfig) {
		self.colConfig = _.indexBy(getPropDef({}, self.defn, 'table', 'columns'), 'field');
	}

	self.fields = [];
	self.controlFields = [];
}, {
	isHorizontal: false,
	disableUsedItems: true,
	useColConfig: true
});

// Events {{{2

mixinEventHandling(GridControl, 'GridControl', [
		'fieldAdded'
	, 'fieldRemoved'
	, 'cleared'
]);

// #makeAddButton {{{2

/**
 * Make a button that calls the `addField` method when clicked.
 *
 * @param {jQuery} target
 * Where to append the button.
 *
 * @returns {jQuery}
 * The button created.
 */

GridControl.prototype.makeAddButton = function (target) {
	var self = this;

	return jQuery(fontAwesome('F0FE'))
		.addClass('wcdv_button')
		.css({'margin-left': '4px'})
		.on('click', function () {
			self.addField(self.ui.dropdown.val(), self.ui.dropdown.find('option:selected').text());
		})
		.appendTo(target);
};

// #makeClearButton {{{2

/**
 * Make a button that calls the `clear` method when clicked.
 *
 * @param {jQuery} target
 * Where to append the button.
 *
 * @returns {jQuery}
 * The button created.
 */

GridControl.prototype.makeClearButton = function (target) {
	var self = this;

	return jQuery(fontAwesome('F05E'))
		.addClass('wcdv_button')
		.css('margin-left', '4px')
		.hide()
		.on('click', function () {
			jQuery(this).hide();
			self.clear();
		})
		.appendTo(target);
};

// #addField {{{2

/**
 * Add a field to this control.  Automatically updates the view afterwards.
 *
 * @param {string} field
 * Name of the field to add.
 */

GridControl.prototype.addField = function (field, displayText, opts) {
	var self = this;

	opts = opts || {};

	_.defaults(opts, {
		updateView: true,
		silent: false
	});

	if (isNothing(field) || field === '' || (self.disableUsedItems && self.fields.indexOf(field) >= 0)) {
		return;
	}

	var cf = new self.controlFieldCtor(self, field, displayText, self.useColConfig ? self.colConfig[field] : null);
	self.controlFields.push(cf);

	self.ui.clearBtn.show();

	var li = jQuery('<li>')
		.attr({
			'data-wcdv-field': field,
			'data-wcdv-draggable-origin': 'GRID_CONTROL_FIELD'
		});

	if (self.isHorizontal) {
		li.append(fontAwesome('F178'));
	}

	li.append(cf.draw());
	li.appendTo(self.ui.fields); // Add it to the DOM.

	if (self.disableUsedItems) {
		self.ui.dropdown.find('option').filter(function () {
			return jQuery(this).val() === field;
		}).prop('disabled', true);
	}

	self.ui.dropdown.val('');

	if (self.disableUsedItems) {
		self.fields.push(field); // Add it to the fields array.
	}

	if (typeof self.updateView === 'function' && opts.updateView) {
		self.updateView();
	}

	if (!opts.silent) {
		self.fire(GridControl.events.fieldAdded, null, field, self.fields);
	}

	return cf;
};

// #removeField {{{2

/**
 * Remove a field from this control.  Automatically updates the view afterwards.
 *
 * @param {ControlField} cf
 * The field to remove.
 */

GridControl.prototype.removeField = function (cf) {
	var self = this
		, controlFieldIndex = self.controlFields.indexOf(cf);

	cf.destroy();
	cf.getElement().parent('li').remove(); // Remove it from the DOM.
	self.controlFields.splice(controlFieldIndex, 1);

	if (self.disableUsedItems) {
		self.fields.splice(self.fields.indexOf(cf.field), 1); // Remove it from the fields array.
	}

	self.ui.dropdown.find('option').filter(function () {
		return jQuery(this).val() === cf.field;
	}).prop('disabled', false);

	if (self.controlFields.length === 0) {
		self.ui.clearBtn.hide();
	}

	self.updateView();
	self.fire(GridControl.events.fieldRemoved, null, cf.field, self.fields);
};

// #clear {{{2

/**
 * Removes all fields from the control.  Automatically updates the view afterwards.
 */

GridControl.prototype.clear = function (opts) {
	var self = this;

	opts = opts || {};
	_.defaults(opts, {
		updateView: true
	});

	self.fields = [];
	self.controlFields = [];
	self.ui.fields.children().remove();
	self.ui.dropdown.find('option:disabled').filter(function () {
		return jQuery(this).val() !== '';
	}).prop('disabled', false);
	self.ui.clearBtn.hide();

	if (opts.updateView) {
		self.updateView();
	}

	self.fire(GridControl.events.cleared);
};

// #destroy {{{2

GridControl.prototype.destroy = function () {
	var self = this;

	debug.info('GRID // CONTROL', 'Good-bye, cruel world!');

	self.view.off('*', self);
	self.ui.root.remove();
};

// #addViewConfigChangeHandler {{{2

/**
 * Registers an event handler on the view to update the UI when the view is changed (typically by
 * loading preferences, but also possibly by another grid connected to the same view).
 */

GridControl.prototype.addViewConfigChangeHandler = function (kind) {
	var self = this;

	var synchronize = function (spec) {
		var fields = (spec && spec.fieldNames) || [];

		self.clear({ updateView: false });

		debug.info('GRID // ' + kind.toUpperCase() + ' CONTROL',
							 'View set ' + kind + ' fields to: ' + JSON.stringify(fields));

		_.each(fields, function (field) {
			self.addField(field, getProp(self.colConfig, field, 'displayText'), { updateView: false });
		});
	};

	self.view.on(View.events[kind + 'Set'], function (spec) {
		synchronize(spec)
	}, { who: self });

	var methodName = 'get' + kind.substr(0, 1).toUpperCase() + kind.substr(1);
	//synchronize(self.view[methodName]());
};

// #getListElement

GridControl.prototype.getListElement = function () {
	var self = this;

	return self.ui.fields;
};

// GroupControl {{{1

// Constructor {{{2

/**
 * Part of the user interface which governs the fields that are part of the group, including
 * filtering.
 */

var GroupControl = makeSubclass(GridControl, null, {
	isHorizontal: true,
	controlFieldCtor: GroupControlField
});

// #draw {{{2

/**
 * Create a DIV element that can be placed within the Grid instance to hold the user interface for
 * the GroupControl.  The caller must add the result to the DOM somewhere.
 *
 * @returns {jQuery} The DIV element that holds the entire UI.
 */

GroupControl.prototype.draw = function (parent) {
	var self = this;

	parent.droppable({
		classes: {
			'ui-droppable-hover': 'wcdv_drop_target_hover'
		},
		drop: function (evt, ui) {
			// Turn this off for the sake of efficiency.
			//ui.draggable.draggable('option', 'refreshPositions', false);

			// The problem is, this event gets triggered both (1) when dropping a field from the grid
			// table's header, and (2) when shuffling fields between the group & pivot controls.  In the
			// case of (1) we need to make an <LI>.  But in the case of (2), we don't need to modify the
			// DOM in any way, jQuery UI sortable does that for us.  To tell the difference, we use the
			// `wcdv-draggable-origin` data attribute, which tells where the draggable came from.

			if (ui.draggable.attr('data-wcdv-draggable-origin') === 'GRID_TABLE_HEADER') {
				var field = ui.draggable.attr('data-wcdv-field');
				self.addField(field, getProp(self.colConfig, field, 'displayText'));
			}
		}
	})
		._addEventDebugging('drop', 'GROUP');

	self.ui.root = jQuery('<div>').appendTo(parent);
	self.ui.title = jQuery('<div>')
		.addClass('wcdv_control_title_bar')
		.appendTo(self.ui.root);
	jQuery('<span>', { 'class': 'wcdv_control_title' })
		.text('Group Fields')
		.appendTo(self.ui.title);
	self.ui.clearBtn = self.makeClearButton(self.ui.title);
	self.ui.fields = jQuery('<ul>', {
		id: gensym()
	}).appendTo(self.ui.root);

	var dropdownContainer = jQuery('<div>').appendTo(self.ui.root);
	self.ui.dropdown = jQuery('<select>').appendTo(dropdownContainer);
	self.makeAddButton(dropdownContainer);

	jQuery('<option>', { 'value': '', 'disabled': true, 'selected': true })
		.text('Select Field')
		.appendTo(self.ui.dropdown);

	self.view.on('getTypeInfo', function (typeInfo) {
		_.each(availableFields(self.defn, null, typeInfo), function (fieldName) {
			var text = getProp(self.colConfig, fieldName, 'displayText') || fieldName;
			jQuery('<option>', { 'value': fieldName }).text(text).appendTo(self.ui.dropdown);
		});
	}, { limit: 1 });

	self.addViewConfigChangeHandler('group');

	return self.ui.root;
};

// #updateView {{{2

GroupControl.prototype.updateView = function () {
	var self = this;

	debug.info('GRID // GROUP CONTROL', 'Setting group fields to: %O', self.fields);

	if (self.fields.length > 0) {
		self.view.setGroup({fieldNames: self.fields}, false, self);
	}
	else {
		self.view.clearGroup();
	}
};

// PivotControl {{{1

// Constructor {{{2

/**
 * Part of the user interface which governs: (1) the fields that are part of the pivot, including
 * filtering; (2) the aggregate function [and potentially its arguments] that produces the values in
 * the pivot table.
 *
 * @class
 *
 * @property {GridControl} super
 * Proxy to call prototype ("superclass") methods even if we override them.
 *
 * @property {string[]} fields
 * Names of the fields
 */

var PivotControl = makeSubclass(GridControl, null, {
	isHorizontal: true,
	controlFieldCtor: PivotControlField
});

// #draw {{{2

/**
 * Create a DIV element that can be placed within the Grid instance to hold the user interface for
 * the PivotControl.  The caller must add the result to the DOM somewhere.
 *
 * @returns {jQuery} The DIV element that holds the entire UI.
 */

PivotControl.prototype.draw = function (parent) {
	var self = this;

	parent.droppable({
		classes: {
			'ui-droppable-hover': 'wcdv_drop_target_hover'
		},
		drop: function (evt, ui) {
			// Turn this off for the sake of efficiency.
			//ui.draggable.draggable('option', 'refreshPositions', false);

			// The problem is, this event gets triggered both (1) when dropping a field from the grid
			// table's header, and (2) when shuffling fields between the group & pivot controls.  In the
			// case of (1) we need to make an <LI>.  But in the case of (2), we don't need to modify the
			// DOM in any way, jQuery UI sortable does that for us.  To tell the difference, we use the
			// `wcdv-draggable-origin` data attribute, which tells where the draggable came from.

			if (ui.draggable.attr('data-wcdv-draggable-origin') === 'GRID_TABLE_HEADER') {
				var field = ui.draggable.attr('data-wcdv-field');
				self.addField(field, getProp(self.colConfig, field, 'displayText'));
			}
		}
	})
		._addEventDebugging('drop', 'PIVOT');

	self.ui.root = jQuery('<div>').appendTo(parent);
	self.ui.title = jQuery('<div>')
		.addClass('wcdv_control_title_bar')
		.appendTo(self.ui.root);
	jQuery('<span>')
		.addClass('wcdv_control_title')
		.text('Pivot Fields')
		.appendTo(self.ui.title);
	self.ui.clearBtn = self.makeClearButton(self.ui.title);
	self.ui.fields = jQuery('<ul>', {
		id: gensym()
	}).appendTo(self.ui.root);

	var dropdownContainer = jQuery('<div>').appendTo(self.ui.root);
	self.ui.dropdown = jQuery('<select>').appendTo(dropdownContainer);
	self.makeAddButton(dropdownContainer);

	jQuery('<option>', { 'value': '', 'disabled': true, 'selected': true })
		.text('Select Field')
		.appendTo(self.ui.dropdown);

	self.view.on('getTypeInfo', function (typeInfo) {
		_.each(availableFields(self.defn, null, typeInfo), function (fieldName) {
			var text = getProp(self.colConfig, fieldName, 'displayText') || fieldName;
			jQuery('<option>', { 'value': fieldName }).text(text).appendTo(self.ui.dropdown);
		});
	}, { limit: 1 });

	self.addViewConfigChangeHandler('pivot');

	return self.ui.root;
};

// #updateView {{{2

/**
 * Set the pivot configuration on the View.  The pivot configuration consists of:
 *
 *   - Fields that are part of the pivot.
 */

PivotControl.prototype.updateView = function () {
	var self = this;

	debug.info('GRID // PIVOT CONTROL', 'Setting pivot fields to: %O', self.fields);

	if (self.fields.length > 0) {
		if (!self.view.setPivot({fieldNames: self.fields}, false, self)) {
			self.clear({ updateView: false });
		}
	}
	else {
		self.view.clearPivot();
	}
};

// AggregateControl {{{1

// Constructor {{{2

/**
 * Part of the user interface which governs the aggregate function (and potentially its arguments)
 * that produces the values in (1) group summary columns, (2) pivot cells.
 *
 * @class
 *
 * @property {string[]} fields
 * Names of the fields
 */

var AggregateControl = makeSubclass(GridControl, null, {
	disableUsedItems: false,
	controlFieldCtor: AggregateControlField
});

// #draw {{{2

/**
 * Create a DIV element that can be placed within the Grid instance to hold the user interface for
 * the AggregateControl.  The caller must add the result to the DOM somewhere.
 *
 * @returns {jQuery} The DIV element that holds the entire UI.
 */

AggregateControl.prototype.draw = function (parent) {
	var self = this;

	self.ui.root = jQuery('<div>').appendTo(parent);

	self.ui.title = jQuery('<div>')
		.addClass('wcdv_control_title_bar')
		.appendTo(self.ui.root);
	jQuery('<span>')
		.addClass('wcdv_control_title')
		.text('Aggregate')
		.appendTo(self.ui.title);
	self.ui.clearBtn = self.makeClearButton(self.ui.title);
	self.ui.fields = jQuery('<ul>').appendTo(self.ui.root);
	var dropdownContainer = jQuery('<div>').appendTo(self.ui.root);
	self.ui.dropdown = jQuery('<select>').appendTo(dropdownContainer);
	self.makeAddButton(dropdownContainer);

	jQuery('<option>', { 'value': '', 'disabled': true, 'selected': true })
		.text('Select Aggregate')
		.appendTo(self.ui.dropdown);

	AGGREGATE_REGISTRY.each(function (aggFunDefn, aggFunShortName) {
		jQuery('<option>', { 'value': aggFunShortName }).text(aggFunDefn.prototype.name).appendTo(self.ui.dropdown);
	});
	/*
	self.ui.fun = jQuery('<div>').css({'margin-top': '7px'}).appendTo(self.ui.root);
	jQuery('<label>').text('Function:').appendTo(self.ui.fun);
	self.ui.funDropdown = jQuery('<select>')
		.appendTo(self.ui.fun)
		.on('change', function () {
			self.triggerAggChange();
		})
	;

	// Create a dropdown containing all the aggregate functions that are allowed to be used for
	// calculating pivot cells.  Right now that's everything that needs no external parameters aside
	// from the field.

	AGGREGATE_REGISTRY.each(function (aggClass, aggFunName) {
		if (aggClass.prototype.enabled && aggClass.prototype.enabled) {
			jQuery('<option>', {
				value: aggFunName
			})
				.text(aggClass.prototype.name || aggFunName)
				.appendTo(self.ui.funDropdown);
		}
	});

	// When we receive type information, use that to populate the "fields" dropdown.
	//
	// TODO This needs to be expanded to the possibility of having multiple fields.

	self.view.on('getTypeInfo', function (typeInfo) {
		self.typeInfo = typeInfo;
		self.updateFieldDropdowns();
	}, { limit: 1 });

	var syncAgg = function (spec) {
		var agg;
		if (getProp(spec, 'cell', 0, 'fun')) {
			self.ui.funDropdown.val(spec.cell[0].fun);
			agg = AGGREGATE_REGISTRY.get(spec.cell[0].fun);
			if (agg.prototype.fieldCount >= self.ui.fields.length) {
				self.addFieldDropdowns(agg);
			}
			self.showHideFields(agg);
		}
		if (getProp(spec, 'cell', 0, 'fields')) {
			_.each(spec.cell[0].fields, function (f, i) {
				self.ui.fields[i].dropdown.val(f);
			});
		}

		debug.info('GRID // AGGREGATE CONTROL',
							 'View set aggregate to: ' + JSON.stringify(spec));
	};

	self.view.on(View.events.aggregateSet, function (spec) {
		syncAgg(spec)
	}, { who: self });
	*/

	self.addViewConfigChangeHandler();
	return self.ui.root;
};

// #updateView {{{2

AggregateControl.prototype.updateView = function () {
	var self = this;
	var info = _.map(self.controlFields, function (cf) {
		return cf.getInfo();
	});
	self.view.setAggregate(objFromArray(['group', 'pivot', 'cell', 'all'], [info]), {
		dontSendEventTo: self
	});
};

if (false) {
// #triggerAggChange {{{2

/**
 * Perform necessary actions when the aggregate function is changed.
 *
 *   - Update the UI to show/hide field argument.
 */

AggregateControl.prototype.triggerAggChange = function () {
	var self = this;
	var agg = AGGREGATE_REGISTRY.get(self.ui.funDropdown.val());

	if (agg.prototype.fieldCount > self.ui.fields.length) {
		self.addFieldDropdowns(agg);
	}

	self.showHideFields(agg);

	var aggSpec = objFromArray(['group', 'pivot', 'cell', 'all'], [[{
		fun: self.ui.funDropdown.val(),
		fields: agg.prototype.fieldCount > 0 && mapLimit(self.ui.fields, function (f) {
			return f.dropdown.val();
		}, agg.prototype.fieldCount)
	}]]);
	var i;
	var div;

	self.view.setAggregate(aggSpec, {
		dontSendEventTo: self
	});
};

// #showHideFields {{{2

AggregateControl.prototype.showHideFields = function (agg) {
	var self = this;

	for (i = 0; i < self.ui.fields.length; i += 1) {
		if (i < agg.prototype.fieldCount) {
			self.ui.fields[i].div.show();
		}
		else {
			self.ui.fields[i].div.hide();
		}
	}
};

// #addFieldDropdowns {{{2

AggregateControl.prototype.addFieldDropdowns = function (agg) {
	var self = this;

	debug.info('GRID // AGGREGATE CONTROL', 'Adding ' + (agg.prototype.fieldCount - self.ui.fields.length) + ' extra field dropdowns for the ' + agg.prototype.name + ' aggregate function');

	// Create the extra dropdowns that we need to get all the fields required by the aggregate
	// function selected.

	while (self.ui.fields.length < agg.prototype.fieldCount) {
		var x = {};
		x.div = jQuery('<div>').css({'margin-top': '4px'}).appendTo(self.ui.root);
		x.label = jQuery('<label>').text('Field:').appendTo(x.div);
		x.dropdown = jQuery('<select>').on('change', function () { self.triggerAggChange(); }).appendTo(x.div);
		self.ui.fields.push(x);
	}

	self.updateFieldDropdowns();
};

// #updateFieldDropdowns {{{2

AggregateControl.prototype.updateFieldDropdowns = function () {
	var self = this;

	// Clear out the fields that are already in the dropdown (in case anything was removed, and to
	// prevent duplicates from being added).

	_.each(self.ui.fields, function (f) {
		f.dropdown.children().remove();
	});

	// Add <OPTION> elements for all the fields.

	_.each(availableFields(self.defn, null, self.typeInfo), function (fieldName) {
		var text = getProp(self.colConfig, fieldName, 'displayText') || fieldName;
		_.each(self.ui.fields, function (f) {
			jQuery('<option>', { 'value': fieldName }).text(text).appendTo(f.dropdown);
		});
	});
};
}

// #addViewConfigChangeHandler {{{2

AggregateControl.prototype.addViewConfigChangeHandler = function () {
	var self = this;

	var synchronize = function (spec) {
		self.clear({ updateView: false });
		if (spec != null) {
			debug.info('GRID // AGGREGATE CONTROL',
				'View set aggregate to: ' + JSON.stringify(spec.all));

			_.each(spec.all, function (agg) {
				self.addField(agg.fun, AGGREGATE_REGISTRY.get(agg.fun).prototype.name, { updateView: false });
			});
		}
	};

	self.view.on(View.events.aggregateSet, function (spec) {
		synchronize(spec)
	}, { who: self });
};

// #addField {{{2

AggregateControl.prototype.addField = function () {
	var self = this;
	var args = Array.prototype.slice.call(arguments);

	if (self.typeInfo == null) {
		return self.view.getTypeInfo(function (typeInfo) {
			self.typeInfo = typeInfo;
			return self.addField.apply(self, args);
		});
	}

	self.super.addField.apply(self, args);
};

// FilterControl {{{1

// Constructor {{{2

/**
 * Part of the user interface which lets users filter columns.
 *
 * @param {object} defn
 *
 * @param {View} view
 *
 * @param {Grid~Features} features
 *
 * @param {object} timing
 */

var FilterControl = makeSubclass(GridControl, function () {
	var self = this;

	self.super.ctor.apply(self, arguments);
	self.gfs = new GridFilterSet(self.view, null, null, null, {
		dontSendEventTo: self
	});
}, {
	controlFieldCtor: FilterControlField
});

// #draw {{{2

/**
 * Create a DIV element that can be placed within the Grid instance to hold the user interface for
 * the FilterControl.  The caller must add the result to the DOM somewhere.
 *
 * @returns {jQuery} The DIV element that holds the entire UI.
 */

FilterControl.prototype.draw = function (parent) {
	var self = this;

	parent.resizable({
		handles: 'e',
		minWidth: 100
	});

	parent.droppable({
		classes: {
			'ui-droppable-hover': 'wcdv_drop_target_hover'
		},
		drop: function (evt, ui) {
			// Turn this off for the sake of efficiency.
			//ui.draggable.draggable('option', 'refreshPositions', false);
			var field = ui.draggable.attr('data-wcdv-field');
			console.log(field);

			self.addField(field, getProp(self.colConfig, field, 'displayText'));
		}
	})
		._addEventDebugging('drop', 'FILTER');

	self.ui.root = jQuery('<div>').appendTo(parent);
	self.ui.title = jQuery('<div>')
		.addClass('wcdv_control_title_bar')
		.appendTo(self.ui.root);
	jQuery('<span>', { 'class': 'wcdv_control_title' })
		.text('Filters')
		.appendTo(self.ui.title);
	self.ui.clearBtn = self.makeClearButton(self.ui.title);
	self.ui.fields = jQuery('<ul>').appendTo(self.ui.root);

	var dropdownContainer = jQuery('<div>').appendTo(self.ui.root);
	self.ui.dropdown = jQuery('<select>').appendTo(dropdownContainer);
	self.makeAddButton(dropdownContainer);

	jQuery('<option>', { 'value': '', 'disabled': true, 'selected': true })
		.text('Select Field')
		.appendTo(self.ui.dropdown);

	self.view.on('getTypeInfo', function (typeInfo) {
		_.each(availableFields(self.defn, null, typeInfo), function (fieldName) {
			var text = getProp(self.colConfig, fieldName, 'displayText') || fieldName;
			jQuery('<option>', { 'value': fieldName }).text(text).appendTo(self.ui.dropdown);
		});
	}, { limit: 1 });

	self.addViewConfigChangeHandler();

	return self.ui.root;
};

// #addField {{{2

FilterControl.prototype.addField = function (field) {
	var self = this;

	self.super.addField(field, getProp(self.colConfig, field, 'displayText'), { updateView: false });	
};

// #removeField {{{2

FilterControl.prototype.removeField = function (cf) {
	var self = this;

	self.gfs.removeField(cf.field);
	self.super.removeField(cf);
};

// #clear {{{2

FilterControl.prototype.clear = function (opts) {
	var self = this;

	self.gfs.reset(opts);
	self.super.clear(opts);
};

// #updateView {{{2

FilterControl.prototype.updateView = function () {
};

// #addViewConfigChangeHandler {{{2

FilterControl.prototype.addViewConfigChangeHandler = function () {
	var self = this;

	var synchronize = function (spec) {
		debug.info('GRID // FILTER CONTROL', 'View set filter to: %O', spec);

		self.clear({ updateView: false });
		_.each(spec, function (fieldSpec, field) {
			self.addField(field, getProp(self.colConfig, field, 'displayText'), { updateView: false });
			self.gfs.set(field, fieldSpec);
		});
	};

	self.view.on(View.events.filterSet, function (spec) {
		synchronize(spec)
	}, { who: self });

	synchronize(self.view.getFilter());
};
