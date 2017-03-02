***********
Data Source
***********

A data source represents a place where data comes from and how to retrieve it.  For example, a data
source can be used to send parameters to a system report.  The data source keeps a "clean" copy of
the source data, which can be used by a :doc:`data view <data_view>` to represent different ways of
looking at the data.

The data source is in charge of taking input from the user, using that to obtain data from
somewhere, and transforming the result so it can be used for a grid and/or graph.  Data sources have
a many-to-many relationship with grids/graphs, so you can have a single data source for three
different grids, or several data sources that are combined together for the same graph.  You can use
them to show different portrayals of the same data, or combine several disparate sets together into
one visualization.

A data source actually captures four different types of information:

- raw data, conceptually "rows" and "columns" but we refer to the columns as "fields"
- type information of the fields
- the "display names" of the fields (if different from the field names)
- unique values across all rows for each field

Type Info
=========

+----------+-------------+
| Type     | Description |
+==========+=============+
| number   |             |
+----------+-------------+
| string   |             |
+----------+-------------+
| date     |             |
+----------+-------------+
| time     |             |
+----------+-------------+
| datetime |             |
+----------+-------------+

Conversion
==========

The data source can be passed an array of functions which can process the data however they like.
For each row, for each field within that row, the data source goes through the list of conversion
functions.  If it returns null, the next function is tried.  The first one that returns non-null
sets the new value.  If none return non-null, then the original value is maintained.  You don't want
to do too much work in these functions, because they're going to get called a lot.

**Example**

.. code-block:: javascript

   var tryInt = function (val) { return _.isInt(val) ? parseInt(val, 10) : null; }
   var tryFloat = function (val) { return _.isFloat(val) ? parseFloat(val) : null; }
   var tryDate = function (val) { return new Date(val); }

   var dataSource = new MIE.DataSource({
     type: 'http',
     url: 'data.json',
     conversion: [tryInt, tryFloat, tryDate]
   });

Backends
========

Local Data
----------

HTTP Request
------------
