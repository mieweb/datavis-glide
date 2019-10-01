JSDOC=./node_modules/.bin/jsdoc
SOURCE=$(wildcard src/*.js) $(wildcard src/util/*.js)
DIST_FILES=$(addprefix dist/,wcdatavis.js wcdatavis.min.js wcdatavis.css)
EXAMPLE_FILES=$(patsubst dist/%,examples/%,$(DIST_FILES))

.PHONY:	doc jsdoc pandoc clean tags examples serve test tests

all:	$(DIST_FILES)

dist/wcdatavis.js:	rollup.config.js datavis.js $(SOURCE)
	npm run rollup

dist/wcdatavis.min.js:	dist/wcdatavis.js
	npm run uglify

doc:	jsdoc pandoc

jsdoc:
	$(JSDOC) -p -c jsdoc_conf.json src

pandoc:
	$(MAKE) -C doc

tests:	$(DIST_FILES)
	$(MAKE) -C tests

test:	tests
	npm run test

examples:	tests $(EXAMPLE_FILES)
	cp tests/data/*.json examples/test

$(EXAMPLE_FILES):examples/%:	dist/%
	cp $^ $@

clean:
	$(MAKE) -C tests clean
	$(MAKE) -C doc clean
	rm -f dist/wcdatavis.js dist/wcdatavis.min.js
	rm -f $(EXAMPLE_FILES)
	rm -f examples/test/*.json
	rm -rf jsdoc

tags:
	ctags -R -f TAGS --languages=JavaScript --sort=foldcase src
