import type { Candle, ChartPayload, IndicatorDefinition, IndicatorSeriesData } from "../types.ts";
import { API_BASE_URL } from "../config/runtimeEnv.ts";

const BASE_URL = API_BASE_URL;

export interface SymbolListResponse {
  symbols: string[];
  lastSymbol: string | null;
  lastFrame: string | null;
}

export async function fetchIndicatorDefinitions(): Promise<IndicatorDefinition[]> {
  try {
    const response = await fetch(`${BASE_URL}/indicators`);
    if (!response.ok) {
      throw new Error(`지표 목록을 가져오지 못했습니다: ${response.status}`);
    }
    return (await response.json()) as IndicatorDefinition[];
  } catch (error) {
    console.warn("지표 목록 API 호출 실패, 빈 배열을 반환합니다.", error);
    return [];
  }
}

interface IndicatorRequest {
  keys: string[];
  candles?: Candle[];
  symbol?: string;
  frame?: string;
  limit?: number;
}

export async function fetchIndicatorSeries(payload: IndicatorRequest): Promise<IndicatorSeriesData[]> {
  try {
    const response = await fetch(`${BASE_URL}/indicators/compute`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
    if (!response.ok) {
      throw new Error(`지표 계산을 요청할 수 없습니다: ${response.status}`);
    }
    const json = (await response.json()) as { indicators: IndicatorSeriesData[] };
    return json.indicators;
  } catch (error) {
    console.warn("지표 계산 API 호출 실패, 빈 배열을 반환합니다.", error);
    return [];
  }
}

interface CandleRequestOptions {
  symbol: string;
  frame?: string;
  limit?: number;
  start?: string | null;
  end?: string | null;
}

export async function fetchCandles(options: CandleRequestOptions): Promise<ChartPayload | null> {
  const params = new URLSearchParams();
  if (options.frame) {
    params.set("frame", options.frame);
  }
  if (typeof options.limit === "number" && Number.isFinite(options.limit) && options.limit > 0) {
    params.set("limit", `${Math.trunc(options.limit)}`);
  }
  if (options.start) {
    params.set("start", options.start);
  }
  if (options.end) {
    params.set("end", options.end);
  }
  const query = params.toString();
  const url = `${BASE_URL}/candles/${encodeURIComponent(options.symbol)}${query ? `?${query}` : ""}`;

  try {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`캔들 데이터를 가져오지 못했습니다: ${response.status}`);
    }
    return (await response.json()) as ChartPayload;
  } catch (error) {
    console.warn("캔들 데이터 API 호출 실패", error);
    return null;
  }
}

export async function fetchSymbols(): Promise<SymbolListResponse> {
  try {
    const response = await fetch(`${BASE_URL}/symbols`);
    if (!response.ok) {
      throw new Error(`심볼 목록을 가져오지 못했습니다: ${response.status}`);
    }
    const json = (await response.json()) as {
      symbols?: string[];
      lastSymbol?: string | null;
      lastFrame?: string | null;
    };
    const symbols = Array.isArray(json.symbols) ? json.symbols : [];
    const lastSymbol = typeof json.lastSymbol === "string" && json.lastSymbol.trim().length > 0 ? json.lastSymbol : null;
    const rawFrame = typeof json.lastFrame === "string" && json.lastFrame.trim().length > 0 ? json.lastFrame : null;
    const lastFrame = rawFrame ? rawFrame.trim().toLowerCase() : null;
    return { symbols, lastSymbol, lastFrame };
  } catch (error) {
    console.warn("심볼 목록 API 호출 실패, 빈 배열을 반환합니다.", error);
    return { symbols: [], lastSymbol: null, lastFrame: null };
  }
}

export async function blacklistSymbol(symbol: string): Promise<SymbolListResponse> {
  try {
    const response = await fetch(`${BASE_URL}/symbols/${encodeURIComponent(symbol)}/blacklist`, {
      method: "POST",
      headers: { "Content-Type": "application/json" }
    });
    if (!response.ok) {
      throw new Error(`심볼을 블랙리스트에 추가하지 못했습니다: ${response.status}`);
    }
    const json = (await response.json()) as {
      symbols?: string[];
      lastSymbol?: string | null;
      lastFrame?: string | null;
    };
    const symbols = Array.isArray(json.symbols) ? json.symbols : [];
    const lastSymbol = typeof json.lastSymbol === "string" && json.lastSymbol.trim().length > 0 ? json.lastSymbol : null;
    const rawFrame = typeof json.lastFrame === "string" && json.lastFrame.trim().length > 0 ? json.lastFrame : null;
    const lastFrame = rawFrame ? rawFrame.trim().toLowerCase() : null;
    return { symbols, lastSymbol, lastFrame };
  } catch (error) {
    console.error("심볼 블랙리스트 처리 실패", error);
    throw error;
  }
}

export async function persistLastSymbol(symbol: string | null): Promise<void> {
  try {
    await fetch(`${BASE_URL}/symbols/last`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ symbol })
    });
  } catch (error) {
    console.warn("마지막 심볼을 저장하지 못했습니다.", error);
  }
}

export async function persistLastFrame(frame: string | null): Promise<void> {
  try {
    await fetch(`${BASE_URL}/frame/last`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ frame })
    });
  } catch (error) {
    console.warn("마지막 타임프레임을 저장하지 못했습니다.", error);
  }
}
