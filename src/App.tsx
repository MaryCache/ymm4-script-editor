import { useCallback } from "react";
import { useProject } from "./hooks/useProject";
import { Header } from "./components/Header/Header";
import { CharacterPanel } from "./components/CharacterPanel/CharacterPanel";
import { ScriptEditor } from "./components/ScriptEditor/ScriptEditor";
import { BgCanvas } from "./components/BgCanvas/BgCanvas";
import { OpeningOverlay } from "./components/OpeningOverlay/OpeningOverlay";
import { buildLineCSV } from "./utils/csv";
import type { Line } from "./types";
import styles from "./App.module.css";

// marquee-scroll (linear-app / bg-decoration-family) のテキスト。
// 繰り返しパターンを一定幅に設定し、シームレスループを作る。
// アスキー記号 ▸ はモノスペースフォントで等幅に近いため採用。
const MARQUEE_TEXT = "YMM4 ▸ SCRIPT ▸ EDITOR ▸ YMM4台本エディタ ▸ ";

export default function App() {
  const {
    project,
    setProjectName,
    addCharacter,
    deleteCharacter,
    addLineAtEnd,
    addLineAfter,
    deleteLine,
    updateLineCharacter,
    updateLineText,
    moveLine,
    saveToFile,
    loadFromFile,
    exportCSV,
    exportMarkdown,
    importMarkdown: importMd,
    exportCSVToClipboard,
  } = useProject();

  // copyLine は characters が変わった時のみ再生成。テキスト編集では characters 参照は不変なので、
  // 毎打鍵で LineRow が再描画されることはない（NF-10 維持）。
  // charsRef.current = ... をレンダー中に書く旧実装は react-hooks/refs 違反のため廃止（C-1）。
  const copyLine = useCallback((line: Line) => {
    navigator.clipboard
      .writeText(buildLineCSV(line, project.characters))
      .catch((e) => {
        console.error("コピーに失敗しました", e);
        alert("コピーに失敗しました。");
      });
  }, [project.characters]);

  // moveLine のラッパ: moveLine は安定参照だが引数変換が必要なため useCallback で包む
  const onMoveUp = useCallback((id: string) => moveLine(id, "up"), [moveLine]);
  const onMoveDown = useCallback((id: string) => moveLine(id, "down"), [moveLine]);

  // importMarkdown: skipped>0 でユーザー通知、失敗は alert（useProject 側が throw する）
  const importMarkdown = useCallback((file: File) => {
    importMd(file)
      .then((skipped) => { if (skipped > 0) alert(`${skipped} 行を読み込めずスキップしました。`); })
      .catch(() => alert("Markdown の読み込みに失敗しました。"));
  }, [importMd]);

  // loadYmscript: 失敗は alert（useProject 内で throw された場合のみ）
  const loadYmscript = useCallback((file: File) => {
    loadFromFile(file).catch(() => alert("プロジェクトファイルの読み込みに失敗しました。"));
  }, [loadFromFile]);

  // 全件コピー失敗はユーザーに通知する（design §8, I-1）
  const onCopyAll = useCallback(() => {
    exportCSVToClipboard().catch(() => alert("クリップボードへのコピーに失敗しました。"));
  }, [exportCSVToClipboard]);

  // App shell は CSS Grid (.app)。Header / CharacterPanel / ScriptEditor が
  // それぞれ grid-area を自己申告するため、中間の wrapper div は不要になった。
  return (
    <>
      {/* ===== Opening overlay (opening-sequence / cygames + loading-family)
       *   コンテンツ (.app) より上に重ねるだけ。DOM は最初から存在し描画遅延なし。
       *   aria-hidden + pointer-events:none。reduced-motion / 2回目以降は null を返す。
       * ===== */}
      <OpeningOverlay />

      <div className={styles.app}>
        {/* ===== Ambient background layer (bg-decoration-family)
         *   aria-hidden: 純粋な装飾レイヤー。pointer-events: none (CSS)。
         *   z-index: 0 で UI より背面。
         *   内包:
         *     bgBlob1/2 — glass-fade 強化ブロブ (blur + mask-image)
         *     BgCanvas  — canvas-gyro 代替 (vanilla canvas, 依存ゼロ)
         *     marqueeTrack — marquee-scroll (linear-app)
         * ===== */}
        <div className={styles.bgAmbient} aria-hidden="true">
          {/* glass-fade 強化ブロブ: filter:blur + mask-image で柔らかい発光 */}
          <span className={styles.bgBlob1} />
          <span className={styles.bgBlob2} />

          {/* canvas-gyro 代替: vanilla canvas で粒子視差を描画。
           *  reduced-motion / document.hidden 時は rAF 停止。
           *  unmount で全リスナ解除。 */}
          <BgCanvas />

          {/* marquee-scroll (linear-app / bg-decoration-family)
           *  巨大で極薄の cyan モノスペース文字帯を横方向に無限スクロール。
           *  2本の .marqueeText を並べてシームレスループ。CSS のみ (JS 不要)。
           *  opacity は .marqueeInner で制御 (0.028)。aria-hidden は親 bgAmbient が担う。
           */}
          <div className={styles.marqueeTrack}>
            <div className={styles.marqueeInner}>
              {/* 2本並べることでシームレスループ: translateX(-50%) で左半分分移動 */}
              <span className={styles.marqueeText}>{MARQUEE_TEXT.repeat(8)}</span>
              <span className={styles.marqueeText}>{MARQUEE_TEXT.repeat(8)}</span>
            </div>
          </div>
        </div>

        <Header
          projectName={project.projectName}
          onProjectNameChange={setProjectName}
          onSaveYmscript={saveToFile}
          onSaveMarkdown={exportMarkdown}
          onExportCSV={exportCSV}
          onLoadYmscript={loadYmscript}
          onLoadMarkdown={importMarkdown}
          onCopyAll={onCopyAll}
        />
        <CharacterPanel
          characters={project.characters}
          onAdd={addCharacter}
          onDelete={deleteCharacter}
        />
        <ScriptEditor
          characters={project.characters}
          lines={project.lines}
          onAddLine={addLineAtEnd}
          onCharacterChange={updateLineCharacter}
          onTextChange={updateLineText}
          onMoveUp={onMoveUp}
          onMoveDown={onMoveDown}
          onAddAfter={addLineAfter}
          onDelete={deleteLine}
          onCopy={copyLine}
        />
      </div>
    </>
  );
}
