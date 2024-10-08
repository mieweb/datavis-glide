# Sorting

The configuration of the View’s sort behavior is different depending on
whether the data has been grouped or pivotted.

## Plain

## Group — Summary



## Group — Detail

In detail mode, also known as “tree mode,” you can sort by the grouped field values (i.e. rowvals) and non-grouped field values independently. The spec looks like this:

```
{
  groups: {
    field: "...",
    dir: "..."
  },
  data: {
    field: "...",
    dir: "..."
  }
}
```

The process of grouping causes an inherent sort by the natrep of the 

## Pivot
