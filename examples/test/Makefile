JSON5=../../node_modules/.bin/json5
JSON5_FILES=$(wildcard *.json5)
JSON_FILES=$(patsubst %.json5,%.json,$(JSON5_FILES))

all:	$(JSON_FILES)

$(JSON_FILES):%.json:	%.json5
	$(JSON5) < $^ > $@
