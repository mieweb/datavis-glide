import resolve from 'rollup-plugin-node-resolve';
import commonjs from 'rollup-plugin-commonjs';
import builtins from 'rollup-plugin-node-builtins';
import globals from 'rollup-plugin-node-globals';

export default {
	input: 'datavis.js',
	external: [
		'jquery',
		'jquery-ui',
		'jquery-contextmenu',
		'sumoselect',
		'flatpickr',
		'papaparse',
		'handlebars',
	],
	output: {
		file: 'dist/wcdatavis.js',
		format: 'iife',
		globals: {
			jquery: 'jQuery',
			papaparse: 'Papa',
			handlebars: 'Handlebars',
		}
	},
	plugins: [resolve(), commonjs()/*, builtins(), globals()*/]
};
