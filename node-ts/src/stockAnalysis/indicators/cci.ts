// @ts-nocheck
import type { IndicatorCompute, IndicatorDefinition } from "./base";
import type { IndicatorInput, IndicatorMarker, IndicatorSeriesData } from "../types";

const CCI_LENGTH = 20;
const CCI_THRESHOLD = 200;

function createSeries(params: {
  name: string;
  values: number[];
  panel: string;
  color?: string;
  plotMode?: string;
  width?: number;
  symbol?: string;
  symbolSize?: number;
  brush?: string;
  fillTarget?: string;
  zValue?: number;
}): IndicatorSeriesData | undefined {
  const { values } = params;
  const hasFinite = values.some((value) => Number.isFinite(value));
  if (!hasFinite) {
    return undefined;
  }
  return {
    name: params.name,
    values: values.map((value) => (Number.isFinite(value) ? value : Number.NaN)),
    panel: params.panel,
    color: params.color,
    plotMode: params.plotMode,
    width: params.width,
    symbol: params.symbol,
    symbolSize: params.symbolSize,
    brush: params.brush,
    fillTarget: params.fillTarget,
    zValue: params.zValue,
  };
}

function cciFromSource(source: number[], length: number): number[] {
  const result = new Array<number>(source.length).fill(Number.NaN);
  if (length <= 1 || source.length < length) {
    return result;
  }
  for (let idx = length - 1; idx < source.length; idx += 1) {
    let valid = true;
    let sum = 0;
    for (let offset = 0; offset < length; offset += 1) {
      const value = source[idx - length + 1 + offset];
      if (!Number.isFinite(value)) {
        valid = false;
        break;
      }
      sum += value;
    }
    if (!valid) {
      continue;
    }
    const mean = sum / length;
    let madSum = 0;
    for (let offset = 0; offset < length; offset += 1) {
      const value = source[idx - length + 1 + offset];
      madSum += Math.abs(value - mean);
    }
    const meanAbsDev = madSum / length;
    if (meanAbsDev <= 1e-12) {
      result[idx] = 0;
      continue;
    }
    const lastValue = source[idx];
    result[idx] = (lastValue - mean) / (0.015 * meanAbsDev);
  }
  return result;
}

function cciFromTypicalPrice(highs: number[], lows: number[], closes: number[], length: number): number[] {
  const typical = highs.map((high, idx) => (high + lows[idx] + closes[idx]) / 3);
  return cciFromSource(typical, length);
}

function computeCciPanel(input: IndicatorInput): IndicatorSeriesData[] {
  const { size } = input;
  if (size < CCI_LENGTH) {
    return [];
  }
  const highs = Array.from(input.highs, (value) => Number(value));
  const lows = Array.from(input.lows, (value) => Number(value));
  const closes = Array.from(input.closes, (value) => Number(value));
  const values = cciFromTypicalPrice(highs, lows, closes, CCI_LENGTH);
  const series = createSeries({
    name: `CCI ${CCI_LENGTH}`,
    values,
    panel: "cci",
    color: "#ab47bc",
    plotMode: "line",
    width: 1.6,
  });
  return series ? [series] : [];
}

function computeCciOverlay(input: IndicatorInput): IndicatorSeriesData[] {
  const size = input.size;
  if (size === 0) {
    return [];
  }

  const opens = Array.from(input.opens, (value) => Number(value));
  const closes = Array.from(input.closes, (value) => Number(value));
  const highs = Array.from(input.highs, (value) => Number(value));
  const lows = Array.from(input.lows, (value) => Number(value));

  const source = opens.map((open, idx) => (open + closes[idx]) * 0.5);
  const ci = cciFromSource(source, CCI_LENGTH);

  const arrowValues = new Array<number>(size).fill(Number.NaN);
  const sellValues = new Array<number>(size).fill(Number.NaN);
  const buyValues = new Array<number>(size).fill(Number.NaN);

  const arrowMarkers: IndicatorMarker[] = [];
  const sellMarkers: IndicatorMarker[] = [];
  const buyMarkers: IndicatorMarker[] = [];

  const arrowUpColor = "rgba(0, 128, 0, 0.65)";
  const arrowDownColor = "rgba(0, 0, 0, 0.65)";
  const sellTextColor = "#111111";
  const buyTextColor = "#c8171f";

  for (let idx = 0; idx < size; idx += 1) {
    const ciValue = ci[idx];
    const prevCi = idx > 0 ? ci[idx - 1] : Number.NaN;
    const high = highs[idx];
    const low = lows[idx];
    const close = closes[idx];

    const range = high - low;
    const priceScale = range > 0 ? range : Math.max(Math.abs(close) * 0.01, 1e-6);
  const arrowOffset = Math.max(priceScale * 0.35, Math.abs(close) * 0.002);
  const labelOffset = Math.max(priceScale * 0.2, arrowOffset * 0.45);

    if (Number.isFinite(ciValue) && Number.isFinite(prevCi)) {
      const longSetup = ciValue > prevCi && ciValue <= -90 && ciValue > -116;
      const shortSetup = ciValue < prevCi && ciValue >= 90 && ciValue < 116;

      if (longSetup) {
        const value = low - arrowOffset;
        arrowValues[idx] = value;
        arrowMarkers.push({
          index: idx,
          value,
          text: "",
          color: arrowUpColor,
          position: "belowBar",
          shape: "arrowUp",
          size: 2,
        });
      }

      if (shortSetup) {
        const value = high + arrowOffset;
        arrowValues[idx] = value;
        arrowMarkers.push({
          index: idx,
          value,
          text: "",
          color: arrowDownColor,
          position: "aboveBar",
          shape: "arrowDown",
          size: 2,
        });
      }
    }

    if (!Number.isFinite(ciValue)) {
      continue;
    }

    const isSell = CCI_THRESHOLD - ciValue < 0;
    const isBuy = -CCI_THRESHOLD - ciValue > 0;

    if (isSell) {
      const value = high + labelOffset;
      sellValues[idx] = value;
      sellMarkers.push({
        index: idx,
        value,
        text: "S",
        color: "rgba(0, 0, 0, 0)",
        position: "aboveBar",
        shape: "circle",
        textColor: sellTextColor,
        offsetX: -5,
        offsetY: -15,
      });
    }

    if (isBuy) {
      const value = low - labelOffset;
      buyValues[idx] = value;
      buyMarkers.push({
        index: idx,
        value,
        text: "B",
        color: "rgba(0, 0, 0, 0)",
        position: "belowBar",
        shape: "circle",
        textColor: buyTextColor,
        offsetX: -5,
        offsetY: 6,
      });
    }
  }

  const results: IndicatorSeriesData[] = [];

  if (arrowMarkers.length > 0) {
    results.push({
      name: "CCI Overlay Arrows",
      values: arrowValues,
      panel: "overlay",
      plotMode: "markers",
      markers: arrowMarkers,
      zValue: 12,
    });
  }

  if (sellMarkers.length > 0) {
    results.push({
      name: "CCI Overlay Sell Marks",
      values: sellValues,
      panel: "overlay",
      plotMode: "markers",
      markers: sellMarkers,
      zValue: 10.5,
    });
  }

  if (buyMarkers.length > 0) {
    results.push({
      name: "CCI Overlay Buy Marks",
      values: buyValues,
      panel: "overlay",
      plotMode: "markers",
      markers: buyMarkers,
      zValue: 10.5,
    });
  }

  return results;
}

const computePanel: IndicatorCompute = (input) => computeCciPanel(input);
const computeOverlay: IndicatorCompute = (input) => computeCciOverlay(input);

export const cciDefinitions: IndicatorDefinition[] = [
  {
    key: "cci_20",
    name: "CCI 20",
    category: "Oscillator",
    panel: "cci",
    description: "Commodity Channel Index with period 20.",
    compute: computePanel,
    isDefault: true,
  },
  {
    key: "cci_overlay_signals",
    name: "CCI Overlay Signals",
    category: "Overlay",
    panel: "overlay",
    description: "CCI 기반 매매 신호",
    compute: computeOverlay,
    isDefault: false,
  },
];
