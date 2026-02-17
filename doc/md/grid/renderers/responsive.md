# Responsive Renderers

You can set up a grid to switch renderers on the fly according to how wide the grid is. This is done by setting both a minimum width and the data modes (i.e. plain, group, or pivot) that the renderer supports.

``` javascript
grid.addRenderer(800, ['plain'], {
	name: 'squirrelly',
  opts: {
    whenPlain: {
      item: `<h2>{{it["Last Name"]}}, {{it["First Name"]}}</h2>
<pre>
	{{it["Street Address"]}}\n
	{{it["City"]}}, {{it["State"]}}  {{it["Zip Code"]}}
</pre>`
    }
  }
});
```

This example adds a renderer using Squirrelly that will be used at 800px and wider, when the data is plain (i.e. not grouped or pivotted). The configuration for the renderer follows in the `opts` property.

## Determining Renderer at Runtime

The renderer is typically specified with a string, but if needed you can supply a function instead. The result of that function determines the renderer, and it’s evaluated whenever the grid is resized. In fact, the out of the box group rendering works this way:

``` javascript
grid.addRenderer(1024, ['group'], {
  fn: function () {
		switch (grid.defn.table.groupMode) {
    case 'summary':
      return 'table_group_summary';
    case 'detail':
      return 'table_group_detail';
    }
  }
});
```

## Builtin Renderers

There are builtin renderers for tabular output, with minimum sizes set at 1024px. If you want to clear out the builtin renderers and only use your own, there’s a way to do that.

``` javascript
grid.clearRenderers();
```

## Determining Which Renderer to Use

When the grid is resized, it follows an algorithm to choose a renderer.

1. Determine the renderer with the largest minimum width which is still less than the current width, and which works for the current data mode.
2. If no renderer matches, the one with the smallest minimum width that supports the current data mode will be used.

### Examples

``` javascript
grid.clearRenderers();
grid.addRenderer(400, ['plain'], { name: 'A', ... });
grid.addRenderer(600, ['plain'], { name: 'B', ... });
grid.addRenderer(800, null, { name: 'C', ... });
```

| Current Width | Data Mode | Renderer Chosen |
| ------------- | --------- | --------------- |
| 900           | plain     | C               |
| 750           | plain     | B               |
| 300           | plain     | A               |
| 300           | group     | C               |

## Backwards Compatibility

Responsive renderers are now the default and preferred way to set up grid renderers. If you use the old method like so:

``` javascript
new MIE.WC_DataVis.Grid({
  ...
  renderer: 'squirrelly',
  rendererOpts: {
    whenPlain: {
      before: ... ,
      item: ... ,
      after: ...
    }
  }
  ...
}, { ... });
```

This will still work, but it won’t be responsive; it will always use the renderer specified.
