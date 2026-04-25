# 06. サイドバー

対応要件：[10-shell-ui.md](../requirements/10-shell-ui.md), [11-tabs-spaces.md](../requirements/11-tabs-spaces.md)

## レイアウト構造

```
┌─────────────────────────────────┐
│ <SidebarHeader>                 │  ← Space 切替 + アプリ名
│   ・Space dots                  │
│   ・Profile icon (M2)           │
├─────────────────────────────────┤
│ <FavoritesRow>                  │  ← 横並び 4×3 (12個)
│   ・大ファビコン                │
├─────────────────────────────────┤
│ <SectionDivider title="Pinned"> │
│ <PinnedList>                    │  ← 縦並び・フォルダ可
│   <TabItem variant="pinned">    │
│   <FolderItem>                  │
├─────────────────────────────────┤
│ <SectionDivider title="Today">  │
│ <TodayList>                     │  ← 仮想スクロール
│   <TabItem variant="today">     │
├─────────────────────────────────┤
│ <NewTabButton>                  │
└─────────────────────────────────┘
│ <DownloadIndicator>             │  ← 下部固定（active 時のみ）
└─────────────────────────────────┘
```

## コンポーネントツリー

```
<Sidebar>
 ├─ <SidebarHeader>
 │   ├─ <SpaceSwitcher>
 │   │   └─ <SpaceDot> × N
 │   └─ <WindowControls>          (Win/Linux のみ)
 ├─ <FavoritesRow>
 │   └─ <FavoriteTile> × ≤12
 ├─ <PinnedSection>
 │   └─ <SortableTree>
 │       ├─ <TabItem>
 │       └─ <FolderItem>
 │           └─ <TabItem> ...
 ├─ <TodaySection>
 │   └─ <VirtualizedList>
 │       └─ <TabItem> × N
 ├─ <NewTabButton>
 └─ <DownloadIndicator>
<ResizeHandle>                     (サイドバーの右端)
```

## TabItem

```typescript
type TabItemProps = {
  tabId: TabId;
  variant: 'pinned' | 'today' | 'favorite';
  isActive: boolean;
  isDragging: boolean;
};

function TabItem({ tabId, variant, isActive }: TabItemProps) {
  const tab = useTabsStore((s) => s.byId[tabId]);
  if (!tab) return null;

  return (
    <div
      className={cn('tab-item', { active: isActive, loading: tab.loading })}
      onClick={() => useTabsStore.getState().activateTab(tabId)}
      onAuxClick={(e) => e.button === 1 && useTabsStore.getState().closeTab(tabId)}
      onContextMenu={(e) => openContextMenu(e, tabId)}
    >
      <Favicon url={tab.faviconUrl} loading={tab.loading} />
      <span className="title">{tab.title || urlToHost(tab.url)}</span>
      {tab.audible && <SpeakerIcon onClick={...} />}
      {variant !== 'favorite' && (
        <CloseButton onClick={(e) => { e.stopPropagation(); useTabsStore.getState().closeTab(tabId); }} />
      )}
    </div>
  );
}
```

### Favicon コンポーネント
- ロード中：スピナー
- ファビコンなし：`urlToHost` の頭文字を背景色付きで描画
- 失敗時：デフォルトグローブアイコン
- ファビコン取得は preload 経由でメイン処理（CORS 回避）

## 仮想スクロール

`react-window` を採用。`FixedSizeList` で各行高さを 36px 固定。

```typescript
import { FixedSizeList } from 'react-window';

function TodayList({ tabIds }: { tabIds: TabId[] }) {
  return (
    <FixedSizeList
      height={containerHeight}
      itemCount={tabIds.length}
      itemSize={36}
      width="100%"
    >
      {({ index, style }) => (
        <div style={style}>
          <TabItem tabId={tabIds[index]} variant="today" isActive={...} isDragging={...} />
        </div>
      )}
    </FixedSizeList>
  );
}
```

ピン留めセクションは件数が少ないため仮想化しない。

## ドラッグ&ドロップ

`@dnd-kit/core` + `@dnd-kit/sortable`。

### 機能要件
- 同一セクション内：並び替え
- セクション間（today ↔ pinned）：状態変更を伴う移動
- Space 間：Space スイッチャーへドロップで Space 移動
- フォルダへのドロップ：フォルダ内に追加
- フォルダ作成：タブを別タブにドロップしてフォルダ化（M1 ではスキップ可）

### 実装の骨格

```typescript
function Sidebar() {
  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragEnd={handleDragEnd}
    >
      <SortableContext items={pinnedIds} strategy={verticalListSortingStrategy}>
        {/* PinnedSection */}
      </SortableContext>
      <SortableContext items={todayIds} strategy={verticalListSortingStrategy}>
        {/* TodaySection */}
      </SortableContext>
      <DragOverlay>{activeId ? <TabItem ... /> : null}</DragOverlay>
    </DndContext>
  );
}

function handleDragEnd(e: DragEndEvent) {
  const tabId = e.active.id as TabId;
  const overId = e.over?.id;
  if (!overId) return;

  const targetSection = sectionOf(overId);   // 'pinned' | 'today'
  const targetIndex = indexOf(overId, targetSection);

  useTabsStore.getState().moveTab(
    tabId,
    activeSpaceId,
    targetSection,
    targetIndex,
  );
}
```

仮想スクロールと dnd-kit の統合：`react-window` が unmount したアイテムは drag できない。「Today の末尾までドラッグするには自動スクロールが必要」→ dnd-kit の autoScroll プラグインで対応。

## リサイズ

```typescript
function ResizeHandle() {
  const setSidebarWidth = useUiStore((s) => s.setSidebarWidth);

  const onMouseDown = (e: React.MouseEvent) => {
    const startX = e.clientX;
    const startW = useUiStore.getState().sidebarWidth;
    const move = (ev: MouseEvent) => {
      const w = clamp(startW + ev.clientX - startX, 180, 400);
      setSidebarWidth(w);
    };
    const up = () => {
      window.removeEventListener('mousemove', move);
      window.removeEventListener('mouseup', up);
    };
    window.addEventListener('mousemove', move);
    window.addEventListener('mouseup', up);
  };

  return <div className="resize-handle" onMouseDown={onMouseDown} onDoubleClick={resetWidth} />;
}
```

幅変更時は `ResizeObserver` の更新により WebView 領域もリサイズ → main へ `tab.setBounds` IPC 通知。

## ホバープレビュー（M1 簡易）

タブにマウスホバー 500ms で tooltip 表示。M1 ではタイトル + URL のテキストのみ。サムネイル画像は M2 以降。

## コンテキストメニュー

`<TabItem>` 右クリックで Electron のネイティブコンテキストメニュー（main プロセスで `Menu.popup()`）を表示。renderer から IPC でメニュー要求。

メニュー項目：
- 新しいタブで開く
- 複製
- ピン留め / 解除
- アーカイブ
- URL をコピー
- フォルダに移動 …
- 別の Space に移動 …
- リロード
- ミュート

## アクティブタブのスクロール追従

新しくアクティブになったタブが画面外なら自動スクロール：

```typescript
useEffect(() => {
  if (!activeTabId) return;
  document.querySelector(`[data-tab-id="${activeTabId}"]`)
    ?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
}, [activeTabId]);
```

## アクセシビリティ

- 各タブ項目は `<button>` または `role="button"` + `tabindex=0`
- `aria-current="page"` をアクティブタブに付与
- セクション見出しは `<h2>`
- キーボードナビゲーション：上下キーでタブ移動、Enter で activate、`Cmd+W` で閉じる
- VoiceOver でタイトル + URL + 状態を読み上げ

## アニメーション

### 機能要件と実装
| 動作 | アニメーション |
|---|---|
| タブ作成 | 高さ 0 → 36px、200ms ease-out |
| タブ削除 | 縮退 + フェード、150ms |
| Space 切替 | クロスフェード + 軽いスライド、200ms |
| ドラッグ中 | dnd-kit デフォルト |
| ロード中 | ファビコン位置のスピナー |

すべて `transform` / `opacity` のみ使用（layout を発生させない）。

## テーマ・カラー

CSS カスタムプロパティで管理：
```css
:root {
  --sidebar-bg-from: #...;
  --sidebar-bg-to:   #...;
  --sidebar-fg:      #...;
  --tab-active-bg:   rgba(255,255,255,0.15);
  --tab-hover-bg:    rgba(255,255,255,0.08);
}
```

Space 切替時に CSS 変数を JS で書き換える（ストアから値を読んで `document.documentElement.style.setProperty`）。

## パフォーマンス目標
- 200 タブ表示で初回描画 100ms 以内
- スクロール 60fps
- ドラッグ中の他タブの再レンダリング回数：0（drag overlay だけ動く）

## テスト
- レンダリングテスト：`@testing-library/react` でタブ表示・クリック動作を確認
- パフォーマンス：1000 タブ生成して描画時間を計測（CI ベンチ）
