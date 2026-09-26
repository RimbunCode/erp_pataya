// SearchLegend — petunjuk (legend) tombol/simbol di footer dropdown Search Bar
// (spec datatable2-advanced-search, revisi 8 Requirement 42, revisi 9, revisi 12).
// Tiap fungsi = pasangan tombol (`<kbd>`) + penjelasan singkat. Revisi 12:
// petunjuk mengikuti KONDISI SAAT INI (Panel / saran / mode value; fokus di
// kotak, chip, opsi, widget kalender; ada ketikan; sedang mengedit; mode
// kecualikan) -- tombol yg SAMA berfungsi beda tergantung fokus (mis. Enter =
// jadikan chip / pilih opsi / edit chip / selesai / terapkan), jadi hanya
// petunjuk yg berlaku SEKARANG yang ditampilkan, dgn kalimat sesuai fungsinya.

import { useLaravelReactI18n } from "laravel-react-i18n";

// id -> tombol yg ditampilkan (`[]` = hanya teks). Label i18n:
// `core.datatable.search.legend.<id>`.
const LEGEND_KEYS = {
  // simbol ketik
  exclude: ["!"],
  exclude_on: ["!"],
  separator: ["|", ";", ","],
  separator_number: ["|", ";"],
  compare: [">", ">=", "<", "<="],
  range: ["a..b"],
  examples: [],
  // tak boleh dicampur (number/date)
  lock_plain: [],
  // kotak search
  enter_chip: ["Enter"],
  enter_symbol_finish: ["Enter"],
  enter_finish: ["Enter"],
  enter_finish_empty: ["Enter"],
  enter_apply: ["Enter"],
  enter_edit_save: ["Enter"],
  option_down: ["↓"],
  complete: ["Tab"],
  chip_focus: ["←", "⌫"],
  chip_focus_filter: ["←", "⌫"],
  // opsi (daftar nilai)
  option_move: ["↑", "↓"],
  option_pick: ["Enter"],
  option_pick_apply: ["Enter"],
  option_pick_symbol: ["Enter"],
  option_back: ["↑"],
  // chip tersorot
  chip_nav: ["←", "→"],
  chip_edit: ["Enter", "Space"],
  chip_remove: ["⌫", "Del"],
  // widget kalender
  widget_nav: ["←", "→", "↑", "↓"],
  widget_pick: ["Enter", "Space"],
  // Panel / saran
  type_hint: [],
  panel_enter: ["↑", "↓"],
  panel_move: ["↑", "↓", "←", "→"],
  panel_pick: ["Enter", "Space"],
  panel_back: ["↑"],
  suggest_move: ["↑", "↓"],
  suggest_pick: ["Enter"],
  column_pick: ["Tab", ":"],
  // umum
  editing_note: [],
  escape: ["Esc"],
  escape_close: ["Esc"],
};

// Nilai bersimbol (perbandingan/rentang) hanya utk number & date.
const HAS_SYMBOLS = new Set(["number", "date"]);

/**
 * Daftar id petunjuk utk kondisi `ctx`.
 * @param {object} ctx
 * @param {"panel"|"panelItem"|"suggest"|"value"} [ctx.scope] Panel (kotak
 *   fokus) / fokus di item Panel / saran ketikan (mode key) / mode value
 * @param {string|null} [ctx.vmode] "text"|"number"|"list"|"relation"|"date"
 * @param {boolean} [ctx.isBoolean] kolom boolean (mode "list" tapi nilai tunggal)
 * @param {boolean} [ctx.hasChips] ada chip (filter utk mode key, nilai utk mode value)
 * @param {boolean} [ctx.chipFocused] chip tersorot panah
 * @param {boolean} [ctx.typing] ada ketikan (di luar awalan `!`)
 * @param {boolean} [ctx.optionActive] sorotan opsi terlihat (mode value)
 * @param {boolean} [ctx.editing] sedang mengedit chip/filter
 * @param {boolean} [ctx.excluded] mode kecualikan (`!`) aktif
 * @param {"plain"|null} [ctx.chipLock] number/date: sudah ada nilai polos
 *   ("plain": simbol ditolak -- daftar = N nilai polos ATAU satu nilai bersimbol)
 * @param {boolean} [ctx.typingSymbol] ketikan number/date bersimbol -> Enter
 *   langsung SELESAI (nilai bersimbol = satu-satunya nilai)
 * @param {boolean} [ctx.widgetFocused] fokus di dalam widget kalender (date)
 * @returns {string[]}
 */
export const legendTipsFor = ({
  scope = "value",
  vmode = null,
  isBoolean = false,
  hasChips = false,
  chipFocused = false,
  typing = false,
  optionActive = false,
  editing = false,
  excluded = false,
  chipLock = null,
  typingSymbol = false,
  widgetFocused = false,
} = {}) => {
  if (scope === "panelItem") {
    return ["panel_move", "panel_pick", "panel_back", "escape_close"];
  }
  if (scope === "panel") {
    if (chipFocused) return chipKeyTips();
    return [
      "type_hint",
      "panel_enter",
      ...(hasChips ? ["chip_focus_filter"] : []),
      "column_pick",
      "enter_apply",
      "escape_close",
    ];
  }
  if (scope === "suggest") {
    if (chipFocused) return chipKeyTips();
    return ["suggest_move", "suggest_pick", "column_pick", "escape_close"];
  }

  // --- mode value ---------------------------------------------------------
  if (!vmode && !isBoolean) return [];
  if (chipFocused) return chipKeyTips();
  if (widgetFocused) return ["widget_nav", "widget_pick", "escape"];

  const isDate = vmode === "date";
  const kind = isBoolean ? "boolean" : vmode;
  const chipMode = ["text", "number", "date"].includes(vmode);
  const listMode = kind === "list" || kind === "relation" || kind === "boolean";
  const tips = [];

  if (optionActive) {
    tips.push("option_move", "option_back");
    // Nilai bersimbol (`>=2027`) yg dipilih dari saran = satu-satunya nilai -> langsung selesai.
    tips.push(
      isBoolean
        ? "option_pick_apply"
        : typingSymbol
          ? "option_pick_symbol"
          : "option_pick",
    );
    if (listMode || isDate) tips.push("complete");
  } else if (typing) {
    if (chipMode) {
      tips.push(typingSymbol ? "enter_symbol_finish" : "enter_chip");
      tips.push(
        vmode === "number" || isDate ? "separator_number" : "separator",
      );
    }
    if (listMode) tips.push("option_down");
    if (isDate) tips.push("complete");
  } else {
    // Kotak kosong, fokus di kotak.
    tips.push(
      editing
        ? "enter_edit_save"
        : hasChips
          ? "enter_finish"
          : "enter_finish_empty",
    );
    if (listMode || isDate || chipMode) tips.push("option_down");
    if (hasChips) tips.push("chip_focus");
    if (kind !== "boolean" && (listMode || chipMode)) {
      tips.push(
        vmode === "number" || isDate ? "separator_number" : "separator",
      );
    }
  }

  // Simbol ketik: dibatasi aturan daftar (satu nilai bersimbol ATAU banyak polos).
  if (HAS_SYMBOLS.has(vmode)) {
    if (chipLock === "plain") tips.push("lock_plain");
    else if (!optionActive) tips.push("compare", "range");
    if (isDate && !optionActive && !typing) tips.push("examples");
  }
  tips.push(excluded ? "exclude_on" : "exclude");
  if (editing && (optionActive || typing)) tips.push("editing_note");
  tips.push("escape");
  return tips;
};

// Chip (utama/nilai) tersorot: panah geser, Enter/Space edit, Backspace/Del hapus.
const chipKeyTips = () => ["chip_nav", "chip_edit", "chip_remove", "escape"];

/**
 * Footer petunjuk: tombol + penjelasan, membungkus rapi di lebar sempit.
 * Warna teks sengaja kontras tinggi (foreground), bukan muted -- tips harus
 * terbaca jelas di tema gelap.
 * @param {object} props
 * @param {object} [props.ctx] kondisi saat ini (lihat `legendTipsFor`)
 * @returns {import("react").JSX.Element|null}
 */
export default function SearchLegend({ ctx }) {
  const { t } = useLaravelReactI18n();
  const ids = legendTipsFor(ctx);
  if (ids.length === 0) return null;

  return (
    <div className="border-t bg-muted/40 px-3 py-2" data-testid="search-legend">
      <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-foreground/80">
        {t("core.datatable.search.legend.title")}
      </p>
      <ul className="flex flex-wrap gap-x-4 gap-y-1.5 text-xs text-foreground/90">
        {ids.map((id) => (
          <li key={id} className="inline-flex items-center gap-1.5">
            {(LEGEND_KEYS[id] ?? []).length > 0 && (
              <span className="inline-flex items-center gap-0.5">
                {LEGEND_KEYS[id].map((key) => (
                  <kbd
                    key={key}
                    className="min-w-5 rounded border border-border bg-background px-1 text-center font-mono text-[11px] leading-5 text-foreground shadow-xs"
                  >
                    {key}
                  </kbd>
                ))}
              </span>
            )}
            <span>{t(`core.datatable.search.legend.${id}`)}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
