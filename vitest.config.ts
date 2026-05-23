import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

// テスト専用の設定。本番用 vite.config.ts（PWA プラグイン等）を読み込まず、
// React 変換と jsdom 環境だけに絞ることでテスト起動を軽くする。
export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: "jsdom",
    setupFiles: ["./src/test/setup.ts"],
  },
});
