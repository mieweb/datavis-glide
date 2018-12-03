JSDOC=./node_modules/.bin/jsdoc
SOURCE=$(wildcard src/*.js)
DIST_FILES=$(addprefix dist/,wcdatavis.js wcdatavis.min.js wcdatavis.css)
EXAMPLE_FILES=$(patsubst dist/%,examples/%,$(DIST_FILES))
PANDOC_FILES=index getting_started examples overview source view grid grid_filter \
	     grid_filter_set grid_table graph prefs perspective events performance \
	     debugging known_issues glossary code_standards about links
PANDOC_INPUT=$(addprefix doc/,$(addsuffix .pandoc,$(PANDOC_FILES)))

.PHONY:	doc jsdoc pandoc clean tags examples tests

all:	dist/wcdatavis.min.js examples

dist/wcdatavis.js:	rollup.config.js datavis.js $(SOURCE)
	npm run rollup

dist/wcdatavis.min.js:	dist/wcdatavis.js
	npm run uglify

doc:	jsdoc pandoc

jsdoc:
	# rm -rf jsdoc
	$(JSDOC) -p -c jsdoc_conf.json src

pandoc:	doc/html/index.html doc/html/style.css

doc/html/index.html:	$(PANDOC_INPUT)
	@mkdir -p $(dir $@)
	pandoc -o $@ -s --toc -c style.css $^

doc/html/style.css:	doc/style.css
	cp $^ $@

tests:
	$(MAKE) -C tests

examples:	tests $(EXAMPLE_FILES)
	cp tests/data/*.json examples/test

$(EXAMPLE_FILES):examples/%:	dist/%
	cp $^ $@

clean:
	$(MAKE) -C tests clean
	rm -f dist/wcdatavis.js dist/wcdatavis.min.js
	rm -f $(EXAMPLE_FILES)
	rm -f examples/test/*.json
	rm -rf jsdoc
	rm -rf doc/html

tags:
	ctags -R -f TAGS --languages=JavaScript --sort=foldcase src
