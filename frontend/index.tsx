import { useState } from 'react';
import {
  Button,
  definePlugin,
  Dropdown,
  Field,
  Toggle,
} from '@steambrew/client';
import {
  COLOR_SCHEMES,
  DEFAULT_SINGLE_COLOR,
  REFRESH_OPTIONS,
  TIER_LABELS,
  getColorSchemeId,
  getCustomColors,
  getRefreshIntervalSeconds,
  getSingleColor,
  isPluginEnabled,
  resetCustomColors,
  setColorSchemeId,
  setCustomColors,
  setPluginEnabled,
  setRefreshIntervalSeconds,
  setSingleColor,
} from './constants';
import type { ColorSchemeId } from './constants';
import { UIMode } from './injection/detector';
import {
  applyRefreshInterval,
  disconnectObserver,
  refreshBadgeColors,
  setupObserver,
} from './injection/observer';

const SWATCH_STYLE = {
  width: '32px',
  height: '32px',
  padding: 0,
  border: '1px solid rgba(255, 255, 255, 0.25)',
  borderRadius: '4px',
  background: 'none',
  cursor: 'pointer',
} as const;

function PluginSettings() {
  const [showBadge, setShowBadge] = useState<boolean>(isPluginEnabled());
  const [schemeId, setSchemeId] = useState<ColorSchemeId>(getColorSchemeId());
  const [customColors, setCustomColorsState] = useState<string[]>(getCustomColors());
  const [singleColor, setSingleColorState] = useState<string>(getSingleColor());
  const [refreshSeconds, setRefreshSeconds] = useState<number>(getRefreshIntervalSeconds());

  const applyScheme = (id: ColorSchemeId) => {
    setSchemeId(id);
    setColorSchemeId(id);
    refreshBadgeColors();
  };

  const applyCustomColor = (tierIndex: number, hex: string) => {
    const next = [...customColors];
    next[tierIndex] = hex;
    setCustomColorsState(next);
    setCustomColors(next);
    refreshBadgeColors();
  };

  const applySingleColor = (hex: string) => {
    setSingleColorState(hex);
    setSingleColor(hex);
    refreshBadgeColors();
  };

  const handleResetCustom = () => {
    const defaults = resetCustomColors();
    setCustomColorsState(defaults);
    refreshBadgeColors();
  };

  const handleResetSingle = () => {
    applySingleColor(DEFAULT_SINGLE_COLOR);
  };

  const applyRefresh = (seconds: number) => {
    setRefreshSeconds(seconds);
    setRefreshIntervalSeconds(seconds);
    applyRefreshInterval();
  };

  const scheme = COLOR_SCHEMES.find((s) => s.id === schemeId);

  return (
    <div>
      <style>{`
        .pcb-swatch::-webkit-color-swatch-wrapper { padding: 0; }
        .pcb-swatch::-webkit-color-swatch { border: none; }
        .pcb-swatch::-moz-color-swatch { border: none; }
      `}</style>
      <Field label="Show live player count">
        <Toggle
          value={showBadge}
          onChange={(value: boolean) => {
            setShowBadge(value);
            setPluginEnabled(value);
            if (!value) {
              disconnectObserver();
            } else {
              setupObserver(document, UIMode.Desktop);
            }
          }}
        />
      </Field>

      <Field
        label="Refresh interval"
        description="How often the player count updates. Longer intervals are gentler on Valve's API."
      >
        <Dropdown
          rgOptions={REFRESH_OPTIONS.map((o) => ({ label: o.label, data: o.seconds }))}
          selectedOption={refreshSeconds}
          onChange={(opt) => applyRefresh(opt.data as number)}
        />
      </Field>

      <Field label="Color scheme" description={scheme?.description}>
        <Dropdown
          rgOptions={COLOR_SCHEMES.map((s) => ({ label: s.label, data: s.id }))}
          selectedOption={schemeId}
          onChange={(opt) => applyScheme(opt.data as ColorSchemeId)}
        />
      </Field>

      {schemeId === 'single' && (
        <>
          <Field label="Badge color">
            <input
              type="color"
              className="pcb-swatch"
              value={singleColor}
              onChange={(e) => applySingleColor(e.target.value)}
              style={SWATCH_STYLE}
              aria-label="Pick badge color"
            />
          </Field>
          <Field
            label="Reset badge color"
            description="Restore the default Steam blue."
          >
            <Button onClick={handleResetSingle}>Reset</Button>
          </Field>
        </>
      )}

      {schemeId === 'custom' && (
        <>
          {customColors.map((color, i) => (
            <Field key={TIER_LABELS[i]} label={TIER_LABELS[i]}>
              <input
                type="color"
                className="pcb-swatch"
                value={color}
                onChange={(e) => applyCustomColor(i, e.target.value)}
                style={SWATCH_STYLE}
                aria-label={`Pick color for ${TIER_LABELS[i]}`}
              />
            </Field>
          ))}
          <Field
            label="Reset custom colors"
            description="Restore the default palette for all five tiers."
          >
            <Button onClick={handleResetCustom}>Reset</Button>
          </Field>
        </>
      )}
    </div>
  );
}

export default definePlugin(() => {
  console.log('[PlayerCount] plugin loaded');

  setupObserver(document, UIMode.Desktop);

  return {
    title: 'Player Count',
    icon: null,
    onDismount() {
      disconnectObserver();
    },
    content: <PluginSettings />,
  };
});
