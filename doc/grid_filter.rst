***********
Grid Filter
***********

A grid filter is a collection of user interface elements that allow the user to set a single filter
on a column in the grid.

JavaScript API
==============

Common Properties
-----------------

All grid filters have the following properties:

.. js:attribute:: grid_filter.colName

   Name of the column for which this filter applies.

.. js:attribute:: grid_filter.gridFilterSet

   The grid filter set to which this filter belongs.

.. js:attribute:: grid_filter.limit

   The maximum number of filters which may be applied to the same column.  The default is zero,
   which means there is no limit.

.. js:attribute:: grid_filter.applyImmediately

   If true, then the filter should be applied as soon as it is created.  This is used for checkbox
   filters, which are applied (in their unchecked state) as soon as they are added.

.. js:attribute:: grid_filter.div

   The div element that wraps all the user interface elements.

.. js:attribute:: grid_filter.removeBtn

   The button that removes the filter from the grid.

Common Methods
--------------

.. js:function:: GridFilter.prototype.getValue()

   Gets the value(s) that the user entered into the filter.  If there are multiple values, they are
   returned as an array.  The default implementation is to use ``self.input.val()`` — if you create
   a subclass that has multiple input elements, you will need to override this method.

.. js:function:: GridFilter.prototype.getOperator()

   Gets the operator that the user has selected to use in comparing the data value with what they
   typed into the filter.

.. js:function:: GridFilter.prototype.getId()

   Returns a string that uniquely identifies the filter.  The default implementation is to use
   ``self.input.attr('id')`` which works for jQWidgets interface elements — again, if you create a
   subclass that has multiple input elements, you will need to override this method.

.. js:function:: GridFilter.prototype.remove()

   Removes ``self.div`` from the page.

Current Implementations
=======================

String Textbox Grid Filter
--------------------------

:Class Name: ``StringTextboxGridFilter``
:Column Type: string
:Filter Type: textbox

This is the standard filter for columns containing string data.  The user can enter a single value,
and that is compared against the column values using the specified operator.  The supported
operators are:

+--------------------------+----+---------------+
| Descripton               | UI | Internal Name |
+==========================+====+===============+
| Contains                 | ∈  | $contains     |
+--------------------------+----+---------------+
| Not Contains             | ∉  | $notcontains  |
+--------------------------+----+---------------+
| Equality                 | =  | $eq           |
+--------------------------+----+---------------+
| Inequality               | ≠  | $ne           |
+--------------------------+----+---------------+
| Greater-than             | >  | $gt           |
+--------------------------+----+---------------+
| Greater-than or Equal-to | ≥  | $gte          |
+--------------------------+----+---------------+
| Less-than                | <  | $lt           |
+--------------------------+----+---------------+
| Less-than or Equal-to    | ≤  | $lte          |
+--------------------------+----+---------------+

String Dropdown Grid Filter
---------------------------

:Class Name: StringDropdownGridFilter
:Column Type: string
:Filter Type: dropdown

String Checked List Grid Filter
-------------------------------

:Class Name: StringCheckedListGridFilter
:Column Type: string
:Filter Type: checkedlist

Number Textbox Grid Filter
--------------------------

:Class Name: NumberTextboxGridFilter
:Column Type: number
:Filter Type: textbox

Number Checkbox Grid Filter
---------------------------

:Class Name: NumberCheckboxGridFilter
:Column Type: number
:Filter Type: checkbox

Date Input Grid Filter
----------------------

:Class Name: DateInputGridFilter
:Column Type: date
:Filter Type: input

Boolean Checkbox Grid Filter
----------------------------

:Class Name: BooleanGridFilter
:Column Type: boolean
:Filter Type: checkbox
