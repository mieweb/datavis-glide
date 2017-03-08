***************
Getting Started
***************

Requirements
============

The following libraries are required to use WC DataVis:

* Underscore
* jQuery
* jQuery UI
* Numeral.js — For parsing number and currency data.
* Moment.js — For parsing date/time data.
* Chosen — For filtering string data.
* FlatPickr — For filtering date/time data.

(The examples pull all of these libraries in from Cloudflare's CDN.)

You also need the following MIE libraries:

* TableTool

Installation
============

Copy the JS and CSS files from the ``dist/`` directory and include them in your page.

Basic Usage
===========

At the bare minimum, you need to create two objects: an instance of ``MIE.DataSource`` and an
instance of ``MIE.Grid`` — the :doc:`data_source` handles data input, the :doc:`grid` handles data
output.

Dependency Rationale
====================

Multi-Select Dropdown
---------------------

Requirements:

* Allow user to see what they've selected.
* Allow user to search for items.

I considered select all / none, but that is easily handled by just removing the filter.

Candidates:

* Chosen

Date / Time Picker
------------------

Requirements:

* Allow user to quickly change month and year.
* Allow user to select date ranges in a single widget.

Candidates:

* Pikaday https://github.com/dbushell/Pikaday

  * Pro: Looks pretty nice.
  * Con: Doesn't handle ranges.

* Flatpickr https://chmln.github.io/flatpickr/examples/

  * Pro: Allows you to input ranges natively.
  * Con: Takes up a lot of space.

* XDSoft DateTimePicker http://xdsoft.net/jqplugins/datetimepicker/

  * Con: Doesn't handle ranges.

* XDSoft PeriodPicker http://xdsoft.net/jqplugins/periodpicker/

  * Pro: Really slick looking.
  * Pro: Allows you to input ranges easily.
  * Con: Costs money!
