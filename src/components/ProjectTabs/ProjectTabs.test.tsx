// src/components/ProjectTabs/ProjectTabs.test.tsx
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ProjectTabs } from "./ProjectTabs";
import type { TabEntry } from "./ProjectTabs";

const tab1: TabEntry = { id: "t1", name: "プロジェクト1", isEmpty: true };
const tab2: TabEntry = { id: "t2", name: "プロジェクト2", isEmpty: false };
const tab3: TabEntry = { id: "t3", name: "プロジェクト3", isEmpty: true };

const noop = () => {};

// ===== タブ一覧表示 =====

test("タブ一覧が role=tablist として描画される", () => {
  render(<ProjectTabs tabs={[tab1, tab2]} activeId="t1" onSwitch={noop} onNew={noop} onClose={noop} onRename={noop} />);
  expect(screen.getByRole("tablist")).toBeInTheDocument();
});

test("各タブが role=tab として描画される", () => {
  render(<ProjectTabs tabs={[tab1, tab2]} activeId="t1" onSwitch={noop} onNew={noop} onClose={noop} onRename={noop} />);
  const tabs = screen.getAllByRole("tab");
  expect(tabs).toHaveLength(2);
});

test("アクティブタブの aria-selected が true になる", () => {
  render(<ProjectTabs tabs={[tab1, tab2]} activeId="t2" onSwitch={noop} onNew={noop} onClose={noop} onRename={noop} />);
  const tabs = screen.getAllByRole("tab");
  // tab1 は aria-selected=false
  expect(tabs[0]).toHaveAttribute("aria-selected", "false");
  // tab2 は aria-selected=true
  expect(tabs[1]).toHaveAttribute("aria-selected", "true");
});

test("タブ名がそれぞれ表示される", () => {
  render(<ProjectTabs tabs={[tab1, tab2]} activeId="t1" onSwitch={noop} onNew={noop} onClose={noop} onRename={noop} />);
  expect(screen.getByText("プロジェクト1")).toBeInTheDocument();
  expect(screen.getByText("プロジェクト2")).toBeInTheDocument();
});

// ===== タブクリック → onSwitch =====

test("タブをクリックすると onSwitch(id) が呼ばれる", async () => {
  const onSwitch = vi.fn();
  render(
    <ProjectTabs tabs={[tab1, tab2]} activeId="t1" onSwitch={onSwitch} onNew={noop} onClose={noop} onRename={noop} />,
  );
  const tabs = screen.getAllByRole("tab");
  await userEvent.click(tabs[1]!);
  expect(onSwitch).toHaveBeenCalledWith("t2");
});

// ===== 「＋」ボタン → onNew =====

test("「＋」ボタンをクリックすると onNew が呼ばれる", async () => {
  const onNew = vi.fn();
  render(
    <ProjectTabs tabs={[tab1, tab2]} activeId="t1" onSwitch={noop} onNew={onNew} onClose={noop} onRename={noop} />,
  );
  await userEvent.click(screen.getByRole("button", { name: "新しいプロジェクト" }));
  expect(onNew).toHaveBeenCalled();
});

// ===== × ボタン → onClose =====

test("× ボタンをクリックすると onClose(id) が呼ばれる", async () => {
  const onClose = vi.fn();
  render(
    <ProjectTabs tabs={[tab1, tab2]} activeId="t1" onSwitch={noop} onNew={noop} onClose={onClose} onRename={noop} />,
  );
  // tab2 の閉じるボタン
  await userEvent.click(screen.getByRole("button", { name: "プロジェクト2 を閉じる" }));
  expect(onClose).toHaveBeenCalledWith("t2");
});

// ===== 最後の1タブでは × が無効 =====

test("タブが1つだけのとき × ボタンが disabled になる", () => {
  render(<ProjectTabs tabs={[tab1]} activeId="t1" onSwitch={noop} onNew={noop} onClose={noop} onRename={noop} />);
  const closeBtn = screen.getByRole("button", { name: "プロジェクト1 を閉じる" });
  expect(closeBtn).toBeDisabled();
});

test("タブが1つだけのとき × クリックで onClose が呼ばれない", async () => {
  const onClose = vi.fn();
  render(<ProjectTabs tabs={[tab1]} activeId="t1" onSwitch={noop} onNew={noop} onClose={onClose} onRename={noop} />);
  const closeBtn = screen.getByRole("button", { name: "プロジェクト1 を閉じる" });
  // disabled ボタンなのでクリックは無視されるはず
  await userEvent.click(closeBtn, { pointerEventsCheck: 0 });
  expect(onClose).not.toHaveBeenCalled();
});

test("タブが2つ以上のとき × ボタンは enabled になる", () => {
  render(<ProjectTabs tabs={[tab1, tab2]} activeId="t1" onSwitch={noop} onNew={noop} onClose={noop} onRename={noop} />);
  const closeBtns = screen.getAllByRole("button", { name: /を閉じる/ });
  for (const btn of closeBtns) {
    expect(btn).not.toBeDisabled();
  }
});

// ===== インライン編集: ダブルクリック → Enter で onRename =====

test("タブ名をダブルクリックすると input が現れる", async () => {
  render(<ProjectTabs tabs={[tab1, tab2]} activeId="t1" onSwitch={noop} onNew={noop} onClose={noop} onRename={noop} />);
  await userEvent.dblClick(screen.getByText("プロジェクト1"));
  expect(screen.getByRole("textbox", { name: "プロジェクト名を編集" })).toBeInTheDocument();
});

test("ダブルクリック後 Enter で onRename(id, value) が呼ばれる", async () => {
  const onRename = vi.fn();
  render(
    <ProjectTabs tabs={[tab1, tab2]} activeId="t1" onSwitch={noop} onNew={noop} onClose={noop} onRename={onRename} />,
  );
  await userEvent.dblClick(screen.getByText("プロジェクト1"));
  const input = screen.getByRole("textbox", { name: "プロジェクト名を編集" });
  await userEvent.clear(input);
  await userEvent.type(input, "新しい名前{Enter}");
  expect(onRename).toHaveBeenCalledWith("t1", "新しい名前");
});

test("ダブルクリック後 blur で onRename が呼ばれる", async () => {
  const onRename = vi.fn();
  render(
    <ProjectTabs tabs={[tab1, tab2]} activeId="t1" onSwitch={noop} onNew={noop} onClose={noop} onRename={onRename} />,
  );
  await userEvent.dblClick(screen.getByText("プロジェクト1"));
  const input = screen.getByRole("textbox", { name: "プロジェクト名を編集" });
  await userEvent.clear(input);
  await userEvent.type(input, "変更後");
  await userEvent.tab(); // blur
  expect(onRename).toHaveBeenCalledWith("t1", "変更後");
});

test("ダブルクリック後 Esc でキャンセル → onRename が呼ばれない", async () => {
  const onRename = vi.fn();
  render(
    <ProjectTabs tabs={[tab1, tab2]} activeId="t1" onSwitch={noop} onNew={noop} onClose={noop} onRename={onRename} />,
  );
  await userEvent.dblClick(screen.getByText("プロジェクト1"));
  await userEvent.keyboard("{Escape}");
  expect(onRename).not.toHaveBeenCalled();
  // 元のタブ名 span が戻っていること
  expect(screen.getByText("プロジェクト1")).toBeInTheDocument();
});

// ===== 空入力は onRename を呼ばない =====

test("空文字で確定しても onRename が呼ばれない", async () => {
  const onRename = vi.fn();
  render(
    <ProjectTabs tabs={[tab1, tab2]} activeId="t1" onSwitch={noop} onNew={noop} onClose={noop} onRename={onRename} />,
  );
  await userEvent.dblClick(screen.getByText("プロジェクト1"));
  const input = screen.getByRole("textbox", { name: "プロジェクト名を編集" });
  await userEvent.clear(input);
  await userEvent.keyboard("{Enter}");
  expect(onRename).not.toHaveBeenCalled();
});

// ===== 3タブ: × の aria-label が各タブ名を含む =====

test("3タブ時に各 × ボタンの aria-label が正しく設定される", () => {
  render(
    <ProjectTabs tabs={[tab1, tab2, tab3]} activeId="t1" onSwitch={noop} onNew={noop} onClose={noop} onRename={noop} />,
  );
  expect(screen.getByRole("button", { name: "プロジェクト1 を閉じる" })).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "プロジェクト2 を閉じる" })).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "プロジェクト3 を閉じる" })).toBeInTheDocument();
});

// ===== tabIndex: アクティブは 0、他は -1 =====

test("アクティブタブのみ tabIndex=0、他は -1", () => {
  render(
    <ProjectTabs tabs={[tab1, tab2, tab3]} activeId="t2" onSwitch={noop} onNew={noop} onClose={noop} onRename={noop} />,
  );
  const tabs = screen.getAllByRole("tab");
  expect(tabs[0]).toHaveAttribute("tabIndex", "-1");
  expect(tabs[1]).toHaveAttribute("tabIndex", "0");
  expect(tabs[2]).toHaveAttribute("tabIndex", "-1");
});
