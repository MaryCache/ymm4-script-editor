// src/components/Modal/Modal.test.tsx
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Modal } from "./Modal";

// open=true のとき children を描画する
test("open=true のとき children が描画される", () => {
  render(
    <Modal open={true} onClose={() => {}}>
      <div>モーダルコンテンツ</div>
    </Modal>,
  );
  expect(screen.getByText("モーダルコンテンツ")).toBeInTheDocument();
});

// open=false のとき children を描画しない
test("open=false のとき children が描画されない", () => {
  render(
    <Modal open={false} onClose={() => {}}>
      <div>非表示コンテンツ</div>
    </Modal>,
  );
  expect(screen.queryByText("非表示コンテンツ")).not.toBeInTheDocument();
});

// Esc キーで onClose が呼ばれる
test("Esc キーで onClose が呼ばれる", async () => {
  const onClose = vi.fn();
  render(
    <Modal open={true} onClose={onClose}>
      <button>ボタン</button>
    </Modal>,
  );
  await userEvent.keyboard("{Escape}");
  expect(onClose).toHaveBeenCalledTimes(1);
});

// オーバーレイクリックで onClose が呼ばれる
test("オーバーレイクリックで onClose が呼ばれる", async () => {
  const onClose = vi.fn();
  const { baseElement } = render(
    <Modal open={true} onClose={onClose}>
      <div role="document">パネル内容</div>
    </Modal>,
  );
  // オーバーレイは body 直下に portal される。data-testid なしで直接クラスを探す。
  // パネル内の要素をクリックしても onClose が呼ばれないことを確認するため
  // 先にパネル外（オーバーレイ）を特定する。
  const overlay = baseElement.querySelector('[class*="overlay"]') as HTMLElement;
  expect(overlay).toBeTruthy();
  // オーバーレイ自身に mousedown を発火（target === currentTarget の条件を満たす）。
  const event = new MouseEvent("mousedown", { bubbles: true });
  Object.defineProperty(event, "target", { value: overlay, writable: false });
  overlay.dispatchEvent(event);
  expect(onClose).toHaveBeenCalled();
});

// パネル内クリックでは onClose が呼ばれない
test("パネル内クリックでは onClose が呼ばれない", async () => {
  const onClose = vi.fn();
  render(
    <Modal open={true} onClose={onClose}>
      <div>パネル内容</div>
    </Modal>,
  );
  await userEvent.click(screen.getByText("パネル内容"));
  expect(onClose).not.toHaveBeenCalled();
});

// role / aria 属性が正しく設定される（dialog）
test("role='dialog' と aria-modal='true' が設定される", () => {
  render(
    <Modal open={true} onClose={() => {}}>
      <div>内容</div>
    </Modal>,
  );
  const dialog = screen.getByRole("dialog");
  expect(dialog).toHaveAttribute("aria-modal", "true");
});

// role='alertdialog' を指定できる
test("role='alertdialog' を指定できる", () => {
  render(
    <Modal open={true} onClose={() => {}} role="alertdialog">
      <div>確認</div>
    </Modal>,
  );
  expect(screen.getByRole("alertdialog")).toBeInTheDocument();
});

// titleId / descId が aria 属性に反映される
test("titleId が aria-labelledby に、descId が aria-describedby に設定される", () => {
  render(
    <Modal open={true} onClose={() => {}} titleId="my-title" descId="my-desc">
      <div>内容</div>
    </Modal>,
  );
  const dialog = screen.getByRole("dialog");
  expect(dialog).toHaveAttribute("aria-labelledby", "my-title");
  expect(dialog).toHaveAttribute("aria-describedby", "my-desc");
});
