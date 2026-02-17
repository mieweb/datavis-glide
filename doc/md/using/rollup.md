# Static Rollup Build

This example shows how to pull in DataVis via NPM dependency, then do a static build of your own JavaScript code using Rollup. This makes one giant JS file of your own code + DataVis (and everything else) suitable for deployment on a traditional HTTP server.

## Package File

``` javascript
{
  "name": "datavis-example",
  "version": "1.0.0",
  "description": "Example of how to use DataVis",
  "license": "UNLICENSED",
  "author": "Taylor Venable <tvenable@mieweb.com>",
  "scripts": {
    "rollup": "rollup --bundleConfigAsCjs -c rollup.config.js",
  },
  "dependencies": {
    "wcdatavis": "git+ssh://git@github.mieweb.com:datavis/wcdatavis.git"
  },
  "devDependencies": {
    "@babel/core": "=7.24.9",
    "@babel/preset-env": "=7.24.8",
    "@rollup/plugin-babel": "=6.0.4",
    "@rollup/plugin-commonjs": "=25.0.7",
    "@rollup/plugin-node-resolve": "=15.2.3",
    "rollup": "=4.9.6"
  }
}
```

## Rollup Config

``` javascript
import resolve from '@rollup/plugin-node-resolve';
import commonjs from '@rollup/plugin-commonjs';
import babel from '@rollup/plugin-babel';

export default {
  input: 'index.js',
  output: {
    file: 'dist/index.js',
    format: 'iife',
    globals: { fs: 'undefined', stream: 'undefined' }
  },
  plugins: [resolve(), commonjs(), babel({ babelHelpers: 'bundled' })]
};
```

## JavaScript File

``` javascript
import {
  Source,
  ComputedView,
  Grid,
} from 'wcdatavis';

document.addEventListener('DOMContentLoaded', function () {
  var source = new Source({
    type: 'http',
    url: 'fruit.csv'
  });
  var computedView = new ComputedView(source);
  new Grid({
    id: 'grid',
    computedView: computedView
  }, {title: 'DataVis NPM Example'});
});

```

## HTML File

``` html
<!DOCTYPE html>
<html>
  <head>
    <title>DataVis Example</title>
    <meta charset="utf-8"/>
    <script src="../dist/index.js"></script>
    <link rel="stylesheet" href="../font-awesome.css"/>
    <link rel="stylesheet" href="../node_modules/wcdatavis/dist/wcdatavis.css"/>
  </head>
  <body>
    <div id="grid"></div>
  </body>
</html>
```

