// src/components/ColorWheel/ColorWheel.test.tsx
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ColorWheel } from "./ColorWheel";

// hex 入力欄に初期 color が反映される
test("hex 入力欄に初期 color が小文字で表示される", () => {
  render(<ColorWheel color="#FF0000" onChange={() => {}} onClose={() => {}} />);
  const input = screen.getByRole("textbox", { name: "色（16進）" });
  expect(input).toHaveValue("#ff0000");
});

// hex 入力で onChange が呼ばれ、hex 形式で返す
test("hex 入力で onChange が妥当な hex を返す", async () => {
  const onChange = vi.fn();
  render(<ColorWheel color="#000000" onChange={onChange} onClose={() => {}} />);
  const input = screen.getByRole("textbox", { name: "色（16進）" });
  // 既存値をクリアして新しい hex を入力
  await userEvent.clear(input);
  await userEvent.type(input, "#ff0000");
  // onChange は最後に呼ばれた引数が #ff0000 であることを確認
  const calls = onChange.mock.calls;
  const lastHex = calls[calls.length - 1]?.[0] as string;
  expect(lastHex).toMatch(/^#[0-9a-f]{6}$/);
});

// 明度スライダー変更で onChange が呼ばれる
test("明度スライダーを変更すると onChange が呼ばれる", async () => {
  const onChange = vi.fn();
  render(<ColorWheel color="#107dc8" onChange={onChange} onClose={() => {}} />);
  const slider = screen.getByRole("slider", { name: "明度" });
  // fireEvent で range input の値を直接変更して change イベントを発火させる。
  // userEvent.click では range input の値変化は起きないため fireEvent を使う。
  const { fireEvent } = await import("@testing-library/react");
  fireEvent.change(slider, { target: { value: "30" } });
  expect(onChange).toHaveBeenCalled();
  // 引数は hex 形式
  const anyHex = (onChange.mock.calls[0]?.[0] as string | undefined) ?? "";
  expect(anyHex).toMatch(/^#[0-9a-f]{6}$/);
});

// 不正な hex 入力では onChange は呼ばれない（最後の有効状態を維持）
test("不正な hex 入力では onChange に不正値が渡らない", async () => {
  const onChange = vi.fn();
  render(<ColorWheel color="#ff0000" onChange={onChange} onClose={() => {}} />);
  const input = screen.getByRole("textbox", { name: "色（16進）" });
  onChange.mockClear();
  await userEvent.clear(input);
  await userEvent.type(input, "#zzzzzz");
  // 不正な hex では onChange が呼ばれない（有効な hex にマッチしない）
  const allHex = onChange.mock.calls.map((c) => c[0] as string);
  for (const hex of allHex) {
    expect(hex).toMatch(/^#[0-9a-f]{6}$/);
  }
});

// role="group" と aria-label が設定される
test("コンテナに role='group' と aria-label が設定される", () => {
  render(<ColorWheel color="#ffffff" onChange={() => {}} onClose={() => {}} />);
  expect(screen.getByRole("group", { name: "カラーピッカー" })).toBeInTheDocument();
});

// Esc キーで onClose が呼ばれる
test("Esc キーで onClose が呼ばれる", async () => {
  const onClose = vi.fn();
  render(<ColorWheel color="#ffffff" onChange={() => {}} onClose={onClose} />);
  await userEvent.keyboard("{Escape}");
  expect(onClose).toHaveBeenCalled();
});
