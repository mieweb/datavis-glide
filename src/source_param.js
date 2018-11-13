import _ from 'underscore';
import jQuery from 'jquery';

import {arrayCopy, debug, getProp, isEmpty, setProp} from './util.js';

// FilterError {{{1

/**
 * @class
 */

var FilterError = function (msg) {
	this.message = msg;
};

FilterError.prototype = Object.create(Error.prototype);
FilterError.prototype.name = 'FilterError';
FilterError.prototype.constructor = FilterError;

// Filter {{{1

/**
 * @class
 *
 * @property {string} inputName Name of an input element from a form.
 *
 * @property {string} type What kind of widget to get input from.  If this is undefined, the default
 * value will be used for storing (from the page), and loading (into the page) will do nothing.
 *
 * @property {boolean} required If true, an error will be issued if this filter is used on a data
 * source, when the user has not entered anything into the input element.
 *
 * @property {string} method How the input should be sent to the server.  Allowed values: [cgi,
 * json_where, json_having].
 *
 * @property {string} paramName When method = "cgi", the name of the CGI parameter to send.
 *
 * @property {object} json When method = "json_where" or method = "json_having", specifies details
 * about that method.
 *
 * @property {string} json.name Name of the constraint set.
 *
 * @property {string} json.column Name of the column to add a constraint for.
 *
 * @property {string} json.operator Operator to use for the constraint.  Allowed values: [$eq, $ne,
 * $in, $nin, $gt, $gte, $lt, $lte, $like].
 *
 * @property {string} json.operand When absent, the user's input is sent as the value.  When
 * present, this is sent instead, and any empty array is replaced with the user's input.
 *
 * @property {any} value The value that will be sent to the server.
 *
 * @property {any} internalValue An internal representation of the value sent (e.g. an object
 * storing extra information).
 *
 * @property {any} defaultValue A default value to send when the user has not specified anything.
 */

// Constructor {{{2

var Filter = function (config) {
	var self = this
		, method
		, operator;

	if (config.inputName && !config.paramName) {
		config.paramName = config.inputName;
	}
	else if (config.paramName && !config.inputName) {
		config.inputName = config.paramName;
	}

	_.defaults(config, {
		required: false,
		defaultValue: null
	});

	_.extend(self, config);

	// Make sure that if we're sending multiple values using JSON, that the operator we're using is
	// one that accepts multiple values (either "$in" or "$nin").  If we don't do this check, the
	// array of values will be interpreted as a function expression.

	if (self.type === 'multi-autocomplete'
		&& (self.method === 'json_where' || self.method === 'json_having')
		&& (self.json.operator !== '$in' && self.json.operator !== '$nin')) {
			throw new FilterError('Filter "' + self.paramName + '" is a multi-autocomplete, so the operator must be either "$in" or "$nin" (right now it\'s "' + self.json.operator + '").');
		}
};

// #store {{{2

/**
 * Store a value in this filter from the form.
 */

Filter.prototype.store = function (id) {
	var form = id ? document.getElementById(id) : null;
	var findInput = form ? function (s) {
		return jQuery(form).find(s);
	} : jQuery;
	var self = this;

	if (self.type === undefined) {
		self.value = self.defaultValue;
	}
	else {
		switch (self.type) {
		case 'hidden':
		case 'text':
			self.value = findInput('input[name="' + self.inputName + '"]').val();
			break;
		case 'date':
			self.internalValue = {};
			var x = _.map(['YEAR', 'MONTH', 'DAY'], function (elt) {
				var value = findInput('[name="' + self.inputName + elt + '"]')[0].value;
				self.internalValue[elt] = value;
				return value;
			}).join('-');
			self.value = (x === '--' ? '' : x);
			break;
		case 'checkbox':
			self.value = _.map(findInput('input[name="' + self.inputName + '"]:checkbox:checked'), function (x) {
				return findInput(x).val();
			});
			break;
		case 'toggle-checkbox':
			self.value = findInput('input[name="' + self.inputName + '"]').prop('checked') ? 'on' : 'off';
			break;
		case 'radio':
			self.value = findInput('input[name="' + self.inputName + '"]:radio:checked').val();
			break;
		case 'select':
			self.value = findInput('select[name="' + self.inputName + '"]').val();
			break;
		case 'autocomplete':
			throw new Error();
		case 'multi-autocomplete':
			self.value = [];
			self.internalValue = [];
			_.each(findInput('input[name="' + self.inputName + '"]'), function (elt, i) {
				self.value[i] = jQuery(elt).val();
				self.internalValue[i] = jQuery(elt).parent().text();
			});
			break;
		default:
			throw 'Invalid parameter specification: unknown input type "' + self.type + '"';
		}
	}

	debug.info('FILTER // STORE', 'Input Type = %s, Input Name = %s, Param Name = %s, Value = %s', self.type, self.inputName, self.paramName, self.value);

	// if (self.required && (self.value === '' || self.value === [])) {
	//	throw new MissingRequiredParameterError(self.paramName);
	// }
};

// #load {{{2

/**
 * Loads a filter from memory into a form in the page. Any existing content in
 * the form is cleared first. This is a lot more complicated than it sounds,
 * because every type has to be loaded differently.
 *
 * @param id The ID of the form to populate.
 *
 * @param opts Additional configuration options:
 *
 * - animate: If true, use an animation to pulse the background color of the
 *   input that's being changed from its currently value. When this is true,
 *   the values bgAccentIn and bgAccountOut must also be provided. (The
 *   default is false, do not show animation.)
 *
 * - bgAccentIn: Hex string for the color to use for fading into the animation
 *   (e.g. if you want something to highlight in yellow briefly and then go
 *   back to white, use a yellow color here).
 *
 * - bgAccentOut: Hex string for the color to use for fading out of the
 *   animation (in the example above, you'd use white). Also supports the
 *   special value "transparent" to remove the highlight.
 */

Filter.prototype.load = function (id, opts) {
	var self = this;

	if (self.type === undefined) {
		return;
	}

	opts = opts || {};
	var form = id ? document.getElementById(id) : null;

	var findInput = form ? function (s) {
		return jQuery(form).find(s);
	} : jQuery;

	_.defaults(opts, {
		fade: false
	});

	if (opts.fade && !(_.isString(opts.bgAccentIn) && _.isString(opts.bgAccentOut))) {
		throw 'Cannot load filter with fading without specifying bgAccent[In|Out] properties';
	}

	var fade = {
		backgroundColor: jQuery.Color(opts.bgAccentIn)
	};

	function unfade() {
		jQuery(this).animate({
			backgroundColor: jQuery.Color(opts.bgAccentOut)
		}, 500);
	}

	function unfadeBdr() {
		jQuery(this).animate({
			borderColor: jQuery.Color(opts.bgAccentOut)
		}, 500, function () {
			jQuery(this).css('border', 'none');
		});
	}

	switch (self.type) {
	case 'hidden':
		(function () {
			var nodes = findInput('input[name="' + self.inputName + '"]');
			nodes.val(self.value ? self.value : (self.defaultValue ? self.defaultValue : ''));
		})();
		break;
	case 'text':
		(function () {
			var nodes = findInput('input[name="' + self.inputName + '"]');
			if (opts.fade && nodes.val() !== self.value) {
				nodes.animate(fade, 500, unfade);
			}
			nodes.val(self.value ? self.value : (self.defaultValue ? self.defaultValue : ''));
		})();
		break;
	case 'date':
		_.each(['YEAR', 'MONTH', 'DAY'], function (elt) {
			var nodes = findInput('input[name="' + self.inputName + elt + '"]');
			nodes.val(_.isObject(self.internalValue) && _.isString(self.internalValue[elt]) && self.internalValue[elt] !== '' ? self.internalValue[elt] : (self.defaultValue ? self.defaultValue : ''));
			if (opts.fade) {
				nodes.animate(fade, 500, unfade);
			}
		});
		break;
	case 'checkbox':
		(function () {
			var curNodes = findInput('input[name="' + self.inputName + '"]:checkbox:checked');
			var curValues = {};
			_.each(curNodes, function (node) {
				curValues[jQuery(node).val()] = node;
			});
			curNodes.prop('checked', false);
			_.each(self.value, function (x) {
				var nodes = findInput('input[name="' + self.inputName + '"]:checkbox[value="' + x + '"]');
				nodes.prop('checked', true);
				delete curValues[x];
				if (opts.fade) {
					nodes.parent('label').animate(fade, 500, unfade);
				}
			});
			if (opts.fade) {
				_.each(curValues, function (node) {
					var label = jQuery(node).parent('label');
					// _.each(['Top', 'Bottom', 'Left', 'Right'], function (side) {
					//	 label.css('border' + side + 'Width', '2px');
					//	 label.css('border' + side + 'Style', 'dashed');
					//	 label.css('border' + side + 'Color', '#000000');
					// });
					label.animate(fade, 500, unfade);
				});
			}
		})();
		break;
	case 'toggle-checkbox':
		(function () {
			var node = findInput('input[name="' + self.inputName + '"]');
			var curValue = node.prop('checked') ? 'on' : 'off';
			node.prop('checked', self.value === 'on');
			if (opts.fade && curValue !== self.value) {
				node.parent('label').animate(fade, 500, unfade);
			}
		})();
		break;
	case 'radio':
		(function () {
			var nodes = findInput('input[name="' + self.inputName + '"]:radio[value="' + self.value + '"]');
			nodes.prop('checked', true);
			if (opts.fade) {
				nodes.parent('label').animate(fade, 500, unfade);
			}
		})();
		break;
	case 'select':
		(function () {
			var nodes = findInput('select[name="' + self.inputName + '"]');
			var oldVal = nodes.val();
			nodes.val(self.value);
			if (opts.fade && oldVal !== self.value) {
				nodes.parent().animate(fade, 500, unfade);
			}
		})();
		break;
	case 'autocomplete':
		return new Error();
	case 'multi-autocomplete':
		(function () {
			if (!_.isObject(window[self.inputName + '_ac'])) {
				throw 'Autocomplete object "' + self.inputName + '" does not exist';
			}
			// window[self.inputName + '_ac'].multiClear(); // Doesn't work!
			window[self.inputName + '_ac'].storedvalues = [];
			jQuery(document.getElementById(self.inputName + '_ac_div')).children().remove();
			_.each(self.value, function (v, i) {
				window[self.inputName + '_ac'].multiAddValue(v, self.internalValue[i]);
			});
			if (opts.fade) {
				jQuery(document.getElementById(self.inputName + '_ac_div')).animate(fade, 500, unfade);
			}
		})();
		break;
	default:
		throw 'Invalid parameter specification: unknown input type "' + self.type + '"';
	}
};

// #buildInput {{{2

/**
 * Constructs a hidden input within the specified form which can be used to
 * submit the filter's value to the server.
 *
 * @param form DOM node (optionally wrapped by jQuery) of the form element in
 * which to place the input.
 */

Filter.prototype.buildInput = function (form) {
	var self = this;
	var val = _.isArray(this.value) ? this.value : [this.value];
	_.each(val, function (v) {
		jQuery('<input>').attr({
			type: 'hidden',
			name: self.paramName,
			value: v
		}).appendTo(form);
	});
};

// #addJsonParam {{{2

Filter.prototype.addJsonParam = function (obj) {
	var self = this
		, operand;

	if (self.json == null) {
		throw new FilterError('Missing configuration object for JSON grid parameter.');
	}

	if (self.json.name == null || self.json.name === '') {
		throw new FilterError('Missing constraint set name for JSON grid parameter.');
	}

	if (self.json.column == null || self.json.column === '') {
		throw new FilterError('Missing column name for JSON grid parameter.');
	}

	if (self.json.operator == null || self.json.operator === '') {
		self.json.operator = '$eq';
	}

	var name = self.json.name;
	var column = self.json.column;
	var operator = self.json.operator;

	// When there's no value, remove it from the JSON object that we might have already constructed
	// (e.g. if loading the grid a second time) and make sure we don't end up with any empty stuff.

	if (self.value === null || (self.type === 'date' && self.value === '') || (self.type === 'multi-autocomplete' && self.value.length === 0)) {
		if (getProp(obj, name, column, operator)) {
			delete obj[name][column][operator];
			if (isEmpty(obj[name][column])) {
				delete obj[name][column];
			}
			if (isEmpty(obj[name])) {
				delete obj[name];
			}
		}
		return;
	}

	// Handle when the operand is an array, in which case we replace any instance of the empty array
	// with the value of the parameter.  A good example of this is how we modify a date to make it a
	// time for the end of the day: ['concat', [], ' 23:59:59'].

	if (_.isArray(self.json.operand)) {
		operand = arrayCopy(self.json.operand);
		_.each(operand, function (elt, i) {
			if (_.isArray(elt) && elt.length === 0) {
				operand[i] = self.value;
			}
		});
	}
	else {
		operand = self.json.operand == null ? self.value : self.json.operand;
	}

	setProp(operand, obj, name, column, operator);
};

// #toParams {{{2

/**
 * Convert this filter into a parameter that can be sent to a system report.  If this filter is
 * going to be used for a JSON WHERE or JSON HAVING clause, that is handled as well.
 *
 * When this filter is being sent using CGI, the parameters object records the parameter name and
 * the value of the filter.  If this filter is being sent as a JSON clause, the appropriate
 * property (either [json_where] or [json_having]) is updated.  In this latter case, somebody will
 * have to encode the object as a string before sending it to the server.
 *
 * @param {object} params The object containing the parameters that will be sent to the server.
 */
Filter.prototype.toParams = function (params) {
	var self = this;

	self.store();

	switch (self.method) {
	case 'json_where':
		params.report_json_where = params.report_json_where || {};
		self.addJsonParam(params.report_json_where);
		break;
	case 'json_having':
		params.report_json_having = params.report_json_having || {};
		self.addJsonParam(params.report_json_having);
		break;
	case 'cgi':
		params[self.paramName] = self.value;
		break;
	default:
		throw 'INVALID METHOD';
	}
};

// FilterSet {{{1

/**
 * @class
 */

// Constructor {{{2

/**
 * @param {string} name
 * @param {object} template
 */

var FilterSet = function (name, template) {
	this.name = name;
	this.filters = [];
	this.filterMap = {};
	var self = this;
	_.each(template, function (t) {
		self.add(new Filter(t));
	});
};

// #copyTo {{{2

/**
 * @param {Filter} target
 */

FilterSet.prototype.copyTo = function (target) {
	_.each(this.filterMap, function (src, paramName) {
		var dst = target.get(paramName);
		if (dst.value === undefined) {
			dst.value = src.value;
			dst.internalValue = src.internalValue;
			if (_.isObject(dst.value)) {
				dst.value = JSON.parse(JSON.stringify(dst.value));
			}
			if (_.isObject(dst.internalValue)) {
				dst.internalValue = JSON.parse(JSON.stringify(dst.internalValue));
			}
		}
	});
};

// #add {{{2

/**
 * Adds a new filter with the specified configuration to this filter set.
 *
 * @param config Configuration for the filter, giving input name, parameter
 * name, and other information (see Filter() for details).
 */

FilterSet.prototype.add = function (config) {
	var fltr = new Filter(config);
	this.filters.push(fltr);
	this.filterMap[fltr.paramName] = fltr;
};

// #remove {{{2

/**
 * Remove a filter from this filter set.
 *
 * @param paramName Parameter name of the filter to remove. All filters should
 * have unique parameter names, so this works.
 */

FilterSet.prototype.remove = function (paramName) {
	this.filters = _.reject(this.filters, function (fltr) {
		return fltr.paramName === paramName;
	});
};

// #get {{{2

/**
 * Get a filter from this filter set by name.
 *
 * @param name Parameter name of the filter to retrieve. All filters should
 * have unique parameter names, so this works.
 */

FilterSet.prototype.get = function (name) {
	return this.filterMap[name];
};

// #load {{{2

/**
 * Load all filters in this set into a form.
 *
 * @param id The ID of the form to load filter data into.
 *
 * @param opts Various options to pass along to Filter#load().
 */

FilterSet.prototype.load = function (id, opts) {
	_.each(this.filters, function (fltr) {
		fltr.load(id, opts);
	});
};

// #store {{{2

FilterSet.prototype.store = function (id) {
	_.each(this.filters, function (fltr) {
		fltr.store(id);
	});
};

// #buildForm {{{2

/**
 * Builds an invisible form containing the parameters for this filter set. The
 * form can then be submitted in order to send the parameters to the server.
 * This is useful in cases where you want to make a request but you don't want
 * to use AJAX (for example, to open the result of a POST in a new window).
 */

FilterSet.prototype.buildForm = function () {
	var form = jQuery('<form>').attr({
		action: 'webchart.cgi',
		method: 'POST'
	});
	_.each(this.filters, function (e) {
		e.buildInput(form);
	});
	return form;
};

// #toParams {{{2

/**
 * Convert the filters in this set into parameters that can be sent to a system report.
 */
FilterSet.prototype.toParams = function () {
	var params = {};

	_.each(this.filters, function (fltr) {
		fltr.toParams(params);
	});

	// The JSON clause parameters will be objects that need to be serialized first, so they can be
	// sent to the server and unpacked there.

	if (params.report_json_where !== undefined) {
		params.report_json_where = JSON.stringify(params.report_json_where);
	}

	if (params.report_json_having !== undefined) {
		params.report_json_having = JSON.stringify(params.report_json_having);
	}

	return params;
};

// FilterInput {{{1

/**
 * @class
 */

// Constructor {{{2

/**
 * @param {string} formId
 */

var FilterInput = function (formId) {
	this.formId = formId;
	this.activeFilterSet = null;
	this.availableFilterSets = {};
};

// #store {{{2

/**
 */

FilterInput.prototype.store = function () {
	this.activeFilterSet.store(this.formId);
	return this;
};

// #load {{{2

/**
 * @param {object} opts
 */

FilterInput.prototype.load = function (opts) {
	this.activeFilterSet.load(this.formId, opts);
	return this;
};

// #change {{{2

/**
 * @param {string} name
 * @param {object} opts
 */

FilterInput.prototype.change = function (name, opts) {
	opts = _.isObject(opts) ? opts : {};
	_.defaults(opts, {
		copy: false
	});
	if (this.availableFilterSets[name] === undefined) {
		throw 'No such filter set: ' + name;
	}
	if (opts.copy) {
		this.activeFilterSet.copyTo(this.availableFilterSets[name]);
	}
	this.activeFilterSet = this.availableFilterSets[name];
	return this;
};

// #activeName {{{2

/**
 * @returns {string}
 */

FilterInput.prototype.activeName = function () {
	return this.activeFilterSet.name;
};

// #add {{{2

/**
 * @param {string} name
 * @param {object} template
 */

FilterInput.prototype.add = function (name, template) {
	this.availableFilterSets[name] = (new FilterSet(name, template));
	this.change(name);
	return this;
};

// #remove {{{2

/**
 * @param {string} name
 */

FilterInput.prototype.remove = function (name) {
	delete this.availableFilterSets[name];
	return this;
};

// #get {{{2

/**
 * @param {string} name
 */

FilterInput.prototype.get = function (name) {
	return this.availableFilterSets[name];
};

// ParamInputError {{{1

function ParamInputError(msg) {
	this.message = msg;
}

ParamInputError.prototype = Object.create(Error.prototype);
ParamInputError.prototype.name = 'ParamInputError';
ParamInputError.prototype.constructor = ParamInputError;

// ParamInput {{{1

// Constructor {{{2

/**
 * @typedef ParamInput~ctor_opts
 *
 * @property {string} inputName
 *
 * @property {string} inputType
 *
 * @property {string} reportMethod
 *
 * @property {object} cgi
 *
 * @property {string} cgi.name
 *
 * @property {string} cgi.value
 *
 * @property {object} json
 *
 * @property {string} json.name
 *
 * @property {string} json.column
 *
 * @property {string} json.operator
 *
 * @property {string} json.operand
 */

/**
 * The ParamInput class contains the idea that parameters for data sources can come from user
 * inputs.  Multiple types of inputs are supported, such as multi-autocompletes and date inputs.
 * There is also a special case for no input at all, in which case the value is hardcoded by the
 * developer (e.g. for providing a "baseline" JSON WHERE clause to a model report).
 *
 * Right now this is mostly a wrapper around a Filter, but ParamInputs are a little more generic and
 * probably will become the de facto way of doing this from here on.
 *
 * @param {string} sourceType What type of data source we are working with.  Must be one of: report,
 * json, local.
 *
 * @param {ParamInput~ctor_opts} opts Various options controlling the behavior of the resulting ParamInput
 * instance.
 *
 * @class
 *
 * @property {string} inputName
 * @property {string} inputType
 * @property {string} reportMethod
 * @property {string} cgiName
 * @property {string} cgiValue
 * @property {string} jsonName
 * @property {string} jsonColumn
 * @property {string} jsonOperator
 * @property {string} jsonOperand
 */

var ParamInput = function (sourceType, opts) {
	var self = this
		, filterOpts = {};

	self.inputName = opts.inputName;
	self.inputType = opts.inputType;

	switch (sourceType) {
	case 'report':
		self.reportMethod = opts.reportMethod;

		filterOpts = {
			type: self.inputType,
			method: self.reportMethod,
			inputName: self.inputName,
		};

		switch (self.reportMethod) {
		case 'cgi':
			self.cgiName = opts.cgi.name;
			self.cgiValue = opts.cgi.value;

			filterOpts.paramName = self.cgiName; // TODO: Remove after self.filter is gone.
			filterOpts.defaultValue = self.cgiValue;

			break;
		case 'json_where':
		case 'json_having':
			self.jsonName = opts.json.name;
			self.jsonColumn = opts.json.column;
			self.jsonOperator = opts.json.operator;
			self.jsonOperand = opts.json.operand;

			filterOpts.json = { // TODO: Remove after self.filter is gone.
				name: self.jsonName,
				column: self.jsonColumn,
				operator: self.jsonOperator,
				operand: self.jsonOperand
			};

			break;
		default:
			throw new ParamInputError('Unrecognized report method "' + opts.reportMethod + '". ' +
				'Must be "cgi", "json_where", or "json_having".');
		}

		break;
	case 'json':
		throw new ParamInputError('Parameter inputs not allowed for JSON API data.');
	case 'local':
		throw new ParamInputError('Parameter inputs not allowed for local data.');
	default:
		throw new ParamInputError('Unrecognized source type "' + sourceType + '". ' +
			'Must be "report", "json", or "local".');
	}

	self.filter = new Filter(filterOpts);
};

// #toParams {{{2

/**
 * Place this parameter's value(s) into an object to be sent to the data source.
 *
 * @param {object} obj The object to place our values into.
 */

ParamInput.prototype.toParams = function (obj) {
	var self = this;

	return self.filter.toParams(obj);
};

// Exports {{{1

export {
	ParamInput
};
