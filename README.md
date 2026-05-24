# YMM4台本エディタ

YukkuriMovieMaker4（YMM4）向けの解説・ゆっくり動画の**台本（キャラクター × セリフ）を編集し、CSV / `.ymscript` / Markdown で入出力する**ブラウザ完結の PWA です。バックエンドなし・外部通信なしで動作し、デスクトップアプリとしてインストールできます。

🌐 **公開版: https://marycache.github.io/ymm4-script-editor/**

---

## 特長

- **キャラクター管理** — 名前で登録し識別色を自動付与。削除時は該当セリフを先頭キャラへ自動付け替え（最後の1人は誤削除防止のため削除不可）。
- **台本編集** — セリフ行の追加（末尾／特定行の直後）・削除・上下入れ替え・キャラ割り当て。各行の文字数と台本全体の合計文字数をリアルタイム表示。
- **コピー／書き出し**
  - 1行コピー（`キャラクター名,セリフ` 形式）／全件コピー
  - **CSV**（UTF-8 BOM 付き、YMM4 読み込み向け。セリフ内コンマは全角化、改行は畳む）
  - **`.ymscript`**（プロジェクトの保存／復元用 JSON）
  - **Markdown**（フロントマター付き完全形式の入出力。AI に台本生成を依頼 → そのまま読み込む用途に対応）
- **自動保存** — 編集内容を localStorage に自動保存し、次回起動時に復元。
- **PWA** — オフライン動作・デスクトップインストール対応。インストール時は Window Controls Overlay でネイティブウィンドウ風の外観に。
- **動作演出** — 起動オープニング、行入れ替えの FLIP アニメ、独自スタイルのキャラ選択ドロップダウン、スクロール促し／一番上に戻る、背景モーションなど。すべて `prefers-reduced-motion` を尊重。

---

## 技術スタック

| 領域 | 採用 |
|---|---|
| ビルド | Vite |
| UI | React 19 + TypeScript（strict / `noUncheckedIndexedAccess` / `verbatimModuleSyntax`） |
| スタイル | Plain CSS + CSS Modules（外部 UI/フォント依存なし） |
| PWA | vite-plugin-pwa（Workbox） |
| 永続化 | localStorage + File API |
| テスト | Vitest + @testing-library（jsdom） |

設計方針: 状態は `src/hooks/useProject.ts` に集約、`src/utils/*` は副作用のない純関数、`src/components/*` は表示のみ。

---

## 開発

```bash
npm install
npm run dev       # 開発サーバ（HMR）
npm test          # テスト（Vitest）
npm run lint      # ESLint
npm run build     # 型チェック + 本番ビルド（dist/）
npm run preview   # ビルド成果物をローカル配信
```

> 主要ターゲットは最新版の Chrome / Edge デスクトップです（モバイルは対象外）。
> PWA インストール・Window Controls Overlay・クリップボードは HTTPS（または localhost）でのみ有効です。

---

## データ形式

### `.ymscript`（プロジェクト保存形式 / JSON）

```json
{
  "version": 1,
  "projectName": "第1回解説",
  "characters": [{ "id": "…", "name": "霊夢", "color": "#FF6B6B" }],
  "lines": [{ "id": "…", "characterId": "…", "text": "今日は解説するわ" }]
}
```

### CSV（YMM4 取り込み用）

ヘッダーなし・1行1セリフ・`キャラクター名,セリフ` 形式・UTF-8 **BOM 付き**。

```
霊夢,今日はCSVの使い方を解説するわ！
魔理沙,しっかり覚えろよ！
```

### Markdown（AI 連携・人間が書く用）

```markdown
---
project: 第1回解説
characters:
  - name: 霊夢
    color: "#FF6B6B"
---

霊夢: 今日はYMM4の使い方を解説するわよ！
魔理沙: しっかり覚えろよな！
```

フロントマターは省略可（省略時は本文の `名前: セリフ` から自動でキャラ登録）。読み込みは現在のプロジェクトを置き換えます。

---

## デプロイ

`main` への push で GitHub Actions（`.github/workflows/deploy.yml`）が `npm run build` を実行し、GitHub Pages へ自動デプロイします。GitHub Pages のサブパス配信に合わせて Vite の `base` を `/ymm4-script-editor/` に設定しています（ルート配信のホストに移す場合は `base` を `/` に戻してください）。

---

## ドキュメント

- [**LLM 向け 台本Markdownフォーマット仕様**](docs/llm-script-format.md) — ChatGPT 等に台本を書かせて、そのまま `.md` 取り込みするための指示書（貼り付けテンプレ付き）

設計・仕様は `docs/spec/` にあります（本文＝初版、各文書末尾の「実装差分・追補」が完成品との同期）。

- [要件定義書](docs/spec/requirements.md)（v1.0 + 実装差分 §9）
- [設計書](docs/spec/design.md)（v1.0 + 実装差分 §10）
- [Markdown対応 追加仕様](docs/spec/spec-v1.1-markdown.md)（v1.1）
- [ADR-001: 技術スタック選定](docs/spec/ADR-001-tech-stack.md)

---

## ライセンス

未設定（個人ツール）。再利用・公開ルールを定めたい場合は `LICENSE` を追加してください。
