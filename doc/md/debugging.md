# Debugging & Errors

If some kind of unexpected behavior occurs, you can check for the
following:

1.  Errors logged on the console — these generally indicate an issue
    with the configuration, or with the data, but which is recoverable
    (e.g. you enabled an option that conflicts with something else; it
    will just be ignored).

2.  Unhandled exceptions — there are several reasons you might get
    these:
    
    1)  An error arising from the source origin (e.g. an HTTP request to
        download the data goes awry).
    2)  A problem with configuration or data that can’t be recovered
        from.
    3)  A flaw in the library itself.

These previous things will always show up in the browser’s development
tools. If you want to get more detail, or there is no error log or
exception showing up, you can try:

3.  Debugging messages — these are quite verbose and are logged only if
    the variable `MIE.DEBUGGING` is true when the message would be
    printed.

## Perspectives

If the preferences system is behaving strangely, the recommended
approach is to try a “reset and refresh” of the system:

1.  Click the “undo” icon next to the perspective switcher to reset all
    perspectives.
2.  Refresh the page.
