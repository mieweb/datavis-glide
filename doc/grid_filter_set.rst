***************
Grid Filter Set
***************

A grid filter set is a collection of :doc:`grid filters <grid_filter>`.  The grid filter set is
responsible for adding and removing grid filters to/from a grid.  It is also responsible for
building filter specs to send to the :doc:`data_view`.

JavaScript API
==============

.. js:class:: GridFilterSet(defn, thead)

   Create a new grid filter set.  The filter set is bound to the grid defined by ``defn``; the view
   used for filtering is found through that object.

   :param object defn: The grid definition.
   :param Element thead: The THEAD element where grid filters will be placed.

   .. js:function:: add(colName, colIndex, filterType, filterBtn)

   .. js:function:: build(colName, filterType)

      Builds a new grid filter instance.

      :param string colName: Name of the column that the new filter will affect.
      :param string filterType: Type of filter widget to use.

   .. js:function:: remove(id)

      Removes a grid filter from the grid, based on its unique ID.  This is usually invoked by the
      "click" handler of a grid filter's remove button.

      :param string id: The unique identifier of the grid filter to remove.

   .. js:function:: reset()

      Resets the state of the filter set, so that there are no filters on the grid.

   .. js:function:: update()

      This should be called whenever a grid filter is changed by the user.  It causes the grid
      filter set to look through all the grid filters, and build a filter spec.  That is then passed
      to the view to filter the data.
