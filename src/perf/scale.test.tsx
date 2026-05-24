// NF-10 検証: 500行スケールでの正当性テスト。
// jsdom では精密な実時間計測は不可能なため、「完走すること」と「正しい行IDで発火すること」を見る。
// 実時間の保証は React DevTools Profiler による手動確認（implementation-plan.md Task 15 Step 3 参照）。
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ScriptEditor } from "../components/ScriptEditor/ScriptEditor";
import type { Character, Line } from "../types";

const characters: Character[] = [{ id: "c1", name: "霊夢", color: "#FF6B6B" }];

function makeLines(n: number): Line[] {
  return Array.from({ length: n }, (_, i) => ({ id: `l${i}`, characterId: "c1", text: `行${i}` }));
}

test("500行でも全行レンダリングされ、合計文字数が正しい", () => {
  const lines = makeLines(500);
  const total = lines.reduce((s, l) => s + l.text.length, 0);
  const handlers = {
    onAddLine: () => {},
    onCharacterChange: () => {},
    onTextChange: () => {},
    onMoveUp: () => {},
    onMoveDown: () => {},
    onAddAfter: () => {},
    onDelete: () => {},
    onCopy: () => {},
  };
  render(<ScriptEditor characters={characters} lines={lines} {...handlers} />);
  expect(screen.getAllByRole("textbox", { name: "セリフ" })).toHaveLength(500);
  expect(screen.getByText(new RegExp(`合計文字数:\\s*${total}`))).toBeInTheDocument();
});

test("500行のうち1行に入力しても onTextChange が正しい行IDで発火する", async () => {
  const lines = makeLines(500);
  const onTextChange = vi.fn();
  const handlers = {
    onAddLine: () => {},
    onCharacterChange: () => {},
    onTextChange,
    onMoveUp: () => {},
    onMoveDown: () => {},
    onAddAfter: () => {},
    onDelete: () => {},
    onCopy: () => {},
  };
  render(<ScriptEditor characters={characters} lines={lines} {...handlers} />);
  const inputs = screen.getAllByRole("textbox", { name: "セリフ" });
  await userEvent.type(inputs[250]!, "X");
  expect(onTextChange).toHaveBeenCalledWith("l250", "行250X");
});
