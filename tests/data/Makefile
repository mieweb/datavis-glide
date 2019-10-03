JSON5_FILES=$(wildcard templates/*.json5)
JSON_FILES=$(patsubst templates/%.json5,%.json,$(JSON5_FILES))
JSON_GEN=../../bin/json-gen.py
JSON_GEN_INPUT=./templates/json-gen-input.json

all:	$(JSON_FILES) random100.json random100.xml random100.csv random500.json random1000.json random10000.json number-format-str.json

clean:
	rm -f $(JSON_FILES)
	rm -f random*.json

random100.json:	$(JSON_GEN_INPUT)
	$(JSON_GEN) -D COUNT=100 < $^ > $@

random100.xml:	$(JSON_GEN_INPUT)
	$(JSON_GEN) -D COUNT=100 -f xml < $^ > $@

random100.csv:	$(JSON_GEN_INPUT)
	$(JSON_GEN) -D COUNT=100 -f csv < $^ > $@

random500.json:	$(JSON_GEN_INPUT)
	$(JSON_GEN) -D COUNT=500 < $^ > $@

random1000.json:	$(JSON_GEN_INPUT)
	$(JSON_GEN) -D COUNT=1000 < $^ > $@

random10000.json:	$(JSON_GEN_INPUT)
	$(JSON_GEN) -D COUNT=10000 < $^ > $@

$(JSON_FILES):%.json:	templates/%.json5
	$(JSON_GEN) -D COUNT=100 < $^ > $@
