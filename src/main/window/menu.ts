import { Menu, type MenuItemConstructorOptions } from 'electron';

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

export const buildApplicationMenu = (): Menu => {
  const template: MenuItemConstructorOptions[] = [
    ...(isMac
      ? [{ role: 'appMenu' as const }]
      : [{ label: 'File', submenu: [{ role: 'quit' as const }] }]),
    { role: 'editMenu' },
    windowMenu,
  ];

  return Menu.buildFromTemplate(template);
};
