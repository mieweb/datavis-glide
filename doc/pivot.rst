**************
Pivot Function
**************

In Transact-SQL (used by Microsoft SQL Server) there is a function called PIVOT.  What this does, is
turn unique values from rows in a single column into multiple columns.  For example:

::

  | Store    | Fruit  | Sold |  =>  | Store    | Apple | Banana | Orange |
  |----------+--------+------|      |----------+-------+--------+--------|
  | Kroger   | Apple  |    1 |      | Kroger   | 1     | 2      | 3      |
  | Kroger   | Banana |    2 |      | Wal-Mart | 4     | 5      | 6      |
  | Kroger   | Orange |    3 |
  | Wal-Mart | Apple  |    4 |
  | Wal-Mart | Banana |    5 |
  | Wal-Mart | Orange |    6 |

The unique values from the column "Fruit" get turned into columns, and the corresponding values of
"Sold" become the values in each column (with rows being grouped by store).

That's easy enough to see... with three dimensions.  How about if we add another?  Can we keep
going, or are we limited to a single pivotted column (in this case "Fruit")?

::

  | Country | Store    | Fruit  | Sold |  =>  | Country | Store    | Apple | Banana | Orange |
  |---------+----------+--------+------|      |---------+----------+-------+--------+--------|
  | Canada  | Kroger   | Apple  |    1 |      | Canada  | Kroger   |     1 |      2 |      3 |
  | Canada  | Kroger   | Banana |    2 |      | Canada  | Wal-Mart |     4 |      5 |      6 |
  | Canada  | Kroger   | Orange |    3 |      | Sweden  | Kroger   |    10 |     20 |     30 |
  | Canada  | Wal-Mart | Apple  |    4 |      | Sweden  | Wal-Mart |    40 |     50 |     60 |
  | Canada  | Wal-Mart | Banana |    5 |
  | Canada  | Wal-Mart | Orange |    6 |
  | Sweden  | Kroger   | Apple  |   10 |
  | Sweden  | Kroger   | Banana |   20 |
  | Sweden  | Kroger   | Orange |   30 |
  | Sweden  | Wal-Mart | Apple  |   40 |
  | Sweden  | Wal-Mart | Banana |   50 |
  | Sweden  | Wal-Mart | Orange |   60 |

Now pivot the result again...

::

  |         | Kroger                  | Wal-Mart                |
  | Country | Apple | Banana | Orange | Apple | Banana | Orange |
  |---------+-------+--------+--------+-------+--------+--------|
  | Canada  | 1     | 2      | 3      | 4     | 5      | 6      |
  | Sweden  | 10    | 20     | 30     | 40    | 50     | 60     |

So you can see that pivoting more than one "dimension" is the same as pivoting multiple times.

Thus, a "complete pivot" of a table involves:

* retaining the first column
* turning the last column into cells
* turning the combinations of all intervening columns into their own columns

We could describe the entire pivot operation using three properties:

* Anchor: column to retain (e.g. "Country")
* Values: data column (e.g. "Sold")
* Pivots: columns whose unique values we're turning into columns (e.g. ["Store", "Fruit"])

Let's take it just one step further.  What if there is more than one value corresponding to the
unique (anchor, pivots) pair?  Let's go back to the example above, but let's forget about individual
stores and see what sales are like across the entire country.

::

  | Country | Store    | Fruit  | Sold |  =>  | Country | Apple | Banana | Orange |
  |---------+----------+--------+------|      |---------+-------+--------+--------|
  | Canada  | Kroger   | Apple  |    1 |      | Canada  | 5     | 7      | 9      |
  | Canada  | Kroger   | Banana |    2 |      | Sweden  | 50    | 70     | 90     |
  | Canada  | Kroger   | Orange |    3 |
  | Canada  | Wal-Mart | Apple  |    4 |
  | Canada  | Wal-Mart | Banana |    5 |
  | Canada  | Wal-Mart | Orange |    6 |
  | Sweden  | Kroger   | Apple  |   10 |
  | Sweden  | Kroger   | Banana |   20 |
  | Sweden  | Kroger   | Orange |   30 |
  | Sweden  | Wal-Mart | Apple  |   40 |
  | Sweden  | Wal-Mart | Banana |   50 |
  | Sweden  | Wal-Mart | Orange |   60 |

The store column might as well not even be in the original, it doesn't make any difference to what
we're trying to accomplish.  By our definition of what constitutes a pivot above, here are the
properties that we are using:

* Anchor = "Country"
* Values = sum("Sold")
* Pivots = ["Fruit"]

So you can see that a pivot operation is not just limited to using the values directly, but can also
use the results of an aggregate function.
