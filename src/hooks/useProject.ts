// src/hooks/useProject.ts
import { useCallback, useEffect, useRef, useState } from "react";
import type { Line, Project, TabEntry, Workspace } from "../types";
import { generateId } from "../utils/id";
import { colorForIndex } from "../utils/color";
import { buildCSV, buildCSVText } from "../utils/csv";
import { buildMarkdown, parseMarkdown } from "../utils/markdown";
import { downloadText, parseProjectFile, parseWorkspaceFile, readFileAsText, sanitizeFilename } from "../utils/file";

/**
 * `localStorage` の旧キー。マイグレーション時にのみ参照する。
 *
 * @remarks
 * v1.3 以降は {@link STORAGE_KEY_WORKSPACE} が永続化の主キーとなる。
 * 旧キーが存在する場合は1エントリのワークスペースに移行する。
 *
 * @see {@link useProject}
 */
export const STORAGE_KEY = "ymm4-script-editor:last-project";

/**
 * `localStorage` のワークスペースキー。v1.3 以降の永続化に使用する。
 *
 * @remarks
 * 名前空間プレフィックス `ymm4-script-editor:` により他アプリとの衝突を防ぐ。
 * ワークスペース全体（全タブ・アクティブ状態）を JSON 保存する。
 *
 * @see {@link useProject}
 */
export const STORAGE_KEY_WORKSPACE = "ymm4-script-editor:workspace";

/**
 * `useProject` フックが返すプロジェクト操作 API の型。
 *
 * @remarks
 * すべてのミューテーター（`setProjectName` 〜 `moveLine`）は
 * `useCallback(deps: [])` で安定参照を持ち、`React.memo` 化したコンポーネントに
 * 渡しても不要な再描画を引き起こさない（要件 NF-10）。
 *
 * `saveToFile` / `exportCSV` / `exportMarkdown` / `exportCSVToClipboard` は
 * `project` の現在値を直接参照するため `[project]` 依存になる。
 *
 * タブ操作（`tabs` / `activeId` / `newProject` / `switchProject` / `closeProject` /
 * `renameProject`）は v1.3 で追加したワークスペース操作 API。
 *
 * @see {@link useProject}
 */
export type UseProjectReturn = {
  /** 現在のプロジェクト状態（読み取り専用参照）。アクティブエントリの project。 */
  project: Project;
  /**
   * タブ表示用の一覧。name = project.projectName。
   *
   * @remarks
   * `isEmpty` の意味・条件は {@link TabEntry} 参照。
   *
   * @see {@link TabEntry}
   */
  tabs: TabEntry[];
  /** 現在アクティブなエントリの id。 */
  activeId: string;
  /** プロジェクト名を更新する。 */
  setProjectName: (name: string) => void;
  /**
   * 指定名のキャラクターを末尾に追加する。
   *
   * @param name - 追加するキャラクター名
   */
  addCharacter: (name: string) => void;
  /**
   * 指定 ID のキャラクターを削除する。
   *
   * @remarks
   * 最後の1キャラクターは削除不可（孤児 Line 防止）。該当行の `characterId` は
   * 「削除対象でない最初のキャラクター」へ付け替える（要件 F-04）。
   *
   * @param id - 削除対象のキャラクター ID
   */
  deleteCharacter: (id: string) => void; // 最後の1キャラは no-op
  /**
   * 指定 ID の行の直後に新しい行を挿入する。
   *
   * @remarks
   * 新しい行は元の行のキャラクターを引き継ぐ（同一話者の連続入力が自然なため）。
   * キャラクターが未登録の場合は no-op。
   *
   * @param afterId - 挿入基準となる行の ID
   */
  addLineAfter: (afterId: string) => void;
  /**
   * プロジェクトの末尾に新しい行を追加する。
   *
   * @remarks
   * 文脈がないため先頭キャラクターを割り当てる。
   * キャラクターが未登録の場合は no-op。
   */
  addLineAtEnd: () => void;
  /**
   * 指定 ID の行を削除する。
   *
   * @param id - 削除対象の行 ID
   */
  deleteLine: (id: string) => void;
  /**
   * 指定行のキャラクターを変更する。
   *
   * @param lineId - 変更対象の行 ID
   * @param characterId - 新しいキャラクター ID
   */
  updateLineCharacter: (lineId: string, characterId: string) => void;
  /**
   * 指定行のテキストを更新する。
   *
   * @param lineId - 更新対象の行 ID
   * @param text - 新しいテキスト
   */
  updateLineText: (lineId: string, text: string) => void;
  /**
   * 指定行を上または下に1つ移動する。
   *
   * @remarks
   * 先頭行を `"up"` / 末尾行を `"down"` にしても no-op（範囲外ガード）。
   *
   * @param id - 移動対象の行 ID
   * @param direction - 移動方向
   */
  moveLine: (id: string, direction: "up" | "down") => void;
  /**
   * 指定 ID のキャラクター名を変更する。
   *
   * @remarks
   * `name.trim()` が空文字列の場合は no-op（元の名前を維持）。
   * trim した名前を採用するため、前後の空白は除去される。
   *
   * @param id - 変更対象のキャラクター ID
   * @param name - 新しいキャラクター名
   */
  renameCharacter: (id: string, name: string) => void;
  /**
   * 指定 ID のキャラクターの色を変更する。
   *
   * @param id - 変更対象のキャラクター ID
   * @param color - 新しい CSS hex カラー（例: `"#FF6B6B"`）
   */
  setCharacterColor: (id: string, color: string) => void;
  /**
   * プレーンテキストを改行で分割して台本末尾に一括追加する。
   *
   * @remarks
   * 各行を trim し、空行はスキップする（要件 F-75）。
   * 取り込んだ行のキャラクターはすべて `characters[0]` に割り当てる（要件 F-73）。
   * キャラクターが0人のときは「キャラ1」を自動作成してから取り込む（要件 F-76）。
   * 取り込みは既存台本の末尾に追加する（置換しない。要件 F-74）。
   * 0行（全部空行）の場合は状態を変更せず 0 を返す（キャラ自動作成もしない）。
   *
   * @param text - 取り込むプレーンテキスト
   * @returns 取り込んだ（空行除外後の）行数
   */
  importPlainText: (text: string) => number;
  /**
   * 全セリフ行を削除する。
   *
   * @remarks
   * キャラクター一覧・プロジェクト名は保持される（要件 F-103）。
   */
  clearAllLines: () => void;
  /**
   * プロジェクトを `.ymscript` ファイルとしてダウンロードする。
   *
   * @remarks
   * ファイル名は `sanitizeFilename(project.projectName) + ".ymscript"`。
   */
  saveToFile: () => void; // .ymscript
  /**
   * `.ymscript` ファイルを読み込んで新規タブとして追加しアクティブにする。
   *
   * @remarks
   * §8-2: 読込は現アクティブを置換せず、新規エントリとして追加する。
   *
   * @param file - ユーザーが選択した `.ymscript` ファイル
   * @returns 読み込み完了の Promise（失敗時は reject）
   */
  loadFromFile: (file: File) => Promise<void>;
  /**
   * プロジェクトを BOM 付き CSV ファイルとしてダウンロードする。
   *
   * @remarks
   * Excel / YMM4 での文字化けを防ぐため UTF-8 BOM を付与する（要件 F-51）。
   */
  exportCSV: () => void; // BOM付き .csv
  /**
   * プロジェクトを Markdown ファイルとしてダウンロードする。
   *
   * @remarks
   * YAML フロントマター付きの完全形式。`parseMarkdown` で round-trip できる。
   */
  exportMarkdown: () => void; // 完全形式 .md
  /**
   * Markdown ファイルを読み込んで新規タブとして追加しアクティブにする。
   *
   * @remarks
   * §8-2: 読込は現アクティブを置換せず、新規エントリとして追加する。
   *
   * @param file - ユーザーが選択した `.md` ファイル
   * @returns スキップした行数（パースできなかった行の件数）
   */
  importMarkdown: (file: File) => Promise<number>; // 返り値: skippedLines
  /**
   * プロジェクト全行の CSV テキストをクリップボードにコピーする（要件 F-51）。
   *
   * @remarks
   * BOM なしの CSV テキストをコピーする（ペースト先が BOM を扱えないケースを考慮）。
   * Clipboard API が利用できない場合は reject する。
   */
  exportCSVToClipboard: () => Promise<void>; // 全件コピー（F-51）
  /**
   * 空の既定プロジェクトを新エントリとして追加し、それをアクティブにする。
   */
  newProject: () => void;
  /**
   * 指定 id のエントリをアクティブにする。
   *
   * @param id - アクティブにするエントリの id
   */
  switchProject: (id: string) => void;
  /**
   * 指定 id のエントリを閉じる。
   *
   * @remarks
   * 最後の1エントリは no-op（常に最低1プロジェクト存在）。
   * 閉じたエントリがアクティブだった場合、隣接する別エントリをアクティブにする。
   *
   * @param id - 閉じるエントリの id
   */
  closeProject: (id: string) => void;
  /**
   * 指定 id のエントリの projectName を変更する。
   *
   * @remarks
   * `name.trim()` が空文字列の場合は no-op。
   *
   * @param id - 変更対象のエントリの id
   * @param name - 新しいプロジェクト名
   */
  renameProject: (id: string, name: string) => void;
};

// 関数にする理由: 毎回新しいオブジェクトを返し、複数の呼び出し元が参照を共有しないようにするため。
const defaultProject = (): Project => ({ version: 1, projectName: "新規プロジェクト", characters: [], lines: [] });

const defaultWorkspace = (): Workspace => {
  const id = generateId();
  return { version: 1, activeId: id, entries: [{ id, project: defaultProject() }] };
};

/**
 * localStorage からワークスペースを復元する。
 *
 * @remarks
 * 復元ロジック（優先順位順）:
 * 1. `STORAGE_KEY_WORKSPACE` に有効な Workspace があれば採用。
 * 2. 旧キー `STORAGE_KEY` に有効な Project があれば1エントリのワークスペースに移行。
 * 3. どちらも無ければ既定ワークスペース（空プロジェクト1つ）。
 *
 * 壊れた値は握り潰して次の候補へフォールバックする。
 */
const restoreWorkspaceFromStorage = (): Workspace => {
  // 1. workspace キーを試みる
  try {
    const raw = localStorage.getItem(STORAGE_KEY_WORKSPACE);
    if (raw) return parseWorkspaceFile(JSON.parse(raw));
  } catch {
    // 壊れていれば次の候補へ
  }

  // 2. 旧キーからのマイグレーション
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const project = parseProjectFile(JSON.parse(raw));
      const id = generateId();
      return { version: 1, activeId: id, entries: [{ id, project }] };
    }
  } catch {
    // 壊れていれば既定へ
  }

  // 3. 既定ワークスペース
  return defaultWorkspace();
};

const newLine = (characterId: string): Line => ({ id: generateId(), characterId, text: "" });

/**
 * アクティブエントリの project を updater で差し替えたワークスペースを返すヘルパー型。
 *
 * @internal
 */
const updateActiveProject = (w: Workspace, updater: (p: Project) => Project): Workspace => {
  return {
    ...w,
    entries: w.entries.map((e) => (e.id === w.activeId ? { ...e, project: updater(e.project) } : e)),
  };
};

/**
 * `useProject` フックのオプション引数。
 *
 * @see {@link useProject}
 */
export type UseProjectOptions = {
  /**
   * localStorage への永続化が失敗したときに呼ばれるコールバック。
   *
   * @remarks
   * 呼ばれるのは `localStorage.setItem` が例外（容量超過等）を投げた場合のみ。
   * `console.error` は引き続き出力される（このコールバックは追加通知用）。
   * 安定参照でなくてもよい（内部で ref 経由で保持するため再レンダーを引き起こさない）。
   *
   * @param error - 発生した例外オブジェクト
   */
  onPersistError?: (error: unknown) => void;
};

/**
 * プロジェクト全体の状態管理と永続化を提供するカスタムフック。
 *
 * @remarks
 * - ワークスペース状態は `localStorage`（キー: {@link STORAGE_KEY_WORKSPACE}）に自動永続化される。
 * - 起動時に `localStorage` から復元を試みる（旧キー移行・壊れた値は `defaultWorkspace` にフォールバック）。
 * - 既存 mutator（`setProjectName` 〜 `clearAllLines`）は常に**アクティブエントリの project** に作用する。
 *   内部的には `setWorkspace(w => updateActiveProject(w, updater))` 形式で実装し、安定参照を維持する。
 * - `saveToFile` / `exportCSV` / `exportMarkdown` / `exportCSVToClipboard` は
 *   `project` の現在値を参照するため `[project]` 依存になる。
 * - `loadFromFile` / `importMarkdown` は §8-2 に従い、新規タブとして追加してアクティブにする。
 * - `options.onPersistError` を渡すと永続化失敗時に呼ばれる（F-117 準拠）。
 *
 * @param options - {@link UseProjectOptions}（省略可）
 * @returns {@link UseProjectReturn} — プロジェクト状態とミューテーター一式
 *
 * @example
 * ```ts
 * function App() {
 *   const { project, tabs, activeId, addCharacter, newProject, switchProject } = useProject();
 *   return <div>{project.projectName} — タブ数: {tabs.length}</div>;
 * }
 * ```
 *
 * @example 永続化失敗をトーストで通知する場合
 * ```ts
 * const { project } = useProject({
 *   onPersistError: () => pushToast("保存に失敗しました", "error"),
 * });
 * ```
 *
 * @see {@link UseProjectReturn}
 * @see {@link UseProjectOptions}
 * @see {@link STORAGE_KEY_WORKSPACE}
 */
export const useProject = (options?: UseProjectOptions): UseProjectReturn => {
  const [workspace, setWorkspace] = useState<Workspace>(restoreWorkspaceFromStorage);

  // onPersistError を ref に退避して useEffect の deps に含めない。
  // これにより、呼び出し元が毎レンダーでインライン関数を渡しても再レンダーを引き起こさない。
  const onPersistErrorRef = useRef(options?.onPersistError);
  useEffect(() => {
    onPersistErrorRef.current = options?.onPersistError;
  });

  // workspace が変わるたびに localStorage へ永続化する。
  // 失敗時は console.error に加えて onPersistError コールバックで呼び出し元に通知する（F-117）。
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY_WORKSPACE, JSON.stringify(workspace));
    } catch (e) {
      console.error("localStorage への保存に失敗しました", e);
      onPersistErrorRef.current?.(e);
    }
  }, [workspace]);

  // アクティブエントリの project を導出する（レンダー内で毎回計算、useCallback 不要）。
  // entries は不変条件 length >= 1 かつ activeId は必ず entries に存在するため非 null アサーション安全。
  const activeEntry = workspace.entries.find((e) => e.id === workspace.activeId)!;
  const project = activeEntry.project;

  // tabs: 表示用（TabEntry 型）。
  // isEmpty = lines が0件かつ characters が空のときのみ真（F-113）。
  //   行なし・キャラあり → 未保存データとみなして閉じ時に確認を要求する。
  // useMemo 不要: レンダー毎の計算コストは配列マップのみで軽量。
  const tabs: TabEntry[] = workspace.entries.map((e) => ({
    id: e.id,
    name: e.project.projectName,
    isEmpty: e.project.lines.length === 0 && e.project.characters.length === 0,
  }));
  const { activeId } = workspace;

  // --- mutator はすべて setWorkspace の updater 形式で実装する ---
  // updater 形式の理由: 連続 act() で状態をバッチ更新しても常に最新の w を参照できる。
  // useCallback(deps: []) の理由: LineRow を React.memo 化した際、ハンドラが毎レンダで
  // 再生成されると memo の恩恵がなくなる（NF-10 性能要件）。外部依存ゼロ = 参照が安定する。

  const setProjectName = useCallback(
    (name: string) => setWorkspace((w) => updateActiveProject(w, (p) => ({ ...p, projectName: name }))),
    [],
  );

  const addCharacter = useCallback(
    (name: string) =>
      setWorkspace((w) =>
        updateActiveProject(w, (p) => ({
          ...p,
          characters: [...p.characters, { id: generateId(), name, color: colorForIndex(p.characters.length) }],
        })),
      ),
    [],
  );

  // 最後の1キャラを削除しない理由: キャラが0になると全 Line が孤児になり
  // select が空になって UI が壊れる。ガードで不変を保つ。
  // fallback は「削除対象でない最初のキャラ」。該当 Line を付け替えることで孤児を作らない（F-04）。
  const deleteCharacter = useCallback(
    (id: string) =>
      setWorkspace((w) =>
        updateActiveProject(w, (p) => {
          if (p.characters.length <= 1) return p; // 最後の1キャラは削除不可
          const fallbackId = p.characters.find((c) => c.id !== id)?.id ?? "";
          return {
            ...p,
            characters: p.characters.filter((c) => c.id !== id),
            lines: p.lines.map((l) => (l.characterId === id ? { ...l, characterId: fallbackId } : l)),
          };
        }),
      ),
    [],
  );

  // 文脈がないため先頭キャラを割り当てる。
  const addLineAtEnd = useCallback(
    () =>
      setWorkspace((w) =>
        updateActiveProject(w, (p) => {
          const first = p.characters[0];
          if (!first) return p; // キャラ未登録なら no-op
          return { ...p, lines: [...p.lines, newLine(first.id)] };
        }),
      ),
    [],
  );

  // 直後に追加する行は元の行のキャラを引き継ぐ（同一話者の連続入力が自然なため）。
  // splice はローカルコピーに対してのみ使用。元の p.lines は変更しない（イミュータブル）。
  const addLineAfter = useCallback(
    (afterId: string) =>
      setWorkspace((w) =>
        updateActiveProject(w, (p) => {
          const first = p.characters[0];
          if (!first) return p; // キャラ未登録なら no-op
          const idx = p.lines.findIndex((l) => l.id === afterId);
          if (idx === -1) return p;
          const sourceLine = p.lines[idx];
          const inheritedCharId = p.characters.some((c) => c.id === sourceLine?.characterId)
            ? (sourceLine?.characterId ?? first.id)
            : first.id;
          const next = [...p.lines];
          next.splice(idx + 1, 0, newLine(inheritedCharId));
          return { ...p, lines: next };
        }),
      ),
    [],
  );

  const deleteLine = useCallback(
    (id: string) =>
      setWorkspace((w) => updateActiveProject(w, (p) => ({ ...p, lines: p.lines.filter((l) => l.id !== id) }))),
    [],
  );

  const updateLineCharacter = useCallback(
    (lineId: string, characterId: string) =>
      setWorkspace((w) =>
        updateActiveProject(w, (p) => ({
          ...p,
          lines: p.lines.map((l) => (l.id === lineId ? { ...l, characterId } : l)),
        })),
      ),
    [],
  );

  const updateLineText = useCallback(
    (lineId: string, text: string) =>
      setWorkspace((w) =>
        updateActiveProject(w, (p) => ({
          ...p,
          lines: p.lines.map((l) => (l.id === lineId ? { ...l, text } : l)),
        })),
      ),
    [],
  );

  const moveLine = useCallback(
    (id: string, direction: "up" | "down") =>
      setWorkspace((w) =>
        updateActiveProject(w, (p) => {
          const idx = p.lines.findIndex((l) => l.id === id);
          if (idx === -1) return p;
          const target = direction === "up" ? idx - 1 : idx + 1;
          if (target < 0 || target >= p.lines.length) return p;
          const next = [...p.lines];
          // 範囲チェック済みのためどちらも必ず存在する。一時変数で swap を明示する。
          const lineAtIdx = next[idx]!;
          const lineAtTarget = next[target]!;
          next[idx] = lineAtTarget;
          next[target] = lineAtIdx;
          return { ...p, lines: next };
        }),
      ),
    [],
  );

  // --- v1.2 追加 mutator ---

  // name.trim() が空なら no-op（元の名前を維持）。trim した名前を採用する。
  const renameCharacter = useCallback(
    (id: string, name: string) =>
      setWorkspace((w) =>
        updateActiveProject(w, (p) => {
          const trimmed = name.trim();
          if (!trimmed) return p; // 空文字は no-op
          return {
            ...p,
            characters: p.characters.map((c) => (c.id === id ? { ...c, name: trimmed } : c)),
          };
        }),
      ),
    [],
  );

  const setCharacterColor = useCallback(
    (id: string, color: string) =>
      setWorkspace((w) =>
        updateActiveProject(w, (p) => ({
          ...p,
          characters: p.characters.map((c) => (c.id === id ? { ...c, color } : c)),
        })),
      ),
    [],
  );

  // text を改行で分割 → trim → 空行スキップ。
  // 0行（全部空行）なら状態変更なし・キャラ自動作成もせず 0 を返す。
  // 0人時は「キャラ1」を自動作成し、characters と lines を1回の setWorkspace で更新する。
  // 返り値（件数）は updater の外で算出する理由: setWorkspace の updater 形式では関数の
  // 戻り値が次の state として解釈されるため、行数のような副作用の値をそこから返せない。
  const importPlainText = useCallback((text: string): number => {
    const parsed = text
      .split(/\r\n|\r|\n/)
      .map((l) => l.trim())
      .filter((l) => l.length > 0);

    if (parsed.length === 0) return 0;

    setWorkspace((w) =>
      updateActiveProject(w, (p) => {
        let characters = p.characters;
        let characterId: string;

        if (characters.length === 0) {
          // キャラが0人なら「キャラ1」を自動作成する。
          const newChar = { id: generateId(), name: "キャラ1", color: colorForIndex(0) };
          characters = [newChar];
          characterId = newChar.id;
        } else {
          // noUncheckedIndexedAccess のため非 null アサーション: length > 0 を確認済み。
          characterId = characters[0]!.id;
        }

        const newLines = parsed.map((lineText) => ({ id: generateId(), characterId, text: lineText }));
        return { ...p, characters, lines: [...p.lines, ...newLines] };
      }),
    );

    return parsed.length;
  }, []);

  const clearAllLines = useCallback(
    () => setWorkspace((w) => updateActiveProject(w, (p) => ({ ...p, lines: [] }))),
    [],
  );

  // --- [project] 依存: saveToFile / exportCSV / exportMarkdown / exportCSVToClipboard ---
  // これらは project の現在値を関数実行時に読むため、updater 形式が使えず [project] 依存。
  // Header など1コンポーネントにのみ渡るため、project 変化ごとの再生成コストは無視可。

  const saveToFile = useCallback(() => {
    const base = sanitizeFilename(project.projectName);
    downloadText(JSON.stringify(project, null, 2), `${base}.ymscript`, "application/json");
  }, [project]);

  // --- § 8-2: loadFromFile / importMarkdown は新規タブとして追加してアクティブにする ---
  // setWorkspace の updater 形式で workspace 全体を更新するため [] で安定参照。

  const loadFromFile = useCallback(async (file: File) => {
    const text = await readFileAsText(file);
    const loaded = parseProjectFile(JSON.parse(text));
    const newId = generateId();
    setWorkspace((w) => ({
      ...w,
      activeId: newId,
      entries: [...w.entries, { id: newId, project: loaded }],
    }));
  }, []);

  const exportCSV = useCallback(() => {
    const base = sanitizeFilename(project.projectName);
    downloadText(buildCSV(project), `${base}.csv`, "text/csv;charset=utf-8");
  }, [project]);

  const exportMarkdown = useCallback(() => {
    const base = sanitizeFilename(project.projectName);
    downloadText(buildMarkdown(project), `${base}.md`, "text/markdown;charset=utf-8");
  }, [project]);

  // § 8-2: importMarkdown も新規タブとして追加してアクティブにする。
  const importMarkdown = useCallback(async (file: File): Promise<number> => {
    const text = await readFileAsText(file);
    const { project: parsed, skippedLines } = parseMarkdown(text);
    const newId = generateId();
    setWorkspace((w) => ({
      ...w,
      activeId: newId,
      entries: [...w.entries, { id: newId, project: parsed }],
    }));
    return skippedLines;
  }, []);

  const exportCSVToClipboard = useCallback(async () => {
    await navigator.clipboard.writeText(buildCSVText(project));
  }, [project]);

  // --- v1.3 ワークスペース操作 ---

  const newProject = useCallback(() => {
    const newId = generateId();
    setWorkspace((w) => ({
      ...w,
      activeId: newId,
      entries: [...w.entries, { id: newId, project: defaultProject() }],
    }));
  }, []);

  const switchProject = useCallback((id: string) => {
    setWorkspace((w) => {
      if (!w.entries.some((e) => e.id === id)) return w; // 存在しない id は no-op
      return { ...w, activeId: id };
    });
  }, []);

  const closeProject = useCallback((id: string) => {
    setWorkspace((w) => {
      if (w.entries.length <= 1) return w; // 最後の1エントリは no-op
      const remaining = w.entries.filter((e) => e.id !== id);
      // 閉じたエントリがアクティブだった場合、隣接する別エントリをアクティブにする。
      // 閉じる前のインデックスを参照し、前のエントリ（なければ次）を選ぶ。
      let nextActiveId = w.activeId;
      if (w.activeId === id) {
        const closedIdx = w.entries.findIndex((e) => e.id === id);
        const prev = w.entries[closedIdx - 1];
        const next = w.entries[closedIdx + 1];
        // noUncheckedIndexedAccess: prev/next は undefined の可能性があるため optional chaining。
        // remaining.length >= 1 の不変条件により remaining[0] は必ず存在する。
        nextActiveId = (prev ?? next ?? remaining[0])!.id;
      }
      return { ...w, activeId: nextActiveId, entries: remaining };
    });
  }, []);

  const renameProject = useCallback((id: string, name: string) => {
    const trimmed = name.trim();
    if (!trimmed) return; // 空文字は no-op
    setWorkspace((w) => ({
      ...w,
      entries: w.entries.map((e) => (e.id === id ? { ...e, project: { ...e.project, projectName: trimmed } } : e)),
    }));
  }, []);

  return {
    project,
    tabs,
    activeId,
    setProjectName,
    addCharacter,
    deleteCharacter,
    addLineAfter,
    addLineAtEnd,
    deleteLine,
    updateLineCharacter,
    updateLineText,
    moveLine,
    renameCharacter,
    setCharacterColor,
    importPlainText,
    clearAllLines,
    saveToFile,
    loadFromFile,
    exportCSV,
    exportMarkdown,
    importMarkdown,
    exportCSVToClipboard,
    newProject,
    switchProject,
    closeProject,
    renameProject,
  };
};
