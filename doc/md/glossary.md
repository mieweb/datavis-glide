# Glossary

  - Source  
    A component of DataVis (subclass of `Source`) that retrieves data
    from some external system (i.e. the “source origin”). The source is
    responsible for:
    
      - Passing parameters to the origin, e.g. CGI parameters for an
        HTTP source.
      - Decoding the data: from XML, JSON, or CSV to an array of
        objects.
      - Type guessing to determine the type of data stored in fields
        declared as strings.
      - Type decoding to convert any string values into appropriate
        internal representations.

  - Source Origin  
    An external system that provides data to the source. For an HTTP
    source, the origin is a web server that handles an HTTP request and
    provides an XML, JSON, or CSV file in response.

  - Type Decoding  
    Parsing a string value into an appropriate internal representation,
    e.g. converting a value in a CSV file (which always starts as a
    string) into a number in JavaScript. Type decoding is performed on
    demand by default, meaning that values are decoded as they are
    needed. Displaying a value forces it to be type decoded. Filtering,
    sorting, grouping, pivoting, or applying an aggregate function to a
    field causes type decoding for values of that field in all rows
    (which can be intensive, especially for dates; sorting a million
    rows by a date field can cause a delay the first time it’s done).

  - Type Guessing  
    The process of iterating through all rows of data for a specific
    field which is declared as a string, examining each value to
    determine if the field should be considered as a different type,
    e.g. a date, number, or currency. This is necessary to handle things
    like CSV files (which have no way to identify field types
    internally), or other origins that don’t adequately specify types.
    Type guessing can be a performance drain, as a successful guess
    requires checking the value of the field in every row, to make sure
    that the guessed type is consistent across all rows.

  - Preferences System  
    The system which stores interactive configuration of different
    DataVis components. The preferences system manages a set of named
    configurations, each of which is called a “Perspectives.”
