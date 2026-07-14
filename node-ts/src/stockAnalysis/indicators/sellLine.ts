// @ts-nocheck
import type { IndicatorDefinition, IndicatorCompute } from "./base";
import type { IndicatorInput, IndicatorSeriesData } from "../types";

const BASE_LENGTH = 22;
const FACTOR = 1.0;
const ATR_PERIOD = 3;
const USE_OC2_SOURCE = false;

const BB_LENGTH = 20;
const BB_MULTIPLIER = 2;

const COLOR_ORANGE = "#ffa500";
const COLOR_BLUE = "#0000ff";
const COLOR_MAROON = "#800000";
const COLOR_BLACK = "#000000";
const COLOR_PURPLE = "#800080";
const COLOR_MAROON_FADED = "rgba(128, 0, 0, 0.5)";
const COLOR_GREEN_FADED = "rgba(0, 128, 0, 0.5)";
const COLOR_FUCHSIA_FILL = "rgba(255, 0, 255, 0.4)";
const COLOR_BLUE_FILL = "rgba(0, 0, 255, 0.4)";
const COLOR_TRANSPARENT = "rgba(0, 0, 0, 0)";

interface SellLineCore {
  avgHigh: number[];
  avgLow: number[];
  center: number[];
  sellLine: number[];
  buyLine: number[];
}

function createSeries(params: {
  name: string;
  values: number[];
  panel: string;
  color?: string;
  plotMode?: string;
  width?: number;
  zValue?: number;
  brush?: string;
  fillTarget?: string;
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
    brush: params.brush,
    fillTarget: params.fillTarget
  };
}

function ema(values: number[], period: number): number[] {
  const result = new Array<number>(values.length).fill(Number.NaN);
  if (period <= 1) {
    for (let idx = 0; idx < values.length; idx += 1) {
      result[idx] = values[idx];
    }
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

function rma(values: number[], period: number): number[] {
  const result = new Array<number>(values.length).fill(Number.NaN);
  if (period <= 0) {
    return result;
  }
  const alpha = 1 / period;
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

function trueRange(highs: number[], lows: number[], closes: number[]): number[] {
  const result = new Array<number>(highs.length).fill(Number.NaN);
  if (highs.length === 0) {
    return result;
  }
  let prevClose = closes[0];
  for (let idx = 0; idx < highs.length; idx += 1) {
    const high = highs[idx];
    const low = lows[idx];
    result[idx] = Math.max(high - low, Math.abs(high - prevClose), Math.abs(low - prevClose));
    prevClose = closes[idx];
  }
  return result;
}

function atr(highs: number[], lows: number[], closes: number[], period: number): number[] {
  const tr = trueRange(highs, lows, closes);
  return rma(tr, period);
}

function wma(values: number[], period: number): number[] {
  const result = new Array<number>(values.length).fill(Number.NaN);
  if (period <= 0 || values.length < period) {
    return result;
  }
  const weightSum = (period * (period + 1)) / 2;
  for (let idx = period - 1; idx < values.length; idx += 1) {
    let acc = 0;
    let valid = true;
    for (let offset = 0; offset < period; offset += 1) {
      const value = values[idx - offset];
      if (!Number.isFinite(value)) {
        valid = false;
        break;
      }
      const weight = period - offset;
      acc += value * weight;
    }
    if (valid) {
      result[idx] = acc / weightSum;
    }
  }
  return result;
}

function rollingStdDev(values: number[], period: number): number[] {
  const result = new Array<number>(values.length).fill(Number.NaN);
  if (period <= 0 || values.length < period) {
    return result;
  }
  for (let idx = period - 1; idx < values.length; idx += 1) {
    let sum = 0;
    let sumSq = 0;
    let valid = true;
    for (let offset = 0; offset < period; offset += 1) {
      const value = values[idx - offset];
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

function rollingMax(values: number[], period: number): number[] {
  const result = new Array<number>(values.length).fill(Number.NaN);
  if (period <= 0) {
    return result;
  }
  for (let idx = period - 1; idx < values.length; idx += 1) {
    let max = -Infinity;
    let valid = false;
    for (let offset = 0; offset < period; offset += 1) {
      const value = values[idx - period + 1 + offset];
      if (Number.isFinite(value)) {
        valid = true;
        if (value > max) {
          max = value;
        }
      }
    }
    result[idx] = valid ? max : Number.NaN;
  }
  return result;
}

function rollingMin(values: number[], period: number): number[] {
  const result = new Array<number>(values.length).fill(Number.NaN);
  if (period <= 0) {
    return result;
  }
  for (let idx = period - 1; idx < values.length; idx += 1) {
    let min = Infinity;
    let valid = false;
    for (let offset = 0; offset < period; offset += 1) {
      const value = values[idx - period + 1 + offset];
      if (Number.isFinite(value)) {
        valid = true;
        if (value < min) {
          min = value;
        }
      }
    }
    result[idx] = valid ? min : Number.NaN;
  }
  return result;
}

function computeSellLineCore(input: IndicatorInput): SellLineCore | null {
  const count = input.size;
  if (count === 0) {
    return null;
  }

  const opens = Array.from(input.opens, (value) => Number(value));
  const highs = Array.from(input.highs, (value) => Number(value));
  const lows = Array.from(input.lows, (value) => Number(value));
  const closes = Array.from(input.closes, (value) => Number(value));

  const hlc3 = highs.map((high, idx) => (high + lows[idx] + closes[idx]) / 3);
  const oc2 = opens.map((open, idx) => (open + closes[idx]) * 0.5);
  const basis = USE_OC2_SOURCE ? oc2 : hlc3;

  const atrFast = atr(highs, lows, closes, ATR_PERIOD);

  const highLines: [number[], number[], number[]] = [
    new Array<number>(count).fill(Number.NaN),
    new Array<number>(count).fill(Number.NaN),
    new Array<number>(count).fill(Number.NaN)
  ];
  const lowLines: [number[], number[], number[]] = [
    new Array<number>(count).fill(Number.NaN),
    new Array<number>(count).fill(Number.NaN),
    new Array<number>(count).fill(Number.NaN)
  ];

  const multipliers: [1, 2, 3] = [1, 2, 3];
  multipliers.forEach((tp, idxMultiplier) => {
    const period = BASE_LENGTH * tp;
    const emaArr = ema(basis, period);
    const maxArr = rollingMax(highs, period);
    const minArr = rollingMin(lows, period);
    const highLine = highLines[idxMultiplier];
    const lowLine = lowLines[idxMultiplier];

    for (let idx = 0; idx < count; idx += 1) {
      const emaVal = emaArr[idx];
      const maxVal = maxArr[idx];
      const minVal = minArr[idx];
      const atrVal = atrFast[idx];
      const basisVal = basis[idx];

      if (
        !Number.isFinite(emaVal) ||
        !Number.isFinite(maxVal) ||
        !Number.isFinite(minVal) ||
        !Number.isFinite(atrVal) ||
        !Number.isFinite(basisVal)
      ) {
        continue;
      }

      const myh = 0.5 * (emaVal + maxVal);
      const targetHigh = myh + FACTOR * tp * atrVal;
      const prevHigh = idx > 0 ? highLine[idx - 1] : Number.NaN;
      highLine[idx] = Number.isFinite(prevHigh) && basisVal < prevHigh ? Math.min(targetHigh, prevHigh) : targetHigh;

      const myl = 0.5 * (emaVal + minVal);
      const targetLow = myl - FACTOR * tp * atrVal;
      const prevLow = idx > 0 ? lowLine[idx - 1] : Number.NaN;
      lowLine[idx] = Number.isFinite(prevLow) && basisVal > prevLow ? Math.max(targetLow, prevLow) : targetLow;
    }
  });

  const avgHigh = new Array<number>(count).fill(Number.NaN);
  const avgLow = new Array<number>(count).fill(Number.NaN);
  for (let idx = 0; idx < count; idx += 1) {
    const h1 = highLines[0][idx];
    const h2 = highLines[1][idx];
    const h3 = highLines[2][idx];
    if (Number.isFinite(h1) && Number.isFinite(h2) && Number.isFinite(h3)) {
      avgHigh[idx] = (h1 + h2 + h3) / 3;
    }
    const l1 = lowLines[0][idx];
    const l2 = lowLines[1][idx];
    const l3 = lowLines[2][idx];
    if (Number.isFinite(l1) && Number.isFinite(l2) && Number.isFinite(l3)) {
      const value = (l1 + l2 + l3) / 3;
      avgLow[idx] = value > 0 ? value : 0;
    }
  }

  const center = new Array<number>(count).fill(Number.NaN);
  const sellLine = new Array<number>(count).fill(Number.NaN);
  const buyLine = new Array<number>(count).fill(Number.NaN);
  for (let idx = 0; idx < count; idx += 1) {
    const high = avgHigh[idx];
    const low = avgLow[idx];
    if (Number.isFinite(high) && Number.isFinite(low)) {
      const mid = (high + low) * 0.5;
      center[idx] = mid;
      sellLine[idx] = 0.5 * (mid + high);
      const buyValue = 0.5 * (mid + low);
      buyLine[idx] = buyValue > 0 ? buyValue : 0;
    }
  }

  return { avgHigh, avgLow, center, sellLine, buyLine };
}

const computeSellLineOverlay: IndicatorCompute = (input) => {
  const core = computeSellLineCore(input);
  if (!core) {
    return [];
  }

  const closes = Array.from(input.closes, (value) => Number(value));
  const bbSource = closes;
  const wmaValues = wma(bbSource, BB_LENGTH);
  const stdevValues = rollingStdDev(bbSource, BB_LENGTH);

  const bbUpper = new Array<number>(bbSource.length).fill(Number.NaN);
  const bbLowerRaw = new Array<number>(bbSource.length).fill(Number.NaN);
  for (let idx = 0; idx < bbSource.length; idx += 1) {
    const base = wmaValues[idx];
    const dev = stdevValues[idx];
    if (!Number.isFinite(base) || !Number.isFinite(dev)) {
      continue;
    }
    const scaled = dev * BB_MULTIPLIER;
    bbUpper[idx] = base + scaled;
    bbLowerRaw[idx] = base - scaled;
  }

  const bbLower = bbLowerRaw.map((value) => {
    if (!Number.isFinite(value)) {
      return Number.NaN;
    }
    return value > 0 ? value : Number.NaN;
  });

  const filteredLow = core.avgLow.map((value) => (Number.isFinite(value) && value > 0 ? value : Number.NaN));
  const filteredBuy = core.buyLine.map((value) => (Number.isFinite(value) && value > 0 ? value : Number.NaN));

  const series: IndicatorSeriesData[] = [];

  const wmaSeries = createSeries({
    name: "WMA20",
    values: wmaValues,
    panel: "overlay",
    color: COLOR_ORANGE,
    plotMode: "colstep",
    width: 2,
    zValue: 5.2
  });
  if (wmaSeries) {
    series.push(wmaSeries);
  }

  const bbUpperSeries = createSeries({
    name: "WMA20 Bollinger Upper",
    values: bbUpper,
    panel: "overlay",
    color: COLOR_BLUE,
    plotMode: "colstep",
    width: 1.5,
    zValue: 5.1
  });
  if (bbUpperSeries) {
    series.push(bbUpperSeries);
  }

  const bbLowerSeries = createSeries({
    name: "WMA20 Bollinger Lower",
    values: bbLower,
    panel: "overlay",
    color: COLOR_MAROON,
    plotMode: "colstep",
    width: 1.5,
    zValue: 5.1
  });
  if (bbLowerSeries) {
    series.push(bbLowerSeries);
  }

  const highSeries = createSeries({
    name: "Sell Line Average High",
    values: core.avgHigh,
    panel: "overlay",
    color: COLOR_BLACK,
    plotMode: "colstep",
    width: 2
  });
  if (highSeries) {
    series.push(highSeries);
  }

  const sellSeries = createSeries({
    name: "Sell Line Upper Mid",
    values: core.sellLine,
    panel: "overlay",
    color: COLOR_MAROON_FADED,
    plotMode: "colstep",
    width: 2
  });
  if (sellSeries) {
    series.push(sellSeries);
  }

  const centerSeries = createSeries({
    name: "Sell Line Center",
    values: core.center,
    panel: "overlay",
    color: COLOR_PURPLE,
    plotMode: "colstep",
    width: 2
  });
  if (centerSeries) {
    series.push(centerSeries);
  }

  const buySeries = createSeries({
    name: "Sell Line Lower Mid",
    values: filteredBuy,
    panel: "overlay",
    color: COLOR_GREEN_FADED,
    plotMode: "colstep",
    width: 2
  });
  if (buySeries) {
    series.push(buySeries);
  }

  const lowSeries = createSeries({
    name: "Sell Line Average Low",
    values: filteredLow,
    panel: "overlay",
    color: COLOR_BLACK,
    plotMode: "colstep",
    width: 2
  });
  if (lowSeries) {
    series.push(lowSeries);
  }

  const bbUpperFill = createSeries({
    name: "WMA20 Bollinger Upper Fill",
    values: bbUpper,
    panel: "overlay",
    color: COLOR_TRANSPARENT,
    plotMode: "line",
    width: 0.1,
    brush: COLOR_FUCHSIA_FILL,
    fillTarget: highSeries?.name,
    zValue: 4.9
  });
  if (bbUpperFill) {
    series.push(bbUpperFill);
  }

  const bbLowerFill = createSeries({
    name: "WMA20 Bollinger Lower Fill",
    values: bbLower,
    panel: "overlay",
    color: COLOR_TRANSPARENT,
    plotMode: "line",
    width: 0.1,
    brush: COLOR_BLUE_FILL,
    fillTarget: lowSeries?.name,
    zValue: 4.9
  });
  if (bbLowerFill) {
    series.push(bbLowerFill);
  }

  return series;
};

export const sellLineDefinitions: IndicatorDefinition[] = [
  {
    key: "sell_line",
    name: "Sell Line",
    category: "Overlay",
    panel: "overlay",
    description: "Sell line overlay based on multi-length EMA and ATR bands.",
    isDefault: false,
    compute: computeSellLineOverlay
  }
];
