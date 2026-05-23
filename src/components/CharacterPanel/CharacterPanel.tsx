// src/components/CharacterPanel/CharacterPanel.tsx
import { useState, useCallback, type ChangeEvent } from "react";
import type { Character } from "../../types";
import styles from "./CharacterPanel.module.css";

export type CharacterPanelProps = {
  characters: Character[];
  onAdd: (name: string) => void;
  onDelete: (id: string) => void;
};

export function CharacterPanel({ characters, onAdd, onDelete }: CharacterPanelProps) {
  const [name, setName] = useState("");
  // 最後の1キャラは削除不可（孤児 Line 防止。useProject.deleteCharacter と同じ制約を UI でも保証）。
  const canDelete = characters.length > 1;

  // ===== 削除アニメーション制御 (item 4) =====
  // removingIds: 退場アニメーション中のキャラ ID のセット。
  // 削除ボタン押下 → ID を removingIds に追加 → アニメーション終了後 → onDelete 呼び出し。
  // Why Set ではなく Record: Set の参照更新が shallow copy でも動作するが、
  // Record<string, true> はスプレッドで immutable 更新しやすい（テスト互換）。
  const [removingIds, setRemovingIds] = useState<Record<string, true>>({});

  // handleDelete: ガード付き削除要求。
  //   1. 最後の1人は onDelete を呼ばない（disabled ガードと二重防衛）。
  //   2. removingIds に追加してアニメーション開始。
  //   3. DURATION ms 後に onDelete を呼ぶ（CSS アニメと同期）。
  // prefers-reduced-motion チェックにより reduced モードでは即時削除。
  const REMOVE_DURATION = 180; // ms — CSS animation duration と一致させる

  const handleDelete = useCallback((id: string) => {
    if (!canDelete) return;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduced) {
      onDelete(id);
      return;
    }
    setRemovingIds((prev) => ({ ...prev, [id]: true }));
    window.setTimeout(() => {
      onDelete(id);
      // removingIds のクリーンアップは onDelete 後に characters が更新されると
      // そのキャラが list から消えるため、state のクリーンアップは省略可能だが
      // 念のため実施して stale state を防ぐ。
      setRemovingIds((prev) => {
        const next = { ...prev };
        delete next[id];
        return next;
      });
    }, REMOVE_DURATION);
  }, [canDelete, onDelete]);

  const submit = () => {
    const trimmed = name.trim();
    if (trimmed === "") return;
    onAdd(trimmed);
    setName("");
  };

  return (
    <aside className={styles.sidebar}>
      {/* ===== Panel header ===== */}
      <div className={styles.panelHead}>
        <span>キャラクター</span>
        {/* 件数バッジ: monospaced で数字を等幅表示 */}
        <span className={styles.count}>{characters.length}</span>
      </div>

      {/* ===== Add character form ===== */}
      <form
        className={styles.charAdd}
        onSubmit={(e) => { e.preventDefault(); submit(); }}
      >
        {/* aria-label でスクリーンリーダーと getByRole テストから取得可能にする
            （placeholder は視覚的ヒントとして残す）。 */}
        <input
          className={styles.input}
          aria-label="キャラクター名"
          placeholder="キャラクター名"
          value={name}
          onChange={(e: ChangeEvent<HTMLInputElement>) => setName(e.target.value)}
        />
        {/* アイコンにしても aria-label="追加" でアクセシブル名を保証する */}
        <button type="submit" className={styles.addBtn} aria-label="追加">+</button>
      </form>

      {/* ===== Character list ===== */}
      <ul className={styles.charList} role="list">
        {characters.map((c) => {
          // item 4: 追加 → appear-slide（opacity 0→1 + translateX -6px→0）
          // 削除 → 退場アニメ（opacity→0 + translateX 8px + height collapse）
          const isRemoving = removingIds[c.id] === true;
          const itemClass = isRemoving
            ? `${styles.charItem} ${styles.charItemRemoving}`
            : `${styles.charItem} ${styles.charItemEnter}`;

          return (
            <li key={c.id} className={itemClass}>
              {/* カラードット: style で直接キャラ色を注入。--c-glow はアルファ付きで同色グロー。 */}
              <span
                className={styles.dot}
                style={{
                  background: c.color,
                  // Why: グロー色は同じ hex にアルファを乗せた近似値。
                  // CSS の color-mix() は Baseline 2023 でまだ一部ブラウザ非対応のため inline 変数で対応。
                  ["--c-glow" as string]: c.color + "80",
                }}
                aria-hidden="true"
              />
              <span className={styles.name}>{c.name}</span>
              {/* deleteButton クラスで破壊操作の視覚的アフォーダンス（--danger）を提供する。 */}
              <button
                className={styles.del}
                aria-label={`${c.name} を削除`}
                disabled={!canDelete}
                onClick={() => handleDelete(c.id)}
              >
                ✕
              </button>
            </li>
          );
        })}
      </ul>

      {/* ===== Footer: decorative version badge + hero-pulse dot (linear-app / bg-decoration-family)
       *   aria-hidden: 純粋な装飾。スクリーンリーダーには読まれない。
       *   heroPulseDot: 小さな cyan 脈動ドットで「動作してる感」を演出。
       * ===== */}
      <div className={styles.sidebarFooter} aria-hidden="true">
        <span style={{ display: "flex", alignItems: "center" }}>
          <span className={styles.heroPulseDot} />
          YMM4 Script Editor
        </span>
        <span className={styles.ver}>v0.1</span>
      </div>
    </aside>
  );
}
