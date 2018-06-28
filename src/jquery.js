/**
 * The jQuery plugin namespace.
 * @external "jQuery.fn"
 * @see {@link http://learn.jquery.com/plugins/|jQuery Plugins}
 */

jQuery.fn.extend({

	/**
	 * Tells whether the element is checked.
	 *
	 * @function external:"jQuery.fn"#_isChecked
	 *
	 * @returns {boolean}
	 * True if the element is checked, false if it's not.
	 */

	_isChecked: function () {
		return this.prop('checked');
	},

	/**
	 * Toggles the checkbox.
	 *
	 * @function external:"jQuery.fn"#_toggleCheck
	 *
	 * @returns {boolean}
	 * True if the element is now checked, false if it's not.
	 */

	_toggleCheck: function () {
		var newValue = !this.prop('checked');
		this.prop('checked', newValue);
		return newValue;
	},

	/**
	 * Tells whether the element is disabled.
	 *
	 * @function external:"jQuery.fn"#_isDisabled
	 *
	 * @returns {boolean}
	 * True if the element is disabled, false if it's not.
	 */

	_isDisabled: function () {
		return this.attr('disabled');
	},

	/**
	 * Tells whether the element is hidden.
	 *
	 * @function external:"jQuery.fn"#_isHidden
	 *
	 * @returns {boolean}
	 * True if the element is hidden, false if it's visible.
	 */

	_isHidden: function () {
		return this.css('display') === 'none' || this.css('visibility') !== 'visible';
	},

	_makeIconCheckbox: function (on, off) {
		var self = this;

		var button = jQuery('<button>', {'type': 'button'})
			.addClass('wcdv_icon_button wcdv_button_left')
			.on('click', function () {
				self._toggleCheck();
				self.trigger('change');
			})
		;
		var onIcon = fontAwesome(on).hide().appendTo(button);
		var offIcon = fontAwesome(off).hide().appendTo(button);

		var updateIcon = function () {
			if (self._isChecked()) {
				onIcon.show();
				offIcon.hide();
			}
			else {
				onIcon.hide();
				offIcon.show();
			}
		};

		updateIcon();
		self.hide();
		self.before(button);
		self.on('change', updateIcon);

		return self;
	},

	/**
	 * Adds debugging output for jQuery UI behavior events.
	 *
	 * @function external:"jQuery.fn"#_addEventDebugging
	 *
	 * @param {string} what
	 * The behavior to output debugging info for.  Must be: drag, drop, or sort.
	 *
	 * @param {string} tag
	 * Prefix to output at the beginning of the debug message.
	 */

	_addEventDebugging: function (what, tag) {
		switch (what) {
		case 'drag':
			this.on('dragstart', function (evt, ui) {
				console.log('### ' + tag + ' > DRAG.START: evt = %O, ui = %O', evt, ui);
			});
			this.on('dragstop', function (evt, ui) {
				console.log('### ' + tag + ' > DRAG.STOP: evt = %O, ui = %O', evt, ui);
			})
			break;
		case 'drop':
			this.on('dropactivate', function (evt, ui) {
				console.log('### ' + tag + ' > DROP.ACTIVATE: evt = %O, ui = %O', evt, ui);
			});
			this.on('dropdeactivate', function (evt, ui) {
				console.log('### ' + tag + ' > DROP.DEACTIVATE: evt = %O, ui = %O', evt, ui);
			})
			this.on('drop', function (evt, ui) {
				console.log('### ' + tag + ' > DROP.DROP: evt = %O, ui = %O', evt, ui);
			});
			break;
		case 'sort':
			this.on('sortreceive', function (evt, ui) {
				console.log('### ' + tag + ' > SORT.RECEIVE: evt = %O, ui = %O', evt, ui);
			});
			this.on('sortremove', function (evt, ui) {
				console.log('### ' + tag + ' > SORT.REMOVE: evt = %O, ui = %O', evt, ui);
			})
			this.on('sortstart', function (evt, ui) {
				console.log('### ' + tag + ' > SORT.START: evt = %O, ui = %O', evt, ui);
			});
			this.on('sortstop', function (evt, ui) {
				console.log('### ' + tag + ' > SORT.STOP: evt = %O, ui = %O', evt, ui);
			});
			this.on('sortactivate', function (evt, ui) {
				console.log('### ' + tag + ' > SORT.ACTIVATE: evt = %O, ui = %O', evt, ui);
			});
			this.on('sortdeactivate', function (evt, ui) {
				console.log('### ' + tag + ' > SORT.DEACTIVATE: evt = %O, ui = %O', evt, ui);
			});
			this.on('sortupdate', function (evt, ui) {
				console.log('### ' + tag + ' > SORT.UPDATE: evt = %O, ui = %O', evt, ui);
			});
			break;
		default:
			throw new Error('Call Error: Event type must be one of: ["drag", "drop", "sort"]');
		};
		return this;
	},

	/**
	 * Make this element draggable.
	 *
	 * @function external:"jQuery.fn"#_makeDraggableField
	 *
	 * @param {object} [opts]
	 * Change options passed to `draggable()`.
	 */

	_makeDraggableField: function (opts) {
		opts = deepDefaults(true, {
			classes: {
				'ui-draggable-handle': 'wcdv_drag_handle'
			},
			distance: 8, // FIXME Deprecated [1.12]: replacement will be in 1.13
			helper: 'clone',
			appendTo: document.body,
			revert: true,
			revertDuration: 0
		});
		this.attr('title', 'XXX'); // FIXME Without this, the 'content' property below does nothing!
		var tooltipContent = jQuery('<div>')
			.append(fontAwesome('fa-info-circle').css('padding-right', '0.25em').addClass('wcdv_text-primary'))
			.append('You can drag & drop this field into the grid controls above to filter, group or pivot.');
		this.tooltip({
			classes: {
				'ui-tooltip': 'ui-corner-all ui-widget-shadow ' + 'wcdv_info_tooltip wcdv_border-primary'
			},
			show: { delay: 2000 },
			content: tooltipContent
		});
		return this
			.draggable(opts);
	},

	/**
	 * Specify what to do when a file is dropped onto this element.
	 *
	 * ```
	 * $('#fileDropTarget')._onFileDrop(function (files) {
	 *   something.addFiles(files);
	 * });
	 * ```
	 *
	 * @function external:"jQuery.fn"#_onFileDrop
	 *
	 * @param {function} cb
	 * Function to call when the file is dropped; it is passed a `File` array.
	 */

	_onFileDrop: function (cb) {
		// https://www.html5rocks.com/en/tutorials/file/dndfiles/
		function handleFileSelect(evt) {
			evt.stopPropagation();
			evt.preventDefault();
			cb(evt.dataTransfer.files);
		}

		function handleDragOver(evt) {
			evt.stopPropagation();
			evt.preventDefault();

			// Things I've tried to determine file type in drag+drop:
			//
			//   evt.dataTransfer.items[0].type => MIME Type
			//
			// +---------+--------------------------------------+
			// | Browser | Result                               |
			// +=========+======================================+
			// | Chrome  | ** OK **                             |
			// | Firefox | ** OK **                             |
			// | IE11    | evt.dataTransfer.items doesn't exist |
			// | Safari  | evt.dataTransfer.items doesn't exist |
			// | Edge    | evt.dataTransfer.items[0].type = ''  |
			// +---------+--------------------------------------+
			//
			// Setting the dropEffect:
			//
			// +---------+-----------------------------+
			// | Browser | Result                      |
			// +=========+=============================+
			// | Chrome  | ** OK **                    |
			// | Firefox | ** OK **                    |
			// | IE11    | None (performs navigation)  |
			// | Safari  | ** OK **                    |
			// | Edge    | None (file always accepted) |
			// +---------+-----------------------------+

			evt.dataTransfer.dropEffect =
				getProp(evt.dataTransfer, 'items', 0, 'type') === 'text/csv' ? 'copy' : 'none';
		}

		this.get(0).addEventListener('dragover', handleDragOver, false);
		this.get(0).addEventListener('drop', handleFileSelect, false);
	}
});
