// src/components/Toast/Toast.tsx
import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import styles from "./Toast.module.css";

// 各トーストエントリの型。App の state に格納される。
/**
 * 単一のトースト通知エントリ。
 *
 * @remarks
 * `variant` により自動消滅時間と aria ロールが切り替わる:
 * - `"info"` → `role="status"` / `aria-live="polite"` / ~3.5s
 * - `"error"` → `role="alert"` / `aria-live="assertive"` / ~5s
 *
 * @see {@link ToastViewport}
 */
export type ToastEntry = {
  /** React key / 削除キーとして使う一意 ID。 */
  id: string;
  /** 表示するメッセージ文字列。 */
  message: string;
  /** 通知の種類。 */
  variant: "info" | "error";
};

/**
 * `ToastViewport` コンポーネントの props 型。
 *
 * @see {@link ToastViewport}
 */
export type ToastViewportProps = {
  /** 現在表示中のトースト一覧。 */
  toasts: ToastEntry[];
  /**
   * 手動 / 自動消滅時に呼ばれるコールバック。
   *
   * @param id - 削除対象のトースト ID
   */
  onDismiss: (id: string) => void;
};

// 自動消滅時間 (ms)
const AUTO_DISMISS_INFO = 3500;
const AUTO_DISMISS_ERROR = 5000;

/**
 * 単一トーストアイテムコンポーネント。
 *
 * @remarks
 * - 入場アニメーション（スライド＋フェード）と退場アニメーション（フェードアウト）を持つ。
 * - `prefers-reduced-motion: reduce` ではアニメーションを無効化する（CSS で制御）。
 * - マウント後に自動消滅タイマーを開始し、unmount 時にクリアする。
 * - × ボタンで即時 dismiss。
 *
 * @param props - id / message / variant / onDismiss
 */
function ToastItem({ id, message, variant, onDismiss }: ToastEntry & { onDismiss: (id: string) => void }) {
  const delay = variant === "error" ? AUTO_DISMISS_ERROR : AUTO_DISMISS_INFO;
  const timerRef = useRef<ReturnType<typeof window.setTimeout> | null>(null);

  useEffect(() => {
    timerRef.current = window.setTimeout(() => {
      timerRef.current = null;
      onDismiss(id);
    }, delay);

    return () => {
      if (timerRef.current !== null) {
        window.clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [id, delay, onDismiss]);

  const itemClass = variant === "error" ? `${styles.item} ${styles.itemError}` : `${styles.item} ${styles.itemInfo}`;

  return (
    <div className={itemClass} role={variant === "error" ? "alert" : "status"}>
      {/* アクセントアイコン: info=cyan ●、error=danger ● */}
      <span className={styles.icon} aria-hidden="true">
        {variant === "error" ? "✕" : "●"}
      </span>
      <span className={styles.message}>{message}</span>
      <button type="button" className={styles.closeBtn} aria-label="通知を閉じる" onClick={() => onDismiss(id)}>
        ✕
      </button>
    </div>
  );
}

/**
 * トースト通知のビューポートコンポーネント。
 *
 * @remarks
 * - `createPortal` で `document.body` 直下に描画する。
 *   overflow / スタッキングコンテキストの問題を回避するため。
 * - z-index は 9000（Modal=1000、OpeningOverlay=9999 の間）。
 * - `info` コンテナ: `role="status"` / `aria-live="polite"`。
 *   `error` コンテナ: `role="alert"` / `aria-live="assertive"`。
 *   スクリーンリーダーが variant に応じた優先度で読み上げる。
 * - トーストが 0 件のときは何も描画しない。
 *
 * @param props - {@link ToastViewportProps}
 *
 * @example
 * ```tsx
 * <ToastViewport toasts={toasts} onDismiss={(id) => removeToast(id)} />
 * ```
 */
export function ToastViewport({ toasts, onDismiss }: ToastViewportProps) {
  if (toasts.length === 0) return null;

  const infoToasts = toasts.filter((t) => t.variant === "info");
  const errorToasts = toasts.filter((t) => t.variant === "error");

  return createPortal(
    <div className={styles.viewport} aria-label="通知">
      {/* info トーストのライブリージョン（polite: 割り込みしない） */}
      {infoToasts.length > 0 && (
        <div role="status" aria-live="polite" aria-atomic="false" className={styles.liveRegion}>
          {infoToasts.map((t) => (
            <ToastItem key={t.id} {...t} onDismiss={onDismiss} />
          ))}
        </div>
      )}
      {/* error トーストのライブリージョン（assertive: 即時割り込み） */}
      {errorToasts.length > 0 && (
        <div role="alert" aria-live="assertive" aria-atomic="false" className={styles.liveRegion}>
          {errorToasts.map((t) => (
            <ToastItem key={t.id} {...t} onDismiss={onDismiss} />
          ))}
        </div>
      )}
    </div>,
    document.body,
  );
}
