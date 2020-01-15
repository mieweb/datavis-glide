# DataVis

# User

## Traditional Web Site

1. Run `npm install` to get dependencies.
2. Run `npm run rollup` to build the JS file.
3. Run `npm run uglify` to compress the JS and CSS files.
4. Copy `dist/wcdatavis.js` and `dist/wcdatavis.css` to your server.
5. Include them like any other JS and CSS files.

# Developer

See the [Development section of the Manual](doc/md/development/index.md) for a full explanation.

## Pre-Requisites

Do this first, or else none of the following will work.

```
$ npm install
$ pip install -r requirements.txt
```

## Quickstart

* `make` — Build the DataVis JS and CSS files.
* `make tests` — Same as `make`, then copy to tests directory, and build test data.
* `make serve` — Start local server for interactive testing.
* `make test` — Same as `make tests`, then run automated tests using Mocha & Selenium.
* `make jsdoc` — Build JS API documentation.
* `make mkdocs` — Build the Manual.

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
* `jaguarjs-jsdoc` — Submodule for the JSDoc template used to build documentation.
* `src` — Contains all the source JS files.
* `tests`
  * `data` — Data files for testing and examples.
    * `*.json5` — Input for generating JSON files.
    * `*.in.json` — Input for generating JSON files.
  * `lib` — Auxiliary JS files to help make writing test cases easier.
  * `pages` — HTML pages used for running Selenium tests.
  * `selenium` — Selenium test case files.
