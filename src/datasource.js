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
		throw self.error(new FilterError('Missing configuration object for JSON grid parameter.'));
	}

	if (isNothing(self.json.name) || self.json.name === '') {
		throw self.error(new FilterError('Missing constraint set name for JSON grid parameter.'));
	}

	if (isNothing(self.json.column) || self.json.column === '') {
		throw self.error(new FilterError('Missing column name for JSON grid parameter.'));
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

var LocalDataSource = function (varName) {
	var self = this;

	self.varName = varName;
	self.cache = {};
};

// #getData {{{2

LocalDataSource.prototype.getData = function (params, cont) {
	var self = this
	, localData;

		localData = window[self.varName];

		if (isNothing(localData)) {
	throw self.error(new InvalidSourceError('Local variable "' + self.varName + '" does not exist.'));
		}

		if (!_.isArray(localData.data)) {
	throw self.error(new InvalidSourceError(self.varName + '.data is not an array.'));
		}

		if (isNothing(localData.typeInfo)) {
	self.warning('No type information found in local data (' + self.varName + '.typeInfo is missing).');
		}
		else if (isNothing(localData.typeInfo.byName) || isNothing(localData.typeInfo.byIndex)) {
	self.warning('Incomplete type information found in local data (either ' + self.varName + '.typeInfo.byName or ' + self.varName + '.typeInfo.byIndex is missing).');
		}

	return cont(localData.data);
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
		throw new Error('Unsupported data source type: ' + self.type);
	}

	self.source = new DataSource.sources[self.type](spec);

	self.locks.getData = new Lock();
};

// .sources {{{2

/**
 * A map of source types to the classes that implement them.
 */

DataSource.sources = {
	local: LocalDataSource
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

	if (!_.isArray(data)) {
		self.error('Error retrieving data');
	}

	debug.info('DATA SOURCE // POST-PROCESSING', 'Beginning post-processing');

	// The report definition can include a pre-processing step to convert the data manually.

	if (self.conversion) {
		data = self.conversion(data);
	}

	self.getTypeInfo(function (typeInfo) {
		_.each(data[0], function (sample, colName) {
			var sqlType = getProp(typeInfo, 'byName', colName);
			var looksLikeType = 'undetermined';
			var convertFn = null;
			// concatLog.info('[CONVERSION] Column =', colName, '; Type =', sqlType, '; Sample =', sample);
			// Often times, number columns in the result set have a string type.  Check the first row and
			// see if it looks like a number.  If it does, then set that as the type.  We don't check all
			// the rows because that would be inefficient, but because of that, this little trick is
			// occasionally wrong.
			if (sqlType === 'number') {
				if (self.guessColumnTypes && isInt(sample)) {
					looksLikeType = 'int';
					convertFn = tryIntConvert;
				}
				else if (self.guessColumnTypes && isFloat(sample)) {
					looksLikeType = 'float';
					convertFn = tryFloatConvert;
				}
			}
			else if (sqlType === 'string') {
				if (self.guessColumnTypes && isInt(sample)) {
					looksLikeType = 'int';
					convertFn = tryIntConvert;
				}
				else if (self.guessColumnTypes && isFloat(sample)) {
					looksLikeType = 'float';
					convertFn = tryFloatConvert;
				}
				else {
					// If we're doing a jQWidgets grid for the output, then we need to do more than just make a
					// link... so we'll handle that later, after we've started to set up the grid.
					convertFn = linkConvert;
				}
			}
			else if (sqlType === 'date') {
				convertFn = makeChain(removeZeroDates, addTimeComponent);
			}
			else if (sqlType === 'datetime') {
				convertFn = makeChain(removeZeroDateTimes, addTimeComponent);
			}
			if (convertFn !== null) {
				//debug.info('CONVERSION', 'Converting column "' + colName + '" (source type = ' + sqlType + ', looks like = ' + looksLikeType + ')');
				_.each(data, function (row) {
					row[colName] = convertFn(row[colName], row, colName, null);
				});
			}
		});

		// Check to see if we're supposed to sort this data.

		if (_.isObject(self.sort)) {
			return sort(data, self.sort, cont);
		}
		else {
			return cont(data);
		}
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

	switch (self.typeInfo.byName[self.sortSpec.col]) {
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

	if (self.data[0].rowData['_ORIG_' + self.sortSpec.col] !== undefined) {
		self.sortSpec.col = '_ORIG_' + self.sortSpec.col;
	}

	var sorted = mergeSort2(self.data, function (a, b) {
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

	// Parameters (DELETE) {{{1
	function getParamValue(id, inputName, type) {
		var form = id ? document.getElementById(id) : null;
		var findInput = form ? function (s) {
			return jQuery(form).find(s);
		} : jQuery;
		switch (type) {
			case 'text':
				return findInput('input[name="' + inputName + '"]').val();
			case 'date':
				return getDate(inputName);
			case 'checkbox':
				return _.map(findInput('input[name="' + inputName + '"]:checkbox:checked'), function (x) {
					return jQuery(x).val();
				});
			case 'select':
				return findInput('select[name="' + inputName + '"]').val();
			case 'autocomplete':
				return new NotImplementedError();
			case 'multi-autocomplete':
				return _.map(findInput('input[name="' + inputName + '"]'), function (x) {
					return jQuery(x).val();
				});
			default:
				throw 'Invalid parameter specification: unknown input type "' + type + '"';
		}
	}
	/**
	 * Get a date from one of our date inputs in YYYY-mm-dd format. I thought
	 * normally there was a hidden input element that stored the complete date,
	 * but I can't find it.
	 *
	 * @param name Name of the hidden input that holds the complete date. The
	 * names of the individual year, month, and day fields are derived from this.
	 *
	 * @return The date in the form "YYYY-mm-dd" or the empty string if all of the
	 * date fields are missing (the latter behavior is so that you can just pass
	 * the result of getDate() as an HTTP parameter for running the report, and
	 * the parameter will be effectively unset as a filter).
	 */
	function getDate(name) {
		var x = _.map(['YEAR', 'MONTH', 'DAY'], function (elt) {
			return jQuery('[name="' + name + elt + '"]')[0].value;
		}).join('-');
		return x === '--' ? '' : x;
	}
	/**
	 * Converts a specification of the parameters to be used from the user input
	 * elements in the page into an object that contains the values for those
	 * inputs which the user has supplied. The input is an array of objects, with
	 * the following properties:
	 *
	 * - paramName: the name of the HTTP parameter
	 * - type: kind of input item
	 *   + autocomplete
	 *   + checkbox
	 *   + date
	 *   + multi-autocomplete
	 *   + select
	 *   + text
	 * - inputName (optional): the name of the input
	 */
	function getParamsFromPage(config) {
		var result = {};
		_.each(config, function (elt) {
			if (!_.isString(elt.paramName) || !_.isString(elt.type)) {
				throw 'Invalid parameter specification: strings for "paramName" and "type" required';
			}
			_.defaults(elt, {
				inputName: elt.paramName
			});
			result[elt.paramName] = getParamValue(null, elt.inputName, elt.type);
			if (elt.required && (result[elt.paramName] === '' || result[elt.paramName] === [])) {
				throw new MissingRequiredParameterError(elt.paramName);
			}
		});
		return result;
	}
	/**
	 * Get parameter values out of the page to show to the user. These are
	 * displayed near the graph to indicate what filters are currently in effect
	 * for rendering the results.
	 */
	function getParamsFromPageToDisplay(config) {
		var result = {
			arr: [],
			obj: {}
		};

		var parentText = function (x) {
			return jQuery(x).parent().text();
		};

		_.each(config, function (elt, i) {
			var value = null;

			if (!_.isString(elt.paramName) || !_.isString(elt.type)) {
				throw 'Invalid parameter specification: strings for "paramName" and "type" required';
			}

			_.defaults(elt, {
				inputName: elt.paramName,
				displayName: elt.paramName
			});

			switch (elt.type) {
				case 'autocomplete':
					break;

				case 'multi-autocomplete':
					value = _.map(jQuery('input[name="' + elt.inputName + '"]'), parentText);
					break;

				default:
					value = getParamValue(null, elt.inputName, elt.type);
			}

			if (value !== null) {
				result.obj[elt.displayName] = value;
				result.arr[i] = {
					displayName: elt.displayName,
					value: value
				};
			}
		});

		return result;
	}
	/*
	 * This function is meant to be useful from the graph definition itself, to
	 * change substitute another source for a parameter with the same name.
	 *
	 * Example:
	 *
	 * replaceParams(params, {
	 *   start_date: {type: 'date', inputName: 'start_date2'},
	 *   end_date: {type: 'date', inputName: 'end_date2'}
	 * })
	 *
	 * This will replace the 'start_date' and 'end_date' parameters in the
	 * parameter object with ones that are sourced from different inputs.
	 */
	function replaceParams(original, xform) {
		return _.union(_.reject(original, function (elt) {
			return _.contains(_.keys(xform), elt.paramName);
		}), _.map(xform, function (val, key) {
			return _.extend(val, {
				paramName: key
			});
		}));
	}

	/*
	 * http://stackoverflow.com/questions/979975/how-to-get-the-value-from-the-url-parameter
	 */

	function getParamsFromUrl() {
		var params = {};
		var query = window.location.search.substring(1);
		var vars = query.split("&");
		var pair;
		var arr;

		for (var i = 0; i < vars.length; i += 1) {
			pair = vars[i].split('=');
			if (typeof params[pair[0]] === 'undefined') {
				params[pair[0]] = decodeURIComponent(pair[1]);
			}
			else {
				if (typeof params[pair[0]] === 'string') {
					params[pair[0]] = [params[pair[0]]];
				}

				params[pair[0]].push(decodeURIComponent(pair[1]));
			}
		}

		return params;
	}

	// Data Sources (DELETE) {{{1

	/**
	 * Produce a data object as one would normally get from a system report by
	 * scraping a listview already in the page.
	 */
	function DataSource_Table_Functor(type) {
		var columnSelector; // fun(name) -> selector, used to get the names of the columns
		var dataSelector; // fun(name) -> selector, used to get the data values
		switch (type) {
			default: columnSelector = function (name) {
				return 'div[id="lv_' + name + '_span"] table tbody:eq(0) tr th a font';
			};
			dataSelector = function (name) {
				return 'div[id="lv_' + name + '_span"] table tbody:eq(1) tr td font';
			};
			break;
		}
		return function (name) {
			var columns = getText(columnSelector(name)),
				data = getText(dataSelector(name)),
				row, col, newData = [],
				newObj;
			// The data we got from the table is in this format: [1A, 1B, 1C, 2A, 2B, 2C ...]
			// We want it to be in this format: [{1A, 1B, 1C}, {2A, 2B, 2C}, ...]
			// The following code does that conversion.
			for (row = 0; row < data.length / columns.length; row += 1) {
				newObj = {};
				for (col = 0; col < columns.length; col += 1) {
					newObj[columns[col]] = data[row * columns.length + col];
				}
				newData.push(newObj);
			}
			return newData;
		};
	}

	/*
	 * Operations to perform directly after the data has been obtained.  These
	 * include sanity/validity checks (to make sure no errors occurred and that
	 * the information we obtained is really data) and post-processing steps.
	 * Assuming that everything goes OK, the callback will get passed the actual
	 * data object.
	 */

	function DataSource_After(defn, source, data, callback) {
		if (!_.isArray(data)) {
			defn.error('Error retrieving data');
		}
		// The report definition can include a pre-processing step to convert
		// the data manually.
		if (source.conversion) {
			data = source.conversion(data);
		}

		// Check to see if we're supposed to sort this data.
		if (_.isObject(source.sort)) {
			return sort(data, source.sort, callback);
		}
		else {
			return callback(data);
		}
	}

	function DataSource_Report_DecodeXml(defn, data) {
		var newData;
		var typeInfo = {
			byIndex: [],
			byName: {}
		};
		try {
			var dataContainer = miexml.xmlNodeToObjectGeneric(data.childNodes[0].childNodes[0]);
			if (dataContainer.WARNING) {
				log.warn('System report warning: ' + dataContainer.WARNING[0].message);
				newData = [];
			}
			else {
				newData = dataContainer.RECORD;
			}
		}
		catch (e) {
			// If MIE's XML library can't convert the data, rather than
			// letting it throw an error, just assume there's no results.
			log.warn('Unable to decode XML. Maybe there\'s no results, or there was an error.');
			newData = [];
		}
		return {
			data: newData,
			typeInfo: typeInfo
		};
	}

	function DataSource_Report_DecodeJson(defn, data) {
		var newData = [];
		var typeInfo = {
			byIndex: [],
			byName: {}
		};
		if (_.isUndefined(data.results)) {
			throw defn.error('System report result data format: missing "results" property');
		}
		var results = data.results;
		if (results.error) {
			throw defn.error(new ReportRunError(results.error));
		}
		if (_.isUndefined(results.columns) || _.isUndefined(results.rows)) {
			throw defn.error('System report result data format: missing "columns" or "rows" property');
		}
		for (var c = 0; c < results.columns.length; c += 1) {
			typeInfo.byIndex[c] = results.columns[c];
			typeInfo.byName[results.columns[c].name] = results.columns[c].type;
		}
		for (var r = 0; r < results.rows.length; r += 1) {
			newData[r] = {};
			for (c = 0; c < results.rows[r].length; c += 1) {
				if (_.isUndefined(results.columns[c])) {
					throw defn.error('System report result: no column data for column #' + c);
				}
				else {
					newData[r][results.columns[c].name] = results.rows[r][c];
				}
			}
		}
		return {
			data: newData,
			typeInfo: typeInfo
		};
	}

	/**
	 * Get data from JavaScript.  This can either be directly from the source object, or it can come
	 * from a JavaScript variable (the latter method mostly used by the <wcgrid> layout tag).
	 */

	function DataSource_Local(defn, source, cont) {
		var localData;

		if (source.varName) {
			localData = window[source.varName];

			if (isNothing(localData)) {
				throw defn.error(new InvalidSourceError('Local variable "' + source.varName + '" does not exist.'));
			}

			if (!_.isArray(localData.data)) {
				throw defn.error(new InvalidSourceError(source.varName + '.data is not an array.'));
			}

			if (isNothing(localData.typeInfo)) {
				defn.warning('No type information found in local data (' + source.varName + '.typeInfo is missing).');
			}
			else if (isNothing(localData.typeInfo.byName) || isNothing(localData.typeInfo.byIndex)) {
				defn.warning('Incomplete type information found in local data (either ' + source.varName + '.typeInfo.byName or ' + source.varName + '.typeInfo.byIndex is missing).');
			}

			return cont({
				data: localData.data,
				typeInfo: localData.typeInfo
			});
		}
		else {
			if (!_.isArray(source.data)) {
				throw defn.error(new InvalidSourceError('source.data is not an array.'));
			}

			if (isNothing(source.typeInfo)) {
				defn.warning('No type information found in local data (source.typeInfo is missing).');
			}
			else if (isNothing(source.typeInfo.byName) || isNothing(source.typeInfo.byIndex)) {
				defn.warning('Incomplete type information found in local data (either source.typeInfo.byName or source.typeInfo.byIndex is missing).');
			}
			cont({
				data: source.data,
				typeInfo: source.typeInfo
			});
		}
	}

	function DataSource_Report_AddJsonParam(defn, obj, fltr) {
		var operand;

		if (isNothing(fltr.json)) {
			throw defn.error('Missing configuration object for JSON grid parameter.');
		}

		if (isNothing(fltr.json.name) || fltr.json.name === '') {
			throw defn.error('Missing constraint set name for JSON grid parameter.');
		}

		if (isNothing(fltr.json.column) || fltr.json.column === '') {
			throw defn.error('Missing column name for JSON grid parameter.');
		}

		if (isNothing(fltr.json.operator) || fltr.json.operator === '') {
			fltr.json.operator = '$eq';
		}

		var name = fltr.json.name;
		var column = fltr.json.column;
		var operator = fltr.json.operator;

		// When there's no value, remove it from the JSON object that we might have already constructed
		// (e.g. if loading the grid a second time) and make sure we don't end up with any empty stuff.

		if (fltr.value === null || (fltr.type === 'date' && fltr.value === '') || (fltr.type === 'multi-autocomplete' && fltr.value.length === 0)) {
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

		if (_.isArray(fltr.json.operand)) {
			operand = arrayCopy(fltr.json.operand);
			_.each(operand, function (elt, i) {
				if (_.isArray(elt) && elt.length === 0) {
					operand[i] = fltr.value;
				}
			});
		}
		else {
			operand = isNothing(fltr.json.operand) ? fltr.value : fltr.json.operand;
		}

		setProp(operand, obj, name, column, operator);
	}

	/**
	 * Get data by running a system report.
	 *
	 * The following properties affect how this data source works:
	 *
	 *   - name: The name of the report to run.
	 *   - filterSet: A filterSet to apply to the report, modifying its results.
	 *   - params: An object representing parameters for the report; lower priority than "filterSet."
	 *   - explain: If true, then the data is the result of explaining the report, not running it.
	 *   - where: An object representing the JSON WHERE clause which may be inserted into the report.
	 *   - having: An object representing the JSON HAVING clause which may be inserted into the report.
	 *   - orderBy: An object representing the JSON ORDER BY clause which will be appended to the report.
	 *   - format: Response format for running the report, either "json" or "xml."
	 */
	function DataSource_Report(defn, source, cont, sourceIdx, getSource, sources, dataAcc, typeInfoAcc) {
		var params = {};

		if (source.passThroughParams) {
			_.extend(params, getParamsFromUrl());
		}

		if (_.isObject(source.filterSet)) {
			var filters = source.filterSet.filters;
			filters = _.isFunction(filters) ? filters() : filters;
			if (!_.isArray(filters)) {
				defn.error('err');
			}

			_.each(source.filterSet.filters, function (fltr) {
				if (fltr.method === undefined || fltr.method === 'cgi') {
					params[fltr.paramName] = fltr.value;
				}
				else if (fltr.method === 'json_where') {
					source.where = source.where || {};
					DataSource_Report_AddJsonParam(defn, source.where, fltr);
				}
				else if (fltr.method === 'json_having') {
					source.having = source.having || {};
					DataSource_Report_AddJsonParam(defn, source.having, fltr);
				}
			});
		}
		else if (source.params) {
			if (_.isArray(source.params)) {
				try {
					_.extend(params, getParamsFromPage(source.params));
				}
				catch (e) {
					if (e instanceof MissingRequiredParameterError) {
						var identity = (defn.name ? defn.name : 'Unknown Graph') + ' / ' + source.name + ' (Source #' + (sourceIdx + 1) + ')';
						log.warn(identity + ': ' + e.message);
						// Skip the current source and go to the next one.
						return getSource(_.rest(sources), sourceIdx + 1, dataAcc, typeInfoAcc);
					}
					else {
						defn.error(e);
					}
				}
			}
			else if (_.isObject(source.params)) {
				// It's an object, which means that the user can be specifying the
				// additional parameters to send in two different ways:
				//
				// [1] If the value is a string, then that is the value of the
				//     parameter.  It's a literal interpretation.
				//
				// [2] If the value is an object, then we treat it as we treated
				//     the parameters above when they were inside an array.
				//
				// We have to process each parameter in isolation, because they
				// may be mixed.  It's a pity that this confusion replaced the
				// rather simple merging of one object into another, but this is a
				// little more friendly to the user.
				_.each(source.params, function (v, k) {
					if (_.isString(v)) {
						params[k] = v;
					}
					else if (_.isObject(v)) {
						try {
							_.extend(v, {
								paramName: k
							});
							params[k] = getParamsFromPage([v]);
						}
						catch (e) {
							if (e instanceof MissingRequiredParameterError) {
								var ident = (defn.name ? defn.name : 'Unknown Graph') + ' / ' + source.name + ' (Source #' + (sourceIdx + 1) + ')';
								log.warn(ident + ': ' + e.message);
								// Skip the current source and go to the next one.
								return getSource(_.rest(sources), sourceIdx + 1, dataAcc, typeInfoAcc);
							}
							else {
								defn.error(e);
							}
						}
					}
					else {
						// The value wasn't a string, and it wasn't an object.  I
						// don't know what you want me to do with this.
						log.warn('Unknown parameter definition format: [', k, '] = ', v);
					}
				});
			}
		}

		_.extend(params, {
			f: 'ajaxget',
			s: source.explain ? 'explain_system_report' : 'run_system_report',
			report_name: source.name,
			WC_DATE_FORMAT: '%Y-%m-%d'
		});

		source._params = params;

		/*
		 * Insert the user's JSON WHERE clause into the parameters we're going to send to the server
		 * with the AJAXGET request.  This constructs a SQL WHERE clause to append onto the report, to
		 * limit the data that the report returns to us.  Validation of the object is up to the server -
		 * we're not going to bother with that here.
		 */
		if (!_.isUndefined(source.where)) {
			if (_.isObject(source.where)) {
				params.report_json_where = JSON.stringify(source.where);
			}
			else {
				log.warn('Invalid format for defn.source[].where: ', source.where);
			}
		}
		/*
		 * Insert the user's JSON HAVING clause into the parameters we're going to send to the server
		 * with the AJAXGET request.  This constructs a SQL HAVING clause to append onto the report, to
		 * limit the data that the report returns to us.  Validation of the object is up to the server -
		 * we're not going to bother with that here.
		 */
		if (!_.isUndefined(source.having)) {
			if (_.isObject(source.having)) {
				params.report_json_having = JSON.stringify(source.having);
			}
			else {
				log.warn('Invalid format for defn.source[].having: ', source.having);
			}
		}
		if (!_.isUndefined(source.orderBy)) {
			if (_.isArray(source.orderBy)) {
				params.report_json_orderby = JSON.stringify(source.orderBy);
			}
			else {
				log.warn('Invalid format for defn.source[].orderBy: ', source.orderBy);
			}
		}
		if (getProp(defn, 'server', 'filter') || getProp(defn, 'server', 'sort')) {
			params.report_limit = getProp(defn, 'server', '_limit');
			if (params.report_limit === undefined) {
				params.report_limit = getProp(defn, 'server', 'limit');
			}
		}
		/*
		 * Figure out how we should be getting this data back: as XML or as JSON.  The default is
		 * JSON, but originally the AJAXGET for running a system report only supported XML.
		 */
		if (_.isUndefined(source.format)) {
			source.format = 'json';
		}
		else if (source.format !== 'json' && source.format !== 'xml') {
			defn.error(new InvalidReportDefinitionError('source.format', source.format, 'must be either "json" or "xml" (or unset)'));
		}
		params.response_format = source.format;
		jQuery.ajax({
			url: 'webchart.cgi',
			dataType: source.format,
			data: params,
			traditional: true,
			success: function (response) {
				var decoded;

				switch (source.format) {
					case 'json':
						decoded = DataSource_Report_DecodeJson(defn, response);
						break;
					case 'xml':
						decoded = DataSource_Report_DecodeXml(defn, response);
						break;
					default:
						throw defn.error(new InvalidReportDefinitionError('source.format', source.format, 'must be either "json" or "xml" (or unset)'));
				}

				DataSource_After(defn, source, decoded.data, function (data) {
					cont({
						data: data,
						typeInfo: decoded.typeInfo
					});
				});
			},
			error: function (jqXHR, status, error) {
				throw defn.error(error);
			}
		});
	}

	/**
	 * Get data from a table already in the page.
	 */

	function DataSource_Table(defn, source, cont, sourceIdx, getSource, sources, dataAcc, typeInfoAcc) {
		if (!source.subtype || !source.table.id) {
			throw defn.error('Report definition missing subtype and/or ID for table source');
		}
		var data = DataSource_Table_Functor(source.subtype)(source.table.id);
		DataSource_After(defn, source, data, function (data) {
			dataAcc.push(data);
			typeInfoAcc.push({});
			getSource(_.rest(sources), sourceIdx + 1, dataAcc, typeInfoAcc);
		});
	}

	/**
	 * Convert the MySQL type reported by the Model (e.g. JSON API request db/model/object=[whatever])
	 * into a type that we can use for displaying stuff in a grid.
	 */

	function translateMysqlType(mysqlType) {
		switch (mysqlType) {
		case 'bit':
		case 'tinyint':
		case 'bool':
		case 'boolean':
		case 'smallint':
		case 'mediumint':
		case 'int':
		case 'integer':
		case 'bigint':
		case 'decimal':
		case 'dec':
		case 'float':
		case 'double':
		case 'year':
			return 'number';
		case 'date':
			return 'date';
		case 'datetime':
		case 'timestamp':
			return 'datetime';
		case 'time':
			return 'time';
		case 'char':
		case 'varchar':
		case 'binary':
		case 'tinyblob':
		case 'blob':
		case 'text':
		case 'mediumblob':
		case 'mediumtext':
		case 'longblob':
		case 'longtext':
		case 'enum':
		case 'set':
			return 'string';
		default:
			return 'string';
		}
	}

	function DataSource_JsonApi_GetMetadata(what, cont) {
		mieapi.get('db/model', {object: what}, function (modelData) {
			var typeInfo
				, displayName = {};

			if (getProp(modelData, 'meta', 'status') !== '200') {
				return cont(null, null);
			}

			typeInfo = {
				byName: {},
				byIndex: [],
				internal: {}
			};

			_.each(modelData.db, function (colInfo) {
				typeInfo.byName[colInfo.field] = translateMysqlType(colInfo.data_type);
				typeInfo.byIndex.push(translateMysqlType(colInfo.data_type));
				typeInfo.internal[colInfo.field] = colInfo.ctype;
				displayName[colInfo.field] = colInfo.label;
			});

			return cont(typeInfo, displayName);
		});
	}

	/**
	 * Get data from the JSON API.
	 */

	function DataSource_JsonApi(defn, source, cont) {
		var params;

		if (isNothing(source.resource)) {
			throw defn.error('Source object (type = "json_api") missing required property: "resource"');
		}

		if (!isNothing(source.params)) {
			if (_.isString(source.params)) {
				params = source.params;
			}
			else if (_.isObject(source.params)) {
				params = jQuery.params(source.params);
			}
		}

		mieapi.get(source.resource, params, function (data) {
			var regexp, match;

			// When there is a problem using the JSON API, just treat it as no data.

			if (getProp(data, 'meta', 'status') !== '200') {
				return cont({data: []});
			}

			// Check to see if we accessed a table directly using the JSON API.  If that's true, we can
			// easily use the model to get some metadata about it (column type, etc).

			regexp = new RegExp('^db/(.*)$');
			match = regexp.exec(source.resource);

			if (match !== null) {

				// Query the type information from the model and attach it to the data that we've retrieved.
				// This is the only way to retrieve type information for data obtained using the JSON API.

				return DataSource_JsonApi_GetMetadata(match[1], function (typeInfo, displayName) {
					return cont({
						data: data.db,
						typeInfo: typeInfo,
						displayName: displayName
					});
				});
			}

			// Continue using exactly the data we obtained and nothing else.

			return cont({data: data.db});
		});
	}

	var dataSource = {
		local: DataSource_Local,
		report: DataSource_Report,
		table: DataSource_Table,
		json_api: DataSource_JsonApi
	};


	// Data Acquisition (DELETE) {{{1

	/**
	 * Checks the continuation predicate of a source based on the data that we just received.
	 *
	 * @param object defn The definition object.
	 * @param object source The source that we just finished fetching data for.
	 * @param array data The information we just fetched.
	 * @param array dataAcc Data from all sources accumulated so far.
	 *
	 * @returns bool True if the continue predicate passes (i.e. keep going), and false if it fails.
	 */

	function checkContinuePred(defn, source, data, dataAcc) {
		var keepGoing = true;
		if (_.isFunction(source.continuePred)) {
			keepGoing = false;
			try {
				keepGoing = source.continuePred(defn, data, dataAcc);
			}
			catch (e) {
				log.warn('Continuation predicate returned error: %O', e);
			}
		}
		return keepGoing;
	}

	function convertData(defn, data, typeInfo) {
		var guessColumnTypes = getProp(defn, 'table', 'guessColumnTypes');
		var tableOutput = getProp(defn, 'table', 'output', 'method');
		if (guessColumnTypes === undefined) {
			guessColumnTypes = true;
		}
		_.each(data[0], function (sample, colName) {
			var sqlType = getProp(typeInfo, 'byName', colName);
			var looksLikeType = 'undetermined';
			var convertFn = null;
			// concatLog.info('[CONVERSION] Column =', colName, '; Type =', sqlType, '; Sample =', sample);
			// Often times, number columns in the result set have a string type.  Check the first row and
			// see if it looks like a number.  If it does, then set that as the type.  We don't check all
			// the rows because that would be inefficient, but because of that, this little trick is
			// occasionally wrong.
			if (sqlType === 'number') {
				if (guessColumnTypes && isInt(sample)) {
					looksLikeType = 'int';
					convertFn = tryIntConvert;
				}
				else if (guessColumnTypes && isFloat(sample)) {
					looksLikeType = 'float';
					convertFn = tryFloatConvert;
				}
			}
			else if (sqlType === 'string') {
				if (guessColumnTypes && isInt(sample)) {
					looksLikeType = 'int';
					convertFn = tryIntConvert;
				}
				else if (guessColumnTypes && isFloat(sample)) {
					looksLikeType = 'float';
					convertFn = tryFloatConvert;
				}
				else if (tableOutput && tableOutput !== 'jqwidgets') {
					// If we're doing a jQWidgets grid for the output, then we need to do more than just make a
					// link... so we'll handle that later, after we've started to set up the grid.
					convertFn = linkConvert;
				}
			}
			else if (sqlType === 'date') {
				convertFn = makeChain(removeZeroDates, addTimeComponent);
			}
			else if (sqlType === 'datetime') {
				convertFn = makeChain(removeZeroDateTimes, addTimeComponent);
			}
			if (convertFn !== null) {
				debug.info('CONVERSION', 'Converting column "' + colName + '" (source type = ' + sqlType + ', looks like = ' + looksLikeType + ')');
				_.each(data, function (row) {
					row[colName] = convertFn(row[colName], row, colName, defn);
				});
			}
		});
	}

	/**
	 * @callback getData_callback A callback for the getData() function.
	 *
	 * @param {Array.<Array.<Object>>} data Data from all sources.
	 */

	/**
	 * Get the data that will be used to render a table or graph. This function DOES NOT attempt to
	 * cache the data - if you call it then it's assumed that you want to fetch the data afresh.
	 *
	 * @param object defn The graph definition to use for the source of the data.
	 *
	 * @param {getData_callback} callback A callback to execute after the data is retrieved. This
	 * function is called with the data object.
	 */

	function getData(defn, callback) {
		/*
		 * To twist our logic through callback-oriented programming, we're going to rely on a little
		 * Prolog trick to accumulate results. When we're out of sources to check, we'll call the real
		 * callback function with the accumulated data. These are all tail calls so if the JS compiler
		 * does TCO we'll have that benefit.
		 */

		function getSource(sources, sourceIdx, acc) {
			if (sources.length === 0) {
				// We've gone through all the sources that were provided, so we can continue with the "all
				// done" callback now.
				return callback(acc, sourceIdx);
			}
			var source = sources[0];
			if (dataSource[source.type]) {
				dataSource[source.type](defn, source, function (sourceResult) {
					var uniqElts = {};
					if (checkContinuePred(defn, source, sourceResult.data, acc.data)) {
						convertData(defn, sourceResult.data, sourceResult.typeInfo);
						// Determine the number of unique elements in each row of each column.  We will use this
						// later to determine what kind of user inputs to show (e.g. 10 or less different values
						// and we might show a dropdown instead of a text input).

						_.each(sourceResult.data, function (row) {
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

						acc.data.push(sourceResult.data);
						acc.typeInfo.push(sourceResult.typeInfo);
						acc.uniqElts.push(uniqElts);
						acc.displayName.push(sourceResult.displayName);
						getSource(sources.slice(1), sourceIdx + 1, acc);
					}
				}, sourceIdx, getSource, sources, acc.data, acc.typeInfo);
			}
		}

		if (isNothing(defn.source)) {
			throw defn.error('Data source not specified');
		}
		else if (defn.source instanceof DataSource) {
			return trulyYours(callback, [
				{fn: 'getData', prop: 'data', conv: makeArray},
				{fn: 'getUniqElts', prop: 'uniqElts', conv: makeArray},
				{fn: 'getTypeInfo', prop: 'typeInfo', conv: makeArray},
				{fn: 'getDisplayName', prop: 'displayName', conv: makeArray}
			], defn.source);
		}
		else {
			return getSource(_.isArray(defn.source) ? defn.source : [defn.source], 0, {
				data: [],
				typeInfo: [],
				uniqElts: [],
				displayName: []
			});
		}
	}
	/**
	 * Store the data retrieved from the system report (or wherever) inside the
	 * report definition itself.
	 */
	// If the report definition property 'dataSeries' is "multiple" then every
	// property (i.e. report column) will be changed to be ":{src}:{prop}" so that
	// later on we can use these to distinguish data from multiple sources in
	// multiple data series -- the first series will refer to data field ":0:asdf"
	// while the second will refer to data field ":1:asdf", etc.
	//
	// To provide a convenient mapping back to the original property names, we
	// also set defn._dataColumns to be a map from the modified property names
	// (i.e. ":{src}:prop") to the original names (just "prop"). Thus for the
	// above example we'd have:
	//
	// defn._data = [
	//   [{x: 0, ':0:asdf': 1}, {x: 1, ':0:asdf': 2}],
	//   [{x: 0, ':1:asdf': 8}, {x: 1, ':1:asdf': 9}]
	// ];
	//
	// defn._dataColsBySource = {
	//   ':0:asdf': {originalName: 'asdf', sourceIndex: 0},
	//   ':1:asdf': {originalName: 'asdf', sourceIndex: 1}
	// };
	//
	// We also store information about the "abstract" column names. This is used
	// to determine what source-specific properties could be referring to a
	// column. This is mostly used for filtering out certain columns when showing
	// the tabular data.
	//
	// defn._abstractDataCols = {
	//   'asdf': [':0:asdf', ':1:asdf']
	// };
	//
	// Then the following flattened data will be used to generate the graph.
	//
	// flattened = [
	//   {x: 0, ':0:asdf': 1, ':1:asdf': 8},
	//   {x: 1, ':0:asdf': 2, ':1:asdf': 9}
	// ];
	function storeDataInDefn(defn, data, typeInfo, uniqElts, displayName, cont) {

		// Make a new DataView if there isn't one already.

		if (defn.source instanceof DataSource && defn.view === undefined) {
			defn.view = new DataView(defn.source, defn);
		}

		if (!_.isString(defn.dataSeries)) {
			defn.dataSeries = 'single';
		}
		defn._typeInfo = typeInfo;
		defn._uniqElts = uniqElts;
		defn._displayName = displayName;
		if (defn.dataSeries === 'single') {
			if (defn.view !== undefined) {
				return defn.view.getData(function (data) {
					defn._data = [data];
					return cont();
				});
			}
			else {
				defn._data = data;
				return cont();
			}
		}
		defn._dataColsBySource = {};
		defn._abstractDataCols = {};
		defn._dataColsBySource[defn.graph.categories.field] = {
			originalName: defn.graph.categories.field
		};
		defn._abstractDataCols[defn.graph.categories.field] = [defn.graph.categories.field];
		for (var srcIndex = 0; srcIndex < data.length; srcIndex += 1) {
			for (var rowIndex = 0; rowIndex < data[srcIndex].length; rowIndex += 1) {
				// XXX
				_.each(data[srcIndex][rowIndex], function (v, k) {
					if (k !== defn.graph.categories.field) {
						var k2 = addSrcInfo(srcIndex, k);
						if (!defn._dataColsBySource[k2]) {
							defn._dataColsBySource[k2] = {
								originalName: k,
								sourceIndex: srcIndex
							};
							if (!defn._abstractDataCols[k]) {
								defn._abstractDataCols[k] = [];
							}
							defn._abstractDataCols[k].push(k2);
						}
						data[srcIndex][rowIndex][k2] = v;
						delete data[srcIndex][rowIndex][k];
					}
				});
			}
		}
		defn._data = data;
		return cont();
	}

	function sort(data, config, cont) {
		if (_.isFunction(config.compare)) {
			return mergeSort(data, config.compare, cont);
		}
		else if (_.isString(config.field) && _.isString(config.order)) {
			if (config.order.toUpperCase() !== 'ASC' && config.order.toUpperCase() !== 'DESC') {
				throw 'sort order must be either "asc" or "desc"';
			}

			var convert = null;

			if (config.type === 'integer') {
				convert = function (a) {
					return parseInt(a, 10);
				};
			}

			else if (config.type === 'float' || config.type === 'number') {
				convert = parseFloat;
			}

			var cmp = function(a, b) {
				if (typeof config.transform === 'function') {
					a = config.transform(a);
					b = config.transform(b);
				}

				a = a[config.field];
				b = b[config.field];

				if (convert !== null) {
					a = convert(a);
					b = convert(b);
				}

				return a === b ? 0 : (config.order.toUpperCase() === 'ASC' ? (a < b ? -1 : 1) : (a > b ? -1 : 1));
			};

			return mergeSort(data, cmp, cont);
		}
		throw 'either [compare] or [field, order] must be specified';
	}

// Exports {{{1

window.MIE = window.MIE || {};

window.MIE.ParamInput = ParamInput;
window.MIE.ParamInputError = ParamInputError;
window.MIE.DataSource = DataSource;
window.MIE.DataSourceError = DataSourceError;
