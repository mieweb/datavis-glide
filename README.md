# DataVis

# User

## Traditional Web Site

* Run `make`.
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

# Tree Structure

* `bin` — Contains programs used to build other stuff, e.g. a JSON generator.
* `dist` — After compiling with `make`, contains the JS and CSS files for DataVis.
* `doc` — Pandoc documentation source.
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
