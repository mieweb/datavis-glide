# Data View

A data view is an image of the data from a source. The original source’s
data is never touched, but through the view, a grid can see the data as
having been filtered, sorted, grouped, or paged.

*This “view” should not be confused with the “view” shown in the grid
toolbar, which is used to name and save the configuration of the grid.
The proper, internal name of the latter is a “perspective,” see
\[Preferences\] for more information about those.*

## Getting Data

An output (e.g. `GridTable`) should never access the data source
directly, it should only use the view to get data. This is because the
view handles filtering, sorting, grouping, and other things which the
data source does not. So how does the view return its data? There are
two formats, depending on whether the data is grouped or not.

``` mermaid
graph TD
  getData["source#getData()"] --> filter
  filter --> group
  group --> pivot
  pivot --> aggregates
  aggregates --> sort
```

## Configuration

### Filter

### Group

  - `fieldNames`

    An array of the fields to group by.

### Pivot

  - `fieldNames`

    An array of the fields to pivot by.

### Aggregates

The toplevel properties are used to set what aggregate functions will be
calculated for various slices of the data:

| Property | Meaning                                                                |
| -------- | ---------------------------------------------------------------------- |
| `cell`   | Function is applied to all rows that fall into the same group & pivot. |
| `group`  | Function is applied to all rows in the same group.                     |
| `pivot`  | Function is applied to all rows in the same pivot.                     |
| `all`    | Function is applied to all rows.                                       |

The value for each of these properties is the same, an array of
aggregate function specs. Each spec looks like this:

  - `fun` : string (required)

    Name of the aggregate function, a key in
    `MIE.WC_DataVis.AGGREGATE_REGISTRY`.

  - `isHidden` : boolean

    If true, then the aggregate function is calculated, but not
    displayed. One use for this is to sort based on the function result,
    when you don’t actually care to see what the value is.

  - `fields` : string array

    Names of the fields to apply the function to, for example the “sum”
    function takes one field.

  - `opts` : object

    Extra options that are allowed by individual aggregate functions. A
    really common one is `separator`, which is used by functions that
    concatenate values.

## Data Object

  - `isPlain`

    True if the data is plain (i.e. not grouped or pivotted).

  - `isGroup`

    True if the data is grouped.

  - `isPivot`

    True if the data is pivotted.

  - `groupFields`

    A list of the fields (from the source, e.g. columns in a system
    report) that we’re grouping by, in order.

  - `rowVals`

    An array of all combinations of values of group fields which exist
    in the data. Every element in the array is itself an array where the
    first element is a value of the first group field, the second
    element is a value of the second group field, etc.

  - `pivotFields`

    A list of the fields (from the source, e.g. columns in a system
    report) that we’re pivotting by, in order.

  - `colVals`

    An array of all combinations of values of pivot fields which exist
    in the data. Every element in the array is itself an array where the
    first element is a value of the first pivot field, the second
    element is a value of the second pivot field, etc.

  - `data`

    When doing normal output, this is just an array of rows.

    When doing grouped output, this is an array of groups. The group
    index corresponds to the index in `rowVals` for the same group. Each
    group is an array of rows that are in that group.

    When doing pivotted output, this is an array of groups. The group
    index corresponds to the index in `rowVals` for the same group. Each
    group is an array of pivots. The pivot index corresponds to the
    index in `colVals` for the same pivot. Each pivot is an array of
    rows that are in that group and pivot.

    However many intervening layers there are for groups and pivots, the
    row itself has two properties.

      - `rowNum`

        This is a unique identifier used to track a row. This is
        currently used to facilitate filtering (e.g. “hide rows 2, 3,
        and 7”) and reordering (e.g. “move row X above row Y”).

      - `rowData`

        This holds the object containing the actual data.

### Example

    groupFields = ["A", "B"]
    rowVals = [[1, 1], [1, 2], [2, 1], [2, 2]]
    
    pivotFields = ["C", "D"]
    colVals = [[3, 3], [3, 4], [4, 3], [4, 4]]
    
    data = [
      [
          [row, row, ...] // each row has A = 1, B = 1, C = 3, D = 3
          [row, row, ...] // each row has A = 1, B = 1, C = 3, D = 4
          [row, row, ...] // each row has A = 1, B = 1, C = 4, D = 3
          [row, row, ...] // each row has A = 1, B = 1, C = 4, D = 4
      ],
      ... // repeat for A = 1, B = 2
      ... // repeat for A = 2, B = 1
      ... // repeat for A = 2, B = 2
    ]

So the information at `data[2][3]`:

  - Is in Group 2 `[1, 2] => {A: 1, B: 2}`
  - Is in Pivot 3 `[4, 3] => {C: 4, D: 3}`

Therefore `data[2][3]` is an array of rows with `{A: 1, B: 2, C: 4,
D: 3}`. It might be an empty array, meaning there are no rows that match
the criteria. Or it may be an array with only one row, or with many
rows. Everything is connected based on indexes to make rendering and
processing the data faster.

## Filtering

### Filter Spec

The filter spec is an object describing how filtering should be done.
The top level keys of the object are column names. The values are
objects indicating what comparisons should be performed (keys are
operators, values are operands). All of the operators are AND-ed
together. For example, this would show anybody who has an age between 18
and 65:

``` javascript
{
    'Age': {
        '$lte': '65',
        '$gte': '18'
    }
}
```

Here are the supported operators:

| Descripton                 | Operator     | Operand                                                    | Types                                                    |
| :------------------------- | :----------- | ---------------------------------------------------------- | -------------------------------------------------------- |
| Contains                   | $contains    | substring                                                  | string                                                   |
| Not Contains               | $notcontains | substring                                                  | string                                                   |
| Exists                     | $exists      |                                                            | any                                                      |
| Not Exists                 | $notexists   |                                                            | any                                                      |
| Equality                   | $eq          | value                                                      |                                                          |
| Inequality                 | $ne          | value                                                      |                                                          |
| Greater-than               | $gt          | value                                                      | string<br />number<br />currency<br />date<br />datetime |
| Greater-than or Equal-to   | $gte         | value                                                      | string<br />number<br />currency<br />date<br />datetime |
| Less-than                  | $lt          | value                                                      | string<br />number<br />currency<br />date<br />datetime |
| Less-than or Equal-to      | $lte         | value                                                      | string<br />number<br />currency<br />date<br />datetime |
| In (member of set)         | $in          | array                                                      | string                                                   |
| Not In (not member of set) | $nin         | array                                                      | string                                                   |
| Every                      | $every       | day name<br />month name                                   | date<br />datetime                                       |
| This                       | $this        | “DATE”<br />“WEEK”<br />“MONTH”<br />“QUARTER”<br />“YEAR” | date<br />datetime                                       |
| Last                       | $last        | “DATE”<br />“WEEK”<br />“MONTH”<br />“QUARTER”<br />“YEAR” | date<br />datetime                                       |

When an array of operands is supposed, the condition on the row must “pass” for all operands.

### Examples

`{"name": {"$contains": "Smith"}}`
: Matches any row where the `name` field contains the substring “Smith.”

`{"price": {"$gte": 50, "$lte": 100}}`
: Matches any row where the `price` field is between 50 and 100.

`{"location": {"$in": ["main office", "remote office"]}}`
: Matches any row where the `location` field is either “main office” or “remote office.”

`{"due": {"$every": "MONDAY"}}`
: Matches any row where the `due` field is a date/time that occurred on a Monday.

`{"finished": {"$this": "MONTH"}}`
: Matches any row where the `finished` field is a date/time that occurred during the current month (at the time of evaluation).

## Events

  - `dataUpdated`  
    Fired when there has been a change in the data at the source.
  - `sortBegin`  
    Fired when a sort operation begins.
  - `sortEnd`  
    Fired when a sort operation ends.
  - `filterBegin`  
    Fired when a filter operation begins.
  - `filterEnd`  
    Fired when a filter operation ends.
