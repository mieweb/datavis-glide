# Localization

## Generating Translation Strings

Language packs are Javascript files that contain a single exported object. They are located in the `src/lang` directory, and named after the ISO 639-1 language code, e.g. `en.js` for English. They are created automatically from the two following TSV files using the GNU Awk script in `bin/make-lang-packs.awk` — which is run automatically when using `make` to build DataVis.

The file `en.tsv` in the root directory contains all English translations for all labels supported by DataVis. To add more translations to DataVis, add them to this file. The file is a TSV (tab-separated values) file without quoted values. The following columns should exist:

1. The translation label.
2. The text used in English.

The file `trans.tsv` is not committed, but if you want to update translations, it should contain a dump of translations in multiple languages. The following columns should exist:

1. The language code, expressed in ISO 639-1.
2. The translation context, which is ignored for now.
3. The translation label, corresponding to the same in `en.tsv`.
4. The translated text.

## Adding a New Language

After updating `trans.tsv` and re-building the language packs, add the following to `src/trans.js` to enable the language pack. For example, if we were adding Italian:

```javascript
import trans_it from './lang/it.js';

// ... other code ...

TRANSLATION_REGISTRY.set('it', trans_it);
```
