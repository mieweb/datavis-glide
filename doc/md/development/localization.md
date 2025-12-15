# Supporting Localization

Classes that need to support localization should follow this pattern:

1. Use a property called `transLabel` to specify the translation label.
2. Implement a method called `getTransName()` that calls `trans(self.transLabel)` to produce a translated version of the component’s name.

Don’t call `trans()` at code loading time! Sometimes the language is set dynamically, so text should always be translated at display time.