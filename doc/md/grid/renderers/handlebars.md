# Handlebars Grid Renderer (`handlebars`)

The Handlebars grid renderer gives you almost total freedom to tailor DataVis' output.  The registry name for this renderer is `handlebars`.

``` javascript
new MIE.WC_DataVis.Grid('grid', view, {
  id: 'grid',
  renderer: 'handlebars',
  rendererOpts: {
    whenPlain: {
      template: '<h1>{{FieldName}}</h1><ul><li>Quoted Field Name: {{[Field Name With Spaces]}}</li></ul>'
    },
    whenGroup: {
      template: '<h1>{{rowval 0}}</h1>'
    }
  },
  source: source
}, {
  title: 'Title',
  showControls: true
});
```

## Renderer Options

`whenPlain`
: Sets output configuration for when data hasn't been grouped or pivotted.

`whenGroup`
: Sets output configuration for when data has been grouped but not pivotted.

`whenPivot`
: Sets output configuration for when data has been both grouped and pivotted.

## Output Configuration

`template`
: A Handlebars template for rendering the data.  In plain output, you can refer to each column in the data by name.  For group & pivot output, see below.

## Templates

`{{rowval N}}`
: Outputs the rowval element at the specified index for the current group.
