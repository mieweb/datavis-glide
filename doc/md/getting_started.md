# Getting Started

## Building

To make it easier to keep track of all the code in this very large
project, different classes are kept in different files within the `src/`
directory. These are compiled together according to the `wcdatavis.src`
file, using a tool called `jspp` (which is a Bash shell script found in
the `bin/` directory). Basically, `wcdatavis.src` is a JavaScript file
with a special "function" that includes a file in that place when
processed by `jspp`, just like the C preprocessor does. This is all just
for developer convenience.

Simply running `make` in the toplevel directory will cause all the files
you need to be built and copied to the `dist/` directory.

## Installation

Copy the JS and CSS files from the `dist/` directory and include them in
your page.

## Runtime Dependencies

### Required Dependencies

The following libraries are required to use WC DataVis:

  - Underscore
  - jQuery (version 1.12 if using TableTool)
  - jQuery UI
  - Numeral.js — For parsing number and currency data.
  - Moment.js — For parsing date/time data.
  - Chosen — For filtering string data.
  - FlatPickr — For filtering date/time data.

(The examples pull all of these libraries in from Cloudflare's CDN.)

You also need the following MIE libraries:

  - TableTool

### Optional Dependencies

  - NProgress

## Basic Usage

At the bare minimum, you need to create two objects: an instance of
`MIE.DataSource` and an instance of `MIE.Grid` — the
<span role="doc">data\_source</span> handles data input, the
<span role="doc">grid</span> handles data output.

## Dependency Rationale

### Multi-Select Dropdown

Requirements:

  - Allow user to see what they've selected.
  - Allow user to search for items.

I considered select all / none, but that is easily handled by just
removing the filter.

Candidates:

  - Chosen

### Date / Time Picker

Requirements:

  - Allow user to quickly change month and year.
  - Allow user to select date ranges in a single widget.

Candidates:

  - Pikaday <https://github.com/dbushell/Pikaday>
      - Pro: Looks pretty nice.
      - Con: Doesn't handle ranges.
  - Flatpickr <https://chmln.github.io/flatpickr/examples/>
      - Pro: Allows you to input ranges natively.
      - Con: Takes up a lot of space.
  - XDSoft DateTimePicker <http://xdsoft.net/jqplugins/datetimepicker/>
      - Con: Doesn't handle ranges.
  - XDSoft PeriodPicker <http://xdsoft.net/jqplugins/periodpicker/>
      - Pro: Really slick looking.
      - Pro: Allows you to input ranges easily.
      - Con: Costs money\!
