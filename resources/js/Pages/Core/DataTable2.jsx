import {
  ArrowDownWideNarrow,
  ArrowUpNarrowWide,
  Ellipsis,
  Plus,
  RefreshCw,
  Trash2Icon,
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
  DropdownMenuItem,
  DropdownMenuPortal,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
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
import SearchBar from "@/Components/Table/Search/SearchBar";
import useSearchDraft from "@/Components/Table/Search/useSearchDraft";
import { FormPageDialog } from "./FormPage";
import { Label } from "@/Components/ui/label";
import NoDataImg from "@/Components/Table/NoDataImg";
import Pagination from "@/Components/Table/Pagination";
import QueryString from "qs";
import React from "react";
import SearchableOptionList, {
  searchableOptionFilter,
} from "@/Components/Table/SearchableOptionList";
import GroupTree from "@/Components/Table/Group/GroupTree";
import {
  GroupHeaderCard,
  GroupNodeStatusCard,
} from "@/Components/Table/Group/GroupHeaderRow";
import {
  buildExpandParams,
  groupsFromQuery,
  groupsToQuery,
  inheritFromDefaults,
  normalizeGroupLevels,
  sameGroups,
  sameRootLevel,
} from "@/Components/Table/Group/groupLevels";
import Table2, { createHeaders } from "@/Components/Table/Table2";
import axios from "axios";
import { compareLabels } from "@/lib/compareLabels";
import { createFilterGroup, createFilterItem } from "@/Hooks/useNestedFilters";
import pluralize from "pluralize";
import { resolveSearchColumns } from "@/Components/Table/Search/resolveSearchColumns";
import { gooeyToast as toast } from "@/lib/gooeyToast";
import useDeleteModal from "@/Hooks/useDeleteModal";
import useDidMountEffect from "@/Hooks/useDidMountEffect";
import { useIsMobile } from "@/Hooks/use-mobile";
import { useLaravelReactI18n } from "laravel-react-i18n";
import usePermission from "@/Hooks/usePermission";

// Requirement 24 (permintaan user): sebagian perubahan `options` (mode grup
// aktif) tak perlu reload Inertia -- level-0 (`data` grup, dari server) tetap
// valid, cukup diperbarui via fetch TanStack node yang sudah ada (GroupTree).
// Hanya berlaku bila TEPAT SATU field `options` berubah per aksi (selain
// `page`, yang di-reset ke 1 oleh semua setter tapi tak relevan di 2 rule ini
// krn level-0 sendiri tak tersentuh):
//   - "group-sublevel": array `group` berubah, TAPI level 0 (kolom terluar)
//     identik -- daftar grup level-0 tetap sama, cuma isi di bawahnya (level 1+)
//     yang berbeda.
//   - "sort-leaf-only": `sort` berubah ke kolom yang BUKAN kolom grup manapun
//     & BUKAN kolom groupAggregate -- urutan baris GRUP (level manapun) tak
//     terpengaruh (backend `GroupNodeQuery::applyGroupOrder` cuma reaksi ke
//     `group_key`/aggregate), cuma urutan baris LEAF (dalam grup yang sudah
//     dibuka) yang berubah.
//   - Selain itu (termasuk `group` yang level-0-nya beda, atau tanpa grup
//     aktif sama sekali): "full" -- reload Inertia spt sebelumnya.
const optionsFieldChanged = (key, prev, next) =>
  key === "group" ? !sameGroups(prev, next) : prev !== next;

export function classifyOptionsChange(
  prev,
  next,
  { groupAggregateColumns, hasGroupTree },
) {
  // Tanpa pohon grup AKTIF di server (`groupMeta`, lihat groupTreeProps),
  // tabel merender jalur DATAR (`data.data` server apa adanya) -- override
  // lokal tak akan berefek di mana pun (tak ada GroupTree utk diperbarui),
  // jadi sort/group manapun WAJIB tetap reload Inertia.
  if (!hasGroupTree) return "full";
  const changedKeys = Object.keys(next).filter(
    (key) => key !== "page" && optionsFieldChanged(key, prev[key], next[key]),
  );
  if (changedKeys.length !== 1) return "full";
  const [key] = changedKeys;

  if (key === "group") {
    if (next.group.length === 0 || prev.group.length === 0) return "full";
    return sameRootLevel(prev.group, next.group) ? "group-sublevel" : "full";
  }
  if (key === "sort" && next.group.length > 0) {
    const sortKey = next.sort?.startsWith("-")
      ? next.sort.slice(1)
      : (next.sort ?? "");
    const groupColumns = next.group.map((level) => level.column);
    if (groupColumns.includes(sortKey)) return "full";
    if (groupAggregateColumns.includes(sortKey)) return "full";
    return "sort-leaf-only";
  }
  return "full";
}

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
      groupMeta,
      defaultGroups,
      searchScope,
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
    // Group awal (`Groups`, spec datatable2-group-tree): `?group=` di URL (skalar
    // lama dipetakan ke level pertama) > group efektif tanpa param dari BE
    // (`defaultGroups`: filter aktif ?? default model). `?group=` KOSONG = user
    // sengaja "Tidak ada" -> `[]` (BUKAN default). Level dari URL yg tak menyebut
    // granularity/range mewarisi dari level default dgn kolom SAMA -- cermin
    // GroupLevelResolver di backend.
    const fromUrl = groupsFromQuery(query);
    const initialGroups =
      fromUrl === null
        ? normalizeGroupLevels(defaultGroups)
        : inheritFromDefaults(fromUrl, defaultGroups);
    const [options, setOptions] = useState({
      sort: query?.sort ?? defaultSort,
      // Tanpa ?fid= eksplisit: pakai default shared filter (Filter Templates)
      // bila ada. Hanya dievaluasi sekali saat mount — perubahan filter
      // eksplisit oleh user setelahnya tidak pernah "dipaksa balik" ke sini.
      fid: query?.fid ?? defaultFilterId ?? null,
      page: query?.page ?? 1,
      show: initialShow,
      // `Groups` kanonik (urutan = nesting, maks 4). Bentuk kawat URL
      // (`group=a,b`, `groupGranularity[a]`, `groupRange[b]`) dibuat HANYA di
      // loadData() lewat groupsToQuery().
      group: initialGroups,
      // Arah urutan baris grup menurut nilai grup (klik ikon chip group) --
      // TERPISAH dari `sort` tabel. Hanya `desc` yang dikirim ke URL.
      groupSort: query?.groupSort === "desc" ? "desc" : "asc",
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
    // Sort By: state buka/tutup Popover (desktop) & Dialog (mobile, dipicu
    // tombol ikon Sort di baris search bar) -- ditutup manual di
    // onValueChange SearchableOptionList setelah pilih. Group by pindah ke
    // Panel ▾ Search Bar (state buka/tutupnya dikelola SearchBar sendiri).
    const [sortPopoverOpen, setSortPopoverOpen] = useState(false);
    const [sortDialogOpen, setSortDialogOpen] = useState(false);
    // Builder lanjutan (FilterTable2 controlled, dibuka dari Search Bar).
    const [builderOpen, setBuilderOpen] = useState(false);
    // Revisi 5 (Requirement 25): draftTree Search Bar SAAT dibuka -- tanpa
    // ini, Builder lanjutan selalu tampilkan `filterTree` (state ter-apply),
    // bukan chip yg lagi disusun tapi belum di-apply. Sentinel `undefined` =
    // belum pernah dibuka dari Search Bar sesi ini (pakai `filterTree` biasa)
    // -- BUKAN `null`, krn draft itu sendiri sah bernilai `null` (semua chip
    // dihapus tapi belum di-apply; harus tampil kosong, bukan fallback ke
    // `filterTree` lama).
    const [builderDraftFilter, setBuilderDraftFilter] = useState(undefined);
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
    // Semua kolom groupable, diurut abjad. TANPA sentinel "Tidak ada" -- "tidak
    // ada" = `Groups` kosong. Dipakai GroupLevelsEditor di Search Bar.
    const groupOptions = useMemo(
      () =>
        groupableColumns
          .map((x) => ({
            value: x.name,
            label: x.title ?? t(x.titleTrans),
          }))
          .sort((a, b) => compareLabels(a.label, b.label, locale)),
      [groupableColumns, t, locale],
    );

    // `Groups` -> bentuk kawat (`group=a,b`, `groupGranularity[a]`, ...)
    // dilebur ke param lain di sini, satu-satunya tempat -- dipakai loadData()
    // (reload Inertia) MAUPUN jalur lokal Requirement 24 (replaceState, tanpa
    // fetch) supaya URL bar selalu konsisten dgn cara yang sama.
    const buildOptionsUrl = useCallback(
      (opts) => {
        const { group, groupSort, ...rest } = opts;
        // `groupSort` (arah urutan grup menurut nilai) hanya dikirim bila `desc`
        // DAN ada group aktif; `asc` = default backend, param dihilangkan.
        const groupSortParam =
          groupSort === "desc" && group.length > 0 ? { groupSort } : {};
        // "Tidak ada" harus mengirim `group=` KOSONG bila ada group yang bisa
        // jatuh kembali dipakai backend: default model, ATAU group milik filter
        // tersimpan aktif (`fid`). `defaultGroups` saja tak cukup -- ia dimuat
        // sebelum user memilih filter tersimpan (partial reload tak
        // menyegarkannya), sehingga chip group dihapus setelah memilih filter yang
        // ber-group malah tak berefek (param hilang -> backend memakai group filter).
        const hasFallbackGroups =
          normalizeGroupLevels(defaultGroups).length > 0 || rest.fid != null;
        return (
          window.location.pathname +
          "?" +
          // skipNulls -- option null (fid/dst saat tidak aktif) dihilangkan
          // dari querystring, bukan tampil sbg `key=` kosong yang mengotori URL.
          QueryString.stringify(
            {
              ...rest,
              ...groupsToQuery(group, hasFallbackGroups),
              ...groupSortParam,
            },
            { skipNulls: true },
          )
        );
      },
      [defaultGroups],
    );
    const loadData = useCallback(() => {
      router.get(
        buildOptionsUrl(options),
        {},
        {
          // reset: prop yang direset (bentuk "only" bagi Inertia -- partial
          // reload cuma fetch ulang prop di daftar ini, lihat komentar loadData
          // di bawah). groupMeta WAJIB ikut, kalau tidak partial reload
          // (mis. ganti Group by) tidak pernah membawa level/agregat baru dari
          // server.
          reset: ["data", "ziggy", "groupMeta"],
          preserveScroll: true,
          preserveState: true,
          replace: true,
        },
      );
    }, [options, buildOptionsUrl]);
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
    // Dipanggil Search Bar (chip/saran/Panel ▾/ChipEditor) dgn `Groups` BARU --
    // granularity/range SUDAH dihitung pemanggil (default kolom baru, atau nilai
    // yg diedit user), jadi diterapkan apa adanya. `[]` = "Tidak ada": lewat
    // groupsToQuery() jadi `group=` KOSONG bila model punya default (menimpa
    // default/filter), selain itu param dihilangkan.
    const onGroupChange = useCallback((groups) => {
      setOptions((prev) => ({
        ...prev,
        group: normalizeGroupLevels(groups),
        page: 1,
      }));
    }, []);
    // Klik ikon chip group: balik arah urutan baris grup menurut nilai grup.
    // Langsung berlaku (debounce reload yang sama), TIDAK menyentuh `sort` tabel.
    const onGroupSortChange = useCallback((direction) => {
      setOptions((prev) => ({
        ...prev,
        groupSort: direction === "desc" ? "desc" : "asc",
        page: 1,
      }));
    }, []);
    // Requirement 24 (permintaan user): override lokal hasil rule
    // "group-sublevel"/"sort-leaf-only" (classifyOptionsChange) -- diterapkan
    // ke tampilan TANPA reload Inertia. `null` = ikuti server (`groupMeta`/
    // `query`) apa adanya. Direset begitu server kirim `groupMeta` BARU
    // (reload sungguhan benar2 terjadi) supaya override yang basi tak pernah
    // "menang" atas data server yang lebih baru.
    const [localOverride, setLocalOverride] = useState(null); // { group?, sort? } | null
    // Naik HANYA saat rule "group-sublevel" diterapkan -- lihat GroupTree.jsx
    // (menutup paksa node terbuka di kedalaman >=1, identitasnya tak valid
    // lagi setelah kolom sub-level berganti).
    const [subLevelVersion, setSubLevelVersion] = useState(0);
    const prevCommittedOptionsRef = useRef(options);
    useEffect(() => {
      setLocalOverride(null);
    }, [groupMeta]);
    const groupAggregateColumns = useMemo(
      () => (groupMeta?.aggregates ?? []).map((a) => a.column),
      [groupMeta],
    );
    useDidMountEffect(() => {
      const reloadData = setTimeout(() => {
        const prev = prevCommittedOptionsRef.current;
        const decision = classifyOptionsChange(prev, options, {
          groupAggregateColumns,
          hasGroupTree: Boolean(groupMeta),
        });
        if (decision === "group-sublevel") {
          setLocalOverride((prevOverride) => ({
            ...prevOverride,
            group: options.group,
          }));
          setSubLevelVersion((v) => v + 1);
          window.history.replaceState(null, "", buildOptionsUrl(options));
        } else if (decision === "sort-leaf-only") {
          setLocalOverride((prevOverride) => ({
            ...prevOverride,
            sort: options.sort,
          }));
          window.history.replaceState(null, "", buildOptionsUrl(options));
        } else {
          loadData();
        }
        prevCommittedOptionsRef.current = options;
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
      async (tree, fid = options.fid, sort, { silent = false } = {}) => {
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
          // `silent`: perubahan chip di Search Bar terjadi per ketikan -- toast
          // sukses tiap kali terlalu berisik (chip sendiri = umpan balik).
          // Toast ERROR tetap tampil.
          if (!silent) toast.success(t("core.datatable.filter.save.success"));
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

    // --- Search Bar (spec datatable2-advanced-search) --------------------
    // Chip = Filter Tree yang sama dgn FilterTable2 -> tiap perubahan chip
    // di-persist lewat jalur persistFilterTree yang sama. Return Promise
    // (Search Bar menampilkan spinner & menolak commit beruntun); reject =
    // gagal simpan, toast sudah tampil, chip otomatis kembali krn `tree` tak
    // berubah.
    const onTreeChange = useCallback(
      (tree) => persistFilterTree(tree, undefined, undefined, { silent: true }),
      [persistFilterTree],
    );

    // Terapkan saved filter (dipilih dari saran/Panel ▾): tree + fid + sort +
    // group sekaligus, tanpa POST baru (setara `useExisting` di
    // onApplyFilters). sort/group `null` di saved filter = tak mengatur, jadi
    // JANGAN override nilai aktif.
    const onPickSaved = useCallback((saved) => {
      if (!saved?.id) return;
      if (saved.filter) setFilterTree(saved.filter);
      setOptions((prev) => {
        const next = {
          ...prev,
          fid: saved.id,
          sort: saved.sort ?? prev.sort,
          page: 1,
        };
        // `group` saved filter = `Groups` (list) atau null (tak mengatur).
        const savedGroups = normalizeGroupLevels(saved.group);
        if (savedGroups.length > 0) next.group = savedGroups;
        return next;
      });
    }, []);

    // Snapshot tampilan utk "Simpan sebagai baru"/"Timpa" & deteksi dirty
    // saved filter sumber (sort + group aktif). `group` kosong -> null ("tak
    // mengatur group", tak menimpa group aktif saat filter diterapkan).
    const getViewSnapshot = useCallback(
      () => ({
        sort: options.sort ?? null,
        group: options.group.length > 0 ? options.group : null,
      }),
      [options.sort, options.group],
    );

    // Kolom yg dicari chip "Cari": searchScope model (sudah disanitasi BE),
    // fallback kolom TAMPIL. Dipanggil SAAT Enter (bukan state) -- cookie
    // visibility bisa berubah di Table2 tanpa me-render ulang DataTable2.
    // `createHeaders` MEMUTASI argumennya -> salinan dangkal.
    const getSearchColumns = useCallback(
      () =>
        resolveSearchColumns({
          searchScope,
          columns: mapColumns,
          visibleNames: createHeaders({ ...mapColumns })
            .filter((h) => h.show)
            .map((h) => h.name),
        }),
      [searchScope, mapColumns],
    );

    // Draft Search Bar (staged-apply) dimiliki di sini supaya dipakai BERSAMA
    // Search Bar atas dan Baris Filter Kolom di Table2 (spec
    // datatable2-column-search-row, Requirement 7.3-7.5): chip atas dan badge
    // sel selalu turunan dari draft yang SAMA. Perubahan `filterTree` dari
    // sumber luar (Builder, saved filter, `addFilter`, `?fid=`) mereset draft.
    const searchDraft = useSearchDraft({
      tree: filterTree,
      group: options.group,
      onTreeChange,
      onGroupChange,
      onPickSaved,
    });

    // Baris Filter Kolom di Table2 (hanya DataTable2 yang mengisinya -- opt-in).
    const columnFilter = useMemo(
      () => ({
        columns: mapColumns,
        draft: searchDraft,
        onOpenBuilder: (draftTree) => {
          setBuilderDraftFilter(draftTree ?? null);
          setBuilderOpen(true);
        },
      }),
      [mapColumns, searchDraft],
    );

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
    // Pohon grup (spec datatable2-group-tree). `resetKey` = URL yang dirender
    // SERVER (ziggy.query), BUKAN `options` pending yang di-debounce 500 ms --
    // kalau memakai options, tabel lama menutup sebelum data baru tiba.
    // `version` naik tiap identitas `data` level-0 berganti (mis. setelah
    // hapus/redirect ke URL yang sama, atau tombol Reload): node terbuka
    // di-refetch, tapi state terbuka TIDAK direset (resetKey tak berubah).
    // Requirement 24: `localOverride` (rule "group-sublevel"/"sort-leaf-only")
    // menang atas `groupMeta.levels`/`query.sort` server SELAMA belum ada
    // reload sungguhan (lihat efek yang membersihkannya di atas). Bentuk
    // `localOverride.group` (`options.group`, {column,granularity,range}[])
    // kompatibel dgn yang dibutuhkan GroupHeaderRow -- `type`/`title`/dst
    // selalu di-lookup client-side dari `mapColumns[level.column]` (Table2.jsx
    // `columnMeta={headers?.[args.level?.column]}`), bukan dari objek level
    // itu sendiri, jadi tak perlu meniru bentuk lengkap balasan server.
    const effectiveLevels = localOverride?.group ?? groupMeta?.levels;
    const effectiveQuery = localOverride?.sort
      ? { ...query, sort: localOverride.sort }
      : query;
    const groupTreeProps = useMemo(
      () =>
        groupMeta
          ? {
              levels: effectiveLevels,
              aggregates: groupMeta.aggregates,
              baseParams: buildExpandParams(effectiveQuery, effectiveLevels),
              pathname: window.location.pathname,
              resetKey: JSON.stringify(query ?? {}),
              subLevelVersion,
            }
          : null,
      [groupMeta, query, effectiveLevels, effectiveQuery, subLevelVersion],
    );
    const dataVersionRef = useRef({ data, version: 0 });
    if (dataVersionRef.current.data !== data) {
      dataVersionRef.current = {
        data,
        version: dataVersionRef.current.version + 1,
      };
    }
    const treeVersion = dataVersionRef.current.version;
    // "1–50 / 200": rentang item halaman ini dari paginator server (`from`/`to`/
    // `total`); tak tampil bila kosong / paginator tanpa field itu.
    const pageRangeText =
      data?.total > 0 && data.from != null && data.to != null
        ? t("core.datatable.page_range", {
            start: data.from,
            end: data.to,
            total: data.total,
          })
        : null;
    // Kartu mobile satu baris data (`templateItem` halaman).
    const mobileItem = (row) =>
      templateItem?.({
        dataRow: row,
        // Pass closure — JANGAN panggil deleteItem() saat render
        // (memicu setState store DeleteDialog selama render).
        deleteItem: () =>
          deleteItem(`${pluralize.plural(name ?? "")}.destroy`, row.id, {
            usePasswordConfirmation: usePasswordConfirmationForDelete,
          }),
      });
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
                    <DropdownMenuItem onClick={loadData}>
                      <RefreshCw />
                      <span>{t("core.datatable.reload")}</span>
                    </DropdownMenuItem>
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
          {/* Search Bar (chip = Filter Tree) + Sort dalam satu baris, di antara
              judul dan kartu tabel -- BUKAN di toolbar judul (tak ramai) dan
              bukan search global navbar (Ctrl+K / "/"). Filter & Group by
              pindah ke Panel ▾ Search Bar. */}
          <div className="flex items-start gap-x-2 mt-3">
            <div className="flex-1 min-w-0">
              <SearchBar
                draft={searchDraft}
                columns={mapColumns}
                tree={filterTree}
                onTreeChange={onTreeChange}
                getSearchColumns={getSearchColumns}
                model={model}
                activeFid={options.fid}
                onPickSaved={onPickSaved}
                getViewSnapshot={getViewSnapshot}
                group={options.group}
                groupOptions={
                  groupableColumns.length > 0 ? groupOptions : undefined
                }
                onGroupChange={
                  groupableColumns.length > 0 ? onGroupChange : undefined
                }
                groupSort={options.groupSort}
                onGroupSortChange={
                  groupableColumns.length > 0 ? onGroupSortChange : undefined
                }
                onOpenBuilder={(draftTree) => {
                  setBuilderDraftFilter(draftTree ?? null);
                  setBuilderOpen(true);
                }}
                placeholder={t("core.datatable.search.placeholder", {
                  name: title,
                })}
              />
            </div>
            <div className="hidden lg:inline-flex overflow-hidden rounded-lg shrink-0">
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
              <Popover open={sortPopoverOpen} onOpenChange={setSortPopoverOpen}>
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
                  align="end"
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
                      emptyMessage={t("core.datatable.filter.column.not_found")}
                    />
                  </Command>
                </PopoverContent>
              </Popover>
            </div>
            {/* Mobile: Sort = tombol ikon -> Dialog (arah asc/desc + daftar
                kolom). Dialog di LUAR DropdownMenu -- tak ada nesting
                menu->dialog (fokus/pointer-events Radix rawan macet). */}
            <Button
              variant="secondary"
              className="p-2! size-fit shrink-0 lg:hidden"
              aria-label={t("core.datatable.sorting.sort_by")}
              onClick={() => setSortDialogOpen(true)}
            >
              {optionsSortOrder == "asc" ? (
                <ArrowUpNarrowWide />
              ) : (
                <ArrowDownWideNarrow />
              )}
            </Button>
          </div>
          <Dialog open={sortDialogOpen} onOpenChange={setSortDialogOpen}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>{t("core.datatable.sorting.sort_by")}</DialogTitle>
                <DialogDescription className="sr-only">
                  {t("core.datatable.sorting.sort_by")}
                </DialogDescription>
              </DialogHeader>
              <div className="flex gap-2">
                {["asc", "desc"].map((order) => (
                  <Button
                    key={order}
                    type="button"
                    size="sm"
                    variant={
                      optionsSortOrder === order ? "default" : "secondary"
                    }
                    className="flex-1"
                    onClick={() => setSort(optionsSortKey, order)}
                  >
                    {order === "asc" ? (
                      <ArrowUpNarrowWide />
                    ) : (
                      <ArrowDownWideNarrow />
                    )}
                    {order === "asc"
                      ? t("core.datatable.sorting.ascending")
                      : t("core.datatable.sorting.descending")}
                  </Button>
                ))}
              </div>
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
                  emptyMessage={t("core.datatable.filter.column.not_found")}
                />
              </Command>
            </DialogContent>
          </Dialog>
          {/* Builder lanjutan -- dialog FilterTable2 dikontrol dari Panel ▾ /
              chip "Filter lanjutan" Search Bar (tanpa trigger sendiri). */}
          <FilterTable2
            columns={mapColumns}
            onApply={onApplyFilters}
            onSaved={onSavedFilter}
            initialFilters={
              builderDraftFilter !== undefined ? builderDraftFilter : filterTree
            }
            model={model}
            activeFid={options.fid}
            isMobile={isMobile}
            open={builderOpen}
            onOpenChange={setBuilderOpen}
          />
          <div className="flex flex-col flex-1 min-h-0 max-w-full mt-3 border rounded-lg border-muted-foreground/25 overflow-hidden">
            {isMobile ? (
              <div className="flex flex-col flex-1 min-h-0 overflow-y-auto">
                {data?.data && data.data.length > 0 ? (
                  groupTreeProps ? (
                    <GroupTree
                      key={groupTreeProps.resetKey}
                      rootItems={data.data}
                      levels={groupTreeProps.levels}
                      baseParams={groupTreeProps.baseParams}
                      pathname={groupTreeProps.pathname}
                      version={treeVersion}
                      subLevelVersion={groupTreeProps.subLevelVersion}
                      // Mobile: isi tiap grup dimuat lewat INFINITE SCROLL
                      // (bukan pager); daftar grup level-0 tetap dipaginasi
                      // Pagination di footer.
                      infinite
                      renderGroupHeader={(args) => (
                        <GroupHeaderCard
                          {...args}
                          columnMeta={mapColumns[args.level?.column]}
                          aggregates={groupTreeProps.aggregates}
                          columns={mapColumns}
                        />
                      )}
                      renderRow={(row) => mobileItem(row) ?? null}
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
                    data.data.map((x) => {
                      const item = mobileItem(x);
                      if (!item) return null;
                      return cloneElement(item, { key: x.id, ...item.props });
                    })
                  )
                ) : (
                  <NoDataImg className="self-center w-full max-w-sm" />
                )}
              </div>
            ) : (
              <Table2
                reload={loadData}
                columnFilter={columnFilter}
                className="flex-1 min-h-0"
                actions={actions}
                columns={mapColumns}
                data={data.data}
                options={options}
                setSort={setSort}
                resetSorting={resetSorting}
                onOptionsChanged={setOptions}
                group={
                  groupTreeProps
                    ? { ...groupTreeProps, version: treeVersion }
                    : undefined
                }
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
              {/* Info jumlah data (mis. "1–50 / 200") di sebelah kontrol
                  halaman, format sama dgn pager row group. Saat grouping
                  aktif, angkanya menghitung GRUP level-0 (yang dipaginasi). */}
              <div className="flex items-center gap-x-3 ml-auto">
                {pageRangeText && (
                  <span
                    data-testid="page-range"
                    className="text-sm text-muted-foreground whitespace-nowrap"
                  >
                    {pageRangeText}
                  </span>
                )}
                <Pagination
                  currentPage={Number(options.page)}
                  totalPages={data.last_page ?? 1}
                  onPageChanged={(page) => setOptions({ ...options, page })}
                  className="justify-end"
                />
              </div>
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
