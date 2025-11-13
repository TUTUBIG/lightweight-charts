/**
 * Vite config for building standalone IIFE
 * This bundles lightweight-charts from the parent charts directory
 */
import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
	define: {
		// Replace process.env references (same as lightweight-charts rollup config)
		'process.env.NODE_ENV': JSON.stringify('production'),
		'process.env.BUILD_VERSION': JSON.stringify('1.0.0'),
	},
	build: {
		outDir: 'dist',
		target: 'es2020',
		commonjsOptions: {
			include: [/node_modules/],
			transformMixedEsModules: true,
		},
		lib: {
			entry: resolve(__dirname, 'src/standalone.ts'),
			name: 'FiPulseWidget',
			formats: ['iife'],
			fileName: () => 'widget.iife.js',
		},
		rollupOptions: {
			// Bundle lightweight-charts from parent directory
			external: [],
			output: {
				// No globals needed since lightweight-charts is bundled
			},
		},
	},
	resolve: {
		alias: {
			'lightweight-charts': resolve(__dirname, '../src/index.ts'),
		},
		dedupe: ['@fipulse/crypto-chart-sdk'],
	},
});

