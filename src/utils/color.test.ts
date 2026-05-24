import { colorForIndex, hexToHsl, hslToHex, PALETTE } from "./color";

test("index 0 はパレット先頭の色", () => {
  expect(colorForIndex(0)).toBe(PALETTE[0]);
});

test("パレット長を超えると巡回する", () => {
  expect(colorForIndex(PALETTE.length)).toBe(PALETTE[0]);
  expect(colorForIndex(PALETTE.length + 1)).toBe(PALETTE[1]);
});

test("負の index でも undefined を返さず巡回する", () => {
  expect(colorForIndex(-1)).toBe(PALETTE[PALETTE.length - 1]);
});

test("すべて hex カラー形式", () => {
  for (const c of PALETTE) expect(c).toMatch(/^#[0-9A-Fa-f]{6}$/);
});

// ===== hexToHsl =====

test("hexToHsl: 赤 #ff0000 → { h:0, s:100, l:50 }", () => {
  expect(hexToHsl("#ff0000")).toEqual({ h: 0, s: 100, l: 50 });
});

test("hexToHsl: 白 #ffffff → { h:0, s:0, l:100 }", () => {
  expect(hexToHsl("#ffffff")).toEqual({ h: 0, s: 0, l: 100 });
});

test("hexToHsl: 黒 #000000 → { h:0, s:0, l:0 }", () => {
  expect(hexToHsl("#000000")).toEqual({ h: 0, s: 0, l: 0 });
});

test("hexToHsl: cyan #107dc8 → h が 0-360, s/l が 0-100 の範囲内", () => {
  const { h, s, l } = hexToHsl("#107dc8");
  expect(h).toBeGreaterThanOrEqual(0);
  expect(h).toBeLessThanOrEqual(360);
  expect(s).toBeGreaterThanOrEqual(0);
  expect(s).toBeLessThanOrEqual(100);
  expect(l).toBeGreaterThanOrEqual(0);
  expect(l).toBeLessThanOrEqual(100);
});

test("hexToHsl: 大文字 #FF0000 も受け入れる", () => {
  expect(hexToHsl("#FF0000")).toEqual({ h: 0, s: 100, l: 50 });
});

test("hexToHsl: 不正な値はフォールバック { h:0, s:0, l:0 }", () => {
  expect(hexToHsl("invalid")).toEqual({ h: 0, s: 0, l: 0 });
  expect(hexToHsl("#gg0000")).toEqual({ h: 0, s: 0, l: 0 });
  expect(hexToHsl("")).toEqual({ h: 0, s: 0, l: 0 });
  expect(hexToHsl("#12345")).toEqual({ h: 0, s: 0, l: 0 });
});

// ===== hslToHex =====

test("hslToHex: { h:0, s:100, l:50 } → #ff0000", () => {
  expect(hslToHex(0, 100, 50)).toBe("#ff0000");
});

test("hslToHex: { h:0, s:0, l:100 } → #ffffff", () => {
  expect(hslToHex(0, 0, 100)).toBe("#ffffff");
});

test("hslToHex: { h:0, s:0, l:0 } → #000000", () => {
  expect(hslToHex(0, 0, 0)).toBe("#000000");
});

test("hslToHex: 出力は常に # + 6桁小文字", () => {
  const result = hslToHex(120, 60, 40);
  expect(result).toMatch(/^#[0-9a-f]{6}$/);
});

// h=360 は色相環の境界値（360 === 0 で赤）。#ff0000 を返すことを保証する。
test("hslToHex: h=360 は h=0 と同じ赤 #ff0000 を返す", () => {
  expect(hslToHex(360, 100, 50)).toBe("#ff0000");
});

// ===== hex → hsl → hex 往復テスト =====

test("往復テスト: #ff0000 → hsl → hex がほぼ一致", () => {
  const { h, s, l } = hexToHsl("#ff0000");
  expect(hslToHex(h, s, l)).toBe("#ff0000");
});

test("往復テスト: #107dc8 → hsl → hex がほぼ一致（丸め誤差 ±2/255 以内）", () => {
  // HSL 成分を整数丸めした後に hex へ戻す際、2段階の丸め誤差が累積するため ±2 を許容する。
  const original = "#107dc8";
  const { h, s, l } = hexToHsl(original);
  const back = hslToHex(h, s, l);
  const parse = (hex: string) => ({
    r: parseInt(hex.slice(1, 3), 16),
    g: parseInt(hex.slice(3, 5), 16),
    b: parseInt(hex.slice(5, 7), 16),
  });
  const orig = parse(original);
  const result = parse(back);
  expect(Math.abs(orig.r - result.r)).toBeLessThanOrEqual(2);
  expect(Math.abs(orig.g - result.g)).toBeLessThanOrEqual(2);
  expect(Math.abs(orig.b - result.b)).toBeLessThanOrEqual(2);
});

test("往復テスト: パレット全色で hex→hsl→hex が ±2/255 誤差以内", () => {
  // HSL 成分を整数丸めした後に hex へ戻す際、2段階の丸め誤差が累積するため ±2 を許容する。
  const parse = (hex: string) => ({
    r: parseInt(hex.slice(1, 3), 16),
    g: parseInt(hex.slice(3, 5), 16),
    b: parseInt(hex.slice(5, 7), 16),
  });
  for (const hex of PALETTE) {
    const { h, s, l } = hexToHsl(hex);
    const back = hslToHex(h, s, l);
    const orig = parse(hex.toLowerCase());
    const result = parse(back);
    expect(Math.abs(orig.r - result.r)).toBeLessThanOrEqual(2);
    expect(Math.abs(orig.g - result.g)).toBeLessThanOrEqual(2);
    expect(Math.abs(orig.b - result.b)).toBeLessThanOrEqual(2);
  }
});
