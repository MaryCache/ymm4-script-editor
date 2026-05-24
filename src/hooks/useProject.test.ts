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
  await expect(
    act(async () => {
      await result.current.loadFromFile(badFile);
    }),
  ).rejects.toThrow();
  expect(result.current.project.projectName).toBe("元の名前");
});

test("importMarkdown はファイルから状態を置き換え、skippedLines を返す", async () => {
  const { result } = renderHook(() => useProject());
  const md = new File(["霊夢: やあ\n不正行\n魔理沙: どうも"], "x.md", { type: "text/markdown" });
  let skipped = -1;
  await act(async () => {
    skipped = await result.current.importMarkdown(md);
  });
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
  await act(async () => {
    await result.current.exportCSVToClipboard();
  });
  expect(writeText).toHaveBeenCalledWith("霊夢,やあ");
});

// I-4: JSON として妥当だが version が不正なファイルは reject し、状態を変えない
test("version:2 の .ymscript は loadFromFile が reject し状態は変わらない（構造不正の異常系）", async () => {
  const { result } = renderHook(() => useProject());
  act(() => result.current.setProjectName("元の名前"));
  const badFile = new File(
    [JSON.stringify({ version: 2, projectName: "X", characters: [], lines: [] })],
    "future.ymscript",
    { type: "application/json" },
  );
  await expect(
    act(async () => {
      await result.current.loadFromFile(badFile);
    }),
  ).rejects.toThrow();
  expect(result.current.project.projectName).toBe("元の名前");
});

// I-2: addLineAfter は元の行のキャラクターを引き継ぐ
test("addLineAfter は直前行のキャラクターを引き継ぐ", () => {
  const { result } = renderHook(() => useProject());
  act(() => result.current.addCharacter("霊夢"));
  act(() => result.current.addCharacter("魔理沙"));
  act(() => result.current.addLineAtEnd());
  // 先頭行を2番目キャラ（魔理沙）に変更
  const marisa = result.current.project.characters[1]!;
  const firstLineId = result.current.project.lines[0]!.id;
  act(() => result.current.updateLineCharacter(firstLineId, marisa.id));
  // 魔理沙の行の直後に追加 → 新規行も魔理沙のはず
  act(() => result.current.addLineAfter(firstLineId));
  expect(result.current.project.lines[1]!.characterId).toBe(marisa.id);
});

// I-4: 正しい project: キーの完全形式フロントマターあり Markdown を importMarkdown できる
test("フロントマターあり Markdown を importMarkdown で読み込める", async () => {
  const { result } = renderHook(() => useProject());
  // parseMarkdown が認識するフロントマター形式: project: + characters: ブロック
  const frontmatter = [
    "---",
    "project: テスト台本",
    "characters:",
    "  - name: 霊夢",
    '    color: "#FF6B6B"',
    "  - name: 魔理沙",
    '    color: "#4ECDC4"',
    "---",
  ].join("\n");
  const body = "霊夢: こんにちは\n魔理沙: どうも";
  const md = new File([`${frontmatter}\n${body}`], "with-frontmatter.md", { type: "text/markdown" });
  let skipped = -1;
  await act(async () => {
    skipped = await result.current.importMarkdown(md);
  });
  // projectName がフロントマターから読み込まれていること
  expect(result.current.project.projectName).toBe("テスト台本");
  // 本文の2行が読み込まれていること
  expect(result.current.project.lines).toHaveLength(2);
  // スキップなし
  expect(skipped).toBe(0);
});

// M-4: moveLine の up 方向
test("moveLine up は行を1つ上に移動する", () => {
  const { result } = renderHook(() => useProject());
  act(() => result.current.addCharacter("霊夢"));
  act(() => result.current.addLineAtEnd());
  act(() => result.current.addLineAtEnd());
  act(() => result.current.updateLineText(result.current.project.lines[0]!.id, "A"));
  act(() => result.current.updateLineText(result.current.project.lines[1]!.id, "B"));
  act(() => result.current.moveLine(result.current.project.lines[1]!.id, "up"));
  expect(result.current.project.lines.map((l) => l.text)).toEqual(["B", "A"]);
});

// M-4: 先頭行の up は no-op
test("moveLine up は先頭行に対して no-op", () => {
  const { result } = renderHook(() => useProject());
  act(() => result.current.addCharacter("霊夢"));
  act(() => result.current.addLineAtEnd());
  act(() => result.current.addLineAtEnd());
  act(() => result.current.updateLineText(result.current.project.lines[0]!.id, "A"));
  act(() => result.current.updateLineText(result.current.project.lines[1]!.id, "B"));
  act(() => result.current.moveLine(result.current.project.lines[0]!.id, "up"));
  expect(result.current.project.lines.map((l) => l.text)).toEqual(["A", "B"]);
});

// M-4: 末尾行の down は no-op
test("moveLine down は末尾行に対して no-op", () => {
  const { result } = renderHook(() => useProject());
  act(() => result.current.addCharacter("霊夢"));
  act(() => result.current.addLineAtEnd());
  act(() => result.current.addLineAtEnd());
  act(() => result.current.updateLineText(result.current.project.lines[0]!.id, "A"));
  act(() => result.current.updateLineText(result.current.project.lines[1]!.id, "B"));
  act(() => result.current.moveLine(result.current.project.lines[1]!.id, "down"));
  expect(result.current.project.lines.map((l) => l.text)).toEqual(["A", "B"]);
});

// --- v1.2 mutators ---

// renameCharacter
test("renameCharacter はキャラクター名を変更する", () => {
  const { result } = renderHook(() => useProject());
  act(() => result.current.addCharacter("霊夢"));
  const id = result.current.project.characters[0]!.id;
  act(() => result.current.renameCharacter(id, "博麗霊夢"));
  expect(result.current.project.characters[0]!.name).toBe("博麗霊夢");
});

test("renameCharacter: 空文字（trim後）は no-op で元の名前を維持する", () => {
  const { result } = renderHook(() => useProject());
  act(() => result.current.addCharacter("霊夢"));
  const id = result.current.project.characters[0]!.id;
  act(() => result.current.renameCharacter(id, "   "));
  expect(result.current.project.characters[0]!.name).toBe("霊夢");
});

// setCharacterColor
test("setCharacterColor はキャラクターの色を変更する", () => {
  const { result } = renderHook(() => useProject());
  act(() => result.current.addCharacter("霊夢"));
  const id = result.current.project.characters[0]!.id;
  act(() => result.current.setCharacterColor(id, "#123456"));
  expect(result.current.project.characters[0]!.color).toBe("#123456");
});

// importPlainText
test("importPlainText: 既存キャラありで3行テキストを末尾に追加し件数3を返す", () => {
  const { result } = renderHook(() => useProject());
  act(() => result.current.addCharacter("霊夢"));
  const charId = result.current.project.characters[0]!.id;
  let count = -1;
  act(() => {
    count = result.current.importPlainText("あいうえお\nかきくけこ\nさしすせそ");
  });
  expect(count).toBe(3);
  expect(result.current.project.lines).toHaveLength(3);
  expect(result.current.project.lines.every((l) => l.characterId === charId)).toBe(true);
});

test("importPlainText: キャラ0人のとき「キャラ1」が自動作成され2行追加・件数2を返す", () => {
  const { result } = renderHook(() => useProject());
  let count = -1;
  act(() => {
    count = result.current.importPlainText("あいうえお\nかきくけこ");
  });
  expect(count).toBe(2);
  expect(result.current.project.characters).toHaveLength(1);
  expect(result.current.project.characters[0]!.name).toBe("キャラ1");
  expect(result.current.project.characters[0]!.color).toMatch(/^#[0-9A-Fa-f]{6}$/);
  expect(result.current.project.lines).toHaveLength(2);
  expect(result.current.project.lines.every((l) => l.characterId === result.current.project.characters[0]!.id)).toBe(
    true,
  );
});

test("importPlainText: 空行混じりテキストは空行をスキップしtrimされる", () => {
  const { result } = renderHook(() => useProject());
  act(() => result.current.addCharacter("霊夢"));
  let count = -1;
  act(() => {
    count = result.current.importPlainText("a\n\n b \n");
  });
  expect(count).toBe(2);
  expect(result.current.project.lines).toHaveLength(2);
  expect(result.current.project.lines[0]!.text).toBe("a");
  expect(result.current.project.lines[1]!.text).toBe("b");
});

test("importPlainText: 既存 lines がある場合は末尾に追加する（置換しない）", () => {
  const { result } = renderHook(() => useProject());
  act(() => result.current.addCharacter("霊夢"));
  act(() => result.current.addLineAtEnd());
  act(() => result.current.updateLineText(result.current.project.lines[0]!.id, "既存行"));
  act(() => {
    result.current.importPlainText("追加行");
  });
  expect(result.current.project.lines).toHaveLength(2);
  expect(result.current.project.lines[0]!.text).toBe("既存行");
  expect(result.current.project.lines[1]!.text).toBe("追加行");
});

test("importPlainText: 全部空行なら0を返し状態は変わらない", () => {
  const { result } = renderHook(() => useProject());
  let count = -1;
  act(() => {
    count = result.current.importPlainText("\n  \n\n");
  });
  expect(count).toBe(0);
  expect(result.current.project.characters).toHaveLength(0);
  expect(result.current.project.lines).toHaveLength(0);
});

// clearAllLines
test("clearAllLines は全行を削除しキャラクターは保持する", () => {
  const { result } = renderHook(() => useProject());
  act(() => result.current.addCharacter("霊夢"));
  act(() => result.current.addLineAtEnd());
  act(() => result.current.addLineAtEnd());
  act(() => result.current.clearAllLines());
  expect(result.current.project.lines).toHaveLength(0);
  expect(result.current.project.characters).toHaveLength(1);
});
