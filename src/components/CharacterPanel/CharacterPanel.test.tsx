// src/components/CharacterPanel/CharacterPanel.test.tsx
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { CharacterPanel } from "./CharacterPanel";
import type { Character } from "../../types";

const two: Character[] = [
  { id: "c1", name: "霊夢", color: "#FF6B6B" },
  { id: "c2", name: "魔理沙", color: "#FFB347" },
];

test("一覧にキャラ名を表示", () => {
  render(<CharacterPanel characters={two} onAdd={() => {}} onDelete={() => {}} />);
  expect(screen.getByText("霊夢")).toBeInTheDocument();
});

test("名前を入力して追加すると onAdd が呼ばれ、入力がクリアされる", async () => {
  const onAdd = vi.fn();
  render(<CharacterPanel characters={[]} onAdd={onAdd} onDelete={() => {}} />);
  const input = screen.getByPlaceholderText("キャラクター名");
  await userEvent.type(input, "魔理沙");
  await userEvent.click(screen.getByRole("button", { name: "追加" }));
  expect(onAdd).toHaveBeenCalledWith("魔理沙");
  expect(input).toHaveValue("");
});

test("空白のみの名前は追加できない", async () => {
  const onAdd = vi.fn();
  render(<CharacterPanel characters={[]} onAdd={onAdd} onDelete={() => {}} />);
  await userEvent.type(screen.getByPlaceholderText("キャラクター名"), "   ");
  await userEvent.click(screen.getByRole("button", { name: "追加" }));
  expect(onAdd).not.toHaveBeenCalled();
});

test("2人以上なら削除ボタンで onDelete が呼ばれる", async () => {
  const onDelete = vi.fn();
  render(<CharacterPanel characters={two} onAdd={() => {}} onDelete={onDelete} />);
  await userEvent.click(screen.getByRole("button", { name: "霊夢 を削除" }));
  expect(onDelete).toHaveBeenCalledWith("c1");
});

test("キャラが1人だけのとき削除ボタンは disabled", () => {
  render(<CharacterPanel characters={[two[0]!]} onAdd={() => {}} onDelete={() => {}} />);
  expect(screen.getByRole("button", { name: "霊夢 を削除" })).toBeDisabled();
});
