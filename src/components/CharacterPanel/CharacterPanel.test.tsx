// src/components/CharacterPanel/CharacterPanel.test.tsx
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { CharacterPanel } from "./CharacterPanel";
import type { Character } from "../../types";

const two: Character[] = [
  { id: "c1", name: "霊夢", color: "#FF6B6B" },
  { id: "c2", name: "魔理沙", color: "#FFB347" },
];

const pinned: Character[] = [{ id: "p1", name: "レミリア", color: "#C792EA" }];

/** デフォルト props（pinnedCharacters=[], onPin/onUnpin は no-op）。 */
const defaultProps = {
  pinnedCharacters: [] as Character[],
  onAdd: () => {},
  onDelete: () => {},
  onRename: () => {},
  onColorChange: () => {},
  onPin: () => {},
  onUnpin: () => {},
};

// ===== 既存テスト（追加/削除/disabled）=====

test("一覧にキャラ名を表示", () => {
  render(<CharacterPanel {...defaultProps} characters={two} />);
  expect(screen.getByText("霊夢")).toBeInTheDocument();
});

test("名前を入力して追加すると onAdd が呼ばれ、入力がクリアされる", async () => {
  const onAdd = vi.fn();
  render(<CharacterPanel {...defaultProps} characters={[]} onAdd={onAdd} />);
  const input = screen.getByRole("textbox", { name: "キャラクター名" });
  await userEvent.type(input, "魔理沙");
  await userEvent.click(screen.getByRole("button", { name: "追加" }));
  expect(onAdd).toHaveBeenCalledWith("魔理沙");
  expect(input).toHaveValue("");
});

test("空白のみの名前は追加できない", async () => {
  const onAdd = vi.fn();
  render(<CharacterPanel {...defaultProps} characters={[]} onAdd={onAdd} />);
  await userEvent.type(screen.getByRole("textbox", { name: "キャラクター名" }), "   ");
  await userEvent.click(screen.getByRole("button", { name: "追加" }));
  expect(onAdd).not.toHaveBeenCalled();
});

test("2人以上なら削除ボタンで onDelete が呼ばれる", async () => {
  const onDelete = vi.fn();
  render(<CharacterPanel {...defaultProps} characters={two} onDelete={onDelete} />);
  await userEvent.click(screen.getByRole("button", { name: "霊夢 を削除" }));
  expect(onDelete).toHaveBeenCalledWith("c1");
});

test("キャラが1人だけのとき削除ボタンは disabled", () => {
  render(<CharacterPanel {...defaultProps} characters={[two[0]!]} />);
  expect(screen.getByRole("button", { name: "霊夢 を削除" })).toBeDisabled();
});

// ===== 名前インライン編集テスト（§2.2 / F-80-82）=====

test("名前をダブルクリックすると編集 input が表示される", async () => {
  render(<CharacterPanel {...defaultProps} characters={two} />);
  expect(screen.getByText("霊夢")).toBeInTheDocument();
  await userEvent.dblClick(screen.getByText("霊夢"));
  expect(screen.getByRole("textbox", { name: "霊夢 の名前を編集" })).toBeInTheDocument();
});

test("編集 input で Enter を押すと onRename が (id, 新名) で呼ばれる", async () => {
  const onRename = vi.fn();
  render(<CharacterPanel {...defaultProps} characters={two} onRename={onRename} />);
  await userEvent.dblClick(screen.getByText("霊夢"));
  const input = screen.getByRole("textbox", { name: "霊夢 の名前を編集" });
  await userEvent.clear(input);
  await userEvent.type(input, "博麗霊夢");
  await userEvent.keyboard("{Enter}");
  expect(onRename).toHaveBeenCalledWith("c1", "博麗霊夢");
  expect(screen.queryByRole("textbox", { name: "霊夢 の名前を編集" })).not.toBeInTheDocument();
});

test("編集中に Esc を押すとキャンセルされ onRename は呼ばれない", async () => {
  const onRename = vi.fn();
  render(<CharacterPanel {...defaultProps} characters={two} onRename={onRename} />);
  await userEvent.dblClick(screen.getByText("霊夢"));
  const input = screen.getByRole("textbox", { name: "霊夢 の名前を編集" });
  await userEvent.clear(input);
  await userEvent.type(input, "削除されるべきでない入力");
  await userEvent.keyboard("{Escape}");
  expect(onRename).not.toHaveBeenCalled();
  expect(screen.queryByRole("textbox", { name: "霊夢 の名前を編集" })).not.toBeInTheDocument();
});

test("trim 後が空文字の状態で確定しても onRename は呼ばれない", async () => {
  const onRename = vi.fn();
  render(<CharacterPanel {...defaultProps} characters={two} onRename={onRename} />);
  await userEvent.dblClick(screen.getByText("霊夢"));
  const input = screen.getByRole("textbox", { name: "霊夢 の名前を編集" });
  await userEvent.clear(input);
  await userEvent.type(input, "   ");
  await userEvent.keyboard("{Enter}");
  expect(onRename).not.toHaveBeenCalled();
});

// ===== 色変更テスト（§2.3 / F-90-93）=====

test("色ドットボタンをクリックすると ColorWheel が表示される", async () => {
  render(<CharacterPanel {...defaultProps} characters={two} />);
  await userEvent.click(screen.getByRole("button", { name: "霊夢 の色を変更" }));
  expect(screen.getByRole("textbox", { name: "色（16進）" })).toBeInTheDocument();
});

test("ColorWheel で色を変更すると onColorChange が呼ばれる", async () => {
  const onColorChange = vi.fn();
  render(<CharacterPanel {...defaultProps} characters={two} onColorChange={onColorChange} />);
  await userEvent.click(screen.getByRole("button", { name: "霊夢 の色を変更" }));
  const hexInput = screen.getByRole("textbox", { name: "色（16進）" });
  await userEvent.clear(hexInput);
  await userEvent.type(hexInput, "#1abc9c");
  expect(onColorChange).toHaveBeenCalledWith("c1", expect.stringMatching(/^#[0-9a-f]{6}$/i));
});

test("ColorWheel は1つしか開かない（排他）", async () => {
  render(<CharacterPanel {...defaultProps} characters={two} />);
  await userEvent.click(screen.getByRole("button", { name: "霊夢 の色を変更" }));
  expect(screen.getAllByRole("textbox", { name: "色（16進）" })).toHaveLength(1);
  await userEvent.click(screen.getByRole("button", { name: "魔理沙 の色を変更" }));
  expect(screen.getAllByRole("textbox", { name: "色（16進）" })).toHaveLength(1);
});

// ===== v1.4 共通キャラ / ピン機能 =====

test("pinnedCharacters のキャラが一覧に表示される", () => {
  render(<CharacterPanel {...defaultProps} pinnedCharacters={pinned} characters={two} />);
  expect(screen.getByText("レミリア")).toBeInTheDocument();
  expect(screen.getByText("霊夢")).toBeInTheDocument();
});

test("共通キャラは上部グループ（ローカルより前）に表示される", () => {
  render(<CharacterPanel {...defaultProps} pinnedCharacters={pinned} characters={two} />);
  const listItems = screen.getAllByRole("listitem");
  // li[role=presentation] を除いたキャラアイテムの順序を確認
  // 「レミリア」（共通）が「霊夢」（ローカル）より前に出てくるはず
  const text = listItems.map((li) => li.textContent ?? "").join("|");
  const pinnedIdx = text.indexOf("レミリア");
  const localIdx = text.indexOf("霊夢");
  expect(pinnedIdx).toBeLessThan(localIdx);
});

test("共通キャラが1件以上あるとき「共通」グループ見出しが表示される", () => {
  render(<CharacterPanel {...defaultProps} pinnedCharacters={pinned} characters={two} />);
  // グループ見出しは aria-hidden なので getAllByText で取得
  expect(screen.getByText("共通")).toBeInTheDocument();
  expect(screen.getByText("このプロジェクト")).toBeInTheDocument();
});

test("共通キャラが0件のときグループ見出しは表示されない", () => {
  render(<CharacterPanel {...defaultProps} pinnedCharacters={[]} characters={two} />);
  expect(screen.queryByText("共通")).not.toBeInTheDocument();
  expect(screen.queryByText("このプロジェクト")).not.toBeInTheDocument();
});

test("共通キャラの固定ボタンは aria-pressed=true", () => {
  render(<CharacterPanel {...defaultProps} pinnedCharacters={pinned} characters={two} />);
  const pinBtn = screen.getByRole("button", { name: "固定を解除", hidden: false });
  expect(pinBtn).toHaveAttribute("aria-pressed", "true");
});

test("ローカルキャラの固定ボタンは aria-pressed=false", () => {
  render(<CharacterPanel {...defaultProps} pinnedCharacters={pinned} characters={two} />);
  // ローカルの霊夢のピンボタン
  const pinBtns = screen.getAllByRole("button", { name: "共通キャラに固定", hidden: false });
  // ローカルが2人いるので2ボタン
  expect(pinBtns.length).toBeGreaterThanOrEqual(1);
  for (const btn of pinBtns) {
    expect(btn).toHaveAttribute("aria-pressed", "false");
  }
});

test("ローカルキャラの固定ボタンをクリックすると onPin が呼ばれる", async () => {
  const onPin = vi.fn();
  render(<CharacterPanel {...defaultProps} characters={two} onPin={onPin} />);
  // 霊夢の固定ボタンを押す
  const pinBtns = screen.getAllByRole("button", { name: "共通キャラに固定", hidden: false });
  await userEvent.click(pinBtns[0]!);
  expect(onPin).toHaveBeenCalledWith("c1");
});

test("共通キャラの固定ボタンをクリックすると onUnpin が呼ばれる", async () => {
  const onUnpin = vi.fn();
  render(<CharacterPanel {...defaultProps} pinnedCharacters={pinned} characters={two} onUnpin={onUnpin} />);
  const unpinBtn = screen.getByRole("button", { name: "固定を解除", hidden: false });
  await userEvent.click(unpinBtn);
  expect(onUnpin).toHaveBeenCalledWith("p1");
});

test("固定ボタンのアイコンは SVG（絵文字でない）", () => {
  render(<CharacterPanel {...defaultProps} pinnedCharacters={pinned} characters={two} />);
  // ピンボタン内のアイコンが SVG であることを確認
  const pinBtns = [
    ...screen.getAllByRole("button", { name: "固定を解除", hidden: false }),
    ...screen.getAllByRole("button", { name: "共通キャラに固定", hidden: false }),
  ];
  for (const btn of pinBtns) {
    const svg = btn.querySelector("svg");
    expect(svg).not.toBeNull();
  }
});

test("共通キャラでも削除ボタンの onDelete が呼ばれる（共通削除は useProject でルーティング）", async () => {
  const onDelete = vi.fn();
  // 実効一覧: 共通1 + ローカル2 = 3 → canDelete=true
  render(<CharacterPanel {...defaultProps} pinnedCharacters={pinned} characters={two} onDelete={onDelete} />);
  const deleteBtn = screen.getByRole("button", { name: "レミリア を削除" });
  await userEvent.click(deleteBtn);
  expect(onDelete).toHaveBeenCalledWith("p1");
});

test("実効1人（共通1+ローカル0）のとき削除ボタンは disabled", () => {
  render(<CharacterPanel {...defaultProps} pinnedCharacters={[pinned[0]!]} characters={[]} />);
  expect(screen.getByRole("button", { name: "レミリア を削除" })).toBeDisabled();
});

// ===== v1.4 レビュー指摘テスト（L-3 アクセシビリティ改善）=====

test("L-3: グループ見出し「共通」はスクリーンリーダーに読まれる（aria-hidden を持たない）", () => {
  render(<CharacterPanel {...defaultProps} pinnedCharacters={pinned} characters={two} />);
  // aria-hidden=true が設定されていないこと（修正後は role="group" で読まれる）
  const communLabel = screen.getByText("共通");
  expect(communLabel).not.toHaveAttribute("aria-hidden", "true");
});

test("L-3: グループ見出し「このプロジェクト」はスクリーンリーダーに読まれる（aria-hidden を持たない）", () => {
  render(<CharacterPanel {...defaultProps} pinnedCharacters={pinned} characters={two} />);
  const localLabel = screen.getByText("このプロジェクト");
  expect(localLabel).not.toHaveAttribute("aria-hidden", "true");
});

test("L-3: 共通グループの div は role=group と aria-label=共通キャラクターを持つ", () => {
  render(<CharacterPanel {...defaultProps} pinnedCharacters={pinned} characters={two} />);
  // role="group" を持ち、aria-label が設定されている
  const group = screen.getByRole("group", { name: "共通キャラクター" });
  expect(group).toBeInTheDocument();
});

test("L-3: ローカルグループの div は role=group と aria-label=このプロジェクトのキャラクターを持つ", () => {
  render(<CharacterPanel {...defaultProps} pinnedCharacters={pinned} characters={two} />);
  const group = screen.getByRole("group", { name: "このプロジェクトのキャラクター" });
  expect(group).toBeInTheDocument();
});
