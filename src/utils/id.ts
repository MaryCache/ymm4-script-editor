// src/utils/id.ts

// 注: `crypto.randomUUID` は secure context（HTTPS / localhost）必須。
// GitHub Pages は HTTPS なので本番可。
export const generateId = (): string => crypto.randomUUID();
