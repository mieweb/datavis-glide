#!/usr/bin/env bash

set -o errexit
set -o nounset
set -o pipefail
# set -o xtrace

errmsg() {
    echo -e "$@" >&2
}

main() {
    local -a tests=(
        'active-row'
        'aggregate'
        'allowHtml'
        'auto-limit'
        'cancel'
        'colconfig'
        'date_filter'
        'dnd'
        'drilldown'
        'filter'
        'footer'
        'format-strings'
        # 'google-chart' -- completely unreliable on GitHub
        'group-funs'
        'multi-grid'
        'no-auto-save'
        'number-format-str'
        'operations'
        'prefs'
        'row-customization'
        'selection'
        'sort'
        'sourceParams'
    )
    npm run test --file="${tests[*]}"
    exit $?
}

main "$@"
