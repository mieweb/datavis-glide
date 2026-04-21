import jQuery from 'jquery';
import {
	fontAwesome,
	makeSubclass,
} from '../util/misc.js';

// Constructor {{{1

/**
 * Create a new popup menu instance.  A popup menu displays a list of items, each with an icon and
 * label, and invokes a callback when the user clicks on one.
 *
 * @class
 * @property {Array} items
 * @property {object} ui
 * @property {HTMLElement|null} ui.root
 */

var PopupMenu = makeSubclass('PopupMenu', Object, function () {
	var self = this;

	self.items = [];
	self.ui = {
		root: null
	};
	self._boundClose = null;
});

// #addItem {{{1

/**
 * Add an item to the menu.
 *
 * @param {string} label
 * The text to display for this item.
 *
 * @param {string} iconName
 * A Lucide icon name (e.g. 'arrow-up-narrow-wide').
 *
 * @param {function} callback
 * Called when the item is clicked.  Receives `userdata` as its argument.
 *
 * @param {*} [userdata]
 * Arbitrary data passed to the callback when this item is clicked.
 */

PopupMenu.prototype.addItem = function (label, iconName, callback, userdata) {
	var self = this;

	self.items.push({
		label: label,
		iconName: iconName,
		callback: callback,
		userdata: userdata,
		separator: false
	});
};

// #addSeparator {{{1

/**
 * Add a visual separator to the menu.
 */

PopupMenu.prototype.addSeparator = function () {
	var self = this;

	self.items.push({
		separator: true
	});
};

// #open {{{1

/**
 * Open the popup menu.  If an anchor element is provided, the menu is positioned near it, taking
 * care to remain within the browser viewport.
 *
 * @param {HTMLElement|jQuery} [anchorElement]
 * Optional element to position the menu near.
 */

PopupMenu.prototype.open = function (anchorElement) {
	var self = this;

	// Close any previously open instance of this menu.
	self.close();

	var root = document.createElement('div');
	root.className = 'wcdv-popup-menu';
	root.setAttribute('role', 'menu');

	for (var i = 0; i < self.items.length; i++) {
		var entry = self.items[i];

		if (entry.separator) {
			var sep = document.createElement('div');
			sep.className = 'wcdv-popup-menu-sep';
			sep.setAttribute('role', 'separator');
			root.appendChild(sep);
			continue;
		}

		var item = document.createElement('div');
		item.className = 'wcdv-popup-menu-item';
		item.setAttribute('role', 'menuitem');

		if (entry.iconName) {
			var iconElt = fontAwesome(entry.iconName).get(0);
			if (iconElt) {
				item.appendChild(iconElt);
			}
		}

		var labelSpan = document.createElement('span');
		labelSpan.className = 'wcdv-popup-menu-item-label';
		labelSpan.textContent = entry.label || '';
		item.appendChild(labelSpan);

		// Bind the click handler using an IIFE to capture the current entry.
		(function (e) {
			item.addEventListener('click', function (evt) {
				evt.stopPropagation();
				self.close();
				if (typeof e.callback === 'function') {
					e.callback(e.userdata);
				}
			});
		})(entry);

		root.appendChild(item);
	}

	document.body.appendChild(root);
	self.ui.root = root;

	// Position the menu near the anchor element, clamped to the viewport.
	if (anchorElement) {
		var anchor = anchorElement instanceof jQuery ? anchorElement.get(0) : anchorElement;
		var rect = anchor.getBoundingClientRect();

		// Start below-left of the anchor.
		var top = rect.bottom;
		var left = rect.left;

		// Measure the menu now that it's in the DOM.
		var menuRect = root.getBoundingClientRect();
		var vpWidth = window.innerWidth;
		var vpHeight = window.innerHeight;

		// Clamp horizontally.
		if (left + menuRect.width > vpWidth) {
			left = vpWidth - menuRect.width;
		}
		if (left < 0) {
			left = 0;
		}

		// If the menu would overflow below, try placing it above the anchor.
		if (top + menuRect.height > vpHeight) {
			var above = rect.top - menuRect.height;
			if (above >= 0) {
				top = above;
			}
			else {
				// Neither fits perfectly; pick whichever side has more room.
				top = rect.top > (vpHeight - rect.bottom)
					? Math.max(0, rect.top - menuRect.height)
					: rect.bottom;
			}
		}

		root.style.position = 'fixed';
		root.style.top = top + 'px';
		root.style.left = left + 'px';
	}

	// Close when the user clicks outside the menu.
	self._boundClose = function (evt) {
		if (self.ui.root && !self.ui.root.contains(evt.target)) {
			self.close();
		}
	};

	// Use a timeout so the current click event doesn't immediately close the menu.
	setTimeout(function () {
		document.addEventListener('mousedown', self._boundClose, true);
	}, 0);
};

// #close {{{1

/**
 * Close the popup menu, removing it from the page.
 */

PopupMenu.prototype.close = function () {
	var self = this;

	if (self._boundClose) {
		document.removeEventListener('mousedown', self._boundClose, true);
		self._boundClose = null;
	}

	if (self.ui.root && self.ui.root.parentNode) {
		self.ui.root.parentNode.removeChild(self.ui.root);
	}
	self.ui.root = null;
};

// #destroy {{{1

/**
 * Destroy the popup menu, releasing all resources.
 */

PopupMenu.prototype.destroy = function () {
	var self = this;

	self.close();
	self.items = [];
};

export default PopupMenu;
