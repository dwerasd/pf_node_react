// @ts-nocheck
import type { IndicatorCompute, IndicatorDefinition } from "./base";
import type { IndicatorInput, IndicatorSeriesData } from "../types";

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

function simpleMovingAverage(values: number[], period: number): number[] {
  const result = new Array<number>(values.length).fill(Number.NaN);
  if (period <= 0 || values.length < period) {
    return result;
  }
  let sum = 0;
  let validCount = 0;
  for (let idx = 0; idx < values.length; idx += 1) {
    const value = values[idx];
    if (Number.isFinite(value)) {
      sum += value;
      validCount += 1;
    }
    if (idx >= period) {
      const drop = values[idx - period];
      if (Number.isFinite(drop)) {
        sum -= drop;
        validCount -= 1;
      }
    }
    if (idx >= period - 1 && validCount === period) {
      result[idx] = sum / period;
    }
  }
  return result;
}

function exponentialMovingAverage(values: number[], period: number): number[] {
  const result = new Array<number>(values.length).fill(Number.NaN);
  if (period <= 0 || values.length === 0) {
    return result;
  }
  const alpha = 2 / (period + 1);
  let prev = Number.NaN;
  for (let idx = 0; idx < values.length; idx += 1) {
    const value = values[idx];
    if (!Number.isFinite(value)) {
      continue;
    }
    if (!Number.isFinite(prev)) {
      prev = value;
    } else {
      prev = prev + alpha * (value - prev);
    }
    result[idx] = prev;
  }
  return result;
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

function computeMovingAverage(
  input: IndicatorInput,
  method: "sma" | "ema" | "wma",
  period: number,
  color: string,
  label: string,
): IndicatorSeriesData[] {
  if (input.size < period) {
    return [];
  }
  const closes = Array.from(input.closes, (value) => Number(value));
  let values: number[];
  if (method === "sma") {
    values = simpleMovingAverage(closes, period);
  } else if (method === "ema") {
    values = exponentialMovingAverage(closes, period);
  } else {
    values = weightedMovingAverage(closes, period);
  }
  const series = createSeries({
    name: label,
    values,
    panel: "overlay",
    color,
    plotMode: "line",
    width: 1.8,
  });
  return series ? [series] : [];
}

interface MovingAverageConfig {
  method: "sma" | "ema" | "wma";
  period: number;
  color: string;
}

const MOVING_AVERAGE_CONFIGS: MovingAverageConfig[] = [
  { method: "sma", period: 20, color: "#1e88e5" },
  { method: "sma", period: 100, color: "#43a047" },
  { method: "sma", period: 200, color: "#ffa726" },
  { method: "ema", period: 100, color: "#26a69a" },
  { method: "ema", period: 200, color: "#5c6bc0" },
];

const METHOD_META: Record<string, string> = {
  sma: "Simple moving average",
  ema: "Exponential moving average",
  wma: "Weighted moving average",
};

export const movingAverageDefinitions: IndicatorDefinition[] = MOVING_AVERAGE_CONFIGS.map((config) => {
  const label = `${config.method.toUpperCase()} ${config.period}`;
  const descriptionText = METHOD_META[config.method] ?? "Moving average";
  const compute: IndicatorCompute = (input) =>
    computeMovingAverage(input, config.method, config.period, config.color, label);
  return {
    key: `${config.method}_${config.period}`,
    name: label,
    category: "Trend",
    panel: "overlay",
    description: `${descriptionText} over ${config.period} periods.`,
    compute,
    isDefault: false,
  };
});
