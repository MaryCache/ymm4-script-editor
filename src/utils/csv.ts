// src/utils/csv.ts
import type { Character, Line, Project } from "../types";

// 1セリフ = CSV 1行。YMM4 はクォートエスケープ非対応想定のため、列ズレを防ぐ目的で
// コンマ類（ASCII カンマ U+002C・読点 U+3001）を全角カンマ U+FF0C へ統一し、
// 改行/CR を半角スペースへ畳む（この変換は非可逆）。
const escapeText = (text: string): string =>
  text.replace(/\r\n|\r|\n/g, " ").replace(/[,、]/g, "，");

export const buildLineCSV = (line: Line, characters: Character[]): string => {
  const name = characters.find((c) => c.id === line.characterId)?.name ?? "";
  return `${name},${escapeText(line.text)}`;
};

export const buildCSVText = (project: Project): string =>
  project.lines.map((line) => buildLineCSV(line, project.characters)).join("\n");

export const buildCSV = (project: Project): string => "﻿" + buildCSVText(project);
