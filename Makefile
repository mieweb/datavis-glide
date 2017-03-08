SOURCE=$(wildcard src/*.js)

.PHONY:	doc examples clean jsdoc sphinx

all:	dist/wcdatavis.js examples

dist/wcdatavis.js:	wcdatavis.src $(SOURCE)
	./bin/jspp -o $@ $<

examples:	examples/wcdatavis.js examples/wcdatavis.css

clean:
	rm -f dist/wcdatavis.js examples/wcdatavis.js examples/wcdatavis.css
	rm -rf jsdoc
	$(MAKE) -C doc clean

doc:	jsdoc sphinx

jsdoc:
	jsdoc -c jsdoc_conf.json src

sphinx:
	$(MAKE) -C doc html

examples/wcdatavis.js:	dist/wcdatavis.js
	cp $^ $@

examples/wcdatavis.css:	dist/wcdatavis.css
	cp $^ $@
