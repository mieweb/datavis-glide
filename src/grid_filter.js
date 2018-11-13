import _ from 'underscore';
import moment from 'moment';
import numeral from 'numeral';
import jQuery from 'jquery';

import {
	debug,
	deepDefaults,
	fontAwesome,
	gensym,
	getPropDef,
	isFloat,
	isInt,
	log,
	makeSubclass,
	makeSuper,
	mixinEventHandling,
	toFloat,
	toInt,
} from './util.js';

// GridFilter {{{1

// Superclass {{{2

// Constructor {{{3

/**
 * Base class for all grid filter widgets.
 *
 * @class
 *
 * @property {string} field
 *
 * @property {GridFilterSet} gridFilterSet
 *
 * @property {object} opts
 *
 * @property {string} [opts.filterType]
 *
 * @property {string} [opts.filterButton]
 * The button used to add a new filter.
 *
 * @property {string} [opts.noRemoveButton=false]
 * If true, don't create a remove button to place next to the filter.
 *
 * @property {number} limit
 *
 * @property {boolean} applyImmediately
 *
 * @property {jQuery} div
 *
 * @property {jQuery} input
 *
 * @property {jQuery} removeBtn
 *
 * @property {string} id
 *
 */

var GridFilter = (function () {
	var id = 0;

	var genId = function () {
		return 'GridFilter_' + id++;
	};

	return function (field, gridFilterSet, typeInfo, opts) {
		var self = this;
		var localRemoveButton;

		self.id = genId();
		self.field = field;
		self.gridFilterSet = gridFilterSet;
		self.typeInfo = typeInfo;
		self.opts = opts;

		self.limit = 0;
		self.applyImmediately = false;
		self.div = jQuery('<div>')
			.addClass('wcdv_filter_control_filter');

		if (self.opts.makeRemoveButton) {
			self.removeBtn = self.makeRemoveBtn();
			localRemoveButton = self.removeBtn;
		}
		else if (self.opts.removeButton) {
			localRemoveButton = self.opts.removeButton;
		}

		if (localRemoveButton) {
			localRemoveButton.on('click', function () {
				self.gridFilterSet.remove(self.getId(), self.opts.filterButton);
				if (typeof self.opts.onRemove === 'function') {
					self.opts.onRemove();
				}
			});
		}

		if (self.gridFilterSet.gridTable) {
			self.gridFilterSet.gridTable.on('columnResize', function () {
				self.adjustInputWidth({ useSizingElement: true, fromColumnResize: true });
			});
		}
	};
})();

GridFilter.prototype = Object.create(Object.prototype);
GridFilter.prototype.constructor = GridFilter;

// #getValue {{{3

/**
 * This represents an exact value to use with a filter operator to decide what to show in the grid.
 *
 * @typedef {string|Moment|Numeral} GridFilter~Value
 */

/**
 * This represents a range of allowed values; anything within the range should be shown in the grid.
 *
 * @typedef {Object} GridFilter~RangeValue
 *
 * @property {GridFilter~Value} start The starting number / date in the range (inclusive).
 * @property {GridFilter~Value} end The ending number / date in the range (inclusive).
 */

/**
 * Gives the value that should be used when building the filters for the View from the user's
 * input in the GridFilter.  A GridFilter can return either a single value (which should be combined
 * with the operator, e.g. "greater than 40") or a range value (where the operators are implicitly
 * greater-than-or-equal and less-than-or-equal, e.g. "between January 1st and March 31st").
 *
 * @returns {GridFilter~Value|GridFilter~RangeValue} The value of the filter; you can tell whether
 * or not it will be a range by checking the result of #isRange().
 */

GridFilter.prototype.getValue = function () {
	var self = this
		, fti = self.gridFilterSet.view.typeInfo.get(self.field);

	switch (fti.type) {
	case 'date':
	case 'time':
	case 'datetime':
		return fti.internalType === 'moment' ? moment(self.input.val()) : self.input.val();
	case 'number':
	case 'currency':
		switch (fti.internalType) {
		case 'numeral':
			return numeral(self.input.val());
		case 'primitive':
			return isInt(self.input.val()) ? toInt(self.input.val())
				: isFloat(self.input.val()) ? toFloat(self.input.val())
				: self.input.val();
		default:
			return self.input.val();
		}
	case 'string':
	default:
		return self.input.val();
	}
};

// #setValue {{{3

GridFilter.prototype.setValue = function (val) {
	var self = this;

	if (numeral && numeral.isNumeral(val)) {
		self.input.val(val._value);
	}
	else {
		self.input.val(val);
	}
};

// #getOperator {{{3

GridFilter.prototype.getOperator = function () {
	var self = this;

	return self.operatorDrop.val();
};

// #setOperator {{{3

GridFilter.prototype.setOperator = function (op) {
	var self = this;

	if (self.operatorDrop) {
		self.operatorDrop.val(op);
	}
};

// #getId {{{3

GridFilter.prototype.getId = function () {
	return this.id;
};

// #makeOperatorDrop {{{3

/**
 * Construct a SELECT that allows the user to pick the operator.
 *
 * @param {Array<string>} include If present, only include operators that correspond to those
 * operations requested.  This should be an array like ``['$eq', '$ne']`` to only show equality and
 * inequality operators.
 */

GridFilter.prototype.makeOperatorDrop = function (include) {
	var self = this;

	// These are all the operators that are possible.

	var operators = [['$contains', '∈'], ['$notcontains', '∉'], ['$eq', '='], ['$ne', '≠'], ['$gt', '>'], ['$gte', '≥'], ['$lt', '<'], ['$lte', '≤'], ['$in', 'in'], ['$nin', 'not in']];

	// Remove anything that user didn't ask for.

	if (include !== undefined && _.isArray(include)) {
		operators = _.reject(operators, function (elt) {
			return include.indexOf(elt[0]) < 0;
		});
	}

	var operatorDrop = jQuery('<select>');

	operatorDrop.css({'margin-right': '0.5em'});

	// Add all the operators as options within the <SELECT>.

	_.each(operators, function (op) {
		var value = op[0]
			, name = op[1];
		operatorDrop.append(jQuery('<option>', { value: value }).text(name));
	});

	// Hook up the event to update the filter when the operator is changed.

	operatorDrop.on('change', function () {
		if (self.getValue() !== '') {
			self.gridFilterSet.update(false);
		}
	});

	// Return the <SELECT> so that the caller can put it where they want.

	return operatorDrop;
};

// #makeRemoveBtn {{{3

GridFilter.prototype.makeRemoveBtn = function () {
	var self = this;

	var removeBtn = jQuery(fontAwesome('F00D', null, 'Click to remove filter'));

	removeBtn.css({'cursor': 'pointer', 'margin-left': '0.5em'})
	return removeBtn;
};

// #remove {{{3

GridFilter.prototype.remove = function () {
	var self = this;

	self.div.remove();
	self.gridFilterSet.update(false);
};

// #isRange {{{3

GridFilter.prototype.isRange = function () {
	return false;
};

// #adjustInputWidth {{{3

GridFilter.prototype.adjustInputWidth = function (opts) {
	var self = this;

	if (!self.opts.autoUpdateInputWidth) {
		return;
	}

	if (opts === undefined) {
		opts = {};
	}

	// In case we're using TableTool, we need to carry around this idea of the sizing element.  At
	// this point in the JS execution, TableTool hasn't caught up and correctly resized the floating
	// header to match the original header column widths.  Therefore, we can't use `self.div` for
	// determining the correct width (it's the wrong size, because it's still in a column which is the
	// wrong size).  Instead, we need to use the sizing element - which is the original version of the
	// TH containing `self.div` - to determine the correct size.  TableTool will catch up later,
	// correctly resizing the column to align perfectly with what we set here.
	//
	// FIXME: This is extremely tightly coupled to knowledge about how the grid table is laid out and
	// what features it has (e.g. TableTool).  It would be better to pass in what the size of the
	// column currently is with the event handler.

	_.defaults(opts, {
		useSizingElement: false,
		input: self.input
	});

	debug.info('GRID FILTER // ADJUST INPUT WIDTH', '         Target: %O', opts.input);

	var targetWidth = opts.useSizingElement ? self.opts.sizingElement.width() : self.div.width();
	debug.info('GRID FILTER // ADJUST INPUT WIDTH', 'Available Space: ' + targetWidth + 'px ' + (opts.useSizingElement ? '[sizing element]' : '[div]'));

	if (self.removeBtn) {
		targetWidth -= self.removeBtn.outerWidth();
		debug.info('GRID FILTER // ADJUST INPUT WIDTH', '  Remove Button: ' + self.removeBtn.outerWidth() + 'px');
	}

	if (self.operatorDrop !== undefined) {
		targetWidth -= self.operatorDrop.outerWidth();
		debug.info('GRID FILTER // ADJUST INPUT WIDTH', '  Operator Drop: ' + self.operatorDrop.outerWidth() + 'px');
	}

	debug.info('GRID FILTER' + (opts.fromColumnResize ? ' // HANDLER (columnResize)' : ''), 'Adjusting ' + self.field + ' filter widget width to ' + targetWidth + 'px to match column width');

	opts.input.outerWidth(targetWidth);

	if (typeof opts.callback === 'function') {
		opts.callback(targetWidth);
	}
};

// StringTextboxGridFilter {{{2

/**
 * Represents a filter on a single string.
 *
 * @class
 * @extends GridFilter
 */

var StringTextboxGridFilter = makeSubclass('StringTextboxGridFilter', GridFilter, function () {
	var self = this;

	self.ctor.apply(self, arguments);

	self.input = jQuery('<input type="text">');
	self.input.on('change', function (evt) {
		self.gridFilterSet.update(false);
	});

	self.operatorDrop = self.makeOperatorDrop(/*['$eq', '$ne']*/);

	/*
	self.strictChkbox = jQuery('<input>', {id: gensym(), type: 'checkbox'})
		.on('change', function () {
			self.gridFilterSet.update();
		});
		*/

	self.div
		.append(self.operatorDrop)
		.append(self.input);

	if (self.removeBtn) {
		self.div.append(self.removeBtn);
	}
});

// StringDropdownGridFilterChosen {{{2

/**
 * Represents a filter for multiple strings.
 *
 * @class
 * @extends GridFilter
 */

var StringDropdownGridFilterChosen = makeSubclass('StringDropdownGridFilterChosen', GridFilter, function () {
	var self = this;

	GridFilter.apply(self, arguments);

	self.super = makeSuper(self, GridFilter);
	self.limit = 1;
	self.input = jQuery('<select>').attr({
		'multiple': true
	});
	self.input.on('change', function (evt) {
		self.gridFilterSet.update(false);
	});

	self.div
		.append(self.input);

	if (self.removeBtn) {
		self.div.append(self.removeBtn);
	}

	self.afterAdd = function (target) {
		self.gridFilterSet.view.getUniqueVals(function (uniqueVals) {
			_.each(getPropDef([], uniqueVals, self.field, 'values'), function (val) {
				jQuery('<option>').attr({
					'value': val
				}).text(val).appendTo(self.input);
			});
			self.input.chosen({'width': self.div.innerWidth() - self.removeBtn.outerWidth()});
			self.chosen = self.input.next('div.chosen-container');
		});
	};

	if (self.gridFilterSet.gridTable) {
		self.gridFilterSet.gridTable.on('columnResize', function () {
			var targetWidth = self.opts.sizingElement.innerWidth() - self.removeBtn.outerWidth() - 14;
			debug.info('GRID FILTER // HANDLER (GridTablePlain.columnResize)', 'Adjusting Chosen widget width to ' + targetWidth + 'px to match column width');
			self.chosen.innerWidth(targetWidth);
		});
	}
});

// #getOperator {{{3

StringDropdownGridFilterChosen.prototype.getOperator = function () {
	return '$in';
};

// #getValue {{{3

StringDropdownGridFilterChosen.prototype.getValue = function () {
	var self = this
		, val = self.super.getValue(self);

	return val === null ? undefined : val;
};

// StringDropdownGridFilterSumo {{{2

/**
 * Represents a filter for multiple strings.
 *
 * @class
 * @extends GridFilter
 */

var StringDropdownGridFilterSumo = makeSubclass('StringDropdownGridFilterSumo', GridFilter, function () {
	var self = this;

	GridFilter.apply(self, arguments);

	self.super = makeSuper(self, GridFilter);
	self.limit = 1;
	self.minDropdownWidth = 200;
	self.input = jQuery('<select>').attr({
		'multiple': true
	})
		.on('change', function (evt) {
			if (self.pleaseDontFireChangeEvent) {
				delete self.pleaseDontFireChangeEvent;
				return;
			}
			self.gridFilterSet.update(false);
		});

	self.operatorDrop = self.makeOperatorDrop(['$in', '$nin']);

	self.div.append(self.operatorDrop);
	self.div.append(self.input);

	if (self.removeBtn) {
		self.div.append(self.removeBtn);
	}

	self.afterAdd = function (target) {
		self.gridFilterSet.view.getUniqueVals(function (uniqueVals) {
			_.each(getPropDef([], uniqueVals, self.field, 'values'), function (val) {
				jQuery('<option>').attr({
					'value': val
				}).text(val === '' ? '[blank]' : val).appendTo(self.input);
			});
			self.input.SumoSelect({
				triggerChangeCombined: true,
				selectAll: true,
				search: true,
				okCancelInMulti: true,
				isClickAwayOk: true
			});
			self.optWrapper = self.input.closest('div.SumoSelect').find('div.optWrapper');
			/*
			optWrapper.resizable({
				helper: 'ui-resizable-helper'
			});
			*/
			//self.adjustInputWidth();
		});
	};
});

// #adjustInputWidth {{{3

StringDropdownGridFilterSumo.prototype.adjustInputWidth = function (opts) {
	var self = this;

	if (opts === undefined) {
		opts = {};
	}

	opts.input = self.input.closest('div.SumoSelect');
	opts.callback = function (width) {
		self.optWrapper.outerWidth(Math.max(width, self.minDropdownWidth));
	};

	self.super.adjustInputWidth(opts);
};

// #getValue {{{3

StringDropdownGridFilterSumo.prototype.getValue = function () {
	var self = this
		, val = self.super.getValue();

	return val === null ? undefined : val;
};

// #setValue {{{3

StringDropdownGridFilterSumo.prototype.setValue = function (val) {
	var self = this;

	if (!_.isArray(val)) {
		val = [val];
	}

	_.each(val, function (v) {
		self.pleaseDontFireChangeEvent = true;
		self.input.get(0).sumo.selectItem(v);
	});
};

// #setOperator {{{3

StringDropdownGridFilterSumo.prototype.setOperator = function (op) {
	var self = this;

	if (op === '$eq') {
		op = '$in';
	}

	return self.super.setOperator(op);
};


// NumberTextboxGridFilter {{{2

var NumberTextboxGridFilter = makeSubclass('NumberTextboxGridFilter', GridFilter, function () {
	var self = this;

	GridFilter.apply(self, arguments);

	self.input = jQuery('<input type="text">');
	self.input.on('change', function (evt) {
		self.gridFilterSet.update(false);
	});

	self.operatorDrop = self.makeOperatorDrop(['$eq', '$ne', '$lt', '$lte', '$gt', '$gte']);

	self.div.append(self.operatorDrop);
	self.div.append(self.input);

	if (self.removeBtn) {
		self.div.append(self.removeBtn);
	}
});

// NumberCheckboxGridFilter {{{2

var NumberCheckboxGridFilter = makeSubclass('NumberCheckboxGridFilter', GridFilter, function () {
	var self = this;

	GridFilter.apply(self, arguments);

	self.input = jQuery('<input>', {'id': gensym(), 'type': 'checkbox'});
	self.input.on('change', function () {
		self.gridFilterSet.update(false);
	});

	self.div
		.append(jQuery('<label>')
						.append(self.input)
						.append(' Filter'));

	if (self.removeBtn) {
		self.div.append(self.removeBtn);
	}

	//self.applyImmediately = true;
	self.limit = 1;
});

// #getValue {{{3

NumberCheckboxGridFilter.prototype.getValue = function () {
	return this.input[0].checked ? 1 : 0;
};

// #getOperator {{{3

NumberCheckboxGridFilter.prototype.getOperator = function () {
	return '$eq';
};

// NumberTriBoolGridFilter {{{2

var NumberTriBoolGridFilter = makeSubclass('NumberTriBoolGridFilter', GridFilter, function () {
	var self = this;

	GridFilter.apply(self, arguments);

	self.inputName = gensym();

	var trueRadio = jQuery('<input>', {'type': 'radio', 'name': self.inputName, 'value': 'true'});
	var falseRadio = jQuery('<input>', {'type': 'radio', 'name': self.inputName, 'value': 'false'});
	var bothRadio = jQuery('<input>', {'type': 'radio', 'name': self.inputName, 'value': 'both'});

	self.inputs = jQuery([trueRadio.get(0), falseRadio.get(0), bothRadio.get(0)]);

	self.inputs.css('margin-right', '0.4em');

	self.inputs.each(function (i, elt) {
		elt = jQuery(elt);

		elt.on('change', function (evt) {
			self.gridFilterSet.update(false);
		});
	});

	self.div
		.append(jQuery('<label>')
			.append(trueRadio)
			.append('True'))
		.append(jQuery('<label>')
			.css('padding-left', '0.8em')
			.append(falseRadio)
			.append('False'))
		.append(jQuery('<label>')
			.css('padding-left', '0.8em')
			.append(bothRadio)
			.append('Both'))
	;

	if (self.removeBtn) {
		self.div.append(self.removeBtn);
	}

	//self.applyImmediately = true;
	self.limit = 1;
});

// #getValue {{{3

NumberTriBoolGridFilter.prototype.getValue = function () {
	var self = this;

	var val = self.inputs.filter(':checked').val();

	switch (val) {
	case 'true':
		return 1;
	case 'false':
		return 0;
	case 'both':
		return undefined;
	default:
		throw new Error('Impossible');
	}
};

// #setValue {{{3

NumberTriBoolGridFilter.prototype.setValue = function (val) {
	var self = this;

	var internalVal;

	switch (val) {
	case 0:
		internalVal = 'false';
		break;
	case 1:
		internalVal = 'true';
		break;
	default:
		internalVal = 'both';
	}

	self.inputs.filter('[value="' + internalVal + '"]').prop('checked', true);
};

// #getOperator {{{3

NumberTriBoolGridFilter.prototype.getOperator = function () {
	return '$eq';
};

// DateSingleGridFilter {{{2

/**
 * Represents a filter for a single date.
 *
 * @class
 * @extends GridFilter
 */

var DateSingleGridFilter = makeSubclass('DateSingleGridFilter', GridFilter, function () {
	var self = this;

	GridFilter.apply(self, arguments);

	self.input = jQuery('<input>').attr({
		'type': 'text',
		'placeholder': 'Select date...'
	});

	self.input.flatpickr({
		'altInput': false,
		'allowInput': true,
		'onChange': function (selectedDates, dateStr, instance) {
			console.log(selectedDates, dateStr);
			//self.gridFilterSet.update();
		}
	});

	self.div
		.append(self.input);

	if (self.removeBtn) {
		self.div.append(self.removeBtn);
	}
});

// DateRangeGridFilter {{{2

/**
 * Represents a filter for a range of dates.
 *
 * @class
 * @extends GridFilter
 */

var DateRangeGridFilter = makeSubclass('DateRangeGridFilter', GridFilter, function () {
	var self = this;

	GridFilter.apply(self, arguments);

	self.limit = 1;

	self.input = jQuery('<input>').attr({
		'type': 'text',
		'placeholder': 'Click here; pick start/end dates.',
		'size': 28
	});

	self.widget = self.input.flatpickr({
		'altInput': false,
		'allowInput': true,
		'mode': 'range',
		'onChange': function (selectedDates, dateStr, instance) {
			self.selectedDates = selectedDates;
			self.gridFilterSet.update(false);
		}
	});

	self.div
		.append(self.input);

	if (self.removeBtn) {
		self.div.append(self.removeBtn);
	}
});

// #getValue {{{3

/**
 * Get the value(s) for this date range filter.  After you bring up the calendar, when you select
 * the start date, the "onChange" event handler is run.  When you select the end date, the event is
 * fired again.  So, we use #isRange() to decide if you've only selected one date, or if you've just
 * picked the second.  When it's a range, we need to produce an object, instead of a simple value.
 *
 * @returns {GridFilter~Value|GridFilter~RangeValue} The value that should be used for filtering all
 * the data in the grid.
 */

DateRangeGridFilter.prototype.getValue = function () {
	var self = this
		, result;

	if (self.isRange()) {
		result = {
			'start': moment(self.selectedDates[0]),
			'end': moment(self.selectedDates[1]).hour(23).minute(59).second(59)
		};

		if (self.typeInfo.internalType === 'string') {
			result = _.mapObject(result, function (m) {
				return m.format('YYYY-MM-DD HH:mm:ss')
			});
		}
	}
	else {
		result = moment(self.selectedDates[0]);

		if (self.typeInfo.internalType === 'string') {
			result = result.format('YYYY-MM-DD HH:mm:ss');
		}
	}

	return result;
};

// #getOperator {{{3

DateRangeGridFilter.prototype.getOperator = function () {
	var self = this;

	if (self.isRange()) {
		log.error('<< TSNH >> GridFilterSet called #getOperator() on a range');
	}

	return '$gte';
};

// #isRange {{{3

DateRangeGridFilter.prototype.isRange = function () {
	var self = this;

	return self.selectedDates.length > 1;
};

// BooleanCheckboxGridFilter {{{2

var BooleanCheckboxGridFilter = makeSubclass('BooleanCheckboxGridFilter', GridFilter, function (field, gridFilter) {
});

// #getValue {{{3

BooleanCheckboxGridFilter.prototype.getValue = function () {
	return this.input.val();
};

// #getOperator {{{3

BooleanCheckboxGridFilter.prototype.getOperator = function () {
	return '$eq';
};

// #getOperator {{{3

BooleanCheckboxGridFilter.prototype.getId = function () {
	return this.input.attr('id');
};

// Widget Map {{{2

// Type -> Filter Widget -> Constructor

GridFilter.widgets = {
	'string': {
		'textbox': StringTextboxGridFilter,
		'dropdown': StringDropdownGridFilterSumo,
	},
	'number': {
		'textbox': NumberTextboxGridFilter,
		'checkbox': NumberCheckboxGridFilter,
		'tribool': NumberTriBoolGridFilter,
	},
	'currency': {
		'textbox': NumberTextboxGridFilter,
	},
	'date': {
		'single': DateSingleGridFilter,
		'range': DateRangeGridFilter,
	},
	'datetime': {
		'single': DateSingleGridFilter,
		'range': DateRangeGridFilter,
	}
};

GridFilter.defaultWidgets = {
	'string': 'dropdown',
	'number': 'textbox',
	'currency': 'textbox',
	'date': 'range',
	'datetime': 'range'
};

// GridFilterSet {{{1
// Constructor {{{2

/**
 * Create a new collection of filters.
 *
 * @param {View} view
 * The view that we will be updating the filter for.
 *
 * @param {Prefs} prefs
 *
 *
 * @param {GridTable} gridTable A reference to the table that this filter set is displayed on.  This
 * is used only to make sure that the widgets shown in the columns are resized correctly when the
 * table's columns change width.
 *
 * @param {object} progress An object describing how to show a progress dialog when the view is
 * updated.
 *
 * @class
 * @property {View} view
 * The view that we will be updating the filter for.
 *
 * @property {Prefs} prefs
 *
 * @property {object} progress An object describing how to show a progress dialog when the view is
 * updated.
 *
 * @property {Element} thead
 *
 * @property {Object} filters Stores the filters that are within this set, with different properties
 * to facilitate different lookup methods.
 *
 * @property {Array} filters.all An array of all the filters.
 *
 * @property {Object} filters.byId An object indexing all the filters by its internal ID.
 *
 * @property {Object.<Array>} filters.byCol An object indexing all the filters by the column that
 * they're filtering.
 *
 * @property {boolean} delayUpdate If true, calls to the update() method do nothing.  This is used
 * internally when loading preferences to avoid updating for every single filter.
 */

var GridFilterSet = function (view, prefs, gridTable, progress, opts) {
	var self = this;

	self.view = view;
	self.prefs = prefs;
	self.gridTable = gridTable;
	self.progress = progress;
	self.opts = deepDefaults(opts, {
		sendEvent: true,
		dontSendEventTo: [],
		updateData: true
	});

	self.filters = {
		all: [],
		byId: {},
		byCol: {}
	};

	self.delayUpdate = false;
};

GridFilterSet.prototype = Object.create(Object.prototype);
GridFilterSet.prototype.constructor = GridFilterSet;

// Events {{{2

/**
 * Fired when a filter has been added.
 *
 * @event GridFilterSet#filterAdded
 */

/**
 * Fired when a filter has been removed.
 *
 * @event GridFilterSet#filterRemoved
 */

mixinEventHandling(GridFilterSet, 'GridFilterSet', [
		'filterAdded'
	, 'filterRemoved'
	, 'widgetResizedHoriz'
	, 'widgetResizedVert'
]);

// #add {{{2

/**
 * Add a new filter to this set.  This creates the user interface elements and places them in the
 * appropriate place in the grid.
 *
 * @param {string} field Name of the column to filter on.
 *
 * @param {Element} target Where to place the filter widget.
 *
 * @param {string} [filterType] The developer's requested filter type.  If missing, we use the first
 * one from the "allowed" list.  If present, and not in the allowed list, you'll get an error.
 *
 * @param {Element} filterBtn The "add filter" button from the column header.  Needed so we can hide
 * it, if we've reached the maximum number of filters allowed on the column.
 */

GridFilterSet.prototype.add = function (field, target, opts) {
	var self = this
		, opts = opts || {}
		, filter;

	filter = self.build(field, target, opts);

	if (filter == null) {
		return null;
	}

	// Make sure that requisite data structures are there.

	if (self.filters.byCol[field] === undefined) {
		self.filters.byCol[field] = [];
	}

	// Add the filter to all of our data structures.

	self.filters.all.push(filter);
	self.filters.byCol[field].push(filter);
	self.filters.byId[filter.getId()] = filter;

	// Add the filter to the user interface.

	target.append(filter.div);

	if (typeof filter.afterAdd === 'function') {
		filter.afterAdd(target);
	}

	filter.adjustInputWidth();

	// Hide the "add filter" button if we've reached the limit of the number of filters we're allowed
	// to have for this column.

	if (opts.filterBtn && self.filters.byCol[field].length === filter.limit) {
		opts.filterBtn.hide();
	}

	self.fire(GridFilterSet.events.filterAdded);

	// Check to see if this filter should take effect as soon as it is created.

	if (filter.applyImmediately) {
		self.update();
	}

	return filter;
};

// #build {{{2

/**
 * Create a new GridFilter instance.
 *
 * @param {string} field
 * Name of the field to apply the filter to.  Passed to the View.
 *
 * @param {string} filterType
 * What type of widget to use for the filter (e.g. dropdown, text box, checkbox).
 *
 * @param {Element} filterBtn
 * Button to add a new filter item.  Might be shown/hidden depending on how many items are allowed
 * (e.g. a multi-select dropdown only allows one "item" as that's all you need).
 *
 * @param {Element} target
 * Where the filter should be placed.
 *
 * @param {function} onRemove
 * Function to call when the filter is removed.
 *
 * @param {Element} [sizingElement]
 * If present, the element to use to calculate the width of the filter widget.  When absent, the
 * div which is placed within the `target` is used.
 */

GridFilterSet.prototype.build = function (field, target, opts) {//filterType, filterBtn, target, onRemove, sizingElement, noRemoveBtn) {
	var self = this;

	// We use a data source to get the type information, so if the grid was built without a data
	// source, this isn't going to work.
	//
	// FIXME Don't rely on the cache, do it right.

	var fti = self.view.typeInfo.get(field);

	if (fti == null) {
		return null;
	}

	var colType = fti.type;

	// Make sure that we are able to get the column type.

	if (colType == null) {
		throw new Error('Unable to determine type of column "' + field + '"');
	}

	// Make sure that we know what kinds of filters are allowed for the column type.

	if (GridFilter.widgets[colType] === undefined) {
		throw new Error('Unknown type "' + colType + '" for column "' + field + '"');
	}

	// When the user didn't request a filter type, just use the first one in the allowed list.
	// Otherwise, make sure that the filter type they asked for makes sense for the column type.

	var filterType = opts.filterType || GridFilter.defaultWidgets[colType];
	var ctor = GridFilter.widgets[colType][filterType];

	if (ctor === undefined) {
		throw new Error('Invalid filter type "' + filterType + '" for type "' + colType + '" of column "' + field + '"');
	}

	debug.info('GRID FILTER', 'Creating new widget: column type = "' + colType + '" ; filter type = "' + filterType + '"');

	return new ctor(field, self, fti, opts);
};

// #remove {{{2

/**
 * Remove a filter.
 *
 * @param {string} id
 * The unique ID of the filter to remove.
 *
 * @param {Element} filterBtn
 * Button to add a new filter item.  Might be shown/hidden depending on how many items are allowed
 * (e.g. a multi-select dropdown only allows one "item" as that's all you need).
 */

GridFilterSet.prototype.remove = function (id, filterBtn, noEvent) {
	var self = this
		, filter = self.filters.byId[id];

	// Make sure that a filter with that ID exists.

	if (filter === undefined) {
		log.warn('Attempted to remove filter with ID "' + id + '" from the grid, but it doesn\'t exist');
		return;
	}

	var sameId = function (elt) { return elt.getId() === id };
	var allIndex = _.findIndex(self.filters.all, sameId);
	var colIndex = _.findIndex(self.filters.byCol[filter.field], sameId);

	delete self.filters.byId[id];
	self.filters.all.splice(allIndex, 1);
	self.filters.byCol[filter.field].splice(colIndex, 1);

	filter.remove();

	// Show the "add filter" button if we're below the limit of the number of filters we're allowed to
	// have for this column.

	if (filterBtn && self.filters.byCol[filter.field].length < filter.limit) {
		filterBtn.show();
	}

	if (!noEvent) {
		self.fire(GridFilterSet.events.filterRemoved);
	}
};

// #removeField {{{2

GridFilterSet.prototype.removeField = function (fieldName, filterBtn) {
	var self = this;

	_.each(self.filters.byCol[fieldName], function (filter) {
		self.remove(filter.getId(), filterBtn, true);
	});

	self.fire(GridFilterSet.events.filterRemoved);
};

// #reset {{{2

/**
 * Clear all filters.
 */

GridFilterSet.prototype.reset = function (opts) {
	var self = this;

	opts = opts || {};
	_.defaults(opts, {
		updateView: true
	});

	self.delayUpdate = true;

	// Remove every filter from the user interface.

	_.each(self.filters.all, function (filter) {
		filter.remove();
	});

	// Reset our internal data structures.

	self.filters = {
		all: [],
		byId: {},
		byCol: {}
	};

	if (opts.updateView) {
		self.view.clearFilter();
	}

	self.delayUpdate = false;
};

// #update {{{2

/**
 * Set the filters on the View based on what the user has entered into the user interface.
 */

GridFilterSet.prototype.update = function () {
	var self = this
		, spec = {};

	// Check for the "don't actually update" property, set when we're loading prefs to prevent any
	// `applyImmediately` filters from causing unnecessary updates until we're done.

	if (self.delayUpdate) {
		return;
	}

	if (self.filters.all.length === 0) {
		self.view.setFilter(null);
		return;
	}

	_.each(self.filters.byCol, function (filterList, field) {
		_.each(filterList, function (filter) {
			var value = filter.getValue();

			if (value === undefined) {
				return;
			}

			if (spec[field] === undefined) {
				spec[field] = {};
			}

			if (filter.isRange()) {
				spec[field]['$gte'] = value.start;
				spec[field]['$lte'] = value.end;
			}
			else {
				var operator = filter.getOperator();

				if (spec[field][operator] === undefined) {
					spec[field][operator] = value;
				}
				else if (_.isArray(spec[field][operator])) {
					spec[field][operator].push(value);
				}
				else if (['$eq', '$ne', '$contains'].indexOf(operator) >= 0) {
					spec[field][operator] = [spec[field][operator], value];
				}
				else {
					spec[field][operator] = value;
				}
			}
		});
	});

	debug.info('GRID FILTER SET', 'Updating with ' + self.filters.all.length + ' filters: ', spec);

	self.view.setFilter(spec, self.progress, self.opts);
};

// #set {{{2

GridFilterSet.prototype.set = function (field, fieldSpec) {
	var self = this;

	if (typeof fieldSpec !== 'object') {
		fieldSpec = { '$eq': fieldSpec };
	}

	_.each(fieldSpec, function (val, op) {
		debug.info('GRID FILTER SET',
			'Setting filter: { field = %s ; operator = %s ; value = %s }',
			field, op, typeof val === 'object' ? JSON.stringify(val) : val);
		var filters = self.filters.byCol[field];

		if (filters == null) {
			return;
		}

		filters[0].setOperator(op);
		filters[0].setValue(val);
	});
};

// Exports {{{1

export {
	GridFilterSet,
};
