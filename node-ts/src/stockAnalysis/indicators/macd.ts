// @ts-nocheck
import type { IndicatorCompute, IndicatorDefinition } from "./base";
import type { IndicatorInput, IndicatorSeriesData } from "../types";
import { macdTalib } from "./talibAdapters";

interface MacdConfig {
  fast: number;
  slow: number;
  signal: number;
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
  const hasFinite = params.values.some((value) => Number.isFinite(value));
  if (!hasFinite) {
    return undefined;
  }
  return {
    name: params.name,
    values: params.values.map((value) => (Number.isFinite(value) ? value : Number.NaN)),
    panel: params.panel,
    color: params.color,
    plotMode: params.plotMode,
    width: params.width,
    zValue: params.zValue,
    colorValues: params.colorValues
  };
}

const DEFAULT_MACD_CONFIG: MacdConfig = {
  fast: 12,
  slow: 26,
  signal: 9
};

// Samsung/Korean HTS style colors
const COL_GROW_ABOVE = "#FF0000"; // 상승 가속 (양수+증가) - 진한 빨강
const COL_FALL_ABOVE = "#FF8888"; // 상승 둔화 (양수+감소) - 연한 빨강
const COL_GROW_BELOW = "#8888FF"; // 하락 둔화 (음수+증가) - 연한 파랑
const COL_FALL_BELOW = "#0000FF"; // 하락 가속 (음수+감소) - 진한 파랑

// MACD OSC - Samsung style bar chart
const computeMacdOsc: IndicatorCompute = (input: IndicatorInput): IndicatorSeriesData[] => {
  if (input.size === 0) {
    return [];
  }
  const closes = Array.from(input.closes, (value) => Number(value));
  const { histogram } = macdTalib(
    closes,
    DEFAULT_MACD_CONFIG.fast,
    DEFAULT_MACD_CONFIG.slow,
    DEFAULT_MACD_CONFIG.signal
  );

  const oscColors = histogram.map((value, idx) => {
    if (!Number.isFinite(value)) {
      return null;
    }
    
    const prevValue = idx > 0 ? histogram[idx - 1] : 0;
    
    if (value >= 0) {
      // 양수 영역
      if (value > prevValue) {
        return COL_GROW_ABOVE; // 상승 가속
      } else {
        return COL_FALL_ABOVE; // 상승 둔화
      }
    } else {
      // 음수 영역
      if (value > prevValue) {
        return COL_GROW_BELOW; // 하락 둔화
      } else {
        return COL_FALL_BELOW; // 하락 가속
      }
    }
  });

  const oscSeries = createSeries({
    name: "MACD OSC",
    values: histogram,
    panel: "macd_osc",
    color: COL_GROW_ABOVE,
    plotMode: "histogram",
    colorValues: oscColors
  });

  return [oscSeries].filter(Boolean) as IndicatorSeriesData[];
};

// MACD Bar Chart - macdLine as columns (no signal line)
const computeMacd: IndicatorCompute = (input: IndicatorInput): IndicatorSeriesData[] => {
  if (input.size === 0) {
    return [];
  }
  const closes = Array.from(input.closes, (value) => Number(value));
  const { macd } = macdTalib(
    closes,
    DEFAULT_MACD_CONFIG.fast,
    DEFAULT_MACD_CONFIG.slow,
    DEFAULT_MACD_CONFIG.signal
  );

  // Bar colors: 양수 = 빨강(매수), 음수 = 파랑(매도)
  const barColors = macd.map((value) => {
    if (!Number.isFinite(value)) {
      return null;
    }
    return value >= 0 ? "#FF0000" : "#0000FF";
  });

  const macdSeries = createSeries({
    name: "MACD",
    values: macd,
    panel: "macd",
    color: "#FF0000",
    plotMode: "histogram",
    colorValues: barColors
  });

  return [macdSeries].filter(Boolean) as IndicatorSeriesData[];
};

export const macdDefinitions: IndicatorDefinition[] = [
  {
    key: "macd_12_26_9",
    name: "MACD",
    category: "Momentum",
    panel: "macd",
    description: "MACD Bar Chart (12, 26, 9) - macdLine as columns",
    compute: computeMacd,
    isDefault: false
  },
  {
    key: "macd_osc",
    name: "MACD OSC",
    category: "Momentum",
    panel: "macd_osc",
    description: "MACD Oscillator - Samsung style bar chart (12, 26, 9)",
    compute: computeMacdOsc,
    isDefault: false
  }
];
