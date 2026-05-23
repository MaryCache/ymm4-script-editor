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
    <aside className={styles.panel}>
      <h2 className={styles.title}>キャラクター</h2>
      <form className={styles.form} onSubmit={(e) => { e.preventDefault(); submit(); }}>
        {/* aria-label でスクリーンリーダーと getByRole テストから取得可能にする（placeholder は視覚的ヒントとして残す）。 */}
        <input
          aria-label="キャラクター名"
          placeholder="キャラクター名"
          value={name}
          onChange={(e: ChangeEvent<HTMLInputElement>) => setName(e.target.value)}
        />
        <button type="submit">追加</button>
      </form>
      <ul className={styles.list}>
        {characters.map((c) => (
          <li key={c.id} className={styles.item}>
            <span className={styles.chip} style={{ background: c.color }} />
            <span className={styles.name}>{c.name}</span>
            {/* deleteButton クラスで破壊操作の視覚的アフォーダンス（--color-danger）を提供する。 */}
            <button
              className={styles.deleteButton}
              aria-label={`${c.name} を削除`}
              disabled={!canDelete}
              onClick={() => onDelete(c.id)}
            >✕</button>
          </li>
        ))}
      </ul>
    </aside>
  );
}
