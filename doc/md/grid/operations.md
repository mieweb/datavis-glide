# Operations

“Operations” are tasks that can be performed on selected rows within a grid. There are three different types of operations. To make it easier to understand, let’s say we’re writing a grid that will work as an email inbox: it has columns for the sender, date, and subject. Maybe it looks something like this:

| Sender         | Date      | Subject                                 |
| -------------- | --------- | --------------------------------------- |
| Peter Potamus  | today     | Did you get that thing that I sent you? |
| Harvey Birdman | yesterday | Re: F. Flinstone settlement             |

Now let’s look at the three kinds of operations.

- Multi-select operations can be performed on many rows at once. “Mark Read” would be an example of such an operations, because you can select several emails and mark them at once.
- Row-based operations can be performed on a single row. “Reply” would be an example of such an operation, because it’s an activity performed based on the entity (viz. an email) represented by the row.
- Cell-based operations can be performed on a single row and are located within the cell. “View Contact” would be an example of such an operation, located within the “Subject” column.

## Configuring Operations

In order to set the operations that a grid supports at the time of grid creation, use the following:

```
new MIE.WC_DataVis.Grid({
  id: 'grid',
  ...
  operations: {
    row: [{
      icon: 'fa-reply',
      tooltip: 'Reply',
      callback: function (row) {
        console.info('Performing "Reply" operation on row: %O', row);
      }
    }, ...],
    cell: {
      'Sender': [{
        icon: 'fa-user',
        tooltip: 'View Contact',
        callback: function (info) {
          console.info('Performing "View Contact" operation on row: %O', info.row);
        }
      }, ...],
      ...
    },
    all: [{
      icon: 'fa-trash',
      label: 'Delete',
      callback: function (info) {
        console.info('Performing "Delete" operation on rows: %O', info.rows);
      }
    }, ...]
  }
});
```

You can also set the operations object after the grid has already been created using the `Grid#setOperations()` method.

