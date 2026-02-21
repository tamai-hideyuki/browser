# 学習メモ

## 略称・命名の由来

| 略称 | 正式名 | 意味 |
|---|---|---|
| `argv` | argument vector | 引数の配列（C言語由来） |
| `stdin` | standard input | 標準入力 |
| `stdout` | standard output | 標準出力 |
| `stderr` | standard error | 標準エラー出力 |
| `fd` | file descriptor | ファイル記述子 |
| `buf` | buffer | バッファ |
| `len` | length | 長さ |
| `ptr` | pointer | ポインタ |
| `str` | string | 文字列 |
| `char` | character | 文字 |
| `fmt` | format | 書式 |
| `alloc` | allocate | メモリ確保 |
| `EOF` | end of file | ファイル終端 |

短くて暗号的な略称はC言語/UNIX由来であることが多い。

## 構文の基本

| 記号 | 役割 | 例 |
|---|---|---|
| `()` | 引数を渡す・受け取る | `fetchPage(url)` |
| `{}` | 処理のブロック | `=> { ... }`, `if () { ... }` |

## process.argv

`process.argv`はコマンドライン引数の配列。

| インデックス | 内容 |
|---|---|
| `[0]` | 実行ファイルパス |
| `[1]` | スクリプトパス |
| `[2]` | ユーザーが渡した最初の引数 |

## process.exit(code)

- `0` = 正常終了
- `1`以上 = 異常終了
- 終了コードは0〜255（UNIX）。HTTPステータスコード（404, 500等）とは別物

## throw vs process.exit

- `throw` = スタックトレース付きのエラー。内部的なエラー向き
- `process.exit(1)` + `console.error` = メッセージのみ。ユーザー向けのエラー表示に適切

## テンプレートリテラル

- `""` (ダブルクォート) = `${...}` が文字列としてそのまま出る
- `` ` ` `` (バッククォート) = `${...}` が値に置き換わる

```typescript
// NG
"HTTP Error: ${response.status}" // → "HTTP Error: ${response.status}"
// OK
`HTTP Error: ${response.status}` // → "HTTP Error: 404"
```

## TypeScriptの型

- `Token[]` = Token型の配列（戻り値の型）
- `Token | null` = Token型またはnull（union型）
- `response.ok` = HTTPレスポンスのステータスが200番台かどうか

## 変数と関数の違い

- **変数** = 値を入れる箱
- **関数** = 処理をまとめたもの（`()` で呼び出すと動く）

見分け方は `=> { ... }` で処理が定義されているかどうか。

```typescript
// 変数: 値を格納するだけ
const hasNextTag = nextTagOpenIndex !== -1;
const readPosition = 0;

// 関数: () をつけて呼び出すと処理が実行される
const readTag = (): Token | null => { ... };
readTag();
```

関数も `const` で変数に代入されるが、中身が `=> { ... }` で処理を持っているので「関数」と呼ぶ。

## 比較演算子

- `!== -1` = 「-1 ではない」= 「見つかった」
- `=== -1` = 「-1 である」= 「見つからなかった」

`indexOf()` が `-1` を返す = 見つからなかった、というパターンとセットで使う。

## 配列メソッド

- `push(値)` = 配列の末尾に要素を追加
- `pop()` = 配列の末尾の要素を取り出して削除
- `indexOf()` = 指定した値が最初に見つかった位置を返す。見つからなければ-1
  - 第2引数で検索開始位置を指定できる

`push` と `pop` はセットで覚える。スタック（後入れ先出し）でよく使う。

## 文字列メソッド

- `slice(開始位置, 終了位置)` = 文字列の一部を切り出して返す（元の文字列は変わらない）
  - 終了位置を省略すると末尾まで切り出す
  - `"Hello".slice(1, 3)` → `"el"`
  - `"Hello".slice(1)` → `"ello"`
- `startsWith("x")` = 文字列が `"x"` で始まるかを判定する
  - `"hello".startsWith("he")` → `true`
- `split("x")` = `"x"` で区切って配列にする
  - `"a b c".split(" ")` → `["a", "b", "c"]`
