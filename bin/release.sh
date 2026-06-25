#!/usr/bin/env bash

set -e -u -o pipefail

declare dry_run=0
declare npm=0
declare run_tests=1
declare pkg_name='DataVis GLIDE'

errmsg() {
    echo -e "$@" >&2
}

usage() {
    errmsg "USAGE: $0 [ --npm ] VERSION"
    errmsg "       $0 -c / --continue"
    errmsg "       $0 -a / --abort"
    errmsg ""
    errmsg "Create a $pkg_name release of the currently checked-out code for VERSION."
    errmsg "If tests fail, use -c / --continue to commit, tag, and push later."
}

getopt() {
    if [[ $(uname) = 'Darwin' && -x /usr/local/opt/gnu-getopt/bin/getopt ]] ; then
        /usr/local/opt/gnu-getopt/bin/getopt "$@"
    else
        getopt "$@"
    fi
}

commit_tag_push() {
    local version="$1" ; shift
    if [[ $dry_run -eq 1 ]]; then
        echo "DRY RUN: Tagging $pkg_name v$version"
    else
        git commit -m "Release: $pkg_name v$version" package.json package-lock.json
        git push origin
        git tag -m "$pkg_name v$version" "v$version"
        git push origin tag "v$version"
    fi
}

npm_publish() {
    if [[ $dry_run -eq 1 ]]; then
        echo "DRY RUN: Publishing NPM package $pkg_name v$version"
    else
        npm login
        npm publish
    fi
}

update_package_json() {
    local version="$1" ; shift
    if [[ ! ( $version =~ [0-9]+\.[0-9]+\.[0-9]+ ) ]] ; then
        errmsg "Invalid version: $version"
        exit 1
    fi
    mv package.json package.json.bak
    jq '.version = "'"$version"'"' < package.json.bak > package.json
    rm package.json.bak
    npm install
    if [[ $run_tests -eq 1 ]]; then
        make clean
        make teardown
        make setup
        make tests
        make test || {
            read -p 'Tests failed... continue? (yes/no) '
            if [[ "$REPLY" != 'yes' ]] ; then
                echo "$version" > .release-version
                errmsg 'Fix any issues, then rerun with --continue.'
                exit 1
            fi
        }
    fi
    commit_tag_push "$version"
    if [[ $npm -eq 1 ]]; then
        npm_publish
    fi
}

main() {
    OPTIONS=$(getopt --options='achn' --longoptions='abort,continue,help,dry-run,no-test,npm' --name="$0" -- "$@")
    if [ $? -ne 0 ]; then
        errmsg 'Error parsing arguments'
        exit 1
    fi
    eval set -- "$OPTIONS"
    while true ; do
        case "$1" in
        -a|--abort)
            shift
            rm -f .release-version
            errmsg 'Not implemented'
            exit 1
            ;;
        -c|--continue)
            shift
            if [[ ! -r .release-version ]] ; then
                errmsg 'Missing .release-version file.'
                exit 1
            fi
            read version < .release-version
            commit_tag_push "$version"
            exit 0
            ;;
        -n|--dry-run)
            shift
            dry_run=1
            ;;
        --no-test)
            shift
            run_tests=0
            ;;
        --npm)
            shift
            npm=1
            ;;
        -h|--help)
            shift
            usage
            exit 1
            ;;
        --)
            shift
            break
        esac
    done
    if [[ $# -ne 1 ]] ; then
        usage
        exit 1
    fi
    update_package_json "$@"
}

main "$@"
