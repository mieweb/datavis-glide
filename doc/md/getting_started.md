# Getting Started

## Building

This project can be built using Make.

```
$ make setup
$ make datavis

$ make tests
$ make serve
```

Make is also used to generate documentation, build & run tests, and other stuff.  See the [Development section](development/index.md) for lots more information about pre-requisites, building DataVis, and running the local data server.

## Installation

Copy the JS and CSS files from the `dist` directory and include them in your page. Or follow one of the following examples:

- [Static JavaScript + HTML](using/static.md)
- [Building with Rollup](using/rollup.md)
- [Using Vite](using/vite.md)

## Runtime Dependencies

There are no JavaScript runtime dependencies. Everything is now bundled within the `wcdatavis.js` file. When using DataVis as a dependency from NPM, simply import it.

All CSS dependencies except FontAwesome are bundled into the `wcdatavis.css` file.

## Basic Concepts

At the bare minimum, you need to create three objects:

- An instance of `Source` to retrieve data.
- An instance of `View` to perform operations like group and sort.
- An instance of `Grid` to display the results.
