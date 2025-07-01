# Best Practices

## Managing Branches

DataVis has three different kinds of branches:

- **development** (`master`): Mostly stable and fully merged branch.  Eventually this will become the next major release.

- **release** (e.g. `v3.0`, `v3.1`): Stable and released version of DataVis.  Only bug fixes are allowed.  Hereafter, just called the "stable" branch, although there is one for each major release.

- **feature** (e.g. `feature/server_limit`, `feature/mirage`): Feature branches are for active development where you want to commit stuff that doesn't fully work yet.

How do you know where changes should go?

* For bug fixes, commit into every stable branch that needs it. Merge from the latest stable branch into `master`.
* For minor changes or new features that don’t have breaking changes, create a new branch off the most recent stable branch and make them there. (For example, if the latest stable is `v3.2` then make a branch called `v3.3` and make the new feature there.) Merge from that branch into `master`.
* For major new features or breaking changes, commit to a feature branch, merging from `master` to keep up-to-date.  When done, merge into `master` and delete the feature branch. When ready to release, create a new major release branch (e.g. `v4.0`) from `master`.
* Testing changes should be included in as many stable branches as possible, because tests will be run in every stable branch before release. Remember to merge into `master`, too.
* Documentation changes can be included only in the most recent stable branch, then merged into `master`. This is because we (currently) only build one set of documentation.

### Tips for Switching Branches

Always, *always* do the following:

- `make teardown`
- `make setup`

This ensures that all dependencies are fully wiped out and rebuilt for the current branch.  You may also get a message about running `nvm use` — that means a specific version of Node is required for the support code.

## Conventions

The number one convention is to avoid making unnecessary diffs.  Follow the style of what's already there, in the area near where you're making a change.  This overrides all other recommendations.

### Formatting Standards

* Code is indented with tabs. Each tab is 2 visual spaces.
* Don't [cuddle your else keywords](http://wiki.c2.com/?CuddledElseBlocks).
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
