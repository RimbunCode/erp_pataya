import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "./ui/dialog";
import { forwardRef, memo, useCallback, useMemo } from "react";
import useSelectModel from "./SelectModel/useSelectModel";

import { Button } from "./ui/button";
import FilterBuilder from "./Table/Filter/FilterBuilder";
import FormInput from "./FormInput";
import Pagination from "./Table/Pagination";
import Select from "./Select";
import Table2 from "./Table/Table2";
import { TooltipProvider } from "./ui/tooltip";
import axios from "axios";
import { cn } from "@/lib/utils";
import { gooeyToast } from "@/lib/gooeyToast";
import { useLaravelReactI18n } from "laravel-react-i18n";

/**
 * @typedef {object} SelectModelConfig
 * @property {string[]} [columns]              Kolom default visible model induk.
 * @property {LinkModelFilterTree} [filters]   Filter default model induk (NON-EDITABLE, lihat typedef di bawah).
 * @property {{[modelClass: string]: { filters?: LinkModelFilterTree, columns?: string[] }}} [selects]
 *           Konfigurasi ekstraksi relasi (plural `selects`; singular `select` TIDAK didukung).
 * @property {{[target: string]: string}} [columnAlias]  Alias kolom hasil (target → source) sebelum onSelected.
 */

/**
 * Filter deklaratif NON-EDITABLE untuk membatasi record sumber, memakai grammar
 * tree LinkModel (sama dengan prop `filters` pada komponen LinkModel). Dikirim ke
 * backend sebagai param `baseFilters` (apa adanya, TANPA konversi FE) dan diterapkan
 * via LinkModelFilterConverter → FilterEvaluator, di-AND dengan filter editable user.
 *
 * NON-EDITABLE: filter ini TIDAK ditampilkan / tidak di-load ke FilterBuilder.
 *
 * Bentuk:
 *   - Map kolom→nilai. Nilai scalar = operator "=" (shorthand).
 *   - Nilai objek = { <operator>: <value> } untuk operator eksplisit (AND antar-operator).
 *   - Key "and"/"or" = grup boolean berisi sub-tree.
 *   - Key "relation.column" atau "relation": { ... } = filter pada relasi (whereHas).
 *
 * Operator (penuh — via FilterEvaluator):
 *   "=" | "==" | "equal" (default) · "!=" | "not" | "notEqual" ·
 *   ">" | ">=" | "<" | "<=" · "in" | "notIn" (array) · "between" | "notBetween" ([min,max]) ·
 *   "like" | "notLike" · "jsonContains" | "jsonDoesntContains" (formStatuses) ·
 *   "column" (value: nama kolom lain) · "and" | "or" (grup pada satu kolom).
 *   Kolom date/datetime: operator komparasi otomatis dibungkus jadi in_period.
 * @typedef {{[column: string]: unknown}} LinkModelFilterTree
 * @example <caption>shorthand equal</caption>
 * { status: "submitted" }                         // status = 'submitted'
 * @example <caption>operator eksplisit</caption>
 * { required_quantity: { ">": 0 } }                // required_quantity > 0
 * { submitted_at: { not: null } }                  // submitted_at != null
 * @example <caption>grup boolean</caption>
 * { or: { status: "submitted", code: { like: "WO" } } }
 * @example <caption>filter pada relasi (whereHas)</caption>
 * { "items.required_quantity": { ">": 0 } }
 * @see resources/js/lib/linkModelUtils.js (validate / validateWithOperators)
 * @see resources/js/lib/linkModelToFilterTree.js (helper konversi FE)
 * @see app/Services/Core/LinkModelFilterConverter.php (konverter BE)
 * @see app/Services/Core/FilterEvaluator.php (engine query)
 */

/**
 * SelectModel — dialog memilih record dari model Eloquent lain lalu mengimpor ke
 * form saat ini. Tiga mode: direct (row model langsung), self-extraction (pilih
 * induk → ekstrak child), per-item (centang item spesifik lintas parent).
 * @param {object} props
 * @param {string} [props.title]
 * @param {string} props.label
 * @param {"secondary"|"primary"|"outline"} [props.variant]
 * @param {"sm"|"lg"} [props.size]
 * @param {string} [props.className]
 * @param {string|{[modelClass: string]: SelectModelConfig}} props.from
 *        String (single model class) ATAU objek `{ [modelClass]: SelectModelConfig }`.
 * @param {(payload: {
 *   items: Array<object>, model: string,
 *   mode: "direct"|"self-extraction"|"per-item",
 *   sourceModel: string|null, sourceIds: Array|null,
 * }) => void} props.onSelected
 */
export default memo(
  forwardRef(function SelectModel(
    {
      title,
      label,
      variant = "secondary",
      size = "sm",
      className,
      from,
      onSelected,
    },
    ref,
  ) {
    const { t } = useLaravelReactI18n();
    const {
      open,
      setOpen,
      loading,
      activeModel,
      setActiveModel,
      activeView,
      setActiveView,
      columnMap,
      data,
      pagination,
      perPage,
      setPerPage,
      setPage,
      sort,
      setSort,
      resetSorting,
      userFilters,
      setUserFilters,
      applyFilters,
      clearFilters,
      modelOptions,
      viewOptions,
      selectedCount,
      confirmSelection,
      tableRef,
      perPageOptions,
    } = useSelectModel({ from, onSelected });

    // Table2/Header memanggil setSort(name, order?) — terjemahkan ke string sort
    // canonical (prefix "-" = desc) yang dipahami backend & hook.
    const handleSort = useCallback(
      (name, order) => {
        const currentKey = sort?.startsWith("-") ? sort.slice(1) : sort;
        const currentOrder =
          sort?.startsWith("-") || sort === currentKey ? "desc" : "asc";
        const nextOrder =
          order ??
          (currentKey === name && currentOrder === "asc" ? "desc" : "asc");
        setSort(nextOrder === "asc" ? name : `-${name}`);
      },
      [sort, setSort],
    );

    // Table2 wiring: options.{sort,page} controlled; perubahan page lewat
    // onOptionsChanged. persistColumns=false + isDynamicData → skipCookie.
    const tableOptions = useMemo(
      () => ({ sort, page: pagination.currentPage }),
      [sort, pagination.currentPage],
    );

    const handleOptionsChanged = useCallback(
      (next) => {
        if (next?.page && next.page !== pagination.currentPage) {
          setPage(next.page);
        }
      },
      [pagination.currentPage, setPage],
    );

    const showModelSelector = modelOptions.length > 1;
    const showViewSelector = viewOptions.length > 0;

    return (
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger ref={ref} asChild onClick={() => setOpen(true)}>
          <Button
            type="button"
            variant={variant}
            size={size}
            className={cn(className)}
          >
            {label}
          </Button>
        </DialogTrigger>
        <DialogContent className="max-w-(--breakpoint-2xl)! w-auto! p-0">
          <TooltipProvider>
            <DialogHeader className="px-6 pt-6 mb-2 border-b border-muted-foreground/30">
              <DialogTitle className="flex items-center mb-1 gap-x-2">
                {title ?? t("core.form.select_model")}
              </DialogTitle>
              <DialogDescription className="sr-only" />
            </DialogHeader>

            <div className="flex flex-col px-6 overflow-y-auto max-h-screen">
              {(showModelSelector || showViewSelector) && (
                <div className="grid grid-cols-2 px-1 pb-4 my-2 border-b gap-x-3 border-muted-foreground/30">
                  {showModelSelector && (
                    <FormInput label={t("core.form.from")} required>
                      <Select
                        value={activeModel}
                        onValueChange={setActiveModel}
                        options={modelOptions}
                        placeholder={t("core.form.model.placeholder")}
                      />
                    </FormInput>
                  )}
                  {showViewSelector && (
                    <FormInput label={t("core.form.select")} required>
                      <Select
                        value={activeView}
                        onValueChange={setActiveView}
                        options={viewOptions}
                        placeholder={t("core.form.select.placeholder")}
                      />
                    </FormInput>
                  )}
                </div>
              )}

              <div className="py-2 border-b border-muted-foreground/30">
                <FilterBuilder
                  columns={columnMap}
                  value={userFilters}
                  onChange={setUserFilters}
                />
                <div className="flex justify-end mt-2 gap-x-2">
                  <Button
                    variant="secondary"
                    className="h-8 px-2!"
                    onClick={clearFilters}
                  >
                    {t("core.datatable.filter.clear_filters")}
                  </Button>
                  <Button className="h-8 px-2!" onClick={applyFilters}>
                    {t("core.datatable.filter.apply_filters")}
                  </Button>
                </div>
              </div>

              <Table2
                ref={tableRef}
                selectable
                persistColumns={false}
                isDynamicData
                className="flex-1"
                columns={columnMap}
                data={data}
                isLoading={loading}
                options={tableOptions}
                setSort={handleSort}
                resetSorting={resetSorting}
                onOptionsChanged={handleOptionsChanged}
              />

              <div className="flex items-center justify-between py-2 border-t border-muted-foreground/30">
                <Select
                  value={String(perPage)}
                  onValueChange={(v) => setPerPage(Number(v))}
                  options={perPageOptions.map((n) => ({
                    value: String(n),
                    label: String(n),
                  }))}
                />
                <div className="flex items-center gap-2">
                  <Pagination
                    currentPage={pagination.currentPage}
                    totalPages={pagination.lastPage}
                    onPageChanged={setPage}
                  />
                  <span className="text-sm text-muted-foreground">
                    {t("core.datatable.total")}: {pagination.total}
                  </span>
                </div>
              </div>
            </div>

            <DialogFooter className="px-6 pb-6 mt-2">
              <Button
                type="button"
                variant="outline"
                size="lg"
                className="h-8 mt-2 sm:mt-0 p-2 size-fit"
                onClick={() => setOpen(false)}
              >
                {t("core.form.cancel")}
              </Button>
              <Button
                type="button"
                variant="primary"
                size="lg"
                className="h-8 p-2 size-fit"
                onClick={confirmSelection}
              >
                {t("core.form.select")}
                {selectedCount > 0 ? ` (${selectedCount})` : ""}
              </Button>
            </DialogFooter>
          </TooltipProvider>
        </DialogContent>
      </Dialog>
    );
  }),
);

/**
 * Muat data dari model by-ID tanpa membuka dialog (deep-link import). Payload
 * return diselaraskan dengan onSelected sehingga konsumen dapat memanggil
 * `mergeItems(result)` langsung.
 * @param {string} model               Class model Eloquent (FQCN).
 * @param {string|number} id           ID record induk.
 * @param {string|null} select         Nama relasi (null → direct/SELF).
 * @param {(key: string) => string} t  Fungsi translate (required, untuk i18n error).
 * @returns {Promise<{
 *   items: Array<object>, model: string,
 *   mode: "direct"|"self-extraction",
 *   sourceModel: string|null, sourceIds: Array|null,
 * } | null>}  null bila gagal (konsumen guard sebelum mergeItems).
 */
export const loadFromModel = async (model, id, select, t) => {
  try {
    // by-id via baseFilters (tree LinkModel) { id } — konsisten dgn kanal
    // baseFilters, tanpa bergantung cabang `id` macro.
    const res = await axios.post(window.route("model.selectData"), {
      model,
      select: select ?? undefined,
      baseFilters: { id },
      with: select ? [select] : undefined,
      show: 1,
      page: 1,
    });
    const rows = res.data?.data?.data ?? [];
    const resolved = res.data?.model ?? model;

    if (!select) {
      return {
        items: rows,
        model: resolved,
        mode: "direct",
        sourceModel: null,
        sourceIds: null,
      };
    }
    return {
      items: rows.flatMap((r) => r[select] ?? []),
      model: resolved,
      mode: "self-extraction",
      sourceModel: model,
      sourceIds: [id],
    };
  } catch (_error) {
    gooeyToast.error(t("core.errors.fetch_failed"));
    return null;
  }
};
