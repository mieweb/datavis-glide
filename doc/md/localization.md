# Localization

## Generating Translation Strings

Like many JS projects, DataVis stores its translations in language pack files, which are exported JS objects that map labels (used in the code, such as `GRID.COLCONFIG_WIN.MOVE_COL_TO_TOP`) to human text. They are located in the `src/lang` directory, and named after the [RFC 5646](https://developer.mozilla.org/en-US/docs/Web/API/Navigator/language) language code, e.g. `en-US.js` for US English. They are created automatically from the two following TSV files using the GNU Awk script in `bin/make-lang-packs.awk` — which is run automatically when using `make` to build DataVis.

The file `en-US.tsv` in the root directory contains all English translations for all labels supported by DataVis. To add more translations to DataVis, add them to this file. The file is a TSV (tab-separated values) file without quoted values. The following columns should exist:

1. The translation label.
2. The text used in English, which will be used to create the `en-US` language pack.
3. Any notes needed by professional translators; this may include context information, disambiguating homographs, etc.

The file `trans.tsv` is not committed, but if you want to update translations, it should contain a dump of translations in multiple languages. The following columns should exist:

1. The language code, expressed in RFC 5646.
2. The translation context, which is ignored for now.
3. The translation label, corresponding to the same in `en-US.tsv`.
4. The translated text.

## Building the Language Packs

The language pack files are built automatically by the Awk script in `bin/make-lang-packs.awk` when running `make datavis`. This will reoccur whenever either of the TSV files above has been modified. As part of building the language packs, information on missing translations is also generated (see below).

## Adding a New Language

1. Update `trans.tsv` with the translations for the new language.

2. Add the language to the `LANG_PACKS` variable in the toplevel `Makefile`.

3. Add the following to `src/trans.js` to enable the language pack. For example, if we were adding German:

   ``` javascript
   import trans_deDE from './lang/de-DE.js';
   
   // ... other code ...
   
   TRANSLATION_REGISTRY.set('DE', trans_it);
   TRANSLATION_REGISTRY.set('DE-DE', trans_it);
   ```

   The use of all upper-case in the registry is to avoid differences between browsers, which may report the string in different cases, by normalizing them to all upper case.

4. Re-build the language packs by running `make datavis`.

## Translation Features

The `%s` placeholder may appear in the translation text; this is often used to insert numbers into the string. For example: “Showing %s of %s records.”

## Missing Translations

After building the language pack files, the Awk script compiles all untranslated labels, together with their English text, into separate files in the `trans-missing` directory. This makes it easy to identify and fix missing translations. For example, translations missing from Brazilian Portugese would be found in the `trans-missing/pt-BR.tsv` file, ready to be sent off to a translation service.
