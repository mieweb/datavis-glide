# Writing Your Own Source

Writing support for your own data source backends is easy, you just need to make a class with a few methods and register it for a type.

## Constructor

``` javascript
var MySource = makeSubclass('MySource', Object, function (spec) {
  // ... store spec fields ...
});
```

## Getting Data & TypeInfo

Data and type info might come together (e.g. as part of a JSON payload with separate properties for each) or the type info might be derived from the data (e.g. CSV contains no metadata itself, but we can build some based on the columns). The methods to get each are separated, and must be callable independently — you can’t rely on one being called before the other.

``` javascript
MySource.prototype.getData = function (params, cont) {
  // ... try to get data ...
  return gotData ? cont(true, data) : cont(false);
};

MySource.prototype.getTypeInfo = function (cont) {
  // ... try to get typeInfo ...
	return gotTypeInfo ? cont(true, typeInfo) : cont(false);
};
```

## Cancelling Request

If there is a way to cancel the data request, you can define the `cancel()` method. If this method exists, it puts a button in the titlebar that lets users abort the process. Here’s an example:

``` javascript
HttpSource.prototype.cancel = function () {
	this.xhr.abort();
};
```

## Adding to the Registry

After defining the class and its methods, you need to add it to the Source registry.

``` javascript
MIE.WC_DataVis.Source.sources.mySource = MySource;
```

## Using the Source

``` javascript
var source = new MIE.WC_DataVis.Source({
  type: 'mySource'
});
var view = new MIE.WC_DataVis.ComputedView(source);
new MIE.WC_DataVis.Grid({
  id: 'grid',
  computedView: view,
  source: source,
}, {
  title: 'Test - My Source'
});
```

