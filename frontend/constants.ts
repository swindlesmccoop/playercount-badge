export const BADGE_ID = 'playercount-badge';
export const PROTONDB_BADGE_ID = 'protondb-status-badge';
export const STORAGE_KEY_SHOW = 'playercount-badge.show';
export const STORAGE_KEY_COLOR_SCHEME = 'playercount-badge.colorScheme';
export const STORAGE_KEY_CUSTOM_COLORS = 'playercount-badge.customColors';
export const STORAGE_KEY_SINGLE_COLOR = 'playercount-badge.singleColor';
export const STORAGE_KEY_REFRESH_INTERVAL = 'playercount-badge.refreshInterval';
export const ACHIEVEMENTS_WAIT_MS = 400;

export function steamDbChartsUrl(appId: number): string {
  return `https://steamdb.info/app/${appId}/charts/`;
}

export function formatPlayerCount(count: number): string {
  return new Intl.NumberFormat('en-US').format(count);
}

// Player count tiers, lowest to highest. Thresholds are in players.
export const TIER_VERY_HIGH = 50_000;
export const TIER_HIGH = 10_000;
export const TIER_MEDIUM = 5_000;
export const TIER_LOW = 1_000;

export const TIER_LABELS = [
  'Under 1K players',
  '1K – 5K players',
  '5K – 10K players',
  '10K – 50K players',
  'Over 50K players',
] as const;

export type ColorSchemeId = 'default' | 'gradient' | 'rarity' | 'none' | 'single' | 'custom';

export interface ColorScheme {
  id: ColorSchemeId;
  label: string;
  description: string;
  /** Fixed palette, lowest tier first. Empty when the scheme has no fixed palette. */
  colors: string[];
  /** True when the scheme paints every tier with one user-picked color. */
  singleColor?: boolean;
}

const DEFAULT_PALETTE = ['#4b9eea', '#cd7f32', '#a6a6a6', '#cfb53b', '#e80e0e'];

export const COLOR_SCHEMES: ColorScheme[] = [
  {
    id: 'default',
    label: 'Default',
    description: 'The original blue, bronze, gray, gold, red palette.',
    colors: [...DEFAULT_PALETTE],
  },
  {
    id: 'gradient',
    label: 'Gradient',
    description: 'Cool gray rising through green, gold and orange to red.',
    colors: ['#7f8ea3', '#43a047', '#cfb53b', '#e67e22', '#e80e0e'],
  },
  {
    id: 'rarity',
    label: 'Rarity',
    description: 'Game-rarity style: gray, green, blue, purple, orange.',
    colors: ['#a6a6a6', '#43a047', '#4b9eea', '#9b59b6', '#f39c12'],
  },
  {
    id: 'single',
    label: 'Single color',
    description: 'One color for every tier. Pick it below.',
    colors: [],
    singleColor: true,
  },
  {
    id: 'none',
    label: 'No colors',
    description: "Use Steam's default text color for the badge.",
    colors: [],
  },
  {
    id: 'custom',
    label: 'Custom',
    description: 'Pick your own color for each tier below.',
    colors: [],
  },
];

/** Steam's signature light blue. Sensible default for the single-color scheme. */
export const DEFAULT_SINGLE_COLOR = '#66c0f4';

const HEX_RE = /^#[0-9a-f]{6}$/i;

function isHexColor(value: unknown): value is string {
  return typeof value === 'string' && HEX_RE.test(value);
}

function isValidColorList(value: unknown): value is string[] {
  return (
    Array.isArray(value) && value.length === 5 && value.every(isHexColor)
  );
}

function readStoredSchemeId(): ColorSchemeId | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_COLOR_SCHEME);
    if (raw && COLOR_SCHEMES.some((s) => s.id === raw)) {
      return raw as ColorSchemeId;
    }
  } catch {
    // Storage unavailable; fall through to default.
  }
  return null;
}

export function getColorSchemeId(): ColorSchemeId {
  return readStoredSchemeId() ?? 'default';
}

export function setColorSchemeId(id: ColorSchemeId): void {
  try {
    localStorage.setItem(STORAGE_KEY_COLOR_SCHEME, id);
  } catch {
    // Storage unavailable; the in-memory default still applies this session.
  }
}

export function getCustomColors(): string[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_CUSTOM_COLORS);
    if (raw) {
      const parsed: unknown = JSON.parse(raw);
      if (isValidColorList(parsed)) {
        return [...parsed];
      }
    }
  } catch {
    // Corrupt or unavailable storage; fall through to defaults.
  }
  return [...DEFAULT_PALETTE];
}

export function setCustomColors(colors: string[]): void {
  if (!isValidColorList(colors)) {
    return;
  }
  try {
    localStorage.setItem(STORAGE_KEY_CUSTOM_COLORS, JSON.stringify(colors));
  } catch {
    // Storage unavailable; ignore.
  }
}

/** Restores the default palette. Returns the palette that is now active. */
export function resetCustomColors(): string[] {
  const defaults = [...DEFAULT_PALETTE];
  try {
    localStorage.setItem(STORAGE_KEY_CUSTOM_COLORS, JSON.stringify(defaults));
  } catch {
    // Storage unavailable; ignore.
  }
  return defaults;
}

export function getSingleColor(): string {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_SINGLE_COLOR);
    if (isHexColor(raw)) {
      return raw;
    }
  } catch {
    // Storage unavailable; fall through to default.
  }
  return DEFAULT_SINGLE_COLOR;
}

export function setSingleColor(color: string): void {
  if (!isHexColor(color)) {
    return;
  }
  try {
    localStorage.setItem(STORAGE_KEY_SINGLE_COLOR, color);
  } catch {
    // Storage unavailable; ignore.
  }
}

/** The fixed palette for the active scheme, or [] when it has none. */
export function activeColors(): string[] {
  const schemeId = getColorSchemeId();
  if (schemeId === 'custom') {
    return getCustomColors();
  }
  const scheme = COLOR_SCHEMES.find((s) => s.id === schemeId);
  return scheme ? [...scheme.colors] : [...DEFAULT_PALETTE];
}

export function colorForPlayerCount(count: number): string {
  const schemeId = getColorSchemeId();

  if (schemeId === 'single') {
    return getSingleColor();
  }

  const colors = activeColors();
  if (colors.length === 0) {
    // Schemes without colors ("No colors") fall back to Steam's default text.
    return '';
  }

  if (count > TIER_VERY_HIGH) return colors[4];
  if (count > TIER_HIGH) return colors[3];
  if (count > TIER_MEDIUM) return colors[2];
  if (count > TIER_LOW) return colors[1];
  return colors[0];
}

export function isPluginEnabled(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY_SHOW) !== 'false';
  } catch {
    return true;
  }
}

export function setPluginEnabled(enabled: boolean): void {
  try {
    localStorage.setItem(STORAGE_KEY_SHOW, String(enabled));
  } catch {
    // Storage unavailable; the toggle still applies for this session.
  }
}

export interface RefreshOption {
  label: string;
  /** Interval in seconds. */
  seconds: number;
}

export const REFRESH_OPTIONS: RefreshOption[] = [
  { label: '30 seconds', seconds: 30 },
  { label: '1 minute', seconds: 60 },
  { label: '2 minutes', seconds: 120 },
  { label: '5 minutes', seconds: 300 },
];

export const DEFAULT_REFRESH_SECONDS = 30;

export function getRefreshIntervalSeconds(): number {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_REFRESH_INTERVAL);
    const seconds = raw ? parseInt(raw, 10) : NaN;
    if (REFRESH_OPTIONS.some((o) => o.seconds === seconds)) {
      return seconds;
    }
  } catch {
    // Storage unavailable; fall through to default.
  }
  return DEFAULT_REFRESH_SECONDS;
}

export function setRefreshIntervalSeconds(seconds: number): void {
  if (!REFRESH_OPTIONS.some((o) => o.seconds === seconds)) {
    return;
  }
  try {
    localStorage.setItem(STORAGE_KEY_REFRESH_INTERVAL, String(seconds));
  } catch {
    // Storage unavailable; ignore.
  }
}
