// src/components/ScriptEditor/ScriptEditor.tsx
import { useRef, useCallback, useLayoutEffect, useState, useEffect, type RefCallback } from "react";
import type { Character, Line } from "../../types";
import { LineRow } from "../LineRow/LineRow";
import styles from "./ScriptEditor.module.css";

export type ScriptEditorProps = {
  characters: Character[];
  lines: Line[];
  onAddLine: () => void;
  onCharacterChange: (lineId: string, characterId: string) => void;
  onTextChange: (lineId: string, text: string) => void;
  onMoveUp: (lineId: string) => void;
  onMoveDown: (lineId: string) => void;
  onAddAfter: (lineId: string) => void;
  onDelete: (lineId: string) => void;
  onCopy: (line: Line) => void;
};

// ===== FLIP アニメーション (item 3) =====
// FLIP: First-Last-Invert-Play。
//   First: 変化前の各要素の rect を記録する。
//   Last:  React が DOM を更新した後（useLayoutEffect）に現在の rect を取得する。
//   Invert: 旧位置と新位置の差分を transform で「打ち消し」て見かけ上の動きをゼロにする。
//   Play:  同フレームで transform をリセット + transition を付与し、アニメーション開始。
//
// Why useLayoutEffect: DOM 更新直後・ブラウザの描画前に実行されるため、
// Invert の transform を適用してもフラッシュが起きない。
//
// DOM 直接操作: FLIP は React の外で DOM を操作する。LineRow の props は変えない（NF-10 維持）。
// React.memo もそのまま機能する（props 変化がなければ再描画しない）。
//
// duration: 220ms、ease: var(--ease-out)。
// prefers-reduced-motion: reduce では FLIP をスキップ（位置変化は即時）。

const FLIP_DURATION = 520; // ms — CSS transition と合わせる（item 7: 緩慢な移動）

// 進行中の FLIP アニメーションの状態。
// rafId: requestAnimationFrame の ID（キャンセル用）。
// timeoutId: setTimeout の ID（クリーンアップ用）。
// els: アニメーション中の要素とその元 transition 値。
type PendingFLIP = {
  rafId: number;
  timeoutId: ReturnType<typeof window.setTimeout>;
  els: Array<{ el: HTMLElement; prevTransition: string }>;
};

// signature: 行の順序＋件数を表す文字列。これが変わった時だけ FLIP を実行する。
// Why: セリフ入力欄は単一行で行高が固定 → テキスト打鍵では行は移動しない。
// 毎レンダーで全行の getBoundingClientRect を呼ぶと 500 行で layout thrashing になり
// NF-10（入力遅延ゼロ）に反する。構造変化（並べ替え/追加/削除）時のみ測定・アニメする。
function useFLIP(signature: string) {
  // rowRefs: lineId → HTMLElement の Map。LineRow の DOM ノードを収集する。
  const rowRefs = useRef<Map<string, HTMLElement>>(new Map());
  // addRowRef: 「行を追加」ボタンの DOM ノード
  const addRowRef = useRef<HTMLElement | null>(null);
  // prevRects: 前回レンダー時の rect（First フェーズで記録）
  const prevRects = useRef<Map<string, DOMRect>>(new Map());
  // pending: 進行中の FLIP アニメーション状態（再入防止ガード用）。
  // Why useRef: レンダーをトリガーせず、useLayoutEffect の外から参照できる必要がある。
  const pending = useRef<PendingFLIP | null>(null);

  // getRef: LineRow に渡す ref callback factory。
  // Why callback ref (not useRef): key が変わるたびに古い DOM ノードを cleanup できる。
  // Why cbCache (I-2): getRowRef をインライン呼び出しすると毎レンダーで全行のコールバック参照が
  // 変わり、React が全行の ref を null→el で再登録する（500行で打鍵ごと 1000回の Map 操作）。
  // id 別にキャッシュして同一参照を返すことで、打鍵時の ref 再登録を防ぐ。
  const cbCache = useRef<Map<string, RefCallback<HTMLElement>>>(new Map());
  const getRowRef = useCallback((id: string): RefCallback<HTMLElement> => {
    const cached = cbCache.current.get(id);
    if (cached) return cached;
    const cb: RefCallback<HTMLElement> = (el) => {
      if (el) {
        rowRefs.current.set(id, el);
      } else {
        rowRefs.current.delete(id);
        cbCache.current.delete(id);
      }
    };
    cbCache.current.set(id, cb);
    return cb;
  }, []);

  // === First フェーズ: レンダー前（useLayoutEffect の前）に前回 rect を記録 ===
  // lines が変わる直前（同期的 render フェーズ）ではなく、
  // 前回の useLayoutEffect 末尾で「次回 First 用の rect」を保存する。
  // → useLayoutEffect 内で (Last → Invert → Play → 保存) の順で実行。

  useLayoutEffect(() => {
    // === 再入防止ガード（I-1）===
    // 素早い連打で前回の RAF/timeout が未完のまま次の useLayoutEffect が走ると、
    // Last の getBoundingClientRect がアニメーション中の座標を拾い差分が壊れる。
    // 冒頭で pending があれば即キャンセルし、対象要素を「確定位置」に戻してから測定する。
    if (pending.current) {
      const { rafId, timeoutId, els } = pending.current;
      cancelAnimationFrame(rafId);
      clearTimeout(timeoutId);
      // transition を無効にして transform を即時リセット → 確定位置に戻す。
      // prevTransition は layout flush 後に復元するため、ここでは変更だけ行う。
      for (const entry of els) {
        entry.el.style.transition = "none";
        entry.el.style.transform = "";
      }
      // 上記の style 変更を確定させるために getBoundingClientRect を呼ぶ（強制 layout flush）。
      // これにより以降の測定は確定位置（アニメーション前の座標）を返す。
      rowRefs.current.forEach((el) => { el.getBoundingClientRect(); });
      // transition を元の値に戻す
      for (const entry of els) {
        entry.el.style.transition = entry.prevTransition;
      }
      pending.current = null;
    }

    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduced) {
      // reduced モードでは rect 記録だけ行い FLIP はスキップ
      prevRects.current = new Map();
      for (const [id, el] of rowRefs.current) {
        prevRects.current.set(id, el.getBoundingClientRect());
      }
      if (addRowRef.current) {
        prevRects.current.set("__addRow__", addRowRef.current.getBoundingClientRect());
      }
      return;
    }

    // === Last フェーズ: 現在の rect を取得 ===
    const currentRects = new Map<string, DOMRect>();
    for (const [id, el] of rowRefs.current) {
      currentRects.set(id, el.getBoundingClientRect());
    }
    if (addRowRef.current) {
      currentRects.set("__addRow__", addRowRef.current.getBoundingClientRect());
    }

    // === Invert フェーズ: 差分 transform を各要素に適用 ===
    const animated: Array<{ el: HTMLElement; prevTransition: string }> = [];
    for (const [id, currentRect] of currentRects) {
      const prevRect = prevRects.current.get(id);
      if (!prevRect) continue;
      const dy = prevRect.top - currentRect.top;
      if (Math.abs(dy) < 1) continue; // 実質移動なし → スキップ

      const el = id === "__addRow__"
        ? addRowRef.current
        : rowRefs.current.get(id);
      if (!el) continue;

      // Invert: 旧位置に見せかける（transition なしで瞬時に）
      const prevTransition = el.style.transition;
      el.style.transition = "none";
      el.style.transform = `translateY(${dy}px)`;
      animated.push({ el, prevTransition });
    }

    // === Play フェーズ: 次フレームで transform をリセット（transition が発火）===
    if (animated.length > 0) {
      // requestAnimationFrame で「Invert の paint が完了した次フレーム」を狙う。
      const rafId = requestAnimationFrame(() => {
        for (const { el, prevTransition } of animated) {
          el.style.transition = `transform ${FLIP_DURATION}ms var(--ease-out), ${prevTransition || ""}`.trim().replace(/,\s*$/, "");
          el.style.transform = "";
        }
        // アニメーション完了後に transition をクリーンアップ
        const timeoutId = window.setTimeout(() => {
          for (const { el, prevTransition } of animated) {
            el.style.transition = prevTransition;
            el.style.transform = "";
          }
          pending.current = null;
        }, FLIP_DURATION + 16);
        // RAF コールバック内で timeoutId が確定するため pending を更新する
        if (pending.current) pending.current.timeoutId = timeoutId;
      });
      // pending に記録しておく（次の useLayoutEffect 冒頭でキャンセル可能にする）
      pending.current = { rafId, timeoutId: -1 as unknown as ReturnType<typeof window.setTimeout>, els: animated };
    }

    // === 次回 First 用に現在の rect を保存 ===
    prevRects.current = currentRects;
  }, [signature]); // 構造変化（並べ替え/追加/削除）時のみ実行 — テキスト編集では走らない

  return { getRowRef, addRowRef };
}

// ===== スクロールインジケーター =====
// lines-scroll がオーバーフローし、かつ最下部でない時に下向き矢印のパルスを表示。
// canScrollUp: scrollTop > 8 の時に上向き矢印を表示（item 2）。
// canScrollDown: 最下部でない時に下向き矢印を表示。
// showScrollToTop: scrollTop が clientHeight を超えた時に戻るボタンを表示（item 3）。
// onScroll + ResizeObserver + lines 変化で状態を判定。

function useScrollIndicator(linesRef: React.RefObject<HTMLDivElement | null>) {
  const [canScrollDown, setCanScrollDown] = useState(false);
  const [canScrollUp, setCanScrollUp] = useState(false);
  const [showScrollToTop, setShowScrollToTop] = useState(false);

  // check: linesRef は useRef 由来で参照が不変。
  // useCallback の deps から外すことで「この関数は linesRef を追いかけない（不変前提）」と明示する。
  const check = useCallback(() => {
    const el = linesRef.current;
    if (!el) {
      setCanScrollDown(false);
      setCanScrollUp(false);
      setShowScrollToTop(false);
      return;
    }
    const scrollTop = el.scrollTop;
    const clientHeight = el.clientHeight;
    setCanScrollDown(el.scrollHeight - scrollTop - clientHeight > 8);
    setCanScrollUp(scrollTop > 8);
    // scroll-to-top-toggle: scrollTop が clientHeight を超えたら表示
    setShowScrollToTop(scrollTop > (clientHeight || 8));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // linesRef は useRef 由来で不変 — deps に含めない

  useEffect(() => {
    const el = linesRef.current;
    if (!el) return;
    check();
    el.addEventListener("scroll", check, { passive: true });
    const ro = new ResizeObserver(check);
    ro.observe(el);
    return () => {
      el.removeEventListener("scroll", check);
      ro.disconnect();
    };
  }, [linesRef, check]); // linesRef は useRef 由来で不変だが、useEffect 内で直接参照するため lint に含める

  // lines 変化時も再チェック（行追加/削除でスクロール高が変わるため）
  return { canScrollDown, canScrollUp, showScrollToTop, recheckScroll: check };
}

export function ScriptEditor(props: ScriptEditorProps) {
  const total = props.lines.reduce((sum, l) => sum + l.text.length, 0);
  // キャラが0人のとき行追加を無効化（選択肢がないため。ScriptEditor 側でも UI 制約を明示）。
  const canAdd = props.characters.length > 0;

  // ===== FLIP (item 3) =====
  // 行の順序＋件数のシグネチャ。これが変わった時だけ FLIP が走る（テキスト編集では不変）。
  const orderSignature = props.lines.map((l) => l.id).join("|");
  const { getRowRef, addRowRef } = useFLIP(orderSignature);

  // ===== スクロールインジケーター =====
  const linesScrollRef = useRef<HTMLDivElement>(null);
  const { canScrollDown, canScrollUp, showScrollToTop, recheckScroll } = useScrollIndicator(linesScrollRef);

  // lines 変化時にスクロール量を再チェック（行追加でスクロール高が変わる）
  useEffect(() => {
    recheckScroll();
  }, [props.lines, recheckScroll]);

  // ===== scroll-to-top-toggle (item 3) =====
  // reduced-motion では behavior: "auto" を使う。
  const scrollToTop = useCallback(() => {
    const el = linesScrollRef.current;
    if (!el) return;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    el.scrollTo({ top: 0, behavior: reduced ? "auto" : "smooth" });
  }, []);

  // aria-label で名前付き region として AT に認識させる（landmark ナビゲーション対応）。
  return (
    <section className={styles.main} aria-label="台本エディター">
      {/* ===== Editor header ===== */}
      <div className={styles.editorHead}>
        <div className={styles.editorHeadLeft}>
          <span className={styles.editorTitle}>台本</span>
          <div className={styles.statGroup}>
            {/* 合計文字数: テストが /合計文字数:\s*N/ で getByText するため単一要素で保持する。
                span 等で数値を分割しない（Why コメント: ScriptEditor.test.tsx, App.test.tsx 参照）。 */}
            <span className={styles.stat}>合計文字数: {total}文字</span>
            {/* 行数 stat (item 1): 独立した stat 要素で表示。合計文字数と同じスタイル。 */}
            <span className={styles.stat}>行数: {props.lines.length}</span>
          </div>
          {/* イコライザ波形 — 純粋装飾。aria-hidden で AT に読ませない。 */}
          <div className={styles.waveform} aria-hidden="true">
            <span /><span /><span /><span /><span /><span />
          </div>
        </div>
      </div>

      {/* ===== Lines scroll (スクロールインジケーター コンテナ) ===== */}
      <div className={styles.linesScrollWrapper}>
        {/* ===== 上向きスクロール促し矢印 (item 2) =====
         * canScrollUp 時のみ表示。上部中央に配置。
         * aria-hidden: 純粋装飾。
         * scroll-arrow-pulse の上向き版（▲）。
         * prefers-reduced-motion: reduce では脈動を止める（表示は残す）。
         */}
        {canScrollUp && (
          <div className={styles.scrollIndicatorTop} aria-hidden="true">
            <span className={styles.scrollArrowUp}>▲</span>
          </div>
        )}

        <div className={styles.linesScroll} ref={linesScrollRef}>
          <div className={styles.lines}>
            {props.lines.map((line, i) => (
              <LineRow
                key={line.id}
                // FLIP のため各行の DOM ノードを ref で収集する。
                // LineRow は memo のまま。ref は props ではなく DOM レイヤーで付与。
                ref={getRowRef(line.id)}
                line={line}
                characters={props.characters}
                index={i}
                isFirst={i === 0}
                isLast={i === props.lines.length - 1}
                onCharacterChange={props.onCharacterChange}
                onTextChange={props.onTextChange}
                onMoveUp={props.onMoveUp}
                onMoveDown={props.onMoveDown}
                onAddAfter={props.onAddAfter}
                onDelete={props.onDelete}
                onCopy={props.onCopy}
              />
            ))}

            {/* ===== 行追加ボタン (FLIP 対象) =====
             * - aria-label="+ 行を追加"（テストのアクセシブル名を維持）
             * - 装飾 .plus（aria-hidden）は「+」のまま残す
             * - 可視テキストは「行を追加」、アクセシブル名: "+ 行を追加"
             * - addRowRef で DOM ノードを収集し FLIP 対象に含める
             */}
            <button
              ref={addRowRef as React.Ref<HTMLButtonElement>}
              className={styles.addRow}
              disabled={!canAdd}
              onClick={props.onAddLine}
              aria-label="+ 行を追加"
            >
              <span className={styles.plus} aria-hidden="true">+</span>
              行を追加
            </button>
          </div>
        </div>

        {/* ===== 下向きスクロール促し矢印 (scroll-arrow-pulse) =====
         * canScrollDown 時のみ表示。下部中央に配置。
         * aria-hidden: 純粋装飾。
         * prefers-reduced-motion: reduce では脈動を止める（表示自体は残す）。
         */}
        {canScrollDown && (
          <div className={styles.scrollIndicator} aria-hidden="true">
            <span className={styles.scrollArrow}>▼</span>
          </div>
        )}

        {/* ===== 一番上に戻るボタン (item 3: scroll-to-top-toggle) =====
         * scroll-to-top-toggle (hover-feedback-family / nissan-jobs):
         *   opacity + translateY のトグルでふわっと表示/非表示。
         * 位置: 右下（下部中央の促し矢印と重ならないよう右寄り）。
         * クリックで lines-scroll を最上部へスムーズスクロール（reduced-motion なら auto）。
         * aria-label="一番上に戻る"。
         *
         * a11y: 非表示時は tabIndex={-1} + aria-hidden="true" でフォーカス/SR 読み上げを防ぐ。
         *   Why 属性切替（条件付きレンダーでない）: フェードアニメ（scroll-to-top-toggle）を維持するため。
         *   opacity:0 + pointer-events:none だけでは DOM 上のフォーカス/SR 読み上げを防げない。
         */}
        <button
          className={`${styles.scrollToTop} ${showScrollToTop ? styles.scrollToTopVisible : ""}`}
          onClick={scrollToTop}
          aria-label="一番上に戻る"
          tabIndex={showScrollToTop ? undefined : -1}
          aria-hidden={showScrollToTop ? undefined : true}
        >
          ▲
        </button>
      </div>
    </section>
  );
}
