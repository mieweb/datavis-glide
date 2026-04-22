import jQuery from 'jquery';
import {
	makeSubclass,
} from '../util/misc.js';

// Tabs {{{1

/**
 * A lightweight tabbed interface widget.
 *
 * Pages are added via {@link Tabs#addPage} and switched via {@link Tabs#switchPage}.
 * The first page added is activated automatically.
 *
 * @class
 *
 * @param {Element|jQuery} container
 * The element the tabs widget will be built inside.
 *
 * @property {object} ui
 * @property {jQuery} ui.root
 * @property {jQuery} ui.nav
 */

var Tabs = makeSubclass('Tabs', Object, function (container) {
	var self = this;

	self._container = jQuery(container);
	self._pages = [];
	self._activeIndex = -1;
	self._idPrefix = 'wcdv-tabs-' + Math.random().toString(36).substr(2, 9);
	self.ui = {};

	self._build();
});

// #_build {{{2

/**
 * Build the DOM skeleton for the tabs widget.
 * @private
 */

Tabs.prototype._build = function () {
	var self = this;

	self.ui.nav = jQuery('<ul>', {
		'class': 'wcdv-tabs-nav',
		role: 'tablist'
	});

	self.ui.root = jQuery('<div>', {
		'class': 'wcdv-tabs'
	}).append(self.ui.nav);

	self._container.append(self.ui.root);
};

// #addPage {{{2

/**
 * Add a new tab page.
 *
 * @param {string} label
 * The text shown on the tab header.
 *
 * @param {Element|jQuery} contentElt
 * The content element placed into the panel.
 *
 * @returns {number}
 * The zero-based index of the new page.
 */

Tabs.prototype.addPage = function (label, contentElt) {
	var self = this;

	var index = self._pages.length;
	var tabId = self._idPrefix + '-tab-' + index;
	var panelId = self._idPrefix + '-panel-' + index;

	var tab = jQuery('<li>', {
		'class': 'wcdv-tabs-tab',
		role: 'tab',
		id: tabId,
		'aria-selected': 'false',
		'aria-controls': panelId,
		tabindex: index === 0 ? '0' : '-1'
	}).append(
		jQuery('<a>', {
			'class': 'wcdv-tabs-tab-link'
		}).text(label)
	);

	(function (idx) {
		tab.on('click', function (e) {
			e.preventDefault();
			self.switchPage(idx);
		});
		tab.on('keydown', function (e) {
			var key = e.which || e.keyCode;
			// Left arrow = 37, Right arrow = 39
			if (key === 37) {
				e.preventDefault();
				var prev = idx - 1;
				if (prev < 0) {
					prev = self._pages.length - 1;
				}
				self.switchPage(prev);
				self._pages[prev].tabEl.focus();
			}
			else if (key === 39) {
				e.preventDefault();
				var next = idx + 1;
				if (next >= self._pages.length) {
					next = 0;
				}
				self.switchPage(next);
				self._pages[next].tabEl.focus();
			}
		});
	})(index);

	var panel = jQuery('<div>', {
		'class': 'wcdv-tabs-panel',
		role: 'tabpanel',
		id: panelId,
		'aria-labelledby': tabId
	}).append(jQuery(contentElt));

	self.ui.nav.append(tab);
	self.ui.root.append(panel);

	self._pages.push({
		label: label,
		tabEl: tab,
		panelEl: panel
	});

	// Auto-activate first page.
	if (self._pages.length === 1) {
		self.switchPage(0);
	}

	return index;
};

// #switchPage {{{2

/**
 * Switch to the tab page at the given index.
 *
 * @param {number} index
 * Zero-based page index.
 */

Tabs.prototype.switchPage = function (index) {
	var self = this;

	if (index < 0 || index >= self._pages.length || index === self._activeIndex) {
		return;
	}

	// Deactivate current tab.
	if (self._activeIndex >= 0) {
		var cur = self._pages[self._activeIndex];
		cur.tabEl.removeClass('wcdv-tabs-tab-active')
			.attr('aria-selected', 'false')
			.attr('tabindex', '-1');
		cur.panelEl.removeClass('wcdv-tabs-panel-active');
	}

	// Activate new tab.
	var next = self._pages[index];
	next.tabEl.addClass('wcdv-tabs-tab-active')
		.attr('aria-selected', 'true')
		.attr('tabindex', '0');
	next.panelEl.addClass('wcdv-tabs-panel-active');

	self._activeIndex = index;
};

// #destroy {{{2

/**
 * Remove all DOM created by this widget and release references.
 */

Tabs.prototype.destroy = function () {
	var self = this;

	if (self.ui.root) {
		self.ui.root.remove();
		self.ui.root = null;
	}
	self.ui.nav = null;
	self._pages = [];
	self._activeIndex = -1;
	self._container = null;
};

export {
	Tabs
};
