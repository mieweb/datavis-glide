***************
Getting Started
***************

Requirements
============

The following libraries are required to use WC DataVis:

* Underscore
* jQuery
* jQuery UI
* Numeral.js
* Moment.js

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
