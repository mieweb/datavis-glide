# NPM Dependency

You can use DataVis as an NPM dependency.

## Package File

```javascript
{
  "name": "datavis-example",
  "version": "1.0.0",
  "description": "Example of how to use DataVis",
  "license": "UNLICENSED",
  "private": true,
  "author": "Taylor Venable <tvenable@mieweb.com>",
  "scripts": {
    "rollup": "rollup --bundleConfigAsCjs -c rollup.config.js",
    "serve": "serve -S"
  },
  "dependencies": {
    "jquery": "=3.7.1",
    "serve": "=14.2.4",
    "wcdatavis": "git+ssh://git@github.mieweb.com:datavis/wcdatavis.git#feature/npm"
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

## Main JS File

```javascript
import {
  Source,
  ComputedView,
  Grid,
} from 'wcdatavis';

jQuery(window.document).ready(function () {
  window.MIE = window.MIE || {};
  window.MIE.DEBUGGING = true;

  var source = new Source({
    type: 'http',
    url: 'fruit.csv'
  });
  var computedView = new ComputedView(source);
  new Grid({
    id: 'grid',
    computedView: computedView,
    table: {
      features: {
        limit: false,
        rowSelect: true,
      }
    }
  }, {
    title: 'DataVis NPM Example',
    showControls: true
  });
});
```

## Main HTML File

```html
<!DOCTYPE html>
<html>
	<head>
		<title>DataVis Example</title>
		<meta charset="utf-8"/>
		<script src="jquery-latest.js"></script>
		<script src="../dist/test.js"></script>
		<link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/4.7.0/css/font-awesome.css" integrity="sha256-NuCn4IvuZXdBaFKJOAcsU2Q3ZpwbdFisd5dux4jkQ5w=" crossorigin="anonymous" />
		<link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/jqueryui/1.12.1/jquery-ui.css" integrity="sha256-p6xU9YulB7E2Ic62/PX+h59ayb3PBJ0WFTEQxq0EjHw=" crossorigin="anonymous" />
		<link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/jquery-contextmenu/2.8.0/jquery.contextMenu.css" integrity="sha256-5jYFrHUEuWbohGWBsZrs+KB0KdlThA22vmG3ublULH8=" crossorigin="anonymous" />
		<link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/jquery.sumoselect/3.0.2/sumoselect.min.css" integrity="sha256-0xvJJaiO/7MuIFIQDyWNKyD347KVWmdyuWWtMdqN8Tk=" crossorigin="anonymous" />
		<link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/flatpickr/4.6.2/flatpickr.css" integrity="sha256-7vIWE+OHz3pLhuONuFqSa/Oh/YUUHFIMooHMwN1Q2bk=" crossorigin="anonymous" />
		<link rel="stylesheet" href="base.css"/>
		<link rel="stylesheet" href="../node_modules/wcdatavis/dist/wcdatavis.css"/>
	</head>
	<body>
		<div id="grid"></div>
	</body>
</html>
```

