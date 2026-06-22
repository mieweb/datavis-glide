import jQuery from 'jquery';

import {
	makeSubclass,
} from '../util/misc.js';

var Toast = makeSubclass('Toast', Object, function () {
	var self = this;

	self._hideTimer = null;

	self.ui = {
		root: jQuery('<div>', {
			'class': 'wcdv_toast',
			'role': 'status',
			'aria-live': 'polite',
			'aria-atomic': 'true'
		})
	};

	jQuery(document.body).append(self.ui.root);
});

Toast.prototype.show = function (text) {
	var self = this;

	if (self._hideTimer != null) {
		clearTimeout(self._hideTimer);
		self._hideTimer = null;
	}

	self.ui.root.text(text);
	self.ui.root.addClass('wcdv_toast_visible');

	self._hideTimer = setTimeout(function () {
		self.hide();
	}, 2000);
};

Toast.prototype.hide = function () {
	var self = this;

	if (self._hideTimer != null) {
		clearTimeout(self._hideTimer);
		self._hideTimer = null;
	}

	self.ui.root.removeClass('wcdv_toast_visible');
};

Toast.prototype.destroy = function () {
	var self = this;

	if (self._hideTimer != null) {
		clearTimeout(self._hideTimer);
		self._hideTimer = null;
	}

	if (self.ui != null && self.ui.root != null) {
		self.ui.root.remove();
	}
};

export default Toast;
