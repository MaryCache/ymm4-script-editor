import { parseProjectFile } from "./file";
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
