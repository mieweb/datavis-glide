# Architectural Overview

This is a reference for all the main classes involved in the datavis library, and how they relate to each other.

This diagram shows the flow of data broadly through the system.

``` mermaid
graph TD
  Source --> View
  View --> Grid
  View --> Graph
```

* The source is in charge of obtaining the data from an origin, and transforming what it gets into the internal representation used by DataVis.
* The view is repsonsible for implementing operations on the data:
    * *filtering* — Removing data elements we're not interested in.
    * *grouping* — Categorizing data based on shared values; in tables this is shown vertically.
    * *pivotting* — A second layer of categorization; in tables this is shown horizontally.
    * *aggregation* — Computation based on the data in their categories.
* The grid/graph takes the data from the view and presents it to the user, along with any user interface necessary to interface with the lower components (e.g. to refresh the source, or to change the operations performed by the view).

## Source

``` mermaid
graph LR
  Source --- SourceParam
  Source --- Origin["HttpSource<br>FileSource<br>LocalSource"]
  style Origin text-align:right
```

Each source has an origin, which is responsible for:

* fetching the data and decoding it (e.g. from JSON)
* fetching type information and decoding it into a dictionary

The source takes this information from the origin, and performs the following operations:

* data conversion, using custom callbacks to transform the data
* type decoding, e.g. converting strings into dates/currencies

See [the source section of the manual](../source/) for more information.

## View

``` mermaid
graph LR
  View --- Source
  View --- Aggregate["AGGREGATE_REGISTRY<br>AggregateInfo"]
  View --- GroupFunction["GROUP_FUNCTION_REGISTRY<br>GroupFunction"]
```

## Grid

``` mermaid
graph LR
  Grid --- View
  Grid --- GridRenderer
  GridRenderer --- GridTable
  GridTable --- GridTablePlain
  GridTable --- GridTableGroupSummary
  GridTable --- GridTableGroupDetails
  GridTable --- GridTablePivot
  Grid --- Toolbars["PrefsToolbar<br>PlainToolbar<br>GroupToolbar<br>PivotToolbar<br>RendererToolbar"]
  style Toolbars text-align:right
  Grid --- Controls["FilterControl<br>GroupControl<br>PivotControl<br>AggregateControl"]
  style Controls text-align:right
  Grid --- GridFilterSet
```
