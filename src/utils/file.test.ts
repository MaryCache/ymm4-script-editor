import { parseProjectFile, parseWorkspaceFile, sanitizeFilename } from "./file";
import type { Project, Workspace } from "../types";

const valid: Project = {
  version: 1,
  projectName: "P",
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

// M-3: 禁止文字のみからなる文字列（置換後が全アンダースコア）は untitled にフォールバックする
test("sanitizeFilename: 禁止文字のみの文字列はアンダースコア列になるが untitled にフォールバックする", () => {
  expect(sanitizeFilename("???")).toBe("untitled");
});

// ===== parseWorkspaceFile =====

const validEntry = {
  id: "entry-1",
  project: { version: 1, projectName: "P", characters: [], lines: [] } satisfies Project,
};

const validWs: Workspace = {
  version: 1,
  activeId: "entry-1",
  entries: [validEntry],
};

test("parseWorkspaceFile: 正常なワークスペースはそのまま返す", () => {
  expect(parseWorkspaceFile(validWs)).toEqual(validWs);
});

test("parseWorkspaceFile: 複数エントリでも正常に返す", () => {
  const entry2 = {
    id: "entry-2",
    project: { version: 1, projectName: "P2", characters: [], lines: [] } satisfies Project,
  };
  const ws: Workspace = { version: 1, activeId: "entry-2", entries: [validEntry, entry2] };
  expect(parseWorkspaceFile(ws)).toEqual(ws);
});

test("parseWorkspaceFile: version が 1 でなければ例外", () => {
  expect(() => parseWorkspaceFile({ ...validWs, version: 2 })).toThrow();
});

test("parseWorkspaceFile: activeId が string でなければ例外", () => {
  expect(() => parseWorkspaceFile({ ...validWs, activeId: 123 })).toThrow();
});

test("parseWorkspaceFile: entries が空配列なら例外", () => {
  expect(() => parseWorkspaceFile({ ...validWs, entries: [] })).toThrow();
});

test("parseWorkspaceFile: entries が配列でなければ例外", () => {
  expect(() => parseWorkspaceFile({ ...validWs, entries: "x" })).toThrow();
});

test("parseWorkspaceFile: entry.id が string でなければ例外", () => {
  const badEntry = { id: 123, project: { version: 1, projectName: "P", characters: [], lines: [] } };
  expect(() => parseWorkspaceFile({ ...validWs, entries: [badEntry] })).toThrow();
});

test("parseWorkspaceFile: entry.project が不正（version:2）なら例外", () => {
  const badEntry = { id: "entry-1", project: { version: 2, projectName: "P", characters: [], lines: [] } };
  expect(() => parseWorkspaceFile({ version: 1, activeId: "entry-1", entries: [badEntry] })).toThrow();
});

test("parseWorkspaceFile: activeId が entries に存在しなければ例外", () => {
  expect(() => parseWorkspaceFile({ ...validWs, activeId: "nonexistent-id" })).toThrow();
});

test("parseWorkspaceFile: null は例外", () => {
  expect(() => parseWorkspaceFile(null)).toThrow();
});

test("parseWorkspaceFile: 非オブジェクトは例外", () => {
  expect(() => parseWorkspaceFile("nope")).toThrow();
  expect(() => parseWorkspaceFile(42)).toThrow();
});
