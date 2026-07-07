import { Menu, type MenuItemConstructorOptions, type WebContents } from 'electron';

const isMac = process.platform === 'darwin';

// windowMenu ロールは既定で Close（Cmd+W）を含み、これはアプリ独自の
// Cmd+W（アクティブタブを閉じる、shortcuts.ts 参照）と衝突するため、
// Window メニューは Close を含めず minimize/zoom だけを手動で組み立てる。
const windowMenu: MenuItemConstructorOptions = {
  label: 'Window',
  submenu: [
    { role: 'minimize' },
    ...(isMac ? [{ role: 'zoom' as const }] : []),
  ],
};

// 開発者ツールは既存の独自ショートカット層（shared/shortcuts.ts）には乗せず、
// メニューのネイティブアクセラレータにそのまま委ねる。
// 独自層は before-input-event と shell 側 DOM keydown の二系統があり、
// 両方が同じキーを処理すると「開いた瞬間に閉じる」ような二重発火が起きうるため。
// メニューのアクセラレータは Electron が focus に関わらず一元管理してくれる。
const buildViewMenu = (getDevToolsTarget: () => WebContents | undefined): MenuItemConstructorOptions => ({
  label: 'View',
  submenu: [
    {
      label: 'デベロッパーツール',
      accelerator: 'CmdOrCtrl+Alt+I',
      click: () => { getDevToolsTarget()?.toggleDevTools(); },
    },
  ],
});

export const buildApplicationMenu = (getDevToolsTarget: () => WebContents | undefined): Menu => {
  const template: MenuItemConstructorOptions[] = [
    ...(isMac
      ? [{ role: 'appMenu' as const }]
      : [{ label: 'File', submenu: [{ role: 'quit' as const }] }]),
    { role: 'editMenu' },
    buildViewMenu(getDevToolsTarget),
    windowMenu,
  ];

  return Menu.buildFromTemplate(template);
};
