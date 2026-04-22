import jQuery from 'jquery';
import _ from 'underscore';
import sprintf from 'sprintf-js';
import JSONFormatter from 'json-formatter-js';
import { icons as lucideIcons } from 'lucide';

import { OrdMap, Lock, Util } from 'datavis-ace';

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

// icon {{{2

/**
 * Convert a kebab-case Lucide icon name to PascalCase for lookup in the icons object.
 *
 * @param {string} name
 * @returns {string}
 */

function lucideNameToPascal(name) {
	return name.split('-').map(function (part) {
		return part.charAt(0).toUpperCase() + part.slice(1);
	}).join('');
}

var SVG_NS = 'http://www.w3.org/2000/svg';

/**
 * Create an SVG element from Lucide icon data.
 *
 * @param {string} name Lucide icon name in kebab-case.
 * @returns {SVGSVGElement|null} The SVG element, or null if the icon was not found.
 */

export function createLucideSvg(name) {
	var pascalName = lucideNameToPascal(name);
	var iconData = lucideIcons[pascalName]; // eslint-disable-line import/namespace

	if (!iconData) {
		console.warn('[DataVis] Unknown Lucide icon: ' + name + ' (looked up as ' + pascalName + ')');
		return null;
	}

	var svg = document.createElementNS(SVG_NS, 'svg');
	svg.setAttribute('xmlns', SVG_NS);
	svg.setAttribute('width', '24');
	svg.setAttribute('height', '24');
	svg.setAttribute('viewBox', '0 0 24 24');
	svg.setAttribute('fill', 'none');
	svg.setAttribute('stroke', 'currentColor');
	svg.setAttribute('stroke-width', '2');
	svg.setAttribute('stroke-linecap', 'round');
	svg.setAttribute('stroke-linejoin', 'round');

	for (var i = 0; i < iconData.length; i++) {
		var tag = iconData[i][0];
		var attrs = iconData[i][1];
		var child = document.createElementNS(SVG_NS, tag);
		for (var key in attrs) {
			if (Object.prototype.hasOwnProperty.call(attrs, key)) {
				child.setAttribute(key, attrs[key]);
			}
		}
		svg.appendChild(child);
	}

	return svg;
}

/**
 * Create an icon element wrapped in jQuery.
 *
 * Accepts either a Lucide icon name (kebab-case, e.g. 'check') or a FontAwesome icon name
 * (e.g. 'fa-check'), which will be mapped to its Lucide equivalent.
 *
 * @param {string} icon The icon name.
 * @param {string} [cls] Additional CSS classes to add.
 * @param {string} [title] A title/tooltip for the icon.
 * @returns {jQuery} A jQuery-wrapped SVG element.
 */

export function icon(icon, cls, title) {
	var svg = createLucideSvg(icon);
	if (!svg) {
		// Fallback: create an empty span so callers don't break.
		return jQuery('<span>');
	}

	svg.classList.add('wcdv_icon');
	svg.setAttribute('data-icon', icon);

	if (cls != null) {
		_.each(cls, function (c) {
			svg.classList.add(c);
		});
	}

	if (title != undefined) {
		svg.setAttribute('title', title);
	}

	return jQuery(svg);
}

/**
 * Create a FontAwesome icon element (for backward compatibility with external consumers
 * that set iconType: 'fontawesome' on their operations).
 *
 * @param {string} faIcon The FA icon class name (e.g. 'fa-check').
 * @param {string} [cls] Additional CSS classes.
 * @param {string} [title] A title/tooltip for the icon.
 * @returns {jQuery}
 */

export function fontAwesome(icon, cls, title) {
	var span = jQuery('<span>')
		.addClass('fa');

	if (icon.substr(0, 3) === 'fa-') {
		span.addClass(icon);
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

		var showValueIcon = createLucideSvg('asterisk');
		showValueIcon.classList.add('wcdv_icon');
		showValueIcon.setAttribute('data-icon', 'asterisk');

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
		//       showValueIcon (svg.wcdv_icon)
		//     operationDiv (div)
		//       (button) (button) (button) ...
		//     container (div) <-- holds the actual data value

		cell.appendChild(wrapper);
		wrapper.appendChild(showValueBtn);
		showValueBtn.appendChild(showValueIcon);
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

function makeOperationIcon(op) {
	if (op.iconType === 'fontawesome') {
		return fontAwesome(op.icon).get(0);
	}
	return icon(op.icon).get(0);
}

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
		btn.appendChild(makeOperationIcon(op));
	}
	else {
		if (op.icon) {
			btn.appendChild(makeOperationIcon(op));
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

// Initialize date and time format strings from user preferences.  There doesn't seem to be a
// builtin way to convert the magick numbers into format strings, but since they're stored in the
// database it seems safe to assume that they won't change.

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
