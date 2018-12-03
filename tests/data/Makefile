JSON5=../../node_modules/.bin/json5
JSON5_FILES=$(wildcard *.json5)
JSON_FILES=$(patsubst %.json5,%.json,$(JSON5_FILES))
JSON_GEN=../../bin/json-gen.py
JSON_GEN_INPUT=./json-gen-input.json

all:	$(JSON_FILES) random100.json random500.json random1000.json random10000.json

clean:
	rm -f $(JSON_FILES)
	rm -f random*.json

random100.json:	$(JSON_GEN_INPUT)
	$(JSON_GEN) -D COUNT=100 < $^ > $@

random500.json:	$(JSON_GEN_INPUT)
	$(JSON_GEN) -D COUNT=500 < $^ > $@

random1000.json:	$(JSON_GEN_INPUT)
	$(JSON_GEN) -D COUNT=1000 < $^ > $@

random10000.json:	$(JSON_GEN_INPUT)
	$(JSON_GEN) -D COUNT=10000 < $^ > $@

$(JSON_FILES):%.json:	%.json5
	$(JSON5) < $^ > $@
