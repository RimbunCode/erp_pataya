// ChipEditor — popover body untuk mengedit chip Search Bar `search` (ganti
// teks) atau `group` (level grup bertingkat: checkbox + urutan + granularity/
// range per level -- GroupLevelsEditor, spec datatable2-group-tree). REVISI 2: chip `leaf`
// TIDAK lagi lewat sini -- edit nilai leaf memakai widget yang SAMA dgn
// membuat baru (mode value inline SearchBar, columnSearch.js), operator
// SELALU tetap, tanpa dialog/menu pemilihan operator (design.md §5.6, §7.1;
// Requirement 7.1-7.3, revisi "permudah pengguna, tanpa dialog operator").
// Komponen murni presentasional -- tidak tahu tree/chip id, hanya melapor
// lewat `onApply(patch)`; parent (SearchBar) yang memutuskan
// `updateChip`/`onGroupChange`.

import { useState } from "react";

import GroupLevelsEditor from "@/Components/Table/Group/GroupLevelsEditor";
import { Button } from "@/Components/ui/button";
import { Input } from "@/Components/ui/input";
import { useLaravelReactI18n } from "laravel-react-i18n";

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
 * @param {*} [root0.value] value awal: teks (kind "search") atau `Groups` (kind "group").
 * @param {string[]} [root0.searchColumnTitles] label kolom yang dicari (kind
 *   "search", untuk info "Mencari di: ...").
 * @param {Array<{value: string, label: string}>} [root0.groupOptions] (kind "group")
 * @param {object} [root0.columns] peta kolom (kind "group", diteruskan ke `GroupLevelsEditor`)
 * @param {(patch: *) => void} root0.onApply kind "search": `{v}`; kind "group": `Groups` baru
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
    // Perubahan diterapkan LANGSUNG ke draft group host (popover tetap terbuka
    // selama user mencentang/mengurutkan beberapa level).
    return (
      <GroupLevelsEditor
        columns={columns}
        options={groupOptions ?? []}
        value={value ?? []}
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
