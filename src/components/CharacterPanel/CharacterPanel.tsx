// src/components/CharacterPanel/CharacterPanel.tsx
import {
  useState,
  useCallback,
  useEffect,
  useRef,
  type ChangeEvent,
  type CSSProperties,
  type KeyboardEvent,
} from "react";
import { createPortal } from "react-dom";
import type { Character } from "../../types";
import { ColorWheel } from "../ColorWheel";
import styles from "./CharacterPanel.module.css";

// ColorWheel ポップオーバーの概算サイズ（クランプ計算用）。
// HSV カラーサークル版: width=236px (container.width)、height=292px 概算
// （padding 32 + ring 200 + gap 14 + hexRow 30 + gap 14 + padding 2 = 292）。
const WHEEL_W = 236;
const WHEEL_H = 292;

// ドットの矩形を基準に、画面内に収まるポップオーバー位置を返す。
// Why fixed + portal: サイドバー（.panel/.charList）が overflow:hidden/auto のため、
// 絶対配置のポップオーバーは親にクリップされて隠れる。body 直下へ portal し fixed で
// ビューポート基準に置くことで overflow を脱出する。
function popoverStyle(anchor: DOMRect): CSSProperties {
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  // 基本はドットの右側に出す。右に入りきらなければ左側へ。
  let left = anchor.right + 10;
  if (left + WHEEL_W > vw - 8) left = Math.max(8, anchor.left - WHEEL_W - 10);
  // 縦はドット上端に合わせ、下にはみ出すなら上方向へ寄せる。
  const top = Math.max(8, Math.min(anchor.top, vh - WHEEL_H - 8));
  return { position: "fixed", left, top, zIndex: 1200 };
}

/**
 * `CharacterPanel` コンポーネントの props 型。
 *
 * @see {@link CharacterPanel}
 */
export type CharacterPanelProps = {
  /** 現在登録されているキャラクター一覧。 */
  characters: Character[];
  /**
   * キャラクター追加要求のコールバック。
   *
   * @param name - 追加するキャラクター名（trim 済みの空文字は呼ばれない）
   */
  onAdd: (name: string) => void;
  /**
   * キャラクター削除要求のコールバック。
   *
   * @remarks
   * 最後の1キャラクターは `disabled` 状態のため呼ばれないが、
   * `useProject.deleteCharacter` 側でも no-op ガードを持つ（二重防衛）。
   *
   * @param id - 削除対象のキャラクター ID
   */
  onDelete: (id: string) => void;
  /**
   * キャラクター名変更要求のコールバック。
   *
   * @remarks
   * `useProject.renameCharacter` の安定参照をそのまま渡してよい。
   * trim 後が空文字の場合は呼び出し元（UI 側）と `useProject` 側の両方で no-op 保証。
   *
   * @param id - 変更対象のキャラクター ID
   * @param name - 新しいキャラクター名
   */
  onRename: (id: string, name: string) => void;
  /**
   * キャラクターカラー変更要求のコールバック。
   *
   * @remarks
   * `useProject.setCharacterColor` の安定参照をそのまま渡してよい。
   * `ColorWheel.onChange` から即時転送されるため、ドラッグ中も逐次反映される。
   *
   * @param id - 変更対象のキャラクター ID
   * @param color - 新しい CSS hex カラー（例: `"#ff6b6b"`）
   */
  onColorChange: (id: string, color: string) => void;
};

/**
 * キャラクター一覧の表示・追加・削除・名前編集・色変更を担うサイドパネルコンポーネント。
 *
 * @remarks
 * - キャラクター名入力フォームと一覧リストを持つ。
 * - 最後の1キャラクターは削除ボタンが `disabled` になる（孤児 Line 防止）。
 * - 削除時は CSS アニメーション（退場スライド）を再生してから `onDelete` を呼ぶ。
 * - 名前をダブルクリックするとインライン編集モードに切り替わる（local state: `editingId`）。
 *   - Enter / blur で確定 → `onRename(id, value)`（trim 後が空なら no-op で編集解除）。
 *   - Esc でキャンセル（元の名前に戻る）。
 * - 色ドットを `<button>` 化し、クリックで `ColorWheel` ポップオーバーを表示（local state: `colorEditingId`、排他）。
 *   - `ColorWheel.onChange` で `onColorChange(id, hex)` を即時転送。
 *   - `ColorWheel.onClose` で `colorEditingId` を解除。
 * - `prefers-reduced-motion: reduce` 時は即時削除（アニメーションスキップ）。
 * - フッターは装飾専用（`aria-hidden`）でスクリーンリーダーには読まれない。
 *
 * @param props - {@link CharacterPanelProps}
 */
export function CharacterPanel({ characters, onAdd, onDelete, onRename, onColorChange }: CharacterPanelProps) {
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

  // 削除アニメーション用タイマーの id を保持する Set。
  // unmount 時に cleanup で全タイマーをクリアし、
  // stale closure による setState-after-unmount を防ぐ。
  const removeTimerIds = useRef(new Set<ReturnType<typeof window.setTimeout>>());

  useEffect(() => {
    const ids = removeTimerIds.current;
    return () => {
      for (const id of ids) {
        window.clearTimeout(id);
      }
      ids.clear();
    };
  }, []);

  const handleDelete = useCallback(
    (id: string) => {
      if (!canDelete) return;
      const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      if (reduced) {
        onDelete(id);
        return;
      }
      setRemovingIds((prev) => ({ ...prev, [id]: true }));
      const timerId = window.setTimeout(() => {
        removeTimerIds.current.delete(timerId);
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
      removeTimerIds.current.add(timerId);
    },
    [canDelete, onDelete],
  );

  const submit = () => {
    const trimmed = name.trim();
    if (trimmed === "") return;
    onAdd(trimmed);
    setName("");
  };

  // ===== 名前インライン編集 (§2.2 / F-80-82) =====
  // editingId: 現在編集中のキャラ ID（null = 編集していない）。
  // editValue: 編集中の一時テキスト（確定まで onRename を呼ばない）。
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");

  /** 名前 span のダブルクリックで編集モードに入る。 */
  const startEdit = useCallback((id: string, currentName: string) => {
    setEditingId(id);
    setEditValue(currentName);
  }, []);

  /** Enter / blur で確定。trim 後が空なら no-op（編集解除のみ）。 */
  const commitEdit = useCallback(
    (id: string, value: string) => {
      setEditingId(null);
      const trimmed = value.trim();
      if (trimmed !== "") {
        onRename(id, trimmed);
      }
      // 空文字の場合は表示が元の名前に戻る（characters が変わらないため）。
    },
    [onRename],
  );

  /** Esc でキャンセル（元の名前表示に戻す）。 */
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

  // ===== 色変更（§2.3 / F-90-93）=====
  // colorEditingId: ColorWheel を表示中のキャラ ID（null = 非表示）。
  // 開けるのは1つのみ（排他）。
  const [colorEditingId, setColorEditingId] = useState<string | null>(null);
  // 色相環ポップオーバーの位置決め用に、開いたドットの矩形を保持する。
  const [colorAnchor, setColorAnchor] = useState<DOMRect | null>(null);

  const openColorWheel = useCallback((id: string, anchor: DOMRect) => {
    setColorAnchor(anchor);
    setColorEditingId(id);
  }, []);

  const closeColorWheel = useCallback(() => {
    setColorEditingId(null);
    setColorAnchor(null);
  }, []);

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
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
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
        <button type="submit" className={styles.addBtn} aria-label="追加">
          +
        </button>
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

          const isEditingName = editingId === c.id;
          const isColorOpen = colorEditingId === c.id;

          return (
            <li key={c.id} className={itemClass}>
              {/* ===== 色ドット → button 化（§2.3）===== */}
              {/* aria-label にキャラ名を含め、目的を明示する。 */}
              {/* position: relative でポップオーバーのアンカーにする。 */}
              <span className={styles.dotWrapper}>
                <button
                  type="button"
                  className={styles.dotBtn}
                  aria-label={`${c.name} の色を変更`}
                  style={{
                    background: c.color,
                    // グロー色は同じ hex にアルファを乗せた近似値（CSS color-mix() は未対応環境があるため inline 変数）。
                    ["--c-glow" as string]: c.color + "80",
                  }}
                  onClick={(e) => openColorWheel(c.id, e.currentTarget.getBoundingClientRect())}
                />
                {/* ColorWheel ポップオーバー: body 直下へ portal し、ドット矩形基準で fixed 配置。
                    Why portal: サイドバーの overflow にクリップされて隠れるのを防ぐ。 */}
                {isColorOpen &&
                  colorAnchor &&
                  createPortal(
                    <div className={styles.colorPopover} style={popoverStyle(colorAnchor)}>
                      <ColorWheel
                        color={c.color}
                        onChange={(hex) => onColorChange(c.id, hex)}
                        onClose={closeColorWheel}
                      />
                    </div>,
                    document.body,
                  )}
              </span>

              {/* ===== キャラ名: 通常表示 / インライン編集切り替え（§2.2）===== */}
              {isEditingName ? (
                /* 編集中: <input> を表示。オートフォーカス＆テキスト全選択。 */
                <input
                  className={styles.nameInput}
                  aria-label={`${c.name} の名前を編集`}
                  value={editValue}
                  autoFocus
                  onFocus={(e) => e.currentTarget.select()}
                  onChange={(e: ChangeEvent<HTMLInputElement>) => setEditValue(e.target.value)}
                  onBlur={() => commitEdit(c.id, editValue)}
                  onKeyDown={(e) => handleEditKeyDown(e, c.id)}
                />
              ) : (
                /* 通常: <span> をダブルクリックで編集モードへ。 */
                <span
                  className={styles.name}
                  onDoubleClick={() => startEdit(c.id, c.name)}
                  title="ダブルクリックで名前を編集"
                >
                  {c.name}
                </span>
              )}

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
        <span className={styles.sidebarFooterInner}>
          <span className={styles.heroPulseDot} />
          YMM4 Script Editor
        </span>
        <span className={styles.ver}>v0.1</span>
      </div>
    </aside>
  );
}
