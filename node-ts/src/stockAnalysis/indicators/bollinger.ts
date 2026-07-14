// @ts-nocheck
import type { IndicatorCompute, IndicatorDefinition } from "./base";
import type { IndicatorInput, IndicatorSeriesData } from "../types";

const PERIOD = 200;

const COLOR_MAROON = "#800000";
const COLOR_BLACK = "#000000";
const COLOR_RED_FADED = "rgba(255, 0, 0, 0.5)";
const COLOR_PURPLE_FADED = "rgba(128, 0, 128, 0.7)";
const COLOR_NAVY_FADED = "rgba(0, 0, 128, 0.6)";
const COLOR_NAVY_LIGHT = "rgba(0, 0, 128, 0.7)";

function createSeries(params: {
  name: string;
  values: number[];
  panel: string;
  color?: string;
  plotMode?: string;
  width?: number;
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
    zValue: params.zValue,
  };
}

function weightedMovingAverage(values: number[], period: number): number[] {
  const result = new Array<number>(values.length).fill(Number.NaN);
  if (period <= 0 || values.length < period) {
    return result;
  }
  const weights = new Array<number>(period);
  for (let idx = 0; idx < period; idx += 1) {
    weights[idx] = idx + 1;
  }
  const denom = (period * (period + 1)) / 2;
  for (let idx = period - 1; idx < values.length; idx += 1) {
    let weightedSum = 0;
    let valid = true;
    for (let offset = 0; offset < period; offset += 1) {
      const value = values[idx - period + 1 + offset];
      if (!Number.isFinite(value)) {
        valid = false;
        break;
      }
      weightedSum += value * weights[offset];
    }
    if (valid) {
      result[idx] = weightedSum / denom;
    }
  }
  return result;
}

function rollingStd(values: number[], period: number): number[] {
  const result = new Array<number>(values.length).fill(Number.NaN);
  if (period <= 0 || values.length < period) {
    return result;
  }
  for (let idx = period - 1; idx < values.length; idx += 1) {
    let sum = 0;
    let sumSq = 0;
    let valid = true;
    for (let offset = 0; offset < period; offset += 1) {
      const value = values[idx - period + 1 + offset];
      if (!Number.isFinite(value)) {
        valid = false;
        break;
      }
      sum += value;
      sumSq += value * value;
    }
    if (!valid) {
      continue;
    }
    const mean = sum / period;
    const variance = Math.max(0, sumSq / period - mean * mean);
    result[idx] = Math.sqrt(variance);
  }
  return result;
}

function computeBollingerWma200(input: IndicatorInput): IndicatorSeriesData[] {
  const size = input.size;
  if (size < PERIOD) {
    return [];
  }

  const highs = Array.from(input.highs, (value) => Number(value));
  const lows = Array.from(input.lows, (value) => Number(value));
  const closes = Array.from(input.closes, (value) => Number(value));
  const typical = highs.map((high, idx) => (high + lows[idx] + closes[idx]) / 3);

  const base = weightedMovingAverage(typical, PERIOD);
  const std = rollingStd(typical, PERIOD);

  const upper = new Array<number>(size).fill(Number.NaN);
  const lower = new Array<number>(size).fill(Number.NaN);
  const upperExtreme = new Array<number>(size).fill(Number.NaN);
  const upperMidHigh = new Array<number>(size).fill(Number.NaN);
  const upperMidLow = new Array<number>(size).fill(Number.NaN);
  const lowerMidHigh = new Array<number>(size).fill(Number.NaN);

  for (let idx = 0; idx < size; idx += 1) {
    const mid = base[idx];
    const deviation = std[idx];
    if (!Number.isFinite(mid) || !Number.isFinite(deviation)) {
      continue;
    }

    const dev1 = deviation;
    const dev2 = deviation * 2;

    const upperValue = mid + dev2;
    const lowerValue = mid - dev2;
    const extremeValue = upperValue + dev2;
    const upperMidHighValue = upperValue + dev1;
    const upperMidLowValue = upperValue - dev1;
    const lowerMidHighValue = lowerValue + dev1;

    upper[idx] = upperValue;
    upperExtreme[idx] = extremeValue;
    upperMidHigh[idx] = upperMidHighValue;
    upperMidLow[idx] = upperMidLowValue;

    if (lowerValue > 0) {
      lower[idx] = lowerValue;
    }
    if (lowerMidHighValue > 0) {
      lowerMidHigh[idx] = lowerMidHighValue;
    }
  }

  const filteredBase = base.map((value) => (Number.isFinite(value) ? value : Number.NaN));

  const results: IndicatorSeriesData[] = [];

  const entries: Array<{
    name: string;
    values: number[];
    color: string;
    width: number;
  }> = [
    { name: "WMA200 Upper", values: upper, color: COLOR_MAROON, width: 5 },
    { name: "WMA200 Base", values: filteredBase, color: COLOR_BLACK, width: 5 },
    { name: "WMA200 Lower", values: lower, color: COLOR_MAROON, width: 5 },
    { name: "WMA200 Upper Extreme", values: upperExtreme, color: COLOR_RED_FADED, width: 2 },
    { name: "WMA200 Upper +1σ", values: upperMidHigh, color: COLOR_PURPLE_FADED, width: 3 },
    { name: "WMA200 Upper -1σ", values: upperMidLow, color: COLOR_NAVY_FADED, width: 3 },
    { name: "WMA200 Lower +1σ", values: lowerMidHigh, color: COLOR_NAVY_LIGHT, width: 3 },
  ];

  entries.forEach((entry) => {
    const series = createSeries({
      name: entry.name,
      values: entry.values,
      panel: "overlay",
      color: entry.color,
      plotMode: "colstep",
      width: entry.width,
    });
    if (series) {
      results.push(series);
    }
  });

  return results;
}

const computeBollinger200: IndicatorCompute = (input) => computeBollingerWma200(input);

export const bollingerDefinitions: IndicatorDefinition[] = [
  {
    key: "bb_wma_200",
    name: "Bollinger WMA 200",
    category: "Volatility",
    panel: "overlay",
    description: "Weighted moving average Bollinger bands (200) with extended levels.",
    compute: computeBollinger200,
    isDefault: true,
  },
];
