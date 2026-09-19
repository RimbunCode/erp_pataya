import {
  ArrowDownWideNarrow,
  ArrowUpNarrowWide,
  Ellipsis,
  Layers,
  Plus,
  RefreshCw,
  Trash2Icon,
  X,
} from "lucide-react";
import { Button, buttonVariants } from "@/Components/ui/button";
import { Command } from "@/Components/ui/command";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/Components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuPortal,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/Components/ui/dropdown-menu";
import { Head, router, usePage } from "@inertiajs/react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/Components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/Components/ui/select";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/Components/ui/tooltip";
import {
  cloneElement,
  forwardRef,
  memo,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from "react";
import { cn, getCookieByName, isMetaAppendColumn } from "@/lib/utils";

import AppLayout from "@/Layouts/AppLayout";
import FilterTable2 from "@/Components/Table/Filter/FilterTable2";
import { FormPageDialog } from "./FormPage";
import { Label } from "@/Components/ui/label";
import NoDataImg from "@/Components/Table/NoDataImg";
import Pagination from "@/Components/Table/Pagination";
import QueryString from "qs";
import React from "react";
import { ScrollArea } from "@/Components/ui/scroll-area";
import SearchableOptionList, {
  searchableOptionFilter,
} from "@/Components/Table/SearchableOptionList";
import Table2, {
  DATE_GROUP_GRANULARITIES,
  DEFAULT_NUMBER_GROUP_RANGE_OPTIONS,
} from "@/Components/Table/Table2";
import axios from "axios";
import { compareLabels } from "@/lib/compareLabels";
import { createFilterGroup, createFilterItem } from "@/Hooks/useNestedFilters";
import pluralize from "pluralize";
import { gooeyToast as toast } from "@/lib/gooeyToast";
import useDeleteModal from "@/Hooks/useDeleteModal";
import useDidMountEffect from "@/Hooks/useDidMountEffect";
import { useIsMobile } from "@/Hooks/use-mobile";
import { useLaravelReactI18n } from "laravel-react-i18n";
import usePermission from "@/Hooks/usePermission";

// Radix Select menolak SelectItem dengan value="" (dipakai internal utk
// clear/reset) -- sentinel non-kosong ini dikonversi balik ke null di
// onValueChange sebelum masuk options.group.
const NO_GROUP_VALUE = "__no_group__";

/**
 * @namespace DataTable
 */
/**
 * @typedef {object} CellProps
 * @property {object} dataRow
 * @property {string} valueCell
 * @callback CellCallback
 * @param {CellProps} props
 * @returns {React.JSX.Element}
 */
/**
 * @typedef {object} ActionProps
 * @property {object} dataRow
 * @callback ActionCallback
 * @param {ActionProps} props
 * @returns {React.JSX.Element}
 */
/**
 * @typedef {object} TemplateItemProps
 * @property {object} dataRow
 * @callback TemplateItemCallback
 * @param {ActionProps} props
 * @returns {React.JSX.Element}
 */
/**
 * @typedef {object} ColumnProps
 * @property {string} name Cocokan saja dengan nama column pada database
 * @property {string} titleTrans
 * @property {'text' | 'number' | 'boolean' | 'date' | string[]} searchType
 * @property {'grow' | 'fit' | string | null} width
 * @property {boolean} sortable
 * @property {boolean} resizeable
 * @property {boolean} show default is true
 * @property {string} parseTrans mirip seperti "parse", pada properti ini akan mengacu pada file locale
 * - contoh: parseTrans: "core.form.parse"
 *
 * ini akan terkonversi menjadi { true: "core.form.parse.true", false: "core.form.parse.false" } bergantung pada attribute pada kolom tersebut
 * @property {object?} parse untuk konversi value sebelum ditampilkan
 * - contoh: { true: "Enabled", false: "Disabled" }
 * - Ini dapat berdampak pada filter jika searchType berupa boolean atau string[]
 * - Ini dapat berdampak pada valueCell yang ada pada CellCallback
 * @property {CellCallback} cell
 */
/**
 * @typedef {object} ActionProps
 * @property {object} row
 */
/**
 * @typedef {object} AddButtonProps
 * @property {string} title
 * @property {React.MouseEvent} onClick
 */

/**
 * @typedef {object} props
 * @property {ColumnProps[]} columns
 * @property {ActionCallback} actions
 * @property {TemplateItemCallback} templateItem akan ditampilkan saat mode mobile
 * @property {string} title
 * @property {AddButtonProps} addButton
 */

/**
 * @type {React.ForwardRefRenderFunction<HTMLDivElement, props>}
 */
export default memo(
  forwardRef(function DataTable2(
    {
      form,
      defaultValueForm,
      classNameDialog,
      actions: _actions,
      templateItem,
      usePasswordConfirmationForDelete,
      forceCanCreate,
    },
    ref,
  ) {
    const isMobile = useIsMobile();
    const { t, currentLocale } = useLaravelReactI18n();
    // `?.` -- ratusan test page me-mock i18n cuma dgn `t` (tanpa currentLocale);
    // di app nyata currentLocale selalu ada.
    const locale = currentLocale?.();
    const query = usePage().props.ziggy.query;
    const { deleteItem } = useDeleteModal();
    const {
      data,
      defaultSort,
      defaultFilterId,
      dataTableColumns,
      translateKey,
      model,
      name,
      groupCounts,
      defaultGroup,
    } = usePage().props;
    const { can } = usePermission(model);
    const canCreate = forceCanCreate || can("create");
    const { num_per_page: numPerPage, per_page_options: perPageOptions } =
      usePage().props?.preferences ?? {
        num_per_page: 25,
        per_page_options: [25, 50, 100],
      };
    // `show` dibaca dengan prioritas: query param `?show` > cookie > preference.
    // Disimpan di `options` agar ikut ke URL & memicu reload otomatis.
    const initialShow =
      query?.show ?? getCookieByName("datatable_show") ?? numPerPage;
    const [options, setOptions] = useState({
      sort: query?.sort ?? defaultSort,
      // Tanpa ?fid= eksplisit: pakai default shared filter (Filter Templates)
      // bila ada. Hanya dievaluasi sekali saat mount — perubahan filter
      // eksplisit oleh user setelahnya tidak pernah "dipaksa balik" ke sini.
      fid: query?.fid ?? defaultFilterId ?? null,
      page: query?.page ?? 1,
      show: initialShow,
      // `?group=` KOSONG ("") = user sengaja "Tidak ada" -> `??` sengaja tak
      // menimpanya dgn defaultGroup (default model dari BE, lihat setGroup).
      group: query?.group ?? defaultGroup ?? null,
      // Bucket grup date/time/datetime (day/month/quarter/half/year) & number/
      // currency (lebar range) -- lihat setGroup(). null kalau kolom grup
      // aktif bukan tipe bucket (mis. string/relation/boolean).
      groupGranularity: query?.groupGranularity ?? null,
      groupRange: query?.groupRange ?? null,
    });
    const show = options.show;
    // Kalau `show` (mis. dari query param) tak ada di daftar preference, paksa
    // tambahkan ke daftar (frontend saja) agar Select punya item yang cocok.
    const effectivePerPageOptions = useMemo(() => {
      const showNum = Number(show);
      const base = perPageOptions.map(Number);
      if (!Number.isNaN(showNum) && !base.includes(showNum)) {
        base.push(showNum);
      }
      return base.sort((a, b) => a - b);
    }, [perPageOptions, show]);
    // Tree filter aktif (untuk seed builder). TIDAK ikut ke URL — hanya `fid`.
    const [filterTree, setFilterTree] = useState(null);
    const { user } = usePage().props.auth;
    const dialogRef = useRef();

    const actions = useCallback(
      (props) => {
        if (
          props.dataRow.canDelete === false ||
          !can("delete", { user_id: props.dataRow?.created_by_id })
        )
          return _actions?.(props);
        return (
          <>
            <Button
              variant="destructive"
              size="icon"
              className="size-8"
              onClick={() =>
                deleteItem(
                  `${pluralize.plural(name ?? "")}.destroy`,
                  props.dataRow.id,
                  {
                    usePasswordConfirmation: usePasswordConfirmationForDelete,
                  },
                )
              }
            >
              <Trash2Icon />
            </Button>
            {_actions?.(props)}
          </>
        );
      },
      [_actions, name, model, user],
    );
    // const [columns] = useState(
    //   _columns.findIndex((x) => x.name === "created_at") > -1
    //     ? _columns
    //     : [
    //         ..._columns,
    //         {
    //           name: "created_at",
    //           titleTrans: "user.user.columns.created_at",
    //           searchType: "date",
    //           width: "fit",
    //           sortable: true,
    //           show: false,
    //           cell: ({ dataRow }) => {
    //             return (
    //               <span>
    //                 {format(new TZDate(dataRow.created_at, "UTC"), "PPPp", {
    //                   locale: getLocaleDate(lang),
    //                 })}
    //               </span>
    //             );
    //           },
    //         },
    //       ],
    // );
    const getColumns = useCallback(
      (t, columns, parentColumn) => {
        let newColumns = {};
        Object.values(columns ?? {}).forEach((col) => {
          // FK/ignored cols (flag hidden/ignore) & meta appends tak pernah
          // dirender di UI — skip di hulu agar tabel, Sort list, &
          // ColumnsFilter semua bersih.
          if (col.hidden || col.ignore || isMetaAppendColumn(col)) return;
          const title = col.title ?? t(col.titleTrans);
          const colName = !parentColumn
            ? col.name
            : `${parentColumn.name}.${col.name}`;

          const currentColumn = {
            ...col,
            name: colName,
            title: title,
            show: !parentColumn ? (col.show ?? false) : false,
            searchable: col.searchable ?? true,
            parentCol: parentColumn,
            sortable: !parentColumn ? (col.sortable ?? true) : false,
            resizeable: col.resizeable ?? true,
            route:
              col.isLink && !parentColumn
                ? `${pluralize.plural(name ?? "")}.show`
                : col.route,
          };
          newColumns[colName] = currentColumn;
          if (col.type == "relation" && col.columns) {
            newColumns[colName].columns = getColumns(
              t,
              col.columns,
              newColumns[colName],
            );
          }
        });
        return newColumns;
      },
      [name],
    );

    const [mapColumns, columns] = useMemo(() => {
      const newColumns = getColumns(t, dataTableColumns);
      return [newColumns, Object.values(newColumns)];
    }, [dataTableColumns, t]);
    const groupableColumns = useMemo(
      () => columns.filter((x) => x.groupable),
      [columns],
    );
    // Sort By & Group by: state buka/tutup Popover (desktop) & Dialog
    // (mobile, dipicu dari DropdownMenuItem di menu Ellipsis) -- ditutup
    // manual di onValueChange SearchableOptionList setelah pilih.
    const [sortPopoverOpen, setSortPopoverOpen] = useState(false);
    const [sortDialogOpen, setSortDialogOpen] = useState(false);
    const [groupPopoverOpen, setGroupPopoverOpen] = useState(false);
    const [groupDialogOpen, setGroupDialogOpen] = useState(false);
    const sortableColumnOptions = useMemo(
      () =>
        columns
          .filter(
            (x) =>
              x.sortable &&
              x.type != "relations" &&
              x.type != "mixed" &&
              x.type != "json",
          )
          .map((x) => ({ value: x.name, label: x.title ?? t(x.titleTrans) }))
          .sort((a, b) => compareLabels(a.label, b.label, locale)),
      [columns, t, locale],
    );
    // "Tidak ada" tetap paling atas, kolom sisanya diurut abjad.
    const groupOptions = useMemo(
      () => [
        { value: NO_GROUP_VALUE, label: t("core.datatable.no_grouping") },
        ...groupableColumns
          .map((x) => ({
            value: x.name,
            label: x.title ?? t(x.titleTrans),
          }))
          .sort((a, b) => compareLabels(a.label, b.label, locale)),
      ],
      [groupableColumns, t, locale],
    );
    const groupColumnLabel =
      groupOptions.find((x) => x.value === (options.group || NO_GROUP_VALUE))
        ?.label ?? t("core.datatable.no_grouping");
    // Kolom grup aktif -- dipakai utk nampilkan selector granularity (date/
    // time/datetime) atau range (number/currency) tambahan di sebelah
    // "Group by", sama seperti Sort By dgn tombol arah asc/desc-nya.
    const activeGroupColumn = options.group ? mapColumns[options.group] : null;
    const isActiveGroupDate = ["date", "time", "datetime"].includes(
      activeGroupColumn?.type,
    );
    const isActiveGroupNumber = ["number", "currency"].includes(
      activeGroupColumn?.type,
    );
    const activeGroupRangeOptions =
      activeGroupColumn?.groupRangeOptions ??
      DEFAULT_NUMBER_GROUP_RANGE_OPTIONS;

    const loadData = useCallback(() => {
      router.get(
        window.location.pathname +
          "?" +
          // skipNulls -- option null (group/fid/groupGranularity/dst saat
          // tidak aktif) dihilangkan dari querystring, bukan tampil sbg
          // `key=` kosong yang mengotori URL.
          QueryString.stringify(options, { skipNulls: true }),
        {},
        {
          // reset: prop yang direset (bentuk "only" bagi Inertia -- partial
          // reload cuma fetch ulang prop di daftar ini, lihat komentar loadData
          // di bawah). groupCounts WAJIB ikut, kalau tidak partial reload
          // (mis. ganti Group by) tidak pernah membawa count baru dari server.
          reset: ["data", "ziggy", "groupCounts"],
          preserveScroll: true,
          preserveState: true,
          replace: true,
        },
      );
    }, [options]);
    // Konvensi sort: prefix `-` = descending, tanpa prefix = ascending.
    // Parse via startsWith agar key ber-dash / nested (`rel.col`) tetap utuh.
    const parseSort = (sortStr) => {
      const raw = sortStr ?? "";
      const order = raw.startsWith("-") ? "desc" : "asc";
      const key = order === "desc" ? raw.slice(1) : raw;
      return { key, order };
    };
    const { key: optionsSortKey, order: optionsSortOrder } = parseSort(
      options.sort,
    );
    const sortColumnLabel =
      sortableColumnOptions.find((x) => x.value === optionsSortKey)?.label ??
      optionsSortKey;

    const resetSorting = useCallback(() => {
      // Functional update agar tak menelan page/fid/show dari closure stale.
      setOptions((prev) => ({ ...prev, sort: defaultSort, page: 1 }));
    }, [defaultSort]);
    const setSort = useCallback((name, sort) => {
      setOptions((prev) => {
        const { key, order: prevOrder } = parseSort(prev.sort);
        // Tanpa argumen `sort`: toggle asc↔desc kolom yang sama.
        const order =
          sort ?? (key === name && prevOrder === "asc" ? "desc" : "asc");
        return {
          ...prev,
          sort: `${order === "asc" ? "" : "-"}${name}`,
          page: 1,
        };
      });
    }, []);
    const setGroup = useCallback(
      (name) => {
        // Sort TIDAK lagi dikunci ke kolom grup -- backend SELALU urutkan
        // primer by kolom grup (SQL mendukung multi-kolom ORDER BY), sort
        // user/default di sini jadi sekunder (tie-breaker dalam tiap grup).
        // Lihat DataTableScope::addDataTable().
        const column = name ? mapColumns[name] : null;
        const isDateType = ["date", "time", "datetime"].includes(column?.type);
        const isNumberType = ["number", "currency"].includes(column?.type);
        setOptions((prev) => ({
          ...prev,
          // "Tidak ada": bila model punya default group, kirim "" (URL bawa
          // `group=` kosong) -- param yg HILANG (null, dibuang skipNulls) akan
          // membuat BE memakai default lagi. Tanpa default, null cukup.
          group: name || (defaultGroup ? "" : null),
          // Default granularity/range kolom BARU -- selalu reset (bukan
          // reuse dari kolom grup sebelumnya), krn lebar range yg masuk akal
          // spesifik per kolom (quantity vs amount beda skala jauh).
          groupGranularity: isDateType ? "month" : null,
          groupRange: isNumberType
            ? (column?.groupRangeOptions?.[0] ??
              DEFAULT_NUMBER_GROUP_RANGE_OPTIONS[0])
            : null,
          page: 1,
        }));
      },
      [mapColumns, defaultGroup],
    );
    const setGroupGranularity = useCallback((value) => {
      setOptions((prev) => ({ ...prev, groupGranularity: value, page: 1 }));
    }, []);
    const setGroupRange = useCallback((value) => {
      setOptions((prev) => ({ ...prev, groupRange: Number(value), page: 1 }));
    }, []);
    useDidMountEffect(() => {
      const reloadData = setTimeout(() => {
        loadData();
      }, 500);

      return () => clearTimeout(reloadData);
    }, [options]);
    // Seed builder dari fid aktif (baik `?fid=` di URL maupun default filter
    // yang auto-applied dari state, lihat useState options di atas) — ambil
    // tree dari saved filter by-id (termasuk ephemeral) agar filter aktif
    // termuat saat builder dibuka. `saved-filters.index` tidak dipakai karena
    // hanya mengembalikan named filter.
    useEffect(() => {
      const fid = options.fid;
      if (!fid || filterTree) return;
      axios
        .get(window.route("saved-filters.show", { savedFilter: fid }))
        .then((res) => {
          if (res.data?.filter) setFilterTree(res.data.filter);
        })
        .catch(() => {});
    }, [options.fid]);
    // Simpan tree sebagai saved filter ephemeral → dapat `fid` → navigasi.
    // Tree kosong → bersihkan filter (drop fid).
    const persistFilterTree = useCallback(
      async (tree, fid = options.fid, sort) => {
        const hasItems = tree && Object.keys(tree.root?.c ?? {}).length > 0;
        if (!hasItems) {
          setFilterTree(null);
          setOptions((prev) => ({ ...prev, fid: null }));
          return;
        }
        try {
          // Kirim fid yang sedang dimuat: backend akan UPDATE row itu (bila
          // milik user & ephemeral cocok) alih-alih menumpuk row baru.
          const res = await axios.post(window.route("saved-filters.store"), {
            model,
            filter: tree,
            fid: fid ?? null,
          });
          setFilterTree(tree);
          setOptions((prev) => ({
            ...prev,
            fid: res.data?.id ?? null,
            // sort filter (Requirement 5) — null berarti jangan override.
            sort: sort ?? prev.sort,
          }));
          toast.success(t("core.datatable.filter.save.success"));
        } catch (error) {
          console.error(error);
          // 422 = tidak ada filter valid setelah cleaning backend.
          const message =
            error?.response?.status === 422
              ? (error.response.data?.errors?.filter?.[0] ??
                t("core.datatable.filter.validation.empty_tree"))
              : t("core.datatable.filter.save.error");
          toast.error(message);
          // Re-throw agar pemanggil (FilterTable2) tahu save gagal & dialog
          // tetap terbuka untuk perbaikan.
          throw error;
        }
      },
      [model, t, options.fid],
    );

    const onApplyFilters = useCallback(
      (tree, fid, opts) => {
        // useExisting: terapkan named filter yang dipilih tanpa membuat record
        // baru — cukup aktifkan id-nya & reload tabel.
        if (opts?.useExisting && fid) {
          setFilterTree(tree);
          setOptions((prev) => ({
            ...prev,
            fid,
            // sort filter (Requirement 5) — null berarti jangan override.
            sort: opts?.sort ?? prev.sort,
          }));
          toast.success(t("core.datatable.filter.save.success"));
          return Promise.resolve();
        }
        return persistFilterTree(tree, fid, opts?.sort);
      },
      [persistFilterTree],
    );

    // Dipanggil saat filter disimpan/dipilih/dihapus di dialog. `saved` berisi
    // { id, filter, name } untuk menjadikan named itu filter aktif; null untuk
    // melepas filter aktif (mis. named aktif dihapus).
    const onSavedFilter = useCallback((saved) => {
      if (!saved?.id) {
        setOptions((prev) => ({ ...prev, fid: null }));
        return;
      }
      if (saved.filter) setFilterTree(saved.filter);
      setOptions((prev) => ({ ...prev, fid: saved.id }));
    }, []);

    useImperativeHandle(ref, () => ({
      addFilter(key, operator, value) {
        // Filter cepat (mis. klik cell): bangun item baru, gabung ke tree aktif.
        const item = createFilterItem({ k: key, o: operator, v: value });
        const root = filterTree?.root ?? createFilterGroup({});
        const id = `${Date.now()}`;
        const nextTree = {
          root: { ...root, c: { ...(root.c ?? {}), [id]: item } },
        };
        // Quick filter (klik cell) tak punya dialog — telan error (toast
        // sudah ditampilkan di persistFilterTree).
        persistFilterTree(nextTree).catch(() => {});
      },
    }));
    const setShowNumber = useCallback((value) => {
      // Update `options.show` → ikut ke URL (?show=) → backend persist cookie
      // `datatable_show` pada path ini. Reset ke page 1 agar tak out-of-range.
      setOptions((prev) => ({ ...prev, show: value, page: 1 }));
    }, []);
    const title = t(`${translateKey}.title`);
    return (
      <>
        <AppLayout>
          <Head title={title} />
          <div className="flex items-center justify-between gap-x-4">
            <h1 className="text-xl font-bold">{title}</h1>
            <div className="flex items-center gap-x-4 ">
              <div className="flex items-center gap-x-4 lg:hidden">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="secondary" className="p-2! size-fit ">
                      <Ellipsis />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent>
                    <ScrollArea className="max-h-56">
                      <DropdownMenuItem onClick={loadData}>
                        <RefreshCw />
                        <span>{t("core.datatable.reload")}</span>
                      </DropdownMenuItem>
                      <FilterTable2
                        columns={mapColumns}
                        onApply={onApplyFilters}
                        onSaved={onSavedFilter}
                        initialFilters={filterTree}
                        model={model}
                        activeFid={options.fid}
                        isMobile={true}
                      />
                      {isMobile && (
                        <DropdownMenuSub>
                          <DropdownMenuSubTrigger>
                            {t("core.datatable.show")}
                          </DropdownMenuSubTrigger>
                          <DropdownMenuPortal>
                            <DropdownMenuSubContent>
                              <DropdownMenuRadioGroup
                                value={`${show}`}
                                onValueChange={(val) => setShowNumber(val)}
                              >
                                {effectivePerPageOptions.map((x) => (
                                  <DropdownMenuRadioItem
                                    key={x}
                                    value={x.toString()}
                                    className="cursor-pointer"
                                    showDot={true}
                                  >
                                    {x}
                                  </DropdownMenuRadioItem>
                                ))}
                              </DropdownMenuRadioGroup>
                            </DropdownMenuSubContent>
                          </DropdownMenuPortal>
                        </DropdownMenuSub>
                      )}
                      {groupableColumns.length > 0 && (
                        <Dialog
                          open={groupDialogOpen}
                          onOpenChange={setGroupDialogOpen}
                        >
                          {/* DialogTrigger asChild yg wrap DropdownMenuItem
                              (spt Header.jsx) TERBUKTI gagal buka Dialog --
                              DropdownMenu auto-close-on-select balapan dgn
                              klik hasil Slot-clone, Dialog tak pernah kebuka
                              (dicoba manual di browser). Kontrol state Dialog
                              langsung via onClick, bukan komposisi trigger. */}
                          <DropdownMenuItem
                            onClick={() => setGroupDialogOpen(true)}
                          >
                            {t("core.datatable.group_by")}: {groupColumnLabel}
                          </DropdownMenuItem>
                          <DialogContent>
                            <DialogHeader>
                              <DialogTitle>
                                {t("core.datatable.group_by")}
                              </DialogTitle>
                              <DialogDescription className="sr-only">
                                {t("core.datatable.group_by")}
                              </DialogDescription>
                            </DialogHeader>
                            <Command filter={searchableOptionFilter}>
                              <SearchableOptionList
                                options={groupOptions}
                                value={options.group || NO_GROUP_VALUE}
                                onValueChange={(val) => {
                                  setGroup(val === NO_GROUP_VALUE ? null : val);
                                  setGroupDialogOpen(false);
                                }}
                                searchPlaceholder={t(
                                  "core.datatable.filter.column.search.placeholder",
                                )}
                                emptyMessage={t(
                                  "core.datatable.filter.column.not_found",
                                )}
                              />
                            </Command>
                          </DialogContent>
                        </Dialog>
                      )}
                      {isActiveGroupDate && (
                        <DropdownMenuSub>
                          <DropdownMenuSubTrigger>
                            {t(
                              `core.datatable.granularity.${options.groupGranularity ?? "month"}`,
                            )}
                          </DropdownMenuSubTrigger>
                          <DropdownMenuPortal>
                            <DropdownMenuSubContent>
                              <DropdownMenuRadioGroup
                                value={options.groupGranularity ?? "month"}
                                onValueChange={setGroupGranularity}
                              >
                                {DATE_GROUP_GRANULARITIES.map((g) => (
                                  <DropdownMenuRadioItem
                                    key={g}
                                    value={g}
                                    className="cursor-pointer"
                                    showDot={true}
                                  >
                                    {t(`core.datatable.granularity.${g}`)}
                                  </DropdownMenuRadioItem>
                                ))}
                              </DropdownMenuRadioGroup>
                            </DropdownMenuSubContent>
                          </DropdownMenuPortal>
                        </DropdownMenuSub>
                      )}
                      {isActiveGroupNumber && (
                        <DropdownMenuSub>
                          <DropdownMenuSubTrigger>
                            {t("core.datatable.group_range")}
                          </DropdownMenuSubTrigger>
                          <DropdownMenuPortal>
                            <DropdownMenuSubContent>
                              <DropdownMenuRadioGroup
                                value={`${options.groupRange ?? activeGroupRangeOptions[0]}`}
                                onValueChange={setGroupRange}
                              >
                                {activeGroupRangeOptions.map((size) => (
                                  <DropdownMenuRadioItem
                                    key={size}
                                    value={`${size}`}
                                    className="cursor-pointer"
                                    showDot={true}
                                  >
                                    {size}
                                  </DropdownMenuRadioItem>
                                ))}
                              </DropdownMenuRadioGroup>
                            </DropdownMenuSubContent>
                          </DropdownMenuPortal>
                        </DropdownMenuSub>
                      )}
                      <DropdownMenuSeparator />
                      <DropdownMenuGroup>
                        <DropdownMenuLabel>
                          {t("core.datatable.sorting.sorting")}
                        </DropdownMenuLabel>
                        <DropdownMenuItem
                          onClick={() => setSort(optionsSortKey)}
                        >
                          {optionsSortOrder == "asc" ? (
                            <ArrowUpNarrowWide />
                          ) : (
                            <ArrowDownWideNarrow />
                          )}
                          {optionsSortOrder == "asc"
                            ? t("core.datatable.sorting.ascending")
                            : t("core.datatable.sorting.descending")}
                        </DropdownMenuItem>
                        <Dialog
                          open={sortDialogOpen}
                          onOpenChange={setSortDialogOpen}
                        >
                          <DropdownMenuItem
                            onClick={() => setSortDialogOpen(true)}
                          >
                            {t("core.datatable.sorting.sort_by")}:{" "}
                            {sortColumnLabel}
                          </DropdownMenuItem>
                          <DialogContent>
                            <DialogHeader>
                              <DialogTitle>
                                {t("core.datatable.sorting.sort_by")}
                              </DialogTitle>
                              <DialogDescription className="sr-only">
                                {t("core.datatable.sorting.sort_by")}
                              </DialogDescription>
                            </DialogHeader>
                            <Command filter={searchableOptionFilter}>
                              <SearchableOptionList
                                options={sortableColumnOptions}
                                value={optionsSortKey}
                                onValueChange={(val) => {
                                  setSort(val, optionsSortOrder);
                                  setSortDialogOpen(false);
                                }}
                                searchPlaceholder={t(
                                  "core.datatable.filter.column.search.placeholder",
                                )}
                                emptyMessage={t(
                                  "core.datatable.filter.column.not_found",
                                )}
                              />
                            </Command>
                          </DialogContent>
                        </Dialog>
                      </DropdownMenuGroup>
                    </ScrollArea>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
              <div className="items-center hidden lg:flex gap-x-4 ">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="secondary"
                      className="p-2! size-fit "
                      onClick={loadData}
                    >
                      <RefreshCw />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent side="bottom">
                    {t("core.datatable.reload")}
                  </TooltipContent>
                </Tooltip>
                <div className="inline-flex overflow-hidden rounded-lg">
                  <FilterTable2
                    columns={mapColumns}
                    onApply={onApplyFilters}
                    onSaved={onSavedFilter}
                    initialFilters={filterTree}
                    model={model}
                    activeFid={options.fid}
                  />
                  {options.fid && (
                    <Button
                      className="py-0! h-8 px-2! rounded-l-none"
                      variant="secondary"
                      onClick={() => {
                        setFilterTree(null);
                        setOptions((prev) => ({ ...prev, fid: null }));
                      }}
                    >
                      <X />
                    </Button>
                  )}
                </div>

                <div className="inline-flex overflow-hidden rounded-lg">
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        className="py-0! h-8 px-2! rounded-r-none border-r  border-muted-foreground/50"
                        variant="secondary"
                        onClick={() => setSort(optionsSortKey)}
                      >
                        {optionsSortOrder == "asc" ? (
                          <ArrowUpNarrowWide />
                        ) : (
                          <ArrowDownWideNarrow />
                        )}
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent align="center" side="bottom">
                      {optionsSortOrder == "asc"
                        ? t("core.datatable.sorting.ascending")
                        : t("core.datatable.sorting.descending")}
                    </TooltipContent>
                  </Tooltip>
                  <Popover
                    open={sortPopoverOpen}
                    onOpenChange={setSortPopoverOpen}
                  >
                    <PopoverTrigger asChild>
                      <Button
                        className={cn(
                          buttonVariants({
                            variant: "secondary",
                            size: "default",
                          }),
                          "flex-1 py-0! h-8 px-2! border-none! rounded-l-none ring-0! justify-start!",
                        )}
                      >
                        {sortColumnLabel}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent
                      align="start"
                      className="w-auto min-w-(--radix-popover-trigger-width) p-0"
                    >
                      <Command filter={searchableOptionFilter}>
                        <SearchableOptionList
                          options={sortableColumnOptions}
                          value={optionsSortKey}
                          onValueChange={(val) => {
                            setSort(val, optionsSortOrder);
                            setSortPopoverOpen(false);
                          }}
                          searchPlaceholder={t(
                            "core.datatable.filter.column.search.placeholder",
                          )}
                          emptyMessage={t(
                            "core.datatable.filter.column.not_found",
                          )}
                        />
                      </Command>
                    </PopoverContent>
                  </Popover>
                </div>
                {groupableColumns.length > 0 && (
                  <Popover
                    open={groupPopoverOpen}
                    onOpenChange={setGroupPopoverOpen}
                  >
                    <PopoverTrigger asChild>
                      <Button
                        className={cn(
                          buttonVariants({
                            variant: "secondary",
                            size: "default",
                          }),
                          "w-fit! gap-x-2 py-0! h-8",
                        )}
                      >
                        <Layers className="size-4" />
                        {groupColumnLabel}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent
                      align="start"
                      className="w-auto min-w-(--radix-popover-trigger-width) p-0"
                    >
                      <Command filter={searchableOptionFilter}>
                        <SearchableOptionList
                          options={groupOptions}
                          value={options.group || NO_GROUP_VALUE}
                          onValueChange={(val) => {
                            setGroup(val === NO_GROUP_VALUE ? null : val);
                            setGroupPopoverOpen(false);
                          }}
                          searchPlaceholder={t(
                            "core.datatable.filter.column.search.placeholder",
                          )}
                          emptyMessage={t(
                            "core.datatable.filter.column.not_found",
                          )}
                        />
                      </Command>
                    </PopoverContent>
                  </Popover>
                )}
                {isActiveGroupDate && (
                  <Select
                    value={options.groupGranularity ?? "month"}
                    onValueChange={setGroupGranularity}
                  >
                    <SelectTrigger className="w-fit! gap-x-2 py-0! h-8">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {DATE_GROUP_GRANULARITIES.map((g) => (
                        <SelectItem key={g} value={g}>
                          {t(`core.datatable.granularity.${g}`)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
                {isActiveGroupNumber && (
                  <Select
                    value={`${options.groupRange ?? activeGroupRangeOptions[0]}`}
                    onValueChange={setGroupRange}
                  >
                    <SelectTrigger className="w-fit! gap-x-2 py-0! h-8">
                      <SelectValue
                        placeholder={t("core.datatable.group_range")}
                      />
                    </SelectTrigger>
                    <SelectContent>
                      {activeGroupRangeOptions.map((size) => (
                        <SelectItem key={size} value={`${size}`}>
                          {size}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </div>
              {form && canCreate && (
                <Button
                  className="p-2! size- fit h-8"
                  onClick={() => dialogRef?.current?.open()}
                >
                  <Plus />
                  {t(`${translateKey}.add`)}
                </Button>
              )}
            </div>
          </div>
          <div className="flex flex-col flex-1 min-h-0 max-w-full mt-4 border rounded-lg border-muted-foreground/25 overflow-hidden">
            {isMobile ? (
              <div className="flex flex-col flex-1 min-h-0 overflow-y-auto">
                {data?.data && data.data.length > 0 ? (
                  data.data.map((x) => {
                    const item = templateItem?.({
                      dataRow: x,
                      // Pass closure — JANGAN panggil deleteItem() saat render
                      // (memicu setState store DeleteDialog selama render).
                      deleteItem: () =>
                        deleteItem(
                          `${pluralize.plural(name ?? "")}.destroy`,
                          x.id,
                          {
                            usePasswordConfirmation:
                              usePasswordConfirmationForDelete,
                          },
                        ),
                    });
                    if (!item) return null;
                    return cloneElement(item, { key: x.id, ...item.props });
                  })
                ) : (
                  <NoDataImg className="self-center w-full max-w-sm" />
                )}
              </div>
            ) : (
              <Table2
                reload={loadData}
                className="flex-1 min-h-0"
                actions={actions}
                columns={mapColumns}
                data={data.data}
                options={options}
                setSort={setSort}
                resetSorting={resetSorting}
                onOptionsChanged={setOptions}
                groupBy={options.group || null}
                groupCounts={groupCounts}
                groupGranularity={options.groupGranularity}
                groupRange={options.groupRange}
              />
            )}
            <div
              className={cn(
                !isMobile || (data.last_page ?? 1) > 1 ? "flex" : "hidden",
                " justify-between px-4 py-4 border-t border-muted-foreground/25 gap-x-4",
              )}
            >
              {!isMobile && (
                <div className="flex items-center gap-x-2">
                  <Label>{t("core.datatable.show")}</Label>
                  <Select
                    value={`${show}`}
                    onValueChange={(e) => setShowNumber(e)}
                  >
                    <SelectTrigger className="w-fit! gap-x-2">
                      <SelectValue placeholder="Show"></SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      {effectivePerPageOptions.map((x) => (
                        <SelectItem key={x} value={x.toString()}>
                          {x}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
              <Pagination
                currentPage={Number(options.page)}
                totalPages={data.last_page ?? 1}
                onPageChanged={(page) => setOptions({ ...options, page })}
                className="justify-end"
              />
            </div>
          </div>
        </AppLayout>
        {form && canCreate && (
          <FormPageDialog
            ref={dialogRef}
            title={t(`${translateKey}.new`)}
            className={classNameDialog}
            defaultValue={defaultValueForm}
            name={name}
          >
            {form}
          </FormPageDialog>
        )}
      </>
    );
  }),
);
