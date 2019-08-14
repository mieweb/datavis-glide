module.exports = {
  "env": {
    "browser": true,
    // This is only needed for the "import" statements.  Those are eliminated by
    // rollup.  The code should only be ES3 to support IE10.
    "es6": true
  },
  "parserOptions": {
    "sourceType": "module"
  },
  "extends": "eslint:recommended"
};
