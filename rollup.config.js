import typescript from '@rollup/plugin-typescript';
import svelte from 'rollup-plugin-svelte';
import sveltePreprocess from 'svelte-preprocess';
import resolve from '@rollup/plugin-node-resolve';
import commonjs from '@rollup/plugin-commonjs';
import babel from '@rollup/plugin-babel';
import postcss from 'rollup-plugin-postcss';

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
	plugins: [
		svelte({
			preprocess: sveltePreprocess({
				typescript: true
			}),
			compilerOptions: {
				dev: true,
				enableSourcemap: true
			},
			// emitCss: false
		}),
		postcss({
			extract: true
		}),
		resolve({
			browser: true,
			dedupe: ['svelte']
		}),
		commonjs(),
		typescript({
			sourceMap: true
		}),
		babel({
			babelHelpers: 'bundled'
		})
	]
};
