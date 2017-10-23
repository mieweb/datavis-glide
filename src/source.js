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
			throw new NotImplementedError();
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
		return new NotImplementedError();
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

	if (isNothing(self.json)) {
		throw new FilterError('Missing configuration object for JSON grid parameter.');
	}

	if (isNothing(self.json.name) || self.json.name === '') {
		throw new FilterError('Missing constraint set name for JSON grid parameter.');
	}

	if (isNothing(self.json.column) || self.json.column === '') {
		throw new FilterError('Missing column name for JSON grid parameter.');
	}

	if (isNothing(self.json.operator) || self.json.operator === '') {
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
		operand = isNothing(self.json.operand) ? self.value : self.json.operand;
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

// SourceError {{{1

var SourceError = function (msg) {
	this.message = msg;
};

SourceError.prototype = Object.create(Error.prototype);
SourceError.prototype.name = 'SourceError';
SourceError.prototype.constructor = SourceError;

// LocalSource {{{1

var LocalSource = function (spec) {
	var self = this;

	self.varName = spec.varName;

	/*
	if (isNothing(self.cache)) {
		throw new InvalidSourceError('Local variable "' + self.varName + '" does not exist.');
	}

	if (!_.isArray(self.cache.data)) {
		throw new InvalidSourceError(self.varName + '.data is not an array.');
	}

	if (isNothing(self.cache.typeInfo)) {
		self.warning('No type information found in local data (' + self.varName + '.typeInfo is missing).');
	}
	*/

	self.cache = {
		data: deepCopy(window[self.varName].data),
		typeInfo: new OrdMap()
	};

	_.each(window[self.varName].typeInfo, function (fti) {
		self.cache.typeInfo.set(fti.field, fti);
	});
};

// #getData {{{2

LocalSource.prototype.getData = function (params, cont) {
	var self = this;

	return cont(self.cache.data);
};

// #getTypeInfo {{{2

LocalSource.prototype.getTypeInfo = function (cont) {
	var self = this;

	return cont(self.cache.typeInfo);
};

// #clearCachedData {{{2

LocalSource.prototype.clearCachedData = function () {
	var self = this;

	self.cache = null;
};

// #getName {{{2

LocalSource.prototype.getName = function () {
	var self = this;

	return self.varName;
};

// HttpSource {{{1

var HttpSource = function (spec, params, userTypeInfo) {
	var self = this;

	self.url = spec.url;
	self.method = spec.method || 'GET';

	self.cache = null;
	self.userTypeInfo = userTypeInfo;
};

// #parseData {{{2

HttpSource.prototype.parseData = function (data) {
	var self = this
		, result = {
			data: [],
			typeInfo: new MIE.OrdMap()
		};

	if (self.userTypeInfo) {
		_.each(self.userTypeInfo, function (fti) {
			result.typeInfo.set(fti.field, fti);
		});
	}

	//debug.info('DATA SOURCE // HTTP // PARSER', 'Data = ' + ((data instanceof XMLDocument) ? '%o' : '%O'), data);

	if (data instanceof XMLDocument) {
		var root = jQuery(data).children('root');
		if (!root.is('root')) {
			throw new SourceError('HTTP Data Source / XML Parser / Missing (root) element');
		}

		var data = root.children('data');
		if (data.length === 0) {
			throw new SourceError('HTTP Data Source / XML Parser / Missing (root > data) element');
		}
		else if (data.length > 1) {
			throw new SourceError('HTTP Data Source / XML Parser / Too many (root > data) elements');
		}

		data.children('item').each(function (_itemIndex, item) {
			item = jQuery(item);
			var row = {};
			item.children().each(function (_fieldIndex, field) {
				field = jQuery(field);
				row[field.prop('tagName')] = field.text();
			});
			result.data.push(row);
		});

		var typeInfo = root.children('typeInfo');
		if (typeInfo.length === 0) {
			throw new SourceError('HTTP Data Source / XML Parser / Missing (root > typeInfo) element');
		}
		else if (typeInfo.length > 1) {
			throw new SourceError('HTTP Data Source / XML Parser / Too many (root > typeInfo) elements');
		}

		typeInfo.children().each(function (_fieldIndex, field) {
			field = jQuery(field);
			var fieldName = field.prop('tagName');
			result.typeInfo.set(fieldName, {});
			if (field.children().length === 0) {
				result.typeInfo.get(fieldName).type = field.text();
			}
			else {
				var type = field.children('type');
				if (type.length === 0) {
					throw new SourceError('HTTP Data Source / XML Parser / Missing (root > typeInfo > ' + fieldName + ' > type) element');
				}
				else if (type.length > 1) {
					throw new SourceError('HTTP Data Source / XML Parser / Too many (root > typeInfo > ' + fieldName + ' > type) elements');
				}
				else if (type.children().length > 0) {
					throw new SourceError('HTTP Data Source / XML Parser / (root > typeInfo > ' + fieldName + ' > type) element cannot have children');
				}

				result.typeInfo.get(fieldName).type = type.text();

				var format = field.children('format');
				if (format.length > 1) {
					throw new SourceError('HTTP Data Source / XML Parser / Too many (root > typeInfo > ' + fieldName + ' > format) elements');
				}
				else if (format.length === 1) {
					if (format.children().length > 0) {
						throw new SourceError('HTTP Data Source / XML Parser / (root > typeInfo > ' + fieldName + ' > format) element cannot have children');
					}
					result.typeInfo.get(fieldName).format = format.text();
				}
			}
		});
	}
	else if (typeof data === 'string') {
		var decoded = Papa.parse(data)
			, fields = decoded.data[0];

		_.each(decoded.data.slice(1), function (row) {
			var newRow = {};
			_.each(row, function (colVal, colIdx) {
				newRow[fields[colIdx]] = colVal;
			});
			result.data.push(newRow);
		});
	}
	else {
		if (data.data === undefined) {
			throw new SourceError('HTTP Data Source / JSON Parser / Missing (data) property');
		}
		else if (!_.isArray(data.data)) {
			throw new SourceError('HTTP Data Source / JSON Parser / (data) property must be an array');
		}

		if (data.typeInfo === undefined) {
			throw new SourceError('HTTP Data Source / JSON Parser / Missing (typeInfo) property');
		}

		_.each(data.typeInfo, function (fti) {
			var field = fti.field;
			delete fti.field;
			result.typeInfo.set(field, fti);
		});

		for (var rowNum = 0; rowNum < data.data.length; rowNum += 1) {
			if (_.isArray(data.data[rowNum])) {
				var newRow = {};
				result.typeInfo.each(function (fti, field, i) {
					newRow[field] = data.data[rowNum][i];
				});
				data.data[rowNum] = newRow;
			}
		}

		result.data = data.data;
	}

	return result;
};

// #getData {{{2

HttpSource.prototype.getData = function (params, cont) {
	var self = this;

	if (self.cache === null) {
		return jQuery.ajax(self.url, {
			method: self.method,
			error: function (jqXHR, textStatus, errorThrown) {
				throw new SourceError('HTTP Data Source / AJAX Error / ' + errorThrown.message);
			},
			success: function (data, textStatus, jqXHR) {
				self.cache = self.parseData(data);
				return self.getData(params, cont);
			}
		});
	}

	return cont(self.cache.data);
};

// #getTypeInfo {{{2

HttpSource.prototype.getTypeInfo = function (cont) {
	var self = this;

	if (self.cache === null) {
		return self.getData(undefined, function () {
			return self.getTypeInfo(cont);
		});
	}

	return cont(self.cache.typeInfo);
};

// #clearCachedData {{{2

HttpSource.prototype.clearCachedData = function () {
	var self = this;

	self.cache = null;
};

// Source {{{1

// JSDoc Typedefs {{{2

/**
 * A callback function that receives the data obtained from a data source.
 *
 * @callback Source~getData_cb
 *
 * @param {Array<Object>} data The data.
 */

/**
 * A callback function that receives unique element information from a data source.
 *
 * @callback Source~getUniqElts_cb
 *
 * @param {Object<string, wcgraph.UniqElt>} uniqElts The unique element information.
 */

/**
 * A callback function that receives the type information about a data source.
 *
 * @callback Source~getTypeInfo_cb
 *
 * @param {TypeInfo} typeInfo The type information.
 */

/**
 * Represents information about the types of fields produced by a data source.  The keys are field
 * names.  Values can just be the type name as a string, in simple situations; when more info is
 * required, you can use the full object to describe the field.
 *
 * @typedef Source~TypeInfo
 *
 * @type {Object<string,string|Source~TypeInfo_Field>}
 */

/**
 * This is the full specification of a field's type information.  One step of data acquisition is
 * type decoding, which converts the data to an internal representation which will be used for
 * sorting and filtering.  This step occurs after any user conversion functions are evaluated.  Type
 * decoding works on the `value` property of the field value object.  If your conversion function
 * updates this property, it's possible to perform your own conversion and still get the benefit of
 * type decoding on the result.
 *
 * @typedef Source~TypeInfo_Field
 *
 * @property {string} type What type of data are we receiving?  Must be one of the following:
 * string, number, date, datetime, currency.
 *
 * @property {string} format For a type of date or datetime, a formatting string for Moment which
 * will decode the input.  Note that decoding comes *after* any conversion functions are executed.
 */

// Constructor {{{2

/**
 * Abstract data source that wraps specific data source implementations (e.g. for system reports or
 * the JSON API).
 *
 * @param {object} spec
 *
 * @param {object} params
 *
 * @param {object} userTypeInfo Provided by the user to override the type information that comes
 * from the origin.  For example, you might be using an origin backed by MySQL, which reports a
 * column type as being a string... but we want to treat it as a date.  You would override that
 * field's type information to indicate it should be parsed as a date instead of a string.  Another
 * possibility is to discard time information from a datetime, treating it as a date instead.
 *
 * ```
 * {
 *   "Birth Date": {
 *     "type": "date"
 *   }
 * }
 * ```
 *
 * @param {object} opts
 *
 * @param {boolean} [opts.deferDecoding=false] If true, defer conversion of numeric and date types
 * (using Numeral and Moment) until required (when displayed or upon sort).
 *
 * @param {boolean} [opts.passThroughParams=false] If true, then parameters are obtained from the
 * current page's URL.  These are overridden by any other parameters.
 *
 * @class
 * @property {string} name
 * @property {function} error
 * @property {string} type
 * @property {object} cache
 * @property {Array<ParamInput>} params
 * @property {object} locks
 * @property {Array<function>} subscribers
 * @property {boolean} guessColumnTypes
 */

var Source = function (spec, params, userTypeInfo, opts) {
	var self = this;

	self.name = spec.name; // The name of the data source, by which it can be addressed later.
	self.error = spec.error; // Error reporting function.
	self.type = spec.type; // Where we're getting the data from.
	self.cache = {};
	self.params = params;
	self.locks = {};
	self.opts = opts || {};

	_.defaults(self.opts, {
		deferDecoding: false,
		passThroughParams: false
	});

	self.eventHandlers = {};
	_.each(_.keys(Source.events), function (evt) {
		self.eventHandlers[evt] = [];
	});

	self.guessColumnTypes = true;
	self.userTypeInfo = userTypeInfo;

	if (Source.sources[self.type] === undefined) {
		throw new SourceError('Unsupported data source type: ' + self.type);
	}

	self.origin = new Source.sources[self.type](spec, params, userTypeInfo);

	var checkConversionArray = function (convs, field) {
		// Check the validity of all the specified conversions.
		//
		//   * If identified by name:
		//
		//     1. The name must already be registered in `Source.converters`
		//     2. The registered converter must be a function
		//
		//   * Otherwise it needs to be a function.

		_.each(convs, function (c, i) {
			if (typeof c === 'string') {
				if (Source.converters[c] === undefined) {
					throw new SourceError('Conversion' + (field ? ' for field "' + field + '", ' : '') + ' #' + i + ': Named converter "' + c + '" not registered');
				}

				if (typeof Source.converters[c] !== 'function') {
					throw new SourceError('Conversion' + (field ? ' for field "' + field + '", ' : '') + ' #' + i + ': Named converter "' + c + '" is not a function');
				}
			}
			else if (typeof c !== 'function') {
				throw new SourceError('Invalid Source config: `.conversion' + (field ? '[' + field + ']' : '') + '[' + i + ']` must be a function or string');
			}
		});
	};

	if (_.isArray(spec.conversion)) {
		checkConversionArray(spec.conversion);
	}
	else {
		_.each(spec.conversion, function (convs, field) {
			checkConversionArray(convs, field);
		});
	}

	self.conversion = spec.conversion;

	self.locks.getData = new Lock();
};

Source.prototype = Object.create(Object.prototype);
Source.prototype.constructor = Source;

mixinEventHandling(Source, 'Source', [
		'dataUpdated'
]);

// .sources {{{2

/**
 * A map of source types to the classes that implement them.
 */

Source.sources = {
	local: LocalSource,
	http: HttpSource
};

// .converters {{{2

Source.converters = {};

// #getName {{{2

Source.prototype.getName = function () {
	var self = this;

	if (typeof self.origin.getName === 'function') {
		return self.origin.getName();
	}
};

// #getData {{{2

/**
 * Evaluate the data source, if necessary, and pass along the data that was obtained from it.  The
 * data will be cached so that subsequent invocations don't re-evaluate the data source.
 *
 * @method
 *
 * @param {Source~getData_cb} cont Continuation function.
 */

Source.prototype.getData = function (cont) {
	var self = this;

	if (self.locks.getData.isLocked()) {
		return self.locks.getData.onUnlock(function () {
			return self.getData(cont);
		});
	}

	if (!isNothing(self.cache.data)) {
		return cont(self.cache.data);
	}

	self.locks.getData.lock();
	return self.origin.getData(self.createParams(), function (data) {
		if (self.type === 'local') {
			self.cache.data = data;
			self.locks.getData.unlock();
			return cont(data);
		}
		else {
			self.postProcess(data, function (finalData) {
				self.cache.data = finalData;
				self.locks.getData.unlock();
				return cont(finalData);
			});
		}
	});
};

// #getUniqueVals {{{2

/**
 * Provide unique element information.
 *
 * @method
 *
 * @param {Source~getUniqElts_cb} cont Continuation function.
 */

Source.prototype.getUniqueVals = function (cont) {
	var self = this;

	if (!isNothing(self.cache.uniqElts)) {
		return cont(self.cache.uniqElts);
	}

	self.getData(function (data) {
		var uniqElts = {};
		var tmp = {};

		_.each(data, function (row) {
			_.each(row, function (cell, field) {
				if (uniqElts[field] === undefined) {
					uniqElts[field] = {
						count: 0,
						values: []
					};
					tmp[field] = {};
				}

				if (tmp[field][cell.value] === undefined) {
					tmp[field][cell.value] = true;
					uniqElts[field].count += 1;
					uniqElts[field].values.push(cell.value);
				}
			});
		});

		_.each(uniqElts, function (obj) {
			obj.values.sort();
		});

		self.cache.uniqElts = uniqElts;
		return cont(self.cache.uniqElts);
	});
};

// #getTypeInfo {{{2

/**
 * @param {Source~getTypeInfo_cb} cont Continuation function.
 */

Source.prototype.getTypeInfo = function (cont) {
	var self = this;

	if (!isNothing(self.cache.typeInfo)) {
		return cont(self.cache.typeInfo);
	}

	return self.origin.getTypeInfo(function (typeInfo) {
		// When the type information for a field is just a string, then that's the same as setting it as
		// the 'type' property of the full object.

		typeInfo.each(function (v, k) {
			if (typeof v === 'string') {
				v = {
					'type': v
				};
				typeInfo.set(k, v);
			}
			v.field = k;
		});

		// XXX This object is a clone of the original typeInfo because we're augmenting it with the
		// user's type info overrides.  I don't remember why we couldn't just do it on the original.
		//
		// TODO Try to do this without cloning.

		var typeInfoClone = deepCopy(typeInfo);

		if (self.userTypeInfo !== undefined) {
			_.each(self.userTypeInfo, function (fieldTypeInfo, field) {
				jQuery.extend(true, typeInfoClone.get(field), fieldTypeInfo);
				debug.info('SOURCE // GET TYPE INFO', 'Overriding origin type information { field = "' + field + '", typeInfo = %O }', fieldTypeInfo);
			});
		}

		self.cache.typeInfo = typeInfoClone;
		debug.info('SOURCE // GET TYPE INFO', 'Type Info = %O', deepCopy(self.cache.typeInfo.asMap()));
		return cont(self.cache.typeInfo);
	});
};

// #getDisplayName {{{2

Source.prototype.getDisplayName = function (cont) {
	var self = this;

	if (!isNothing(self.cache.displayName)) {
		return cont(self.cache.displayName);
	}

	if (!isNothing(self.origin.getDisplayName)) {
		return self.origin.getDisplayName(function (displayName) {
			self.cache.displayName = displayName;
			return cont(self.cache.displayName);
		});
	}
	else {
		self.cache.displayName = {};
		return cont(self.cache.displayName);
	}
};

// #postProcess {{{2

Source.prototype.postProcess = function (data, cont) {
	var self = this;

	if (isNothing(data)) {
		throw new SourceError('Data Source / Post Process / Received nothing');
	}
	else if (!_.isArray(data)) {
		throw new SourceError('Data Source / Post Process / Data is not an array');
	}

	debug.info('SOURCE // POST-PROCESSING', 'Beginning post-processing');

	self.getTypeInfo(function (typeInfo) {
		debug.info('SOURCE // POST-PROCESSING', 'Received type info from source origin: %O', typeInfo.asMap());

		// Gather the user's conversion functions, which will be applied on every row.  Conversion
		// functions can be applied across all fields (specified as an array), or on a per-field basis
		// (specified as an object with field name keys and array values).

		var conversionFuncs = {};
		typeInfo.each(function (fti, fieldName) {
			conversionFuncs[fieldName] = self.getConversionFuncs(fieldName);
		});

		// Update the type information with whether the internal representation (i.e. numeral or moment)
		// conversion of a field should be deferred or not.

		self.setConversionTypeInfo(data);

		_.each(data, function (row, rowNum) {
			_.each(row, function (val, field) {
				var fti = typeInfo.get(field);

				row[field] = {
					value: val
				};

				if (conversionFuncs[field] !== undefined) {
					// Go through all the user's conversion functions.

					var i = 0;
					while (i < conversionFuncs[field].length) {
						if (conversionFuncs[field][i](row[field], field, fti, row, self)) {
							break;
						}
						i += 1;
					}
				}

				// Unless conversion has been deferred on this field, convert it into the appropriate
				// internal representation (numeral or moment).

				if (!fti.deferDecoding) {
					self.convertCell(row, field);
				}
			});
		});

		debug.info('SOURCE // POST-PROCESSING', 'Post-processing finished');

		return cont(data);
	});
};

// #determineConversionFuncs {{{2

Source.prototype.getConversionFuncs = function (fieldName) {
	var self = this
		, conversionFuncs = [];

	var addConversionFuncs = function (convs) {
		_.each(convs, function (c, i) {
			if (typeof c === 'function') {
				conversionFuncs.push(c);
			}
			else if (typeof c === 'string') {
				conversionFuncs.push(Source.converters[c]);
			}
		});
	};

	if (self.conversion !== undefined) {
		if (_.isArray(self.conversion)) {
			addConversionFuncs(self.conversion);
		}
		else if (self.conversion[fieldName] !== undefined) {
			addConversionFuncs(self.conversion[fieldName]);
		}
	}

	return conversionFuncs;
};

// #setConversionTypeInfo {{{2

Source.prototype.setConversionTypeInfo = function (data) {
	var self = this;

	_.each(self.cache.typeInfo.asMap(), function (fti /* field type info */, f /* field */) {
		if (['number', 'currency', 'date', 'datetime'].indexOf(fti.type) >= 0) {
			fti.deferDecoding = self.opts.deferDecoding;

			if (fti.type === 'number' || fti.type === 'currency') {
				fti.needsDecoding = true;
				fti.internalType = 'numeral';

				if (data.length > 0 && (isInt(data[0][f]) || isFloat(data[0][f]))) {

					// Looks like it can be decoded into a primitive number, so there's no need for Numeral's
					// advanced parsing.

					fti.internalType = 'primitive';
				}
			}
			else if (fti.type === 'date' || fti.type === 'datetime') {
				if ((fti.type === 'date' && (fti.format === undefined || fti.format === 'YYYY-MM-DD'))
						|| (fti.type === 'datetime' && (fti.format === undefined || fti.format === 'YYYY-MM-DD HH:mm:ss'))) {
					fti.internalType = 'string';
				}
				else {

					// This is a date that can't be sorted lexicographically, so it needs to be stored and
					// processed using Moment.

					fti.needsDecoding = true;
					fti.internalType = 'moment';
				}
			}

			if (fti.deferDecoding) {
				debug.info('SOURCE // CONVERSION', 'Deferring conversion until <%s> { field = "%s", type = "%s", format = "%s" }',
									 fti.needsDecoding ? 'SORT' : 'DISPLAY', f, fti.type, fti.format);
			}
		}
	});
};

// #convertCell {{{2

/**
 * Converts a cell of data into an appropriate internal representation, regardless of whether
 * conversion has been deferred on that field or not.
 *
 * @param {object} row The `rowData` property of a row object.
 * @param {string} field Name of the field this data cell belongs to.
 */

Source.prototype.convertCell = function (row, field) {
	var self = this
		, fti = self.cache.typeInfo.get(field)
		, cell = row[field];

	switch (fti.type) {
	case 'number':
	case 'currency':
		if (cell.orig === undefined) {
			cell.orig = cell.value;
		}
		if (typeof cell.value === 'string') {
			switch (fti.internalType) {
			case 'numeral':
				cell.value = numeral(cell.value);
				break;
			case 'primitive':
				if (isInt(cell.value)) {
					cell.value = toInt(cell.value);
				}
				else if (isFloat(cell.value)) {
					cell.value = toFloat(cell.value);
				}
				break;
			default:
				log.error('Unable to convert cell value, invalid internal type "%s": { field = "%s", type = "%s", valueTypeOf = "%s" }',
									fti.internalType, field, fti.type, typeof(cell.value));
			}
		}
		else if (typeof cell.value !== 'number' && (window.numeral ? !window.numeral.isNumeral(cell.value) : true)) {
			log.error('Unable to convert cell value: { field = "%s", type = "%s", valueTypeOf = "%s" }',
								field, fti.type, typeof(cell.value));
		}
		break;
	case 'date':
	case 'time':
	case 'datetime':
		if (cell.orig === undefined) {
			cell.orig = cell.value;
		}
		if (typeof cell.value === 'string') {
			switch (fti.internalType) {
			case 'moment':
				cell.value = moment(cell.value, fti.format);
				break;
			case 'string':
				/* NOTHING */
				break;
			default:
				log.error('Unable to convert cell value, invalid internal type "%s": { field = "%s", type = "%s", valueTypeOf = "%s" }',
									fti.internalType, field, fti.type, typeof(cell.value));
			}
		}
		else if (typeof cell.value !== 'string' && (window.moment ? !window.moment.isMoment(cell.value) : true)) {
			log.error('Unable to convert cell value: { field = "%s", type = "%s", valueTypeOf = "%s" }',
								field, fti.type, typeof(cell.value));
		}
		break;
	}
};

// #convertAll {{{2

Source.prototype.convertAll = function (data, field) {
	var self = this;

	_.each(data, function (row) {
		self.convertCell(row.rowData, field);
	});
};

// #clearCachedData {{{2

/**
 * Removes the cache of data, type information, unique elements, and display names.  This is also
 * needed to force the data source to re-evalute its parameter inputs.  The next call to getData()
 * et al. will re-evaluate the underlying data source.
 *
 * @method
 */

Source.prototype.clearCachedData = function () {
	var self = this;

	if (typeof self.origin.clearCachedData === 'function') {
		self.origin.clearCachedData();
	}

	self.cache = {};

	debug.info('SOURCE (' + self.name + ')', 'Cleared cache');

	self.fire(Source.events.dataUpdated);
};

// #createParams {{{2

/**
 * Create a parameters object from the ParamInput instances currently bound to this data source.
 * This is an internal method used when the user calls getData().  For system reports, it helps
 * build the object used by jQuery to set the CGI parameters for the HTTP GET request.
 *
 * @method
 *
 * @returns {object} The CGI parameters needed for running a system report.
 */

Source.prototype.createParams = function () {
	var self = this
		, obj = {};

	if (self.opts.passThroughParams) {
		obj = getParamsFromUrl();
	}

	_.each(self.params, function (p) {
		debug.info('SOURCE // CREATE PARAMS', 'Parameter =', p);
		p.toParams(obj);
	});

	debug.info('SOURCE // CREATE PARAMS', 'Final Parameters =', obj);

	// The JSON clause parameters will be objects that need to be serialized first, so they can be
	// sent to the server and unpacked there.

	if (!isNothing(obj.report_json_where)) {
		obj.report_json_where = JSON.stringify(obj.report_json_where);
	}

	if (!isNothing(obj.report_json_having)) {
		obj.report_json_having = JSON.stringify(obj.report_json_having);
	}

	return obj;
};

// #swapRows {{{2

/**
 *
 */

Source.prototype.swapRows = function (oldIndex, newIndex) {
	var self = this;

	if (self.cache.data === undefined) {
		throw new SourceError('Attempted to swap rows before retrieving data');
	}

	var temp = self.cache.data.splice(oldIndex, 1);
	self.cache.data.splice(newIndex, 0, temp[0]);
	//for (var i=0; i<self.cache.data.length; i++) {
	//	self.cache.data[i].position=i;
	//}
};

// #toString {{{2

Source.prototype.toString = function () {
	var self = this;

	return 'Source <' + self.name + ', ' + self.type + '>';
};

// Data Model {{{1
//
// There's no such thing as a data model now.  There's just not a lot of functionality AT THIS TIME
// that we would put there.  So the data source is kind of acting as the model now.  This may change
// when we add editing.

