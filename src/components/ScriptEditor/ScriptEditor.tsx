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

const FLIP_DURATION = 220; // ms — CSS transition と合わせる

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

  // getRef: LineRow に渡す ref callback factory。
  // Why callback ref (not useRef): key が変わるたびに古い DOM ノードを cleanup できる。
  const getRowRef = useCallback((id: string): RefCallback<HTMLElement> => (el) => {
    if (el) {
      rowRefs.current.set(id, el);
    } else {
      rowRefs.current.delete(id);
    }
  }, []);

  // === First フェーズ: レンダー前（useLayoutEffect の前）に前回 rect を記録 ===
  // lines が変わる直前（同期的 render フェーズ）ではなく、
  // 前回の useLayoutEffect 末尾で「次回 First 用の rect」を保存する。
  // → useLayoutEffect 内で (Last → Invert → Play → 保存) の順で実行。

  useLayoutEffect(() => {
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
      requestAnimationFrame(() => {
        for (const { el, prevTransition } of animated) {
          el.style.transition = `transform ${FLIP_DURATION}ms var(--ease-out), ${prevTransition || ""}`.trim().replace(/,\s*$/, "");
          el.style.transform = "";
        }
        // アニメーション完了後に transition をクリーンアップ
        window.setTimeout(() => {
          for (const { el, prevTransition } of animated) {
            el.style.transition = prevTransition;
            el.style.transform = "";
          }
        }, FLIP_DURATION + 16);
      });
    }

    // === 次回 First 用に現在の rect を保存 ===
    prevRects.current = currentRects;
  }, [signature]); // 構造変化（並べ替え/追加/削除）時のみ実行 — テキスト編集では走らない

  return { getRowRef, addRowRef };
}

// ===== スクロールインジケーター (item 7) =====
// lines-scroll がオーバーフローし、かつ最下部でない時に下向き矢印のパルスを表示。
// onScroll + ResizeObserver + lines 変化で canScrollDown を判定。
// 最下部到達で fade-out 後に非表示。

function useScrollIndicator(linesRef: React.RefObject<HTMLDivElement | null>) {
  const [canScrollDown, setCanScrollDown] = useState(false);

  const check = useCallback(() => {
    const el = linesRef.current;
    if (!el) { setCanScrollDown(false); return; }
    const scrollable = el.scrollHeight - el.scrollTop - el.clientHeight > 8;
    setCanScrollDown(scrollable);
  }, [linesRef]);

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
  }, [linesRef, check]);

  // lines 変化時も再チェック（行追加/削除でスクロール高が変わるため）
  return { canScrollDown, recheckScroll: check };
}

export function ScriptEditor(props: ScriptEditorProps) {
  const total = props.lines.reduce((sum, l) => sum + l.text.length, 0);
  // キャラが0人のとき行追加を無効化（選択肢がないため。ScriptEditor 側でも UI 制約を明示）。
  const canAdd = props.characters.length > 0;

  // ===== FLIP (item 3) =====
  // 行の順序＋件数のシグネチャ。これが変わった時だけ FLIP が走る（テキスト編集では不変）。
  const orderSignature = props.lines.map((l) => l.id).join("|");
  const { getRowRef, addRowRef } = useFLIP(orderSignature);

  // ===== スクロールインジケーター (item 7) =====
  const linesScrollRef = useRef<HTMLDivElement>(null);
  const { canScrollDown, recheckScroll } = useScrollIndicator(linesScrollRef);

  // lines 変化時にスクロール量を再チェック（行追加でスクロール高が変わる）
  useEffect(() => {
    recheckScroll();
  }, [props.lines, recheckScroll]);

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
          </div>
          {/* イコライザ波形 — 純粋装飾。aria-hidden で AT に読ませない。 */}
          <div className={styles.waveform} aria-hidden="true">
            <span /><span /><span /><span /><span /><span />
          </div>
        </div>
      </div>

      {/* ===== Lines scroll (スクロールインジケーター コンテナ) ===== */}
      <div className={styles.linesScrollWrapper}>
        <div className={styles.linesScroll} ref={linesScrollRef}>
          <div className={styles.lines}>
            {props.lines.map((line, i) => (
              <LineRow
                key={line.id}
                // item 3: FLIP のため各行の DOM ノードを ref で収集する。
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

            {/* ===== 行追加ボタン (item 2: 二重 + 修正 / item 3: FLIP 対象) =====
             * item 2:
             *   - aria-label="+ 行を追加"（テストのアクセシブル名を維持）
             *   - 装飾 .plus（aria-hidden）は「+」のまま残す
             *   - 可視テキストは「行を追加」に変更（二重 + を解消）
             *   - 見た目: 「＋ 行を追加」（+は1つ）、アクセシブル名: "+ 行を追加"
             * item 3:
             *   - addRowRef で DOM ノードを収集し FLIP 対象に含める
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

        {/* ===== スクロールインジケーター (item 7: scroll-arrow-pulse) =====
         * canScrollDown 時のみ表示。最下部で fade-out。
         * aria-hidden: 純粋装飾。
         * 上下に脈動する矢印（scroll-arrow-pulse: scroll-indicator.md / cygames-corporate）。
         * prefers-reduced-motion: reduce では脈動を止める（表示自体は残す）。
         */}
        {canScrollDown && (
          <div className={styles.scrollIndicator} aria-hidden="true">
            <span className={styles.scrollArrow}>▼</span>
          </div>
        )}
      </div>
    </section>
  );
}
