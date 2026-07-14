// @ts-nocheck
import "./styles.css";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type {
  ChangeEvent,
  DragEvent as ReactDragEvent,
  FocusEvent,
  KeyboardEvent,
  MouseEvent as ReactMouseEvent
} from "react";
import { Responsive, WidthProvider, type Layouts, type Layout } from "react-grid-layout";
import "react-grid-layout/css/styles.css";
import "react-resizable/css/styles.css";
import {
  ColorType,
  LineType,
  LineStyle,
  PriceScaleMode,
  createChart,
  type CandlestickData,
  type HistogramData,
  type IChartApi,
  type ISeriesApi,
  type LineData,
  type LineWidth,
  type SeriesMarker,
  type SeriesMarkerShape,
  type MouseEventParams,
  type Time,
  type UTCTimestamp
} from "lightweight-charts";
import {
  fetchIndicatorDefinitions,
  fetchIndicatorSeries,
  fetchCandles,
  fetchSymbols,
  blacklistSymbol as blacklistSymbolApi,
  persistLastSymbol,
  persistLastFrame
} from "./services/api.ts";
import { TIMEFRAME_OPTIONS, TIMEFRAME_VALUE_SET, type TimeframeOption } from "./config/timeframes.ts";
import type { Candle, IndicatorDefinition, IndicatorSeriesData } from "./types.ts";

type CandleSeries = ISeriesApi<"Candlestick">;
type LineSeries = ISeriesApi<"Line">;
type VolumeSeries = ISeriesApi<"Histogram">;
type AnySeries = ISeriesApi<"Line"> | ISeriesApi<"Histogram">;
type CandleFillSeries = ISeriesApi<"Candlestick">;

interface ChartBundle {
  chart: IChartApi;
  candleSeries: CandleSeries;
  volumeSeries: VolumeSeries;
}

const PANEL_SCALE_PREFIX = "panel:";

function getPriceScaleId(panel?: string): string {
  if (!panel || panel === "overlay") {
    return "right";
  }
  if (panel === "volume") {
    return "volume";
  }
  return `${PANEL_SCALE_PREFIX}${panel}`;
}

const ResponsiveGridLayout = WidthProvider(Responsive);

const GRID_BREAKPOINTS = {
  lg: 1280,
  md: 996,
  sm: 768,
  xs: 480,
  xxs: 0
};

const GRID_COLS = {
  lg: 12,
  md: 10,
  sm: 6,
  xs: 4,
  xxs: 2
};

const GRID_ROW_HEIGHT = 36;
const GRID_MARGIN: [number, number] = [16, 16];

const DEFAULT_LAYOUTS: Layouts = {
  lg: [
    { i: "chart-panel", x: 0, y: 0, w: 5, h: 14, minW: 4, minH: 14 },
    { i: "favorite-panel", x: 5, y: 0, w: 1, h: 14, minW: 1, minH: 12 },
    { i: "symbol-panel", x: 6, y: 0, w: 1, h: 14, minW: 1, minH: 12 },
    { i: "indicator-panel", x: 7, y: 0, w: 1, h: 14, minW: 1, minH: 8 }
  ],
  md: [
    { i: "chart-panel", x: 0, y: 0, w: 5, h: 14, minW: 4, minH: 14 },
    { i: "favorite-panel", x: 5, y: 0, w: 1, h: 14, minW: 1, minH: 12 },
    { i: "symbol-panel", x: 6, y: 0, w: 1, h: 14, minW: 1, minH: 12 },
    { i: "indicator-panel", x: 0, y: 14, w: 7, h: 14, minW: 3, minH: 8 }
  ],
  sm: [
    { i: "chart-panel", x: 0, y: 0, w: 5, h: 14, minW: 3, minH: 14 },
    { i: "favorite-panel", x: 0, y: 14, w: 1, h: 14, minW: 1, minH: 12 },
    { i: "symbol-panel", x: 1, y: 14, w: 1, h: 14, minW: 1, minH: 12 },
    { i: "indicator-panel", x: 0, y: 28, w: 3, h: 14, minW: 2, minH: 8 }
  ],
  xs: [
    { i: "chart-panel", x: 0, y: 0, w: 3, h: 14, minW: 2, minH: 14 },
    { i: "favorite-panel", x: 0, y: 14, w: 2, h: 14, minW: 1, minH: 12 },
    { i: "symbol-panel", x: 0, y: 28, w: 2, h: 14, minW: 1, minH: 12 },
    { i: "indicator-panel", x: 0, y: 42, w: 2, h: 14, minW: 1, minH: 8 }
  ],
  xxs: [
    { i: "chart-panel", x: 0, y: 0, w: 1, h: 14, minW: 1, minH: 14 },
    { i: "favorite-panel", x: 0, y: 14, w: 1, h: 14, minW: 1, minH: 12 },
    { i: "symbol-panel", x: 0, y: 28, w: 1, h: 14, minW: 1, minH: 12 },
    { i: "indicator-panel", x: 0, y: 42, w: 1, h: 14, minW: 1, minH: 8 }
  ]
};

function cloneLayouts(layouts: Layouts): Layouts {
  const result: Layouts = {};
  for (const key in layouts) {
    if (!Object.prototype.hasOwnProperty.call(layouts, key)) {
      continue;
    }
    const layout = layouts[key];
    if (!layout) {
      continue;
    }
    result[key] = layout.map((item: Layout) => ({ ...item }));
  }
  return result;
}

const DEFAULT_SYMBOL = "005930";
const DEFAULT_FRAME = "day1";
const DEFAULT_INDICATORS = new Set<string>(["market_bias", "fvg_order_blocks", "supertrend"]);
const MAX_CANDLES_ON_SCREEN = 400;
const FUTURE_BAR_PADDING = 15;
const TIME_SCALE_BASE_SPACING = 6;
const TIME_SCALE_WHEEL_RATIO = 1.1;
// 마우스 휠을 위로 스크롤한 축척을 기본값으로 사용한다.
const INITIAL_WHEEL_STEPS = 4;

const INITIAL_BAR_SPACING = Math.round(
  TIME_SCALE_BASE_SPACING * Math.pow(TIME_SCALE_WHEEL_RATIO, INITIAL_WHEEL_STEPS) * 100
) / 100;
const INITIAL_VISIBLE_BAR_FALLOFF = Math.max(
  60,
  Math.round(MAX_CANDLES_ON_SCREEN / Math.pow(TIME_SCALE_WHEEL_RATIO, INITIAL_WHEEL_STEPS))
);
const LOCAL_STORAGE_SYMBOL_KEY = "tmengine:lastSymbol";
const LOCAL_STORAGE_FRAME_KEY = "tmengine:lastFrame";
const HISTORY_CHUNK_SIZE = 1000;
const MAX_HISTORY_LIMIT = 20000;
const INDICATOR_HISTORY_BUFFER = 2000;
const PANEL_WEIGHT_OVERRIDES: Record<string, number> = {
  rsi: 2.2,
  rsi_divergence: 2.2,
  cci: 1.6,
  oscillator: 1.5,
  macd: 1.8
};

function createContainer(): HTMLDivElement {
  const container = document.createElement("div");
  container.className = "chart-container";
  return container;
}

function pickColor(series: IndicatorSeriesData): string {
  if (series.color) {
    return series.color;
  }
  const candidate = series.colorValues?.find((value: string | null): value is string => Boolean(value));
  return candidate ?? "#4a6fa5";
}

interface ParsedColor {
  r: number;
  g: number;
  b: number;
  a: number;
}

function clampChannel(value: number): number {
  if (!Number.isFinite(value)) {
    return 0;
  }
  return Math.min(255, Math.max(0, Math.round(value)));
}

function clampAlpha(value: number): number {
  if (!Number.isFinite(value)) {
    return 1;
  }
  return Math.min(1, Math.max(0, value));
}

function parseHexColor(value: string): ParsedColor | null {
  const match = /^#([0-9a-f]{3,4}|[0-9a-f]{6}|[0-9a-f]{8})$/i.exec(value);
  if (!match) {
    return null;
  }
  const hex = match[1];
  if (hex.length === 3 || hex.length === 4) {
    const r = parseInt(hex[0] + hex[0], 16);
    const g = parseInt(hex[1] + hex[1], 16);
    const b = parseInt(hex[2] + hex[2], 16);
    const a = hex.length === 4 ? parseInt(hex[3] + hex[3], 16) / 255 : 1;
    return { r, g, b, a };
  }
  if (hex.length === 6 || hex.length === 8) {
    const r = parseInt(hex.slice(0, 2), 16);
    const g = parseInt(hex.slice(2, 4), 16);
    const b = parseInt(hex.slice(4, 6), 16);
    const a = hex.length === 8 ? parseInt(hex.slice(6, 8), 16) / 255 : 1;
    return { r, g, b, a };
  }
  return null;
}

function parseRgbColor(value: string): ParsedColor | null {
  const match = /^rgba?\(\s*([+-]?\d*\.?\d+)\s*,\s*([+-]?\d*\.?\d+)\s*,\s*([+-]?\d*\.?\d+)(?:\s*,\s*([+-]?\d*\.?\d+))?\s*\)$/i.exec(value);
  if (!match) {
    return null;
  }
  const r = clampChannel(Number(match[1]));
  const g = clampChannel(Number(match[2]));
  const b = clampChannel(Number(match[3]));
  const a = clampAlpha(match[4] !== undefined ? Number(match[4]) : 1);
  return { r, g, b, a };
}

function parseCssColor(value: string): ParsedColor | null {
  const trimmed = value.trim();
  if (trimmed.length === 0) {
    return null;
  }
  return parseHexColor(trimmed) ?? parseRgbColor(trimmed);
}

function renderCssColor(color: ParsedColor): string {
  const r = clampChannel(color.r);
  const g = clampChannel(color.g);
  const b = clampChannel(color.b);
  const a = clampAlpha(color.a);
  if (a >= 0.999) {
    return `rgb(${r}, ${g}, ${b})`;
  }
  const formattedAlpha = Number(a.toFixed(3));
  return `rgba(${r}, ${g}, ${b}, ${formattedAlpha})`;
}

function normalizeDisplayColor(color?: string | null): string | undefined {
  if (!color) {
    return undefined;
  }
  const parsed = parseCssColor(color);
  if (!parsed) {
    return color;
  }
  let { r, g, b, a } = parsed;
  let changed = false;

  if (a < 0.45) {
    a = 0.6;
    changed = true;
  }

  const luminance = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
  if (luminance > 0.82) {
    const factor = 0.78;
    r = clampChannel(r * factor);
    g = clampChannel(g * factor);
    b = clampChannel(b * factor);
    changed = true;
  }

  if (!changed) {
    return color;
  }
  return renderCssColor({ r, g, b, a });
}

function mapCandlesToData(candles: Candle[]): {
  data: CandlestickData[];
  timestamps: UTCTimestamp[];
  volumes: HistogramData[];
} {
  const timestamps: UTCTimestamp[] = [];
  const data: CandlestickData[] = [];
  const volumes: HistogramData[] = [];

  let previousClose = candles.length > 0 ? candles[0].close : 0;

  candles.forEach((candle, index) => {
    const time = candle.timestamp as UTCTimestamp;
    timestamps.push(time);
    data.push({
      time,
      open: candle.open,
      high: candle.high,
      low: candle.low,
      close: candle.close
    });

    const isUp = index === 0 ? candle.close >= candle.open : candle.close >= previousClose;
    volumes.push({
      time,
      value: candle.volume ?? 0,
      color: isUp ? "rgba(83, 185, 135, 0.6)" : "rgba(235, 77, 92, 0.6)"
    });

    previousClose = candle.close;
  });

  return { data, timestamps, volumes };
}

function lowerBound(timestamps: UTCTimestamp[], targetSeconds: number): number {
  let left = 0;
  let right = timestamps.length - 1;
  let result = timestamps.length;

  while (left <= right) {
    const mid = (left + right) >>> 1;
    const value = Number(timestamps[mid]);
    if (value >= targetSeconds) {
      result = mid;
      right = mid - 1;
    } else {
      left = mid + 1;
    }
  }

  return result;
}

interface AlignedPoint {
  time: UTCTimestamp;
  value: number;
  color: string;
  index: number;
}

interface ScaleStats {
  min: number;
  max: number;
}

function normalizeMarkerShape(shape?: string): SeriesMarkerShape {
  switch (shape) {
    case "square":
    case "arrowUp":
    case "arrowDown":
      return shape;
    default:
      return "circle";
  }
}

interface MarkerLabelOptions {
  text: string;
  textColor?: string;
  backgroundColor?: string;
  offsetX?: number;
  offsetY?: number;
}

interface MarkerRenderData {
  marker: SeriesMarker<UTCTimestamp>;
  dataPoint: LineData<UTCTimestamp>;
  index: number;
  label?: MarkerLabelOptions;
}

interface MarkerLabelItem {
  marker: SeriesMarker<UTCTimestamp>;
  dataPoint: LineData<UTCTimestamp>;
  index: number;
  offsetX: number;
  offsetY: number;
  element: HTMLDivElement;
}

interface MarkerLabelEntry {
  series: LineSeries;
  items: MarkerLabelItem[];
  key?: string;
}

interface CachedIndicatorEntry {
  seriesList: IndicatorSeriesData[];
  aligned: Map<string, AlignedPoint[]>;
  markers: Map<string, MarkerRenderData[]>;
  valueByTime: Map<string, Map<number, AlignedPoint>>;
}

interface LegendValues {
  time?: UTCTimestamp;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

interface IndicatorLegendValue {
  id: string;
  text: string;
  color?: string;
}

interface IndicatorLegendEntry {
  key: string;
  label: string;
  values: IndicatorLegendValue[];
}

interface CandleColorScheme {
  up: string;
  down: string;
  neutral: string;
}

const PRICE_FORMATTER = new Intl.NumberFormat("ko-KR", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2
});

const VOLUME_FORMATTER = new Intl.NumberFormat("ko-KR", {
  notation: "compact",
  maximumFractionDigits: 2
});

const INDICATOR_VALUE_FORMATTER = new Intl.NumberFormat("ko-KR", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 4
});

const PERCENT_FORMATTER = new Intl.NumberFormat("ko-KR", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2
});

const INDICATOR_SELECTION_COOKIE_KEY = "tmengine:indicatorSelection";
const INDICATOR_SELECTION_COOKIE_TTL = 60 * 60 * 24 * 30;
const GRID_LAYOUT_COOKIE_KEY = "tmengine:gridLayouts";
const GRID_RESET_FLAG_KEY = "tmengine:grid-reset";
const GRID_LAYOUT_COOKIE_TTL = 60 * 60 * 24 * 30;
const FAVORITE_SYMBOLS_COOKIE_KEY = "tmengine:favorites";
const FAVORITE_SYMBOLS_COOKIE_TTL = 60 * 60 * 24 * 30;
const START_DATE_COOKIE_KEY = "tmengine:startDate";
const START_DATE_COOKIE_TTL = 60 * 60 * 24 * 30;
const DEFAULT_START_DATE = "2022-01-01";
const END_DATE_COOKIE_KEY = "tmengine:endDate";
const END_DATE_COOKIE_TTL = 60 * 60 * 24 * 30;

function readIndicatorSelectionCookie(): string[] {
  if (typeof document === "undefined" || !document.cookie) {
    return [];
  }
  const prefix = `${INDICATOR_SELECTION_COOKIE_KEY}=`;
  const entries = document.cookie.split(";");
  for (const rawEntry of entries) {
    const entry = rawEntry.trim();
    if (!entry.startsWith(prefix)) {
      continue;
    }
    const value = entry.slice(prefix.length);
    if (!value) {
      return [];
    }
    try {
      const parsed = JSON.parse(decodeURIComponent(value));
      if (Array.isArray(parsed)) {
        return parsed.filter((item): item is string => typeof item === "string").map((item) => item.trim());
      }
    } catch (error) {
      console.warn("지표 선택 쿠키를 해석하지 못했습니다.", error);
      return [];
    }
  }
  return [];
}

function writeIndicatorSelectionCookie(selection: Set<string>): void {
  if (typeof document === "undefined") {
    return;
  }
  try {
    const payload = JSON.stringify(Array.from(selection));
    const encoded = encodeURIComponent(payload);
    document.cookie = `${INDICATOR_SELECTION_COOKIE_KEY}=${encoded}; max-age=${INDICATOR_SELECTION_COOKIE_TTL}; path=/; SameSite=Lax`;
  } catch (error) {
    console.warn("지표 선택 쿠키를 저장하지 못했습니다.", error);
  }
}

function readFavoriteSymbolsCookie(): string[] {
  if (typeof document === "undefined" || !document.cookie) {
    return [];
  }
  const prefix = `${FAVORITE_SYMBOLS_COOKIE_KEY}=`;
  const entries = document.cookie.split(";");
  for (const rawEntry of entries) {
    const entry = rawEntry.trim();
    if (!entry.startsWith(prefix)) {
      continue;
    }
    const value = entry.slice(prefix.length);
    if (!value) {
      return [];
    }
    try {
      const decoded = decodeURIComponent(value);
      const parsed = JSON.parse(decoded);
      if (!Array.isArray(parsed)) {
        return [];
      }
      const normalized: string[] = [];
      parsed.forEach((item) => {
        if (typeof item !== "string") {
          return;
        }
        const trimmed = item.trim().toUpperCase();
        if (trimmed.length === 0) {
          return;
        }
        if (!/^[A-Z0-9]+$/.test(trimmed)) {
          return;
        }
        if (!normalized.includes(trimmed)) {
          normalized.push(trimmed);
        }
      });
      return normalized;
    } catch (error) {
      console.warn("관심종목 쿠키를 해석하지 못했습니다.", error);
      return [];
    }
  }
  return [];
}

function writeFavoriteSymbolsCookie(favorites: string[]): void {
  if (typeof document === "undefined") {
    return;
  }
  try {
    const sanitized = favorites
      .map((item) => item.trim().toUpperCase())
      .filter((item) => /^[A-Z0-9]+$/.test(item));
    const unique: string[] = [];
    sanitized.forEach((item) => {
      if (!unique.includes(item)) {
        unique.push(item);
      }
    });
    const payload = JSON.stringify(unique);
    const encoded = encodeURIComponent(payload);
    document.cookie = `${FAVORITE_SYMBOLS_COOKIE_KEY}=${encoded}; max-age=${FAVORITE_SYMBOLS_COOKIE_TTL}; path=/; SameSite=Lax`;
  } catch (error) {
    console.warn("관심종목 쿠키를 저장하지 못했습니다.", error);
  }
}

interface StartDateCookieState {
  value: string | null;
  exists: boolean;
}

function readStartDateCookie(): StartDateCookieState {
  if (typeof document === "undefined" || !document.cookie) {
    return { value: null, exists: false };
  }
  const prefix = `${START_DATE_COOKIE_KEY}=`;
  const entries = document.cookie.split(";");
  for (const rawEntry of entries) {
    const entry = rawEntry.trim();
    if (!entry.startsWith(prefix)) {
      continue;
    }
    const rawValue = decodeURIComponent(entry.slice(prefix.length));
    if (rawValue === "none") {
      return { value: null, exists: true };
    }
    if (/^\d{4}-\d{2}-\d{2}$/.test(rawValue)) {
      return { value: rawValue, exists: true };
    }
    const numericCandidate = Number(rawValue);
    if (Number.isFinite(numericCandidate) && numericCandidate > 0) {
      const iso = new Date(numericCandidate * 1000).toISOString().slice(0, 10);
      if (/^\d{4}-\d{2}-\d{2}$/.test(iso)) {
        return { value: iso, exists: true };
      }
    }
    return { value: null, exists: true };
  }
  return { value: null, exists: false };
}

function writeStartDateCookie(value: string | null): void {
  if (typeof document === "undefined") {
    return;
  }
  const cookieValue = value ?? "none";
  document.cookie = `${START_DATE_COOKIE_KEY}=${encodeURIComponent(cookieValue)}; max-age=${START_DATE_COOKIE_TTL}; path=/; SameSite=Lax`;
}

interface EndDateCookieState {
  value: string | null;
  exists: boolean;
}

function readEndDateCookie(): EndDateCookieState {
  if (typeof document === "undefined" || !document.cookie) {
    return { value: null, exists: false };
  }
  const prefix = `${END_DATE_COOKIE_KEY}=`;
  const entries = document.cookie.split(";");
  for (const rawEntry of entries) {
    const entry = rawEntry.trim();
    if (!entry.startsWith(prefix)) {
      continue;
    }
    const rawValue = decodeURIComponent(entry.slice(prefix.length));
    if (rawValue === "none") {
      return { value: null, exists: true };
    }
    if (/^\d{4}-\d{2}-\d{2}$/.test(rawValue)) {
      return { value: rawValue, exists: true };
    }
    const numericCandidate = Number(rawValue);
    if (Number.isFinite(numericCandidate) && numericCandidate > 0) {
      const iso = new Date(numericCandidate * 1000).toISOString().slice(0, 10);
      if (/^\d{4}-\d{2}-\d{2}$/.test(iso)) {
        return { value: iso, exists: true };
      }
    }
    return { value: null, exists: true };
  }
  return { value: null, exists: false };
}

function writeEndDateCookie(value: string | null): void {
  if (typeof document === "undefined") {
    return;
  }
  const cookieValue = value ?? "none";
  document.cookie = `${END_DATE_COOKIE_KEY}=${encodeURIComponent(cookieValue)}; max-age=${END_DATE_COOKIE_TTL}; path=/; SameSite=Lax`;
}

function normalizeDateValue(raw: string | number | null | undefined): string | null {
  if (raw === null || raw === undefined) {
    return null;
  }

  if (typeof raw === "number") {
    if (!Number.isFinite(raw) || raw <= 0) {
      return null;
    }
    const date = new Date(Math.trunc(raw) * 1000);
    if (Number.isNaN(date.getTime())) {
      return null;
    }
    return date.toISOString().slice(0, 10);
  }

  const valueText = raw.trim();
  if (valueText.length === 0) {
    return null;
  }

  if (/^\d+$/.test(valueText)) {
    const numeric = Number(valueText);
    if (Number.isFinite(numeric) && numeric > 0) {
      const date = new Date(Math.trunc(numeric) * 1000);
      if (!Number.isNaN(date.getTime())) {
        return date.toISOString().slice(0, 10);
      }
    }
  }

  if (!/^\d{4}-\d{2}-\d{2}$/.test(valueText)) {
    const looseMatch = /^([0-9]{4})-([0-9]{1,2})-([0-9]{1,2})$/.exec(valueText);
    if (!looseMatch) {
      return null;
    }
    const year = Number(looseMatch[1]);
    const month = Number(looseMatch[2]);
    const day = Number(looseMatch[3]);
    if (!Number.isFinite(year) || !Number.isFinite(month) || !Number.isFinite(day)) {
      return null;
    }
    if (month < 1 || month > 12 || day < 1 || day > 31) {
      return null;
    }
    const isoCandidateLoose = `${year.toString().padStart(4, "0")}-${month.toString().padStart(2, "0")}-${day
      .toString()
      .padStart(2, "0")}`;
    const parsedLoose = Date.parse(`${isoCandidateLoose}T00:00:00Z`);
    if (Number.isNaN(parsedLoose)) {
      return null;
    }
    const dateLoose = new Date(parsedLoose);
    return dateLoose.toISOString().slice(0, 10);
  }

  const isoCandidate = `${valueText}T00:00:00Z`;
  const parsed = Date.parse(isoCandidate);
  if (Number.isNaN(parsed)) {
    return null;
  }

  const date = new Date(parsed);
  return date.toISOString().slice(0, 10);
}

function normalizeLayouts(source: Layouts | Record<string, unknown> | null | undefined): Layouts | null {
  if (!source || typeof source !== "object") {
    return null;
  }

  const result: Layouts = {};
  let hasAny = false;

  Object.keys(DEFAULT_LAYOUTS).forEach((key) => {
    const rawList = (source as Record<string, unknown>)[key];
    if (!Array.isArray(rawList)) {
      return;
    }

    const sanitized: Layout[] = rawList
      .map((item) => {
        if (!item || typeof item !== "object") {
          return null;
        }
        const entry = item as Record<string, unknown>;
        const id = typeof entry.i === "string" ? entry.i.trim() : "";
        if (!id) {
          return null;
        }

        const numeric = (value: unknown, minimum: number, allowZero = false): number | null => {
          const parsed = Number(value);
          if (!Number.isFinite(parsed)) {
            return null;
          }
          const truncated = Math.trunc(parsed);
          if (allowZero) {
            return Math.max(0, truncated);
          }
          return Math.max(minimum, truncated);
        };

        const x = numeric(entry.x, 0, true);
        const y = numeric(entry.y, 0, true);
        const w = numeric(entry.w, 1);
        const h = numeric(entry.h, 1);

        if (x === null || y === null || w === null || h === null) {
          return null;
        }

        const sanitizedItem: Layout = { i: id, x, y, w, h };

        const minW = numeric(entry.minW, 1);
        const minH = numeric(entry.minH, 1);
        if (minW !== null) {
          sanitizedItem.minW = minW;
        }
        if (minH !== null) {
          sanitizedItem.minH = minH;
        }
        if (typeof entry.static === "boolean") {
          sanitizedItem.static = entry.static;
        }

        return sanitizedItem;
      })
      .filter((item): item is Layout => item !== null);

    if (sanitized.length > 0) {
      result[key] = sanitized;
      hasAny = true;
    }
  });

  return hasAny ? result : null;
}

function mergeLayouts(base: Layouts, override?: Layouts | null): Layouts {
  const merged = cloneLayouts(base);
  if (!override) {
    return merged;
  }

  Object.keys(merged).forEach((key) => {
    const overrideItems = override[key];
    if (!Array.isArray(overrideItems) || overrideItems.length === 0) {
      return;
    }

    const baseMap = new Map<string, Layout>();
    (merged[key] ?? []).forEach((item) => {
      baseMap.set(item.i, item);
    });

    merged[key] = overrideItems.map((item) => {
      const fallback = baseMap.get(item.i);
      const next: Layout = { ...item };
      if (fallback) {
        if (typeof next.minW !== "number" && typeof fallback.minW === "number") {
          next.minW = fallback.minW;
        }
        if (typeof next.minH !== "number" && typeof fallback.minH === "number") {
          next.minH = fallback.minH;
        }
      }
      return next;
    });
  });

  return merged;
}

function readGridLayoutCookie(): Layouts | null {
  if (typeof document === "undefined" || !document.cookie) {
    return null;
  }
  const prefix = `${GRID_LAYOUT_COOKIE_KEY}=`;
  const entries = document.cookie.split(";");
  for (const rawEntry of entries) {
    const entry = rawEntry.trim();
    if (!entry.startsWith(prefix)) {
      continue;
    }
    const value = entry.slice(prefix.length);
    if (!value) {
      return null;
    }
    try {
      const decoded = decodeURIComponent(value);
      const parsed = JSON.parse(decoded) as unknown;
      return normalizeLayouts(parsed as Layouts);
    } catch (error) {
      console.warn("레이아웃 쿠키를 읽지 못했습니다.", error);
      return null;
    }
  }
  return null;
}

function writeGridLayoutCookie(layouts: Layouts): void {
  if (typeof document === "undefined") {
    return;
  }
  try {
    const payload: Record<string, Layout[]> = {};
    Object.keys(DEFAULT_LAYOUTS).forEach((key) => {
      const list = layouts[key];
      if (!Array.isArray(list)) {
        return;
      }
      payload[key] = list.map((item) => {
        const entry: Layout = {
          i: item.i,
          x: Math.max(0, Math.trunc(item.x)),
          y: Math.max(0, Math.trunc(item.y)),
          w: Math.max(1, Math.trunc(item.w)),
          h: Math.max(1, Math.trunc(item.h))
        };
        if (typeof item.minW === "number") {
          entry.minW = Math.max(1, Math.trunc(item.minW));
        }
        if (typeof item.minH === "number") {
          entry.minH = Math.max(1, Math.trunc(item.minH));
        }
        if (typeof item.static === "boolean") {
          entry.static = item.static;
        }
        return entry;
      });
    });
    const encoded = encodeURIComponent(JSON.stringify(payload));
    document.cookie = `${GRID_LAYOUT_COOKIE_KEY}=${encoded}; max-age=${GRID_LAYOUT_COOKIE_TTL}; path=/; SameSite=Lax`;
  } catch (error) {
    console.warn("레이아웃 쿠키를 저장하지 못했습니다.", error);
  }
}

function consumeGridResetFlag(): boolean {
  if (typeof window === "undefined") {
    return false;
  }
  try {
    const flag = window.sessionStorage?.getItem(GRID_RESET_FLAG_KEY);
    if (!flag) {
      return false;
    }
    window.sessionStorage?.removeItem(GRID_RESET_FLAG_KEY);
    return true;
  } catch (error) {
    console.warn("그리드 리셋 플래그를 확인하지 못했습니다.", error);
    return false;
  }
}

const DEFAULT_CANDLE_COLORS: CandleColorScheme = {
  up: "#53b987",
  down: "#eb4d5c",
  neutral: "#94a3b8"
};
const LEGEND_PLACEHOLDER_HTML = [
  '<span class="legend-entry">시 -</span>',
  '<span class="legend-entry">고 -</span>',
  '<span class="legend-entry">저 -</span>',
  '<span class="legend-entry">종 -</span>',
  '<span class="legend-entry">(-%)</span>',
  '<span class="legend-entry">V -</span>'
].join("  ");

function normalizeStoredSymbol(value: string | null | undefined): string | null {
  if (!value) {
    return null;
  }
  const normalized = value.trim().toUpperCase();
  return /^\d{6}$/.test(normalized) ? normalized : null;
}


function readStoredSymbol(): string | null {
  if (typeof window === "undefined" || !window.localStorage) {
    return null;
  }
  try {
    const raw = window.localStorage.getItem(LOCAL_STORAGE_SYMBOL_KEY);
    return normalizeStoredSymbol(raw);
  } catch (error) {
    console.warn("로컬 저장소에서 마지막 심볼을 읽지 못했습니다.", error);
    return null;
  }
}

function normalizeStoredFrame(value: string | null | undefined): string | null {
  if (!value) {
    return null;
  }
  const normalized = value.trim().toLowerCase();
  return TIMEFRAME_VALUE_SET.has(normalized) ? normalized : null;
}

function isMinuteFrameValue(value: string | null | undefined): boolean {
  if (!value) {
    return false;
  }
  const normalized = value.trim().toLowerCase();
  if (normalized === "day" || normalized === "day1" || normalized === "d1" || normalized === "1d" || normalized === "1day") {
    return false;
  }
  return /^m\d+$/.test(normalized) || normalized.endsWith("min") || /^\d+m$/.test(normalized);
}

function readStoredFrame(): string | null {
  if (typeof window === "undefined" || !window.localStorage) {
    return null;
  }
  try {
    const raw = window.localStorage.getItem(LOCAL_STORAGE_FRAME_KEY);
    return normalizeStoredFrame(raw);
  } catch (error) {
    console.warn("로컬 저장소에서 마지막 타임프레임을 읽지 못했습니다.", error);
    return null;
  }
}
function formatPrice(value: number): string {
  return Number.isFinite(value) ? PRICE_FORMATTER.format(value) : "-";
}

function formatVolume(value: number): string {
  return Number.isFinite(value) ? VOLUME_FORMATTER.format(Math.max(0, value)) : "-";
}

function formatIndicatorValue(value: number): string {
  if (!Number.isFinite(value)) {
    return "-";
  }
  return INDICATOR_VALUE_FORMATTER.format(value);
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (match) => {
    switch (match) {
      case "&":
        return "&amp;";
      case "<":
        return "&lt;";
      case ">":
        return "&gt;";
      case '"':
        return "&quot;";
      case "'":
        return "&#39;";
      default:
        return match;
    }
  });
}

function isBusinessDay(value: unknown): value is { year: number; month: number; day: number } {
  if (!value || typeof value !== "object") {
    return false;
  }
  const day = value as { year?: number; month?: number; day?: number };
  return (
    Number.isFinite(day.year) &&
    Number.isFinite(day.month) &&
    Number.isFinite(day.day)
  );
}

function extractTimestamp(time?: Time): UTCTimestamp | undefined {
  if (typeof time === "number" && Number.isFinite(time)) {
    return time as UTCTimestamp;
  }
  if (isBusinessDay(time)) {
    const utcMillis = Date.UTC(time.year, time.month - 1, time.day);
    if (Number.isFinite(utcMillis)) {
      return Math.floor(utcMillis / 1000) as UTCTimestamp;
    }
  }
  return undefined;
}

function formatTimestamp(value?: UTCTimestamp): string {
  if (!Number.isFinite(value)) {
    return "";
  }
  const date = new Date((value as number) * 1000);
  const year = date.getUTCFullYear();
  const month = `${date.getUTCMonth() + 1}`.padStart(2, "0");
  const day = `${date.getUTCDate()}`.padStart(2, "0");
  const hours = `${date.getUTCHours()}`.padStart(2, "0");
  const minutes = `${date.getUTCMinutes()}`.padStart(2, "0");
  return `${year}-${month}-${day} ${hours}:${minutes}`;
}

function formatTimeLabel(time: Time): string {
  const timestamp = extractTimestamp(time);
  if (!timestamp) {
    return "";
  }
  return formatTimestamp(timestamp);
}

function formatTimeScaleLabel(time: Time): string {
  const timestamp = extractTimestamp(time);
  if (!timestamp) {
    return "";
  }
  const formatted = formatTimestamp(timestamp);
  return formatted.endsWith(" 00:00") ? formatted.slice(0, 10) : formatted;
}

function resolveLegendCandleColor(open: number, close: number, colors: CandleColorScheme): string {
  if (Number.isFinite(open) && Number.isFinite(close)) {
    if (close > open) {
      return colors.up;
    }
    if (close < open) {
      return colors.down;
    }
  }
  return colors.neutral;
}

function buildLegendMarkup(values: LegendValues | undefined, colors: CandleColorScheme): string {
  if (!values) {
    return LEGEND_PLACEHOLDER_HTML;
  }

  const timeText = formatTimestamp(values.time);
  const openText = escapeHtml(formatPrice(values.open));
  const highText = escapeHtml(formatPrice(values.high));
  const lowText = escapeHtml(formatPrice(values.low));
  const closeText = escapeHtml(formatPrice(values.close));
  const volumeText = escapeHtml(formatVolume(values.volume));

  const candleColor = resolveLegendCandleColor(values.open, values.close, colors);
  const priceColorAttr = ` style="color:${candleColor}"`;

  let percentDisplay = "-";
  let percentColorAttr = "";
  if (Number.isFinite(values.open) && Number.isFinite(values.close) && Math.abs(values.open) > Number.EPSILON) {
    const percent = ((values.close - values.open) / Math.abs(values.open)) * 100;
    if (Number.isFinite(percent)) {
      const sign = percent > 0 ? "+" : "";
      percentDisplay = `${sign}${PERCENT_FORMATTER.format(percent)}%`;
      percentColorAttr = priceColorAttr;
    }
  }
  if (!percentColorAttr) {
    percentColorAttr = ` style="color:${colors.neutral}"`;
  }

  const segments: string[] = [];
  if (timeText) {
    segments.push(`<span class="legend-time">${escapeHtml(timeText)}</span>`);
  }

  segments.push(
    `<span class="legend-entry">시 <span class="legend-value"${priceColorAttr}>${openText}</span></span>`
  );
  segments.push(
    `<span class="legend-entry">고 <span class="legend-value"${priceColorAttr}>${highText}</span></span>`
  );
  segments.push(
    `<span class="legend-entry">저 <span class="legend-value"${priceColorAttr}>${lowText}</span></span>`
  );
  segments.push(
    `<span class="legend-entry">종 <span class="legend-value"${priceColorAttr}>${closeText}</span></span>`
  );
  segments.push(
    `<span class="legend-entry">(<span class="legend-value"${percentColorAttr}>${escapeHtml(percentDisplay)}</span>)</span>`
  );
  segments.push(
    `<span class="legend-entry">V ${volumeText}</span>`
  );

  return segments.join("  ");
}

function alignSeriesPoints(
  series: IndicatorSeriesData,
  timestamps: UTCTimestamp[],
  scaleId: string,
  transformValue?: (scaleId: string, value: number) => number,
  applyTransform?: boolean
): AlignedPoint[] {
  const count = Math.min(series.values.length, timestamps.length);
  if (count === 0) {
    return [];
  }

  const valueOffset = series.values.length - count;
  const timeOffset = timestamps.length - count;

  const points: AlignedPoint[] = [];
  for (let idx = 0; idx < count; idx += 1) {
    const sourceIndex = valueOffset + idx;
    const rawValue = series.values[sourceIndex];
    if (!Number.isFinite(rawValue)) {
      continue;
    }
    const time = timestamps[timeOffset + idx];
    const colorCandidate = series.colorValues?.[valueOffset + idx] ?? series.color;
    const color = colorCandidate ?? pickColor(series);
    const value = applyTransform && transformValue ? transformValue(scaleId, rawValue) : rawValue;
    points.push({ time, value, color, index: sourceIndex });
  }

  return points;
}

function alignMarkers(
  series: IndicatorSeriesData,
  timestamps: UTCTimestamp[],
  scaleId: string,
  transformValue?: (scaleId: string, value: number) => number,
  applyTransform?: boolean
): MarkerRenderData[] {
  const placeholders = series.markers ?? [];
  if (placeholders.length === 0 || timestamps.length === 0) {
    return [];
  }

  const count = Math.min(series.values.length, timestamps.length);
  if (count === 0) {
    return [];
  }

  const valueOffset = series.values.length - count;
  const timeOffset = timestamps.length - count;
  const markers: MarkerRenderData[] = [];
  placeholders.forEach((marker) => {
    const sourceIndex = Number.isFinite(marker.index) ? marker.index : Number.NaN;
    if (!Number.isFinite(sourceIndex)) {
      return;
    }
    if (sourceIndex < valueOffset || sourceIndex >= series.values.length) {
      return;
    }
    const alignedIndex = sourceIndex - valueOffset;
    if (alignedIndex < 0 || alignedIndex >= count) {
      return;
    }
    const timeIndex = timeOffset + alignedIndex;
    if (timeIndex < 0 || timeIndex >= timestamps.length) {
      return;
    }
    const time = timestamps[timeIndex];
    if (!time) {
      return;
    }
    const price = Number.isFinite(marker.value) ? marker.value : series.values[sourceIndex];
    if (!Number.isFinite(price)) {
      return;
    }
    const color = marker.color ?? series.color ?? pickColor(series);
    const value = applyTransform && transformValue ? transformValue(scaleId, price) : price;
    const labelNeedsOverlay =
      Boolean(marker.offsetX) ||
      Boolean(marker.offsetY) ||
      Boolean(marker.textColor) ||
      Boolean(marker.backgroundColor);
    markers.push({
      marker: {
        time,
        position: marker.position ?? "inBar",
        color,
        shape: normalizeMarkerShape(marker.shape),
        text: labelNeedsOverlay ? "" : marker.text,
        size: marker.size,
      },
      dataPoint: { time, value },
      index: timeIndex,
      label: labelNeedsOverlay
        ? {
            text: marker.text,
            textColor: marker.textColor,
            backgroundColor: marker.backgroundColor,
            offsetX: marker.offsetX,
            offsetY: marker.offsetY,
          }
        : undefined,
    });
  });
  return markers;
}

function renderIndicatorLineSeries(
  series: IndicatorSeriesData,
  aligned: AlignedPoint[],
  chart: IChartApi,
  priceScaleId: string,
  formatValue?: (scaleId: string, value: number, kind?: "price" | "volume" | "indicator") => string
): AnySeries[] {
  if (aligned.length === 0) {
    return [];
  }

  interface Segment {
    color: string;
    data: LineData[];
    lastIndex: number;
  }

  const segments: Segment[] = [];
  const MAX_INDEX_GAP = 8;

  aligned.forEach((point) => {
    const segment = segments[segments.length - 1];
    const gap = segment ? point.index - segment.lastIndex : 0;
    const isContiguous = segment ? gap <= MAX_INDEX_GAP : false;
    const colorChanged = segment ? segment.color !== point.color : false;

    if (!segment || !isContiguous || colorChanged) {
      const seed: Segment = {
        color: point.color,
        data: [{ time: point.time, value: point.value }],
        lastIndex: point.index,
      };

      if (segment && isContiguous && colorChanged) {
        const tail = segment.data[segment.data.length - 1];
        if (tail) {
          seed.data.unshift({ time: tail.time, value: tail.value });
        }
      }

      segments.push(seed);
      return;
    }

    segment.data.push({ time: point.time, value: point.value });
    segment.lastIndex = point.index;
  });

  const normalizedWidth = Math.max(1, Math.min(4, Math.round(series.width ?? 2))) as LineWidth;
  const handles: AnySeries[] = [];

  segments.forEach((segment) => {
    const line = chart.addLineSeries({
      color: segment.color,
      lineWidth: normalizedWidth,
      priceLineVisible: false,
      lastValueVisible: false,
      priceScaleId,
      crosshairMarkerVisible: true,
      ...(formatValue
        ? {
            priceFormat: {
              type: "custom" as const,
              minMove: 0.0001,
              formatter: (value: number) => {
                const kind = priceScaleId === "volume"
                  ? "volume"
                  : priceScaleId === "right"
                    ? "price"
                    : "indicator";
                return formatValue(priceScaleId, value, kind);
              }
            }
          }
        : {})
    });
    if (series.plotMode === "colstep") {
      line.applyOptions({ lineType: LineType.WithSteps });
    }
    line.setData(segment.data);
    handles.push(line);
  });

  return handles;
}

function renderIndicatorHistogramSeries(
  series: IndicatorSeriesData,
  aligned: AlignedPoint[],
  chart: IChartApi,
  priceScaleId: string,
  formatValue?: (scaleId: string, value: number, kind?: "price" | "volume" | "indicator") => string
): AnySeries[] {
  if (aligned.length === 0) {
    return [];
  }

  const histogram = chart.addHistogramSeries({
    base: 0,
    priceLineVisible: false,
    lastValueVisible: false,
    priceScaleId,
    crosshairMarkerVisible: true,
    color: series.color ?? pickColor(series),
    ...(formatValue
      ? {
          priceFormat: {
            type: "custom" as const,
            minMove: 0.0001,
            formatter: (value: number) => formatValue(priceScaleId, value, "indicator")
          }
        }
      : {})
  });

  const data = aligned.map((point) => ({
    time: point.time,
    value: point.value,
    color: point.color
  }));
  histogram.setData(data);

  return [histogram];
}

function renderIndicatorMarkerSeries(
  series: IndicatorSeriesData,
  markers: MarkerRenderData[],
  chart: IChartApi,
  priceScaleId: string,
  registerLabels?: (indicatorKey: string, seriesApi: LineSeries, items: MarkerRenderData[]) => void,
  indicatorKey?: string
): AnySeries[] {
  if (markers.length === 0) {
    return [];
  }

  const ordered = [...markers].sort(
    (left, right) => Number(left.dataPoint.time) - Number(right.dataPoint.time)
  );

  const markerSeries = chart.addLineSeries({
    color: "rgba(0,0,0,0)",
    lineWidth: 1,
    priceLineVisible: false,
    lastValueVisible: false,
    crosshairMarkerVisible: false,
    priceScaleId
  });
  markerSeries.setData(ordered.map((item) => item.dataPoint));
  markerSeries.setMarkers(ordered.map((item) => item.marker));

  if (registerLabels && indicatorKey) {
    registerLabels(indicatorKey, markerSeries, ordered);
  }

  return [markerSeries];
}

function renderFillBetweenSeries(
  topSeries: IndicatorSeriesData,
  topPoints: AlignedPoint[],
  bottomPoints: AlignedPoint[] | undefined,
  chart: IChartApi,
  priceScaleId: string,
  formatValue?: (scaleId: string, value: number, kind?: "price" | "volume" | "indicator") => string
): CandleFillSeries[] {
  if (!bottomPoints || topPoints.length === 0 || bottomPoints.length === 0) {
    return [];
  }

  const candleData: CandlestickData[] = [];
  const brushColor = topSeries.brush ?? topSeries.color ?? pickColor(topSeries);
  const bottomByTime = new Map<UTCTimestamp, AlignedPoint>();
  for (let idx = 0; idx < bottomPoints.length; idx += 1) {
    const point = bottomPoints[idx];
    bottomByTime.set(point.time, point);
  }

  for (let idx = 0; idx < topPoints.length; idx += 1) {
    const top = topPoints[idx];
    const bottom = bottomByTime.get(top.time);
    if (!bottom) {
      continue;
    }
    if (!Number.isFinite(top.value) || !Number.isFinite(bottom.value)) {
      continue;
    }
    const upper = Math.max(top.value, bottom.value);
    const lower = Math.min(top.value, bottom.value);
    candleData.push({
      time: top.time,
      open: upper,
      high: upper,
      low: lower,
      close: lower,
      color: brushColor,
      borderColor: brushColor,
      wickColor: brushColor
    });
  }

  if (candleData.length === 0) {
    return [];
  }

  const fillSeries = chart.addCandlestickSeries({
    priceScaleId,
    upColor: brushColor,
    downColor: brushColor,
    borderUpColor: brushColor,
    borderDownColor: brushColor,
    wickUpColor: brushColor,
    wickDownColor: brushColor,
    borderVisible: false,
    wickVisible: false,
    priceLineVisible: false,
    lastValueVisible: false,
    ...(formatValue
      ? {
          priceFormat: {
            type: "custom" as const,
            minMove: 0.0001,
            formatter: (value: number) => {
              const kind = priceScaleId === "volume"
                ? "volume"
                : priceScaleId === "right"
                  ? "price"
                  : "indicator";
              return formatValue(priceScaleId, value, kind);
            }
          }
        }
      : {})
  });

  fillSeries.setData(candleData);
  return [fillSeries];
}

export default function App(): JSX.Element {
  const normalizedDefaultStartDate = useMemo(() => normalizeDateValue(DEFAULT_START_DATE), []);
  const todayIso = new Date().toISOString().slice(0, 10);
  const initialStoredSymbol = useMemo(() => readStoredSymbol(), []);
  const initialStoredFrame = useMemo(() => readStoredFrame(), []);
  const startDateCookie = useMemo(() => readStartDateCookie(), []);
  const endDateCookie = useMemo(() => readEndDateCookie(), []);
  const normalizedInitialStartDate = startDateCookie.exists
    ? normalizeDateValue(startDateCookie.value)
    : normalizedDefaultStartDate;
  const normalizedInitialEndDate = endDateCookie.exists ? normalizeDateValue(endDateCookie.value) : null;
  const [definitions, setDefinitions] = useState<IndicatorDefinition[]>([]);
  const [selection, setSelection] = useState<Set<string>>(() => new Set(DEFAULT_INDICATORS));
  const [chartReady, setChartReady] = useState(false);
  const [candles, setCandles] = useState<Candle[]>([]);
  const [symbols, setSymbols] = useState<string[]>([]);
  const [favoriteSymbols, setFavoriteSymbols] = useState<string[]>(() => readFavoriteSymbolsCookie());
  const [symbol, setSymbol] = useState<string>(initialStoredSymbol ?? DEFAULT_SYMBOL);
  const [frame, setFrame] = useState<string>(initialStoredFrame ?? DEFAULT_FRAME);
  const [startDateFilter, setStartDateFilter] = useState<string | null>(normalizedInitialStartDate ?? null);
  const [startDateInput, setStartDateInput] = useState<string>(normalizedInitialStartDate ?? "");
  const [startDateInputError, setStartDateInputError] = useState<string | null>(null);
  const [endDateFilter, setEndDateFilter] = useState<string | null>(normalizedInitialEndDate ?? null);
  const [endDateInput, setEndDateInput] = useState<string>(normalizedInitialEndDate ?? "");
  const [endDateInputError, setEndDateInputError] = useState<string | null>(null);
  const [symbolInput, setSymbolInput] = useState<string>("");
  const [symbolInputError, setSymbolInputError] = useState<string | null>(null);
  const [symbolInputPending, setSymbolInputPending] = useState(false);
  const [symbolPersistenceReady, setSymbolPersistenceReady] = useState(false);
  const [timeframePersistenceReady, setTimeframePersistenceReady] = useState(false);
  const [historyChunkCount, setHistoryChunkCount] = useState(0);
  const [candlesPending, setCandlesPending] = useState(false);
  const [isInverted, setIsInverted] = useState(false);
  const [legendSnapshot, setLegendSnapshot] = useState<LegendValues | null>(null);
  const [indicatorSnapshot, setIndicatorSnapshot] = useState<IndicatorLegendEntry[]>([]);
  const [gridLayouts, setGridLayouts] = useState<Layouts>(() => {
    if (consumeGridResetFlag()) {
      return cloneLayouts(DEFAULT_LAYOUTS);
    }
    const persisted = readGridLayoutCookie();
    return mergeLayouts(DEFAULT_LAYOUTS, persisted);
  });
  const [volumeEnabled, setVolumeEnabled] = useState(true);

  const bundleRef = useRef<ChartBundle | null>(null);
  const timestampsRef = useRef<UTCTimestamp[]>([]);
  const fullTimelineRef = useRef<UTCTimestamp[]>([]); // Maintains complete timestamps for keyboard end-date navigation.
  const fullTimelineKeyRef = useRef<string | null>(null);
  const fullCandlesRef = useRef<Candle[]>([]); // Stores full candle data for local stepping without refetch.
  const suppressNextCandleFetchRef = useRef(false); // Skips fetch when end date navigation adjusts candles locally.
  const suppressIndicatorResetRef = useRef(false); // Prevents indicator teardown during local candle stepping.
  const fullChartDataRef = useRef<{ data: CandlestickData[]; volumes: HistogramData[]; timestamps: UTCTimestamp[] } | null>(null);
  const activeSliceRangeRef = useRef<{ start: number; end: number } | null>(null);
  const selectionInitRef = useRef(false);
  const legendRef = useRef<HTMLDivElement | null>(null);
  const lastLegendValuesRef = useRef<LegendValues | null>(null);
  const lastIndicatorEntriesRef = useRef<IndicatorLegendEntry[]>([]);
  const candleLegendColorsRef = useRef<CandleColorScheme>({ ...DEFAULT_CANDLE_COLORS });
  const markerLayerRef = useRef<HTMLDivElement | null>(null);
  const markerLabelEntriesRef = useRef<MarkerLabelEntry[]>([]);
  const indicatorCacheRef = useRef<Map<string, CachedIndicatorEntry>>(new Map());
  const indicatorRawRef = useRef<Map<string, IndicatorSeriesData[]>>(new Map());
  const indicatorHandlesRef = useRef<Map<string, (AnySeries | CandleFillSeries)[]>>(new Map());
  const timestampIndexRef = useRef<Map<number, number>>(new Map());
  const selectionRef = useRef<Set<string>>(new Set(DEFAULT_INDICATORS));
  const definitionMapRef = useRef<Map<string, IndicatorDefinition>>(new Map());
  const candlesRef = useRef<Candle[]>([]);
  const panelScaleIdsRef = useRef<Set<string>>(new Set(["right", "volume"]));
  const symbolButtonRefs = useRef<Map<string, HTMLButtonElement>>(new Map());
  const symbolInputRef = useRef<HTMLInputElement | null>(null);
  const startDateInputRef = useRef<HTMLInputElement | null>(null);
  const endDateInputRef = useRef<HTMLInputElement | null>(null);
  const lastPersistedSymbolRef = useRef<string | null>(initialStoredSymbol);
  const symbolPersistenceReadyRef = useRef<boolean>(false);
  const timeframeButtonRefs = useRef<Map<string, HTMLButtonElement>>(new Map());
  const timeframeContainerRef = useRef<HTMLDivElement | null>(null);
  const lastPersistedFrameRef = useRef<string | null>(initialStoredFrame);
  const timeframePersistenceReadyRef = useRef<boolean>(false);
  const baseHistoryCountRef = useRef<number | null>(null);
  const candleLimitRef = useRef<number | null>(null);
  const inversionRef = useRef<boolean>(false);
  const scaleStatsRef = useRef<Map<string, ScaleStats>>(new Map());
  const volumeEnabledRef = useRef<boolean>(true);
  const favoriteDragSymbolRef = useRef<string | null>(null);

  const ensureStatsEntry = (statsMap: Map<string, ScaleStats>, scaleId: string): ScaleStats => {
    const existing = statsMap.get(scaleId);
    if (existing) {
      return existing;
    }
    const created: ScaleStats = { min: Number.POSITIVE_INFINITY, max: Number.NEGATIVE_INFINITY };
    statsMap.set(scaleId, created);
    return created;
  };

  const updateStatsEntry = (entry: ScaleStats, value: number): void => {
    if (!Number.isFinite(value)) {
      return;
    }
    if (value < entry.min) {
      entry.min = value;
    }
    if (value > entry.max) {
      entry.max = value;
    }
  };

  const rebuildScaleStats = useCallback(() => {
    const stats = new Map<string, ScaleStats>();
    const candleList = candlesRef.current;
    if (candleList.length > 0) {
      const priceStats = ensureStatsEntry(stats, "right");
      const volumeStats = volumeEnabledRef.current ? ensureStatsEntry(stats, "volume") : null;
      candleList.forEach((candle) => {
        updateStatsEntry(priceStats, candle.open);
        updateStatsEntry(priceStats, candle.high);
        updateStatsEntry(priceStats, candle.low);
        updateStatsEntry(priceStats, candle.close);
        if (volumeStats && Number.isFinite(candle.volume)) {
          updateStatsEntry(volumeStats, candle.volume ?? 0);
        }
      });
    }

    const activeSelection = selectionRef.current;
    activeSelection.forEach((indicatorKey) => {
      const seriesList = indicatorRawRef.current.get(indicatorKey);
      if (!seriesList) {
        return;
      }
      seriesList.forEach((series) => {
        const scaleId = getPriceScaleId(series.panel ?? "overlay");
        const entry = ensureStatsEntry(stats, scaleId);
        series.values.forEach((value) => updateStatsEntry(entry, value));
      });
    });

    scaleStatsRef.current = stats;
  }, []);

  const transformValueForScale = useCallback(
    (scaleId: string, value: number): number => {
      if (!inversionRef.current || scaleId === "volume") {
        return value;
      }
      if (!Number.isFinite(value)) {
        return value;
      }
      const stats = scaleStatsRef.current.get(scaleId);
      if (!stats) {
        return value;
      }
      const { min, max } = stats;
      if (!Number.isFinite(min) || !Number.isFinite(max) || max <= min) {
        return value;
      }
      return min + max - value;
    },
    []
  );

  const restoreValueForScale = useCallback(
    (scaleId: string, value: number): number => {
      if (!inversionRef.current || scaleId === "volume") {
        return value;
      }
      const stats = scaleStatsRef.current.get(scaleId);
      if (!stats) {
        return value;
      }
      const { min, max } = stats;
      if (!Number.isFinite(min) || !Number.isFinite(max) || max <= min) {
        return value;
      }
      return min + max - value;
    },
    []
  );

  const transformCandlePoint = useCallback(
    (scaleId: string, candle: CandlestickData<Time>): CandlestickData<Time> => {
      if (!inversionRef.current) {
        return candle;
      }
      const stats = scaleStatsRef.current.get(scaleId);
      if (!stats) {
        return candle;
      }
      const { min, max } = stats;
      if (!Number.isFinite(min) || !Number.isFinite(max) || max <= min) {
        return candle;
      }
      const offset = min + max;
      const invertedOpen = offset - candle.open;
      const invertedClose = offset - candle.close;
      const invertedHigh = offset - candle.low;
      const invertedLow = offset - candle.high;
      return {
        ...candle,
        open: invertedOpen,
        high: invertedHigh,
        low: invertedLow,
        close: invertedClose
      };
    },
    []
  );

  const transformHistogramPoint = useCallback(
    (scaleId: string, item: HistogramData<Time>): HistogramData<Time> => {
      if (!inversionRef.current || scaleId === "volume") {
        return item;
      }
      const transformedValue = transformValueForScale(scaleId, item.value);
      if (transformedValue === item.value) {
        return item;
      }
      return { ...item, value: transformedValue };
    },
    [transformValueForScale]
  );

  const refreshVolumeSeries = useCallback(() => {
    const context = bundleRef.current;
    if (!context) {
      return;
    }
    if (!volumeEnabledRef.current) {
      context.volumeSeries.setData([]);
      context.chart.priceScale("volume").applyOptions({ visible: false });
      return;
    }
    const candleList = candlesRef.current;
    if (candleList.length === 0) {
      context.volumeSeries.setData([]);
      context.chart.priceScale("volume").applyOptions({ visible: true, scaleMargins: { top: 0.75, bottom: 0 } });
      return;
    }
    const { volumes } = mapCandlesToData(candleList);
    const data = inversionRef.current
      ? volumes.map((item) => transformHistogramPoint("volume", item))
      : volumes;
    context.volumeSeries.setData(data);
    context.chart.priceScale("volume").applyOptions({ visible: true, scaleMargins: { top: 0.75, bottom: 0 } });
  }, [transformHistogramPoint]);

  const formatValueForScale = useCallback(
    (scaleId: string, value: number, kind: "price" | "volume" | "indicator" = "price"): string => {
      const restored = restoreValueForScale(scaleId, value);
      if (kind === "volume") {
        return formatVolume(restored);
      }
      if (kind === "indicator") {
        return formatIndicatorValue(restored);
      }
      return formatPrice(restored);
    },
    [restoreValueForScale]
  );

  const applyPanelLayout = useCallback(() => {
    const context = bundleRef.current;
    if (!context) {
      return;
    }

    const selectionSet = selectionRef.current;
    const cacheMap = indicatorCacheRef.current;
    const activePanels = new Set<string>();

    selectionSet.forEach((key) => {
      const cache = cacheMap.get(key);
      if (!cache) {
        return;
      }
      cache.seriesList.forEach((series) => {
        const panelName = series.panel ?? "overlay";
        if (panelName !== "overlay" && panelName !== "volume") {
          activePanels.add(panelName);
        }
      });
    });

  const orderedPanels = Array.from(activePanels).sort((left, right) => left.localeCompare(right));
  const includeVolumePanel = volumeEnabledRef.current;
  const segments = 1 + (includeVolumePanel ? 1 : 0) + orderedPanels.length;
  const gap = segments > 1 ? 0.015 : 0;
  const topPad = 0.08;
  const bottomPad = 0.05;
  const available = Math.max(0, 1 - topPad - bottomPad - gap * (segments - 1));
  const baseMainWeight = 3;
  const baseVolumeWeight = includeVolumePanel ? 1 : 0;
  const subWeights = orderedPanels.map((panel) => PANEL_WEIGHT_OVERRIDES[panel] ?? 1);
  const totalWeight = baseMainWeight + baseVolumeWeight + subWeights.reduce((sum, value) => sum + value, 0);
  const shareMain = totalWeight > 0 ? (available * baseMainWeight) / totalWeight : available;
  const shareVolume = includeVolumePanel && totalWeight > 0 ? (available * baseVolumeWeight) / totalWeight : 0;
  const shareSubs = subWeights.map((weight) => (totalWeight > 0 ? (available * weight) / totalWeight : 0));

  const shares: number[] = includeVolumePanel ? [shareMain, shareVolume, ...shareSubs] : [shareMain, ...shareSubs];
    const suffixShares = new Array<number>(segments).fill(0);
    for (let idx = segments - 2; idx >= 0; idx -= 1) {
      suffixShares[idx] = suffixShares[idx + 1] + shares[idx + 1];
    }

    const newScaleIds = new Set<string>(["right"]);
    if (includeVolumePanel) {
      newScaleIds.add("volume");
    }
    let prefixSum = 0;

    for (let idx = 0; idx < segments; idx += 1) {
      let scaleId: string;
      if (idx === 0) {
        scaleId = "right";
      } else if (includeVolumePanel && idx === 1) {
        scaleId = "volume";
      } else {
        const offset = includeVolumePanel ? 2 : 1;
        const panelName = orderedPanels[idx - offset];
        scaleId = getPriceScaleId(panelName);
        newScaleIds.add(scaleId);
      }

      const topMargin = topPad + prefixSum + gap * idx;
      let bottomMargin = bottomPad + suffixShares[idx] + gap * (segments - idx - 1);
      if (idx === 0) {
        const limit = includeVolumePanel ? 0.34 : 0.2;
        bottomMargin = Math.min(limit, bottomMargin);
      }
      bottomMargin = Math.min(0.45, Math.max(0, bottomMargin));
      const isVolumeScale = scaleId === "volume";
      context.chart.priceScale(scaleId).applyOptions({
        visible: !isVolumeScale,
        borderVisible: false,
        autoScale: true,
        mode: PriceScaleMode.Normal,
        alignLabels: true,
        scaleMargins: {
          top: Math.min(0.9, Math.max(0, topMargin)),
          bottom: Math.min(0.9, Math.max(0, bottomMargin))
        }
      });

      prefixSum += shares[idx];
    }

    const previous = panelScaleIdsRef.current;
    previous.forEach((scaleId) => {
      if (!newScaleIds.has(scaleId) && scaleId.startsWith(PANEL_SCALE_PREFIX)) {
        context.chart.priceScale(scaleId).applyOptions({
          visible: false,
          scaleMargins: { top: 0.9, bottom: 0.05 }
        });
      }
    });

    if (!includeVolumePanel) {
      context.chart.priceScale("volume").applyOptions({
        visible: false,
        scaleMargins: { top: 0.9, bottom: 0.05 }
      });
    }

    panelScaleIdsRef.current = newScaleIds;
  }, []);


  const updateLegendDisplay = useCallback(
    (price?: LegendValues | null, indicatorEntries?: IndicatorLegendEntry[]) => {
      const node = legendRef.current;
      if (!node) {
        return;
      }
  const priceMarkup = buildLegendMarkup(price ?? undefined, candleLegendColorsRef.current);
      const indicators = (indicatorEntries ?? []).filter((entry) => entry.values.length > 0);
      if (indicators.length === 0) {
        node.innerHTML = `<div class="legend-price">${priceMarkup}</div>`;
        return;
      }
      const indicatorBlocks = indicators
        .map(
          (entry) => {
            const valueHtml = entry.values
              .map((item) => {
                const colorAttr = item.color ? ` style="color:${escapeHtml(item.color)}"` : "";
                return `<span class="legend-indicator-value"${colorAttr}>${escapeHtml(item.text)}</span>`;
              })
              .join(" ");
            return `<span class="legend-indicator"><strong>${escapeHtml(entry.label)}</strong> ${valueHtml}</span>`;
          }
        )
        .join("");
  node.innerHTML = `<div class="legend-price">${priceMarkup}</div><div class="legend-indicators">${indicatorBlocks}</div>`;
    },
    []
  );

  const applyLegendState = useCallback(
    (values: LegendValues | null, entries: IndicatorLegendEntry[] = []) => {
      lastLegendValuesRef.current = values;
      lastIndicatorEntriesRef.current = entries;
      updateLegendDisplay(values, entries);
      setLegendSnapshot(values);
      setIndicatorSnapshot(entries);
    },
    [updateLegendDisplay]
  );

  const syncLegendState = useCallback(() => {
    updateLegendDisplay(lastLegendValuesRef.current, lastIndicatorEntriesRef.current);
    setLegendSnapshot(lastLegendValuesRef.current);
    setIndicatorSnapshot(lastIndicatorEntriesRef.current);
  }, [updateLegendDisplay]);

  const computeIndicatorEntries = useCallback((index: number | undefined): IndicatorLegendEntry[] => {
    if (typeof index !== "number") {
      return [];
    }
    const timeline = timestampsRef.current;
    if (index < 0 || index >= timeline.length) {
      return [];
    }
    const targetTime = Number(timeline[index]);
    if (!Number.isFinite(targetTime)) {
      return [];
    }

    const result: IndicatorLegendEntry[] = [];
    const selectionSet = selectionRef.current;
    const definitionMap = definitionMapRef.current;

    selectionSet.forEach((key) => {
      const cache = indicatorCacheRef.current.get(key);
      if (!cache) {
        return;
      }
      const label = definitionMap.get(key)?.name ?? key;
      const items: IndicatorLegendValue[] = [];

      cache.seriesList.forEach((series, seriesIndex) => {
        if (series.fillTarget) {
          return;
        }

        const scaleId = getPriceScaleId(series.panel ?? "overlay");
        if (series.plotMode === "markers") {
          const markerItems = cache.markers.get(series.name) ?? [];
          markerItems.forEach((item) => {
            if (Number(item.dataPoint.time) !== targetTime) {
              return;
            }
            const text = item.label?.text?.trim() || item.marker.text?.trim();
            if (!text) {
              return;
            }
            const markerColorSource = item.label?.textColor || item.marker.color;
            const markerColor = normalizeDisplayColor(markerColorSource);
            const markerIdBase = series.name ?? `${key}-${seriesIndex}`;
            items.push({
              id: `${markerIdBase}-marker-${item.index}`,
              text,
              color: markerColor ?? markerColorSource ?? undefined
            });
          });
          return;
        }

  const alignedPoints = cache.aligned.get(series.name) ?? [];
  const lookup = cache.valueByTime.get(series.name);
        const point = lookup?.get(targetTime);
        let numeric = point?.value;
        let color = point?.color;
        let valueIndex = point?.index;

        if (!Number.isFinite(numeric) && index < series.values.length) {
          const fallbackValue = series.values[index];
          if (Number.isFinite(fallbackValue)) {
            numeric = fallbackValue;
            valueIndex = index;
          }
        }

        if (!Number.isFinite(numeric)) {
          return;
        }

        const seriesLabel = (series.name ?? "").trim();
        const restored = restoreValueForScale(scaleId, Number(numeric));
        let formatted: string;
        if (scaleId === "right") {
          formatted = formatPrice(restored);
        } else if (scaleId === "volume") {
          formatted = formatVolume(restored);
        } else {
          formatted = formatIndicatorValue(restored);
        }

        if (typeof color !== "string" && typeof valueIndex === "number") {
          const alignedPoint = alignedPoints.find((candidate) => candidate.index === valueIndex);
          color = alignedPoint?.color;
        }
        if (typeof color !== "string") {
          const matching = alignedPoints.find((candidate) => Number(candidate.time) === targetTime);
          if (matching) {
            color = matching.color;
            if (typeof valueIndex !== "number") {
              valueIndex = matching.index;
            }
          }
        }

        const colorFromSeries =
          typeof valueIndex === "number" && Array.isArray(series.colorValues)
            ? series.colorValues[valueIndex]
            : undefined;
        const resolvedColor = color ?? colorFromSeries ?? series.color ?? pickColor(series);
        const displayColor = normalizeDisplayColor(resolvedColor) ?? resolvedColor;
        const baseId = series.name ?? `${key}-${seriesIndex}`;
        const itemId = `${baseId}-${targetTime}`;
        items.push({ id: itemId, text: formatted, color: displayColor });
      });

      if (items.length === 0) {
        return;
      }

      result.push({ key, label, values: items });
    });

    return result;
  }, [restoreValueForScale]);


  const updateMarkerLabels = useCallback(() => {
    const context = bundleRef.current;
    const layer = markerLayerRef.current;
    if (!context) {
      return;
    }
    if (!layer) {
      return;
    }
    const width = layer.clientWidth;
    const height = layer.clientHeight;
    markerLabelEntriesRef.current.forEach((entry) => {
      entry.items.forEach((item) => {
        const element = item.element;
        const logicalRange = context.chart.timeScale().getVisibleLogicalRange();
        if (
          logicalRange &&
          typeof logicalRange.from === "number" &&
          typeof logicalRange.to === "number" &&
          (item.index < logicalRange.from - 1 || item.index > logicalRange.to + 1)
        ) {
          element.style.opacity = "0";
          return;
        }

        const xRaw = context.chart.timeScale().timeToCoordinate(item.marker.time);
        const yRaw = entry.series.priceToCoordinate(item.dataPoint.value);
        if (typeof xRaw !== "number" || typeof yRaw !== "number") {
          element.style.opacity = "0";
          return;
        }
        const x = xRaw + item.offsetX;
        const y = yRaw + item.offsetY;
        element.style.opacity = "1";
        element.style.transform = `translate(${Math.round(x)}px, ${Math.round(y)}px)`;
      });
    });
  }, []);

  const clearMarkerLabels = useCallback(() => {
    markerLabelEntriesRef.current.forEach((entry) => {
      entry.items.forEach((item) => {
        item.element.remove();
      });
    });
    markerLabelEntriesRef.current = [];
  }, []);

  const removeMarkerLabelsByKey = useCallback((indicatorKey: string) => {
    markerLabelEntriesRef.current = markerLabelEntriesRef.current.filter((entry) => {
      if (entry.key && entry.key !== indicatorKey) {
        return true;
      }
      entry.items.forEach((item) => {
        item.element.remove();
      });
      return false;
    });
  }, []);

  const registerMarkerLabels = useCallback(
    (indicatorKey: string, seriesApi: LineSeries, items: MarkerRenderData[]) => {
      const layer = markerLayerRef.current;
      if (!layer) {
        return;
      }

      const duplicates = new Map<string, number>();
      const entry: MarkerLabelEntry = { series: seriesApi, items: [], key: indicatorKey };

      items.forEach((dataItem) => {
        const label = dataItem.label;
        if (!label || !label.text) {
          return;
        }

        const element = document.createElement("div");
        element.className = "marker-label";
        element.textContent = label.text;
        element.style.position = "absolute";
        element.style.whiteSpace = "nowrap";
        element.style.pointerEvents = "none";
        element.style.transform = "translate(-9999px, -9999px)";
        element.style.opacity = "0";
        if (label.textColor) {
          element.style.color = label.textColor;
        }
        if (label.backgroundColor) {
          element.style.backgroundColor = label.backgroundColor;
          element.style.padding = "2px 4px";
          element.style.borderRadius = "3px";
        }
        layer.appendChild(element);

        const baseOffsetX = label.offsetX ?? 12;
        const baseOffsetY = label.offsetY ?? 0;
        const duplicateKey = String(dataItem.index);
        const duplicateIndex = duplicates.get(duplicateKey) ?? 0;
        duplicates.set(duplicateKey, duplicateIndex + 1);
        const computedOffsetX = baseOffsetX + duplicateIndex * 18;
        const computedOffsetY = baseOffsetY;

        entry.items.push({
          marker: dataItem.marker,
          dataPoint: dataItem.dataPoint,
          index: dataItem.index,
          offsetX: computedOffsetX,
          offsetY: computedOffsetY,
          element,
        });
      });

      if (entry.items.length === 0) {
        return;
      }

      markerLabelEntriesRef.current.push(entry);
      if (typeof requestAnimationFrame === "function") {
        requestAnimationFrame(() => updateMarkerLabels());
      } else {
        updateMarkerLabels();
      }
    },
    [updateMarkerLabels]
  );

  const containerRef = useMemo(() => createContainer(), []);


  useEffect(() => {
    if (!selectionInitRef.current) {
      return;
    }
    writeIndicatorSelectionCookie(selection);
  }, [selection]);

  useEffect(() => {
    writeFavoriteSymbolsCookie(favoriteSymbols);
  }, [favoriteSymbols]);

  useEffect(() => {
    writeStartDateCookie(startDateFilter);
  }, [startDateFilter]);

  useEffect(() => {
    writeEndDateCookie(endDateFilter);
  }, [endDateFilter]);

  useEffect(() => {
    const map = new Map<string, IndicatorDefinition>();
    definitions.forEach((definition) => {
      map.set(definition.key, definition);
    });
    definitionMapRef.current = map;

    const timeline = timestampsRef.current;
    if (timeline.length === 0) {
      return;
    }
    const lastIndex = timeline.length - 1;
    const entries = computeIndicatorEntries(lastIndex);
    applyLegendState(lastLegendValuesRef.current, entries);
  }, [definitions, computeIndicatorEntries, applyLegendState]);

  useEffect(() => {
    const node = symbolButtonRefs.current.get(symbol);
    if (!node) {
      return;
    }
    try {
  const container = node.closest(".symbol-list-container") as HTMLDivElement | null;
      if (container) {
        const containerRect = container.getBoundingClientRect();
        const nodeRect = node.getBoundingClientRect();
        const nodeTop = nodeRect.top - containerRect.top + container.scrollTop;
        const nodeBottom = nodeTop + nodeRect.height;
        const viewTop = container.scrollTop;
        const viewBottom = viewTop + container.clientHeight;

        if (nodeTop < viewTop) {
          container.scrollTop = nodeTop;
          return;
        }
        if (nodeBottom > viewBottom) {
          container.scrollTop = nodeBottom - container.clientHeight;
          return;
        }
        return;
      }
      node.scrollIntoView({ block: "nearest", inline: "nearest" });
    } catch (error) {
      console.warn("심볼 목록 스크롤 이동 실패", error);
      node.scrollIntoView({ block: "nearest", inline: "nearest" });
    }
  }, [symbol, symbols]);

  useEffect(() => {
    const normalized = normalizeStoredFrame(frame);
    if (!normalized) {
      return;
    }
    const node = timeframeButtonRefs.current.get(normalized);
    if (!node) {
      return;
    }
    const container = timeframeContainerRef.current;
    if (container) {
      const buttonLeft = node.offsetLeft;
      const buttonRight = buttonLeft + node.offsetWidth;
      const viewLeft = container.scrollLeft;
      const viewRight = viewLeft + container.clientWidth;
      if (buttonLeft < viewLeft) {
        container.scrollLeft = buttonLeft;
      } else if (buttonRight > viewRight) {
        container.scrollLeft = buttonRight - container.clientWidth;
      }
      return;
    }
    try {
      node.scrollIntoView({ block: "nearest", inline: "center" });
    } catch (error) {
      node.scrollIntoView({ block: "nearest" });
    }
  }, [frame]);

  useEffect(() => {
    if (!symbolPersistenceReady) {
      return;
    }
    const normalized = typeof symbol === "string" && symbol.trim().length > 0 ? symbol.trim().toUpperCase() : "";
    const next = normalized.length > 0 ? normalized : null;
    if (lastPersistedSymbolRef.current === next) {
      return;
    }
    lastPersistedSymbolRef.current = next;
    if (typeof window !== "undefined" && window.localStorage) {
      try {
        if (next) {
          window.localStorage.setItem(LOCAL_STORAGE_SYMBOL_KEY, next);
        } else {
          window.localStorage.removeItem(LOCAL_STORAGE_SYMBOL_KEY);
        }
      } catch (storageError) {
        console.warn("로컬 저장소에 마지막 심볼을 기록하지 못했습니다.", storageError);
      }
    }
    void persistLastSymbol(next);
  }, [symbol, symbolPersistenceReady]);

  useEffect(() => {
    if (!timeframePersistenceReady) {
      return;
    }
    const normalized = normalizeStoredFrame(frame);
    if (lastPersistedFrameRef.current === normalized) {
      return;
    }
    lastPersistedFrameRef.current = normalized;
    if (typeof window !== "undefined" && window.localStorage) {
      try {
        if (normalized) {
          window.localStorage.setItem(LOCAL_STORAGE_FRAME_KEY, normalized);
        } else {
          window.localStorage.removeItem(LOCAL_STORAGE_FRAME_KEY);
        }
      } catch (storageError) {
        console.warn("로컬 저장소에 마지막 타임프레임을 기록하지 못했습니다.", storageError);
      }
    }
    void persistLastFrame(normalized);
  }, [frame, timeframePersistenceReady]);

  useEffect(() => {
    baseHistoryCountRef.current = null;
    candleLimitRef.current = null;
    setHistoryChunkCount(0);
  }, [symbol, frame]);

  const detachIndicator = useCallback(
    (indicatorKey: string, options?: { clearCache?: boolean; suppressRebuild?: boolean }) => {
      const context = bundleRef.current;
      const handles = indicatorHandlesRef.current.get(indicatorKey);
      if (handles && context) {
        handles.forEach((series) => {
          context.chart.removeSeries(series);
        });
      }
      indicatorHandlesRef.current.delete(indicatorKey);
      removeMarkerLabelsByKey(indicatorKey);
      if (options?.clearCache) {
        indicatorCacheRef.current.delete(indicatorKey);
        indicatorRawRef.current.delete(indicatorKey);
      }
      if (!options?.suppressRebuild) {
        rebuildScaleStats();
      }
    },
        [removeMarkerLabelsByKey, rebuildScaleStats]
  );

  const resetIndicators = useCallback(() => {
    const context = bundleRef.current;
    if (context) {
      indicatorHandlesRef.current.forEach((handles, key) => {
        handles.forEach((series) => {
          context.chart.removeSeries(series);
        });
        removeMarkerLabelsByKey(key);
      });
    }
    indicatorHandlesRef.current.clear();
    indicatorCacheRef.current.clear();
    indicatorRawRef.current.clear();
    clearMarkerLabels();
    applyLegendState(lastLegendValuesRef.current, []);
    applyPanelLayout();
    rebuildScaleStats();
  }, [removeMarkerLabelsByKey, clearMarkerLabels, applyLegendState, applyPanelLayout, rebuildScaleStats]);

  const applyStartDateFilter = useCallback(
    (next: string | null) => {
      if (next && endDateFilter && next > endDateFilter) {
        setStartDateInput(next);
        setStartDateInputError("시작일은 마감일보다 같거나 이전이어야 합니다.");
        return;
      }
      if (startDateFilter === next) {
        setStartDateInput(next ?? "");
        setStartDateInputError(null);
        setEndDateInputError(null);
        return;
      }
      setStartDateFilter(next);
      setStartDateInput(next ?? "");
      setStartDateInputError(null);
      setEndDateInputError(null);
      baseHistoryCountRef.current = null;
      candleLimitRef.current = null;
      setHistoryChunkCount(0);
      resetIndicators();
      candlesRef.current = [];
      fullCandlesRef.current = [];
      fullChartDataRef.current = null;
      activeSliceRangeRef.current = null;
      fullTimelineRef.current = [];
      fullTimelineKeyRef.current = null;
      setCandles([]);
    },
    [startDateFilter, endDateFilter, resetIndicators]
  );

  const applyEndDateFilter = useCallback(
    (next: string | null) => {
      if (next && startDateFilter && next < startDateFilter) {
        setEndDateInput(next);
        setEndDateInputError("마감일은 시작일보다 같거나 이후여야 합니다.");
        return;
      }
      if (endDateFilter === next) {
        setEndDateInput(next ?? "");
        setEndDateInputError(null);
        setStartDateInputError(null);
        return;
      }
      setEndDateFilter(next);
      setEndDateInput(next ?? "");
      setEndDateInputError(null);
      setStartDateInputError(null);
      baseHistoryCountRef.current = null;
      candleLimitRef.current = null;
      setHistoryChunkCount(0);
      resetIndicators();
      candlesRef.current = [];
      fullCandlesRef.current = [];
      fullChartDataRef.current = null;
      activeSliceRangeRef.current = null;
      fullTimelineRef.current = [];
      fullTimelineKeyRef.current = null;
      setCandles([]);
    },
    [endDateFilter, startDateFilter, resetIndicators]
  );

  const markSymbolPersistenceReady = useCallback(() => {
    if (!symbolPersistenceReadyRef.current) {
      symbolPersistenceReadyRef.current = true;
      setSymbolPersistenceReady(true);
    }
  }, [setSymbolPersistenceReady]);

  const markTimeframePersistenceReady = useCallback(() => {
    if (!timeframePersistenceReadyRef.current) {
      timeframePersistenceReadyRef.current = true;
      setTimeframePersistenceReady(true);
    }
  }, [setTimeframePersistenceReady]);

  const attemptLoadSymbol = useCallback(
    async (candidate: string) => {
      const normalized = candidate.trim().toUpperCase();
      if (!/^\d{6}$/.test(normalized)) {
        setSymbolInputError("심볼은 6자리 숫자여야 합니다.");
        return;
      }
      if (symbolInputPending) {
        return;
      }
      setSymbolInputPending(true);
      setSymbolInputError(null);
      try {
        const payload = await fetchCandles({
          symbol: normalized,
          frame,
          start: startDateFilter ?? undefined,
          end: endDateFilter ?? undefined
        });
        if (!payload || !Array.isArray(payload.candles) || payload.candles.length === 0) {
          setSymbolInputError("차트 데이터를 찾을 수 없습니다.");
          return;
        }

        setSymbolInput("");
        setSymbols((prev) => {
          if (prev.includes(normalized)) {
            return prev;
          }
          const merged = [...prev, normalized];
          merged.sort((left, right) => left.localeCompare(right));
          return merged;
        });

        baseHistoryCountRef.current = null;
        setHistoryChunkCount(0);

        try {
          const refreshed = await fetchSymbols();
          if (refreshed.symbols.length > 0) {
            const refreshedList = refreshed.symbols
              .map((item) => item.toUpperCase())
              .sort((left, right) => left.localeCompare(right));
            setSymbols(refreshedList);
          }
          const normalizedServerLast = normalizeStoredSymbol(refreshed.lastSymbol);
          if (normalizedServerLast && !lastPersistedSymbolRef.current) {
            lastPersistedSymbolRef.current = normalizedServerLast;
          }
        } catch (error) {
          console.warn("심볼 목록을 새로 고칠 수 없습니다.", error);
    }

        applyLegendState(null, []);
        resetIndicators();

        const fullList = payload.candles.slice();
        const mapped = mapCandlesToData(fullList);
        fullCandlesRef.current = fullList;
        fullChartDataRef.current = mapped;
        activeSliceRangeRef.current = fullList.length > 0 ? { start: 0, end: fullList.length - 1 } : null;
        candlesRef.current = fullList;
        setCandles(fullList);
        if (fullList.length > 0) {
          baseHistoryCountRef.current = fullList.length;
        }
        const appliedLimit = typeof payload.limit === "number" && Number.isFinite(payload.limit)
          ? Math.max(0, Math.trunc(payload.limit))
          : fullList.length;
        candleLimitRef.current = appliedLimit;
        const nextFrameValue = normalizeStoredFrame(payload.frame) ?? frame;
        fullTimelineRef.current = mapped.timestamps;
        fullTimelineKeyRef.current = `${normalized}::${nextFrameValue ?? ""}`;
        setFrame(nextFrameValue);
        markSymbolPersistenceReady();
        markTimeframePersistenceReady();
        setSymbol(normalized);
      } catch (error) {
        console.error("심볼 직접 로드 실패", error);
        setSymbolInputError("차트 데이터를 찾을 수 없습니다.");
      } finally {
        setSymbolInputPending(false);
      }
    },
    [
      symbolInputPending,
      frame,
      startDateFilter,
      endDateFilter,
      resetIndicators,
      applyLegendState,
      markSymbolPersistenceReady,
      markTimeframePersistenceReady
    ]
  );

  const handleSymbolInputChange = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => {
      const raw = event.target.value;
      const sanitized = raw.replace(/[^0-9]/g, "").slice(0, 6);
      setSymbolInput(sanitized);
      if (symbolInputError) {
        setSymbolInputError(null);
      }
      if (sanitized.length === 6) {
        void attemptLoadSymbol(sanitized);
      }
    },
    [attemptLoadSymbol, symbolInputError]
  );

  const handleSymbolInputKeyDown = useCallback(
    (event: KeyboardEvent<HTMLInputElement>) => {
      if (event.key === "Enter") {
        event.preventDefault();
        if (symbolInput.length === 6) {
          void attemptLoadSymbol(symbolInput);
        } else {
          setSymbolInputError("심볼은 6자리 숫자여야 합니다.");
        }
      }
    },
    [attemptLoadSymbol, symbolInput]
  );

  const handleStartDateInputChange = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => {
      const raw = event.target.value ?? "";
      const trimmed = raw.trim();
      if (raw !== startDateInput) {
        setStartDateInput(raw);
      }
      setStartDateInputError(null);

      if (trimmed.length === 0) {
        applyStartDateFilter(null);
        return;
      }

      const normalized = normalizeDateValue(trimmed);
      if (!normalized) {
        setStartDateInputError("시작일은 YYYY-MM-DD 형식이어야 합니다.");
        return;
      }

      if (endDateFilter && normalized > endDateFilter) {
        setStartDateInput(normalized);
        setStartDateInputError("시작일은 마감일보다 같거나 이전이어야 합니다.");
        return;
      }

      applyStartDateFilter(normalized);
    },
    [applyStartDateFilter, endDateFilter, startDateInput]
  );

  const handleStartDateInputKeyDown = useCallback(
    (event: KeyboardEvent<HTMLInputElement>) => {
      if (event.key === "Enter") {
        event.preventDefault();
        const raw = event.currentTarget.value.trim();
        if (raw.length === 0) {
          setStartDateInputError(null);
          applyStartDateFilter(null);
          return;
        }
        const normalized = normalizeDateValue(raw);
        if (!normalized) {
          setStartDateInputError("시작일은 YYYY-MM-DD 형식이어야 합니다.");
          return;
        }
        if (endDateFilter && normalized > endDateFilter) {
          setStartDateInput(normalized);
          setStartDateInputError("시작일은 마감일보다 같거나 이전이어야 합니다.");
          return;
        }
        setStartDateInputError(null);
        applyStartDateFilter(normalized);
        return;
      }

      if (event.key === "Escape") {
        event.preventDefault();
        setStartDateInput(startDateFilter ?? "");
        setStartDateInputError(null);
        event.currentTarget.blur();
      }
    },
    [applyStartDateFilter, startDateFilter, endDateFilter]
  );

  const handleStartDateInputBlur = useCallback(
    (event: FocusEvent<HTMLInputElement>) => {
      const raw = event.target.value.trim();
      if (raw.length === 0) {
        if (startDateFilter !== null) {
          setStartDateInput(startDateFilter);
        } else {
          setStartDateInput("");
        }
        setStartDateInputError(null);
        return;
      }

      const normalized = normalizeDateValue(raw);
      if (!normalized) {
        setStartDateInput(startDateFilter ?? "");
        setStartDateInputError(null);
        return;
      }
      if (endDateFilter && normalized > endDateFilter) {
        setStartDateInput(startDateFilter ?? "");
        setStartDateInputError(null);
        return;
      }

      setStartDateInput(normalized);
      setStartDateInputError(null);
    },
    [startDateFilter, endDateFilter]
  );

  const handleStartDateDefault = useCallback(() => {
    if (!normalizedDefaultStartDate) {
      return;
    }
    setStartDateInputError(null);
    applyStartDateFilter(normalizedDefaultStartDate);
  }, [applyStartDateFilter, normalizedDefaultStartDate]);

  const handleStartDateReset = useCallback(() => {
    setStartDateInputError(null);
    applyStartDateFilter(null);
  }, [applyStartDateFilter]);

  const handleEndDateInputChange = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => {
      const raw = event.target.value ?? "";
      const trimmed = raw.trim();
      if (raw !== endDateInput) {
        setEndDateInput(raw);
      }
      setEndDateInputError(null);

      if (trimmed.length === 0) {
        applyEndDateFilter(null);
        return;
      }

      const normalized = normalizeDateValue(trimmed);
      if (!normalized) {
        setEndDateInputError("마감일은 YYYY-MM-DD 형식이어야 합니다.");
        return;
      }

      if (startDateFilter && normalized < startDateFilter) {
        setEndDateInput(normalized);
        setEndDateInputError("마감일은 시작일보다 같거나 이후여야 합니다.");
        return;
      }

      applyEndDateFilter(normalized);
    },
    [applyEndDateFilter, endDateInput, startDateFilter]
  );

  const handleEndDateInputKeyDown = useCallback(
    (event: KeyboardEvent<HTMLInputElement>) => {
      if (event.key === "Enter") {
        event.preventDefault();
        const raw = event.currentTarget.value.trim();
        if (raw.length === 0) {
          setEndDateInputError(null);
          applyEndDateFilter(null);
          return;
        }
        const normalized = normalizeDateValue(raw);
        if (!normalized) {
          setEndDateInputError("마감일은 YYYY-MM-DD 형식이어야 합니다.");
          return;
        }
        if (startDateFilter && normalized < startDateFilter) {
          setEndDateInput(normalized);
          setEndDateInputError("마감일은 시작일보다 같거나 이후여야 합니다.");
          return;
        }
        setEndDateInputError(null);
        applyEndDateFilter(normalized);
        return;
      }

      if (event.key === "Escape") {
        event.preventDefault();
        setEndDateInput(endDateFilter ?? "");
        setEndDateInputError(null);
        event.currentTarget.blur();
      }
    },
    [applyEndDateFilter, endDateFilter, startDateFilter]
  );

  const handleEndDateInputBlur = useCallback(
    (event: FocusEvent<HTMLInputElement>) => {
      const raw = event.target.value.trim();
      if (raw.length === 0) {
        if (endDateFilter !== null) {
          setEndDateInput(endDateFilter);
        } else {
          setEndDateInput("");
        }
        setEndDateInputError(null);
        return;
      }

      const normalized = normalizeDateValue(raw);
      if (!normalized) {
        setEndDateInput(endDateFilter ?? "");
        setEndDateInputError(null);
        return;
      }
      if (startDateFilter && normalized < startDateFilter) {
        setEndDateInput(endDateFilter ?? "");
        setEndDateInputError(null);
        return;
      }

      setEndDateInput(normalized);
      setEndDateInputError(null);
    },
    [endDateFilter, startDateFilter]
  );

  const handleEndDateToday = useCallback(() => {
    const iso = new Date().toISOString().slice(0, 10);
    setEndDateInputError(null);
    applyEndDateFilter(iso);
  }, [applyEndDateFilter]);

  const handleEndDateReset = useCallback(() => {
    setEndDateInputError(null);
    applyEndDateFilter(null);
  }, [applyEndDateFilter]);

  const handleSymbolContextMenu = useCallback(
    async (event: ReactMouseEvent<HTMLButtonElement>, targetSymbol: string) => {
      event.preventDefault();
      const trimmed = targetSymbol.trim().toUpperCase();
      if (trimmed.length === 0) {
        return;
      }
      const confirmed = window.confirm(`${trimmed} 종목을 목록에서 삭제하시겠습니까?`);
      if (!confirmed) {
        return;
      }
      try {
        const updated = await blacklistSymbolApi(trimmed);
        const nextList = updated.symbols
          .map((item) => item.toUpperCase())
          .sort((left, right) => left.localeCompare(right));
        const serverLastSymbol = normalizeStoredSymbol(updated.lastSymbol);
        lastPersistedSymbolRef.current = serverLastSymbol ?? null;
        const serverLastFrame = normalizeStoredFrame(updated.lastFrame);
        if (serverLastFrame && !timeframePersistenceReadyRef.current) {
          lastPersistedFrameRef.current = serverLastFrame;
        }
        setSymbols(nextList);
        setFavoriteSymbols((prev) => prev.filter((item) => item !== trimmed));
        setSymbolInputError(null);
        if (trimmed === symbol) {
          applyLegendState(null, []);
          resetIndicators();
          candlesRef.current = [];
          fullCandlesRef.current = [];
          fullChartDataRef.current = null;
          activeSliceRangeRef.current = null;
          fullTimelineRef.current = [];
          fullTimelineKeyRef.current = null;
          setCandles([]);
          const fallback = serverLastSymbol && nextList.includes(serverLastSymbol) ? serverLastSymbol : nextList[0];
          if (fallback && fallback !== symbol) {
            setSymbol(fallback);
          } else if (!fallback) {
            setSymbol("");
          }
        }
      } catch (error) {
        console.error("심볼 블랙리스트 등록 실패", error);
        setSymbolInputError("종목을 삭제하지 못했습니다.");
      }
    },
    [symbol, resetIndicators, applyLegendState]
  );

  const addFavoriteSymbol = useCallback((candidate: string) => {
    const normalized = candidate.trim().toUpperCase();
    if (!normalized) {
      return;
    }
    setFavoriteSymbols((prev) => {
      if (prev.includes(normalized)) {
        return prev;
      }
      return [...prev, normalized];
    });
  }, []);

  const removeFavoriteSymbol = useCallback((candidate: string) => {
    const normalized = candidate.trim().toUpperCase();
    if (!normalized) {
      return;
    }
    setFavoriteSymbols((prev) => prev.filter((item) => item !== normalized));
  }, []);

  const handleFavoriteDragStart = useCallback(
    (event: ReactDragEvent<HTMLButtonElement>, index: number) => {
      const symbolValue = favoriteSymbols[index];
      if (!symbolValue) {
        return;
      }
      favoriteDragSymbolRef.current = symbolValue;
      if (event.dataTransfer) {
        event.dataTransfer.effectAllowed = "move";
        try {
          event.dataTransfer.setData("text/plain", symbolValue);
        } catch {
        }
      }
    },
    [favoriteSymbols]
  );

  const handleFavoriteDragOver = useCallback((event: ReactDragEvent<HTMLElement>) => {
    event.preventDefault();
    if (event.dataTransfer) {
      event.dataTransfer.dropEffect = "move";
    }
  }, []);

  const handleFavoriteDrop = useCallback(
    (event: ReactDragEvent<HTMLElement>, targetSymbol: string | null) => {
      event.preventDefault();
      event.stopPropagation();
      const sourceSymbol = favoriteDragSymbolRef.current;
      favoriteDragSymbolRef.current = null;
      if (!sourceSymbol) {
        return;
      }
      setFavoriteSymbols((prev) => {
        const sourceIndex = prev.indexOf(sourceSymbol);
        if (sourceIndex === -1) {
          return prev;
        }

        let targetIndex = targetSymbol ? prev.indexOf(targetSymbol) : prev.length;
        if (targetSymbol && targetSymbol === sourceSymbol) {
          return prev;
        }
        if (!targetSymbol && sourceIndex === prev.length - 1) {
          return prev;
        }
        if (targetIndex === -1) {
          targetIndex = prev.length;
        }
        if (targetSymbol && targetIndex === sourceIndex) {
          return prev;
        }
        if (targetSymbol && targetIndex === sourceIndex + 1) {
          return prev;
        }

        const next = [...prev];
        const [moved] = next.splice(sourceIndex, 1);
        if (sourceIndex < targetIndex) {
          targetIndex -= 1;
        }
        if (targetIndex < 0) {
          targetIndex = 0;
        }
        if (targetIndex > next.length) {
          targetIndex = next.length;
        }
        next.splice(targetIndex, 0, moved);
        for (let idx = 0; idx < next.length; idx += 1) {
          if (next[idx] !== prev[idx]) {
            return next;
          }
        }
        return prev;
      });
    },
    [setFavoriteSymbols]
  );

  const handleFavoriteDragEnd = useCallback(() => {
    favoriteDragSymbolRef.current = null;
  }, []);

  const handleFavoriteContextMenu = useCallback(
    (event: ReactMouseEvent<HTMLButtonElement>, targetSymbol: string) => {
      event.preventDefault();
      removeFavoriteSymbol(targetSymbol);
    },
    [removeFavoriteSymbol]
  );

  const buildIndicatorCacheEntry = useCallback((seriesList: IndicatorSeriesData[]): CachedIndicatorEntry => {
    const aligned = new Map<string, AlignedPoint[]>();
    const markers = new Map<string, MarkerRenderData[]>();
    const valueByTime = new Map<string, Map<number, AlignedPoint>>();
    const timeline = timestampsRef.current;

    seriesList.forEach((item) => {
      const scaleId = getPriceScaleId(item.panel ?? "overlay");
      const applyTransform = inversionRef.current;
      const alignedPoints = alignSeriesPoints(
        item,
        timeline,
        scaleId,
        transformValueForScale,
        applyTransform
      );
      aligned.set(item.name, alignedPoints);
      if (alignedPoints.length > 0) {
        const lookup = new Map<number, AlignedPoint>();
        alignedPoints.forEach((point) => {
          lookup.set(Number(point.time), point);
        });
        valueByTime.set(item.name, lookup);
      }
      if (item.plotMode === "markers") {
        markers.set(
          item.name,
          alignMarkers(item, timeline, scaleId, transformValueForScale, applyTransform)
        );
      }
    });

    return { seriesList, aligned, markers, valueByTime };
  }, [transformValueForScale]);

  const renderIndicatorSeriesGroup = useCallback(
    (indicatorKey: string, entry: CachedIndicatorEntry): (AnySeries | CandleFillSeries)[] => {
      const context = bundleRef.current;
      if (!context || entry.seriesList.length === 0) {
        return [];
      }

      const handles: (AnySeries | CandleFillSeries)[] = [];

      entry.seriesList.forEach((seriesItem) => {
        const panelName = seriesItem.panel ?? "overlay";
        const priceScaleId = getPriceScaleId(panelName);

        if (seriesItem.plotMode === "markers") {
          const markerPoints = entry.markers.get(seriesItem.name) ?? [];
          const markerHandles = renderIndicatorMarkerSeries(
            seriesItem,
            markerPoints,
            context.chart,
            priceScaleId,
            registerMarkerLabels,
            indicatorKey
          );
          handles.push(...markerHandles);
          return;
        }

        const alignedPoints = entry.aligned.get(seriesItem.name) ?? [];
        if (seriesItem.fillTarget) {
          const bottomPoints = entry.aligned.get(seriesItem.fillTarget);
          const fillHandles = renderFillBetweenSeries(
            seriesItem,
            alignedPoints,
            bottomPoints,
            context.chart,
            priceScaleId,
            formatValueForScale
          );
          handles.push(...fillHandles);
        } else if (seriesItem.plotMode === "histogram") {
          const histogramHandles = renderIndicatorHistogramSeries(
            seriesItem,
            alignedPoints,
            context.chart,
            priceScaleId,
            formatValueForScale
          );
          handles.push(...histogramHandles);
        } else if (!seriesItem.name.includes("Fill")) {
          const lineHandles = renderIndicatorLineSeries(
            seriesItem,
            alignedPoints,
            context.chart,
            priceScaleId,
            formatValueForScale
          );
          handles.push(...lineHandles);
        }
      });

      return handles;
    },
    [registerMarkerLabels, formatValueForScale]
  );

  const refreshSeriesForInversion = useCallback((options?: { skipIndicators?: boolean }) => {
    const context = bundleRef.current;
    if (!context) {
      return;
    }

    const candleList = candlesRef.current;
    if (candleList.length > 0) {
      const { data, volumes } = mapCandlesToData(candleList);
      const transformedCandles = inversionRef.current
        ? data.map((point) => transformCandlePoint("right", point))
        : data;
      context.candleSeries.setData(transformedCandles);
      if (volumeEnabledRef.current) {
        const transformedVolumes = inversionRef.current
          ? volumes.map((item) => transformHistogramPoint("volume", item))
          : volumes;
        context.volumeSeries.setData(transformedVolumes);
        context.chart.priceScale("volume").applyOptions({ visible: true, scaleMargins: { top: 0.75, bottom: 0 } });
      } else {
        context.volumeSeries.setData([]);
        context.chart.priceScale("volume").applyOptions({ visible: false });
      }
    } else {
      context.candleSeries.setData([]);
      context.volumeSeries.setData([]);
    }

    if (!options?.skipIndicators) {
      const activeKeys = Array.from(selectionRef.current);
      activeKeys.forEach((key) => {
        detachIndicator(key, { suppressRebuild: true });
      });

      activeKeys.forEach((key) => {
        const rawSeries = indicatorRawRef.current.get(key) ?? [];
        const entry = buildIndicatorCacheEntry(rawSeries);
        indicatorCacheRef.current.set(key, entry);
        if (entry.seriesList.length === 0) {
          return;
        }
        const handles = renderIndicatorSeriesGroup(key, entry);
        if (handles.length > 0) {
          indicatorHandlesRef.current.set(key, handles);
        }
      });

      if (typeof requestAnimationFrame === "function") {
        requestAnimationFrame(() => updateMarkerLabels());
      } else {
        updateMarkerLabels();
      }
    }

    applyPanelLayout();
  }, [
    applyPanelLayout,
    buildIndicatorCacheEntry,
    detachIndicator,
    renderIndicatorSeriesGroup,
    transformCandlePoint,
    transformHistogramPoint,
    updateMarkerLabels
  ]);

  useEffect(() => {
    selectionRef.current = new Set(selection);
    rebuildScaleStats();
    if (inversionRef.current) {
      refreshSeriesForInversion({ skipIndicators: true });
    }
    const timeline = timestampsRef.current;
    if (timeline.length === 0) {
      applyLegendState(lastLegendValuesRef.current, []);
      return;
    }
    const lastIndex = timeline.length - 1;
    const entries = computeIndicatorEntries(lastIndex);
    applyLegendState(lastLegendValuesRef.current, entries);
  }, [
    selection,
    computeIndicatorEntries,
    applyLegendState,
    rebuildScaleStats,
    refreshSeriesForInversion
  ]);

  useEffect(() => {
    const mountNode = document.getElementById("chart-root");
    if (!mountNode) {
      return;
    }

    mountNode.innerHTML = "";
    mountNode.appendChild(containerRef);

    const chart = createChart(containerRef, {
      autoSize: true,
      layout: {
        background: { type: ColorType.Solid, color: "#f1f1f1" },
        textColor: "#202020"
      },
      grid: {
        vertLines: { color: "rgba(0, 0, 0, 0.1)", style: LineStyle.Solid },
        horzLines: { color: "rgba(0, 0, 0, 0.1)", style: LineStyle.Solid }
      },
      crosshair: {
        vertLine: { color: "rgba(96, 96, 96, 0.6)", style: LineStyle.Dotted, width: 1 },
        horzLine: { color: "rgba(96, 96, 96, 0.6)", style: LineStyle.Dotted, width: 1 }
      },
      rightPriceScale: {
        scaleMargins: { top: 0.12, bottom: 0.25 },
        borderVisible: false
      },
      timeScale: {
        timeVisible: true,
        secondsVisible: false,
        rightOffset: FUTURE_BAR_PADDING,
        barSpacing: INITIAL_BAR_SPACING,
        borderVisible: false,
        tickMarkFormatter: (time: Time) => formatTimeScaleLabel(time)
      },
      localization: {
        locale: "ko-KR",
        timeFormatter: (time: Time) => formatTimeLabel(time)
      }
    });
    chart.priceScale("right").applyOptions({ borderVisible: false, scaleMargins: { top: 0.12, bottom: 0.25 } });
    chart.timeScale().applyOptions({
      rightOffset: FUTURE_BAR_PADDING,
      borderVisible: false,
      barSpacing: INITIAL_BAR_SPACING
    });

    const candleSeries = chart.addCandlestickSeries({
      upColor: "#53b987",
      downColor: "#eb4d5c",
      borderUpColor: "#008000",
      borderDownColor: "#c2185b",
      wickUpColor: "#53b987",
      wickDownColor: "#eb4d5c",
      borderVisible: true,
      wickVisible: true,
      priceLineVisible: false,
      priceFormat: {
        type: "custom",
        minMove: 0.01,
        formatter: (value: number) => formatValueForScale("right", value, "price")
      }
    });

    const candleOptions = candleSeries.options();
    const upBodyColor = typeof candleOptions.upColor === "string" ? candleOptions.upColor : undefined;
    const downBodyColor = typeof candleOptions.downColor === "string" ? candleOptions.downColor : undefined;
    const upBorderColor = typeof candleOptions.borderUpColor === "string" ? candleOptions.borderUpColor : undefined;
    const downBorderColor = typeof candleOptions.borderDownColor === "string" ? candleOptions.borderDownColor : undefined;

    candleLegendColorsRef.current = {
      up: upBorderColor ?? upBodyColor ?? DEFAULT_CANDLE_COLORS.up,
      down: downBorderColor ?? downBodyColor ?? DEFAULT_CANDLE_COLORS.down,
      neutral: DEFAULT_CANDLE_COLORS.neutral
    };

    const volumeSeries = chart.addHistogramSeries({
      color: "rgba(83, 185, 135, 0.6)",
      priceScaleId: "volume",
      priceFormat: {
        type: "custom",
        minMove: 1,
        formatter: (value: number) => formatValueForScale("volume", value, "volume")
      },
      priceLineVisible: false,
      baseLineVisible: false
    });

    chart.priceScale("volume").applyOptions({ scaleMargins: { top: 0.75, bottom: 0 } });

  const legend = document.createElement("div");
  legend.className = "chart-legend";
  legend.innerHTML = `<div class="legend-price">${LEGEND_PLACEHOLDER_HTML}</div>`;
  containerRef.appendChild(legend);
  legendRef.current = legend;
  syncLegendState();

  const markerLayer = document.createElement("div");
  markerLayer.className = "marker-layer";
  containerRef.appendChild(markerLayer);
  markerLayerRef.current = markerLayer;

    bundleRef.current = { chart, candleSeries, volumeSeries };
    setChartReady(true);
  applyPanelLayout();

    const handleCrosshairMove = (param: MouseEventParams<Time>) => {
      const seriesDataMap = param.seriesData as unknown as Map<any, any>;
      const candleData = seriesDataMap.get(candleSeries) as CandlestickData | undefined;
      const volumeData = seriesDataMap.get(volumeSeries) as HistogramData | undefined;
      const crosshairTimestamp = extractTimestamp(param.time);
      const candleList = candlesRef.current;

      let index: number | undefined;
      if (typeof param.logical === "number" && Number.isFinite(param.logical)) {
        const logicalIndex = Math.round(param.logical);
        if (logicalIndex >= 0 && logicalIndex < candleList.length) {
          index = logicalIndex;
        }
      }
      if (index === undefined && crosshairTimestamp !== undefined) {
        index = timestampIndexRef.current.get(Number(crosshairTimestamp));
      }
      if (index === undefined && typeof candleData?.time === "number") {
        index = timestampIndexRef.current.get(Number(candleData.time));
      }

      const candleFromState = index !== undefined ? candleList[index] : undefined;
      const effectiveTimestamp =
        (candleFromState ? (candleFromState.timestamp as UTCTimestamp) : undefined) ??
        crosshairTimestamp ??
        extractTimestamp(candleData?.time);

      if (candleFromState || candleData) {
        const open = candleFromState?.open ?? candleData?.open ?? 0;
        const high = candleFromState?.high ?? candleData?.high ?? open;
        const low = candleFromState?.low ?? candleData?.low ?? open;
        const close = candleFromState?.close ?? candleData?.close ?? open;
        const volume =
          candleFromState?.volume ?? volumeData?.value ?? lastLegendValuesRef.current?.volume ?? 0;

        const values: LegendValues = {
          time: effectiveTimestamp,
          open,
          high,
          low,
          close,
          volume
        };
        const indicatorEntries = computeIndicatorEntries(index);
        applyLegendState(values, indicatorEntries);
      } else {
        syncLegendState();
      }
    };


    chart.subscribeCrosshairMove(handleCrosshairMove);

    const scheduleUpdate = () => {
      if (typeof requestAnimationFrame === "function") {
        requestAnimationFrame(() => updateMarkerLabels());
      } else {
        updateMarkerLabels();
      }
    };
    const handleRangeChange = () => scheduleUpdate();
    chart.timeScale().subscribeVisibleLogicalRangeChange(handleRangeChange);
    let resizeObserver: ResizeObserver | null = null;
    if (typeof ResizeObserver !== "undefined") {
      resizeObserver = new ResizeObserver(() => scheduleUpdate());
      resizeObserver.observe(containerRef);
    }

    return () => {
      resetIndicators();
      chart.unsubscribeCrosshairMove(handleCrosshairMove);
      chart.timeScale().unsubscribeVisibleLogicalRangeChange(handleRangeChange);
      if (resizeObserver) {
        resizeObserver.disconnect();
      }
      chart.remove();
      if (legendRef.current && legendRef.current.parentElement) {
        legendRef.current.parentElement.removeChild(legendRef.current);
      }
      legendRef.current = null;
      if (markerLayerRef.current && markerLayerRef.current.parentElement) {
        markerLayerRef.current.parentElement.removeChild(markerLayerRef.current);
      }
      markerLayerRef.current = null;
      bundleRef.current = null;
      setChartReady(false);
    };
  }, [
    containerRef,
    resetIndicators,
    updateMarkerLabels,
    applyLegendState,
    syncLegendState,
    computeIndicatorEntries,
    applyPanelLayout,
    rebuildScaleStats,
  refreshSeriesForInversion
  ]);

  useEffect(() => {
    let cancelled = false;

    fetchSymbols()
      .then(({ symbols: fetchedSymbols, lastSymbol, lastFrame }) => {
        if (cancelled) {
          return;
        }

        const normalizedSet = new Set<string>();
        fetchedSymbols.forEach((value) => {
          if (typeof value === "string" && value.trim().length > 0) {
            normalizedSet.add(value.trim().toUpperCase());
          }
        });

        if (initialStoredSymbol) {
          normalizedSet.add(initialStoredSymbol);
        }

        const normalizedServerLast = normalizeStoredSymbol(lastSymbol);
        if (normalizedServerLast) {
          normalizedSet.add(normalizedServerLast);
          if (!lastPersistedSymbolRef.current) {
            lastPersistedSymbolRef.current = normalizedServerLast;
          }
        } else if (!lastPersistedSymbolRef.current) {
          lastPersistedSymbolRef.current = null;
        }

        const normalizedServerFrame = normalizeStoredFrame(lastFrame);
        if (!lastPersistedFrameRef.current) {
          lastPersistedFrameRef.current = normalizedServerFrame ?? initialStoredFrame ?? DEFAULT_FRAME;
        }
        if (!initialStoredFrame && normalizedServerFrame && !timeframePersistenceReadyRef.current) {
          setFrame(normalizedServerFrame);
        }

        const ordered = Array.from(normalizedSet).sort((left, right) => left.localeCompare(right));
        setSymbols(ordered);

        setSymbol((current) => {
          const normalizedCurrent = typeof current === "string" && current.trim().length > 0
            ? current.trim().toUpperCase()
            : "";

          if (symbolPersistenceReadyRef.current) {
            if (normalizedCurrent && ordered.includes(normalizedCurrent)) {
              return normalizedCurrent;
            }
            if (ordered.includes(DEFAULT_SYMBOL)) {
              return DEFAULT_SYMBOL;
            }
            return ordered[0] ?? normalizedCurrent;
          }

          if (ordered.length === 0) {
            return normalizedCurrent;
          }

          const preferred = lastPersistedSymbolRef.current;
          if (preferred && ordered.includes(preferred)) {
            return preferred;
          }

          if (normalizedCurrent && ordered.includes(normalizedCurrent)) {
            return normalizedCurrent;
          }

          if (ordered.includes(DEFAULT_SYMBOL)) {
            return DEFAULT_SYMBOL;
          }

          return ordered[0];
        });
      })
      .catch((error: unknown) => {
        console.warn("심볼 목록을 가져오지 못했습니다.", error);
      })
      .finally(() => {
        if (!cancelled) {
          markSymbolPersistenceReady();
          markTimeframePersistenceReady();
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    fetchIndicatorDefinitions()
      .then((items) => {
        if (cancelled) {
          return;
        }
        setDefinitions(items);
        if (!selectionInitRef.current) {
          selectionInitRef.current = true;
          setSelection(() => {
            const defaults = new Set(DEFAULT_INDICATORS);
            items.forEach((definition) => {
              if (definition.isDefault) {
                defaults.add(definition.key);
              }
            });
            const validKeys = new Set(items.map((definition) => definition.key));
            const persistedKeys = readIndicatorSelectionCookie().filter((key) => validKeys.has(key));
            if (persistedKeys.length > 0) {
              return new Set(persistedKeys);
            }
            return defaults;
          });
        }
      })
      .catch((error: unknown) => {
        console.error("지표 정의를 가져오지 못했습니다.", error);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!chartReady) {
      setCandlesPending(false);
      return;
    }

    const activeSymbol = symbol?.trim();
    if (!activeSymbol) {
      baseHistoryCountRef.current = null;
      candleLimitRef.current = null;
      candlesRef.current = [];
      setCandles([]);
      fullTimelineRef.current = [];
      fullTimelineKeyRef.current = null;
      fullCandlesRef.current = [];
      fullChartDataRef.current = null;
      activeSliceRangeRef.current = null;
      applyLegendState(null, []);
      resetIndicators();
      setCandlesPending(false);
      return;
    }

    if (suppressNextCandleFetchRef.current) {
      suppressNextCandleFetchRef.current = false;
      setCandlesPending(false);
      return;
    }

    const baseCount = baseHistoryCountRef.current;
    const minuteFrameSelected = isMinuteFrameValue(frame);
    let requestLimit: number | undefined;
    if (historyChunkCount > 0 && baseCount && baseCount > 0) {
      const targetLimit = baseCount + historyChunkCount * HISTORY_CHUNK_SIZE;
      requestLimit = minuteFrameSelected ? Math.min(targetLimit, MAX_HISTORY_LIMIT) : targetLimit;
    }

    let cancelled = false;
    setCandlesPending(true);

    fetchCandles({
      symbol: activeSymbol,
      frame,
      limit: requestLimit,
      start: startDateFilter ?? undefined,
      end: endDateFilter ?? undefined
    })
      .then((payload) => {
        if (cancelled) {
          return;
        }
        if (payload && Array.isArray(payload.candles) && payload.candles.length > 0) {
          const fullList = payload.candles.slice();
          const mapped = mapCandlesToData(fullList);
          fullCandlesRef.current = fullList;
          fullChartDataRef.current = mapped;
          activeSliceRangeRef.current = fullList.length > 0 ? { start: 0, end: fullList.length - 1 } : null;
          candlesRef.current = fullList;
          setCandles(fullList);
          const appliedLimit = typeof payload.limit === "number" && Number.isFinite(payload.limit)
            ? Math.max(0, Math.trunc(payload.limit))
            : fullList.length;
          candleLimitRef.current = appliedLimit;
          const nextFrameValue = normalizeStoredFrame(payload.frame) ?? frame;
          if (historyChunkCount === 0) {
            baseHistoryCountRef.current = fullList.length;
          }
          const key = `${activeSymbol ?? ""}::${nextFrameValue ?? ""}`;
          fullTimelineRef.current = mapped.timestamps;
          fullTimelineKeyRef.current = key;
          setFrame(nextFrameValue);
          return;
        }

        if (historyChunkCount === 0) {
          baseHistoryCountRef.current = null;
        }
        candleLimitRef.current = null;
        candlesRef.current = [];
        setCandles([]);
        fullTimelineRef.current = [];
        fullTimelineKeyRef.current = `${activeSymbol ?? ""}::${frame ?? ""}`;
        fullCandlesRef.current = [];
        fullChartDataRef.current = null;
        activeSliceRangeRef.current = null;
        applyLegendState(null, []);
        resetIndicators();
      })
      .catch((error: unknown) => {
        console.error("캔들 데이터를 가져오지 못했습니다.", error);
        if (cancelled) {
          return;
        }
        if (historyChunkCount === 0) {
          baseHistoryCountRef.current = null;
        }
        candleLimitRef.current = null;
        candlesRef.current = [];
        setCandles([]);
        fullCandlesRef.current = [];
        fullTimelineRef.current = [];
        fullTimelineKeyRef.current = `${activeSymbol ?? ""}::${frame ?? ""}`;
        fullChartDataRef.current = null;
        activeSliceRangeRef.current = null;
        applyLegendState(null, []);
        resetIndicators();
      })
      .finally(() => {
        if (!cancelled) {
          setCandlesPending(false);
        }
      });

    return () => {
      cancelled = true;
      setCandlesPending(false);
    };
  }, [chartReady, frame, historyChunkCount, symbol, startDateFilter, endDateFilter, resetIndicators, applyLegendState]);

  useEffect(() => {
    if (candles.length === 0) {
      return;
    }

    const lastCandle = candles[candles.length - 1];
    if (!lastCandle || typeof lastCandle.timestamp !== "number" || !Number.isFinite(lastCandle.timestamp)) {
      return;
    }

    const candidateDate = new Date(Math.trunc(lastCandle.timestamp) * 1000);
    if (Number.isNaN(candidateDate.getTime())) {
      return;
    }

    const normalized = candidateDate.toISOString().slice(0, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(normalized)) {
      return;
    }

    if (endDateFilter === null) {
      applyEndDateFilter(normalized);
      return;
    }

    if (endDateFilter > normalized) {
      applyEndDateFilter(normalized);
      return;
    }

    if (endDateFilter === normalized && endDateInput !== normalized) {
      setEndDateInput(normalized);
    }
  }, [candles, endDateFilter, endDateInput, applyEndDateFilter]);

  useEffect(() => {
    const context = bundleRef.current;
    if (!chartReady || !context) {
      return;
    }

    if (candles.length === 0) {
      candlesRef.current = [];
      activeSliceRangeRef.current = null;
      timestampsRef.current = [];
      timestampIndexRef.current = new Map();
      context.candleSeries.setData([]);
      context.volumeSeries.setData([]);
      applyLegendState(null, []);
      resetIndicators();
      return;
    }

    candlesRef.current = candles;
    const cached = fullChartDataRef.current;
    const activeSlice = activeSliceRangeRef.current;
    const fullList = fullCandlesRef.current;
    let data: CandlestickData[];
    let timestamps: UTCTimestamp[];
    let volumes: HistogramData[];

    if (
      cached &&
      activeSlice &&
      Array.isArray(fullList) &&
      fullList.length === cached.data.length &&
      activeSlice.start >= 0 &&
      activeSlice.end >= activeSlice.start &&
      activeSlice.end < cached.data.length &&
      candles.length === activeSlice.end - activeSlice.start + 1
    ) {
      const exclusiveEnd = activeSlice.end + 1;
      if (activeSlice.start === 0 && exclusiveEnd === cached.data.length) {
        data = cached.data;
        timestamps = cached.timestamps;
        volumes = cached.volumes;
      } else {
        data = cached.data.slice(activeSlice.start, exclusiveEnd);
        timestamps = cached.timestamps.slice(activeSlice.start, exclusiveEnd);
        volumes = cached.volumes.slice(activeSlice.start, exclusiveEnd);
      }
    } else {
      const mapped = mapCandlesToData(candles);
      data = mapped.data;
      timestamps = mapped.timestamps;
      volumes = mapped.volumes;
      if (candles.length > 0 && Array.isArray(fullList) && candles.length === fullList.length) {
        fullChartDataRef.current = mapped;
        activeSliceRangeRef.current = { start: 0, end: candles.length - 1 };
      }
    }

    timestampsRef.current = timestamps;
    const indexLookup = new Map<number, number>();
    timestamps.forEach((time, idx) => {
      indexLookup.set(Number(time), idx);
    });
    timestampIndexRef.current = indexLookup;
    rebuildScaleStats();

    const transformedCandles = inversionRef.current
      ? data.map((point) => transformCandlePoint("right", point))
      : data;

    context.candleSeries.setData(transformedCandles);
    if (volumeEnabledRef.current) {
      const transformedVolumes = inversionRef.current
        ? volumes.map((item) => transformHistogramPoint("volume", item))
        : volumes;
      context.volumeSeries.setData(transformedVolumes);
      context.chart.priceScale("volume").applyOptions({ visible: true, scaleMargins: { top: 0.75, bottom: 0 } });
    } else {
      context.volumeSeries.setData([]);
      context.chart.priceScale("volume").applyOptions({ visible: false });
    }

    let nextLegend: LegendValues | null = null;
    if (candles.length > 0) {
      const last = candles[candles.length - 1];
      nextLegend = {
        time: last.timestamp as UTCTimestamp,
        open: last.open,
        high: last.high,
        low: last.low,
        close: last.close,
        volume: last.volume ?? 0
      };
    }

    if (timestamps.length > 0) {
      const timeScale = context.chart.timeScale();
      timeScale.applyOptions({ barSpacing: INITIAL_BAR_SPACING });

      const containerElement = containerRef ?? null;
      const containerWidth = containerElement ? containerElement.clientWidth || containerElement.offsetWidth || 0 : 0;
      const derivedVisibleBars = containerWidth > 0
        ? Math.max(1, Math.round(containerWidth / INITIAL_BAR_SPACING))
        : INITIAL_VISIBLE_BAR_FALLOFF;

      const lastIndex = timestamps.length - 1;
      const visibleCount = Math.min(MAX_CANDLES_ON_SCREEN, INITIAL_VISIBLE_BAR_FALLOFF, derivedVisibleBars, timestamps.length);
      const fromIndex = Math.max(0, lastIndex - visibleCount + 1);

      timeScale.setVisibleLogicalRange({ from: fromIndex, to: lastIndex + FUTURE_BAR_PADDING });
    }

    const indicatorEntries = timestamps.length > 0
      ? computeIndicatorEntries(timestamps.length - 1)
      : [];

    applyLegendState(nextLegend, indicatorEntries);

    if (suppressIndicatorResetRef.current) {
      suppressIndicatorResetRef.current = false;
      refreshSeriesForInversion();
    } else {
      resetIndicators();
    }
  }, [
    chartReady,
    candles,
    resetIndicators,
  computeIndicatorEntries,
  applyLegendState,
    rebuildScaleStats,
    transformCandlePoint,
    transformHistogramPoint,
    refreshSeriesForInversion
  ]);

  useEffect(() => {
    if (!chartReady) {
      return;
    }

    const context = bundleRef.current;
    if (!context || candles.length === 0) {
      return;
    }

    const activeSymbol = symbol?.trim();
    if (!activeSymbol) {
      return;
    }

    const selectedKeys = Array.from(selection);
    const handlesMap = indicatorHandlesRef.current;
    let labelsNeedUpdate = false;

    const keysToRemove: string[] = [];
    handlesMap.forEach((_, key) => {
      if (!selection.has(key)) {
        keysToRemove.push(key);
      }
    });
    keysToRemove.forEach((key) => {
      detachIndicator(key);
      labelsNeedUpdate = true;
    });

    if (keysToRemove.length > 0 && inversionRef.current) {
      refreshSeriesForInversion({ skipIndicators: true });
    }

    selectedKeys.forEach((key) => {
      const cacheEntry = indicatorCacheRef.current.get(key);
      if (cacheEntry && !handlesMap.has(key) && cacheEntry.seriesList.length > 0) {
        const handles = renderIndicatorSeriesGroup(key, cacheEntry);
        if (handles.length > 0) {
          indicatorHandlesRef.current.set(key, handles);
          labelsNeedUpdate = true;
        }
      }
    });

    const missingKeys = selectedKeys.filter((key) => !indicatorCacheRef.current.has(key));
    if (missingKeys.length === 0) {
      if (labelsNeedUpdate) {
        if (typeof requestAnimationFrame === "function") {
          requestAnimationFrame(() => updateMarkerLabels());
        } else {
          updateMarkerLabels();
        }
      }
      applyPanelLayout();
      return;
    }

    let cancelled = false;
    const baseLimit = candleLimitRef.current ?? candlesRef.current.length ?? candles.length;
    const minuteFrameSelected = isMinuteFrameValue(frame);
    const indicatorLimit = baseLimit > 0
      ? minuteFrameSelected
        ? Math.min(baseLimit + INDICATOR_HISTORY_BUFFER, MAX_HISTORY_LIMIT)
        : baseLimit + INDICATOR_HISTORY_BUFFER
      : undefined;

    fetchIndicatorSeries({
      keys: missingKeys,
      symbol: activeSymbol,
      frame,
      limit: indicatorLimit
    })
      .then((seriesList) => {
        if (cancelled) {
          return;
        }
        const grouped = new Map<string, IndicatorSeriesData[]>();
        seriesList.forEach((item) => {
          const key = item.sourceKey ?? missingKeys[0];
          const bucket = grouped.get(key) ?? [];
          bucket.push(item);
          grouped.set(key, bucket);
        });

        missingKeys.forEach((key) => {
          const groupedSeries = grouped.get(key) ?? [];
          indicatorRawRef.current.set(key, groupedSeries);
          detachIndicator(key, { suppressRebuild: true });
        });

        rebuildScaleStats();

        missingKeys.forEach((key) => {
          const rawSeries = indicatorRawRef.current.get(key) ?? [];
          const entry = buildIndicatorCacheEntry(rawSeries);
          indicatorCacheRef.current.set(key, entry);
          if (entry.seriesList.length === 0) {
            return;
          }
          const handles = renderIndicatorSeriesGroup(key, entry);
          if (handles.length > 0) {
            indicatorHandlesRef.current.set(key, handles);
          }
        });

        labelsNeedUpdate = true;

        if (inversionRef.current) {
          refreshSeriesForInversion({ skipIndicators: true });
        }

        applyPanelLayout();

        if (typeof requestAnimationFrame === "function") {
          requestAnimationFrame(() => updateMarkerLabels());
        } else {
          updateMarkerLabels();
        }

        const timeline = timestampsRef.current;
        if (timeline.length > 0) {
          const lastIndex = timeline.length - 1;
          const entries = computeIndicatorEntries(lastIndex);
          applyLegendState(lastLegendValuesRef.current, entries);
        }
      })
      .catch((error: unknown) => {
        console.error("지표 데이터를 가져오지 못했습니다.", error);
      });

    return () => {
      cancelled = true;
    };
  }, [
    chartReady,
    candles,
    frame,
    selection,
    detachIndicator,
    renderIndicatorSeriesGroup,
    updateMarkerLabels,
    buildIndicatorCacheEntry,
    symbol,
    computeIndicatorEntries,
    applyLegendState,
    applyPanelLayout
  ]);

  const handleToggle = (key: string) => {
    setSelection((prev) => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  };

  const handleToggleVolume = useCallback(() => {
    setVolumeEnabled((prev) => !prev);
  }, []);

  const handleSymbolSelect = useCallback(
    (next: string) => {
      const trimmed = next.trim().toUpperCase();
      if (!trimmed || trimmed === symbol) {
        return;
      }
      baseHistoryCountRef.current = null;
      candleLimitRef.current = null;
      setHistoryChunkCount(0);
      resetIndicators();
      candlesRef.current = [];
      fullCandlesRef.current = [];
      fullChartDataRef.current = null;
      activeSliceRangeRef.current = null;
      fullTimelineRef.current = [];
      fullTimelineKeyRef.current = null;
      setCandles([]);
      setSymbolInput("");
      setSymbolInputError(null);
      markSymbolPersistenceReady();
      setSymbol(trimmed);
    },
    [symbol, resetIndicators, markSymbolPersistenceReady]
  );

  const handleTimeframeSelect = useCallback(
    (next: string) => {
      const normalized = normalizeStoredFrame(next);
      if (!normalized || normalized === frame) {
        return;
      }
      baseHistoryCountRef.current = null;
      candleLimitRef.current = null;
      setHistoryChunkCount(0);
      resetIndicators();
      candlesRef.current = [];
      fullCandlesRef.current = [];
      fullChartDataRef.current = null;
      activeSliceRangeRef.current = null;
      fullTimelineRef.current = [];
      fullTimelineKeyRef.current = null;
      setCandles([]);
      markTimeframePersistenceReady();
      setFrame(normalized);
    },
    [frame, markTimeframePersistenceReady, resetIndicators]
  );

  const handleNavigateSymbol = useCallback(
    (direction: 1 | -1) => {
      const sourceList = favoriteSymbols.length > 0 ? favoriteSymbols : symbols;
      if (sourceList.length === 0) {
        return;
      }
      const currentIndex = symbol ? sourceList.indexOf(symbol) : -1;
      if (currentIndex === -1) {
        const fallbackIndex = direction === 1 ? 0 : sourceList.length - 1;
        const fallbackSymbol = sourceList[fallbackIndex];
        if (fallbackSymbol) {
          handleSymbolSelect(fallbackSymbol);
        }
        return;
      }
      const nextIndex = currentIndex + direction;
      if (nextIndex < 0 || nextIndex >= sourceList.length) {
        return;
      }
      const targetSymbol = sourceList[nextIndex];
      if (targetSymbol) {
        handleSymbolSelect(targetSymbol);
      }
    },
    [favoriteSymbols, symbols, symbol, handleSymbolSelect]
  );

  const handleStepEndDate = useCallback(
    (direction: 1 | -1) => {
      if (candlesPending) {
        return;
      }

      const timeline = fullTimelineRef.current;
      const fullList = fullCandlesRef.current;
      const candleList = candlesRef.current;
      if (!timeline || timeline.length === 0 || !Array.isArray(fullList) || fullList.length === 0 || !candleList || candleList.length === 0) {
        return;
      }

      const currentCandle = candleList[candleList.length - 1];
      if (!currentCandle || typeof currentCandle.timestamp !== "number" || !Number.isFinite(currentCandle.timestamp)) {
        return;
      }

      const normalizedTimestamp = Math.trunc(currentCandle.timestamp);
      const lastIndex = timeline.length - 1;
      const lowerBoundIndex = lowerBound(timeline, normalizedTimestamp);
      let currentIndex = lowerBoundIndex;
      if (
        currentIndex >= timeline.length ||
        Number(timeline[currentIndex]) !== normalizedTimestamp
      ) {
        if (currentIndex > 0 && Number(timeline[currentIndex - 1]) === normalizedTimestamp) {
          currentIndex -= 1;
        } else {
          currentIndex = lastIndex;
        }
      }

      const startSeconds = startDateFilter
        ? (() => {
            const parsed = Date.parse(`${startDateFilter}T00:00:00Z`);
            return Number.isNaN(parsed) ? null : Math.floor(parsed / 1000);
          })()
        : null;

      let minIndex = 0;
      if (startSeconds !== null) {
        const located = lowerBound(timeline, startSeconds);
        if (located >= timeline.length) {
          return;
        }
        minIndex = located;
      }

      let targetIndex = direction === -1 ? currentIndex - 1 : currentIndex + 1;

      if (direction === -1 && targetIndex < minIndex) {
        targetIndex = minIndex;
      }
      if (direction === 1 && targetIndex > lastIndex) {
        targetIndex = lastIndex;
      }

      if (targetIndex === currentIndex || targetIndex < 0 || targetIndex > lastIndex) {
        return;
      }

      const targetTimestamp = timeline[targetIndex];
      if (typeof targetTimestamp !== "number" || !Number.isFinite(targetTimestamp)) {
        return;
      }

      const targetDate = new Date(Math.trunc(targetTimestamp) * 1000);
      if (Number.isNaN(targetDate.getTime())) {
        return;
      }

      const targetIso = targetDate.toISOString().slice(0, 10);
      if (!/^\d{4}-\d{2}-\d{2}$/.test(targetIso)) {
        return;
      }

      if (startDateFilter && targetIso < startDateFilter) {
        return;
      }

      const startIndex = startSeconds !== null ? minIndex : 0;
      if (startIndex > targetIndex) {
        return;
      }

      const sliceEndExclusive = targetIndex + 1;
      const slicedCandles = fullList.slice(startIndex, sliceEndExclusive);
      if (slicedCandles.length === 0) {
        return;
      }

      if (candlesRef.current.length === slicedCandles.length && endDateFilter === targetIso) {
        return;
      }
      suppressNextCandleFetchRef.current = true;
      suppressIndicatorResetRef.current = true;
      candlesRef.current = slicedCandles;
      setCandles(slicedCandles);
      activeSliceRangeRef.current = { start: startIndex, end: sliceEndExclusive - 1 };
      const filteredLength = slicedCandles.length;
      candleLimitRef.current = filteredLength;
      if (baseHistoryCountRef.current === null || baseHistoryCountRef.current < filteredLength) {
        baseHistoryCountRef.current = filteredLength;
      }
      setEndDateFilter(targetIso);
      setEndDateInput(targetIso);
      setEndDateInputError(null);
    },
    [candlesPending, startDateFilter, endDateFilter]
  );

  useEffect(() => {
    const handleKeyDown = (event: globalThis.KeyboardEvent) => {
      if ((event.key === "i" || event.key === "I") && event.altKey && !event.ctrlKey && !event.metaKey) {
        event.preventDefault();
        setIsInverted((prev) => !prev);
        return;
      }
      if (
        event.key !== "ArrowDown" &&
        event.key !== "ArrowUp" &&
        event.key !== "ArrowLeft" &&
        event.key !== "ArrowRight"
      ) {
        return;
      }
      if (event.altKey || event.ctrlKey || event.metaKey) {
        return;
      }
      const activeElement = document.activeElement as HTMLElement | null;
      if (activeElement) {
        const tagName = activeElement.tagName.toUpperCase();
        const isSymbolInputActive = symbolInputRef.current !== null && activeElement === symbolInputRef.current;
        const isStartDateInputActive = startDateInputRef.current !== null && activeElement === startDateInputRef.current;
        const isEndDateInputActive = endDateInputRef.current !== null && activeElement === endDateInputRef.current;
        const isEditable = activeElement.isContentEditable;
        if (isStartDateInputActive || isEndDateInputActive) {
          return;
        }
        if (!isSymbolInputActive && (tagName === "INPUT" || tagName === "TEXTAREA" || isEditable)) {
          return;
        }
      }
      if (event.key === "ArrowDown" || event.key === "ArrowUp") {
        event.preventDefault();
        handleNavigateSymbol(event.key === "ArrowDown" ? 1 : -1);
        return;
      }
      if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
        event.preventDefault();
        handleStepEndDate(event.key === "ArrowRight" ? 1 : -1);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleNavigateSymbol, handleStepEndDate]);

  useEffect(() => {
    inversionRef.current = isInverted;
    rebuildScaleStats();
    refreshSeriesForInversion();
  }, [isInverted, rebuildScaleStats, refreshSeriesForInversion]);

  useEffect(() => {
    volumeEnabledRef.current = volumeEnabled;
    rebuildScaleStats();
    refreshVolumeSeries();
    applyPanelLayout();
  }, [volumeEnabled, rebuildScaleStats, refreshVolumeSeries, applyPanelLayout]);

  return (
    <div className="app-shell">
      <main className="main-grid">
        <ResponsiveGridLayout
          className="grid-layout"
          layouts={gridLayouts}
          breakpoints={GRID_BREAKPOINTS}
          cols={GRID_COLS}
          rowHeight={GRID_ROW_HEIGHT}
          margin={GRID_MARGIN}
          containerPadding={GRID_MARGIN}
          draggableHandle=".grid-item-header"
          draggableCancel=".grid-item-header input, .grid-item-header button"
          onLayoutChange={(_currentLayout: Layout[], allLayouts: Layouts) => {
            const normalized = normalizeLayouts(allLayouts);
            const nextLayouts = mergeLayouts(DEFAULT_LAYOUTS, normalized);
            setGridLayouts(nextLayouts);
            writeGridLayoutCookie(nextLayouts);
          }}
          isBounded
          compactType="vertical"
        >
          <div key="indicator-panel" className="grid-item indicator-grid">
            <div className="grid-item-header">보조지표</div>
            <div className="grid-item-body indicator-grid-body">
              <ul className="indicator-list">
                <li>
                  <label>
                    <input
                      type="checkbox"
                      checked={volumeEnabled}
                      onChange={handleToggleVolume}
                    />
                    <span>거래량</span>
                  </label>
                </li>
                {definitions.map((definition) => (
                  <li key={definition.key}>
                    <label>
                      <input
                        type="checkbox"
                        checked={selection.has(definition.key)}
                        onChange={() => handleToggle(definition.key)}
                      />
                      <span>{definition.name}</span>
                    </label>
                  </li>
                ))}
              </ul>
            </div>
          </div>
          <div key="chart-panel" className="grid-item chart-grid">
            <div className="grid-item-header chart-header">
              <div className="chart-header-main">
                <span className="chart-header-title">차트</span>
                {symbol?.trim() ? <span className="grid-header-symbol">{symbol.trim()}</span> : null}
              </div>
              <div className="chart-header-filters">
                <div className="date-filter-wrapper">
                  <div className="date-filter-group">
                    <label className="date-filter-label" htmlFor="start-date-input">시작일</label>
                    <input
                      id="start-date-input"
                      type="date"
                      className="date-filter-input"
                      value={startDateInput}
                      onChange={handleStartDateInputChange}
                      onKeyDown={handleStartDateInputKeyDown}
                      onBlur={handleStartDateInputBlur}
                      ref={startDateInputRef}
                      placeholder="YYYY-MM-DD"
                    />
                    <div className="date-filter-actions">
                      <button
                        type="button"
                        className="date-filter-button"
                        onClick={handleStartDateDefault}
                        disabled={startDateFilter === normalizedDefaultStartDate}
                      >
                        기본값
                      </button>
                      <button
                        type="button"
                        className="date-filter-button"
                        onClick={handleStartDateReset}
                        disabled={startDateFilter === null}
                      >
                        해제
                      </button>
                    </div>
                  </div>
                  {startDateInputError ? (
                    <div className="date-filter-error">{startDateInputError}</div>
                  ) : null}
                </div>
                <div className="date-filter-wrapper">
                  <div className="date-filter-group">
                    <label className="date-filter-label" htmlFor="end-date-input">마감일</label>
                    <input
                      id="end-date-input"
                      type="date"
                      className="date-filter-input"
                      value={endDateInput}
                      onChange={handleEndDateInputChange}
                      onKeyDown={handleEndDateInputKeyDown}
                      onBlur={handleEndDateInputBlur}
                      ref={endDateInputRef}
                      placeholder="YYYY-MM-DD"
                    />
                    <div className="date-filter-actions">
                      <button
                        type="button"
                        className="date-filter-button"
                        onClick={handleEndDateToday}
                        disabled={endDateFilter === todayIso}
                      >
                        오늘
                      </button>
                      <button
                        type="button"
                        className="date-filter-button"
                        onClick={handleEndDateReset}
                        disabled={endDateFilter === null}
                      >
                        해제
                      </button>
                    </div>
                  </div>
                  {endDateInputError ? (
                    <div className="date-filter-error">{endDateInputError}</div>
                  ) : null}
                </div>
              </div>
            </div>
            <div className="grid-item-body chart-grid-body">
              <div className="timeframe-toolbar-wrapper">
                <div className="timeframe-toolbar" ref={timeframeContainerRef}>
                  {TIMEFRAME_OPTIONS.map((option) => {
                    const isActive = option.value === frame;
                    return (
                      <button
                        key={option.value}
                        type="button"
                        className={isActive ? "timeframe-button selected" : "timeframe-button"}
                        onClick={() => handleTimeframeSelect(option.value)}
                        ref={(element) => {
                          if (element) {
                            timeframeButtonRefs.current.set(option.value, element);
                          } else {
                            timeframeButtonRefs.current.delete(option.value);
                          }
                        }}
                      >
                        {option.label}
                      </button>
                    );
                  })}
                </div>
              </div>
              <div id="chart-root" className="chart-root" />
            </div>
          </div>
          <div key="symbol-panel" className="grid-item symbol-panel">
            <div className="grid-item-header">종목</div>
            <div className="grid-item-body symbol-panel-body">
              <div className="symbol-list-section">
                <div className="symbol-list-header">심볼 목록</div>
                <div className="symbol-input">
                  <input
                    type="text"
                    value={symbolInput}
                    maxLength={6}
                    placeholder="심볼 입력 (6자리)"
                    onChange={handleSymbolInputChange}
                    onKeyDown={handleSymbolInputKeyDown}
                    disabled={symbolInputPending}
                    inputMode="numeric"
                    autoComplete="off"
                    ref={symbolInputRef}
                  />
                  {symbolInputError ? <div className="symbol-input-error">{symbolInputError}</div> : null}
                </div>
                <div className="symbol-list-container">
                  <ul className="symbol-list">
                    {symbols.map((item) => {
                      const isActive = item === symbol;
                      return (
                        <li key={item} className={isActive ? "active" : undefined}>
                          <button
                            type="button"
                            onClick={() => handleSymbolSelect(item)}
                            onDoubleClick={() => addFavoriteSymbol(item)}
                            onContextMenu={(event) => handleSymbolContextMenu(event, item)}
                            ref={(element) => {
                              if (element) {
                                symbolButtonRefs.current.set(item, element);
                              } else {
                                symbolButtonRefs.current.delete(item);
                              }
                            }}
                            className={isActive ? "selected" : undefined}
                          >
                            {item}
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              </div>
            </div>
          </div>
          <div key="favorite-panel" className="grid-item favorite-panel symbol-panel">
            <div className="grid-item-header">관심종목</div>
            <div className="grid-item-body symbol-panel-body">
              <div className="symbol-list-section">
                <div className="symbol-list-header">관심종목 목록</div>
                <div className="symbol-list-container">
                  {favoriteSymbols.length > 0 ? (
                    <ul
                      className="symbol-list"
                      onDragOver={(event) => handleFavoriteDragOver(event)}
                      onDrop={(event) => handleFavoriteDrop(event, null)}
                    >
                      {favoriteSymbols.map((item, index) => {
                        const isActive = item === symbol;
                        return (
                          <li key={item} className={isActive ? "active" : undefined}>
                            <button
                              type="button"
                              onClick={() => handleSymbolSelect(item)}
                              onContextMenu={(event) => handleFavoriteContextMenu(event, item)}
                              onDragStart={(event) => handleFavoriteDragStart(event, index)}
                              onDragOver={(event) => handleFavoriteDragOver(event)}
                              onDrop={(event) => handleFavoriteDrop(event, item)}
                              onDragEnd={handleFavoriteDragEnd}
                              draggable
                              className={isActive ? "selected" : undefined}
                            >
                              {item}
                            </button>
                          </li>
                        );
                      })}
                    </ul>
                  ) : (
                    <div className="favorite-list-empty">관심종목이 없습니다.</div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </ResponsiveGridLayout>
      </main>
    </div>
  );
}
