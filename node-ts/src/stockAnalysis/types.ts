export interface Candle {
  timestamp: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface IndicatorSeriesData {
  name: string;
  values: number[];
  panel: string;
  color?: string;
  plotMode?: string;
  width?: number;
  stepMode?: boolean;
  symbol?: string;
  symbolSize?: number;
  brush?: string;
  fillTarget?: string;
  zValue?: number;
  colorValues?: (string | null)[];
  penStyle?: string;
  xValues?: number[];
  markers?: IndicatorMarker[];
  sourceKey?: string;
}

export interface IndicatorMarker {
  index: number;
  value: number;
  text: string;
  color?: string;
  position?: "aboveBar" | "belowBar" | "inBar";
  shape?: "circle" | "square" | "diamond" | "arrowUp" | "arrowDown" | "arrowLeft" | "arrowRight" | "dot";
  size?: number;
  textColor?: string;
  backgroundColor?: string;
  offsetX?: number;
  offsetY?: number;
}

export interface ChartPayload {
  candles: Candle[];
  frame?: string | null;
  limit?: number | null;
  start?: number | null;
  end?: number | null;
}

export function buildChartPayload(candles: Candle[]): ChartPayload {
  return { candles };
}

export interface IndicatorInput {
  indices: Float64Array;
  opens: Float64Array;
  highs: Float64Array;
  lows: Float64Array;
  closes: Float64Array;
  volumes: Float64Array;
  size: number;
}

export function buildIndicatorInput(payload: ChartPayload): IndicatorInput {
  const count = payload.candles.length;
  const indices = new Float64Array(count);
  const opens = new Float64Array(count);
  const highs = new Float64Array(count);
  const lows = new Float64Array(count);
  const closes = new Float64Array(count);
  const volumes = new Float64Array(count);

  payload.candles.forEach((candle, idx) => {
    indices[idx] = idx;
    opens[idx] = candle.open;
    highs[idx] = candle.high;
    lows[idx] = candle.low;
    closes[idx] = candle.close;
    volumes[idx] = candle.volume ?? 0;
  });

  return {
    indices,
    opens,
    highs,
    lows,
    closes,
    volumes,
    size: count
  };
}
