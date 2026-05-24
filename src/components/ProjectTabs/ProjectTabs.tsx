// src/components/ProjectTabs/ProjectTabs.tsx
import { useState, useCallback, useRef, type KeyboardEvent } from "react";
import styles from "./ProjectTabs.module.css";

/**
 * タブエントリの型。
 *
 * @remarks
 * `isEmpty` は `lines.length === 0` の導出値。
 * 閉じる前に中身があるかどうかを UI 側で判断するために使用する（F-113）。
 */
export type TabEntry = {
  /** エントリの一意 ID。 */
  id: string;
  /** プロジェクト名（タブに表示する）。 */
  name: string;
  /**
   * 台本が空（行が0件）かどうか。
   *
   * @remarks
   * `true` のとき × 閉じは確認なしで即実行。
   * `false` のとき App 側で ConfirmDialog を開く（F-113）。
   */
  isEmpty: boolean;
};

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

/**
 * プロジェクトタブ行コンポーネント。
 *
 * @remarks
 * - ヘッダー直下に横並びタブ行（`role="tablist"`）を描画する。
 * - 各タブ（`role="tab"`）にプロジェクト名と × 閉じボタンを持つ。
 * - 最後の1タブでは × を disabled にする（F-114）。
 * - タブ名ダブルクリックでインライン編集（CharacterPanel と同パターン）。
 *   Enter/blur で確定、Esc でキャンセル（F-116）。
 * - 右端に「＋」新規ボタン（F-111）。
 * - タブが多い場合は横スクロール可能（F-115）。
 * - アクティブタブが見えるよう `scrollIntoView` を呼ぶ。
 * - 矢印キーでタブ間を移動する（ARIA tablist keyboard a11y）。
 * - `prefers-reduced-motion: reduce` でアニメーションを簡素化（§7.1）。
 *
 * @param props - {@link ProjectTabsProps}
 */
export function ProjectTabs({ tabs, activeId, onSwitch, onNew, onClose, onRename }: ProjectTabsProps) {
  const isSingle = tabs.length <= 1;

  // ===== インライン編集（CharacterPanel と同パターン）=====
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");

  const startEdit = useCallback((id: string, currentName: string) => {
    setEditingId(id);
    setEditValue(currentName);
  }, []);

  const commitEdit = useCallback(
    (id: string, value: string) => {
      setEditingId(null);
      // trim 後が空の場合は onRename に渡さない（useProject 側でも no-op だが UI 側でもガード）
      const trimmed = value.trim();
      if (trimmed !== "") {
        onRename(id, trimmed);
      }
    },
    [onRename],
  );

  const cancelEdit = useCallback(() => {
    setEditingId(null);
  }, []);

  const handleEditKeyDown = useCallback(
    (e: KeyboardEvent<HTMLInputElement>, id: string) => {
      if (e.key === "Enter") {
        e.preventDefault();
        commitEdit(id, editValue);
      } else if (e.key === "Escape") {
        e.preventDefault();
        cancelEdit();
      }
    },
    [commitEdit, cancelEdit, editValue],
  );

  // ===== アクティブタブの scrollIntoView =====
  // jsdom 環境（テスト）では scrollIntoView が未実装なため optional call でガードする。
  const activeTabRef = useCallback((node: HTMLButtonElement | null) => {
    if (node) {
      node.scrollIntoView?.({ block: "nearest", inline: "nearest" });
    }
  }, []);

  // ===== 矢印キーナビゲーション（ARIA tablist パターン）=====
  const handleTabKeyDown = useCallback(
    (e: KeyboardEvent<HTMLButtonElement>, currentIdx: number) => {
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
      }
    },
    [tabs, onSwitch],
  );

  // タブリストのスクロールコンテナへの ref（任意: ホイール横スクロール対応）
  const trackRef = useRef<HTMLDivElement>(null);

  return (
    <div className={styles.tabsRow}>
      {/* スクロールコンテナ */}
      <div className={styles.tabsTrack} ref={trackRef}>
        <div className={styles.tabList} role="tablist" aria-label="プロジェクトタブ">
          {tabs.map((tab, idx) => {
            const isActive = tab.id === activeId;
            const isEditing = editingId === tab.id;

            return (
              <div
                key={tab.id}
                className={`${styles.tabItem} ${isActive ? styles.tabItemActive : ""} ${styles.tabItemEnter}`}
              >
                {/* タブ本体ボタン（切替 + 矢印キーナビ）。
                 *  isEditing 時は pointer-events: none にして input が全面を取る。
                 *  role="tab" / aria-selected でスクリーンリーダーに状態を伝える。
                 */}
                <button
                  ref={isActive ? activeTabRef : null}
                  role="tab"
                  aria-selected={isActive}
                  tabIndex={isActive ? 0 : -1}
                  className={styles.tabBtn}
                  onClick={() => {
                    if (!isEditing) onSwitch(tab.id);
                  }}
                  onKeyDown={(e) => handleTabKeyDown(e, idx)}
                  title={tab.name}
                >
                  {isEditing ? (
                    /* インライン編集中: input を表示 */
                    <input
                      className={styles.tabNameInput}
                      aria-label="プロジェクト名を編集"
                      value={editValue}
                      autoFocus
                      onFocus={(e) => e.currentTarget.select()}
                      onChange={(e) => setEditValue(e.target.value)}
                      onBlur={() => commitEdit(tab.id, editValue)}
                      onKeyDown={(e) => {
                        // Enter/Esc はフォーカスをタブ内に閉じる（stopPropagation で tabBtn の onKeyDown と競合しない）
                        e.stopPropagation();
                        handleEditKeyDown(e, tab.id);
                      }}
                    />
                  ) : (
                    /* 通常表示: ダブルクリックで編集モードへ */
                    <span
                      className={styles.tabName}
                      onDoubleClick={(e) => {
                        e.stopPropagation();
                        startEdit(tab.id, tab.name);
                      }}
                      title="ダブルクリックでプロジェクト名を編集"
                    >
                      {tab.name}
                    </span>
                  )}
                </button>

                {/* × 閉じボタン。
                 *  最後の1タブでは disabled + aria-hidden（見せない）。
                 *  タブ切替と競合しないよう stopPropagation。
                 */}
                <button
                  type="button"
                  className={`${styles.closeBtn} ${isSingle ? styles.closeBtnHidden : ""}`}
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
        </div>
      </div>

      {/* 「＋」新規プロジェクトボタン */}
      <button type="button" className={styles.newBtn} aria-label="新しいプロジェクト" onClick={onNew}>
        ＋
      </button>
    </div>
  );
}
