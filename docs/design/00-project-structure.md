# 00. プロジェクト構造

対応要件：[01-architecture.md](../requirements/01-architecture.md)

## ディレクトリレイアウト

```
browser/
├── src/
│   ├── main/                       # メインプロセス（Node.js）
│   │   ├── index.ts                # エントリポイント
│   │   ├── app/
│   │   │   ├── lifecycle.ts        # app.whenReady, before-quit
│   │   │   └── menu.ts             # アプリケーションメニュー
│   │   ├── window/
│   │   │   ├── main-window.ts      # BrowserWindow 管理
│   │   │   └── window-state.ts     # 位置・サイズの永続化
│   │   ├── tabs/
│   │   │   ├── tab-manager.ts      # タブの生成・破棄・切替
│   │   │   ├── webview-host.ts     # WebContentsView の管理
│   │   │   └── discard.ts          # スリープ判定
│   │   ├── storage/
│   │   │   ├── db.ts               # better-sqlite3 接続
│   │   │   ├── migrations/         # マイグレーションスクリプト
│   │   │   │   ├── 001_init.sql
│   │   │   │   └── runner.ts
│   │   │   └── repositories/
│   │   │       ├── tab-repo.ts
│   │   │       ├── space-repo.ts
│   │   │       ├── history-repo.ts
│   │   │       └── settings-repo.ts
│   │   ├── ipc/
│   │   │   ├── handlers.ts         # ipcMain.handle 登録
│   │   │   └── broadcaster.ts      # メイン → 全 renderer ブロードキャスト
│   │   ├── settings/
│   │   │   └── settings-service.ts
│   │   ├── search/
│   │   │   └── indexer.ts          # FTS5 への投入
│   │   └── navigation/
│   │       ├── url-resolver.ts
│   │       └── history-stack.ts
│   │
│   ├── preload/                    # contextBridge
│   │   └── index.ts
│   │
│   ├── shell/                      # シェル renderer（React）
│   │   ├── index.html
│   │   ├── main.tsx                # React エントリポイント
│   │   ├── App.tsx
│   │   ├── components/
│   │   │   ├── Sidebar/
│   │   │   ├── CommandBar/
│   │   │   ├── ErrorPage/
│   │   │   └── ContextMenu/
│   │   ├── stores/                 # Zustand
│   │   │   ├── tabs-store.ts
│   │   │   ├── spaces-store.ts
│   │   │   ├── ui-store.ts
│   │   │   └── command-bar-store.ts
│   │   ├── hooks/
│   │   ├── theme/
│   │   ├── i18n/
│   │   └── utils/
│   │
│   └── shared/                     # 両側参照
│       ├── types/
│       │   ├── ipc.ts
│       │   ├── tab.ts
│       │   ├── space.ts
│       │   └── settings.ts
│       └── constants.ts
│
├── tests/
│   ├── unit/
│   ├── integration/
│   └── e2e/                        # Playwright（将来）
│
├── build/                          # ビルド成果物（git ignore）
├── resources/                      # アイコン・スプラッシュ
├── docs/                           # 要件・設計
├── package.json
├── tsconfig.json
├── tsconfig.main.json              # main 用
├── tsconfig.shell.json             # shell renderer 用
├── vite.config.ts                  # shell renderer 用
├── electron-builder.yml            # パッケージング設定
├── .eslintrc.cjs
├── .prettierrc
└── vitest.config.ts
```

## 既存コードの扱い
現行の `src/http`, `src/tokenizer`, `src/tree`, `src/render`, `src/main.ts`, `src/main.test.ts`, `src/types.ts` は学習用 CLI のため、本プロジェクト着手時に `legacy/` 配下へ退避するか、別リポジトリに分離する。M1 では再利用しない。

## tsconfig 構成

`tsconfig.base.json` を共通設定とし、main / shell で別 tsconfig を持つ。

### tsconfig.base.json
```jsonc
{
  "compilerOptions": {
    "target": "ES2022",
    "moduleResolution": "bundler",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "noUncheckedIndexedAccess": true,
    "exactOptionalPropertyTypes": true,
    "paths": {
      "@shared/*": ["src/shared/*"]
    }
  }
}
```

### tsconfig.main.json
```jsonc
{
  "extends": "./tsconfig.base.json",
  "compilerOptions": {
    "module": "CommonJS",        // Electron main は CJS
    "outDir": "build/main",
    "types": ["node"]
  },
  "include": ["src/main/**/*", "src/preload/**/*", "src/shared/**/*"]
}
```

### tsconfig.shell.json
```jsonc
{
  "extends": "./tsconfig.base.json",
  "compilerOptions": {
    "module": "ESNext",
    "jsx": "react-jsx",
    "lib": ["ES2022", "DOM"],
    "noEmit": true               // Vite が emit
  },
  "include": ["src/shell/**/*", "src/shared/**/*"]
}
```

## ビルドパイプライン

| プロセス | ビルダ | エントリ | 出力 |
|---|---|---|---|
| main | esbuild（CLI 一発） | `src/main/index.ts` | `build/main/index.js` |
| preload | esbuild | `src/preload/index.ts` | `build/preload/index.js` |
| shell renderer | Vite | `src/shell/index.html` | `build/shell/` |

開発時は Vite の dev server を起動し、Electron 側は `BrowserWindow.loadURL("http://localhost:5173")` で参照する。

## package.json スクリプト

```json
{
  "scripts": {
    "dev": "concurrently \"npm:dev:shell\" \"npm:dev:main\"",
    "dev:shell": "vite",
    "dev:main": "node scripts/dev-main.mjs",
    "build": "npm run build:main && npm run build:preload && npm run build:shell",
    "build:main": "esbuild src/main/index.ts --bundle --platform=node --external:electron --external:better-sqlite3 --outfile=build/main/index.js",
    "build:preload": "esbuild src/preload/index.ts --bundle --platform=node --external:electron --outfile=build/preload/index.js",
    "build:shell": "vite build",
    "package": "npm run build && electron-builder",
    "package:mac": "npm run build && electron-builder --mac",
    "lint": "eslint src --ext .ts,.tsx",
    "format": "prettier --write src",
    "test": "vitest run",
    "test:watch": "vitest",
    "typecheck": "tsc -p tsconfig.main.json --noEmit && tsc -p tsconfig.shell.json --noEmit"
  }
}
```

## 主要依存

### Production
| パッケージ | 用途 |
|---|---|
| `electron` | フレームワーク |
| `better-sqlite3` | DB |
| `zod` | バリデーション |
| `react` / `react-dom` | UI |
| `zustand` | 状態管理 |
| `@dnd-kit/core` | サイドバーのドラッグ&ドロップ |
| `react-window` | 仮想スクロール |
| `fuse.js` | 軽量ファジー検索（補助、メインは FTS5） |

### Dev
| パッケージ | 用途 |
|---|---|
| `typescript` | 型チェック |
| `vite` | shell renderer ビルド |
| `@vitejs/plugin-react` | React 統合 |
| `esbuild` | main / preload ビルド |
| `electron-builder` | パッケージング |
| `vitest` | テスト |
| `eslint` / `@typescript-eslint/*` | Lint |
| `prettier` | フォーマット |
| `concurrently` | dev タスク並走 |

## 名前空間規則
- ファイル名：kebab-case（`tab-manager.ts`）
- React コンポーネント：PascalCase（`Sidebar.tsx`）
- 型・interface：PascalCase
- 関数・変数：camelCase
- 定数：UPPER_SNAKE_CASE

## ESLint 主要ルール
- `@typescript-eslint/no-explicit-any`: error
- `@typescript-eslint/explicit-module-boundary-types`: warn
- `import/no-cycle`: error（循環依存を禁止）
- `import/order`: error（import 並び順固定）

## .gitignore に追加すべき項目
```
build/
dist/
node_modules/
*.log
.DS_Store
.env
.env.local
```
