import { useCallback, useRef } from "react";
import { useProject } from "./hooks/useProject";
import { Header } from "./components/Header/Header";
import { CharacterPanel } from "./components/CharacterPanel/CharacterPanel";
import { ScriptEditor } from "./components/ScriptEditor/ScriptEditor";
import { buildLineCSV } from "./utils/csv";
import type { Character, Line } from "./types";
import styles from "./App.module.css";

export default function App() {
  const p = useProject();

  // copyLine を安定参照に保つため、最新 characters を ref 経由で参照（依存ゼロ）。
  // これにより useCallback([]) で包めて、全 LineRow へ渡すハンドラが再生成されない（NF-10）。
  const charsRef = useRef<Character[]>(p.project.characters);
  charsRef.current = p.project.characters;

  const copyLine = useCallback((line: Line) => {
    navigator.clipboard
      .writeText(buildLineCSV(line, charsRef.current))
      .catch((e) => console.error("コピーに失敗しました", e));
  }, []);

  // moveLine のラッパ: moveLine は安定だが引数変換が必要なため useCallback で包む
  const onMoveUp = useCallback((id: string) => p.moveLine(id, "up"), [p.moveLine]);
  const onMoveDown = useCallback((id: string) => p.moveLine(id, "down"), [p.moveLine]);

  // importMarkdown: skipped>0 でユーザー通知、失敗は alert（useProject 側が throw する）
  const importMarkdown = useCallback((file: File) => {
    p.importMarkdown(file)
      .then((skipped) => { if (skipped > 0) alert(`${skipped} 行を読み込めずスキップしました。`); })
      .catch(() => alert("Markdown の読み込みに失敗しました。"));
  }, [p.importMarkdown]);

  // loadYmscript: 失敗は alert（useProject 内で throw された場合のみ）
  const loadYmscript = useCallback((file: File) => {
    p.loadFromFile(file).catch(() => alert("プロジェクトファイルの読み込みに失敗しました。"));
  }, [p.loadFromFile]);

  return (
    <div className={styles.app}>
      <Header
        projectName={p.project.projectName}
        onProjectNameChange={p.setProjectName}
        onSaveYmscript={p.saveToFile}
        onSaveMarkdown={p.exportMarkdown}
        onExportCSV={p.exportCSV}
        onLoadYmscript={loadYmscript}
        onLoadMarkdown={importMarkdown}
        onCopyAll={() => { void p.exportCSVToClipboard(); }}
      />
      <div className={styles.body}>
        <CharacterPanel
          characters={p.project.characters}
          onAdd={p.addCharacter}
          onDelete={p.deleteCharacter}
        />
        <ScriptEditor
          characters={p.project.characters}
          lines={p.project.lines}
          onAddLine={p.addLineAtEnd}
          onCharacterChange={p.updateLineCharacter}
          onTextChange={p.updateLineText}
          onMoveUp={onMoveUp}
          onMoveDown={onMoveDown}
          onAddAfter={p.addLineAfter}
          onDelete={p.deleteLine}
          onCopy={copyLine}
        />
      </div>
    </div>
  );
}
