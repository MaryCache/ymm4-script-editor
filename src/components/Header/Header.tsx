// src/components/Header/Header.tsx
import { useRef, type RefObject, type ChangeEvent, type MouseEvent } from "react";
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
function runAndCloseMenu(action: () => void) {
  return (e: MouseEvent<HTMLButtonElement>) => {
    action();
    e.currentTarget.closest("details")?.removeAttribute("open");
  };
}

export function Header(props: HeaderProps) {
  const ymscriptInput = useRef<HTMLInputElement>(null);
  const markdownInput = useRef<HTMLInputElement>(null);

  // hidden file input をプログラムから開く → ファイル選択後に handler を呼ぶ。
  const pick = (
    ref: RefObject<HTMLInputElement | null>,
    handler: (file: File) => void
  ) => (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handler(file);
    // 同じファイルを連続選択できるよう value をリセットする（change イベントが再発火するため）。
    if (ref.current) ref.current.value = "";
  };

  return (
    <header className={styles.header}>
      <input
        className={styles.projectName}
        value={props.projectName}
        onChange={(e: ChangeEvent<HTMLInputElement>) => props.onProjectNameChange(e.target.value)}
        aria-label="プロジェクト名"
      />
      <div className={styles.spacer} />
      <button onClick={props.onCopyAll}>全件コピー</button>

      <details className={styles.menu}>
        <summary>保存▼</summary>
        <div className={styles.menuItems}>
          <button onClick={runAndCloseMenu(props.onSaveYmscript)}>.ymscript として保存</button>
          <button onClick={runAndCloseMenu(props.onSaveMarkdown)}>.md として保存</button>
          <button onClick={runAndCloseMenu(props.onExportCSV)}>CSV を書き出す</button>
        </div>
      </details>

      <details className={styles.menu}>
        <summary>読込▼</summary>
        <div className={styles.menuItems}>
          <button onClick={runAndCloseMenu(() => ymscriptInput.current?.click())}>.ymscript を読み込む</button>
          <button onClick={runAndCloseMenu(() => markdownInput.current?.click())}>.md を読み込む</button>
        </div>
      </details>

      {/* aria-label でテストから取得可能にする（a11y 改善も兼ねる）。 */}
      <input
        ref={ymscriptInput}
        type="file"
        accept=".ymscript,application/json"
        hidden
        aria-label=".ymscript ファイル"
        onChange={pick(ymscriptInput, props.onLoadYmscript)}
      />
      <input
        ref={markdownInput}
        type="file"
        accept=".md,text/markdown"
        hidden
        aria-label=".md ファイル"
        onChange={pick(markdownInput, props.onLoadMarkdown)}
      />
    </header>
  );
}
