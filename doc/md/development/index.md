# Development

## Managing Branches

DataVis has (mainly) two branches: `stable` and `master`.  In general, `stable` is what's out there in the wild, and `master` is what's next.  There are also feature branches when necessary, like if it's a really big change or will take a while to finish.

* For bug fixes, commit into the `stable` branch and merge to `master`.
* For minor new features and refactoring, commit into `master` and merge into `stable` when they're well tested.
* For major new features, commit to a feature branch, merging from `master` to keep up-to-date.  When done, merge info `master` and delete the feature branch.  Merge from `master` to `stable` when you're ready.

## Conventions

The number one convention is to avoid making unnecessary diffs.  Follow the style of what's already there, in the area near where you're making a change.  This overrides all other recommendations.

### Formatting Standards

* Code is indented with tabs. Each tab is 2 visual spaces.
* Don’t [cuddle your else keywords](http://wiki.c2.com/?CuddledElseBlocks).
* Combine declarations for variables without initializers; use separate declarations for variables with initializers.

### General Guidelines

* Maintain compatibility with IE10.  I know, this sucks.
* If you're going to potentially call another function with the same arguments, use `var args = Array.prototype.slice.call(arguments)` and apply the function call to `args`.
* Check arguments at the start of a function.  For example, does an argument need to be a function?  Make sure that it is.  The point is to throw an exception as early as possible for any developer mistakes.
* After checking argument validity, set any default values for variables, or defaults for keys in an object.
* Don't use `console` methods directly.  Use `log` for normal console messages, `debug` for debugging messages, and `logAsync()` for logging asynchronous stuff (i.e. JS thread yields).
* Use exceptions liberally for unrecoverable situations, like `throw new Error('...')`.  This makes mistakes easier to catch because they're obvious as we're testing.
* For recoverable errors (i.e. "you asked for that but I know that's wrong so I'm going to do this instead so things are still usable") log an error to the console with `log.error()`.
* For things that are wrong but not going to break anything, use `log.warn()`.

!!! important
    Again, it's really important that we maintain compatibility with IE10.  That means no arrow functions, no template strings, no destructuring, no classes or modules.

### Object Orientation

* The first line of any method should be `var self = this`.
* Never use `this` unless within an event handler or something like that.  Always use `self` to refer to the instance that the method is being invoked on.
* Use `makeSubclass` to create class hierarchies.  Toplevel classes should have `Object` as their superclass.
* Use `self.super` to access methods in superclasses.

## Pre-Requisites

The DataVis support tooling is written in both JavaScript and Python.  For the latter, I recommend setting up a virtualenv using the latest stable Python 3 release first.  Then you can run the following to get all the required packages.

```
$ git submodule update --init
$ npm install
$ pip install -r requirements.txt
```

## Compiling

After installing the [Pre-Requisites](#pre-requisites), run `make` to build the JS and CSS files for DataVis.  You can also run `make tests` to (1) build and copy the JS and CSS files to `tests/pages`, and (2) generate the data files needed for testing.  See [Building Test Data](#building-test-data) below.

## Running the Local Server

By running the local HTTP server, you can easily get to the documentation and test pages as you work on the code.  It runs on port 5000 and can be started with `make serve`.  Here are some links for useful stuff, once you get it running:

- [DataVis JS API Docs](http://localhost:5000/jsdoc/index.html)
- [DataVis Manual](http://localhost:5000/doc/html/index.html)
- [Testing Library JS API Docs](http://localhost:5000/tests/jsdoc/index.html)
- [Grid Test Pages](http://localhost:5000/tests/pages/grid/)

!!! note
    By default, the local HTTP server uses port 5000 but your computer may already be using that port for something else.  In that case, you'll see a warning in the console, along with what port it used instead; adjust the previously listed URLs accordingly.

## Testing

### Building Test Data

The program that generates the data is written in Python, and uses the packages we installed in [Pre-Requisites](#pre-requisites).

Test data is generated from [JSON5](https://json5.org) test files located in the `tests/data/templates` directory.  The resulting data files can be found in `tests/data` and get copied to `tests/pages` for use by the automated tests.  See [the json-gen documentation](json_gen.md) for more information about the template files.

You'll also need a word list, as some of the data files contain random dictionary words.  The tests expect the word list from the `words` package, specifically version `3.0-17.el6` from CentOS.  By default, `json-gen` expects to find this word list at `/usr/share/dict/words` — if you have this file elsewhere, you can specify that path as the `DICT_FILE` environment variable when running *make*.

### Writing Tests

Automated tests for DataVis are written in JavaScript using [Selenium](https://seleniumhq.github.io/selenium/docs/api/javascript/) and [Mocha](https://mochajs.org).  The [Chai](https://www.chaijs.com/api/assert/) assertion and [Bluebird](http://bluebirdjs.com/docs/api-reference.html) promise libraries are also heavily used.  At first, I found writing these asynchronous tests pretty mind-bending, but with a library of useful utility functions, it gets easier.

In general, the approach for each test suite (i.e. file) is to define a data structure specifying what to check and what the results should be.  Then iterate over that structure, building up `describe()` and `it()` functions as you go.

### Running Tests

Build everything needed for manual testing with `make tests` (the test pages make great examples), and run all automated tests using `make test`.

You can also run individual test files using Mocha directly:

```
[wcdatavis] $ ./node_modules/mocha/bin/mocha -t 10000 tests/selenium/sort.js
```

If every test causes a window to pop up and immediately close, resulting in a failed test, then it's likely that your locally installed version of Chrome is out of sync with the `chromedriver` NPM package.  This happens all the time.  Open Chrome and check the version.  If that's more recent than the version of `chromedriver` specified in DataVis' `package.json` then update it to whatever the matching release is from the [chromedriver NPM page](https://www.npmjs.com/package/chromedriver).  Then run `npm install` to get the new `chromedriver` package and try running tests again.

## Building Documentation

To build all documentation, after installing the required dependencies, simply use `make doc`.  This builds both the JS API docs and the manual.

### JavaScript API Docs

The JavaScript API documentation is generated from the comments of the source code using *jsdoc*.  After installing the [Pre-Requisites](#pre-requisites), run `make jsdoc` to build the JavaScript API documentation.  The result is in the `jsdoc` directory, which can be accessed via the [local server](http://localhost:5000/jsdoc/index.html).

### This Manual

The manual is written in Markdown using a Python program called *mkdocs*.  After installing the [Pre-Requisites](#pre-requisites), run `make mkdocs` to produce the documentation in the `doc/html` directory.  These can then be accessed via the [local server](http://localhost:5000/doc/html/index.html).

!!! tip
    When actively working on the documentation, you can also use `mkdocs serve` to start a separate server that only provides the documentation, but reloads automatically as you edit the pages.

### Testing JS API Docs

Since tests are written in JavaScript, the libraries that help with testing are also documented with jsdoc.  You can build them by running `make jsdoc` in the `tests` directory, or by running `make doc` at the toplevel directory.  The resulting pages go into `tests/jsdoc` and can be accessed via the [local server](http://localhost:5000/tests/jsdoc/index.html).
