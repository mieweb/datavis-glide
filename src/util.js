// Functional {{{1

/**
 * Generate unique symbols to use for element IDs. It doesn't much matter what the actual string
 * produced is, as long as it's unique. That's why we use the 'gensymSeed' upvalue.
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
 */

function I(x) {
	return x;
}

/**
 * Does nothing.
 */

function NOP() {
	return;
};

/**
 * Universal comparison function.  Uses the builtin JavaScript type-safe equality and less-than
 * operators to do the comparison.
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

var getComparisonFn = (function () {
	var cmpFn = {};

	// Dates and times are stored as Moment instances, so we need to compare them accordingly.

	cmpFn.date = function (a, b) {
		if (window.moment === undefined || (!moment.isMoment(a) && !moment.isMoment(b))) {
			return a < b;
		}
		else if (moment.isMoment(a) && moment.isMoment(b)) {
			return a.isBefore(b);
		}
		else {
			log.warn('Cannot compare Moment w/ non-Moment');
			return 0;
		}
	};
	cmpFn.time = cmpFn.date;
	cmpFn.datetime = cmpFn.date;

	// Strings, numbers, and currency are stored as JavaScript primitives, so using the builtin
	// operators to compare them is OK.

	cmpFn.string = function (a, b) {
		return a < b;
	};

	cmpFn.number = function (a, b) {
		if (window.numeral === undefined) {
			return a < b;
		}

		if (numeral.isNumeral(a)) {
			if (numeral.isNumeral(b)) {
				return a._value < b._value;
			}
			else {
				return a._value < b;
			}
		}
		else if (numeral.isNumeral(b)) {
			return a < b._value;
		}
		else {
			return a < b;
		}
	};
	cmpFn.currency = cmpFn.number;

	cmpFn.array = function (a, b) {
		return arrayCompare(a, b) < 0;
	};

	return {
		byType: (function (type) {
			return cmpFn[type];
		}),
		byValue: (function (val) {
			if (window.numeral && window.numeral.isNumeral(val)) {
				return cmpFn.number;
			}
			else if (window.moment && window.moment.isMoment(val)) {
				return cmpFn.date;
			}
			else if (_.isArray(val)) {
				return cmpFn.array;
			}
			else {
				return cmpFn.string;
			}
		})
	};
})();

function arrayCompare(a, b) {
	if (!_.isArray(a) || !_.isArray(b)) {
		throw new Error('Call Error: arguments must be arrays');
	}

	if (a.length !== b.length) {
		throw new Error('Call Error: arguments must have the same length');
	}

	for (var i = 0; i < a.length; i += 1) {
		if (a[i] < b[i]) {
			return -1;
		}
		else if (a[i] > b[i]) {
			return 1;
		}
	}

	return 0;
}

function arrayEqual(a, b) {
	if (!_.isArray(a) || !_.isArray(b)) {
		throw new Error('Call Error: arguments must be arrays');
	}

	if (a.length !== b.length) {
		return false;
	}

	return arrayCompare(a, b) === 0;
}

function getNatRep(x) {
	if (window.numeral && numeral.isNumeral(x)) {
		return x.value();
	}
	else if (window.moment && moment.isMoment(x)) {
		return x.unix();
	}
	else {
		return x;
	}
};

/**
 * Call a chain of functions, such that each function consumes as its arguments the result(s) of
 * the previous function.
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
	return (typeof x === 'string') ? parseInt(x, 10) : Math.floor(+x);
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

/**
 * Calls a function on each element in a list until a certain value is returned.
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

/**
 * Calls a function on each key/value pair in an object until the function returns a certain value.
 * This is mainly useful as a sort of short-circuited version of `_.each()` or a version of
 * `_.every()` that works on objects.  This contrived example only goes through as many keys as
 * necessary to determine that one of them is "TERMINATE."
 *
 * ```
 * if (!eachUntilObject(o, (v, k) => { k.toUpperCase() }, "TERMINATE")) {
 *   console.log('Object contains TERMINATE key!');
 * }
 * ```
 *
 * @param {object} o
 * The object to iterate over.
 *
 * @param {function} f
 * Function to call like this: `f(value, key, extra)`
 *
 * @param {any} r
 * If `f` returns `r` then this function returns false.
 *
 * @param {any} [extra]
 * A "userdata" type of argument passed to `f`.
 *
 * @return {boolean}
 * False if `f` returned `r` for some key/value pair in the object, and true otherwise.
 */

function eachUntilObj(o, f, r, extra) {
	for (k in o) {
		if (o.hasOwnProperty(k) && f(o[k], k, extra) === r) {
			return false;
		}
	}
	return true;
}

/**
 * Map a function over an array, stopping after a preset number of elements.
 *
 * @param {any[]} a
 * An array of items.
 *
 * @param {function} f
 * The function to map.
 *
 * @param {number} l
 * Maximum number of elements to process.
 *
 * @return {any[]}
 * An array of size `min(a.length, l)` containing the mapped results.
 */

function mapLimit(a, f, l) {
	var result = [];
	for (var i = 0; i < Math.min(a.length, l); i += 1) {
		result.push(f(a[i], i));
	}
	return result;
}

/**
 * Create a deep copy of an object.
 *
 * @param object o
 * The thing to copy.
 *
 * @return object
 * A clean copy of the argument.
 */

var deepCopy = function (x0) {
	var depth = 0;
	var depthLimit = 99;
	var path = [];

	if (x0 == null) {
		return {};
	}

	function recursive(x, depth) {
		if (depth > depthLimit) {
			log.error('deepCopy: path = %O', path);
			throw new Error('deepCopy: Maximum recursion depth exceeded');
		}

		var result;

		if (jQuery.isArray(x)) {
			result = [];

			for (var i = 0; i < x.length; i += 1) {
				path.push(i);
				result[i] = recursive(x[i], depth + 1);
				path.pop();
			}

			return result;
		}
		else if (jQuery.isPlainObject(x)) {
			result = {};

			for (var k in x) {
				if (x.hasOwnProperty(k)) {
					path.push(k);
					result[k] = recursive(x[k], depth + 1);
					path.pop();
				}
			}

			return result;
		}
		else {
			return x;
		}
	}

	return recursive(x0, 0);
};

var arrayCopy = deepCopy;

/**
 * Returns true if the argument is null or undefined.
 */

function isNothing(x) {
	return x === undefined || x === null;
}

/**
 * Returns true if the object doesn't have any properties.
 */

function isEmpty(o) {
	var numProps = 0;

	_.each(o, function () {
		numProps += 1;
	});

	return numProps === 0;
}

function deepDefaults() {
	var args = Array.prototype.slice.call(arguments)
		, base;

	if (args[0] === true) {
		args.shift();
		base = args.shift();
	}
	else {
		base = deepCopy(args.shift());
	}

	var f = function (a, b) {
		_.each(b, function (v, k) {
			if (a[k] === undefined) {
				a[k] = typeof v === 'object' ? deepCopy(v) : v;
			}
			else if (_.isObject(a[k]) && _.isObject(v)) {
				f(a[k], v);
			}
		});
	};

	_.each(args, function (arg) {
		f(base, arg);
	});

	return base;
}

/**
 * Safely get the value of a property path in an object, even if some properties in the path don't
 * exist.  Returns the value of the last property in the path, or undefined if some elements in
 * the path don't exist in the object.
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

	args = _.flatten(args);

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

	args = _.flatten(args);

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

	args = _.flatten(args);

	for (var i = 0; i < args.length - 1; i += 1) {
		if (o[args[i]] === undefined) {
			o[args[i]] = {};
		}

		o = o[args[i]];
	}

	if (o[args[args.length - 1]] === undefined) {
		o[args[args.length - 1]] = x;
	}
}

/**
 * Throw an exception if a property is missing.
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
	var stepsBeforeUpdate = Math.min(data.length / 50, 500);

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
					if (step % stepsBeforeUpdate === 0) {
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

/**
 * Non-recursive merge sort, mostly taken from: https://stackoverflow.com/questions/1557894/
 * Breaks for update every "merge" which happens log_2(n) times.
 */

var mergeSort4 = function (data, cmp, cont, update) {
	cmp = cmp || function (x, y) { return x < y };
	var a = data;
	var num = data.length;
	var b = new Array(num);

	var rght, wid, rend;
	var i, j, m, t;

	var sortWindow = function (k) {
		for (var left=0; left+k < num; left += k*2 ) {
			rght = left + k;
			rend = rght + k;
			if (rend > num) rend = num;
			m = left; i = left; j = rght;
			while (i < rght && j < rend) {
				if (cmp(a[i], a[j])) {
					b[m] = a[i]; i++;
				} else {
					b[m] = a[j]; j++;
				}
				m++;
			}
			while (i < rght) {
				b[m]=a[i];
				i++; m++;
			}
			while (j < rend) {
				b[m]=a[j];
				j++; m++;
			}
			for (m=left; m < rend; m++) {
				a[m] = b[m];
			}
		}

		if (k < num) {
			if (typeof update === 'function') {
				update(k, num);
			}
			return window.setTimeout(function () {
				sortWindow(k * 2);
			});
		}
		else {
			return cont(a);
		}
	};

	sortWindow(1);
};

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
 * Constructs an object from a simplified array representation.
 *
 * ```
 * objFromArray(['foo', 'bar', 'baz'])             => {foo: 0, bar: 1}
 * objFromArray(['foo', 'bar', 'baz'], ['a'])      => {foo: 'a', bar: 'a', baz: 'a'}
 * objFromArray(['foo', 'bar', 'baz'], ['a', 'b']) => {foo: 'a', bar: 'b', baz: 'a'}
 * ```
 *
 * @param {any[]} a
 * Items that will become the keys in the object.
 *
 * @param {any[]} [v]
 * Items that will become the values in the object.
 */

function objFromArray(a, v) {
	return _.reduce(a, function (o, x, i) {
		o[x] = v ? v[i % v.length] : x;
		return o;
	}, {});
}

/**
 * Treating an object like a tree, descends through object values until it hits a non-object, then
 * calls the given function.
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

// Object Orientation {{{1

/**
 * Create a function representing a subclass.
 *
 * ```
 * var Animal = makeSubclass(Object, function (name) {
 *   this.name = name;
 * }, {
 *   species: 'unknown species'
 * });
 *
 * Animal.prototype.printInfo = function () {
 *   console.log(this.name + ' is a ' + this.species + '.');
 * };
 *
 * var HouseFinch = makeSubclass(Animal, null, {
 *   species: 'Haemorhous mexicanus'
 * });
 *
 * HouseFinch.prototype.printInfo = function () {
 *   self.super.printInfo();
 *   console.log('He says: Tweet tweet!');
 * };
 *
 * var harold = new HouseFinch('Harold');
 * harold.printInfo();
 *
 * > Harold is a Haemorhous mexicanus.
 * > He says: Tweet tweet!
 * ```
 *
 * Within the source code, look to {@linkcode Aggregate} or {@linkcode GridTable} for some prime
 * examples.
 *
 * @param {function} parent
 * The parent class; use "Object" to create base classes.
 *
 * @param {function} [ctor]
 * Constructor for the subclass.  If not provided, a default constructor is used which simply calls
 * the superclass' constructor with all arguments.
 *
 * @param {object} [ptype]
 * Properties added to the resulting class' prototype.
 *
 * @return {function}
 * A constructor used to create new instances of the subclass.  The instance will get a `super`
 * property which can be used to invoke the superclass' methods on itself.
 */

var makeSubclass = function (parent, ctor, ptype) {
	// Default constructor just calls the super constructor.

	if (ctor == null && parent !== Object) {
		ctor = function () {
			this.super.ctor.apply(this, arguments);
		};
	}

	var subclass = function () {
		if (parent !== Object) {
			this.super = makeSuper(this, parent);
		}

		if (ctor != null) {
			ctor.apply(this, arguments);
		}
	};

	subclass.prototype = Object.create(parent.prototype);
	subclass.prototype.constructor = subclass;

	_.each(ptype, function (v, k) {
		subclass.prototype[k] = v;
	});

	return subclass;
};

/**
 * Creates an object to act as a proxy to superclass methods.  Probably best to not use this
 * directly, and instead let {@linkcode makeSubclass makeSubclass()} do the work for you.
 *
 * @param {object} me
 * An instance of the subclass.
 *
 * @param {function} parent
 * The superclass.
 *
 * @return {object}
 * An object containing proxies to superclass methods (bound to `me`).
 */

var makeSuper = function (me, parent) {
	var sup = _.mapObject(parent.prototype, function (v, k) {
		if (typeof v === 'function') {
			return _.bind(v, me);
		}
	});

	sup.ctor = _.bind(parent, me);

	return sup;
};

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
 */

/**
 * Engage the lock with the given name.
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
 */

function isLocked(defn, name) {
	return defn.locks && !!defn.locks[name];
}

/**
 * An implementation of a counting semaphore for JavaScript.
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
	this._lockCount += 1;
	debug.info('LOCK // ' + this._name, 'Locking to level: ' + this._lockCount);
};

// #unlock {{{2

/**
 * Disengage the lock.  A lock can be engaged multiple times.  Each lock operation must be unlocked
 * separately to fully disengage the lock.
 *
 * @method
 */

Lock.prototype.unlock = function () {
	var self = this;

	self._lockCount -= 1;
	debug.info('LOCK // ' + self._name, 'Unlocking to level: ' + self._lockCount);

	// If we're completely unlocked, start going through the functions that were registered to be run.
	// The only problem is that these functions can cause us to be locked again.  If that happens, we
	// abort.  The functions to run are a queue, and when we become unlocked we'll just resume running
	// the functions in the queue.

	var onUnlockLen = self._onUnlock.length;
	var i = 0;

	while (self._onUnlock.length > 0 && !self.isLocked()) {
		i += 1;
		var onUnlock = self._onUnlock.shift();

		debug.info('LOCK // ' + self._name,
							 'Running onUnlock function (#'
							 + i
							 + '/'
							 + onUnlockLen
							 + ') - '
							 + (onUnlock.info || '[NO INFO]'));

		onUnlock.f();
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

Lock.prototype.onUnlock = function (f, info) {
	var self = this;

	// If we're not already locked, there's no point in queueing it up, just do it.  This can simplify
	// logic in callers (i.e. they don't have to do the check).

	if (!self.isLocked()) {
		f();
	}

	self._onUnlock.push({
		f: f,
		info: info
	});

	debug.info('LOCK // ' + self._name,
		'Saved onUnlock function (#'
		+ self._onUnlock.length
		+ ') - '
		+ (info || '[NO INFO]'));
};

// HTML {{{1

/**
 * Returns the HTML used to construct the argument.
 */

function outerHtml(elt) {
	return jQuery('<div>').append(elt).html();
}

/**
 * Get all the next nodes which are direct children of the specified nodes.
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

/*
 * Taken from --
 *   https://stackoverflow.com/a/7557433/5628
 */

function isElementInViewport (parent, elt) {
	if (elt instanceof jQuery) {
		elt = elt.get(0);
	}

	var eltRect = elt.getBoundingClientRect();

	if (eltRect.top < 0 || eltRect.left < 0) {
		return false;
	}

	if (parent !== window) {
		if (parent instanceof Element) {
			parent = jQuery(parent);
		}

		var parentRect = parent.get(0).getBoundingClientRect();
		//console.log('top=' + eltRect.top + ', ' +
		//						'left=' + eltRect.left + ', ' +
		//						'bottom=' + eltRect.bottom + ', ' +
		//						'height=' + (parent.innerHeight() + parentRect.top));
		return eltRect.bottom <= parent.innerHeight() + parentRect.top;
	}
	else {
		//console.log('top=' + eltRect.top + ', ' +
		//						'left=' + eltRect.left + ', ' +
		//						'bottom=' + eltRect.bottom + ', ' +
		//						'height=' + window.innerHeight);
		return eltRect.bottom <= window.innerHeight;
	}
}

function onVisibilityChange(parent, elt, callback) {
	var old_visible;
	return function () {
		var visible = isElementInViewport(parent, elt);
		if (visible !== old_visible) {
			if (old_visible !== undefined && typeof callback == 'function') {
				callback(visible);
			}
			old_visible = visible;
		}
	}
}

function fontAwesome(icon, cls, title) {
	var span = jQuery('<span>')
		.addClass('fa');

	if (icon.substr(0, 3) === 'fa-') {
		span.addClass(icon);
	}
	else {
		span.text(String.fromCharCode(parseInt(icon, 16)));
	}

	if (cls !== undefined) {
		span.addClass(cls);
	}

	if (title !== undefined) {
		span.attr('title', title);
	}

	return span;
};

/**
 * @function loadScript
 * @description
 *
 * Dynamically load JavaScript from a URL into the page.
 *
 * Here's an example of using the `needAsyncSetup` option:
 *
 * ```
 * return loadScript('https://www.gstatic.com/charts/loader.js', function (wasAlreadyLoaded, k) {
 *   if (!wasAlreadyLoaded) {
 *     google.charts.load('current', {'packages':['corechart']});
 *     google.charts.setOnLoadCallback(k);
 *   }
 *   else {
 *     k();
 *   }
 * }, {
 *   needAsyncSetup: true
 * });
 * ```
 *
 * Calling `k()` *must* be done to properly unlock the loading code (only one file is loaded at a
 * time) but only after everything is fully set up.
 *
 * @param {string} url
 * The URL to load a script file from.
 *
 * @param {function} callback
 * A function that receives at least one argument, a boolean which is true if the script was already
 * loaded in the page.  The callback will not be called until the browser has finished executing the
 * script, so it can safely use anything that the script provides.  If the callback needs to perform
 * any additional setup before the loading is considered "complete" then use the `needAsyncSetup`
 * option as shown below.
 *
 * @param {object} [opts]
 * Additional options (see below).
 *
 * @param {boolean} [opts.needAsyncSetup = false]
 * If true, then the callback function receives an additional argument, another function *which it
 * must call* when finished.  This is specifically to support Google's JS API "loader" script, which
 * requires additional (asynchronous) setup.
 */

var loadScript = (function () {
	var alreadyLoaded = {};
	var lock = new Lock('LOAD SCRIPT');
	return function (url, callback, opts) {
		_.defaults(opts, {
			needAsyncSetup: false
		});

		// https://stackoverflow.com/a/950146

		var load = function (url, callback) {
			// Adding the script tag to the head as suggested before
			var head = document.getElementsByTagName('head')[0];
			var script = document.createElement('script');
			script.type = 'text/javascript';
			script.src = url;

			// Then bind the event to the callback function.
			// There are several events for cross browser compatibility.
			script.onreadystatechange = callback;
			script.onload = callback;

			// Fire the loading
			head.appendChild(script);
		};

		var makeCb = function (isAlreadyLoaded) {
			var showLoadMsg = function () {
				if (isAlreadyLoaded) {
					debug.info('UTIL // LOAD SCRIPT', '[url = %s] Already loaded', url);
				}
				else {
					debug.info('UTIL // LOAD SCRIPT', '[url = %s] Finished executing loaded script', url);
				}
			};

			if (opts.needAsyncSetup) {
				return function () {
					showLoadMsg();
					callback(isAlreadyLoaded, function () {
						debug.info('UTIL // LOAD SCRIPT', '[url = %s] Exiting control of the script loader', url);
						if (!isAlreadyLoaded) {
							alreadyLoaded[url] = true;
							lock.unlock();
						}
					});
				};
			}
			else {
				return function () {
					showLoadMsg();
					debug.info('UTIL // LOAD SCRIPT', '[url = %s] Exiting control of the script loader', url);
					if (!isAlreadyLoaded) {
						alreadyLoaded[url] = true;
						lock.unlock();
					}
					callback(isAlreadyLoaded);
				};
			}
		};

		lock.onUnlock(function () {
			if (alreadyLoaded[url]) {
				makeCb(true)();
			}
			else {
				lock.lock();
				load(url, makeCb(false));
			}
		});
	};
})();

// makeCheckbox {{{2

function makeCheckbox(startChecked, onChange, text, parent) {
	return jQuery('<label>')
		.append(jQuery('<input>', { 'type': 'checkbox', 'checked': startChecked })
						.on('change', onChange))
		.append(text)
		.appendTo(parent);
}

// makeToggleCheckbox {{{2

function makeToggleCheckbox(rootObj, path, startChecked, text, parent, after) {
	setPropDef(startChecked, rootObj, path);

	return makeCheckbox(getProp(rootObj, path), function () {
		var isChecked = jQuery(this).prop('checked');
		debug.info('GRID // TOOLBAR', 'Setting `' + path.join('.') + '` to ' + isChecked);
		setProp(isChecked, rootObj, path);
		if (typeof after === 'function') {
			after(isChecked);
		}
	}, text, parent);
}

// makeRadioButtons {{{2

/**
 * @typedef makeRadioButtons_values
 *
 * @property {string} label
 *
 * @property {string} value
 */

/**
 * @param {Object} rootObj
 * Object to update when radio button is selected.
 *
 * @param {string[]} path
 * Path within the object to set the value of the selected radio button.
 *
 * @param {string} def
 * Default value to set in the object.
 *
 * @param {string} [label]
 * Label to put before the group of radio buttons.
 *
 * @param {string} name
 * Name of the form variable.
 *
 * @param {Array.<string|makeRadioButtons_values>} values
 * Possible values to create radio buttons for.
 *
 * @param {function} [conv]
 * Pass selected value through this function to convert it (e.g. "true" -> 1).
 *
 * @param {function} [onChange]
 * Function to call when the value is changed.
 *
 * @param {Element|jQuery} parent
 * Element to place the radio buttons within.
 */

function makeRadioButtons(rootObj, path, def, label, name, values, conv, onChange, parent) {
	setPropDef(def, rootObj, path);
	var initial = getProp(rootObj, path);

	var root = jQuery('<div>').css('display', 'inline-block').appendTo(parent);
	if (label) {
		jQuery('<label>').text(label).appendTo(root);
	}
	_.each(values, function (v) {
		var label = _.isString(v) ? v : v.label;
		var value = _.isString(v) ? v : v.value;
		jQuery('<label>')
			.append(jQuery('<input>', { 'type': 'radio', 'name': name, 'value': value })
							.on('change', function () {
								var selected = root.find('input[type=radio]:checked').val();
								if (typeof conv === 'function') {
									selected = conv(selected);
								}
								debug.info('GRID // TOOLBAR', 'Setting `' + path.join('.') + '` to ' + selected);
								setProp(selected, rootObj, path);
								if (typeof onChange === 'function') {
									onChange(selected);
								}
							}))
			.append(label)
			.appendTo(root);
	});
	root.find('input[type=radio]').val([initial]);
}

// Input / Output {{{1

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
 */

var log = {
	info: Function.prototype.bind.call(window.console.log, window.console),
	warn: Function.prototype.bind.call(window.console.warn, window.console),
	error: Function.prototype.bind.call(window.console.error, window.console)
};

/**
 * More logging wrappers.
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

/**
 * Correctly format a value according to its type and user specification.
 *
 * @param {object} colConfig Configuration object for the column corresponding to this field.
 *
 * @param {object} typeInfo
 *
 * @param {Cell} cell The true value, as used by the View to perform sorting and
 * filtering.
 *
 * @param {object} opts
 * Additional options.
 *
 * @param {boolean} [opts.debug=false]
 * If true, some debugging output is produced.  Turned off by default because it tends to be noisy
 * and thus slow down the browser.
 *
 * @param {string} [opts.overrideType]
 * If true, the type of the data is assumed to be that specified, instead of what's in `typeInfo`.
 * This is often used when outputting aggregate function results that have a different type from the
 * type of the field they're applied on (e.g. "distinct values" always produces a string, even if
 * it's applied over a field that contains dates or currency).
 */

function format(colConfig, typeInfo, cell, opts) {
	colConfig = colConfig || {};
	typeInfo = typeInfo || {};

	opts = opts || {};

	_.defaults(opts, {
		debug: false,
		overrideType: null
	});

	if (opts.debug) {
		debug.info('FORMAT', 'typeInfo = %O ; colConfig = %O ; cell = %O ; opts = %O', typeInfo, colConfig, cell, opts);
	}

	// When we just receive a value instead of a proper data cell, convert it so that code below can
	// be simplified.  These cells are just "pretend" and anything stored in them is going to be
	// discarded when this function is done.

	if ((window.moment && window.moment.isMoment(cell))
			|| (window.numeral && window.numeral.isNumeral(cell))
			|| typeof cell !== 'object') {
		cell = {
			value: cell
		};
	}

	// When we've already rendered this cell before, just reuse that.

	if (cell.cachedRender != null) {
		return cell.cachedRender;
	}

	var result = cell.orig || cell.value;

	var t = opts.overrideType || typeInfo.type;

	// Handle zero dates like Webchart uses all the time.  Turn them into the empty string, otherwise
	// Moment will say "Invalid Date".

	if (['date', 'datetime'].indexOf(t) >= 0
			&& ((window.moment && window.moment.isMoment(cell.value) && !cell.value.isValid())
					|| (typeof(cell.value) === 'string' && (cell.value === '0000-00-00'
																									|| cell.value === '0000-00-00 00:00:00')))) {
		result = '';
	}
	else {
		switch (t) {
		case 'date':
		case 'datetime':
			if (typeof cell.value === 'string' && typeInfo.needsDecoding) {
				cell.value = moment(cell.value, typeInfo.format);
			}

			if (window.moment && window.moment.isMoment(cell.value)) {
				result = cell.value.format(colConfig.format || 'YYYY-MM-DD');
			}
			else {
				result = moment(cell.value).format(colConfig.format);
			}
			break;
		case 'number':
		case 'currency':
			if (typeof cell.value === 'string' && typeInfo.needsDecoding) {
				if (isInt(cell.value)) {
					cell.value = toInt(cell.value);
				}
				else if (isFloat(cell.value)) {
					cell.value = toFloat(cell.value);
				}
				else {
					cell.value = numeral(cell.value);
				}
			}

			if (window.numeral && window.numeral.isNumeral(cell.value)) {
				if (colConfig.format) {
					result = cell.value.format(colConfig.format);
				}
				else {
					result = cell.value.value() + '';
				}
			}
			else {
				if (colConfig.format) {
					result = numeral(cell.value).format(colConfig.format);
				}
				else {
					result = cell.value + '';
				}
			}
			break;
		case 'string':
			result = cell.value;
			break;
		default:
			log.error('Unable to format - unknown type: { field = "%s", type = "%s", value = "%s" }',
				typeInfo.field, t, cell.value);
		}
	}

	// If there's a rendering function, pass the (possibly formatted) value through it to get the new
	// value to display.

	if (typeof cell.render === 'function') {
		result = cell.render(result);
	}

	cell.cachedRender = result;

	return cell.cachedRender;
};

// Date and Time Formatting {{{1

// Initialize date and time format strings from user preferences.  There doesn't seem to be a
// builtin way to convert the magick numbers into format strings, but since they're stored in the
// database it seems safe to assume that they won't change.

var dateFormatString = 'yyyy-MM-dd';
var timeFormatString = 'HH:mm:ss';

/**
 * Initialization function to grab things we need before doing anything else (e.g. user
 * preferences).  This function is asynchronous and requires that you pass it a continuation.
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
*/

function formatDateTime(d) {
	return formatDate(d) + ' ' + formatTime(d);
}

/**
*/

function formatDateString(s) {
	if (s === '' || s === '0000-00-00' || s === '0000-00-00 00:00:00') {
		return '[UNKNOWN]';
	}
	return formatDate(new Date(s));
}

/**
*/

function formatTimeString(s) {
	if (s === '' || s === '0000-00-00' || s === '0000-00-00 00:00:00') {
		return '[UNKNOWN]';
	}
	return formatTime(new Date(s));
}

/**
*/

function formatDateTimeString(s) {
	if (s === '' || s === '0000-00-00' || s === '0000-00-00 00:00:00') {
		return '[UNKNOWN]';
	}
	formatDateTime(new Date(s));
}

/**
*/

function removeZeroDates(x) {
	return x === '0000-00-00' ? '' : x;
}

/**
*/

function removeZeroDateTimes(x) {
	return x === '0000-00-00 00:00:00' ? '' : x;
}

var DATE_ONLY_REGEXP = /^\d\d\d\d-\d\d-\d\d$/;

/**
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

// Event Handling {{{1

function mixinEventHandling(obj, name, events) {
	obj.events = objFromArray(events);

	// #_initEventHandlers {{{2

	obj.prototype._initEventHandlers = function () {
		var self = this;

		if (self.eventHandlers === undefined) {
			self.eventHandlers = {};

			_.each(obj.events, function (evt) {
				self.eventHandlers[evt] = [];
			});
		}
	};

	// #on {{{2

	obj.prototype.on = function (evt, cb, opts) {
		var self = this
			, myName = typeof name === 'function' ? name(self) : name;

		opts = opts || {};

		self._initEventHandlers();

		if (obj.events[evt] === undefined) {
			throw new Error('Unable to register handler on ' + myName + ' for "' + evt + '" event: no such event available');
		}

		self.eventHandlers[evt].push({
																 who: opts.who,
																 cb: cb,
																 limit: opts.limit
		});

		return self;
	};

	// #off {{{2

	obj.prototype.off = function (evt, who) {
		var self = this
			, myName = typeof name === 'function' ? name(self) : name;

		self._initEventHandlers();

		if (evt === '*') {
			_.each(obj.events, function (e) {
				self.off(e, who);
			});
			return;
		}

		if (obj.events[evt] === undefined) {
			throw new Error('Unable to register handler on ' + myName + ' for "' + evt + '" event: no such event available');
		}

		var startLen = self.eventHandlers[evt].length;

		self.eventHandlers[evt] = _.reject(self.eventHandlers[evt], function (h) {
			return h.who === who;
		});

		var endLen = self.eventHandlers[evt].length;

		//debug.info(myName + ' // OFF', 'Removed ' + (startLen - endLen) + ' handlers from ' + who + ' on "' + evt + '" event');
	};

	// #fire {{{2

	/**
	 * @param {string} event
	 *
	 * @param {object} opts
	 *
	 * @param {boolean} opts.silent
	 * If true, don't print a debugging log entry for sending the event.  This is useful for some
	 * really spammy events which would otherwise slow down the console.
	 *
	 * @param {object|Array.<object>|function} opts.notTo
	 * Indicates entities which should not receive the event.  Can either be the entity itself, a list
	 * of entities, or a function which returns true when passed an entity which shouldn't receive the
	 * event.  An entity here is registered in the `who` property of the handler.
	 */

	obj.prototype.fire = function () {
		var self = this
			, args = Array.prototype.slice.call(arguments)
			, evt = args.shift()
			, opts = args.shift() || {}
			, myName = typeof name === 'function' ? name(self) : name;

		self._initEventHandlers();

		if (obj.events[evt] === undefined) {
			throw new Error('Illegal event: ' + evt);
		}

		var handlers = [];

		for (var i = 0; i < self.eventHandlers[evt].length; i += 1) {
			var handler = self.eventHandlers[evt][i];

			// Check to see if this handler is for someone we shouldn't be sending to.
			//
			//   - `notTo` is an array (check memberof)
			//   - `notTo` is a function returning true
			//   - `notTo` is an object (direct comparison)

			if (handler.who && opts.notTo &&
					((_.isArray(opts.notTo) && opts.notTo.indexOf(handler.who) >= 0)
						|| (typeof opts.notTo === 'function' && opts.notTo(handler.who))
						|| (typeof opts.notTo === 'object' && opts.notTo === handler.who))) {
				continue;
			}

			handlers.push({
										handler: handler,
										index: i
			});
		}

		// Print a debugging message unless invoked with the silent option (used internally to prevent
		// spamming millions of messages, which slows down the console).

		if (!opts.silent) {
			debug.info(myName + ' // FIRE', 'Triggering "' + evt + '" event on ' + handlers.length + ' handlers:', args);
		}

		_.each(handlers, function (h) {
			h.handler.cb.apply(null, args);

			// Remove the handler if we've hit the limit of how many times we're supposed to invoke it.
			// Actually we just set the handler to null and remove it below.

			if (h.handler.limit) {
				h.handler.limit -= 1;
				if (h.handler.limit <= 0) {
					debug.info(myName + ' // FIRE', 'Removing "' + evt + '" event handler after reaching invocation limit');
					self.eventHandlers[evt][h.index] = null;
				}
			}
		});

		// Clean up handlers we removed (because they reached the limit).

		self.eventHandlers[evt] = _.without(self.eventHandlers[evt], null);
	};
}

// Delegate {{{1

function delegate(from, to, methods) {
	_.each(methods, function (m) {
		from.prototype[m] = function () {
			var args = Array.prototype.slice.call(arguments);
			return this[to][m].apply(this[to], args);
		};
	});
}

// CGI {{{1

// https://stackoverflow.com/questions/901115/

function getParamsFromUrl() {
	var match, key, val,
		pl     = /\+/g,  // Regex for replacing addition symbol with a space
		search = /([^&=]+)=?([^&]*)/g,
		decode = function (s) { return decodeURIComponent(s.replace(pl, " ")); },
		query  = window.location.search.substring(1),
		params = {};

	while (match = search.exec(query)) {
		key = decode(match[1]);
		val = decode(match[2]);
		if (params[key]) {
			if (!_.isArray(params[key])) {
				params[key] = [params[key]];
			}
			params[key].push(val);
		}
		else {
			params[key] = val;
		}
	}

	return params;
}
