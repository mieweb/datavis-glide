***************
Group and Pivot
***************

Example Data
============

+-------+---------+---------+------------+------+
| Row # | Country | Store   | Product    | Sold |
+=======+=========+=========+============+======+
| 1     | USA     | Kroger  | Apple      | 3    |
+-------+---------+---------+------------+------+
| 2     | USA     | Kroger  | Banana     | 8    |
+-------+---------+---------+------------+------+
| 3     | USA     | Kroger  | Strawberry | 12   |
+-------+---------+---------+------------+------+
| 4     | USA     | Walmart | Apple      | 7    |
+-------+---------+---------+------------+------+
| 5     | USA     | Walmart | Banana     | 4    |
+-------+---------+---------+------------+------+
| 6     | USA     | Meijer  | Apple      | 2    |
+-------+---------+---------+------------+------+
| 7     | Canada  | Kroger  | Apple      | 5    |
+-------+---------+---------+------------+------+
| 8     | Canada  | Kroger  | Banana     | 1    |
+-------+---------+---------+------------+------+
| 9     | Canada  | Kroger  | Strawberry | 9    |
+-------+---------+---------+------------+------+
| 10    | Canada  | Walmart | Apple      | 4    |
+-------+---------+---------+------------+------+
| 11    | Sweden  | Kroger  | Apple      | 1    |
+-------+---------+---------+------------+------+
| 12    | Sweden  | Kroger  | Banana     | 20   |
+-------+---------+---------+------------+------+
| 13    | Sweden  | Walmart | Apple      | 6    |
+-------+---------+---------+------------+------+

Group Operation
===============

To perform a group operation, we need to know the "group fields."  These are the columns from the
original data, which we want to group by (it's an array of strings).  Using this, we produce two
values: the "row values" and the "data."  An example is the easiest way to convey how these work:

::

  groupFields = ["Country", "Store"]

  rowVals = [["USA", "Kroger"],
             ["USA", "Walmart"],
             ["USA", "Meijer"],
             ["Canada", "Kroger"],
             ["Canada", "Walmart"],
             ["Sweden", "Kroger"],
             ["Sweden", "Walmart"]]

  data = [[#1, #2, #3],
          [#4, #5],
          [#6],
          [#7, #8, #9],
          [#10],
          [#11, #12],
          [#13]]

To explain this in words: ``rowVals[X][Y]`` is a value of ``groupFields[Y]`` for all the rows in
``data[X]``.  Or to put that another way, ``data[X]`` contains all the rows that have a property
``groupFields[Y]`` with a value of ``rowVals[X][Y]``.

* ``data[0]`` contains all rows that have:

  * Country = USA
  * Store = Kroger

* ``data[1]`` contains all rows that have:

  * Country = USA
  * Store = Walmart

And so on.

Pivot Operation
===============

.. important ::

   The data must be grouped before we can pivot it.

::

  foreach group in data
    foreach v in pivotVals
      tmp = filter(rows, λ r . r[f] == v)
      result[v] = agg(tmp)
