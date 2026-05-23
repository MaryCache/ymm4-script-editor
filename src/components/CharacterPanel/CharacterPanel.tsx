// src/components/CharacterPanel/CharacterPanel.tsx
import { useState, type ChangeEvent } from "react";
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
        {characters.map((c) => (
          <li key={c.id} className={styles.charItem}>
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
              onClick={() => onDelete(c.id)}
            >
              ✕
            </button>
          </li>
        ))}
      </ul>

      {/* ===== Footer: decorative version badge ===== */}
      <div className={styles.sidebarFooter} aria-hidden="true">
        <span>YMM4 Script Editor</span>
        <span className={styles.ver}>v0.1</span>
      </div>
    </aside>
  );
}
