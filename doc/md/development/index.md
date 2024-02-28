# Getting Started

## Pre-Requisites

The DataVis support tooling is written in both JavaScript and Python: you will need to have them both installed.  Using `pyenv` is required for managing Python versions, as we will create a virtualenv to install the packages that DataVis needs.

!!! help "Installing Node with `nvm`"

    See instructions [on the NVM GitHub repository](https://github.com/nvm-sh/nvm#installing-and-updating).

!!! help "Installing Python with `pyenv`"

    1. [install pyenv](https://github.com/pyenv/pyenv#installation)
    2. [install the virtualenv plugin](https://github.com/pyenv/pyenv-virtualenv#installation)
    3. Use `pyenv` to install an appropriate version of Python.

    Example on MacOS:

    ```
    $ brew install pyenv pyenv-virtualenv
    $ eval "$(pyenv init -)"
    $ pyenv install 3.12.2
    ```

Then you can run the following to get all the required Node and Python packages.  By default, a virtualenv will be created using the most recent version of Python installed via `pyenv`, but you can override that using the `PYTHON_VER` variable.

```
$ make [PYTHON_VER=...] setup
```

## Compiling

After installing the [Pre-Requisites](#pre-requisites), run `make datavis` to build the JS and CSS files for DataVis.  You can also run `make tests` to (1) build and copy the JS and CSS files to `tests/pages`, and (2) generate the data files needed for testing.

## Running the Local Server

By running the local HTTP server, you can easily get to the documentation and test pages as you work on the code.  It runs on port 5000 and can be started with `make serve`.  Here are some links for useful stuff, once you get it running:

- [DataVis JS API Docs](http://localhost:5000/jsdoc/index.html)
- [DataVis Manual](http://localhost:5000/doc/html/index.html)
- [Testing Library JS API Docs](http://localhost:5000/tests/jsdoc/index.html)
- [Grid Test Pages](http://localhost:5000/tests/pages/grid/)

!!! note
    By default, the local HTTP server uses port 5000 but your computer may already be using that port for something else.  In that case, you'll see an error in the console; you can use a variable for make to change the port, like so: `make PORT=5001 serve`.  If you change the port, adjust those previous URLs appropriately.
