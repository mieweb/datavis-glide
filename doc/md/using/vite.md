# Vite

This example shows how to pull in DataVis via NPM dependency, using it from your own JavaScript code with Vite for a development environment or production build.

!!! warning

    Using Vite disables any Svelte components. Our Svelte gantt chart component requires an old version of Svelte, which is incompatible with the Svelte plugin for Vite.

An official DataVis NPM package is now published in GitHub. See [the NPM page](./npm.md) to get setup; here is what you’ll need in your `package.json` file.

```javascript
"dependencies": {
  "@mieweb/wcdatavis": "=3.2.3",
  "vite": "=7.3.1"
}
```

## Building a Page

Import FontAwesome 4.7 CSS somehow (this example uses a CDN).

Inside a module script tag, import the CSS for DataVis and its dependents. This is necessary when using Vite in this configuration, but not if using a version of DataVis built via Rollup (which uses the PostCSS plugin to automatically extract and bundle all CSS files imported from JS).

```javascript
import 'jquery-ui/dist/themes/base/jquery-ui.min.css';
import 'jquery-contextmenu/dist/jquery.contextMenu.min.css';
import 'sumoselect/sumoselect.min.css';
import '@mieweb/wcdatavis/wcdatavis.css';
```

Then just use DataVis like normal:

```javascript
import { Source, ComputedView, Grid } from '@mieweb/wcdatavis/index.js';

document.addEventListener('DOMContentLoaded', () => {
  const source = new Source({
    type: 'http',
    url: 'fruit.csv'
  });
  const computedView = new ComputedView(source);
  new Grid({
    id: 'grid',
    computedView: computedView
  }, {
    title: 'DataVis NPM Example (Using Vite)'
  });
});
```

Make sure you also have a div to contain the grid on the page.

```html
<div id="grid"></div>
```
