import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import "./styles/global.css";

/**
 * アプリケーションのエントリーポイント。
 *
 * @remarks
 * `StrictMode` でアプリ全体を包むことで、開発時に副作用の二重実行や
 * 非推奨 API の使用を検出する。
 * `#root` 要素は `index.html` で定義済み。見つからない場合は `!` アサーションにより
 * `null` が TypeScript 上で除外されるが、実際には `index.html` が正しく配置されている前提。
 */
createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
