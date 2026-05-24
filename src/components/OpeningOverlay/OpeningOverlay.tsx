// src/components/OpeningOverlay/OpeningOverlay.tsx
//
// オープニング演出: アプリ起動時の一度きりの全画面ブランドアニメーション。
// design-library parts/opening-sequence (cygames: opening-fade-in + opening-fade-out) +
// loading-family (loading-fade-in / loading-exit) をベースに、
// 図形のモーショングラフィックス（放射状の衝撃波リング＋放射パーティクル）を重ねる。
//
// レイヤー構成（奥→手前）:
//   1. .burst — 図形モーション（中心から広がるリング・放射パーティクル・回転ポリゴン）
//   2. .logo  — タイトルロゴ画像（最前面 z-index）
//
// 挙動:
//   1. prefers-reduced-motion: reduce → 即 null（演出非表示）
//   2. sessionStorage に 'ymm4-opening-shown' があれば即 null（2回目以降スキップ）
//   3. burst が中心から放射 → 少し遅れてタイトルロゴが浮かび上がる
//   4. アイドル後 fade-out（loading-exit）→ DOM から除去
//
// アクセシビリティ / 設計上の注意:
//   - コンテンツ (.app) は最初から DOM に存在（描画遅延なし）; オーバーレイは上に重ねるのみ
//   - aria-hidden="true" で AT から非可視。短時間で消えるためフォーカストラップは行わない
//   - テスト環境では matchMedia スタブが reduce=true を返すため即 null → テスト非干渉

import { useState, useEffect, useRef, type CSSProperties } from "react";
import styles from "./OpeningOverlay.module.css";

const SESSION_KEY = "ymm4-opening-shown";

// prefers-reduced-motion と sessionStorage で演出を表示すべきか判定する純粋関数。
function checkShouldPlay(): boolean {
  if (typeof window === "undefined") return false;
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return false;
  if (sessionStorage.getItem(SESSION_KEY) === "1") return false;
  return true;
}

// 放射パーティクル定義（モジュール定数 = 毎回同じ配置・乱数なし）。
// angle: 放射方向。dist: 飛ぶ距離。size: 粒径。delay: 発射の時間差。
// 偶奇でわずかに角度をずらし、距離・遅延を散らして「弾けた」自然さを出す。
const BURST_PARTICLES = Array.from({ length: 30 }, (_, i) => ({
  angle: (360 / 30) * i + (i % 2 === 0 ? 6 : -6),
  dist: 130 + (i % 5) * 30,
  size: 2 + (i % 3),
  delay: (i % 6) * 28,
}));

type Phase = "enter" | "idle" | "exit" | "done";

// T_ENTER は burst のモーション（~0.9s）が概ね出きるまでの尺。
// content の fade-in（CSS 0.6s）より十分長いので、enter→idle 切替時のフラッシュは起きない。
const T_ENTER = 1000; // 図形モーション + ロゴ出現の尺 (ms)
const T_IDLE = 350; // アイドル (ms)
const T_EXIT = 550; // loading-exit (ms)

export function OpeningOverlay() {
  const [phase, setPhase] = useState<Phase>(() => (checkShouldPlay() ? "enter" : "done"));

  // Strict Mode の二重 effect でタイマーが二重に張られないための防衛フラグ。
  const timerStartedRef = useRef(false);

  useEffect(() => {
    if (timerStartedRef.current) return;
    if (!checkShouldPlay()) return;
    timerStartedRef.current = true;

    // セッション中のスキップ記録（effect 内で行うことで SSR 安全）
    sessionStorage.setItem(SESSION_KEY, "1");

    // フェーズ遷移は timer で進める。T_ENTER > content fade(0.6s) なのでフラッシュは起きない。
    const t1 = window.setTimeout(() => setPhase("idle"), T_ENTER);
    const t2 = window.setTimeout(() => setPhase("exit"), T_ENTER + T_IDLE);
    const t3 = window.setTimeout(() => setPhase("done"), T_ENTER + T_IDLE + T_EXIT);

    return () => {
      window.clearTimeout(t1);
      window.clearTimeout(t2);
      window.clearTimeout(t3);
      // Strict Mode のクリーンアップ後、次の mount で再試行できるようリセット
      timerStartedRef.current = false;
    };
  }, []);

  if (phase === "done") return null;

  return (
    <div className={`${styles.overlay} ${styles[phase]}`} aria-hidden="true">
      <div className={styles.content}>
        {/* ===== 図形モーショングラフィックス（放射）: ロゴより背面 ===== */}
        <div className={styles.burst}>
          {/* 衝撃波リング: 中心から拡大しながらフェードする同心円（3枚を時間差で） */}
          <span className={styles.ring} />
          <span className={styles.ring} />
          <span className={styles.ring} />

          {/* 回転ポリゴン: ゆっくり回りながら拡大・消滅する六角形の線画（図形モーション） */}
          <svg className={styles.poly} viewBox="0 0 100 100" aria-hidden="true">
            <polygon
              points="50,6 88,28 88,72 50,94 12,72 12,28"
              fill="none"
              stroke="rgba(43,180,230,0.6)"
              strokeWidth="1"
            />
          </svg>

          {/* 放射パーティクル: 中心から各方向へ飛び散る粒 */}
          {BURST_PARTICLES.map((p, i) => (
            <span
              key={i}
              className={styles.particle}
              style={
                {
                  "--angle": `${p.angle}deg`,
                  "--dist": `${p.dist}px`,
                  "--size": `${p.size}px`,
                  "--delay": `${p.delay}ms`,
                } as CSSProperties
              }
            />
          ))}
        </div>

        {/* ===== タイトルロゴ（最前面）===== */}
        {/* public 配下の画像は base 込みで参照（GitHub Pages のサブパス配信対応）。
            Vite は JS 文字列内の "/..." を書き換えないため import.meta.env.BASE_URL を前置する。 */}
        <img className={styles.logo} src={`${import.meta.env.BASE_URL}opening-logo.png`} alt="YMM4台本エディタ" />
      </div>
    </div>
  );
}
