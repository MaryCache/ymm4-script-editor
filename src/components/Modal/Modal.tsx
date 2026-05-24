// src/components/Modal/Modal.tsx
import { useEffect, useRef, type RefObject } from "react";
import { createPortal } from "react-dom";
import styles from "./Modal.module.css";

/**
 * `Modal` コンポーネントの props 型。
 *
 * @see {@link Modal}
 */
export type ModalProps = {
  /** モーダルの表示状態。`false` の場合は何も描画しない。 */
  open: boolean;
  /** オーバーレイクリック・Esc キーによる閉じ要求のコールバック。 */
  onClose: () => void;
  /**
   * `aria-labelledby` に渡す ID。
   * タイトル要素の `id` と対応させてスクリーンリーダーに名前を伝える。
   */
  titleId?: string;
  /**
   * `aria-describedby` に渡す ID。
   * 説明文要素の `id` と対応させてスクリーンリーダーに詳細を伝える。
   */
  descId?: string;
  /**
   * ダイアログの WAI-ARIA ロール。
   * 通常は `"dialog"`、破壊操作の確認など緊急性の高い場合は `"alertdialog"` を使う。
   */
  role?: "dialog" | "alertdialog";
  /**
   * パネルが開いたときの初期フォーカス先。
   * - `"first"`: パネル内の最初のフォーカス可能要素（デフォルト）
   * - `RefObject<HTMLElement>`: 指定した要素へフォーカス
   */
  initialFocus?: "first" | RefObject<HTMLElement | null>;
  /** パネル内に描画するコンテンツ。 */
  children: React.ReactNode;
};

// フォーカス可能要素のセレクタ（フォーカストラップで使用）。
// tabbable な要素を一般的な CSS セレクタで列挙する。
const FOCUSABLE_SELECTOR = [
  "a[href]",
  "button:not([disabled])",
  "input:not([disabled])",
  "select:not([disabled])",
  "textarea:not([disabled])",
  "[tabindex]:not([tabindex='-1'])",
].join(", ");

/**
 * 再利用可能な汎用モーダル基盤コンポーネント。
 *
 * @remarks
 * - `createPortal` で `document.body` 直下に描画し、スタッキングコンテキストの問題を回避する。
 * - `open=false` の場合は何も描画しない（DOM に残さない）。
 * - Esc キー / オーバーレイクリックで `onClose` を呼ぶ。
 * - フォーカストラップ: Tab / Shift+Tab がパネル内を循環する。
 * - 開いたとき `initialFocus` が指す要素（またはパネル内の最初のフォーカス可能要素）へフォーカスを移す。
 * - 閉じたとき、モーダルを開く前にフォーカスしていた要素へフォーカスを復帰させる。
 * - アニメーション: オーバーレイ `backdrop-fade`（opacity, ~180ms） + パネル `modal-rise-in`
 *   （translateY 8px→0 + opacity + scale 0.98→1, ~0.28s）。
 *   `prefers-reduced-motion: reduce` では即時 / opacity のみに簡素化。
 *
 * @param props - {@link ModalProps}
 *
 * @example
 * ```tsx
 * <Modal open={isOpen} onClose={() => setOpen(false)} titleId="dialog-title">
 *   <h2 id="dialog-title">タイトル</h2>
 *   <button onClick={() => setOpen(false)}>閉じる</button>
 * </Modal>
 * ```
 */
export function Modal({
  open,
  onClose,
  titleId,
  descId,
  role = "dialog",
  initialFocus = "first",
  children,
}: ModalProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  // モーダルを開く前のフォーカス先を記憶して閉じ後に復帰させる。
  const previousFocusRef = useRef<Element | null>(null);

  // open になったときにフォーカス先を記録し、パネル内へフォーカスを移す。
  useEffect(() => {
    if (!open) return;

    // フォーカス復帰先を記録（open 直前の activeElement）。
    previousFocusRef.current = document.activeElement;

    // 次の tick で DOM が確定してからフォーカスを移す。
    const id = window.setTimeout(() => {
      if (initialFocus === "first") {
        const focusable = panelRef.current?.querySelector<HTMLElement>(FOCUSABLE_SELECTOR);
        focusable?.focus();
      } else {
        initialFocus.current?.focus();
      }
    }, 0);

    return () => window.clearTimeout(id);
  }, [open, initialFocus]);

  // close 時にフォーカスを復帰させる。
  useEffect(() => {
    if (open) return;
    const prev = previousFocusRef.current;
    if (prev && prev instanceof HTMLElement) {
      prev.focus();
    }
  }, [open]);

  // Esc キー処理と document レベルのフォーカストラップ。
  useEffect(() => {
    if (!open) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
        return;
      }

      if (e.key === "Tab") {
        const panel = panelRef.current;
        if (!panel) return;
        const focusable = Array.from(panel.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)).filter(
          (el) => el.offsetParent !== null, // 非表示要素を除外
        );
        if (focusable.length === 0) {
          e.preventDefault();
          return;
        }
        const first = focusable[0]!;
        const last = focusable[focusable.length - 1]!;

        if (e.shiftKey) {
          // Shift+Tab: 先頭にいるなら末尾へ
          if (document.activeElement === first) {
            e.preventDefault();
            last.focus();
          }
        } else {
          // Tab: 末尾にいるなら先頭へ
          if (document.activeElement === last) {
            e.preventDefault();
            first.focus();
          }
        }
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  return createPortal(
    // オーバーレイ: backdrop-fade アニメーション（opacity 0→1, ~180ms）。
    // data-overlay 属性でクリック判定（パネル自体へのクリックは伝播を止める）。
    <div
      className={styles.overlay}
      onMouseDown={(e) => {
        // オーバーレイ自身（パネル外）をクリックしたときのみ閉じる。
        if (e.target === e.currentTarget) onClose();
      }}
      // スクリーンリーダーはダイアログ内に閉じ込める（aria-modal で外の読み上げを抑制）。
    >
      <div
        ref={panelRef}
        className={styles.panel}
        role={role}
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descId}
      >
        {children}
      </div>
    </div>,
    document.body,
  );
}
