// src/utils/color.ts

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
