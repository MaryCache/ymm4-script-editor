// src/components/LineRow/LineRow.test.tsx
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { LineRow } from "./LineRow";
import type { Character, Line } from "../../types";

const characters: Character[] = [
  { id: "c1", name: "霊夢", color: "#FF6B6B" },
  { id: "c2", name: "魔理沙", color: "#FFB347" },
];
const line: Line = { id: "l1", characterId: "c1", text: "やあ" };
const noop = () => {};
const baseProps = {
  line, characters, index: 0, isFirst: true, isLast: false,
  onCharacterChange: noop, onTextChange: noop, onMoveUp: noop,
  onMoveDown: noop, onAddAfter: noop, onDelete: noop, onCopy: noop,
};

test("行番号・セリフ・文字数を表示", () => {
  render(<LineRow {...baseProps} />);
  expect(screen.getByText("1")).toBeInTheDocument();
  expect(screen.getByRole("textbox", { name: "セリフ" })).toHaveValue("やあ");
  expect(screen.getByText("2")).toBeInTheDocument(); // "やあ" = 2文字
});

test("セリフ入力で onTextChange が呼ばれる", async () => {
  const onTextChange = vi.fn();
  render(<LineRow {...baseProps} onTextChange={onTextChange} />);
  await userEvent.type(screen.getByRole("textbox", { name: "セリフ" }), "！");
  expect(onTextChange).toHaveBeenCalledWith("l1", "やあ！");
});

test("isFirst なら上移動ボタンが disabled", () => {
  render(<LineRow {...baseProps} isFirst={true} />);
  expect(screen.getByRole("button", { name: "上に移動" })).toBeDisabled();
});

test("コピーボタンで onCopy が呼ばれる", async () => {
  const onCopy = vi.fn();
  render(<LineRow {...baseProps} onCopy={onCopy} />);
  await userEvent.click(screen.getByRole("button", { name: "この行をコピー" }));
  expect(onCopy).toHaveBeenCalledWith(line);
});

// m-5: isLast=true で下移動ボタンが disabled
test("isLast なら下移動ボタンが disabled", () => {
  render(<LineRow {...baseProps} isLast={true} />);
  expect(screen.getByRole("button", { name: "下に移動" })).toBeDisabled();
});

// m-5: 削除ボタンで onDelete が line.id 付きで呼ばれる
test("削除ボタンで onDelete が line.id 付きで呼ばれる", async () => {
  const onDelete = vi.fn();
  render(<LineRow {...baseProps} onDelete={onDelete} />);
  await userEvent.click(screen.getByRole("button", { name: "この行を削除" }));
  expect(onDelete).toHaveBeenCalledWith(line.id);
});

// m-5: 行追加ボタンで onAddAfter が line.id 付きで呼ばれる
test("直後に行を追加ボタンで onAddAfter が line.id 付きで呼ばれる", async () => {
  const onAddAfter = vi.fn();
  render(<LineRow {...baseProps} onAddAfter={onAddAfter} />);
  await userEvent.click(screen.getByRole("button", { name: "直後に行を追加" }));
  expect(onAddAfter).toHaveBeenCalledWith(line.id);
});
