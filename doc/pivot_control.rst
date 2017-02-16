*************
Pivot Control
*************

The pivot control class represents the user interface that surrounds a grid in pivot mode.  There
are five major components.  Note that in pivot mode, what we would normally call "columns" (i.e.
from a system report, or shown in a regular grid) are instead called "fields."  This is because when
pivotting by a field, the values of that field in various rows become columns in the output.

* *available fields* — Fields from the data which can be grouped or pivotted by are shown here.
* *grouped fields* — Fields that are currently being grouped by are shown here.
* *pivotted fields* — Fields that are currently being pivotted by are shown here.
* *aggregate method* — This lets the user configure what aggregate method should be used to compute
  the values shown for the grouped/pivotted data.
* *data table* — This is a grid table of the grouped and pivotted data.  Filtering is disabled in
  this grid table, and should be done through the three field areas noted above.

Filtering
=========

Since a pivot table does not show the original data, it doesn't make much sense to allow it to be
filtered.  Instead, the user interacts with the pivot control to filter data before the pivot result
has been determined.  In this way, the pivot control uses a grid filter set just as a normal grid
does.

Normal Grid
-----------

* Editing enabled in the GridTable.
* GridFilterSet owned by the GridTable.
* GridFilterSet configures and updates the DataView.
* GridFilters are appended to ``TH`` elements (within GridTable).

Pivot Table
-----------

* Editing disabled in the GridTable.
* GridFilterSet owned by the PivotControl.
* GridFilterSet configures and updates the DataView.
* GridFilters are appended to ``DIV`` elements (within PivotControlField).

User Interface
==============

::

  div.gridwrapper (self.ui.container)
    div (self.ui.rows)
    div (self.ui.columns)
    div (self.ui.table)
