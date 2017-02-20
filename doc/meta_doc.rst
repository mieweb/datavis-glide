***************************************
Meta Documentation: Docs About the Docs
***************************************

There are two kinds of documentation about wcgrid.  High level technical and user documentation is
written in reStructuredText and compiled using Sphinx.  Low level technical documentation is written
in comments in the source code and compiled using jsdoc.  This page tells how to build both kinds of
documentation.

Using Sphinx
============

Find the directory containing the reStructuredText documentation and run ``make html``.  That's all
you need to do.

Using jsdoc
===========

Prerequisites
-------------

::

  $ npm install jsdoc
  $ npm install ink-docstrap

Building the Docs
-----------------

Run this:

::

  $ jsdoc -c doc/jsdoc/conf.json jsbin/wcgraph.js
