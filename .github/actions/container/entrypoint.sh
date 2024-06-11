#!/usr/bin/env bash

main() {
	cd /github/workspace

	case "$1" in
		build-docs)
			make setup
			make doc
		;;
		build-examples)
			make setup
			make datavis
			make tests
		;;
	esac
}

export PYENV_ROOT="$HOME/.pyenv"
export PATH="$PYENV_ROOT/bin:$PATH"

eval "$(pyenv init --path)"
eval "$(pyenv virtualenv-init -)"

main "$@"
