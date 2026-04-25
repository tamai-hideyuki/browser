# 10. 主要フローのシーケンス図

各フローの処理の流れを Mermaid で示す。実装時の参照用。

## アプリ起動

```mermaid
sequenceDiagram
    participant App as Electron App
    participant Main as Main Process
    participant DB as SQLite
    participant Win as BrowserWindow
    participant Shell as Shell Renderer
    participant TM as TabManager

    App->>Main: app.whenReady
    Main->>Main: loadBootstrap (settings.json)
    Main->>DB: open data.db
    Main->>DB: runMigrations
    Main->>Main: backupOnStartup
    Main->>Main: SettingsService.init
    Main->>Win: new BrowserWindow(bounds)
    Main->>Shell: loadURL(vite-url or file://shell/index.html)
    Shell->>Main: invoke 'bootstrap.fetch'
    Main->>DB: load spaces / tabs / settings
    Main-->>Shell: BootstrapPayload
    Shell->>Shell: hydrate stores
    Shell->>Main: invoke 'tab.activate' (last active)
    Main->>TM: activate(lastTabId)
    TM->>TM: mountView (WebContentsView)
    TM->>Win: contentView.addChildView
    TM-->>Shell: emit 'tab.activated'
    Shell->>Shell: render
```

## 新規タブ生成（コマンドバーから）

```mermaid
sequenceDiagram
    participant U as User
    participant CB as CommandBar
    participant Store as TabsStore
    participant Main as Main
    participant TM as TabManager
    participant DB as SQLite
    participant V as WebContentsView

    U->>CB: Cmd+T → "github.com" → Enter
    CB->>CB: parse → kind=url
    CB->>Store: createTab({ url: 'https://github.com' })
    Store->>Main: invoke 'tab.create'
    Main->>TM: create()
    TM->>DB: TabRepository.insert(meta)
    TM->>TM: mountView
    TM->>V: new WebContentsView
    TM->>V: loadURL
    TM-->>Store: emit 'tab.created'
    TM->>TM: activate
    TM-->>Store: emit 'tab.activated'
    Store->>Store: applyEvent
    V->>Main: did-start-loading
    Main-->>Store: emit 'tab.loadingStateChanged'
    V->>Main: page-title-updated
    Main->>DB: TabRepository.update(title)
    Main-->>Store: emit 'tab.titleUpdated'
    V->>Main: did-finish-load
    Main-->>Store: emit 'tab.loadingStateChanged' (loading=false)
```

## URL 遷移（既存タブで）

```mermaid
sequenceDiagram
    participant U as User
    participant CB as CommandBar
    participant Store as TabsStore
    participant TM as TabManager
    participant V as WebContentsView
    participant DB as SQLite

    U->>CB: Cmd+L → URL → Enter
    CB->>Store: navigateTab(activeId, url)
    Store->>TM: invoke 'tab.navigate'
    TM->>V: webContents.loadURL(resolvedUrl)
    V->>TM: did-start-loading
    TM-->>Store: emit 'tab.loadingStateChanged'
    V->>TM: did-navigate
    TM->>DB: HistoryRepository.record
    TM->>DB: TabRepository.update(url)
    TM-->>Store: emit 'tab.urlUpdated'
    V->>TM: did-finish-load
    TM-->>Store: emit 'tab.loadingStateChanged' (done)
```

## タブを閉じる（archived 行き）

```mermaid
sequenceDiagram
    participant U as User
    participant Store as TabsStore
    participant TM as TabManager
    participant V as WebContentsView
    participant DB as SQLite
    participant Win as BrowserWindow

    U->>Store: closeTab(tabId) (Cmd+W or click)
    Store->>TM: invoke 'tab.close'
    TM->>Win: contentView.removeChildView
    TM->>V: webContents.destroy
    TM->>DB: TabRepository.update(state=archived, archivedAt)
    TM->>TM: records.delete(tabId)
    TM-->>Store: emit 'tab.archived'
    Store->>Store: byId から削除
    alt active タブだった場合
        TM->>TM: 直前の活発タブを activate
        TM-->>Store: emit 'tab.activated'
    end
```

## タブの discard（自動スリープ）

```mermaid
sequenceDiagram
    participant Sched as DiscardScheduler
    participant TM as TabManager
    participant V as WebContentsView
    participant Win as BrowserWindow
    participant Store as TabsStore

    loop every 60s
        Sched->>TM: tick()
        TM->>TM: scan all records
        alt now - lastActiveAt > threshold
            TM->>V: capture scrollPosition
            TM->>Win: removeChildView
            TM->>V: webContents.destroy
            TM->>TM: records[id].view = null
            TM-->>Store: emit 'tab.discarded'
            Store->>Store: byId[id].discarded = true
        end
    end
```

## discarded タブの再アクティブ化

```mermaid
sequenceDiagram
    participant U as User
    participant Store as TabsStore
    participant TM as TabManager
    participant V as new WebContentsView
    participant Win as BrowserWindow

    U->>Store: activateTab(tabId)
    Store->>TM: invoke 'tab.activate'
    TM->>TM: rec.view is null → mountView
    TM->>V: new WebContentsView
    TM->>V: loadURL(rec.meta.url)
    TM->>Win: addChildView
    TM-->>Store: emit 'tab.activated'
    V->>TM: did-finish-load
    TM->>V: executeJavaScript(scrollTo(...))
    TM-->>Store: emit 'tab.loadingStateChanged' (done)
```

## クラッシュからの復旧

```mermaid
sequenceDiagram
    participant V as WebContentsView
    participant TM as TabManager
    participant Win as BrowserWindow
    participant Store as TabsStore
    participant U as User

    V->>TM: render-process-gone
    TM->>Win: removeChildView
    TM->>TM: rec.view = null, mark crashed
    TM-->>Store: emit 'tab.crashed'
    Store->>Store: show ErrorOverlay
    U->>Store: click "再読込"
    Store->>TM: invoke 'tab.reload'
    TM->>TM: mountView
    TM->>V: loadURL
    Note over TM: 5分以内に同タブで3回連続クラッシュ → 自動再読込抑止
```

## サイドバーリサイズ → WebView の追従

```mermaid
sequenceDiagram
    participant U as User
    participant SB as Sidebar
    participant Ui as UiStore
    participant Wrap as WebViewWrapper
    participant Main as Main
    participant TM as TabManager
    participant V as WebContentsView

    U->>SB: drag ResizeHandle
    SB->>Ui: setSidebarWidth(w)
    Ui->>Ui: debounce 500ms → invoke 'settings.patch'
    Wrap->>Wrap: ResizeObserver fires
    Wrap->>Main: invoke 'tab.setBounds'(rect)
    Main->>TM: setBounds
    TM->>V: setBounds(rect)
```

## 設定変更の反映

```mermaid
sequenceDiagram
    participant U as User
    participant UI as SettingsModal
    participant Store as SettingsStore
    participant Main as Main
    participant SS as SettingsService
    participant DB as SQLite

    U->>UI: change theme to dark
    UI->>Store: patch({ appearance: { theme: 'dark' } })
    Store->>Store: debounce 200ms
    Store->>Main: invoke 'settings.patch'
    Main->>SS: patch
    SS->>DB: SettingsRepository.patch
    SS->>SS: cache 更新
    SS-->>Store: emit 'settings.updated'
    Store->>Store: applyEvent
    Store->>UI: re-render with new theme
```

## コマンドバーの候補生成

```mermaid
sequenceDiagram
    participant U as User
    participant Input as Input
    participant CB as CommandBar
    participant Tabs as TabsStore (in-mem)
    participant Main as Main
    participant DB as SQLite (FTS5)

    U->>Input: type "git"
    Input->>CB: setInput
    CB->>CB: debounce 50ms
    par
        CB->>Tabs: searchOpenTabs("git")
        Tabs-->>CB: tab candidates (instant)
    and
        CB->>Main: invoke 'commandBar.search'({query:"git"})
        Main->>DB: SELECT FTS5 MATCH 'git*'
        DB-->>Main: rows
        Main-->>CB: history candidates
    and
        CB->>CB: searchActions("git") → []
    end
    CB->>CB: rank & merge → top 8
    CB->>Input: re-render candidates
```

## アプリ終了

```mermaid
sequenceDiagram
    participant U as User
    participant App as Electron App
    participant Main as Main
    participant TM as TabManager
    participant Win as BrowserWindow
    participant DB as SQLite

    U->>App: Cmd+Q
    App->>Main: before-quit
    Main->>TM: persist runtime state (lastActiveAt, scrollPos)
    TM->>DB: bulk update tabs
    Main->>Win: saveBounds → settings.json
    Main->>DB: close
    Main->>App: quit
```

## エラーフロー（ネット切断）

```mermaid
sequenceDiagram
    participant V as WebContentsView
    participant TM as TabManager
    participant Store as TabsStore
    participant UI as ErrorOverlay

    V->>TM: did-fail-load (errorCode=-105 NAME_NOT_RESOLVED)
    TM-->>Store: emit 'navigation.error'
    Store->>Store: activeTabError = { ... }
    UI->>UI: show overlay with retry button
```

## 自動アーカイブ（today → archived）

```mermaid
sequenceDiagram
    participant Sched as ArchiveScheduler
    participant TM as TabManager
    participant V as WebContentsView
    participant DB as SQLite
    participant Store as TabsStore

    loop every 5 min
        Sched->>TM: scan today tabs
        alt now - lastActiveAt > archiveAfter
            TM->>V: destroy (if mounted)
            TM->>DB: update state=archived
            TM->>TM: records.delete
            TM-->>Store: emit 'tab.archived'
        end
    end
```

## 不変条件のまとめ
これらのフローを通じて以下が常に成り立つ：
- DB の `tabs.state` と `records` の存在は一貫（archived は records になし）
- 各 active タブは必ず view を持つ
- broadcaster は同じイベントを 2 回発行しない
- shell store は IPC イベント以外でタブを生成・削除しない（直接書き換え禁止）
