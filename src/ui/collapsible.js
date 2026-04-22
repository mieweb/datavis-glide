import jQuery from 'jquery';
import {
	icon,
	makeSubclass,
} from '../util/misc.js';

// Collapsible {{{1

/**
 * A lightweight accordion-style collapsible sections widget.
 *
 * Sections are added via {@link Collapsible#addSection}.  By default, clicking a header
 * calls {@link Collapsible#switchSection} which closes all other sections and opens the
 * clicked one (exclusive / accordion behavior).
 *
 * @class
 *
 * @param {Element|jQuery} container
 * The element the collapsible widget will be built inside.
 *
 * @property {object} ui
 * @property {jQuery} ui.root
 */

var Collapsible = makeSubclass('Collapsible', Object, function (container) {
	var self = this;

	self._container = jQuery(container);
	self._sections = [];
	self._idPrefix = 'wcdv-coll-' + Math.random().toString(36).substr(2, 9);
	self.ui = {};

	self._build();
});

// #_build {{{2

/**
 * Build the DOM skeleton for the collapsible widget.
 * @private
 */

Collapsible.prototype._build = function () {
	var self = this;

	self.ui.root = jQuery('<div>', {
		'class': 'wcdv-collapsible'
	});

	self._container.append(self.ui.root);
};

// #addSection {{{2

/**
 * Add a new collapsible section.
 *
 * @param {string} label
 * The text shown on the section header.
 *
 * @param {Element|jQuery} contentElt
 * The content element placed into the panel.
 *
 * @returns {number}
 * The zero-based index of the new section.
 */

Collapsible.prototype.addSection = function (label, contentElt) {
	var self = this;

	var index = self._sections.length;
	var headerId = self._idPrefix + '-header-' + index;
	var panelId = self._idPrefix + '-panel-' + index;

	var iconEl = jQuery('<span>', {
		'class': 'wcdv-collapsible-icon'
	}).append(icon('chevron-right'));

	var title = jQuery('<span>', {
		'class': 'wcdv-collapsible-title'
	}).text(label);

	var header = jQuery('<div>', {
		'class': 'wcdv-collapsible-header',
		id: headerId,
		role: 'button',
		'aria-expanded': 'false',
		'aria-controls': panelId,
		tabindex: '0'
	}).append(iconEl)
		.append(title);

	(function (idx) {
		header.on('click', function () {
			self.switchSection(idx);
		});
		header.on('keydown', function (e) {
			var key = e.which || e.keyCode;
			// Enter = 13, Space = 32
			if (key === 13 || key === 32) {
				e.preventDefault();
				self.switchSection(idx);
			}
		});
	})(index);

	var panel = jQuery('<div>', {
		'class': 'wcdv-collapsible-panel',
		role: 'region',
		id: panelId,
		'aria-labelledby': headerId
	}).append(jQuery(contentElt));

	var section = jQuery('<div>', {
		'class': 'wcdv-collapsible-section'
	}).append(header)
		.append(panel);

	self.ui.root.append(section);

	self._sections.push({
		label: label,
		sectionEl: section,
		headerEl: header,
		panelEl: panel,
		isOpen: false
	});

	// Auto-open first section.
	if (self._sections.length === 1) {
		self.openSection(0);
	}

	return index;
};

// #openSection {{{2

/**
 * Expand the section at the given index.
 *
 * @param {number} index
 * Zero-based section index.
 */

Collapsible.prototype.openSection = function (index) {
	var self = this;

	if (index < 0 || index >= self._sections.length) {
		return;
	}

	var sec = self._sections[index];
	if (sec.isOpen) {
		return;
	}

	sec.sectionEl.addClass('wcdv-collapsible-section-open');
	sec.headerEl.attr('aria-expanded', 'true');
	sec.isOpen = true;
};

// #closeSection {{{2

/**
 * Collapse the section at the given index.
 *
 * @param {number} index
 * Zero-based section index.
 */

Collapsible.prototype.closeSection = function (index) {
	var self = this;

	if (index < 0 || index >= self._sections.length) {
		return;
	}

	var sec = self._sections[index];
	if (!sec.isOpen) {
		return;
	}

	sec.sectionEl.removeClass('wcdv-collapsible-section-open');
	sec.headerEl.attr('aria-expanded', 'false');
	sec.isOpen = false;
};

// #switchSection {{{2

/**
 * Exclusive switch: close all other sections and open the specified one.
 * If the section is already the only one open, this is a no-op.
 *
 * @param {number} index
 * Zero-based section index.
 */

Collapsible.prototype.switchSection = function (index) {
	var self = this;

	if (index < 0 || index >= self._sections.length) {
		return;
	}

	for (var i = 0; i < self._sections.length; i++) {
		if (i !== index) {
			self.closeSection(i);
		}
	}

	self.openSection(index);
};

// #destroy {{{2

/**
 * Remove all DOM created by this widget and release references.
 */

Collapsible.prototype.destroy = function () {
	var self = this;

	if (self.ui.root) {
		self.ui.root.remove();
		self.ui.root = null;
	}
	self._sections = [];
	self._container = null;
};

export {
	Collapsible
};
