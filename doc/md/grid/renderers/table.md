# Table Grid Renderer

A grid table is a representation of the actual data table that appears
when rendering a grid, both in normal and in pivot mode. The grid table
creates the user interface for interactive sorting and filtering. The
grid table gets its data directly from the \_<span role="doc">data
view\<data\_view\></span>.

There are two ways that grid tables are used within the wcgraph library:

  - Under the control of a WCGRID instance. This is how it works when
    the grid is in non-pivot mode. The grid table has full features
    enabled (it controls sorting, filtering, and paging within the
    view).
  - Under the control of a PivotControl instance. This is how it works
    when the grid is in pivot mode. The grid table has filtering
    disabled (because the pivot control handles filtering).
      - The data view provides the grid table with pivotted data. This
        means that the rows and columns returned by `DataView#getData()`
        and the type information provided by `DataView.getTypeInfo()`
        reflect the fact that we are looking at a transformation of the
        data provided by the data source.
      - The pivot control sets the grouping, pivotting, and filtering of
        the view.
      - The grid table still controls sorting and paging.
