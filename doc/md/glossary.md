# Glossary

Source
: A component of DataVis (subclass of `Source`) that retrieves data from some external system (i.e. the “source origin”). The source is responsible for:

    - Passing parameters to the origin, e.g. CGI parameters for an HTTP source.
    - Decoding the data: from XML, JSON, or CSV to an array of objects.
    - Type guessing to determine the type of data stored in fields declared as strings.
    - Type decoding to convert any string values into appropriate internal representations.

Source Origin
: An external system that provides data to the source. For an HTTP source, the origin is a web server that handles an HTTP request and provides an XML, JSON, or CSV file in response.

Type Decoding
: Parsing a string value into an appropriate internal representation, e.g. converting a value in a CSV file (which always starts as a string) into a number in JavaScript.  Type decoding is performed on demand by default, meaning that values are decoded as they are needed.  Displaying a value forces it to be type decoded.  Filtering, sorting, grouping, pivoting, or applying an aggregate function to a field causes type decoding for values of that field in all rows (which can be intensive, especially for dates; sorting a million rows by a date field can cause a delay the first time it's done).

Type Guessing
: The process of iterating through all rows of data for a specific field which is declared as a string, examining each value to determine if the field should be considered as a different type, e.g. a date, number, or currency.  This is necessary to handle things like CSV files (which have no way to identify field types internally), or other origins that don’t adequately specify types.  Type guessing can be a performance drain, as a successful guess requires checking the value of the field in every row, to make sure that the guessed type is consistent across all rows.

Perspective
: A named configuration of multiple DataVis components ("Perspective Modules") that is commonly used to (1) store the current configuration so it can be loaded when the user comes back later, and (2) provide pre-built setups for viewing the data in different ways.

Preferences System
: The system which stores interactive configuration of different DataVis components. The preferences system manages a set of named configurations, each of which is called a Perspective.

## Technical Terms

`natRep` (“Native Representation”)
: A representation of a value that is stored as a JS native value that (1) can be used as a key in an object, (2) sorts via the JS greater-than and less-than operators, and (3) has a one-to-one mapping back to the original value. For example, dates may be internally stored using Date objects, but the natrep is a string in ISO-8601 format.

`rowVal` (“Row Value”)
: A list of the values of all the fields that are part of the group. For example, grouping U.S. presidents by last name, first name — one rowval would be `["Obama", "Barack"]`. All data rows that are in the same group have the same rowval. Grouping presidents by last name only, the rowval `["Roosevelt"]` would have two rows associated with it.

`rowValElt` (“Row Value Element”)
: A single element of the rowval. In the example above, “Obama” is a rowval element. This term is typically used when rendering a table. For example, there is a `<th>` for each rowval element in a rowval.

`rowNum` / `rowId` (“Row Num”)
: Unique identifier for a row of data from a source. New code should use the term “rowId” since it avoids the connotation that there is an ordering to the data (ordering is provided by the view when sorting, not by the data source).

## Acronyms and Code Words

- `ASCMB` — Automatic SuperClass Method Binding
