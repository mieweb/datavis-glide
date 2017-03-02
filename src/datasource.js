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
 * @property {string} type What kind of widget to get input from.
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

	_.defaults(config, {
		inputName: config.paramName,
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
	switch (self.type) {
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

	debug.info('FILTER', 'Param Name = %s, Value = %s', self.paramName, self.value);

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
	opts = opts || {};
	var form = id ? document.getElementById(id) : null;

	var findInput = form ? function (s) {
		return jQuery(form).find(s);
	} : jQuery;

	var self = this;

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

// DataSourceError {{{1

var DataSourceError = function (msg) {
	this.message = msg;
};

DataSourceError.prototype = Object.create(Error.prototype);
DataSourceError.prototype.name = 'DataSourceError';
DataSourceError.prototype.constructor = DataSourceError;

// LocalDataSource {{{1

var LocalDataSource = function (spec) {
	var self = this;

	self.varName = spec.varName;
	self.cache = window[self.varName];

	if (isNothing(self.cache)) {
		throw new InvalidSourceError('Local variable "' + self.varName + '" does not exist.');
	}

	if (!_.isArray(self.cache.data)) {
		throw new InvalidSourceError(self.varName + '.data is not an array.');
	}

	if (isNothing(self.cache.typeInfo)) {
		self.warning('No type information found in local data (' + self.varName + '.typeInfo is missing).');
	}
};

// #getData {{{2

LocalDataSource.prototype.getData = function (params, cont) {
	var self = this;

	return cont(self.cache.data);
};

// #getTypeInfo {{{2

LocalDataSource.prototype.getTypeInfo = function (cont) {
	var self = this;

	return cont(self.cache.typeInfo);
};

// HttpDataSource {{{1

var HttpDataSource = function (spec) {
	var self = this;

	self.url = spec.url;
	self.method = spec.method || 'GET';

	self.cache = null;
};

HttpDataSource.parseData = function (data) {
	var result = {};

	debug.info('DATA SOURCE // HTTP // PARSER', 'Data = ' + ((data instanceof XMLDocument) ? '%o' : '%O'), data);

	if (data instanceof XMLDocument) {
		var root = jQuery(data).children('root');
		if (!root.is('root')) {
			throw new DataSourceError('HTTP Data Source / XML Parser / Missing (root) element');
		}

		var data = root.children('data');
		if (data.length === 0) {
			throw new DataSourceError('HTTP Data Source / XML Parser / Missing (root > data) element');
		}
		else if (data.length > 1) {
			throw new DataSourceError('HTTP Data Source / XML Parser / Too many (root > data) elements');
		}

		result.data = [];
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
			throw new DataSourceError('HTTP Data Source / XML Parser / Missing (root > typeInfo) element');
		}
		else if (typeInfo.length > 1) {
			throw new DataSourceError('HTTP Data Source / XML Parser / Too many (root > typeInfo) elements');
		}

		result.typeInfo = {};
		typeInfo.children().each(function (_fieldIndex, field) {
			field = jQuery(field);
			result.typeInfo[field.prop('tagName')] = field.text();
		});
	}
	else {
		if (data.data === undefined) {
			throw new DataSourceError('HTTP Data Source / JSON Parser / Missing (data) property');
		}
		else if (!_.isArray(data.data)) {
			throw new DataSourceError('HTTP Data Source / JSON Parser / (data) property must be an array');
		}

		if (data.typeInfo === undefined) {
			throw new DataSourceError('HTTP Data Source / JSON Parser / Missing (typeInfo) property');
		}

		result = data;
	}

	return result;
};

// #getData {{{2

HttpDataSource.prototype.getData = function (params, cont) {
	var self = this;

	if (self.cache === null) {
		return jQuery.ajax(self.url, {
			method: self.method,
			error: function (jqXHR, textStatus, errorThrown) {
				throw new DataSourceError('HTTP Data Source / AJAX Error / ' + errorThrown.message);
			},
			success: function (data, textStatus, jqXHR) {
				self.cache = HttpDataSource.parseData(data);
				return self.getData(params, cont);
			}
		});
	}

	return cont(self.cache.data);
};

// #getTypeInfo {{{2

HttpDataSource.prototype.getTypeInfo = function (cont) {
	var self = this;

	if (self.cache === null) {
		return self.getData(function () {
			return self.getTypeInfo(cont);
		});
	}

	return cont(self.cache.typeInfo);
};

// DataSource {{{1

// JSDoc Typedefs {{{2

/**
 * A callback function that receives the data obtained from a data source.
 *
 * @callback DataSource~getData_cb
 *
 * @param {Array<Object>} data The data.
 */

/**
 * A callback function that receives unique element information from a data source.
 *
 * @callback DataSource~getUniqElts_cb
 *
 * @param {Object<string, wcgraph.UniqElt>} uniqElts The unique element information.
 */

/**
 * A callback function that receives the type information about a data source.
 *
 * @callback DataSource~getTypeInfo_cb
 *
 * @param {wcgraph.TypeInfo} typeInfo The type information.
 */

// Constructor {{{2

/**
 * Abstract data source that wraps specific data source implementations (e.g. for system reports or
 * the JSON API).
 *
 * @param {object} spec
 * @param {object} params
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

var DataSource = function (spec, params) {
	var self = this;

	self.name = spec.name; // The name of the data source, by which it can be addressed later.
	self.error = spec.error; // Error reporting function.
	self.type = spec.type; // Where we're getting the data from.
	self.cache = {};
	self.params = params;
	self.locks = {};
	self.subscribers = [];
	self.guessColumnTypes = true;

	if (DataSource.sources[self.type] === undefined) {
		throw new DataSourceError('Unsupported data source type: ' + self.type);
	}

	self.source = new DataSource.sources[self.type](spec);

	if (!isNothing(spec.conversion) && !_.isArray(spec.conversion)) {
		throw new DataSourceError('Invalid DataSource config: <.conversion> must be an array');
	}

	_.each(spec.conversion, function (f, i) {
		if (typeof f !== 'function') {
			throw new DataSourceError('Invalid DataSource config: <.conversion[' + i + '] must be a function');
		}
	});

	self.conversion = spec.conversion || [];

	self.locks.getData = new Lock();
};

// .sources {{{2

/**
 * A map of source types to the classes that implement them.
 */

DataSource.sources = {
	local: LocalDataSource,
	http: HttpDataSource
};

// .messages {{{2

DataSource.messages = {
	DATA_UPDATED: 'DATA_UPDATED'
};

// #getData {{{2

/**
 * Evaluate the data source, if necessary, and pass along the data that was obtained from it.  The
 * data will be cached so that subsequent invocations don't re-evaluate the data source.
 *
 * @method
 *
 * @param {DataSource~getData_cb} cont Continuation function.
 */

DataSource.prototype.getData = function (cont) {
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
	return self.source.getData(self.createParams(), function (data) {
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

// #getUniqElts {{{2

/**
 * Provide unique element information.
 *
 * @method
 *
 * @param {DataSource~getUniqElts_cb} cont Continuation function.
 */

DataSource.prototype.getUniqElts = function (cont) {
	var self = this;

	if (!isNothing(self.cache.uniqElts)) {
		return cont(self.cache.uniqElts);
	}

	self.getData(function (data) {
		var uniqElts = {};

		_.each(data, function (row) {
			_.each(row, function (value, col) {
				if (uniqElts[col] === undefined) {
					uniqElts[col] = {
						count: 0,
						values: {}
					};
				}

				if (uniqElts[col].values[value] === undefined) {
					uniqElts[col].count += 1;
					uniqElts[col].values[value] = true;
				}
			});
		});

		self.cache.uniqElts = uniqElts;
		return cont(self.cache.uniqElts);
	});
};

// #getTypeInfo {{{2

/**
 * @param {DataSource~getTypeInfo_cb} cont Continuation function.
 */

DataSource.prototype.getTypeInfo = function (cont) {
	var self = this;

	if (!isNothing(self.cache.typeInfo)) {
		return cont(self.cache.typeInfo);
	}

	return self.source.getTypeInfo(function (typeInfo) {
		self.cache.typeInfo = typeInfo;
		return cont(self.cache.typeInfo);
	});
};

// #getDisplayName {{{2

DataSource.prototype.getDisplayName = function (cont) {
	var self = this;

	if (!isNothing(self.cache.displayName)) {
		return cont(self.cache.displayName);
	}

	if (!isNothing(self.source.getDisplayName)) {
		return self.source.getDisplayName(function (displayName) {
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

DataSource.prototype.postProcess = function (data, cont) {
	var self = this;

	if (isNothing(data)) {
		throw new DataSourceError('Data Source / Post Process / Received nothing');
	}
	else if (!_.isArray(data)) {
		throw new DataSourceError('Data Source / Post Process / Data is not an array');
	}

	debug.info('DATA SOURCE // POST-PROCESSING', 'Beginning post-processing');

	self.getTypeInfo(function (typeInfo) {
		_.each(data, function (row, rowNum) {
			_.each(row, function (val, field) {
				var i = 0;
				while (i < self.conversion.length) {
					var result = self.conversion[i](val, field, typeInfo[field], row);
					if (result !== null && result !== undefined) {
						row[field] = result;
						break;
					}
					i += 1;
				}
			});
		});

		return cont(data);
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

DataSource.prototype.clearCachedData = function () {
	var self = this;

	self.cache = {};
	self.publish(DataSource.messages.DATA_UPDATED);
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

DataSource.prototype.createParams = function () {
	var self = this
		, obj = {};

	_.each(self.params, function (p) {
		debug.info('DATA SOURCE // CREATE PARAMS', 'Parameter =', p);
		p.toParams(obj);
	});

	debug.info('DATA SOURCE // #createParams()', 'Final Parameters =', obj);

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

// #subscribe {{{2

/**
 * Subscribe to events on this data source.  This mechanism is used to notify clients that they need
 * to refresh their display after a data update.
 *
 * @method
 */

DataSource.prototype.subscribe = function (f) {
	this.subscribers.push(f);
};

// #publish {{{2

/**
 * Notify all subscribers of a message.
 *
 * @param {string} msg The message to send to all subscribers.
 * @param {...string} rest Additional arguments to pass to the subscribers.
 */

DataSource.prototype.publish = function () {
	var self = this;
	var args = Array.prototype.slice.call(arguments);

	args.unshift(self);

	debug.info('DATA SOURCE // PUBLISH', 'Sending message "%s" from data source "%s": %O', args[1], self.name, args.slice(2));

	_.each(self.subscribers, function (f) {
		f.apply(null, args);
	});
};

// #swapRows {{{2

/**
 *
 */

DataSource.prototype.swapRows = function (oldIndex, newIndex) {
	var self = this;

	if (self.cache.data === undefined) {
		throw new DataSourceError('Attempted to swap rows before retrieving data');
	}

	var temp = self.cache.data.splice(oldIndex, 1);
	self.cache.data.splice(newIndex, 0, temp[0]);
	//for (var i=0; i<self.cache.data.length; i++) {
	//	self.cache.data[i].position=i;
	//}
};

// Data Model {{{1
//
// There's no such thing as a data model now.  There's just not a lot of functionality AT THIS TIME
// that we would put there.  So the data source is kind of acting as the model now.  This may change
// when we add editing.

// Data View {{{1

var DATA_VIEW_ID = 1;

/**
 * This represents a view of the data obtained by a data source.  While the pool of available data
 * is the same, the way its represented to the user (filtered, sorted, grouped, or pivotted)
 * changes.
 *
 * @memberof wcgraph_int
 *
 * @class
 *
 * @property {DataSource} source
 *
 * @property {Object} defn
 *
 * @property {Array.<function>} subscribers
 *
 * @property {Object} sortSpec
 *
 * @property {string} sortSpec.col The name of the column to sort by.
 *
 * @property {string} sortSpec.dir The direction of the sort, either "ASC" or "DESC."
 *
 * @property {Object} groupSpec
 *
 * @property {Array.<string>} groupSpec.fieldNames
 *
 * @property {Function} groupSpec.aggregate
 *
 * @property {number} tryLimit Maximum number of tries for calling getData(), this is a safety valve
 * which is mostly useful while developing (it prevents your computer's memory from being completely
 * eaten by an infinite recursive loop).
 *
 * @property {Timing} timing For keeping track of how long it takes to do things in the view.
 */

// Data View Error {{{2

function DataViewError(msg) {
	this.message = msg;
}

DataViewError.prototype = Object.create(Error.prototype);
DataViewError.prototype.name = 'DataViewError';
DataViewError.prototype.constructor = DataViewError;

// Constructor {{{2

function DataView(source, defn, wcgrid) {
	var self = this;

	self.source = source;
	self.defn = defn;
	self.wcgrid = wcgrid;
	self.subscribers = [];
	self.name = 'Data View #' + (DATA_VIEW_ID++);
	self.eventHandlers = {};
	self.tryLimit = 5;
	self.timing = new Timing();
}

DataView.prototype = Object.create(Error.prototype);
DataView.prototype.name = 'DataView';
DataView.prototype.constructor = DataView;

// #getRowCount {{{2

/**
 * Get the number of rows currently being shown by the view.
 */

DataView.prototype.getRowCount = function () {
	var self = this;

	if (self.data.isPlain) {
		return self.data.data.length;
	}
	else if (self.data.isGroup) {
		return _.reduce(self.data, function (prev1, groupedData, rowValNum) {
			if (self.data.isPivot) {
				return prev1 + _.reduce(groupedData, function (prev2, pivottedData, colValNum) {
					return prev2 + pivottedData.length;
				}, 0);
			}
			else {
				return prev1 + groupedData.length;
			}
		}, 0);
	}
	else {
		throw new Error('Unable to determine row count when data is not plain, but also not grouped.');
	}
};

// #getTotalRowCount {{{2

/**
 * Get the number of rows that could be shown by the view.
 */

DataView.prototype.getTotalRowCount = function () {
	return this.source.cache.data.length;
};

// #on {{{2

/**
 * Register an event handler for different things that happen in the view.  Multiple handlers can be
 * registered on the same event; they will be called in the order they were reigstered.
 *
 * @param {string} event The kind of event to register on.
 * @param {function} cb A function to call when the event fires.  The arguments to the function
 * depend on the event.
 */

DataView.prototype.on = function (event, cb) {
	if (this.eventHandlers[event] === undefined) {
		this.eventHandlers[event] = [];
	}

	this.eventHandlers[event].push(cb);
};

// #off {{{2

/**
 * Remove all registered event handlers for the specified events.
 *
 * @param {...string} events The events to remove handlers for.
 */

DataView.prototype.off = function () {
	var args = Array.prototype.slice.call(arguments)
		, self = this;

	_.each(args, function (event) {
		delete self.eventHandlers[event];
	});
};

// #setSort {{{2

/**
 * Set the sorting spec for the view.
 *
 * @param {string} col
 * @param {string} dir
 *
 * @param {boolean} dontNotify If true, don't fire off the message notifying subscribers that the
 * view has been sorted.
 */

DataView.prototype.setSort = function (col, dir, dontNotify) {
	var self = this;

	self.clearCache();

	if (isNothing(col) || isNothing(dir)) {
		self.sortSpec = null;
	}
	else {
		self.sortSpec = {
			col: col,
			dir: dir
		};
	}

	window.setTimeout(function () {
		self.getData();
	});
};

// #clearSort {{{2

/**
 * Clear the sort spec for the view.
 *
 * @param {boolean} dontNotify If true, don't fire off the message notifying subscribers that the
 * view has been sorted.
 */

DataView.prototype.clearSort = function (dontNotify) {
	return this.setSort(null, null, dontNotify);
};

// #sort {{{2

/**
 * Sort this view of the data by the specified column name, in the specified direction.
 */

DataView.prototype.sort = function () {
	var self = this
		, timingEvt = ['Data Source "' + self.source.name + '" : ' + self.name, 'Sorting']
		, conv = I;

	if (self.sortSpec === undefined) {
		return;
	}

	self.timing.start(timingEvt);

	switch (self.typeInfo[self.sortSpec.col]) {
	case 'number':
		conv = parseFloat;
		break;
	case 'date':
		conv = function (x) { return new Date(x); };
		break;
	case 'string':
		conv = function (x) { return x.toLowerCase(); };
		break;
	}

	if (self.data.data[0].rowData['_ORIG_' + self.sortSpec.col] !== undefined) {
		self.sortSpec.col = '_ORIG_' + self.sortSpec.col;
	}

	var sorted = mergeSort2(self.data.data, function (a, b) {
		return !!((conv(a.rowData[self.sortSpec.col]) < conv(b.rowData[self.sortSpec.col])) ^ (self.sortSpec.dir === 'DESC'));
	});

	if (self.eventHandlers.sort) {
		_.each(sorted, function (row, position) {
			_.each(self.eventHandlers.sort, function (cb) {
				if (typeof cb === 'function') {
					cb(row.rowNum, position);
				}
			});
		});
	}

	self.timing.stop(timingEvt);
	return sorted;
};

// #setFilter {{{2

/**
 * @typedef {Object<string,string>|Object<string,DataView_Filter_Spec_Value>} DataView_Filter_Spec
 * The specification used for filtering within a data view.  The keys are column names, and the
 * values are either strings (implying an equality relationship) or objects indicating a more
 * complex relationship.
 */

/**
 * @typedef {Object<string,any>} DataView_Filter_Spec_Value
 * A value within the filter spec object.  In order for a row to "pass" the filter, all of the
 * conditions supplied must be true.  At least one of the following must be provided.
 *
 * @property {string|number|Date} [$eq] Allow things equal to the value.
 * @property {string|number|Date} [$ne] Allow things not equal to the value.
 * @property {string|number|Date} [$gt] Allow things greater than the value.
 * @property {string|number|Date} [$gte] Allow things greater than or equal to the value.
 * @property {string|number|Date} [$lt] Allow things less than the value.
 * @property {string|number|Date} [$lte] Allow things less than or equal to the value.
 * @property {Array.<string|number>} [$in] Allow things that are elements of the set value.
 * @property {Array.<string|number>} [$nin] Allow things that are not elements of the set value.
 */

/**
 * Set the filtering that will be used by this view.  The object spec is the same as we support for
 * server-side filtering using JSON.  It's based on MongoDB.  Every key is the name of a column to
 * filter.  Every value is either a string (the column must be equal to that value), or an object
 * --- in which every key is an operator and every value an operand.  Operators are:
 *
 *   - $eq, $ne, $gt, $gte, $lt, $lte, $contains, $notcontains
 *   - $in, $nin
 *
 * @method
 * @memberof DataView
 *
 * @param {DataView_Filter_Spec} spec How to perform filtering.
 */

DataView.prototype.setFilter = function (spec, dontNotify) {
	var self = this;

	self.clearCache();
	self.filterSpec = spec;
	self.getData();
};

// #clearFilter {{{2

/**
 * Clear the spec used to filter this view.
 *
 * @param {boolean} dontNotify If true, don't send the notification message to subscribers that this
 * view has been filtered.
 */

DataView.prototype.clearFilter = function (dontNotify) {
	this.setFilter(null, dontNotify);
};

// #isFiltered {{{2

/**
 * Tell if this view has been filtered.
 *
 * @returns {boolean} True if the view has been filtered.
 */

DataView.prototype.isFiltered = function () {
	return !isNothing(this.filterSpec);
};

// #filter {{{2

/**
 * Apply the filter previously set.
 */

DataView.prototype.filter = function () {
	var self = this
		, timingEvt = ['Data Source "' + self.source.name + '" : ' + self.name, 'Filtering'];

	if (self.filterSpec === undefined) {
		return;
	}

	// Checks to see if the given filter passes for the given row.

	function passesFilter(fltr, colName, row) {
		var datum = either(row['_ORIG_' + colName], row[colName]);

		// When there's no such column, automatically fail.

		if (datum === undefined) {
			debug.warn('DATA VIEW // FILTER', 'Attempted to filter by non-existent column: ' + colName);
			return false;
		}

		datum = datum.toString().toLowerCase();

		var pred = {
			'$eq': function (x) {
				return datum === x.toString().toLowerCase();
			},
			'$ne': function (x) {
				return datum !== x.toString().toLowerCase();
			},
			'$contains': function (x) {
				return datum.indexOf(x.toString().toLowerCase()) >= 0;
			},
			'$notcontains': function (x) {
				return datum.indexOf(x.toString().toLowerCase()) < 0;
			}
		};

		for (var operator in fltr) {
			if (!fltr.hasOwnProperty(operator)) {
				continue;
			}

			var operand = fltr[operator];
			// debug.info('DATA VIEW // FILTER', 'ColName = ' + colName + ' ; Datum = ' + datum + ' ; Operator = ' + operator + ' ; Operand = ' + operand);

			if (pred[operator] !== undefined) {
				if (_.isArray(operand)) {
					if (_.every(operand, pred[operator]) === false) {
						return false;
					}
				}
				else if (pred[operator](operand) === false) {
					return false;
				}
			}
			else {
				switch (operator) {
				case '$gt':
					if (datum <= operand.toString().toLowerCase()) {
						return false;
					}
					break;

				case '$gte':
					if (datum < operand.toString().toLowerCase()) {
						return false;
					}
					break;

				case '$lt':
					if (datum >= operand.toString().toLowerCase()) {
						return false;
					}
					break;

				case '$lte':
					if (datum > operand.toString().toLowerCase()) {
						return false;
					}
					break;

				case '$in':
					if (!_.isArray(operand)) {
						throw new DataViewError('Invalid filter spec, operator "$in" for column "' + colName + '" requires array value');
					}

					if (_.map(operand, function (elt) { return elt.toString().toLowerCase(); }).indexOf(datum) < 0) {
						return false;
					}
					break;

				case '$nin':
					if (!_.isArray(operand)) {
						throw new DataViewError('Invalid filter spec, operator "$nin" for column "' + colName + '" requires array value');
					}

					if (_.map(operand, function (elt) { return elt.toString().toLowerCase(); }).indexOf(datum) >= 0) {
						return false;
					}
					break;

				default:
					throw new DataViewError('Invalid operator "' + operator + '" for column "' + colName + '"');
				}
			}
		}

		return true;
	}

	// Checks to see if all filters from the spec pass on the given row.

	function passesAllFilters(row) {
		// Iterate over all elements in the filter spec, testing each in turn, until one fails.  Pass
		// the row along as "extra data" because that's what the predicate is actually testing.

		var passes = isNothing(self.filterSpec) ? true : eachUntilObj(self.filterSpec, passesFilter, false, row.rowData);

		if (self.eventHandlers.filter) {
			_.each(self.eventHandlers.filter, function (cb) {
				if (typeof cb === 'function') {
					cb(row.rowNum, !passes);
				}
			});
		}

		return passes;
	}

	/*
	if (self.data === undefined) {
		return self.getData(function () {
			return self.filter();
		});
	}
	else if (self.typeInfo === undefined) {
		return self.getTypeInfo(function () {
			return self.filter();
		});
	}
	else {
		self.timing.start(timingEvt);
		self.data = _.filter(self.data, passesAllFilters);
		self.timing.stop(timingEvt);
	}
	*/

	self.timing.start(timingEvt);
	self.data = _.filter(self.data.data, passesAllFilters);
	self.timing.stop(timingEvt);
};

// #setGroup {{{2

/**
 * Set the specification for how the data will be grouped.
 *
 * @param {object} spec
 *
 * @param {Array.<string>} spec.fieldNames
 *
 * @param {Function} spec.aggregate
 */

DataView.prototype.setGroup = function (spec) {
	var self = this;

	self.clearCache();
	self.groupSpec = spec;
	self.getData();
};

// #clearGroup {{{2

DataView.prototype.clearGroup = function () {
	var self = this;

	self.clearCache();
	delete self.groupSpec;
	self.getData();
};

// #group {{{2

DataView.prototype.group = function () {
	var self = this;

	if (self.groupSpec === undefined) {
		return;
	}

	var groupFields = self.groupSpec.fieldNames;

	// The variable `tree` contains all the rows of data, grouped according to the fields given, and
	// organized into a tree structure.
	//
	// Example
	// -------
	//
	// fieldNames = [Last Name, First Name]
	// A, B, C, ... = {row objects}
	//
	// tree = {
	//   Kennedy: {
	//     John: [A, B],
	//     Robert: [C, D],
	//     Ted: [E, F]
	//   },
	//   Roosevelt: {
	//     Franklin: [G, H],
	//     Teddy: [I, J]
	//   }
	// }
	//
	// {A,B,C,D,E,F}[Last Name] = Kennedy
	// {A,B}[First Name] = John
	// {C,D}[First Name] = Robert
	// {E,F}[First Name] = Ted

	var tree = (function RECUR(fieldNames, data) {
		var field = car(fieldNames)
			, tmp = {};

		// Assemble all the rows grouped by value for the current field.

		_.each(data, function (row) {
			var value = row.rowData['_ORIG_' + field] || row.rowData[field];

			if (tmp[value] === undefined) {
				tmp[value] = [];
			}

			tmp[value].push(row);
		});

		if (fieldNames.length > 1) {
			_.each(tmp, function (groupedRows, value) {
				tmp[value] = RECUR(cdr(fieldNames), groupedRows);
			});
		}

		return tmp;
	})(self.groupSpec.fieldNames, self.data.data);

	debug.info('DATA VIEW // GROUP', 'Tree Form: %O', tree);

	var rowVals = [];
	var newData = [];

	// Convert the tree structure above into linear structure.  The advantage of the linear structure
	// is that everything is associated by index.
	//
	// Example
	// -------
	//
	// tree = < AS ABOVE >
	//
	// rowVals = [[Kennedy, John], [Kennedy, Robert], [Kennedy, Ted],
	//            [Roosevelt, Franklin], [Roosevelt, Teddy]]
	//
	// newData = [[A, B], [C, D], [E, F],
	//            [G, H], [I, J]]
	//
	// newData[2][1] = F
	// rowVals[2] = [Kennedy, Ted]
	// fieldNames[0] = Last Name  -> newData[2][1][Last Name]  = Kennedy
	// fieldNames[1] = First Name -> newData[2][1][First Name] = Ted

	(function RECUR(tree, level, path) {
		if (level === self.groupSpec.fieldNames.length) {
			_.each(_.keys(tree).sort(), function (value) {
				var rows = tree[value];
				rowVals.push(path.concat([value]));
				newData.push(rows);
			});
		}
		else {
			_.each(tree, function (subtree, value) {
				RECUR(subtree, level + 1, path.concat([value]));
			});
		}
	})(tree, 1, []);

	debug.info('DATA VIEW // GROUP', 'Row Vals: %O', rowVals);
	debug.info('DATA VIEW // GROUP', 'New Data: %O', newData);

	self.data.isPlain = false;
	self.data.isGroup = true;
	self.data.groupFields = groupFields;
	self.data.rowVals = rowVals;
	self.data.data = newData;
};

// #setPivot {{{2

DataView.prototype.setPivot = function (spec) {
	var self = this;

	self.clearCache();
	self.pivotSpec = spec;
	self.getData();
};

// #clearPivot {{{2

DataView.prototype.clearPivot = function () {
	var self = this;

	self.clearCache();
	delete self.pivotSpec;
	self.getData();
};

// #pivot {{{2

DataView.prototype.pivot = function () {
	var self = this;

	if (self.pivotSpec === undefined) {
		return;
	}

	var pivotFields = self.pivotSpec.fieldNames;
	var colValsTree = {};

	_.each(self.data.data, function (groupedRows) {
		(function RECUR(fieldNames, data, tree) {
			var field = car(fieldNames)
				, tmp = {};

			_.each(data, function (row) {
				var value = row.rowData['_ORIG_' + field] || row.rowData[field];

				if (tree[value] === undefined) {
					tree[value] = fieldNames.length > 1 ? {} : true;
				}

				if (tmp[value] === undefined) {
					tmp[value] = [];
				}

				tmp[value].push(row);
			});

			if (fieldNames.length > 1) {
				_.each(tmp, function (pivottedRows, value) {
					RECUR(cdr(fieldNames), pivottedRows, tree[value]);
				});
			}
		})(pivotFields, groupedRows, colValsTree);
	});

	colVals = [];

	(function RECUR(tree, level, path) {
		if (level === self.pivotSpec.fieldNames.length) {
			_.each(_.keys(tree).sort(), function (value) {
				colVals.push(path.concat([value]));
			});
		}
		else {
			_.each(tree, function (subtree, value) {
				RECUR(subtree, level + 1, path.concat([value]));
			});
		}
	})(colValsTree, 1, []);

	_.each(self.data.data, function (groupedRows, groupNum) {
		var newData = [];
		_.each(colVals, function (colValSet) {
			var tmp = [];
			_.each(groupedRows, function (row) {
				if (_.every(colValSet, function (colVal, colValNum) {
					console.log(colValNum, pivotFields[colValNum], colVal);
					return colVal === (row.rowData['_ORIG_' + pivotFields[colValNum]] || row.rowData[pivotFields[colValNum]]);
				})) {
					tmp.push(row);
				}
			});
			newData.push(tmp);
		});
		self.data.data[groupNum] = newData;
	});

	debug.info('DATA VIEW // PIVOT', 'Col Vals Tree: %O', colValsTree);
	debug.info('DATA VIEW // PIVOT', 'Col Vals: %O', colVals);
	debug.info('DATA VIEW // PIVOT', 'New Data: %O', self.data);

	self.data.isPivot = true;
	self.data.pivotFields = pivotFields;
	self.data.colVals = colVals;
};

// #getData {{{2

/**
 * Retrieves a fresh copy of the data for this view from the data source.
 *
 * @param {function} cont What to do next.
 */

DataView.prototype.getData = function (cont, tries) {
	var self = this;

	if (tries === undefined) {
		tries = 1;
	}

	if (tries === 5) {
		throw new DataViewError('I appear to be stuck in an infinite loop (maximum try limit reached)');
	}

	if (self.data === undefined) {
		self.wcgrid.setSpinner('working');
		self.wcgrid.showSpinner();

		return self.source.getData(function (data) {
			return self.source.getTypeInfo(function (typeInfo) {
				self.data = {
					isPlain: true,
					isGroup: false,
					isPivot: false,
					data: _.map(data, function (rowData, rowNum) { return { rowNum: rowNum, rowData: rowData }; })
				};

				self.typeInfo = typeInfo;

				self.filter();
				self.group();
				self.pivot();
				self.sort();

				return self.getData(cont, tries + 1);
			});
		});
	}

	debug.info('DATA VIEW', 'Got data: %O', self.data);

	self.wcgrid.hideSpinner();
	self.wcgrid.updateRowCount(self.getRowCount(), self.isFiltered() ? self.getTotalRowCount() : undefined);

	if (typeof cont === 'function') {
		return cont(self.data);
	}
};

// #getTypeInfo {{{2

DataView.prototype.getTypeInfo = function (cont) {
	var self = this;

	if (self.typeInfo === undefined) {
		return self.source.getTypeInfo(function (typeInfo) {
			self.typeInfo = typeInfo;
			return self.getTypeInfo(cont);
		});
	}

	if (typeof cont === 'function') {
		return cont(self.typeInfo);
	}
};

// #clearCache {{{2

DataView.prototype.clearCache = function () {
	this.data = undefined;
	this.dataGrouped = undefined;
	this.typeInfo = undefined;
};

// #reset {{{2

/**
 * Reset the view to reflect the data source with no transformations.  This is the same as calling
 * all the "clear" functions.
 */

DataView.prototype.reset = function (dontNotify) {
	var self = this;

	self.clearCache();
	self.clearSort(true);
	self.clearFilter(true);

	if (!dontNotify) {
		self.publish(DataView.messages.RESET, {
			rowCount: self.source.cache.data.length
		});
	}
};

// .messages {{{2

DataView.messages = {
	FILTERED: 'FILTERED',
	SORTED: 'SORTED',
	GROUPED: 'GROUPED',
	RESET: 'RESET'
};

// #subscribe {{{2

/**
 * Subscribe to events on this data source.  This mechanism is used to notify clients that they need
 * to refresh their display after a data update.
 */

DataView.prototype.subscribe = function (f) {
	var self = this;

	self.subscribers.push(f);
};

// #publish {{{2

/**
 * Notify all subscribers of a message.
 *
 * @param {string} msg The message to send to all subscribers.
 * @param {...string} rest Additional arguments to pass to the subscribers.
 */

DataView.prototype.publish = function () {
	var self = this;
	var args = Array.prototype.slice.call(arguments);

	args.unshift(self);

	debug.info('DATA VIEW // PUBLISH', 'Sending message "%s" from data view: %O', args[1], args.slice(2));

	_.each(self.subscribers, function (f) {
		f.apply(null, args);
	});
};

// Exports {{{1

window.MIE = window.MIE || {};

window.MIE.ParamInput = ParamInput;
window.MIE.ParamInputError = ParamInputError;
window.MIE.DataSource = DataSource;
window.MIE.DataSourceError = DataSourceError;
