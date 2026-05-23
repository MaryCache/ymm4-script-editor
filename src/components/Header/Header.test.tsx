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

// m-4: 保存メニューの各ボタンが対応する handler を呼ぶ
test("保存メニュー: .ymscript として保存で onSaveYmscript が呼ばれる", async () => {
  const onSaveYmscript = vi.fn();
  render(<Header {...baseProps} onSaveYmscript={onSaveYmscript} />);
  await userEvent.click(screen.getByRole("button", { name: ".ymscript として保存" }));
  expect(onSaveYmscript).toHaveBeenCalled();
});

test("保存メニュー: .md として保存で onSaveMarkdown が呼ばれる", async () => {
  const onSaveMarkdown = vi.fn();
  render(<Header {...baseProps} onSaveMarkdown={onSaveMarkdown} />);
  await userEvent.click(screen.getByRole("button", { name: ".md として保存" }));
  expect(onSaveMarkdown).toHaveBeenCalled();
});

test("保存メニュー: CSV を書き出すで onExportCSV が呼ばれる", async () => {
  const onExportCSV = vi.fn();
  render(<Header {...baseProps} onExportCSV={onExportCSV} />);
  await userEvent.click(screen.getByRole("button", { name: "CSV を書き出す" }));
  expect(onExportCSV).toHaveBeenCalled();
});

// m-4: hidden file input への upload で onLoadYmscript / onLoadMarkdown が File 付きで呼ばれる
test("ファイル読込: .ymscript ファイルを選択すると onLoadYmscript が File 付きで呼ばれる", async () => {
  const onLoadYmscript = vi.fn();
  render(<Header {...baseProps} onLoadYmscript={onLoadYmscript} />);
  // aria-label=".ymscript ファイル" で hidden input を取得する（m-4 / a11y 改善）
  const input = screen.getByLabelText(".ymscript ファイル");
  const file = new File(['{"lines":[]}'], "test.ymscript", { type: "application/json" });
  await userEvent.upload(input, file);
  expect(onLoadYmscript).toHaveBeenCalledWith(file);
});

test("ファイル読込: .md ファイルを選択すると onLoadMarkdown が File 付きで呼ばれる", async () => {
  const onLoadMarkdown = vi.fn();
  render(<Header {...baseProps} onLoadMarkdown={onLoadMarkdown} />);
  // aria-label=".md ファイル" で hidden input を取得する（m-4 / a11y 改善）
  const input = screen.getByLabelText(".md ファイル");
  const file = new File(["# 台本"], "test.md", { type: "text/markdown" });
  await userEvent.upload(input, file);
  expect(onLoadMarkdown).toHaveBeenCalledWith(file);
});
