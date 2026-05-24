// src/components/PasteImportModal/PasteImportModal.tsx
import { useRef, useCallback, useId } from "react";
import { Modal } from "../Modal";
import styles from "./PasteImportModal.module.css";

/**
 * `PasteImportModal` コンポーネントの props 型。
 *
 * @see {@link PasteImportModal}
 */
export type PasteImportModalProps = {
  /** モーダルの表示状態。 */
  open: boolean;
  /** 閉じ要求のコールバック（Esc / キャンセル / オーバーレイクリック）。 */
  onClose: () => void;
  /**
   * 取り込みボタン押下のコールバック。空文字・空白のみの場合は呼ばれない。
   *
   * @remarks
   * 取り込み完了後の行数トースト通知は呼び出し元（App）の責務。
   *
   * @param text - textarea に入力されたテキスト
   */
  onImport: (text: string) => void;
};

/**
 * プレーンテキストをコピペでインポートするモーダルコンポーネント。
 *
 * @remarks
 * `Modal` 基盤を使用する（挙動は {@link Modal} 参照）。
 * textarea に `initialFocus` を向けてオートフォーカスする。
 * 「取り込み」押下時: テキストが空または空白のみなら何もせず閉じる。
 * それ以外は `onImport(text)` を呼んでから閉じる。
 * open=false で Modal が内側 DOM ごと unmount するため、textarea の手動リセットは不要。
 *
 * @param props - {@link PasteImportModalProps}
 */
export function PasteImportModal({ open, onClose, onImport }: PasteImportModalProps) {
  // useId: 同一ページに複数のモーダルが並存してもアクセシビリティ id が衝突しないよう
  // React が生成するコンポーネント固有の id を使用する。
  const uid = useId();
  const titleId = `paste-import-title-${uid}`;
  const descId = `paste-import-desc-${uid}`;

  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const handleImport = useCallback(() => {
    const text = textareaRef.current?.value ?? "";
    if (text.trim().length === 0) {
      onClose();
      return;
    }
    onImport(text);
    onClose();
  }, [onImport, onClose]);

  const handleClose = useCallback(() => {
    onClose();
  }, [onClose]);

  return (
    <Modal open={open} onClose={handleClose} role="dialog" titleId={titleId} descId={descId} initialFocus={textareaRef}>
      <div className={styles.inner}>
        <h2 id={titleId} className={styles.title}>
          テキストをコピペでインポート
        </h2>
        <p id={descId} className={styles.desc}>
          改行ごとに1行・すべて先頭キャラクターに割り当てて末尾に追加します
        </p>
        <textarea ref={textareaRef} className={styles.textarea} aria-label="インポートするテキスト" rows={10} />
        <div className={styles.actions}>
          <button className={styles.btnCancel} onClick={handleClose}>
            キャンセル
          </button>
          <button className={styles.btnImport} onClick={handleImport}>
            取り込み
          </button>
        </div>
      </div>
    </Modal>
  );
}
