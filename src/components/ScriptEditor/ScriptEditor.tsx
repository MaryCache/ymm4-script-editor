// src/components/ScriptEditor/ScriptEditor.tsx
import type { Character, Line } from "../../types";
import { LineRow } from "../LineRow/LineRow";
import styles from "./ScriptEditor.module.css";

export type ScriptEditorProps = {
  characters: Character[];
  lines: Line[];
  onAddLine: () => void;
  onCharacterChange: (lineId: string, characterId: string) => void;
  onTextChange: (lineId: string, text: string) => void;
  onMoveUp: (lineId: string) => void;
  onMoveDown: (lineId: string) => void;
  onAddAfter: (lineId: string) => void;
  onDelete: (lineId: string) => void;
  onCopy: (line: Line) => void;
};

export function ScriptEditor(props: ScriptEditorProps) {
  const total = props.lines.reduce((sum, l) => sum + l.text.length, 0);
  // キャラが0人のとき行追加を無効化（選択肢がないため。ScriptEditor 側でも UI 制約を明示）。
  const canAdd = props.characters.length > 0;

  // aria-label で名前付き region として AT に認識させる（landmark ナビゲーション対応）。
  return (
    <section className={styles.editor} aria-label="台本エディター">
      <div className={styles.bar}>合計文字数: {total}文字</div>
      <div className={styles.list}>
        {props.lines.map((line, i) => (
          <LineRow
            key={line.id}
            line={line}
            characters={props.characters}
            index={i}
            isFirst={i === 0}
            isLast={i === props.lines.length - 1}
            onCharacterChange={props.onCharacterChange}
            onTextChange={props.onTextChange}
            onMoveUp={props.onMoveUp}
            onMoveDown={props.onMoveDown}
            onAddAfter={props.onAddAfter}
            onDelete={props.onDelete}
            onCopy={props.onCopy}
          />
        ))}
      </div>
      <button className={styles.add} disabled={!canAdd} onClick={props.onAddLine}>+ 行を追加</button>
    </section>
  );
}
