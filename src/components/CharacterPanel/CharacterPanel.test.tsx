// src/components/CharacterPanel/CharacterPanel.test.tsx
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { CharacterPanel } from "./CharacterPanel";
import type { Character } from "../../types";

const two: Character[] = [
  { id: "c1", name: "霊夢", color: "#FF6B6B" },
  { id: "c2", name: "魔理沙", color: "#FFB347" },
];

// ===== 既存テスト（追加/削除/disabled）=====

test("一覧にキャラ名を表示", () => {
  render(
    <CharacterPanel
      characters={two}
      onAdd={() => {}}
      onDelete={() => {}}
      onRename={() => {}}
      onColorChange={() => {}}
    />,
  );
  expect(screen.getByText("霊夢")).toBeInTheDocument();
});

test("名前を入力して追加すると onAdd が呼ばれ、入力がクリアされる", async () => {
  const onAdd = vi.fn();
  render(
    <CharacterPanel characters={[]} onAdd={onAdd} onDelete={() => {}} onRename={() => {}} onColorChange={() => {}} />,
  );
  // aria-label="キャラクター名" で取得（I-4 対応）
  const input = screen.getByRole("textbox", { name: "キャラクター名" });
  await userEvent.type(input, "魔理沙");
  await userEvent.click(screen.getByRole("button", { name: "追加" }));
  expect(onAdd).toHaveBeenCalledWith("魔理沙");
  expect(input).toHaveValue("");
});

test("空白のみの名前は追加できない", async () => {
  const onAdd = vi.fn();
  render(
    <CharacterPanel characters={[]} onAdd={onAdd} onDelete={() => {}} onRename={() => {}} onColorChange={() => {}} />,
  );
  // aria-label="キャラクター名" で取得（I-4 対応）
  await userEvent.type(screen.getByRole("textbox", { name: "キャラクター名" }), "   ");
  await userEvent.click(screen.getByRole("button", { name: "追加" }));
  expect(onAdd).not.toHaveBeenCalled();
});

test("2人以上なら削除ボタンで onDelete が呼ばれる", async () => {
  const onDelete = vi.fn();
  render(
    <CharacterPanel
      characters={two}
      onAdd={() => {}}
      onDelete={onDelete}
      onRename={() => {}}
      onColorChange={() => {}}
    />,
  );
  await userEvent.click(screen.getByRole("button", { name: "霊夢 を削除" }));
  expect(onDelete).toHaveBeenCalledWith("c1");
});

test("キャラが1人だけのとき削除ボタンは disabled", () => {
  render(
    <CharacterPanel
      characters={[two[0]!]}
      onAdd={() => {}}
      onDelete={() => {}}
      onRename={() => {}}
      onColorChange={() => {}}
    />,
  );
  expect(screen.getByRole("button", { name: "霊夢 を削除" })).toBeDisabled();
});

// ===== 名前インライン編集テスト（§2.2 / F-80-82）=====

test("名前をダブルクリックすると編集 input が表示される", async () => {
  render(
    <CharacterPanel
      characters={two}
      onAdd={() => {}}
      onDelete={() => {}}
      onRename={() => {}}
      onColorChange={() => {}}
    />,
  );
  // 通常表示では span でテキストが見える
  expect(screen.getByText("霊夢")).toBeInTheDocument();

  await userEvent.dblClick(screen.getByText("霊夢"));

  // 編集モード: aria-label="霊夢 の名前を編集" の input が出現（M-6: キャラ別 aria-label）
  expect(screen.getByRole("textbox", { name: "霊夢 の名前を編集" })).toBeInTheDocument();
});

test("編集 input で Enter を押すと onRename が (id, 新名) で呼ばれる", async () => {
  const onRename = vi.fn();
  render(
    <CharacterPanel
      characters={two}
      onAdd={() => {}}
      onDelete={() => {}}
      onRename={onRename}
      onColorChange={() => {}}
    />,
  );
  await userEvent.dblClick(screen.getByText("霊夢"));

  // M-6: aria-label はキャラ名を含む（"霊夢 の名前を編集"）
  const input = screen.getByRole("textbox", { name: "霊夢 の名前を編集" });
  await userEvent.clear(input);
  await userEvent.type(input, "博麗霊夢");
  await userEvent.keyboard("{Enter}");

  expect(onRename).toHaveBeenCalledWith("c1", "博麗霊夢");
  // 編集 input は消える
  expect(screen.queryByRole("textbox", { name: "霊夢 の名前を編集" })).not.toBeInTheDocument();
});

test("編集中に Esc を押すとキャンセルされ onRename は呼ばれない", async () => {
  const onRename = vi.fn();
  render(
    <CharacterPanel
      characters={two}
      onAdd={() => {}}
      onDelete={() => {}}
      onRename={onRename}
      onColorChange={() => {}}
    />,
  );
  await userEvent.dblClick(screen.getByText("霊夢"));

  // M-6: aria-label はキャラ名を含む（"霊夢 の名前を編集"）
  const input = screen.getByRole("textbox", { name: "霊夢 の名前を編集" });
  await userEvent.clear(input);
  await userEvent.type(input, "削除されるべきでない入力");
  await userEvent.keyboard("{Escape}");

  expect(onRename).not.toHaveBeenCalled();
  // 編集 input は消える
  expect(screen.queryByRole("textbox", { name: "霊夢 の名前を編集" })).not.toBeInTheDocument();
});

test("trim 後が空文字の状態で確定しても onRename は呼ばれない", async () => {
  const onRename = vi.fn();
  render(
    <CharacterPanel
      characters={two}
      onAdd={() => {}}
      onDelete={() => {}}
      onRename={onRename}
      onColorChange={() => {}}
    />,
  );
  await userEvent.dblClick(screen.getByText("霊夢"));

  // M-6: aria-label はキャラ名を含む（"霊夢 の名前を編集"）
  const input = screen.getByRole("textbox", { name: "霊夢 の名前を編集" });
  await userEvent.clear(input);
  await userEvent.type(input, "   ");
  await userEvent.keyboard("{Enter}");

  expect(onRename).not.toHaveBeenCalled();
});

// ===== 色変更テスト（§2.3 / F-90-93）=====

test("色ドットボタンをクリックすると ColorWheel が表示される", async () => {
  render(
    <CharacterPanel
      characters={two}
      onAdd={() => {}}
      onDelete={() => {}}
      onRename={() => {}}
      onColorChange={() => {}}
    />,
  );
  // 色ドットは button（aria-label: "{name} の色を変更"）
  await userEvent.click(screen.getByRole("button", { name: "霊夢 の色を変更" }));

  // ColorWheel の hex 入力欄（aria-label="色（16進）"）が出現することで ColorWheel の存在を確認
  expect(screen.getByRole("textbox", { name: "色（16進）" })).toBeInTheDocument();
});

test("ColorWheel で色を変更すると onColorChange が呼ばれる", async () => {
  const onColorChange = vi.fn();
  render(
    <CharacterPanel
      characters={two}
      onAdd={() => {}}
      onDelete={() => {}}
      onRename={() => {}}
      onColorChange={onColorChange}
    />,
  );
  await userEvent.click(screen.getByRole("button", { name: "霊夢 の色を変更" }));

  const hexInput = screen.getByRole("textbox", { name: "色（16進）" });
  // hex 入力欄に有効な hex カラーを入力
  await userEvent.clear(hexInput);
  await userEvent.type(hexInput, "#1abc9c");

  // onColorChange が id と hex で呼ばれることを確認
  expect(onColorChange).toHaveBeenCalledWith("c1", expect.stringMatching(/^#[0-9a-f]{6}$/i));
});

test("ColorWheel は1つしか開かない（排他）", async () => {
  render(
    <CharacterPanel
      characters={two}
      onAdd={() => {}}
      onDelete={() => {}}
      onRename={() => {}}
      onColorChange={() => {}}
    />,
  );
  // 1つ目を開く
  await userEvent.click(screen.getByRole("button", { name: "霊夢 の色を変更" }));
  expect(screen.getAllByRole("textbox", { name: "色（16進）" })).toHaveLength(1);

  // 2つ目を開く → 1つ目が閉じて2つ目が開く
  await userEvent.click(screen.getByRole("button", { name: "魔理沙 の色を変更" }));
  expect(screen.getAllByRole("textbox", { name: "色（16進）" })).toHaveLength(1);
});
