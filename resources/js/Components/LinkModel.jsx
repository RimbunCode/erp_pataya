import {
  ArrowRight,
  CheckIcon,
  PlusIcon,
  SearchIcon,
  XIcon,
} from "lucide-react";
import {
  Command,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "./ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "./ui/popover";
import { Tooltip, TooltipContent, TooltipTrigger } from "./ui/tooltip";
import { camelize, cn } from "@/lib/utils";
import {
  buildSources,
  convertTemplateLink,
  optionKey,
  validate,
} from "@/lib/linkModelUtils";
import { DIFF_HIGHLIGHT, isChanged } from "@/lib/diffUtils";
import SemanticTemplate from "@/Components/SemanticTemplate/SemanticTemplate";
import { templateToText } from "@/Components/SemanticTemplate/templateEngine";
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
import ChipList from "./ChipList";
import GroupedOptions, {
  groupHeaderValue,
  isGroupHeaderValue,
} from "./LinkModel/GroupedOptions";
import InfiniteScrollSentinel from "./LinkModel/InfiniteScrollSentinel";
import SourceSection, {
  SourceHeader,
  isSourceHeaderValue,
} from "./LinkModel/SourceSection";
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

// Nama resource (untuk route `<plural>.show/create`) & key route dari prop `as`
// ("name:keyRoute") atau, bila tak ada, dari nama class model.
const navFor = (as, model) => {
  if (as) {
    const [name, keyRoute] = as.split(":");

    return { name: camelize(name), keyRoute };
  }

  return {
    name: camelize((model ?? "").split("\\").pop()),
    keyRoute: "id",
  };
};

// Value cmdk baris Add: main tetap ADD_VALUE (kompatibel), sub berprefiks indeks.
const addValueFor = (index) =>
  index === 0 ? ADD_VALUE : `${ADD_VALUE}:${index}`;
const isAddValue = (value) =>
  typeof value === "string" && value.startsWith(ADD_VALUE);

// Peringatan konfigurasi `subModels` cukup sekali per pesan (komponen render ulang).
const warnedMessages = new Set();
const warnOnce = (message) => {
  if (warnedMessages.has(message)) return;
  warnedMessages.add(message);
  console.warn(message);
};

/**
 *
 * @param props
 * @param props.value
 * @param props.onValueChange
 * @param props.placeholder
 * @param props.className
 * @param props.disabled
 * @param props.model model utama (main).
 * @param props.mainLabel label header bagian main (spec linkmodel-multi-model). Diisi ->
 *   main dibungkus header buka-tutup (terbuka default); tidak diisi -> main tampil sbg
 *   daftar biasa. Hanya bermakna bila `subModels` ada.
 * @param props.subModels daftar sub model (spec linkmodel-multi-model): tiap elemen
 *   `{model, label, filters, with, fields, order, keywords, translate, group}` (+ opsi
 *   add/navigate). `model` & `label` wajib; sub SELALU dibungkus header, tertutup &
 *   di-fetch lazy (saat dibuka / saat user mengetik). Dedupe terhadap main dilakukan
 *   konsumen lewat `filters` sub (mis. `{ id: { notIn: [...] } }`). Tanpa prop ini
 *   perilaku identik dengan satu model.
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
 * @param props.multiple mode multi value (spec finance-multi-tax-per-item, Requirement 9):
 *   `value` = array objek (bentuk tiap elemen sama dgn nilai tunggal), `onValueChange(array)`.
 *   Memilih opsi = toggle (dropdown tetap terbuka, urutan pilihan terjaga); nilai tampil
 *   sbg chip (label = navigasi ke halaman detail, X = cabut). `valueBefore` = array,
 *   diff ditandai per chip. TIDAK didukung bersama `subModels` (diabaikan + warning).
 *   Kosong = array kosong `[]`. `defaultValue` tidak dipakai di mode ini.
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
      mainLabel,
      subModels,
      multiple = false,
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
      includeGlobalBranch = false,
    },
    ref,
  ) {
    const { t } = useLaravelReactI18n();
    const [open, setOpen] = useState(false);
    const isMultiple = !!multiple;
    const [_option, _setOption] = useState(isMultiple ? (value ?? []) : value);
    const [search, setSearch] = useState(
      isMultiple ? "" : convertTemplateLink(value ?? ""),
    );
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

    // Sumber dropdown: [main, ...subModels valid]. `isMulti` = ada sub model;
    // tanpa itu seluruh jalur lama (satu model) dipakai apa adanya.
    if (isMultiple && subModels?.length) {
      warnOnce(
        "LinkModel: `multiple` tidak mendukung `subModels` pada rilis ini, `subModels` diabaikan.",
      );
    }
    const sources = buildSources(
      { model, mainLabel, subModels: isMultiple ? undefined : subModels },
      warnOnce,
    );
    const isMulti = sources.length > 1;
    const modelsKey = sources.map((s) => s.model).join("|");
    // Daftar model yang diizinkan utk validasi opsi (`thisModel`).
    const allModels = useMemo(
      () => (isMulti ? modelsKey.split("|") : model),
      [isMulti, modelsKey, model],
    );
    const mainSource = sources[0];
    const subSources = sources.slice(1);
    const [mainExpanded, setMainExpanded] = useState(true);
    useEffect(() => {
      if (!open) setMainExpanded(true);
    }, [open]);
    // Status hasil tiap bagian sub (dilaporkan SourceSection) -- dasar pesan
    // "tidak ditemukan" lintas sumber saat mencari.
    const [subStatus, setSubStatus] = useState({});
    const onSubStatus = useCallback((index, status) => {
      setSubStatus((prev) =>
        prev[index]?.hasResults === status.hasResults &&
        prev[index]?.settled === status.settled
          ? prev
          : { ...prev, [index]: status },
      );
    }, []);

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
      includeGlobalBranch,
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
      includeGlobalBranch,
    });
    const options = cache ? cached.options : searched.options;
    const fetchLoading = cache ? cached.loading : searched.loading;
    const loading = fetchLoading || resolvingDefault;
    // Registri baris yang pernah dirender di pohon grup -- Tab-autocomplete &
    // exact-match-on-close butuh mencari opsi yg tidak ada di daftar flat.
    const knownRowsRef = useRef(new Map());

    const route = window.route;
    const isControlled = value !== undefined;
    const commandRef = useRef(null);

    const rawValue = isControlled ? value : _option;
    // Mode multiple: `option` (nilai tunggal) selalu null supaya efek/handler
    // mode tunggal di bawah tidak menyentuh array; daftar pilihan = `selected`.
    const option = isMultiple ? null : rawValue;
    const selected = useMemo(
      () => (isMultiple && Array.isArray(rawValue) ? rawValue : []),
      [isMultiple, rawValue],
    );

    // Konfigurasi navigasi/add per sumber (main = props LinkModel, sub = config
    // elemen `subModels`). Sumber aktif = sumber dari `option.thisModel`.
    const sourceProps = sources.map((src) =>
      src.isMain
        ? {
            as,
            canNavigation,
            disabledNavigation,
            customNavigation,
            form,
            titleDialog,
            disabledAddButton,
            defaultValueForm,
            postOption,
            classNameDialog,
            with: _with,
          }
        : src.config,
    );

    // Navigasi per-opsi (dipakai tombol panah mode tunggal DAN label chip mode
    // multiple): sumber ditentukan dari `opt.thisModel`; `allowed` = nama
    // resource diketahui, tak `disabledNavigation`, dan lolos izin `read`
    // (`canNavigation` > sumber sub > model utama). `open()` memanggil
    // `customNavigation(customArg)` lalu membuka `<plural>.show` di tab baru.
    const resolveNavigation = (opt, customArg = opt) => {
      const none = { allowed: false, href: null, open: () => {} };
      if (!opt) return none;
      const index = Math.max(
        0,
        sources.findIndex((src) => src.model === opt.thisModel),
      );
      const source = sources[index];
      const props = sourceProps[index];
      const { name, keyRoute } = navFor(props.as, source.model);
      if (props.disabledNavigation || !name) return none;

      let allowed;
      if (props.canNavigation) {
        const ownerScope = keyRoute?.includes(".")
          ? get(opt, keyRoute.split(".").slice(0, -1).join("."))
          : opt;
        allowed = canGlobal(props.canNavigation, "read", {
          user_id: ownerScope?.created_by_id,
        });
      } else if (!source.isMain) {
        allowed = canGlobal(source.model, "read", {
          user_id: opt?.created_by_id,
        });
      } else {
        allowed = can("read", { user_id: opt?.created_by_id });
      }
      if (!allowed) return none;

      // `href` dihitung malas: `route()` Ziggy melempar bila rute tak ada, jadi
      // jangan dipanggil saat render (perilaku lama: baru saat diklik).
      const buildHref = () =>
        route(
          `${pluralize.plural(name ?? "")}.show`,
          get(opt, keyRoute ?? "id"),
        );

      return {
        allowed: true,
        get href() {
          return buildHref();
        },
        open: () => {
          if (typeof props.customNavigation === "function") {
            props.customNavigation(customArg);
          }
          window.open(buildHref(), "_blank");
        },
      };
    };

    const isDeleted = !!option?.deleted_at;

    useDidMountEffect(() => {
      _setOption((prev) => {
        // kalau sama, jangan trigger apa-apa
        if (isEqual(prev, value)) return prev;

        return value;
      });
    }, [value]);

    // Mode multiple: tulis array pilihan (opsi tak valid dibuang, urutan terjaga).
    const setSelected = useCallback(
      (next) => {
        if (disabled || readOnly) return;
        const valid = next.filter((opt) => validate(opt, allModels));
        if (isControlled) {
          if (isEqual(selected, valid)) return;
          onValueChange?.(valid);
          return;
        }
        _setOption((prev) => {
          if (isEqual(prev ?? [], valid)) return prev;
          onValueChange?.(valid);
          return valid;
        });
      },
      [
        disabled,
        readOnly,
        allModels,
        isControlled,
        selected,
        onValueChange,
        _setOption,
      ],
    );

    // Toggle satu opsi (mode multiple): sudah terpilih -> dicabut, belum -> ditambah di akhir.
    const toggleOption = useCallback(
      (opt) => {
        const key = optionKey(opt);
        const exists = selected.some((item) => optionKey(item) === key);
        setSelected(
          exists
            ? selected.filter((item) => optionKey(item) !== key)
            : [...selected, opt],
        );
      },
      [selected, setSelected],
    );

    const setOptionSingle = useCallback(
      (val) => {
        if (disabled || readOnly) return;
        if (val) {
          const isValid = validate(val, allModels);
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
        allModels,
      ],
    );

    // Titik tulis nilai untuk semua jalur lama (Add dialog, defaultValue, ...):
    // mode multiple -> null = kosongkan, opsi = tambah bila belum ada.
    const setOption = useCallback(
      (val) => {
        if (!isMultiple) return setOptionSingle(val);
        if (!val) return setSelected([]);
        if (selected.some((item) => optionKey(item) === optionKey(val))) return;
        setSelected([...selected, val]);
      },
      [isMultiple, setOptionSingle, setSelected, selected],
    );

    // Pilih opsi dari dropdown/grup: tunggal -> set + tutup; multiple -> toggle, tetap terbuka.
    const pickOption = (opt) => {
      if (isMultiple) {
        toggleOption(opt);
        return;
      }
      setOption(opt);
      setOpen(false);
    };

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

      if (isMultiple) {
        // Input hanya buffer pencarian: reset saat dropdown tertutup (tak ada
        // auto-commit teks yang cocok seperti mode tunggal).
        if (search) setSearch("");
        setAllowSearch(true);
        return;
      }
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
      if (isMultiple) {
        // Buang hanya elemen tak valid (mis. filters/model berubah), urutan terjaga.
        if (selected.some((opt) => !validate(opt, allModels))) {
          setSelected(selected);
        }
        return;
      }
      if (!(option || value)) return;
      const isValid = validate(option || value, allModels);

      if (!isValid) {
        setOption(null);
      }
    }, [filters, option, value, allModels, selected]);

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
      if (isMultiple || !defaultKey || value || !model) return;

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
          includeGlobalBranch,
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

    const onSuccessFormPageDialog = (e, index = 0) => {
      setOpen(false);
      axios
        .post(route("model"), {
          model: sources[index].model,
          with: sourceProps[index].with,
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
      // Mode multiple: diff per chip (lihat `chipItems`), bukan satu baris before/after.
      if (isMultiple) return { before: false, after: "", same: true };
      const before = convertTemplateLink(valueBefore);
      const after = convertTemplateLink(value);
      const changed = isChanged(valueBefore, value);
      return {
        before: changed && before,
        after,
        same: !changed,
      };
    }, [value, valueBefore, isMultiple]);

    // Chip mode multiple: tiap elemen `selected` (+ elemen `valueBefore` yang
    // sudah dicabut, dicoret). Navigasi label per chip lewat `resolveNavigation`.
    const buildChipItems = () => {
      if (!isMultiple) return [];
      const hasBefore = valueBefore !== undefined;
      const before = Array.isArray(valueBefore) ? valueBefore : [];
      const beforeKeys = new Set(before.map(optionKey));
      const currentKeys = new Set(selected.map(optionKey));
      const current = selected.map((opt) => {
        const nav = resolveNavigation(opt);

        return {
          key: optionKey(opt),
          label: convertTemplateLink(opt),
          status:
            hasBefore && !beforeKeys.has(optionKey(opt)) ? "added" : undefined,
          onNavigate: nav.allowed ? nav.open : undefined,
        };
      });
      const removed = hasBefore
        ? before
            .filter((opt) => !currentKeys.has(optionKey(opt)))
            .map((opt) => ({
              key: `removed-${optionKey(opt)}`,
              label: convertTemplateLink(opt),
              status: "removed",
            }))
        : [];

      return [...current, ...removed];
    };
    const chipItems = buildChipItems();
    const multiDiffers = chipItems.some((item) => item.status);
    const selectedKeys = new Set(selected.map(optionKey));
    const removeChip = (item) =>
      setSelected(selected.filter((opt) => optionKey(opt) !== item.key));

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
      // Cocokkan TEKS TERLIHAT (tanpa <title>, tanpa nama tag), bukan string HTML.
      return list.filter((opt) =>
        templateToText(opt?.templateLink, opt).toLowerCase().includes(keyword),
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

    // Baris Add sub model: hanya sub ber-`form`, tak `disabledAddButton`, dan
    // lolos izin `create` model-nya sendiri.
    const enabledSubAdds = subSources.filter(
      (src) =>
        !src.config.disabledAddButton &&
        !!src.config.form &&
        canGlobal(src.model, "create"),
    );
    const subAddKey = enabledSubAdds.map((src) => src.index).join(",");
    const [subDialogIndex, setSubDialogIndex] = useState(null);

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
      subAddKey
        .split(",")
        .filter(Boolean)
        .forEach((index) => ids.push(addValueFor(Number(index))));
      return ids;
    }, [flatOptions, isGrouped, disabledAdd, subAddKey]);
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
          isSourceHeaderValue(highlightedValue) ||
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
      // Multi-model: header bagian & baris sub (dirender SourceSection, tak ada
      // di `visibleValues`) dilacak sendiri -- jangan di-reset ke opsi pertama.
      const trackedBySource =
        isMulti &&
        (isSourceHeaderValue(highlightedValue) ||
          knownRowsRef.current.has(highlightedValue));
      if (!trackedBySource && !visibleValues.includes(highlightedValue)) {
        setHighlightedValue(visibleValues[0]);
      }
    }, [visibleValues, flatOptions, isGrouped, firstGroupValue]);

    // Mode tunggal: navigasi nilai terpilih (customNavigation menerima prop `value`).
    const singleNav = resolveNavigation(option, value);
    // Sumber tab Advance Search (multi-model): main + sub yang tak `advanceSearch: false`.
    const advanceSources = sources
      .filter((src) => src.isMain || src.config.advanceSearch !== false)
      .map((src) =>
        src.isMain
          ? {
              model,
              label: mainLabel ?? (model ?? "").split("\\").pop(),
              filters,
              fields,
              joins,
              with: _with,
              order,
              translate,
              group: groupProp,
              includeGlobalBranch,
            }
          : {
              model: src.model,
              label: src.label,
              filters: src.config.filters,
              fields: src.config.fields,
              joins: src.config.joins,
              with: src.config.with,
              order: src.config.order,
              translate: src.config.translate,
              includeGlobalBranch: src.config.includeGlobalBranch ?? false,
              group:
                src.config.group === undefined || src.config.group === null
                  ? undefined
                  : normalizeGroupLevels(src.config.group),
            },
      );

    // Isi bagian main (flat / grup / loading) -- jalur lama apa adanya.
    const mainContent = (
      <>
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
            {!isMulti && (flatEmpty || groupedEmpty) && (
              <div role="presentation" className="py-6 text-sm text-center">
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
                fetcher={cache ? localFetcher : fetchLinkModelGroupNode}
                pathname={cache ? `linkmodel-local:${model}` : "linkmodel"}
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
                onPick={pickOption}
                isSelected={
                  isMultiple
                    ? (row) => selectedKeys.has(optionKey(row))
                    : undefined
                }
              />
            ) : (
              flatOptions?.map((opt, index) => {
                return (
                  <CommandItem
                    key={opt.id ?? index}
                    value={`${opt.id ?? index}`}
                    onSelect={() => pickOption(opt)}
                    data-checked={
                      isMultiple ? selectedKeys.has(optionKey(opt)) : undefined
                    }
                  >
                    <div className={isMultiple ? "flex-1" : undefined}>
                      <SemanticTemplate
                        template={opt.templateLink}
                        row={opt}
                        context="option"
                        search={search ?? ""}
                      />
                    </div>
                    {isMultiple && selectedKeys.has(optionKey(opt)) && (
                      <CheckIcon className="size-4 shrink-0" />
                    )}
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
      </>
    );

    const searching = allowSearch && !!search?.trim();
    const mainEmptyFinal = !loading && (flatEmpty || groupedEmpty);
    const notFoundNode = (
      <div role="presentation" className="py-6 text-sm text-center">
        {t("core.form.not_found")}
      </div>
    );
    // "Tidak ditemukan" lintas sumber: saat mencari = semua bagian kosong FINAL;
    // tanpa ketikan = hanya main tak dibungkus yang kosong (sub tertutup tetap
    // bisa dibuka user).
    const multiNotFound =
      isMulti &&
      mainEmptyFinal &&
      (searching
        ? subSources.every(
            (src) =>
              subStatus[src.index]?.settled &&
              !subStatus[src.index]?.hasResults,
          )
        : !mainSource.wrapped);
    const multiBody = (
      <>
        {multiNotFound && notFoundNode}
        {mainSource.wrapped
          ? !(searching && mainEmptyFinal) && (
              <>
                <SourceHeader
                  index={0}
                  label={mainSource.label}
                  isOpen={mainExpanded}
                  loading={loading}
                  onToggle={() => setMainExpanded((v) => !v)}
                />
                {mainExpanded && (
                  <div className="pl-3">
                    {!searching && mainEmptyFinal && notFoundNode}
                    {mainContent}
                  </div>
                )}
              </>
            )
          : mainContent}
        {subSources.map((src) => (
          <SourceSection
            key={src.index}
            source={src}
            open={open}
            search={search}
            allowSearch={allowSearch}
            staleTime={staleTime}
            onStatus={onSubStatus}
            onPick={pickOption}
            knownRef={knownRowsRef}
          />
        ))}
      </>
    );

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
                  const isSourceHeader = isSourceHeaderValue(highlightedValue);
                  if (!isSourceHeader && !isGroupHeaderValue(highlightedValue))
                    return;
                  // Popover dirender di portal -> bukan turunan DOM commandRef.
                  const header = document.querySelector(
                    `[data-testid="${isSourceHeader ? "linkmodel-source-header" : "linkmodel-group-header"}"][data-selected="true"]`,
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
                  isSourceHeaderValue(highlightedValue) ||
                  highlightedValue === ADVANCE_SEARCH_VALUE ||
                  isAddValue(highlightedValue)
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
                      isMultiple && "flex-wrap h-auto min-h-8 py-0.5",
                      valueBefore !== undefined &&
                        (isMultiple ? multiDiffers : !diff?.same) &&
                        DIFF_HIGHLIGHT,
                      disabled && "cursor-not-allowed opacity-50",
                      className,
                    )}
                  >
                    <div>
                      {isMultiple && (
                        <ChipList
                          items={chipItems}
                          readOnly={disabled || readOnly}
                          onRemove={removeChip}
                          removeLabel={(item) =>
                            t("core.form.linkmodel.remove", {
                              name: item.label,
                            })
                          }
                          className="pl-1.5 py-0.5 max-w-full"
                        />
                      )}
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
                        required={
                          isMultiple ? required && !selected.length : required
                        }
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
                          isMultiple && "w-auto flex-1 min-w-24",
                          // diff.same && "text-",
                        )}
                        placeholder={
                          isMultiple && selected.length ? "" : placeholder
                        }
                      />
                      <div className="flex items-center h-8 pr-2 w-fit gap-x-2">
                        {loading ? (
                          <LoadingIcon className="size-4" />
                        ) : (
                          <>
                            {!isMultiple &&
                              option &&
                              search &&
                              singleNav.allowed && (
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
                                  onClick={() => singleNav.open()}
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
                                (!search ||
                                  disabled ||
                                  readOnly ||
                                  isMultiple) &&
                                  "hidden",
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
                {!isMultiple && valueBefore && !diff?.same && (
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
                    {isMulti ? multiBody : mainContent}
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

                            const mainName = navFor(as, model).name;
                            if (!mainName) return;
                            const pluralized = `${pluralize.plural(mainName)}.create`;
                            window.open(route(pluralized), "_blank");
                          }}
                        >
                          <PlusIcon className="size-4" />
                          {titleDialog}
                        </CommandItem>
                      )}
                      {enabledSubAdds.map((src) => (
                        <CommandItem
                          key={src.index}
                          value={addValueFor(src.index)}
                          onSelect={() => setSubDialogIndex(src.index)}
                        >
                          <PlusIcon className="size-4" />
                          {src.config.titleDialog}
                        </CommandItem>
                      ))}
                    </div>
                  </CommandList>
                </PopoverContent>
              )}
            </Command>
            {!disabledAdd && (
              <FormPageDialog
                title={titleDialog}
                name={navFor(as, model).name}
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
            {enabledSubAdds.map((src) => (
              <FormPageDialog
                key={src.index}
                title={src.config.titleDialog}
                name={navFor(src.config.as, src.model).name}
                open={subDialogIndex === src.index}
                onOpenChange={(next) =>
                  setSubDialogIndex(next ? src.index : null)
                }
                className={cn("max-w-4xl", src.config.classNameDialog)}
                defaultValue={src.config.defaultValueForm}
                onSuccess={(e) => onSuccessFormPageDialog(e, src.index)}
                postOption={src.config.postOption}
              >
                {src.config.form}
              </FormPageDialog>
            ))}
          </Popover>
          <AdvanceSearchDialog
            open={openAdvanceSearch}
            onOpenChange={setOpenAdvanceSearch}
            sources={advanceSources.length > 1 ? advanceSources : undefined}
            model={model}
            filters={filters}
            fields={fields}
            joins={joins}
            with={_with}
            order={order}
            translate={translate}
            group={groupProp}
            includeGlobalBranch={includeGlobalBranch}
            initialSearch={advanceSearchText}
            onSelect={(row) => {
              setOption(row);
              setOpenAdvanceSearch(false);
            }}
            multiple={isMultiple}
            selected={selected}
            onSelectMany={(rows) => {
              setSelected(rows);
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
