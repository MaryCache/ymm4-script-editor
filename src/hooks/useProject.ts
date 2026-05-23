// src/hooks/useProject.ts
import { useCallback, useEffect, useState } from "react";
import type { Line, Project } from "../types";
import { generateId } from "../utils/id";
import { colorForIndex } from "../utils/color";
import { buildCSV, buildCSVText } from "../utils/csv";
import { buildMarkdown, parseMarkdown } from "../utils/markdown";
import { downloadText, parseProjectFile, readFileAsText, sanitizeFilename } from "../utils/file";

export const STORAGE_KEY = "ymm4-script-editor:last-project";

export type UseProjectReturn = {
  project: Project;
  setProjectName: (name: string) => void;
  addCharacter: (name: string) => void;
  deleteCharacter: (id: string) => void;          // 最後の1キャラは no-op
  addLineAfter: (afterId: string) => void;
  addLineAtEnd: () => void;
  deleteLine: (id: string) => void;
  updateLineCharacter: (lineId: string, characterId: string) => void;
  updateLineText: (lineId: string, text: string) => void;
  moveLine: (id: string, direction: "up" | "down") => void;
  saveToFile: () => void;                          // .ymscript
  loadFromFile: (file: File) => Promise<void>;
  exportCSV: () => void;                           // BOM付き .csv
  exportMarkdown: () => void;                       // 完全形式 .md
  importMarkdown: (file: File) => Promise<number>;  // 返り値: skippedLines
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
