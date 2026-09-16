import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/Components/ui/dialog";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
} from "@/Components/ui/input-group";
import { useEffect, useMemo, useState } from "react";

import FilterTable from "@/Components/Table/Filter/FilterTable2";
import { Filter } from "lucide-react";
import InfiniteScrollSentinel from "./InfiniteScrollSentinel";
import Table2 from "@/Components/Table/Table2";
import { TooltipProvider } from "@/Components/ui/tooltip";
import { convertTemplateLink } from "@/lib/linkModelUtils";
import { flattenFilters } from "@/Hooks/useNestedFilters";
import { trimToLinkModelPayload } from "./trimToLinkModelPayload";
import { useLaravelReactI18n } from "laravel-react-i18n";
import useAdvanceSearchModel from "./useAdvanceSearchModel";

/**
 * AdvanceSearchDialog — dialog Advance Search / See More LinkModel. Tabel
 * (desktop) / list (mobile) hasil browse model target, kolom dibatasi ke
 * "kolom aman" (linkable-gated), filter tambahan via FilterTable (additive,
 * `props.filters` LinkModel tetap AND, ditampilkan locked/read-only di
 * dalamnya), infinite scroll. Lihat design.md linkmodel-advanced-search.
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
 * @param {string} [props.initialSearch] carry-over dari state `search` LinkModel (Requirement 6)
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
  onSelect,
}) {
  const { t } = useLaravelReactI18n();
  const [search, setSearch] = useState(initialSearch ?? "");
  const [additiveFilters, setAdditiveFilters] = useState(null);

  // Requirement 6 AC3: re-init tiap kali dialog DIBUKA (bukan sekali seumur
  // hidup komponen) -- nilai LinkModel terbaru harus terbawa tiap buka ulang.
  useEffect(() => {
    if (open) setSearch(initialSearch ?? "");
  }, [open, initialSearch]);

  const {
    columnMap,
    lockedColumnNames,
    rows,
    isLoading,
    isFetchingNextPage,
    hasNextPage,
    fetchNextPage,
  } = useAdvanceSearchModel({
    model,
    baseFilters: filters,
    additiveFilters,
    search,
    joins,
    with: withParam,
    order,
    translate,
    open,
  });

  const activeAdditiveCount = useMemo(
    () => flattenFilters(additiveFilters?.root?.c ?? {}).length,
    [additiveFilters],
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
              <InputGroup>
                <InputGroupAddon align="inline-start">
                  <FilterTable
                    columns={columnMap}
                    initialFilters={additiveFilters}
                    lockedFilters={filters}
                    onApply={setAdditiveFilters}
                    model={model}
                    trigger={
                      <InputGroupButton
                        type="button"
                        variant={
                          activeAdditiveCount > 0 ? "secondary" : "ghost"
                        }
                        className="relative"
                      >
                        <Filter />
                        {activeAdditiveCount > 0 && (
                          <span className="inline-flex min-w-4.5 items-center justify-center rounded-full bg-primary px-1.5 text-xs font-semibold text-primary-foreground">
                            {activeAdditiveCount}
                          </span>
                        )}
                      </InputGroupButton>
                    }
                  />
                </InputGroupAddon>
                <InputGroupInput
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder={t("core.form.search.placeholder")}
                />
              </InputGroup>
            </div>

            {/* Desktop: tabel kolom aman. */}
            <div className="hidden lg:block">
              <Table2
                columns={columnMap}
                data={rows}
                isLoading={isLoading}
                isDynamicData
                persistColumns={false}
                onRowClick={handlePick}
              />
              <InfiniteScrollSentinel
                onIntersect={fetchNextPage}
                enabled={hasNextPage}
                loading={isFetchingNextPage}
              />
            </div>

            {/* Mobile: list templateLink, sumber data sama (CSS-toggle, bukan query beda). */}
            <div className="lg:hidden flex flex-col divide-y divide-muted-foreground/20">
              {rows.map((row, i) => (
                <button
                  key={row.id ?? i}
                  type="button"
                  onClick={() => handlePick(row)}
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
              ))}
              <InfiniteScrollSentinel
                onIntersect={fetchNextPage}
                enabled={hasNextPage}
                loading={isFetchingNextPage}
              />
            </div>
          </div>
        </TooltipProvider>
      </DialogContent>
    </Dialog>
  );
}
