// @ts-nocheck
import type { IndicatorCompute, IndicatorDefinition } from "./base";
import type { IndicatorInput, IndicatorSeriesData } from "../types";

const RSI_LENGTH = 5;
const RSI_OVERBOUGHT = 70;
const RSI_OVERSOLD = 30;
const LINE_WIDTH = 3;

const COLOR_UP = "rgba(0, 128, 0, 0.5)";
const COLOR_DOWN = "rgba(255, 0, 0, 0.5)";

interface ColoredSegment {
  startIndex: number;
  startValue: number;
  endIndex: number;
  endValue: number;
  color: string;
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
    colorValues: params.colorValues,
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

function fillSegment(values: number[], colorValues: (string | null)[], segment: ColoredSegment): void {
  const { startIndex, endIndex, startValue, endValue, color } = segment;
  if (
    startIndex < 0 ||
    endIndex < 0 ||
    endIndex < startIndex ||
    !Number.isFinite(startValue) ||
    !Number.isFinite(endValue)
  ) {
    return;
  }

  const span = endIndex - startIndex;
  if (span === 0) {
    values[startIndex] = startValue;
    colorValues[startIndex] = color;
    return;
  }

  for (let offset = 0; offset <= span; offset += 1) {
    const index = startIndex + offset;
    const ratio = offset / span;
    values[index] = startValue + (endValue - startValue) * ratio;
    colorValues[index] = color;
  }
}

const computeHighLowLines: IndicatorCompute = (input) => {
  const size = input.size;
  if (size === 0) {
    return [];
  }

  const highs = Array.from(input.highs, (value) => Number(value));
  const lows = Array.from(input.lows, (value) => Number(value));
  const closes = Array.from(input.closes, (value) => Number(value));
  const rsiValues = computeRsi(closes, RSI_LENGTH);

  const segments: ColoredSegment[] = [];
  let currentSegment: ColoredSegment | null = null;
  let currentState = 0;
  let lastExtreme: { type: 1 | 2; index: number; price: number } | null = null;

  const startNewState = (type: 1 | 2, index: number, price: number): void => {
    const priceFinite = Number.isFinite(price);
    if (
      lastExtreme &&
      lastExtreme.type !== type &&
      Number.isFinite(lastExtreme.price) &&
      priceFinite
    ) {
      const segment: ColoredSegment = {
        startIndex: lastExtreme.index,
        startValue: lastExtreme.price,
        endIndex: index,
        endValue: price,
        color: type === 1 ? COLOR_UP : COLOR_DOWN,
      };
      segments.push(segment);
      currentSegment = segment;
    } else {
      currentSegment = null;
    }

    currentState = type;
    lastExtreme = priceFinite ? { type, index, price } : null;
  };

  const extendState = (type: 1 | 2, index: number, price: number): void => {
    if (!Number.isFinite(price)) {
      return;
    }

    if (!lastExtreme || lastExtreme.type !== type) {
      lastExtreme = { type, index, price };
    } else if (type === 1) {
      if (price >= lastExtreme.price) {
        lastExtreme.index = index;
        lastExtreme.price = price;
      }
    } else if (price <= lastExtreme.price) {
      lastExtreme.index = index;
      lastExtreme.price = price;
    }

    if (!currentSegment || currentSegment.color !== (type === 1 ? COLOR_UP : COLOR_DOWN)) {
      return;
    }

    if (type === 1) {
      if (price >= currentSegment.endValue) {
        currentSegment.endIndex = index;
        currentSegment.endValue = price;
      }
    } else if (price <= currentSegment.endValue) {
      currentSegment.endIndex = index;
      currentSegment.endValue = price;
    }
  };

  for (let idx = 0; idx < size; idx += 1) {
    const high = highs[idx];
    const low = lows[idx];
    const rsi = rsiValues[idx];

    const isOverbought = Number.isFinite(rsi) && rsi >= RSI_OVERBOUGHT;
    const isOversold = Number.isFinite(rsi) && rsi <= RSI_OVERSOLD;

    if (isOverbought) {
      if (currentState === 1) {
        extendState(1, idx, high);
      } else {
        startNewState(1, idx, high);
      }
      continue;
    }

    if (isOversold) {
      if (currentState === 2) {
        extendState(2, idx, low);
      } else {
        startNewState(2, idx, low);
      }
      continue;
    }

    if (currentState === 1) {
      extendState(1, idx, high);
    } else if (currentState === 2) {
      extendState(2, idx, low);
    }
  }

  if (segments.length === 0) {
    return [];
  }

  const baseValues = new Array<number>(size).fill(Number.NaN);
  const colorValues = new Array<(string | null)>(size).fill(null);

  segments.forEach((segment) => fillSegment(baseValues, colorValues, segment));

  const lineSeries = createSeries({
    name: "High Low Line",
    values: baseValues,
    panel: "overlay",
    color: COLOR_UP,
    plotMode: "line",
    width: LINE_WIDTH,
    colorValues,
  });

  return lineSeries ? [lineSeries] : [];
};

export const highLowLineDefinitions: IndicatorDefinition[] = [
  {
    key: "high_low_lines",
    name: "High Low Lines",
    category: "Overlay",
    panel: "overlay",
    description: "Lines based on RSI overbought and oversold transitions.",
    compute: computeHighLowLines,
    isDefault: false,
  },
];
