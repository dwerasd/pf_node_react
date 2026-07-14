// @ts-nocheck
import type { IndicatorCompute, IndicatorDefinition } from "./base";
import type { IndicatorInput, IndicatorSeriesData, IndicatorMarker } from "../types";
import { atrTalib } from "./talibAdapters";

const LOOKBACK = 0;
const ATR_PERIOD = 200;
const FILTER_PERCENT = 0.5;
const MAX_BOXES = 6;
const TEMP_BOX_SPAN = 7;
const SHOW_BROKEN = false;

const BULL_LINE_COLOR = "#0b7d63";
const BULL_FILL_COLOR = "rgba(20, 190, 148, 0.25)";
const BULL_LINE_COLOR_BROKEN = "rgba(11, 125, 99, 0.35)";
const BULL_FILL_COLOR_BROKEN = "rgba(20, 190, 148, 0.1)";
const BEAR_LINE_COLOR = "#992020";
const BEAR_FILL_COLOR = "rgba(194, 25, 25, 0.25)";
const BEAR_LINE_COLOR_BROKEN = "rgba(153, 32, 32, 0.35)";
const BEAR_FILL_COLOR_BROKEN = "rgba(194, 25, 25, 0.1)";
const GAP_LINE_COLOR = "#6c6f73";
const GAP_BULL_FILL = "rgba(120, 122, 126, 0.35)";
const GAP_BEAR_FILL = "rgba(120, 122, 126, 0.35)";

interface GapEntry {
  start: number;
  end: number;
  top: number;
  bottom: number;
  strength: number;
}

class BoxState {
  top: number;
  bottom: number;
  startIndex: number;
  endIndex: number;
  active: boolean;
  broken: boolean;
  strength: number;

  constructor(top: number, bottom: number, startIndex: number, endIndex?: number, strength?: number) {
    this.top = top;
    this.bottom = bottom;
    this.startIndex = Math.max(0, Math.trunc(startIndex));
    this.endIndex = endIndex !== undefined ? Math.trunc(endIndex) : this.startIndex;
    this.active = true;
    this.broken = false;
    this.strength = Number.isFinite(strength) ? Number(strength) : 0;
  }
}

function trueRange(highs: number[], lows: number[], closes: number[]): number[] {
  const result = new Array(highs.length).fill(Number.NaN);
  if (highs.length === 0) {
    return result;
  }
  let prevClose = closes[0];
  for (let idx = 0; idx < highs.length; idx += 1) {
    const high = highs[idx];
    const low = lows[idx];
    const values = [high - low, Math.abs(high - prevClose), Math.abs(low - prevClose)];
    result[idx] = Math.max(...values);
    prevClose = closes[idx];
  }
  return result;
}

function atrRma(highs: number[], lows: number[], closes: number[], period: number): number[] {
  if (period <= 1) {
    throw new Error("ATR period must be greater than 1");
  }
  const tr = trueRange(highs, lows, closes);
  const result = new Array(tr.length).fill(Number.NaN);
  if (tr.length === 0) {
    return result;
  }
  result[0] = tr[0];
  const alpha = 1 / period;
  for (let idx = 1; idx < tr.length; idx += 1) {
    const prev = Number.isFinite(result[idx - 1]) ? result[idx - 1] : tr[idx - 1];
    result[idx] = prev + alpha * (tr[idx] - prev);
  }
  const cut = Math.min(period - 1, result.length);
  for (let idx = 0; idx < cut; idx += 1) {
    result[idx] = Number.NaN;
  }
  return result;
}

function atrWithFallback(highs: number[], lows: number[], closes: number[], period: number): number[] {
  try {
    const values = atrTalib(highs, lows, closes, period);
    if (values.some((value) => Number.isFinite(value))) {
      return values;
    }
  } catch (error) {
    console.warn("[FVG] TA-Lib ATR 호출 실패, RMA 계산으로 대체합니다.", error);
  }
  return atrRma(highs, lows, closes, period);
}

function createSeries(params: {
  name: string;
  values: number[];
  panel: string;
  color?: string;
  plotMode?: string;
  width?: number;
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
    brush: params.brush,
    fillTarget: params.fillTarget,
    zValue: params.zValue,
  };
}

function createRangeValues(length: number, start: number, end: number, value: number): number[] {
  const result = new Array<number>(length).fill(Number.NaN);
  if (length === 0) {
    return result;
  }
  const startClamped = Math.max(0, Math.min(length - 1, Math.trunc(start)));
  const endClamped = Math.max(startClamped, Math.min(length - 1, Math.trunc(end)));
  for (let idx = startClamped; idx <= endClamped; idx += 1) {
    result[idx] = value;
  }
  return result;
}

function formatPercent(value: number, isBullish: boolean): string {
  if (!Number.isFinite(value)) {
    return "";
  }
  const signedValue = isBullish ? Math.abs(value) : -Math.abs(value);
  const formatted = signedValue.toFixed(2);
  if (signedValue > 0) {
    return `+${formatted}%`;
  }
  return `${formatted}%`;
}

function markBoxBroken(box: BoxState, index: number): void {
  box.broken = true;
  box.active = false;
  box.endIndex = Math.max(box.startIndex, index);
}

function updateBullBoxes(boxes: BoxState[], index: number, currentHigh: number): void {
  for (let boxIndex = boxes.length - 1; boxIndex >= 0; boxIndex -= 1) {
    const box = boxes[boxIndex];
    if (box.broken) {
      continue;
    }
    if (currentHigh < box.bottom) {
      markBoxBroken(box, index);
      if (!SHOW_BROKEN) {
        boxes.splice(boxIndex, 1);
      }
      continue;
    }
    box.endIndex = index;
  }
}

function updateBearBoxes(boxes: BoxState[], index: number, currentLow: number): void {
  for (let boxIndex = boxes.length - 1; boxIndex >= 0; boxIndex -= 1) {
    const box = boxes[boxIndex];
    if (box.broken) {
      continue;
    }
    if (currentLow > box.top) {
      markBoxBroken(box, index);
      if (!SHOW_BROKEN) {
        boxes.splice(boxIndex, 1);
      }
      continue;
    }
    box.endIndex = index;
  }
}

function removeNestedBoxes(boxes: BoxState[]): void {
  for (let outer = boxes.length - 1; outer >= 0; outer -= 1) {
    const candidate = boxes[outer];
    if (candidate.broken) {
      continue;
    }
    for (let inner = 0; inner < boxes.length; inner += 1) {
      if (inner === outer) {
        continue;
      }
      const other = boxes[inner];
      if (other.broken) {
        continue;
      }
      if (other.top < candidate.top && other.top > candidate.bottom) {
        boxes.splice(outer, 1);
        break;
      }
    }
  }
}

function limitBoxes(boxes: BoxState[]): void {
  if (!MAX_BOXES || MAX_BOXES <= 0) {
    return;
  }
  while (boxes.length > MAX_BOXES) {
    boxes.shift();
  }
}

function computeFvg(input: IndicatorInput): IndicatorSeriesData[] {
  const count = input.size;
  if (count < 3) {
    return [];
  }

  const highs = Array.from(input.highs, (value) => Number(value));
  const lows = Array.from(input.lows, (value) => Number(value));
  const closes = Array.from(input.closes, (value) => Number(value));

  const atr = atrWithFallback(highs, lows, closes, ATR_PERIOD);

  const startIndex = LOOKBACK && LOOKBACK > 0 ? Math.max(2, count - LOOKBACK) : 2;

  const gapBull: GapEntry[] = [];
  const gapBear: GapEntry[] = [];
  const bullBoxes: BoxState[] = [];
  const bearBoxes: BoxState[] = [];
  const markers: IndicatorMarker[] = [];
  const markerValues = new Array<number>(count).fill(Number.NaN);

  for (let index = 2; index < count; index += 1) {
    const currentHigh = highs[index];
    const currentLow = lows[index];

    if (index >= startIndex) {
      const prevHigh = highs[index - 1];
      const prevLow = lows[index - 1];
      const prev2High = highs[index - 2];
      const prev2Low = lows[index - 2];

      const atrValue = atr[index];
      if (Number.isFinite(atrValue) && atrValue > 0) {
        const filtUp = currentLow > 0 ? ((currentLow - prev2High) / currentLow) * 100 : 0;
        const filtDn = prev2Low > 0 ? ((prev2Low - currentHigh) / prev2Low) * 100 : 0;

        const isBullGap =
          prev2High < currentLow &&
          prev2High < prevHigh &&
          prev2Low < currentLow &&
          filtUp > FILTER_PERCENT;

        const isBearGap =
          prev2Low > currentHigh &&
          prev2Low > prevLow &&
          prev2High > currentHigh &&
          filtDn > FILTER_PERCENT;

        if (isBullGap) {
          const start = Math.max(index - 1, 0);
          const end = Math.min(start + TEMP_BOX_SPAN - 1, count - 1);
          gapBull.push({ start, end, top: currentLow, bottom: prev2High, strength: filtUp });
          const box = new BoxState(prev2High, prev2High - atrValue, start, index, filtUp);
          bullBoxes.push(box);
        }

        if (isBearGap) {
          const start = Math.max(index - 1, 0);
          const end = Math.min(start + TEMP_BOX_SPAN - 1, count - 1);
          gapBear.push({ start, end, top: prev2Low, bottom: currentHigh, strength: filtDn });
          const box = new BoxState(prev2Low + atrValue, prev2Low, start, index, filtDn);
          bearBoxes.push(box);
        }
      }
    }

    updateBullBoxes(bullBoxes, index, currentHigh);
    updateBearBoxes(bearBoxes, index, currentLow);
    removeNestedBoxes(bullBoxes);
    removeNestedBoxes(bearBoxes);
    limitBoxes(bullBoxes);
    limitBoxes(bearBoxes);
  }

  if (count > 0) {
    const lastIndex = count - 1;
    for (const box of bullBoxes) {
      if (box.active) {
        box.endIndex = lastIndex;
      }
    }
    for (const box of bearBoxes) {
      if (box.active) {
        box.endIndex = lastIndex;
      }
    }
  }

  if (LOOKBACK && LOOKBACK > 0) {
    const pruneIndex = Math.max(0, count - LOOKBACK);
    for (let idx = bullBoxes.length - 1; idx >= 0; idx -= 1) {
      if (bullBoxes[idx].endIndex < pruneIndex) {
        bullBoxes.splice(idx, 1);
      }
    }
    for (let idx = bearBoxes.length - 1; idx >= 0; idx -= 1) {
      if (bearBoxes[idx].endIndex < pruneIndex) {
        bearBoxes.splice(idx, 1);
      }
    }
  }

  const results: IndicatorSeriesData[] = [];

  const pushGapSeries = (
    prefix: string,
    entries: GapEntry[],
    brush: string,
    markerTextColor: string,
    markerBackground: string,
    isBullish: boolean
  ) => {
    entries.forEach((entry, index) => {
      const bottomValues = createRangeValues(count, entry.start, entry.end, entry.bottom);
      const bottomSeries = createSeries({
        name: `${prefix} ${index + 1} Bottom`,
        values: bottomValues,
        panel: "overlay",
        color: GAP_LINE_COLOR,
        plotMode: "line",
        width: 1,
        zValue: 4,
      });
      if (!bottomSeries) {
        return;
      }
      results.push(bottomSeries);

      const topValues = createRangeValues(count, entry.start, entry.end, entry.top);
      const topSeries = createSeries({
        name: `${prefix} ${index + 1} Top`,
        values: topValues,
        panel: "overlay",
        color: GAP_LINE_COLOR,
        plotMode: "line",
        width: 1,
        brush,
        fillTarget: bottomSeries.name,
        zValue: 4,
      });
      if (topSeries) {
        results.push(topSeries);
      }

      if (Number.isFinite(entry.strength)) {
        const midpoint = entry.start + Math.max(0, Math.floor((entry.end - entry.start) / 2));
        const centerValue = (entry.top + entry.bottom) / 2;
        markers.push({
          index: midpoint,
          value: centerValue,
          text: formatPercent(entry.strength, isBullish),
          color: GAP_LINE_COLOR,
          textColor: markerTextColor,
          backgroundColor: markerBackground,
          offsetX: 12,
          offsetY: -11,
        });
        if (midpoint >= 0 && midpoint < markerValues.length) {
          markerValues[midpoint] = centerValue;
        }
      }
    });
  };

  pushGapSeries("FVG Gap Bull", gapBull, GAP_BULL_FILL, "#111111", "rgba(255, 255, 255, 0.25)", true);
  pushGapSeries("FVG Gap Bear", gapBear, GAP_BEAR_FILL, "#111111", "rgba(255, 255, 255, 0.25)", false);

  const pushBoxes = (
    prefix: string,
    boxes: BoxState[],
    lineColor: string,
    fillColor: string,
    brokenLineColor: string,
    brokenFillColor: string,
    markerList: IndicatorMarker[],
    isBullish: boolean
  ) => {
    boxes.forEach((box, index) => {
      if (box.broken && !SHOW_BROKEN) {
        return;
      }
      const start = Math.min(box.startIndex, count - 1);
      const end = Math.min(Math.max(box.endIndex, start), count - 1);

      const effectiveLineColor = box.broken ? brokenLineColor : lineColor;
      const effectiveFillColor = box.broken ? brokenFillColor : fillColor;

      const bottomValues = createRangeValues(count, start, end, box.bottom);
      const bottomSeries = createSeries({
        name: `${prefix} ${index + 1} Bottom`,
        values: bottomValues,
        panel: "overlay",
        color: effectiveLineColor,
        plotMode: "line",
        width: 1.4,
        zValue: 8,
      });
      if (!bottomSeries) {
        return;
      }
      results.push(bottomSeries);

      const topValues = createRangeValues(count, start, end, box.top);
      const topSeries = createSeries({
        name: `${prefix} ${index + 1} Top`,
        values: topValues,
        panel: "overlay",
        color: effectiveLineColor,
        plotMode: "line",
        width: 1.4,
        brush: effectiveFillColor,
        fillTarget: bottomSeries.name,
        zValue: 8,
      });
      if (topSeries) {
        results.push(topSeries);
      }

      if (Number.isFinite(box.strength)) {
        const midpoint = start + Math.max(0, Math.floor((end - start) / 2));
        const markerValue = (box.top + box.bottom) / 2;
        markerList.push({
          index: midpoint,
          value: markerValue,
          text: formatPercent(box.strength, isBullish),
          color: effectiveLineColor,
          textColor: "#111111",
          backgroundColor: "rgba(255, 255, 255, 0.15)",
          offsetX: 12,
          offsetY: -11,
        });
        if (midpoint >= 0 && midpoint < markerValues.length) {
          markerValues[midpoint] = markerValue;
        }
      }
    });
  };

  pushBoxes(
    "FVG Bull Block",
    bullBoxes,
    BULL_LINE_COLOR,
    BULL_FILL_COLOR,
    BULL_LINE_COLOR_BROKEN,
    BULL_FILL_COLOR_BROKEN,
    markers,
    true
  );
  pushBoxes(
    "FVG Bear Block",
    bearBoxes,
    BEAR_LINE_COLOR,
    BEAR_FILL_COLOR,
    BEAR_LINE_COLOR_BROKEN,
    BEAR_FILL_COLOR_BROKEN,
    markers,
    false
  );

  if (markers.length > 0) {
    results.push({
      name: "FVG Strength Labels",
      values: markerValues,
      panel: "overlay",
      color: undefined,
      plotMode: "markers",
      markers,
      zValue: 9,
    });
  }

  return results;
}

const compute: IndicatorCompute = (input) => computeFvg(input);

export const fvgDefinitions: IndicatorDefinition[] = [
  {
    key: "fvg_order_blocks",
    name: "FVG Order Blocks",
    category: "Price Action",
    panel: "overlay",
    description: "Fair value gap and order block detection inspired by the Python implementation.",
    isDefault: true,
    compute,
  },
];
