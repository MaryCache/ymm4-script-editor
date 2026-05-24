// src/components/BgCanvas/BgCanvas.tsx
//
// canvas-gyro 代替実装: 依存ゼロの vanilla canvas で Three.js の精神を再現する。
// オリジナル (makery-subculture / bg-decoration-family) は Three.js + pointermove/deviceorientation
// 連動の3Dパララックスだが、外部依存禁止 (NF-02/03 / ADR 依存最小) のため以下で代替する:
//   - 52粒固定の淡い cyan ドット（PARTICLE_COUNT = 52）を複数レイヤーに分け描画
//   - pointermove でポインタ位置に応じてレイヤーごとに視差シフト (parallax-family の精神)
//   - 常時ゆるやかな drift を rAF で合成
//   - prefers-reduced-motion: reduce → rAF を回さず静止キャンバスのまま (即 return)
//   - document.hidden → rAF 一時停止 (ページ非表示時の無駄なCPU使用を防ぐ)
//   - devicePixelRatio 対応 + resize 対応 (dpr は resize 毎に再取得)
//   - unmount で rAF / listener / visibilitychange を全て解除
//
// アクセシビリティ:
//   aria-hidden="true" + role="presentation" で AT からは非可視
//   pointer-events: none (style で直接付与) でインタラクションを貫通させる

import { useEffect, useRef } from "react";

// 粒の型: depth 0.0〜1.0 (0=奥=移動少, 1=手前=移動多)
type Particle = {
  x: number;       // 基準 x (0〜1 の正規化座標)
  y: number;       // 基準 y (0〜1 の正規化座標)
  r: number;       // 半径 px (logical)
  alpha: number;   // ベース不透明度
  depth: number;   // 視差係数
  driftX: number;  // 常時ドリフト速度 x (px/frame, 正規化)
  driftY: number;  // 常時ドリフト速度 y (px/frame, 正規化)
  phase: number;   // alpha パルスの位相 (ゆっくりした明暗変化用)
  speed: number;   // alpha パルスの速さ (rad/frame)
};

// 52粒固定（モジュール冒頭コメント「52粒固定」と一致）
const PARTICLE_COUNT = 52;
// 視差シフト最大量 (logical px)。小さめにして主コンテンツを邪魔しない。
const PARALLAX_STRENGTH = 28;
// ドリフト速度の最大絶対値 (正規化 per frame)
const DRIFT_MAX = 0.00012;

function makeParticles(count: number): Particle[] {
  const particles: Particle[] = [];
  for (let i = 0; i < count; i++) {
    particles.push({
      x: Math.random(),
      y: Math.random(),
      r: Math.random() * 1.6 + 0.6,      // 0.6〜2.2 px
      alpha: Math.random() * 0.22 + 0.06, // 0.06〜0.28 — 淡め
      depth: Math.random(),
      driftX: (Math.random() - 0.5) * 2 * DRIFT_MAX,
      driftY: (Math.random() - 0.5) * 2 * DRIFT_MAX,
      phase: Math.random() * Math.PI * 2,
      speed: Math.random() * 0.008 + 0.003, // 0.003〜0.011 rad/frame
    });
  }
  return particles;
}

export function BgCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    // prefers-reduced-motion: reduce の場合はキャンバスを描画しない
    // テスト環境は matchMedia スタブで reduce=true を返すため、ここで return し canvas は空白のまま
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduced) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // TypeScript noUncheckedIndexedAccess / strict null: 内部関数のクロージャで
    // canvas / ctx は「nullable な ref」として再評価される場合があるため、
    // この時点で既にガード済みの値を別名に固定して内部関数から参照する。
    const cvs: HTMLCanvasElement = canvas;
    const context: CanvasRenderingContext2D = ctx;

    // dpr を let にすることで別モニタへ移動した際に resize() 内で再取得できる
    let dpr = window.devicePixelRatio || 1;
    let width = 0;
    let height = 0;

    // ポインタ正規化位置 (0〜1)、初期値は中央
    let ptrX = 0.5;
    let ptrY = 0.5;

    // 現在の平滑化ポインタ位置 (0〜1)
    let smoothX = 0.5;
    let smoothY = 0.5;

    const particles = makeParticles(PARTICLE_COUNT);

    // canvas サイズを window に合わせて設定する。
    // dpr は毎回 window.devicePixelRatio を再取得する: 別 DPI モニタへ移動後の resize
    // イベントで正しいスケールが適用されるようにするため。
    function resize() {
      dpr = window.devicePixelRatio || 1;
      width = window.innerWidth;
      height = window.innerHeight;
      // devicePixelRatio 対応: CSS サイズと実ピクセル数を分離
      cvs.width = Math.round(width * dpr);
      cvs.height = Math.round(height * dpr);
      cvs.style.width = `${width}px`;
      cvs.style.height = `${height}px`;
      context.scale(dpr, dpr);
    }
    resize();

    let rafId: number | null = null;

    function draw() {
      context.clearRect(0, 0, width, height);

      // ポインタ位置を指数平滑化 (慣性感) — smooth factor 0.04 で遅れあり
      smoothX += (ptrX - smoothX) * 0.04;
      smoothY += (ptrY - smoothY) * 0.04;

      // 中心からのオフセット (-0.5〜0.5)
      const offsetX = (smoothX - 0.5) * PARALLAX_STRENGTH;
      const offsetY = (smoothY - 0.5) * PARALLAX_STRENGTH;

      for (const p of particles) {
        // 常時ドリフト: 基準座標を毎フレーム微小移動し、画面外に出たら反対から戻す
        p.x += p.driftX;
        p.y += p.driftY;
        if (p.x < -0.05) p.x = 1.05;
        if (p.x > 1.05)  p.x = -0.05;
        if (p.y < -0.05) p.y = 1.05;
        if (p.y > 1.05)  p.y = -0.05;

        // alpha パルス: sin 波でゆっくり明暗
        p.phase += p.speed;
        const alphaMod = 1 + Math.sin(p.phase) * 0.3; // 0.7〜1.3 倍

        // 視差シフト: depth が大きい粒ほど大きく動く
        const px = p.x * width  + offsetX * p.depth;
        const py = p.y * height + offsetY * p.depth;

        // 描画 — cyan (#58d3f0) の淡い点。
        // fillStyle を "#58d3f0" 固定にして透明度は globalAlpha で表現する。
        // 粒×60fps の毎フレームで rgba 文字列を生成すると GC 圧がかかるため、
        // 文字列生成を無くして globalAlpha の数値代入に置き換える。
        // 描画後は globalAlpha を 1 に戻し、他の描画処理への影響を防ぐ。
        const clampedAlpha = Math.min(1, Math.max(0, p.alpha * alphaMod));
        context.beginPath();
        context.arc(px, py, p.r, 0, Math.PI * 2);
        context.fillStyle = "#58d3f0";
        context.globalAlpha = clampedAlpha;
        context.fill();
        context.globalAlpha = 1;
      }

      rafId = requestAnimationFrame(draw);
    }

    // document.hidden でrAF を一時停止・再開
    function handleVisibility() {
      if (document.hidden) {
        if (rafId !== null) {
          cancelAnimationFrame(rafId);
          rafId = null;
        }
      } else {
        if (rafId === null) {
          rafId = requestAnimationFrame(draw);
        }
      }
    }

    function handlePointerMove(e: PointerEvent) {
      ptrX = e.clientX / window.innerWidth;
      ptrY = e.clientY / window.innerHeight;
    }

    function handleResize() {
      // getContext のスケールは累積するため resetTransform してから再設定
      context.resetTransform();
      resize();
    }

    // イベント登録
    window.addEventListener("pointermove", handlePointerMove, { passive: true });
    window.addEventListener("resize", handleResize, { passive: true });
    document.addEventListener("visibilitychange", handleVisibility);

    // 初期描画開始
    rafId = requestAnimationFrame(draw);

    // クリーンアップ: unmount 時に全リソースを解放
    return () => {
      if (rafId !== null) cancelAnimationFrame(rafId);
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("resize", handleResize);
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, []); // 初回マウント時のみ実行

  return (
    <canvas
      ref={canvasRef}
      // 背面固定: position/z-index は bgAmbient 内で制御。
      // mask-image: ブロブと同様に縁をフェードさせ、粒子が画面端でぶつ切りにならないようにする。
      // radial-gradient の楕円形状は bgAmbient の mask-image と視覚的に揃える。
      style={{
        position: "absolute",
        inset: 0,
        pointerEvents: "none",
        display: "block",
        maskImage: "radial-gradient(ellipse 90% 88% at 50% 50%, black 40%, transparent 100%)",
        WebkitMaskImage: "radial-gradient(ellipse 90% 88% at 50% 50%, black 40%, transparent 100%)",
      }}
      aria-hidden="true"
      role="presentation"
    />
  );
}
