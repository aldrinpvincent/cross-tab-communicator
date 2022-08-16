// // rollup.config.js
// import { terser } from 'rollup-plugin-terser';
// import { nodeResolve } from '@rollup/plugin-node-resolve';
// import commonjs from '@rollup/plugin-commonjs';

// const devMode = (process.env.NODE_ENV === 'development');
// console.log(`${devMode ? 'development' : 'production'} mode bundle`);

// export default [
// 	{
// 		input: './src/main.js',
// 		plugins: [
// 			nodeResolve(),
// 			commonjs()
// 		],
// 		output: {
// 			name: 'AcrossTabs',
// 			file: './build/bundle-iffe.js',
// 			format: 'iife',
// 			sourcemap: devMode ? 'inline' : false,
// 			plugins: [
// 				terser({
// 					ecma: 2020,
// 					mangle: { toplevel: true },
// 					compress: {
// 						module: true,
// 						toplevel: true,
// 						unsafe_arrows: true,
// 						drop_console: !devMode,
// 						drop_debugger: !devMode
// 					},
// 					output: { quote_style: 1 }
// 				})
// 			]
// 		}
// 	}
// ];



import resolve from '@rollup/plugin-node-resolve';
import commonjs from '@rollup/plugin-commonjs';
import pkg from './package.json';

export default [
	// browser-friendly UMD build
	{
		input: 'src/main.js',
		output: {
			name: 'AcrossTabs',
			file: pkg.browser,
			format: 'umd'
		},
		plugins: [
			resolve(), // so Rollup can find `ms`
			commonjs() // so Rollup can convert `ms` to an ES module
		]
	},

	// CommonJS (for Node) and ES module (for bundlers) build.
	// (We could have three entries in the configuration array
	// instead of two, but it's quicker to generate multiple
	// builds from a single configuration where possible, using
	// an array for the `output` option, where we can specify
	// `file` and `format` for each target)
	{
		input: 'src/main.js',
		external: ['ms'],
		output: [
			{ file: pkg.main, format: 'cjs' },
			{ file: pkg.module, format: 'es' }
		]
	}
];
