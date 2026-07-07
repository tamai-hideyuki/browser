import type { ShortcutAction } from './types/ipc';

// キーボードショートカットの唯一のキーマップ定義。
// - main 側（webview にフォーカスがあるとき）: before-input-event から参照
// - shell 側（UI にフォーカスがあるとき）: keydown リスナから参照
// meta は呼び出し側で Cmd(mac) / Ctrl(win/linux) に解決して渡す。
export type ShortcutKeyInput = {
  key: string;
  meta: boolean;
  shift: boolean;
};

export const matchShortcut = ({ key, meta, shift }: ShortcutKeyInput): ShortcutAction | null => {
  if (key === 'Escape') return 'escape';
  if (!meta) return null;
  switch (key.toLowerCase()) {
    case 't': return 'newTab';
    case 'l': return 'editUrl';
    case 'w': return 'closeTab';
    case 'r': return shift ? 'reloadHard' : 'reload';
    case '[': return 'back';
    case ']': return 'forward';
    case ',': return 'openSettings';
    default:  return null;
  }
};
