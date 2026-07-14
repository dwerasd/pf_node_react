// @ts-nocheck
import fs from "node:fs";
import path from "node:path";

import { type Candle } from "../types";
import { getRuntimeEnv } from "../config/runtimeEnv";
import { filterBlacklistedSymbols } from "./symbolRegistry";

const PRIMARY_CSV_ROOT = path.resolve(process.cwd(), "csv");
const STATIC_WINDOWS_HINTS = [
  "E:/Stock/chartdata",
  "D:/Stock/chartdata",
  "C:/Stock/chartdata"
].map((entry) => path.resolve(entry));

const configuredCsvRoot = getRuntimeEnv("TMENGINE_CSV_ROOT");

const CSV_ROOT_CANDIDATES = Array.from(
  new Set(
    [
      configuredCsvRoot && configuredCsvRoot.trim().length > 0 ? configuredCsvRoot : undefined,
      PRIMARY_CSV_ROOT,
      path.resolve(process.cwd(), "../csv"),
      path.resolve(process.cwd(), "../data"),
      path.resolve(__dirname, "../../csv"),
      path.resolve(__dirname, "../../data"),
      path.resolve(__dirname, "../../py/csv"),
      path.resolve(__dirname, "../../py/data"),
      ...STATIC_WINDOWS_HINTS
    ].filter((entry): entry is string => Boolean(entry))
  )
);

if (!fs.existsSync(PRIMARY_CSV_ROOT)) {
  fs.mkdirSync(PRIMARY_CSV_ROOT, { recursive: true });
}

interface CsvCacheEntry {
  candles: Candle[];
  mtimeMs: number;
  size: number;
  parsedAt: number;
}

const csvCache = new Map<string, CsvCacheEntry>();

interface CsvRow {
  date: string;
  time: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

const DEFAULT_FRAME = "day1";

const FRAME_ALIASES: Record<string, string> = {
  day: DEFAULT_FRAME,
  daily: DEFAULT_FRAME,
  d1: DEFAULT_FRAME,
  "1d": DEFAULT_FRAME,
  "1day": DEFAULT_FRAME,
  minute: "m1",
  min1: "m1",
  "1m": "m1",
  "1min": "m1"
};

export interface ResolveResult {
  filePath: string;
  tried: string[];
  frame: string;
}

function normalizeSymbol(symbol: string): string {
  return symbol.replace(/[^0-9A-Za-z-_]/g, "").toUpperCase();
}

function normalizeFrame(frame?: string): string {
  if (!frame) {
    return DEFAULT_FRAME;
  }
  const cleaned = frame.toLowerCase().replace(/[^0-9a-z]/g, "");
  if (cleaned.length === 0) {
    return DEFAULT_FRAME;
  }
  return FRAME_ALIASES[cleaned] ?? cleaned;
}

function buildCandidateNames(symbol: string, frame: string): string[] {
  const variants = new Set<string>();
  const base = `${symbol}_${frame}`;
  variants.add(`${base}.csv`);
  variants.add(`${base.toLowerCase()}.csv`);
  variants.add(`${base.toUpperCase()}.csv`);
  variants.add(`${symbol}.csv`);
  return Array.from(variants);
}

export function resolveCsvPath(symbol: string, frame?: string): ResolveResult {
  const normalizedSymbol = normalizeSymbol(symbol);
  const normalizedFrame = normalizeFrame(frame);
  const candidateNames = buildCandidateNames(normalizedSymbol, normalizedFrame);

  const tried: string[] = [];

  for (const root of CSV_ROOT_CANDIDATES) {
    for (const name of candidateNames) {
      const direct = path.join(root, name);
      tried.push(direct);
      if (fs.existsSync(direct)) {
        return { filePath: direct, tried, frame: normalizedFrame };
      }

      const nested = path.join(root, normalizedSymbol, name);
      tried.push(nested);
      if (fs.existsSync(nested)) {
        return { filePath: nested, tried, frame: normalizedFrame };
      }
    }
  }

  const fallback = path.join(PRIMARY_CSV_ROOT, candidateNames[0]);
  tried.push(fallback);
  return { filePath: fallback, tried, frame: normalizedFrame };
}

function parseTimestamp(dateValue: string, timeValue: string): number {
  const dateStr = dateValue.trim().padStart(8, "0");
  const timeStr = timeValue.trim().padStart(4, "0");

  const year = Number.parseInt(dateStr.slice(0, 4), 10);
  const month = Number.parseInt(dateStr.slice(4, 6), 10);
  const day = Number.parseInt(dateStr.slice(6, 8), 10);
  const hour = Number.parseInt(timeStr.slice(0, 2), 10);
  const minute = Number.parseInt(timeStr.slice(2, 4), 10);

  if (
    Number.isNaN(year) ||
    Number.isNaN(month) ||
    Number.isNaN(day) ||
    Number.isNaN(hour) ||
    Number.isNaN(minute)
  ) {
    throw new Error(`잘못된 날짜/시간 포맷입니다: date=${dateValue}, time=${timeValue}`);
  }

  const utcMillis = Date.UTC(year, month - 1, day, hour, minute);
  if (!Number.isFinite(utcMillis)) {
    throw new Error(`날짜/시간을 UTC로 변환할 수 없습니다: date=${dateValue}, time=${timeValue}`);
  }

  return Math.floor(utcMillis / 1000);
}

interface LoadOptions {
  limit?: number;
}

export function loadCandlesFromCsv(filePath: string, options?: LoadOptions): Candle[] {
  if (!fs.existsSync(filePath)) {
    throw new Error(
      `CSV 파일을 찾을 수 없습니다: ${filePath}. 검색 경로: ${CSV_ROOT_CANDIDATES.join(", ")}`
    );
  }

  const limit = options?.limit && options.limit > 0 ? Math.trunc(options.limit) : undefined;
  const stats = fs.statSync(filePath);
  const cacheKey = path.resolve(filePath);
  const cached = csvCache.get(cacheKey);
  if (cached && cached.mtimeMs === stats.mtimeMs && cached.size === stats.size) {
    const dataset = cached.candles;
    if (limit && dataset.length > limit) {
      return dataset.slice(-limit);
    }
    return dataset;
  }

  const content = fs.readFileSync(filePath, "utf-8");
  if (!content.trim()) {
    throw new Error(`CSV 파일이 비어 있습니다: ${filePath}`);
  }

  const lines = content.split(/\r?\n/).filter(Boolean);
  const candles: Candle[] = [];

  lines.forEach((line, index) => {
    const parts = line.split(",");
    if (parts.length < 6) {
      throw new Error(`CSV 포맷이 잘못되었습니다 (line ${index + 1}): ${line}`);
    }

    const [date, time, open, high, low, close, volume = "0"] = parts;

    const parsed: CsvRow = {
      date,
      time,
      open: Number(open),
      high: Number(high),
      low: Number(low),
      close: Number(close),
      volume: Number(volume)
    };

    if (!Number.isFinite(parsed.open) || !Number.isFinite(parsed.close)) {
      throw new Error(`숫자 변환 실패 (line ${index + 1}): ${line}`);
    }

    const timestamp = parseTimestamp(parsed.date, parsed.time);
    candles.push({
      timestamp,
      open: parsed.open,
      high: parsed.high,
      low: parsed.low,
      close: parsed.close,
      volume: parsed.volume
    });
  });

  csvCache.set(cacheKey, {
    candles,
    mtimeMs: stats.mtimeMs,
    size: stats.size,
    parsedAt: Date.now()
  });

  if (limit && candles.length > limit) {
    return candles.slice(-limit);
  }

  return candles;
}

export function listAvailableSymbols(): string[] {
  const prioritized = [path.resolve("E:/Stock/chartdata"), ...CSV_ROOT_CANDIDATES];
  const roots = Array.from(new Set(prioritized));
  const results: string[] = [];
  const seen = new Set<string>();

  roots.forEach((root) => {
    if (!root || !fs.existsSync(root)) {
      return;
    }
    try {
      const entries = fs.readdirSync(root, { withFileTypes: true });
      entries.forEach((entry) => {
        if (!entry.isDirectory()) {
          return;
        }
        const name = entry.name.trim();
        if (!/^\d{4,6}$/.test(name)) {
          return;
        }
        if (seen.has(name)) {
          return;
        }
        seen.add(name);
        results.push(name);
      });
    } catch (error) {
      console.warn(`심볼 디렉터리 나열 실패: ${root}`, error);
    }
  });

  results.sort((left, right) => left.localeCompare(right));
  return filterBlacklistedSymbols(results);
}

export function describeCsvSearchPaths(): string[] {
  return [...CSV_ROOT_CANDIDATES];
}
