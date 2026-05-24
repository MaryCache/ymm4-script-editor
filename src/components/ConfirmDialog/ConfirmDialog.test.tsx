// src/components/ConfirmDialog/ConfirmDialog.test.tsx
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ConfirmDialog } from "./ConfirmDialog";

const baseProps = {
  open: true,
  title: "全行をリセットしますか？",
  message: "すべてのセリフ行が削除されます。この操作は元に戻せません。",
  confirmLabel: "リセット",
  cancelLabel: "キャンセル",
  onConfirm: () => {},
  onClose: () => {},
};

// open=true でタイトル・本文が表示される
test("open=true でタイトルと本文が表示される", () => {
  render(<ConfirmDialog {...baseProps} />);
  expect(screen.getByText("全行をリセットしますか？")).toBeInTheDocument();
  expect(screen.getByText("すべてのセリフ行が削除されます。この操作は元に戻せません。")).toBeInTheDocument();
});

// role=alertdialog が設定される
test("role='alertdialog' が設定される", () => {
  render(<ConfirmDialog {...baseProps} />);
  expect(screen.getByRole("alertdialog")).toBeInTheDocument();
});

// open=false のとき何も描画されない
test("open=false のとき何も描画されない", () => {
  render(<ConfirmDialog {...baseProps} open={false} />);
  expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
});

// 確認ボタンで onConfirm と onClose が呼ばれる
test("確認ボタンで onConfirm と onClose が呼ばれる", async () => {
  const onConfirm = vi.fn();
  const onClose = vi.fn();
  render(<ConfirmDialog {...baseProps} onConfirm={onConfirm} onClose={onClose} />);
  await userEvent.click(screen.getByRole("button", { name: "リセット" }));
  expect(onConfirm).toHaveBeenCalled();
  expect(onClose).toHaveBeenCalled();
});

// キャンセルボタンで onClose のみ呼ばれ onConfirm は呼ばれない
test("キャンセルで onClose のみ呼ばれ onConfirm は呼ばれない", async () => {
  const onConfirm = vi.fn();
  const onClose = vi.fn();
  render(<ConfirmDialog {...baseProps} onConfirm={onConfirm} onClose={onClose} />);
  await userEvent.click(screen.getByRole("button", { name: "キャンセル" }));
  expect(onClose).toHaveBeenCalled();
  expect(onConfirm).not.toHaveBeenCalled();
});

// Esc キーで onClose のみ呼ばれ onConfirm は呼ばれない
test("Esc キーで onClose のみ呼ばれ onConfirm は呼ばれない", async () => {
  const onConfirm = vi.fn();
  const onClose = vi.fn();
  render(<ConfirmDialog {...baseProps} onConfirm={onConfirm} onClose={onClose} />);
  await userEvent.keyboard("{Escape}");
  expect(onClose).toHaveBeenCalled();
  expect(onConfirm).not.toHaveBeenCalled();
});

// danger=true のとき確認ボタンに danger クラスが付く
test("danger=true のとき確認ボタンに danger スタイルクラスが付く", () => {
  render(<ConfirmDialog {...baseProps} danger />);
  const confirmBtn = screen.getByRole("button", { name: "リセット" });
  // CSS Modules のクラス名に "Danger" が含まれることを確認（大文字小文字はコンパイル後も保持される）
  expect(confirmBtn.className).toMatch(/[Dd]anger/);
});

// danger=false（デフォルト）のとき確認ボタンに danger クラスが付かない
test("danger=false のとき確認ボタンに danger クラスが付かない", () => {
  render(<ConfirmDialog {...baseProps} danger={false} />);
  const confirmBtn = screen.getByRole("button", { name: "リセット" });
  expect(confirmBtn.className).not.toMatch(/[Dd]anger/);
});
