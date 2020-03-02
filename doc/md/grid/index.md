# Grid

## Definition Object

  - `table` — required object

  - `table.id` — required string

  - `table.columns` — object array
    
    Specifies the order that fields are rendered in plain output. If not
    provided, all fields are rendered in the order received from the
    source; fields with names starting with an underscore are not shown.
    If provided, only those fields specified are rendered, and in the
    order indicated.
    
    See [Column Configuration](#column-configuration).

  - `table.features` — object
    
    The features that are enabled for this grid.
    
    See [Grid Features](#grid-features).

  - `table.limit` — object

  - `table.limit.method` — string, default = “`more`”
    
    How to limit the output. Must be one of the following:
    
      - `more` — Show a row at the bottom, which when clicked, loads
        more rows.

  - `table.limit.threshold` — number
    
    The total number of rows must exceed this in order to trigger using
    the limit method. If omitted, then the “limit” feature is
    effectively disabled.

  - `table.limit.chunkSize` — number
    
    When using the “more” limit method, how many additional rows to load
    each time.

  - `table.floatingHeader` — object
    
    Configuration for the “floating header” feature.

  - `table.floatingHeader.method` — string
    
    What library to use to create the floating table header. Must be one
    of the following:
    
      - `floatThead`
      - `fixedHeaderTable`
      - `tabletool`
    
    If this is not specified, the default is based on what library is
    available in the page, in the order listed above.

### Column Configuration

  - `field` — required string
    
    We’re configuring the output of this field.

  - `displayText` — string
    
    What to show as the name of the column; the default is to show the
    field name.

  - `format` — string
    
    If the value is a number or currency: a Numeral format string used
    to render the value. If the value is a date, datetime, or time: a
    Moment format string used to render the value. Otherwise, this
    option is not used. The default format strings are:
    
      - number: \[none\]
      - currency: `$0,0.00` (e.g. “$1,000.23”)
      - date: `LL` (e.g. “September 4, 1986”)
      - datetime: `LLL` (e.g. “September 4, 1986 8:30 PM”)

  - `format_dateOnly` — string, default = “`LL`”
    
    When `hideMidnight = true` this is the Moment format string used to
    display just the date component of the datetime. Note that the time
    component is still present in the value when it is formatted, so
    don’t reference the hours/minutes/seconds from the format string.

  - `hideMidnight` — boolean, default = false
    
    If the value is a datetime, and this value is true, then the time
    component is not rendered when it’s midnight (00:00:00). If the
    value is not a datetime, this option is not used.

  - `cellAlignment` — string
    
    How to align the value within the cell horizontally. Possible
    values:
    
      - `left`
      - `center`
      - `right`
    
    The default depends on the type of the field. Strings, dates,
    datetimes, and times are left-aligned by default. Numbers and
    currencies are right-aligned by default.

  - `allowHtml` — boolean, default = false
    
    If true and the type of the field is a string, the value is
    interpreted as HTML and the resulting nodes are inserted into the
    table result. When exporting to CSV, the value emitted will be the
    text nodes only.

### Grid Features

All features are off by default.

  - `rowSelect`
    
    If true, the user is allowed to select rows by using the checkbox in
    the first column.

  - `rowReorder`
    
    If true, the user is allowed to manually reorder the rows using the
    handle in the last column.

  - `limit`
    
    If true, then limit the amount of rows output by some method.

  - `floatingHeader`
    
    If true, then create a floating header for the table.

  - `block`
    
    If true, prevent interaction with the table while the View is doing
    something.

  - `progress`
    
    If true, show the progress of sort/filter operations that the View
    is performing.

## Grouping

Grouped output consists of two main parts: the group itself, and the
data within the group. These sort independently, so you can actually
sort by two different columns in grouped output mode: one column must be
a group field, and the other must be a non-group field.

### Sorting Group Fields

Sorting group fields causes the groups to be reordered according to the
sort. It does not affect the ordering of the data within the groups.

### Sorting Non-Group Fields

Sorting non-group fields causes a sort to occur within each group. It
does not affect the ordering of the groups themselves.

## Pivotting

### Sorting Pivot Fields

Sorting pivot fields (e.g. "State") changes the order of the pivotted
columns to be in the order indicated (e.g. Alabama, Alaska, Arizona, …
for ascending order).

### Sorting Pivot Values

Sorting pivot values (e.g. "Indiana") changes the order of the rows,
based on the value of the aggregate function, to be in the order
indicated.
