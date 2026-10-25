export enum UIMode {
  Desktop = 'desktop',
  BigPicture = 'bigpicture',
}

export interface GamePageInfo {
  appId: number;
  mode: UIMode;
}

export function detectGamePage(_doc: Document, _mode: UIMode): GamePageInfo | null {
  const pathname = window.MainWindowBrowserManager?.m_lastLocation?.pathname;
  if (pathname) {
    const m = pathname.match(/\/app\/(\d+)/);
    if (m) {
      return { appId: parseInt(m[1], 10), mode: UIMode.Desktop };
    }
  }

  return null;
}
