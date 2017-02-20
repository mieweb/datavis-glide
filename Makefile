SOURCE=$(wildcard src/*.js)

.PHONY:	doc

dist/wcdatavis.js:	wcdatavis.src $(SOURCE)
	./bin/jspp -o $@ $<

doc:
	rm -rf jsdoc
	jsdoc -c jsdoc_conf.json src
