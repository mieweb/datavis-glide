# Static JS + HTML

This example shows how to use DataVis as a static library.

1. Download the DataVis source code.
2. Run `make setup` to get dependencies.
3. Run `make datavis` to build the JS file.
4. Copy `dist/wcdatavis.js` and `dist/wcdatavis.css` to your server.
5. Include them like any other JS and CSS files.

You’ll also need FontAwesome v4.7 for DataVis to display icons; the FontAwesome webfonts are not distributed with DataVis.

## HTML File

``` html
<!DOCTYPE html>
<html>
  <head>
    <meta charset="utf-8"/>
    <script src="../wcdatavis.js"></script>
    <link rel="stylesheet" href="../font-awesome.css"/>
    <link rel="stylesheet" href="../wcdatavis.css"/>
    <script>
document.addEventListener('DOMContentLoaded', function () {
  var source = new MIE.WC_DataVis.Source({
    type: 'http',
    url: 'fruit.csv'
  });
  var computedView = new MIE.WC_DataVis.ComputedView(source);
  new MIE.WC_DataVis.Grid({
    id: 'grid',
    computedView: computedView
  }, {title: 'DataVis NPM Example'});
});
    </script>
  </head>
  <body>
    <div id="grid"></div>
  </body>
</html>
```

