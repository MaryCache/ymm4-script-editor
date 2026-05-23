// src/components/Header/Header.test.tsx
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Header } from "./Header";

const baseProps = {
  projectName: "テスト台本",
  onProjectNameChange: () => {},
  onSaveYmscript: () => {}, onSaveMarkdown: () => {}, onExportCSV: () => {},
  onLoadYmscript: () => {}, onLoadMarkdown: () => {}, onCopyAll: () => {},
};

test("プロジェクト名が編集欄に表示される", () => {
  render(<Header {...baseProps} />);
  expect(screen.getByDisplayValue("テスト台本")).toBeInTheDocument();
});

test("プロジェクト名変更で onProjectNameChange が呼ばれる", async () => {
  const onProjectNameChange = vi.fn();
  render(<Header {...baseProps} onProjectNameChange={onProjectNameChange} />);
  await userEvent.type(screen.getByDisplayValue("テスト台本"), "X");
  expect(onProjectNameChange).toHaveBeenCalledWith("テスト台本X");
});

test("全件コピーで onCopyAll が呼ばれる", async () => {
  const onCopyAll = vi.fn();
  render(<Header {...baseProps} onCopyAll={onCopyAll} />);
  await userEvent.click(screen.getByRole("button", { name: "全件コピー" }));
  expect(onCopyAll).toHaveBeenCalled();
});
