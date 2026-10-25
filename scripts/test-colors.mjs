// Unit tests for the playercount-badge color scheme + refresh logic.
// Run from the repo root: node scripts/test-colors.mjs
// (imports constants.ts directly; node strips types)
import assert from 'node:assert';

// Minimal localStorage stub (constants.ts reads it at call time).
const store = new Map();
globalThis.localStorage = {
  getItem: (k) => (store.has(k) ? store.get(k) : null),
  setItem: (k, v) => store.set(k, String(v)),
  removeItem: (k) => store.delete(k),
  clear: () => store.clear(),
};

const C = await import('../frontend/constants.ts');

let pass = 0;
function check(name, fn) {
  store.clear();
  try {
    fn();
    pass++;
  } catch (e) {
    console.error('FAIL:', name, '-', e.message);
    process.exitCode = 1;
  }
}

// --- default scheme matches the original hardcoded colors ---
check('default scheme tiers', () => {
  assert.equal(C.colorForPlayerCount(0), '#4b9eea');
  assert.equal(C.colorForPlayerCount(1000), '#4b9eea');
  assert.equal(C.colorForPlayerCount(1001), '#cd7f32');
  assert.equal(C.colorForPlayerCount(5000), '#cd7f32');
  assert.equal(C.colorForPlayerCount(5001), '#a6a6a6');
  assert.equal(C.colorForPlayerCount(10000), '#a6a6a6');
  assert.equal(C.colorForPlayerCount(10001), '#cfb53b');
  assert.equal(C.colorForPlayerCount(50000), '#cfb53b');
  assert.equal(C.colorForPlayerCount(50001), '#e80e0e');
  assert.equal(C.colorForPlayerCount(250000), '#e80e0e');
});

// --- all six schemes registered, palettes well-formed ---
check('scheme registry', () => {
  const ids = C.COLOR_SCHEMES.map((s) => s.id);
  for (const id of ['default', 'gradient', 'rarity', 'single', 'none', 'custom']) {
    assert.ok(ids.includes(id), `missing scheme ${id}`);
  }
  for (const s of C.COLOR_SCHEMES) {
    if (s.singleColor) {
      assert.equal(s.id, 'single');
      assert.deepEqual(s.colors, []);
    } else if (s.id === 'none' || s.id === 'custom') {
      assert.deepEqual(s.colors, []);
    } else {
      assert.equal(s.colors.length, 5, `${s.id} needs 5 colors`);
    }
  }
});

// --- none scheme returns empty string (Steam default applies) ---
check('none scheme', () => {
  C.setColorSchemeId('none');
  assert.equal(C.colorForPlayerCount(999999), '');
  assert.equal(C.colorForPlayerCount(0), '');
});

// --- single scheme paints every tier with one color ---
check('single color scheme', () => {
  C.setColorSchemeId('single');
  assert.equal(C.colorForPlayerCount(10), C.DEFAULT_SINGLE_COLOR);
  C.setSingleColor('#ff0000');
  assert.equal(C.getSingleColor(), '#ff0000');
  for (const n of [0, 999, 1001, 6000, 11000, 60000]) {
    assert.equal(C.colorForPlayerCount(n), '#ff0000');
  }
  C.setSingleColor('not-a-color');
  assert.equal(C.getSingleColor(), '#ff0000'); // invalid writes ignored
});

// --- custom scheme round-trips through storage ---
check('custom colors', () => {
  const custom = ['#111111', '#222222', '#333333', '#444444', '#555555'];
  C.setColorSchemeId('custom');
  C.setCustomColors(custom);
  assert.equal(C.colorForPlayerCount(10), '#111111');
  assert.equal(C.colorForPlayerCount(60000), '#555555');
  assert.deepEqual(C.getCustomColors(), custom);
  C.setCustomColors(['#123456']); // wrong length ignored
  assert.deepEqual(C.getCustomColors(), custom);
});

// --- corrupt storage falls back safely ---
check('storage fallbacks', () => {
  store.set('playercount-badge.colorScheme', 'bogus');
  assert.equal(C.getColorSchemeId(), 'default');
  store.set('playercount-badge.colorScheme', 'custom');
  store.set('playercount-badge.customColors', 'not-json');
  assert.equal(C.colorForPlayerCount(10), '#4b9eea'); // default palette
  store.set('playercount-badge.customColors', JSON.stringify(['#123456']));
  assert.equal(C.colorForPlayerCount(10), '#4b9eea'); // wrong length -> defaults
  store.set(
    'playercount-badge.customColors',
    JSON.stringify(['red', '#123456', '#123456', '#123456', '#123456']),
  );
  assert.equal(C.colorForPlayerCount(10), '#4b9eea'); // invalid hex -> defaults
  store.set('playercount-badge.singleColor', 'blue');
  assert.equal(C.getSingleColor(), C.DEFAULT_SINGLE_COLOR);
});

// --- refresh interval options: 30s..5min, validated ---
check('refresh interval', () => {
  assert.equal(C.getRefreshIntervalSeconds(), C.DEFAULT_REFRESH_SECONDS);
  assert.equal(C.DEFAULT_REFRESH_SECONDS, 30);
  for (const o of C.REFRESH_OPTIONS) {
    C.setRefreshIntervalSeconds(o.seconds);
    assert.equal(C.getRefreshIntervalSeconds(), o.seconds);
  }
  assert.deepEqual(
    C.REFRESH_OPTIONS.map((o) => o.seconds),
    [30, 60, 120, 300],
  );
  C.setRefreshIntervalSeconds(7); // not an option -> ignored
  assert.equal(C.getRefreshIntervalSeconds(), 300);
  store.set('playercount-badge.refreshInterval', '999');
  assert.equal(C.getRefreshIntervalSeconds(), 30); // corrupt -> default
});

// --- scheme switching applies immediately ---
check('scheme switching', () => {
  C.setColorSchemeId('rarity');
  assert.equal(C.colorForPlayerCount(10), '#a6a6a6');
  C.setColorSchemeId('gradient');
  assert.equal(C.colorForPlayerCount(60000), '#e80e0e');
  C.setColorSchemeId('single');
  C.setSingleColor('#00ff00');
  assert.equal(C.colorForPlayerCount(60000), '#00ff00');
});

console.log(`\n${pass} test groups passed`);
