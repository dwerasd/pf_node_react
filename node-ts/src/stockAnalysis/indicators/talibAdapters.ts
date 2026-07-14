// @ts-nocheck
import talibContext from "../talib";

const LOG_PREFIX = "[TMEngine][TA-Lib]";
let loggedUnavailable = false;
let loggedFailure = false;

function noteTalibUnavailable(message: string, detail?: unknown): void {
  if (loggedUnavailable) {
    return;
  }
  console.warn(`${LOG_PREFIX} ${message}`, detail);
  loggedUnavailable = true;
}

function noteTalibFailure(error: unknown): void {
  if (loggedFailure) {
    return;
  }
  console.warn(`${LOG_PREFIX} TA-Lib 계산에 실패했습니다. 순수 TypeScript 버전으로 대체합니다.`, error);
  loggedFailure = true;
}

function shouldUseTalib(): boolean {
  if (talibContext.mode === "off") {
    return false;
  }
  if (!talibContext.available) {
    if (talibContext.mode === "force") {
      noteTalibUnavailable("TMENGINE_TALIB_MODE=force 이지만 'talib-binding' 모듈을 불러오지 못했습니다.", talibContext.error);
    }
    return false;
  }
  return true;
}

export function alignTalibSeries(totalLength: number, raw: ArrayLike<number>): number[] {
  const result = new Array<number>(totalLength).fill(Number.NaN);
  if (raw.length === 0) {
    return result;
  }
  const copyStart = Math.max(0, totalLength - raw.length);
  const limit = Math.min(raw.length, totalLength - copyStart);
  for (let idx = 0; idx < limit; idx += 1) {
    const value = Number(raw[idx]);
    result[copyStart + idx] = Number.isFinite(value) ? value : Number.NaN;
  }
  return result;
}

function isFiniteTuple(values: number[]): boolean {
  return values.every((value) => Number.isFinite(value));
}

function computeTrueRange(high: number, low: number, prevClose: number | null): number | undefined {
  if (!Number.isFinite(high) || !Number.isFinite(low)) {
    return undefined;
  }

  const baseRange = high - low;
  if (typeof prevClose !== "number" || !Number.isFinite(prevClose)) {
    return Number.isFinite(baseRange) ? baseRange : undefined;
  }

  const rangeHighPrev = Math.abs(high - prevClose);
  const rangeLowPrev = Math.abs(low - prevClose);
  return Math.max(baseRange, rangeHighPrev, rangeLowPrev);
}

function computeAtrWithTalib(highs: number[], lows: number[], closes: number[], period: number): number[] | null {
  if (!shouldUseTalib()) {
    return null;
  }

  const module = talibContext.module;
  if (!module || typeof module.ATR !== "function") {
    noteTalibUnavailable("'talib-binding' 모듈에 ATR 함수가 존재하지 않습니다. 순수 TypeScript 버전으로 대체합니다.");
    return null;
  }

  try {
    const raw = module.ATR(highs, lows, closes, period) as ArrayLike<number> | null | undefined;
    if (!raw) {
      noteTalibFailure("ATR 결과가 비어 있습니다.");
      return null;
    }
    return alignTalibSeries(highs.length, raw);
  } catch (error) {
    noteTalibFailure(error);
    return null;
  }
}

function computeAtrFallback(highs: number[], lows: number[], closes: number[], period: number): number[] {
  const length = highs.length;
  const result = new Array<number>(length).fill(Number.NaN);
  const seedWindow: number[] = [];
  let prevClose: number | null = Number.isFinite(closes[0]) ? closes[0] : null;
  let atrValue: number | null = null;

  for (let idx = 0; idx < length; idx += 1) {
    const high = highs[idx];
    const low = lows[idx];
    const close = closes[idx];

    if (!isFiniteTuple([high, low])) {
      if (Number.isFinite(close)) {
        prevClose = close;
      }
      continue;
    }

    const trueRange = computeTrueRange(high, low, prevClose);
    if (typeof trueRange !== "number" || !Number.isFinite(trueRange)) {
      if (Number.isFinite(close)) {
        prevClose = close;
      }
      continue;
    }

    if (atrValue === null) {
      seedWindow.push(trueRange);
      if (seedWindow.length === period) {
        const sum = seedWindow.reduce((total, value) => total + value, 0);
        atrValue = sum / period;
        result[idx] = atrValue;
      }
    } else {
      atrValue = ((period - 1) * atrValue + trueRange) / period;
      result[idx] = atrValue;
    }

    if (Number.isFinite(close)) {
      prevClose = close;
    }
  }

  return result;
}

export function atrTalib(highs: number[], lows: number[], closes: number[], period: number): number[] {
  if (highs.length !== lows.length || highs.length !== closes.length) {
    throw new Error("High/Low/Close 길이가 일치하지 않습니다.");
  }
  if (period <= 1) {
    throw new Error("ATR 기간은 2 이상이어야 합니다.");
  }
  if (highs.length === 0) {
    return [];
  }

  const talibValues = computeAtrWithTalib(highs, lows, closes, period);
  if (talibValues) {
    return talibValues;
  }

  return computeAtrFallback(highs, lows, closes, period);
}

function emaWithSeed(values: number[], period: number): number[] {
  const length = values.length;
  const result = new Array<number>(length).fill(Number.NaN);
  if (period <= 0 || length === 0) {
    return result;
  }

  const alpha = 2 / (period + 1);
  let seedSum = 0;
  let seedCount = 0;
  let emaValue = Number.NaN;

  for (let idx = 0; idx < length; idx += 1) {
    const value = values[idx];
    if (!Number.isFinite(value)) {
      continue;
    }

    if (!Number.isFinite(emaValue)) {
      seedSum += value;
      seedCount += 1;
      if (seedCount >= period) {
        emaValue = seedSum / period;
        result[idx] = emaValue;
      }
      continue;
    }

    emaValue = emaValue + alpha * (value - emaValue);
    result[idx] = emaValue;
  }

  return result;
}

function computeMacdWithTalib(
  closes: number[],
  fastPeriod: number,
  slowPeriod: number,
  signalPeriod: number
): { macd: number[]; signal: number[]; histogram: number[] } | null {
  if (!shouldUseTalib()) {
    return null;
  }

  const module = talibContext.module;
  if (!module || typeof module.MACD !== "function") {
    noteTalibUnavailable("'talib-binding' 모듈에 MACD 함수가 존재하지 않습니다. 순수 TypeScript 버전으로 대체합니다.");
    return null;
  }

  try {
    const raw = module.MACD(closes, fastPeriod, slowPeriod, signalPeriod) as ArrayLike<number>[] | null | undefined;
    if (!raw || raw.length < 3) {
      noteTalibFailure("MACD 결과가 비어 있습니다.");
      return null;
    }
    const macd = raw[0];
    const signal = raw[1];
    const histogram = raw[2];
    if (!macd || !signal || !histogram) {
      noteTalibFailure("MACD 결과가 비어 있습니다.");
      return null;
    }
    return {
      macd: alignTalibSeries(closes.length, macd),
      signal: alignTalibSeries(closes.length, signal),
      histogram: alignTalibSeries(closes.length, histogram)
    };
  } catch (error) {
    noteTalibFailure(error);
    return null;
  }
}

function computeMacdFallback(
  closes: number[],
  fastPeriod: number,
  slowPeriod: number,
  signalPeriod: number
): { macd: number[]; signal: number[]; histogram: number[] } {
  const length = closes.length;
  const macdResult = new Array<number>(length).fill(Number.NaN);
  if (length === 0) {
    return { macd: macdResult, signal: macdResult.slice(), histogram: macdResult.slice() };
  }

  const fastEma = emaWithSeed(closes, fastPeriod);
  const slowEma = emaWithSeed(closes, slowPeriod);

  for (let idx = 0; idx < length; idx += 1) {
    const fast = fastEma[idx];
    const slow = slowEma[idx];
    if (Number.isFinite(fast) && Number.isFinite(slow)) {
      macdResult[idx] = fast - slow;
    }
  }

  const signalResult = emaWithSeed(macdResult, signalPeriod);
  const histogramResult = new Array<number>(length).fill(Number.NaN);

  for (let idx = 0; idx < length; idx += 1) {
    const macd = macdResult[idx];
    const signal = signalResult[idx];
    if (Number.isFinite(macd) && Number.isFinite(signal)) {
      histogramResult[idx] = macd - signal;
    }
  }

  return {
    macd: macdResult,
    signal: signalResult,
    histogram: histogramResult
  };
}

export function macdTalib(
  closes: number[],
  fastPeriod: number,
  slowPeriod: number,
  signalPeriod: number
): { macd: number[]; signal: number[]; histogram: number[] } {
  if (fastPeriod <= 0 || slowPeriod <= 0 || signalPeriod <= 0) {
    throw new Error("MACD 기간은 0보다 커야 합니다.");
  }
  if (closes.length === 0) {
    return {
      macd: [],
      signal: [],
      histogram: []
    };
  }

  const talibValues = computeMacdWithTalib(closes, fastPeriod, slowPeriod, signalPeriod);
  if (talibValues) {
    return talibValues;
  }

  return computeMacdFallback(closes, fastPeriod, slowPeriod, signalPeriod);
}
