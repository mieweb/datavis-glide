// I don't know why this is necessary. You should be able to do:
//
//   import 'core-js/es/symbol';
//
// But if you do this, you get an exception in IE mode that says "Incompatible receiver, Symbol
// required" which I can't figure out how to fix. So instead, we'll use a different Symbol polyfill
// and patch it in here.

import Symbol from 'es6-symbol';

if (typeof window.Symbol === 'undefined') {
	window.Symbol = Symbol;
}
