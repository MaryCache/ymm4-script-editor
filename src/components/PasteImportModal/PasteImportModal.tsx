// src/components/PasteImportModal/PasteImportModal.tsx
import { useRef, useCallback } from "react";
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
   * @param text - textarea に入力されたテキスト
   */
  onImport: (text: string) => void;
};

const TITLE_ID = "paste-import-title";
const DESC_ID = "paste-import-desc";

/**
 * プレーンテキストをコピペでインポートするモーダルコンポーネント。
 *
 * @remarks
 * - `Modal` 基盤を使用する（role="dialog"、backdrop-fade + modal-rise-in アニメーション、
 *   フォーカストラップ、Esc 閉じ、オーバーレイクリック閉じ、フォーカス復帰）。
 * - textarea に `initialFocus` を向けてオートフォーカスする。
 * - 「取り込み」押下時: テキストが空または空白のみなら何もせず閉じる。
 *   それ以外は `onImport(text)` を呼んでから閉じる。
 * - モーダルを閉じると textarea の内容をリセットする。
 *
 * @param props - {@link PasteImportModalProps}
 */
export function PasteImportModal({ open, onClose, onImport }: PasteImportModalProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const handleImport = useCallback(() => {
    const text = textareaRef.current?.value ?? "";
    if (text.trim().length === 0) {
      onClose();
      return;
    }
    onImport(text);
    // textarea をリセット（次回開いた時に前の内容が残らないようにする）
    if (textareaRef.current) textareaRef.current.value = "";
    onClose();
  }, [onImport, onClose]);

  const handleClose = useCallback(() => {
    // キャンセル時も textarea をリセット
    if (textareaRef.current) textareaRef.current.value = "";
    onClose();
  }, [onClose]);

  return (
    <Modal
      open={open}
      onClose={handleClose}
      role="dialog"
      titleId={TITLE_ID}
      descId={DESC_ID}
      initialFocus={textareaRef}
    >
      <div className={styles.inner}>
        <h2 id={TITLE_ID} className={styles.title}>
          テキストをコピペでインポート
        </h2>
        <p id={DESC_ID} className={styles.desc}>
          改行ごとに1行・すべて先頭キャラクターに割り当てて末尾に追加します
        </p>
        {/* 非制御テキストエリア: ref で値を読むため onChange は不要 */}
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
