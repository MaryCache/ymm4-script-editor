import { useCallback, useState } from "react";
import { useProject } from "./hooks/useProject";
import { Header } from "./components/Header/Header";
import { CharacterPanel } from "./components/CharacterPanel/CharacterPanel";
import { ScriptEditor } from "./components/ScriptEditor/ScriptEditor";
import { BgCanvas } from "./components/BgCanvas/BgCanvas";
import { OpeningOverlay } from "./components/OpeningOverlay/OpeningOverlay";
import { PasteImportModal } from "./components/PasteImportModal";
import { ConfirmDialog } from "./components/ConfirmDialog";
import { buildLineCSV } from "./utils/csv";
import type { Line } from "./types";
import styles from "./App.module.css";

// marquee-scroll (linear-app / bg-decoration-family) のテキスト。
// 繰り返しパターンを一定幅に設定し、シームレスループを作る。
// アスキー記号 ▸ はモノスペースフォントで等幅に近いため採用。
const MARQUEE_TEXT = "YMM4 ▸ SCRIPT ▸ EDITOR ▸ YMM4台本エディタ ▸ ";

/**
 * アプリケーションのルートコンポーネント。
 *
 * @remarks
 * `useProject` フックでプロジェクト状態を管理し、
 * `Header` / `CharacterPanel` / `ScriptEditor` へ各操作ハンドラーを配布する。
 *
 * レイアウト:
 * - CSS Grid（`.app`）で `Header` / `CharacterPanel` / `ScriptEditor` を配置する。
 * - 背景装飾レイヤー（`BgCanvas` + marquee + slow-rot リング）は `z-index: 0` で UI より背面に置く。
 * - `OpeningOverlay` は起動時のみ全画面に重なり、フェードアウト後に DOM から消える。
 *
 * ハンドラー安定化:
 * - `copyLine` は `project.characters` が変化したときのみ再生成（テキスト編集では不変）。
 * - `onMoveUp` / `onMoveDown` は `moveLine` を `useCallback` で包んで引数変換する。
 * - `importMarkdown` / `loadYmscript` は読み込み失敗を `alert` で通知する。
 * - `onCopyAll` はクリップボードエラーを `alert` で通知する（要件 design §8, I-1）。
 */
export default function App() {
  const {
    project,
    setProjectName,
    addCharacter,
    deleteCharacter,
    renameCharacter,
    setCharacterColor,
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
    importPlainText,
    clearAllLines,
  } = useProject();

  // ===== モーダル開閉状態 =====
  const [pasteImportOpen, setPasteImportOpen] = useState(false);
  const [resetConfirmOpen, setResetConfirmOpen] = useState(false);

  // ===== 全行リセット退場アニメーション (§4.7) =====
  // isResetting: true の間 ScriptEditor の .lines に fadeout クラスを付与。
  // prefers-reduced-motion: reduce では 即時クリア（タイマー不要）。
  const [isResetting, setIsResetting] = useState(false);

  const handleOpenPasteImport = useCallback(() => setPasteImportOpen(true), []);
  const handleClosePasteImport = useCallback(() => setPasteImportOpen(false), []);

  const handleOpenResetAll = useCallback(() => setResetConfirmOpen(true), []);
  const handleCloseResetAll = useCallback(() => setResetConfirmOpen(false), []);

  // コピペインポート実行: n行追加を alert で通知（n=0 は何もしない）
  const handleImportPlainText = useCallback(
    (text: string) => {
      const n = importPlainText(text);
      if (n > 0) alert(`${n} 行を取り込みました。`);
    },
    [importPlainText],
  );

  // 全行リセット確定: prefers-reduced-motion に応じて即時 or フェードアウト後にクリア
  const handleConfirmReset = useCallback(() => {
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduced) {
      clearAllLines();
      return;
    }
    // フェードアウト (~220ms) してから clearAllLines
    setIsResetting(true);
    window.setTimeout(() => {
      clearAllLines();
      setIsResetting(false);
    }, 230);
  }, [clearAllLines]);

  // copyLine は characters が変わった時のみ再生成。テキスト編集では characters 参照は不変なので、
  // 毎打鍵で LineRow が再描画されることはない（NF-10 維持）。
  // charsRef.current = ... をレンダー中に書く旧実装は react-hooks/refs 違反のため廃止（C-1）。
  const copyLine = useCallback(
    (line: Line) => {
      navigator.clipboard.writeText(buildLineCSV(line, project.characters)).catch((e) => {
        console.error("コピーに失敗しました", e);
        alert("コピーに失敗しました。");
      });
    },
    [project.characters],
  );

  // moveLine のラッパ: moveLine は安定参照だが引数変換が必要なため useCallback で包む
  const onMoveUp = useCallback((id: string) => moveLine(id, "up"), [moveLine]);
  const onMoveDown = useCallback((id: string) => moveLine(id, "down"), [moveLine]);

  // importMarkdown: skipped>0 でユーザー通知、失敗は alert（useProject 側が throw する）
  const importMarkdown = useCallback(
    (file: File) => {
      importMd(file)
        .then((skipped) => {
          if (skipped > 0) alert(`${skipped} 行を読み込めずスキップしました。`);
        })
        .catch(() => alert("Markdown の読み込みに失敗しました。"));
    },
    [importMd],
  );

  // loadYmscript: 失敗は alert（useProject 内で throw された場合のみ）
  const loadYmscript = useCallback(
    (file: File) => {
      loadFromFile(file).catch(() => alert("プロジェクトファイルの読み込みに失敗しました。"));
    },
    [loadFromFile],
  );

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
         *     slow-rot リング (bgAmbient::before/::after) — 切れ目つきの回転弧
         *     BgCanvas  — canvas-gyro 代替 (vanilla canvas, 依存ゼロ)
         *     marqueeTrack — marquee-scroll (linear-app)
         *   ※ 旧コーナーのブロブ (bgBlob1/2) はユーザー要望で削除した。
         * ===== */}
        <div className={styles.bgAmbient} aria-hidden="true">
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
              {/* repeat(8): MARQUEE_TEXT ≒ 40文字×11px≒440px。8回≒3520px で 4K(3840px)をカバーする最低反復数 */}
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
          onOpenPasteImport={handleOpenPasteImport}
          onOpenResetAll={handleOpenResetAll}
          canResetAll={project.lines.length > 0}
        />
        <CharacterPanel
          characters={project.characters}
          onAdd={addCharacter}
          onDelete={deleteCharacter}
          onRename={renameCharacter}
          onColorChange={setCharacterColor}
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
          isResetting={isResetting}
        />
      </div>

      {/* ===== コピペインポートモーダル ===== */}
      <PasteImportModal open={pasteImportOpen} onClose={handleClosePasteImport} onImport={handleImportPlainText} />

      {/* ===== 全行リセット確認ダイアログ ===== */}
      <ConfirmDialog
        open={resetConfirmOpen}
        title="全行をリセットしますか？"
        message="すべてのセリフ行が削除されます。この操作は元に戻せません。"
        confirmLabel="リセット"
        cancelLabel="キャンセル"
        danger
        onConfirm={handleConfirmReset}
        onClose={handleCloseResetAll}
      />
    </>
  );
}
