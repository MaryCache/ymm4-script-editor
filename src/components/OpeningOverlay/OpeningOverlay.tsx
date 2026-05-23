// src/components/OpeningOverlay/OpeningOverlay.tsx
//
// オープニング演出: アプリ起動時の一度きりの全画面ブランドアニメーション。
// design-library parts/opening-sequence (cygames: opening-fade-in + opening-fade-out) +
// loading-family (loading-fade-in / loading-exit) の最小構成。
//
// 挙動:
//   1. prefers-reduced-motion: reduce → 即 null を返す (演出非表示)
//   2. sessionStorage に 'ymm4-opening-shown' があれば即 null を返す (2回目以降スキップ)
//   3. ブランド (Y4 マーク + 「YMM4台本エディタ」) を fade-in + わずかな scale/glow で表示
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

// ブランドロゴ: SVG インライン (外部リソース不要, NF-02/03)
function BrandMark() {
  return (
    <svg
      className={styles.brandMark}
      viewBox="0 0 80 80"
      width="80"
      height="80"
      aria-hidden="true"
      focusable="false"
    >
      {/* 外周リング */}
      <circle
        cx="40" cy="40" r="36"
        fill="none"
        stroke="rgba(43,180,230,0.5)"
        strokeWidth="1.5"
      />
      {/* 内周リング */}
      <circle
        cx="40" cy="40" r="29"
        fill="none"
        stroke="rgba(16,125,200,0.25)"
        strokeWidth="0.75"
      />
      {/* Y の左腕 */}
      <line x1="26" y1="24" x2="40" y2="42" stroke="rgba(88,211,240,0.95)" strokeWidth="2.5" strokeLinecap="round" />
      {/* Y の右腕 */}
      <line x1="54" y1="24" x2="40" y2="42" stroke="rgba(88,211,240,0.95)" strokeWidth="2.5" strokeLinecap="round" />
      {/* Y の軸 */}
      <line x1="40" y1="42" x2="40" y2="58" stroke="rgba(88,211,240,0.95)" strokeWidth="2.5" strokeLinecap="round" />
      {/* 4 の横棒 */}
      <line x1="29" y1="46" x2="45" y2="46" stroke="rgba(43,180,230,0.75)" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

type Phase = "enter" | "idle" | "exit" | "done";

const T_ENTER = 500;   // opening-fade-in 尺 (ms)
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

    // enter → idle → exit → done のシーケンスをタイマーで制御
    const t1 = window.setTimeout(() => setPhase("idle"),  T_ENTER);
    const t2 = window.setTimeout(() => setPhase("exit"),  T_ENTER + T_IDLE);
    const t3 = window.setTimeout(() => setPhase("done"),  T_ENTER + T_IDLE + T_EXIT);

    return () => {
      window.clearTimeout(t1);
      window.clearTimeout(t2);
      window.clearTimeout(t3);
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
      <div className={styles.content}>
        <BrandMark />
        <p className={styles.title}>YMM4台本エディタ</p>
        <p className={styles.sub}>Script Editor</p>
      </div>
    </div>
  );
}
