import { parseProjectFile, parseWorkspaceFile, reconcileImportedCharacters, sanitizeFilename } from "./file";
import type { Character, Project, Workspace } from "../types";

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
  pinnedCharacters: [],
};

test("parseWorkspaceFile: 正常なワークスペースはそのまま返す", () => {
  expect(parseWorkspaceFile(validWs)).toEqual(validWs);
});

test("parseWorkspaceFile: 複数エントリでも正常に返す", () => {
  const entry2 = {
    id: "entry-2",
    project: { version: 1, projectName: "P2", characters: [], lines: [] } satisfies Project,
  };
  const ws: Workspace = { version: 1, activeId: "entry-2", entries: [validEntry, entry2], pinnedCharacters: [] };
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

// ===== v1.4 pinnedCharacters マイグレーション =====

test("parseWorkspaceFile: pinnedCharacters 欠落（旧形式）→ [] にマイグレーション", () => {
  // pinnedCharacters キーなし（旧ワークスペース）
  const oldWs = { version: 1, activeId: "entry-1", entries: validWs.entries };
  const result = parseWorkspaceFile(oldWs);
  expect(result.pinnedCharacters).toEqual([]);
});

test("parseWorkspaceFile: pinnedCharacters が正常な Character[] なら採用する", () => {
  const ws = {
    ...validWs,
    pinnedCharacters: [{ id: "p1", name: "レミリア", color: "#C792EA" }],
  };
  const result = parseWorkspaceFile(ws);
  expect(result.pinnedCharacters).toHaveLength(1);
  expect(result.pinnedCharacters[0]!.name).toBe("レミリア");
});

test("parseWorkspaceFile: pinnedCharacters が不正な要素を含む場合は例外", () => {
  const ws = {
    ...validWs,
    pinnedCharacters: [{ id: "p1", name: 123, color: "#C792EA" }], // name が number
  };
  expect(() => parseWorkspaceFile(ws)).toThrow();
});

test("parseWorkspaceFile: pinnedCharacters が配列でない場合は例外", () => {
  const ws = {
    ...validWs,
    pinnedCharacters: "not-an-array",
  };
  expect(() => parseWorkspaceFile(ws)).toThrow();
});

// ===== reconcileImportedCharacters =====

const reimuPinned: Character = { id: "p-reimu", name: "霊夢", color: "#FF6B6B" };
const marisaPinned: Character = { id: "p-marisa", name: "魔理沙", color: "#4ECDC4" };

test("reconcileImportedCharacters: 同名キャラが pinned にある → ローカルに含まれず、line の characterId が pinnedId に付け替わる", () => {
  const imported: Project = {
    version: 1,
    projectName: "台本A",
    characters: [{ id: "local-reimu", name: "霊夢", color: "#AABBCC" }],
    lines: [{ id: "l1", characterId: "local-reimu", text: "やあ" }],
  };
  const result = reconcileImportedCharacters(imported, [reimuPinned]);
  // 霊夢はローカルに含まれない
  expect(result.characters).toHaveLength(0);
  // 行の characterId が pinnedId に付け替わっている
  expect(result.lines[0]!.characterId).toBe("p-reimu");
  // その他のフィールドは不変
  expect(result.projectName).toBe("台本A");
  expect(result.version).toBe(1);
});

test("reconcileImportedCharacters: 同名が無いキャラ → ローカルに残り id 不変、lines もそのまま", () => {
  const imported: Project = {
    version: 1,
    projectName: "台本B",
    characters: [{ id: "local-youmu", name: "妖夢", color: "#FFFFFF" }],
    lines: [{ id: "l2", characterId: "local-youmu", text: "はい" }],
  };
  const result = reconcileImportedCharacters(imported, [reimuPinned]);
  // 妖夢はローカルに残る（id 不変）
  expect(result.characters).toHaveLength(1);
  expect(result.characters[0]!.id).toBe("local-youmu");
  // 行の characterId はそのまま
  expect(result.lines[0]!.characterId).toBe("local-youmu");
});

test("reconcileImportedCharacters: 名前 trim 一致（前後空白付き）で同定される", () => {
  const trimPinned: Character = { id: "p-trim", name: "  霊夢  ", color: "#FF0000" };
  const imported: Project = {
    version: 1,
    projectName: "台本C",
    characters: [{ id: "local-trim", name: "霊夢", color: "#000000" }],
    lines: [{ id: "l3", characterId: "local-trim", text: "test" }],
  };
  // pinned の名前が "  霊夢  "（trim すると "霊夢"）、imported の名前が "霊夢" → 同定される
  const result = reconcileImportedCharacters(imported, [trimPinned]);
  expect(result.characters).toHaveLength(0);
  expect(result.lines[0]!.characterId).toBe("p-trim");
});

test("reconcileImportedCharacters: 色違いでも名前一致なら同定（共通優先 = local は characters に追加されない）", () => {
  const imported: Project = {
    version: 1,
    projectName: "台本D",
    characters: [{ id: "local-reimu2", name: "霊夢", color: "#000000" }], // 色が違う
    lines: [{ id: "l4", characterId: "local-reimu2", text: "color test" }],
  };
  const result = reconcileImportedCharacters(imported, [reimuPinned]);
  // 名前一致なので同定 → ローカルに含まれない（共通側の色が採用される）
  expect(result.characters).toHaveLength(0);
  expect(result.lines[0]!.characterId).toBe("p-reimu");
});

test("reconcileImportedCharacters: pinned が空なら imported がそのまま返る", () => {
  const imported: Project = {
    version: 1,
    projectName: "台本E",
    characters: [{ id: "c1", name: "霊夢", color: "#FF6B6B" }],
    lines: [{ id: "l5", characterId: "c1", text: "no pinned" }],
  };
  const result = reconcileImportedCharacters(imported, []);
  expect(result.characters).toHaveLength(1);
  expect(result.characters[0]!.id).toBe("c1");
  expect(result.lines[0]!.characterId).toBe("c1");
});

test("reconcileImportedCharacters: 同名 imported キャラが複数あっても同じ pinnedId にマップされる", () => {
  const imported: Project = {
    version: 1,
    projectName: "台本F",
    characters: [
      { id: "local-reimu-a", name: "霊夢", color: "#111111" },
      { id: "local-reimu-b", name: "霊夢", color: "#222222" },
    ],
    lines: [
      { id: "l6a", characterId: "local-reimu-a", text: "A" },
      { id: "l6b", characterId: "local-reimu-b", text: "B" },
    ],
  };
  const result = reconcileImportedCharacters(imported, [reimuPinned]);
  // どちらの霊夢も同定されローカルには残らない
  expect(result.characters).toHaveLength(0);
  // どちらの行も pinnedId に付け替わる
  expect(result.lines[0]!.characterId).toBe("p-reimu");
  expect(result.lines[1]!.characterId).toBe("p-reimu");
});

test("reconcileImportedCharacters: 一部同定・一部ローカル残しが混在するケース", () => {
  const imported: Project = {
    version: 1,
    projectName: "台本G",
    characters: [
      { id: "local-reimu3", name: "霊夢", color: "#AABBCC" }, // pinned にある
      { id: "local-sakuya", name: "咲夜", color: "#CCDDEE" }, // pinned にない
    ],
    lines: [
      { id: "l7a", characterId: "local-reimu3", text: "reimu line" },
      { id: "l7b", characterId: "local-sakuya", text: "sakuya line" },
    ],
  };
  const result = reconcileImportedCharacters(imported, [reimuPinned, marisaPinned]);
  // 霊夢はローカルから除外、咲夜はローカルに残る
  expect(result.characters).toHaveLength(1);
  expect(result.characters[0]!.name).toBe("咲夜");
  // 霊夢の行は pinnedId に付け替わる
  expect(result.lines[0]!.characterId).toBe("p-reimu");
  // 咲夜の行はそのまま
  expect(result.lines[1]!.characterId).toBe("local-sakuya");
});
