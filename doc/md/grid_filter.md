# Grid Filter

A grid filter is a collection of user interface elements that allow the
user to set a single filter on a column in the grid.

<div class="note">

<div class="admonition-title">

Note

</div>

Grid filters are applied dynamically by the
<span role="doc">data\_view</span> and should not be confused with
<span role="doc">filters</span>, which are applied by the
<span role="doc">data\_source</span>.

</div>

## JavaScript API

### Common Properties

All grid filters have the following properties:

### Common Methods

## Current Implementations

### String Textbox Grid Filter

  - Class Name  
    `StringTextboxGridFilter`

  - Column Type  
    string

  - Filter Type  
    textbox

This is the standard filter for columns containing string data. The user
can enter a single value, and that is compared against the column values
using the specified operator. The supported operators are:

| Descripton               | UI | Internal Name |
| :----------------------- | :- | :------------ |
| Contains                 | ∈  | $contains     |
| Not Contains             | ∉  | $notcontains  |
| Equality                 | \= | $eq           |
| Inequality               | ≠  | $ne           |
| Greater-than             | \> | $gt           |
| Greater-than or Equal-to | ≥  | $gte          |
| Less-than                | \< | $lt           |
| Less-than or Equal-to    | ≤  | $lte          |

### String Dropdown Grid Filter

  - Class Name  
    StringDropdownGridFilter

  - Column Type  
    string

  - Filter Type  
    dropdown

### String Checked List Grid Filter

  - Class Name  
    StringCheckedListGridFilter

  - Column Type  
    string

  - Filter Type  
    checkedlist

### Number Textbox Grid Filter

  - Class Name  
    NumberTextboxGridFilter

  - Column Type  
    number

  - Filter Type  
    textbox

### Number Checkbox Grid Filter

  - Class Name  
    NumberCheckboxGridFilter

  - Column Type  
    number

  - Filter Type  
    checkbox

### Date Single Grid Filter

  - Class Name  
    DateSingleGridFilter

  - Column Type  
    date

  - Filter Type  
    single

### Date Range Grid Filter

  - Class Name  
    DateRangeGridFilter

  - Column Type  
    date

  - Filter Type  
    range

### Boolean Checkbox Grid Filter

  - Class Name  
    BooleanGridFilter

  - Column Type  
    boolean

  - Filter Type  
    checkbox
