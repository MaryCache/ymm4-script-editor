// src/hooks/useProject.test.ts
import { renderHook, act } from "@testing-library/react";
import { useProject, STORAGE_KEY, STORAGE_KEY_WORKSPACE } from "./useProject";
import type { Workspace } from "../types";

beforeEach(() => localStorage.clear());

// ===== 基本動作（既存）=====

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

// ===== isEmpty（F-113）=====

test("新規タブは行もキャラもないため isEmpty=true", () => {
  const { result } = renderHook(() => useProject());
  expect(result.current.tabs[0]!.isEmpty).toBe(true);
});

test("キャラだけ追加して行が0件のタブは isEmpty=false（閉じ時に確認が必要）", () => {
  const { result } = renderHook(() => useProject());
  act(() => result.current.addCharacter("霊夢"));
  expect(result.current.project.lines).toHaveLength(0);
  expect(result.current.tabs[0]!.isEmpty).toBe(false);
});

test("行を追加したタブは isEmpty=false", () => {
  const { result } = renderHook(() => useProject());
  act(() => result.current.addCharacter("霊夢"));
  act(() => result.current.addLineAtEnd());
  expect(result.current.tabs[0]!.isEmpty).toBe(false);
});

test("全行削除してもキャラが残っていれば isEmpty=false", () => {
  const { result } = renderHook(() => useProject());
  act(() => result.current.addCharacter("霊夢"));
  act(() => result.current.addLineAtEnd());
  act(() => result.current.clearAllLines());
  expect(result.current.project.lines).toHaveLength(0);
  expect(result.current.tabs[0]!.isEmpty).toBe(false);
});

// ===== 永続化（ワークスペース化後の挙動）=====

test("変更が localStorage（workspaceキー）に自動保存される", () => {
  const { result } = renderHook(() => useProject());
  act(() => result.current.setProjectName("わたしの台本"));
  const raw = localStorage.getItem(STORAGE_KEY_WORKSPACE);
  expect(raw).not.toBeNull();
  const ws: Workspace = JSON.parse(raw!);
  const active = ws.entries.find((e) => e.id === ws.activeId)!;
  expect(active.project.projectName).toBe("わたしの台本");
});

test("workspaceキーに有効なワークスペースがあれば復元する", () => {
  const id = "test-id-1";
  const ws: Workspace = {
    version: 1,
    activeId: id,
    entries: [{ id, project: { version: 1, projectName: "復元テスト", characters: [], lines: [] } }],
    pinnedCharacters: [],
  };
  localStorage.setItem(STORAGE_KEY_WORKSPACE, JSON.stringify(ws));
  const { result } = renderHook(() => useProject());
  expect(result.current.project.projectName).toBe("復元テスト");
  expect(result.current.activeId).toBe(id);
});

// ===== マイグレーション =====

test("旧キーのみ存在 → 1エントリのワークスペースに移行してアクティブ", () => {
  localStorage.setItem(
    STORAGE_KEY,
    JSON.stringify({ version: 1, projectName: "旧プロジェクト", characters: [], lines: [] }),
  );
  const { result } = renderHook(() => useProject());
  expect(result.current.project.projectName).toBe("旧プロジェクト");
  expect(result.current.tabs).toHaveLength(1);
  expect(result.current.activeId).toBe(result.current.tabs[0]!.id);
});

test("workspaceキー優先（旧キーも存在する場合はworkspaceキーを使う）", () => {
  const id = "ws-id";
  const ws: Workspace = {
    version: 1,
    activeId: id,
    entries: [{ id, project: { version: 1, projectName: "ワークスペース側", characters: [], lines: [] } }],
    pinnedCharacters: [],
  };
  localStorage.setItem(STORAGE_KEY_WORKSPACE, JSON.stringify(ws));
  localStorage.setItem(STORAGE_KEY, JSON.stringify({ version: 1, projectName: "旧キー側", characters: [], lines: [] }));
  const { result } = renderHook(() => useProject());
  expect(result.current.project.projectName).toBe("ワークスペース側");
});

test("両方なければ既定ワークスペース（空プロジェクト1つ）", () => {
  const { result } = renderHook(() => useProject());
  expect(result.current.tabs).toHaveLength(1);
  expect(result.current.project.projectName).toBe("新規プロジェクト");
  expect(result.current.project.characters).toHaveLength(0);
});

test("workspaceキーが壊れていれば旧キーにフォールバックする", () => {
  localStorage.setItem(STORAGE_KEY_WORKSPACE, "broken json");
  localStorage.setItem(
    STORAGE_KEY,
    JSON.stringify({ version: 1, projectName: "旧キーフォールバック", characters: [], lines: [] }),
  );
  const { result } = renderHook(() => useProject());
  expect(result.current.project.projectName).toBe("旧キーフォールバック");
});

test("workspaceキー・旧キー共に壊れていれば既定にフォールバックする", () => {
  localStorage.setItem(STORAGE_KEY_WORKSPACE, "broken");
  localStorage.setItem(STORAGE_KEY, "also broken");
  const { result } = renderHook(() => useProject());
  expect(result.current.project.projectName).toBe("新規プロジェクト");
  expect(result.current.tabs).toHaveLength(1);
});

// ===== タブ操作 =====

test("newProject でエントリが増えてアクティブが新プロジェクトになる", () => {
  const { result } = renderHook(() => useProject());
  const prevActiveId = result.current.activeId;
  act(() => result.current.newProject());
  expect(result.current.tabs).toHaveLength(2);
  expect(result.current.activeId).not.toBe(prevActiveId);
  expect(result.current.project.projectName).toBe("新規プロジェクト");
  expect(result.current.project.characters).toHaveLength(0);
  expect(result.current.project.lines).toHaveLength(0);
});

test("switchProject でアクティブが切り替わる", () => {
  const { result } = renderHook(() => useProject());
  act(() => result.current.setProjectName("プロジェクト1"));
  act(() => result.current.newProject());
  act(() => result.current.setProjectName("プロジェクト2"));
  // プロジェクト1のIDに戻す
  const firstId = result.current.tabs[0]!.id;
  act(() => result.current.switchProject(firstId));
  expect(result.current.activeId).toBe(firstId);
  expect(result.current.project.projectName).toBe("プロジェクト1");
});

test("switchProject: 存在しない id は no-op", () => {
  const { result } = renderHook(() => useProject());
  const prevActiveId = result.current.activeId;
  act(() => result.current.switchProject("nonexistent-id"));
  expect(result.current.activeId).toBe(prevActiveId);
});

test("closeProject: 最後の1エントリは no-op", () => {
  const { result } = renderHook(() => useProject());
  const onlyId = result.current.activeId;
  act(() => result.current.closeProject(onlyId));
  expect(result.current.tabs).toHaveLength(1);
  expect(result.current.activeId).toBe(onlyId);
});

test("closeProject: 閉じたら別エントリがアクティブになる（アクティブを閉じた場合）", () => {
  const { result } = renderHook(() => useProject());
  act(() => result.current.setProjectName("P1"));
  act(() => result.current.newProject());
  act(() => result.current.setProjectName("P2"));
  const p2Id = result.current.activeId;
  // P2（アクティブ）を閉じる → P1 がアクティブになるはず
  act(() => result.current.closeProject(p2Id));
  expect(result.current.tabs).toHaveLength(1);
  expect(result.current.project.projectName).toBe("P1");
});

test("closeProject: 非アクティブエントリを閉じてもアクティブは変わらない", () => {
  const { result } = renderHook(() => useProject());
  act(() => result.current.setProjectName("P1"));
  act(() => result.current.newProject());
  act(() => result.current.setProjectName("P2"));
  // 今アクティブは P2
  const p2Id = result.current.activeId;
  const p1Id = result.current.tabs[0]!.id;
  // P1（非アクティブ）を閉じる → P2 がアクティブのまま
  act(() => result.current.closeProject(p1Id));
  expect(result.current.tabs).toHaveLength(1);
  expect(result.current.activeId).toBe(p2Id);
  expect(result.current.project.projectName).toBe("P2");
});

test("closeProject: 先頭エントリを閉じたとき次のエントリがアクティブになる", () => {
  const { result } = renderHook(() => useProject());
  act(() => result.current.setProjectName("P1"));
  const p1Id = result.current.activeId;
  act(() => result.current.newProject());
  act(() => result.current.setProjectName("P2"));
  // P1 に戻してからP1を閉じる
  act(() => result.current.switchProject(p1Id));
  act(() => result.current.closeProject(p1Id));
  expect(result.current.tabs).toHaveLength(1);
  expect(result.current.project.projectName).toBe("P2");
});

test("renameProject: 指定エントリのprojectNameを変更する", () => {
  const { result } = renderHook(() => useProject());
  const id = result.current.activeId;
  act(() => result.current.renameProject(id, "新しい名前"));
  expect(result.current.project.projectName).toBe("新しい名前");
  expect(result.current.tabs[0]!.name).toBe("新しい名前");
});

test("renameProject: trim後空は no-op", () => {
  const { result } = renderHook(() => useProject());
  act(() => result.current.setProjectName("元の名前"));
  const id = result.current.activeId;
  act(() => result.current.renameProject(id, "   "));
  expect(result.current.project.projectName).toBe("元の名前");
});

test("renameProject: trim して採用する", () => {
  const { result } = renderHook(() => useProject());
  const id = result.current.activeId;
  act(() => result.current.renameProject(id, "  スペース付き  "));
  expect(result.current.project.projectName).toBe("スペース付き");
});

test("renameProject: 非アクティブなエントリのtabs.nameも更新される", () => {
  const { result } = renderHook(() => useProject());
  act(() => result.current.setProjectName("P1"));
  const p1Id = result.current.activeId;
  act(() => result.current.newProject());
  act(() => result.current.setProjectName("P2"));
  // P1（非アクティブ）をリネーム
  act(() => result.current.renameProject(p1Id, "P1リネーム"));
  const p1Tab = result.current.tabs.find((t) => t.id === p1Id)!;
  expect(p1Tab.name).toBe("P1リネーム");
  // P2 はアクティブのまま
  expect(result.current.project.projectName).toBe("P2");
});

// ===== 既存 mutator がアクティブに作用すること =====

test("addCharacter はアクティブエントリにのみ作用する", () => {
  const { result } = renderHook(() => useProject());
  act(() => result.current.setProjectName("P1"));
  const p1Id = result.current.activeId;
  act(() => result.current.newProject()); // P2 がアクティブ
  act(() => result.current.switchProject(p1Id)); // P1 に戻す
  act(() => result.current.addCharacter("霊夢"));
  // P1 にキャラが追加されている
  expect(result.current.project.characters).toHaveLength(1);
  // P2 に切り替えたとき P2 にはキャラがいない
  act(() => result.current.switchProject(result.current.tabs.find((t) => t.id !== p1Id)!.id));
  expect(result.current.project.characters).toHaveLength(0);
});

// ===== loadFromFile / importMarkdown が新タブを追加してアクティブにする =====

test("loadFromFile は新タブとして追加しアクティブにする", async () => {
  const { result } = renderHook(() => useProject());
  act(() => result.current.setProjectName("元のプロジェクト"));
  const originalId = result.current.activeId;
  const ymscript = JSON.stringify({ version: 1, projectName: "読み込んだプロジェクト", characters: [], lines: [] });
  const file = new File([ymscript], "loaded.ymscript", { type: "application/json" });
  await act(async () => {
    await result.current.loadFromFile(file);
  });
  expect(result.current.tabs).toHaveLength(2);
  expect(result.current.activeId).not.toBe(originalId);
  expect(result.current.project.projectName).toBe("読み込んだプロジェクト");
  // 元のエントリは保持されている
  const originalTab = result.current.tabs.find((t) => t.id === originalId)!;
  expect(originalTab.name).toBe("元のプロジェクト");
});

test("不正な .ymscript を読み込んでも状態は変わらない（design §8）", async () => {
  const { result } = renderHook(() => useProject());
  act(() => result.current.setProjectName("元の名前"));
  const tabCount = result.current.tabs.length;
  const badFile = new File(["{ not valid json"], "broken.ymscript", { type: "application/json" });
  await expect(
    act(async () => {
      await result.current.loadFromFile(badFile);
    }),
  ).rejects.toThrow();
  expect(result.current.project.projectName).toBe("元の名前");
  expect(result.current.tabs).toHaveLength(tabCount);
});

test("version:2 の .ymscript は loadFromFile が reject し状態は変わらない（構造不正の異常系）", async () => {
  const { result } = renderHook(() => useProject());
  act(() => result.current.setProjectName("元の名前"));
  const tabCount = result.current.tabs.length;
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
  expect(result.current.tabs).toHaveLength(tabCount);
});

test("importMarkdown は新タブとして追加しアクティブにし skippedLines を返す", async () => {
  const { result } = renderHook(() => useProject());
  act(() => result.current.setProjectName("元のプロジェクト"));
  const originalId = result.current.activeId;
  const md = new File(["霊夢: やあ\n不正行\n魔理沙: どうも"], "x.md", { type: "text/markdown" });
  let skipped = -1;
  await act(async () => {
    skipped = await result.current.importMarkdown(md);
  });
  expect(skipped).toBe(1);
  expect(result.current.tabs).toHaveLength(2);
  expect(result.current.activeId).not.toBe(originalId);
  expect(result.current.project.lines.map((l) => l.text)).toEqual(["やあ", "どうも"]);
  // 元のエントリは保持されている
  expect(result.current.tabs.some((t) => t.id === originalId)).toBe(true);
});

test("フロントマターあり Markdown を importMarkdown で読み込める（新タブとして）", async () => {
  const { result } = renderHook(() => useProject());
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
  // 新タブがアクティブで projectName がフロントマターから読み込まれる
  expect(result.current.project.projectName).toBe("テスト台本");
  expect(result.current.project.lines).toHaveLength(2);
  expect(skipped).toBe(0);
});

// ===== exportCSVToClipboard =====

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

// ===== moveLine 境界ケース =====

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

// ===== addLineAfter のキャラ引き継ぎ =====

test("addLineAfter は直前行のキャラクターを引き継ぐ", () => {
  const { result } = renderHook(() => useProject());
  act(() => result.current.addCharacter("霊夢"));
  act(() => result.current.addCharacter("魔理沙"));
  act(() => result.current.addLineAtEnd());
  const marisa = result.current.project.characters[1]!;
  const firstLineId = result.current.project.lines[0]!.id;
  act(() => result.current.updateLineCharacter(firstLineId, marisa.id));
  act(() => result.current.addLineAfter(firstLineId));
  expect(result.current.project.lines[1]!.characterId).toBe(marisa.id);
});

// ===== v1.2 mutators =====

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

test("setCharacterColor はキャラクターの色を変更する", () => {
  const { result } = renderHook(() => useProject());
  act(() => result.current.addCharacter("霊夢"));
  const id = result.current.project.characters[0]!.id;
  act(() => result.current.setCharacterColor(id, "#123456"));
  expect(result.current.project.characters[0]!.color).toBe("#123456");
});

// ===== importPlainText =====

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

// ===== clearAllLines =====

test("clearAllLines は全行を削除しキャラクターは保持する", () => {
  const { result } = renderHook(() => useProject());
  act(() => result.current.addCharacter("霊夢"));
  act(() => result.current.addLineAtEnd());
  act(() => result.current.addLineAtEnd());
  act(() => result.current.clearAllLines());
  expect(result.current.project.lines).toHaveLength(0);
  expect(result.current.project.characters).toHaveLength(1);
});

// ===== 永続化失敗時の onPersistError コールバック（F-117）=====

test("localStorage.setItem が失敗したとき onPersistError が呼ばれる", () => {
  const onPersistError = vi.fn();
  const error = new DOMException("QuotaExceededError");

  // localStorage.setItem を一時的に例外を投げるよう上書きする
  const setItemSpy = vi.spyOn(Storage.prototype, "setItem").mockImplementationOnce(() => {
    throw error;
  });

  // console.error の出力を抑制（テストログを汚さないため）
  const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

  const { result } = renderHook(() => useProject({ onPersistError }));

  // useEffect は初回マウント時に必ず実行される（workspace 変化扱い）ため
  // この時点で onPersistError が1回呼ばれているはず
  expect(onPersistError).toHaveBeenCalledTimes(1);
  expect(onPersistError).toHaveBeenCalledWith(error);
  expect(consoleErrorSpy).toHaveBeenCalled();

  // 後片付け
  setItemSpy.mockRestore();
  consoleErrorSpy.mockRestore();

  // 返り値の型チェック: 引数なし呼び出しと同じ型が返ること
  expect(result.current.project).toBeDefined();
});

test("localStorage.setItem が成功しているとき onPersistError は呼ばれない", () => {
  const onPersistError = vi.fn();
  renderHook(() => useProject({ onPersistError }));
  expect(onPersistError).not.toHaveBeenCalled();
});

test("useProject() を引数なしで呼んでも後方互換（既存テストと同じ動作）", () => {
  const { result } = renderHook(() => useProject());
  expect(result.current.project.projectName).toBe("新規プロジェクト");
});

// ===== v1.4 共通キャラ（pinnedCharacters）=====

test("初期状態: pinnedCharacters は空、characters（実効）もローカルと一致", () => {
  const { result } = renderHook(() => useProject());
  expect(result.current.pinnedCharacters).toHaveLength(0);
  act(() => result.current.addCharacter("霊夢"));
  expect(result.current.characters).toHaveLength(1);
  expect(result.current.characters[0]!.name).toBe("霊夢");
});

test("pinCharacter: ローカルキャラを共通プールへ移動する", () => {
  const { result } = renderHook(() => useProject());
  act(() => result.current.addCharacter("霊夢"));
  const id = result.current.project.characters[0]!.id;
  act(() => result.current.pinCharacter(id));
  expect(result.current.pinnedCharacters).toHaveLength(1);
  expect(result.current.pinnedCharacters[0]!.name).toBe("霊夢");
  expect(result.current.project.characters).toHaveLength(0);
});

test("pinCharacter: 既に共通なら no-op", () => {
  const { result } = renderHook(() => useProject());
  act(() => result.current.addCharacter("霊夢"));
  const id = result.current.project.characters[0]!.id;
  act(() => result.current.pinCharacter(id));
  act(() => result.current.pinCharacter(id)); // 2回目は no-op
  expect(result.current.pinnedCharacters).toHaveLength(1);
});

test("unpinCharacter: 共通キャラをローカルへ移動する", () => {
  const { result } = renderHook(() => useProject());
  act(() => result.current.addCharacter("霊夢"));
  const id = result.current.project.characters[0]!.id;
  act(() => result.current.pinCharacter(id));
  act(() => result.current.unpinCharacter(id));
  expect(result.current.pinnedCharacters).toHaveLength(0);
  expect(result.current.project.characters).toHaveLength(1);
  expect(result.current.project.characters[0]!.name).toBe("霊夢");
});

test("unpinCharacter: 共通にいなければ no-op", () => {
  const { result } = renderHook(() => useProject());
  act(() => result.current.addCharacter("霊夢"));
  const id = result.current.project.characters[0]!.id;
  act(() => result.current.unpinCharacter(id)); // 共通にいない
  expect(result.current.project.characters).toHaveLength(1);
  expect(result.current.pinnedCharacters).toHaveLength(0);
});

test("実効一覧（characters）は [共通, ...ローカル] の順", () => {
  const { result } = renderHook(() => useProject());
  act(() => result.current.addCharacter("霊夢"));
  act(() => result.current.addCharacter("魔理沙"));
  const reimuId = result.current.project.characters[0]!.id;
  act(() => result.current.pinCharacter(reimuId));
  // 共通: 霊夢、ローカル: 魔理沙
  expect(result.current.characters[0]!.name).toBe("霊夢");
  expect(result.current.characters[1]!.name).toBe("魔理沙");
});

test("renameCharacter: 共通キャラの名前は全タブ反映（共通を更新）", () => {
  const { result } = renderHook(() => useProject());
  act(() => result.current.addCharacter("霊夢"));
  const id = result.current.project.characters[0]!.id;
  act(() => result.current.pinCharacter(id));
  act(() => result.current.renameCharacter(id, "博麗霊夢"));
  expect(result.current.pinnedCharacters[0]!.name).toBe("博麗霊夢");
});

test("renameCharacter: ローカルキャラの名前はローカルのみ更新", () => {
  const { result } = renderHook(() => useProject());
  act(() => result.current.addCharacter("霊夢"));
  act(() => result.current.addCharacter("魔理沙"));
  const marisaId = result.current.project.characters[1]!.id;
  act(() => result.current.renameCharacter(marisaId, "霧雨魔理沙"));
  expect(result.current.project.characters[1]!.name).toBe("霧雨魔理沙");
  expect(result.current.pinnedCharacters).toHaveLength(0);
});

test("setCharacterColor: 共通キャラの色は全タブ反映", () => {
  const { result } = renderHook(() => useProject());
  act(() => result.current.addCharacter("霊夢"));
  const id = result.current.project.characters[0]!.id;
  act(() => result.current.pinCharacter(id));
  act(() => result.current.setCharacterColor(id, "#abcdef"));
  expect(result.current.pinnedCharacters[0]!.color).toBe("#abcdef");
});

test("deleteCharacter: 共通キャラ削除で全プロジェクトのラインを付け替える", () => {
  const { result } = renderHook(() => useProject());
  act(() => result.current.addCharacter("霊夢"));
  act(() => result.current.addCharacter("魔理沙"));
  const reimuId = result.current.project.characters[0]!.id;
  act(() => result.current.pinCharacter(reimuId));
  act(() => result.current.addLineAtEnd()); // 先頭キャラ=共通の霊夢
  act(() => result.current.deleteCharacter(reimuId)); // 共通から除去
  // ラインの characterId が付け替えられている（魔理沙）
  const marisaId = result.current.project.characters[0]!.id;
  expect(result.current.project.lines[0]!.characterId).toBe(marisaId);
  expect(result.current.pinnedCharacters).toHaveLength(0);
});

test("deleteCharacter: 実効一覧が1以下なら no-op（共通1+ローカル0）", () => {
  const { result } = renderHook(() => useProject());
  act(() => result.current.addCharacter("霊夢"));
  const id = result.current.project.characters[0]!.id;
  act(() => result.current.pinCharacter(id));
  // 実効一覧: [共通の霊夢] = 1件
  act(() => result.current.deleteCharacter(id));
  expect(result.current.pinnedCharacters).toHaveLength(1);
});

test("マイグレーション: pinnedCharacters 欠落のワークスペースを復元すると [] になる", () => {
  const id = "migrated-id";
  // pinnedCharacters を含まない旧形式
  const oldWs = {
    version: 1,
    activeId: id,
    entries: [{ id, project: { version: 1, projectName: "旧プロジェクト", characters: [], lines: [] } }],
  };
  localStorage.setItem(STORAGE_KEY_WORKSPACE, JSON.stringify(oldWs));
  const { result } = renderHook(() => useProject());
  expect(result.current.project.projectName).toBe("旧プロジェクト");
  expect(result.current.pinnedCharacters).toHaveLength(0);
});

test("saveToFile: materialize - 参照されている共通キャラのみ books/export に含まれる（localStorage 書き出し内容で確認）", () => {
  // saveToFile の materialize を間接的に確認する。
  // downloadText → downloadBlob → URL.createObjectURL の呼び出し経路を stub する。
  const blobContents: Blob[] = [];
  const originalCreateObjectURL = URL.createObjectURL;
  const originalRevokeObjectURL = URL.revokeObjectURL;
  URL.createObjectURL = (blob: Blob) => {
    blobContents.push(blob);
    return "blob:stub";
  };
  URL.revokeObjectURL = () => {};

  // anchor 要素の click を no-op にする（document.createElement("a") ではなく body.click でも可）
  const anchorClickSpy = vi.fn();
  const originalBodyAppendChild = document.body.appendChild.bind(document.body);
  const originalBodyRemoveChild = document.body.removeChild.bind(document.body);
  vi.spyOn(document.body, "appendChild").mockImplementation((node) => {
    if (node instanceof HTMLAnchorElement) {
      vi.spyOn(node, "click").mockImplementation(anchorClickSpy);
    }
    return originalBodyAppendChild(node);
  });
  vi.spyOn(document.body, "removeChild").mockImplementation((node) => originalBodyRemoveChild(node));

  const { result } = renderHook(() => useProject());
  act(() => result.current.addCharacter("霊夢")); // ローカル
  act(() => result.current.addCharacter("魔理沙")); // ローカル
  const reimuId = result.current.project.characters[0]!.id;
  act(() => result.current.pinCharacter(reimuId)); // 霊夢を共通に
  act(() => result.current.addLineAtEnd()); // 先頭=共通の霊夢

  act(() => result.current.saveToFile());

  URL.createObjectURL = originalCreateObjectURL;
  URL.revokeObjectURL = originalRevokeObjectURL;
  vi.restoreAllMocks();

  expect(blobContents).toHaveLength(1);
  const fileText = new Promise<string>((resolve) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.readAsText(blobContents[0]!);
  });

  return fileText.then((text) => {
    const parsed = JSON.parse(text);
    const charNames: string[] = parsed.characters.map((c: { name: string }) => c.name);
    // 霊夢（共通・参照あり）と魔理沙（ローカル）が含まれる
    expect(charNames).toContain("霊夢");
    expect(charNames).toContain("魔理沙");
  });
});

test("pinnedCharacters: 旧キーからマイグレーション時に pinnedCharacters=[] が付く", () => {
  localStorage.clear();
  localStorage.setItem(
    STORAGE_KEY,
    JSON.stringify({ version: 1, projectName: "旧プロジェクト2", characters: [], lines: [] }),
  );
  const { result } = renderHook(() => useProject());
  expect(result.current.project.projectName).toBe("旧プロジェクト2");
  expect(result.current.pinnedCharacters).toHaveLength(0);
});

// ===== v1.4 レビュー指摘テスト（ギャップ埋め）=====

// テスト1: H-1 unpinCharacter — 他プロジェクトのラインが孤児化しない
test("unpinCharacter: 複数プロジェクトが共通キャラを参照 → unpin でアクティブ以外のラインが fallback へ付け替わる", () => {
  const { result } = renderHook(() => useProject());

  // P1 にキャラ（ローカル）と行を追加
  act(() => result.current.addCharacter("霊夢"));
  const reimuId = result.current.project.characters[0]!.id;
  act(() => result.current.addLineAtEnd());

  // 霊夢を共通へ
  act(() => result.current.pinCharacter(reimuId));
  const p1Id = result.current.activeId;

  // P2 を追加し、共通の霊夢を話者とする行を追加
  act(() => result.current.newProject());
  const p2Id = result.current.activeId;
  act(() => result.current.addLineAtEnd()); // 先頭=共通の霊夢

  // P1 に戻ってから unpin（P1 がアクティブ）
  act(() => result.current.switchProject(p1Id));
  act(() => result.current.unpinCharacter(reimuId));

  // 共通プールから除去されている
  expect(result.current.pinnedCharacters).toHaveLength(0);

  // アクティブ(P1) のラインはローカルへ移動した霊夢をそのまま参照している
  const p1Lines = result.current.project.lines;
  expect(p1Lines[0]!.characterId).toBe(reimuId);

  // P2 のラインは霊夢 id を参照できなくなるため fallback へ付け替わっている（孤児化しない）
  act(() => result.current.switchProject(p2Id));
  const p2Lines = result.current.project.lines;
  // fallback = P2 の実効一覧先頭。P2 には共通も残らずローカルキャラもいないため ""
  expect(p2Lines[0]!.characterId).not.toBe(reimuId);
});

test("unpinCharacter: アクティブのラインは移動キャラ id を参照し続ける（付け替えない）", () => {
  const { result } = renderHook(() => useProject());
  act(() => result.current.addCharacter("魔理沙"));
  const marisaId = result.current.project.characters[0]!.id;
  act(() => result.current.addLineAtEnd()); // 先頭=魔理沙
  act(() => result.current.pinCharacter(marisaId)); // 共通へ

  // unpin（アクティブのまま）
  act(() => result.current.unpinCharacter(marisaId));

  // アクティブの行は移動先ローカルの魔理沙を参照している
  expect(result.current.project.lines[0]!.characterId).toBe(marisaId);
  expect(result.current.project.characters[0]!.id).toBe(marisaId);
});

// テスト2: M-1 isEmpty — pinnedCharacters があっても固有コンテンツ0なら isEmpty=true
test("isEmpty: ローカルキャラ0・行0 だが pinnedCharacters あり → isEmpty=true（M-1 修正）", () => {
  const { result } = renderHook(() => useProject());
  // まず別タブでキャラを追加してピン
  act(() => result.current.addCharacter("霊夢"));
  const id = result.current.project.characters[0]!.id;
  act(() => result.current.pinCharacter(id));

  // 新規タブを追加（ローカルキャラ0・行0）
  act(() => result.current.newProject());

  // アクティブタブは行もローカルキャラも0 → isEmpty=true
  expect(result.current.tabs.find((t) => t.id === result.current.activeId)!.isEmpty).toBe(true);
  // pinnedCharacters は存在するが isEmpty に影響しない
  expect(result.current.pinnedCharacters).toHaveLength(1);
});

// テスト3: deleteCharacter 共通 — 複数プロジェクトのラインを正しく fallback へ
test("deleteCharacter: 共通キャラ削除で複数プロジェクトのラインが fallback へ付け替わる（無関係なラインは維持）", () => {
  const { result } = renderHook(() => useProject());

  // P1: 霊夢（共通予定）と魔理沙（ローカル）を追加し行を2本
  act(() => result.current.addCharacter("霊夢"));
  act(() => result.current.addCharacter("魔理沙"));
  const reimuId = result.current.project.characters[0]!.id;
  const marisaId = result.current.project.characters[1]!.id;
  act(() => result.current.addLineAtEnd()); // 先頭=霊夢（後でピン）
  act(() => result.current.addLineAtEnd()); // 霊夢
  act(() => result.current.updateLineCharacter(result.current.project.lines[1]!.id, marisaId)); // 2行目=魔理沙

  // 霊夢を共通へ
  act(() => result.current.pinCharacter(reimuId));
  const p1Id = result.current.activeId;

  // P2: 共通の霊夢を話者とする行
  act(() => result.current.newProject());
  act(() => result.current.addLineAtEnd()); // 先頭=共通の霊夢

  // P1 に戻って霊夢（共通）を削除
  act(() => result.current.switchProject(p1Id));
  act(() => result.current.deleteCharacter(reimuId));

  // 共通プールが空に
  expect(result.current.pinnedCharacters).toHaveLength(0);

  // P1 の霊夢参照ラインが魔理沙（fallback）に付け替わっている
  const p1Line0 = result.current.project.lines[0]!;
  expect(p1Line0.characterId).toBe(marisaId);
  // P1 の魔理沙参照ラインは変わらない（無関係なラインは維持）
  const p1Line1 = result.current.project.lines[1]!;
  expect(p1Line1.characterId).toBe(marisaId);
});

// テスト4: materialize — 未参照の共通キャラは書き出しに含まれない
test("saveToFile: materialize — 未参照の共通キャラは書き出しに含まれない", () => {
  const blobContents: Blob[] = [];
  const originalCreateObjectURL = URL.createObjectURL;
  const originalRevokeObjectURL = URL.revokeObjectURL;
  URL.createObjectURL = (blob: Blob) => {
    blobContents.push(blob);
    return "blob:stub";
  };
  URL.revokeObjectURL = () => {};

  const anchorClickSpy = vi.fn();
  const originalBodyAppendChild = document.body.appendChild.bind(document.body);
  const originalBodyRemoveChild = document.body.removeChild.bind(document.body);
  vi.spyOn(document.body, "appendChild").mockImplementation((node) => {
    if (node instanceof HTMLAnchorElement) {
      vi.spyOn(node, "click").mockImplementation(anchorClickSpy);
    }
    return originalBodyAppendChild(node);
  });
  vi.spyOn(document.body, "removeChild").mockImplementation((node) => originalBodyRemoveChild(node));

  const { result } = renderHook(() => useProject());
  // 霊夢（共通・参照あり）と妖夢（共通・参照なし）
  act(() => result.current.addCharacter("霊夢"));
  act(() => result.current.addCharacter("妖夢"));
  const reimuId = result.current.project.characters[0]!.id;
  const youmuId = result.current.project.characters[1]!.id;
  act(() => result.current.pinCharacter(reimuId));
  act(() => result.current.pinCharacter(youmuId));
  // 霊夢のみ行で参照する
  act(() => result.current.addLineAtEnd()); // 先頭=共通の霊夢

  act(() => result.current.saveToFile());

  URL.createObjectURL = originalCreateObjectURL;
  URL.revokeObjectURL = originalRevokeObjectURL;
  vi.restoreAllMocks();

  expect(blobContents).toHaveLength(1);
  const fileText = new Promise<string>((resolve) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.readAsText(blobContents[0]!);
  });

  return fileText.then((text) => {
    const parsed = JSON.parse(text);
    const charNames: string[] = parsed.characters.map((c: { name: string }) => c.name);
    // 霊夢（参照あり）は含まれる
    expect(charNames).toContain("霊夢");
    // 妖夢（参照なし）は含まれない（否定側アサーション）
    expect(charNames).not.toContain("妖夢");
  });
});

// ===== F-128 インポート時の共通キャラ照合 =====

test("loadFromFile (F-128): 共通キャラ（霊夢）をピンした状態で霊夢を含む .ymscript をロード → 新規タブで霊夢が1人だけ、行が共通 id を参照", async () => {
  const { result } = renderHook(() => useProject());

  // 霊夢をローカルに追加してピン
  act(() => result.current.addCharacter("霊夢"));
  const pinnedReimuId = result.current.project.characters[0]!.id;
  act(() => result.current.pinCharacter(pinnedReimuId));
  expect(result.current.pinnedCharacters[0]!.id).toBe(pinnedReimuId);

  // 霊夢を含む .ymscript を読み込む（別のローカル id を持つ）
  const importedReimuId = "imported-reimu-id";
  const ymscript = JSON.stringify({
    version: 1,
    projectName: "霊夢の台本",
    characters: [{ id: importedReimuId, name: "霊夢", color: "#AABBCC" }],
    lines: [{ id: "imported-line-1", characterId: importedReimuId, text: "こんにちは" }],
  });
  const file = new File([ymscript], "reimu.ymscript", { type: "application/json" });

  await act(async () => {
    await result.current.loadFromFile(file);
  });

  // 新規タブがアクティブになっている
  expect(result.current.tabs).toHaveLength(2);
  expect(result.current.project.projectName).toBe("霊夢の台本");

  // ローカルキャラに霊夢が追加されていない（共通に同定されたため）
  expect(result.current.project.characters).toHaveLength(0);

  // 実効一覧では共通の霊夢が1人だけ
  expect(result.current.characters).toHaveLength(1);
  expect(result.current.characters[0]!.name).toBe("霊夢");

  // 行の characterId が共通の霊夢 id に付け替わっている
  expect(result.current.project.lines).toHaveLength(1);
  expect(result.current.project.lines[0]!.characterId).toBe(pinnedReimuId);
});

test("loadFromFile (F-128): 同名なしキャラはローカルとして取り込まれる", async () => {
  const { result } = renderHook(() => useProject());

  // 霊夢を共通にピン
  act(() => result.current.addCharacter("霊夢"));
  act(() => result.current.pinCharacter(result.current.project.characters[0]!.id));

  // 霊夢（共通と同定）＋咲夜（新規）を含む .ymscript
  const ymscript = JSON.stringify({
    version: 1,
    projectName: "混合台本",
    characters: [
      { id: "imp-reimu", name: "霊夢", color: "#000" },
      { id: "imp-sakuya", name: "咲夜", color: "#FFF" },
    ],
    lines: [
      { id: "ll1", characterId: "imp-reimu", text: "A" },
      { id: "ll2", characterId: "imp-sakuya", text: "B" },
    ],
  });
  const file = new File([ymscript], "mixed.ymscript", { type: "application/json" });

  await act(async () => {
    await result.current.loadFromFile(file);
  });

  // 咲夜のみローカルに取り込まれる
  expect(result.current.project.characters).toHaveLength(1);
  expect(result.current.project.characters[0]!.name).toBe("咲夜");

  // 霊夢の行は共通 id へ、咲夜の行はそのまま
  const pinnedReimuId = result.current.pinnedCharacters[0]!.id;
  expect(result.current.project.lines[0]!.characterId).toBe(pinnedReimuId);
  expect(result.current.project.lines[1]!.characterId).toBe("imp-sakuya");
});

test("importMarkdown (F-128): 共通キャラ（霊夢）をピンした状態で霊夢を含む .md をインポート → 行が共通 id を参照", async () => {
  const { result } = renderHook(() => useProject());

  // 霊夢を共通にピン
  act(() => result.current.addCharacter("霊夢"));
  const pinnedReimuId = result.current.project.characters[0]!.id;
  act(() => result.current.pinCharacter(pinnedReimuId));

  // 霊夢を含む Markdown
  const md = new File(["霊夢: おはよう\n魔理沙: どうも"], "test.md", { type: "text/markdown" });

  await act(async () => {
    await result.current.importMarkdown(md);
  });

  // 新規タブがアクティブ
  expect(result.current.tabs).toHaveLength(2);

  // ローカルに霊夢が重複追加されていない（霊夢は共通に同定）
  // 魔理沙は新規ローカルとして取り込まれる
  expect(result.current.project.characters).toHaveLength(1);
  expect(result.current.project.characters[0]!.name).toBe("魔理沙");

  // 霊夢の行の characterId が共通 id になっている
  const reimuLine = result.current.project.lines.find((l) => l.text === "おはよう")!;
  expect(reimuLine.characterId).toBe(pinnedReimuId);
});

test("importMarkdown (F-128): pinned が空なら全キャラがローカルとして取り込まれる", async () => {
  const { result } = renderHook(() => useProject());

  const md = new File(["霊夢: こんにちは\n魔理沙: どうも"], "nopin.md", { type: "text/markdown" });

  await act(async () => {
    await result.current.importMarkdown(md);
  });

  // pinned なしなので霊夢・魔理沙の両方がローカルに
  expect(result.current.project.characters).toHaveLength(2);
  expect(result.current.pinnedCharacters).toHaveLength(0);
});

// テスト5: CSV/コピー — 共通キャラを話者にした行の名前が解決される
test("exportCSVToClipboard: 共通キャラを話者にした行の CSV で名前が解決される", async () => {
  const writeText = vi.fn().mockResolvedValue(undefined);
  Object.assign(navigator, { clipboard: { writeText } });

  const { result } = renderHook(() => useProject());
  act(() => result.current.addCharacter("霊夢"));
  const reimuId = result.current.project.characters[0]!.id;
  act(() => result.current.pinCharacter(reimuId)); // 共通へ
  act(() => result.current.addLineAtEnd()); // 先頭=共通の霊夢
  act(() => result.current.updateLineText(result.current.project.lines[0]!.id, "おは！"));

  await act(async () => {
    await result.current.exportCSVToClipboard();
  });

  // 話者名「霊夢」がCSVに解決されている
  expect(writeText).toHaveBeenCalledWith(expect.stringContaining("霊夢"));
  expect(writeText).toHaveBeenCalledWith(expect.stringContaining("おは！"));
});
