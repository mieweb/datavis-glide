import resolve from '@rollup/plugin-node-resolve';
import commonjs from '@rollup/plugin-commonjs';
//import builtins from 'rollup-plugin-node-builtins';
//import globals from 'rollup-plugin-node-globals';

export default {
	input: 'datavis.js',
	external: [
		'jquery'
	],
	output: {
		file: 'dist/wcdatavis.js',
		format: 'iife',
		globals: {
			jquery: 'jQuery',
			fs: 'undefined',
			stream: 'undefined',
		}
	},
	plugins: [resolve(), commonjs()/*, builtins(), globals()*/]
};
