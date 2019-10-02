# Known Issues

On Chrome 58, with jQuery 3.2.4, `TableTool.setupDetection()` runs
before `TableTool.init()`, which leaves the variable body set to null,
and causes an error when attempting to check `body.height` in the
`setupDetection()` function. Using an older version of jQuery (e.g.
1.12.4) or an older version of Chrome (e.g. 57) prevents this. For this
reason, the examples distributed with WC DataVis use jQuery 1.12.
