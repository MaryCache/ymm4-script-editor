// src/utils/id.ts

/**
 * プロジェクト内の各エンティティ（キャラクター・行）用の一意 ID を生成する。
 *
 * @remarks
 * `crypto.randomUUID` は Secure Context（HTTPS または localhost）でのみ利用可能。
 * 本アプリは GitHub Pages（HTTPS）でのみ配信されるため本番環境では常に利用可能。
 *
 * @returns ハイフン区切りの UUID v4 文字列（例: `"a3f8c2e1-..."`）
 *
 * @example
 * ```ts
 * const id = generateId();
 * // => "550e8400-e29b-41d4-a716-446655440000" (example)
 * ```
 *
 * @see {@link https://developer.mozilla.org/en-US/docs/Web/API/Crypto/randomUUID | MDN: crypto.randomUUID}
 */
// 注: `crypto.randomUUID` は secure context（HTTPS / localhost）必須。
// GitHub Pages は HTTPS なので本番可。
export const generateId = (): string => crypto.randomUUID();
