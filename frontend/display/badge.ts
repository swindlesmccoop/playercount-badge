import { findClassModule } from '@steambrew/client';
import type { PlayerCount } from '../services/playerCountApi';
import {
  BADGE_ID,
  PROTONDB_BADGE_ID,
  colorForPlayerCount,
  steamDbChartsUrl,
} from '../constants';

const PlayBar = (findClassModule?.(
  (m: any) => !!(m.GameStat && m.PlayBarLabel)
) as Record<string, string> | undefined) ?? null;

const KNOWN: Record<string, string> = {
  GameStat:            '_1kiZKVbDe-9Ikootk57kpA',
  GameStatWithIcon:    '_1aKegVl9_lSdNAyWYZQlr9',
  GameStatRight:       '_3m_zjRTQBqcfzCjXLXUHcR',
  PlayBarLabel:        '_34lrt5-Fc3usZU6trA1P0-',
  PlayBarDetailLabel:  '_2TYVGoD27ZMfjRirKQNLfk',
};

function c(key: string): string {
  return PlayBar?.[key] ?? KNOWN[key] ?? '';
}

export interface ToolbarTarget {
  row: HTMLElement;
  doc: Document;
}

function applyColor(el: HTMLElement, color: string): void {
  if (color) {
    el.style.color = color;
  } else {
    // Empty color means the "No colors" scheme: drop the inline style so
    // Steam's default text color applies.
    el.style.removeProperty('color');
  }
}

let lastOpenMs = 0;

function openSteamDbCharts(appId: number): void {
  const url = steamDbChartsUrl(appId);
  const w = window as any;

  const now = Date.now();
  if (now - lastOpenMs < 800) return;
  lastOpenMs = now;

  const openInSystemBrowser = w.SteamClient?.System?.OpenInSystemBrowser;
  if (typeof openInSystemBrowser === 'function') {
    try {
      openInSystemBrowser(url);
      return;
    } catch {
      // Fall through to the anchor click below.
    }
  }

  try {
    const link = w.document.createElement('a');
    link.href = url;
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    link.style.display = 'none';
    w.document.body.appendChild(link);
    link.click();
    link.remove();
  } catch {
    console.warn('[PlayerCount] Could not open SteamDB URL');
  }
}

function _findInDoc(doc: Document): HTMLElement | null {
  if (PlayBar?.GameStatsSection) {
    const els = doc.querySelectorAll('.' + PlayBar.GameStatsSection);
    if (els.length > 0) {
      return els[els.length - 1] as HTMLElement;
    }
  }

  if (PlayBar?.PlaytimeIcon) {
    const icons = doc.querySelectorAll('.' + PlayBar.PlaytimeIcon);
    if (icons.length > 0) {
      const icon = icons[icons.length - 1];
      const row = PlayBar.GameStatsSection
        ? icon.closest('.' + PlayBar.GameStatsSection) as HTMLElement | null
        : icon.parentElement?.parentElement?.parentElement as HTMLElement | null;
      if (row) return row;
    }
  }

  const svgs = doc.querySelectorAll('[class*="SVGIcon_PlayTime"], .SVGIcon_PlayTime');
  if (svgs.length > 0) {
    const row = svgs[svgs.length - 1].parentElement?.parentElement?.parentElement;
    if (row) return row as HTMLElement;
  }

  return null;
}

export function findToolbarRow(): ToolbarTarget | null {
  const inMain = _findInDoc(document);
  if (inMain) {
    return { row: inMain, doc: document };
  }

  const g_PM = (window as any).g_PopupManager;
  const popups: any[] = g_PM?.GetPopups?.() ?? [];
  for (const popup of popups) {
    let popDoc: Document | null = null;
    try { popDoc = popup?.window?.document; } catch { continue; }
    if (!popDoc || popDoc === document) continue;
    const found = _findInDoc(popDoc);
    if (found) {
      return { row: found, doc: popDoc };
    }
  }

  return null;
}

export function insertBadgeInRow(row: HTMLElement, badge: HTMLElement): void {
  const protonBadge = row.querySelector('#' + PROTONDB_BADGE_ID);
  if (protonBadge) {
    row.insertBefore(badge, protonBadge);
    return;
  }
  row.appendChild(badge);
}

export function ensureBadgePosition(row: HTMLElement, badge: HTMLElement): void {
  const protonBadge = row.querySelector('#' + PROTONDB_BADGE_ID);
  if (protonBadge && badge.nextElementSibling !== protonBadge) {
    row.insertBefore(badge, protonBadge);
  }
}

const SVG_NS = 'http://www.w3.org/2000/svg';
const ICON_STYLE_ID = 'playercount-badge-style';
const ICON_CLASS = 'playercount-badge-icon';

// Two overlapping players, drawn as an outline on Steam's 26px icon grid. Size,
// stroke weight and color were measured against the clock and trophy glyphs
// (24-26px wide, ~2.2px stroke, white at 52% alpha) so it reads as one set.
const PLAYERS_ICON_SHAPES = [
  { tag: 'circle', attrs: { cx: '9.3', cy: '7.4', r: '4.3' } },
  { tag: 'path', attrs: { d: 'M2.1 23.4v-1.5c0-4 3.2-7.3 7.2-7.3s7.2 3.3 7.2 7.3v1.5z' } },
  { tag: 'path', attrs: { d: 'M17 3.1a4.3 4.3 0 0 1 0 8.6' } },
  { tag: 'path', attrs: { d: 'M19.6 14.8c2.8.9 4.4 3.4 4.4 6.9v1.7h-4' } },
];

function createPlayersIcon(doc: Document): SVGSVGElement {
  const svg = doc.createElementNS(SVG_NS, 'svg');
  svg.setAttribute('viewBox', '0 0 26 26');
  svg.setAttribute('width', '26');
  svg.setAttribute('height', '26');
  svg.setAttribute('fill', 'none');
  svg.setAttribute('stroke', 'hsla(0, 0%, 100%, 0.52)');
  svg.setAttribute('stroke-width', '2.2');
  svg.setAttribute('stroke-linecap', 'round');
  svg.setAttribute('stroke-linejoin', 'round');
  svg.style.display = 'block';

  for (const { tag, attrs } of PLAYERS_ICON_SHAPES) {
    const shape = doc.createElementNS(SVG_NS, tag);
    for (const [name, value] of Object.entries(attrs)) {
      shape.setAttribute(name, value);
    }
    svg.appendChild(shape);
  }

  return svg;
}

// Steam hides its own stat icons in the narrow side panel and in the basic UI
// layout. Mirror that so our icon never crowds the text in those layouts.
function ensureIconStyle(doc: Document): void {
  if (doc.getElementById(ICON_STYLE_ID)) return;
  const style = doc.createElement('style');
  style.id = ICON_STYLE_ID;
  style.textContent =
    `.NarrowRightPanel .${ICON_CLASS}, .BasicUI .${ICON_CLASS} { display: none !important; }`;
  (doc.head ?? doc.documentElement).appendChild(style);
}

export function updateBadgeValue(badge: HTMLElement, playerCount: PlayerCount): void {
  const color = colorForPlayerCount(playerCount.count);
  applyColor(badge, color);

  const valueSpan = badge.querySelector('[data-playercount-value="true"]') as HTMLElement | null;
  if (valueSpan) {
    valueSpan.textContent = playerCount.formatted;
    applyColor(valueSpan, color);
  }
}

export function createBadge(playerCount: PlayerCount, appId: number, doc: Document): HTMLElement {
  const color = colorForPlayerCount(playerCount.count);

  const tile = doc.createElement('div');
  tile.id = BADGE_ID;
  tile.className = [c('GameStat'), c('GameStatWithIcon')].filter(Boolean).join(' ');
  applyColor(tile, color);
  tile.style.cursor = 'pointer';
  tile.style.pointerEvents = 'auto';
  tile.title = 'Open SteamDB charts';
  tile.setAttribute('role', 'button');
  tile.setAttribute('tabindex', '0');
  tile.addEventListener('click', (ev: MouseEvent) => {
    ev.preventDefault();
    ev.stopPropagation();
    openSteamDbCharts(appId);
  });
  tile.addEventListener('mousedown', (ev: MouseEvent) => {
    ev.preventDefault();
    ev.stopPropagation();
  });
  tile.addEventListener('keydown', (ev: KeyboardEvent) => {
    if (ev.key === 'Enter' || ev.key === ' ') {
      ev.preventDefault();
      openSteamDbCharts(appId);
    }
  });

  ensureIconStyle(doc);

  const iconDiv = doc.createElement('div');
  iconDiv.className = ICON_CLASS;
  // Use Steam's own icon metrics (30px box, 3px margin) pinned to the top. The
  // old auto-margin centering floated the glyph down whenever a sibling tile,
  // such as Achievements with its progress bar, made the row taller than ours,
  // and the row's overflow clip then cut it off. We still avoid Steam's icon
  // classes because newer clients paint a clock glyph on them.
  iconDiv.style.display = 'flex';
  iconDiv.style.alignItems = 'center';
  iconDiv.style.justifyContent = 'center';
  iconDiv.style.alignSelf = 'flex-start';
  iconDiv.style.flexShrink = '0';
  iconDiv.style.width = '30px';
  iconDiv.style.height = '30px';
  iconDiv.style.margin = '3px';
  iconDiv.appendChild(createPlayersIcon(doc));

  const rightDiv = doc.createElement('div');
  rightDiv.className = c('GameStatRight');

  const labelSpan = doc.createElement('span');
  labelSpan.className = c('PlayBarLabel');
  labelSpan.textContent = 'Players';

  const valueSpan = doc.createElement('span');
  valueSpan.className = c('PlayBarDetailLabel');
  valueSpan.setAttribute('data-playercount-value', 'true');
  valueSpan.textContent = playerCount.formatted;
  applyColor(valueSpan, color);

  rightDiv.appendChild(labelSpan);
  rightDiv.appendChild(valueSpan);

  tile.appendChild(iconDiv);
  tile.appendChild(rightDiv);

  return tile;
}
