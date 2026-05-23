// src/components/Header/Header.tsx
import {
  useState,
  useRef,
  useCallback,
  useEffect,
  type ChangeEvent,
  type KeyboardEvent,
  type MouseEvent,
} from "react";
import styles from "./Header.module.css";

export type HeaderProps = {
  projectName: string;
  onProjectNameChange: (name: string) => void;
  onSaveYmscript: () => void;
  onSaveMarkdown: () => void;
  onExportCSV: () => void;
  onLoadYmscript: (file: File) => void;
  onLoadMarkdown: (file: File) => void;
  onCopyAll: () => void;
};

// openMenu の型: 保存/読込 の排他制御に使う（item 5）。
type OpenMenu = "save" | "load" | null;

// メニュー外クリック検知: 対象 ref の外側を mousedown した時に onClose を呼ぶ。
// Why mousedown (not click): click はポップアップ内ボタンの action 後にも伝播し得るが、
// mousedown は action より先に発火するため「外をクリックして閉じる」に適している。
// enabled フラグで無効時はリスナーを登録しない（パフォーマンス最適化）。
function useOutsideClick(
  ref: React.RefObject<HTMLElement | null>,
  onClose: () => void,
  enabled: boolean,
) {
  useEffect(() => {
    if (!enabled) return;
    const handler = (e: globalThis.MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        onClose();
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [ref, onClose, enabled]);
}

export function Header(props: HeaderProps) {
  // props オブジェクト全体は毎レンダーで新しい参照になるため、
  // useCallback の依存に個別の関数を書けるよう分割代入する（exhaustive-deps 対策）。
  const {
    onProjectNameChange,
    onSaveYmscript,
    onSaveMarkdown,
    onExportCSV,
    onLoadYmscript,
    onLoadMarkdown,
    onCopyAll,
    projectName,
  } = props;

  // ===== 排他メニュー制御 (item 5) =====
  // openMenu が "save"/"load" の時のみ対応パネルを DOM に出す。
  // 片方を開くともう片方は閉じる（setOpenMenu で上書き）。
  const [openMenu, setOpenMenu] = useState<OpenMenu>(null);

  const headerRef = useRef<HTMLElement>(null);
  const closeMenu = useCallback(() => setOpenMenu(null), []);

  // メニュー外クリックで閉じる（item 5）
  useOutsideClick(headerRef, closeMenu, openMenu !== null);

  // Escape キーで閉じる（keyboard a11y）
  const handleKeyDown = useCallback((e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key === "Escape") closeMenu();
  }, [closeMenu]);

  const toggleSave = useCallback((e: MouseEvent<HTMLButtonElement>) => {
    e.stopPropagation();
    setOpenMenu((prev) => (prev === "save" ? null : "save"));
  }, []);

  const toggleLoad = useCallback((e: MouseEvent<HTMLButtonElement>) => {
    e.stopPropagation();
    setOpenMenu((prev) => (prev === "load" ? null : "load"));
  }, []);

  // メニュー項目クリック: アクションを実行してメニューを閉じる。
  // Why useCallback with inner factory: 各項目のクリックハンドラは異なる action を持つが、
  // いずれも setOpenMenu(null) を呼ぶ共通処理を持つ。
  const runAndClose = useCallback((action: () => void) => () => {
    action();
    setOpenMenu(null);
  }, []);

  // ===== Hidden file inputs =====
  const ymscriptInputRef = useRef<HTMLInputElement>(null);
  const markdownInputRef = useRef<HTMLInputElement>(null);

  // hidden file input をプログラムから開くのは標準的なパターン。
  // イベントハンドラ内の ref アクセスで安全（レンダー中に .current を読むわけではない）。
  const openYmscriptPicker = useCallback(() => {
    ymscriptInputRef.current?.click();
    setOpenMenu(null);
  }, []);

  const openMarkdownPicker = useCallback(() => {
    markdownInputRef.current?.click();
    setOpenMenu(null);
  }, []);

  // onChange ハンドラ: ファイルを handler に渡し、同じファイルの連続選択を可能にするため
  // value をリセットする。ref.current へのアクセスは change イベント発火時（レンダー外）で安全。
  const onChangeYmscript = useCallback((e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) onLoadYmscript(file);
    // 同じファイルを連続選択できるよう value をリセットする（change イベントが再発火するため）。
    if (ymscriptInputRef.current) ymscriptInputRef.current.value = "";
  }, [onLoadYmscript]);

  const onChangeMarkdown = useCallback((e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) onLoadMarkdown(file);
    // 同じファイルを連続選択できるよう value をリセットする（change イベントが再発火するため）。
    if (markdownInputRef.current) markdownInputRef.current.value = "";
  }, [onLoadMarkdown]);

  return (
    <header className={styles.header} ref={headerRef}>
      {/* ===== Left: brand mark + project name ===== */}
      <div className={styles.brand}>
        {/* aria-hidden: 純粋な装飾ロゴ。スクリーンリーダーに読ませない。 */}
        <div className={styles.brandMark} aria-hidden="true">Y4</div>
        <div className={styles.brandSep} aria-hidden="true" />
        <input
          className={styles.projectName}
          value={projectName}
          onChange={(e: ChangeEvent<HTMLInputElement>) => onProjectNameChange(e.target.value)}
          aria-label="プロジェクト名"
        />
      </div>

      <div className={styles.spacer} />

      {/* ===== Right: action buttons ===== */}
      {/* onKeyDown で Escape を捕捉してメニューを閉じる（a11y keyboard navigation） */}
      <div className={styles.headerActions} onKeyDown={handleKeyDown}>
        {/* 全件コピー: primary variant で最重要 CTA として強調 */}
        <button className={styles.btnPrimary} onClick={onCopyAll}>全件コピー</button>

        <div className={styles.vSep} aria-hidden="true" />

        {/* ===== 保存メニュー (item 5) =====
         * aria-haspopup="menu" + aria-expanded でスクリーンリーダーに状態を伝える。
         * パネルは openMenu === "save" の時のみ DOM に出す
         * （a11y: hidden 要素に Tab が入らない, role="menu" の子のみ focusable）。
         * 開く演出: dropdown-enter-right（nav-menu-family / linear-app）
         *   opacity 0→1 + translateX(10%→0), 0.2s ease。
         * 項目は CSS animation-delay で stagger（各 +30ms）。
         */}
        <div className={styles.menuWrapper}>
          <button
            className={styles.btn}
            aria-haspopup="menu"
            aria-expanded={openMenu === "save"}
            onClick={toggleSave}
          >
            保存▼
          </button>
          {openMenu === "save" && (
            <div className={styles.menuPanel} role="menu">
              <button
                role="menuitem"
                className={styles.menuItem}
                style={{ animationDelay: "0ms" }}
                onClick={runAndClose(onSaveYmscript)}
              >
                .ymscript として保存
              </button>
              <button
                role="menuitem"
                className={styles.menuItem}
                style={{ animationDelay: "30ms" }}
                onClick={runAndClose(onSaveMarkdown)}
              >
                .md として保存
              </button>
              <button
                role="menuitem"
                className={styles.menuItem}
                style={{ animationDelay: "60ms" }}
                onClick={runAndClose(onExportCSV)}
              >
                CSV を書き出す
              </button>
            </div>
          )}
        </div>

        {/* ===== 読込メニュー (item 5) ===== */}
        <div className={styles.menuWrapper}>
          <button
            className={styles.btn}
            aria-haspopup="menu"
            aria-expanded={openMenu === "load"}
            onClick={toggleLoad}
          >
            読込▼
          </button>
          {openMenu === "load" && (
            <div className={styles.menuPanel} role="menu">
              <button
                role="menuitem"
                className={styles.menuItem}
                style={{ animationDelay: "0ms" }}
                onClick={openYmscriptPicker}
              >
                .ymscript を読み込む
              </button>
              <button
                role="menuitem"
                className={styles.menuItem}
                style={{ animationDelay: "30ms" }}
                onClick={openMarkdownPicker}
              >
                .md を読み込む
              </button>
            </div>
          )}
        </div>
      </div>

      {/* aria-label でテストから取得可能にする（a11y 改善も兼ねる）。 */}
      <input
        ref={ymscriptInputRef}
        type="file"
        accept=".ymscript,application/json"
        hidden
        aria-label=".ymscript ファイル"
        onChange={onChangeYmscript}
      />
      <input
        ref={markdownInputRef}
        type="file"
        accept=".md,text/markdown"
        hidden
        aria-label=".md ファイル"
        onChange={onChangeMarkdown}
      />
    </header>
  );
}
