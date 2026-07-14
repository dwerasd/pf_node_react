// @ts-nocheck
import type { IndicatorCompute, IndicatorDefinition } from "./base";
import type { IndicatorSeriesData } from "../types";

const RSI_LENGTH = 5;
const RSI_OVERBOUGHT = 70;
const RSI_OVERSOLD = 30;
const LINE_WIDTH = 3;

const COLOR_UP = "rgba(0, 128, 0, 0.5)";
const COLOR_DOWN = "rgba(255, 0, 0, 0.5)";

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

function computeRsi(values: number[], period: number): number[] {
  const size = values.length;
  const result = new Array<number>(size).fill(Number.NaN);
  if (period <= 0 || size <= 1) {
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

const computeHighLowLinesLegacy: IndicatorCompute = (input) => {
  const size = input.size;
  if (size === 0) {
    return [];
  }

  const highs = Array.from(input.highs, (value) => Number(value));
  const lows = Array.from(input.lows, (value) => Number(value));
  const closes = Array.from(input.closes, (value) => Number(value));
  const rsiValues = computeRsi(closes, RSI_LENGTH);

  const upLine = new Array<number>(size).fill(Number.NaN);
  const downLine = new Array<number>(size).fill(Number.NaN);

  let lastState = 0;
  let lastOverboughtIndex = -1;
  let lastOverboughtPrice = Number.NaN;
  let lastOversoldIndex = -1;
  let lastOversoldPrice = Number.NaN;
  let activeUpStart = -1;
  let activeDownStart = -1;
  let lastUpValue = Number.NaN;
  let lastDownValue = Number.NaN;

  for (let idx = 0; idx < size; idx += 1) {
    const high = highs[idx];
    const low = lows[idx];
    const rsi = rsiValues[idx];

    if (lastState === 1 && Number.isFinite(high)) {
      if (!Number.isFinite(lastOverboughtPrice) || high >= lastOverboughtPrice) {
        lastOverboughtIndex = idx;
        lastOverboughtPrice = high;
        if (activeUpStart >= 0) {
          upLine[idx] = high;
          lastUpValue = high;
        }
      }
    }

    if (lastState === 2 && Number.isFinite(low)) {
      if (!Number.isFinite(lastOversoldPrice) || low <= lastOversoldPrice) {
        lastOversoldIndex = idx;
        lastOversoldPrice = low;
        if (activeDownStart >= 0) {
          downLine[idx] = low;
          lastDownValue = low;
        }
      }
    }

    if (!Number.isFinite(rsi)) {
      continue;
    }

    if (rsi >= RSI_OVERBOUGHT) {
      if (
        lastState === 2 &&
        lastOversoldIndex >= 0 &&
        Number.isFinite(lastOversoldPrice) &&
        Number.isFinite(high)
      ) {
        activeUpStart = lastOversoldIndex;
        upLine[lastOversoldIndex] = lastOversoldPrice;
        upLine[idx] = high;
        lastUpValue = high;
      } else if (
        activeUpStart >= 0 &&
        Number.isFinite(high) &&
        (!Number.isFinite(lastUpValue) || high >= lastUpValue)
      ) {
        upLine[idx] = high;
        lastUpValue = high;
      }

      lastState = 1;
      activeDownStart = -1;
      lastDownValue = Number.NaN;

      if (Number.isFinite(high)) {
        if (!Number.isFinite(lastOverboughtPrice) || high >= lastOverboughtPrice) {
          lastOverboughtIndex = idx;
          lastOverboughtPrice = high;
        }
      }

      continue;
    }

    if (rsi <= RSI_OVERSOLD) {
      if (
        lastState === 1 &&
        lastOverboughtIndex >= 0 &&
        Number.isFinite(lastOverboughtPrice) &&
        Number.isFinite(low)
      ) {
        activeDownStart = lastOverboughtIndex;
        downLine[lastOverboughtIndex] = lastOverboughtPrice;
        downLine[idx] = low;
        lastDownValue = low;
      } else if (
        activeDownStart >= 0 &&
        Number.isFinite(low) &&
        (!Number.isFinite(lastDownValue) || low <= lastDownValue)
      ) {
        downLine[idx] = low;
        lastDownValue = low;
      }

      lastState = 2;
      activeUpStart = -1;
      lastUpValue = Number.NaN;

      if (Number.isFinite(low)) {
        if (!Number.isFinite(lastOversoldPrice) || low <= lastOversoldPrice) {
          lastOversoldIndex = idx;
          lastOversoldPrice = low;
        }
      }
    }
  }

  const results: IndicatorSeriesData[] = [];

  const upSeries = createSeries({
    name: "High Low Line Up",
    values: upLine,
    panel: "overlay",
    color: COLOR_UP,
    plotMode: "line",
    width: LINE_WIDTH,
  });
  if (upSeries) {
    results.push(upSeries);
  }

  const downSeries = createSeries({
    name: "High Low Line Down",
    values: downLine,
    panel: "overlay",
    color: COLOR_DOWN,
    plotMode: "line",
    width: LINE_WIDTH,
  });
  if (downSeries) {
    results.push(downSeries);
  }

  return results;
};

export const highLowLineLegacyDefinitions: IndicatorDefinition[] = [
  {
    key: "high_low_lines_legacy",
    name: "High Low Lines (Legacy)",
    category: "Overlay",
    panel: "overlay",
    description: "Legacy lines based on RSI overbought/oversold transitions with step drawing.",
    compute: computeHighLowLinesLegacy,
    isDefault: false,
  },
];
