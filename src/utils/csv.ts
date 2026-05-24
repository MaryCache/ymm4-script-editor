// src/utils/csv.ts
import type { Character, Line, Project } from "../types";

// 1セリフ = CSV 1行。YMM4 はクォートエスケープ非対応想定のため、列ズレを防ぐ目的で
// ASCII カンマ U+002C のみを全角カンマ U+FF0C へ変換し、改行/CR を半角スペースへ畳む
// （この変換は非可逆）。
// 読点「、」(U+3001) はユーザーの表記であり CSV の列区切りにはならないため変換しない。
// 名前列も同じ列ズレリスクがあるため escapeText を適用する。
const escapeText = (text: string): string => text.replace(/\r\n|\r|\n/g, " ").replace(/,/g, "，");

/**
 * 1行のセリフを YMM4 向け CSV 行文字列（`名前,テキスト`）に変換する。
 *
 * @remarks
 * - ASCII カンマ（U+002C）は全角カンマ（U+FF0C）に置換（列ズレ防止）。
 * - 改行・CR はスペースに正規化（非可逆変換）。
 * - `line.characterId` に対応するキャラクターが見つからない場合、名前列は空文字。
 * - 読点「、」(U+3001) は列区切りにならないため変換しない。
 *
 * @param line - 変換対象のセリフ行
 * @param characters - キャラクター一覧（名前解決に使用）
 * @returns `"名前,テキスト"` 形式の CSV 行文字列（BOM なし・改行なし）
 *
 * @see {@link buildCSVText}
 * @see {@link buildCSV}
 */
export const buildLineCSV = (line: Line, characters: Character[]): string => {
  const name = characters.find((c) => c.id === line.characterId)?.name ?? "";
  return `${escapeText(name)},${escapeText(line.text)}`;
};

/**
 * プロジェクト全行を YMM4 向け CSV テキスト（BOM なし）に変換する。
 *
 * @remarks
 * 各行を `buildLineCSV` で変換し、改行（`\n`）で結合する。
 * BOM なしなので、クリップボードコピー（`exportCSVToClipboard`）に適している。
 *
 * @param project - 変換対象のプロジェクト
 * @returns 全行を `\n` 区切りにした CSV テキスト（BOM なし）
 *
 * @see {@link buildLineCSV}
 * @see {@link buildCSV}
 */
export const buildCSVText = (project: Project): string =>
  project.lines.map((line) => buildLineCSV(line, project.characters)).join("\n");

/**
 * プロジェクト全行を YMM4 向け CSV テキスト（UTF-8 BOM 付き）に変換する。
 *
 * @remarks
 * Excel / YMM4 での文字化けを防ぐため UTF-8 BOM（U+FEFF）を先頭に付与する。
 * ファイルダウンロード用途に使用する。クリップボードコピーには {@link buildCSVText} を使う。
 *
 * @param project - 変換対象のプロジェクト
 * @returns BOM 付き CSV テキスト文字列
 *
 * @example
 * ```ts
 * const csv = buildCSV(project);
 * // csv.charCodeAt(0) === 0xFEFF (BOM)
 * downloadText(csv, "script.csv", "text/csv;charset=utf-8");
 * ```
 *
 * @see {@link buildCSVText}
 * @see {@link buildLineCSV}
 */
export const buildCSV = (project: Project): string => "﻿" + buildCSVText(project);
