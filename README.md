# DataVis

DataVis is a tool for exploring, manipulating, and visualizing data. It can import data over HTTP (XML, JSON, CSV) or from a file (CSV), or it can use data already in JavaScript on the page. It can automatically parse different types of data including dates and times, numbers (including arbitrarily large integers), and currency. It allows interactive filtering, grouping, pivotting, and aggregation with support for custom aggregate functions. For grouped data, it supports "drilling down" to the underlying population. It can store the current configuration as a "perspective" you can immediately return to later. You can export what's shown on screen to CSV, or display it in a graph.

[Enjoy this video overview.](https://drive.google.com/file/d/1w1VGRYZbJ0Qyn8tUjQB9181lKfbeveQw/view)

## How to Use

### Traditional Website

1. Run `make setup` to get dependencies.
2. Run `make datavis` to build the JS file.
3. Copy `dist/wcdatavis.js` and `dist/wcdatavis.css` to your server.
4. Include them like any other JS and CSS files.

## How to Develop

See the [Development section of the Manual](doc/md/development/index.md) for a full explanation.  What follows is a synopsis.

### Quickstart

We use GNU Make to provide a simple interface to the various tools to build and test DataVis.

* `make setup` — Installs all dependencies.
* `make datavis` — Build the compressed DataVis JS and CSS files.
* `make tests` — Same as `make`, then copy to tests directory, and build test data.
* `make [PORT=] serve` — Start local server for interactive testing.
* `make test` — Same as `make tests`, then run automated tests using Mocha & Selenium.
* `make doc` — Build all documentation.
  * `make jsdoc` — Build JS API documentation from comments in the source.
  * `make mkdocs` — Build the Manual from Markdown files.
* `make clean` — Remove all build products and generated test data.
* `make teardown` — Resets the development environment.

## Tree Structure

* `bin` — Contains programs used to build other stuff, e.g. a JSON generator.
* `dist` — After compiling with `make`, contains the JS and CSS files for DataVis.
* `doc` — The user & developer manual.
  * `md` — Manual Markdown source files.
  * `html` — Manual HTML output files.
* `src` — Contains all the source JS files.
  * `renderers` — Classes for DataVis output.
  * `ui` — Classes for user interface components.
    * `filters` — Filter widget implementation.
    * `windows` — Modal dialogs.
  * `util` — Classes and modules for utilities.
  * `reg` — Registry files.
  * `lang` — Compiled language packs.
* `tests`
  * `data` — Data files for testing and examples.
    * `*.json5` — Input for generating JSON files.
    * `*.in.json` — Input for generating JSON files.
  * `lib` — Auxiliary JS files to help make writing test cases easier.
  * `pages` — HTML pages used for running Selenium tests.
    * `grid` — Tests specifically for the grid.
    * `graph` — Tests specifically for the graph.
    * `qunit` — Unit tests, mostly for the view.
  * `selenium` — Selenium test case files.

### Submodules

* `jaguarjs-jsdoc` — JSDoc template used to build documentation.
* `json-formatter-js` — A library to render JSON objects in a tree view.
