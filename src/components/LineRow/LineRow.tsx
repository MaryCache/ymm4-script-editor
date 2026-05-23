// src/components/LineRow/LineRow.tsx
import { memo, type ChangeEvent } from "react";
import type { Character, Line } from "../../types";
import styles from "./LineRow.module.css";

export type LineRowProps = {
  line: Line;
  characters: Character[];
  index: number;
  isFirst: boolean;
  isLast: boolean;
  onCharacterChange: (lineId: string, characterId: string) => void;
  onTextChange: (lineId: string, text: string) => void;
  onMoveUp: (lineId: string) => void;
  onMoveDown: (lineId: string) => void;
  onAddAfter: (lineId: string) => void;
  onDelete: (lineId: string) => void;
  onCopy: (line: Line) => void;
};

// React.memo: props（line/characters/handlers）が参照同値なら再描画をスキップ。
// useProject が「変わらない line・characters の参照を保つ」設計＋ App が安定ハンドラを渡す
// ことで、500行中1行の編集で他行が再描画されない（NF-10）。
export const LineRow = memo(function LineRow(props: LineRowProps) {
  const { line, characters, index, isFirst, isLast } = props;
  const color = characters.find((c) => c.id === line.characterId)?.color ?? "transparent";

  return (
    <div className={styles.row} style={{ borderLeftColor: color }}>
      <span className={styles.num}>{index + 1}</span>
      <select
        className={styles.select}
        aria-label="キャラクター"
        value={line.characterId}
        onChange={(e: ChangeEvent<HTMLSelectElement>) => props.onCharacterChange(line.id, e.target.value)}
      >
        {characters.map((c) => (
          <option key={c.id} value={c.id}>{c.name}</option>
        ))}
      </select>
      <input
        className={styles.text}
        type="text"
        aria-label="セリフ"
        value={line.text}
        onChange={(e: ChangeEvent<HTMLInputElement>) => props.onTextChange(line.id, e.target.value)}
      />
      <span className={styles.count}>{line.text.length}</span>
      <div className={styles.actions}>
        <button aria-label="上に移動" disabled={isFirst} onClick={() => props.onMoveUp(line.id)}>↑</button>
        <button aria-label="下に移動" disabled={isLast} onClick={() => props.onMoveDown(line.id)}>↓</button>
        <button aria-label="この行をコピー" onClick={() => props.onCopy(line)}>⧉</button>
        <button aria-label="直後に行を追加" onClick={() => props.onAddAfter(line.id)}>＋</button>
        <button aria-label="この行を削除" onClick={() => props.onDelete(line.id)}>✕</button>
      </div>
    </div>
  );
});
