import { colorForIndex, PALETTE } from "./color";

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
