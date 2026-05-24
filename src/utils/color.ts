// src/utils/color.ts
// ===== HSL ↔ Hex 変換（ColorWheel 内部で使用）=====

/**
 * CSS hex カラー（`#RRGGBB`）を HSL 成分へ変換する純関数。
 *
 * @remarks
 * 不正な hex 文字列（長さ不一致・非 hex 文字を含む）を渡した場合、
 * `{ h: 0, s: 0, l: 0 }` を返す（安全なフォールバック）。
 * アルファチャンネル（`#RRGGBBAA`）は無視して `#RRGGBB` の先頭 6 桁のみを使用する。
 *
 * @param hex - `#RRGGBB` 形式の CSS カラー文字列（大文字・小文字いずれも可）
 * @returns h: 0–360, s: 0–100, l: 0–100 の HSL オブジェクト
 *
 * @example
 * ```ts
 * hexToHsl("#ff0000"); // => { h: 0, s: 100, l: 50 }
 * hexToHsl("#ffffff"); // => { h: 0, s: 0, l: 100 }
 * hexToHsl("invalid"); // => { h: 0, s: 0, l: 0 }
 * ```
 */
export const hexToHsl = (hex: string): { h: number; s: number; l: number } => {
  // バリデーション: # + 6桁 hex（または # + 8桁 hex のアルファ付きも受け入れる）
  const match = /^#([0-9a-fA-F]{6})([0-9a-fA-F]{2})?$/.exec(hex.trim());
  if (!match) return { h: 0, s: 0, l: 0 };

  // noUncheckedIndexedAccess: match[1] は必ず存在（正規表現上の保証）。
  const raw = match[1]!;
  const r = parseInt(raw.slice(0, 2), 16) / 255;
  const g = parseInt(raw.slice(2, 4), 16) / 255;
  const b = parseInt(raw.slice(4, 6), 16) / 255;

  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const delta = max - min;

  // Lightness
  const l = (max + min) / 2;

  // Saturation
  const s = delta === 0 ? 0 : delta / (1 - Math.abs(2 * l - 1));

  // Hue
  let h = 0;
  if (delta !== 0) {
    if (max === r) {
      h = 60 * (((g - b) / delta) % 6);
    } else if (max === g) {
      h = 60 * ((b - r) / delta + 2);
    } else {
      h = 60 * ((r - g) / delta + 4);
    }
  }
  if (h < 0) h += 360;

  return {
    h: Math.round(h),
    s: Math.round(s * 100),
    l: Math.round(l * 100),
  };
};

/**
 * HSL 成分を CSS hex カラー（`#rrggbb` 小文字）へ変換する純関数。
 *
 * @remarks
 * 各引数は範囲外でもクランプせずそのまま CSS 変換アルゴリズムで処理するが、
 * 想定入力は h: 0–360, s: 0–100, l: 0–100 である。
 * 出力は常に小文字 6 桁 hex（例: `"#ff0000"`）。
 *
 * @param h - 色相（0–360）
 * @param s - 彩度（0–100）
 * @param l - 明度（0–100）
 * @returns `#rrggbb` 形式の CSS カラー文字列（小文字）
 *
 * @example
 * ```ts
 * hslToHex(0, 100, 50);   // => "#ff0000"
 * hslToHex(0, 0, 100);    // => "#ffffff"
 * hslToHex(0, 0, 0);      // => "#000000"
 * ```
 */
export const hslToHex = (h: number, s: number, l: number): string => {
  const sn = s / 100;
  const ln = l / 100;

  // CSS Color Level 4 の HSL → RGB 変換アルゴリズム
  const c = (1 - Math.abs(2 * ln - 1)) * sn;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = ln - c / 2;

  // RGB 成分をセクター（60度刻み）ごとに決定する。
  // no-useless-assignment を避けるため条件式で一括代入する。
  // セクター: [0,60)→(c,x,0), [60,120)→(x,c,0), [120,180)→(0,c,x),
  //           [180,240)→(0,x,c), [240,300)→(x,0,c), [300,360)→(c,0,x)
  const r = h < 60 ? c : h < 120 ? x : h < 180 ? 0 : h < 240 ? 0 : h < 300 ? x : c;
  const g = h < 60 ? x : h < 120 ? c : h < 180 ? c : h < 240 ? x : h < 300 ? 0 : 0;
  const b = h < 60 ? 0 : h < 120 ? 0 : h < 180 ? x : h < 240 ? c : h < 300 ? c : x;

  const toHex = (n: number): string => {
    const val = Math.round((n + m) * 255);
    return Math.max(0, Math.min(255, val)).toString(16).padStart(2, "0");
  };

  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
};

/**
 * キャラクターへ自動付与するカラーパレット（10色）。
 *
 * @remarks
 * `as const` によりリテラル union 型として推論される。
 * `colorForIndex` の戻り値型 `(typeof PALETTE)[number]` によって
 * 呼び出し側が IDE 補完でリテラル値を確認できる。
 *
 * 注意: フロントマターで手動指定された色とのユニーク性は保証しない
 * （自動付与は出現順の巡回のみ）。
 *
 * @see {@link colorForIndex}
 */
export const PALETTE = [
  "#FF6B6B",
  "#FFB347",
  "#87CEEB",
  "#A0E7A0",
  "#C792EA",
  "#FFD166",
  "#6BCB77",
  "#4D96FF",
  "#FF9A8B",
  "#B388EB",
] as const;

/**
 * キャラクターインデックスをパレット内の色へ循環マッピングする。
 *
 * @remarks
 * 負数・範囲外インデックスでも `undefined` を返さず常に有効な色を返す。
 * 戻り値型を `(typeof PALETTE)[number]` にすることで、
 * 呼び出し側がリテラル union の補完を受けられる。
 *
 * 注意: フロントマターで手動指定された色とは衝突回避を保証しない
 * （自動付与は出現順の巡回のみ。手動色が偶然パレット内の色と一致すると同色になりうる）。
 *
 * @param index - キャラクター配列のインデックス（0 始まり、負数・範囲外も受け付ける）
 * @returns `PALETTE` 内の対応する CSS hex カラーリテラル
 *
 * @example
 * ```ts
 * colorForIndex(0);  // => "#FF6B6B"
 * colorForIndex(10); // => "#FF6B6B" (wrap-around)
 * colorForIndex(-1); // => "#B388EB" (last color)
 * ```
 *
 * @see {@link PALETTE}
 */
// index を 0..length-1 に正規化（負数・範囲外でも undefined を返さない）。
// 戻り値型を (typeof PALETTE)[number] にすることで、呼び出し側がリテラル union の
// 補完を受けられる（意図が型に出る）。
// 注意: フロントマターで手動指定された色とは衝突回避を保証しない（自動付与は
// 出現順の巡回のみ。手動色が偶然パレット内の色と一致すると同色になりうる）。
export const colorForIndex = (index: number): (typeof PALETTE)[number] =>
  PALETTE[((index % PALETTE.length) + PALETTE.length) % PALETTE.length]!;
