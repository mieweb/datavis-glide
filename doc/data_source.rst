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

The type information obtained from the source indicates how the data should be interpreted.
Usually, data formats like XML and JSON do not allow flexible representation of all the different
types of data that we're interested in.  For example, you can't put a date into JSON unless you
encode it as a string or number.  Having the type information tells the data source that the value
should be treated as a date.  That information propagates to the view, where it can affect how the
value is displayed, sorted, or filtered.

The type information for each field indicates the following:

* The type (e.g. number, string, date).
* The format (e.g. "MM-DD-YYYY") — used for dates, times, and datetimes.

.. table:: Available types

   +--------------+--------------------------------------------------------------------------------+
   | Type         | Description                                                                    |
   +==============+================================================================================+
   | ``number``   | Integer of floating point number; primarily used for sorting numerically.  The |
   |              | internal value is a number.                                                    |
   +--------------+--------------------------------------------------------------------------------+
   | ``string``   | Catch all data type, can contain anything at all.                              |
   +--------------+--------------------------------------------------------------------------------+
   | ``date``     | A string containing a date, which can be formatted or sorted.  The default     |
   |              | format is "YYYY-MM-DD."  The internal value is a Date instance.                |
   +--------------+--------------------------------------------------------------------------------+
   | ``time``     | A string containing a time, which can be formatted or sorted.  The default     |
   |              | format is "HH:mm:ss."  The internal value is a string.                         |
   +--------------+--------------------------------------------------------------------------------+
   | ``datetime`` | A string containing both a date and time, which can be formatted and sorted.   |
   |              | The default format is "YYYY-MM-DD HH:mm:ss."  The internal value is a Date     |
   |              | instance.                                                                      |
   +--------------+--------------------------------------------------------------------------------+

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

The HTTP request data source simply makes an AJAX request to get data.  The data can either be in
JSON or XML.  You don't need to indicate which one is being used, we figure it out automatically.
However, you must adhere to a specific format for the data, which is outlined below.

.. code-block:: javascript

  var dataSource = new MIE.DataSource({
    type: 'http',
    url: '/data.json'
  });

JSON Data
^^^^^^^^^

Here's the format for data expressed using JSON.

::

  {
    data: [
      {
        FIELD: VALUE,
        ...
      },
      ...
    ],
    typeInfo: {
      FIELD: {
        type: TYPE-NAME,
        format: FORMAT-STRING
      },
      ...
    }
  }

XML Data
^^^^^^^^

Here's the format for data expressed using XML.

::

  <root>
    <data>
      <item>
        <FIELD>VALUE</FIELD>
        ...
      </item>
      ...
    </data>
    <typeInfo>
      <FIELD>
        <type>TYPE-NAME</type>
        <format>FORMAT-STRING</format>
      </FIELD>
      ...
    </typeInfo>
  </root>
