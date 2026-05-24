# 設計書: YMM4台本エディタ (ymm4-script-editor)

バージョン: 1.0.0（本文）+ 2026-05-24 実装差分追補（§10）
作成日: 2026-05-24

> **§1〜§9 は初版（v1.0）の設計。完成品との差分は §10 に集約**しており、本文と §10 で
> 食い違う箇所は §10 を正とする。本文側の主な「非現行」箇所には前方参照の注記を入れてある。
> 実スタックは Vite 8 + React 19 + TS strict（ADR の "Vite 6" は決定時点の表記）。

---

## 1. ディレクトリ構成

```
ymm4-script-editor/
├── public/
│   ├── icon-192.png          # PWA アイコン
│   ├── icon-512.png
│   └── manifest.json         # ← vite-plugin-pwa が自動生成 or 手動配置
├── src/
│   ├── main.tsx              # エントリーポイント
│   ├── App.tsx               # ルートコンポーネント
│   ├── types.ts              # 型定義（Project / Character / Line）
│   ├── hooks/
│   │   ├── useProject.ts     # プロジェクト状態 + localStorage 自動保存
│   │   └── useClipboard.ts   # クリップボード操作のラッパー
│   ├── components/
│   │   ├── Header/
│   │   │   ├── Header.tsx
│   │   │   └── Header.module.css
│   │   ├── CharacterPanel/
│   │   │   ├── CharacterPanel.tsx
│   │   │   └── CharacterPanel.module.css
│   │   ├── ScriptEditor/
│   │   │   ├── ScriptEditor.tsx
│   │   │   └── ScriptEditor.module.css
│   │   └── LineRow/
│   │       ├── LineRow.tsx
│   │       └── LineRow.module.css
│   ├── utils/
│   │   ├── csv.ts            # CSV 生成ロジック
│   │   ├── file.ts           # ファイル保存・読み込みロジック
│   │   └── id.ts             # ID 生成ユーティリティ
│   └── styles/
│       └── global.css        # CSS Variables・リセット・グローバルスタイル
├── index.html
├── vite.config.ts
├── tsconfig.json
└── package.json
```

---

## 2. 型定義

```typescript
// src/types.ts

export type Character = {
  id: string;
  name: string;
  color: string; // CSS hex color, e.g. "#FF6B6B"
};

export type Line = {
  id: string;
  characterId: string;
  text: string;
};

export type Project = {
  version: 1;
  projectName: string;
  characters: Character[];
  lines: Line[];
};
```

**データ設計の原則:**
- `id` はすべて `crypto.randomUUID()` で生成する（重複なし・変換コストゼロ）
- `Character` と `Line` は参照関係（`characterId` → `Character.id`）
- `Project` はシリアライズ可能な純粋データ（関数を含まない）

---

## 3. 状態管理設計

### 3.1 状態の場所

すべての状態は `useProject` カスタムフックに集約する。  
コンポーネントが直接 `useState` でプロジェクトデータを持つことを禁止する。

```typescript
// src/hooks/useProject.ts の公開インターフェース

type UseProjectReturn = {
  project: Project;

  // プロジェクト操作
  setProjectName: (name: string) => void;

  // キャラクター操作
  addCharacter: (name: string) => void;
  deleteCharacter: (id: string) => void;

  // ライン操作
  addLineAfter: (afterId: string) => void;
  addLineAtEnd: () => void;
  deleteLine: (id: string) => void;
  updateLineCharacter: (lineId: string, characterId: string) => void;
  updateLineText: (lineId: string, text: string) => void;
  moveLine: (id: string, direction: "up" | "down") => void;

  // プロジェクトファイル操作
  saveToFile: () => void;
  loadFromFile: (file: File) => Promise<void>;

  // CSV エクスポート
  exportCSV: () => void;
};
```

### 3.2 localStorage 自動保存

- `useProject` 内で `useEffect` を使い、`project` が変化するたびに localStorage に書き込む
- キー: `ymm4-script-editor:last-project`（**→ v1.3 で `ymm4-script-editor:workspace` に移行。旧キーはマイグレーション用に参照継続。§10.y 参照**）
- 初期化時: localStorage に値があれば読み込む、なければデフォルト値を使う

```typescript
// 疑似コード
useEffect(() => {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(project));
}, [project]);
```

### 3.3 状態変更の原則

- **イミュータブル更新**: 配列の変更は必ず新しい配列を生成する（splice 禁止）
- **deleteCharacter の副作用**: キャラクター削除時は、そのキャラクターを持つすべてのラインの `characterId` を先頭キャラクターに変更する（要件 F-04）

```typescript
// deleteCharacter の実装方針
const deleteCharacter = (id: string) => {
  const fallbackId = project.characters.find(c => c.id !== id)?.id ?? "";
  setProject(prev => ({
    ...prev,
    characters: prev.characters.filter(c => c.id !== id),
    lines: prev.lines.map(l =>
      l.characterId === id ? { ...l, characterId: fallbackId } : l
    ),
  }));
};
```

> **注（§10.2 で更新）**: 実装では「**最後の1キャラは削除不可**」ガードを追加している（上記コードは初版の説明）。また `addLineAfter` は**直前行のキャラを継承**する（§10.2 / 要件 F-63）。本節のコードは挙動の骨子を示すもの。

---

## 4. コンポーネント設計

### 4.1 コンポーネントツリー

```
App
├── Header
│   ├── ProjectNameInput（インライン編集）
│   ├── SaveButton
│   ├── LoadButton（hidden input[type=file]）
│   └── ExportCSVButton
├── CharacterPanel
│   ├── CharacterAddForm
│   └── CharacterList
│       └── CharacterItem（× 削除ボタン付き）
└── ScriptEditor
    ├── TotalCharCount（合計文字数）
    ├── LineList
    │   └── LineRow（× 行数）
    │       ├── RowNumber
    │       ├── CharacterSelect（ドロップダウン）
    │       ├── TextInput（single line）
    │       ├── CharCount（文字数バッジ）
    │       └── RowActions（↑↓ コピー 追加 削除）
    └── AddLineButton（末尾に追加）
```

### 4.2 LineRow の詳細設計

```typescript
type LineRowProps = {
  line: Line;
  characters: Character[];
  index: number;
  isFirst: boolean;
  isLast: boolean;
  onCharacterChange: (lineId: string, characterId: string) => void;
  onTextChange: (lineId: string, text: string) => void;
  onMoveUp: (lineId: string) => void;
  onMoveDown: (lineId: string) => void;
  onAddAfter: (lineId: string) => void;
  onDelete: (lineId: string) => void;
  onCopy: (line: Line) => void;
};
```

- `isFirst` / `isLast` で上下ボタンの disabled 制御
- `onTextChange` は `onChange` に接続（1文字ごとに状態を更新）
- 文字数は `line.text.length` をそのままレンダリング

---

## 5. ユーティリティ設計

### 5.1 csv.ts

```typescript
// セリフテキスト内のコンマをYMM4向けに処理する方針:
// コンマを全角コンマ（，）に変換 ※YMM4がダブルクォートエスケープを
// 正しく処理するかが未確認のため、安全策として全角変換を採用
export const buildCSV = (project: Project): string => {
  const rows = project.lines.map(line => {
    const char = project.characters.find(c => c.id === line.characterId);
    const name = char?.name ?? "";
    const text = line.text.replace(/,/g, "，");
    return `${name},${text}`;
  });
  // BOM付きUTF-8（YMM4・Excel の文字化け防止）
  return "\uFEFF" + rows.join("\n");
};
```

### 5.2 file.ts

```typescript
// ダウンロードのトリガー（DOM を一時的に使う）
export const downloadBlob = (blob: Blob, filename: string): void => {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url); // メモリリークを防ぐ
};

// プロジェクトファイルの検証
export const parseProjectFile = (raw: unknown): Project => {
  // version チェック・必須フィールドの存在確認を行う
  // 異常なデータを読み込んで状態が壊れるのを防ぐ
};
```

### 5.3 id.ts

```typescript
export const generateId = (): string => crypto.randomUUID();
```

---

## 6. スタイリング設計

> **注（非現行）**: 下記 §6.1 の配色（`#0f1117` 系の青紫）は初版。完成品は **§10.3 の cold-blue-black（`#00101d` / シアン）に置換済み**。実装の正は §10.3。外部フォントは読み込まない（NF-33 / §10.3）。

### 6.1 CSS Variables（global.css）

```css
:root {
  --color-bg: #0f1117;
  --color-surface: #1c1e2a;
  --color-border: #2c2e3e;
  --color-text: #d4d8f0;
  --color-text-sub: #7a80a0;
  --color-accent: #5b8dff;
  --color-danger: #ff5c5c;
  --color-success: #4caf81;
  --font-sans: "Noto Sans JP", system-ui, sans-serif;
  --font-mono: "Fira Code", "Consolas", monospace;
}
```

- セリフ入力欄は `--font-mono` を使用（文字数の視認性向上）
- キャラクター識別色は各 `CharacterItem` の CSS Variable で注入

---

## 7. PWA 設定

> **注（非現行）**: 下記は初版の最小 manifest。完成品は **§10.7 を正**とする（`display_override: window-controls-overlay`、`theme_color: #00101d`、PNG アイコン、`start_url`/`scope` は base `/ymm4-script-editor/` 配下）。

```typescript
// vite.config.ts
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: "autoUpdate",
      manifest: {
        name: "YMM4台本エディタ",
        short_name: "台本エディタ",
        start_url: "/",
        display: "standalone",
        background_color: "#0f1117",
        theme_color: "#5b8dff",
      },
      workbox: {
        // 全アセットをキャッシュ（オフライン動作）
        globPatterns: ["**/*.{js,css,html,ico,png,svg}"],
      },
    }),
  ],
});
```

---

## 8. エラーハンドリング方針

| 状況 | 対応 |
|---|---|
| `.ymscript` のパースに失敗 | `alert` でエラーを通知。状態は変更しない |
| localStorage の書き込み失敗（容量オーバー等） | エラーをコンソールに出力。アプリはクラッシュさせない |
| クリップボードへのアクセス拒否 | **実装では `alert` で通知**（§10.9。「赤くする」視覚表現は将来課題） |
| キャラクターが0人の状態でのライン追加 | ボタンを disabled にして防止する |
| ファイル名・不正な読み込みデータ | §10.9 を参照（サニタイズ／状態不変） |

---

## 9. 実装順序（Claude Code への推奨）

```
1. プロジェクトセットアップ（Vite + React + TypeScript + vite-plugin-pwa）
2. types.ts
3. utils/id.ts, utils/csv.ts, utils/file.ts
4. hooks/useProject.ts（localStorage 含む）
5. styles/global.css（CSS Variables）
6. Header コンポーネント
7. CharacterPanel コンポーネント
8. LineRow コンポーネント
9. ScriptEditor コンポーネント（LineRow を並べる）
10. App.tsx で統合
11. PWA 設定・動作確認
```

> **注（§10.1 で更新）**: 完成品はこの順に加え、`utils/color.ts`・`components/BgCanvas`（背景）・`components/OpeningOverlay`（起動演出）を含む。構成の正は §10.1。

**各ステップで動作確認してから次に進む。**  
大きなコンポーネントを一度に書かず、データ構造・フック・UI の順に積み上げる。

---

## 10. 実装差分・追補（2026-05-24 完成版に同期）

> 本書 v1.0 をベースに、実装・レビュー・デザイン作り込みで追加/変更された設計を反映する。
> スタックは実際には **Vite 8 + React 19 + TS strict（`noUncheckedIndexedAccess`/`verbatimModuleSyntax`）+ Vitest**。

### 10.1 ディレクトリ構成（実態との差分）

```
src/
├── components/
│   ├── LineRow/         … React.memo + forwardRef。独自キャラドロップダウンを内包
│   ├── CharacterPanel/  … サイドバー（hero-pulse ドット付きフッター）
│   ├── Header/          … タイトルバー兼用（WCO 対応）
│   ├── ScriptEditor/    … 行数+合計文字数、FLIP、スクロール促し/戻るボタン
│   ├── BgCanvas/        … 【新規】canvas-gyro 代替（vanilla canvas 粒子）
│   └── OpeningOverlay/  … 【新規】起動オープニング（放射パーティクル+図形モーション）
├── hooks/useProject.ts
├── utils/{id,color,csv,markdown,file}.ts   … color.ts は【新規】、file.ts に sanitizeFilename
└── styles/global.css
public/  icon-192.png / icon-512.png / favicon.png / header-logo.png / opening-logo.png
```
- アイコンは **PNG**（ユーザー提供を Pillow で縮小）。当初の SVG 自動生成は廃止。

### 10.2 `useProject` 公開 API の追加（§3.1 への追補）

- 追加: `importMarkdown(file): Promise<number>`（skip 行数を返す）/ `exportMarkdown()` / `exportCSVToClipboard()`。
- **全 mutator を `useCallback` で安定参照**にする（NF-10。LineRow の memo を効かせる前提）。
- `deleteCharacter` は**最後の1キャラを no-op で保護**。`addLineAfter` は**直前行のキャラを継承**（なければ先頭）。

### 10.3 スタイリング（§6.1 を置換）— cold-blue-black

```css
:root{
  --bg-0:#00101d; --bg-1:#04182a; --bg-2:#082133; --bg-3:#0e2c42; --bg-4:#163850;
  --border-1:#0e2c42; --border-2:#1d3a52; --border-strong:#2c4d68;
  --text-0:#eaf2f8; --text-1:#b8c7d4; --text-2:#7e94a8; --text-3:#4f6679; --text-4:#33485a;
  --accent:#107dc8; --accent-2:#2bb4e6; --accent-soft:rgba(16,125,200,.14);
  --danger:#ef6a6a; --warn:#efb35f; --ok:#6ec48a;
  --font-ui:"IBM Plex Sans JP","Noto Sans JP",system-ui,sans-serif;  /* 外部読込なし・フォールバック */
  --font-mono:"JetBrains Mono","Noto Sans JP",ui-monospace,monospace;
}
```
キャラ識別色は各行ルートに `--char`（character.color）を inline 注入し、行の左アクセントバー・選択ドット・フォーカス色に使う。

### 10.4 アニメーション設計（`~/design-library` から選定）

| 用途 | 採用 | 実装メモ |
|---|---|---|
| 行入替/挿入/削除 | FLIP | **行順シグネチャ変化時のみ**測定（テキスト編集では走らせない=NF-10）。520ms |
| キャラ追加/削除 | appear-slide / collapse | 削除は退場アニメ後に onDelete |
| 保存/読込メニュー | 排他制御 + dropdown-enter-right | 片方開くと片方閉じる、外側クリック/Escape、▼ は submenu-icon-rotate |
| スクロール促し | scroll-arrow-pulse（上下）+ scroll-to-top-toggle | overflow 検出で表示 |
| 背景 | glass-fade 平滑化 / slow-rot（**切れ目つきリング**）/ **canvas-gyro→vanilla canvas** / marquee-scroll / hero-pulse | 全て背面・aria-hidden・pointer-events:none |
| 起動 | opening-fade + 放射パーティクル + 回転六角形 | sessionStorage で1回・reduced-motion で非表示 |

全演出は `@media (prefers-reduced-motion: reduce)` と JS の `matchMedia` で**静止/非描画**にする。

### 10.5 キャラ選択ドロップダウン設計（§4 への追補）

- native `<select>` を廃止し独自実装: `button[aria-haspopup="listbox" aria-expanded aria-label="キャラクター"]` + `ul[role="listbox"]` / `li[role="option" aria-selected]`。
- キーボード（↑↓/Enter/Space/Escape）、外側クリックで閉じる、開いたら選択中 option にフォーカス。
- open 状態は **LineRow 内 local state**（その行だけ再描画。他行へ波及しない=NF-10）。

### 10.6 性能設計（NF-10）

- `LineRow = memo(forwardRef(...))`。App の全ハンドラは安定参照（useProject の mutator は安定、moveLine ラッパ/copyLine は useCallback）。
- FLIP は `useLayoutEffect(..., [orderSignature])` で構造変化時のみ。BgCanvas は粒数を抑え `document.hidden`/reduced-motion で rAF 停止、unmount で全リスナ解除。

### 10.7 PWA / Window Controls Overlay（§7 を更新）

```typescript
VitePWA({
  registerType:"autoUpdate",
  includeAssets:["favicon.png","icon-192.png","icon-512.png"],
  manifest:{
    name:"YMM4台本エディタ", short_name:"台本エディタ", lang:"ja",
    display_override:["window-controls-overlay","standalone","minimal-ui"],
    display:"standalone",
    start_url:"/ymm4-script-editor/", // = base（scope 外だと install 無効）
    background_color:"#00101d", theme_color:"#00101d",
    icons:[{src:"icon-192.png",sizes:"192x192",type:"image/png",purpose:"any"},
           {src:"icon-512.png",sizes:"512x512",type:"image/png",purpose:"any"}],
  },
  workbox:{ globPatterns:["**/*.{js,css,html,svg,png,ico}"] },
})
```
Header は `@media (display-mode: window-controls-overlay)` で `app-region:drag` のタイトルバー化。OS コントロール幅ぶん右に余白（`env(titlebar-area-*)`）、操作要素は `app-region:no-drag`。

### 10.8 デプロイ設計（新規）

- Vite `base:"/ymm4-script-editor/"`（GitHub Pages サブパス）。JS 内のルート絶対画像参照は `import.meta.env.BASE_URL` を前置。
- `.github/workflows/deploy.yml`: main push → `npm ci` → `npm run build` → `upload-pages-artifact` → `deploy-pages`。Pages source = GitHub Actions。

### 10.9 エラーハンドリング（§8 更新）

- クリップボード失敗 → **alert で通知**（「赤くする」視覚表現は将来課題）。
- ファイル名は `sanitizeFilename` で不正文字を `_`、空は `untitled`。
- 不正な `.ymscript`/JSON 読み込みは throw → 呼び出し元 alert、**状態は不変**（テスト済み）。

### 10.10 キャラクター識別色の自動付与（utils/color.ts）— F-02

- 固定パレット `PALETTE`（10色のシアン/暖色を含む hex 配列）を持ち、`colorForIndex(index)` が
  **`index` をパレット長で巡回**（mod）して 1 色を返す純関数。負数・範囲外も正規化して `undefined` を返さない。
- 付与規則:
  - キャラ追加時は **その時点のキャラ数を index** にして採番（`colorForIndex(characters.length)`）= 出現順の巡回。
  - Markdown のフロントマターで **色を明示**した場合はそれを優先。未指定／簡易形式は出現順で自動付与。
- 既知の割り切り: 手動指定色とパレット自動色の**衝突は回避しない**（偶然同色になりうる）。識別が主目的のため許容。
- 各行・各キャラの色は表示時に CSS 変数 `--char`（= `character.color`）として注入し、左アクセントバー・選択ドット・フォーカス色に用いる。

### 10.11 v1.2 追補 — Modal 基盤・ColorWheel・各コンポーネント

> spec-v1.2-paste-and-character-edit.md の実装で追加された設計骨子。

- **Modal 基盤**: 共通オーバーレイ + フォーカストラップ + Esc クローズ + backdrop-fade / modal-rise-in アニメ。`PasteImportModal` と `ConfirmDialog` が再利用。
- **ColorWheel**（依存ゼロ）: 内部 state は **HSV `{h, s, v}`**。UI は**色相リング（conic-gradient）+ SV スクエア（彩度・明度2次元パネル）+ hex 入力欄**。変換は `hexToHsv` / `hsvToHex`。出力形式 `#RRGGBB`。ポップオーバーは dropdown-enter-right アニメで開閉。
- **PasteImportModal**: `role="dialog"` / `aria-modal` / フォーカストラップ。`importPlainText(text)` を呼び取り込み行数を Toast 通知。
- **ConfirmDialog**: `role="alertdialog"` / 既定フォーカスはキャンセルボタン / 破壊操作色（`--danger`）のリセットボタン。
- **Toast**: 簡易通知コンポーネント（取り込み成功等の一時メッセージ）。
- `useProject` 追加 mutator: `renameCharacter` / `setCharacterColor` / `importPlainText` / `clearAllLines`。いずれも useCallback 安定参照。

### 10.12 v1.3 追補 — Workspace / ProjectTabs / ストレージ移行

> spec-v1.3-multi-project-tabs.md の実装で追加された設計骨子。

- **型追加**（`src/types.ts`）:
  ```typescript
  type WorkspaceEntry = { id: string; project: Project; };
  type Workspace = { version: 1; activeId: string; entries: WorkspaceEntry[]; };
  ```
- **useProject のワークスペース化**: 公開 API 名は `useProject` のまま（`useWorkspace` へ改名しない）。内部で `Workspace` を state として保持し、既存 mutator はすべてアクティブ entry の `project` に作用。新規公開: `tabs: {id, name}[]` / `activeId` / `newProject()` / `switchProject(id)` / `closeProject(id)`。
- **ProjectTabs** コンポーネント（新規）: `role="tablist"` のタブストリップ。編集領域の `role="tabpanel"` コンテナは App 側に配置。アニメ: 追加=appear-slide / 閉じる=フェード / 下線移動=スライド。
- **ストレージキー移行**: 主キー `ymm4-script-editor:workspace`（Workspace JSON）。旧キー `ymm4-script-editor:last-project`（単体 Project）は起動時マイグレーション用に参照継続し、workspace キーが正となった後も削除しない。
- **マイグレーションロジック**: 起動時 ①workspace キーあり→採用、②なし→旧キー確認し1エントリのワークスペースに変換、③どちらもなし→既定の空プロジェクト1件。
