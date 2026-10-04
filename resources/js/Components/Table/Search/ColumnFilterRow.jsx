// ColumnFilterRow — Baris Filter Kolom: `<tr>` kedua di `<thead>` `Table2`
// berisi satu Sel Filter per kolom tampil (spec datatable2-column-search-row,
// Requirement 1). Sel kosong pengisi untuk kolom checkbox/aksi supaya sel lain
// tetap sejajar dgn header (grid `display: contents` di table.css). Chip draft
// (`treeToChips`) dan penanda "dipakai di filter lanjutan" dihitung SEKALI di
// sini lalu dioper ke sel -- bukan N kali.

import { columnsUsedInAdvanced } from "./columnBadges";
import { getLocaleDate } from "@/lib/utils";
import { buildPeriodI18nLabels } from "../Filter/periodParsing";
import { treeToChips } from "./searchChips";
import { useMemo } from "react";

import ColumnFilterCell from "./ColumnFilterCell";
import { useLaravelReactI18n } from "laravel-react-i18n";

/**
 * @param {object} p
 * @param {Array<{name: string}>} p.showedColumns kolom tampil (urutan = header)
 * @param {boolean} [p.selectable] ada kolom checkbox
 * @param {boolean} [p.actions] ada kolom aksi
 * @param {{columns: object, draft: object, onOpenBuilder?: (draftTree: object|null) => void}} p.columnFilter
 * @returns {React.JSX.Element}
 */
export default function ColumnFilterRow({
  showedColumns,
  selectable,
  actions,
  columnFilter,
}) {
  const { t, currentLocale } = useLaravelReactI18n();
  const { columns, draft, onOpenBuilder } = columnFilter;

  const dateLocale = useMemo(
    () => getLocaleDate(currentLocale?.()),
    [currentLocale],
  );
  const monthsShort = useMemo(
    () => buildPeriodI18nLabels({ t, dateLocale }).monthsShort,
    [t, dateLocale],
  );
  const chips = useMemo(
    () => treeToChips(draft.draftTree, columns, t, { monthsShort }),
    [draft.draftTree, columns, t, monthsShort],
  );
  const advancedUsed = useMemo(() => columnsUsedInAdvanced(chips), [chips]);

  const cellClass =
    "bg-muted py-1! px-1! border-r border-muted-foreground/15 items-stretch";

  return (
    <tr data-testid="column-filter-row" data-column-filter-row>
      {selectable && <th aria-hidden="true" className={cellClass} />}
      {actions && <th aria-hidden="true" className={cellClass} />}
      {showedColumns.map((col) => (
        <th key={col.name} className={cellClass}>
          <ColumnFilterCell
            column={columns?.[col.name] ?? col}
            columns={columns}
            draft={draft}
            chips={chips}
            advancedUsed={advancedUsed}
            monthsShort={monthsShort}
            onOpenBuilder={onOpenBuilder}
          />
        </th>
      ))}
    </tr>
  );
}
