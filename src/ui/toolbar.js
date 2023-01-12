import {
	isVisible,
	makeSubclass,
} from '../util/misc.js';

// ToolbarSection {{{1

var ToolbarSection = makeSubclass('ToolbarSection', Object, function () {
	var self = this;

	self.ui = {};
	self.ui.root = jQuery('<div>');
});

// #attach {{{2

ToolbarSection.prototype.attach = function (parent) {
	var self = this;
	self.ui.root.appendTo(parent);
};

// #detach {{{2

ToolbarSection.prototype.detach = function () {
	var self = this;
	self.ui.root.remove();
};

// #show {{{2

ToolbarSection.prototype.show = function () {
	var self = this;
	self.update();
	self.ui.root.show();
};

// #hide {{{2

ToolbarSection.prototype.hide = function () {
	var self = this;
	self.ui.root.hide();
};

// #isVisible {{{2

ToolbarSection.prototype.isVisible = function () {
	var self = this;
	return isVisible(self.ui.root);
};

// #update {{{2

ToolbarSection.prototype.update = function () {
	// Do nothing.
};

// Exports {{{1

export {
	ToolbarSection,
};
