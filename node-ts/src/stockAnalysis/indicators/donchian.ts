// @ts-nocheck
import type { IndicatorCompute, IndicatorDefinition } from "./base";
import type { IndicatorInput, IndicatorSeriesData } from "../types";

const LENGTH_UP = 26;
const LENGTH_DOWN = 9;

const COLOR_ORANGE = "#ffa500";
const COLOR_BLACK = "#000000";

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

function computeDonchianChannel(input: IndicatorInput): IndicatorSeriesData[] {
  const size = input.size;
  if (size === 0) {
    return [];
  }

  const opens = Array.from(input.opens, (value) => Number(value));
  const closes = Array.from(input.closes, (value) => Number(value));

  const upperBody = new Array<number>(size).fill(Number.NaN);
  const lowerBody = new Array<number>(size).fill(Number.NaN);
  for (let idx = 0; idx < size; idx += 1) {
    const open = opens[idx];
    const close = closes[idx];
    if (!Number.isFinite(open) || !Number.isFinite(close)) {
      continue;
    }
    upperBody[idx] = Math.max(open, close);
    lowerBody[idx] = Math.min(open, close);
  }

  const upper = new Array<number>(size).fill(Number.NaN);
  const lower = new Array<number>(size).fill(Number.NaN);

  for (let idx = LENGTH_UP - 1; idx < size; idx += 1) {
    let windowMax = -Infinity;
    let valid = true;
    for (let offset = 0; offset < LENGTH_UP; offset += 1) {
      const sample = upperBody[idx - offset];
      if (!Number.isFinite(sample)) {
        valid = false;
        break;
      }
      if (sample > windowMax) {
        windowMax = sample;
      }
    }
    if (valid) {
      upper[idx] = windowMax;
    }
  }

  for (let idx = LENGTH_DOWN - 1; idx < size; idx += 1) {
    let windowMin = Infinity;
    let valid = true;
    for (let offset = 0; offset < LENGTH_DOWN; offset += 1) {
      const sample = lowerBody[idx - offset];
      if (!Number.isFinite(sample)) {
        valid = false;
        break;
      }
      if (sample < windowMin) {
        windowMin = sample;
      }
    }
    if (valid) {
      lower[idx] = windowMin;
    }
  }

  const results: IndicatorSeriesData[] = [];

  const upperSeries = createSeries({
    name: "Donchian Upper",
    values: upper,
    panel: "overlay",
    color: COLOR_ORANGE,
    plotMode: "colstep",
    width: 5,
  });
  if (upperSeries) {
    results.push(upperSeries);
  }

  const lowerSeries = createSeries({
    name: "Donchian Lower",
    values: lower,
    panel: "overlay",
    color: COLOR_BLACK,
    plotMode: "colstep",
    width: 5,
  });
  if (lowerSeries) {
    results.push(lowerSeries);
  }

  return results;
}

const computeDonchian: IndicatorCompute = (input) => computeDonchianChannel(input);

export const donchianDefinitions: IndicatorDefinition[] = [
  {
    key: "donchian_20",
    name: "Donchian Channel",
    category: "Volatility",
    panel: "overlay",
    description: "Donchian channel using body-based 26/9 lengths.",
    compute: computeDonchian,
    isDefault: false,
  },
];
