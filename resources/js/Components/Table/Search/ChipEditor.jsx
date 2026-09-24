// ChipEditor — popover body untuk mengedit chip Search Bar `search` (ganti
// teks) atau `group` (kolom grup + granularity/range). REVISI 2: chip `leaf`
// TIDAK lagi lewat sini -- edit nilai leaf memakai widget yang SAMA dgn
// membuat baru (mode value inline SearchBar, columnSearch.js), operator
// SELALU tetap, tanpa dialog/menu pemilihan operator (design.md §5.6, §7.1;
// Requirement 7.1-7.3, revisi "permudah pengguna, tanpa dialog operator").
// Komponen murni presentasional -- tidak tahu tree/chip id, hanya melapor
// lewat `onApply(patch)`; parent (SearchBar) yang memutuskan
// `updateChip`/`onGroupChange`.

import {
  DATE_GROUP_GRANULARITIES,
  DEFAULT_NUMBER_GROUP_RANGE_OPTIONS,
} from "@/Components/Table/Table2";
import SearchableOptionList, {
  searchableOptionFilter,
} from "@/Components/Table/SearchableOptionList";
import { useState } from "react";

import { Button } from "@/Components/ui/button";
import { Command } from "@/Components/ui/command";
import { Input } from "@/Components/ui/input";
import { useLaravelReactI18n } from "laravel-react-i18n";

// Sentinel "Tidak ada" -- sama seperti `NO_GROUP_VALUE` (DataTable2.jsx:96)
// & `searchSuggestions.js`. Didefinisikan lokal (bukan import dari Pages/)
// agar komponen ini tidak bergantung ke DataTable2.
const NO_GROUP_VALUE = "__no_group__";

const isDateColumn = (col) => ["date", "time", "datetime"].includes(col?.type);
const isNumberColumn = (col) => ["number", "currency"].includes(col?.type);

/**
 * Hitung default granularity/range untuk kolom grup BARU -- mirror
 * `setGroup()` (DataTable2.jsx:447-474): date/time/datetime → granularity
 * "month"; number/currency → range pertama (`groupRangeOptions` kolom /
 * default global); lainnya → null.
 * @param {object|null} column node kolom (WAJIB `column.name`)
 * @returns {{column: string|null, granularity: string|null, range: number|null}}
 */
export const computeGroupDefaults = (column) => ({
  column: column?.name ?? null,
  granularity: isDateColumn(column) ? "month" : null,
  range: isNumberColumn(column)
    ? (column?.groupRangeOptions?.[0] ?? DEFAULT_NUMBER_GROUP_RANGE_OPTIONS[0])
    : null,
});

/**
 * GroupPicker — kolom grup (`SearchableOptionList` "Tidak ada" + kolom
 * groupable) + sub-pilihan granularity/range untuk kolom grup AKTIF. Dipakai
 * `ChipEditor` (kind "group") DAN `SearchPanel` (kolom Group by) -- UI sama
 * persis (design.md §5.6, §5.8; Requirement 7.3, 9.4).
 * @param {object} root0
 * @param {Array<{value: string, label: string}>} root0.groupOptions daftar
 *   opsi TERMASUK sentinel "Tidak ada" di depan (bentuk sama dengan
 *   `groupOptions` DataTable2 -- host membangunnya sekali, dipakai ulang).
 * @param {object} root0.columns peta kolom (getColumns()), untuk resolusi
 *   tipe kolom yang dipilih.
 * @param {{column: string|null, granularity: string|null, range: number|null}} root0.value
 * @param {(patch: {column: string|null, granularity: string|null, range: number|null}) => void} root0.onChange
 * @returns {React.JSX.Element}
 */
export function GroupPicker({ groupOptions, columns, value, onChange }) {
  const { t } = useLaravelReactI18n();
  const activeColumn = value?.column ? columns?.[value.column] : null;
  const rangeOptions =
    activeColumn?.groupRangeOptions ?? DEFAULT_NUMBER_GROUP_RANGE_OPTIONS;

  return (
    <div className="flex flex-col w-64">
      <Command filter={searchableOptionFilter}>
        <SearchableOptionList
          options={groupOptions}
          value={value?.column || NO_GROUP_VALUE}
          onValueChange={(val) => {
            if (val === NO_GROUP_VALUE) {
              onChange({ column: null, granularity: null, range: null });
              return;
            }
            onChange(computeGroupDefaults(columns?.[val] ?? { name: val }));
          }}
          searchPlaceholder={t(
            "core.datatable.filter.column.search.placeholder",
          )}
          emptyMessage={t("core.datatable.filter.column.not_found")}
        />
      </Command>
      {isDateColumn(activeColumn) && (
        <div className="flex flex-wrap gap-1 p-2 border-t border-muted-foreground/20">
          {DATE_GROUP_GRANULARITIES.map((g) => (
            <Button
              key={g}
              type="button"
              size="sm"
              variant={
                (value?.granularity ?? "month") === g ? "secondary" : "ghost"
              }
              onClick={() => onChange({ ...value, granularity: g })}
            >
              {t(`core.datatable.granularity.${g}`)}
            </Button>
          ))}
        </div>
      )}
      {isNumberColumn(activeColumn) && (
        <div className="flex flex-wrap gap-1 p-2 border-t border-muted-foreground/20">
          {rangeOptions.map((size) => (
            <Button
              key={size}
              type="button"
              size="sm"
              variant={
                (value?.range ?? rangeOptions[0]) === size
                  ? "secondary"
                  : "ghost"
              }
              onClick={() => onChange({ ...value, range: size })}
            >
              {size}
            </Button>
          ))}
        </div>
      )}
    </div>
  );
}

/**
 * Editor chip `search` — ganti teks yang dicari (`v` semua anak grup, sesuai
 * `updateChip`/`isSearchGroup` di `searchChips.js`).
 * @param {object} root0
 * @param {string} [root0.initialValue]
 * @param {string[]} root0.searchColumnTitles
 * @param {(patch: {v: string}) => void} root0.onApply
 * @param {(key: string, params?: object) => string} root0.t
 * @returns {React.JSX.Element}
 */
function SearchChipEditor({ initialValue, searchColumnTitles, onApply, t }) {
  const [text, setText] = useState(initialValue ?? "");

  const apply = () => {
    const trimmed = text.trim();
    if (!trimmed) return;
    onApply({ v: trimmed });
  };

  return (
    <div
      className="flex flex-col gap-2 w-64"
      onKeyDown={(e) => {
        if (e.key !== "Enter") return;
        e.preventDefault();
        apply();
      }}
    >
      <Input autoFocus value={text} onChange={(e) => setText(e.target.value)} />
      <span className="text-muted-foreground text-xs">
        {t("core.datatable.search.searching_in", {
          columns: searchColumnTitles.join(", "),
        })}
      </span>
      <Button type="button" size="sm" className="self-end" onClick={apply}>
        {t("core.datatable.search.apply")}
      </Button>
    </div>
  );
}

/**
 * ChipEditor — popover body untuk chip `search` atau `group`. Chip `leaf`
 * TIDAK ditangani di sini lagi (lihat komentar file, revisi 2).
 * @param {object} root0
 * @param {"search"|"group"} root0.kind
 * @param {*} [root0.value] value awal (kind "search"/"group").
 * @param {string[]} [root0.searchColumnTitles] label kolom yang dicari (kind
 *   "search", untuk info "Mencari di: ...").
 * @param {Array<{value: string, label: string}>} [root0.groupOptions] (kind "group")
 * @param {object} [root0.columns] peta kolom (kind "group", diteruskan ke `GroupPicker`)
 * @param {(patch: object) => void} root0.onApply
 * @returns {React.JSX.Element}
 */
export default function ChipEditor({
  kind,
  value,
  searchColumnTitles,
  groupOptions,
  columns,
  onApply,
}) {
  const { t } = useLaravelReactI18n();

  if (kind === "group") {
    return (
      <GroupPicker
        groupOptions={groupOptions ?? []}
        columns={columns}
        value={value ?? { column: null, granularity: null, range: null }}
        onChange={onApply}
      />
    );
  }

  return (
    <SearchChipEditor
      initialValue={value}
      searchColumnTitles={searchColumnTitles ?? []}
      onApply={onApply}
      t={t}
    />
  );
}
