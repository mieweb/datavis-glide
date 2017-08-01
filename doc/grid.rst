Grid
####

Definition Object
=================

::

   defn
     source
     [sortSpec]
     [gridFilterSet]
     [prefs]
     [server]
       filter
       limit
     [grid]
     [_id]
     [error]
     [_data]
     [locks]
     [_events]
     table
       [blockCount]
       [output]
         method
       [prefs]
         gridId
         enableSaving
       id
       [enableEditing]
       features
         sort                    - enables sorting by column
         filter                  - enables filtering column data
         group                   - enables grouping control
         pivot                   - enables pivot control
         rowSelect               - enables selecting rows
         rowReorder              - enables reordering rows
         add                     - enables adding rows
         edit                    - enables editing columns in a row
         delete                  - enables deleting rows
         limit                   - enables limiting output ("more" / paging)
         tabletool               - enables using tabletool floating header
       incremental
         appendBodyLast          - if true, put body in page after rows have been added to it
         chunkSize               - number of rows at add at a time
         delay                   - how many milliseconds to wait between rendering
         method                  - setTimeout | requestAnimationFrame
       limit
         method                  - more | paging
         threshold               - how many total rows trigger limiting
       columns
       [columnConfig]

Grouping
========

Grouped output consists of two main parts: the group itself, and the data within the group.  These
sort independently, so you can actually sort by two different columns in grouped output mode: one
column must be a group field, and the other must be a non-group field.

Sorting Group Fields
--------------------

Sorting group fields causes the groups to be reordered according to the sort.  It does not affect
the ordering of the data within the groups.

Sorting Non-Group Fields
------------------------

Sorting non-group fields causes a sort to occur within each group.  It does not affect the ordering
of the groups themselves.
