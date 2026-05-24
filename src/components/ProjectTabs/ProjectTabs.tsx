// src/components/ProjectTabs/ProjectTabs.tsx
import { useState, useRef, useEffect, useLayoutEffect, type KeyboardEvent } from "react";
import type { TabEntry } from "../../types";
import styles from "./ProjectTabs.module.css";

// TabEntry は types.ts で定義。後方互換のため index.ts から re-export 継続。
export type { TabEntry };

/**
 * `ProjectTabs` コンポーネントの props 型。
 *
 * @see {@link ProjectTabs}
 */
export type ProjectTabsProps = {
  /** タブ一覧。 */
  tabs: TabEntry[];
  /** 現在アクティブなエントリの ID。 */
  activeId: string;
  /**
   * タブ切替要求のコールバック。
   *
   * @param id - アクティブにするエントリの ID
   */
  onSwitch: (id: string) => void;
  /** 新規プロジェクト追加要求のコールバック（「＋」ボタン押下）。 */
  onNew: () => void;
  /**
   * タブ閉じ要求のコールバック（× ボタン押下）。
   *
   * @remarks
   * 確認の要否は呼び出し元（App）が `isEmpty` を見て判断する。
   * 最後の1タブは × を disabled にするため呼ばれない（ProjectTabs 側のガード）。
   *
   * @param id - 閉じるエントリの ID
   */
  onClose: (id: string) => void;
  /**
   * タブリネーム要求のコールバック（インライン編集 Enter/blur）。
   *
   * @param id - 変更対象のエントリの ID
   * @param name - 新しいプロジェクト名（trim 後が空の場合は `useProject.renameProject` 側で no-op）
   */
  onRename: (id: string, name: string) => void;
};

// ===== 退場ゴースト型 =====
// タブが tabs prop から消えた瞬間、元の位置に一時的なゴースト要素をレンダーして
// フェード＋幅コラプスアニメを再生する。REMOVE_DURATION 後にゴーストを破棄する。
type GhostTab = {
  /** 退場するタブの ID */
  id: string;
  /** 退場するタブの名前（ゴーストに表示するため保持） */
  name: string;
  /**
   * 消える直前の表示インデックス（現行 tabs 内の位置）。
   * レンダリスト生成時にゴーストを元の位置に差し込むために使う。
   * 複数同時削除でも昇順 splice により破綻しない。
   */
  index: number;
};

/** 退場アニメーション再生時間 (ms)。CSS の tabExit animation と必ず一致させる。 */
const REMOVE_DURATION = 200;

// ===== FLIP ヘルパー型 =====
// 進行中の FLIP アニメーション状態。cleanup に必要な ID を束ねる。
type PendingFLIP = {
  rafId: number;
  timeoutId: ReturnType<typeof window.setTimeout>;
  els: Array<{ el: HTMLElement; prevTransition: string }>;
};

/**
 * プロジェクトタブ行コンポーネント。
 *
 * @remarks
 * - ヘッダー直下に横並びタブ行（`role="tablist"`）を描画する。
 * - 各タブ（`role="tab"`）にプロジェクト名と × 閉じボタンを持つ。
 * - 最後の1タブでは × を disabled にする（F-114）。
 * - タブ名ダブルクリックでインライン編集（CharacterPanel と同パターン）。
 *   Enter/blur で確定、Esc でキャンセル（F-116）。
 * - タブリスト内の最後尾に「＋」新規ボタン（F-111）。タブと一緒にスクロールする。
 * - タブが多い場合は横スクロール可能（F-115）。
 * - アクティブタブが見えるよう `scrollIntoView` を呼ぶ。
 * - 矢印キーでタブ間を移動する（ARIA tablist keyboard a11y）。
 * - `prefers-reduced-motion: reduce` でアニメーションを簡素化（F-115）。
 *
 * ## アニメーション一覧
 * - ① ＋ ボタン hover 回転: CSS `.newBtn:hover .newBtnPlus`（ScriptEditor の .plus と同パターン）。
 * - ② ＋ ボタン移動 FLIP: タブ増減時に ＋ の x 位置をグライドさせる（FLIP、reduced = 即時）。
 * - ③ × ボタン reveal: タブ hover / :focus-within 時に opacity フェードで出現（CSS のみ）。
 * - ④ タブ退場: `tabs` prop から id が消えたことを検知してゴースト要素でフェード＋幅コラプス。
 *   reduced-motion 下ではゴーストなし即時（テスト環境でも即時）。
 *
 * @param props - {@link ProjectTabsProps}
 */
export function ProjectTabs({ tabs, activeId, onSwitch, onNew, onClose, onRename }: ProjectTabsProps) {
  const isSingle = tabs.length <= 1;

  // ===== インライン編集（CharacterPanel と同パターン）=====
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");

  const startEdit = (id: string, currentName: string) => {
    setEditingId(id);
    setEditValue(currentName);
  };

  const commitEdit = (id: string, value: string) => {
    setEditingId(null);
    // trim 後が空の場合は onRename に渡さない（useProject 側でも no-op だが UI 側でもガード）
    const trimmed = value.trim();
    if (trimmed !== "") {
      onRename(id, trimmed);
    }
  };

  const cancelEdit = () => {
    setEditingId(null);
  };

  const handleEditKeyDown = (e: KeyboardEvent<HTMLInputElement>, id: string) => {
    if (e.key === "Enter") {
      e.preventDefault();
      commitEdit(id, editValue);
    } else if (e.key === "Escape") {
      e.preventDefault();
      cancelEdit();
    }
  };

  // ===== アクティブタブの scrollIntoView =====
  // jsdom 環境（テスト）では scrollIntoView が未実装なため optional call でガードする。
  const activeTabRef = (node: HTMLButtonElement | null) => {
    if (node) {
      node.scrollIntoView?.({ block: "nearest", inline: "nearest" });
    }
  };

  // ===== 矢印キーナビゲーション + Delete キー閉じ（ARIA tablist パターン）=====
  // Delete（または Backspace）キーでフォーカス中のタブを閉じる。
  // タブが1つだけ（isSingle）のときは何もしない。
  const handleTabKeyDown = (e: KeyboardEvent<HTMLButtonElement>, tab: TabEntry, currentIdx: number) => {
    if (e.key === "ArrowRight") {
      e.preventDefault();
      const nextIdx = (currentIdx + 1) % tabs.length;
      const nextId = tabs[nextIdx]?.id;
      if (nextId) onSwitch(nextId);
    } else if (e.key === "ArrowLeft") {
      e.preventDefault();
      const prevIdx = (currentIdx - 1 + tabs.length) % tabs.length;
      const prevId = tabs[prevIdx]?.id;
      if (prevId) onSwitch(prevId);
    } else if ((e.key === "Delete" || e.key === "Backspace") && !isSingle) {
      // フォーカス中のタブを閉じる（タブが1つだけのときは no-op）。
      e.preventDefault();
      onClose(tab.id);
    }
  };

  // ===== ④ 退場アニメーション: ゴースト方式 =====
  // Why ゴースト方式: ×クリックを横取りして先にアニメするのではなく、
  // App 側の ConfirmDialog やキーボード操作など全削除経路を一元カバーするため、
  // 「props の tabs から id が消えたこと」を検知して退場ゴーストを出す。
  // reduced-motion 環境ではゴーストを出さず即時消滅（テスト環境 = reduced = 既存テスト維持）。

  /** 退場アニメーション中のゴースト一覧。 */
  const [ghosts, setGhosts] = useState<GhostTab[]>([]);

  // 前回の tabs を ref で保持（今回の tabs と比較して消えた id を検知する）。
  const prevTabsRef = useRef<TabEntry[]>(tabs);

  // 退場ゴースト用タイマーの id を保持する Set（unmount cleanup + 早期削除に使う）。
  const ghostTimerIds = useRef(new Set<ReturnType<typeof window.setTimeout>>());

  useEffect(() => {
    const ids = ghostTimerIds.current;
    return () => {
      for (const id of ids) {
        window.clearTimeout(id);
      }
      ids.clear();
    };
  }, []);

  // tabs が変化するたびに「消えた tab」を検知してゴーストを生成する。
  //
  // Why useLayoutEffect（not useEffect）:
  //   useEffect では描画後の別コミットでゴーストが DOM に挿入されるため、
  //   FLIP 測定時にゴーストが存在せず ＋ ボタンの二重移動が発生していた。
  //   useLayoutEffect に変えることで削除と同じフレームでゴーストを DOM に出し、
  //   FLIP 測定の時点でゴーストが全幅で存在することを保証する。
  //
  // ゴーストの index フィールドに「prevTabs 内での位置」を記録する。
  // レンダリスト生成時（後述の mergedList）にゴーストを元インデックス位置に splice 挿入する。
  // これにより中間タブを閉じても末尾ではなく元の位置にゴーストが出る（C1 修正）。
  useLayoutEffect(() => {
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const prev = prevTabsRef.current;
    const currentIds = new Set(tabs.map((t) => t.id));

    if (!reduced) {
      const removed = prev.map((t, i) => ({ tab: t, index: i })).filter(({ tab }) => !currentIds.has(tab.id));

      if (removed.length > 0) {
        setGhosts((g) => {
          const existingIds = new Set(g.map((x) => x.id));
          const newGhosts = removed
            .filter(({ tab }) => !existingIds.has(tab.id))
            .map(({ tab, index }) => ({ id: tab.id, name: tab.name, index }));
          return newGhosts.length > 0 ? [...g, ...newGhosts] : g;
        });

        for (const { tab: r } of removed) {
          const timerId = window.setTimeout(() => {
            ghostTimerIds.current.delete(timerId);
            setGhosts((g) => g.filter((x) => x.id !== r.id));
          }, REMOVE_DURATION);
          ghostTimerIds.current.add(timerId);
        }
      }
    }

    prevTabsRef.current = tabs;
  }, [tabs]);

  // ===== ② ＋ ボタン移動 FLIP =====
  // tabs の id 列が変わった時（追加/削除）に ＋ ボタンの x 位置をグライドさせる。
  // Why FLIP: CSS transition だけでは「スクロールコンテナ内の絶対 x 移動」を補間できない。
  // First: signature 変化前に ＋ の rect を記録。
  // Last: useLayoutEffect で現在の rect を取得。
  // Invert+Play: translateX 差分 → RAF で transition 付きリセット。
  //
  // 新規追加タブは tabAppear（enter アニメ）のみ担当、FLIP 対象外（old rect なし = skip）。

  /** ＋ ボタンの DOM ノード ref */
  const newBtnRef = useRef<HTMLButtonElement | null>(null);

  /** 前回の ＋ ボタン rect（First フェーズで記録） */
  const prevNewBtnRect = useRef<DOMRect | null>(null);

  /** 進行中の ＋ FLIP アニメーション状態（再入防止ガード用 + unmount cleanup 用） */
  const pendingFlip = useRef<PendingFLIP | null>(null);

  /** タブ id 列の signature（構造変化検知用） */
  const tabSignature = tabs.map((t) => t.id).join("|");

  // First フェーズ: useLayoutEffect の末尾で次回用 rect を保存する。
  // useLayoutEffect の外（render 中）で记録すると「レンダー前の古い rect」が取れるため、
  // 前回の useLayoutEffect 末尾での保存パターンを踏襲する（ScriptEditor の useFLIP と同方式）。

  useLayoutEffect(() => {
    // === 再入防止ガード ===
    // 素早い操作で前回の RAF/timeout が未完のまま次の useLayoutEffect が走った場合、
    // アニメーション中の x 座標を拾って差分が壊れる。即キャンセルして確定位置に戻す。
    if (pendingFlip.current) {
      const { rafId, timeoutId, els } = pendingFlip.current;
      cancelAnimationFrame(rafId);
      clearTimeout(timeoutId);
      for (const entry of els) {
        entry.el.style.transition = "none";
        entry.el.style.transform = "";
      }
      // 強制 layout flush で確定位置に戻す
      newBtnRef.current?.getBoundingClientRect();
      for (const entry of els) {
        entry.el.style.transition = entry.prevTransition;
      }
      pendingFlip.current = null;
    }

    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const el = newBtnRef.current;

    if (reduced || !el) {
      // reduced モードまたは ref 未設定: rect 記録だけ行って FLIP スキップ
      prevNewBtnRect.current = el ? el.getBoundingClientRect() : null;
      return;
    }

    // === Last フェーズ: 現在の ＋ の rect ===
    const currentRect = el.getBoundingClientRect();
    const prevRect = prevNewBtnRect.current;

    if (prevRect) {
      const dx = prevRect.left - currentRect.left;
      if (Math.abs(dx) >= 1) {
        // === Invert フェーズ: 旧位置に見せかける（transition なしで瞬時に）===
        const prevTransition = el.style.transition;
        el.style.transition = "none";
        el.style.transform = `translateX(${dx}px)`;

        // === Play フェーズ: 次フレームで transform をリセット（transition が発火）===
        // ScriptEditor の useFLIP と同様に既存 transition を連結してから上書きする。
        // これにより glide 中に hover しても color/background の transition が途切れない（L7 修正）。
        const rafId = requestAnimationFrame(() => {
          const baseTransition = prevTransition ? `${prevTransition}, ` : "";
          el.style.transition = `${baseTransition}transform 220ms var(--ease-out)`;
          el.style.transform = "";
          const timeoutId = window.setTimeout(() => {
            el.style.transition = prevTransition;
            el.style.transform = "";
            pendingFlip.current = null;
          }, 220 + 16);
          // RAF コールバック内で timeoutId が確定するため pending を更新する
          if (pendingFlip.current) pendingFlip.current.timeoutId = timeoutId;
        });
        pendingFlip.current = {
          rafId,
          timeoutId: -1 as unknown as ReturnType<typeof window.setTimeout>,
          els: [{ el, prevTransition }],
        };
      }
    }

    // 次回 First 用に現在の rect を保存
    prevNewBtnRect.current = currentRect;
  }, [tabSignature]); // 構造変化時のみ実行（テキスト編集では走らない）

  // unmount 時に FLIP タイマー（rafId / timeoutId）を確実にキャンセルする（M3 修正）。
  // ゴーストタイマーは別の useEffect で cleanup 済み。
  useEffect(() => {
    return () => {
      if (pendingFlip.current) {
        const { rafId, timeoutId } = pendingFlip.current;
        cancelAnimationFrame(rafId);
        clearTimeout(timeoutId);
        pendingFlip.current = null;
      }
    };
  }, []);

  // タブリストのスクロールコンテナへの ref
  const trackRef = useRef<HTMLDivElement>(null);

  // ===== レンダリスト: 現行 tabs にゴーストを元インデックス順で差し込む =====
  // ゴーストを「消えた位置」に挿入することで、中間タブ削除時も末尾ではなく
  // 元の位置にゴーストが出る（C1 根治）。
  // マージ方針:
  //   1. ベース配列は現行 tabs（実タブ）のコピー。
  //   2. ゴーストを index 昇順にソートして splice 挿入。
  //      昇順で挿入すると先頭側の挿入が後ろのインデックスをずらすため、
  //      挿入のたびにオフセットを +1 する。
  //   3. ghost の index は prevTabs 内の位置なので、現行 tabs の長さ + 既挿入数でクランプする。
  type RenderItem = { kind: "tab"; tab: TabEntry; idx: number } | { kind: "ghost"; ghost: GhostTab };

  const mergedList: RenderItem[] = tabs.map((tab, idx) => ({ kind: "tab" as const, tab, idx }));
  const sortedGhosts = [...ghosts].sort((a, b) => a.index - b.index);
  let insertOffset = 0;
  for (const ghost of sortedGhosts) {
    const insertAt = Math.min(ghost.index + insertOffset, mergedList.length);
    mergedList.splice(insertAt, 0, { kind: "ghost" as const, ghost });
    insertOffset++;
  }

  return (
    <div className={styles.tabsRow}>
      {/* スクロールコンテナ */}
      <div className={styles.tabsTrack} ref={trackRef}>
        <div className={styles.tabList} role="tablist" aria-label="プロジェクトタブ">
          {mergedList.map((item) => {
            if (item.kind === "ghost") {
              // ④ 退場ゴースト: tabs から消えたタブの元の位置にゴーストをレンダーし退場アニメを再生。
              // aria-hidden: ゴーストは視覚演出のみ。アクセシビリティツリーには不要。
              // key に "ghost-<id>" を使うことで実タブの key と衝突しない。
              // useLayoutEffect でゴーストを生成するため削除と同フレームで DOM に出現し、
              // FLIP 測定時にゴーストが全幅で存在する（＋ の二重移動を防ぐ）。
              return (
                <div key={`ghost-${item.ghost.id}`} className={styles.tabGhost} aria-hidden="true">
                  <span className={styles.tabName}>{item.ghost.name}</span>
                  <span className={styles.closeBtnGhost}>×</span>
                </div>
              );
            }

            const { tab, idx } = item;
            const isActive = tab.id === activeId;
            const isEditing = editingId === tab.id;

            return (
              // tabItemEnter クラスは全タブに無条件付与される。
              // ただし key が tab.id で安定しているため、React は既存タブを再 mount せず
              // tabAppear アニメーションは DOM が新規 mount された時（タブ追加時）にのみ発火する。
              <div
                key={tab.id}
                className={`${styles.tabItem} ${isActive ? styles.tabItemActive : ""} ${styles.tabItemEnter}`}
              >
                {isEditing ? (
                  /* インライン編集中: button を描画せず input を li 直下に置く。
                   * <input> を <button role="tab"> の子にすると
                   * インタラクティブ要素のネストになり不正（ARIA 仕様違反）なため、
                   * 編集中は button の代わりに input を直接 tabItem 内に描画する。
                   * 編集完了（Enter/blur）または Esc で通常表示に戻る。
                   */
                  <input
                    className={styles.tabNameInput}
                    aria-label="プロジェクト名を編集"
                    value={editValue}
                    autoFocus
                    onFocus={(e) => e.currentTarget.select()}
                    onChange={(e) => setEditValue(e.target.value)}
                    onBlur={() => commitEdit(tab.id, editValue)}
                    onKeyDown={(e) => handleEditKeyDown(e, tab.id)}
                  />
                ) : (
                  /* 通常表示: タブ本体ボタン（切替 + 矢印/Delete キーナビ）。
                   * role="tab" / aria-selected でスクリーンリーダーに状態を伝える。
                   * onClick の if(!isEditing) ガードと input 側 stopPropagation の代わりに、
                   * 編集時は button 自体を描画しないことで競合を根本回避。
                   */
                  <button
                    ref={isActive ? activeTabRef : null}
                    role="tab"
                    aria-selected={isActive}
                    tabIndex={isActive ? 0 : -1}
                    className={styles.tabBtn}
                    onClick={() => onSwitch(tab.id)}
                    onKeyDown={(e) => handleTabKeyDown(e, tab, idx)}
                    title={tab.name}
                  >
                    {/* ダブルクリックで編集モードへ。
                     *  span に title を付けない: button の title={tab.name} が
                     *  長名のホバー表示（フルネーム tooltip）を担うため、
                     *  span に別の title を重ねると上書きされてしまう（#5 修正）。
                     */}
                    <span
                      className={styles.tabName}
                      onDoubleClick={(e) => {
                        e.stopPropagation();
                        startEdit(tab.id, tab.name);
                      }}
                    >
                      {tab.name}
                    </span>
                  </button>
                )}

                {/* × 閉じボタン。
                 *  ③ reveal: 既定で opacity:0 + visibility:hidden（レイアウトは保持）。
                 *     tabItem を hover または :focus-within で opacity:1 に遷移する（CSS）。
                 *     最後の1タブでは disabled + closeBtnHidden（visibility:hidden 維持）のまま。
                 *  tabIndex=-1 で Tab フォーカスは当たらない。Delete キーでの閉じは
                 *  タブ本体ボタンの handleTabKeyDown が担う（上記参照）。
                 */}
                <button
                  type="button"
                  className={`${styles.closeBtn} ${isSingle ? styles.closeBtnHidden : styles.closeBtnReveal}`}
                  aria-label={`${tab.name} を閉じる`}
                  disabled={isSingle}
                  tabIndex={-1}
                  onClick={(e) => {
                    e.stopPropagation();
                    if (!isSingle) onClose(tab.id);
                  }}
                >
                  ×
                </button>
              </div>
            );
          })}

          {/* ① ＋ 新規ボタン: タブリスト内に配置し、最後のタブの直後に並ぶ。
           * 少数タブ時は最後のタブにくっつき、タブ増減時は ＋ が FLIP でグライドする。
           * タブが増えてオーバーフローした場合は tabsTrack と一緒にスクロールする。
           * .newBtnPlus: aria-hidden の装飾 span。hover で 90度回転（.plus と同パターン）。
           */}
          <button
            ref={newBtnRef}
            type="button"
            className={styles.newBtn}
            aria-label="新しいプロジェクト"
            onClick={onNew}
          >
            <span className={styles.newBtnPlus} aria-hidden="true">
              ＋
            </span>
          </button>
        </div>
      </div>
    </div>
  );
}
