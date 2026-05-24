// src/components/PasteImportModal/PasteImportModal.test.tsx
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { PasteImportModal } from "./PasteImportModal";

const baseProps = {
  open: true,
  onClose: () => {},
  onImport: () => {},
};

// open=true のとき textarea が表示される
test("open=true のとき textarea が表示される", () => {
  render(<PasteImportModal {...baseProps} />);
  expect(screen.getByRole("textbox", { name: "インポートするテキスト" })).toBeInTheDocument();
});

// open=false のとき何も描画されない
test("open=false のとき何も描画されない", () => {
  render(<PasteImportModal {...baseProps} open={false} />);
  expect(screen.queryByRole("textbox", { name: "インポートするテキスト" })).not.toBeInTheDocument();
});

// テキスト入力 → 「取り込み」→ onImport が入力値で呼ばれる
test("テキスト入力 → 取り込みで onImport が入力値で呼ばれる", async () => {
  const onImport = vi.fn();
  const onClose = vi.fn();
  render(<PasteImportModal {...baseProps} onImport={onImport} onClose={onClose} />);
  const textarea = screen.getByRole("textbox", { name: "インポートするテキスト" });
  await userEvent.type(textarea, "あいうえお");
  await userEvent.click(screen.getByRole("button", { name: "取り込み" }));
  expect(onImport).toHaveBeenCalledWith("あいうえお");
  expect(onClose).toHaveBeenCalled();
});

// 空文字で取り込みを押すと onImport は呼ばれず onClose だけ呼ばれる
test("空文字で取り込みを押すと onImport は呼ばれず onClose が呼ばれる", async () => {
  const onImport = vi.fn();
  const onClose = vi.fn();
  render(<PasteImportModal {...baseProps} onImport={onImport} onClose={onClose} />);
  // textarea は空のまま
  await userEvent.click(screen.getByRole("button", { name: "取り込み" }));
  expect(onImport).not.toHaveBeenCalled();
  expect(onClose).toHaveBeenCalled();
});

// 空白のみで取り込みを押すと onImport は呼ばれない
test("空白のみで取り込みを押すと onImport は呼ばれない", async () => {
  const onImport = vi.fn();
  const onClose = vi.fn();
  render(<PasteImportModal {...baseProps} onImport={onImport} onClose={onClose} />);
  const textarea = screen.getByRole("textbox", { name: "インポートするテキスト" });
  await userEvent.type(textarea, "   ");
  await userEvent.click(screen.getByRole("button", { name: "取り込み" }));
  expect(onImport).not.toHaveBeenCalled();
  expect(onClose).toHaveBeenCalled();
});

// キャンセルボタンで onClose が呼ばれる
test("キャンセルボタンで onClose が呼ばれる", async () => {
  const onClose = vi.fn();
  render(<PasteImportModal {...baseProps} onClose={onClose} />);
  await userEvent.click(screen.getByRole("button", { name: "キャンセル" }));
  expect(onClose).toHaveBeenCalled();
});

// Esc キーで onClose が呼ばれる
test("Esc キーで onClose が呼ばれる", async () => {
  const onClose = vi.fn();
  render(<PasteImportModal {...baseProps} onClose={onClose} />);
  await userEvent.keyboard("{Escape}");
  expect(onClose).toHaveBeenCalled();
});

// role=dialog が設定される
test("role='dialog' が設定される", () => {
  render(<PasteImportModal {...baseProps} />);
  expect(screen.getByRole("dialog")).toBeInTheDocument();
});
