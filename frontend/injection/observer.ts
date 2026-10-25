import { UIMode, detectGamePage } from './detector';
import { clearPlayerCountCache, fetchPlayerCount } from '../services/playerCountApi';
import type { PlayerCount } from '../services/playerCountApi';
import {
  createBadge,
  ensureBadgePosition,
  findToolbarRow,
  insertBadgeInRow,
  updateBadgeValue,
} from '../display/badge';
import {
  ACHIEVEMENTS_WAIT_MS,
  BADGE_ID,
  getRefreshIntervalSeconds,
  isPluginEnabled,
} from '../constants';

let observer: MutationObserver | null = null;
let intervalId: ReturnType<typeof setInterval> | null = null;
let refreshIntervalId: ReturnType<typeof setInterval> | null = null;
let currentAppId: number | null = null;
let processingAppId: number | null = null;
let panelDoc: Document | null = null;
let lastPlayerCount: PlayerCount | null = null;

function clearRefreshInterval(): void {
  if (refreshIntervalId !== null) {
    clearInterval(refreshIntervalId);
    refreshIntervalId = null;
  }
}

// Re-applies the current color scheme to the visible badge without
// re-fetching. Called when the user changes color settings.
export function refreshBadgeColors(): void {
  const badge = panelDoc?.getElementById(BADGE_ID) as HTMLElement | null;
  if (badge && lastPlayerCount) {
    updateBadgeValue(badge, lastPlayerCount);
  }
}

function clearCurrentBadge(): void {
  panelDoc?.getElementById(BADGE_ID)?.remove();
  panelDoc = null;
  clearRefreshInterval();
}

function resetStateForNoGame(): void {
  clearCurrentBadge();
  currentAppId = null;
  processingAppId = null;
  lastPlayerCount = null;
}

function startRefreshLoop(appId: number): void {
  clearRefreshInterval();

  const intervalMs = getRefreshIntervalSeconds() * 1000;
  refreshIntervalId = setInterval(async () => {
    if (currentAppId !== appId || !isPluginEnabled()) return;

    if (!panelDoc?.getElementById(BADGE_ID)) return;

    const playerCount = await fetchPlayerCount(appId, { bypassCache: true });
    if (currentAppId !== appId || !playerCount) return;

    lastPlayerCount = playerCount;
    // Look the badge up again: Steam may have re-rendered the row during the
    // request, which would leave a reference taken before it pointing at a
    // detached node.
    const badge = panelDoc?.getElementById(BADGE_ID) as HTMLElement | null;
    if (badge) {
      updateBadgeValue(badge, playerCount);
    }
  }, intervalMs);
}

// Restarts the refresh loop with the currently configured interval.
// Called when the user changes the refresh setting.
export function applyRefreshInterval(): void {
  if (currentAppId !== null && refreshIntervalId !== null) {
    startRefreshLoop(currentAppId);
  }
}

export function disconnectObserver(): void {
  observer?.disconnect();
  observer = null;
  if (intervalId !== null) {
    clearInterval(intervalId);
    intervalId = null;
  }
  clearRefreshInterval();
  panelDoc?.getElementById(BADGE_ID)?.remove();
  currentAppId = null;
  processingAppId = null;
  panelDoc = null;
  lastPlayerCount = null;
  clearPlayerCountCache();
}

export function setupObserver(doc: Document, mode: UIMode): void {
  disconnectObserver();

  observer = new MutationObserver(() => handleGamePage(doc, mode));
  observer.observe(doc.body, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ['class'],
  });

  intervalId = setInterval(() => handleGamePage(doc, mode), 500);
  handleGamePage(doc, mode);
}

async function handleGamePage(doc: Document, mode: UIMode): Promise<void> {
  try {
    await _handleGamePage(doc, mode);
  } catch (e) {
    console.error('[PlayerCount] handleGamePage threw:', e);
  }
}

async function _handleGamePage(doc: Document, mode: UIMode): Promise<void> {
  if (!isPluginEnabled()) {
    if (currentAppId !== null) {
      resetStateForNoGame();
    }
    return;
  }

  const info = detectGamePage(doc, mode);
  if (!info) {
    if (currentAppId !== null) {
      resetStateForNoGame();
    }
    return;
  }

  const { appId } = info;

  if (currentAppId !== appId) {
    clearCurrentBadge();
    if (currentAppId !== null) {
      clearPlayerCountCache(currentAppId);
    }
    currentAppId = appId;
    processingAppId = null;
  }

  const existingBadge = panelDoc?.getElementById(BADGE_ID) as HTMLElement | null;
  if (existingBadge) {
    const row = existingBadge.parentElement;
    if (row) {
      ensureBadgePosition(row, existingBadge);
    }
    if (!refreshIntervalId) {
      startRefreshLoop(appId);
    }
    return;
  }

  if (processingAppId === appId) return;

  processingAppId = appId;

  const target = findToolbarRow();
  if (!target) {
    processingAppId = null;
    return;
  }
  panelDoc = target.doc;

  const playerCount = await fetchPlayerCount(appId);
  if (currentAppId !== appId) {
    processingAppId = null;
    return;
  }
  if (!playerCount) {
    processingAppId = null;
    return;
  }

  const deadline = Date.now() + ACHIEVEMENTS_WAIT_MS;
  while (Date.now() < deadline) {
    const rowNow = findToolbarRow()?.row ?? target.row;
    const hasAchievements = Array.from(rowNow.children).some(
      el => el.textContent?.includes('Achievements'),
    );
    if (hasAchievements) break;
    await new Promise(r => setTimeout(r, 50));
  }

  if (currentAppId !== appId) {
    processingAppId = null;
    return;
  }

  const freshTarget = findToolbarRow() ?? target;
  panelDoc = freshTarget.doc;

  const badge = createBadge(playerCount, appId, freshTarget.doc);
  insertBadgeInRow(freshTarget.row, badge);
  lastPlayerCount = playerCount;
  startRefreshLoop(appId);
  processingAppId = null;
}
