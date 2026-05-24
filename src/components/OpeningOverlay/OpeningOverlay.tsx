// src/components/OpeningOverlay/OpeningOverlay.tsx
//
// オープニング演出: アプリ起動時の一度きりの全画面ブランドアニメーション。
// design-library parts/opening-sequence (cygames: opening-fade-in + opening-fade-out) +
// loading-family (loading-fade-in / loading-exit) の最小構成。
//
// 挙動:
//   1. prefers-reduced-motion: reduce → 即 null を返す (演出非表示)
//   2. sessionStorage に 'ymm4-opening-shown' があれば即 null を返す (2回目以降スキップ)
//   3. ブランド (エンブレム画像 + タイトルロゴ画像) を fade-in + わずかな scale/glow で表示
//   4. アイドル後 fade-out (loading-exit) → DOM から除去
//   総尺 ~1.4s: fade-in 0.5s + idle 0.4s + fade-out 0.5s
//
// アクセシビリティ / 設計上の注意:
//   - コンテンツ (.app) は最初から DOM に存在 (描画遅延なし); オーバーレイは上に重ねるのみ
//   - aria-hidden="true" で AT から非可視。短時間で消えるため フォーカストラップは行わない
//   - テスト環境では matchMedia スタブが reduce=true を返すため即 null → テスト非干渉

import { useState, useEffect, useRef } from "react";
import styles from "./OpeningOverlay.module.css";

const SESSION_KEY = "ymm4-opening-shown";

// prefers-reduced-motion と sessionStorage で演出を表示すべきか判定する純粋関数。
// useState / useRef の initializer / useEffect 内いずれからも呼べる。
function checkShouldPlay(): boolean {
  if (typeof window === "undefined") return false;
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return false;
  if (sessionStorage.getItem(SESSION_KEY) === "1") return false;
  return true;
}

type Phase = "enter" | "idle" | "exit" | "done";

// T_ENTER は CSS の openingFadeIn duration(0.5s=500ms) より少し長く設定する。
// 両者が完全一致するとタイマー誤差で enter→idle 切替が animation 終了前に起き、
// .idle が animation:none なため一瞬 opacity:0 に戻るフラッシュが発生する。
// 40ms のバッファで CSS 側が先に完了することを保証する（総尺への影響は無視できる）。
const T_ENTER = 540;   // opening-fade-in 尺 (ms) ※CSS animation 500ms + 40ms buffer
const T_IDLE  = 400;   // アイドル時間 (ms)
const T_EXIT  = 500;   // loading-exit 尺 (ms)

export function OpeningOverlay() {
  // useState initializer: 初回 render 時のみ評価される。
  // render 中に呼ばれるが useState initializer は React の公式 API であり問題なし。
  const [phase, setPhase] = useState<Phase>(
    () => checkShouldPlay() ? "enter" : "done"
  );

  // タイマー起動済みフラグ: Strict Mode の二重 effect 起動でタイマーが二重に張られないための防衛。
  // react-hooks/refs: ref.current は render 中には参照しない (effect 内のみ)。
  const timerStartedRef = useRef(false);

  // .content 要素への ref: enter→idle 遷移を animationend で受ける（フラッシュ回避の補助）。
  // T_ENTER タイムアウトより animationend の方が先に到着した場合は animationend を優先し、
  // タイムアウト側は clearTimeout で無効化する。
  const contentRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // done フェーズ (reduced-motion / 2回目以降 / Strict Mode 二重起動) はスキップ
    // phase は useState で決定済みだが、ここで再チェックしてもよい。
    // しかし phase を deps に入れると毎フェーズ変化でタイマーが再起動するため、
    // timerStartedRef で「既に起動済みか」を管理する。
    if (timerStartedRef.current) return;
    // checkShouldPlay() を effect 内でも確認 (Strict Mode の2回目呼び出し対応)
    if (!checkShouldPlay()) return;

    timerStartedRef.current = true;

    // セッション中のスキップ記録 (effect 内で行うことで SSR 安全)
    sessionStorage.setItem(SESSION_KEY, "1");

    // enter → idle: animationend で受ける（CSS 完了を確実に待つ）。
    // T_ENTER のタイムアウトはフォールバック（animationend が発火しない環境向け）。
    let t1: ReturnType<typeof window.setTimeout> | null = null;

    function onEnterEnd() {
      if (t1 !== null) {
        window.clearTimeout(t1);
        t1 = null;
      }
      setPhase("idle");
    }

    const contentEl = contentRef.current;
    if (contentEl) {
      contentEl.addEventListener("animationend", onEnterEnd, { once: true });
    }
    // フォールバックタイムアウト: animationend が来なかった場合に遷移を保証する
    t1 = window.setTimeout(onEnterEnd, T_ENTER);

    const t2 = window.setTimeout(() => setPhase("exit"),  T_ENTER + T_IDLE);
    const t3 = window.setTimeout(() => setPhase("done"),  T_ENTER + T_IDLE + T_EXIT);

    return () => {
      if (t1 !== null) window.clearTimeout(t1);
      window.clearTimeout(t2);
      window.clearTimeout(t3);
      if (contentEl) contentEl.removeEventListener("animationend", onEnterEnd);
      // Strict Mode でクリーンアップされた場合は次の mount で再試行できるようにリセット
      timerStartedRef.current = false;
    };
  }, []); // タイマーシーケンスは初回マウント時のみ。phase は deps 不要 (timerStartedRef で管理)

  // done になったら DOM から除去
  if (phase === "done") return null;

  return (
    <div
      className={`${styles.overlay} ${styles[phase]}`}
      aria-hidden="true"
    >
      <div className={styles.content} ref={contentRef}>
        {/* エンブレム（放射光つき吹き出し）とタイトルロゴはユーザー提供の透過 PNG。
            overlay 全体が aria-hidden のため画像は装飾扱い（alt は実質無視される）。 */}
        <img className={styles.emblem} src="/opening-emblem.png" alt="" width={180} height={180} />
        <img className={styles.logo} src="/opening-logo.png" alt="YMM4台本エディタ" />
      </div>
    </div>
  );
}
