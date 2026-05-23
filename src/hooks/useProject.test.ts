// src/hooks/useProject.test.ts
import { renderHook, act } from "@testing-library/react";
import { useProject, STORAGE_KEY } from "./useProject";

beforeEach(() => localStorage.clear());

test("初期状態はデフォルトプロジェクト（キャラ0・ライン0）", () => {
  const { result } = renderHook(() => useProject());
  expect(result.current.project.characters).toHaveLength(0);
  expect(result.current.project.lines).toHaveLength(0);
});

test("addCharacter で名前と自動色付きキャラが増える", () => {
  const { result } = renderHook(() => useProject());
  act(() => result.current.addCharacter("霊夢"));
  expect(result.current.project.characters[0]!.name).toBe("霊夢");
  expect(result.current.project.characters[0]!.color).toMatch(/^#[0-9A-Fa-f]{6}$/);
});

test("addLineAtEnd は先頭キャラを割り当てて末尾に追加", () => {
  const { result } = renderHook(() => useProject());
  act(() => result.current.addCharacter("霊夢"));
  act(() => result.current.addLineAtEnd());
  expect(result.current.project.lines).toHaveLength(1);
  expect(result.current.project.lines[0]!.characterId).toBe(result.current.project.characters[0]!.id);
});

test("deleteCharacter は該当ラインを先頭キャラに付け替える（F-04）", () => {
  const { result } = renderHook(() => useProject());
  act(() => result.current.addCharacter("霊夢"));
  act(() => result.current.addCharacter("魔理沙"));
  act(() => result.current.addLineAtEnd());
  const marisa = result.current.project.characters[1]!;
  act(() => result.current.updateLineCharacter(result.current.project.lines[0]!.id, marisa.id));
  act(() => result.current.deleteCharacter(marisa.id));
  expect(result.current.project.characters).toHaveLength(1);
  expect(result.current.project.lines[0]!.characterId).toBe(result.current.project.characters[0]!.id);
});

test("最後の1キャラは削除できない（孤児Line防止）", () => {
  const { result } = renderHook(() => useProject());
  act(() => result.current.addCharacter("霊夢"));
  const onlyId = result.current.project.characters[0]!.id;
  act(() => result.current.deleteCharacter(onlyId));
  expect(result.current.project.characters).toHaveLength(1);
});

test("moveLine up/down が順番を入れ替える", () => {
  const { result } = renderHook(() => useProject());
  act(() => result.current.addCharacter("霊夢"));
  act(() => result.current.addLineAtEnd());
  act(() => result.current.addLineAtEnd());
  act(() => result.current.updateLineText(result.current.project.lines[0]!.id, "A"));
  act(() => result.current.updateLineText(result.current.project.lines[1]!.id, "B"));
  act(() => result.current.moveLine(result.current.project.lines[0]!.id, "down"));
  expect(result.current.project.lines.map((l) => l.text)).toEqual(["B", "A"]);
});

test("addLineAfter は指定行の直後に挿入", () => {
  const { result } = renderHook(() => useProject());
  act(() => result.current.addCharacter("霊夢"));
  act(() => result.current.addLineAtEnd());
  const first = result.current.project.lines[0]!;
  act(() => result.current.updateLineText(first.id, "A"));
  act(() => result.current.addLineAfter(first.id));
  expect(result.current.project.lines[0]!.text).toBe("A");
  expect(result.current.project.lines).toHaveLength(2);
});

test("変更が localStorage に自動保存される", () => {
  const { result } = renderHook(() => useProject());
  act(() => result.current.setProjectName("わたしの台本"));
  expect(JSON.parse(localStorage.getItem(STORAGE_KEY)!).projectName).toBe("わたしの台本");
});

test("localStorage に既存があれば復元する", () => {
  localStorage.setItem(STORAGE_KEY, JSON.stringify({ version: 1, projectName: "復元", characters: [], lines: [] }));
  const { result } = renderHook(() => useProject());
  expect(result.current.project.projectName).toBe("復元");
});

test("不正な .ymscript を読み込んでも状態は変わらない（design §8）", async () => {
  const { result } = renderHook(() => useProject());
  act(() => result.current.setProjectName("元の名前"));
  const badFile = new File(["{ not valid json"], "broken.ymscript", { type: "application/json" });
  await expect(act(async () => { await result.current.loadFromFile(badFile); })).rejects.toThrow();
  expect(result.current.project.projectName).toBe("元の名前");
});

test("importMarkdown はファイルから状態を置き換え、skippedLines を返す", async () => {
  const { result } = renderHook(() => useProject());
  const md = new File(["霊夢: やあ\n不正行\n魔理沙: どうも"], "x.md", { type: "text/markdown" });
  let skipped = -1;
  await act(async () => { skipped = await result.current.importMarkdown(md); });
  expect(skipped).toBe(1);
  expect(result.current.project.lines.map((l) => l.text)).toEqual(["やあ", "どうも"]);
});

test("exportCSVToClipboard は全件 CSV をクリップボードへ書く", async () => {
  const writeText = vi.fn().mockResolvedValue(undefined);
  Object.assign(navigator, { clipboard: { writeText } });
  const { result } = renderHook(() => useProject());
  act(() => result.current.addCharacter("霊夢"));
  act(() => result.current.addLineAtEnd());
  act(() => result.current.updateLineText(result.current.project.lines[0]!.id, "やあ"));
  await act(async () => { await result.current.exportCSVToClipboard(); });
  expect(writeText).toHaveBeenCalledWith("霊夢,やあ");
});
