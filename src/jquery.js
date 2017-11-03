jQuery.fn.extend({
	_isChecked: function () {
		return jQuery(this).attr('checked');
	},
	_isDisabled: function () {
		return jQuery(this).attr('disabled');
	},
	_makeDraggableField: function () {
		return jQuery(this)
			.draggable({
				classes: {
					'ui-draggable-handle': 'wcdv_drag_handle'
				},
				distance: 8, // FIXME Deprecated [1.12]: replacement will be in 1.13
				helper: 'clone',
				revert: true,
				revertDuration: 0
			});
	},
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
