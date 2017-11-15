SOURCE=$(wildcard src/*.js)

.PHONY:	doc examples clean jsdoc sphinx tags

all:	dist/wcdatavis.js examples

dist/wcdatavis.js:	wcdatavis.src $(SOURCE)
	./bin/jspp -o $@ $<

examples:	examples/wcdatavis.js examples/wcdatavis.css examples/wcdatavis-extra.css examples/export.php

clean:
	rm -f dist/wcdatavis.js examples/wcdatavis.js examples/wcdatavis.css
	rm -rf jsdoc
	$(MAKE) -C doc clean

doc:	jsdoc sphinx

jsdoc:
	rm -rf jsdoc
	./node_modules/.bin/jsdoc -c jsdoc_conf.json src

sphinx:
	$(MAKE) -C doc html

tags:
	/usr/bin/ctags -R -f TAGS --languages=JavaScript --sort=foldcase src

examples/wcdatavis.js:	dist/wcdatavis.js
	cp $^ $@

examples/wcdatavis.css:	dist/wcdatavis.css
	cp $^ $@

examples/wcdatavis-extra.css:	dist/wcdatavis-extra.css
	cp $^ $@

examples/export.php:	dist/export.php
	cp $^ $@
