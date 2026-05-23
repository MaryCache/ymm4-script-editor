import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

// Why SVG instead of PNG: ImageMagick 不要（依存ゼロ）、ベクタなので全サイズに対応、
// Chrome/Edge の PWA インストール要件（sizes: "any"）を SVG 単独で満たせるため。
export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: "autoUpdate",
      // favicon.svg は index.html <link rel="icon"> 用、icon.svg が PWA install 用
      includeAssets: ["favicon.svg", "icon.svg"],
      manifest: {
        name: "YMM4台本エディタ",
        short_name: "台本エディタ",
        start_url: "/",
        display: "standalone",
        lang: "ja",
        background_color: "#0f1117",
        theme_color: "#5b8dff",
        icons: [
          // purpose は "any" のみ。icon.svg はマスク用セーフゾーンを持たないため
          // "maskable" を名乗らない（名乗ると Android で円形マスクにグリフが欠ける）。
          // 主ターゲットは Chrome/Edge デスクトップ（モバイルはスコープ外 NF-21）。
          {
            src: "icon.svg",
            sizes: "any",
            type: "image/svg+xml",
            purpose: "any",
          },
        ],
      },
      workbox: {
        globPatterns: ["**/*.{js,css,html,svg,png,ico}"],
      },
    }),
  ],
});
