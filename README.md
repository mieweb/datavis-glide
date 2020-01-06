# DataVis

# User

## Traditional Web Site

* Run `npm install` to get dependencies.
* Run `npm run rollup` to build the JS file.
* Run `npm run uglify` to compress the JS and CSS files.
* Copy `dist/wcdatavis.js` and `dist/wcdatavis.css` to your server.
* Include them like any other JS and CSS files.

# Developer

## Managing Branches

* For bug fixes, commit into the `stable` branch and merge to `master`.
* For minor new features and refactoring, commit into `master` and merge into `stable` when they're well tested.
* For major new features, commit to a feature branch, merging from `master` to keep up-to-date.  When done, merge info `master` and delete the feature branch.  Merge from `master` to `stable` when you're ready.

## Conventions

The number one convention is to avoid making unnecessary diffs.  Follow the style of what's already there, in the area near where you're making a change.  This overrides all other recommendations.

### General

* If you're going to potentially call another function with the same arguments, use `var args = Array.prototype.slice.call(arguments)` and apply the function call to `args`.
* Check arguments at the start of a function.  For example, does an argument need to be a function?  Make sure that it is.  The point is to throw an exception as early as possible for any developer mistakes.
* After checking argument validity, set any default values for variables, or defaults for keys in an object.
* Don't use `console` methods directly.  Use `log` for normal console messages, `debug` for debugging messages, and `logAsync()` for logging asynchronous stuff (i.e. JS thread yields).
* Use exceptions liberally for unrecoverable situations, like `throw new Error('...')`.  This makes mistakes easier to catch because they're obvious as we're testing.
* For recoverable errors (i.e. "you asked for that but I know that's wrong so I'm going to do this instead so things are still usable") log an error to the console with `log.error()`.
* For things that are wrong but not going to break anything, use `log.warn()`.

### Object Orientation

* The first line of any method should be `var self = this`.
* Never use `this` unless within an event handler or something like that.  Always use `self` to refer to the instance that the method is being invoked on.
* Use `makeSubclass` to create class hierarchies.  Toplevel classes should have `Object` as their superclass.
* Use `self.super` to access methods in superclasses.

## Building Documentation

### Manual

The manual covers how to use and develop DataVis.  It's written in Markdown and compiled to HTML using a Python program called mkdocs.  You need the following Python modules to build the manual.

* mkdocs
* mkdocs-material
* pymdown-extensions

Run `make mkdocs` to build the manual.  You can also run `mkdocs serve` to start a web server that will automatically reload your browser when changes are made to the corresponding Markdown files, ideal when working on the documentation.

### API Documentation

The API documentation covers every class and method in DataVis.  It's written in the comments of the source code and is compiled to HTML using a JavaScript program called jsdoc.  Follow these steps to build the API documentation:

1. Run `git submodule update --init` to get the JSDoc templates that this project uses.
2. Run `npm install` to get JSDoc and all its dependencies.
3. Run `make jsdoc` to build the API documentation.

## Running

This project contains a builtin web server for interactively testing features during development.  Run `make serve` to start the server on port 5000.

## Automated Testing

DataVis uses Mocha + Selenium for browser testing.  Run `npm install` and then `make test` to run all available Selenium tests.  Since tests run in Node.js, please use any available JavaScript features you want (e.g. async/await, destructuring assignment, etc).

### Dependencies

A Python program called `json-gen` is used to generate test data files.  You'll need the following modules:

* babel
* json5
* dicttoxml

You'll also need a word list, as some of the data files contain random dictionary words.  The tests expect the word list from the `words` package, specifically version `3.0-17.el6` from CentOS.  By default, `json-gen` expects to find this word list at `/usr/share/dict/words` — if you have this file elsewhere, you can specify that path as the `DICT_FILE` environment variable when running *make*.

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
