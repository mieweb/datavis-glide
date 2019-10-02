# Examples

## Data Generation

Testing data is created using <http://www.json-generator.com/> with the
specification in `examples/spec.txt` to drive it.

### Generating XML Data File

Once you have the JSON data file, you can build the XML data file from
it:

    $ ./bin/json-to-xml.py < examples/data.json > examples/data.xml

Using this script requires the `dicttoxml` Python module.
