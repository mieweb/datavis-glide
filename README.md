# DataVis

DataVis is a tool for exploring, manipulating, and visualizing data. It can import data over HTTP (XML, JSON, CSV) or from a file (CSV), or it can use data already in JavaScript on the page. It can automatically parse different types of data including dates and times, numbers (including arbitrarily large integers), and currency. It allows interactive filtering, grouping, pivotting, and aggregation with support for custom aggregate functions. For grouped data, it supports "drilling down" to the underlying population. It can store the current configuration as a "perspective" you can immediately return to later. You can export what's shown on screen to CSV, or display it in a graph.

# How to Use

## Traditional Website

1. Run `npm install` to get dependencies.
2. Run `npm run rollup` to build the JS file.
3. Run `npm run uglify` to compress the JS and CSS files.
4. Copy `dist/wcdatavis.js` and `dist/wcdatavis.css` to your server.
5. Include them like any other JS and CSS files.

# How to Develop

See the [Development section of the Manual](doc/md/development/index.md) for a full explanation.  What follows is a synopsis.

## Pre-Requisites

1. Run `git submodule update --init` to get all the source code.
2. Run `npm install` to get the Node tools needed to build/test.
3. Run `pip install -r requirements.txt` to get Python tools needed to test.

## Quickstart

We use GNU Make to provide a simple interface to the various tools to build and test DataVis.

* `make` — Build the compressed DataVis JS and CSS files.
* `make tests` — Same as `make`, then copy to tests directory, and build test data.
  * `make DICT_FILE=[path] tests` — To set the dictionary file path when generating test data.
* `make serve` — Start local server for interactive testing.
* `make test` — Same as `make tests`, then run automated tests using Mocha & Selenium.
* `make doc` — Build all documentation.
  * `make jsdoc` — Build JS API documentation from comments in the source.
  * `make mkdocs` — Build the Manual from Markdown files.

# Tree Structure

* `bin` — Contains programs used to build other stuff, e.g. a JSON generator.
* `dist` — After compiling with `make`, contains the JS and CSS files for DataVis.
* `doc` — The user & developer manual.
  * `md` — Manual Markdown source files.
  * `html` — Manual HTML output files.
* `examples`
  * `graph` — Examples using graph output.
  * `grid` — Examples using grid output.
  * `test` — QUnit tests (these may move eventually).
* `src` — Contains all the source JS files.
  * `renderers` — Classes for DataVis output.
  * `ui` — Classes for user interface components.
  * `util` — Classes and modules for utilities.
* `tests`
  * `data` — Data files for testing and examples.
    * `*.json5` — Input for generating JSON files.
    * `*.in.json` — Input for generating JSON files.
  * `lib` — Auxiliary JS files to help make writing test cases easier.
  * `pages` — HTML pages used for running Selenium tests.
  * `selenium` — Selenium test case files.

## Submodules

* `jaguarjs-jsdoc` — Submodule for the JSDoc template used to build documentation.
