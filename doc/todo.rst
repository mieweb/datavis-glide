****
Todo
****

Items that are waiting to be done!

Grid Table
==========

* Date formatting is wrong
* Interactive column resizing
* Option to use divs instead of tables
* Paging

  The implementation of paging here can use the fact we can pass a limit/offset to the "run system
  report" AJAX function, if we can figure out how to pass that information from the user interface
  all the way back to the DataSource.

* Grouping?

  Questionable because this is already a function of the pivot table, so maybe it's not necessary to
  have it here as well.  The benefit of offering it here, however, is that grouping would visually
  put the appropriate rows together within collapsible groups, like in the jqxGrid.  Within the
  pivot table, grouping data shows the results of some aggregate function instead.

* Other filter widgets

  - string dropdown (use ``DataSource#getUniqElts()``)
  - string checkedlist (use ``DataSource#getUniqElts()``)

Pivot Control
=============

* Drag & drop for pivot control fields.
* ``DataView#group()``
* ``DataView#pivot()``

Pivot Table
===========

* Filtering
* Group by column
* Pivot by column
* Show details within the aggregate results (i.e. "what contributed to this aggregate result").

Preferences
===========

  - filtering

    The filter is applied by ``GridFilterSet#update()`` so that is where we should call
    ``Prefs#save()``.  Also need to write a handler in ``Prefs.getFrom``.

    Preferences are going to have the following format:

    +---------------------+-------------------------------------------+
    | Property            | Meaning                                   |
    +=====================+===========================================+
    | filter              | array of filters                          |
    +---------------------+-------------------------------------------+
    | filter[].colName    | name of the column this filter applies to |
    +---------------------+-------------------------------------------+
    | filter[].filterType | type of widget used for the filter        |
    +---------------------+-------------------------------------------+
    | filter[].operator   | opterator                                 |
    +---------------------+-------------------------------------------+
    | filter[].value      | value                                     |
    +---------------------+-------------------------------------------+

  - sorting

Within the Documentation
========================

.. todolist::
