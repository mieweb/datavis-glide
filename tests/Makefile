PAGES_DEPENDS=../dist/wcdatavis.js ../dist/wcdatavis.css ../examples/base.css

.PHONY:	data pages clean

all:	data pages

data:
	$(MAKE) -C data

pages:
	cp $(PAGES_DEPENDS) pages
	cp data/*.json pages

clean:
	$(MAKE) -C data clean
	rm -f pages/wcdatavis.js pages/wcdatavis.css pages/base.css
