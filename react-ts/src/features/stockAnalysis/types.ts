export interface IndicatorDefinition {
  key: string;
  name: string;
  category: string;
  panel: string;
  description: string;
  isDefault: boolean;
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

export interface Candle {
  timestamp: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface ChartPayload {
  candles: Candle[];
  frame?: string | null;
  limit?: number | null;
  start?: number | null;
  end?: number | null;
}
