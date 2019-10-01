PANDOC=pandoc
DOC_FILES=index getting_started examples overview source view grid grid_filter grid_filter_set grid_table graph prefs events performance debugging known_issues glossary code_standards about
DOC_INPUT=$(addsuffix .pandoc,$(DOC_FILES))
DOC_OUTPUT=$(addprefix html/,$(addsuffix .html,$(DOC_FILES)))

all:	html/index.html html/style.css

html/style.css:	style.css
	cp $^ $@

html/index.html:	$(DOC_INPUT)
	@mkdir -p html
	$(PANDOC) -o $@ -s --toc -c style.css $^

# UNUSED FOR NOW

#$(DOC_OUTPUT):html/%.html:	%.pandoc
#	@mkdir -p html
#	$(PANDOC) -o $@ -s -c style.css $^

clean:
	rm -rf html
