import { app, BrowserWindow, Menu } from 'electron';
import { runMigrations } from './storage/migrations/runner';
import { closeDb } from './storage/db';
import { SpaceRepository } from './storage/repositories/space-repo';
import { createMainWindow, getCurrentBounds } from './window/main-window';
import { buildApplicationMenu } from './window/menu';
import { TabManager } from './tabs/tab-manager';
import { Broadcaster } from './ipc/broadcaster';
import { registerHandlers } from './ipc/handlers';
import { SettingsService } from './settings/settings-service';
import { loadBootstrap, saveBootstrap } from './settings/bootstrap-settings';

let mainWindow: BrowserWindow | null = null;
let tabManager: TabManager | null = null;
let saveBoundsTimer: NodeJS.Timeout | null = null;

const scheduleSaveBounds = (): void => {
  if (!mainWindow) return;
  if (saveBoundsTimer) clearTimeout(saveBoundsTimer);
  saveBoundsTimer = setTimeout(() => {
    if (!mainWindow) return;
    const bounds = getCurrentBounds(mainWindow);
    if (bounds) saveBootstrap({ windowBounds: bounds });
  }, 500);
};

app.whenReady().then(() => {
  Menu.setApplicationMenu(buildApplicationMenu());

  runMigrations();
  const defaultSpace = SpaceRepository.ensureDefault();

  const bootstrap = loadBootstrap();
  mainWindow = createMainWindow(bootstrap.windowBounds);

  const broadcaster = new Broadcaster(() => mainWindow);
  const settingsService = new SettingsService(broadcaster);
  settingsService.init();

  tabManager = new TabManager(mainWindow, broadcaster, settingsService, defaultSpace.id);

  registerHandlers(tabManager, settingsService);

  // 既存のタブ復元（archive 以外）
  const { activeTabId } = tabManager.hydrateFromDb();

  mainWindow.webContents.once('did-finish-load', () => {
    if (activeTabId && tabManager) {
      tabManager.activate(activeTabId);
    }
  });

  // ウィンドウ位置・サイズの永続化
  mainWindow.on('resize', scheduleSaveBounds);
  mainWindow.on('move', scheduleSaveBounds);

  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      mainWindow = createMainWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('before-quit', () => {
  if (mainWindow) {
    const bounds = getCurrentBounds(mainWindow);
    if (bounds) saveBootstrap({ windowBounds: bounds });
  }
  closeDb();
});
