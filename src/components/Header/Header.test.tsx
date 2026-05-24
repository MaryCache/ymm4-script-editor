// src/components/Header/Header.test.tsx
// item 5 対応: <details> → 制御状態メニューへの変更に伴い、
// メニュー項目をクリックする前に対応するトグルボタン（"保存▼"/"読込▼"）を開くステップを追加。
// 項目は DOM に出ていない時は不可視なため、先にメニューを開く必要がある。
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Header } from "./Header";

const baseProps = {
  projectName: "テスト台本",
  onProjectNameChange: () => {},
  onSaveYmscript: () => {},
  onSaveMarkdown: () => {},
  onExportCSV: () => {},
  onLoadYmscript: () => {},
  onLoadMarkdown: () => {},
  onCopyAll: () => {},
  onOpenPasteImport: () => {},
  onOpenResetAll: () => {},
  canResetAll: true,
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

// m-4 / item 5: 保存メニューを開いてから各ボタンをクリックする
test("保存メニュー: .ymscript として保存で onSaveYmscript が呼ばれる", async () => {
  const onSaveYmscript = vi.fn();
  render(<Header {...baseProps} onSaveYmscript={onSaveYmscript} />);
  // 保存▼ を開く
  await userEvent.click(screen.getByRole("button", { name: "保存▼" }));
  await userEvent.click(screen.getByRole("menuitem", { name: ".ymscript として保存" }));
  expect(onSaveYmscript).toHaveBeenCalled();
});

test("保存メニュー: .md として保存で onSaveMarkdown が呼ばれる", async () => {
  const onSaveMarkdown = vi.fn();
  render(<Header {...baseProps} onSaveMarkdown={onSaveMarkdown} />);
  await userEvent.click(screen.getByRole("button", { name: "保存▼" }));
  await userEvent.click(screen.getByRole("menuitem", { name: ".md として保存" }));
  expect(onSaveMarkdown).toHaveBeenCalled();
});

test("保存メニュー: CSV を書き出すで onExportCSV が呼ばれる", async () => {
  const onExportCSV = vi.fn();
  render(<Header {...baseProps} onExportCSV={onExportCSV} />);
  await userEvent.click(screen.getByRole("button", { name: "保存▼" }));
  await userEvent.click(screen.getByRole("menuitem", { name: "CSV を書き出す" }));
  expect(onExportCSV).toHaveBeenCalled();
});

// item 5: 排他制御のテスト — 片方を開くともう片方は閉じる
test("保存▼ を開いた状態で 読込▼ を開くと保存メニューが閉じる", async () => {
  render(<Header {...baseProps} />);
  await userEvent.click(screen.getByRole("button", { name: "保存▼" }));
  expect(screen.getByRole("menu")).toBeInTheDocument();
  // 読込▼ を開く → 保存メニューは閉じるはず
  await userEvent.click(screen.getByRole("button", { name: "読込▼" }));
  // 画面に存在するメニューは1つ（読込メニュー）のみ
  expect(screen.getAllByRole("menu")).toHaveLength(1);
  expect(screen.getByRole("menuitem", { name: ".ymscript を読み込む" })).toBeInTheDocument();
  expect(screen.queryByRole("menuitem", { name: ".ymscript として保存" })).not.toBeInTheDocument();
});

// item 5: Escape でメニューが閉じる
test("Escape キーでメニューが閉じる", async () => {
  render(<Header {...baseProps} />);
  await userEvent.click(screen.getByRole("button", { name: "保存▼" }));
  expect(screen.getByRole("menu")).toBeInTheDocument();
  await userEvent.keyboard("{Escape}");
  expect(screen.queryByRole("menu")).not.toBeInTheDocument();
});

// m-4 / item 5: hidden file input への upload — 「読込▼」を開いてから
// getByLabelText で hidden input を取得して upload する。
test("ファイル読込: .ymscript ファイルを選択すると onLoadYmscript が File 付きで呼ばれる", async () => {
  const onLoadYmscript = vi.fn();
  render(<Header {...baseProps} onLoadYmscript={onLoadYmscript} />);
  // aria-label=".ymscript ファイル" で hidden input を取得する（m-4 / a11y 改善）
  // hidden input は DOM に常に存在するため、メニューを開かなくても getByLabelText できる
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

// ===== v1.2 新規ボタンのテスト =====

test("「コピペでインポート」クリックで onOpenPasteImport が呼ばれる", async () => {
  const onOpenPasteImport = vi.fn();
  render(<Header {...baseProps} onOpenPasteImport={onOpenPasteImport} />);
  await userEvent.click(screen.getByRole("button", { name: "コピペでインポート" }));
  expect(onOpenPasteImport).toHaveBeenCalled();
});

test("「全行リセット」クリックで onOpenResetAll が呼ばれる", async () => {
  const onOpenResetAll = vi.fn();
  render(<Header {...baseProps} onOpenResetAll={onOpenResetAll} canResetAll={true} />);
  await userEvent.click(screen.getByRole("button", { name: "全行リセット" }));
  expect(onOpenResetAll).toHaveBeenCalled();
});

test("canResetAll=false のとき「全行リセット」ボタンが disabled", () => {
  render(<Header {...baseProps} canResetAll={false} />);
  expect(screen.getByRole("button", { name: "全行リセット" })).toBeDisabled();
});

test("canResetAll=true のとき「全行リセット」ボタンが enabled", () => {
  render(<Header {...baseProps} canResetAll={true} />);
  expect(screen.getByRole("button", { name: "全行リセット" })).not.toBeDisabled();
});
