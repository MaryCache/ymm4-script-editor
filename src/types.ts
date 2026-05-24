// src/types.ts

/**
 * キャラクター（話者）を表すドメインモデル。
 *
 * @remarks
 * プロジェクト内でキャラクターを一意に識別するための `id` と、
 * UI 表示に使う `name` / `color` を保持する。
 * `color` は CSS hex 形式（`#RRGGBB`）で、`PALETTE` またはユーザー指定値が入る。
 *
 * @see {@link Line} — セリフが `characterId` でキャラクターを参照する
 * @see {@link Project} — プロジェクトの `characters` 配列の要素
 */
export type Character = {
  /** `crypto.randomUUID()` で生成した一意識別子。 */
  id: string;
  /** 台本・UI 上に表示するキャラクター名。 */
  name: string;
  /** キャラクターに対応する CSS hex カラー（例: `"#FF6B6B"`）。 */
  color: string; // CSS hex color, e.g. "#FF6B6B"
};

/**
 * 台本の1行（セリフ）を表すドメインモデル。
 *
 * @remarks
 * `characterId` で {@link Character} を参照する。
 * `text` は YMM4 へ書き出す生のセリフ文字列。
 *
 * @see {@link Character} — 話者情報
 * @see {@link Project} — プロジェクトの `lines` 配列の要素
 */
export type Line = {
  /** `crypto.randomUUID()` で生成した一意識別子。 */
  id: string;
  /** この行を話すキャラクターの `Character.id`。 */
  characterId: string;
  /** セリフのテキスト。改行を含まない想定（CSV 出力時にスペースへ正規化）。 */
  text: string;
};

/**
 * プロジェクト全体を表す最上位データ構造。
 *
 * @remarks
 * `version: 1` はスキーマバージョン識別子。将来の破壊的変更に備えてリテラル型とした。
 * `characters` / `lines` の順序は表示・出力順に直結する。
 *
 * @see {@link Character}
 * @see {@link Line}
 */
export type Project = {
  /** スキーマバージョン。現在は常に `1`。 */
  version: 1;
  /** 台本のタイトル。ファイル保存時にファイル名のベースになる。 */
  projectName: string;
  /** プロジェクトに登録されたキャラクター一覧（順序保証）。 */
  characters: Character[];
  /** 台本の行（セリフ）一覧（上から順）。 */
  lines: Line[];
};

/**
 * ワークスペース内の1タブに対応するエントリ。
 *
 * @remarks
 * `id` はワークスペース内でタブを一意に識別するための識別子（`crypto.randomUUID()`）。
 * `.ymscript` 互換を維持するため、`id` は `Project` には持たせず、ラッパ側にのみ保持する。
 *
 * @see {@link Workspace}
 * @see {@link Project}
 */
export type WorkspaceEntry = {
  /** ワークスペース内でタブを一意に識別する ID（`crypto.randomUUID()`）。 */
  id: string;
  /** このエントリが保持するプロジェクト（台本データ）。 */
  project: Project;
};

/**
 * 複数プロジェクトを束ねるワークスペース。localStorage 永続化の単位。
 *
 * @remarks
 * 不変条件:
 * - `entries.length >= 1`（常に最低1エントリ）
 * - `activeId` は必ず `entries` のいずれかの `id` を指す
 *
 * `version: 1` はスキーマバージョン識別子。将来の破壊的変更に備えたリテラル型。
 *
 * @see {@link WorkspaceEntry}
 */
export type Workspace = {
  /** スキーマバージョン。現在は常に `1`。 */
  version: 1;
  /** 現在アクティブなエントリの `id`。必ず `entries` のいずれかを指す。 */
  activeId: string;
  /** タブとして保持するプロジェクトエントリ一覧。1つ以上。 */
  entries: WorkspaceEntry[];
};
