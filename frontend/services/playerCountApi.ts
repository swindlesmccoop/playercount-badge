import { callable } from '@steambrew/client';
import { formatPlayerCount } from '../constants';

const fetchFn = callable<[{ appId: number }], string>('FetchPlayerCount');

export interface PlayerCount {
  count: number;
  formatted: string;
}

interface CacheEntry {
  value: PlayerCount | null;
  fetchedAt: number;
}

const CACHE_TTL_MS = 25_000;
// Upper bound for a single backend round-trip. The Lua side already times out
// its HTTP call at 10s; this guards against the IPC layer itself stalling.
const FETCH_TIMEOUT_MS = 15_000;
const cache = new Map<number, CacheEntry>();

export function clearPlayerCountCache(appId?: number): void {
  if (appId === undefined) {
    cache.clear();
    return;
  }
  cache.delete(appId);
}

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error(`timed out after ${ms}ms`)), ms);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

export async function fetchPlayerCount(
  appId: number,
  options: { bypassCache?: boolean } = {},
): Promise<PlayerCount | null> {
  if (!options.bypassCache) {
    const cached = cache.get(appId);
    if (cached && Date.now() - cached.fetchedAt < CACHE_TTL_MS) {
      return cached.value;
    }
  }

  try {
    const json = await withTimeout(fetchFn({ appId }), FETCH_TIMEOUT_MS);
    const data = JSON.parse(json);
    const result = data?.response;

    if (!result || result.result !== 1 || typeof result.player_count !== 'number') {
      cache.set(appId, { value: null, fetchedAt: Date.now() });
      return null;
    }

    const value: PlayerCount = {
      count: result.player_count,
      formatted: formatPlayerCount(result.player_count),
    };

    cache.set(appId, { value, fetchedAt: Date.now() });
    return value;
  } catch (e) {
    console.error('[PlayerCount] error fetching count:', e);
    cache.set(appId, { value: null, fetchedAt: Date.now() });
    return null;
  }
}
