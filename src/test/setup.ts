// jest-dom の DOM マッチャ（toBeInTheDocument 等）を vitest の expect に登録する。
import "@testing-library/jest-dom/vitest";

// ===== jsdom 環境の Web API ポリフィル =====
// jsdom は一部の Web API を実装していない。テストが依存するものを最小限でスタブする。

// ResizeObserver: jsdom 未実装。ScriptEditor の useScrollIndicator で使用（item 7）。
// スタブは何もしない — テスト中にスクロール高変化は発生しないため問題なし。
if (typeof globalThis.ResizeObserver === "undefined") {
  globalThis.ResizeObserver = class ResizeObserver {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
}

// window.matchMedia: jsdom 未実装。CharacterPanel の prefers-reduced-motion 判定に使用（item 4）。
// テスト環境では prefers-reduced-motion: reduce = true として扱う。
// Why reduce=true in tests: アニメーション（setTimeout 付き削除）を即時実行させ、
// テストのタイマーモック不要にする。視覚アニメーションのロジックはブラウザ環境で確認する。
if (typeof window.matchMedia === "undefined") {
  Object.defineProperty(window, "matchMedia", {
    writable: true,
    value: (query: string) => ({
      matches: query.includes("prefers-reduced-motion"),
      media: query,
      onchange: null,
      addListener: () => {},
      removeListener: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => false,
    }),
  });
}
