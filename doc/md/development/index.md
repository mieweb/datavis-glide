# Getting Started

## Pre-Requisites

The DataVis support tooling is written in both JavaScript and Python: you will need to have them both installed.  Using `pyenv` is required for managing Python versions, as we will create a virtualenv to install the packages that DataVis needs.  You'll also need some other command line tools: GNU Make, and GNU Awk.

??? help "Installing Node with `nvm`"

    See instructions [on the NVM GitHub repository](https://github.com/nvm-sh/nvm#installing-and-updating).

??? help "Installing Python with `pyenv`"

    1. [install pyenv](https://github.com/pyenv/pyenv#installation)
    2. [install the virtualenv plugin](https://github.com/pyenv/pyenv-virtualenv#installation)
    3. Use `pyenv` to install an appropriate version of Python.

!!! example "Full example on MacOS"

    The following should get you everything you need on MacOS, ready for the "setup" step below.
    
    ```
    $ brew install make gawk node pyenv pyenv-virtualenv
    $ eval "$(pyenv init -)"
    $ pyenv install 3.12.2
    ```

After getting all that installed, you can run the following to get all the required Node and Python packages.  By default, a virtualenv will be created using the most recent version of Python installed via `pyenv`, but you can override that using the `PYTHON_VER` variable.

```
$ make [PYTHON_VER=...] setup
```

## Compiling

After installing the [Pre-Requisites](#pre-requisites), run `make datavis` to build the JS and CSS files for DataVis.  You can also run `make tests` to (1) build and copy the JS and CSS files to `tests/pages`, and (2) generate the data files needed for testing.  See [Generating Data](json_gen.md) for more information about how test data is created.

### Rapid Development

As of DataVis v3.3 you no longer need to compile every time you want to test changes. `make serve` now runs Vite, so as long as you’re using a test page written to take advantage of hot module reloading, the page will refresh automatically as soon as you edit a source file.

??? example "An example page using Vite"

	```html
	<!DOCTYPE html>
	<html>
	  <head>
	    <meta charset="utf-8"/>
	    <script type="module" src="/index.js"></script>
	    <link rel="stylesheet" href="../font-awesome.css"/>
	    <link rel="stylesheet" href="../base.css"/>
	    <link rel="stylesheet" href="../wcdatavis.css"/>
	    <script type="module">
	import { Source, ComputedView, Grid } from '/index.js';
	document.addEventListener('DOMContentLoaded', function () {
	  window.MIE = window.MIE || {};
	  window.MIE.DEBUGGING = true;
	
	  // build the grid using the imported classes
	});
	    </script>
	  </head>
	  <body>
	    <div id="grid"></div>
	  </body>
	</html>
	```
NB № 1: Using Vite disables any Svelte components. Our Svelte gantt chart component requires an old version of Svelte, which is incompatible with the Svelte plugin for Vite.

NB № 2: Pages used for automated testing should still use the statically compiled DataVis JS and CSS files, as this is how DataVis is most often deployed.

## Running the Local Server

By running the local HTTP server, you can easily get to the documentation and test pages as you work on the code.  It can be started with `make PORT=3000 serve`.  Here are some links for useful stuff, once you get it running:

- [DataVis JS API Docs](http://localhost:3000/jsdoc/index.html)
- [DataVis Manual](http://localhost:3000/doc/html/index.html)
- [Testing Library JS API Docs](http://localhost:3000/tests/jsdoc/index.html)
- [Grid Test Pages](http://localhost:3000/tests/pages/grid/)

!!! note "Specifying the Server’s Port"
    By default, the local HTTP server uses whatever port is available, and prints the address when it starts.  For most use cases, this is enough; but if necessary, you can force the server to bind to a specific port using the `PORT` environment variable. Port 3000 is what’s used by the automated tests, so that’s what we use in this manual.
