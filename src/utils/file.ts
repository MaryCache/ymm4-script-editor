// src/utils/file.ts
import type { Character, Line, Project } from "../types";

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

export const downloadText = (text: string, filename: string, mime: string): void => {
  downloadBlob(new Blob([text], { type: mime }), filename);
};

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
