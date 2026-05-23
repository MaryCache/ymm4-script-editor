// src/components/LineRow/LineRow.tsx
import { memo, useState, forwardRef, type ChangeEvent } from "react";
import type { Character, Line } from "../../types";
import styles from "./LineRow.module.css";

// ===== count-badge の warn / long 閾値 =====
// Why: 読み上げ字幕の目安。閾値は暫定ヒューリスティック。
//   warn: 字幕が長くなりはじめる目安（YMM4 デフォルト表示行数を参考）。
//   long: 明らかに長すぎる — 字幕テロップが切れる可能性が高い。
//   文字数の表示値そのものは変えない（数値が消えると逆効果）。
const LINE_WARN_CHARS = 25;  // この文字数以上で warn
const LINE_LONG_CHARS = 40;  // この文字数以上で long（warn より優先）

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
  /** 親（App）は useCallback で安定化して渡すこと — memo を効かせるため（NF-10）。 */
  onCopy: (line: Line) => void;
};

// React.memo + forwardRef:
//   memo: props（line/characters/handlers）が参照同値なら再描画をスキップ（NF-10）。
//   forwardRef: ScriptEditor の useFLIP が FLIP アニメーションのために各行の DOM ノードを
//     収集する必要があるため ref forwarding を追加（item 3）。
//     ref は DOM 直接操作専用。LineRow の props / レンダーロジックは変わらない。
//
// Why forwardRef after memo: React.memo(forwardRef(...)) でも
// forwardRef(React.memo(...)) でも動作するが、
// `memo(forwardRef(...))` の方が「memo が外側」なので
// props 変化なし → forwardRef コンポーネント自体がスキップされるため効率が良い。
export const LineRow = memo(forwardRef<HTMLDivElement, LineRowProps>(function LineRow(props, ref) {
  const { line, characters, index, isFirst, isLast } = props;

  // セリフ入力フォーカス中は row に .focused クラスを付与し、視覚的ハイライトを行全体に広げる。
  const [focused, setFocused] = useState(false);

  // キャラ色: 選択中キャラの hex。見つからない場合は transparent（CSS 変数のフォールバック）。
  const color = characters.find((c) => c.id === line.characterId)?.color ?? "transparent";

  // 現在選択中のキャラ名（charDisplay に表示する装飾テキスト）
  const charName = characters.find((c) => c.id === line.characterId)?.name ?? "";

  // count-badge の状態判定
  const len = line.text.length;
  const badgeClass =
    len >= LINE_LONG_CHARS ? `${styles.countBadge} ${styles.long}`
    : len >= LINE_WARN_CHARS ? `${styles.countBadge} ${styles.warn}`
    : styles.countBadge;

  // --char 変数を行ルート要素に注入する style オブジェクト。
  // Why memo-safe: オブジェクトは毎レンダーで新参照になるが、memo の shallow 比較では
  // style は常に異なるオブジェクトとみなされる。ただし color は string primitive なので
  // 同じキャラが選ばれている限り color 文字列は同値 → style の変化は memo 外から来る
  // props(line.characterId 変更)によるものだけ。LineRow の再描画は必要なので許容する。
  const rowStyle = { ["--char" as string]: color };

  const handleFocus = () => setFocused(true);
  const handleBlur  = () => setFocused(false);

  return (
    <div
      ref={ref}
      className={focused ? `${styles.row} ${styles.focused}` : styles.row}
      style={rowStyle}
    >
      {/* 行番号 — 可視テキストは index+1 */}
      <span className={styles.num}>{index + 1}</span>

      {/* ===== Character select =====
       * Why wrapper + native select:
       *   native <select> はブラウザ・スクリーンリーダー・キーボード操作の
       *   標準実装をそのまま使う（a11y 最優先、NF-02 準拠）。
       *   左バーの色バー（::before）と表示名（charDisplay）は wrapper / 装飾要素で対応。
       *   select 自体は opacity: 0 で上に被せてクリックを受け取る。
       */}
      <div className={styles.charSelectWrapper} style={rowStyle}>
        {/* 装飾テキスト — pointer-events: none でクリックを select に透過 */}
        <span className={styles.charDisplay} aria-hidden="true">{charName}</span>
        <select
          className={styles.charSelect}
          aria-label="キャラクター"
          value={line.characterId}
          onChange={(e: ChangeEvent<HTMLSelectElement>) =>
            props.onCharacterChange(line.id, e.target.value)
          }
        >
          {characters.map((c) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>
      </div>

      {/* ===== Dialogue input ===== */}
      <input
        className={styles.dialogue}
        type="text"
        aria-label="セリフ"
        placeholder="セリフを入力…"
        value={line.text}
        onChange={(e: ChangeEvent<HTMLInputElement>) =>
          props.onTextChange(line.id, e.target.value)
        }
        onFocus={handleFocus}
        onBlur={handleBlur}
      />

      {/* ===== Character count badge ===== */}
      <span className={badgeClass}>{line.text.length}</span>

      {/* ===== Action buttons: ホバー時にスライドイン ===== */}
      <div className={styles.actions}>
        <button
          className={styles.action}
          aria-label="上に移動"
          disabled={isFirst}
          onClick={() => props.onMoveUp(line.id)}
        >
          ↑
        </button>
        <button
          className={styles.action}
          aria-label="下に移動"
          disabled={isLast}
          onClick={() => props.onMoveDown(line.id)}
        >
          ↓
        </button>
        <div className={styles.actionsSep} aria-hidden="true" />
        <button
          className={styles.action}
          aria-label="この行をコピー"
          onClick={() => props.onCopy(line)}
        >
          ⧉
        </button>
        <button
          className={styles.action}
          aria-label="直後に行を追加"
          onClick={() => props.onAddAfter(line.id)}
        >
          ＋
        </button>
        <div className={styles.actionsSep} aria-hidden="true" />
        {/* 削除ボタン: 赤系ホバーで破壊操作のアフォーダンスを提供する */}
        <button
          className={`${styles.action} ${styles.actionDel}`}
          aria-label="この行を削除"
          onClick={() => props.onDelete(line.id)}
        >
          ✕
        </button>
      </div>
    </div>
  );
}));
