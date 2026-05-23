import { parseProjectFile, sanitizeFilename } from "./file";
import type { Project } from "../types";

const valid: Project = {
  version: 1, projectName: "P",
  characters: [{ id: "c1", name: "霊夢", color: "#FF6B6B" }],
  lines: [{ id: "l1", characterId: "c1", text: "やあ" }],
};

test("正常な Project はそのまま返す", () => {
  expect(parseProjectFile(valid)).toEqual(valid);
});

test("version が 1 でなければ例外", () => {
  expect(() => parseProjectFile({ ...valid, version: 2 })).toThrow();
});

test("characters が配列でなければ例外", () => {
  expect(() => parseProjectFile({ ...valid, characters: "x" })).toThrow();
});

test("lines 要素に必須フィールド欠落で例外", () => {
  expect(() => parseProjectFile({ ...valid, lines: [{ id: "l1" }] })).toThrow();
});

test("null / 文字列など非オブジェクトで例外", () => {
  expect(() => parseProjectFile(null)).toThrow();
  expect(() => parseProjectFile("nope")).toThrow();
});

// I-5: sanitizeFilename
test("sanitizeFilename: 通常の名前はそのまま返す", () => {
  expect(sanitizeFilename("台本タイトル")).toBe("台本タイトル");
});

test("sanitizeFilename: パス区切り文字はアンダースコアに置換する", () => {
  expect(sanitizeFilename("a/b\\c")).toBe("a_b_c");
});

test("sanitizeFilename: Windows 禁止文字はアンダースコアに置換する", () => {
  expect(sanitizeFilename('a:b*c?d"e<f>g|h')).toBe("a_b_c_d_e_f_g_h");
});

test("sanitizeFilename: 空文字列は untitled にフォールバックする", () => {
  expect(sanitizeFilename("")).toBe("untitled");
});

test("sanitizeFilename: 空白のみは untitled にフォールバックする", () => {
  expect(sanitizeFilename("   ")).toBe("untitled");
});

test("sanitizeFilename: 前後の空白はトリムする", () => {
  expect(sanitizeFilename("  タイトル  ")).toBe("タイトル");
});
