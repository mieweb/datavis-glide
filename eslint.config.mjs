import globals from "globals";
import js from "@eslint/js";
import stylistic from '@stylistic/eslint-plugin';
import importPlugin from 'eslint-plugin-import';
import unusedImports from "eslint-plugin-unused-imports";

export default [
  js.configs.recommended,
  importPlugin.flatConfigs.recommended,
  {
    // "env": {
    //   "browser": true,
    //   // This is only needed for the "import" statements.  Those are eliminated by
    //   // rollup.  The code should only be ES3 to support IE10.
    //   "es6": true
    // },
    plugins: {
      '@stylistic': stylistic,
      'unused-imports': unusedImports
    },
    files: ["src/**/*.js"],
    languageOptions: {
      sourceType: "module",
      globals: {
        ...globals.browser
      }
    },
    rules: {
      'no-unused-vars': 'off',
      'unused-imports/no-unused-imports': 'error',
      '@stylistic/semi': ['error', 'always']
    }
  },
  {
    plugins: {
      '@stylistic': stylistic
    },
    files: ["tests/lib/*.js"],
    languageOptions: {
      sourceType: "commonjs",
      globals: {
        ...globals.browser,
        ...globals.node
      }
    },
    rules: {
      'no-unused-vars': 'off',
      '@stylistic/semi': ['error', 'always']
    }
  },
  {
    plugins: {
      '@stylistic': stylistic
    },
    files: ["tests/selenium/*.js"],
    languageOptions: {
      sourceType: "commonjs",
      globals: {
        ...globals.node,
        ...globals.mocha
      }
    },
    rules: {
      'no-unused-vars': 'off',
      '@stylistic/semi': ['error', 'always']
    }
  }
];
