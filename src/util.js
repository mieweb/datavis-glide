	// Functional {{{1

	/**
	 * @namespace wcgraph_int.functional
	 */

	/**
	 * Generate unique symbols to use for element IDs. It doesn't much matter what the actual string
	 * produced is, as long as it's unique. That's why we use the 'gensymSeed' upvalue.
	 *
	 * @memberof wcgraph_int.functional
	 */

	var gensym = (function () {
		var gensymSeed = 0;
		return function () {
			gensymSeed += 1;
			return 'gensym-' + gensymSeed;
		};
	})();

	/**
	 * Y combinator.
	 *
	 * @memberof wcgraph_int.functional
	 */

	function Y(f) {
		return (function (g) {
			return g(g);
		})(function (g) {
			return f(function () {
				return g(g).apply(this, arguments);
			});
		});
	}

	/**
	 * Identity function.
	 *
	 * @memberof wcgraph_int.functional
	 */

	function I(x) {
		return x;
	}

	/**
	 * Does nothing.
	 *
	 * @memberof wcgraph_int.functional
	 */

	function NOP() {
		return;
	};

	/**
	 * Universal comparison function.  Uses the builtin JavaScript type-safe equality and less-than
	 * operators to do the comparison.
	 *
	 * @memberof wcgraph_int.functional
	 *
	 * @param {any} a First operand.
	 * @param {any} b Second operand.
	 *
	 * @returns {number} Zero if operands are equal, -1 if the first operand compares less than the
	 * second, and +1 if the first operand compares greater than the second.
	 */

	function universalCmp(a, b) {
		return a === b ? 0 : a < b ? -1 : 1;
	}

	/**
	 * Call a chain of functions, such that each function consumes as its arguments the result(s) of
	 * the previous function.
	 *
	 * @memberof wcgraph_int.functional
	 *
	 * @param {array} #0 The arguments to pass to the first function in the chain.  If it's not an
	 * array, that's OK.  An array of multiple elements gets turned into multiple arguments for the
	 * first function in the chain.
	 *
	 * @param {function} ... The functions to call in a chain.
	 *
	 * @returns {any} Whatever the result of calling the last function in the chain is.
	 */

	function chain() {
		var args = Array.prototype.slice.call(arguments);
		var fnArgs = args.shift();
		var fn;

		while (args.length > 0) {
			fn = args.shift();

			if (!(fnArgs instanceof Array)) {
				fnArgs = [fnArgs];
			}

			if (typeof fn !== 'function') {
				return fnArgs;
			}

			fnArgs = fn.apply(null, fnArgs);
		}

		return fnArgs;
	}

	/**
	 * Build a function that invokes a chain of function calls, where each function consumes as its
	 * arguments the result of the previous call (converting an array into separate arguments).  The
	 * arguments of the function thus produced are the arguments for the first function in the chain.
	 *
	 * @memberof wcgraph_int.functional
	 *
	 * @param {function} ... The functions to chain together.
	 *
	 * @returns {function} A function that takes any number of arguments; these are passed to the first
	 * function in the chain.  The result of the last function of the chain is the return value.
	 */

	function makeChain() {
		var fns = Array.prototype.slice.call(arguments);
		return function () {
			var args = Array.prototype.slice.call(arguments);
			return chain.apply(null, Array.prototype.concat.call([args], fns));
		};
	}

	function makeArray() {
		return Array.prototype.slice.call(arguments);
	}

	/**
	 * Call methods on an object, and build an object from the values which are passed to callbacks by
	 * those methods.  In other words, it's a way to get results from multiple callback-taking methods
	 * at the same time.
	 *
	 * @memberof wcgraph_int.functional
	 *
	 * @param {Function} cont
	 * @param {Array.<Object.<fn:string, prop:string>>} spec
	 * @param {Object} thisArg
	 * @param {?Object} acc
	 *
	 * @example
	 * trulyYours(cont, [{prop: a, fn: alpha}, {prop: b, fn: bravo}], target) =>
	 *
	 * var obj = {};
	 * return target.alpha(function (x) {
	 *   obj[a] = x;
	 *   return target.bravo(function (y) {
	 *     obj[b] = y;
	 *     return cont(obj);
	 *   });
	 * });
	 */
	function trulyYours(cont, spec, thisArg, acc) {
		acc = acc || {};
		return (spec.length === 0) ? cont(acc) : (function () {
			debug.info('TRULY YOURS', 'Calling #%s() to set property .%s', spec[0].fn, spec[0].prop);
			return (thisArg[spec[0].fn].bind(thisArg))(function (y) {
				acc[spec[0].prop] = (spec[0].conv || I)(y);
				return trulyYours(cont, spec.slice(1), thisArg, acc);
			});
		})();
	}

	/**
	 * Partial application of a function.  Returns a new function that is a version of the argument
	 * with some parameters already bound.  Also called Schönfinkelization.
	 *
	 * @param {function} f The function to curry.
	 * @param {...any} args Arguments to bind in `f`.
	 *
	 * @returns {function} A function with free parameters corresponding to the parameters of `f`
	 * which weren't bound by `args`.
	 */

	function curry() {
		var args = Array.prototype.slice.call(arguments);
		var fn = args.shift();

		return function() {
			return fn.apply(this, args.concat(Array.prototype.slice.call(arguments)));
		};
	}

	function curryCtor() {
		var args = Array.prototype.slice.call(arguments)
			, result = curry.apply(null, args);
		result.prototype = args[0].prototype;
		return result;
	}

	function either() {
		var args = Array.prototype.slice.call(arguments);
		for (var i = 0; i < args.length; i += 1) {
			if (args[i] !== undefined) {
				return args[i];
			}
		}
		return undefined;
	}

	function car(a) {
		return a[0];
	}

	function cdr(a) {
		return a.slice(1);
	}

// Conversion {{{1

function isInt(x) {
	return (typeof x === 'string') ? String(parseInt(x, 10)) === x : +x === Math.floor(+x);
}

function isFloat(x) {
	if (x === null || (typeof x === 'string' && x === '')) {
		// Because: +null => 0 ; +"" => 0
		return false;
	}

	return !isNaN(+x);
}

function toInt(x) {
	return (typeof x === 'string') ? String(parseInt(x, 10)) : Math.floor(+x);
}

function toFloat(x) {
	return +x;
}

/**
 * Convert from a string to an integer.
 *
 * @param {any} x Value to attempt to convert.
 *
 * @returns {number} The value as an integer number, or 0 if the value is not something which can
 * be converted cleanly.
 */

function tryIntConvert(x) {
	return isInt(x) ? toInt(x) : 0;
}

/**
 * Convert from a string to a float.
 *
 * @param {any} x Value to attempt to convert.
 *
 * @returns {number} The value as a floating point number, or 0.0 if the value is not something
 * which can be converted cleanly.
 */

function tryFloatConvert(x) {
	return isFloat(x) ? toFloat(x) : 0.0;
}

	// Data Structures {{{1

	/** @namespace wcgraph_int.datastruct */

	/**
	 * Calls a function on each element in a list until a certain value is returned.
	 *
	 * @memberof wcgraph_int.datastruct
	 *
	 * @param {array} l List to iterate over.
	 * @param {function} f Function to invoke on each element.  Called like: f(item, index).
	 * @param {any} r Return value that causes the iteration to abort.
	 *
	 * @returns {void} Nothing.
	 */

	function eachUntil(l, f, r) {
		var i;
		for (i = 0; i < l.length; i += 1) {
			if (f(l[i], i) === r) {
				return;
			}
		}
	}

	function eachUntilObj(o, f, r, extra) {
		for (k in o) {
			if (o.hasOwnProperty(k) && f(o[k], k, extra) === r) {
				return false;
			}
		}
		return true;
	}

	/**
	 * Create a deep copy of an object.
	 *
	 * @memberof wcgraph_int.datastruct
	 *
	 * @param object o The thing to copy.
	 *
	 * @return object A clean copy of the argument.
	 */

	function deepCopy(o) {
		return jQuery.extend(true, {}, o);
	}

	/**
	 * Deep copy an array.
	 *
	 * @memberof wcgraph_int.datastruct
	 */

	function arrayCopy(a) {
		var result = [];

		for (var i = 0; i < a.length; i += 1) {
			if (_.isArray(a[i])) {
				result[i] = arrayCopy(a[i]);
			}
			else if (_.isObject(a[i])) {
				result[i] = deepCopy(a[i]);
			}
			else {
				result[i] = a[i];
			}
		}

		return result;
	}

	/**
	 * Returns true if the argument is null or undefined.
	 *
	 * @memberof wcgraph_int.datastruct
	 */

	function isNothing(x) {
		return x === undefined || x === null;
	}

	/**
	 * Returns true if the object doesn't have any properties.
	 *
	 * @memberof wcgraph_int.datastruct
	 */

	function isEmpty(o) {
		var numProps = 0;

		_.each(o, function () {
			numProps += 1;
		});

		return numProps === 0;
	}

	/**
	 * Safely get the value of a property path in an object, even if some properties in the path don't
	 * exist.  Returns the value of the last property in the path, or undefined if some elements in
	 * the path don't exist in the object.
	 *
	 * @memberof wcgraph_int.datastruct
	 *
	 * @param {object} obj The object to search for the property path.
	 * @param {...(string|number)} prop Property path to traverse.
	 *
	 * @returns {any} The value of the property found at the end of the provided path, or undefined if
	 * the path cannot be traversed at any step of the way.
	 *
	 * @example
	 * var obj = {a: {b: 2}};
	 *
	 * getProp(obj, 'a', 'b');  // 2
	 * getProp(obj, 'a');		  // {b: 2}
	 * getProp(obj, 'a', 'x');  // undefined
	 * getProp(obj, 'x');		  // undefined
	 */

	function getProp() {
	var args = Array.prototype.slice.call(arguments)
		, o = args.shift()
		, i;

	for (i = 0; o !== undefined && o !== null && i < args.length; i += 1) {
		o = o[args[i]];
		}

	return i < args.length ? undefined : o;
	}

	/**
	 * Safely get the value of a property path in an object, even if some properties in the path don't
	 * exist.  Returns the value of the last property in the path, or a default value if some elements
	 * in the path don't exist in the object.
	 *
	 * @memberof wcgraph_int.datastruct
	 *
	 * @param {any} value The default value to return if the property doesn't exist.
	 * @param {object} obj The object to search for the property within.
	 * @param {...(string|number)} prop Property path to traverse.
	 *
	 * @example
	 * var obj = {a: {b: 2}};
	 *
	 * getPropDef(1, obj, 'a', 'b');		// 2
	 * getPropDef(1, obj, 'a', 'b', 'c'); // 1
	 * getPropDef(1, obj, 'a', 'x');		// 1
	 * getPropDef(1, obj, 'x');			// 1
	 */

	function getPropDef() {
		var args = Array.prototype.slice.call(arguments);
		var d = args.shift();
		var p = getProp.apply(undefined, args);
		return p !== undefined ? p : d;
	}

	/**
	 * Set a value for a property path in an object.
	 *
	 * @memberof wcgraph_int.datastruct
	 *
	 * @param {any} value The value to set for the property.
	 * @param {object} obj The object to set the property within.
	 * @param {...(string|number)} prop Property path to traverse before setting the value.
	 *
	 * @example
	 * var obj = {};
	 * setProp(42, obj, 'a', 'b', 'c');
	 * obj.a.b.c === 42;
	 */

	function setProp() {
		var args = Array.prototype.slice.call(arguments);
		var x = args.shift();
		var o = args.shift();

		for (var i = 0; i < args.length - 1; i += 1) {
			if (o[args[i]] === undefined) {
				o[args[i]] = {};
			}
			o = o[args[i]];
		}

		o[args[args.length - 1]] = x;
	}

	function setPropDef() {
		var args = Array.prototype.slice.call(arguments);
		var x = args.shift();
		var o = args.shift();

		for (var i = 0; i < args.length - 1; i += 1) {
			if (o[args[i]] === undefined) {
				o[args[i]] = {};
			}
			o = o[args[i]];
		}

		if (o[args[args.length - 1]] === undefined) {
			o[args[args.length - 1]] = x;
		}
	};

	/**
	 * Throw an exception if a property is missing.
	 *
	 * @memberof wcgraph_int.datastruct
	 *
	 * @param {function} exn Constructor used to instantiate an exception if an error arises.
	 * @param {object} obj Target object to search within.
	 * @param {...(string|number)} prop Property path.
	 */

	function needProp() {
	var args = Array.prototype.slice.call(arguments)
		, exn = args.shift()
		, prop = getProp.apply(this, args);

	if (prop === undefined) {
		throw new exn('Missing property: [' + args.slice(1).join('.') + ']');
	}

	return prop;
	}

	/**
	 * Throw an exception if a property is missing or not a member of a set.
	 *
	 * @memberof wcgraph_int.datastruct
	 *
	 * @param {function} exn Constructor used to instantiate an exception if an error arises.
	 * @param {object} obj Target object to search within.
	 * @param {...(string|number)} prop Property path.
	 * @param {array} arr Set of values which the property must be in.
	 */

	function needPropIn() {
	var args = Array.prototype.slice.call(arguments)
		, set = args.pop()
		, prop = needProp.apply(this, args);

	if (set.indexOf(prop) === -1) {
		throw new exn('Property [' + args.slice(1).join('.') + '] must be one of: {"' + set.join('", "') + '"}');
	}

	return prop;
	}

	/**
	 * Throw an exception if a property is missing or not an array.
	 *
	 * @memberof wcgraph_int.datastruct
	 *
	 * @param {function} exn Constructor used to instantiate an exception if an error arises.
	 * @param {object} obj Target object to search within.
	 * @param {...(string|number)} prop Property path.
	 */

	function needPropArr() {
	var args = Array.prototype.slice.call(arguments)
		, exn = args[0]
		, prop = needProp.apply(this, args);

	if (!_.isArray(prop)) {
		throw new exn('Property [' + args.slice(1).join('.') + '] must be an array');
	}

	return prop;
	}

	/**
	 * Throw an exception if a property is missing or not an object.
	 *
	 * @memberof wcgraph_int.datastruct
	 *
	 * @param {function} exn Constructor used to instantiate an exception if an error arises.
	 * @param {object} obj Target object to search within.
	 * @param {...(string|number)} prop Property path.
	 */

	function needPropObj() {
	var args = Array.prototype.slice.call(arguments)
		, exn = args[0]
		, prop = needProp.apply(this, args);

	if (!_.isObject(prop)) {
		throw new exn('Property [' + args.slice(1).join('.') + '] must be an object');
	}

	return prop;
	}

	/**
	 * Throw an exception if a property is missing or not an instance of a class.
	 *
	 * @memberof wcgraph_int.datastruct
	 *
	 * @param {function} exn Constructor used to instantiate an exception if an error arises.
	 * @param {object} obj Target object to search within.
	 * @param {...string|number} prop Property path.
	 * @param {function} cls Class which the property must be an instance of.
	 */

	function needPropInst() {
	var args = Array.prototype.slice.call(arguments)
		, exn = args[0]
		, cls = args.pop()
		, prop = needProp.apply(this, args);

	if (!(prop instanceof cls)) {
		throw new exn('Property [' + args.slice(1).join('.') + '] must be an instance of ' + cls.name);
	}

	return prop;
	}

function needArgInst(val, varName, cls) {
	needArg(val, varName);
	var msg = arguments.callee.name + '(): Argument "' + varName + '" must be an instance of ' + cls.name;

	if (!(val instanceof cls)) {
		console.error(msg + ', received: %O', val);
		throw new Error(msg);
	}

	return val;
}

function needArg(val, varName) {
	console.log(arguments.callee.name);
	var msg = arguments.callee.name + '(): Missing required argument "' + varName + '"';

	if (isNothing(val)) {
		throw new Error(msg);
	}

	return val;
}

	/**
	 * Prune a subtree in an object.  This means to prune the leaf, and then if there are no other
	 * leaves on that branch, prune the branch, and so on all the way up.
	 *
	 * @memberof wcgraph_int.datastruct
	 *
	 * @example pruneTree(OBJECT, PATH...)
	 */

	function pruneTree() {
		var args = Array.prototype.slice.call(arguments);
		var o = args.shift();
		var deleteFrom = [];
		var i;

		for (i = 0; i < args.length; i += 1) {
			if (o[args[i]] !== undefined) {
				deleteFrom.push(o);
				if (_.isObject(o[args[i]])) {
					o = o[args[i]];
					continue;
				}
			}

			break;
		}

		for (i = deleteFrom.length - 1; i >= 0; i -= 1) {
			delete deleteFrom[i][args[i]];
			if (!isEmpty(deleteFrom[i])) {
				break;
			}
		}
	}

	/**
	 * Stable sort algorithm that allows for responsive browser UI.
	 *
	 * @memberof wcgraph_int.datastruct
	 */

	function mergeSort(data, cmp, cont) {
		cmp = cmp || universalCmp;
		return Y(function (recur) {
			return function (data, cont) {
				function merge(left, right, cont) {
					var result = [];
					while (left.length !== 0 && right.length !== 0) {
						var cmpResult = cmp(left[0], right[0]);
						if (!_.isNumber(cmpResult)) {
							throw 'comparison result returned non-number';
						}
						result.push(cmpResult <= 0 ? left.shift() : right.shift());
					}
					window.setTimeout(function () {
						cont(result.concat(left.length > 0 ? left : right));
					}, 0);
				}
				if (data.length <= 1) {
					window.setTimeout(function () {
						cont(data);
					}, 0);
				}
				else {
					var pivot = Math.floor(data.length / 2);
					window.setTimeout(function () {
						recur(data.slice(0, pivot), function (left) {
							window.setTimeout(function () {
								recur(data.slice(pivot), function (right) {
									window.setTimeout(function () {
										merge(left, right, cont);
									}, 0);
								});
							}, 0);
						});
					}, 0);
				}
			};
		})(data, cont);
	}

	function mergeSort2(data, cmp) {
		cmp = cmp || function (a, b) { return a < b };

		var merge = function (left, right) {
			var result = []
				, leftLen = left.length
				, leftIdx = 0
				, rightLen = right.length
				, rightIdx = 0;
			while (leftIdx < leftLen && rightIdx < rightLen) {
				var cmpResult = cmp(left[leftIdx], right[rightIdx]);
				result.push(cmpResult ? left[leftIdx++] : right[rightIdx++]);
			}
			return result.concat(leftIdx < leftLen ? left.slice(leftIdx) : right.slice(rightIdx));
		};

		if (data.length <= 1) {
			return data;
		}
		else {
			var pivot = Math.floor(data.length / 2)
				, left = mergeSort2(data.slice(0, pivot), cmp)
				, right = mergeSort2(data.slice(pivot), cmp);
			return merge(left, right);
		}
	}

	function mergeSort3(data, cmp, cont, update) {
		cmp = cmp || function (a, b) { return a < b };
		var size = data.length;
		var step = 0;

		function merge(left, right) {
			var result = []
				, leftLen = left.length
				, leftIdx = 0
				, rightLen = right.length
				, rightIdx = 0;
			while (leftIdx < leftLen && rightIdx < rightLen) {
				var cmpResult = cmp(left[leftIdx], right[rightIdx]);
				result.push(cmpResult ? left[leftIdx++] : right[rightIdx++]);
			}
			return result.concat(leftIdx < leftLen ? left.slice(leftIdx) : right.slice(rightIdx));
		}

		function sort(data, cont) {
			if (data.length <= 1) {
				return cont(data);
			}
			else {
				var pivot = Math.floor(data.length / 2);
				return sort(data.slice(0, pivot), function (left) {
					return sort(data.slice(pivot), function (right) {
						var fn = function () {
							return cont(merge(left, right, cont));
						};
						step += 1;
						if (step % 100 === 0) {
							if (typeof update === 'function') {
								update(step, size);
							}
							return window.setTimeout(fn);
						}
						else {
							return fn();
						}
					});
				});
			}
		}

		return sort(data, cont);
	}

	function objGetPath(obj, fieldPath) {
		var i, len = fieldPath.length;
		for (i = 0; i < len && obj !== undefined; i += 1) {
			obj = obj[fieldPath[i]];
		}
		return obj;
	}

	function cmpObjField(fieldPath, cmp) {
		cmp = cmp || universalCmp;
		return function (a, b) {
			a = objGetPath(a, fieldPath);
			b = objGetPath(b, fieldPath);
			if (!_.isString(a) && !_.isNumber(a) && !_.isDate(a)) {
				throw 'object "a" doesn\'t contain field path: ' + fieldPath.toString();
			}
			if (!_.isString(b) && !_.isNumber(b) && !_.isDate(b)) {
				throw 'object "b" doesn\'t contain field path: ' + fieldPath.toString();
			}
			return cmp(a, b);
		};
	}

	/**
	 * Compare two arrays against each other, deeply. There is no function built into JavaScript to do
	 * this, of course.
	 *
	 * @memberof wcgraph_int.datastruct
	 *
	 * @param {array} a First operand.
	 * @param {array} b Second operand.
	 *
	 * @returns {boolean} True if both arrays contain the exact same elements.  Elements which are
	 * arrays are compared deeply; elements which are objects are not.
	 */

	function arrayCompare(a, b) {
		if (!_.isArray(a) || !_.isArray(b) || a.length !== b.length) {
			return false;
		}
		for (var i = 0; i < a.length; i++) {
			if (_.isArray(a[i]) && _.isArray(b[i])) {
				if (!arrayCompare(a[i], b[i])) {
					return false;
				}
			}
			else if (a[i] !== b[i]) {
				return false;
			}
		}
		return true;
	}

	/**
	 * Treating an object like a tree, descends through object values until it hits a non-object, then
	 * calls the given function.
	 *
	 * @memberof wcgraph_int.datastruct
	 *
	 * @param object o The root of the tree.
	 *
	 * @param function f Callback to invoke, applied to the leaf and the path of keys taken to arrive
	 * at that leaf.
	 *
	 * @param array acc Accumulator of the key path.
	 */

	function walkObj(o, f, acc) {
		if (acc === undefined) {
			acc = [];
		}
		if (_.isUndefined(acc)) {
			walkObj(o, f, []);
		}
		else if (!_.isArray(acc)) {
			throw 'accumulator is not an array';
		}
		else {
			_.each(o, function (v, k) {
				var newAcc = acc.slice();
				newAcc.push(k);
				if (!_.isObject(v) || _.isArray(v)) {
					f(v, newAcc);
				}
				else if (_.isObject(v)) {
					walkObj(v, f, newAcc);
				}
			});
		}
	}

	// OrdMap {{{1

	/**
	 * Create a map (a.k.a. dictionary) where the order of the keys added to the data structure is
	 * maintained.
	 *
	 * @memberof wcgraph_int
	 * @class
	 *
	 * @property {Array<string>} keys List of all keys, in the order they were inserted.
	 * @property {Object<string, number>} keyIndex Associates key with the index it was inserted at.
	 * @property {Object} map Contains all the data inserted.
	 * @property {number} size Number of elements in the map.
	 */

	function OrdMap() {
		this.keys = [];
		this.keyIndex = {};
		this.map = {};
		this.size = 0;
	}

	OrdMap.prototype = Object.create(Object.prototype);
	OrdMap.prototype.constructor = OrdMap;

	/**
	 * Retrieve a key/value association from the map.
	 *
	 * @method
	 * @memberof OrdMap
	 *
	 * @param {string} k The key to retrieve.
	 * @returns {any} The value associated with that key.
	 */

	OrdMap.prototype.get = function (k) {
		return this.map[k];
	};

	/**
	 * Create a key/value association in the map.
	 *
	 * @method
	 * @memberof OrdMap
	 *
	 * @param {string} k The key to use.
	 * @param {any} v The value to use.
	 */

	OrdMap.prototype.set = function (k, v) {
		if (_.isUndefined(this.map[k])) {
			this.keys.push(k);
			this.keyIndex[k] = this.keys.length - 1;
			this.size += 1;
		}
		this.map[k] = v;
	};

	/**
	 * Remove a key/value association from the map.
	 *
	 * @method
	 * @memberof OrdMap
	 *
	 * @param {string} k The key for the association to remove.
	 */

	OrdMap.prototype.unset = function (k) {
		delete this.keyIndex[k];
		delete this.map[k];
		this.size -= 1;
	};

	/**
	 * Indicate if there is an association set for the specified key.
	 *
	 * @method
	 * @memberof OrdMap
	 *
	 * @param {string} k The key to check on.
	 * @returns {boolean} True if there is an association for this key, false if there is not.
	 */

	OrdMap.prototype.isSet = function (k) {
		return !_.isUndefined(this.map[k]);
	};

	/**
	 * Iterate over the map in the order of the keys inserted.  This is the principle way in which
	 * OrdMap differs from a regular JavaScript object.
	 *
	 * @method
	 * @memberof OrdMap
	 *
	 * @param {function} f A function called for each existing association.  The function is invoked
	 * like this: f(VALUE, KEY, KEY-NUMBER).
	 */

	OrdMap.prototype.each = function (f) {
		var i, j = 0,
			k, v, keyLen = this.keys.length;
			for (i = 0; i < keyLen; i += 1) {
				k = this.keys[i];
				if (this.keyIndex[k] === i) {
					v = this.map[k];
					f(v, k, j);
					j += 1;
				}
			}
	};

	/**
	 * Get a list of the keys used, in the order they were inserted.
	 *
	 * @method
	 * @memberof OrdMap
	 *
	 * @returns {array} All the keys in order.
	 */

	OrdMap.prototype.orderedKeys = function () {
		var i, k, result, keyLen = this.keys.length;
		for (i = 0; i < keyLen; i += 1) {
			k = this.keys[i];
			if (this.keyIndex[k] === i) {
				result.push(k);
			}
		}
		return result;
	};

	// HTML {{{1

	/** @namespace wcgraph_int.html */

	/**
	 * Returns the HTML used to construct the argument.
	 *
	 * @memberof wcgraph_int.html
	 */

	function outerHtml(elt) {
		return $('<div>').append(elt).html();
	}

	/**
	 * Get all the next nodes which are direct children of the specified nodes.
	 *
	 * @memberof wcgraph_int.html
	 *
	 * @param selector jQuery selector used to search for nodes containing text
	 * children.
	 *
	 * @return An array of strings, each element being the text of a node matched
	 * by the specified selector.
	 */

	function getText(selector) {
		return jQuery(selector).map(function (i, x) {
			return jQuery(x).text();
		});
	}

	function isVisible(elt) {
		return elt.css('display') !== 'none' && elt.css('visibility') === 'visible';
	}

function fontAwesome(hex, cls, title) {
	var span = jQuery('<span>')
		.addClass('fa')
		.text(String.fromCharCode(parseInt(hex, 16)))

	if (cls !== undefined) {
		span.addClass(cls);
	}

	if (title !== undefined) {
		span.attr('title', title);
	}

	return span;
};

	// Input / Output {{{1

	/** @namespace wcgraph_int.io */

	function valueInfo(value) {
		if (_.isNumber(value)) {
			return [value, ': Number'];
		}
		else if (_.isString(value)) {
			return ['"' + value + '"', ': String'];
		}
		else if (_.isArray(value)) {
			return [value, ': Array'];
		}
		else if (_.isObject(value)) {
			return [value, ': Object'];
		}
		else {
			return [value, ': Unknown'];
		}
	}

	function addSrcInfo(srcIndex, field) {
		return ':' + srcIndex + ':' + field;
	}

	/**
	 * Logging wrappers.
	 *
	 * @memberof wcgraph_int.io
	 */

	var log = {
		info: Function.prototype.bind.call(window.console.log, window.console),
		warn: Function.prototype.bind.call(window.console.warn, window.console),
		error: Function.prototype.bind.call(window.console.error, window.console)
	};

	/**
	 * More logging wrappers.
	 *
	 * @memberof wcgraph_int.io
	 */

	var concatLog = {
		info: function () {
			log.info.apply(window.console, _.flatten(arguments, true));
		},
		warn: function () {
			log.warn.apply(window.console, _.flatten(arguments, true));
		},
		error: function () {
			log.error.apply(window.console, _.flatten(arguments, true));
		}
	};

	/**
	 * Debug logging.
	 *
	 * @memberof wcgraph_int.io
	 */

	var debug = {
		info: function (tag) {
			var rest = Array.prototype.slice.call(arguments, 1);
			var args = Array.prototype.concat.call(['[DEBUG // ' + tag + '] ' + rest[0]], rest.slice(1));

			if (!MIE.DEBUGGING) {
				return;
			}

			return log.info.apply(null, args);
		},
		warn: function (tag) {
			var rest = Array.prototype.slice.call(arguments, 1);
			var args = Array.prototype.concat.call(['[DEBUG // ' + tag + '] ' + rest[0]], rest.slice(1));

			if (!MIE.DEBUGGING) {
				return;
			}

			return log.warn.apply(null, args);
		}
	};

	/**
	 * Issue a warning about deprecated usage.  This also sends an email at the warning level, so that
	 * we can see any systems which are using deprecated features.
	 *
	 * @memberof wcgraph_int.io
	 *
	 * @param {object} defn The grid definition.
	 * @param {string} msg The explanatory message.
	 * @param {string} ref Section in the wiki that describes this deprecated usage.
	 *
	 * @example
	 * deprecated(defn, 'Usage of [showColumns] and [hideColumns] is deprecated.', 'Showing_.26_Hiding_Columns');
	 */

	function deprecated(defn, msg, ref) {
		var output = msg + ' See https://miewiki.med-web.com/wiki/index.php/Advanced_Reports:_Filtering,_Graphing,_Comparing#' + ref + ' for more information.';
		emailWarning(defn, output);
	}


	// Date and Time Formatting {{{1

	/** @namespace wcgraph_int.datetime */

	// Initialize date and time format strings from user preferences.  There doesn't seem to be a
	// builtin way to convert the magick numbers into format strings, but since they're stored in the
	// database it seems safe to assume that they won't change.

	var dateFormatString = 'yyyy-MM-dd';
	var timeFormatString = 'HH:mm:ss';

	/**
	 * Initialization function to grab things we need before doing anything else (e.g. user
	 * preferences).  This function is asynchronous and requires that you pass it a continuation.
	 *
	 * @memberof wcgraph_int.datetime
	 */

	function init(cont) {
		switch (miecgictrl.dateformat) {
		case 1:
			dateFormatString = 'MM-dd-yyyy';
			break;
		case 2:
			dateFormatString = 'dd-MM-yyyy';
			break;
		case 3:
			dateFormatString = 'yyyy-MM-dd';
			break;
		default:
			dateFormatString = 'yyyy-MM-dd';
		}
		timeFormatString = miecgictrl.militaryTime ? 'HH:mm:ss' : 'hh:mm:ss tt';
		cont();
	}

	/**
	 * Format a Date object according to the user's date formatting preferences.  To be accurate, you
	 * need to call the init() function first.
	 *
	 * @memberof wcgraph_int.datetime
	 *
	 * @param {Date} d The date to format.
	 * @returns {string} The date formatted according to the user's preference.
	 */

	function formatDate(d) {
		var convert = {
			'MM': function (x) {
				var m = x.getMonth() + 1;
				return m > 9 ? m : '0' + m;
			},
			'dd': function (x) {
				var d = x.getDate();
				return d > 9 ? d : '0' + d;
			},
			'yyyy': function (x) {
				return x.getFullYear();
			}
		};
		return _.map(dateFormatString.split('-'), function (fmt) {
			if (convert[fmt]) {
				return convert[fmt](d);
			}
			else {
				return '[UNKNOWN]';
			}
		}).join('-');
	}

	/**
	 * Format a Date object according to the user's time formatting preferences.  To be accurate, you
	 * need to call the init() function first.
	 *
	 * @memberof wcgraph_int.datetime
	 *
	 * @param {Date} t The time to format.
	 * @returns {string} The time formatted according to the user's preference.
	 */

	function formatTime(t) {
		var convert = {
			'HH': function (x) {
				var h = x.getHours();
				return h > 9 ? h : '0' + h;
			},
			'hh': function (x) {
				var h = x.getHours();
				if (h === 0) {
					h = 12;
				}
				else if (h > 12) {
					h = h - 12;
				}
				return h > 9 ? h : '0' + h;
			},
			'mm': function (x) {
				var m = x.getMinutes();
				return m > 9 ? m : '0' + m;
			},
			'ss': function (x) {
				var s = x.getSeconds();
				return s > 9 ? s : '0' + s;
			},
			'tt': function (x) {
				var h = x.getHours();
				return h < 12 ? 'AM' : 'PM';
			}
		};
		return timeFormatString.replace(/[A-Za-z]+/g, function (fmt) {
			if (convert[fmt]) {
				return convert[fmt](t);
			}
		});
	}

	/**
	 * @memberof wcgraph_int.datetime
	 */

	function formatDateTime(d) {
		return formatDate(d) + ' ' + formatTime(d);
	}

	/**
	 * @memberof wcgraph_int.datetime
	 */

	function formatDateString(s) {
		if (s === '' || s === '0000-00-00' || s === '0000-00-00 00:00:00') {
			return '[UNKNOWN]';
		}
		return formatDate(new Date(s));
	}

	/**
	 * @memberof wcgraph_int.datetime
	 */

	function formatTimeString(s) {
		if (s === '' || s === '0000-00-00' || s === '0000-00-00 00:00:00') {
			return '[UNKNOWN]';
		}
		return formatTime(new Date(s));
	}

	/**
	 * @memberof wcgraph_int.datetime
	 */

	function formatDateTimeString(s) {
		if (s === '' || s === '0000-00-00' || s === '0000-00-00 00:00:00') {
			return '[UNKNOWN]';
		}
		formatDateTime(new Date(s));
	}

	/**
	 * @memberof wcgraph_int.datetime
	 */

	function removeZeroDates(x) {
		return x === '0000-00-00' ? '' : x;
	}

	/**
	 * @memberof wcgraph_int.datetime
	 */

	function removeZeroDateTimes(x) {
		return x === '0000-00-00 00:00:00' ? '' : x;
	}

	var DATE_ONLY_REGEXP = /^\d\d\d\d-\d\d-\d\d$/;

	/**
	 * @memberof wcgraph_int.datetime
	 */

	function addTimeComponent(x) {
		return (typeof x === 'string' && DATE_ONLY_REGEXP.test(x)) ? x + ' 00:00:00' : x;
	}


	// Exceptions {{{1

	/**
	 * Exception used when a parameter required by a report has not been provided through the user
	 * interface.
	 */

	function MissingRequiredParameterError(name) {
		this.name = 'MissingRequiredParameterError';
		this.stack = (new Error()).stack;
		this.message = 'Missing required parameter: ' + name;
	}

	MissingRequiredParameterError.prototype = Object.create(Error.prototype);
	MissingRequiredParameterError.prototype.constructor = MissingRequiredParameterError;

	/**
	 * Internal exception used when the developer requests a feature that has not been implemented.
	 */

	function NotImplementedError(msg) {
		this.name = 'NotImplementedError';
		this.stack = (new Error()).stack;
		this.message = msg || 'Not Implemented';
	}

	NotImplementedError.prototype = Object.create(Error.prototype);
	NotImplementedError.prototype.constructor = NotImplementedError;

	/**
	 * Exception used when an error has occurred while attempting to run a system report.
	 */

	function ReportRunError(msg) {
		this.name = 'ReportRunError';
		this.stack = (new Error()).stack;
		this.message = msg;
	}

	ReportRunError.prototype = Object.create(Error.prototype);
	ReportRunError.prototype.constructor = ReportRunError;

	/**
	 * Internal exception used when the developer has used a grid definition which is invalid in some
	 * way (e.g. missing or incorrect property value).
	 */

	function InvalidReportDefinitionError(field, value, msg) {
		this.name = 'InvalidReportDefinitionError';
		this.stack = (new Error()).stack;

		window.console.log(msg);
		window.console.log(field);
		window.console.log(value);

		if (isNothing(field) && isNothing(value)) {
			this.message = msg;
		}
		else {
			this.message = 'Invalid report definition: [' + field + '] = "' + value + '", ' + msg;
		}
	}

	InvalidReportDefinitionError.prototype = Object.create(Error.prototype);
	InvalidReportDefinitionError.prototype.constructor = InvalidReportDefinitionError;

	/**
	 * Internal exception used when the developer has created or specified an invalid source.
	 */

	function InvalidSourceError(msg) {
		this.name = 'InvalidSourceError';
		this.stack = (new Error()).stack;
		this.message = msg;
	}

	InvalidSourceError.prototype = Object.create(Error.prototype);
	InvalidSourceError.prototype.constructor = InvalidSourceError;

	/**
	 * Internal exception used when the developer has called a function with an invalid argument.
	 */

	function InvalidCallError(msg) {
		this.name = 'InvalidCallError';
		this.stack = (new Error()).stack;
		this.message = msg;
	}

	InvalidCallError.prototype = Object.create(Error.prototype);
	InvalidCallError.prototype.constructor = InvalidCallError;


	// Locking {{{1

	/**
	 * Locks exist because we may have multiple asynchronous chunks of JavaScript running at the same
	 * time which interfere with each other.
	 *
	 * A really good example is preferences: loading them into the jQWidgets grid fires the event
	 * handlers associated with changing all the items in the prefs.  The preferences contain column
	 * widths, so loading them causes all the column resize event handlers to fire.  So we have a lock
	 * for preferences.  We engage it when load the preferences, then the event handlers find the lock
	 * engaged, so they don't try to save the preferences.  When the preferences are done loading, we
	 * disengage the lock, and event handlers are free to save prefs again.
	 *
	 * @namespace wcgraph_int.locking
	 */

	/**
	 * Engage the lock with the given name.
	 *
	 * @memberof wcgraph_int.locking
	 */

	function lock(defn, name) {
		if (defn.locks === undefined) {
			defn.locks = {};
		}

		if (defn.locks[name] === undefined) {
			defn.locks[name] = 0;
		}

		defn.locks[name] += 1;
		debug.info('LOCK', 'Locking ' + name + ' - ' + defn.locks[name]);
	}

	/**
	 * Disengage the lock with the given name.
	 *
	 * @memberof wcgraph_int.locking
	 */

	function unlock(defn, name) {
		if (defn.locks === undefined) {
			defn.locks = {};
		}

		if (defn.locks[name] === undefined) {
			defn.locks[name] = 1;
		}

		defn.locks[name] -= 1;
		debug.info('LOCK', 'Unlocking ' + name + ' - ' + defn.locks[name]);
	}

	/**
	 * Check to see if the lock with the given name is engaged or not.
	 *
	 * @memberof wcgraph_int.locking
	 */

	function isLocked(defn, name) {
		return defn.locks && !!defn.locks[name];
	}

/**
 * An implementation of a counting semaphore for JavaScript.
 *
 * @memberof wcgraph_int
 * @class
 */

var Lock = function (name) {
	var self = this;

	self._name = name || '#' + (Lock._id++);
	self._lockCount = 0;
	self._onUnlock = [];
};

Lock._id = 1;

// #lock {{{2

/**
 * Engage the lock.  A lock can be engaged multiple times.  Each lock operation must be unlocked
 * separately to fully disengage the lock.
 *
 * @method
 */

Lock.prototype.lock = function () {
	debug.info('LOCK // ' + this._name, 'Locking to level: ' + this._lockCount);
	this._lockCount += 1;
};

// #unlock {{{2

/**
 * Disengage the lock.  A lock can be engaged multiple times.  Each lock operation must be unlocked
 * separately to fully disengage the lock.
 *
 * @method
 */

Lock.prototype.unlock = function () {
	this._lockCount -= 1;

	debug.info('LOCK // ' + this._name, 'Unlocking to level: ' + this._lockCount);

	if (this._lockCount === 0) {
		_.each(this._onUnlock, function (f) {
			f();
		});
		this._onUnlock = [];
	}
};

// #isLocked {{{2

/**
 * Check to see if the lock is engaged.
 *
 * @method
 *
 * @returns {boolean} True if the lock is engaged, false if it's disengaged.
 */

Lock.prototype.isLocked = function () {
	return this._lockCount !== 0;
};

// #onUnlock {{{2

/**
 * Register a function to call when the lock is fully disengaged (i.e. all locks have been
 * unlocked).
 *
 * @method
 *
 * @param {function} f Function to call when the lock is disengaged.
 */

Lock.prototype.onUnlock = function (f) {
	this._onUnlock.push(f);
};

	// Blocking {{{1

	var BLOCK_CONFIG = {
		message: null,
		overlayCSS: {
			opacity: 0.9,
			backgroundColor: '#FFF'
		}
	};

	/**
	 * Block the grid.  If the grid has already been blocked, then nothing happens.
	 *
	 * @param {object} defn The definition of the report that created the grid to block.
	 * @param {function} fn If present, that function will be used as BlockUI's onBlock event handler.
	 * @param {string} info Message that can be logged when blocking.
	 */

	function blockGrid(defn, fn, info) {
		var grid;
		var blockConfig;
		var output;

		if (defn.table.blockCount === undefined) {
			defn.table.blockCount = 0;
		}

		defn.table.blockCount += 1;

		debug.info('BLOCKING // PUSH', '> COUNT =', defn.table.blockCount, '> INFO =', info);

		if (defn.table.blockCount === 1) {
			output = getProp(defn, 'table', 'output', 'method');

			switch (output) {
			case 'jqwidgets':
				grid = jQuery(document.getElementById(defn.table.id)).children('div [role="grid"]');
				break;
			case 'pivot':
				grid = jQuery(document.getElementById(defn.table.id));
				break;
			default:
				grid = null;
			}

			if (grid !== null) {
				blockConfig = {
					message: null,
					overlayCSS: {
						opacity: 0.9,
						backgroundColor: '#FFF'
					}
				};

				if (typeof fn === 'function') {
					blockConfig.onBlock = fn;
				}

				grid.block(blockConfig);
			}
			else {
				fn();
			}
		}
		else if (typeof fn === 'function') {
			fn();
		}
	}

	/**
	 * Unblock the grid.  If the grid has been blocked by more events then it has been unblocked by,
	 * then the block will remain.
	 *
	 * @param {object} defn The definition of the report that created the grid to block.
	 * @param {string} info Message that can be logged when unblocking.
	 */

	function unblockGrid(defn, info) {
		var grid;
		var output;

		if (defn.table.blockCount === undefined) {
			defn.table.blockCount = 0;
		}

		if (defn.table.blockCount > 0) {
			defn.table.blockCount -= 1;
			debug.info('BLOCKING // POP', ' > COUNT =', defn.table.blockCount, '> INFO =', info);
			if (defn.table.blockCount === 0) {
				output = getProp(defn, 'table', 'output', 'method');

				switch (output) {
				case 'jqwidgets':
					grid = jQuery(document.getElementById(defn.table.id)).children('div [role="grid"]');
					break;
				case 'pivot':
					grid = jQuery(document.getElementById(defn.table.id));
					break;
				default:
					grid = null;
				}

				if (grid !== null) {
					grid.unblock();
				}
			}
		}
	}

	/**
	 * Check to see if a grid is blocked.
	 *
	 * @param {object} defn The definition of the report that created the grid we want to check.
	 *
	 * @return {boolean} True if the grid is blocked, false if it is not.
	 */

	function gridIsBlocked(defn) {
		return defn.table.blockCount > 0;
	}

	/**
	 * Wrap a function to execute while the grid is blocked.  Blocks the grid, calls the function, and
	 * unblocks immediately afterward.  You probably only want to use this is the function you provide
	 * is not asynchronous (otherwise the grid will unblock "early" when the function returns).
	 *
	 * @param {object} defn The definition of the report that created the grid to block.
	 *
	 * @param {function} fn A zero-arity function to call after the grid has been blocked.  After this
	 * function returns, the grid is unblocked.
	 *
	 * @param {string} info Message that can be logged when blocking/unblocking.
	 */

	function withGridBlock(defn, fn, info) {
		if (typeof fn !== 'function') {
			throw InvalidCallError('Argument <fn> must be a function.');
		}

		blockGrid(defn, function () {
			// This shouldn't be necessary because we're doing it in BlockUI's onBlock event handler, but
			// for whatever reason it doesn't always work... oftentimes, when fn() executes, the element
			// is not visually blocked.  This seems to be much more consistent in how it looks.

			window.setTimeout(function () {
				fn();
				unblockGrid(defn, info);
			}, $.blockUI.defaults.fadeIn);
		}, info);
	}

// Timing {{{1

function TimingError(msg) {
	this.name = 'TimingError';
	this.stack = (new Error()).stack;
	this.message = msg;
}

TimingError.prototype = Object.create(Error.prototype);
TimingError.prototype.constructor = TimingError;

function Timing() {
	var self = this;

	self.data = {};
	self.events = {};
	self.eventCount = {};
}

// #start {{{2

Timing.prototype.start = function (what) {
	var self = this
		, subject = what[0]
		, event = what[1];

	setPropDef([], self.events, subject);
	setPropDef(0, self.eventCount, subject, event);
	setPropDef({}, self.data, subject);

	self.eventCount[subject][event] += 1;

	if (self.eventCount[subject][event] > 1) {
		event += ' (#' + self.eventCount[subject][event] + ')';
	}

	self.events[subject].push(event);

	debug.info('TIMING', 'Received <START> event for [' + subject + ' : ' + event + ']');

	setProp(Date.now(), self.data, subject, event, 'start');
};

// #stop {{{2

Timing.prototype.stop = function (what) {
	var self = this
		, subject = what[0]
		, event = what[1];

	setPropDef(0, self.eventCount, subject, event);

	if (self.eventCount[subject][event] > 1) {
		event += ' (#' + self.eventCount[subject][event] + ')';
	}

	debug.info('TIMING', 'Received <STOP> event for [' + subject + ' : ' + event + ']');

	if (getProp(self.data, subject, event, 'start') === undefined) {
		log.warn('Received <STOP> event for [' + subject + ' : ' + event + '] with no <START> event');
		return;
	}

	setProp(Date.now(), self.data, subject, event, 'end');
};

// #getSubjects {{{2

Timing.prototype.getSubjects = function () {
	return _.keys(this.events);
};

// #dump {{{2

Timing.prototype.dump = function (subject) {
	var self = this;

	var f = function (sub) {
		if (isNothing(self.events[sub])) {
			throw new TimingError('Unknown subject: ' + sub);
		}

		_.each(self.events[sub], function (evt) {
			var start = getProp(self.data, sub, evt, 'start')
				, end = getProp(self.data, sub, evt, 'end');

			log.info('[TIMING] ' + sub + ' : ' + evt + ' >> ' + (end - start) + 'ms');
		});
	};

	if (!isNothing(subject)) {
		f(subject);
	}
	else {
		_.each(self.getSubjects(), f);
	}
};
