// src/components/ConfirmDialog/ConfirmDialog.tsx
import { useRef, useCallback } from "react";
import { Modal } from "../Modal";
import styles from "./ConfirmDialog.module.css";

/**
 * `ConfirmDialog` コンポーネントの props 型。
 *
 * @see {@link ConfirmDialog}
 */
export type ConfirmDialogProps = {
  /** モーダルの表示状態。 */
  open: boolean;
  /** ダイアログのタイトルテキスト。 */
  title: string;
  /** ダイアログの本文テキスト。 */
  message: string;
  /** 確認ボタンのラベル。 */
  confirmLabel: string;
  /** キャンセルボタンのラベル。 */
  cancelLabel: string;
  /**
   * 確認ボタン押下のコールバック。
   *
   * @remarks
   * 実行後にモーダルを閉じる。
   */
  onConfirm: () => void;
  /** 閉じ要求のコールバック（Esc / キャンセル / オーバーレイクリック）。 */
  onClose: () => void;
  /**
   * 破壊操作フラグ。`true` のとき確認ボタンを `--danger` 配色にする。
   *
   * @defaultValue `false`
   */
  danger?: boolean;
};

const TITLE_ID = "confirm-dialog-title";
const DESC_ID = "confirm-dialog-desc";

/**
 * 汎用確認ダイアログコンポーネント。
 *
 * @remarks
 * - `Modal` 基盤を使用する（role="alertdialog"、backdrop-fade + modal-rise-in アニメーション、
 *   フォーカストラップ、Esc 閉じ、オーバーレイクリック閉じ、フォーカス復帰）。
 * - 破壊操作の誤操作防止のため、**既定フォーカスはキャンセルボタン**（`initialFocus`）。
 * - `danger=true` のとき確認ボタンを danger 配色にする。
 * - 確認で `onConfirm()` を呼んでから閉じる。Esc / キャンセル / オーバーレイで `onClose()`。
 *
 * @param props - {@link ConfirmDialogProps}
 */
export function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel,
  cancelLabel,
  onConfirm,
  onClose,
  danger = false,
}: ConfirmDialogProps) {
  const cancelRef = useRef<HTMLButtonElement>(null);

  const handleConfirm = useCallback(() => {
    onConfirm();
    onClose();
  }, [onConfirm, onClose]);

  return (
    <Modal
      open={open}
      onClose={onClose}
      role="alertdialog"
      titleId={TITLE_ID}
      descId={DESC_ID}
      initialFocus={cancelRef}
    >
      <div className={styles.inner}>
        <h2 id={TITLE_ID} className={styles.title}>
          {title}
        </h2>
        <p id={DESC_ID} className={styles.message}>
          {message}
        </p>
        <div className={styles.actions}>
          <button ref={cancelRef} className={styles.btnCancel} onClick={onClose}>
            {cancelLabel}
          </button>
          <button className={`${styles.btnConfirm} ${danger ? styles.btnDanger : ""}`} onClick={handleConfirm}>
            {confirmLabel}
          </button>
        </div>
      </div>
    </Modal>
  );
}
