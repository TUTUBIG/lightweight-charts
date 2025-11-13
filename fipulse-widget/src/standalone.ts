/**
 * Standalone entry point for IIFE builds
 * 
 * This mimics TradingView's approach exactly:
 * - Import everything as a namespace (import * as)
 * - Assign directly to window.FiPulseWidget
 * 
 * When Rollup builds this as IIFE, it creates:
 * var FiPulseWidget = (function() { ... return FiPulseWidgetModule })();
 * 
 * So window.FiPulseWidget is directly the object with all exports as properties.
 * No module wrapper needed!
 */

// Polyfill process for browser compatibility (needed for lightweight-charts)
if (typeof process === 'undefined') {
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	(window as any).process = {
		env: {
			NODE_ENV: 'production',
			BUILD_VERSION: '1.0.0',
		},
	};
}

// Import everything from the widget module as a namespace
// eslint-disable-next-line @typescript-eslint/naming-convention
import * as FiPulseWidgetModule from './widget';

// Put all exports from package to window.FiPulseWidget object
// eslint-disable-next-line @typescript-eslint/no-explicit-any,@typescript-eslint/no-unsafe-member-access
(window as any).FiPulseWidget = FiPulseWidgetModule;

