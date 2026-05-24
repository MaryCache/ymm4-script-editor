// src/hooks/useProject.ts
import { useCallback, useEffect, useState } from "react";
import type { Line, Project } from "../types";
import { generateId } from "../utils/id";
import { colorForIndex } from "../utils/color";
import { buildCSV, buildCSVText } from "../utils/csv";
import { buildMarkdown, parseMarkdown } from "../utils/markdown";
import { downloadText, parseProjectFile, readFileAsText, sanitizeFilename } from "../utils/file";

/**
 * `localStorage` のキー。プロジェクトの永続化に使用する。
 *
 * @remarks
 * 名前空間プレフィックス `ymm4-script-editor:` により他アプリとの衝突を防ぐ。
 *
 * @see {@link useProject}
 */
export const STORAGE_KEY = "ymm4-script-editor:last-project";

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
 * @see {@link useProject}
 */
export type UseProjectReturn = {
  /** 現在のプロジェクト状態（読み取り専用参照）。 */
  project: Project;
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
  deleteCharacter: (id: string) => void;          // 最後の1キャラは no-op
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
   * プロジェクトを `.ymscript` ファイルとしてダウンロードする。
   *
   * @remarks
   * ファイル名は `sanitizeFilename(project.projectName) + ".ymscript"`。
   */
  saveToFile: () => void;                          // .ymscript
  /**
   * `.ymscript` ファイルを読み込んでプロジェクトを復元する。
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
  exportCSV: () => void;                           // BOM付き .csv
  /**
   * プロジェクトを Markdown ファイルとしてダウンロードする。
   *
   * @remarks
   * YAML フロントマター付きの完全形式。`parseMarkdown` で round-trip できる。
   */
  exportMarkdown: () => void;                       // 完全形式 .md
  /**
   * Markdown ファイルを読み込んでプロジェクトを更新する。
   *
   * @param file - ユーザーが選択した `.md` ファイル
   * @returns スキップした行数（パースできなかった行の件数）
   */
  importMarkdown: (file: File) => Promise<number>;  // 返り値: skippedLines
  /**
   * プロジェクト全行の CSV テキストをクリップボードにコピーする（要件 F-51）。
   *
   * @remarks
   * BOM なしの CSV テキストをコピーする（ペースト先が BOM を扱えないケースを考慮）。
   * Clipboard API が利用できない場合は reject する。
   */
  exportCSVToClipboard: () => Promise<void>;        // 全件コピー（F-51）
};

// 関数にする理由: 毎回新しいオブジェクトを返し、複数の呼び出し元が参照を共有しないようにするため。
const defaultProject = (): Project => ({ version: 1, projectName: "新規プロジェクト", characters: [], lines: [] });

// localStorage から復元を試みる。壊れた値は握り潰して defaultProject にフォールバック。
// parseProjectFile が version チェックや構造検証を行うため、部分破損も安全に扱える。
const restoreProjectFromStorage = (): Project => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaultProject();
    return parseProjectFile(JSON.parse(raw));
  } catch {
    return defaultProject();
  }
};

const newLine = (characterId: string): Line => ({ id: generateId(), characterId, text: "" });

/**
 * プロジェクト全体の状態管理と永続化を提供するカスタムフック。
 *
 * @remarks
 * - プロジェクト状態は `localStorage`（キー: {@link STORAGE_KEY}）に自動永続化される。
 * - 起動時に `localStorage` から復元を試みる（壊れた値は `defaultProject` にフォールバック）。
 * - ミューテーター（`setProjectName` 〜 `moveLine`）は `updater` 形式の `setProject` を使い、
 *   外部依存ゼロで `useCallback([])` による安定参照を実現する（要件 NF-10）。
 * - `saveToFile` / `exportCSV` / `exportMarkdown` / `exportCSVToClipboard` は
 *   `project` の現在値を参照するため `[project]` 依存になる。
 *
 * @returns {@link UseProjectReturn} — プロジェクト状態とミューテーター一式
 *
 * @example
 * ```ts
 * function App() {
 *   const { project, addCharacter, addLineAtEnd, exportCSV } = useProject();
 *   return <div>{project.projectName}</div>;
 * }
 * ```
 *
 * @see {@link UseProjectReturn}
 * @see {@link STORAGE_KEY}
 */
export const useProject = (): UseProjectReturn => {
  const [project, setProject] = useState<Project>(restoreProjectFromStorage);

  // project が変わるたびに localStorage へ永続化する。
  // useState の初期化関数 restoreProjectFromStorage が復元を担うので、保存と復元のループは起きない。
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(project));
    } catch (e) {
      console.error("localStorage への保存に失敗しました", e);
    }
  }, [project]);

  // --- mutator はすべて setProject の updater 形式 → 外部依存ゼロ → useCallback([]) で安定参照 ---
  // updater 形式を使う理由: 連続 act() で状態をバッチ更新しても常に最新の p を参照できる。
  // useCallback([]) で参照を固定する理由: LineRow を React.memo 化した際、ハンドラが毎レンダ
  // で再生成されると memo の恩恵がなくなる（NF-10 性能要件）。

  const setProjectName = useCallback((name: string) => setProject((p) => ({ ...p, projectName: name })), []);

  const addCharacter = useCallback((name: string) =>
    setProject((p) => ({
      ...p,
      characters: [...p.characters, { id: generateId(), name, color: colorForIndex(p.characters.length) }],
    })), []);

  // 最後の1キャラを削除しない理由: キャラが0になると全 Line が孤児になり
  // select が空になって UI が壊れる。ガードで不変を保つ。
  // fallback は「削除対象でない最初のキャラ」。該当 Line を付け替えることで孤児を作らない（F-04）。
  const deleteCharacter = useCallback((id: string) =>
    setProject((p) => {
      if (p.characters.length <= 1) return p; // 最後の1キャラは削除不可
      const fallbackId = p.characters.find((c) => c.id !== id)?.id ?? "";
      return {
        ...p,
        characters: p.characters.filter((c) => c.id !== id),
        lines: p.lines.map((l) => (l.characterId === id ? { ...l, characterId: fallbackId } : l)),
      };
    }), []);

  // 文脈がないため先頭キャラを割り当てる。
  const addLineAtEnd = useCallback(() =>
    setProject((p) => {
      const first = p.characters[0];
      if (!first) return p; // キャラ未登録なら no-op
      return { ...p, lines: [...p.lines, newLine(first.id)] };
    }), []);

  // 直後に追加する行は元の行のキャラを引き継ぐ（同一話者の連続入力が自然なため）。
  // 末尾追加 addLineAtEnd は文脈がないので先頭キャラを使う。
  // afterId の行が見つからない・登録キャラがいない場合のフォールバックは先頭キャラ。
  // splice はローカルコピーに対してのみ使用。元の p.lines は変更しない（イミュータブル）。
  const addLineAfter = useCallback((afterId: string) =>
    setProject((p) => {
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
    }), []);

  const deleteLine = useCallback((id: string) =>
    setProject((p) => ({ ...p, lines: p.lines.filter((l) => l.id !== id) })), []);

  const updateLineCharacter = useCallback((lineId: string, characterId: string) =>
    setProject((p) => ({ ...p, lines: p.lines.map((l) => (l.id === lineId ? { ...l, characterId } : l)) })), []);

  const updateLineText = useCallback((lineId: string, text: string) =>
    setProject((p) => ({ ...p, lines: p.lines.map((l) => (l.id === lineId ? { ...l, text } : l)) })), []);

  const moveLine = useCallback((id: string, direction: "up" | "down") =>
    setProject((p) => {
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
    }), []);

  // --- [project] 依存: saveToFile / exportCSV / exportMarkdown / exportCSVToClipboard ---
  // これらは project の現在値を関数実行時に読むため、updater 形式が使えず [project] 依存。
  // Header など1コンポーネントにのみ渡るため、project 変化ごとの再生成コストは無視可。

  const saveToFile = useCallback(() => {
    const base = sanitizeFilename(project.projectName);
    downloadText(JSON.stringify(project, null, 2), `${base}.ymscript`, "application/json");
  }, [project]);

  // --- [] 独立: loadFromFile / importMarkdown ---
  // これらは project を参照せず、parse 後に setProject で上書きするだけなので [] で安定参照。

  const loadFromFile = useCallback(async (file: File) => {
    const text = await readFileAsText(file);
    setProject(parseProjectFile(JSON.parse(text)));
  }, []);

  const exportCSV = useCallback(() => {
    const base = sanitizeFilename(project.projectName);
    downloadText(buildCSV(project), `${base}.csv`, "text/csv;charset=utf-8");
  }, [project]);

  const exportMarkdown = useCallback(() => {
    const base = sanitizeFilename(project.projectName);
    downloadText(buildMarkdown(project), `${base}.md`, "text/markdown;charset=utf-8");
  }, [project]);

  // project を読まないため [] で安定参照（loadFromFile と同じ）。
  const importMarkdown = useCallback(async (file: File): Promise<number> => {
    const text = await readFileAsText(file);
    const { project: parsed, skippedLines } = parseMarkdown(text);
    setProject(parsed);
    return skippedLines;
  }, []);

  const exportCSVToClipboard = useCallback(async () => {
    await navigator.clipboard.writeText(buildCSVText(project));
  }, [project]);

  return {
    project, setProjectName, addCharacter, deleteCharacter,
    addLineAfter, addLineAtEnd, deleteLine, updateLineCharacter,
    updateLineText, moveLine, saveToFile, loadFromFile,
    exportCSV, exportMarkdown, importMarkdown, exportCSVToClipboard,
  };
};
