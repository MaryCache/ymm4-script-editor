// src/components/ScriptEditor/ScriptEditor.test.tsx
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ScriptEditor } from "./ScriptEditor";
import type { Character, Line } from "../../types";

const characters: Character[] = [{ id: "c1", name: "霊夢", color: "#FF6B6B" }];
const lines: Line[] = [
  { id: "l1", characterId: "c1", text: "あいう" },
  { id: "l2", characterId: "c1", text: "かき" },
];
const handlers = {
  onCharacterChange: () => {},
  onTextChange: () => {},
  onMoveUp: () => {},
  onMoveDown: () => {},
  onAddAfter: () => {},
  onDelete: () => {},
  onCopy: () => {},
};

test("合計文字数を表示（3+2=5）", () => {
  render(<ScriptEditor characters={characters} lines={lines} onAddLine={() => {}} {...handlers} />);
  expect(screen.getByText(/合計文字数:\s*5/)).toBeInTheDocument();
});

test("行を追加ボタンで onAddLine が呼ばれる", async () => {
  const onAddLine = vi.fn();
  render(<ScriptEditor characters={characters} lines={lines} onAddLine={onAddLine} {...handlers} />);
  await userEvent.click(screen.getByRole("button", { name: "+ 行を追加" }));
  expect(onAddLine).toHaveBeenCalled();
});

test("キャラ0人なら行追加ボタンは disabled", () => {
  render(<ScriptEditor characters={[]} lines={[]} onAddLine={() => {}} {...handlers} />);
  expect(screen.getByRole("button", { name: "+ 行を追加" })).toBeDisabled();
});
