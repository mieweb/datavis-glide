JSDOC=./node_modules/.bin/jsdoc
SOURCE=$(shell find src -type f -name '*.js')
DIST_FILES=$(addprefix dist/,wcdatavis.js wcdatavis.min.js wcdatavis.css)
EXAMPLE_FILES=$(patsubst dist/%,examples/%,$(DIST_FILES))
PUB_PATH=zeus.med-web.com:~/public_html/datavis

.PHONY:	all doc doc-publish doc-clean doc-serve jsdoc mkdocs serve tests test examples dist-clean clean tags
.PHONY:	setup teardown npm-setup npm-teardown python-setup python-teardown jsdoc-setup jsdoc-teardown
.PHONY: publish tests-publish

.DEFAULT:	all

all:	$(DIST_FILES)

npm-setup:
	@if [ -f .nvmrc ] ; then printf '\033[34;1mPlease run `nvm use` to ensure the right version of Node is used.\033[0m\n' ; fi
	npm install
	./bin/update-deps.sh

npm-teardown:
	rm -rf node_modules

python-setup:
	pyenv virtualenv datavis
	pyenv local datavis
	pip install -r requirements.txt

python-teardown:
	-pyenv virtualenv-delete -f datavis
	-pyenv local --unset

jsdoc-setup:
	cd third-party/jaguarjs-jsdoc && npm i

jsdoc-teardown:
	cd third-party/jaguarjs-jsdoc && rm -rf node_modules

setup:	npm-setup python-setup
	git submodule update --init
	$(MAKE) jsdoc-setup

teardown:	npm-teardown python-teardown jsdoc-teardown

dist/wcdatavis.js:	rollup.config.js datavis.js $(SOURCE)
	npm run rollup

dist/wcdatavis.min.js:	dist/wcdatavis.js
	npm run uglify

doc:	jsdoc mkdocs
	$(MAKE) -C tests $@
	@printf '\033[32;1mRun `make doc-publish` to publish documentation to $(PUB_PATH)\033[0m\n'

doc-publish:	doc
	rsync -a --delete doc/html/ $(PUB_PATH)/manual/
	rsync -a --delete jsdoc/ $(PUB_PATH)/jsdoc/
	$(MAKE) -C tests $@

doc-clean:
	rm -rf doc/html
	rm -rf jsdoc
	$(MAKE) -C tests $@

doc-serve:
	mkdocs serve

jsdoc:
	$(JSDOC) -p -c jsdoc_conf.json src
	$(MAKE) -C tests $@

mkdocs:
	mkdocs build

publish:	doc-publish tests-publish

serve:
	python bin/data-server.py

tests:	$(DIST_FILES)
	$(MAKE) -C tests

tests-publish:	tests
	rsync -av --delete tests/pages/ $(PUB_PATH)/examples/

test:	tests
	npm run test

examples:	tests $(EXAMPLE_FILES)
	cp tests/data/*.json examples/test

$(EXAMPLE_FILES):examples/%:	dist/%
	cp $^ $@

dist-clean:
	rm -f dist/wcdatavis.js dist/wcdatavis.min.js
	rm -f $(EXAMPLE_FILES)
	rm -f examples/test/*.json

clean:	doc-clean dist-clean
	$(MAKE) -C tests $@

tags:
	ctags -R -f TAGS --languages=JavaScript --sort=foldcase src
