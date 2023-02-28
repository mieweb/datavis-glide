JSDOC=../node_modules/.bin/jsdoc
PAGES_DEPENDS=../dist/wcdatavis.js ../dist/wcdatavis.css ../examples/base.css
DOC_PUB_PATH=zeus.med-web.com:~/public_html/datavis

.PHONY:	all
all:	data pages

.PHONY:	data
data:
	$(MAKE) -C data

.PHONY:	pages
pages:
	cp $(PAGES_DEPENDS) pages
	cp data/*.csv pages
	cp data/*.json pages
	cp data/*.xml pages
	cp data/third-party/*.csv pages

.PHONY:	jsdoc
jsdoc:
	$(JSDOC) -p -c jsdoc_conf.json lib
	@printf '\033[32;1mRun `make doc-publish` to publish documentation to $(PUB_PATH)\033[0m\n'

.PHONY:	doc-publish
doc-publish:	doc
	rsync -a --delete jsdoc/ $(DOC_PUB_PATH)/jsdoc-tests/

.PHONY:	doc-clean
doc-clean:
	rm -rf jsdoc/

.PHONY:	clean
clean:
	$(MAKE) -C data clean
	rm -f pages/wcdatavis.js pages/wcdatavis.css
