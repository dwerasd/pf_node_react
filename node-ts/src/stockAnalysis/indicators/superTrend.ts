// @ts-nocheck
import type { IndicatorCompute, IndicatorDefinition } from "./base";
import type { IndicatorInput, IndicatorSeriesData } from "../types";
import { atrTalib } from "./talibAdapters";

const ATR_PERIOD = 14;
const ATR_MULTIPLIER = 3;
const CHANGE_ATR_METHOD = false;
const SHOW_SIGNALS = false;
const SHOW_ST_LINES = true;
const SHOW_HIDDEN_ST_LINES = true;

const UP_ACTIVE_COLOR = "#00b894";
const UP_INACTIVE_COLOR = "rgba(0, 184, 148, 0.27)";
const DOWN_ACTIVE_COLOR = "#d63031";
const DOWN_INACTIVE_COLOR = "rgba(214, 48, 49, 0.27)";
const UP_FLAT_ACTIVE_COLOR = "#001f5c";
const UP_FLAT_INACTIVE_COLOR = "rgba(0, 31, 92, 0.55)";
const DOWN_FLAT_ACTIVE_COLOR = "#ff00ff";
const DOWN_FLAT_INACTIVE_COLOR = "rgba(255, 0, 255, 0.55)";
const SIGN_BUY_COLOR = "rgba(0, 200, 140, 0.75)";
const SIGN_SELL_COLOR = "rgba(214, 48, 49, 0.75)";

interface SuperTrendState {
  upLevel: number;
  downLevel: number;
  trend: number;
  upCapLevel: number;
  downCapLevel: number;
  confirmedTrend: number;
  upActive: boolean;
  downActive: boolean;
  upWidth: number;
  downWidth: number;
}

function createInitialState(): SuperTrendState {
  return {
    upLevel: Number.NaN,
    downLevel: Number.NaN,
    trend: 1,
    upCapLevel: Number.NaN,
    downCapLevel: Number.NaN,
    confirmedTrend: 1,
    upActive: false,
    downActive: false,
    upWidth: 1,
    downWidth: 1,
  };
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
    result[idx] = Math.max(high - low, Math.abs(high - prevClose), Math.abs(low - prevClose));
    prevClose = closes[idx];
  }
  return result;
}

function sma(values: number[], period: number): number[] {
  const result = new Array(values.length).fill(Number.NaN);
  if (period <= 0 || values.length < period) {
    return result;
  }
  let windowSum = 0;
  let count = 0;
  for (let idx = 0; idx < values.length; idx += 1) {
    const value = values[idx];
    if (Number.isFinite(value)) {
      windowSum += value;
      count += 1;
    }
    if (idx >= period) {
      const drop = values[idx - period];
      if (Number.isFinite(drop)) {
        windowSum -= drop;
        count -= 1;
      }
    }
    if (idx >= period - 1 && count > 0) {
      result[idx] = windowSum / count;
    }
  }
  return result;
}

function rma(values: number[], period: number): number[] {
  const result = new Array(values.length).fill(Number.NaN);
  if (period <= 0 || values.length === 0) {
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
    if (idx >= period - 1) {
      result[idx] = prev;
    }
  }
  return result;
}

function computeAtr(highs: number[], lows: number[], closes: number[], period: number): number[] {
  if (!CHANGE_ATR_METHOD) {
    try {
      const values = atrTalib(highs, lows, closes, period);
      if (values.some((value) => Number.isFinite(value))) {
        return values;
      }
    } catch (error) {
      console.warn("[Supertrend] TA-Lib ATR 호출 실패, 기본 계산으로 대체합니다.", error);
    }
  }

  const tr = trueRange(highs, lows, closes);
  if (CHANGE_ATR_METHOD) {
    return rma(tr, period);
  }
  return sma(tr, period);
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
  symbol?: string;
  symbolSize?: number;
  colorValues?: (string | null)[];
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
    symbol: params.symbol,
    symbolSize: params.symbolSize,
    colorValues: params.colorValues,
  };
}

function widthMask(
  base: number[],
  widthValues: number[],
  threshold: number,
  activeFlags: boolean[],
): number[] {
  return base.map((value, idx) => {
    return widthValues[idx] >= threshold && activeFlags[idx] && Number.isFinite(value) ? value : Number.NaN;
  });
}

function computeSupertrend(input: IndicatorInput): IndicatorSeriesData[] {
  const count = input.size;
  if (count === 0) {
    return [];
  }

  const indices = Array.from(input.indices, (value) => Number(value));
  const opens = Array.from(input.opens, (value) => Number(value));
  const highs = Array.from(input.highs, (value) => Number(value));
  const lows = Array.from(input.lows, (value) => Number(value));
  const closes = Array.from(input.closes, (value) => Number(value));

  const oc2 = opens.map((open, idx) => (open + closes[idx]) * 0.5);
  const atr = computeAtr(highs, lows, closes, ATR_PERIOD);

  const up = new Array<number>(count).fill(Number.NaN);
  const down = new Array<number>(count).fill(Number.NaN);
  const trend = new Array<number>(count).fill(1);
  const changeCond = new Array<boolean>(count).fill(false);

  const upFlat = new Array<number>(count).fill(Number.NaN);
  const downFlat = new Array<number>(count).fill(Number.NaN);
  const upActiveFlags = new Array<boolean>(count).fill(false);
  const downActiveFlags = new Array<boolean>(count).fill(false);
  const upWidthValues = new Array<number>(count).fill(1);
  const downWidthValues = new Array<number>(count).fill(1);

  const state = createInitialState();

  for (let idx = 0; idx < count; idx += 1) {
    const atrValue = atr[idx];
    const price = oc2[idx];

    if (!Number.isFinite(atrValue) || !Number.isFinite(price)) {
      if (idx > 0) {
        trend[idx] = trend[idx - 1];
        up[idx] = up[idx - 1];
        down[idx] = down[idx - 1];
        changeCond[idx] = false;
      }
      continue;
    }

    let upCandidate = price - ATR_MULTIPLIER * atrValue;
    let downCandidate = price + ATR_MULTIPLIER * atrValue;

    if (idx > 0) {
      const prevUp = Number.isFinite(up[idx - 1]) ? up[idx - 1] : upCandidate;
      const prevDown = Number.isFinite(down[idx - 1]) ? down[idx - 1] : downCandidate;
      if (highs[idx - 1] > prevUp) {
        upCandidate = Math.max(upCandidate, prevUp);
      }
      if (lows[idx - 1] < prevDown) {
        downCandidate = Math.min(downCandidate, prevDown);
      }
    }

    up[idx] = upCandidate;
    down[idx] = downCandidate;

    const prevTrend = idx > 0 ? trend[idx - 1] : state.trend;
    const upPrev = idx > 0 && Number.isFinite(up[idx - 1]) ? up[idx - 1] : upCandidate;
    const downPrev = idx > 0 && Number.isFinite(down[idx - 1]) ? down[idx - 1] : downCandidate;

    let currentTrend = prevTrend;
    if (prevTrend === -1 && lows[idx] > downPrev) {
      currentTrend = 1;
    } else if (prevTrend === 1 && highs[idx] < upPrev) {
      currentTrend = -1;
    }
    trend[idx] = currentTrend;
    changeCond[idx] = idx > 0 && currentTrend !== prevTrend;

    if (!Number.isFinite(state.upCapLevel) && !Number.isFinite(state.downCapLevel)) {
      state.confirmedTrend = currentTrend;
      if (currentTrend === 1) {
        state.upCapLevel = upCandidate;
        state.upActive = true;
        state.downActive = false;
      } else {
        state.downCapLevel = downCandidate;
        state.downActive = true;
        state.upActive = false;
      }
    }

    if (changeCond[idx]) {
      state.confirmedTrend = currentTrend;
      if (currentTrend === 1) {
        state.upCapLevel = upCandidate;
      } else {
        state.downCapLevel = downCandidate;
      }
      state.upActive = currentTrend === 1;
      state.downActive = currentTrend === -1;
    }

    if (
      state.confirmedTrend === 1 &&
      Number.isFinite(state.upCapLevel) &&
      closes[idx] < state.upCapLevel
    ) {
      state.confirmedTrend = -1;
      state.downCapLevel = downCandidate;
      state.upActive = false;
      state.downActive = true;
    } else if (
      state.confirmedTrend === -1 &&
      Number.isFinite(state.downCapLevel) &&
      closes[idx] > state.downCapLevel
    ) {
      state.confirmedTrend = 1;
      state.upCapLevel = upCandidate;
      state.upActive = true;
      state.downActive = false;
    }

  const upLevel = state.upCapLevel > 0 ? state.upCapLevel : Number.NaN;
  const downLevel = state.downCapLevel > 0 ? state.downCapLevel : Number.NaN;

    upFlat[idx] = upLevel;
    downFlat[idx] = downLevel;
  upActiveFlags[idx] = state.upActive && Number.isFinite(upLevel);
  downActiveFlags[idx] = state.downActive && Number.isFinite(downLevel);

    if (idx > 0 && Number.isFinite(upFlat[idx]) && Number.isFinite(upFlat[idx - 1])) {
      if (upFlat[idx] > upFlat[idx - 1]) {
        state.upWidth += 1;
      } else if (upFlat[idx] < upFlat[idx - 1]) {
        state.upWidth = 1;
      }
    } else {
      state.upWidth = 1;
    }

    if (idx > 0 && Number.isFinite(downFlat[idx]) && Number.isFinite(downFlat[idx - 1])) {
      if (downFlat[idx] < downFlat[idx - 1]) {
        state.downWidth += 1;
      } else if (downFlat[idx] > downFlat[idx - 1]) {
        state.downWidth = 1;
      }
    } else {
      state.downWidth = 1;
    }

    state.upWidth = Math.min(state.upWidth, 5);
    state.downWidth = Math.min(state.downWidth, 5);
    upWidthValues[idx] = state.upWidth;
    downWidthValues[idx] = state.downWidth;
  }

  const trendPrev = trend.map((value, idx) => (idx === 0 ? value : trend[idx - 1]));
  const buyMask = trend.map((value, idx) => value === 1 && trendPrev[idx] === -1);
  const sellMask = trend.map((value, idx) => value === -1 && trendPrev[idx] === 1);

  const upSeriesBase = up.map((value, idx) => {
    if (!(value > 0)) {
      return Number.NaN;
    }
    if (trend[idx] === 1) {
      return value;
    }
    return SHOW_HIDDEN_ST_LINES ? value : Number.NaN;
  });
  const upSeriesColors = up.map((value, idx) => {
    if (!(value > 0)) {
      return null;
    }
    if (trend[idx] === 1) {
      return UP_ACTIVE_COLOR;
    }
    return SHOW_HIDDEN_ST_LINES ? UP_INACTIVE_COLOR : null;
  });

  const downSeriesBase = down.map((value, idx) => {
    if (!(value > 0)) {
      return Number.NaN;
    }
    if (trend[idx] === -1) {
      return value;
    }
    return SHOW_HIDDEN_ST_LINES ? value : Number.NaN;
  });
  const downSeriesColors = down.map((value, idx) => {
    if (!(value > 0)) {
      return null;
    }
    if (trend[idx] === -1) {
      return DOWN_ACTIVE_COLOR;
    }
    return SHOW_HIDDEN_ST_LINES ? DOWN_INACTIVE_COLOR : null;
  });

  const buyValues = up.map((value, idx) => (buyMask[idx] && value > 0 ? value : Number.NaN));
  const sellValues = down.map((value, idx) => (sellMask[idx] && value > 0 ? value : Number.NaN));

  const upFlatBase = upFlat.map((value) => (Number.isFinite(value) ? value : Number.NaN));
  const upFlatColors = upFlat.map((value, idx) => {
    if (!Number.isFinite(value)) {
      return null;
    }
    return upActiveFlags[idx] ? UP_FLAT_ACTIVE_COLOR : UP_FLAT_INACTIVE_COLOR;
  });

  const downFlatBase = downFlat.map((value) => (Number.isFinite(value) ? value : Number.NaN));
  const downFlatColors = downFlat.map((value, idx) => {
    if (!Number.isFinite(value)) {
      return null;
    }
    return downActiveFlags[idx] ? DOWN_FLAT_ACTIVE_COLOR : DOWN_FLAT_INACTIVE_COLOR;
  });

  const upFlatWidthSeries: Record<number, number[]> = {};
  const downFlatWidthSeries: Record<number, number[]> = {};

  for (let level = 2; level <= 5; level += 1) {
    upFlatWidthSeries[level] = widthMask(upFlat, upWidthValues, level, upActiveFlags);
    downFlatWidthSeries[level] = widthMask(downFlat, downWidthValues, level, downActiveFlags);
  }

  const results: IndicatorSeriesData[] = [];

  if (SHOW_ST_LINES) {
    const upSeriesData = createSeries({
      name: "Supertrend Up",
      values: upSeriesBase,
      panel: "overlay",
      color: UP_ACTIVE_COLOR,
      colorValues: upSeriesColors,
      plotMode: "line",
      width: 2,
      zValue: 7,
    });
    if (upSeriesData) {
      results.push(upSeriesData);
    }

    const downSeriesData = createSeries({
      name: "Supertrend Down",
      values: downSeriesBase,
      panel: "overlay",
      color: DOWN_ACTIVE_COLOR,
      colorValues: downSeriesColors,
      plotMode: "line",
      width: 2,
      zValue: 7,
    });
    if (downSeriesData) {
      results.push(downSeriesData);
    }
  }

  if (SHOW_SIGNALS) {
    const buySeries = createSeries({
      name: "Supertrend Buy",
      values: buyValues,
      panel: "overlay",
      color: SIGN_BUY_COLOR,
      plotMode: "scatter",
      symbol: "t1",
      symbolSize: 9,
      brush: SIGN_BUY_COLOR,
      zValue: 9,
    });
    if (buySeries) {
      results.push(buySeries);
    }

    const sellSeries = createSeries({
      name: "Supertrend Sell",
      values: sellValues,
      panel: "overlay",
      color: SIGN_SELL_COLOR,
      plotMode: "scatter",
      symbol: "t",
      symbolSize: 9,
      brush: SIGN_SELL_COLOR,
      zValue: 9,
    });
    if (sellSeries) {
      results.push(sellSeries);
    }
  }

  const upFlatSeries = createSeries({
    name: "Supertrend Up Flat",
    values: upFlatBase,
    panel: "overlay",
    color: UP_FLAT_ACTIVE_COLOR,
    colorValues: upFlatColors,
    plotMode: "line",
    width: 1,
    zValue: 6.5,
  });
  if (upFlatSeries) {
    results.push(upFlatSeries);
  }

  const downFlatSeries = createSeries({
    name: "Supertrend Down Flat",
    values: downFlatBase,
    panel: "overlay",
    color: DOWN_FLAT_ACTIVE_COLOR,
    colorValues: downFlatColors,
    plotMode: "line",
    width: 1,
    zValue: 6.5,
  });
  if (downFlatSeries) {
    results.push(downFlatSeries);
  }

  for (let level = 2; level <= 5; level += 1) {
    const upSeries = createSeries({
      name: `Supertrend Up Flat +${level}`,
      values: upFlatWidthSeries[level],
      panel: "overlay",
      color: UP_FLAT_ACTIVE_COLOR,
      plotMode: "line",
      width: level,
      zValue: 6.6 + level * 0.01,
    });
    if (upSeries) {
      results.push(upSeries);
    }

    const downSeries = createSeries({
      name: `Supertrend Down Flat +${level}`,
      values: downFlatWidthSeries[level],
      panel: "overlay",
      color: DOWN_FLAT_ACTIVE_COLOR,
      plotMode: "line",
      width: level,
      zValue: 6.6 + level * 0.01,
    });
    if (downSeries) {
      results.push(downSeries);
    }
  }

  return results;
}

const compute: IndicatorCompute = (input) => computeSupertrend(input);

export const superTrendDefinitions: IndicatorDefinition[] = [
  {
    key: "supertrend",
    name: "Supertrend",
    category: "Overlay",
    panel: "overlay",
    description: "Supertrend with flat-line capture and buy/sell markers.",
    isDefault: true,
    compute,
  },
];
