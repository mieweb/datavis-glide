import resolve from '@rollup/plugin-node-resolve';
import commonjs from '@rollup/plugin-commonjs';
import babel from '@rollup/plugin-babel';

export default {
	input: 'datavis.js',
	output: {
		file: 'dist/wcdatavis.js',
		format: 'iife',
		globals: {
			fs: 'undefined',
			stream: 'undefined',
		}
	},
	plugins: [resolve(), commonjs(), babel({ babelHelpers: 'bundled' })]
};
