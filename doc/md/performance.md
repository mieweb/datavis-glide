# Performance Tips

  - **Prevent type guessing by specifying the type of every non-string
    field in a source.**
    
    If a source origin identifies a field as having a “string” type, and
    it’s not overridden by the user, then DataVis (by default) will try
    to determine if there is actually some other type of data stored in
    that field.\[1\] This can be very costly, and the easiest way to get
    around it is just to specify the type of every field which the
    source origin identifies as a string. *If you know that a field is
    going to contain currency but the source origin will call it a
    string, tell the Source instance that it’s a currency.* And
    remember, all fields in all CSV origins are treated as strings
    unless the source is told, or guesses, otherwise.

<!-- end list -->

1.  This is because the first source for DataVis was to handle MySQL
    output, where the result set column types tended to be rather
    ambiguous, e.g. storing numbers in varchar fields.
