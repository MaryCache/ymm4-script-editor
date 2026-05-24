import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import App from "./App";

beforeEach(() => localStorage.clear());

test("キャラ追加 → 行追加 → セリフ入力の一連が動き、合計文字数が反映される", async () => {
  render(<App />);
  await userEvent.type(screen.getByPlaceholderText("キャラクター名"), "霊夢");
  await userEvent.click(screen.getByRole("button", { name: "追加" }));
  await userEvent.click(screen.getByRole("button", { name: "+ 行を追加" }));

  const seriesInput = screen.getByRole("textbox", { name: "セリフ" });
  await userEvent.type(seriesInput, "やあ");

  expect(seriesInput).toHaveValue("やあ");
  expect(screen.getByText(/合計文字数:\s*2/)).toBeInTheDocument();
});

// 全行リセット確認 → 行が消える結合テスト（prefers-reduced-motion: reduce で即時クリア）
// テスト環境は matchMedia スタブで reduce=true のため、タイマー待ちなしで即時クリアになる。
test("全行リセット確認で行が消える（reduce=true 環境で即時）", async () => {
  render(<App />);

  // キャラ追加 → 行追加
  await userEvent.type(screen.getByPlaceholderText("キャラクター名"), "霊夢");
  await userEvent.click(screen.getByRole("button", { name: "追加" }));
  await userEvent.click(screen.getByRole("button", { name: "+ 行を追加" }));

  // 行が1件あることを確認
  expect(screen.getByText(/行数:\s*1/)).toBeInTheDocument();

  // 全行リセットボタンをクリック → 確認ダイアログが開く
  await userEvent.click(screen.getByRole("button", { name: "全行リセット" }));
  expect(screen.getByRole("alertdialog")).toBeInTheDocument();

  // 「リセット」ボタンで確定
  await userEvent.click(screen.getByRole("button", { name: "リセット" }));

  // ダイアログが閉じて行数が 0 になる
  await waitFor(() => {
    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
  });
  expect(screen.getByText(/行数:\s*0/)).toBeInTheDocument();
});
