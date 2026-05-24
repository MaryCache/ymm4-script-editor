// src/components/LineRow/LineRow.tsx
import {
  memo,
  useState,
  useRef,
  useEffect,
  forwardRef,
  type ChangeEvent,
  type KeyboardEvent as ReactKeyboardEvent,
} from "react";
import type { Character, Line } from "../../types";
import styles from "./LineRow.module.css";

// ===== count-badge の warn / long 閾値 =====
// Why: 読み上げ字幕の目安。閾値は暫定ヒューリスティック。
//   warn: 字幕が長くなりはじめる目安（YMM4 デフォルト表示行数を参考）。
//   long: 明らかに長すぎる — 字幕テロップが切れる可能性が高い。
//   文字数の表示値そのものは変えない（数値が消えると逆効果）。
const LINE_WARN_CHARS = 25; // この文字数以上で warn
const LINE_LONG_CHARS = 40; // この文字数以上で long（warn より優先）

/**
 * `LineRow` コンポーネントの props 型。
 *
 * @remarks
 * `memo` + `forwardRef` を使う都合上、props 型を外部に export して
 * 呼び出し元が型安全に構築できるようにする。
 *
 * @see {@link LineRow}
 */
export type LineRowProps = {
  /** この行が表すセリフデータ。 */
  line: Line;
  /** キャラクタードロップダウンの選択肢として使うキャラクター一覧。 */
  characters: Character[];
  /** 行番号（0 始まり）。表示は `index + 1`。 */
  index: number;
  /** 先頭行かどうか（「上に移動」ボタンの `disabled` 制御）。 */
  isFirst: boolean;
  /** 末尾行かどうか（「下に移動」ボタンの `disabled` 制御）。 */
  isLast: boolean;
  /**
   * キャラクター変更コールバック。
   *
   * @param lineId - 変更対象の行 ID
   * @param characterId - 新しいキャラクター ID
   */
  onCharacterChange: (lineId: string, characterId: string) => void;
  /**
   * テキスト変更コールバック。
   *
   * @param lineId - 変更対象の行 ID
   * @param text - 新しいテキスト
   */
  onTextChange: (lineId: string, text: string) => void;
  /**
   * 「上に移動」コールバック。
   *
   * @param lineId - 移動対象の行 ID
   */
  onMoveUp: (lineId: string) => void;
  /**
   * 「下に移動」コールバック。
   *
   * @param lineId - 移動対象の行 ID
   */
  onMoveDown: (lineId: string) => void;
  /**
   * 「直後に行を追加」コールバック。
   *
   * @param lineId - 基準となる行 ID
   */
  onAddAfter: (lineId: string) => void;
  /**
   * 「この行を削除」コールバック。
   *
   * @param lineId - 削除対象の行 ID
   */
  onDelete: (lineId: string) => void;
  /**
   * 「この行をコピー」コールバック。
   *
   * @remarks
   * 親（`App`）は `useCallback` で安定化して渡すこと — `memo` を効かせるため（NF-10）。
   *
   * @param line - コピー対象の行データ
   */
  /** 親（App）は useCallback で安定化して渡すこと — memo を効かせるため（NF-10）。 */
  onCopy: (line: Line) => void;
};

// ===== 独自キャラクタードロップダウン (item 4) =====
// アクセシブルな listbox パターン。
// - トグル: button[aria-haspopup="listbox"][aria-expanded]
// - ポップアップ: ul[role="listbox"] aria-label="キャラクター選択"
//   Why ul/li: div[role=option] より ul[role=listbox]+li[role=option] の方が
//   AT（支援技術）との相互運用性が高い（ARIA in HTML 勧告に基づく）。
// - 各項目: li[role="option"] aria-selected
// - キーボード: Enter/Space 開閉、↑↓ 移動、Enter 確定、Escape 閉じる、Tab は自然な移動
// - open 状態は LineRow 内 local state（NF-10: 他行に波及しない）
// - 外側クリックで閉じる（useOutsideClick 相当、標準 blur で対応）

type CharDropdownProps = {
  lineId: string;
  characterId: string;
  characters: Character[];
  onCharacterChange: (lineId: string, charId: string) => void;
  rowStyle: React.CSSProperties;
};

function CharDropdown({ lineId, characterId, characters, onCharacterChange, rowStyle }: CharDropdownProps) {
  const [open, setOpen] = useState(false);
  // focusedIndex: ↑↓ キーで移動するフォーカス位置（-1 は未フォーカス）
  const [focusedIndex, setFocusedIndex] = useState(-1);
  const toggleRef = useRef<HTMLButtonElement>(null);
  const listRef = useRef<HTMLUListElement>(null);

  const selectedChar = characters.find((c) => c.id === characterId);
  const selectedColor = selectedChar?.color ?? "transparent";
  const selectedName = selectedChar?.name ?? "";

  // 開く: focusedIndex を選択中の index に合わせる
  const openDropdown = () => {
    const idx = characters.findIndex((c) => c.id === characterId);
    setFocusedIndex(idx >= 0 ? idx : 0);
    setOpen(true);
  };

  const closeDropdown = () => {
    setOpen(false);
    setFocusedIndex(-1);
    // トグルボタンにフォーカスを戻す
    toggleRef.current?.focus();
  };

  const selectChar = (charId: string) => {
    onCharacterChange(lineId, charId);
    closeDropdown();
  };

  // 外側クリックで閉じる
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (!toggleRef.current?.contains(e.target as Node) && !listRef.current?.contains(e.target as Node)) {
        setOpen(false);
        setFocusedIndex(-1);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  // 開いたら focusedIndex の option にフォーカスを移す
  useEffect(() => {
    if (!open || focusedIndex < 0) return;
    const items = listRef.current?.querySelectorAll<HTMLElement>("[role='option']");
    items?.[focusedIndex]?.focus();
  }, [open, focusedIndex]);

  // トグルのキーボード操作
  const handleToggleKeyDown = (e: ReactKeyboardEvent<HTMLButtonElement>) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      if (open) {
        closeDropdown();
      } else {
        openDropdown();
      }
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      if (!open) {
        openDropdown();
      }
    } else if (e.key === "Escape") {
      if (open) {
        e.stopPropagation();
        closeDropdown();
      }
    }
  };

  // リスト項目のキーボード操作
  const handleOptionKeyDown = (e: ReactKeyboardEvent<HTMLElement>, idx: number) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      const next = Math.min(idx + 1, characters.length - 1);
      setFocusedIndex(next);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      const prev = Math.max(idx - 1, 0);
      setFocusedIndex(prev);
    } else if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      const char = characters[idx];
      if (char) selectChar(char.id);
    } else if (e.key === "Escape") {
      e.preventDefault();
      closeDropdown();
    } else if (e.key === "Tab") {
      // Tab はキーボードトラップを避けるため preventDefault しない（WCAG 2.1.2）。
      // フォーカスは自然に次要素へ移動し、ドロップダウンだけ閉じる。
      closeDropdown();
    }
  };

  return (
    <div className={styles.charSelectWrapper} style={rowStyle}>
      {/* キャラ色の左バー: wrapper の ::before で描画（既存スタイル流用） */}
      {/* トグルボタン: aria-haspopup="listbox" aria-expanded */}
      <button
        ref={toggleRef}
        className={styles.charToggleBtn}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label="キャラクター"
        type="button"
        onClick={() => {
          if (open) {
            closeDropdown();
          } else {
            openDropdown();
          }
        }}
        onKeyDown={handleToggleKeyDown}
      >
        {/* 色ドット */}
        <span className={styles.charDot} style={{ background: selectedColor }} aria-hidden="true" />
        {/* キャラ名 */}
        <span className={styles.charDisplay}>{selectedName}</span>
        {/* シェブロン ▼ */}
        <span className={`${styles.charChevron} ${open ? styles.charChevronOpen : ""}`} aria-hidden="true">
          ▼
        </span>
      </button>

      {/* ポップアップリスト: ul/li で AT 相互運用性を確保（ARIA in HTML 勧告準拠） */}
      {open && (
        <ul ref={listRef} role="listbox" aria-label="キャラクター選択" className={styles.charListbox}>
          {characters.map((c, idx) => (
            <li
              key={c.id}
              role="option"
              aria-selected={c.id === characterId}
              className={`${styles.charOption} ${c.id === characterId ? styles.charOptionSelected : ""}`}
              tabIndex={-1}
              onClick={() => selectChar(c.id)}
              onKeyDown={(e) => handleOptionKeyDown(e, idx)}
            >
              <span className={styles.charDot} style={{ background: c.color }} aria-hidden="true" />
              <span>{c.name}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

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

/**
 * 台本の1行（セリフ行）を表示・編集する行コンポーネント。
 *
 * @remarks
 * `React.memo` + `forwardRef` の組み合わせで実装する。
 *
 * - `memo`: `line` / `characters` / ハンドラーが参照同値なら再描画をスキップ（要件 NF-10）。
 *   そのため呼び出し元（`App`）はすべてのハンドラーを `useCallback` で安定化すること。
 * - `forwardRef`: `ScriptEditor` の FLIP アニメーション（`useFLIP`）が各行の DOM ノードを
 *   収集するために必要（ref は DOM 操作専用。`LineRow` の props / レンダーロジックは変わらない）。
 *
 * 文字数バッジ:
 * - `LINE_WARN_CHARS`（25文字）以上で warn 色、`LINE_LONG_CHARS`（40文字）以上で long 色。
 * - 値そのものは常に表示する（数値が消えると逆効果）。
 *
 * @param props - {@link LineRowProps}
 * @param ref - `ScriptEditor` の FLIP が DOM 直接操作に使う ref
 */
export const LineRow = memo(
  forwardRef<HTMLDivElement, LineRowProps>(function LineRow(props, ref) {
    const { line, characters, index, isFirst, isLast } = props;

    // セリフ入力フォーカス中は row に .focused クラスを付与し、視覚的ハイライトを行全体に広げる。
    const [focused, setFocused] = useState(false);

    // キャラ色: 選択中キャラの hex。見つからない場合は transparent（CSS 変数のフォールバック）。
    const color = characters.find((c) => c.id === line.characterId)?.color ?? "transparent";

    // count-badge の状態判定
    const len = line.text.length;
    const badgeClass =
      len >= LINE_LONG_CHARS
        ? `${styles.countBadge} ${styles.long}`
        : len >= LINE_WARN_CHARS
          ? `${styles.countBadge} ${styles.warn}`
          : styles.countBadge;

    // --char 変数を行ルート要素に注入する style オブジェクト。
    // Why memo-safe: オブジェクトは毎レンダーで新参照になるが、memo の shallow 比較では
    // style は常に異なるオブジェクトとみなされる。ただし color は string primitive なので
    // 同じキャラが選ばれている限り color 文字列は同値 → style の変化は memo 外から来る
    // props(line.characterId 変更)によるものだけ。LineRow の再描画は必要なので許容する。
    const rowStyle = { ["--char" as string]: color };

    const handleFocus = () => setFocused(true);
    const handleBlur = () => setFocused(false);

    return (
      <div ref={ref} className={focused ? `${styles.row} ${styles.focused}` : styles.row} style={rowStyle}>
        {/* 行番号 — 可視テキストは index+1 */}
        <span className={styles.num}>{index + 1}</span>

        {/* ===== Character dropdown (item 4: 独自アクセシブルドロップダウン) =====
         * CharDropdown コンポーネント: listbox パターン。
         * open 状態は LineRow 内 local state（NF-10: 他行に波及しない）。
         * CharDropdown 内で open 管理するため、LineRow は rowStyle を渡すだけ。
         */}
        <CharDropdown
          lineId={line.id}
          characterId={line.characterId}
          characters={characters}
          onCharacterChange={props.onCharacterChange}
          rowStyle={rowStyle}
        />

        {/* ===== Dialogue input ===== */}
        <input
          className={styles.dialogue}
          type="text"
          aria-label="セリフ"
          placeholder="セリフを入力…"
          value={line.text}
          onChange={(e: ChangeEvent<HTMLInputElement>) => props.onTextChange(line.id, e.target.value)}
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
          <button className={styles.action} aria-label="この行をコピー" onClick={() => props.onCopy(line)}>
            ⧉
          </button>
          <button className={styles.action} aria-label="直後に行を追加" onClick={() => props.onAddAfter(line.id)}>
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
  }),
);
