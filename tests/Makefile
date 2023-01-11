JSDOC=../node_modules/.bin/jsdoc
PAGES_DEPENDS=../dist/wcdatavis.js ../dist/wcdatavis.css ../examples/base.css
DOC_PUB_PATH=zeus.med-web.com:~/public_html/datavis

.PHONY:	data pages jsdoc clean

all:	data pages

data:
	$(MAKE) -C data

pages:
	cp $(PAGES_DEPENDS) pages
	cp data/*.csv pages
	cp data/*.json pages
	cp data/*.xml pages
	cp data/third-party/*.csv pages

jsdoc:
	$(JSDOC) -p -c jsdoc_conf.json lib
	@printf '\033[32;1mRun `make doc-publish` to publish documentation to $(PUB_PATH)\033[0m\n'

doc-publish:	doc
	rsync -a --delete jsdoc/ $(DOC_PUB_PATH)/jsdoc-tests/

doc-clean:
	rm -rf jsdoc/

clean:
	$(MAKE) -C data clean
	rm -f pages/wcdatavis.js pages/wcdatavis.css
