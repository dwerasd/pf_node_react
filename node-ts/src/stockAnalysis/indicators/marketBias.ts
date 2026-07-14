// @ts-nocheck
import type { IndicatorDefinition, IndicatorCompute } from "./base";
import type { IndicatorInput, IndicatorSeriesData } from "../types";

const HA_LENGTH = 200;
const HA_SMOOTH_LENGTH = 50;
const OSC_LENGTH = 7;
const WMA_LENGTH = 200;
const DARK_TRANSP = 50;
const LIGHT_TRANSP = 80;

const COLOR_LIME: readonly [number, number, number] = [0, 255, 0];
const COLOR_RED: readonly [number, number, number] = [255, 0, 0];
const COLOR_ORANGE: readonly [number, number, number] = [255, 165, 0];

function ema(values: Float64Array, period: number): Float64Array {
  const result = new Float64Array(values.length).fill(Number.NaN);
  if (period <= 1) {
    for (let idx = 0; idx < values.length; idx += 1) {
      result[idx] = values[idx];
    }
    return result;
  }
  const alpha = 2 / (period + 1);
  let emaVal = Number.NaN;
  for (let idx = 0; idx < values.length; idx += 1) {
    const value = values[idx];
    if (!Number.isFinite(value)) {
      // NaN 유지
      continue;
    }
    if (Number.isNaN(emaVal)) {
      emaVal = value;
    } else {
      emaVal = emaVal + alpha * (value - emaVal);
    }
    result[idx] = emaVal;
  }
  return result;
}

function wma(values: Float64Array, period: number): Float64Array {
  const result = new Float64Array(values.length).fill(Number.NaN);
  if (period <= 1) {
    for (let idx = 0; idx < values.length; idx += 1) {
      result[idx] = values[idx];
    }
    return result;
  }
  const weights = new Float64Array(period);
  for (let idx = 0; idx < period; idx += 1) {
    weights[idx] = idx + 1;
  }
  const denom = weights.reduce((sum, value) => sum + value, 0);
  if (denom === 0) {
    return result;
  }

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

function transpToAlpha(transp: number): number {
  const value = Math.max(0, Math.min(Math.trunc(transp), 100));
  return Math.round(((100 - value) * 255) / 100);
}

function rgba(base: readonly [number, number, number], alpha: number): [number, number, number, number] {
  return [base[0], base[1], base[2], alpha];
}

function rgbaCss(color: [number, number, number, number]): string {
  const [r, g, b, a] = color;
  const opacity = Math.max(0, Math.min(a / 255, 1));
  return `rgba(${r}, ${g}, ${b}, ${opacity.toFixed(3)})`;
}

function createSeries(params: {
  name: string;
  values: Float64Array;
  panel: string;
  color?: string;
  plotMode?: string;
  width?: number;
  brush?: string;
  fillTarget?: string;
  zValue?: number;
  colorValues?: (string | null)[];
}): IndicatorSeriesData | undefined {
  const finite = Array.from(params.values).some((value) => Number.isFinite(value));
  if (!finite) {
    return undefined;
  }
  return {
    name: params.name,
    values: Array.from(params.values, (value) => (Number.isFinite(value) ? value : Number.NaN)),
    panel: params.panel,
    color: params.color,
    plotMode: params.plotMode,
    width: params.width,
    brush: params.brush,
    fillTarget: params.fillTarget,
    zValue: params.zValue,
    colorValues: params.colorValues ?? undefined
  };
}

function computeMarketBias(input: IndicatorInput): IndicatorSeriesData[] {
  const { size } = input;
  if (size === 0) {
    return [];
  }

  const o = ema(input.opens, HA_LENGTH);
  const c = ema(input.closes, HA_LENGTH);
  const h = ema(input.highs, HA_LENGTH);
  const l = ema(input.lows, HA_LENGTH);

  const haclose = new Float64Array(size);
  for (let idx = 0; idx < size; idx += 1) {
    haclose[idx] = (o[idx] + h[idx] + l[idx] + c[idx]) / 4;
  }

  const haopen = new Float64Array(size).fill(Number.NaN);
  if (size > 0) {
    haopen[0] = (o[0] + c[0]) / 2;
  }
  for (let idx = 1; idx < size; idx += 1) {
    const prevOpen = haopen[idx - 1];
    const prevClose = haclose[idx - 1];
    if (Number.isFinite(prevOpen) && Number.isFinite(prevClose)) {
      haopen[idx] = (prevOpen + prevClose) / 2;
    } else {
      haopen[idx] = (o[idx] + c[idx]) / 2;
    }
  }

  const hahigh = new Float64Array(size);
  const halow = new Float64Array(size);
  for (let idx = 0; idx < size; idx += 1) {
    hahigh[idx] = Math.max(h[idx], haopen[idx], haclose[idx]);
    halow[idx] = Math.min(l[idx], haopen[idx], haclose[idx]);
  }

  const o2 = ema(haopen, HA_SMOOTH_LENGTH);
  const c2 = ema(haclose, HA_SMOOTH_LENGTH);
  const h2 = ema(hahigh, HA_SMOOTH_LENGTH);
  const l2 = ema(halow, HA_SMOOTH_LENGTH);

  const mbAvg = new Float64Array(size);
  for (let idx = 0; idx < size; idx += 1) {
    mbAvg[idx] = (h2[idx] + l2[idx]) / 2;
  }

  const oscBias = new Float64Array(size);
  for (let idx = 0; idx < size; idx += 1) {
    oscBias[idx] = 100 * (c2[idx] - o2[idx]);
  }
  const oscSmooth = ema(oscBias, OSC_LENGTH);

  const wma200 = wma(input.closes, WMA_LENGTH);
  const wma200Prev = new Float64Array(size).fill(Number.NaN);
  for (let idx = 1; idx < size; idx += 1) {
    wma200Prev[idx] = wma200[idx - 1];
  }

  const darkAlpha = transpToAlpha(DARK_TRANSP);
  const lightAlpha = transpToAlpha(LIGHT_TRANSP);

  const upward: boolean[] = new Array(size);
  const downward: boolean[] = new Array(size);
  const biasGeSmooth: boolean[] = new Array(size);
  const biasLtSmooth: boolean[] = new Array(size);
  const wmaFalling: boolean[] = new Array(size);
  const wmaRising: boolean[] = new Array(size);

  for (let idx = 0; idx < size; idx += 1) {
    upward[idx] = oscBias[idx] > 0;
    downward[idx] = oscBias[idx] < 0;
    biasGeSmooth[idx] = oscBias[idx] >= oscSmooth[idx];
    biasLtSmooth[idx] = oscBias[idx] < oscSmooth[idx];
    wmaFalling[idx] = wma200[idx] <= wma200Prev[idx];
    wmaRising[idx] = wma200[idx] >= wma200Prev[idx];
  }

  const maskAnd = (...conditions: boolean[][]): boolean[] => {
    const mask = new Array(size).fill(true);
    for (let idx = 0; idx < size; idx += 1) {
      let value = true;
      for (const condition of conditions) {
        value = value && condition[idx];
        if (!value) {
          break;
        }
      }
      mask[idx] = value;
    }
    return mask;
  };

  const results: IndicatorSeriesData[] = [];

  const emitFill = (
    prefix: string,
    mask: boolean[],
    brush: [number, number, number, number]
  ) => {
    const brushCss = rgbaCss(brush);
    const top = new Float64Array(size).fill(Number.NaN);
    const bottom = new Float64Array(size).fill(Number.NaN);
    let hasData = false;
    for (let idx = 0; idx < size; idx += 1) {
      if (mask[idx]) {
        top[idx] = h2[idx];
        bottom[idx] = l2[idx];
        hasData = true;
      }
    }
    if (!hasData) {
      return;
    }
    const bottomSeries = createSeries({
      name: `${prefix} Bottom`,
      values: bottom,
      panel: "overlay",
      color: "rgba(0,0,0,0)",
      plotMode: "line",
      width: 0.1,
      zValue: 5
    });
    if (!bottomSeries) {
      return;
    }
    results.push(bottomSeries);

    const topSeries = createSeries({
      name: `${prefix} Top`,
      values: top,
      panel: "overlay",
      color: "rgba(0,0,0,0)",
      plotMode: "line",
      width: 0.1,
      brush: brushCss,
      fillTarget: bottomSeries.name,
      zValue: 5
    });
    if (topSeries) {
      results.push(topSeries);
    }
  };

  emitFill("Market Bias Fill Strong Up Orange", maskAnd(upward, biasGeSmooth, wmaFalling), rgba(COLOR_ORANGE, darkAlpha));
  emitFill(
    "Market Bias Fill Strong Up Lime",
    maskAnd(upward, biasGeSmooth, invertMask(wmaFalling)),
    rgba(COLOR_LIME, darkAlpha)
  );
  emitFill("Market Bias Fill Weak Up Orange", maskAnd(upward, biasLtSmooth, wmaFalling), rgba(COLOR_ORANGE, lightAlpha));
  emitFill(
    "Market Bias Fill Weak Up Lime",
    maskAnd(upward, biasLtSmooth, invertMask(wmaFalling)),
    rgba(COLOR_LIME, lightAlpha)
  );
  emitFill("Market Bias Fill Strong Down Orange", maskAnd(downward, biasGeSmooth, wmaRising), rgba(COLOR_ORANGE, darkAlpha));
  emitFill(
    "Market Bias Fill Strong Down Red",
    maskAnd(downward, biasGeSmooth, invertMask(wmaRising)),
    rgba(COLOR_RED, darkAlpha)
  );
  emitFill("Market Bias Fill Weak Down Orange", maskAnd(downward, biasLtSmooth, wmaRising), rgba(COLOR_ORANGE, lightAlpha));
  emitFill(
    "Market Bias Fill Weak Down Red",
    maskAnd(downward, biasLtSmooth, invertMask(wmaRising)),
    rgba(COLOR_RED, lightAlpha)
  );

  // Color series for lines - based on candle direction (현재 close vs 이전 close)
  // 원본 plotcandle의 col 로직: o2 > c2 ? col_bear : col_bull
  // 하지만 스무딩된 하이킨 아시에서는 o2 < c2가 대부분이므로
  // 대안: 현재 c2 vs 이전 c2로 방향 판단
  const lineColors: string[] = new Array(size);
  const defaultLineColor = `rgba(${COLOR_LIME[0]}, ${COLOR_LIME[1]}, ${COLOR_LIME[2]}, 1.0)`;

  for (let idx = 0; idx < size; idx += 1) {
    let isBearish: boolean;
    if (idx > 0) {
      isBearish = c2[idx] < c2[idx - 1]; // 이전 c2보다 작으면 하락
    } else {
      isBearish = o2[idx] > c2[idx]; // 첫 봉은 원본 로직 사용
    }

    if (isBearish) {
      // 하락: red
      lineColors[idx] = `rgba(${COLOR_RED[0]}, ${COLOR_RED[1]}, ${COLOR_RED[2]}, 1.0)`;
    } else {
      // 상승: lime
      lineColors[idx] = `rgba(${COLOR_LIME[0]}, ${COLOR_LIME[1]}, ${COLOR_LIME[2]}, 1.0)`;
    }
  }

  const highSeries = createSeries({
    name: "Market Bias High",
    values: h2,
    panel: "overlay",
    color: defaultLineColor,
    plotMode: "colstep",
    width: 1,
    zValue: 5.6,
    colorValues: lineColors
  });
  if (highSeries) {
    results.push(highSeries);
  }

  const lowSeries = createSeries({
    name: "Market Bias Low",
    values: l2,
    panel: "overlay",
    color: defaultLineColor,
    plotMode: "colstep",
    width: 1,
    zValue: 5.6,
    colorValues: lineColors
  });
  if (lowSeries) {
    results.push(lowSeries);
  }

  const avgSeries = createSeries({
    name: "Market Bias Average",
    values: mbAvg,
    panel: "overlay",
    color: defaultLineColor,
    plotMode: "colstep",
    width: 1.2,
    zValue: 5.8,
    colorValues: lineColors
  });
  if (avgSeries) {
    results.push(avgSeries);
  }

  return results;
}

function invertMask(mask: boolean[]): boolean[] {
  return mask.map((value) => !value);
}

const compute: IndicatorCompute = (input: IndicatorInput) => computeMarketBias(input);

export const marketBiasDefinitions: IndicatorDefinition[] = [
  {
    key: "market_bias",
    name: "Market Bias",
    category: "Overlay",
    panel: "overlay",
    description: "Market Bias overlay converted from Python implementation",
    isDefault: false,
    compute
  }
];
