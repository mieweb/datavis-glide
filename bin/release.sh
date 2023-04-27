#!/usr/bin/env bash

main() {
    local version="$1" ; shift

    mv package.json package.json.bak
    jq '.version = "'"$version"'"' < package.json.bak > package.json
    rm package.json.bak
    git commit -m "Rel: DataVis v$version" package.json
    git tag -m "DataVis v$version" "v$version"
}

main "$@"