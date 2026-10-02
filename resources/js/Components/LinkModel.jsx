import { ArrowRight, PlusIcon, SearchIcon, XIcon } from "lucide-react";
import {
  Command,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "./ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "./ui/popover";
import { Tooltip, TooltipContent, TooltipTrigger } from "./ui/tooltip";
import { camelize, cn } from "@/lib/utils";
import { convertTemplateLink, validate } from "@/lib/linkModelUtils";
import { DIFF_HIGHLIGHT, isChanged } from "@/lib/diffUtils";
import {
  forwardRef,
  memo,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import useLinkModelOptions, {
  buildOptionsPayload,
} from "@/Hooks/useLinkModelOptions";
import useLinkModelInfiniteOptions, {
  LINKMODEL_PAGE_SIZE,
  fetchLinkModelGroupNode,
} from "@/Hooks/useLinkModelInfiniteOptions";
import { normalizeGroupLevels } from "@/Components/Table/Group/groupLevels";
import {
  createLocalGroupFetcher,
  groupNodeFromRows,
  inferLevels,
} from "@/Components/Table/Group/localGroups";

import AdvanceSearchDialog from "./LinkModel/AdvanceSearchDialog";
import GroupedOptions, {
  groupHeaderValue,
  isGroupHeaderValue,
} from "./LinkModel/GroupedOptions";
import InfiniteScrollSentinel from "./LinkModel/InfiniteScrollSentinel";
import { Button } from "./ui/button";
import ClickAwayListener from "react-click-away-listener";
import { Command as CommandPrimitive } from "cmdk";
import { FormPageDialog } from "@/Pages/Core/FormPage";
import { Input } from "./ui/input";
import LoadingIcon from "./LoadingIcon";
import axios from "axios";
import { gooeyToast } from "@/lib/gooeyToast";
import { get, isEqual } from "lodash";
import pluralize from "pluralize";
import useDidMountEffect from "@/Hooks/useDidMountEffect";
import { useLaravelReactI18n } from "laravel-react-i18n";
import usePermission from "@/Hooks/usePermission";
import { useRef } from "react";

// Sentinel value utk baris "add"/"advance search" di CommandList -- BUKAN opsi
// data asli, jadi dikasih value string eksplisit (bukan diserahkan ke inferensi
// otomatis cmdk dari textContent, yg rapuh & beda tiap locale) supaya bisa
// dilacak di `visibleValues` (lihat Tab-autocomplete di bawah) tanpa ikut
// ke-override balik ke opsi data pas user arrow-navigate ke baris ini.
const ADD_VALUE = "__linkmodel_add__";
const ADVANCE_SEARCH_VALUE = "__linkmodel_advance_search__";

/**
 *
 * @param props
 * @param props.value
 * @param props.onValueChange
 * @param props.placeholder
 * @param props.className
 * @param props.disabled
 * @param props.model
 * @param props.group grup bertingkat untuk opsi dropdown DAN grup awal Advance Search
 *   (spec linkmodel-grouping-search): string kolom, list string, atau list
 *   `{column, granularity?, range?}`. Tidak diberikan -> default `$defaultGroups`
 *   model; `[]` -> tanpa grup (menimpa default model). Mode `cache`: hanya kolom
 *   string/relasi/boolean, dikelompokkan di client.
 * @param props.filters
 * @param props.joins
 * @param props.fields kolom non-templateLink yang form butuh (di luar tampilan dropdown).
 *   Hanya kolom ber-`linkable` di server yang akan keluar; kolom sensitif tetap di-gate
 *   `visibleFor`. Default `[]` (hanya kolom templateLink). Lihat spec linkmodel-column-security.
 * @param props.keywords
 * @param props.cache boolean -- muat SELURUH dataset model sekali, filter/cari di client.
 *   Dipakai untuk data referensi kecil & jarang berubah (mis. Currency, Country). Sebelumnya
 *   juga menerima bentuk object `{ enabled, refreshMs }`; bentuk itu DIHAPUS (lihat spec
 *   linkmodel-fetch-optimization) -- kesegaran data sekarang murni dikontrol `staleTime`.
 * @param props.cacheStorage "memory" | "localStorage" | "sessionStorage" | "indexedDB"
 * @param props.staleTime durasi (ms) data dianggap masih segar setelah fetch -- dalam window
 *   ini, buka-tutup dropdown atau remount TIDAK memicu fetch baru. Default 120000 (2 menit),
 *   sama dengan default global TanStack Query di `lib/queryClient.js`. Override per-instance
 *   untuk field yang datanya sering berubah (mis. stok Item).
 * @param props.canNavigation FQCN model target navigasi (mis. "App\\Models\\Inventory\\Item").
 *   Kalau diisi, tombol navigasi di-gate `canGlobal(model, "read", { user_id })` ke model INI,
 *   bukan `model` prop utama. Dipakai saat target navigasi (`as="name:keyRoute"`) beda dari
 *   model data (mis. SalesOrderItem menavigasi ke halaman Item). Default: fallback ke
 *   `can("read", { user_id: option.created_by_id })` (model utama).
 * @param props.requireReselectIfDeleted Saat true, field ini wajib diisi ulang bila
 *   relasi yang tersimpan sudah di-soft-delete (`deleted_at` terisi) — dipasang HANYA
 *   pada field master data operasional (Item, Account, Customer, dst) di form draft.
 *   Field non-operasional (mis. User pembuat) tidak perlu prop ini; badge peringatan
 *   tetap tampil independen dari prop ini, hanya blocking submit yang bergantung.
 */
export default memo(
  forwardRef(function LinkModel(
    {
      id,
      as,
      valueBefore,
      defaultValue,
      value,
      onValueChange,
      placeholder,
      className,
      disabled,
      readOnly,
      required,
      model,
      group,
      filters,
      joins,
      keywords,
      cache = false,
      cacheStorage = "memory",
      staleTime = 120_000,
      translate,
      titleDialog,
      classNameDialog,
      disabledNavigation,
      disabledAddButton,
      defaultValueForm,
      form,
      postOption,
      onKeyDown,
      with: _with,
      fields,
      order,
      customNavigation,
      canNavigation,
      requireReselectIfDeleted,
    },
    ref,
  ) {
    const { t } = useLaravelReactI18n();
    const [open, setOpen] = useState(false);
    const [_option, _setOption] = useState(value);
    const [search, setSearch] = useState(convertTemplateLink(value ?? ""));
    const [allowSearch, setAllowSearch] = useState(true);
    const [resolvingDefault, setResolvingDefault] = useState(false);
    const [openDialog, setOpenDialog] = useState(false);
    const [openAdvanceSearch, setOpenAdvanceSearch] = useState(false);
    // Snapshot terpisah dari `search` -- menutup dropdown (`setOpen(false)`)
    // buat buka dialog ini memicu efek exact-match-on-close existing di bawah
    // (baris "!option && search" -> setSearch("")) kalau teks yg diketik tak
    // cocok opsi manapun. Reactive `initialSearch={search}` akan race dgn efek
    // itu (search keburu di-reset SEBELUM AdvanceSearchDialog sempat baca).
    // Snapshot di sini diambil SINKRON di handler klik, sebelum setOpen(false).
    const [advanceSearchText, setAdvanceSearchText] = useState("");
    // Dipakai KHUSUS utk keputusan fokus-lock Tab-autocomplete di bawah --
    // LinkModel gak py flag "lagi ngetik" spt Select/MultiSelect (di sini
    // ketikan langsung `setOption(null)` di `onInputKeyDown`, gak ditunda).
    const [isDirty, setIsDirty] = useState(false);
    useEffect(() => {
      if (open) setIsDirty(false);
    }, [open]);
    // Dropdown tak boleh tetap/ter-buka kembali selagi dialog Advance Search
    // terbuka (event dari dialog yang di-portal ikut bubbling di pohon React).
    useEffect(() => {
      if (openAdvanceSearch && open) setOpen(false);
    }, [openAdvanceSearch, open]);
    const { can, canGlobal } = usePermission(model);

    // Grup efektif dari prop (`undefined` = pakai default model di server).
    const groupKey = JSON.stringify(group ?? null);
    const groupProp = useMemo(
      () =>
        group === undefined || group === null
          ? undefined
          : normalizeGroupLevels(group),
      [groupKey],
    );

    // Mode cache: seluruh dataset dimuat sekali (hook lama). Mode search:
    // infinite scroll + pohon grup lazy (hook baru) -- keduanya di-gate agar
    // hanya satu yang fetch.
    const cached = useLinkModelOptions({
      model,
      filters,
      joins,
      with: _with,
      fields,
      keywords,
      order,
      translate,
      search,
      open: !!cache && open,
      allowSearch,
      cacheMode: !!cache,
      cacheStorage,
      staleTime,
    });
    const searched = useLinkModelInfiniteOptions({
      model,
      filters,
      joins,
      with: _with,
      fields,
      keywords,
      order,
      translate,
      search,
      open: !cache && open,
      allowSearch,
      group: groupProp,
      staleTime,
    });
    const options = cache ? cached.options : searched.options;
    const fetchLoading = cache ? cached.loading : searched.loading;
    const loading = fetchLoading || resolvingDefault;
    // Registri baris yang pernah dirender di pohon grup -- Tab-autocomplete &
    // exact-match-on-close butuh mencari opsi yg tidak ada di daftar flat.
    const knownRowsRef = useRef(new Map());

    const { name, keyRoute } = useMemo(() => {
      if (as) {
        const [name, keyRoute] = as.split(":");
        return { name: camelize(name), keyRoute };
      }
      return {
        name: camelize((model ?? "").split("\\").pop()),
        keyRoute: "id",
      };
    }, [as, model]);

    const route = window.route;
    const isControlled = value !== undefined;
    const commandRef = useRef(null);

    const option = useMemo(() => {
      return isControlled ? value : _option;
    }, [isControlled, value, _option]);

    const isDeleted = !!option?.deleted_at;

    useDidMountEffect(() => {
      _setOption((prev) => {
        // kalau sama, jangan trigger apa-apa
        if (isEqual(prev, value)) return prev;

        return value;
      });
    }, [value]);

    const setOption = useCallback(
      (val) => {
        if (disabled || readOnly) return;
        if (val) {
          const isValid = validate(val, model);
          if (!isValid) return;
        }
        if (isControlled) {
          if (isEqual(value, val)) return;
          onValueChange?.(val);
          return;
        }
        _setOption((prev) => {
          // kalau sama, jangan trigger apa-apa
          if (isEqual(prev, val)) return prev;
          onValueChange?.(val);
          return val;
        });
      },
      [
        onValueChange,
        _setOption,
        disabled,
        readOnly,
        filters,
        isControlled,
        value,
      ],
    );

    // requireReselectIfDeleted: kosongkan value begitu terdeteksi relasi yang
    // tersimpan sudah di-soft-delete, agar field jadi invalid oleh validasi
    // `required` yang sudah ada (memaksa user memilih ulang sebelum submit),
    // tanpa perlu API baru untuk expose state validitas ke form parent.
    const reselectHandledRef = useRef(false);
    useEffect(() => {
      if (!requireReselectIfDeleted || !isDeleted) return;
      if (reselectHandledRef.current) return;
      reselectHandledRef.current = true;
      setOption(null);
      setSearch("");
    }, [requireReselectIfDeleted, isDeleted]);

    useEffect(() => {
      if (open) return;

      if (isControlled && value === null) {
        setAllowSearch(true);
        if (search) {
          setSearch("");
        }
        return;
      }
      if (!option && search) {
        const findOption = [...options, ...knownRowsRef.current.values()].find(
          (x) => convertTemplateLink(x).toLowerCase() == search.toLowerCase(),
        );
        if (findOption) {
          setOption(findOption);

          return;
        }
        setAllowSearch(false);
        setSearch("");
      }
    }, [open, isControlled, value, search, option, options, setOption]);

    useEffect(() => {
      if (option) {
        setAllowSearch(false);
        setSearch(convertTemplateLink(option));
      } else if (!open) {
        setAllowSearch(true);
        setSearch("");
      }
    }, [option]);

    useEffect(() => {
      if (valueBefore !== undefined) {
        return;
      }
      if (!(option || value)) return;
      const isValid = validate(option || value, model);

      if (!isValid) {
        setOption(null);
      }
    }, [filters, option, value, model]);

    // Resolve `defaultValue` -- fetch TERPISAH dari daftar opsi dropdown
    // (query semantiknya beda: mengisi `option`, bukan menampilkan list).
    // TETAP imperatif (bukan lewat useLinkModelOptions), lihat requirements.md
    // Requirement 1 AC4. `cacheMode: !!cache` mempertahankan perilaku lama --
    // payload tetap benar menyertakan `filters` berkat `buildOptionsPayload`
    // (fix bug yang sama juga berlaku di jalur ini, bukan cuma di hook).
    const defaultKey = useMemo(
      () => (defaultValue ? JSON.stringify(defaultValue) : null),
      [defaultValue],
    );

    const loadedDefaultKeyRef = useRef(null);

    useEffect(() => {
      if (!defaultKey || value || !model) return;

      if (loadedDefaultKeyRef.current === defaultKey) return;
      loadedDefaultKeyRef.current = defaultKey;

      setResolvingDefault(true);
      const reloadModel = setTimeout(() => {
        const payload = buildOptionsPayload({
          model,
          cacheMode: !!cache,
          joins,
          search,
          with: _with,
          fields,
          filters,
          filterForDefaultValue: defaultValue,
          keywords,
          order,
          translate,
        });
        axios
          .post(route("model"), payload)
          .then((res) => {
            const data = res.data.data;
            if (data.length <= 0) return;
            setOption(data[0]);
          })
          .catch(() => {
            gooeyToast.error(t("core.errors.fetch_failed"));
          })
          .finally(() => {
            setResolvingDefault(false);
          });
      }, 500);

      return () => clearTimeout(reloadModel);
    }, [defaultKey, value]);

    const onInputKeyDown = (e) => {
      if (e.key == "Enter" && open) return;
      if (
        e.ctrlKey ||
        e.metaKey ||
        e.shiftKey ||
        e.altKey ||
        e.key == "Tab" ||
        e.key == "Enter"
      ) {
        onKeyDown?.(e);
        return;
      }
      if (readOnly || disabled) return;
      if (option) {
        setOption(null);
      }
      setIsDirty(true);
      if (!open) {
        setOpen(true);
      }
    };

    const onSuccessFormPageDialog = (e) => {
      setOpen(false);
      axios
        .post(route("model"), {
          model,
          with: _with,
          id: e.props.flash.id ?? null,
        })
        .then((res) => {
          setOption(res.data);
        })
        .catch(() => {
          gooeyToast.error(t("core.errors.fetch_failed"));
        });
    };

    const diff = useMemo(() => {
      const before = convertTemplateLink(valueBefore);
      const after = convertTemplateLink(value);
      const changed = isChanged(valueBefore, value);
      return {
        before: changed && before,
        after,
        same: !changed,
      };
    }, [value, valueBefore]);

    const filteredOptions = useMemo(() => {
      if (!cache) return options;
      let list = options.filter((opt) => validate(opt, model));
      if (cache && order) {
        const [col, dir = "asc"] = (order ?? "").split(":");
        list = [...list].sort((a, b) => {
          const va = col ? a[col] : convertTemplateLink(a);
          const vb = col ? b[col] : convertTemplateLink(b);
          if (va == null && vb == null) return 0;
          if (va == null) return dir === "asc" ? -1 : 1;
          if (vb == null) return dir === "asc" ? 1 : -1;
          if (typeof va === "number" && typeof vb === "number") {
            return dir === "asc" ? va - vb : vb - va;
          }
          return (
            String(va).localeCompare(String(vb)) * (dir === "asc" ? 1 : -1)
          );
        });
      }
      if (!search) return list;
      const keyword = (search ?? "")?.toLowerCase();
      return list.filter((opt) =>
        convertTemplateLink(opt, "", true).toLowerCase().includes(keyword),
      );
    }, [cache, options, search, filters, order, model]);

    // Mode cache + grup: pengelompokan di client (string/relasi/boolean). Level
    // diturunkan dari SELURUH dataset (bukan hasil filter search) supaya tipe
    // tak berubah saat ketikan menyempit.
    const localLevels = useMemo(
      () =>
        cache && groupProp?.length
          ? inferLevels(groupProp, cached.options)
          : [],
      [cache, groupProp, cached.options],
    );
    const isGrouped = cache ? localLevels.length > 0 : searched.isGrouped;
    const filteredRef = useRef(filteredOptions);
    filteredRef.current = filteredOptions;
    const localFetcher = useMemo(
      () =>
        createLocalGroupFetcher({
          getRows: () => filteredRef.current,
          levels: localLevels,
        }),
      [localLevels],
    );
    const localRootItems = useMemo(
      () =>
        cache && localLevels.length
          ? groupNodeFromRows(
              filteredOptions,
              localLevels,
              [],
              1,
              Math.max(1, filteredOptions.length),
            ).data
          : [],
      [cache, localLevels, filteredOptions],
    );
    const rootItems = cache ? localRootItems : searched.rootItems;
    const groupLevels = cache
      ? localLevels
      : (searched.groupMeta?.levels ?? []);

    // Infinite scroll mode cache: render bertahap (jendela bertambah saat
    // sentinel terlihat) supaya DOM tak membengkak utk dataset besar.
    const [cacheWindow, setCacheWindow] = useState(LINKMODEL_PAGE_SIZE);
    useEffect(() => {
      setCacheWindow(LINKMODEL_PAGE_SIZE);
    }, [search, open]);
    const flatOptions = useMemo(
      () => (cache ? filteredOptions.slice(0, cacheWindow) : filteredOptions),
      [cache, filteredOptions, cacheWindow],
    );
    const hasMoreFlat = cache
      ? cacheWindow < filteredOptions.length
      : searched.hasNextPage;
    const fetchMoreFlat = useCallback(
      () =>
        cache
          ? setCacheWindow((n) => n + LINKMODEL_PAGE_SIZE)
          : searched.fetchNextPage(),
      [cache, searched.fetchNextPage],
    );
    // Auto-expand hanya utk hasil yang cocok dgn ketikan SEKARANG: selama
    // debounce, grup lama (dari pencarian sebelumnya) masih tampil -- membukanya
    // memicu fetch lazy sia-sia utk hasil yang segera diganti.
    const searchSettled =
      cache || (searched.settledSearch ?? "") === (search ?? "");
    const autoExpand = useMemo(
      () =>
        allowSearch && search?.trim() && searchSettled
          ? { budget: LINKMODEL_PAGE_SIZE }
          : undefined,
      [allowSearch, search, searchSettled],
    );
    const groupedEmpty = isGrouped && rootItems.length === 0;
    const flatEmpty = !isGrouped && (!flatOptions || flatOptions.length === 0);

    const disabledAdd = useMemo(() => {
      if (disabledAddButton) return true;
      else if (!form) return true;
      else if (!can("create")) return true;
      return false;
    }, [disabledAddButton, form, can]);

    // cmdk dikontrol via `value`/`onValueChange` sendiri (bukan diserahkan ke
    // auto-highlight bawaan cmdk) -- auto-highlight cmdk cuma jalan SEKALI
    // saat mount/registrasi item pertama, TIDAK otomatis pindah ke item lain
    // kalau item yg lagi ke-highlight hilang dari DOM krn hasil search server
    // berubah (`filteredOptions` bisa berganti total begitu fetch baru
    // selesai). Sama gotcha yg ditemukan & difix di MultiSelect.jsx/
    // Select.jsx. Baris "more"/"add" ikut dilacak (via MORE_VALUE/ADD_VALUE)
    // biar navigasi arrow ke situ gak ke-override balik ke opsi data.
    const [highlightedValue, setHighlightedValue] = useState();
    const visibleValues = useMemo(() => {
      // Selalu di-stringify -- cmdk internal nge-treat `value` sbg string
      // (panggil `.trim()` dsb saat controlled via prop `value`/onValueChange
      // di <Command>), sedangkan `opt.id` di sini bisa numeric (PK integer,
      // bukan cuma ULID string). ADVANCE_SEARCH_VALUE/ADD_VALUE SELALU masuk
      // (item itu SELALU dirender terlepas dari `loading`, lihat CommandList
      // di bawah -- user bisa buka Advance Search/Add walau data masih fetching).
      const ids = isGrouped
        ? []
        : (flatOptions ?? []).map((opt, index) => `${opt.id ?? index}`);
      ids.push(ADVANCE_SEARCH_VALUE);
      if (!disabledAdd) ids.push(ADD_VALUE);
      return ids;
    }, [flatOptions, isGrouped, disabledAdd]);
    // Mode grup: sorotan awal = header grup pertama (nilai cmdk header dibuat
    // dari path JSON); baris/header lain dilacak cmdk sendiri, bukan visibleValues.
    const firstGroupValue =
      isGrouped && rootItems[0]
        ? groupHeaderValue(JSON.stringify([rootItems[0].raw]))
        : undefined;
    // ADVANCE_SEARCH_VALUE/ADD_VALUE SELALU ada di visibleValues (poin di atas)
    // -- termasuk SEBELUM data pertama kali datang (saat filteredOptions masih
    // kosong). Tanpa guard ini, begitu opsi data ASLI datang, reset-effect di
    // bawah TIDAK pernah fire lagi (sentinel yg lagi ke-highlight tetap valid
    // di visibleValues baru), jadi default highlight nyangkut di sentinel
    // selamanya alih-alih pindah ke opsi data pertama (kontrak existing yg
    // divalidasi test Tab-autocomplete). Deteksi transisi KOSONG->ADA-DATA
    // secara eksplisit & paksa default ke opsi data pertama SAAT ITU JUGA --
    // TIDAK override navigasi manual user (ref cuma reset pas transisi itu,
    // bukan tiap render/tiap filteredOptions berubah referensi).
    const hadDataOptionsRef = useRef(false);
    const hadGroupsRef = useRef(false);
    useEffect(() => {
      if (isGrouped) {
        // Transisi KOSONG -> ADA grup: sorotan awal = header pertama, walau
        // cmdk sudah memilih sentinel "Advance Search" (item pertama yang
        // sempat terdaftar saat data belum tiba) -- sama alasan dgn mode flat.
        const hasGroups = !!firstGroupValue;
        if (hasGroups && !hadGroupsRef.current) {
          hadGroupsRef.current = true;
          setHighlightedValue(firstGroupValue);
          return;
        }
        hadGroupsRef.current = hasGroups;
        const tracked =
          isGroupHeaderValue(highlightedValue) ||
          knownRowsRef.current.has(highlightedValue) ||
          visibleValues.includes(highlightedValue);
        if (!tracked) setHighlightedValue(firstGroupValue ?? visibleValues[0]);
        return;
      }
      const hasDataOptions = (flatOptions?.length ?? 0) > 0;
      if (hasDataOptions && !hadDataOptionsRef.current) {
        hadDataOptionsRef.current = true;
        setHighlightedValue(`${flatOptions[0].id ?? 0}`);
        return;
      }
      hadDataOptionsRef.current = hasDataOptions;
      if (!visibleValues.includes(highlightedValue)) {
        setHighlightedValue(visibleValues[0]);
      }
    }, [visibleValues, flatOptions, isGrouped, firstGroupValue]);

    const routeId = useMemo(
      () => get(option, keyRoute ?? "id"),
      [option, keyRoute],
    );

    const navAllowed = useMemo(() => {
      if (!option) return false;
      if (canNavigation) {
        const navOwnerScope = keyRoute?.includes(".")
          ? get(option, keyRoute.split(".").slice(0, -1).join("."))
          : option;
        return canGlobal(canNavigation, "read", {
          user_id: navOwnerScope?.created_by_id,
        });
      }
      return can("read", { user_id: option?.created_by_id });
    }, [option, keyRoute, canNavigation, can, canGlobal]);
    return (
      <ClickAwayListener onClickAway={() => setOpen(false)}>
        <div className={cn("w-full", className)}>
          <Popover open={open} onOpenChange={() => {}}>
            <Command
              className="relative h-full overflow-visible bg-transparent"
              ref={commandRef}
              loop
              value={highlightedValue}
              onValueChange={setHighlightedValue}
              onKeyDown={(e) => {
                // Tab CUMA nulis label opsi yg lagi di-highlight keyboard ke
                // search (autocomplete) -- TIDAK langsung memilihnya. Commit
                // beneran tetap lewat mekanisme exact-match on-close yg SUDAH
                // ada (efek `[open, ...]` di bawah), sama kayak kalau user
                // ngetik label itu manual lalu blur. Baris "more"/"add"
                // sengaja DIABAIKAN -- itu bukan opsi data, gak ada teks yg
                // masuk akal buat di-autocomplete-kan.
                // Panah kanan/kiri pada header grup yang di-highlight: buka/
                // tutup grup (pola tree-view). Hanya bila aksinya berlaku
                // (kanan = grup tertutup, kiri = grup terbuka); selain itu
                // biarkan default (geser caret input).
                if (e.key === "ArrowRight" || e.key === "ArrowLeft") {
                  if (!isGroupHeaderValue(highlightedValue)) return;
                  // Popover dirender di portal -> bukan turunan DOM commandRef.
                  const header = document.querySelector(
                    '[data-testid="linkmodel-group-header"][data-selected="true"]',
                  );
                  if (!header) return;
                  const isOpen =
                    header.getAttribute("aria-expanded") === "true";
                  if ((e.key === "ArrowRight") === isOpen) return;
                  e.preventDefault();
                  header.click();
                  return;
                }
                if (e.key !== "Tab") return;
                if (
                  highlightedValue == null ||
                  isGroupHeaderValue(highlightedValue) ||
                  highlightedValue === ADVANCE_SEARCH_VALUE ||
                  highlightedValue === ADD_VALUE
                ) {
                  return;
                }
                const opt =
                  flatOptions.find(
                    (o, i) => `${o.id ?? i}` === highlightedValue,
                  ) ?? knownRowsRef.current.get(highlightedValue);
                if (!opt) return;
                if (isDirty) e.preventDefault();
                setAllowSearch(true);
                setSearch(convertTemplateLink(opt));
                setIsDirty(true);
              }}
            >
              <Tooltip>
                <TooltipTrigger asChild>
                  <PopoverTrigger
                    asChild
                    className={cn(
                      "flex h-full bg-muted items-center  overflow-hidden border rounded-md cursor-default group/model relative focus-within:border-0 border-input ring-offset-background  focus-within:outline-none focus-within:ring-1 focus-within:ring-ring focus-within:ring-offset-1",
                      valueBefore !== undefined &&
                        !diff?.same &&
                        DIFF_HIGHLIGHT,
                      disabled && "cursor-not-allowed opacity-50",
                      className,
                    )}
                  >
                    <div>
                      <Input
                        id={id}
                        ref={ref}
                        disabled={disabled}
                        readOnly={readOnly}
                        onKeyDown={onInputKeyDown}
                        onClick={(e) => {
                          e.preventDefault();
                          if (!(option && search) && !open) {
                            setOpen(true);
                          }
                        }}
                        required={required}
                        value={search}
                        onChange={(e) => {
                          setAllowSearch(true);
                          setSearch(e.target.value);
                        }}
                        onBlur={() => {
                          // Diperlukan spesifik utk Tab-autocomplete: Tab
                          // TANPA klik gak lewat ClickAwayListener (itu cuma
                          // dengar mousedown/click), jadi tanpa onBlur ini
                          // popover gak pernah nutup+commit teks yg ditulis
                          // Tab abis fokus pindah keluar. Efek exact-match
                          // on-close yang commit -- satu sumber kebenaran,
                          // sama kayak jalur ngetik manual.
                          setOpen(false);
                        }}
                        className={cn(
                          "focus:border-0! bg-inherit! disabled:opacity-100! h-8 w-full rounded-none! pr-2! border-0!  focus-visible:ring-0! focus-visible:ring-offset-0!  ",
                          // diff.same && "text-",
                        )}
                        placeholder={placeholder}
                      />
                      <div className="flex items-center h-8 pr-2 w-fit gap-x-2">
                        {loading ? (
                          <LoadingIcon className="size-4" />
                        ) : (
                          <>
                            {!disabledNavigation &&
                              name &&
                              option &&
                              search &&
                              navAllowed && (
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="icon"
                                  className={cn(
                                    "size-6 hidden",
                                    valueBefore && "inline-flex!",
                                    option &&
                                      search &&
                                      "group-focus-within/model:inline-flex",
                                  )}
                                  onClick={() => {
                                    if (!name || !option || !search) return;
                                    if (
                                      customNavigation &&
                                      typeof customNavigation === "function"
                                    ) {
                                      customNavigation(value);
                                    }
                                    const pluralized = `${pluralize.plural(name ?? "")}.show`;
                                    window.open(
                                      route(pluralized, routeId),
                                      "_blank",
                                    );
                                  }}
                                >
                                  <ArrowRight className="size-3" />
                                </Button>
                              )}
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className={cn(
                                "size-6 ",
                                (!search || disabled || readOnly) && "hidden",
                              )}
                              onClick={() => {
                                setOption(null);

                                setSearch("");
                              }}
                            >
                              <XIcon className="size-3" />
                            </Button>
                          </>
                        )}
                      </div>
                    </div>
                  </PopoverTrigger>
                </TooltipTrigger>
                {valueBefore && !diff?.same && (
                  <TooltipContent side="top" align="start">
                    {diff?.before && (
                      <>
                        <s>{diff?.before}</s>
                        <br />
                      </>
                    )}
                    <span>{diff?.after}</span>
                  </TooltipContent>
                )}
              </Tooltip>
              {!(disabled || readOnly) && (
                <PopoverContent
                  onOpenAutoFocus={(e) => e.preventDefault()}
                  align="start"
                  side="bottom"
                  className="relative z-50 w-auto  min-w-(--radix-popover-trigger-width) p-0 "
                  forceMount
                  asChild
                >
                  <CommandList
                    className="p-1 pb-0 space-y-2"
                    // Cegah browser memindah/menghapus fokus dari Input saat
                    // area ini di-mousedown (klik opsi/more/add) -- Input
                    // sekarang punya `onBlur` (utk Tab-autocomplete di atas),
                    // tanpa guard ini klik bisa nge-trigger blur DULUAN
                    // (browser default: mousedown geser fokus) sebelum
                    // onSelect klik itu sendiri sempat jalan.
                    onMouseDown={(e) => e.preventDefault()}
                  >
                    {loading ? (
                      <CommandPrimitive.Loading>
                        <div className="flex justify-center py-6 text-sm font-normal text-center text-foreground gap-x-4">
                          <LoadingIcon className="size-4" />
                          <span>{t("core.form.loading")} ...</span>
                        </div>
                      </CommandPrimitive.Loading>
                    ) : (
                      <>
                        {/* BUKAN <CommandEmpty> -- primitif cmdk itu
                            self-hide berdasar JUMLAH GLOBAL CommandItem
                            terdaftar (state.filtered.count), dan CommandItem
                            "Advance Search" SEKARANG SELALU terdaftar (di
                            luar ternary ini), jadi count tak pernah 0 lagi
                            walau filteredOptions kosong -- pesan "tidak
                            ditemukan" jadi tak pernah muncul. Kondisi manual
                            di sini independen dari state internal cmdk. */}
                        {(flatEmpty || groupedEmpty) && (
                          <div
                            role="presentation"
                            className="py-6 text-sm text-center"
                          >
                            {t("core.form.not_found")}
                          </div>
                        )}
                        {isGrouped ? (
                          <GroupedOptions
                            rootItems={rootItems}
                            levels={groupLevels}
                            baseParams={
                              cache
                                ? { model, search: search ?? "" }
                                : (searched.baseParams ?? {})
                            }
                            fetcher={
                              cache ? localFetcher : fetchLinkModelGroupNode
                            }
                            pathname={
                              cache ? `linkmodel-local:${model}` : "linkmodel"
                            }
                            resetKey={
                              cache
                                ? `${model}|${search ?? ""}`
                                : JSON.stringify(searched.baseParams)
                            }
                            search={allowSearch ? search : ""}
                            autoExpand={autoExpand}
                            hasNextRoot={!cache && searched.hasNextPage}
                            fetchNextRoot={searched.fetchNextPage}
                            fetchingRoot={!cache && searched.isFetchingNextPage}
                            knownRef={knownRowsRef}
                            onPick={(row) => {
                              setOption(row);
                              setOpen(false);
                            }}
                          />
                        ) : (
                          flatOptions?.map((opt, index) => {
                            return (
                              <CommandItem
                                key={opt.id ?? index}
                                value={`${opt.id ?? index}`}
                                onSelect={() => {
                                  setOption(opt);

                                  setOpen(false);
                                }}
                              >
                                <p
                                  dangerouslySetInnerHTML={{
                                    __html: convertTemplateLink(
                                      opt,
                                      search ?? "",
                                    ),
                                  }}
                                />
                              </CommandItem>
                            );
                          })
                        )}
                        {!isGrouped && (
                          <InfiniteScrollSentinel
                            onIntersect={fetchMoreFlat}
                            enabled={!!hasMoreFlat}
                            loading={!cache && searched.isFetchingNextPage}
                          />
                        )}
                      </>
                    )}
                    {/* Grouping aksi: Advance Search (selalu ada) + Add
                        (kondisional) -- SELALU dirender terlepas dari `loading`
                        (user bisa buka Advance Search/Add walau data masih
                        fetching), Advance Search SELALU sebelum Add. Sticky
                        BOTTOM -- CommandList di atas adalah scroll container
                        sungguhan (max-h-[300px] overflow-y-auto, lihat
                        ui/command.jsx), jadi grup aksi ini tetap kelihatan pas
                        daftar opsi discroll, bukan ikut ter-scroll ke bawah.
                        `sticky bottom-0` MENGHORMATI padding-bottom scroll
                        container (terukur di browser: dasar grup berhenti
                        setinggi padding di atas dasar scrollport, jalur itu
                        membocorkan item yg discroll) -- makanya CommandList
                        di atas `pb-0` dan grup ini pegang `pb-1` sendiri. */}
                    <div className="sticky bottom-0 z-10 bg-popover pt-1 -mx-1 px-1 pb-1">
                      <CommandSeparator />
                      <CommandItem
                        value={ADVANCE_SEARCH_VALUE}
                        onSelect={() => {
                          setAdvanceSearchText(search);
                          setOpen(false);
                          setOpenAdvanceSearch(true);
                        }}
                      >
                        <SearchIcon className="size-4" />
                        {t("core.form.linkmodel.advance_search")}
                      </CommandItem>
                      {!disabledAdd && (
                        <CommandItem
                          value={ADD_VALUE}
                          onSelect={() => {
                            if (form) {
                              setOpenDialog(true);
                              return;
                            }

                            if (!name) return;
                            const pluralized = `${pluralize.plural(name ?? "")}.create`;
                            window.open(route(pluralized), "_blank");
                          }}
                        >
                          <PlusIcon className="size-4" />
                          {titleDialog}
                        </CommandItem>
                      )}
                    </div>
                  </CommandList>
                </PopoverContent>
              )}
            </Command>
            {!disabledAdd && (
              <FormPageDialog
                title={titleDialog}
                name={name}
                open={openDialog}
                onOpenChange={setOpenDialog}
                className={cn("max-w-4xl", classNameDialog)}
                defaultValue={defaultValueForm}
                onSuccess={onSuccessFormPageDialog}
                postOption={postOption}
              >
                {form}
              </FormPageDialog>
            )}
          </Popover>
          <AdvanceSearchDialog
            open={openAdvanceSearch}
            onOpenChange={setOpenAdvanceSearch}
            model={model}
            filters={filters}
            fields={fields}
            joins={joins}
            with={_with}
            order={order}
            translate={translate}
            group={groupProp}
            initialSearch={advanceSearchText}
            onSelect={(row) => {
              setOption(row);
              setOpenAdvanceSearch(false);
            }}
          />
          {isDeleted && (
            <p className="text-sm text-yellow-600 dark:text-yellow-400 mt-1">
              {requireReselectIfDeleted
                ? t("core.form.link_model_deleted_reselect_required")
                : t("core.form.link_model_deleted")}
            </p>
          )}
        </div>
      </ClickAwayListener>
    );
  }),
);
