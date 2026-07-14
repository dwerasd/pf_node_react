// @ts-nocheck
import type { IndicatorCompute, IndicatorDefinition } from "./base";
import type { IndicatorMarker, IndicatorSeriesData } from "../types";

const PANEL_KEY = "rsi_divergence";
const RSI_LENGTH = 5;
const LOOKBACK_LEFT = 5;
const LOOKBACK_RIGHT = 0;
const RANGE_MIN = 5;
const RANGE_MAX = 60;

const RSI_OVERBOUGHT = 70;
const RSI_OVERSOLD = 30;
const RSI_NEUTRAL_CEILING = 50;

const COLOR_FUCHSIA = "#ff00ff";
const COLOR_GREEN = "#008000";
const COLOR_PURPLE = "#800080";
const COLOR_RED = "#ff0000";
const COLOR_BLUE = "#0000ff";
const COLOR_TRANSPARENT = "rgba(255, 255, 255, 0)";
const COLOR_BULL = "#00ff00";
const COLOR_BULL_LABEL = "#16a34a";
const COLOR_HIDDEN_BULL = "rgba(22, 101, 52, 0.55)";
const COLOR_BEAR = "#800080";
const COLOR_BEAR_LABEL = "#7c3aed";
const COLOR_HIDDEN_BEAR = "rgba(185, 28, 28, 0.55)";
const COLOR_TEXT = "#ffffff";
const COLOR_TOP_FILL = "rgba(128, 0, 0, 0.15)";
const COLOR_MID_FILL = "rgba(153, 21, 255, 0.08)";
const COLOR_BOTTOM_FILL = "rgba(15, 23, 42, 0.12)";
const COLOR_PIVOT_OUTLINE = "rgba(17, 24, 39, 0.85)";

interface RsiState {
  lastState: 0 | 1 | 2;
  lastColor: string;
  lastHigh: number;
  lastLow: number;
}

interface DivergencePivot {
  index: number;
  rsi: number;
  price: number;
}

function createSeries(params: {
  name: string;
  values: number[];
  panel: string;
  color?: string;
  plotMode?: string;
  width?: number;
  zValue?: number;
  colorValues?: (string | null)[];
  brush?: string;
  fillTarget?: string;
  markers?: IndicatorMarker[];
  stepMode?: boolean;
  symbol?: string;
  symbolSize?: number;
  penStyle?: string;
  xValues?: number[];
}): IndicatorSeriesData | undefined {
  const { values, markers } = params;
  const hasFinite = values.some((value) => Number.isFinite(value)) || Boolean(markers?.length);
  if (!hasFinite) {
    return undefined;
  }

  const series: IndicatorSeriesData = {
    name: params.name,
    values: values.map((value) => (Number.isFinite(value) ? value : Number.NaN)),
    panel: params.panel,
    color: params.color,
    plotMode: params.plotMode,
    width: params.width,
    zValue: params.zValue,
    colorValues: params.colorValues,
    brush: params.brush,
    fillTarget: params.fillTarget,
    markers,
    stepMode: params.stepMode,
  };

  if (params.symbol !== undefined) {
    (series as any).symbol = params.symbol;
  }
  if (params.symbolSize !== undefined) {
    (series as any).symbolSize = params.symbolSize;
  }
  if (params.penStyle !== undefined) {
    (series as any).penStyle = params.penStyle;
  }
  if (params.xValues !== undefined) {
    (series as any).xValues = params.xValues;
  }

  return series;
}

function fillLineSegment(
  values: number[],
  startIndex: number,
  endIndex: number,
  startValue: number,
  endValue: number
): void {
  if (
    !Number.isFinite(startValue) ||
    !Number.isFinite(endValue) ||
    !Number.isFinite(startIndex) ||
    !Number.isFinite(endIndex)
  ) {
    return;
  }

  const begin = Math.trunc(startIndex);
  const finish = Math.trunc(endIndex);
  if (finish < begin || begin < 0 || finish >= values.length) {
    return;
  }

  const span = finish - begin;
  if (span === 0) {
    values[begin] = startValue;
    return;
  }

  for (let offset = 0; offset <= span; offset += 1) {
    const index = begin + offset;
    const ratio = offset / span;
    values[index] = startValue + (endValue - startValue) * ratio;
  }
}

function computeRsi(values: number[], period: number): number[] {
  const size = values.length;
  const result = new Array<number>(size).fill(Number.NaN);
  if (period <= 1 || size <= 1) {
    return result;
  }

  let prev = values[0];
  let gainSum = 0;
  let lossSum = 0;
  let count = 0;
  let avgGain = Number.NaN;
  let avgLoss = Number.NaN;

  for (let idx = 1; idx < size; idx += 1) {
    const current = values[idx];
    if (!Number.isFinite(current) || !Number.isFinite(prev)) {
      prev = current;
      continue;
    }

    const change = current - prev;
    const gain = change > 0 ? change : 0;
    const loss = change < 0 ? -change : 0;

    if (count < period) {
      gainSum += gain;
      lossSum += loss;
      count += 1;
      if (count === period) {
        avgGain = gainSum / period;
        avgLoss = lossSum / period;
        if (avgLoss === 0) {
          result[idx] = 100;
        } else {
          const rs = avgGain / avgLoss;
          result[idx] = 100 - 100 / (1 + rs);
        }
      }
    } else if (Number.isFinite(avgGain) && Number.isFinite(avgLoss)) {
      avgGain = (avgGain * (period - 1) + gain) / period;
      avgLoss = (avgLoss * (period - 1) + loss) / period;
      if (avgLoss === 0) {
        result[idx] = 100;
      } else {
        const rs = avgGain / avgLoss;
        result[idx] = 100 - 100 / (1 + rs);
      }
    }

    prev = current;
  }

  return result;
}

function updateRsiState(state: RsiState, idx: number, high: number, low: number, rsi: number): string {
  const isOverbought = Number.isFinite(rsi) && rsi > RSI_OVERBOUGHT;
  const isOversold = Number.isFinite(rsi) && rsi < RSI_OVERSOLD;

  if (state.lastState === 2 && isOverbought) {
    state.lastHigh = high;
    state.lastColor = COLOR_RED;
  }

  if (state.lastState === 1 && isOversold) {
    state.lastLow = low;
    state.lastColor = COLOR_BLUE;
  }

  if (isOverbought) {
    if (!Number.isFinite(state.lastHigh) || high >= state.lastHigh) {
      state.lastHigh = high;
    }
    state.lastState = 1;
  }

  if (isOversold) {
    if (!Number.isFinite(state.lastLow) || low <= state.lastLow) {
      state.lastLow = low;
    }
    state.lastState = 2;
  }

  if (state.lastState === 1 && Number.isFinite(state.lastHigh) && high >= state.lastHigh) {
    state.lastHigh = high;
  }

  if (state.lastState === 2 && Number.isFinite(state.lastLow) && low <= state.lastLow) {
    state.lastLow = low;
  }

  if (isOverbought) {
    return COLOR_FUCHSIA;
  }
  if (isOversold) {
    return COLOR_GREEN;
  }
  return state.lastColor;
}

function isPivotLow(values: number[], index: number, left: number, right: number): boolean {
  const base = values[index];
  if (!Number.isFinite(base)) {
    return false;
  }
  for (let offset = 1; offset <= left; offset += 1) {
    const compare = values[index - offset];
    if (!Number.isFinite(compare) || compare <= base) {
      return false;
    }
  }
  for (let offset = 1; offset <= right; offset += 1) {
    const compare = values[index + offset];
    if (!Number.isFinite(compare) || compare < base) {
      return false;
    }
  }
  return true;
}

function isPivotHigh(values: number[], index: number, left: number, right: number): boolean {
  const base = values[index];
  if (!Number.isFinite(base)) {
    return false;
  }
  for (let offset = 1; offset <= left; offset += 1) {
    const compare = values[index - offset];
    if (!Number.isFinite(compare) || compare >= base) {
      return false;
    }
  }
  for (let offset = 1; offset <= right; offset += 1) {
    const compare = values[index + offset];
    if (!Number.isFinite(compare) || compare > base) {
      return false;
    }
  }
  return true;
}

const computeRsiDivergence: IndicatorCompute = (input) => {
  const size = input.size;
  if (size === 0) {
    return [];
  }

  const closes = Array.from(input.closes, (value) => Number(value));
  const highs = Array.from(input.highs, (value) => Number(value));
  const lows = Array.from(input.lows, (value) => Number(value));

  const rsiValues = computeRsi(closes, RSI_LENGTH);
  const colorValues = new Array<string | null>(size).fill(null);

  let initialHigh = Number.NaN;
  let initialLow = Number.NaN;
  for (let idx = 0; idx < size; idx += 1) {
    const high = highs[idx];
    const low = lows[idx];
    if (!Number.isFinite(initialHigh) && Number.isFinite(low)) {
      initialHigh = low;
    }
    if (!Number.isFinite(initialLow) && Number.isFinite(high)) {
      initialLow = high;
    }
    if (Number.isFinite(initialHigh) && Number.isFinite(initialLow)) {
      break;
    }
  }

  const state: RsiState = {
    lastState: 0,
    lastColor: COLOR_PURPLE,
    lastHigh: initialHigh,
    lastLow: initialLow,
  };

  for (let idx = 0; idx < size; idx += 1) {
    const rsi = rsiValues[idx];
    const high = highs[idx];
    const low = lows[idx];
    if (!Number.isFinite(high) || !Number.isFinite(low)) {
      colorValues[idx] = state.lastColor;
      continue;
    }
    colorValues[idx] = updateRsiState(state, idx, high, low, rsi);
  }

  const rsiSeries = createSeries({
    name: "RSI Divergence",
    values: rsiValues,
    panel: PANEL_KEY,
    plotMode: "colstep",
    width: 1.4,
    color: "#8e24aa",
    colorValues,
    zValue: 3,
  });

  const constant = (value: number): number[] => new Array<number>(size).fill(value);

  const overboughtSeries = createSeries({
    name: "RSI Divergence Overbought",
    values: constant(RSI_OVERBOUGHT),
    panel: PANEL_KEY,
    color: "rgba(148, 163, 184, 0.65)",
    plotMode: "line",
    width: 1,
    zValue: 0.5,
    penStyle: "dotted",
  });

  const oversoldSeries = createSeries({
    name: "RSI Divergence Oversold",
    values: constant(RSI_OVERSOLD),
    panel: PANEL_KEY,
    color: "rgba(148, 163, 184, 0.65)",
    plotMode: "line",
    width: 1,
    zValue: 0.5,
    penStyle: "dotted",
  });

  if (overboughtSeries) {
    overboughtSeries.fillTarget = "RSI Divergence Oversold";
    overboughtSeries.brush = COLOR_MID_FILL;
  }

  const topBandSeries = createSeries({
    name: "RSI Divergence Top",
    values: constant(100),
    panel: PANEL_KEY,
    color: "rgba(148, 163, 184, 0.35)",
    plotMode: "line",
    width: 1,
    zValue: 0.3,
    fillTarget: "RSI Divergence Overbought",
    brush: COLOR_TOP_FILL,
    penStyle: "dotted",
  });

  const bottomBandSeries = createSeries({
    name: "RSI Divergence Bottom",
    values: constant(0),
    panel: PANEL_KEY,
    color: "rgba(148, 163, 184, 0.35)",
    plotMode: "line",
    width: 1,
    zValue: 0.3,
    penStyle: "dotted",
  });

  if (oversoldSeries) {
    oversoldSeries.fillTarget = "RSI Divergence Bottom";
    oversoldSeries.brush = COLOR_BOTTOM_FILL;
  }

  const pivotLowOutlineMarkers: IndicatorMarker[] = [];
  const pivotLowMarkers: IndicatorMarker[] = [];
  const pivotHighOutlineMarkers: IndicatorMarker[] = [];
  const pivotHighMarkers: IndicatorMarker[] = [];
  const bullMarkers: IndicatorMarker[] = [];
  const hiddenBullMarkers: IndicatorMarker[] = [];
  const bearMarkers: IndicatorMarker[] = [];
  const hiddenBearMarkers: IndicatorMarker[] = [];

  const bullLine = new Array<number>(size).fill(Number.NaN);
  const hiddenBullLine = new Array<number>(size).fill(Number.NaN);
  const bearLine = new Array<number>(size).fill(Number.NaN);
  const hiddenBearLine = new Array<number>(size).fill(Number.NaN);

  let lastLowPivot: DivergencePivot | null = null;
  let lastHighPivot: DivergencePivot | null = null;

  for (let idx = LOOKBACK_LEFT; idx < size - LOOKBACK_RIGHT; idx += 1) {
    const pivotIndex = idx;

    if (isPivotLow(rsiValues, pivotIndex, LOOKBACK_LEFT, LOOKBACK_RIGHT)) {
      const pivotValue = rsiValues[pivotIndex];
      const pivotPrice = lows[pivotIndex];
      if (Number.isFinite(pivotValue) && Number.isFinite(pivotPrice)) {
        const currentPivot: DivergencePivot = {
          index: pivotIndex,
          rsi: pivotValue,
          price: pivotPrice,
        };

        pivotLowOutlineMarkers.push({
          index: pivotIndex,
          value: pivotValue,
          text: "",
          color: COLOR_PIVOT_OUTLINE,
          position: "inBar",
          shape: "circle",
          size: 1,
        });
        pivotLowMarkers.push({
          index: pivotIndex,
          value: pivotValue,
          text: "",
          color: COLOR_BULL,
          position: "inBar",
          shape: "circle",
          size: 0.7,
        });

        if (lastLowPivot) {
          const barsSincePreviousPivot = pivotIndex - lastLowPivot.index - 1;
          if (barsSincePreviousPivot >= RANGE_MIN && barsSincePreviousPivot <= RANGE_MAX) {
            const currentRsi = Number.isFinite(rsiValues[pivotIndex]) ? rsiValues[pivotIndex] : pivotValue;
            const previousRsi = lastLowPivot.rsi;
            const previousPrice = lastLowPivot.price;

            const priceLL = pivotPrice < previousPrice;
            const priceHL = pivotPrice > previousPrice;
            const oscHL = pivotValue > previousRsi;
            const oscLL = pivotValue < previousRsi;

            if (Number.isFinite(currentRsi) && currentRsi <= RSI_NEUTRAL_CEILING) {
              if (priceLL && oscHL) {
                fillLineSegment(bullLine, lastLowPivot.index, pivotIndex, lastLowPivot.rsi, pivotValue);
                bullMarkers.push({
                  index: pivotIndex,
                  value: pivotValue,
                  text: "저점",
                  color: COLOR_TRANSPARENT,
                  position: "inBar",
                  shape: "circle",
                  textColor: COLOR_TEXT,
                  backgroundColor: COLOR_BULL_LABEL,
                  offsetY: 14,
                  offsetX: -6,
                });
              }

              if (priceHL && oscLL) {
                fillLineSegment(hiddenBullLine, lastLowPivot.index, pivotIndex, lastLowPivot.rsi, pivotValue);
                hiddenBullMarkers.push({
                  index: pivotIndex,
                  value: pivotValue,
                  text: "단기저점",
                  color: COLOR_TRANSPARENT,
                  position: "inBar",
                  shape: "circle",
                  textColor: COLOR_TEXT,
                  backgroundColor: COLOR_HIDDEN_BULL,
                  offsetY: 18,
                  offsetX: -18,
                });
              }
            }
          }
        }

        lastLowPivot = currentPivot;
      }
    }

    if (isPivotHigh(rsiValues, pivotIndex, LOOKBACK_LEFT, LOOKBACK_RIGHT)) {
      const pivotValue = rsiValues[pivotIndex];
      const pivotPrice = highs[pivotIndex];
      if (Number.isFinite(pivotValue) && Number.isFinite(pivotPrice)) {
        const currentPivot: DivergencePivot = {
          index: pivotIndex,
          rsi: pivotValue,
          price: pivotPrice,
        };

        pivotHighOutlineMarkers.push({
          index: pivotIndex,
          value: pivotValue,
          text: "",
          color: COLOR_PIVOT_OUTLINE,
          position: "inBar",
          shape: "circle",
          size: 1,
        });
        pivotHighMarkers.push({
          index: pivotIndex,
          value: pivotValue,
          text: "",
          color: COLOR_FUCHSIA,
          position: "inBar",
          shape: "circle",
          size: 0.7,
        });

        if (lastHighPivot) {
          const barsSincePreviousPivot = pivotIndex - lastHighPivot.index - 1;
          if (barsSincePreviousPivot >= RANGE_MIN && barsSincePreviousPivot <= RANGE_MAX) {
            const currentRsi = Number.isFinite(rsiValues[pivotIndex]) ? rsiValues[pivotIndex] : pivotValue;
            const previousRsi = lastHighPivot.rsi;
            const previousPrice = lastHighPivot.price;

            const priceHH = pivotPrice > previousPrice;
            const priceLH = pivotPrice < previousPrice;
            const oscLH = pivotValue < previousRsi;
            const oscHH = pivotValue > previousRsi;

            if (Number.isFinite(currentRsi) && currentRsi >= RSI_NEUTRAL_CEILING) {
              if (priceHH && oscLH) {
                fillLineSegment(bearLine, lastHighPivot.index, pivotIndex, lastHighPivot.rsi, pivotValue);
                bearMarkers.push({
                  index: pivotIndex,
                  value: pivotValue,
                  text: "고점",
                  color: COLOR_TRANSPARENT,
                  position: "inBar",
                  shape: "circle",
                  textColor: COLOR_TEXT,
                  backgroundColor: COLOR_BEAR_LABEL,
                  offsetY: -24,
                  offsetX: -6,
                });
              }

              if (priceLH && oscHH) {
                fillLineSegment(hiddenBearLine, lastHighPivot.index, pivotIndex, lastHighPivot.rsi, pivotValue);
                hiddenBearMarkers.push({
                  index: pivotIndex,
                  value: pivotValue,
                  text: "단기고점",
                  color: COLOR_TRANSPARENT,
                  position: "inBar",
                  shape: "circle",
                  textColor: COLOR_TEXT,
                  backgroundColor: COLOR_HIDDEN_BEAR,
                  offsetY: -30,
                  offsetX: -20,
                });
              }
            }
          }
        }

        lastHighPivot = currentPivot;
      }
    }
  }

  const results: IndicatorSeriesData[] = [];

  if (topBandSeries) {
    results.push(topBandSeries);
  }
  if (overboughtSeries) {
    results.push(overboughtSeries);
  }
  if (oversoldSeries) {
    results.push(oversoldSeries);
  }
  if (bottomBandSeries) {
    results.push(bottomBandSeries);
  }
  if (rsiSeries) {
    results.push(rsiSeries);
  }

  const pushLineSeries = (name: string, values: number[], color: string, zValue: number): void => {
    if (!values.some((value) => Number.isFinite(value))) {
      return;
    }
    const series = createSeries({
      name,
      values,
      panel: PANEL_KEY,
      color,
      plotMode: "line",
      width: 2,
      zValue,
    });
    if (series) {
      results.push(series);
    }
  };

  pushLineSeries("RSI Bullish Divergence", bullLine, COLOR_GREEN, 8.7);
  pushLineSeries("RSI Hidden Bullish Divergence", hiddenBullLine, COLOR_HIDDEN_BULL, 8.6);
  pushLineSeries("RSI Bearish Divergence", bearLine, COLOR_PURPLE, 8.5);
  pushLineSeries("RSI Hidden Bearish Divergence", hiddenBearLine, COLOR_HIDDEN_BEAR, 8.4);

  const pushMarkerSeries = (name: string, markers: IndicatorMarker[], color: string): void => {
    if (markers.length === 0) {
      return;
    }
    const values = new Array<number>(size).fill(Number.NaN);
    const series = createSeries({
      name,
      values,
      panel: PANEL_KEY,
      color,
      plotMode: "markers",
      markers,
      zValue: 5,
    });
    if (series) {
      results.push(series);
    }
  };

  pushMarkerSeries("RSI Pivot Low Outline", pivotLowOutlineMarkers, COLOR_PIVOT_OUTLINE);
  pushMarkerSeries("RSI Pivot Low Highlight", pivotLowMarkers, COLOR_BULL);
  pushMarkerSeries("RSI Pivot High Outline", pivotHighOutlineMarkers, COLOR_PIVOT_OUTLINE);
  pushMarkerSeries("RSI Pivot High Highlight", pivotHighMarkers, COLOR_FUCHSIA);
  pushMarkerSeries("RSI Bull Labels", bullMarkers, COLOR_BULL);
  pushMarkerSeries("RSI Hidden Bull Labels", hiddenBullMarkers, COLOR_HIDDEN_BULL);
  pushMarkerSeries("RSI Bear Labels", bearMarkers, COLOR_BEAR);
  pushMarkerSeries("RSI Hidden Bear Labels", hiddenBearMarkers, COLOR_HIDDEN_BEAR);

  return results;
};

export const rsiDivergenceDefinitions: IndicatorDefinition[] = [
  {
    key: "rsi_divergence",
    name: "RSI 다이버전스",
    category: "Oscillator",
    panel: PANEL_KEY,
    description: "RSI 기반 다이버전스 탐지",
    compute: computeRsiDivergence,
    isDefault: false,
  },
];
