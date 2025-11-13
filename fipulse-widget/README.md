# Fipulse Crypto Chart Widget

A standalone widget that combines lightweight-charts (from parent directory) and crypto-chart-sdk for easy integration into any website.

## Features

- 📊 **Real-time price updates** via WebSocket
- 🎨 **Multiple chart types**: Candlestick and Area charts
- 📈 **Volume indicators** with toggle support
- 🌓 **Theme support**: Light and Dark modes
- 🎛️ **Built-in controls** for chart customization
- 📦 **Single script**: lightweight-charts is bundled, so only one script tag needed!

## Installation

### Build the Widget

First, build the widget from the `charts/fipulse-widget` directory:

```bash
cd charts/fipulse-widget
npm install
npm run build
```

This will create `dist/widget.iife.js` which contains everything you need.

## Usage

### Basic Integration

```html
<!DOCTYPE html>
<html>
<head>
  <title>Crypto Chart</title>
</head>
<body>
  <div id="crypto-chart" style="width: 100%; height: 500px;"></div>

  <!-- Load widget - lightweight-charts is bundled! -->
  <script src="./dist/widget.iife.js"></script>

  <script>
    const chart = window.FiPulseWidget.create({
      container: '#crypto-chart',
      tokenId: '1-2260fac5e5542a773aa44fbcfedf7c193bc2c599', // BTC
      symbol: 'BTC/USDT',
      showControls: true,
      showVolume: true,
      theme: 'light'
    });
  </script>
</body>
</html>
```

### Configuration Options

```typescript
interface WidgetOptions {
  // Required
  container: string | HTMLElement;  // CSS selector or DOM element
  tokenId: string;                  // Format: chain_id-token_address

  // Optional display
  symbol?: string;                  // Trading pair symbol (e.g., 'BTC/USDT')
  title?: string;                   // Chart title
  height?: number;                  // Chart height in pixels
  width?: number;                   // Chart width in pixels

  // Configuration
  showControls?: boolean;           // Show UI controls (default: true)
  showVolume?: boolean;             // Show volume by default (default: false)
  priceSeriesType?: 'candle' | 'area'; // Default price series (default: 'candle')
  theme?: 'light' | 'dark';        // Chart theme (default: 'light')
  autoConnect?: boolean;            // Auto-connect WebSocket (default: true)

  // API Configuration
  baseUrl?: string;                 // API base URL (default: 'https://api.fipulse.xyz')
  websocketUrl?: string;            // WebSocket URL (default: 'wss://api.fipulse.xyz/ws')

  // Callbacks
  onError?: (error: string) => void;
  onDataUpdate?: (data: ChartData) => void;
  onTrade?: (trade: RealTimeTrade) => void;
  onConnectionChange?: (status: 'connecting' | 'connected' | 'disconnected') => void;
}
```

### Programmatic Control

```javascript
const chart = window.FiPulseWidget.create({ /* options */ });

// Toggle volume display
chart.toggleVolume();

// Switch chart type
chart.setPriceSeriesType('candle'); // or 'area'

// Toggle theme
chart.toggleTheme();

// Update token
chart.updateToken('1-0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2'); // ETH

// Resize chart
chart.resize(800, 600);

// Destroy chart
chart.destroy();
```

## Example

See `example.html` for a complete working example with interactive controls.

## Development

```bash
# Install dependencies
npm install

# Build widget
npm run build

# Watch mode (for development)
npm run dev
```

## Notes

- The widget bundles lightweight-charts from the parent `charts` directory, so you don't need to load it separately
- The widget uses `@fipulse/crypto-chart-sdk` for data fetching and WebSocket connections
- Make sure to build the parent `charts` project first if you're developing locally

