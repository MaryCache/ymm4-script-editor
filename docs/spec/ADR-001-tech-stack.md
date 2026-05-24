# ADR-001: YMM4台本エディタ 技術スタック選定

## ステータス
採択（2026-05-24）

---

## コンテキスト

- バックエンドなし・フロントエンドのみで動作する
- 「可能な限り軽く作る」が最優先制約
- 「アプリとして動かす」= インストール可能な形（PWA）を想定
- Claude Code による AI 実装支援を前提とする（AI 補助との相性を重視）
- 単一開発者・個人ツール用途

---

## 決定

### ビルドツール: **Vite**

| 軸 | 評価 |
|---|---|
| 適合性 | フロントエンド単体アプリに最適。バックエンド不要 |
| 成熟度 | v6 系、破壊的変更が少ない安定期。エコシステム成熟 |
| 運用性 | `vite build` で静的ファイル生成。Netlify/GitHub Pages に直接デプロイ可 |
| 人材 | Claude Code の知識量が高い。ドキュメントも充実 |

**却下: webpack** — 設定コストが過大。このサイズのアプリに不釣り合い。

---

### 言語: **TypeScript（strict モード）**

状態管理でデータ構造が複雑になりうる（キャラクター / 台本ライン / プロジェクト）ため、型安全を確保する。  
2026 年時点で型なし JS を新規選択する理由がない。

---

### UIフレームワーク: **React 19 + TypeScript**

**候補比較:**

| 候補 | 採用 | 理由 |
|---|---|---|
| **React 19** | ✅ 採択 | Claude Code の出力品質が最も高い。ランタイム ~14KB (gzip)。hooks ベースで状態管理がシンプル |
| Preact | — | API 互換だが Claude Code での幻覚リスクがわずかに上がる。差分 (~11KB) を優先する局面ではない |
| Svelte 5 | — | バンドルサイズ最小だが Claude Code との相性が React より劣る。AI 補助品質を犠牲にしない |
| Vanilla TypeScript | — | ランタイムゼロだが、リスト再順序など動的 UI の実装コストが高い。Claude Code の生産性も下がる |

**判断根拠:**  
「既存のもので済まない理由」として、React の状態管理モデル（useState / useReducer）が、  
リスト操作（追加・削除・並べ替え）と Claude Code の相性において圧倒的に有利。  
軽量性よりも **AI補助品質 × 実装シンプルさ** を優先した。

---

### スタイリング: **Plain CSS + CSS Variables**

- CSS フレームワーク（Tailwind 等）は不採用。このサイズのアプリで依存を増やす理由がない
- CSS Modules で命名衝突を回避
- ダークモード対応は CSS Variables で対応

**却下: Tailwind CSS** — ビルドチェーンが増える。クラス名が長くなり Claude Code の出力が冗長になる。

---

### 状態管理: **React 組み込みの useState / useReducer のみ**

- Redux / Zustand / Jotai は不採用
- データ構造が単純（キャラクターリスト + ラインリスト）なのでローカル状態で十分
- Context API も不要（props で十分な深さ）

**「大は小を兼ねる」の罠を避ける** — coding principles §11.6 参照。

---

### 永続化: **localStorage（自動保存）+ File API（明示的保存/読み込み）**

- localStorage: 最後のプロジェクトを自動保存（アプリ起動時に復元）
- File API: `.ymscript`（JSON）形式でプロジェクトを明示的に保存・読み込み
- `.csv`（UTF-8 BOM付き）で YMM4 向けエクスポート

**DB（IndexedDB）は不採用** — 複数プロジェクト管理は現時点での要件ではない。

---

### PWA: **vite-plugin-pwa**

- `manifest.json` + Service Worker を自動生成
- オフライン動作・デスクトップインストールを実現
- Workbox ベースで信頼性が高い

---

## 採用しないもの（明示的な除外）

| 技術 | 除外理由 |
|---|---|
| Next.js / Remix | SSR 不要。バックエンドなし前提にオーバースペック |
| Electron / Tauri | ビルド・配布コストが過大。PWA で要件を満たせる |
| IndexedDB | 複数プロジェクト管理は現時点の要件にない |
| Zustand / Redux | 状態が単純。ライブラリ依存を増やさない |
| Tailwind CSS | ビルドチェーン追加コストに対しメリットが薄い |
| React Query / SWR | 非同期データフェッチが発生しない |

---

## 結果

**利点:**
- 依存ライブラリが最小限（Vite + React + vite-plugin-pwa のみ）
- Claude Code による高品質な実装支援が期待できる
- PWA でデスクトップアプリとして使える
- 静的ファイルのみ → GitHub Pages 等に無料でホスト可

**欠点・リスク:**
- React のランタイムが ~14KB 存在する（Vanilla TS 比）
- localStorage は Claude.ai アーティファクト環境では動作しない（自己ホスト時は機能する）

---

## 最終スタック

```
Vite 6 + React 19 + TypeScript (strict)
Plain CSS + CSS Modules
vite-plugin-pwa (Workbox)
localStorage + File API
```

> 注（2026-05-24・実装時点）: 実際の構築は **Vite 8 系**（scaffold の最新版）で行った。
> 上記「Vite 6」は採択時点の表記。方針（Vite を採用）は不変。
> 完成品の実スタック詳細は `design.md §10` を参照。
