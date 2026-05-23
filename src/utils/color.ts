// src/utils/color.ts

export const PALETTE = [
  "#FF6B6B", "#FFB347", "#87CEEB", "#A0E7A0", "#C792EA",
  "#FFD166", "#6BCB77", "#4D96FF", "#FF9A8B", "#B388EB",
] as const;

// index を 0..length-1 に正規化（負数・範囲外でも undefined を返さない）。
// 注意: フロントマターで手動指定された色とは衝突回避を保証しない（自動付与は
// 出現順の巡回のみ。手動色が偶然パレット内の色と一致すると同色になりうる）。
export const colorForIndex = (index: number): string =>
  PALETTE[((index % PALETTE.length) + PALETTE.length) % PALETTE.length]!;
