import fs from "node:fs";
import path from "node:path";

function normalizeSymbol(value: string): string {
  return value.replace(/[^0-9A-Za-z-_]/g, "").toUpperCase();
}

const DATA_ROOT = path.resolve(process.cwd(), "data");
const BLACKLIST_PATH = path.join(DATA_ROOT, "symbol-blacklist.json");
const LAST_SYMBOL_PATH = path.join(DATA_ROOT, "symbol-last.json");
const LAST_FRAME_PATH = path.join(DATA_ROOT, "frame-last.json");

const VALID_FRAMES = new Set([
  "m1",
  "m3",
  "m5",
  "m10",
  "m15",
  "m30",
  "m45",
  "m60",
  "m90",
  "m135",
  "m240",
  "day1"
]);

let blacklistCache: Set<string> | null = null;
let lastSymbolCache: string | null | undefined = undefined;
let lastFrameCache: string | null | undefined = undefined;

function ensureDataRoot(): void {
  if (!fs.existsSync(DATA_ROOT)) {
    fs.mkdirSync(DATA_ROOT, { recursive: true });
  }
}

function ensureLoaded(): void {
  if (blacklistCache !== null) {
    return;
  }
  ensureDataRoot();
  if (!fs.existsSync(BLACKLIST_PATH)) {
    blacklistCache = new Set();
    return;
  }
  try {
    const content = fs.readFileSync(BLACKLIST_PATH, "utf-8");
    const parsed = JSON.parse(content);
    if (Array.isArray(parsed)) {
      blacklistCache = new Set(parsed.map((item) => normalizeSymbol(String(item))));
      return;
    }
  } catch (error) {
    console.warn("[SymbolRegistry] 블랙리스트 파일을 읽는 도중 오류가 발생했습니다.", error);
  }
  blacklistCache = new Set();
}

function persist(): void {
  ensureDataRoot();
  if (blacklistCache === null) {
    blacklistCache = new Set();
  }
  const payload = JSON.stringify(Array.from(blacklistCache).sort(), null, 2);
  fs.writeFileSync(BLACKLIST_PATH, payload, "utf-8");
}

function ensureLastSymbolLoaded(): void {
  if (lastSymbolCache !== undefined) {
    return;
  }
  ensureDataRoot();
  if (!fs.existsSync(LAST_SYMBOL_PATH)) {
    lastSymbolCache = null;
    return;
  }
  try {
    const content = fs.readFileSync(LAST_SYMBOL_PATH, "utf-8");
    const parsed = JSON.parse(content);
    if (typeof parsed === "string") {
      const normalized = normalizeSymbol(parsed);
      lastSymbolCache = normalized.length > 0 ? normalized : null;
      return;
    }
    if (parsed && typeof parsed === "object" && typeof parsed.symbol === "string") {
      const normalized = normalizeSymbol(parsed.symbol);
      lastSymbolCache = normalized.length > 0 ? normalized : null;
      return;
    }
  } catch (error) {
    console.warn("[SymbolRegistry] 마지막 심볼 파일을 읽는 도중 오류가 발생했습니다.", error);
  }
  lastSymbolCache = null;
}

function persistLastSymbol(): void {
  ensureDataRoot();
  if (!lastSymbolCache) {
    if (fs.existsSync(LAST_SYMBOL_PATH)) {
      try {
        fs.unlinkSync(LAST_SYMBOL_PATH);
      } catch (error) {
        console.warn("[SymbolRegistry] 마지막 심볼 파일을 삭제할 수 없습니다.", error);
      }
    }
    return;
  }
  const payload = JSON.stringify({ symbol: lastSymbolCache }, null, 2);
  fs.writeFileSync(LAST_SYMBOL_PATH, payload, "utf-8");
}

function normalizeFrameValue(value: string): string {
  const normalized = value.trim().toLowerCase();
  if (VALID_FRAMES.has(normalized)) {
    return normalized;
  }
  return "";
}

function ensureLastFrameLoaded(): void {
  if (lastFrameCache !== undefined) {
    return;
  }
  ensureDataRoot();
  if (!fs.existsSync(LAST_FRAME_PATH)) {
    lastFrameCache = null;
    return;
  }
  try {
    const content = fs.readFileSync(LAST_FRAME_PATH, "utf-8");
    const parsed = JSON.parse(content);
    if (typeof parsed === "string") {
      const normalized = normalizeFrameValue(parsed);
      lastFrameCache = normalized || null;
      return;
    }
    if (parsed && typeof parsed === "object" && typeof parsed.frame === "string") {
      const normalized = normalizeFrameValue(parsed.frame);
      lastFrameCache = normalized || null;
      return;
    }
  } catch (error) {
    console.warn("[SymbolRegistry] 마지막 타임프레임 파일을 읽는 도중 오류가 발생했습니다.", error);
  }
  lastFrameCache = null;
}

function persistLastFrame(): void {
  ensureDataRoot();
  if (!lastFrameCache) {
    if (fs.existsSync(LAST_FRAME_PATH)) {
      try {
        fs.unlinkSync(LAST_FRAME_PATH);
      } catch (error) {
        console.warn("[SymbolRegistry] 마지막 타임프레임 파일을 삭제할 수 없습니다.", error);
      }
    }
    return;
  }
  const payload = JSON.stringify({ frame: lastFrameCache }, null, 2);
  fs.writeFileSync(LAST_FRAME_PATH, payload, "utf-8");
}

export function getBlacklist(): string[] {
  ensureLoaded();
  return Array.from(blacklistCache ?? []);
}

export function isBlacklisted(symbol: string): boolean {
  ensureLoaded();
  const normalized = normalizeSymbol(symbol);
  if (!normalized) {
    return false;
  }
  return (blacklistCache ?? new Set()).has(normalized);
}

export function blacklistSymbol(symbol: string): void {
  ensureLoaded();
  const normalized = normalizeSymbol(symbol);
  if (!normalized) {
    throw new Error("심볼이 비어 있습니다.");
  }
  blacklistCache?.add(normalized);
  persist();
}

export function removeFromBlacklist(symbol: string): void {
  ensureLoaded();
  const normalized = normalizeSymbol(symbol);
  if (!normalized) {
    return;
  }
  if (blacklistCache?.delete(normalized)) {
    persist();
  }
}

export function filterBlacklistedSymbols(symbols: string[]): string[] {
  ensureLoaded();
  const cache = blacklistCache ?? new Set();
  return symbols.filter((symbol) => !cache.has(normalizeSymbol(symbol)));
}

export function getLastSymbol(): string | null {
  ensureLastSymbolLoaded();
  return lastSymbolCache ?? null;
}

export function setLastSymbol(symbol: string | null | undefined): string | null {
  ensureLastSymbolLoaded();
  if (!symbol) {
    lastSymbolCache = null;
    persistLastSymbol();
    return null;
  }
  const normalized = normalizeSymbol(symbol);
  if (!normalized) {
    lastSymbolCache = null;
    persistLastSymbol();
    return null;
  }
  lastSymbolCache = normalized;
  persistLastSymbol();
  return lastSymbolCache;
}

export function getLastFrame(): string | null {
  ensureLastFrameLoaded();
  return lastFrameCache ?? null;
}

export function setLastFrame(frame: string | null | undefined): string | null {
  ensureLastFrameLoaded();
  if (!frame) {
    lastFrameCache = null;
    persistLastFrame();
    return null;
  }
  const normalized = normalizeFrameValue(frame);
  if (!normalized) {
    lastFrameCache = null;
    persistLastFrame();
    return null;
  }
  lastFrameCache = normalized;
  persistLastFrame();
  return lastFrameCache;
}
