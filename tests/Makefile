JSDOC=../node_modules/.bin/jsdoc
PAGES_DEPENDS=../dist/wcdatavis.js ../dist/wcdatavis.css ../examples/base.css

.PHONY:	data pages jsdoc clean

all:	data pages

data:
	$(MAKE) -C data

pages:
	cp $(PAGES_DEPENDS) pages
	cp data/*.json pages

jsdoc:
	$(JSDOC) -p -c jsdoc_conf.json lib

clean:
	$(MAKE) -C data clean
	rm -f pages/wcdatavis.js pages/wcdatavis.css
