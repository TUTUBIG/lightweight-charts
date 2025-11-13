/**
 * Fipulse Crypto Chart Widget
 *
 * A standalone widget that combines lightweight-charts and crypto-chart-sdk
 * for easy integration into any website.
 *
 * Usage:
 * ```html
 * <div id="crypto-chart"></div>
 * <script src="fipulse-widget.js"></script>
 * <script>
 *   FiPulseWidget.create({
 *     container: '#crypto-chart',
 *     tokenId: '1-0x2260fac5e5542a773aa44fbcfedf7c193bc2c599',
 *     symbol: 'BTC/USDT'
 *   });
 * </script>
 * ```
 */

import {
	AreaSeries,
	CandlestickSeries,
	createChart,
	HistogramSeries,
} from '../../src/index';
import type { IChartApi } from '../../src/api/create-chart';
import type { ISeriesApi } from '../../src/api/iseries-api';
import type { UTCTimestamp } from '../../src/model/horz-scale-behavior-time/types';
import type { ChartOptions } from '../../src/api/create-chart';
import type { DeepPartial } from '../../src/helpers/strict-type-checks';
import {
	CryptoChartSDK,
	type ChartData,
	type Candle,
	type RealTimeTrade, formatVolume,
} from '@fipulse/crypto-chart-sdk';
import {areaSeries} from "../../src/model/series/area-series";
import {lineSeries} from "../../src/model/series/line-series";
import {CandlestickData} from "../../src/model/data-consumer";

// ============================================================================
// Type Definitions
// ============================================================================

export interface WidgetOptions {
	// Required
	container: string | HTMLElement;
	tokenId: string; // Format: chain_id-token_address (e.g., "1-0x2260fac5e5542a773aa44fbcfedf7c193bc2c599")

	// Optional display
	symbol?: string;
	height?: number;
	width?: number;

	// Configuration
	showVolume?: boolean; // Show volume by default (default: false)
	priceSeriesType?: 'candle' | 'line'; // Default price series type (default: 'candle')
	theme?: 'light' | 'dark'; // Chart theme (default: 'light')
	legendStyle?: 'none' | 'simple' | 'complex';

	// Callbacks
	onError?: (error: string) => void;
	onDataUpdate?: (data: ChartData) => void;
	onTrade?: (trade: RealTimeTrade) => void;
	onConnectionChange?: (status: 'connecting' | 'connected' | 'disconnected') => void;
}

// ============================================================================
// Widget Class
// ============================================================================

class FiPulseChartWidget {
	private chart: IChartApi | null = null;
	private legendElement: HTMLElement | null = null;
	private candlestickSeries: ISeriesApi<'Candlestick'> | null = null;
	private lineSeries: ISeriesApi<'Line'> | null = null;
	private volumeSeries: ISeriesApi<'Histogram'> | null = null;
	private sdk: CryptoChartSDK | null = null;

	private chartData: ChartData = {
		candles: [],
		lastUpdate: null,
		isLoading: true,
		error: null,
	};
	private currentPrice: number | null = null;
	private priceChange: number | 0 = 0;
	private previousCandleCount: number = 0;
	private isInitialLoad: boolean = true;

	private options: Required<Pick<WidgetOptions,  'showVolume' | 'priceSeriesType' | 'theme' | 'legendStyle' >> & WidgetOptions;
	private previousPrice: number = 0;

	constructor(options: WidgetOptions) {
		this.options = {
			showVolume: false,
			priceSeriesType: 'candle',
			theme: 'light',
			legendStyle: 'complex',
			...options,
		};


		this.initialize().then(r => {console.log("create chart successfully")});
	}

	private async initialize(): Promise<void> {
		await this.initializeSDK();
		this.initializeChart();
		if (this.sdk && this.options.tokenId) {
			await this.loadTokenData(this.options.tokenId);
		}
	}

	private async initializeSDK(): Promise<void> {
		const baseUrl = 'https://api.fipulse.xyz';
		const wsUrl =  'wss://api.fipulse.xyz/ws';

		// Create fetch-based HTTP client
		const httpClient = {
			async get(url: string, options?: { params?: Record<string, string>; headers?: Record<string, string> }): Promise<string> {
				const queryString = options?.params ? '?' + new URLSearchParams(options.params).toString() : '';
				const response = await fetch(url + queryString, {
					headers: options?.headers,
				});
				if (!response.ok) {
					throw new Error(`HTTP error! status: ${response.status}`);
				}
				return await response.text();
			},
		};

		this.sdk = new CryptoChartSDK(
			{
				baseUrl,
				timeouts: {
					httpRequest: 10000,
					websocketConnect: 5000,
				},
				endpoints: {
					historyCandles: '/candle-chart',
					singleCandle: '/single-candle',
					websocket: wsUrl,
				},
			},
			{
				url: wsUrl,
				reconnectDelay: 1000,
				maxReconnectAttempts: 5,
				heartbeatInterval: 30000,
			},
			{
				maxCandles: 1440,
				autoScroll: true,
			},
			httpClient
		);

		// Set up SDK callbacks
		this.sdk.onChartUpdate((data: ChartData) => {
			this.handleChartUpdate(data);
		});

		this.sdk.onTrade((trade: RealTimeTrade) => {
			this.handleTrade(trade);
		});

		this.sdk.onError((error: string) => {
			this.chartData.error = error;
			if (this.options.onError) {
				this.options.onError(error);
			}
		});

		this.sdk.onConnectionChange((status) => {
			if (this.options.onConnectionChange) {
				this.options.onConnectionChange(status);
			}
		});

		this.sdk.connectWebSocket();
	}

	private initializeChart(): void {
		const container = typeof this.options.container === 'string'
			? document.getElementById(this.options.container.replace('#', '')) || document.querySelector(this.options.container)
			: this.options.container;

		if (!container) {
			throw new Error(`Chart container not found: ${this.options.container}`);
		}

		// Ensure container has position relative for absolute positioned legend
		const containerElement = container as HTMLElement;
		if (getComputedStyle(containerElement).position === 'static') {
			containerElement.style.position = 'relative';
		}

		const isDark = this.options.theme === 'dark';
		const chartOptions: DeepPartial<ChartOptions> = {
			layout: {
				background: { color: isDark ? '#1a1a1a' : '#ffffff' },
				textColor: isDark ? '#ffffff' : '#333333',
				attributionLogo: true,
			},
			grid: {
				vertLines: { color: isDark ? '#2a2a2a' : '#f0f0f0' },
				horzLines: { color: isDark ? '#2a2a2a' : '#f0f0f0' },
			},
			crosshair: {
				mode: 1,
				vertLine: { color: isDark ? '#666666' : '#cccccc', width: 1 },
				horzLine: { color: isDark ? '#666666' : '#cccccc', width: 1 },
			},
			rightPriceScale: {
				borderColor: isDark ? '#444444' : '#cccccc',
				scaleMargins: {
					top: 0.3,
					bottom: 0.1,
				},
			},
			timeScale: {
				borderColor: isDark ? '#444444' : '#cccccc',
				timeVisible: true,
				secondsVisible: false,
			},
		};

		if (this.options.width) chartOptions.width = this.options.width;
		if (this.options.height) chartOptions.height = this.options.height;

		this.chart = createChart(container as HTMLElement, chartOptions);
		if (this.options.priceSeriesType == 'candle') {
			// Create candlestick series
			this.candlestickSeries = this.chart.addSeries(CandlestickSeries, {
				upColor: isDark ? '#00d4aa' : '#26a69a',
				downColor: isDark ? '#ff6b6b' : '#ef5350',
				borderVisible: false,
				wickUpColor: isDark ? '#00d4aa' : '#26a69a',
				wickDownColor: isDark ? '#ff6b6b' : '#ef5350',
			},0);
		} else if (this.options.priceSeriesType == 'line') {
			this.lineSeries = this.chart.addSeries(lineSeries, {
				color: isDark ? '#cbdf97' : '#c56e6e',
			})
		}

		if (this.options.showVolume) {
			// Create volume series with its own price scale (creates separate pane)
			this.volumeSeries = this.chart.addSeries(HistogramSeries, {
				color: isDark ? '#26a69a80' : '#26a69a40', // Default color (will be overridden per data point)
				priceFormat: {
					type: 'volume',
				},
			},1);
			this.chart.panes()[0].setStretchFactor(0.9)
			this.chart.panes()[1].setStretchFactor(0.1)
		}

		if (this.options.legendStyle === 'simple' || this.options.legendStyle === 'complex') {
			this.legendElement = document.createElement('div');
			this.legendElement.className = 'chart-legend';
			this.legendElement.style.cssText = `
			position: absolute;
			left: 12px;
			top: 12px;
			z-index: 1000;
			font-size: 13px;
			font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
			line-height: 1.5;
			pointer-events: none;
			user-select: none;
			padding: 10px 14px;
			background: ${isDark ? 'rgba(26, 26, 26, 0.95)' : 'rgba(255, 255, 255, 0.95)'};
			border-radius: 8px;
			box-shadow: 0 2px 12px ${isDark ? 'rgba(0, 0, 0, 0.4)' : 'rgba(0, 0, 0, 0.15)'};
			min-width: 180px;
		`;
			containerElement.appendChild(this.legendElement);

			// Subscribe to crosshair moves to update legend
			this.chart.subscribeCrosshairMove((param) => {
				if (this.options.legendStyle === 'complex') {
					this.updateLegend(param);
				}
			});
		}

		// Initial legend update
		this.updateLegend(null);
	}


	formatPrice(price: number | null): string {
		if (price === null) return '--';
		return price.toFixed(2);
	}

	formatPercentage(percentage: number | null): string {
		if (percentage === null) return '--';
		return `${percentage.toFixed(2)}%`;
	}

	private updateLegend(crosshairParam: any): void {
		if (!this.legendElement || !this.chart) return;

		const isDark = this.options.theme === 'dark';

		// Get token name
		const tokenName = this.options.symbol || 'Token';

		// Get real-time price
		const price = this.currentPrice !== null ? this.formatPrice(this.currentPrice) : '--';

		// Get 24h rate
		const rate24h = this.priceChange !== null ? this.formatPercentage(this.priceChange) : '--';
		const rateColor = this.priceChange !== null
			? (this.priceChange >= 0
				? (isDark ? '#00d4aa' : '#26a69a')
				: (isDark ? '#ff6b6b' : '#ef5350'))
			: (isDark ? '#999' : '#666');

		// Get OHLC and Volume from crosshair if available
		let ohlcHtml = '';
		let candleChangeHtml = '';
		let candleFluctuationHtml = '';

		if (crosshairParam && crosshairParam.time && crosshairParam.seriesData && this.candlestickSeries) {
			const data = crosshairParam.seriesData.get(this.candlestickSeries) as CandlestickData | undefined;
			if (data) {
				// Find the corresponding candle to get volume and calculate metrics
				let volume = null;
				let matchingCandle: Candle | undefined;
				const crosshairTime = crosshairParam.time as number;

				// Match crosshair time with candle timestamp (accounting for timezone conversion)
				matchingCandle = this.chartData.candles.find((candle: Candle) => {
					const utcTimestamp = candle.Timestamp;
					const utcDate = new Date(utcTimestamp * 1000);
					const timezoneOffsetSeconds = utcDate.getTimezoneOffset() * 60;
					const localTimestamp = utcTimestamp - timezoneOffsetSeconds;
					// Match within 60 seconds tolerance (for minute candles)
					return Math.abs(localTimestamp - crosshairTime) < 60;
				});

				if (matchingCandle) {
					volume = matchingCandle.VolumeIn; // Use VolumeIn (USD volume)

					// Calculate price change rate for this candle (open to close)
					const candleChange = matchingCandle.OpenPrice > 0
						? ((matchingCandle.ClosePrice - matchingCandle.OpenPrice) / matchingCandle.OpenPrice) * 100
						: 0;
					const candleChangeFormatted = this.formatPercentage(candleChange);
					const candleChangeColor = candleChange >= 0
						? (isDark ? '#00d4aa' : '#26a69a')
						: (isDark ? '#ff6b6b' : '#ef5350');

					candleChangeHtml = `
            <div style="display: flex; align-items: center; gap: 4px;">
              <span style="color: ${isDark ? '#999' : '#666'}; font-size: 11px;">Change:</span>
              <span style="font-weight: 500; font-size: 11px; color: ${candleChangeColor};">${candleChangeFormatted}</span>
            </div>
          `;

					// Calculate price fluctuation (violation rate) for this candle
					// Fluctuation = (high - low) / open * 100
					const candleFluctuation = matchingCandle.OpenPrice > 0
						? ((matchingCandle.HighPrice - matchingCandle.LowPrice) / matchingCandle.OpenPrice) * 100
						: 0;
					const candleFluctuationFormatted = this.formatPercentage(candleFluctuation);
					const fluctuationColor = isDark ? '#ffa726' : '#ff9800'; // Orange color

					candleFluctuationHtml = `
            <div style="display: flex; align-items: center; gap: 4px;">
              <span style="color: ${isDark ? '#999' : '#666'}; font-size: 11px;">Fluctuation:</span>
              <span style="font-weight: 500; font-size: 11px; color: ${fluctuationColor};">${candleFluctuationFormatted}</span>
            </div>
          `;
				}

				const openColor = isDark ? '#999' : '#666';
				const highColor = isDark ? '#00d4aa' : '#26a69a';
				const lowColor = isDark ? '#ff6b6b' : '#ef5350';
				const closeColor = isDark ? '#64b5f6' : '#2196f3';
				const volumeColor = isDark ? '#999' : '#666';

				const volumeHtml = volume !== null
					? `<div><span style="color: ${volumeColor};">V</span> <span style="color: ${isDark ? '#fff' : '#333'};">$${formatVolume(volume)}</span></div>`
					: '';

				ohlcHtml = `
          <div style="margin-top: 8px; padding-top: 8px; border-top: 1px solid ${isDark ? '#333' : '#e0e0e0'};">
            <div style="display: flex; gap: 12px; font-size: 11px; flex-wrap: wrap; margin-bottom: 6px;">
              <div><span style="color: ${openColor};">O</span> <span style="color: ${isDark ? '#fff' : '#333'};">${this.formatPrice(data.open)}</span></div>
              <div><span style="color: ${highColor};">H</span> <span style="color: ${highColor};">${this.formatPrice(data.high)}</span></div>
              <div><span style="color: ${lowColor};">L</span> <span style="color: ${lowColor};">${this.formatPrice(data.low)}</span></div>
              <div><span style="color: ${closeColor};">C</span> <span style="color: ${closeColor};">${this.formatPrice(data.close)}</span></div>
              ${volumeHtml}
            </div>
            ${candleChangeHtml}
            ${candleFluctuationHtml}
          </div>
        `;
			}
		}

		// Update legend HTML
		const textColor = isDark ? '#fff' : '#333';
		const labelColor = isDark ? '#999' : '#666';
		const priceChangeValue = this.priceChange ?? 0;
		const priceColor = priceChangeValue > 0
			? (isDark ? '#00d4aa' : '#26a69a')
			: priceChangeValue < 0
				? (isDark ? '#ff6b6b' : '#ef5350')
				: (isDark ? '#64b5f6' : '#2196f3');

		this.legendElement.innerHTML = `
      <div style="font-weight: 700; font-size: 14px; color: ${textColor}; margin-bottom: 4px;">${tokenName}</div>
      <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 4px;">
        <span style="color: ${labelColor}; font-size: 12px;">Price:</span>
        <span style="font-weight: 600; font-size: 16px; color: ${priceColor};">$${price}</span>
      </div>
      <div style="display: flex; align-items: center; gap: 12px; margin-bottom: 4px; flex-wrap: wrap;">
        <div style="display: flex; align-items: center; gap: 4px;">
          <span style="color: ${labelColor}; font-size: 11px;">24h:</span>
          <span style="font-weight: 500; font-size: 11px; color: ${rateColor};">${rate24h}</span>
        </div>
      </div>
      ${ohlcHtml}
    `;
	}

	private updateVolumeSeries(): void {
		if (!this.chart) return;
		const isDark = this.options.theme === 'dark';

		if (this.options.showVolume) {
			if (!this.volumeSeries) {
				this.volumeSeries = this.chart.addSeries(HistogramSeries, {
					color: isDark ? '#26a69a80' : '#26a69a40',
					priceFormat: { type: 'volume' },
				}, 1);
				this.chart.panes()[0].setStretchFactor(0.9);
				this.chart.panes()[1].setStretchFactor(0.1);
			}
			if (this.chartData.candles.length > 0) {
				const volumeData = this.chartData.candles.map(c => this.convertCandleToVolumeData(c));
				this.volumeSeries.setData(volumeData);
			}
			this.chart.applyOptions({
				leftPriceScale: { visible: true, borderColor: isDark ? '#444444' : '#cccccc' },
			});
		} else {
			if (this.volumeSeries) {
				this.chart.removeSeries(this.volumeSeries);
				this.volumeSeries = null;
				this.chart.panes()[0].setStretchFactor(1);
			}
			this.chart.applyOptions({ leftPriceScale: { visible: false } });
		}
	}

	private convertCandleToChartData(candle: Candle) {
		const utcTimestamp = candle.Timestamp;
		const utcDate = new Date(utcTimestamp * 1000);
		const timezoneOffsetSeconds = utcDate.getTimezoneOffset() * 60;
		const localTimestamp = utcTimestamp - timezoneOffsetSeconds;
		return {
			time: localTimestamp as UTCTimestamp,
			open: candle.OpenPrice,
			high: candle.HighPrice,
			low: candle.LowPrice,
			close: candle.ClosePrice,
		};
	}

	private convertCandleToAreaData(candle: Candle) {
		const utcTimestamp = candle.Timestamp;
		const utcDate = new Date(utcTimestamp * 1000);
		const timezoneOffsetSeconds = utcDate.getTimezoneOffset() * 60;
		const localTimestamp = utcTimestamp - timezoneOffsetSeconds;
		return {
			time: localTimestamp as UTCTimestamp,
			value: candle.ClosePrice,
		};
	}

	private convertCandleToVolumeData(candle: Candle) {
		const utcTimestamp = candle.Timestamp;
		const utcDate = new Date(utcTimestamp * 1000);
		const timezoneOffsetSeconds = utcDate.getTimezoneOffset() * 60;
		const localTimestamp = utcTimestamp - timezoneOffsetSeconds;
		const isUp = candle.ClosePrice >= candle.OpenPrice;
		const isDark = this.options.theme === 'dark';
		const color = isUp
			? (isDark ? '#00d4aa80' : '#26a69a40')
			: (isDark ? '#ff6b6b80' : '#ef535040');
		return {
			time: localTimestamp as UTCTimestamp,
			value: candle.VolumeIn,
			color: color,
		};
	}

	private updateChart(data: ChartData): void {
		if (data.candles.length === 0) return;

		if (this.options.priceSeriesType === 'candle' && this.candlestickSeries) {
			const chartData = data.candles.map(c => this.convertCandleToChartData(c));
			this.candlestickSeries.setData(chartData);
		} else if (this.options.priceSeriesType === 'line' && this.lineSeries) {
			const lineData = data.candles.map(c => this.convertCandleToAreaData(c));
			this.lineSeries.setData(lineData);
		}

		if (this.options.showVolume && this.volumeSeries) {
			const volumeData = data.candles.map(c => this.convertCandleToVolumeData(c));
			this.volumeSeries.setData(volumeData);
		}

		if (this.chart && data.candles.length > 0) {
			this.chart.timeScale().fitContent();
		}
	}

	private updateSingleCandle(candle: Candle): void {
		this.currentPrice = candle.ClosePrice;
		if (this.options.priceSeriesType === 'candle' && this.candlestickSeries) {
			const candleData = this.convertCandleToChartData(candle);
			this.candlestickSeries.update(candleData);
		} else if (this.options.priceSeriesType === 'line' && this.lineSeries) {
			const lineData = this.convertCandleToAreaData(candle);
			this.lineSeries.update(lineData);
		}
		if (this.options.theme && this.volumeSeries) {
			const volumeData = this.convertCandleToVolumeData(candle);
			this.volumeSeries.update(volumeData);
		}
		if (this.chart) {
			this.chart.timeScale().scrollToRealTime();
		}
	}

	private handleChartUpdate(data: ChartData): void {
		this.chartData = data;
		const previousCount = this.previousCandleCount;
		const currentCount = data.candles.length;
		const candleCountDiff = currentCount - previousCount;
		const MAX_INCREMENTAL_CANDLES = 50;
		const isIncrementalUpdate = !this.isInitialLoad &&
			currentCount > 0 &&
			candleCountDiff >= 0 &&
			candleCountDiff <= MAX_INCREMENTAL_CANDLES;

		if (isIncrementalUpdate && data.candles.length > 0) {
			if (candleCountDiff === 0 || candleCountDiff === 1) {
				const latestCandle = data.candles[data.candles.length - 1];
				this.updateSingleCandle(latestCandle);
			} else {
				this.updateChart(data);
			}
		} else {
			this.updateChart(data);
			this.isInitialLoad = false;
		}

		this.previousCandleCount = currentCount;
		if (data.candles.length > 0) {
			const latestCandle = data.candles[data.candles.length - 1];
			this.currentPrice = latestCandle.ClosePrice;

			// Calculate 24h price change (first candle vs last candle)
			if (data.candles.length > 1) {
				const firstCandle = data.candles[0];
				if (firstCandle.OpenPrice > 0) {
					this.priceChange = ((latestCandle.ClosePrice - firstCandle.OpenPrice) / firstCandle.OpenPrice) * 100;
				}
			}

			// Update legend when data changes
			if (this.options.legendStyle !== 'none') {
				this.updateLegend(null);
			}
		}
		if (this.options.onDataUpdate) {
			this.options.onDataUpdate(data);
		}
	}

	private handleTrade(trade: RealTimeTrade): void {
		this.currentPrice = trade.Price;
		this.previousPrice = trade.Price;

		// Update legend when trade comes in
		if (this.options.legendStyle !== 'none') {
			this.updateLegend(null);
		}
		if (this.chartData.candles.length > 0) {
			const latestCandle = this.chartData.candles[this.chartData.candles.length - 1];
			const tradeMinuteTimestamp = Math.floor(trade.TradeTime / 60) * 60;
			const latestCandleTimestamp = latestCandle.Timestamp;
			const timeDiff = tradeMinuteTimestamp - latestCandleTimestamp;
			if (timeDiff >= 0 && timeDiff <= 120) {
				const updatedCandle: Candle = {
					...latestCandle,
					ClosePrice: trade.Price,
					HighPrice: Math.max(latestCandle.HighPrice, trade.Price),
					LowPrice: Math.min(latestCandle.LowPrice, trade.Price),
					VolumeIn: latestCandle.VolumeIn + trade.USD,
					VolumeOut: latestCandle.VolumeOut + trade.Amount,
					TransactionCount: (latestCandle.TransactionCount || 0) + 1,
				};
				this.chartData.candles[this.chartData.candles.length - 1] = updatedCandle;
				this.updateSingleCandle(updatedCandle);
			}
		}
		if (this.options.onTrade) {
			this.options.onTrade(trade);
		}
	}

	private async loadTokenData(tokenId: string): Promise<void> {
		if (!this.sdk) return;
		this.isInitialLoad = true;
		this.previousCandleCount = 0;
		this.chartData = { candles: [], lastUpdate: null, isLoading: true, error: null };

		try {
			await this.sdk.initialize(tokenId, true);
			setTimeout(async () => {
				if (!this.sdk) return;
				const isConnected = await this.waitForWebSocketConnection(this.sdk);
				if (isConnected) {
					this.sdk.subscribe(tokenId);
				}
			}, 1000);
		} catch (error) {
			const errorMessage = error instanceof Error ? error.message : 'Failed to load token data';
			this.chartData = { ...this.chartData, error: errorMessage, isLoading: false };
			if (this.options.onError) {
				this.options.onError(errorMessage);
			}
		}
	}

	private async waitForWebSocketConnection(sdk: CryptoChartSDK, maxWaitMs: number = 5000): Promise<boolean> {
		return new Promise((resolve) => {
			const startTime = Date.now();
			const checkConnection = () => {
				const status = sdk.getSubscriptionStatus();
				if (status.isConnected) {
					resolve(true);
					return;
				}
				if (Date.now() - startTime > maxWaitMs) {
					resolve(false);
					return;
				}
				setTimeout(checkConnection, 100);
			};
			checkConnection();
		});
	}

	public destroy(): void {
		if (this.sdk) {
			this.sdk.destroy();
			this.sdk = null;
		}
		if (this.chart) {
			this.chart.remove();
			this.chart = null;
		}
	}

	public resize(width?: number, height?: number): void {
		if (this.chart) {
			this.chart.applyOptions({ width, height });
		}
	}
}

// ============================================================================
// Global API
// ============================================================================

export interface FiPulseWidgetAPI {
	create(options: WidgetOptions): FiPulseChartWidget;
}

// Export the widget API object directly
// Using object literal ensures the structure is preserved in IIFE builds
const FiPulseWidget: FiPulseWidgetAPI = {
	create(options: WidgetOptions): FiPulseChartWidget {
		return new FiPulseChartWidget(options);
	},
};

// Export for module usage
export default FiPulseWidget;
export { FiPulseChartWidget };

