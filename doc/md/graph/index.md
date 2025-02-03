# Graph

Just like \[grids\]\[Grid\], graphs are bound to views which manage the
data. This means that a graph and grid can show the same data. Graphs
tend to show aggregate values, making them perfect for summarizing data
which has been grouped or pivotted. For this reason, it’s easy to
configure a graph to behave differently depending on how the data has
been organized.

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
