import React from 'react';
import { useTabsStore, type TabError } from '../stores/tabs-store';

// Chromium の net エラーコード（一部抜粋）
const NAVIGATION_MESSAGES: Record<string, string> = {
  '-105': 'サーバーのアドレスが見つかりませんでした',
  '-106': 'インターネットに接続されていません',
  '-102': '接続が拒否されました',
  '-118': '接続がタイムアウトしました',
  '-501': '安全な接続を確立できませんでした',
};

const describe = (error: TabError): { title: string; detail: string } => {
  if (error.kind === 'crash') {
    return { title: 'このページは応答しなくなりました', detail: `reason: ${error.reason}` };
  }
  const message = NAVIGATION_MESSAGES[error.errorCode] ?? `読み込みに失敗しました（エラーコード: ${error.errorCode}）`;
  return { title: message, detail: error.url };
};

export const ErrorOverlay = () => {
  const activeId = useTabsStore((s) => s.activeTabId);
  const error = useTabsStore((s) => (s.activeTabId ? s.errorsByTabId[s.activeTabId] : undefined));
  const reload = useTabsStore((s) => s.reload);

  if (!activeId || !error) return null;

  const { title, detail } = describe(error);

  return (
    <div className="error-overlay">
      <div className="error-overlay-body">
        <div className="error-title">{title}</div>
        <div className="error-detail">{detail}</div>
        <button className="error-retry" onClick={() => reload(activeId)}>
          再読込
        </button>
      </div>
    </div>
  );
};
