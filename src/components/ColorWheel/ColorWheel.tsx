// src/components/ColorWheel/ColorWheel.tsx
import { useEffect, useId, useRef, useState, type ChangeEvent, type PointerEvent as ReactPointerEvent } from "react";
import { hexToHsv, hsvToHex } from "../../utils/color";
import styles from "./ColorWheel.module.css";

/**
 * `ColorWheel` コンポーネントの props 型。
 *
 * @see {@link ColorWheel}
 */
export type ColorWheelProps = {
  /**
   * 現在の色（`#RRGGBB` 形式の CSS hex カラー）。
   * 初期値として内部 HSV 状態を初期化するために使用する。
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
const WHEEL_SIZE = 200; // px — SVG コンテナの一辺
const OUTER_R = 90; // 外径（px）
const INNER_R = 64; // 内径（px）— リング幅 = OUTER_R - INNER_R = 26px

// SV スクエアの寸法: 内径の正方形（対角線が内径の円に内接）。
// 内径円の半径 = INNER_R → 内接正方形の一辺 = INNER_R * √2
const SV_SIZE = Math.floor(INNER_R * Math.SQRT2) - 4; // 4px のマージン

/** HSV 型エイリアス（内部状態）。 */
type Hsv = { h: number; s: number; v: number };

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

/** 値を [min, max] にクランプするヘルパー。 */
const clamp = (val: number, min: number, max: number): number => Math.max(min, Math.min(max, val));

/**
 * 依存ゼロの自前カラーピッカーコンポーネント（HSV カラーサークル）。
 *
 * @remarks
 * - **色相リング**: `conic-gradient` の SVG ラップで 360° のリングを描画。クリック / ドラッグ位置の
 *   角度から hue（0–360）を算出し、現在 hue のマーカー（白丸）をリング上に表示する。
 * - **SV スクエア**: リング内側に正方形。横方向に 白→純色、縦方向に 透明→黒 の2レイヤーで
 *   HSV の彩度（s）・明度（v）を操作する。ハンドル（小円）を (s, v) 位置に表示。
 * - **hex 入力欄**: 6桁 hex を直接入力可能。妥当な値で `onChange` を呼ぶ。
 *   キーボードのみでも色指定できるためアクセシビリティを確保する。
 * - 内部状態は HSV で保持し、各ハンドラで `hsvToHex` して `onChange` を呼ぶ。
 * - 初期値は `hexToHsv(color)` で設定。
 * - ポップオーバーとして表示される想定（位置は使用側が制御する）。
 *   外側クリック / Esc で `onClose` を呼ぶ。
 * - 入場アニメーション: `dropdownEnter`（opacity + scale 0.96→1, ~0.18s）。
 * - `prefers-reduced-motion: reduce` ではアニメーションなし。
 *
 * @param props - {@link ColorWheelProps}
 */
export function ColorWheel({ color, onChange, onClose }: ColorWheelProps) {
  // useId: 同一ページに複数の ColorWheel が同時に描画されてもクリッパー id が衝突しないよう
  // React が生成するコンポーネント固有の id を使用する。
  const uid = useId();
  const ringClipId = `ring-clip-${uid}`;

  // 初期 HSV は props.color から算出する。
  const initial = hexToHsv(color);
  const [hsv, setHsv] = useState<Hsv>({ h: initial.h, s: initial.s, v: initial.v });

  // hex 入力フィールドの制御値。入力途中の文字列（例: "#ff"）を保持するため hsv とは分離する。
  const [hexInput, setHexInput] = useState(hsvToHex(initial.h, initial.s, initial.v));

  const containerRef = useRef<HTMLDivElement>(null);
  // ドラッグ状態は ref で管理（setState を経ない = 再描画を引き起こさない）。
  const isDraggingRing = useRef(false);
  const isDraggingSv = useRef(false);

  // SV スクエアの DOM 参照（ポインター座標を要素ローカル座標に変換するため）。
  const svRef = useRef<HTMLDivElement>(null);

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
  // stopImmediatePropagation: ColorWheel が開いている状態で Esc を押したとき、
  // 背後にある Modal の keydown リスナーまで伝播して二重に onClose が呼ばれることを防ぐ。
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        e.stopImmediatePropagation();
        onClose();
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  // ===== 内部ヘルパー: HSV を更新し onChange / hex 入力欄を同期する =====
  // useCallback を使わず React Compiler の最適化に委ねる（eslint-plugin-react-hooks v7 に準拠）。
  const applyHsv = (next: Hsv) => {
    setHsv(next);
    const hex = hsvToHex(next.h, next.s, next.v);
    onChange(hex);
    setHexInput(hex);
  };

  // ===== 色相リングインタラクション =====

  /**
   * SVG コンテナ上のポインター座標から色相を算出して applyHsv を呼ぶ共通ヘルパー。
   *
   * @param clientX - ポインターのビューポート X 座標
   * @param clientY - ポインターのビューポート Y 座標
   */
  const applyHueFromPointer = (clientX: number, clientY: number) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    // wheelWrapper の padding (4px) を考慮した SVG 内の中心座標を計算。
    const svgLeft = rect.left + 4; // .wheelWrapper の padding-left
    const svgTop = rect.top + 4; // .wheelWrapper の padding-top
    const cx = clientX - svgLeft - WHEEL_SIZE / 2;
    const cy = clientY - svgTop - WHEEL_SIZE / 2;
    const newHue = Math.round(angleFromCenter(cx, cy));
    applyHsv({ ...hsv, h: newHue });
  };

  const handleRingPointerDown = (e: ReactPointerEvent<SVGSVGElement>) => {
    isDraggingRing.current = true;
    // setPointerCapture: jsdom 未実装のため optional chaining でガード。
    (e.currentTarget as SVGSVGElement).setPointerCapture?.(e.pointerId);
    applyHueFromPointer(e.clientX, e.clientY);
  };

  const handleRingPointerMove = (e: ReactPointerEvent<SVGSVGElement>) => {
    if (!isDraggingRing.current) return;
    applyHueFromPointer(e.clientX, e.clientY);
  };

  const handleRingPointerUp = () => {
    isDraggingRing.current = false;
  };

  // ===== SV スクエアインタラクション =====

  /**
   * SV スクエア上のポインター座標から彩度・明度を算出して applyHsv を呼ぶ共通ヘルパー。
   *
   * @param clientX - ポインターのビューポート X 座標
   * @param clientY - ポインターのビューポート Y 座標
   */
  const applySvFromPointer = (clientX: number, clientY: number) => {
    if (!svRef.current) return;
    const rect = svRef.current.getBoundingClientRect();
    const x = clientX - rect.left;
    const y = clientY - rect.top;
    const newS = Math.round(clamp((x / rect.width) * 100, 0, 100));
    const newV = Math.round(clamp((1 - y / rect.height) * 100, 0, 100));
    applyHsv({ ...hsv, s: newS, v: newV });
  };

  const handleSvPointerDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    isDraggingSv.current = true;
    // setPointerCapture: jsdom 未実装のため optional chaining でガード。
    (e.currentTarget as HTMLDivElement).setPointerCapture?.(e.pointerId);
    applySvFromPointer(e.clientX, e.clientY);
  };

  const handleSvPointerMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (!isDraggingSv.current) return;
    applySvFromPointer(e.clientX, e.clientY);
  };

  const handleSvPointerUp = () => {
    isDraggingSv.current = false;
  };

  // ===== hex 入力 =====

  const handleHexChange = (e: ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value;
    setHexInput(raw);
    // # + 6桁 hex の形式で妥当なときのみ内部状態を更新する。
    const match = /^#([0-9a-fA-F]{6})$/.exec(raw.trim());
    if (match) {
      const parsed = hexToHsv(raw.trim());
      const next: Hsv = { h: parsed.h, s: parsed.s, v: parsed.v };
      setHsv(next);
      onChange(hsvToHex(next.h, next.s, next.v));
      // hex 入力欄は raw のまま保持（ユーザーが入力中の値を書き換えない）。
    }
  };

  // ===== マーカー位置の計算（色相リング）=====
  // 現在 hue のリング中央（半径 = (OUTER_R + INNER_R) / 2）上の座標を算出する。
  const markerR = (OUTER_R + INNER_R) / 2;
  // CSS conic-gradient の 0deg=12時方向・時計回り → atan2 座標系（0=3時, 反時計）への変換。
  const markerAngleDeg = 90 - hsv.h;
  const markerAngleRad = (markerAngleDeg * Math.PI) / 180;
  const markerX = WHEEL_SIZE / 2 + markerR * Math.cos(markerAngleRad);
  const markerY = WHEEL_SIZE / 2 - markerR * Math.sin(markerAngleRad);

  // ===== SV スクエアの背景 =====
  // 上レイヤー: 横方向に 白→現在 hue の純色
  // 下レイヤー: 縦方向に 透明→黒
  // 「白→純色」の純色は HSL(h, 100%, 50%) で近似（HSV の s=100, v=100 に相当する表示色）。
  const pureColor = `hsl(${hsv.h} 100% 50%)`;
  const svBgSaturation = `linear-gradient(to right, #fff, ${pureColor})`;
  const svBgValue = "linear-gradient(to top, #000, transparent)";

  // SV ハンドルの位置（0–100% で指定）。
  const handleLeft = `${hsv.s}%`;
  const handleTop = `${100 - hsv.v}%`;

  // ハンドル枠色: 明度（v）が低い場合は白、高い場合は黒で視認性を確保する。
  const handleBorderColor = hsv.v < 50 ? "rgba(255,255,255,0.8)" : "rgba(0,0,0,0.5)";

  // 現在の hex（swatch と aria ラベルに使用）。
  const currentHex = hsvToHex(hsv.h, hsv.s, hsv.v);

  return (
    <div ref={containerRef} className={styles.container} role="group" aria-label="カラーピッカー">
      {/* ===== 色相リング（SVG ラップ conic-gradient）+ SV スクエア ===== */}
      {/* aria-hidden: 装飾的要素。キーボード操作は hex 入力欄で担保する。 */}
      <div className={styles.wheelWrapper} aria-hidden="true">
        {/* 色相リング SVG */}
        <svg
          width={WHEEL_SIZE}
          height={WHEEL_SIZE}
          className={styles.wheelSvg}
          onPointerDown={handleRingPointerDown}
          onPointerMove={handleRingPointerMove}
          onPointerUp={handleRingPointerUp}
          onPointerCancel={handleRingPointerUp}
          style={{ cursor: "crosshair" }}
        >
          <defs>
            {/* リング形状のクリッパー: 外円 - 内円（evenodd で穴を作る）*/}
            <clipPath id={ringClipId}>
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
          <foreignObject x="0" y="0" width={WHEEL_SIZE} height={WHEEL_SIZE} clipPath={`url(#${ringClipId})`}>
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

        {/* SV スクエア: 色相リングの内側に絶対配置 */}
        {/* pointer イベントは SVG と重なると SVG が取るため、SV 専用の div で独立して捕捉する。 */}
        <div
          ref={svRef}
          className={styles.svSquare}
          style={{
            width: SV_SIZE,
            height: SV_SIZE,
            // リング中心に配置: top/left = (WHEEL_SIZE - SV_SIZE) / 2 + padding(4px)
            top: (WHEEL_SIZE - SV_SIZE) / 2 + 4,
            left: (WHEEL_SIZE - SV_SIZE) / 2 + 4,
          }}
          onPointerDown={handleSvPointerDown}
          onPointerMove={handleSvPointerMove}
          onPointerUp={handleSvPointerUp}
          onPointerCancel={handleSvPointerUp}
        >
          {/* 背景レイヤー1: 白→純色（横方向・彩度軸）*/}
          <div className={styles.svLayerSat} style={{ background: svBgSaturation }} />
          {/* 背景レイヤー2: 透明→黒（縦方向・明度軸）*/}
          <div className={styles.svLayerVal} style={{ background: svBgValue }} />
          {/* SV ハンドル（小円）: (s, v) の位置を示す */}
          <div
            className={styles.svHandle}
            style={{
              left: handleLeft,
              top: handleTop,
              borderColor: handleBorderColor,
              background: currentHex,
            }}
          />
        </div>
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
