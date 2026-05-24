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

/**
 * ピン（画鋲）アイコンの SVG path d 文字列。
 *
 * @remarks
 * 固定中（塗り）と未固定（アウトライン）で同一形状を使い、
 * fill / opacity の切り替えのみで状態を表現する（二重定義の排除 / M-2 修正）。
 * Bootstrap Icons v1 pin-angle-fill に由来する 16×16 viewBox のパス。
 */
const PIN_PATH =
  "M9.828.722a.5.5 0 0 1 .354.146l4.95 4.95a.5.5 0 0 1 0 .707c-.48.48-1.072.588-1.503.588-.177 0-.335-.018-.46-.039l-3.134 3.134a5.927 5.927 0 0 1 .16 1.013c.046.702-.032 1.687-.72 2.375a.5.5 0 0 1-.707 0l-2.829-2.828-3.182 3.182c-.195.195-1.219.902-1.414.707-.195-.195.512-1.22.707-1.414l3.182-3.182-2.828-2.829a.5.5 0 0 1 0-.707c.688-.688 1.673-.767 2.375-.72a5.922 5.922 0 0 1 1.013.16l3.134-3.133a2.772 2.772 0 0 1-.04-.461c0-.43.108-1.022.589-1.503a.5.5 0 0 1 .353-.146z";

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
  /**
   * 全プロジェクト共有の共通キャラクター一覧（上部グループ表示・ピン判定用）。
   *
   * @remarks
   * `useProject.pinnedCharacters` をそのまま渡す。
   */
  pinnedCharacters: Character[];
  /**
   * アクティブ project のローカルキャラクター一覧（下部グループ）。
   *
   * @remarks
   * `useProject.project.characters` をそのまま渡す（実効一覧ではない）。
   */
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
  /**
   * ピン固定要求のコールバック（ローカル → 共通プールへ移動）。
   *
   * @param id - ピンするキャラクターの ID
   */
  onPin: (id: string) => void;
  /**
   * ピン解除要求のコールバック（共通プール → ローカルへ移動）。
   *
   * @param id - ピン解除するキャラクターの ID
   */
  onUnpin: (id: string) => void;
};

/**
 * キャラクター一覧の表示・追加・削除・名前編集・色変更・ピン固定を担うサイドパネルコンポーネント。
 *
 * @remarks
 * - キャラクター名入力フォームと一覧リストを持つ（上部=共通キャラ、下部=ローカル）。
 * - 実効一覧（pinnedCharacters + characters）が1以下なら削除ボタンが `disabled`（孤児 Line 防止）。
 * - 各キャラ行に固定トグルボタン（インライン SVG のピン/画鋲）を持つ。
 * - 削除時は CSS アニメーション（退場スライド）を再生してから `onDelete` を呼ぶ。
 * - 名前をダブルクリックするとインライン編集モードに切り替わる（local state: `editingId`）。
 *   - Enter / blur で確定 → `onRename(id, value)`（trim 後が空なら no-op で編集解除）。
 *   - Esc でキャンセル（元の名前に戻る）。
 * - 色ドットを `<button>` 化し、クリックで `ColorWheel` ポップオーバーを表示（local state: `colorEditingId`、排他）。
 * - `prefers-reduced-motion: reduce` 時は即時削除（アニメーションスキップ）。
 * - フッターは装飾専用（`aria-hidden`）でスクリーンリーダーには読まれない。
 *
 * @param props - {@link CharacterPanelProps}
 */
export function CharacterPanel({
  pinnedCharacters,
  characters,
  onAdd,
  onDelete,
  onRename,
  onColorChange,
  onPin,
  onUnpin,
}: CharacterPanelProps) {
  const [name, setName] = useState("");
  // 実効一覧（共通 + ローカル）の合計が1以下なら削除不可（孤児 Line 防止）。
  const effectiveTotal = pinnedCharacters.length + characters.length;
  const canDelete = effectiveTotal > 1;

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

  /** キャラ1行のレンダリング（共通・ローカル共用）。 */
  const renderCharItem = (c: Character, isPinned: boolean) => {
    const isRemoving = removingIds[c.id] === true;
    const itemClass = isRemoving
      ? `${styles.charItem} ${styles.charItemRemoving}`
      : `${styles.charItem} ${styles.charItemEnter}`;

    const isEditingName = editingId === c.id;
    const isColorOpen = colorEditingId === c.id;

    return (
      <li key={c.id} className={itemClass}>
        {/* ===== 色ドット → button 化（§2.3）===== */}
        <span className={styles.dotWrapper}>
          <button
            type="button"
            className={styles.dotBtn}
            aria-label={`${c.name} の色を変更`}
            style={{
              background: c.color,
              ["--c-glow" as string]: c.color + "80",
            }}
            onClick={(e) => openColorWheel(c.id, e.currentTarget.getBoundingClientRect())}
          />
          {isColorOpen &&
            colorAnchor &&
            createPortal(
              <div className={styles.colorPopover} style={popoverStyle(colorAnchor)}>
                <ColorWheel color={c.color} onChange={(hex) => onColorChange(c.id, hex)} onClose={closeColorWheel} />
              </div>,
              document.body,
            )}
        </span>

        {/* ===== キャラ名: 通常表示 / インライン編集切り替え（§2.2）===== */}
        {isEditingName ? (
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
          <span
            className={styles.name}
            onDoubleClick={() => startEdit(c.id, c.name)}
            title="ダブルクリックで名前を編集"
          >
            {c.name}
          </span>
        )}

        {/* ===== ピン固定トグルボタン（インライン SVG / F-124）===== */}
        {/* aria-pressed でトグル状態を表現。固定中=塗り(currentColor)、未固定=アウトライン淡色。 */}
        {/* PIN_PATH を共用することでパスの二重定義を排除し形状の一致を保証する（M-2 修正）。 */}
        <button
          type="button"
          className={styles.pinBtn}
          aria-pressed={isPinned}
          aria-label={isPinned ? "固定を解除" : "共通キャラに固定"}
          onClick={() => (isPinned ? onUnpin(c.id) : onPin(c.id))}
        >
          {isPinned ? (
            /* 固定中: 塗り */
            <svg width="12" height="12" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true" focusable="false">
              <path d={PIN_PATH} />
            </svg>
          ) : (
            /* 未固定: アウトライン（fill なし・stroke で輪郭のみ） */
            <svg
              width="12"
              height="12"
              viewBox="0 0 16 16"
              fill="none"
              stroke="currentColor"
              strokeWidth="1"
              aria-hidden="true"
              focusable="false"
            >
              <path d={PIN_PATH} />
            </svg>
          )}
        </button>

        {/* ===== 削除ボタン ===== */}
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
  };

  return (
    <aside className={styles.sidebar}>
      {/* ===== Panel header ===== */}
      <div className={styles.panelHead}>
        <span>キャラクター</span>
        {/* 件数バッジ: 実効一覧の合計 */}
        <span className={styles.count}>{effectiveTotal}</span>
      </div>

      {/* ===== Add character form ===== */}
      <form
        className={styles.charAdd}
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
      >
        <input
          className={styles.input}
          aria-label="キャラクター名"
          placeholder="キャラクター名"
          value={name}
          onChange={(e: ChangeEvent<HTMLInputElement>) => setName(e.target.value)}
        />
        <button type="submit" className={styles.addBtn} aria-label="追加">
          +
        </button>
      </form>

      {/* ===== Character list: 共通グループ（上）+ ローカルグループ（下）===== */}
      {/* L-3 修正: aria-hidden を外し、各グループを aria-label 付きの role="group" 区画にする。
       *  スクリーンリーダーがグループ名を読み上げるため、視覚と SR の情報が一致する。 */}
      <ul className={styles.charList} role="list">
        {/* 共通キャラグループ: pinnedCharacters.length > 0 のときのみ表示 */}
        {pinnedCharacters.length > 0 && (
          <li role="presentation">
            <div className={styles.groupLabel} role="group" aria-label="共通キャラクター">
              共通
            </div>
          </li>
        )}
        {pinnedCharacters.map((c) => renderCharItem(c, true))}

        {/* ローカルキャラグループ: 共通が1件以上あるときのみ見出しを表示 */}
        {pinnedCharacters.length > 0 && (
          <li role="presentation">
            <div className={styles.groupLabel} role="group" aria-label="このプロジェクトのキャラクター">
              このプロジェクト
            </div>
          </li>
        )}
        {characters.map((c) => renderCharItem(c, false))}
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
