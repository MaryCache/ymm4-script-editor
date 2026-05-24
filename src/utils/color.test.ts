import { colorForIndex, hexToHsv, hsvToHex, PALETTE } from "./color";

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

// ===== hexToHsv =====

test("hexToHsv: 赤 #ff0000 → { h:0, s:100, v:100 }", () => {
  expect(hexToHsv("#ff0000")).toEqual({ h: 0, s: 100, v: 100 });
});

test("hexToHsv: 白 #ffffff → { h:0, s:0, v:100 }", () => {
  expect(hexToHsv("#ffffff")).toEqual({ h: 0, s: 0, v: 100 });
});

test("hexToHsv: 黒 #000000 → { h:0, s:0, v:0 }", () => {
  expect(hexToHsv("#000000")).toEqual({ h: 0, s: 0, v: 0 });
});

test("hexToHsv: #107dc8 → h が 0-360, s/v が 0-100 の範囲内", () => {
  const { h, s, v } = hexToHsv("#107dc8");
  expect(h).toBeGreaterThanOrEqual(0);
  expect(h).toBeLessThanOrEqual(360);
  expect(s).toBeGreaterThanOrEqual(0);
  expect(s).toBeLessThanOrEqual(100);
  expect(v).toBeGreaterThanOrEqual(0);
  expect(v).toBeLessThanOrEqual(100);
});

test("hexToHsv: 大文字 #FF0000 も受け入れる", () => {
  expect(hexToHsv("#FF0000")).toEqual({ h: 0, s: 100, v: 100 });
});

test("hexToHsv: 不正な値はフォールバック { h:0, s:0, v:0 }", () => {
  expect(hexToHsv("invalid")).toEqual({ h: 0, s: 0, v: 0 });
  expect(hexToHsv("#gg0000")).toEqual({ h: 0, s: 0, v: 0 });
  expect(hexToHsv("")).toEqual({ h: 0, s: 0, v: 0 });
  expect(hexToHsv("#12345")).toEqual({ h: 0, s: 0, v: 0 });
});

// ===== hsvToHex =====

test("hsvToHex: { h:0, s:100, v:100 } → #ff0000", () => {
  expect(hsvToHex(0, 100, 100)).toBe("#ff0000");
});

test("hsvToHex: { h:0, s:0, v:100 } → #ffffff", () => {
  expect(hsvToHex(0, 0, 100)).toBe("#ffffff");
});

test("hsvToHex: { h:0, s:0, v:0 } → #000000", () => {
  expect(hsvToHex(0, 0, 0)).toBe("#000000");
});

test("hsvToHex: 出力は常に # + 6桁小文字", () => {
  const result = hsvToHex(120, 60, 80);
  expect(result).toMatch(/^#[0-9a-f]{6}$/);
});

// h=360 は色相環の境界値（360 === 0 で赤）。#ff0000 を返すことを保証する。
test("hsvToHex: h=360 は h=0 と同じ赤 #ff0000 を返す", () => {
  expect(hsvToHex(360, 100, 100)).toBe("#ff0000");
});

// ===== hex → hsv → hex 往復テスト =====
// 丸め誤差の許容: h/s/v を整数丸めした後に hex へ戻す際、2段階の丸め誤差が累積するため ±2/255 を許容する。

test("往復テスト: #ff0000 → hsv → hex がほぼ一致", () => {
  const { h, s, v } = hexToHsv("#ff0000");
  expect(hsvToHex(h, s, v)).toBe("#ff0000");
});

test("往復テスト: #ffffff → hsv → hex がほぼ一致", () => {
  const { h, s, v } = hexToHsv("#ffffff");
  expect(hsvToHex(h, s, v)).toBe("#ffffff");
});

test("往復テスト: #000000 → hsv → hex がほぼ一致", () => {
  const { h, s, v } = hexToHsv("#000000");
  expect(hsvToHex(h, s, v)).toBe("#000000");
});

test("往復テスト: #107dc8 → hsv → hex が ±2/255 誤差以内", () => {
  // HSV 成分を整数丸めした後に hex へ戻す際、2段階の丸め誤差が累積するため ±2 を許容する。
  const original = "#107dc8";
  const { h, s, v } = hexToHsv(original);
  const back = hsvToHex(h, s, v);
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

test("往復テスト: パレット全色で hex→hsv→hex が ±2/255 誤差以内", () => {
  // HSV 成分を整数丸めした後に hex へ戻す際、2段階の丸め誤差が累積するため ±2 を許容する。
  const parse = (hex: string) => ({
    r: parseInt(hex.slice(1, 3), 16),
    g: parseInt(hex.slice(3, 5), 16),
    b: parseInt(hex.slice(5, 7), 16),
  });
  for (const hex of PALETTE) {
    const { h, s, v } = hexToHsv(hex);
    const back = hsvToHex(h, s, v);
    const orig = parse(hex.toLowerCase());
    const result = parse(back);
    expect(Math.abs(orig.r - result.r)).toBeLessThanOrEqual(2);
    expect(Math.abs(orig.g - result.g)).toBeLessThanOrEqual(2);
    expect(Math.abs(orig.b - result.b)).toBeLessThanOrEqual(2);
  }
});
