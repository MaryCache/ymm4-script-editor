import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import App from "./App";

beforeEach(() => localStorage.clear());

test("キャラ追加 → 行追加 → セリフ入力の一連が動き、合計文字数が反映される", async () => {
  render(<App />);
  await userEvent.type(screen.getByPlaceholderText("キャラクター名"), "霊夢");
  await userEvent.click(screen.getByRole("button", { name: "追加" }));
  await userEvent.click(screen.getByRole("button", { name: "+ 行を追加" }));

  const seriesInput = screen.getByRole("textbox", { name: "セリフ" });
  await userEvent.type(seriesInput, "やあ");

  expect(seriesInput).toHaveValue("やあ");
  expect(screen.getByText(/合計文字数:\s*2/)).toBeInTheDocument();
});

// 全行リセット確認 → 行が消える結合テスト（prefers-reduced-motion: reduce で即時クリア）
// テスト環境は matchMedia スタブで reduce=true のため、タイマー待ちなしで即時クリアになる。
test("全行リセット確認で行が消える（reduce=true 環境で即時）", async () => {
  render(<App />);

  // キャラ追加 → 行追加
  await userEvent.type(screen.getByPlaceholderText("キャラクター名"), "霊夢");
  await userEvent.click(screen.getByRole("button", { name: "追加" }));
  await userEvent.click(screen.getByRole("button", { name: "+ 行を追加" }));

  // 行が1件あることを確認
  expect(screen.getByText(/行数:\s*1/)).toBeInTheDocument();

  // 全行リセットボタンをクリック → 確認ダイアログが開く
  await userEvent.click(screen.getByRole("button", { name: "全行リセット" }));
  expect(screen.getByRole("alertdialog")).toBeInTheDocument();

  // 「リセット」ボタンで確定
  await userEvent.click(screen.getByRole("button", { name: "リセット" }));

  // ダイアログが閉じて行数が 0 になる
  await waitFor(() => {
    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
  });
  expect(screen.getByText(/行数:\s*0/)).toBeInTheDocument();
});

// ===== プロジェクトタブ結合テスト（v1.3）=====

// 「＋」新規ボタンで2タブになる
test("「＋」ボタンで新規タブが追加され2タブになる", async () => {
  render(<App />);
  // 初期は1タブ
  expect(screen.getAllByRole("tab")).toHaveLength(1);
  // 「新しいプロジェクト」ボタンをクリック
  await userEvent.click(screen.getByRole("button", { name: "新しいプロジェクト" }));
  expect(screen.getAllByRole("tab")).toHaveLength(2);
});

// 空タブの × は即閉じ（ConfirmDialog が出ない）
test("空タブの × をクリックすると確認なしで閉じる", async () => {
  render(<App />);
  // 新規タブを追加して2タブにする
  await userEvent.click(screen.getByRole("button", { name: "新しいプロジェクト" }));
  expect(screen.getAllByRole("tab")).toHaveLength(2);

  // 2枚目（アクティブ）は空なので × クリックで即閉じ
  const closeBtns = screen.getAllByRole("button", { name: /を閉じる/ });
  await userEvent.click(closeBtns[1]!);

  // ダイアログは出ずに1タブに戻る
  expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
  expect(screen.getAllByRole("tab")).toHaveLength(1);
});

// 中身ありタブの × は ConfirmDialog が出て、確定で閉じる
test("中身ありタブの × クリックで ConfirmDialog が出て確定で閉じる", async () => {
  render(<App />);
  // 初期タブにキャラ追加 → 行追加（中身あり状態にする）
  await userEvent.type(screen.getByPlaceholderText("キャラクター名"), "霊夢");
  await userEvent.click(screen.getByRole("button", { name: "追加" }));
  await userEvent.click(screen.getByRole("button", { name: "+ 行を追加" }));
  // 行が入ったことを確認
  expect(screen.getByText(/行数:\s*1/)).toBeInTheDocument();

  // 2枚目タブを追加して切り替えてから1枚目に戻る
  await userEvent.click(screen.getByRole("button", { name: "新しいプロジェクト" }));
  // 中身あり（1枚目）の × をクリック
  const closeBtns = screen.getAllByRole("button", { name: /を閉じる/ });
  await userEvent.click(closeBtns[0]!);

  // ConfirmDialog が表示される
  expect(screen.getByRole("alertdialog")).toBeInTheDocument();

  // 「閉じる」ボタンで確定
  await userEvent.click(screen.getByRole("button", { name: "閉じる" }));

  // ダイアログが閉じてタブが1つになる
  await waitFor(() => {
    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
  });
  expect(screen.getAllByRole("tab")).toHaveLength(1);
});

// コピペ取込 → トースト文言が表示される結合テスト
test("コピペ取込でトースト『N 行を取り込みました。』が表示される", async () => {
  const { baseElement } = render(<App />);

  // キャラ追加してコピペインポートボタンを開く
  await userEvent.type(screen.getByPlaceholderText("キャラクター名"), "魔理沙");
  await userEvent.click(screen.getByRole("button", { name: "追加" }));

  // コピペインポートモーダルを開く
  await userEvent.click(screen.getByRole("button", { name: "コピペでインポート" }));
  expect(screen.getByRole("dialog")).toBeInTheDocument();

  // textarea にテキストを入力
  const textarea = screen.getByRole("textbox", { name: "インポートするテキスト" });
  await userEvent.type(textarea, "セリフ1\nセリフ2\nセリフ3");

  // 取り込みボタンをクリック
  await userEvent.click(screen.getByRole("button", { name: "取り込み" }));

  // モーダルが閉じる
  await waitFor(() => {
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  // トースト通知が表示される（body 直下の aria-label="通知" 内を検索）
  const viewport = baseElement.querySelector('[aria-label="通知"]');
  expect(viewport).toBeTruthy();
  expect(within(viewport as HTMLElement).getByText(/行を取り込みました。/)).toBeInTheDocument();
});
