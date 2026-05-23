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
    <section className={styles.main} aria-label="台本エディター">
      {/* ===== Editor header ===== */}
      <div className={styles.editorHead}>
        <div className={styles.editorHeadLeft}>
          <span className={styles.editorTitle}>台本</span>
          <div className={styles.statGroup}>
            {/* 合計文字数: テストが /合計文字数:\s*N/ で getByText するため単一要素で保持する。
                span 等で数値を分割しない（Why コメント: ScriptEditor.test.tsx, App.test.tsx 参照）。 */}
            <span className={styles.stat}>合計文字数: {total}文字</span>
          </div>
          {/* イコライザ波形 — 純粋装飾。aria-hidden で AT に読ませない。 */}
          <div className={styles.waveform} aria-hidden="true">
            <span /><span /><span /><span /><span /><span />
          </div>
        </div>
      </div>

      {/* ===== Lines scroll ===== */}
      <div className={styles.linesScroll}>
        <div className={styles.lines}>
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

          {/* 行追加ボタン: 破線ボーダー + ホバー時ソリッドに変化 */}
          <button
            className={styles.addRow}
            disabled={!canAdd}
            onClick={props.onAddLine}
            aria-label="+ 行を追加"
          >
            <span className={styles.plus} aria-hidden="true">+</span>
            + 行を追加
          </button>
        </div>
      </div>
    </section>
  );
}
