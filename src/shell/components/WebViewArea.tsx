import React, { useEffect, useRef } from 'react';
import { useTabsStore } from '../stores/tabs-store';
import { ErrorOverlay } from './ErrorOverlay';

export const WebViewArea = () => {
  const ref = useRef<HTMLDivElement | null>(null);
  const activeId = useTabsStore((s) => s.activeTabId);
  const tabCount = Object.keys(useTabsStore((s) => s.byId)).length;

  useEffect(() => {
    if (!ref.current) return;
    const el = ref.current;
    const update = () => {
      const r = el.getBoundingClientRect();
      window.api.invoke('tab.setBounds', {
        bounds: {
          x: Math.round(r.left),
          y: Math.round(r.top),
          width: Math.round(r.width),
          height: Math.round(r.height),
        },
      });
    };
    const ro = new ResizeObserver(update);
    ro.observe(el);
    update();
    window.addEventListener('resize', update);
    return () => {
      ro.disconnect();
      window.removeEventListener('resize', update);
    };
  }, [activeId]);

  return (
    <div className="webview-area" ref={ref}>
      {!activeId && tabCount === 0 && (
        <div className="empty">
          Cmd+T で新規タブを開く
        </div>
      )}
      <ErrorOverlay />
    </div>
  );
};
