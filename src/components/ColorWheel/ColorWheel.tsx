// src/components/ColorWheel/ColorWheel.tsx
import { useEffect, useRef, useState, type ChangeEvent, type PointerEvent as ReactPointerEvent } from "react";
import { hexToHsl, hslToHex } from "../../utils/color";
import styles from "./ColorWheel.module.css";

/**
 * `ColorWheel` コンポーネントの props 型。
 *
 * @see {@link ColorWheel}
 */
export type ColorWheelProps = {
  /**
   * 現在の色（`#RRGGBB` 形式の CSS hex カラー）。
   * 初期値として内部 HSL 状態を初期化するために使用する。
   */
  color: string;
  /**
   * 色が変更されたときのコールバック。
   *
   * @param hex - 新しい色（`#rrggbb` 小文字形式）
   */
  onChange: (hex: string) => void;
  /** Esc キー / 外側クリックで閉じる要求のコールバック。 */
  onClose: () => void;
};

// 色相環の寸法定数。
const WHEEL_SIZE = 180; // px — SVG コンテナの一辺
const OUTER_R = 80; // 外径（px）
const INNER_R = 54; // 内径（px）— リング幅 = OUTER_R - INNER_R = 26px

/** HSL 型エイリアス（内部状態）。 */
type Hsl = { h: number; s: number; l: number };

/**
 * ポインター座標（コンテナ中心基準）から色相角（0–360）を算出するヘルパー。
 *
 * @param cx - ポインターの x 座標（コンテナ中心を 0 とした相対値）
 * @param cy - ポインターの y 座標（コンテナ中心を 0 とした相対値、y 軸下向き正）
 * @returns 0–360 の色相角（deg）
 */
const angleFromCenter = (cx: number, cy: number): number => {
  const rad = Math.atan2(cy, cx);
  // CSS conic-gradient の 0deg=12時方向・時計回りに合わせるため 90deg オフセット。
  let deg = (rad * 180) / Math.PI + 90;
  if (deg < 0) deg += 360;
  if (deg >= 360) deg -= 360;
  return deg;
};

/**
 * 依存ゼロの自前カラーピッカーコンポーネント。
 *
 * @remarks
 * - **色相環**: `conic-gradient` の SVG ラップで 360° のリングを描画。クリック / ドラッグ位置の
 *   角度から hue（0–360）を算出し、現在 hue のマーカー（白丸）を表示する。
 * - **明度スライダー**: hue・彩度（最低 60%）を保ちながら l を 0–100 で調整する range input。
 * - **hex 入力欄**: 6桁 hex を直接入力可能。妥当な値で `onChange` を呼ぶ。
 *   キーボードのみでも色指定できるためアクセシビリティを確保する。
 * - 内部状態は HSL で保持し、各ハンドラで `hslToHex` して `onChange` を呼ぶ。
 * - 初期値は `hexToHsl(color)` で設定。彩度は最低 60% を確保。
 * - ポップオーバーとして表示される想定（位置は使用側が制御する）。
 *   外側クリック / Esc で `onClose` を呼ぶ。
 * - 入場アニメーション: `dropdown-enter-right`（opacity + scale 0.96→1, ~0.18s）。
 * - `prefers-reduced-motion: reduce` ではアニメーションなし。
 *
 * @param props - {@link ColorWheelProps}
 */
export function ColorWheel({ color, onChange, onClose }: ColorWheelProps) {
  // 初期 HSL は props.color から算出する。彩度は最低 60% を確保（表示映えの最低ライン）。
  const initial = hexToHsl(color);
  const [hsl, setHsl] = useState<Hsl>({
    h: initial.h,
    s: Math.max(initial.s, 60),
    l: initial.l,
  });

  // hex 入力フィールドの制御値。入力途中の文字列（例: "#ff"）を保持するため hsl とは分離する。
  const [hexInput, setHexInput] = useState(hslToHex(initial.h, Math.max(initial.s, 60), initial.l));

  const containerRef = useRef<HTMLDivElement>(null);
  // ドラッグ状態は ref で管理（setState を経ない = 再描画を引き起こさない）。
  const isDragging = useRef(false);

  // 外側クリック検知: containerRef の外を mousedown したら onClose。
  useEffect(() => {
    const handleMouseDown = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    document.addEventListener("mousedown", handleMouseDown);
    return () => document.removeEventListener("mousedown", handleMouseDown);
  }, [onClose]);

  // Esc キーで閉じる。
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  // ===== 内部ヘルパー: HSL を更新し onChange / hex 入力欄を同期する =====
  // React Compiler が最適化するため useCallback は使わない（manual memoization の衝突回避）。
  const applyHsl = (next: Hsl) => {
    setHsl(next);
    const hex = hslToHex(next.h, next.s, next.l);
    onChange(hex);
    setHexInput(hex);
  };

  // ===== 色相環インタラクション =====

  /**
   * ポインター位置から色相を更新する。
   * SVG コンテナの中心を原点として atan2 で角度を算出する。
   */
  const updateHueFromPointer = (e: { clientX: number; clientY: number }) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    // wheelWrapper の padding (4px) を考慮した SVG 内の中心座標を計算。
    const svgLeft = rect.left + 4; // .wheelWrapper の padding-left
    const svgTop = rect.top + 4; // .wheelWrapper の padding-top
    const cx = e.clientX - svgLeft - WHEEL_SIZE / 2;
    const cy = e.clientY - svgTop - WHEEL_SIZE / 2;
    const dist = Math.sqrt(cx * cx + cy * cy);
    // ドラッグ中でない場合はリング領域外のクリックを無視する。
    if (!isDragging.current && (dist < INNER_R || dist > OUTER_R)) return;
    const newHue = Math.round(angleFromCenter(cx, cy));
    applyHsl({ ...hsl, h: newHue });
  };

  const handlePointerDown = (e: ReactPointerEvent<SVGSVGElement>) => {
    isDragging.current = true;
    (e.currentTarget as SVGSVGElement).setPointerCapture(e.pointerId);
    updateHueFromPointer(e);
  };

  const handlePointerMove = (e: ReactPointerEvent<SVGSVGElement>) => {
    if (!isDragging.current) return;
    updateHueFromPointer(e);
  };

  const handlePointerUp = () => {
    isDragging.current = false;
  };

  // ===== 明度スライダー =====

  const handleLightnessChange = (e: ChangeEvent<HTMLInputElement>) => {
    applyHsl({ ...hsl, l: Number(e.target.value) });
  };

  // ===== hex 入力 =====

  const handleHexChange = (e: ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value;
    setHexInput(raw);
    // # + 6桁 hex の形式で妥当なときのみ内部状態を更新する。
    const match = /^#([0-9a-fA-F]{6})$/.exec(raw.trim());
    if (match) {
      const parsed = hexToHsl(raw.trim());
      const next: Hsl = { h: parsed.h, s: Math.max(parsed.s, 60), l: parsed.l };
      setHsl(next);
      onChange(hslToHex(next.h, next.s, next.l));
      // hex 入力欄は raw のまま保持（ユーザーが入力中の値を書き換えない）。
    }
  };

  // ===== マーカー位置の計算 =====
  // 現在 hue のリング中央（半径 = (OUTER_R + INNER_R) / 2）上の座標を算出する。
  const markerR = (OUTER_R + INNER_R) / 2;
  // CSS conic-gradient の 0deg=12時方向・時計回り → atan2 座標系（0=3時, 反時計）への変換。
  const markerAngleDeg = 90 - hsl.h;
  const markerAngleRad = (markerAngleDeg * Math.PI) / 180;
  const markerX = WHEEL_SIZE / 2 + markerR * Math.cos(markerAngleRad);
  const markerY = WHEEL_SIZE / 2 - markerR * Math.sin(markerAngleRad);

  // 明度スライダーのグラデーション: 現在の hue・彩度で l=0〜100。
  const sliderBg = `linear-gradient(to right, hsl(${hsl.h},${hsl.s}%,0%), hsl(${hsl.h},${hsl.s}%,50%), hsl(${hsl.h},${hsl.s}%,100%))`;

  // 現在の hex（swatch と aria ラベルに使用）。
  const currentHex = hslToHex(hsl.h, hsl.s, hsl.l);

  return (
    <div ref={containerRef} className={styles.container} role="group" aria-label="カラーピッカー">
      {/* ===== 色相環（SVG ラップ conic-gradient）===== */}
      {/* aria-hidden: 装飾的要素。キーボード操作は hex 入力欄で担保する。 */}
      <div className={styles.wheelWrapper} aria-hidden="true">
        <svg
          width={WHEEL_SIZE}
          height={WHEEL_SIZE}
          className={styles.wheelSvg}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerUp}
          style={{ cursor: "crosshair" }}
        >
          <defs>
            {/* リング形状のクリッパー: 外円 - 内円（evenodd で穴を作る）*/}
            <clipPath id="ring-clip">
              <path
                d={`
                  M ${WHEEL_SIZE / 2} ${WHEEL_SIZE / 2 - OUTER_R}
                  A ${OUTER_R} ${OUTER_R} 0 1 1 ${WHEEL_SIZE / 2 - 0.001} ${WHEEL_SIZE / 2 - OUTER_R}
                  Z
                  M ${WHEEL_SIZE / 2} ${WHEEL_SIZE / 2 - INNER_R}
                  A ${INNER_R} ${INNER_R} 0 1 0 ${WHEEL_SIZE / 2 - 0.001} ${WHEEL_SIZE / 2 - INNER_R}
                  Z
                `}
                fillRule="evenodd"
              />
            </clipPath>
          </defs>

          {/* conic-gradient を foreignObject 経由で描画（SVG 内 CSS gradient の代替手法）*/}
          <foreignObject x="0" y="0" width={WHEEL_SIZE} height={WHEEL_SIZE} clipPath="url(#ring-clip)">
            <div
              style={{
                width: `${WHEEL_SIZE}px`,
                height: `${WHEEL_SIZE}px`,
                borderRadius: "50%",
                background:
                  "conic-gradient(from 0deg, hsl(0,100%,50%), hsl(30,100%,50%), hsl(60,100%,50%), hsl(90,100%,50%), hsl(120,100%,50%), hsl(150,100%,50%), hsl(180,100%,50%), hsl(210,100%,50%), hsl(240,100%,50%), hsl(270,100%,50%), hsl(300,100%,50%), hsl(330,100%,50%), hsl(360,100%,50%))",
              }}
            />
          </foreignObject>

          {/* 現在 hue マーカー（白丸、現在色で塗りつぶし）*/}
          <circle
            cx={markerX}
            cy={markerY}
            r={8}
            fill={currentHex}
            stroke="white"
            strokeWidth={2}
            style={{ filter: "drop-shadow(0 1px 3px rgba(0,0,0,0.5))", pointerEvents: "none" }}
          />
        </svg>
      </div>

      {/* ===== 明度スライダー ===== */}
      <div className={styles.sliderRow}>
        <label className={styles.sliderLabel} htmlFor="cw-lightness">
          明度
        </label>
        <input
          id="cw-lightness"
          type="range"
          min={5}
          max={95}
          value={hsl.l}
          onChange={handleLightnessChange}
          className={styles.slider}
          style={{ background: sliderBg }}
          aria-label="明度"
        />
        <span className={styles.sliderValue}>{hsl.l}%</span>
      </div>

      {/* ===== hex 入力欄 ===== */}
      <div className={styles.hexRow}>
        {/* 現在色のプレビュースウォッチ — 装飾専用 */}
        <span className={styles.swatch} style={{ background: currentHex }} aria-hidden="true" />
        <input
          type="text"
          className={styles.hexInput}
          value={hexInput}
          onChange={handleHexChange}
          aria-label="色（16進）"
          maxLength={7}
          spellCheck={false}
          autoComplete="off"
        />
      </div>
    </div>
  );
}
