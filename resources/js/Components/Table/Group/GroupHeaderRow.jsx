// Header node pohon grup (spec datatable2-group-tree, Requirement 15-16):
//  - GroupHeaderRow  : desktop, `<tr>` di tabel CSS grid. Label (indent per depth,
//    chevron, nilai grup, `(count)`, pager) + satu sel per kolom sisa berisi
//    agregat terformat -- sejajar kolomnya karena thead/tbody/tr = `display:
//    contents` (semua `td` adalah grid item langsung).
//  - GroupHeaderCard : mobile, kartu ringkas (agregat sbg teks kecil `Nama: nilai`).
//  - GroupNodeStatusRow / GroupNodeStatusCard : baris/kartu loading (skeleton
//    berdenyut) dan error (+ "Coba lagi") -- hanya utk node yg bersangkutan.

import { ChevronDown, ChevronRight, Loader2 } from "lucide-react";
import { usePage } from "@inertiajs/react";
import { useLaravelReactI18n } from "laravel-react-i18n";
import { useCallback, useEffect, useRef } from "react";

import { cn } from "@/lib/utils";
import {
  formatAggregate,
  groupLabelValue,
  splitHeaderColumns,
} from "./groupDisplay";
import GroupLabel from "./GroupLabel";

const INDENT_PX = 16;
const HOVER_INTENT_DELAY_MS = 150;

// Header node TERTUTUP dipakai buat prefetch on-hover (Requirement 21.7).
// Mouse yang cuma LEWAT (scroll cepat lintas beberapa row) sebelumnya
// memicu prefetch tiap row yang disentuh -- badai request percuma
// (permintaan user, revisi 2026-09-28). Prefetch baru jalan kalau pointer
// BERTAHAN di row itu >= delay; `onMouseLeave` batalkan timer. `onFocus`
// (Tab keyboard) SENGAJA tidak lewat sini -- fokus keyboard = niat
// eksplisit, bukan "kebetulan lewat", jadi tetap prefetch langsung.
export function useHoverIntent(callback, delay = HOVER_INTENT_DELAY_MS) {
  const timeoutRef = useRef(null);
  const callbackRef = useRef(callback);
  callbackRef.current = callback;

  const onMouseEnter = useCallback(() => {
    if (!callbackRef.current) return;
    clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(() => callbackRef.current?.(), delay);
  }, [delay]);

  const onMouseLeave = useCallback(() => {
    clearTimeout(timeoutRef.current);
  }, []);

  useEffect(() => () => clearTimeout(timeoutRef.current), []);

  return { onMouseEnter, onMouseLeave };
}
// Sticky header grup desktop (Requirement 21.9, permintaan user): SATU header
// grup yg sedang relevan menempel tepat di bawah baris header kolom saat
// scroll, digantikan otomatis oleh header berikutnya begitu scroll mencapai
// baris itu (pola "sticky section header" umum, mis. daftar kontak).
//
// PERNAH DICOBA & GAGAL (ketahuan lewat verifikasi browser, bukan asumsi):
// `top` BERBEDA per depth (`depth * tinggiBaris`) dgn niat menumpuk breadcrumb
// leluhur (Customer > Tahap > Ditugaskan). Rusak total: krn thead/tbody/tr di
// table.css = `display:contents` (SEMUA `td`, tanpa peduli grup/kedalaman
// mana, jadi grid item LANGSUNG & FLAT -- tak ada wadah per-grup yg jadi
// batas "sticky ini cuma aktif selama subtree-nya di layar"), header level
// LAIN (bukan leluhur node yg sedang di-scroll, mis. sibling level-0 lain)
// ikut nempel di posisi `top` yg kebetulan sama & tumpang-tindih random saat
// discroll. Tabel HARUS tetap `<tr>` datar (semantik HTML tabel), jadi tak
// bisa dibungkus per-grup spt pola nested-sticky pada umumnya -- SEMUA header
// grup (berapa pun depth-nya) sengaja pakai `top` YANG SAMA di bawah ini;
// CSS sticky native yg menentukan header mana yg "menang" tampil (yg terakhir
// dicapai scroll), bukan breadcrumb bertumpuk.
//
// `top` BUKAN angka tetap: sejak header kolom boleh wrap (revisi wrap sel,
// gantikan running-text/truncate), tingginya bisa 1-4 baris tergantung
// panjang label & lebar kolom -- var CSS `--group-sticky-top` diukur live
// oleh ResizeObserver di Table2.jsx (tinggi TERBESAR di antara semua `th`,
// bukan asumsi 1 sel mewakili -- grid stretch ternyata tak selalu konsisten)
// dan diset di elemen <table>, warisan turun ke <td> ini. Fallback 25px cuma
// utk render pertama sebelum observer sempat mengukur.
const stickyGroupHeaderStyle = () => ({
  position: "sticky",
  top: "var(--group-sticky-top, 25px)",
  zIndex: 4,
});

// Klik header = buka/tutup; keyboard Enter/Spasi juga (baris bukan <button>
// karena isinya (pager) mengandung tombol -- tombol bersarang tak valid).
const toggleProps = (onToggle, isOpen, label) => ({
  role: "button",
  tabIndex: 0,
  "aria-expanded": isOpen,
  "aria-label": label,
  onClick: onToggle,
  onKeyDown: (event) => {
    if (event.target !== event.currentTarget) return; // Enter di pager tak menoggle
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      onToggle();
    }
  },
});

function GroupTitle({ item, level, isOpen }) {
  return (
    <>
      {isOpen ? (
        <ChevronDown className="size-4 shrink-0" />
      ) : (
        <ChevronRight className="size-4 shrink-0" />
      )}
      <span>
        <GroupLabel
          type={level?.type}
          value={groupLabelValue(item, level)}
          column={level}
          granularity={level?.granularity}
          rangeSize={level?.range}
        />
      </span>
      <span className="text-muted-foreground font-normal">({item.count})</span>
    </>
  );
}

/**
 * @param {object} root0
 * @param {object} root0.item deskriptor grup {key, raw, count, aggregates, label?}
 * @param {number} root0.depth
 * @param {object} root0.level `groupMeta.levels[depth]`
 * @param {object} [root0.columnMeta] node kolom penuh level ini (label: valueTrans/parse/currency)
 * @param {boolean} root0.isOpen
 * @param {() => void} root0.onToggle
 * @param {*} root0.pager <GroupPager/> atau null
 * @param {(() => void)|undefined} [root0.onPrefetch] hover/fokus header node
 *   TERTUTUP -> mulai muat halaman 1 (`GroupTree` prop, hanya ada saat relevan)
 * @param {Array<{column: string, fn: string}>} root0.aggregates `groupMeta.aggregates`
 * @param {Array<object>} root0.showedColumns kolom tampil berurutan (Table2)
 * @param {boolean} [root0.selectable]
 * @param {boolean} [root0.actions]
 */
export function GroupHeaderRow({
  item,
  depth,
  level,
  columnMeta,
  isOpen,
  onToggle,
  pager,
  onPrefetch,
  aggregates,
  showedColumns,
  selectable,
  actions,
}) {
  const { t } = useLaravelReactI18n();
  const { preferences } = usePage().props;
  const leading = (selectable ? 1 : 0) + (actions ? 1 : 0);
  const { labelSpan, trailing } = splitHeaderColumns(
    showedColumns,
    aggregates,
    leading,
  );
  const fnOf = new Map((aggregates ?? []).map((a) => [a.column, a.fn]));
  const sticky = stickyGroupHeaderStyle();
  const hoverIntent = useHoverIntent(onPrefetch);

  return (
    <tr>
      <td
        {...toggleProps(onToggle, isOpen, undefined)}
        onMouseEnter={hoverIntent.onMouseEnter}
        onMouseLeave={hoverIntent.onMouseLeave}
        onFocus={onPrefetch}
        className="flex-row! justify-start! items-center gap-x-2 bg-muted font-medium cursor-pointer select-none"
        style={{
          ...sticky,
          gridColumn: `span ${labelSpan}`,
          paddingLeft: `calc(1.25rem + ${depth * INDENT_PX}px)`,
        }}
      >
        <GroupTitle
          item={item}
          level={{ ...columnMeta, ...level }}
          isOpen={isOpen}
        />
        {pager}
      </td>
      {trailing.map((column) => {
        const fn = fnOf.get(column.name);
        const value = fn ? item.aggregates?.[column.name] : null;
        return (
          <td
            key={column.name}
            className="bg-muted font-medium border-r border-muted-foreground/15"
            style={sticky}
            title={fn ? t(`core.datatable.aggregate.${fn}`) : undefined}
          >
            {fn && (
              <span className="whitespace-nowrap! text-ellipsis!">
                {formatAggregate(value, column, preferences)}
              </span>
            )}
          </td>
        );
      })}
    </tr>
  );
}

/**
 * Kartu header mobile. Kolom di kartu tak ada, jadi agregat tampil sbg teks
 * kecil `Nama: nilai` (nama = judul kolom).
 * @param root0
 * @param root0.item
 * @param root0.depth
 * @param root0.level
 * @param root0.columnMeta
 * @param root0.isOpen
 * @param root0.onToggle
 * @param root0.pager
 * @param root0.onPrefetch
 * @param root0.aggregates
 * @param root0.columns
 */
export function GroupHeaderCard({
  item,
  depth,
  level,
  columnMeta,
  isOpen,
  onToggle,
  pager,
  onPrefetch,
  aggregates,
  columns,
}) {
  const { t } = useLaravelReactI18n();
  const { preferences } = usePage().props;
  const shown = (aggregates ?? [])
    .map((aggregate) => {
      const column = columns?.[aggregate.column];
      const value = formatAggregate(
        item.aggregates?.[aggregate.column],
        column,
        preferences,
      );
      return value === ""
        ? null
        : {
            name: aggregate.column,
            title: column?.title ?? aggregate.column,
            fn: t(`core.datatable.aggregate.${aggregate.fn}`),
            value,
          };
    })
    .filter(Boolean);
  const hoverIntent = useHoverIntent(onPrefetch);

  return (
    <div
      className="bg-muted border-b border-muted-foreground/25 px-3 py-2 text-sm"
      style={{ paddingLeft: `calc(0.75rem + ${depth * INDENT_PX}px)` }}
    >
      <div
        {...toggleProps(onToggle, isOpen, undefined)}
        onMouseEnter={hoverIntent.onMouseEnter}
        onMouseLeave={hoverIntent.onMouseLeave}
        onFocus={onPrefetch}
        className="flex items-center gap-x-2 font-medium cursor-pointer select-none"
      >
        <GroupTitle
          item={item}
          level={{ ...columnMeta, ...level }}
          isOpen={isOpen}
        />
        {pager}
      </div>
      {shown.length > 0 && (
        <p className="mt-1 ml-6 flex flex-wrap gap-x-3 text-xs text-muted-foreground">
          {shown.map((entry) => (
            <span key={entry.name} title={entry.fn}>
              {entry.title}: {entry.value}
            </span>
          ))}
        </p>
      )}
    </div>
  );
}

// Loading = skeleton berdenyut (bukan teks statis).
export function GroupNodeStatusRow({ depth, colSpan, error, onRetry }) {
  const { t } = useLaravelReactI18n();
  return (
    <tr>
      <td
        className="flex-row! justify-start! items-center gap-x-3"
        style={{
          gridColumn: `span ${colSpan}`,
          paddingLeft: `calc(1.25rem + ${depth * INDENT_PX}px)`,
        }}
      >
        <StatusBody t={t} error={error} onRetry={onRetry} />
      </td>
    </tr>
  );
}

export function GroupNodeStatusCard({ depth, error, onRetry }) {
  const { t } = useLaravelReactI18n();
  return (
    <div
      className="flex items-center gap-x-3 border-b border-muted-foreground/25 px-3 py-2 text-sm"
      style={{ paddingLeft: `calc(0.75rem + ${depth * INDENT_PX}px)` }}
    >
      <StatusBody t={t} error={error} onRetry={onRetry} />
    </div>
  );
}

function StatusBody({ t, error, onRetry }) {
  if (!error) {
    return (
      <div
        role="status"
        aria-busy="true"
        className="flex w-full items-center gap-x-2 text-muted-foreground"
      >
        <Loader2 className="size-4 animate-spin" />
        <span>{t("core.datatable.group_loading")}</span>
      </div>
    );
  }
  return (
    <div
      role="alert"
      className={cn("flex items-center gap-x-3 text-destructive")}
    >
      <span>{t("core.datatable.group_error")}</span>
      <button
        type="button"
        className="underline underline-offset-2"
        onClick={(event) => {
          event.stopPropagation();
          onRetry();
        }}
      >
        {t("core.datatable.group_retry")}
      </button>
    </div>
  );
}
