import { render, screen } from "@testing-library/react";
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
