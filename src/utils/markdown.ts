// src/utils/markdown.ts
import type { Character, Line, Project } from "../types";
import { generateId } from "./id";
import { colorForIndex } from "./color";

export type ParseResult = { project: Project; skippedLines: number };

type Frontmatter = { projectName?: string; characters: { name: string; color: string }[] };

const unquote = (s: string): string => s.trim().replace(/^["']|["']$/g, "");

// 対象フォーマット限定の最小フロントマターパーサ。
// 期待構造: project: 文字列 / characters: ( - name: / color: ) の繰り返し。
// 想定外のインデントや複数行値は黙って無視される（割り切り）。
const parseFrontmatter = (block: string): Frontmatter => {
  const result: Frontmatter = { characters: [] };
  let current: { name: string; color: string } | null = null;
  for (const rawLine of block.split("\n")) {
    const line = rawLine.replace(/\s+$/, "");
    if (line.trim() === "" || line.trim() === "characters:") continue;

    const project = line.match(/^\s*project:\s*(.+)$/);
    if (project) { result.projectName = unquote(project[1]!); continue; }

    const name = line.match(/^\s*-\s*name:\s*(.+)$/);
    if (name) { current = { name: unquote(name[1]!), color: "" }; result.characters.push(current); continue; }

    const color = line.match(/^\s*color:\s*(.+)$/);
    if (color && current) { current.color = unquote(color[1]!); continue; }
  }
  return result;
};

export const parseMarkdown = (raw: string): ParseResult => {
  let body = raw.replace(/\r\n/g, "\n");
  let fm: Frontmatter = { characters: [] };

  const fmMatch = body.match(/^---\n([\s\S]*?)\n---\n?/);
  if (fmMatch) {
    fm = parseFrontmatter(fmMatch[1]!);
    body = body.slice(fmMatch[0].length);
  }

  const characters: Character[] = fm.characters.map((c, i) => ({
    id: generateId(),
    name: c.name,
    color: c.color || colorForIndex(i),
  }));
  const byName = new Map<string, Character>(characters.map((c) => [c.name, c]));

  const ensureCharacter = (name: string): Character => {
    const existing = byName.get(name);
    if (existing) return existing;
    const created: Character = { id: generateId(), name, color: colorForIndex(characters.length) };
    characters.push(created);
    byName.set(name, created);
    return created;
  };

  const lines: Line[] = [];
  let skippedLines = 0;

  for (const rawLine of body.split("\n")) {
    const line = rawLine.trim();
    if (line === "" || line.startsWith("#")) continue;

    const sep = line.indexOf(": "); // 区切りは「コロン＋半角スペース」のみ
    if (sep <= 0) { skippedLines++; continue; }

    const name = line.slice(0, sep).trim();
    const text = line.slice(sep + 2).trim();
    if (name === "") { skippedLines++; continue; }

    lines.push({ id: generateId(), characterId: ensureCharacter(name).id, text });
  }

  return {
    project: { version: 1, projectName: fm.projectName ?? "新規プロジェクト", characters, lines },
    skippedLines,
  };
};

export const buildMarkdown = (project: Project): string => {
  const head = [
    "---",
    `project: ${project.projectName}`,
    "characters:",
    ...project.characters.map((c) => [`  - name: ${c.name}`, `    color: "${c.color}"`].join("\n")),
    "---",
    "",
  ].join("\n");

  const nameById = new Map(project.characters.map((c) => [c.id, c.name]));
  const bodyText = project.lines.map((l) => `${nameById.get(l.characterId) ?? ""}: ${l.text}`).join("\n");

  return head + bodyText + "\n";
};
