import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/Components/ui/dialog";
import { useCallback, useEffect, useMemo, useState } from "react";

import FilterTable from "@/Components/Table/Filter/FilterTable2";
import {
  GroupHeaderCard,
  GroupNodeStatusCard,
} from "@/Components/Table/Group/GroupHeaderRow";
import GroupTree from "@/Components/Table/Group/GroupTree";
import { normalizeGroupLevels } from "@/Components/Table/Group/groupLevels";
import InfiniteScrollSentinel from "./InfiniteScrollSentinel";
import SearchBar from "@/Components/Table/Search/SearchBar";
import Table2 from "@/Components/Table/Table2";
import { TooltipProvider } from "@/Components/ui/tooltip";
import { addSearchChip } from "@/Components/Table/Search/searchChips";
import { compareLabels } from "@/lib/compareLabels";
import { createFilterItem } from "@/Hooks/useNestedFilters";
import { convertTemplateLink } from "@/lib/linkModelUtils";
import { isMetaAppendColumn } from "@/lib/utils";
import { resolveSearchColumns } from "@/Components/Table/Search/resolveSearchColumns";
import { trimToLinkModelPayload } from "./trimToLinkModelPayload";
import { useLaravelReactI18n } from "laravel-react-i18n";
import useAdvanceSearchModel, {
  fetchAdvanceGroupNode,
} from "./useAdvanceSearchModel";

const hasItems = (tree) => Object.keys(tree?.root?.c ?? {}).length > 0;

/**
 * Chip "Cari" dari teks carry-over. Satu kolom saja -> leaf `matches` biasa
 * (grup OR berisi 1 anak tak dikenali chip "Cari": itu yang biasanya dirapikan
 * `FilterTreeCleaner` saat persist, sedangkan dialog ini tak mem-persist).
 * @param {object|null} tree
 * @param {string} text
 * @param {string[]} columns kolom pencarian
 */
export const addCarryOverSearch = (tree, text, columns) => {
  if (columns.length !== 1) return addSearchChip(tree, text, columns);
  const root = tree?.root;

  return {
    root: {
      k: root?.k ?? "and",
      c: {
        ...(root?.c ?? {}),
        [`search-${Date.now()}`]: createFilterItem({
          k: columns[0],
          o: "matches",
          v: text.trim(),
        }),
      },
    },
  };
};

/**
 * Peta kolom utk SearchBar (chip, saran, Panel): bentuk yang sama dgn
 * `getColumns()` DataTable2 -- `title` terjemahan, `searchable` default true.
 * Kolom hidden/ignore/meta tak pernah tampil di UI.
 * @param {object} filterColumnMap peta kolom SEMUA schema (buildAdvanceSearchFilterColumnMap)
 * @param {(key: string) => string} t
 * @returns {{[name: string]: object}}
 */
export function buildSearchBarColumnMap(filterColumnMap, t) {
  const map = {};
  Object.values(filterColumnMap ?? {}).forEach((col) => {
    if (col.hidden || col.ignore || isMetaAppendColumn(col)) return;
    map[col.name] = {
      ...col,
      title: col.title ?? t(col.titleTrans),
      searchable: col.searchable ?? true,
    };
  });

  return map;
}

/**
 * Opsi Group by: kolom `groupable` yang AMAN (spec linkmodel-grouping-search
 * Requirement 3.1/6.7): relasi, kolom `linkable`, atau sumber templateLink --
 * server tetap menjadi gerbang sebenarnya, ini hanya menyaring tawaran UI.
 * @param {{[name: string]: object}} barColumns
 * @param {string[]} lockedColumnNames
 * @param {string} [locale]
 */
export function buildGroupOptions(barColumns, lockedColumnNames, locale) {
  return Object.values(barColumns)
    .filter(
      (col) =>
        col.groupable &&
        !["relations", "mixed", "json"].includes(col.type) &&
        (col.type === "relation" ||
          col.linkable === true ||
          lockedColumnNames.includes(col.name)),
    )
    .map((col) => ({ value: col.name, label: col.title }))
    .sort((a, b) => compareLabels(a.label, b.label, locale));
}

/**
 * AdvanceSearchDialog — dialog Advance Search / See More LinkModel. Tabel
 * (desktop) / list (mobile) hasil browse model target, kolom dibatasi ke
 * "kolom aman" (linkable-gated). Pencarian & filter lewat `SearchBar`
 * DataTable2 (chip, saran, Filter Tersimpan, Group by) -- chip = tree filter
 * additive (`props.filters` LinkModel tetap AND, tampil locked di Builder).
 * Grup bertingkat memakai `GroupTree` lazy (infinite scroll level-0).
 * Lihat design.md linkmodel-advanced-search & linkmodel-grouping-search.
 * @param {object} props
 * @param {boolean} props.open
 * @param {(open: boolean) => void} props.onOpenChange
 * @param {string} props.model
 * @param {object} [props.filters] prop `filters` LinkModel (non-editable, apa adanya)
 * @param {string[]} [props.fields] prop `fields` LinkModel
 * @param {object|Array} [props.joins]
 * @param {object|Array} [props.with]
 * @param {string} [props.order]
 * @param {string} [props.translate]
 * @param {string} [props.initialSearch] carry-over teks input LinkModel -> chip "Cari"
 * @param {Array} [props.group] grup awal dari prop `group` LinkModel (`undefined`
 *   = default model di server, `[]` = tanpa grup); diinisialisasi ulang tiap
 *   dialog dibuka, perubahan di panel hanya lokal dialog
 * @param {(row: object) => void} props.onSelect dipanggil dengan row yang SUDAH terpangkas (Requirement 7)
 * @returns {React.JSX.Element}
 */
export default function AdvanceSearchDialog({
  open,
  onOpenChange,
  model,
  filters,
  fields,
  joins,
  with: withParam,
  order,
  translate,
  initialSearch,
  group,
  onSelect,
}) {
  const { t, currentLocale } = useLaravelReactI18n();
  const locale = currentLocale?.();
  // Tree filter additive (chip SearchBar). `null` = tanpa filter.
  const [tree, setTree] = useState(null);
  // `undefined` = belum diubah user -> pakai `group` prop / default model.
  const [groupOverride, setGroupOverride] = useState(undefined);
  const [groupSort, setGroupSort] = useState("asc");
  // Teks carry-over yang belum jadi chip (kolom pencarian baru diketahui
  // setelah respons pertama); selama ada, dikirim sbg `search` biasa supaya
  // hasil tidak berkedip tak terfilter.
  const [pendingSearch, setPendingSearch] = useState(initialSearch ?? "");
  const [builderOpen, setBuilderOpen] = useState(false);
  const [builderDraft, setBuilderDraft] = useState(undefined);

  // Requirement 6 AC3 & linkmodel-grouping-search 7.2: re-init tiap kali dialog
  // DIBUKA (bukan sekali seumur hidup) -- nilai LinkModel terbaru terbawa.
  useEffect(() => {
    if (!open) return;
    setTree(null);
    setGroupOverride(undefined);
    setGroupSort("asc");
    setBuilderDraft(undefined);
    setPendingSearch(initialSearch ?? "");
  }, [open, initialSearch]);

  const groupProp = useMemo(
    () =>
      group === undefined || group === null
        ? undefined
        : normalizeGroupLevels(group),
    [group],
  );
  const requestGroup = groupOverride !== undefined ? groupOverride : groupProp;

  const {
    columnMap,
    filterColumnMap,
    lockedColumnNames,
    rows,
    rootItems,
    isGrouped,
    groupMeta,
    groupBaseParams,
    isLoading,
    isFetchingNextPage,
    hasNextPage,
    fetchNextPage,
  } = useAdvanceSearchModel({
    model,
    baseFilters: filters,
    additiveFilters: tree,
    search: pendingSearch,
    joins,
    with: withParam,
    order,
    translate,
    group: requestGroup,
    groupSort,
    open,
  });

  const barColumns = useMemo(
    () => buildSearchBarColumnMap(filterColumnMap, t),
    [filterColumnMap, t],
  );
  const groupOptions = useMemo(
    () => buildGroupOptions(barColumns, lockedColumnNames, locale),
    [barColumns, lockedColumnNames, locale],
  );

  // Kolom chip "Cari": kolom sumber templateLink bertipe string (sama dgn
  // pencarian bebas dropdown).
  const getSearchColumns = useCallback(
    () =>
      resolveSearchColumns({
        columns: barColumns,
        visibleNames: lockedColumnNames,
      }),
    [barColumns, lockedColumnNames],
  );

  // Carry-over `initialSearch` -> chip "Cari" begitu kolom diketahui.
  useEffect(() => {
    if (!pendingSearch.trim()) return;
    const cols = getSearchColumns();
    if (cols.length === 0) return;
    setTree((prev) => addCarryOverSearch(prev, pendingSearch, cols));
    setPendingSearch("");
  }, [pendingSearch, getSearchColumns]);

  // Grup yang ditampilkan di chip: pilihan user > grup efektif server (sudah
  // lolos gate kolom aman & berdefault) > prop sebelum respons pertama.
  const barGroups = useMemo(() => {
    if (groupOverride !== undefined) return groupOverride;
    if (groupMeta) {
      return groupMeta.levels.map(({ column, granularity, range }) => ({
        column,
        granularity,
        range,
      }));
    }

    return groupProp ?? [];
  }, [groupOverride, groupMeta, groupProp]);

  const onTreeChange = useCallback((next) => {
    setTree(hasItems(next) ? next : null);

    return Promise.resolve();
  }, []);
  const onGroupChange = useCallback((groups) => {
    setGroupOverride(normalizeGroupLevels(groups));
  }, []);
  const onPickSaved = useCallback((saved) => {
    if (!saved?.id) return;
    setTree(hasItems(saved.filter) ? saved.filter : null);
    const savedGroups = normalizeGroupLevels(saved.group);
    if (savedGroups.length > 0) setGroupOverride(savedGroups);
  }, []);
  const getViewSnapshot = useCallback(
    () => ({ sort: null, group: barGroups.length > 0 ? barGroups : null }),
    [barGroups],
  );

  const handlePick = (row) => {
    onSelect(
      trimToLinkModelPayload(row, {
        fields,
        templateLinkColumnNames: lockedColumnNames,
      }),
    );
    onOpenChange?.(false);
  };

  // Pohon grup: desktop -> Table2 (prop `group`), mobile -> GroupTree kartu.
  const groupTreeProps = useMemo(
    () =>
      isGrouped && groupBaseParams
        ? {
            levels: groupMeta.levels,
            aggregates: groupMeta.aggregates,
            baseParams: groupBaseParams,
            pathname: `advance-search:${model}`,
            resetKey: JSON.stringify(groupBaseParams),
            fetcher: fetchAdvanceGroupNode,
            infinite: true,
            version: 0,
            subLevelVersion: 0,
          }
        : null,
    [isGrouped, groupBaseParams, groupMeta, model],
  );

  const levelZeroSentinel = (
    <InfiniteScrollSentinel
      onIntersect={fetchNextPage}
      enabled={hasNextPage}
      loading={isFetchingNextPage}
    />
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-(--breakpoint-2xl)! w-auto! p-0">
        <TooltipProvider>
          <DialogHeader className="px-6 pt-6 mb-2 border-b border-muted-foreground/30">
            <DialogTitle>{t("core.form.linkmodel.advance_search")}</DialogTitle>
            <DialogDescription className="sr-only" />
          </DialogHeader>

          <div className="flex flex-col px-6 overflow-y-auto max-h-[80svh] gap-3">
            {/* Sticky -- search+filter tetap kelihatan pas hasil discroll
                (list bisa panjang, infinite scroll). bg-background solid
                supaya baris di bawahnya tidak transparan-tembus pas overlap. */}
            <div className="sticky top-0 z-10 bg-background pb-1 -mx-6 px-6 pt-1">
              <SearchBar
                columns={barColumns}
                tree={tree}
                onTreeChange={onTreeChange}
                getSearchColumns={getSearchColumns}
                model={model}
                onPickSaved={onPickSaved}
                getViewSnapshot={getViewSnapshot}
                group={barGroups}
                groupOptions={
                  groupOptions.length > 0 ? groupOptions : undefined
                }
                onGroupChange={
                  groupOptions.length > 0 ? onGroupChange : undefined
                }
                groupSort={groupSort}
                onGroupSortChange={
                  groupOptions.length > 0
                    ? (direction) =>
                        setGroupSort(direction === "desc" ? "desc" : "asc")
                    : undefined
                }
                onOpenBuilder={(draftTree) => {
                  setBuilderDraft(draftTree ?? null);
                  setBuilderOpen(true);
                }}
                placeholder={t("core.form.search.placeholder")}
              />
              {/* Builder lanjutan (FilterTable2 controlled, tanpa trigger):
                  `lockedFilters` = prop `filters` LinkModel, read-only. */}
              <FilterTable
                columns={filterColumnMap}
                initialFilters={
                  builderDraft !== undefined ? builderDraft : tree
                }
                lockedFilters={filters}
                onApply={(next) => setTree(hasItems(next) ? next : null)}
                model={model}
                open={builderOpen}
                onOpenChange={setBuilderOpen}
              />
            </div>

            {/* Desktop: tabel kolom aman (grup -> GroupTree di dalam Table2). */}
            <div className="hidden lg:block">
              <Table2
                columns={columnMap}
                data={isGrouped ? rootItems : rows}
                isLoading={isLoading}
                isDynamicData
                persistColumns={false}
                onRowClick={handlePick}
                group={groupTreeProps ?? undefined}
              />
              {levelZeroSentinel}
            </div>

            {/* Mobile: list templateLink, sumber data sama (CSS-toggle, bukan query beda). */}
            <div className="lg:hidden flex flex-col divide-y divide-muted-foreground/20">
              {groupTreeProps ? (
                <GroupTree
                  key={groupTreeProps.resetKey}
                  rootItems={rootItems}
                  levels={groupTreeProps.levels}
                  baseParams={groupTreeProps.baseParams}
                  pathname={groupTreeProps.pathname}
                  fetcher={groupTreeProps.fetcher}
                  infinite
                  renderGroupHeader={(args) => (
                    <GroupHeaderCard
                      {...args}
                      columnMeta={columnMap[args.level?.column]}
                      aggregates={groupTreeProps.aggregates}
                      columns={columnMap}
                    />
                  )}
                  renderRow={(row) => (
                    <MobileRow key={row.id} row={row} onPick={handlePick} />
                  )}
                  renderLoading={({ depth }) => (
                    <GroupNodeStatusCard depth={depth} />
                  )}
                  renderError={({ depth, onRetry }) => (
                    <GroupNodeStatusCard
                      depth={depth}
                      error
                      onRetry={onRetry}
                    />
                  )}
                />
              ) : (
                rows.map((row, i) => (
                  <MobileRow key={row.id ?? i} row={row} onPick={handlePick} />
                ))
              )}
              {levelZeroSentinel}
            </div>
          </div>
        </TooltipProvider>
      </DialogContent>
    </Dialog>
  );
}

function MobileRow({ row, onPick }) {
  return (
    <button
      type="button"
      onClick={() => onPick(row)}
      className="text-left py-2.5 hover:bg-accent/50"
    >
      <span
        dangerouslySetInnerHTML={{
          // search dipaksa "" (bukan diomit) -- convertTemplateLink
          // hanya HTML-escape nilai kolom di jalur ini (search!=null);
          // diomit balik ke plain-text unescaped (unescapeHtml), TIDAK
          // aman utk dangerouslySetInnerHTML. Pola sama LinkModel.jsx
          // dropdown (`convertTemplateLink(opt, search ?? "")`).
          __html: convertTemplateLink(row, ""),
        }}
      />
    </button>
  );
}
