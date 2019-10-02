# Data Source

A data source represents a place where data comes from and how to
retrieve it. For example, a data source can be an HTTP request that
returns JSON or XML. The data source keeps a "clean" copy of the source
data, which can be used by a <span role="doc">data view
\<data\_view\></span> to represent different ways of looking at the
data.

The data source is in charge of taking input from the user, using that
to obtain data from somewhere, and transforming the result so it can be
used for a grid and/or graph. Data sources have a one-to-many
relationship with grids/graphs, so you can have a single data source for
three different grids. This allows you to show different portrayals of
the same data.

A data source actually captures four different types of information:

  - raw data, conceptually "rows" and "columns" but we refer to the
    columns as "fields"
  - type information of the fields
  - the "display names" of the fields (if different from the field
    names)
  - unique values across all rows for each field

## Type Info

The type information obtained from the source indicates how the data
should be interpreted. Usually, data formats like XML and JSON do not
allow flexible representation of all the different types of data that
we're interested in. For example, you can't put a date into JSON unless
you encode it as a string or number. Having the type information tells
the data source that the value should be treated as a date. That
information propagates to the view, where it can affect how the value is
displayed, sorted, or filtered.

The type information for each field indicates the following:

  - `field`  
    Name of the field.

  - `type`  
    The type (e.g. number, string, date). This affects how filtering and
    sorting works, e.g. dates can be sorted chronologically instead of
    alphabetically.

  - `format`  
    The format (e.g. "MM-DD-YYYY") — used for dates, times, and
    datetimes. This is needed to prevent misinterpretation of ambiguous
    dates like "01/02/03."

  - `deferDecoding`  
    If this is true, then type decoding of the raw data into an internal
    representation (e.g. from a string or number into a Moment or
    Numeral object) is deferred until needed (e.g. for sorting,
    filtering, or display).

  - `needsDecoding`  
    If this is true, then type decoding of the raw data into an internal
    representation is not necessary for sorting.

  - `internalType`  
    The type of the data when stored internally. For dates, can be
    “moment” to indicate that the value is wrapped by Moment, or
    “string” to indicate that the dates are represented only as
    strings. For numbers, can be “numeral” to indicate that the value is
    wrapped by Numeral, or “primitive” to indicate that a raw JS number
    is used.

| Type       | Description                                                                                                                                                        |
| :--------- | :----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `number`   | Integer of floating point number; primarily used for sorting numerically. The internal value is a number.                                                          |
| `currency` | A string formatted as money. The internal value is a number.                                                                                                       |
| `string`   | Catch all data type, can contain anything at all.                                                                                                                  |
| `date`     | A string containing a date, which can be formatted or sorted. The default format is "YYYY-MM-DD." The internal value is a Moment instance.                         |
| `time`     | A string containing a time, which can be formatted or sorted. The default format is "HH:mm:ss." The internal value is a string.                                    |
| `datetime` | A string containing both a date and time, which can be formatted and sorted. The default format is "YYYY-MM-DD HH:mm:ss." The internal value is a Moment instance. |

Available types

## Conversion

After retrieving the data, it can be converted by user-specified
functions. These are allowed to completely change the data and the type
information. There are two ways to specify conversion functions: (1)
across all fields, and (2) on a per-field basis.

To specify some conversion functions that will run for all fields, you
can simply provide an array of conversion functions. For each row, for
each cell within that row, the data source goes through the list of
conversion functions. You don't want to do too much work in these
functions, because they're going to get called a lot.

**Example**

``` sourceCode javascript
var tryInt = function (val) { return _.isInt(val) ? parseInt(val, 10) : null; }
var tryFloat = function (val) { return _.isFloat(val) ? parseFloat(val) : null; }
var tryDate = function (val) { return new Date(val); }

var source = new MIE.WC_DataVis.Source({
  type: 'http',
  url: 'data.json',
  conversion: [tryInt, tryFloat, tryDate]
});
```

To specify conversion functions on a per-field basis, use an object.
Field names are the keys, and the conversion function arrays are the
values — just as above.

**Example**

``` sourceCode javascript
var source = new MIE.WC_DataVis.Source({
  type: 'http',
  url: 'data.json',
  conversion: {
    'Signature': [bbcode],
    'Birthday': [tryDate]
  }
});
```

Conversion functions can either be plain old JavaScript functions, or
they can be strings which refer to properties of `Source.converters` —
which allows you to reference a conversion function by name, for the
sake of convenience.

## Type Decoding

After the user conversion functions have been evaluated, the data source
will perform type decoding. This process transforms the data row's field
values into appropriate internal representations according to the type
information for that field (e.g. a string containing a date gets
transformed into a Moment instance when the type info indicates the
field should be treated as a date). The internal representation is used
when sorting and filtering.

Since type decoding can be expensive (e.g. converting millions of
numbers using Numeral takes time), it can be deferred until needed. Here
are some examples of when type decoding is required:

  - At display time (e.g. formatting a number as currency)
  - At sort time (e.g. parsing dates where the lexicographic ordering
    isn't chronological)

If your data has thousands of values where type decoding has been
deferred, the first time the user sorts by that column can take a great
deal of time, because all values must be decoded before they can be
sorted correctly. Operations after that will all be fast, since type
decoding never has to occur again.

## Internal Format

Data sources store the data they retrieve as an array of objects, each
representing a row. The keys of the row object are the fields from the
data source, and the values are objects with the following properties:

  - `value`  
    This is the value used for all operations on the data, such as
    sorting, filtering, and grouping. Initially this is the value
    returned by the data source, but conversion functions and type
    decoding may alter it: for example, when the type of the field is a
    date, the `value` becomes a Moment instance during type decoding.

  - `orig`  
    This property stores the original value obtained from the source.
    During conversion (either user-specified or the builtin type
    conversion that follows), this property is stored when the `value`
    property is updated.

  - `render`  
    If present, this should be a function taking one argument. During
    output, if this property exists, it will be called with the `value`
    property. The result — which may be an Element or jQuery instance —
    will be what's shown in the grid table cell.

## Builtin Sources

### Local Data

### HTTP Request

The HTTP request data source simply makes an AJAX request to get data.
The data can either be in JSON or XML. You don't need to indicate which
one is being used, we figure it out automatically. However, you must
adhere to a specific format for the data, which is outlined below.

``` sourceCode javascript
var dataSource = new MIE.DataSource({
  type: 'http',
  url: '/data.json'
});
```

#### JSON Data

Here's the format for data expressed using JSON.

    {
      data: [
        {
          FIELD: VALUE,
          ...
        },
        ...
      ],
      typeInfo: {
        FIELD: {
          type: TYPE-NAME,
          format: FORMAT-STRING
        },
        ...
      }
    }

#### XML Data

Here's the format for data expressed using XML.

    <root>
      <data>
        <item>
          <FIELD>VALUE</FIELD>
          ...
        </item>
        ...
      </data>
      <typeInfo>
        <FIELD>
          <type>TYPE-NAME</type>
          <format>FORMAT-STRING</format>
        </FIELD>
        ...
      </typeInfo>
    </root>

## Custom Backends

Writing support for your own data source backends is easy, you just need
to make a class with a few methods and register it for a type.
