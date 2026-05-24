// src/components/Toast/Toast.test.tsx
import { render, screen, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ToastViewport } from "./Toast";
import type { ToastEntry } from "./Toast";

// ===== helper =====
function makeEntry(overrides: Partial<ToastEntry> = {}): ToastEntry {
  return { id: "t1", message: "テストメッセージ", variant: "info", ...overrides };
}

// ===== 表示 =====

test("toasts が空のとき何も描画しない", () => {
  const { baseElement } = render(<ToastViewport toasts={[]} onDismiss={() => {}} />);
  // portal は baseElement (body) に描画される。viewport が存在しないことを確認。
  expect(baseElement.querySelector('[aria-label="通知"]')).not.toBeInTheDocument();
});

test("info トーストを push すると message が表示される", () => {
  const toast = makeEntry({ message: "取り込みました。", variant: "info" });
  render(<ToastViewport toasts={[toast]} onDismiss={() => {}} />);
  expect(screen.getByText("取り込みました。")).toBeInTheDocument();
});

test("error トーストを push すると message が表示される", () => {
  const toast = makeEntry({ message: "コピーに失敗しました。", variant: "error" });
  render(<ToastViewport toasts={[toast]} onDismiss={() => {}} />);
  expect(screen.getByText("コピーに失敗しました。")).toBeInTheDocument();
});

// ===== aria role =====

test("info トーストは role='status' を持つ", () => {
  const toast = makeEntry({ variant: "info" });
  render(<ToastViewport toasts={[toast]} onDismiss={() => {}} />);
  // role="status" の要素が存在する（ライブリージョンコンテナ + item の両方が存在しうるため getAll で確認）
  const statusEls = screen.getAllByRole("status");
  expect(statusEls.length).toBeGreaterThanOrEqual(1);
});

test("error トーストは role='alert' を持つ", () => {
  const toast = makeEntry({ variant: "error" });
  render(<ToastViewport toasts={[toast]} onDismiss={() => {}} />);
  const alertEls = screen.getAllByRole("alert");
  expect(alertEls.length).toBeGreaterThanOrEqual(1);
});

// ===== × ボタン =====

test("× ボタンをクリックすると onDismiss が呼ばれる", async () => {
  const onDismiss = vi.fn();
  const toast = makeEntry({ id: "abc", variant: "info" });
  render(<ToastViewport toasts={[toast]} onDismiss={onDismiss} />);

  await userEvent.click(screen.getByRole("button", { name: "通知を閉じる" }));
  expect(onDismiss).toHaveBeenCalledWith("abc");
});

// ===== 複数トースト =====

test("複数のトーストが同時に表示される", () => {
  const toasts: ToastEntry[] = [
    { id: "1", message: "メッセージA", variant: "info" },
    { id: "2", message: "メッセージB", variant: "error" },
  ];
  render(<ToastViewport toasts={toasts} onDismiss={() => {}} />);
  expect(screen.getByText("メッセージA")).toBeInTheDocument();
  expect(screen.getByText("メッセージB")).toBeInTheDocument();
});

// ===== 自動消滅タイマー (fake timer) =====

test("info トーストは 3500ms 後に onDismiss が呼ばれる", () => {
  vi.useFakeTimers();
  const onDismiss = vi.fn();
  const toast = makeEntry({ id: "timer-info", variant: "info" });
  render(<ToastViewport toasts={[toast]} onDismiss={onDismiss} />);

  // まだ呼ばれていない
  expect(onDismiss).not.toHaveBeenCalled();

  // 3500ms 経過
  act(() => {
    vi.advanceTimersByTime(3500);
  });
  expect(onDismiss).toHaveBeenCalledWith("timer-info");

  vi.useRealTimers();
});

test("error トーストは 5000ms 後に onDismiss が呼ばれる", () => {
  vi.useFakeTimers();
  const onDismiss = vi.fn();
  const toast = makeEntry({ id: "timer-error", variant: "error" });
  render(<ToastViewport toasts={[toast]} onDismiss={onDismiss} />);

  // 3500ms では呼ばれない
  act(() => {
    vi.advanceTimersByTime(3500);
  });
  expect(onDismiss).not.toHaveBeenCalled();

  // 5000ms で呼ばれる
  act(() => {
    vi.advanceTimersByTime(1500);
  });
  expect(onDismiss).toHaveBeenCalledWith("timer-error");

  vi.useRealTimers();
});
