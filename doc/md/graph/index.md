# Graph

Just like [grids](../grid/index.md), graphs are bound to views which manage the data and perform operations on it. This means that a graph and grid can show the same data by sharing a view, and this is the main use case. By grouping, pivotting, and calculating aggregate functions in a grid, a graph connected to the same view can depict the results.

It is also possible, by defining a perspective in the source code, to use a graph without any connected grid. The perspective replaces the interactive configuration of the view by the grid. Here’s [an example of that](site:../examples/graph/google-no-grid.html).

# Graph Types

## Bar / Column Charts

|            |                     |
| ---------- | ------------------- |
| Renderers  | Google              |
| Graph Type | `bar` / `column`    |
| Data Modes | plain, group, pivot |

A bar or column chart shows values plotted as the length of a block
which corresponds to a bucket of data.

### Configuration Options

  - `categoryField` : string (plain mode only)

    Name of the field which gives the category (i.e. “bucket”) of the
    box. In column / vertical graphs, this is the x-axis value; in bar /
    horizontal graphs, this is the y-axis value. The “display text” of
    the corresponding column in the grid overrides the field name in the
    axis label.

  - `valueField` : string (plain mode only)

    Name of the field which determines the size of the box. In column /
    vertical graphs, this is the y-axis value; in bar / horizontal
    graphs, this is the x-axis value. The “display text” of the
    corresponding column in the grid overrides the field name in the
    axis label.

  - `options` : object

    Additional configuration which is passed directly to the renderer.
    See the [Google Charts
    documentation](https://developers.google.com/chart/interactive/docs/gallery/columnchart#configuration-options)
    for a complete list.
