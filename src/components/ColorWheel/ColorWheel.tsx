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

// ===== 寸法定数 =====
// リング全体の外径（px）。ポップオーバー内に収まる想定サイズ。
const RING_OUTER = 200;
// リング幅（px）。細めのドーナツにする。
const RING_WIDTH = 26;
// 内径（px）。
const RING_INNER = RING_OUTER - RING_WIDTH * 2;
// リング中心半径（マーカー配置用）。
const RING_MID_R = RING_OUTER / 2 - RING_WIDTH / 2;
// SV スクエアの四隅と内円のあいだに空ける半径方向の隙間（px）。
// 四隅をちょうど内円に接させると詰まって見えるため、少し内側に縮めて余白を持たせる。
const SV_GAP = 6;
// SV スクエアの一辺（px）。四隅が「内半径 − SV_GAP」の円に乗る大きさ（一辺 = その半径 × √2）。
const SV_SIZE = Math.round((RING_INNER / 2 - SV_GAP) * Math.SQRT2);

/** HSV 型エイリアス（内部状態）。 */
type Hsv = { h: number; s: number; v: number };

/** 値を [min, max] にクランプするヘルパー。 */
const clamp = (val: number, min: number, max: number): number => Math.max(min, Math.min(max, val));

/**
 * ポインター座標（要素中心基準）から色相角（0–360）を算出するヘルパー。
 *
 * @remarks
 * リング（`conic-gradient(from 0deg, ...)`）・マーカー（`rotate(h)`）はいずれも
 * 「12時=hue 0・時計回り」で定義しているため、atan2 の戻り値（0deg=3時方向）から
 * 90deg を加算して向きを合わせる（12時を 0、時計回りに増加させる）。
 *
 * @param cx - ポインターの x 座標（要素中心を 0 とした相対値）
 * @param cy - ポインターの y 座標（要素中心を 0 とした相対値、y 軸下向き正）
 * @returns 0–360 の色相角（deg）
 */
const angleFromCenter = (cx: number, cy: number): number => {
  const rad = Math.atan2(cy, cx);
  // atan2 の 0deg=3時 → +90 で 0deg=12時（上）に変換し、時計回り正。
  let deg = (rad * 180) / Math.PI + 90;
  if (deg < 0) deg += 360;
  if (deg >= 360) deg -= 360;
  return deg;
};

/**
 * 依存ゼロの自前カラーピッカーコンポーネント（HSV カラーサークル）。
 *
 * @remarks
 * - **色相リング（CSS ドーナツ）**: `div` に `conic-gradient` + CSS `mask` で真ん中をくり抜いた
 *   ドーナツ形のリングを描画。クリック / ドラッグ位置の角度から hue（0–360）を算出し、
 *   現在 hue のマーカー（白枠の小丸）をリング上に CSS `transform: rotate` で配置する。
 * - **SV スクエア**: リング内側に正方形。横方向に 白→純色（彩度軸）、縦方向に 透明→黒
 *   （明度軸）の2レイヤーで HSV の s・v を操作する。ハンドル（小円）を (s, v) 位置に表示。
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
  // useId: 同一ページに複数の ColorWheel が同時に描画されても id が衝突しないよう
  // React が生成するコンポーネント固有の id を使用する。
  // 現状は container div の id 属性にのみ付与し、aria-labelledby への接続は未実施。
  const uid = useId();
  const pickerId = `color-picker-${uid}`;

  // 初期 HSV は props.color から算出する。
  const initial = hexToHsv(color);
  const [hsv, setHsv] = useState<Hsv>({ h: initial.h, s: initial.s, v: initial.v });

  // hex 入力フィールドの制御値。入力途中の文字列（例: "#ff"）を保持するため hsv とは分離する。
  const [hexInput, setHexInput] = useState(hsvToHex(initial.h, initial.s, initial.v));

  const containerRef = useRef<HTMLDivElement>(null);
  // ドラッグ状態は ref で管理（setState を経ない = 再描画を引き起こさない）。
  const isDraggingRing = useRef(false);
  const isDraggingSv = useRef(false);

  // 色相リングの DOM 参照（ポインター座標を要素ローカル座標に変換するため）。
  const ringRef = useRef<HTMLDivElement>(null);
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
  // stopImmediatePropagation: 現状 ColorWheel は Modal 内では使用していないため
  // 二重 onClose は起こり得ないが、将来の内側配置に備えた防御的措置として残す。
  // 将来 Modal 内に置く場合は document リスナーの登録順依存になる点に注意。
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
   * リング div 上のポインター座標から色相を算出して applyHsv を呼ぶ共通ヘルパー。
   *
   * @param clientX - ポインターのビューポート X 座標
   * @param clientY - ポインターのビューポート Y 座標
   */
  const applyHueFromPointer = (clientX: number, clientY: number) => {
    if (!ringRef.current) return;
    const rect = ringRef.current.getBoundingClientRect();
    const cx = clientX - rect.left - rect.width / 2;
    const cy = clientY - rect.top - rect.height / 2;
    const newHue = Math.round(angleFromCenter(cx, cy));
    applyHsv({ ...hsv, h: newHue });
  };

  const handleRingPointerDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    isDraggingRing.current = true;
    // setPointerCapture: jsdom 未実装のため optional chaining でガード。
    (e.currentTarget as HTMLDivElement).setPointerCapture?.(e.pointerId);
    applyHueFromPointer(e.clientX, e.clientY);
  };

  const handleRingPointerMove = (e: ReactPointerEvent<HTMLDivElement>) => {
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

  // ===== SV スクエアの背景 =====
  // 上レイヤー: 横方向に 白→現在 hue の純色（彩度軸）
  // 下レイヤー: 縦方向に 透明→黒（明度軸）
  const pureColor = `hsl(${hsv.h} 100% 50%)`;
  const svBgSaturation = `linear-gradient(to right, #fff, ${pureColor})`;
  const svBgValue = "linear-gradient(to top, #000, transparent)";

  // SV ハンドルの位置（0–100% で指定）。
  const handleLeft = `${hsv.s}%`;
  const handleTop = `${100 - hsv.v}%`;

  // ハンドル枠色: 明度（v）が低い場合は白、高い場合は黒で視認性を確保する。
  const handleBorderColor = hsv.v < 50 ? "rgba(255,255,255,0.8)" : "rgba(0,0,0,0.5)";

  // 現在の hex（swatch に使用）。
  const currentHex = hsvToHex(hsv.h, hsv.s, hsv.v);

  // ===== 色相マーカーの角度（CSS rotate に使用）=====
  // リング conic-gradient は from 0deg（12時=赤）で開始、時計回り正。
  // hsv.h=0 → マーカーは 12時位置、hsv.h=90 → 3時位置…
  // rotate(deg) で div の 12時方向を基点に hue 分回す。
  // marker div は translateY(-RING_MID_R) で上端（12時）に突き出す形にするため:
  //   transform: rotate(hue deg) → hue=0 は 12時 → 正しい
  const markerRotate = hsv.h;

  return (
    <div ref={containerRef} id={pickerId} className={styles.container} role="group" aria-label="カラーピッカー">
      {/* ===== 色相リング + SV スクエア ===== */}
      {/* aria-hidden: 装飾的要素。キーボード操作は hex 入力欄で担保する。 */}
      <div className={styles.pickerArea} aria-hidden="true">
        {/* ===== 色相リング（CSS conic-gradient + mask でドーナツ型）===== */}
        {/* ポインターイベントは SV スクエアより背面（z-index 低）で受け取る。 */}
        <div
          ref={ringRef}
          className={styles.ring}
          style={{ width: RING_OUTER, height: RING_OUTER }}
          onPointerDown={handleRingPointerDown}
          onPointerMove={handleRingPointerMove}
          onPointerUp={handleRingPointerUp}
          onPointerCancel={handleRingPointerUp}
        >
          {/* 色相マーカー: 現在 hue 位置を示す白枠の小丸。
              リング中心を軸に markerRotate deg 回転させ、上端（12時方向）に突き出す。 */}
          <div
            className={styles.hueMarker}
            style={{
              transform: `rotate(${markerRotate}deg) translateY(-${RING_MID_R}px)`,
            }}
          />
        </div>

        {/* ===== SV スクエア: リング内側に絶対配置（z-index でリングより前面）===== */}
        <div
          ref={svRef}
          className={styles.svSquare}
          style={{
            width: SV_SIZE,
            height: SV_SIZE,
            // リング中心に配置: top/left = (RING_OUTER - SV_SIZE) / 2
            top: (RING_OUTER - SV_SIZE) / 2,
            left: (RING_OUTER - SV_SIZE) / 2,
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
