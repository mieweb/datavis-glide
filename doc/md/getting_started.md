# Getting Started

## Building

This project can be built using Make.

```
$ make setup
$ make datavis
```

Make is also used to generate documentation, build & run tests, and other stuff.

## Installation

Copy the JS and CSS files from the `dist` directory and include them in your page.

## Runtime Dependencies

### Required Dependencies

The following libraries are required to use DataVis:

| Name         | Dependency Type |
| ------------ | --------------- |
| jQuery       | JS              |
| jQuery UI    | JS, CSS         |
| BlockUI      | JS              |
| contextMenu  | JS, CSS         |
| SumoSelect   | JS, CSS         |
| FlatPickr    | JS, CSS         |
| Font Awesome | CSS             |

Here's some HTML you can adapt to get the external dependencies.

``` html
<script src="jquery-latest.js"></script>
<script src="jquery-ui.js"></script>
<script src="blockUI.js"></script>
<script src="contextMenu.js"></script>
<script src="sumoselect.js"></script>
<script src="flatpickr.js"></script>
<script src="wcdatavis.js"></script>

<link rel="stylesheet" href="font-awesome.css"/>
<link rel="stylesheet" href="jquery-ui.css"/>
<link rel="stylesheet" href="contextMenu.css"/>
<link rel="stylesheet" href="sumoselect.css"/>
<link rel="stylesheet" href="flatpickr.css"/>
<link rel="stylesheet" href="base.css"/>
<link rel="stylesheet" href="wcdatavis.css"/>
```

## Basic Usage

At the bare minimum, you need to create two objects: an instance of `MIE.WC_DataVis.Source` and an instance of `MIE.WC_DataVis.Grid` — the source handles data input, the grid handles data output.

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
