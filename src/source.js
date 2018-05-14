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
	self.dataType = spec.dataType;

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

	//debug.info('DATA SOURCE // HTTP // PARSER', 'Data = ' + ((data instanceof XMLDocument) ? '%o' : '%O'), data);

	if (data instanceof Document) {
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

		_.each(fields, function (f) {
			result.typeInfo.set(f, {
				type: 'string'
			});
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
			dataType: self.dataType,
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

// FileSource {{{1

var FileSource = function (spec, params, userTypeInfo, source) {
	var self = this;

	self.spec = spec;
	self.params = params;
	self.userTypeInfo = userTypeInfo;
	self.source = source;

	self.cache = {
		data: [],
		typeInfo: new OrdMap()
	};
};

// #setToolbar {{{2

FileSource.prototype.setToolbar = function (toolbar) {
	var self = this;

	var input = jQuery('<input>', { 'type': 'file', 'name': 'file', 'accept': '.csv' })
		.on('change', function () {
			Papa.parse(this.files.item(0), {
				header: true,
				skipEmptyLines: true,
				complete: function (results, file) {
					console.log(results);

					self.cache.data = results.data;
					self.cache.typeInfo = new OrdMap();

					_.each(results.meta.fields, function (field) {
						self.cache.typeInfo.set(field, {
							'type': 'string'
						});
					});

					self.source.clearCachedData();
				}
			});
		})
		.appendTo(toolbar);
};

// #setFile {{{2

FileSource.prototype.setFiles = function (files) {
	var self = this;

	if (!(files instanceof FileList)) {
		return;
	}

	Papa.parse(files.item(0), {
		header: true,
		skipEmptyLines: true,
		complete: function (results, file) {
			console.log(results);

			self.cache.data = results.data;
			self.cache.typeInfo = new OrdMap();

			_.each(results.meta.fields, function (field) {
				self.cache.typeInfo.set(field, {
					'type': 'string'
				});
			});

			self.source.clearCachedData();
		}
	});
};

// #getData {{{2

FileSource.prototype.getData = function (params, cont) {
	var self = this;

	return cont(self.cache.data);
};

// #getTypeInfo {{{2

FileSource.prototype.getTypeInfo = function (cont) {
	var self = this;

	return cont(self.cache.typeInfo);
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

	self.origin = new Source.sources[self.type](spec, params, userTypeInfo, self);

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
	, 'getTypeInfo'
]);

// .sources {{{2

/**
 * A map of source types to the classes that implement them.
 */

Source.sources = {
	local: LocalSource,
	http: HttpSource,
	file: FileSource
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
			v.overridden = false;
		});

		if (self.userTypeInfo !== undefined) {
			_.each(self.userTypeInfo, function (fieldTypeInfo, field) {
				if (!typeInfo.isSet(field)) {
					log.warn('Overriding type information on field "' + field + '" which is not present in the source.');
					typeInfo.set(field, {});
				}
				if (typeof fieldTypeInfo === 'string') {
					fieldTypeInfo = {
						type: fieldTypeInfo
					};
				}
				_.extend(typeInfo.get(field), fieldTypeInfo);
				typeInfo.get(field).overridden = true;
				debug.info('SOURCE // GET TYPE INFO', 'Overriding origin type information { field = "' + field + '", typeInfo = %O }', fieldTypeInfo);
			});
		}

		self.cache.typeInfo = typeInfo;
		debug.info('SOURCE // GET TYPE INFO', 'Type Info = %O', deepCopy(self.cache.typeInfo.asMap()));

		self.fire(Source.events.getTypeInfo, null, self.cache.typeInfo, self);
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

		// Post-processing involves converting the data received from the source into a form that will
		// be used internally for sorting, filtering, and display.  This takes several steps.
		//
		//   #1 - User conversion functions.  These go first because they can alter the value and type
		//        information.  (For example, turning all strings starting with "$" into currency.)
		//
		//   #2 - Decide whether type conversion is necessary and should be deferred.
		//
		//   #3 - Perform type conversion for non-deferred fields.

		// Gather the user's conversion functions, which will be applied on every row.  Conversion
		// functions can be applied across all fields (specified as an array), or on a per-field basis
		// (specified as an object with field name keys and array values).

		var conversionFuncs = {};
		typeInfo.each(function (fti, fieldName) {
			conversionFuncs[fieldName] = self.getConversionFuncs(fieldName);
		});

		// Step #1 - Perform all user conversion functions.

		_.each(data, function (row, rowNum) {
			_.each(row, function (val, field) {
				var fti = typeInfo.get(field);
				var cell = {
					value: val
				};

				if (conversionFuncs[field] != null) {
					var conversionFuncOpts = {
						row: row,
						source: self,
						rowNum: rowNum,
						totalRows: data.length
					};

					// Go through all the user's conversion functions.

					for (var i = 0; i < conversionFuncs[field].length; i += 1) {
						if (conversionFuncs[field][i](cell, field, fti, conversionFuncOpts)) {
							break;
						}
					}
				}

				row[field] = cell;
			});
		});

		self.guessTypes(data, typeInfo);

		// Step #2 - Update the type information with whether the internal representation (i.e. numeral
		// or moment) conversion of a field should be deferred or not.

		self.setConversionTypeInfo(data, typeInfo);

		// Step #3 - Unless conversion has been deferred on this field, convert it into the appropriate
		// internal representation (numeral or moment).

		_.each(data, function (row, rowNum) {
			_.each(row, function (val, field) {
				var fti = typeInfo.get(field);

				if (fti != null && !fti.deferDecoding) {
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

// #guessTypes {{{2

Source.prototype.guessTypes = function (data, typeInfo) {
	var self = this;

	var guessType = function (val) {
		if (val.match(/^\d\d\d\d-\d\d-\d\d$/)) {
			return 'date';
		}
		else if (val.match(/^\d\d:\d\d:\d\d$/)) {
			return 'time';
		}
		else if (val.match(/^\d\d\d\d-\d\d-\d\d \d\d:\d\d:\d\d$/)) {
			return 'datetime';
		}
		else if (val.match(/^[-+]?[\d,.]+$/)) {
			return 'number';
		}
		else if (val.match(/^\$[-+]?[\d,.]+$/)) {
			return 'currency';
		}
		else {
			return 'string';
		}
	};

	typeInfo.each(function (fti, f) {
		if (fti.overridden || fti.type !== 'string') {
			return;
		}

		var guess = null;

		for (var i = 0; guess !== 'string' && i < data.length; i += 1) {
			var val = data[i][f].value;
			var newGuess = guessType(val);

			if (guess == null) {
				guess = newGuess;
			}
			else if (newGuess !== guess) {
				debug.info('DATA SOURCE // CONVERSION // TYPE GUESSING', 'For field "%s", previous guess "%s" disagrees with current guess "%s" (rowNum = %d, value = %O)', f, guess, newGuess, i, val);
				guess = 'string';
			}
		}

		if (guess != null) {
			debug.info('DATA SOURCE // CONVERSION // TYPE GUESSING', 'For field "%s", successfully guessed new type "%s"', f, guess);
			fti.type = guess;
		}
	});
};

// #setConversionTypeInfo {{{2

Source.prototype.setConversionTypeInfo = function (data, typeInfo) {
	var self = this;

	typeInfo.each(function (fti, f) {
		if (['number', 'currency', 'date', 'datetime'].indexOf(fti.type) >= 0) {
			fti.deferDecoding = self.opts.deferDecoding;

			if (fti.type === 'number' || fti.type === 'currency') {
				fti.needsDecoding = true;

				var stop = false;
				for (var i = 0; !stop && i < data.length; i += 1) {
					if (isInt(data[i][f].value) || isFloat(data[i][f].value)) {
						// Looks like it can be decoded into a primitive number, so there's no need for
						// Numeral's advanced parsing.
						//
						// However, we do need to keep checking other rows, e.g. when the first row is "123.45"
						// (toFloat will work) but the second row is "1,234.56" (we need to use Numeral).

						fti.internalType = 'primitive';
					}
					else {
						// We need to use Numeral's parser, which means there's no point in checking any other
						// rows... we don't have any better tools than that.

						fti.internalType = 'numeral';
						stop = true;
					}
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

		if (typeof cell.value === 'number') {
			switch (fti.internalType) {
			case 'primitive':
				// number -> primitive ... Nothing to do.
				break;
			case 'numeral':
				// number -> numeral
				cell.value = numeral(cell.value);
				break;
			default:
				log.error('Unable to convert cell value, invalid internal type: field = "%s" ; type = %s ; internalType = %s ; valueTypeOf = %s ; value = %O', field, fti.type, fti.internalType, typeof(cell.value), cell.value);
			}
		}
		else if (typeof cell.value === 'string') {
			if (cell.value === '') {
				cell.value = null;
			}
			else {
				switch (fti.internalType) {
				case 'primitive':
					// string -> primitive
					if (isInt(cell.value)) {
						cell.value = toInt(cell.value);
					}
					else if (isFloat(cell.value)) {
						cell.value = toFloat(cell.value);
					}
					else {
						log.error('Unable to convert cell value, cannot decode to primitive number: field = "%s" ; type = %s ; internalType = %s ; valueTypeOf = %s ; value = %O', field, fti.type, fti.internalType, typeof(cell.value), cell.value);
					}
					break;
				case 'numeral':
					// string -> numeral
					cell.value = numeral(cell.value);
					break;
				default:
					log.error('Unable to convert cell value, invalid internal type: field = "%s" ; type = %s ; internalType = %s ; valueTypeOf = %s ; value = %O', field, fti.type, fti.internalType, typeof(cell.value), cell.value);
				}
			}
		}
		else if (window.numeral == null || !numeral.isNumeral(cell.value)) {
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
	var fti = self.cache.typeInfo.get(field);

	if (!fti.needsDecoding) {
		return;
	}

	debug.info('SOURCE // CONVERSION', 'Converting all values: field = "%s" ; type = %s ; internalType = %s ; valueTypeOf = %s', field, fti.type, fti.internalType, typeof(getProp(data, 0, field, 'value')));

	_.each(data, function (row) {
		self.convertCell(row, field);
	});

	fti.deferDecoding = false;
	fti.needsDecoding = false;
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

// #setToolbar {{{2

Source.prototype.setToolbar = function (toolbar) {
	var self = this;

	self.toolbar = toolbar;

	if (typeof self.origin.setToolbar === 'function') {
		self.origin.setToolbar(toolbar);
	}
};

// Data Model {{{1
//
// There's no such thing as a data model now.  There's just not a lot of functionality AT THIS TIME
// that we would put there.  So the data source is kind of acting as the model now.  This may change
// when we add editing.

