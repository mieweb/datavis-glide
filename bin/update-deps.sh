#!/usr/bin/env bash

set -o errexit
set -o nounset
set -o pipefail
# set -o xtrace

# There's probably a better way to do this in Make.

main() {
	local src=node_modules
	local dest=tests/pages
	local -a files
	files+=(jquery/dist/jquery.min.js)
	files+=(jquery-ui/dist/jquery-ui.min.js jquery-ui/dist/themes/base/jquery-ui.min.css)
	files+=(jquery-contextmenu/dist/jquery.contextMenu.min.{js,css})
	files+=(sumoselect/jquery.sumoselect.min.js sumoselect/sumoselect.min.css)
	files+=(flatpickr/dist/flatpickr.min.{js,css})
	files+=(normalize.css/normalize.css)
	files+=(bulma/css/bulma.min.css)
	cp -v "${files[@]/#/$src/}" $dest
	rsync -av $src/jquery-ui/themes/base/images/ $dest/images/
}

main "$@"
