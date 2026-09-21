// ChipEditor — popover body untuk mengedit satu chip Search Bar (leaf/
// search/group), ATAU membuat DRAFT leaf baru saat user memilih kolom
// bertipe date/datetime/time/relation/relations/lainnya di mode value
// (design.md §5.3, §5.6; Requirement 6.5, 7.1-7.3). Komponen murni
// presentasional -- tidak tahu tree/chip id, hanya melapor lewat
// `onApply(patch)`; parent (SearchBar) yang memutuskan
// `updateChip`/`addLeafChip`/`onGroupChange`.

import {
  DATE_GROUP_GRANULARITIES,
  DEFAULT_NUMBER_GROUP_RANGE_OPTIONS,
} from "@/Components/Table/Table2";
import SearchableOptionList, {
  searchableOptionFilter,
} from "@/Components/Table/SearchableOptionList";
import { columnHasOptions, getOperators } from "../Filter/operators";
import { useMemo, useState } from "react";

import { Button } from "@/Components/ui/button";
import { Command } from "@/Components/ui/command";
import { Input } from "@/Components/ui/input";
import Select from "@/Components/Select";
import ValueField from "../Filter/ValueField";
import { useLaravelReactI18n } from "laravel-react-i18n";

// Sentinel "Tidak ada" -- sama seperti `NO_GROUP_VALUE` (DataTable2.jsx:96)
// & `searchSuggestions.js`. Didefinisikan lokal (bukan import dari Pages/)
// agar komponen ini tidak bergantung ke DataTable2.
const NO_GROUP_VALUE = "__no_group__";

const isDateColumn = (col) =>
  ["date", "time", "datetime"].includes(col?.type);
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
 * Editor chip `leaf` (edit existing ATAU draft baru). Label kolom TETAP
 * (Requirement 7.1) -- tidak ada picker kolom di sini, hanya operator +
 * ValueField. Ganti operator mereset value bila `valueInput`-nya beda
 * (mirror `FilterItem2.onOperatorsChanged`).
 * @param {object} root0
 * @param {object} root0.column
 * @param {string} [root0.initialOperator]
 * @param {*} [root0.initialValue]
 * @param {(patch: {k: string, o: string, v: *}) => void} root0.onApply
 * @param {(key: string, params?: object) => string} root0.t
 * @returns {React.JSX.Element}
 */
function LeafChipEditor({ column, initialOperator, initialValue, onApply, t }) {
  const operators = useMemo(
    () =>
      getOperators(column?.type, {
        typeRelation: column?.typeRelation,
        hasOptions: columnHasOptions(column),
      }),
    [column],
  );
  const operatorOptions = useMemo(() => Object.keys(operators), [operators]);
  const [operator, setOperator] = useState(
    () => initialOperator || operatorOptions[0] || "",
  );
  const [value, setValue] = useState(initialValue ?? "");

  const onOperatorChange = (val) => {
    const oldInput = operators[operator]?.valueInput;
    const newInput = operators[val]?.valueInput;
    setOperator(val);
    if (newInput !== oldInput) setValue("");
  };

  const apply = () => {
    if (!column?.name || !operator) return;
    onApply({ k: column.name, o: operator, v: value });
  };

  const title =
    column?.title ??
    (column?.titleTrans ? t(column.titleTrans) : column?.name);

  return (
    <div
      className="flex flex-col gap-2 w-64"
      onKeyDown={(e) => {
        if (e.key !== "Enter") return;
        e.preventDefault();
        apply();
      }}
    >
      <span className="text-sm font-medium">{title}</span>
      <Select
        value={operator}
        onValueChange={onOperatorChange}
        optionTrans="core.datatable.filter.operator"
        options={operatorOptions}
        placeholder={t("core.datatable.filter.select_operator")}
      />
      <ValueField
        column={column}
        operator={operator}
        value={value}
        onChange={setValue}
      />
      <Button
        type="button"
        size="sm"
        className="self-end"
        onClick={apply}
      >
        {t("core.datatable.search.apply")}
      </Button>
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
 * ChipEditor — popover body untuk chip `leaf` (termasuk draft leaf baru),
 * `search`, atau `group`.
 * @param {object} root0
 * @param {"leaf"|"search"|"group"} root0.kind
 * @param {object} [root0.column] kolom node (kind "leaf") -- WAJIB
 *   `column.name`; label kolom TETAP (tidak bisa diganti di editor).
 * @param {string} [root0.operator] operator awal (kind "leaf"; kosong ->
 *   default ke operator pertama, dipakai saat membuat draft leaf baru).
 * @param {*} [root0.value] value awal (kind "leaf"/"search"/"group").
 * @param {string[]} [root0.searchColumnTitles] label kolom yang dicari (kind
 *   "search", untuk info "Mencari di: ...").
 * @param {Array<{value: string, label: string}>} [root0.groupOptions] (kind "group")
 * @param {object} [root0.columns] peta kolom (kind "group", diteruskan ke `GroupPicker`)
 * @param {(patch: object) => void} root0.onApply
 * @returns {React.JSX.Element}
 */
export default function ChipEditor({
  kind,
  column,
  operator,
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

  if (kind === "search") {
    return (
      <SearchChipEditor
        initialValue={value}
        searchColumnTitles={searchColumnTitles ?? []}
        onApply={onApply}
        t={t}
      />
    );
  }

  return (
    <LeafChipEditor
      column={column}
      initialOperator={operator}
      initialValue={value}
      onApply={onApply}
      t={t}
    />
  );
}
