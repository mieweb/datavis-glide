******************************
Class Overview & Relationships
******************************

This is a reference for all the main classes involved in the grid/graph library, and how they
relate to each other.

WCGRID
======

This is the user interface for the grid, including the title bar and menu.  It is named after the
``<WCGRID>`` layout tag that creates it.

It should be noted that while a lot of the table generation code is still hanging around from the
old design (that is function-based, not object-oriented), the WCGRID class is considered the wrapper
around all those functions.  Eventually it will be refactored to actually be so in the
implementation.

* GridTable (×1) *when not in pivot mode*

  This directly renders the data in an HTML table.  When in pivot mode, the PivotControl manages the GridTable.

* GridFilterSet (×1) *when not in pivot mode*

  A collection of all filters on all columns in the grid.  WCGRID does not interact with the
  individual GridFilter instances, only with the GridFilterSet.

  Important methods:

  - ``add()`` — Invoked by the "add filter" button.
  - ``reset()`` — Invoked by the "reset" link.

* PivotControl (×1) *when in pivot mode*

  This manages the user interface for changing the group or pivot of the data.  It manages its own
  GridFilterSet and GridTable for filtering and showing the data.

* Prefs (×1)

PivotControl
============

* GridTable (×1)

* GridFilterSet (×1)

GridTable
=========

* DataView (×1)

  The view is used as the source of data that is output within the grid.

  Important methods:

  - ``getData()``

DataView
========



* DataSource (×1) — The backing source of the data used by this view.
