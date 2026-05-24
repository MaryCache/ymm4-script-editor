// src/utils/markdown.ts
import type { Character, Line, Project } from "../types";
import { generateId } from "./id";
import { colorForIndex } from "./color";

/**
 * Markdown インポートの結果を表す型。
 *
 * @remarks
 * `project` はパース成功した {@link Project}。
 * `skippedLines` は「キャラ名: テキスト」形式に合わなかった行の件数
 * （ユーザーへの通知用）。
 *
 * @see {@link parseMarkdown}
 */
export type ParseResult = { project: Project; skippedLines: number };

/** フロントマターの内部表現（パース専用）。 */
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
    if (project) {
      result.projectName = unquote(project[1]!);
      continue;
    }

    const name = line.match(/^\s*-\s*name:\s*(.+)$/);
    if (name) {
      current = { name: unquote(name[1]!), color: "" };
      result.characters.push(current);
      continue;
    }

    const color = line.match(/^\s*color:\s*(.+)$/);
    if (color && current) {
      current.color = unquote(color[1]!);
      continue;
    }
  }
  return result;
};

/**
 * Markdown テキストをプロジェクトデータへパースする。
 *
 * @remarks
 * フォーマット:
 * - オプションの YAML フロントマター（`---` 区切り）でプロジェクト名とキャラクター色を定義。
 * - 本文は `キャラ名: テキスト` の行を台本行として解釈。
 * - `#` 始まりの見出し行・空行はスキップ（`skippedLines` にはカウントされない）。
 * - 区切りが「コロン＋半角スペース」でない行は `skippedLines` にカウント。
 * - フロントマターに未登録のキャラクター名が本文に現れた場合、自動生成して追加する。
 * - 孤立した `\r`（旧 Mac 改行）も `\n` に統一する。
 *
 * @param raw - 読み込んだ Markdown テキスト（UTF-8 文字列）
 * @returns パース結果 `{ project, skippedLines }`
 *
 * @example
 * ```ts
 * const md = `---\nproject: 劇場版\ncharacters:\n  - name: 春香\n    color: "#FF6B6B"\n---\n春香: こんにちは\n`;
 * const { project, skippedLines } = parseMarkdown(md);
 * // project.projectName === "劇場版"
 * // project.lines[0]?.text === "こんにちは"
 * // skippedLines === 0
 * ```
 *
 * @see {@link buildMarkdown} — 逆変換（Project → Markdown）
 * @see {@link ParseResult}
 */
export const parseMarkdown = (raw: string): ParseResult => {
  // 孤立した \r（旧 Mac 改行）も \n に統一する。
  let body = raw.replace(/\r\n|\r/g, "\n");
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
    if (sep <= 0) {
      skippedLines++;
      continue;
    }

    const name = line.slice(0, sep).trim();
    const text = line.slice(sep + 2).trim();
    if (name === "") {
      skippedLines++;
      continue;
    }

    lines.push({ id: generateId(), characterId: ensureCharacter(name).id, text });
  }

  return {
    project: { version: 1, projectName: fm.projectName ?? "新規プロジェクト", characters, lines },
    skippedLines,
  };
};

// フロントマターに改行が混入すると --- の区切りが崩れて round-trip が壊れるため、
// projectName とキャラ名の改行（\r\n / \r / \n）を半角スペースに置換してから埋め込む。
const sanitizeLine = (s: string): string => s.replace(/\r\n|\r|\n/g, " ");

/**
 * プロジェクトデータを Markdown テキストへ変換する。
 *
 * @remarks
 * YAML フロントマター（`---` 区切り）にプロジェクト名とキャラクター色を書き出し、
 * 本文は `キャラ名: テキスト` 形式で各行を並べる。
 * `projectName` / キャラ名 / 本文テキストに含まれる改行はスペースに置換して
 * 本文での行区切り誤認とフロントマターの `---` 崩れを防ぐ。
 *
 * @remarks
 * **round-trip 保証の範囲**: 典型的な入力（改行なし・`: ` を含まない・行頭 `#` なし）では
 * `parseMarkdown(buildMarkdown(project))` が元データを再現する。
 * ただし `text` 内の `: `（区切り誤認）や行頭 `#`（見出し誤認）は
 * エスケープしないため、これらを含む場合の厳密な可逆性は保証しない。
 *
 * @param project - 変換対象のプロジェクト
 * @returns Markdown テキスト文字列（末尾 `\n` 付き）
 *
 * @see {@link parseMarkdown} — 逆変換（Markdown → Project）
 */
export const buildMarkdown = (project: Project): string => {
  const head = [
    "---",
    `project: ${sanitizeLine(project.projectName)}`,
    "characters:",
    ...project.characters.map((c) => [`  - name: ${sanitizeLine(c.name)}`, `    color: "${c.color}"`].join("\n")),
    "---",
    "",
  ].join("\n");

  const nameById = new Map(project.characters.map((c) => [c.id, c.name]));
  const bodyText = project.lines.map((l) => `${nameById.get(l.characterId) ?? ""}: ${sanitizeLine(l.text)}`).join("\n");

  return head + bodyText + "\n";
};
