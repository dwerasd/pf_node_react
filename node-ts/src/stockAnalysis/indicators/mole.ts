// @ts-nocheck
import type { IndicatorCompute, IndicatorDefinition } from "./base";
import type { IndicatorInput, IndicatorMarker, IndicatorSeriesData } from "../types";

const MID_PERIOD = 14;
const VOLUME_SMA_PERIOD = 5;
const VOLUME_MULTIPLIER = 5;
const MARKER_COLOR = "#ff6d00";

function rollingMax(values: number[], period: number): number[] {
  const result = new Array<number>(values.length).fill(Number.NaN);
  if (period <= 0) {
    return result;
  }
  for (let idx = period - 1; idx < values.length; idx += 1) {
    let maxValue = -Infinity;
    let valid = false;
    for (let offset = 0; offset < period; offset += 1) {
      const candidate = values[idx - period + 1 + offset];
      if (Number.isFinite(candidate)) {
        valid = true;
        if (candidate > maxValue) {
          maxValue = candidate;
        }
      }
    }
    if (valid) {
      result[idx] = maxValue;
    }
  }
  return result;
}

function rollingMin(values: number[], period: number): number[] {
  const result = new Array<number>(values.length).fill(Number.NaN);
  if (period <= 0) {
    return result;
  }
  for (let idx = period - 1; idx < values.length; idx += 1) {
    let minValue = Infinity;
    let valid = false;
    for (let offset = 0; offset < period; offset += 1) {
      const candidate = values[idx - period + 1 + offset];
      if (Number.isFinite(candidate)) {
        valid = true;
        if (candidate < minValue) {
          minValue = candidate;
        }
      }
    }
    if (valid) {
      result[idx] = minValue;
    }
  }
  return result;
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

function computeMole(input: IndicatorInput): IndicatorSeriesData[] {
  const size = input.size;
  if (size === 0) {
    return [];
  }

  const opens = Array.from(input.opens, (value) => Number(value));
  const closes = Array.from(input.closes, (value) => Number(value));
  const highs = Array.from(input.highs, (value) => Number(value));
  const lows = Array.from(input.lows, (value) => Number(value));
  const volumes = Array.from(input.volumes, (value) => Number(value));

  const highOc = opens.map((open, idx) => Math.max(open, closes[idx]));
  const lowOc = opens.map((open, idx) => Math.min(open, closes[idx]));

  const highest = rollingMax(highOc, MID_PERIOD);
  const lowest = rollingMin(lowOc, MID_PERIOD);
  const averageLine = new Array<number>(size).fill(Number.NaN);
  for (let idx = 0; idx < size; idx += 1) {
    const hi = highest[idx];
    const lo = lowest[idx];
    if (Number.isFinite(hi) && Number.isFinite(lo)) {
      averageLine[idx] = (hi + lo) * 0.5;
    }
  }

  const volumeAvg = simpleMovingAverage(volumes, VOLUME_SMA_PERIOD);
  const markerValues = new Array<number>(size).fill(Number.NaN);
  const markerList: IndicatorMarker[] = [];

  for (let idx = 0; idx < size; idx += 1) {
    const open = opens[idx];
    const close = closes[idx];
    const avg = averageLine[idx];
    const prevAvg = idx > 0 ? averageLine[idx - 1] : Number.NaN;
    const avgVolume = volumeAvg[idx];
    const prevAvgVolume = idx > 0 ? volumeAvg[idx - 1] : Number.NaN;
    const high = highs[idx];
    const low = lows[idx];

    const upCandle = open < close;
    const priceAbove = Number.isFinite(avg) && close > avg;
    const volumeCondition = Number.isFinite(avgVolume) && Number.isFinite(prevAvgVolume)
      ? avgVolume > prevAvgVolume * VOLUME_MULTIPLIER
      : false;
    const slopeUp = Number.isFinite(avg) && Number.isFinite(prevAvg) ? prevAvg < avg : false;

    const isCandidate = upCandle && priceAbove && volumeCondition && slopeUp;

    if (isCandidate) {
      const range = high - low;
      const padding = range > 0 ? range * 0.35 : Math.max(Math.abs(close) * 0.02, 1e-3);
      const markerValue = Number.isFinite(high) ? high + padding : close + Math.abs(close) * 0.02;
      markerValues[idx] = markerValue;
      markerList.push({
        index: idx,
        value: markerValue,
        text: "",
        color: MARKER_COLOR,
        position: "aboveBar",
        shape: "circle",
        size: 1.8,
      });
    }
  }

  const series: IndicatorSeriesData[] = [];

  if (markerList.length > 0) {
    series.push({
      name: "두더지 신호",
      values: markerValues,
      panel: "overlay",
      plotMode: "markers",
      markers: markerList,
      color: MARKER_COLOR,
      zValue: 11,
    });
  }

  return series;
}

const compute: IndicatorCompute = (input) => computeMole(input);

export const moleDefinitions: IndicatorDefinition[] = [
  {
    key: "mole_overlay",
    name: "두더지",
    category: "Overlay",
    panel: "overlay",
    description: "거래량 급등 구간 표시",
    isDefault: false,
    compute,
  },
];
