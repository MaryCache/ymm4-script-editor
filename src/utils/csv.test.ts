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

test("buildLineCSV は 名前,セリフ 形式（ASCII カンマは全角化）", () => {
  // ASCII カンマが含まれる場合のみ全角化される
  expect(
    buildLineCSV({ id: "x", characterId: "c1", text: "今日は,解説するわ" }, project.characters)
  ).toBe("霊夢,今日は，解説するわ");
});

test("buildLineCSV は読点「、」を変換しない（データ保持）", () => {
  // 読点は CSV 列区切りにならないため変換不要・ユーザー表記を保持
  expect(
    buildLineCSV({ id: "x", characterId: "c1", text: "あ、い" }, project.characters)
  ).toBe("霊夢,あ、い");
});

test("buildLineCSV は改行/CR を半角スペースに畳む", () => {
  expect(buildLineCSV({ id: "x", characterId: "c1", text: "あ\nい\r\nう" }, project.characters))
    .toBe("霊夢,あ い う");
});

test("buildLineCSV はキャラ名の ASCII カンマも全角化する（名前列の列ズレ防止）", () => {
  const charactersWithComma = [{ id: "cx", name: "田中,太郎", color: "#FF6B6B" }];
  expect(
    buildLineCSV({ id: "x", characterId: "cx", text: "セリフ" }, charactersWithComma)
  ).toBe("田中，太郎,セリフ");
});

test("不明な characterId のとき名前は空", () => {
  expect(buildLineCSV({ id: "x", characterId: "none", text: "あ" }, project.characters)).toBe(",あ");
});

test("buildCSVText は全行を改行区切り・BOMなし", () => {
  // project の lines は読点を含む（変換されず保持される）
  expect(buildCSVText(project)).toBe("霊夢,今日は、解説するわ\n魔理沙,覚えろよ");
});

test("buildCSV は先頭に BOM が付く", () => {
  expect(buildCSV(project).startsWith("﻿")).toBe(true);
  expect(buildCSV(project)).toBe("﻿" + buildCSVText(project));
});
