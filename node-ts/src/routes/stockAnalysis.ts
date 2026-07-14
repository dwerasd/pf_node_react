import { Router, type Request, type Response } from 'express';
import { IndicatorRegistry } from '../stockAnalysis/indicators/registry';
import { buildChartPayload, type Candle } from '../stockAnalysis/types';
import { computeIndicatorSeries } from '../stockAnalysis/indicators/compute';
import {
  resolveCsvPath,
  loadCandlesFromCsv,
  describeCsvSearchPaths,
  listAvailableSymbols,
  type ResolveResult
} from '../stockAnalysis/services/csvLoader';
import {
  blacklistSymbol as addSymbolToBlacklist,
  removeFromBlacklist,
  getBlacklist,
  getLastSymbol,
  setLastSymbol,
  getLastFrame,
  setLastFrame
} from '../stockAnalysis/services/symbolRegistry';

const router = Router();

const registry = new IndicatorRegistry();

const DAILY_DEFAULT_START = Math.floor(Date.UTC(2022, 0, 1) / 1000);
const INTRADAY_DEFAULT_LIMIT = 2500;
const INTRADAY_MAX_LIMIT = 20000;
const ISO_DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;

function parseStartTimestamp(value?: string): number | null {
  if (typeof value !== 'string') {
    return null;
  }
  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }
  const numericCandidate = Number(trimmed);
  if (Number.isFinite(numericCandidate) && numericCandidate > 0) {
    return Math.max(0, Math.trunc(numericCandidate));
  }
  const normalized = ISO_DATE_ONLY.test(trimmed) ? `${trimmed}T00:00:00Z` : trimmed;
  const parsed = Date.parse(normalized);
  if (Number.isNaN(parsed)) {
    return null;
  }
  return Math.floor(parsed / 1000);
}

function parseEndTimestamp(value?: string): number | null {
  if (typeof value !== 'string') {
    return null;
  }
  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }
  const numericCandidate = Number(trimmed);
  if (Number.isFinite(numericCandidate) && numericCandidate > 0) {
    return Math.max(0, Math.trunc(numericCandidate));
  }
  if (ISO_DATE_ONLY.test(trimmed)) {
    const parsed = Date.parse(`${trimmed}T23:59:59Z`);
    if (Number.isNaN(parsed)) {
      return null;
    }
    return Math.floor(parsed / 1000);
  }
  const parsed = Date.parse(trimmed);
  if (Number.isNaN(parsed)) {
    return null;
  }
  return Math.floor(parsed / 1000);
}

function normalizeSymbolValue(value: string): string {
  return value.replace(/[^0-9A-Za-z-_]/g, '').toUpperCase();
}

function isDailyFrame(frame?: string): boolean {
  if (!frame) {
    return false;
  }
  const normalized = frame.toLowerCase();
  return (
    normalized === 'day' ||
    normalized === 'day1' ||
    normalized === 'd1' ||
    normalized === '1d' ||
    normalized === '1day'
  );
}

function isMinuteFrame(frame?: string): boolean {
  if (!frame) {
    return false;
  }
  const normalized = frame.toLowerCase();
  if (isDailyFrame(normalized)) {
    return false;
  }
  return /^m\d+$/.test(normalized) || normalized.endsWith('min') || /^\d+m$/.test(normalized);
}

function applyDefaultFrameWindow({
  candles,
  frame,
  limit,
  start,
  end
}: {
  candles: Candle[];
  frame?: string;
  limit?: number;
  start?: number | null;
  end?: number | null;
}): { candles: Candle[]; appliedLimit: number | null } {
  const hasFrame = typeof frame === 'string' && frame.length > 0;
  const minuteFrame = hasFrame ? isMinuteFrame(frame) : false;
  const positiveLimit = limit && limit > 0 ? Math.trunc(limit) : undefined;
  const clampedLimit = positiveLimit
    ? minuteFrame
      ? Math.max(1, Math.min(positiveLimit, INTRADAY_MAX_LIMIT))
      : Math.max(1, positiveLimit)
    : undefined;

  if (!candles.length) {
    return { candles, appliedLimit: clampedLimit ?? null };
  }

  const hasCustomStart = typeof start === 'number' && Number.isFinite(start);
  const hasCustomEnd = typeof end === 'number' && Number.isFinite(end);

  // 1. 날짜 필터 먼저 적용
  let filtered = candles;
  if (hasCustomStart || hasCustomEnd) {
    filtered = candles.filter((item) => {
      if (hasCustomStart && item.timestamp < start!) return false;
      if (hasCustomEnd && item.timestamp > end!) return false;
      return true;
    });
  }

  // 2. limit 적용 (날짜 필터 후)
  if (clampedLimit) {
    const trimmed = filtered.length > clampedLimit ? filtered.slice(-clampedLimit) : filtered.slice();
    return { candles: trimmed, appliedLimit: Math.min(clampedLimit, trimmed.length) };
  }

  // 날짜 필터가 있으면 여기서 반환
  if (hasCustomStart || hasCustomEnd) {
    return { candles: filtered, appliedLimit: null };
  }

  if (!hasFrame) {
    return { candles: filtered, appliedLimit: null };
  }

  if (isDailyFrame(frame)) {
    const dailyFiltered = filtered.filter((item) => item.timestamp >= DAILY_DEFAULT_START);
    if (dailyFiltered.length > 0) {
      return { candles: dailyFiltered, appliedLimit: null };
    }
    return { candles: filtered, appliedLimit: null };
  }

  if (minuteFrame) {
    const limitSize = Math.max(1, Math.min(INTRADAY_DEFAULT_LIMIT, INTRADAY_MAX_LIMIT));
    const trimmed = filtered.length > limitSize ? filtered.slice(-limitSize) : filtered.slice();
    return { candles: trimmed, appliedLimit: Math.min(limitSize, trimmed.length) };
  }

  return { candles: filtered, appliedLimit: null };
}

router.get('/indicators', (_req: Request, res: Response) => {
  res.json(registry.listDefinitions());
});

router.get('/symbols', (_req: Request, res: Response) => {
  const symbols = listAvailableSymbols();
  const lastSymbol = getLastSymbol();
  const lastFrame = getLastFrame();
  res.json({ symbols, lastSymbol, lastFrame });
});

router.get('/blacklist', (_req: Request, res: Response) => {
  const blacklist = getBlacklist();
  res.json({ blacklist });
});

router.delete('/blacklist/:symbol', (req: Request, res: Response) => {
  const symbolParam = (req.params.symbol ?? '').trim();
  if (symbolParam.length === 0) {
    res.status(400).json({ error: 'symbol 파라미터가 필요합니다.' });
    return;
  }
  try {
    removeFromBlacklist(symbolParam);
    const blacklist = getBlacklist();
    const symbols = listAvailableSymbols();
    res.json({ success: true, blacklist, symbols, lastSymbol: getLastSymbol(), lastFrame: getLastFrame() });
  } catch (error) {
    console.error(`블랙리스트 해제 실패 (${symbolParam}):`, error);
    res.status(500).json({ error: '블랙리스트에서 심볼을 제거할 수 없습니다.' });
  }
});

router.post('/symbols/:symbol/blacklist', (req: Request, res: Response) => {
  const symbolParam = (req.params.symbol ?? '').trim();
  if (symbolParam.length === 0) {
    res.status(400).json({ error: 'symbol 파라미터가 필요합니다.' });
    return;
  }
  const normalizedParam = normalizeSymbolValue(symbolParam);
  try {
    addSymbolToBlacklist(symbolParam);
    if (normalizedParam && getLastSymbol() === normalizedParam) {
      setLastSymbol(null);
    }
    const symbols = listAvailableSymbols();
    res.json({ success: true, symbols, lastSymbol: getLastSymbol(), lastFrame: getLastFrame() });
  } catch (error) {
    console.error(`심볼 블랙리스트 추가 실패 (${symbolParam}):`, error);
    res.status(500).json({ error: '심볼을 블랙리스트에 추가할 수 없습니다.' });
  }
});

router.post('/symbols/last', (req: Request, res: Response) => {
  try {
    const payload = req.body ?? {};
    const raw = payload.symbol;
    const stored = typeof raw === 'string' ? setLastSymbol(raw) : setLastSymbol(null);
    res.json({ success: true, symbol: stored });
  } catch (error) {
    console.error('마지막 심볼을 저장할 수 없습니다.', error);
    res.status(500).json({ error: '마지막 심볼을 저장하는 도중 오류가 발생했습니다.' });
  }
});

router.post('/frame/last', (req: Request, res: Response) => {
  try {
    const payload = req.body ?? {};
    const raw = payload.frame;
    const stored = typeof raw === 'string' ? setLastFrame(raw) : setLastFrame(null);
    res.json({ success: true, frame: stored });
  } catch (error) {
    console.error('마지막 타임프레임을 저장할 수 없습니다.', error);
    res.status(500).json({ error: '마지막 타임프레임을 저장하는 도중 오류가 발생했습니다.' });
  }
});

router.get('/candles/:symbol', (req: Request, res: Response) => {
  const symbol = (req.params.symbol ?? '').trim();
  const frameParam = typeof req.query.frame === 'string' ? req.query.frame : undefined;
  const limitParam = typeof req.query.limit === 'string' ? Number(req.query.limit) : undefined;
  const startParam = typeof req.query.start === 'string' ? req.query.start : undefined;
  const endParam = typeof req.query.end === 'string' ? req.query.end : undefined;
  if (symbol.length === 0) {
    res.status(400).json({ error: 'symbol 파라미터가 필요합니다.' });
    return;
  }

  let resolved: ResolveResult | undefined;
  try {
  resolved = resolveCsvPath(symbol, frameParam);
  const startTimestamp = parseStartTimestamp(startParam);
  const endTimestamp = parseEndTimestamp(endParam);
    const limitValue = Number.isFinite(limitParam) && limitParam && limitParam > 0 ? Math.trunc(limitParam) : undefined;
    const minuteFrameSelected = isMinuteFrame(resolved.frame);
    const inferredLimit = !limitValue && minuteFrameSelected && !startTimestamp && !endTimestamp
      ? INTRADAY_DEFAULT_LIMIT
      : undefined;
    const requestedLimit = limitValue ?? inferredLimit;
    const effectiveLimit = requestedLimit
      ? minuteFrameSelected
        ? Math.max(1, Math.min(requestedLimit, INTRADAY_MAX_LIMIT))
        : Math.max(1, requestedLimit)
      : undefined;
    // 날짜 필터가 있으면 전체 로드, 없으면 limit 적용
    const loadOptions = (startTimestamp || endTimestamp) ? undefined : (effectiveLimit !== undefined ? { limit: effectiveLimit } : undefined);
    const loadedCandles = loadCandlesFromCsv(resolved.filePath, loadOptions);
    let filteredCandles = loadedCandles;
    if (startTimestamp) {
      filteredCandles = filteredCandles.filter((item) => item.timestamp >= startTimestamp);
    }
    if (endTimestamp) {
      filteredCandles = filteredCandles.filter((item) => item.timestamp <= endTimestamp);
    }
    // 날짜 필터가 있으면 limit 적용 안함
    const hasDateFilter = startTimestamp || endTimestamp;
    const frameWindowOptions: { candles: Candle[]; frame?: string; limit?: number; start?: number | null; end?: number | null } = {
      candles: filteredCandles,
      frame: resolved.frame,
      ...(!hasDateFilter && effectiveLimit !== undefined ? { limit: effectiveLimit } : {}),
      ...(startTimestamp ? { start: startTimestamp } : {}),
      ...(endTimestamp ? { end: endTimestamp } : {})
    };
    const { candles: windowed, appliedLimit } = applyDefaultFrameWindow(frameWindowOptions);
    removeFromBlacklist(symbol);
    const payload = buildChartPayload(windowed);
    res.json({
      ...payload,
      frame: resolved.frame,
      limit: appliedLimit,
      start: startTimestamp ?? null,
      end: endTimestamp ?? null
    });
  } catch (error) {
    console.error(`CSV 로드 실패 (${symbol}, frame=${resolved?.frame ?? 'n/a'}):`, error);
    if (resolved) {
      console.error('시도한 경로:', resolved.tried);
    }
    console.error('CSV 검색 경로:', describeCsvSearchPaths());
    
    // CSV 파일을 찾을 수 없으면 자동으로 블랙리스트에 추가
    const errorMessage = error instanceof Error ? error.message : String(error);
    if (errorMessage.includes('CSV 파일을 찾을 수 없습니다')) {
      try {
        addSymbolToBlacklist(symbol);
        const normalizedParam = normalizeSymbolValue(symbol);
        if (normalizedParam && getLastSymbol() === normalizedParam) {
          setLastSymbol(null);
        }
        console.log(`심볼 ${symbol}을(를) 블랙리스트에 자동 추가했습니다. (CSV 파일 없음)`);
        const updatedSymbols = listAvailableSymbols();
        res.status(404).json({
          error: '지정한 심볼의 CSV 데이터를 찾거나 읽을 수 없습니다.',
          blacklisted: true,
          symbol,
          symbols: updatedSymbols,
          lastSymbol: getLastSymbol(),
          lastFrame: getLastFrame(),
          frame: resolved?.frame ?? null,
          tried: resolved?.tried ?? []
        });
        return;
      } catch (blacklistError) {
        console.error(`심볼 ${symbol} 블랙리스트 추가 실패:`, blacklistError);
      }
    }
    
    res.status(404).json({
      error: '지정한 심볼의 CSV 데이터를 찾거나 읽을 수 없습니다.',
      frame: resolved?.frame ?? null,
      tried: resolved?.tried ?? []
    });
  }
});

router.post('/indicators/compute', (req: Request, res: Response) => {
  const { candles, keys, symbol, frame, limit, start, end } = req.body ?? {};
  if (!Array.isArray(keys) || keys.length === 0) {
    res.status(400).json({ error: 'keys 배열이 필요합니다.' });
    return;
  }

  let resolved: ResolveResult | undefined;
  let candleObjects: Candle[] | undefined;

  if (Array.isArray(candles) && candles.length > 0) {
    candleObjects = candles.map((item: any) => ({
      timestamp: Number(item.timestamp),
      open: Number(item.open),
      high: Number(item.high),
      low: Number(item.low),
      close: Number(item.close),
      volume: Number(item.volume ?? 0)
    }));
  } else if (typeof symbol === 'string' && symbol.trim().length > 0) {
    try {
      resolved = resolveCsvPath(symbol, typeof frame === 'string' ? frame : undefined);
      const limitValue = Number.isFinite(limit) && limit && limit > 0 ? Math.trunc(limit) : undefined;
      const minuteFrameSelected = isMinuteFrame(resolved.frame);
      // 날짜 필터가 있으면 전체 로드
      const hasDateFilter = (typeof start === 'string' && start.trim().length > 0) ||
                           (typeof end === 'string' && end.trim().length > 0);
      const inferredLimit = !limitValue && minuteFrameSelected && !hasDateFilter ? INTRADAY_DEFAULT_LIMIT : undefined;
      const requestedLimit = hasDateFilter ? undefined : (limitValue ?? inferredLimit);
      const effectiveLimit = requestedLimit
        ? minuteFrameSelected
          ? Math.max(1, Math.min(requestedLimit, INTRADAY_MAX_LIMIT))
          : Math.max(1, requestedLimit)
        : undefined;
      const loadOptions = effectiveLimit !== undefined ? { limit: effectiveLimit } : undefined;
      const loaded = loadCandlesFromCsv(resolved.filePath, loadOptions);
      const startTs = typeof start === 'string' ? parseStartTimestamp(start) : null;
      const endTs = typeof end === 'string' ? parseEndTimestamp(end) : null;
      // 날짜 필터가 있으면 limit 전달 안함
      const applyLimit = hasDateFilter ? undefined : effectiveLimit;
      const frameWindowOptions: { candles: Candle[]; frame?: string; limit?: number; start?: number | null; end?: number | null } = {
        candles: loaded,
        frame: resolved.frame,
        ...(applyLimit !== undefined ? { limit: applyLimit } : {}),
        ...(startTs != null ? { start: startTs } : {}),
        ...(endTs != null ? { end: endTs } : {})
      };
      const windowed = applyDefaultFrameWindow(frameWindowOptions);
      candleObjects = windowed.candles;
    } catch (error) {
      console.error('지표 계산용 CSV 로드 실패:', error);
      // CSV 파일을 찾을 수 없으면 자동으로 블랙리스트에 추가
      const errorMessage = error instanceof Error ? error.message : String(error);
      if (errorMessage.includes('CSV 파일을 찾을 수 없습니다')) {
        try {
          addSymbolToBlacklist(symbol);
          const normalizedParam = normalizeSymbolValue(symbol);
          if (normalizedParam && getLastSymbol() === normalizedParam) {
            setLastSymbol(null);
          }
          console.log(`심볼 ${symbol}을(를) 블랙리스트에 자동 추가했습니다. (CSV 파일 없음)`);
          const updatedSymbols = listAvailableSymbols();
          res.status(404).json({ 
            error: '지표 계산을 위한 캔들 데이터를 찾을 수 없습니다.',
            blacklisted: true,
            symbol,
            symbols: updatedSymbols,
            lastSymbol: getLastSymbol(),
            lastFrame: getLastFrame()
          });
          return;
        } catch (blacklistError) {
          console.error(`심볼 ${symbol} 블랙리스트 추가 실패:`, blacklistError);
        }
      }
      res.status(404).json({ error: '지표 계산을 위한 캔들 데이터를 찾을 수 없습니다.' });
      return;
    }
  }

  if (!candleObjects || candleObjects.length === 0) {
    res.status(400).json({ error: '계산에 사용할 캔들 데이터가 없습니다.' });
    return;
  }

  const payload = buildChartPayload(candleObjects);
  const series = computeIndicatorSeries({ keys, payload, registry });
  res.json({ indicators: series, frame: resolved?.frame ?? frame ?? null, count: candleObjects.length });
});

export default router;
