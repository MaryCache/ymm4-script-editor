import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

// アイコンはユーザー提供の透過 PNG（public/icon-192.png / icon-512.png、元 1024px から縮小）。
// background/theme color は cold-blue-black テーマに合わせる。
export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: ["favicon.png", "icon-192.png", "icon-512.png"],
      manifest: {
        name: "YMM4台本エディタ",
        short_name: "台本エディタ",
        start_url: "/",
        // display_override: インストール済みウィンドウの外観を上位から順に試す。
        //   window-controls-overlay … タイトルバーをアプリ側で描画し OS のウィンドウ
        //     コントロール(最小/最大/閉じる)だけを重ねる＝ネイティブアプリ風ウィンドウ。
        //     未対応環境は standalone → minimal-ui の順にフォールバック。
        // 対応: Edge / Chrome デスクトップ（インストール時のみ有効。タブ表示では無視される）。
        display_override: ["window-controls-overlay", "standalone", "minimal-ui"],
        display: "standalone",
        lang: "ja",
        background_color: "#00101d",
        // theme_color はウィンドウのタイトルバー(コントロール帯)の色。アプリの暗い地と
        // 揃えてネイティブ感を出すため cyan アクセントではなく bg と同じ #00101d にする。
        theme_color: "#00101d",
        icons: [
          // purpose は "any" のみ。アイコンは角丸タイルに余白があり、maskable を名乗ると
          // Android の円形マスクでタイル端が欠けるため。主ターゲットは Chrome/Edge デスクトップ。
          { src: "icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
          { src: "icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
        ],
      },
      workbox: {
        globPatterns: ["**/*.{js,css,html,svg,png,ico}"],
      },
    }),
  ],
});
