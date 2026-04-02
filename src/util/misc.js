import jQuery from 'jquery';
import _ from 'underscore';
import sprintf from 'sprintf-js';
import JSONFormatter from 'json-formatter-js';

import { OrdMap, Lock, Util } from 'datavis-ace';

// Functional {{{1

/**
 * @namespace util.functional
 */

/**
 * Y combinator.
 *
 * @memberof util.functional
 * @inner
 */

export function Y(f) {
	return (function (g) {
		return g(g);
	})(function (g) {
		return f(function () {
			return g(g).apply(this, arguments);
		});
	});
}

/**
 * Does nothing.
 *
 * @memberof util.functional
 * @inner
 */

export function NOP() {
	return;
}

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

export function chain() {
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

export function makeChain() {
	var fns = Array.prototype.slice.call(arguments);
	return function () {
		var args = Array.prototype.slice.call(arguments);
		return chain.apply(null, Array.prototype.concat.call([args], fns));
	};
}

export function makeArray() {
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
export function trulyYours(cont, spec, thisArg, acc) {
	acc = acc || {};
	return (spec.length === 0) ? cont(acc) : (function () {
		console.debug('[DataVis // Truly Yours] Calling #%s() to set property .%s', spec[0].fn, spec[0].prop);
		return (thisArg[spec[0].fn].bind(thisArg))(function (y) {
			acc[spec[0].prop] = (spec[0].conv || Util.I)(y);
			return trulyYours(cont, spec.slice(1), thisArg, acc);
		});
	})();
}

export function asyncChain(fns, args, done) {
	var self = this;
	if (!_.isArray(fns)) {
		throw new Error('Call Error: `fns` must be an array');
	}
	if (!_.isArray(args)) {
		throw new Error('Call Error: `args` must be an array');
	}

	fns = Util.shallowCopy(fns);
	var g = function () {
		if (fns.length === 0) {
			return done();
		}
		fns.shift().apply(self, args.concat(g));
	};
	return g();
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

export function curry() {
	var curryArgs = Array.prototype.slice.call(arguments);
	var fn = curryArgs.shift();
	var placeholderIndex = curryArgs.indexOf('#');
	return function () {
		var args = Array.prototype.slice.call(arguments);
		var fnArgs = curryArgs.slice();
		var spliceArgs = placeholderIndex === -1 ? [fnArgs.length, 0] : [placeholderIndex, 1];
		Array.prototype.splice.apply(fnArgs, spliceArgs.concat(args));
		return fn.apply(this, fnArgs);
	};
}

export function curryCtor() {
	var args = Array.prototype.slice.call(arguments)
		, result = curry.apply(null, args);
	result.prototype = args[0].prototype;
	return result;
}

export function either() {
	var args = Array.prototype.slice.call(arguments);
	for (var i = 0; i < args.length; i += 1) {
		if (args[i] !== undefined) {
			return args[i];
		}
	}
	return undefined;
}

// Conversion {{{1

/**
 * @namespace util.conversion
 */

export var parseNumber = (function () {
  var re_number = new RegExp(/(^-?[1-9]{1}[0-9]{0,2}(,?\d{3})*(\.\d+)?(e[+-]?\d+)?$)|(^0(e[+-]?\d+)?$)|(^-?0?\.\d+(e[+-]?\d+)?$)/);
	var re_comma = new RegExp(/,/g);
  return function p(s, resultType) {
		if (typeof s !== 'string') {
			throw new Error('Call Error: `s` must be a string');
		}
		if (resultType != null && typeof resultType !== 'string') {
			throw new Error('Call Error: `resultType` must be null or a string');
		}

		if (resultType == null) {
			resultType = 'number';
		}

		if (['number', 'string'].indexOf(resultType) < 0) {
			throw new Error('Call Error: `resultType` must be one of: ["number", "string"]');
		}

    if (s.charAt(0) === '$') {
      return p(s.substring(1));
    }
    else if (s.charAt(0) === '(' && s.charAt(-1) === ')') {
      return p(s.substring(1, s.length - 1)) * -1;
    }
    else {
      return !re_number.test(s) ? null
        : s.indexOf('.') >= 0 || s.indexOf('e') >= 0 ? (resultType === 'number' ? parseFloat : Util.I)(s.replace(re_comma, ''))
        : (resultType === 'number' ? parseInt : Util.I)(s.replace(re_comma, ''));
    }
  };
})();

/**
 * Convert from a string to an integer.
 *
 * @param {any} x Value to attempt to convert.
 *
 * @returns {number} The value as an integer number, or 0 if the value is not something which can
 * be converted cleanly.
 */

export function tryIntConvert(x) {
	return Util.isInt(x) ? Util.toInt(x) : 0;
}

/**
 * Convert from a string to a float.
 *
 * @param {any} x Value to attempt to convert.
 *
 * @returns {number} The value as a floating point number, or 0.0 if the value is not something
 * which can be converted cleanly.
 */

export function tryFloatConvert(x) {
	return Util.isFloat(x) ? Util.toFloat(x) : 0.0;
}

// Data Structures {{{1

/**
 * @namespace util.data_structures
 */

export function moveArrayElement(a, fromIdx, toIdx) {
	var elt = a[fromIdx];
	a.splice(fromIdx, 1);
	a.splice(toIdx, 0, elt);
}

/**
 * Calls a function on each element in a list until a certain value is returned.
 *
 * @memberof util.data_structures
 * @inner
 *
 * @param {array} l List to iterate over.
 * @param {function} f Function to invoke on each element.  Called like: f(item, index).
 * @param {any} r Return value that causes the iteration to abort.
 *
 * @returns {void} Nothing.
 */

export function eachUntil(l, f, r) {
	var i;
	for (i = 0; i < l.length; i += 1) {
		if (f(l[i], i) === r) {
			return;
		}
	}
}

/**
 * Map a function over an array, stopping after a preset number of elements.
 *
 * @memberof util.data_structures
 * @inner
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

export function mapLimit(a, f, l) {
	var result = [];
	for (var i = 0; i < Math.min(a.length, l); i += 1) {
		result.push(f(a[i], i));
	}
	return result;
}

/**
 * Throw an exception if a property is missing.
 *
 * @param {function} exn Constructor used to instantiate an exception if an error arises.
 * @param {object} obj Target object to search within.
 * @param {...(string|number)} prop Property path.
 */

export function needProp() {
	var args = Array.prototype.slice.call(arguments)
		, exn = args.shift()
		, prop = Util.getProp.apply(this, args);

	if (prop === undefined) {
		throw new exn('Missing property: [' + args.slice(1).join('.') + ']');
	}

	return prop;
}

/**
 * Throw an exception if a property is missing or not a member of a set.
 *
 * @param {object} obj Target object to search within.
 * @param {...(string|number)} prop Property path.
 * @param {array} arr Set of values which the property must be in.
 */

export function needPropIn() {
	var args = Array.prototype.slice.call(arguments)
		, set = args.pop()
		, prop = needProp.apply(this, args);

	if (set.indexOf(prop) === -1) {
		throw new Error('Property [' + args.slice(1).join('.') + '] must be one of: {"' + set.join('", "') + '"}');
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

export function needPropArr() {
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

export function needPropObj() {
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

export function needPropInst() {
	var args = Array.prototype.slice.call(arguments)
		, exn = args[0]
		, cls = args.pop()
		, prop = needProp.apply(this, args);

	if (!(prop instanceof cls)) {
		throw new exn('Property [' + args.slice(1).join('.') + '] must be an instance of ' + cls.name);
	}

	return prop;
}

export function needArgInst(val, varName, cls) {
	needArg(val, varName);
	var msg = arguments.callee.name + '(): Argument "' + varName + '" must be an instance of ' + cls.name;

	if (!(val instanceof cls)) {
		console.error(msg + ', received: %O', val);
		throw new Error(msg);
	}

	return val;
}

export function needArg(val, varName) {
	var msg = arguments.callee.name + '(): Missing required argument "' + varName + '"';

	if (Util.isNothing(val)) {
		throw new Error(msg);
	}

	return val;
}

export function iota(a, b, step) {
	var r = []
		, start
		, end;

	if (b == null) {
		start = 0;
		end = a;
	}
	else {
		start = a;
		end = b;
	}

	if (step == null) {
		step = 1;
	}

	for (var i = start; i <= end; i += step) {
		r.push(i);
	}

	return r;
}

/**
 * Prune a subtree in an object.  This means to prune the leaf, and then if there are no other
 * leaves on that branch, prune the branch, and so on all the way up.
 *
 * @example pruneTree(OBJECT, PATH...)
 */

export function pruneTree() {
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
		if (!Util.isEmpty(deleteFrom[i])) {
			break;
		}
	}
}

/**
 * Stable sort algorithm that allows for responsive browser UI.
 */

export function mergeSort(data, cmp, cont) {
	cmp = cmp || Util.universalCmp;
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

export function mergeSort2(data, cmp) {
	cmp = cmp || function (a, b) { return a < b; };

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

export function mergeSort3(data, cmp, cont, update) {
	cmp = cmp || function (a, b) { return a < b; };
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

export function objGetPath(obj, fieldPath) {
	var i, len = fieldPath.length;
	for (i = 0; i < len && obj !== undefined; i += 1) {
		obj = obj[fieldPath[i]];
	}
	return obj;
}

export function cmpObjField(fieldPath, cmp) {
	cmp = cmp || Util.universalCmp;
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

// Locking {{{1

/**
 * @namespace util.locking
 */

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

export function lock(defn, name) {
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

export function unlock(defn, name) {
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

export function isLocked(defn, name) {
	return defn.locks && !!defn.locks[name];
}

// HTML {{{1

/**
 * @namespace util.html
 */

// outerHtml {{{2

/**
 * Returns the HTML used to construct the argument.
 */

export function outerHtml(elt) {
	return jQuery('<div>').append(elt).html();
}

// getText {{{2

/**
 * Get all the next nodes which are direct children of the specified nodes.
 *
 * @param selector jQuery selector used to search for nodes containing text
 * children.
 *
 * @return An array of strings, each element being the text of a node matched
 * by the specified selector.
 */

export function getText(selector) {
	return jQuery(selector).map(function (i, x) {
		return jQuery(x).text();
	});
}

// isVisible {{{2

export function isVisible(elt) {
	return elt.css('display') !== 'none' && elt.css('visibility') === 'visible';
}

// isElement {{{2

export function isElement(x) {
	return x instanceof Element || x instanceof jQuery;
}

// getElement {{{2

export function getElement(x) {
	return x instanceof Element ? x
		: x instanceof jQuery ? x.get(0)
		: null;
}

// isElementInViewport {{{2

/*
 * Taken from --
 *   https://stackoverflow.com/a/7557433/5628
 */

export function isElementInViewport (parent, elt) {
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

// onVisibilityChange {{{2

export function onVisibilityChange(parent, elt, callback) {
	var old_visible;
	return function () {
		var visible = isElementInViewport(parent, elt);
		if (visible !== old_visible) {
			if (old_visible !== undefined && typeof callback == 'function') {
				callback(visible);
			}
			old_visible = visible;
		}
	};
}

// addFocusHandler {{{2

export function addFocusHandler(elt, id, cb) {
	jQuery(document).on('click.focus-' + id, function (evt) {
		if (jQuery(evt.target).closest(document).length === 0) {
			// Clicked element no longer on the page; ignore!  This could happen when another click
			// handler on the element (e.g. a button) caused it to be removed (e.g. the clicked button
			// closed a dialog).  In this case, there's nothing for us to do.
			return;
		}
		if (jQuery(evt.target).closest(elt).length === 1) {
			elt.addClass('wcdv-focus');
			cb(true);
		}
		else {
			elt.removeClass('wcdv-focus');
			cb(false);
		}
	});
}

// removeFocusHandler {{{2

export function removeFocusHandler(id) {
	jQuery(document).off('click.focus-' + id);
}

// fontAwesome {{{2

export function fontAwesome(icon, cls, title) {
	var span = jQuery('<span>')
		.addClass('fa');

	if (icon.substr(0, 3) === 'fa-') {
		span.addClass(icon);
	}
	else {
		span.text(String.fromCharCode(parseInt(icon, 16)));
	}

	if (cls != undefined) {
		span.addClass(cls);
	}

	if (title != undefined) {
		span.attr('title', title);
	}

	return span;
}

// loadScript {{{2

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

export var loadScript = (function () {
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
					console.debug('[DataVis // Load Script] [url = %s] Already loaded', url);
				}
				else {
					console.debug('[DataVis // Load Script] [url = %s] Finished executing loaded script', url);
				}
			};

			if (opts.needAsyncSetup) {
				return function () {
					showLoadMsg();
					callback(isAlreadyLoaded, function () {
						console.debug('[DataVis // Load Script] [url = %s] Exiting control of the script loader', url);
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
					console.debug('[DataVis // Load Script] [url = %s] Exiting control of the script loader', url);
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
		}, sprintf.sprintf('Waiting to load [url = %s]', url));
	};
})();

// setTableCell {{{2

/**
 * Set the value of a table cell.
 *
 * @param {jQuery|HTMLTableCellElement} cell
 * @param {Element|jQuery|string|number} value
 * @param {object} opts
 * @param {string} opts.field
 * @param {OrdMap} opts.colConfig
 * @param {OrdMap} opts.typeInfo
 */

export function setTableCell(cell, value, opts) {
	opts = opts || {};

	var fcc = (opts.colConfig instanceof OrdMap && opts.colConfig.get(opts.field)) || opts.colConfig || {};
	var fti = (opts.typeInfo instanceof OrdMap && opts.typeInfo.get(opts.field)) || opts.typeInfo || {};
	var ops = opts.operations || [];

	if (cell instanceof jQuery) {
		cell = cell.get(0);
	}

	if (!(cell instanceof HTMLTableCellElement)) {
		throw new Error('Call Error: `cell` must be a HTMLTableCellElement instance');
	}

	var container = cell
		, wrapper
		, operationDiv;

	if (fcc.maxHeight != null && value !== '') {
		wrapper = document.createElement('div');
		wrapper.classList.add('wcdv_maxheight_wrapper');
		wrapper.style.maxHeight = fcc.maxHeight;

		if (fcc.width) {
			wrapper.classList.add('wcdv_maxheight_wrapper_withwidth');
			wrapper.style.width = fcc.width;
		}

		var showValueBtn = document.createElement('button');
		showValueBtn.setAttribute('title', 'Full value has been truncated; click to show it.');
		showValueBtn.classList.add('wcdv_icon_button');
		showValueBtn.classList.add('wcdv_icon_button_incell');
		showValueBtn.classList.add('wcdv_icon_button_nolabel');
		showValueBtn.classList.add('wcdv_show_full_value');

		var showValueSpan = document.createElement('span');
		showValueSpan.classList.add('fa');
		showValueSpan.classList.add('fa-asterisk');

		operationDiv = document.createElement('div');
		operationDiv.style.display = 'inline-block';
		operationDiv.style.float = 'right';

		_.each(ops, function (op, index) {
			operationDiv.appendChild(makeOperationButton('cell', op, index, {inCell: true}));
		});

		container = document.createElement('div');

		// cell (td)
		//   wrapper (div)
		//     showValueBtn (button)
		//       showValueSpan (span.fa)
		//     operationDiv (div)
		//       (button) (button) (button) ...
		//     container (div) <-- holds the actual data value

		cell.appendChild(wrapper);
		wrapper.appendChild(showValueBtn);
		showValueBtn.appendChild(showValueSpan);
		wrapper.appendChild(operationDiv);
		wrapper.appendChild(container);
	}
	else if (ops.length > 0) {
		wrapper = document.createElement('div');

		operationDiv = document.createElement('div');
		operationDiv.style.display = 'inline-block';
		operationDiv.style.float = 'right';

		_.each(ops, function (op, index) {
			var opBtn = makeOperationButton('cell', op, index, {inCell: true});
			if (op.disableWhen && op.disableWhen(value)) {
				opBtn.disabled = true;
			}
			if (op.hideWhen && op.hideWhen(value)) {
				opBtn.style.display = 'none';
			}

			operationDiv.appendChild(opBtn);
		});

		container = document.createElement('div');

		// cell (td)
		//   wrapper (div)
		//     operationDiv (div)
		//       (button) (button) (button) ...
		//     container (div) <-- holds the actual data value

		cell.appendChild(wrapper);
		wrapper.appendChild(operationDiv);
		wrapper.appendChild(container);
	}

	setElement(container, value, opts);
}

// setElement {{{2

/**
 * Set the value of an element.
 *
 * @param {jQuery|Element} container
 * @param {Element|jQuery|string|number} value
 * @param {object} opts
 * @param {string} opts.field
 * @param {OrdMap} opts.colConfig
 * @param {OrdMap} opts.typeInfo
 */

export function setElement(container, value, opts) {
	opts = opts || {};

	var fcc = (opts.colConfig instanceof OrdMap && opts.colConfig.get(opts.field)) || opts.colConfig || {};
	var fti = (opts.typeInfo instanceof OrdMap && opts.typeInfo.get(opts.field)) || opts.typeInfo || {};

	if (container instanceof jQuery) {
		container = container.get(0);
	}

	if (!(container instanceof Element)) {
		throw new Error('Call Error: `container` must be an Element instance');
	}

	if (value instanceof Element) {
		container.appendChild(value);
	}
	else if (value instanceof jQuery) {
		container.appendChild(value.get(0));
	}
	else if (fcc.allowHtml && fti.type === 'string') {
		container.innerHTML = value;
	}
	else if (value === '') {
		container.innerText = '\u00A0';
	}
	else {
		container.innerText = value;
	}
}

// makeOperationButton {{{2

export function makeOperationButton(type, op, index, opts) {
	opts = opts || {};

	_.defaults(opts, {
		inCell: false
	});

	var btn = document.createElement('button');
	btn.setAttribute('type', 'button');
	btn.setAttribute('data-operation-type', type);
	btn.setAttribute('data-operation-index', index);
	btn.classList.add('wcdv_operation');
	// Cell operations don't get labels, because they would take up too much space.
	if (type === 'cell') {
		btn.classList.add('wcdv_icon_button');
		btn.classList.add('wcdv_icon_button_incell');
		btn.classList.add('wcdv_icon_button_nolabel');
		btn.style.float = 'initial';
		btn.appendChild(fontAwesome(op.icon).get(0));
	}
	else {
		if (op.icon) {
			btn.appendChild(fontAwesome(op.icon).get(0));
		}
		if (op.label) {
			btn.classList.add('wcdv_nowrap');
			btn.append(op.label);
		}
		else {
			btn.classList.add('no_label');
		}
	}
	if (op.tooltip) {
		btn.setAttribute('title', op.tooltip);
	}
	return btn;
}

// makeCheckbox {{{2

export function makeCheckbox(startChecked, onChange, text, parent) {
	var label = jQuery('<label>');
	var input = jQuery('<input>', { 'type': 'checkbox', 'checked': startChecked }).on('change', onChange);

	label.append(input).append(text).appendTo(parent);

	return input;
}

// makeToggleCheckbox {{{2

export function makeToggleCheckbox(rootObj, path, startChecked, text, parent, after) {
	if (rootObj != null) {
		Util.setPropDef(startChecked, rootObj, path);
	}

	return makeCheckbox(rootObj != null ? Util.getProp(rootObj, path) : startChecked, function () {
		var isChecked = jQuery(this).prop('checked');
		if (rootObj != null) {
			console.debug('[DataVis // Grid // Toolbar] Setting `' + path.join('.') + '` to ' + isChecked);
			Util.setProp(isChecked, rootObj, path);
		}
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

export function makeRadioButtons(rootObj, path, def, label, name, values, conv, onChange, parent) {
	Util.setPropDef(def, rootObj, path);
	var initial = Util.getProp(rootObj, path);

	var root = jQuery('<div>').css('display', 'inline-block').appendTo(parent);

	var handler = function () {
		var selected = root.find('input[type=radio]:checked').val();
		if (typeof conv === 'function') {
			selected = conv(selected);
		}
		console.debug('[DataVis // Grid // Toolbar] Setting `' + path.join('.') + '` to ' + selected);
		Util.setProp(selected, rootObj, path);
		if (typeof onChange === 'function') {
			onChange(selected);
		}
	};

	if (label) {
		jQuery('<label>').text(label).appendTo(root);
	}
	_.each(values, function (v) {
		var label = _.isString(v) ? v : v.label;
		var value = _.isString(v) ? v : v.value;
		jQuery('<label>')
			.append(jQuery('<input>', { 'type': 'radio', 'name': name, 'value': value })
							.on('change', handler))
			.append(label)
			.appendTo(root);
	});
	root.find('input[type=radio]').val([initial]);
	return root;
}

// Input / Output {{{1

/**
 * @namespace util.io
 */

export function valueInfo(value) {
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

export function addSrcInfo(srcIndex, field) {
	return ':' + srcIndex + ':' + field;
}

// Date and Time Formatting {{{1

/**
 * @namespace util.datetime
 */

// Initialize date and time format strings from user preferences.  There doesn't seem to be a
// builtin way to convert the magick numbers into format strings, but since they're stored in the
// database it seems safe to assume that they won't change.

var dateFormatString = 'yyyy-MM-dd';
var timeFormatString = 'HH:mm:ss';

/**
 * Initialization function to grab things we need before doing anything else (e.g. user
 * preferences).  This function is asynchronous and requires that you pass it a continuation.
 */

export function init(cont) {
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

export function formatDate(d) {
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

export function formatTime(t) {
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

export function formatDateTime(d) {
	return formatDate(d) + ' ' + formatTime(d);
}

/**
*/

export function formatDateString(s) {
	if (s === '' || s === '0000-00-00' || s === '0000-00-00 00:00:00') {
		return '[UNKNOWN]';
	}
	return formatDate(new Date(s));
}

/**
*/

export function formatTimeString(s) {
	if (s === '' || s === '0000-00-00' || s === '0000-00-00 00:00:00') {
		return '[UNKNOWN]';
	}
	return formatTime(new Date(s));
}

/**
*/

export function formatDateTimeString(s) {
	if (s === '' || s === '0000-00-00' || s === '0000-00-00 00:00:00') {
		return '[UNKNOWN]';
	}
	formatDateTime(new Date(s));
}

/**
*/

export function removeZeroDates(x) {
	return x === '0000-00-00' ? '' : x;
}

/**
*/

export function removeZeroDateTimes(x) {
	return x === '0000-00-00 00:00:00' ? '' : x;
}

var DATE_ONLY_REGEXP = /^\d\d\d\d-\d\d-\d\d$/;

/**
*/

export function addTimeComponent(x) {
	return (typeof x === 'string' && DATE_ONLY_REGEXP.test(x)) ? x + ' 00:00:00' : x;
}

// Blocking {{{1

/**
 * @namespace util.blocking
 */

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

export function blockGrid(defn, fn, info) {
	var grid;
	var blockConfig;
	var output;

	if (defn.table.blockCount === undefined) {
		defn.table.blockCount = 0;
	}

	defn.table.blockCount += 1;

	console.debug('[DataVis // Blocking // Push] COUNT =', defn.table.blockCount, '> INFO =', info);

	if (defn.table.blockCount === 1) {
		output = Util.getProp(defn, 'table', 'output', 'method');

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

export function unblockGrid(defn, info) {
	var grid;
	var output;

	if (defn.table.blockCount === undefined) {
		defn.table.blockCount = 0;
	}

	if (defn.table.blockCount > 0) {
		defn.table.blockCount -= 1;
		console.debug('[DataVis // Blocking // Pop] COUNT =', defn.table.blockCount, '> INFO =', info);
		if (defn.table.blockCount === 0) {
			output = Util.getProp(defn, 'table', 'output', 'method');

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

export function gridIsBlocked(defn) {
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

export function withGridBlock(defn, fn, info) {
	if (typeof fn !== 'function') {
		throw Error('Call Error: `fn` must be a function');
	}

	blockGrid(defn, function () {
		// This shouldn't be necessary because we're doing it in BlockUI's onBlock event handler, but
		// for whatever reason it doesn't always work... oftentimes, when fn() executes, the element
		// is not visually blocked.  This seems to be much more consistent in how it looks.

		window.setTimeout(function () {
			fn();
			unblockGrid(defn, info);
		}, jQuery.blockUI.defaults.fadeIn);
	}, info);
}

// Downloading {{{1

/**
 * Present a blob as a download.  This works even in IE10!
 *
 * @param {Blob} blob
 * The content to download.
 *
 * @param {string} fileName
 * Default name to use for the file.
 */

export function presentDownload(blob, fileName) {
	if (!(blob instanceof Blob)) {
		throw new Error('Call Error: `blob` must be a Blob');
	}

	// IE11 supports Blob, but doesn't allow you to fake a click on the download link.  Fortunately
	// for us, it has a function which does all of that for you in one step!

	if (window.navigator.msSaveBlob != null) {
		window.navigator.msSaveBlob(blob, fileName);
	}
	else {
		var a = document.createElement('a');
		a.download = fileName;
		a.href = URL.createObjectURL(blob);
		jQuery(document.body).append(a);
		a.click();
		a.remove();
	}
}

// https://stackoverflow.com/a/12300351

/**
 * Convert a data URI to a blob which can be downloaded.  This works even in IE10!
 *
 * @param {string} dataURI
 * The URI to convert into a blob.
 *
 * @return {Blob}
 * A blob that can be downloaded.
 */

export function dataURItoBlob(dataURI) {
  // convert base64 to raw binary data held in a string
  // doesn't handle URLEncoded DataURIs - see SO answer #6850276 for code that does this
  var byteString = atob(dataURI.split(',')[1]);

  // separate out the mime component
  var mimeString = dataURI.split(',')[0].split(':')[1].split(';')[0];

  // write the bytes of the string to an ArrayBuffer
  var ab = new ArrayBuffer(byteString.length);

  // create a view into the buffer
  var ia = new Uint8Array(ab);

  // set the bytes of the buffer to the correct values
  for (var i = 0; i < byteString.length; i++) {
      ia[i] = byteString.charCodeAt(i);
  }

  // write the ArrayBuffer to a blob, and you're done
  var blob = new Blob([ab], {type: mimeString});
  return blob;

}

export function ordmapAsHtmlDefnList(o) {
	var dl = jQuery('<dl>');
	o.each(function (v, k) {
		var dt = jQuery('<dt>').text(k);
		var dd = jQuery('<dd>');
		if (v instanceof jQuery || v instanceof Element) {
			dd.append(v);
		}
		else if (_.isObject(v)) {
			dd.append(new JSONFormatter(v, 0).render());
		}
		else {
			dd.text(v);
		}
		jQuery('<div>')
			.append(dt)
			.append(dd)
			.appendTo(dl);
	});
	return dl;
}

// Misc {{{1

// sleep {{{2

export function sleep(ms) {
	var start = new Date();
	var end;
	do {
		end = new Date();
	}
	while (end - start < ms);
}

// EagerPipeline {{{1

export var EagerPipeline = Util.makeSubclass('EagerPipeline', Object, function (x) {
	this.x = x;
});

// #andThen {{{2

EagerPipeline.prototype.andThen = function (f) {
	var x = this.x;
	return new EagerPipeline(f(x));
};

// #andThenCurry {{{2

EagerPipeline.prototype.andThenCurry = function () {
	var f = curry.apply(null, arguments);
	return this.andThen(f);
};

// #done {{{2

EagerPipeline.prototype.done = function () {
	return this.x;
};


// Re-export Util members from datavis-ace for API compatibility.
export var {
	gensym,
	I,
	universalCmp,
	getComparisonFn,
	getNatRep,
	car,
	cdr,
	isInt,
	isFloat,
	toInt,
	toFloat,
	stringValueType,
	arrayCompare,
	arrayEqual,
	eachUntilObj,
	asyncEach,
	shallowCopy,
	deepCopy,
	arrayCopy,
	isNothing,
	isEmpty,
	deepDefaults,
	getProp,
	getPropDef,
	setProp,
	setPropDef,
	copyProps,
	interleaveWith,
	mergeSort4,
	pigeonHoleSort,
	objFromArray,
	walkObj,
	makeSubclass,
	makeSuper,
	mixinEventHandling,
	mixinLogging,
	makeSetters,
	delegate,
	mixinNameSetting,
	escapeHtml,
	logAsync,
	format,
	Timing,
	getParamsFromUrl,
	validateColConfig,
	determineColumns,
	uuid
} = Util;

// Polyfills {{{1

// https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/String/repeat

if (!String.prototype.repeat) {
  String.prototype.repeat = function(count) {
    'use strict';
    if (this == null) { // check if `this` is null or undefined
      throw new TypeError('can\'t convert ' + this + ' to object');
    }
    var str = '' + this;
    // To convert string to integer.
    count = +count;
    if (count < 0) {
      throw new RangeError('repeat count must be non-negative');
    }
    if (count == Infinity) {
      throw new RangeError('repeat count must be less than infinity');
    }
    count |= 0; // floors and rounds-down it.
    if (str.length == 0 || count == 0) {
      return '';
    }
    // Ensuring count is a 31-bit integer allows us to heavily optimize the
    // main part. But anyway, most current (August 2014) browsers can't handle
    // strings 1 << 28 chars or longer, so:
    if (str.length * count >= (1 << 28)) {
      throw new RangeError('repeat count must not overflow maximum string size');
    }
		// eslint-disable-next-line no-cond-assign
    while (count >>= 1) { // shift it by multiple of 2 because this is binary summation of series
       str += str; // binary summation
    }
    str += str.substring(0, str.length * count - str.length);
    return str;
  };
}

// https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/String/startsWith

if (!String.prototype.startsWith) {
    Object.defineProperty(String.prototype, 'startsWith', {
        value: function(search, rawPos) {
            var pos = rawPos > 0 ? rawPos|0 : 0;
            return this.substring(pos, pos + search.length) === search;
        }
    });
}

// https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/String/endsWith

if (!String.prototype.endsWith) {
  String.prototype.endsWith = function(search, this_len) {
    if (this_len === undefined || this_len > this.length) {
      this_len = this.length;
    }
    return this.substring(this_len - search.length, this_len) === search;
  };
}

// https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Number/isNaN

Number.isNaN = Number.isNaN || function(value) {
	return value !== value;
};

// https://developer.mozilla.org/en-US/docs/Web/API/Element/closest

if (!Element.prototype.matches) {
  Element.prototype.matches = Element.prototype.msMatchesSelector || Element.prototype.webkitMatchesSelector;
}

if (!Element.prototype.closest) {
  Element.prototype.closest = function(s) {
    var el = this;

    do {
      if (el.matches(s)) return el;
      el = el.parentElement || el.parentNode;
    } while (el !== null && el.nodeType === 1);
    return null;
  };
}
