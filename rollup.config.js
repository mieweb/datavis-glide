import typescript from '@rollup/plugin-typescript';
import svelte from 'rollup-plugin-svelte';
import sveltePreprocess from 'svelte-preprocess';
import resolve from '@rollup/plugin-node-resolve';
import commonjs from '@rollup/plugin-commonjs';
import babel from '@rollup/plugin-babel';
import postcss from 'rollup-plugin-postcss';
import replace from '@rollup/plugin-replace';

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
	onwarn: (warning, warn) => {
    if (warning.code === 'CIRCULAR_DEPENDENCY') {
      console.log(warning.message);
    }
    warn(warning);
  },
	plugins: [
		// This global CSS rule from Svelte-Gantt messes up other styles, so confine it to graphs.
		replace({
			include: ['**/Gantt.svelte'],
			delimiters: ['', ''],
			values: {
				':global(*) {': ':global(.wcdv_graph *) {',
			}
		}),
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
      extensions: ['.js', '.mjs', '.svelte', '.ts', '.tsx'],
      babelHelpers: 'bundled',
      presets: [
        [ "@babel/preset-env", {"targets": {"ie": "11"}} ],
        "@babel/preset-typescript"
      ]
    })
	]
};
