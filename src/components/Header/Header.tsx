// src/components/Header/Header.tsx
import { useRef, useCallback, type ChangeEvent, type MouseEvent } from "react";
import styles from "./Header.module.css";

export type HeaderProps = {
  projectName: string;
  onProjectNameChange: (name: string) => void;
  onSaveYmscript: () => void;
  onSaveMarkdown: () => void;
  onExportCSV: () => void;
  onLoadYmscript: (file: File) => void;
  onLoadMarkdown: (file: File) => void;
  onCopyAll: () => void;
};

// メニュー操作後に親の <details> を閉じる。
// <details> はキーボード操作可能な disclosure として使っているが、
// ボタンを押した後もメニューが開いたままになるのを防ぐためクローズする。
// runAndCloseMenu は props 由来の安定関数のみを受け取る（ref を捕捉した関数は渡さない）ため、
// レンダー中に ref を読む心配がなく react-hooks/refs に抵触しない。
function runAndCloseMenu(action: () => void) {
  return (e: MouseEvent<HTMLButtonElement>) => {
    action();
    e.currentTarget.closest("details")?.removeAttribute("open");
  };
}

export function Header(props: HeaderProps) {
  // props オブジェクト全体は毎レンダーで新しい参照になるため、
  // useCallback の依存に個別の関数を書けるよう分割代入する（exhaustive-deps 対策）。
  const {
    onProjectNameChange,
    onSaveYmscript,
    onSaveMarkdown,
    onExportCSV,
    onLoadYmscript,
    onLoadMarkdown,
    onCopyAll,
    projectName,
  } = props;

  const ymscriptInputRef = useRef<HTMLInputElement>(null);
  const markdownInputRef = useRef<HTMLInputElement>(null);

  // hidden file input をプログラムから開くのは標準的なパターン。
  // イベントハンドラ内の ref アクセスで安全（レンダー中に .current を読むわけではない）。
  // openYmscriptPicker / openMarkdownPicker はメニューも閉じるため runAndCloseMenu を内包する。
  const openYmscriptPicker = useCallback((e: MouseEvent<HTMLButtonElement>) => {
    ymscriptInputRef.current?.click();
    e.currentTarget.closest("details")?.removeAttribute("open");
  }, []);

  const openMarkdownPicker = useCallback((e: MouseEvent<HTMLButtonElement>) => {
    markdownInputRef.current?.click();
    e.currentTarget.closest("details")?.removeAttribute("open");
  }, []);

  // onChange ハンドラ: ファイルを handler に渡し、同じファイルの連続選択を可能にするため
  // value をリセットする。ref.current へのアクセスは change イベント発火時（レンダー外）で安全。
  const onChangeYmscript = useCallback((e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) onLoadYmscript(file);
    // 同じファイルを連続選択できるよう value をリセットする（change イベントが再発火するため）。
    if (ymscriptInputRef.current) ymscriptInputRef.current.value = "";
  }, [onLoadYmscript]);

  const onChangeMarkdown = useCallback((e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) onLoadMarkdown(file);
    // 同じファイルを連続選択できるよう value をリセットする（change イベントが再発火するため）。
    if (markdownInputRef.current) markdownInputRef.current.value = "";
  }, [onLoadMarkdown]);

  return (
    <header className={styles.header}>
      {/* ===== Left: brand mark + project name ===== */}
      <div className={styles.brand}>
        {/* aria-hidden: 純粋な装飾ロゴ。スクリーンリーダーに読ませない。 */}
        <div className={styles.brandMark} aria-hidden="true">Y4</div>
        <div className={styles.brandSep} aria-hidden="true" />
        <input
          className={styles.projectName}
          value={projectName}
          onChange={(e: ChangeEvent<HTMLInputElement>) => onProjectNameChange(e.target.value)}
          aria-label="プロジェクト名"
        />
      </div>

      <div className={styles.spacer} />

      {/* ===== Right: action buttons ===== */}
      <div className={styles.headerActions}>
        {/* 全件コピー: primary variant で最重要 CTA として強調 */}
        <button className={styles.btnPrimary} onClick={onCopyAll}>全件コピー</button>

        <div className={styles.vSep} aria-hidden="true" />

        {/* 保存メニュー */}
        <details className={styles.menu}>
          <summary>保存▼</summary>
          <div className={styles.menuItems}>
            <button onClick={runAndCloseMenu(onSaveYmscript)}>.ymscript として保存</button>
            <button onClick={runAndCloseMenu(onSaveMarkdown)}>.md として保存</button>
            <button onClick={runAndCloseMenu(onExportCSV)}>CSV を書き出す</button>
          </div>
        </details>

        {/* 読込メニュー */}
        <details className={styles.menu}>
          <summary>読込▼</summary>
          <div className={styles.menuItems}>
            <button onClick={openYmscriptPicker}>.ymscript を読み込む</button>
            <button onClick={openMarkdownPicker}>.md を読み込む</button>
          </div>
        </details>
      </div>

      {/* aria-label でテストから取得可能にする（a11y 改善も兼ねる）。 */}
      <input
        ref={ymscriptInputRef}
        type="file"
        accept=".ymscript,application/json"
        hidden
        aria-label=".ymscript ファイル"
        onChange={onChangeYmscript}
      />
      <input
        ref={markdownInputRef}
        type="file"
        accept=".md,text/markdown"
        hidden
        aria-label=".md ファイル"
        onChange={onChangeMarkdown}
      />
    </header>
  );
}
