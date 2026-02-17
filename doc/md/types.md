# Types

Types are collections of values that support the same operations. All values in a column in DataVis have a common type, with the most basic type being string.

DataVis ships with many builtin types for common applications such as: numbers, dates, times, and JSON data. However, you may wish to add your own types. 

Some of this implementation may seem redundant. Why have so many ways to store numbers when you can use the browser’s native number formatting in `Intl`? Well, it’s because we originally wrote DataVis to support IE10, which does not have such features.

## Toplevel API

The `types` object exported from `types.js` has the following properties:

- `guess(str)` — Returns the name of a type which matches the string given. See [Guessing Types](#guessing-types) below.
- `registry` — An OrdMap mapping type names to an object of type functions. See [Type Functions](#type-functions) below.

## Guessing Types

Type guessing is an important part of DataVis’ functionality. Every type that DataVis knows about is stored in the registry, an ordered mapping of type names to the object that specifies how that type works. To guess the type of a value represented by a string (e.g. to say that “$99.97” is a currency) we iterate through the registry in order, trying each type to see if it matches. The first one that matches wins, and that’s the name of the type we guess.

## Builtin Types

The following types are builtin to DataVis:

- `string` — The fallback, used to represent anything for which we don’t have a more specific type.
- `number` — General purpose numbers.
- `currency` — Support for fixed-precision arithmetic and output.
- `date` — Dates without times.
- `datetime` — Dates with times.
- `duration` — Lengths of time, ranging from microseconds to years.
- `time` — Times without dates.
- `json` — JSON objects, formatted and decorated so you can browse them interactively.

### Number and Currency

The number and currency types supports the following internal representations:

- `primitive` — Uses the browser’s native floats to store values, and it’s good enough most of the time, but it can cause aggregate function accuracy to suffer from the accumulation of error. Comparison for equality is done using `Number.EPSILON` if it exists.
- `bignumber` — Uses the BigNumber arbitrary-precision arithmetic library. This is the default internal type for currency, where it is configured to maintain four decimal places for arithmetic operations and two decimal places for output.
- `numeral` — Uses the Numeral library. There is probably little need to use this anymore; it was the preferred way to format numbers with a specific number of decimal places before browsers widely supported the `Intl.NumberFormat` object. Nowadays you can do everything that Numeral offers via native browser functions.

### Date, Datetime, and Time

The date type supports the following internal representations:

- `string` — Values are stored internally as strings. This is the fastest, because the lexicographic sorting is also chronological. However, when applying a group function (e.g. by year & month) they will be converted into another internal type anyway.
  - Dates are stored in the format `YYYY-MM-DD`.
  - Datetimes are stored in the format `YYYY-MM-DD HH:mm:ss`.
  - Times are stored in the format `HH:mm:ss`.
- `date` — Values are stored as Date instances. Time type values are stored with the date of January 1, 2000 and only the time component is formatted.
- `moment` — Values are stored in Moment instances. Time type values are stored with the date of January 1, 2000 and only the time component is formatted.

### Duration

A duration represents a span of time, how long it takes something to happen.

A parsing string may be provided as part of the type information for a field containing duration values. The parsing string consists of regular text, which must exist in the input string, combined with parsing placeholders consisting of `%` and a letter indicating what part of the duration to read. For example, the parsing string `%h:%m:%s` will parse the input string `03:08:45` into a duration value representing 3 hours, 8 minutes, and 45 seconds. The colons are required, since they are part of the parsing string. Leading zeroes in the parts are ignored, i.e. the input string `3:8:45` parses to the same duration value.

A formatting string may be provided as part of the column configuration for a field containing duration values. This is very similar to the parsing string, with the addition that some printf-like formatting sequences are allowed. In particular, the sequence `%[0<WIDTH>]<PART>` will output the duration part indicated, optionally zero-padded to the specified width. For example, using that value we parsed above, and the formatting string `%h hours, %02m minutes` produces the output “3 hours, 08 minutes”.

The following duration parts are supported for both parsing and formatting strings:

| Flag | Meaning      |
| ---- | ------------ |
| `y`  | years        |
| `d`  | days         |
| `h`  | hours        |
| `m`  | minutes      |
| `s`  | seconds      |
| `t`  | milliseconds |
| `u`  | microseconds |

Additionally, when formatting, you can use `%[<PART>:<TEXT>]` to include the text only when that part of the duration is greater than zero. For example, `%[d:%d days ]%h:%m` will only output the days if necessary, and always output the hours and minutes. This is mainly useful for the sum aggregate, which often requires the use of higher-magnitude parts than the individual values that contribute to it (i.e. many hours add up to days).

The only supported internal representation of a duration is an object with fields for the years, days, hours, minutes, seconds, and milliseconds.

There is currently no filter for durations.

The following aggregate functions are supported for duration values:

- Count Distinct
- Values
- Values w/ Counts
- Distinct Values
- Sum
- Min / Max
- First / Last / Nth

## Type Functions

Every entry in the registry is an object defining the type’s behavior. The following properties are required to fully implement a new type. All of the functions can be performance bottlenecks if care is not taken.

- `matches(str) : bool` — Returns true if the string is something we can parse into a member of this type. Used by the type guessing logic.
- `parse(str, ir, fmt) : obj` — Parses the string value into a value for the type. The nature of the value is determined by the *ir* parameter, which describes the “internal representation” of the value. For example, numbers can be represented internally by primitive floats, using the BigNumber library, or using the Numeral library. The fmt argument describes how to parse the string; usually this is passed to a library function such as `moment()`. Returns null if the string cannot be parsed.
- `decode(val, ir, fmt) : obj` — Convert a value of the type into a different internal representation. This is mainly used when:
  - the serialization format of the data has support for a representation of the type, but we’re using a different one (e.g. using a JSON number as currency)
  - when combining data from multiple columns e.g. in an aggregate function

- `format(val, fmt) : str | elt` — Formats a value so that it can be printed. Since a type can have multiple internal representations, the format function must handle them all; e.g. the number type handles values of primitive floats, BigNumber objects, and Numeral objects. Returns the empty string if the value cannot be formatted, or if the value is `null`, `undefined`, or `NaN`.
- `natRep(val) : str` — Converts a value from its internal representation into a string that can be used as the key of a JavaScript object. This is mainly used for grouping functionality in the view. The mapping must be one-to-one, so that different values cannot produce the same “native representation.”
- `compare(a, b) : {-1, 0, 1}` — Returns -1 if a < b, 0 if a = b, and 1 if a > b. Returns null if the values cannot be compared. This is used for sorting data.
- `add(a, b) : any` — Add the two values of this type. This is used by the `sum` aggregate function, viz. to add numbers, currency, and durations.

### Parsing vs Decoding

Most of the data types that we support do not have a native representation in many wire protocols. XML and CSV are all just text. JSON has numbers, but not dates or times. For this reason, we mostly talk about parsing, but it’s important to mention decoding as well.

- *Parsing* is the process of converting a string into a value in the internal representation of the type.
- *Decoding* is the more general process of converting a value of a type from one representation to another.

If you’re writing a custom type, and it (b) supports more than one internal representation, or (b) can be serialized as something other than a string, you should provide the `decode` function.

## Registering a New Type

Create the functions specified above, then add it to the types registry like so:

``` javascript
import types from 'types.js';

(function () {
  function matches(str) { /* ... */ }
  function parse(str, ir, fmt) { /* ... */ }
  function decode(val, ir, fmt) { /* ... */ }
  function format(val, fmt) { /* ... */ }
  function natRep(val) { /* ... */ }
  function compare(a, b) { /* ... */ }
  function add(a, b) { /* ... */ }
  
  types.registry.set('custom', {
    matches: matches,
    parse: parse,
    decode: decode,
    format: format,
    natRep: natRep,
    compare: compare,
    add: add,
  });
})();
```

## Using the API

Here’s a brief example of how to use the type registry to: (1) guess the type that can represent a string value, (2) convert it into a native object, and (3) print out the formatted version.

``` javascript
import types from 'types.js';

switch (types.guess(str)) {
case 'date':
  let d = types.registry.get('date').parse(str, 'date');
  console.log('date = %s', types.registry.get('date').format(d));
  break;
}
```

