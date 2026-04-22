import jQuery from 'jquery';
import {
	icon,
	makeSubclass,
	mixinEventHandling,
} from '../util/misc.js';
import { trans } from '../trans.js';

// PopupWindow {{{1

/**
 * A modal popup window that replaces jQuery UI's dialog widget.
 *
 * The window is always modal (with a backdrop overlay), supports dragging by the titlebar,
 * resizing via a corner handle, and has a built-in 100ms fade transition.
 *
 * @class
 *
 * @param {object} [options]
 * @param {string} [options.title] Window title text.
 * @param {number|string} [options.width=600] CSS width for the window.
 * @param {number|null} [options.maxHeight] Max-height for the content area.
 * @param {object} [options.position] Positioning spec: { my, at, of }.
 * @param {Element|jQuery} [options.content] Initial content element.
 * @param {Array} [options.buttons] Array of { icon, label, callback } specs.
 *
 * @property {object} ui
 * @property {jQuery} ui.overlay
 * @property {jQuery} ui.win
 * @property {jQuery} ui.titlebar
 * @property {jQuery} ui.title
 * @property {jQuery} ui.closeBtn
 * @property {jQuery} ui.content
 * @property {jQuery} ui.buttonbar
 * @property {jQuery} ui.resize
 */

var PopupWindow = makeSubclass('PopupWindow', Object, function (options) {
	var self = this;

	var opts = options || {};

	self._options = {
		title: opts.title || '',
		width: opts.width != null ? opts.width : 600,
		maxHeight: opts.maxHeight || null,
		position: opts.position || { my: 'center', at: 'center', of: window }
	};

	self.ui = {};
	self._destroyed = false;
	self._prevFocus = null;
	self._dragState = null;
	self._resizeState = null;

	self._build();

	if (opts.content) {
		self.setContent(opts.content);
	}

	if (opts.buttons) {
		self.setButtons(opts.buttons);
	}
});

// Events {{{2

/**
 * Fired when the window is opened.
 * @event PopupWindow#open
 */

/**
 * Fired when the window is closed.
 * @event PopupWindow#close
 */

mixinEventHandling(PopupWindow, ['open', 'close']);

// #_build {{{2

/**
 * Build the DOM structure for the popup window.
 * @private
 */

PopupWindow.prototype._build = function () {
	var self = this;

	// Generate a unique ID for aria-labelledby.
	var titleId = 'wcdv-pw-title-' + Math.random().toString(36).substr(2, 9);

	self.ui.title = jQuery('<span>', {
		'class': 'wcdv-popup-window-title',
		id: titleId
	}).text(self._options.title);

	self.ui.closeBtn = jQuery('<button>', {
		'class': 'wcdv-popup-window-close',
		'aria-label': trans('POPUP_WINDOW.CLOSE'),
		type: 'button'
	}).append(icon('x'))
		.on('click', function () {
			self.close();
		});

	self.ui.titlebar = jQuery('<div>', {
		'class': 'wcdv-popup-window-titlebar'
	}).append(self.ui.title)
		.append(self.ui.closeBtn);

	self.ui.content = jQuery('<div>', {
		'class': 'wcdv-popup-window-content'
	});

	if (self._options.maxHeight) {
		self.ui.content.css('max-height', self._options.maxHeight + 'px');
	}

	self.ui.buttonbar = jQuery('<div>', {
		'class': 'wcdv-popup-window-buttonbar wcdv_button_bar'
	}).hide();

	self.ui.resize = jQuery('<div>', {
		'class': 'wcdv-popup-window-resize'
	});

	self.ui.win = jQuery('<div>', {
		'class': 'wcdv-popup-window',
		role: 'dialog',
		'aria-modal': 'true',
		'aria-labelledby': titleId,
		tabindex: '-1'
	}).css('width', self._options.width)
		.append(self.ui.titlebar)
		.append(self.ui.content)
		.append(self.ui.buttonbar)
		.append(self.ui.resize);

	self.ui.overlay = jQuery('<div>', {
		'class': 'wcdv-popup-window-overlay'
	}).append(self.ui.win);

	self._initDrag();
	self._initResize();
	self._initKeyboard();
};

// #open {{{2

/**
 * Open the popup window, appending it to the document body and fading it in.
 */

PopupWindow.prototype.open = function () {
	var self = this;

	if (self._destroyed) {
		return;
	}

	self._prevFocus = document.activeElement;

	// Force the initial state for the CSS transition.
	self.ui.overlay.css('opacity', 0);
	self.ui.overlay.appendTo(document.body);

	self._applyPosition();

	// Trigger reflow, then fade in.
	void self.ui.overlay[0].offsetHeight;
	self.ui.overlay.css('opacity', 1);

	self.ui.win.focus();
	self._initFocusTrap();

	self.fire('open');
};

// #close {{{2

/**
 * Close the popup window with a fade-out, then remove it from the DOM.
 */

PopupWindow.prototype.close = function () {
	var self = this;

	if (self._destroyed) {
		return;
	}

	self.ui.overlay.css({
		'opacity': 0,
		'pointer-events': 'none'
	});

	setTimeout(function () {
		self.ui.overlay.detach();
		self.ui.overlay.css('pointer-events', '');

		// Restore focus to the previously focused element.
		if (self._prevFocus && self._prevFocus.focus) {
			self._prevFocus.focus();
		}

		self.fire('close');
	}, 100);
};

// #destroy {{{2

/**
 * Destroy the popup window.  Removes all DOM elements and unbinds all events.
 */

PopupWindow.prototype.destroy = function () {
	var self = this;

	if (self._destroyed) {
		return;
	}

	self._destroyed = true;

	self.ui.overlay.remove();
	self.ui = {};
	self._prevFocus = null;
	self._dragState = null;
	self._resizeState = null;
};

// #setTitle {{{2

/**
 * Set the title text of the popup window.
 *
 * @param {string} text
 */

PopupWindow.prototype.setTitle = function (text) {
	var self = this;

	self.ui.title.text(text);
};

// #setContent {{{2

/**
 * Set the content of the popup window.  The content area is emptied and the given element is
 * appended.
 *
 * @param {Element|jQuery} elt
 * A DOM element or jQuery object to place inside the content area.
 */

PopupWindow.prototype.setContent = function (elt) {
	var self = this;

	self.ui.content.empty().append(elt);
};

// #setButtons {{{2

/**
 * Set the buttons displayed at the bottom of the popup window.
 *
 * @param {Array} buttonSpecs
 * Array of objects, each with:
 *   - {string} icon - Lucide icon name
 *   - {string} label - Button text
 *   - {function} callback - Click handler
 */

PopupWindow.prototype.setButtons = function (buttonSpecs) {
	var self = this;

	self.ui.buttonbar.empty();

	if (!buttonSpecs || buttonSpecs.length === 0) {
		self.ui.buttonbar.hide();
		return;
	}

	for (var i = 0; i < buttonSpecs.length; i++) {
		(function (spec) {
			var btn = jQuery('<button>', {
				'class': 'wcdv-popup-window-btn',
				type: 'button'
			});

			if (spec.icon) {
				btn.append(icon(spec.icon));
			}

			if (spec.label) {
				btn.append(jQuery('<span>').text(spec.label));
				btn.attr('title', spec.label);
			}

			if (spec.attrs) {
				btn.attr(spec.attrs);
			}

			btn.on('click', function () {
				if (typeof spec.callback === 'function') {
					spec.callback();
				}
			});

			self.ui.buttonbar.append(btn);
		})(buttonSpecs[i]);
	}

	self.ui.buttonbar.show();
};

// #_applyPosition {{{2

/**
 * Position the window according to the position option.
 * Supports a simplified version of jQuery UI's { my, at, of } spec.
 * @private
 */

PopupWindow.prototype._applyPosition = function () {
	var self = this;

	var pos = self._options.position;
	var win = self.ui.win[0];
	var winRect = win.getBoundingClientRect();
	var target = pos.of;
	var targetRect;

	if (target === window || target == null) {
		targetRect = {
			top: 0,
			left: 0,
			bottom: window.innerHeight,
			right: window.innerWidth,
			width: window.innerWidth,
			height: window.innerHeight
		};
	}
	else {
		var targetElt = target instanceof jQuery ? target[0] : target;
		targetRect = targetElt.getBoundingClientRect();
	}

	// Compute the anchor point on the target ('at').
	var atParts = (pos.at || 'center').split(/\s+/);
	var atH = atParts[0] || 'center';
	var atV = atParts.length > 1 ? atParts[1] : atH;
	var anchorX = self._resolveH(atH, targetRect);
	var anchorY = self._resolveV(atV, targetRect);

	// Compute the offset on the window ('my').
	var myParts = (pos.my || 'center').split(/\s+/);
	var myH = myParts[0] || 'center';
	var myV = myParts.length > 1 ? myParts[1] : myH;
	var offsetX = self._resolveH(myH, { left: 0, right: winRect.width, width: winRect.width });
	var offsetY = self._resolveV(myV, { top: 0, bottom: winRect.height, height: winRect.height });

	var left = anchorX - offsetX;
	var top = anchorY - offsetY;

	// Clamp to viewport.
	var vpW = window.innerWidth;
	var vpH = window.innerHeight;
	if (left + winRect.width > vpW) {
		left = vpW - winRect.width;
	}
	if (left < 0) {
		left = 0;
	}
	if (top + winRect.height > vpH) {
		top = vpH - winRect.height;
	}
	if (top < 0) {
		top = 0;
	}

	self.ui.win.css({
		position: 'fixed',
		left: left + 'px',
		top: top + 'px'
	});
};

// #_resolveH {{{2

/**
 * Resolve a horizontal keyword to a pixel value within a rect.
 * @private
 */

PopupWindow.prototype._resolveH = function (keyword, rect) {
	if (keyword === 'left') {
		return rect.left;
	}
	if (keyword === 'right') {
		return rect.left + rect.width;
	}
	// center
	return rect.left + rect.width / 2;
};

// #_resolveV {{{2

/**
 * Resolve a vertical keyword to a pixel value within a rect.
 * @private
 */

PopupWindow.prototype._resolveV = function (keyword, rect) {
	if (keyword === 'top') {
		return rect.top;
	}
	if (keyword === 'bottom') {
		return rect.top + rect.height;
	}
	// center
	return rect.top + rect.height / 2;
};

// #_initDrag {{{2

/**
 * Set up titlebar dragging.
 * @private
 */

PopupWindow.prototype._initDrag = function () {
	var self = this;

	self.ui.titlebar.on('mousedown', function (e) {
		// Don't drag when clicking the close button.
		if (jQuery(e.target).closest('.wcdv-popup-window-close').length) {
			return;
		}

		e.preventDefault();
		var winPos = self.ui.win[0].getBoundingClientRect();
		self._dragState = {
			startX: e.clientX,
			startY: e.clientY,
			origLeft: winPos.left,
			origTop: winPos.top
		};

		jQuery(document).on('mousemove.wcdvpwdrag', function (e) {
			if (!self._dragState) {
				return;
			}
			var dx = e.clientX - self._dragState.startX;
			var dy = e.clientY - self._dragState.startY;
			self.ui.win.css({
				left: (self._dragState.origLeft + dx) + 'px',
				top: (self._dragState.origTop + dy) + 'px'
			});
		}).on('mouseup.wcdvpwdrag', function () {
			self._dragState = null;
			jQuery(document).off('.wcdvpwdrag');
		});
	});
};

// #_initResize {{{2

/**
 * Set up corner resize handle.
 * @private
 */

PopupWindow.prototype._initResize = function () {
	var self = this;

	self.ui.resize.on('mousedown', function (e) {
		e.preventDefault();
		var winRect = self.ui.win[0].getBoundingClientRect();
		self._resizeState = {
			startX: e.clientX,
			startY: e.clientY,
			origWidth: winRect.width,
			origHeight: winRect.height
		};

		jQuery(document).on('mousemove.wcdvpwresize', function (e) {
			if (!self._resizeState) {
				return;
			}
			var dx = e.clientX - self._resizeState.startX;
			var dy = e.clientY - self._resizeState.startY;
			var newW = Math.max(200, self._resizeState.origWidth + dx);
			var newH = Math.max(100, self._resizeState.origHeight + dy);
			self.ui.win.css({
				width: newW + 'px',
				height: newH + 'px'
			});
		}).on('mouseup.wcdvpwresize', function () {
			self._resizeState = null;
			jQuery(document).off('.wcdvpwresize');
		});
	});
};

// #_initKeyboard {{{2

/**
 * Set up keyboard handling (ESC to close).
 * @private
 */

PopupWindow.prototype._initKeyboard = function () {
	var self = this;

	self.ui.overlay.on('keydown', function (e) {
		if (e.keyCode === 27) { // ESC
			e.stopPropagation();
			self.close();
		}
	});
};

// #_initFocusTrap {{{2

/**
 * Trap focus within the popup window so that Tab and Shift+Tab cycle through
 * focusable elements inside the dialog.
 * @private
 */

PopupWindow.prototype._initFocusTrap = function () {
	var self = this;

	self.ui.overlay.off('keydown.wcdvpwfocus').on('keydown.wcdvpwfocus', function (e) {
		if (e.keyCode !== 9) { // Tab
			return;
		}

		var focusable = self.ui.win.find(
			'a[href], button:not([disabled]), textarea:not([disabled]), ' +
			'input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])'
		);

		if (focusable.length === 0) {
			e.preventDefault();
			return;
		}

		var first = focusable.first()[0];
		var last = focusable.last()[0];

		if (e.shiftKey) {
			if (document.activeElement === first) {
				e.preventDefault();
				last.focus();
			}
		}
		else {
			if (document.activeElement === last) {
				e.preventDefault();
				first.focus();
			}
		}
	});
};

// }}}

export { PopupWindow };
