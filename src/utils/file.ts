// src/utils/file.ts
import type { Character, Line, Project } from "../types";

/**
 * 文字列からファイル名として不正な文字を除去し、安全なファイル名を返す。
 *
 * @remarks
 * OS・ブラウザの `anchor.download` が不正文字を含むファイル名を
 * どう扱うかは実装依存のため、保存前に正規化する。
 *
 * 置換対象: パス区切り（`/` `\`）、Windows 禁止文字（`: * ? " < > |`）、
 * および制御文字（U+0000–U+001F）をアンダースコアに置換する。
 *
 * 全てアンダースコアになった場合（例: `"???"`→`"___"`）は
 * 有効な文字が含まれていないとみなして `"untitled"` にフォールバックする。
 *
 * @param name - サニタイズ前のファイル名ベース（拡張子なし）
 * @returns 安全なファイル名文字列。空や全アンダースコアの場合は `"untitled"`
 *
 * @example
 * ```ts
 * sanitizeFilename("my/project:name"); // => "my_project_name"
 * sanitizeFilename("???");             // => "untitled"
 * sanitizeFilename("  hello  ");       // => "hello"
 * ```
 */
// ファイル名として不正な文字（パス区切り・Windowsで禁止される記号・制御文字）を
// アンダースコアに置換する。ブラウザが anchor.download をそのままOSに渡す際、
// 不正文字が含まれると動作がブラウザ依存になるため、保存前に正規化する。
export const sanitizeFilename = (name: string): string => {
  // eslint-disable-next-line no-control-regex
  const sanitized = name.replace(/[/\\:*?"<>|\x00-\x1f]/g, "_").trim();
  // 空文字だけでなく全てアンダースコア（例: "???" → "___"）の場合も意味のある名前がないため
  // "untitled" にフォールバックする。サニタイズ前の元の名前が有効文字を含まなかった証拠。
  if (sanitized.length === 0 || /^_+$/.test(sanitized)) return "untitled";
  return sanitized;
};

/**
 * Blob をユーザーのローカルにダウンロードさせる。
 *
 * @remarks
 * 一時的なオブジェクト URL を生成し、非表示 `<a>` を DOM に挿入してクリックする。
 * DOM に挿入してから `click()` する理由: 未挿入だと一部ブラウザで `click` が発火しない。
 * 同期 `revokeObjectURL` はダウンロード開始前に URL が無効化されうるため、
 * `setTimeout(0)` で1マイクロタスク後に解放する。
 *
 * @param blob - ダウンロードするデータの Blob
 * @param filename - 保存ダイアログに表示するファイル名
 */
export const downloadBlob = (blob: Blob, filename: string): void => {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  // DOM に挿入してから click する。未挿入だと一部ブラウザで click イベントが発火しない。
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  // 同期 revoke はダウンロード開始前に URL が無効化されうるため、
  // マイクロタスクを1周待ってから解放する。
  setTimeout(() => URL.revokeObjectURL(url), 0);
};

/**
 * テキスト文字列を指定 MIME タイプのファイルとしてダウンロードさせる。
 *
 * @remarks
 * `text` を `Blob` に変換して {@link downloadBlob} に委譲する。
 *
 * @param text - ダウンロードするテキスト内容
 * @param filename - 保存ダイアログに表示するファイル名
 * @param mime - MIME タイプ（例: `"text/csv;charset=utf-8"`）
 *
 * @see {@link downloadBlob}
 */
export const downloadText = (text: string, filename: string, mime: string): void => {
  downloadBlob(new Blob([text], { type: mime }), filename);
};

/**
 * `File` オブジェクトをテキストとして非同期に読み込む。
 *
 * @remarks
 * `FileReader.readAsText` を Promise でラップする。
 * エラー時は `FileReader.error` をそのまま reject するか、
 * エラーが null の場合は汎用 `Error` を reject する。
 *
 * @param file - 読み込む File オブジェクト
 * @returns ファイルのテキスト内容
 */
export const readFileAsText = (file: File): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error ?? new Error("ファイル読み込みに失敗しました"));
    reader.readAsText(file);
  });

const isString = (v: unknown): v is string => typeof v === "string";

const isCharacter = (v: unknown): v is Character =>
  typeof v === "object" && v !== null &&
  isString((v as Character).id) && isString((v as Character).name) && isString((v as Character).color);

const isLine = (v: unknown): v is Line =>
  typeof v === "object" && v !== null &&
  isString((v as Line).id) && isString((v as Line).characterId) && isString((v as Line).text);

/**
 * 未知の JSON 値をプロジェクトデータとして検証し、型安全な `Project` を返す。
 *
 * @remarks
 * `.ymscript` ファイルの JSON を `JSON.parse` した結果を渡す想定。
 * バージョン・必須フィールドの存在・型を検証する。
 *
 * 注: `characterId` の参照整合性（存在する Character を指すか）まで検証しない。
 * 孤児 Line は select が空表示になるだけで状態破壊には至らないため、v1 では許容する。
 *
 * @param raw - `JSON.parse` で得た未知の値
 * @returns 検証済みの `Project` オブジェクト
 * @throws `Error` スキーマ違反または非対応バージョンの場合
 *
 * @see {@link Project}
 */
// 注: characterId の参照整合性（存在する Character を指すか）までは検証しない。
// 孤児 Line は select が空表示になるだけで状態破壊には至らないため、v1 では許容する。
export const parseProjectFile = (raw: unknown): Project => {
  if (typeof raw !== "object" || raw === null) throw new Error("プロジェクトファイルの形式が不正です");
  const obj = raw as Record<string, unknown>;
  if (obj.version !== 1) throw new Error("非対応のバージョンです");
  if (!isString(obj.projectName)) throw new Error("projectName が不正です");
  if (!Array.isArray(obj.characters) || !obj.characters.every(isCharacter)) throw new Error("characters が不正です");
  if (!Array.isArray(obj.lines) || !obj.lines.every(isLine)) throw new Error("lines が不正です");
  return { version: 1, projectName: obj.projectName, characters: obj.characters, lines: obj.lines };
};
