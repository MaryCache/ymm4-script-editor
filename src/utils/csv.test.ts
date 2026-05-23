import { buildLineCSV, buildCSVText, buildCSV } from "./csv";
import type { Project } from "../types";

const project: Project = {
  version: 1,
  projectName: "テスト",
  characters: [
    { id: "c1", name: "霊夢", color: "#FF6B6B" },
    { id: "c2", name: "魔理沙", color: "#FFB347" },
  ],
  lines: [
    { id: "l1", characterId: "c1", text: "今日は、解説するわ" },
    { id: "l2", characterId: "c2", text: "覚えろよ" },
  ],
};

test("buildLineCSV は 名前,セリフ 形式（コンマは全角化）", () => {
  expect(buildLineCSV(project.lines[0]!, project.characters)).toBe("霊夢,今日は，解説するわ");
});

test("buildLineCSV は改行/CR を半角スペースに畳む", () => {
  expect(buildLineCSV({ id: "x", characterId: "c1", text: "あ\nい\r\nう" }, project.characters))
    .toBe("霊夢,あ い う");
});

test("不明な characterId のとき名前は空", () => {
  expect(buildLineCSV({ id: "x", characterId: "none", text: "あ" }, project.characters)).toBe(",あ");
});

test("buildCSVText は全行を改行区切り・BOMなし", () => {
  expect(buildCSVText(project)).toBe("霊夢,今日は，解説するわ\n魔理沙,覚えろよ");
});

test("buildCSV は先頭に BOM が付く", () => {
  expect(buildCSV(project).startsWith("﻿")).toBe(true);
  expect(buildCSV(project)).toBe("﻿" + buildCSVText(project));
});
