import { BrowserWindow } from 'electron';
import path from 'node:path';
import type { WindowBounds } from '../settings/bootstrap-settings';

export const createMainWindow = (bounds?: WindowBounds): BrowserWindow => {
  const win = new BrowserWindow({
    x: bounds?.x,
    y: bounds?.y,
    width: bounds?.width ?? 1280,
    height: bounds?.height ?? 800,
    minWidth: 720,
    minHeight: 480,
    titleBarStyle: 'hiddenInset',
    backgroundColor: '#1a1a1f',
    webPreferences: {
      preload: path.join(__dirname, '..', 'preload', 'index.cjs'),
      sandbox: true,
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  const devUrl = process.env['VITE_DEV_URL'];
  if (devUrl) {
    win.loadURL(devUrl);
  } else {
    win.loadFile(path.join(__dirname, '..', 'shell', 'index.html'));
  }

  return win;
};

export const getCurrentBounds = (win: BrowserWindow): WindowBounds | null => {
  if (win.isDestroyed()) return null;
  const b = win.getBounds();
  return { x: b.x, y: b.y, width: b.width, height: b.height };
};
