# Generating Data

Test data is generated using a Python program called `json-gen.py` which takes a JSON5 file on stdin and generates data on stdout.  Most importantly, **the test data created by this program is reproducible,** so the test files are the same no matter where or when they are generated.

## Usage

``` bash
json-gen.py [OPTIONS]
```

!!! important
    The program does not take arguments for the input and output, so you must pipe it the template file on stdin, and redirect stdout to wherever you want it to go.

### Options

`-D VAR=VALUE`
: Defines the specified variable, which can be accessed inside the template using `ARGS[VAR]`.  Most often used with the `repeat()` function.

`-f csv|json|xml`
: Set the output format.  The default is JSON.

## Template Format

The template file is read as [JSON5](https://json5.org), which is basically JSON but with more convenience features like comments and not having to quote object keys.  It should have the same format as that used by the [HTTP + JSON source](../source/index.md#json-data).  String values in certain places in the object can contain references to functions used to generate data.  To use these, surround the function call with `$< ... >$`.

??? example "Function Syntax Example"

    ``` javascript
    { foo: "$< random_int(n, 1, 10) >$" }
    ```

## Special Functions

The following functions don't generate data by themselves, but they control important aspects of how the program works.

`random_seed(0)`
: Sets the starting RNG seed to the specified value, in this case zero.

`repeat(ARGS['COUNT'], VALUE)`
: Repeats the following item the number of times specified by the `COUNT` definition on the command line (using the `-D` argument, e.g. `-D COUNT=100` creates 100 items).  Each item is expanded, giving you an easy way to create a lot of data quickly.

## Data Functions

The following functions are used to generate test data.  In all of the following, the `rng_name` argument is used to create different random generators so adding more fields won't cause the data in the existing fields to change when the program is run again.  Using the same name as the field is recommended.

`random_int(rng_name, min, max, opts)`
: Creates a random integer in the range specified (inclusive).  Supports the following options:

    - output_type — Sets how the value should be encoded, for JSON output.  Must be one of: *number* (the default), *string*.
    - format — The format to use when encoding the number as a string using [Babel's `format_decimal()`](http://babel.pocoo.org/en/latest/numbers.html).

`random_float(rng_name, min, max, opts)`
: Creates a random floating point number in the range specified (inclusive).  Supports the following options:

    - output_type — Sets how the value should be encoded, for JSON output.  Must be one of: *number* (the default), *string*.
    - format — The format to use when encoding the number as a string using [Babel's `format_decimal()`](http://babel.pocoo.org/en/latest/numbers.html).

`random_date(rng_name, min, max, opts)`
: Creates a random date string in the range specified (inclusive).  Supports the following options:

    - format — The format to use when encoding the date as a string using [Babel's `format_date()`](http://babel.pocoo.org/en/latest/dates.html).

`random_datetime(rng_name, min, max, opts)`
: Creates a random datetime string in the range specified (inclusive).  Supports the following options:

    - format — The format to use when encoding the date as a string using [Babel's `format_datetime()`](http://babel.pocoo.org/en/latest/dates.html).

`random_element(rng_name, lst, dist)`
: Selects an element from the specified list at random, following the requested distribution.  The following distributions are supported: *uniform* (the default), *normal*, *triangular*.

`word_dict(rng_name)`
: Uses a word at random from the dictionary.

`state(rng_name)`
: Uses the name of a random state in the United States.

`cycle(rng_name, lst)`
: Iterates through the specified list, producing the next value each time it's called.

`sequence(rng_name, start)`
: Produces an incrementing number.  The default value to start at is one.

`lipsum(count)`
: Produces the specified number of copies of a "lorem ipsum" text.  Note there is no `rng_name` argument here, because nothing random is being generated.

`last(rng_name)`
: Uses the last value produced by the generator specified.  Used to duplicate the contents of another field in the same row.

    ??? example
    
        ``` javascript
        {
          foo: "$< random_int('foo', 0, 255) >$",
          bar: "$< last('foo') >$"
        }
    
        /* produces */
    
        {
          foo: 42,
          bar: 42
        }
        ```

## Example Template

``` javascript
{
  "$< random_seed(0) >$": null,
  data: [
    "$< repeat(ARGS['COUNT'], VALUE) >$",
    {
      country: "$< cycle('country', ['United States', 'Canada', 'Mexico', 'England', 'France', 'Germany', 'Switzerland', 'Japan', 'China', 'South Korea']) >$",
      state: "$< state() >$",
      fruit: "$< random_element('fruit', ['Apple', 'Banana', 'Blueberry', 'Cherry', 'Grape', 'Kiwi', 'Mango', 'Orange', 'Pineapple', 'Strawberry'], 'normal') >$",
      link1: "$< '<a href=\"https://en.wikipedia.org/wiki/' + last('fruit') + '\">' + last('fruit') + '</a>' >$",
      link2: "$< '<a href=\"https://en.wikipedia.org/wiki/' + last('fruit') + '\">Same Text, Different Link</a>' >$",
      link3: "$< last('fruit') >$",
      link4: "$< last('fruit') >$",
      date: "$< random_date('date3', format='MM/dd/yyyy') >$"
    }
  ],
  typeInfo: [
    { field: 'country', type: 'string' },
    { field: 'state', type: 'string' },
    { field: 'fruit', type: 'string' },
    { field: 'link1', type: 'string' },
    { field: 'link2', type: 'string' },
    { field: 'link3', type: 'string' },
    { field: 'link4', type: 'string' },
    { field: 'date', type: 'date' },
  ]
}
```

## Example Usage

``` bash
json-gen.py -f csv -D COUNT=100 < template.json5 > data.csv
```
