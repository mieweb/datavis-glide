// GridFilterError {{{1

/**
 * Represents an error that occurs when creating or using a grid filter.
 *
 * @memberof wcgraph_int
 * @class
 *
 * @param {string} msg The error message.
 */

function GridFilterError(msg) {
	this.name = 'GridFilterError';
	this.stack = (new Error()).stack;
	this.message = msg;
}

GridFilterError.prototype = Object.create(Error.prototype);
GridFilterError.prototype.constructor = GridError;

// GridFilter {{{1

// Superclass {{{2

/**
 * Base class for all grid filter widgets.
 *
 * @class
 *
 * @property {string} field
 *
 * @property {string} filterType
 *
 * @property {string} filterBtn
 *
 * @property {GridFilterSet} gridFilterSet
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

	return function (field, filterType, filterBtn, gridFilterSet, th, onRemove, sizingElement) {
		var self = this;

		self.field = field;
		self.filterType = filterType;
		self.filterBtn = filterBtn;
		self.gridFilterSet = gridFilterSet;
		self.limit = 0;
		self.applyImmediately = false;
		self.div = jQuery('<div>')
			.css({'white-space': 'nowrap', 'padding-top': 2, 'padding-bottom': 2});
		self.removeBtn = self.makeRemoveBtn();
		self.onRemove = onRemove;
		self.id = genId();
		self.sizingElement = sizingElement;

		self.gridFilterSet.gridTable.on(GridTable.events.columnResize, function () {
			self.adjustInputWidth({ useSizingElement: true, fromColumnResize: true });
		});
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
		fti = self.gridFilterSet.view.typeInfo.get(self.field);

	switch (fti.type) {
	case 'date':
	case 'time':
	case 'datetime':
		return fti.internalType === 'moment' ? moment(this.input.val()) : this.input.val();
	case 'number':
	case 'currency':
		switch (fti.internalType) {
		case 'numeral':
			return numeral(this.input.val());
		case 'primitive':
			return isInt(this.input.val()) ? toInt(this.input.val())
				: isFloat(this.input.val()) ? toFloat(this.input.val())
				: this.input.val();
		default:
			return this.input.val();
		}
	case 'string':
	default:
		return this.input.val();
	}
};

// #getOperator {{{3

GridFilter.prototype.getOperator = function () {
	return this.operatorDrop.val();
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

	var operators = [['$contains', '∈'], ['$notcontains', '∉'], ['$eq', '='], ['$ne', '≠'], ['$gt', '>'], ['$gte', '≥'], ['$lt', '<'], ['$lte', '≤']];

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
	removeBtn.on('click', function () {
		self.gridFilterSet.remove(self.getId(), self.filterBtn);
		if (typeof self.onRemove === 'function') {
			self.onRemove();
		}
	});

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

	var targetWidth = opts.useSizingElement ? self.sizingElement.width() : self.div.width();
	debug.info('GRID FILTER // ADJUST INPUT WIDTH', 'Available Space: ' + targetWidth + 'px ' + (opts.useSizingElement ? '[sizing element]' : '[div]'));

	targetWidth -= self.removeBtn.outerWidth();
	debug.info('GRID FILTER // ADJUST INPUT WIDTH', '  Remove Button: ' + self.removeBtn.outerWidth() + 'px');


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

var StringTextboxGridFilter = function () {
	var self = this;

	GridFilter.apply(self, arguments);

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
		.append(self.input)
		.append(self.removeBtn);
};

StringTextboxGridFilter.prototype = Object.create(GridFilter.prototype);

/*
StringTextboxGridFilter.prototype.getOperator = function () {
	var self = this;

	var op = GridFilter.prototype.getOperator.call(self);

	if (self.strictChkbox[0].checked) {
		return op;
	}
	else {
		switch (op) {
		case '$eq':
			return '$contains';
		case '$ne':
			return '$notcontains';
		default:
			throw new GridFilterError('<< TSNH >> Unable to determine corresponding non-strict operator for ' + op);
		}
	}
}
*/

// StringDropdownGridFilterChosen {{{2

/**
 * Represents a filter for multiple strings.
 *
 * @class
 * @extends GridFilter
 */

var StringDropdownGridFilterChosen = function () {
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
		.append(self.input)
		.append(self.removeBtn);

	self.afterAdd = function (target) {
		self.gridFilterSet.view.getUniqueVals(function (uniqueVals) {
			_.each(uniqueVals[self.field].values, function (val) {
				jQuery('<option>').attr({
					'value': val
				}).text(val).appendTo(self.input);
			});
			self.input.chosen({'width': self.div.innerWidth() - self.removeBtn.outerWidth()});
			self.chosen = self.input.next('div.chosen-container');
		});
	};

	self.gridFilterSet.gridTable.on(GridTable.events.columnResize, function () {
		var targetWidth = self.sizingElement.innerWidth() - self.removeBtn.outerWidth() - 14;
		debug.info('GRID FILTER // HANDLER (GridTablePlain.columnResize)', 'Adjusting Chosen widget width to ' + targetWidth + 'px to match column width');
		self.chosen.innerWidth(targetWidth);
	});
};

StringDropdownGridFilterChosen.prototype = Object.create(GridFilter.prototype);

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

var StringDropdownGridFilterSumo = function () {
	var self = this;

	GridFilter.apply(self, arguments);

	self.super = makeSuper(self, GridFilter);
	self.limit = 1;
	self.minDropdownWidth = 200;
	self.input = jQuery('<select>').attr({
		'multiple': true
	})
		.on('change', function (evt) {
			self.gridFilterSet.update(false);
		});

	self.div
		.append(self.input)
		.append(self.removeBtn);

	self.afterAdd = function (target) {
		self.gridFilterSet.view.getUniqueVals(function (uniqueVals) {
			_.each(uniqueVals[self.field].values, function (val) {
				jQuery('<option>').attr({
					'value': val
				}).text(val).appendTo(self.input);
			});
			var sumo = self.input.SumoSelect({
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
};

StringDropdownGridFilterSumo.prototype = Object.create(GridFilter.prototype);

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

// #getOperator {{{3

StringDropdownGridFilterSumo.prototype.getOperator = function () {
	return '$in';
};

// #getValue {{{3

StringDropdownGridFilterSumo.prototype.getValue = function () {
	var self = this
		, val = self.super.getValue();

	return val === null ? undefined : val;
};

// StringCheckedListGridFilter {{{2

var StringCheckedlistGridFilter = function () {
};

// NumberTextboxGridFilter {{{2

var NumberTextboxGridFilter = function () {
	var self = this;

	GridFilter.apply(self, arguments);

	self.input = jQuery('<input type="text">');
	self.input.on('change', function (evt) {
		self.gridFilterSet.update(false);
	});

	self.operatorDrop = self.makeOperatorDrop(['$eq', '$ne', '$lt', '$lte', '$gt', '$gte']);

	self.div
		.append(self.operatorDrop)
		.append(self.input)
		.append(self.removeBtn);
};

NumberTextboxGridFilter.prototype = Object.create(GridFilter.prototype);

// NumberCheckboxGridFilter {{{2

var NumberCheckboxGridFilter = function () {
	var self = this;

	GridFilter.apply(self, arguments);

	self.input = jQuery('<input>', {'id': gensym(), 'type': 'checkbox'});
	self.input.on('change', function () {
		self.gridFilterSet.update(false);
	});

	self.div
		.append(jQuery('<label>')
						.append(self.input)
						.append(' Filter'))
		.append(self.removeBtn);

	self.applyImmediately = true;
	self.limit = 1;
};

NumberCheckboxGridFilter.prototype = Object.create(GridFilter.prototype);

NumberCheckboxGridFilter.prototype.getValue = function () {
	return this.input[0].checked ? 1 : 0;
};

NumberCheckboxGridFilter.prototype.getOperator = function () {
	return '$eq';
};

// DateSingleGridFilter {{{2

/**
 * Represents a filter for a single date.
 *
 * @class
 * @extends GridFilter
 */

var DateSingleGridFilter = function () {
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
		.append(self.input)
		.append(self.removeBtn);
};

DateSingleGridFilter.prototype = Object.create(GridFilter.prototype);

// DateRangeGridFilter {{{2

/**
 * Represents a filter for a range of dates.
 *
 * @class
 * @extends GridFilter
 */

var DateRangeGridFilter = function () {
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
			self.gridFilterSet.update(false);
		}
	});

	self.div
		.append(self.input)
		.append(self.removeBtn);
};

DateRangeGridFilter.prototype = Object.create(GridFilter.prototype);

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
	var self = this;

	if (self.isRange()) {
		return {
			'start': moment(self.widget.selectedDates[0]),
			'end': moment(self.widget.selectedDates[1])
		};
	}
	else {
		return moment(self.widget.selectedDates[0]);
	}
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

	return self.widget.selectedDates.length > 1;
};

// BooleanCheckboxGridFilter {{{2

BooleanCheckboxGridFilter = function (field, gridFilter) {
};

BooleanCheckboxGridFilter.prototype.getValue = function () {
	return this.input.val();
};

BooleanCheckboxGridFilter.prototype.getOperator = function () {
	return '$eq';
};

BooleanCheckboxGridFilter.prototype.getId = function () {
	return this.input.attr('id');
};


// Widget Map {{{2

// Type -> Filter Widget -> Constructor

GridFilter.widgets = {
	'string': {
		'textbox': StringTextboxGridFilter,
		'dropdown': StringDropdownGridFilterSumo
	},
	'number': {
		'textbox': NumberTextboxGridFilter
	},
	'currency': {
		'textbox': NumberTextboxGridFilter
	},
	'date': {
		'single': DateSingleGridFilter,
		'range': DateRangeGridFilter
	}
};

GridFilter.defaultWidgets = {
	'string': 'dropdown',
	'number': 'textbox',
	'currency': 'textbox',
	'date': 'range'
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

var GridFilterSet = function (view, prefs, gridTable, progress) {
	var self = this;

	self.view = view;
	self.prefs = prefs;
	self.gridTable = gridTable;
	self.progress = progress;

	self.filters = {
		all: [],
		byId: {},
		byCol: {}
	};

	self.delayUpdate = false;
};

// .events {{{2

GridFilterSet.events = objFromArray([
	'filterAdded'
	, 'filterRemoved'
]);

mixinEventHandling(GridFilterSet, 'GridFilterSet', GridFilterSet.events);

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

GridFilterSet.prototype.add = function (field, target, filterType, filterBtn, onRemove, sizingElement) {
	var self = this
		, filter;

	filter = self.build(field, filterType, filterBtn, target, onRemove, sizingElement);

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

	if (self.filters.byCol[field].length === filter.limit) {
		filterBtn.hide();
	}

	self.fire(GridFilterSet.events.filterAdded);

	// Check to see if this filter should take effect as soon as it is created.

	if (filter.applyImmediately) {
		self.update();
	}
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

GridFilterSet.prototype.build = function (field, filterType, filterBtn, target, onRemove, sizingElement) {
	var self = this
		, colType
		, ctor;

	// We use a data source to get the type information, so if the grid was built without a data
	// source, this isn't going to work.
	//
	// FIXME Don't rely on the cache, do it right.

	colType = self.view.typeInfo.get(field).type;

	// Make sure that we are able to get the column type.

	if (isNothing(colType)) {
		throw new GridFilterError('Unable to determine type of column "' + field + '"');
	}

	// Make sure that we know what kinds of filters are allowed for the column type.

	if (GridFilter.widgets[colType] === undefined) {
		throw new GridFilterError('Unknown type "' + colType + '" for column "' + field + '"');
	}

	// When the user didn't request a filter type, just use the first one in the allowed list.
	// Otherwise, make sure that the filter type they asked for makes sense for the column type.

	if (isNothing(filterType)) {
		filterType = GridFilter.defaultWidgets[colType];
		ctor = GridFilter.widgets[colType][filterType];
	}
	else {
		ctor = GridFilter.widgets[colType][filterType];
	}

	if (ctor === undefined) {
		throw new GridFilterError('Invalid filter type "' + filterType + '" for type "' + colType + '" of column "' + field + '"');
	}

	debug.info('GRID FILTER', 'Creating new widget: column type = "' + colType + '" ; filter type = "' + filterType + '"');

	return new ctor(field, filterType, filterBtn, self, target, onRemove, sizingElement);
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

GridFilterSet.prototype.remove = function (id, filterBtn) {
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

	if (self.filters.byCol[filter.field].length < filter.limit) {
		filterBtn.show();
	}

	self.fire(GridFilterSet.events.filterRemoved);
};

// #reset {{{2

/**
 * Clear all filters.
 */

GridFilterSet.prototype.reset = function () {
	var self = this;

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

	self.view.clearFilter();
};

// #update {{{2

/**
 * Set the filters on the View based on what the user has entered into the user interface.
 *
 * @param {boolean} dontSavePrefs If true, don't save preferences.
 */

GridFilterSet.prototype.update = function (dontSavePrefs) {
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

	self.view.setFilter(spec, false, self.progress);

	if (self.prefs && !dontSavePrefs) {
		self.savePrefs();
	}
};

// #savePrefs {{{2

/**
 * Store preferences for the filters on this grid.
 */

GridFilterSet.prototype.savePrefs = function () {
	var self = this
		, filters = [];

	_.each(self.filters.all, function (filter) {
		var filterPref = {};

		filterPref.field = filter.field;
		filterPref.filterType = filter.filterType;
		filterPref.operator = filter.getOperator();
		filterPref.value = filter.getValue();

		filters.push(filterPref);
	});

	self.prefs.setUserData('html/filters', filters);
	self.prefs.save();
};

// #loadPrefs {{{2

/**
 * Load filter data from preferences and apply it to the grid.
 *
 * @param {object} prefs The whole preferences object.
 */

GridFilterSet.prototype.loadPrefs = function (prefs) {
	_.each(prefs.filters, function (filterPref) {
		self.add();
	});

	self.update(true); // No need to save prefs, we just loaded them!
};

