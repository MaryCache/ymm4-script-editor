// src/components/Header/Header.tsx
import { useRef, type RefObject, type ChangeEvent } from "react";
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

export function Header(props: HeaderProps) {
  const ymscriptInput = useRef<HTMLInputElement>(null);
  const markdownInput = useRef<HTMLInputElement>(null);

  // hidden file input をプログラムから開く → ファイル選択後に handler を呼ぶ。
  // 同じファイルを連続選択できるよう ref.current.value をリセットする。
  const pick = (
    ref: RefObject<HTMLInputElement | null>,
    handler: (file: File) => void
  ) => (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handler(file);
    if (ref.current) ref.current.value = ""; // 同じファイルを連続選択できるよう reset
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
          <button onClick={props.onSaveYmscript}>.ymscript として保存</button>
          <button onClick={props.onSaveMarkdown}>.md として保存</button>
          <button onClick={props.onExportCSV}>CSV を書き出す</button>
        </div>
      </details>

      <details className={styles.menu}>
        <summary>読込▼</summary>
        <div className={styles.menuItems}>
          <button onClick={() => ymscriptInput.current?.click()}>.ymscript を読み込む</button>
          <button onClick={() => markdownInput.current?.click()}>.md を読み込む</button>
        </div>
      </details>

      <input ref={ymscriptInput} type="file" accept=".ymscript,application/json" hidden onChange={pick(ymscriptInput, props.onLoadYmscript)} />
      <input ref={markdownInput} type="file" accept=".md,text/markdown" hidden onChange={pick(markdownInput, props.onLoadMarkdown)} />
    </header>
  );
}
