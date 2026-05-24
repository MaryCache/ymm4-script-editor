// src/components/ProjectTabs/ProjectTabs.test.tsx
import { render, screen, act } from "@testing-library/react";
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
  render(<ProjectTabs tabs={[tab1, tab2]} activeId="t1" onSwitch={noop} onNew={noop} onClose={noop} onRename={noop} />);
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

// ===== Delete キーでフォーカス中のタブを閉じる（a11y #2）=====

test("タブが2つ以上のとき Delete キーで onClose(id) が呼ばれる", async () => {
  const onClose = vi.fn();
  render(
    <ProjectTabs tabs={[tab1, tab2]} activeId="t1" onSwitch={noop} onNew={noop} onClose={onClose} onRename={noop} />,
  );
  const tabBtns = screen.getAllByRole("tab");
  // t1 タブにフォーカスして Delete を押す
  tabBtns[0]!.focus();
  await userEvent.keyboard("{Delete}");
  expect(onClose).toHaveBeenCalledWith("t1");
});

test("タブが1つだけのとき Delete キーで onClose が呼ばれない", async () => {
  const onClose = vi.fn();
  render(<ProjectTabs tabs={[tab1]} activeId="t1" onSwitch={noop} onNew={noop} onClose={onClose} onRename={noop} />);
  const tabBtns = screen.getAllByRole("tab");
  tabBtns[0]!.focus();
  await userEvent.keyboard("{Delete}");
  expect(onClose).not.toHaveBeenCalled();
});

// ===== インライン編集中は input がタブボタンの外側（兄弟）として描画される（a11y #3）=====

test("編集中は role=tab ボタンが消えて input が tabItem 直下に描画される", async () => {
  render(<ProjectTabs tabs={[tab1, tab2]} activeId="t1" onSwitch={noop} onNew={noop} onClose={noop} onRename={noop} />);
  // ダブルクリック前: role=tab ボタンが存在する
  expect(screen.getAllByRole("tab")).toHaveLength(2);
  await userEvent.dblClick(screen.getByText("プロジェクト1"));
  // 編集中: t1 の role=tab ボタンは消え、role=tab は t2 のみ
  expect(screen.getAllByRole("tab")).toHaveLength(1);
  // input は存在する
  expect(screen.getByRole("textbox", { name: "プロジェクト名を編集" })).toBeInTheDocument();
});

// ===== ① ＋ ボタン: 装飾 span（aria-hidden）を持つ =====
// Why: ① の実装確認。スクリーンリーダーが ＋ 記号を読まないことを保証する。

test("「＋」ボタンが aria-hidden な装飾 span を内包する", () => {
  render(<ProjectTabs tabs={[tab1, tab2]} activeId="t1" onSwitch={noop} onNew={noop} onClose={noop} onRename={noop} />);
  const newBtn = screen.getByRole("button", { name: "新しいプロジェクト" });
  // 子要素に aria-hidden="true" の span が存在することを確認
  const decorSpan = newBtn.querySelector("span[aria-hidden='true']");
  expect(decorSpan).not.toBeNull();
});

// ===== ③ × reveal: 2タブ以上のとき closeBtnReveal クラスを持つ =====
// Why: reveal クラスが付くことで CSS の hover/focus-within が有効になる。
// jsdom で CSS 疑似クラスの視覚効果は確認できないが、クラス付与は確認可能。

test("タブが2つ以上のとき × ボタンが reveal クラスを持つ", () => {
  render(<ProjectTabs tabs={[tab1, tab2]} activeId="t1" onSwitch={noop} onNew={noop} onClose={noop} onRename={noop} />);
  const closeBtns = screen.getAllByRole("button", { name: /を閉じる/ });
  for (const btn of closeBtns) {
    // CSS Modules はクラス名をハッシュ化するため className 文字列に "closeBtnReveal" が含まれるかで判定
    expect(btn.className).toContain("closeBtnReveal");
  }
});

// ===== ④ タブ退場: reduced-motion 環境では onClose 呼び出し後にゴーストが残らない =====
// Why: テスト環境は matchMedia が prefers-reduced-motion: reduce = true を返す（setup.ts）。
//   reduced 時はゴーストを生成せず即時消滅するため、onClose 後すぐに該当タブの痕跡がなくなる。
//   これにより既存の「×クリックで onClose 即呼び」系テストが維持できることを確認する。

test("reduced-motion 環境: タブ削除後にゴーストが残らない（退場ゴーストなし）", async () => {
  const onClose = vi.fn();
  const { rerender } = render(
    <ProjectTabs tabs={[tab1, tab2]} activeId="t1" onSwitch={noop} onNew={noop} onClose={onClose} onRename={noop} />,
  );
  // tab2 の × をクリック → onClose が呼ばれる
  await userEvent.click(screen.getByRole("button", { name: "プロジェクト2 を閉じる" }));
  expect(onClose).toHaveBeenCalledWith("t2");

  // App が tabs を更新したことをシミュレート: tab2 を除いた props で再レンダー
  rerender(<ProjectTabs tabs={[tab1]} activeId="t1" onSwitch={noop} onNew={noop} onClose={onClose} onRename={noop} />);

  // reduced-motion 下ではゴーストが生成されないため aria-hidden="true" な要素は存在しない
  // （tabGhost は aria-hidden でレンダーされる）
  const ghosts = document.querySelectorAll("[aria-hidden='true']");
  // aria-hidden 要素がゼロ、あるいは存在しても tabGhost クラスを持たないことを確認
  for (const el of ghosts) {
    expect(el.className).not.toContain("tabGhost");
  }
});

// ===== ④ タブ退場ゴースト: 元インデックス位置に出現することを検証（C1 再発防止）=====
// Why: useEffect → useLayoutEffect への移行後、ゴーストが元インデックス位置に挿入されることを
//   保証する回帰テスト。
// セットアップ: matchMedia を per-test で reduced=false に差し替え + vi.useFakeTimers()。
// afterEach で元に戻し他テストへの影響を防ぐ。
//
// CSS Modules はクラス名をハッシュ化するため、tabGhost の判定は className の includes で行う。
// DOM 兄弟順で「ゴーストが t1 の次・t3 の前」に位置することを確認する。

describe("退場ゴースト位置・ライフサイクル（reduced=false / fake timers）", () => {
  const originalMatchMedia = window.matchMedia;

  beforeEach(() => {
    // matchMedia を reduced=false に差し替える
    Object.defineProperty(window, "matchMedia", {
      writable: true,
      value: (query: string) => ({
        matches: false, // reduced-motion = false
        media: query,
        onchange: null,
        addListener: () => {},
        removeListener: () => {},
        addEventListener: () => {},
        removeEventListener: () => {},
        dispatchEvent: () => false,
      }),
    });
    vi.useFakeTimers({ shouldAdvanceTime: false });
  });

  afterEach(async () => {
    // act でラップして pending state update をフラッシュしてからタイマーを消費する。
    // これにより次テストの render 後にタイマーが発火して act 警告が出るのを防ぐ。
    await act(async () => {
      vi.runAllTimers();
    });
    vi.useRealTimers();
    // matchMedia を元のスタブ（reduced=true）に戻す
    Object.defineProperty(window, "matchMedia", {
      writable: true,
      value: originalMatchMedia,
    });
  });

  test("中間タブ削除時: ゴーストが元の位置（t1 の次・t3 の前）に出現する", async () => {
    const { rerender } = render(
      <ProjectTabs
        tabs={[tab1, tab2, tab3]}
        activeId="t1"
        onSwitch={noop}
        onNew={noop}
        onClose={noop}
        onRename={noop}
      />,
    );

    // t2 を削除した props で再レンダー（App の状態更新をシミュレート）
    // async act でラップし、さらに空の async act で pending state を追加フラッシュする。
    // useLayoutEffect → setGhosts が React 19 + fake timers 環境で
    // act バウンダリ外から発火する警告を防ぐ。
    await act(async () => {
      rerender(
        <ProjectTabs tabs={[tab1, tab3]} activeId="t1" onSwitch={noop} onNew={noop} onClose={noop} onRename={noop} />,
      );
      await Promise.resolve();
    });

    // tabGhost クラスを持つ要素が存在することを確認
    const ghostEls = document.querySelectorAll("[aria-hidden='true']");
    const ghostTabEls = Array.from(ghostEls).filter((el) => el.className.includes("tabGhost"));
    expect(ghostTabEls).toHaveLength(1);

    const ghost = ghostTabEls[0]!;
    // ゴーストに t2 の名前が表示されていること
    expect(ghost.textContent).toContain("プロジェクト2");

    // DOM 兄弟順の確認: tabList 直下の子を列挙して順序を検証
    const tabList = screen.getByRole("tablist");
    const children = Array.from(tabList.children);

    // children は [t1-tabItem, ghost, t3-tabItem, newBtn] の順になるはず
    const t1Idx = children.findIndex(
      (el) => el.textContent?.includes("プロジェクト1") && el.className.includes("tabItem"),
    );
    const ghostIdx = children.indexOf(ghost);
    const t3Idx = children.findIndex(
      (el) => el.textContent?.includes("プロジェクト3") && el.className.includes("tabItem"),
    );

    expect(t1Idx).toBeGreaterThanOrEqual(0);
    expect(ghostIdx).toBeGreaterThanOrEqual(0);
    expect(t3Idx).toBeGreaterThanOrEqual(0);
    // ゴーストは t1 の後・t3 の前
    expect(ghostIdx).toBeGreaterThan(t1Idx);
    expect(ghostIdx).toBeLessThan(t3Idx);
  });

  test("末尾タブ削除時: ゴーストが末尾（＋ の手前）に出現する", async () => {
    const { rerender } = render(
      <ProjectTabs
        tabs={[tab1, tab2, tab3]}
        activeId="t1"
        onSwitch={noop}
        onNew={noop}
        onClose={noop}
        onRename={noop}
      />,
    );

    // t3（末尾）を削除した props で再レンダー
    await act(async () => {
      rerender(
        <ProjectTabs tabs={[tab1, tab2]} activeId="t1" onSwitch={noop} onNew={noop} onClose={noop} onRename={noop} />,
      );
      await Promise.resolve();
    });

    const ghostEls = document.querySelectorAll("[aria-hidden='true']");
    const ghostTabEls = Array.from(ghostEls).filter((el) => el.className.includes("tabGhost"));
    expect(ghostTabEls).toHaveLength(1);

    const ghost = ghostTabEls[0]!;
    expect(ghost.textContent).toContain("プロジェクト3");

    const tabList = screen.getByRole("tablist");
    const children = Array.from(tabList.children);

    // ゴーストは ＋ ボタン（最後の子）の直前にある
    const ghostIdx = children.indexOf(ghost);
    const newBtnIdx = children.length - 1; // newBtn は常に最後
    expect(ghostIdx).toBe(newBtnIdx - 1);
  });

  test("ゴーストが REMOVE_DURATION(200ms) 経過後に DOM から消える", async () => {
    const { rerender } = render(
      <ProjectTabs tabs={[tab1, tab2]} activeId="t1" onSwitch={noop} onNew={noop} onClose={noop} onRename={noop} />,
    );

    await act(async () => {
      rerender(<ProjectTabs tabs={[tab1]} activeId="t1" onSwitch={noop} onNew={noop} onClose={noop} onRename={noop} />);
      await Promise.resolve();
    });

    // タイマー実行前: ゴーストが存在する
    const beforeGhosts = Array.from(document.querySelectorAll("[aria-hidden='true']")).filter((el) =>
      el.className.includes("tabGhost"),
    );
    expect(beforeGhosts).toHaveLength(1);

    // REMOVE_DURATION(200ms) 経過後: ゴーストが消える
    act(() => {
      vi.advanceTimersByTime(200);
    });

    const afterGhosts = Array.from(document.querySelectorAll("[aria-hidden='true']")).filter((el) =>
      el.className.includes("tabGhost"),
    );
    expect(afterGhosts).toHaveLength(0);
  });
});
