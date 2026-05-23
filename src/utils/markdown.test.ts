import { parseMarkdown, buildMarkdown } from "./markdown";
import type { Project } from "../types";

test("簡易形式: 本文からキャラを自動登録", () => {
  const { project, skippedLines } = parseMarkdown("霊夢: こんにちは\n魔理沙: やあ\n霊夢: またね");
  expect(project.characters.map((c) => c.name)).toEqual(["霊夢", "魔理沙"]);
  expect(project.lines).toHaveLength(3);
  expect(project.lines[0]!.characterId).toBe(project.characters[0]!.id);
  expect(project.lines[2]!.characterId).toBe(project.characters[0]!.id);
  expect(skippedLines).toBe(0);
});

test("完全形式: フロントマターの色定義を優先", () => {
  const md = [
    "---", "project: 第1回解説", "characters:",
    "  - name: 霊夢", '    color: "#FF6B6B"',
    "  - name: 魔理沙", '    color: "#FFB347"',
    "---", "", "霊夢: やあ", "魔理沙: どうも",
  ].join("\n");
  const { project } = parseMarkdown(md);
  expect(project.projectName).toBe("第1回解説");
  expect(project.characters[0]).toMatchObject({ name: "霊夢", color: "#FF6B6B" });
  expect(project.characters[1]).toMatchObject({ name: "魔理沙", color: "#FFB347" });
});

test("フロントマター未定義のキャラが本文に出たら自動追加", () => {
  const md = [
    "---", "project: P", "characters:", "  - name: 霊夢", '    color: "#FF6B6B"', "---",
    "霊夢: やあ", "ナレーター: 補足です",
  ].join("\n");
  const { project } = parseMarkdown(md);
  expect(project.characters.map((c) => c.name)).toEqual(["霊夢", "ナレーター"]);
});

test("空行と # 行は無視、: スペース区切りでない行はスキップ数に計上", () => {
  const { project, skippedLines } = parseMarkdown(
    "# 見出し\n\n霊夢: あ\nコロンなしの不正行\n魔理沙:行末コロンのみ\n魔理沙: い"
  );
  expect(project.lines.map((l) => l.text)).toEqual(["あ", "い"]);
  expect(skippedLines).toBe(2); // 「コロンなし」「行末コロンのみ（: スペースでない）」
});

test("半角コロンを含むセリフは最初の : スペースだけで分割", () => {
  const { project } = parseMarkdown("霊夢: 時刻は12:00だ");
  expect(project.lines[0]!.text).toBe("時刻は12:00だ");
});

test("閉じない壊れたフロントマターは本文として扱い、パースを継続する", () => {
  // 閉じ --- が無い → フロントマター検出に失敗 → 全体を本文として処理
  const { project } = parseMarkdown("---\nproject: P\n霊夢: やあ");
  expect(project.characters.map((c) => c.name)).toEqual(["project", "霊夢"]);
  // ※ "project: P" も `名前: テキスト` として拾われる。閉じ忘れ時の妥当なフォールバック。
  expect(project.lines.map((l) => l.text)).toEqual(["P", "やあ"]);
});

test("parseMarkdown は孤立 \\r（旧 Mac 改行）を \\n として扱う", () => {
  // \r だけで区切られた行も正しく分割・パースされる
  const { project } = parseMarkdown("霊夢: やあ\r魔理沙: どうも");
  expect(project.lines.map((l) => l.text)).toEqual(["やあ", "どうも"]);
});

test("buildMarkdown の projectName に改行が含まれてもフロントマターが壊れない", () => {
  const original: Project = {
    version: 1,
    projectName: "タイトル\n第2行",
    characters: [{ id: "c1", name: "霊夢", color: "#FF6B6B" }],
    lines: [{ id: "l1", characterId: "c1", text: "やあ" }],
  };
  const md = buildMarkdown(original);
  // 閉じ --- がただ1つ存在し、フロントマターが壊れていないこと
  const fmMatch = md.match(/^---\n([\s\S]*?)\n---\n/);
  expect(fmMatch).not.toBeNull();
  // round-trip でプロジェクト名が1行に収まっている（改行はスペースに置換）
  const { project: restored } = parseMarkdown(md);
  expect(restored.projectName).toBe("タイトル 第2行");
});

test("buildMarkdown は完全形式で round-trip できる（色は保持）", () => {
  const original: Project = {
    version: 1, projectName: "P",
    characters: [
      { id: "c1", name: "霊夢", color: "#FF6B6B" },
      { id: "c2", name: "魔理沙", color: "#FFB347" },
    ],
    lines: [
      { id: "l1", characterId: "c1", text: "やあ" },
      { id: "l2", characterId: "c2", text: "どうも" },
    ],
  };
  const md = buildMarkdown(original);
  const { project: restored } = parseMarkdown(md);
  expect(restored.projectName).toBe("P");
  expect(restored.characters.map((c) => [c.name, c.color])).toEqual([
    ["霊夢", "#FF6B6B"], ["魔理沙", "#FFB347"],
  ]);
  expect(restored.lines.map((l) => l.text)).toEqual(["やあ", "どうも"]);
  // ID は保持されない（新規採番）
  expect(restored.characters[0]!.id).not.toBe("c1");
});
