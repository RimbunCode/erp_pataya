// SearchBar — kotak ketik hybrid Odoo (chip = filter tree) + GitHub
// (autocomplete kolom) untuk DataTable2 (design.md §2-§8, revisi 2; Requirement
// 1-10, 14-15). Host-agnostic: TIDAK mengimpor `router`/`usePage`, TIDAK
// menulis `fid` -- transport tree via `onTreeChange` (boleh Promise),
// transport saved filter via `onPickSaved`, transport group via
// `onGroupChange`. Satu-satunya I/O mandiri: fetch `saved-filters.index` saat
// `model` diberikan (dan `saved-filters.destroy` untuk hapus dari Panel, pola
// sama dgn `FilterTable2.removeSaved`).
//
// Revisi 2 (feedback visual): SATU border membungkus ikon+chip+input+chevron
// (bukan kotak terpisah-pisah); warna chip = peran (sumber emas, group biru,
// lainnya secondary); dropdown yang SAMA menampilkan Panel (fokus/chevron,
// input kosong) ATAU saran (mengetik) ATAU daftar nilai (mode value) -- tidak
// pernah dialog/popover terpisah utk memilih operator. Operator SELALU
// diturunkan dari tipe kolom (columnSearch.js); klik chip existing utk edit
// memakai widget nilai yang SAMA (bukan editor operator terpisah).

import { Command } from "@/Components/ui/command";
import {
  Popover,
  PopoverAnchor,
  PopoverContent,
  PopoverTrigger,
} from "@/Components/ui/popover";
import {
  ArrowDown,
  ArrowUp,
  Ban,
  ChevronDown,
  Filter,
  Layers,
  Search,
  Star,
  X,
} from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/Components/ui/tooltip";
import {
  addLeafChip,
  addSearchChip,
  removeChip,
  treeToChips,
  updateChip,
} from "./searchChips";
import {
  columnTitle,
  hasValueSymbol,
  dateSignature,
  isColumnSearchable,
  resolveColumnPath,
} from "./columnSearch";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { Button } from "@/Components/ui/button";
import ChipEditor from "./ChipEditor";
import {
  isDateGroupType,
  isNumberGroupType,
  normalizeGroupLevels,
  sameGroups,
  toggleGroupLevel,
} from "@/Components/Table/Group/groupLevels";

import LoadingIcon from "@/Components/LoadingIcon";
import SearchLegend from "./SearchLegend";
import SearchPanel from "./SearchPanel";
import axios from "axios";
import { buildSuggestions, findRelationScope } from "./searchSuggestions";
import { cn } from "@/lib/utils";
import { compareLabels } from "@/lib/compareLabels";

import { isFilterTreeDirty } from "../Filter/filterTreeCompare";
import {
  buildEditorPrefill,
  canEditLeafInCell,
  chipClass,
  dottedColumnFor,
  recordLabel,
} from "./valueInputUtils";
import ColumnValueDropdown from "./ColumnValueDropdown";
import ValueChipList from "./ValueChipList";
import useColumnValueInput from "./useColumnValueInput";
import { useLiveDraftState, useLiveDraftSync } from "./useLiveDraft";
import useSearchDraft from "./useSearchDraft";
import useLinkModelOptions from "@/Hooks/useLinkModelOptions";
import { useLaravelReactI18n } from "laravel-react-i18n";

// Referensi stabil utk "belum ada record" -- `useLinkModelOptions` mengembalikan
// `[]` BARU tiap render saat data belum ada; memo yg bergantung padanya akan
// selalu dihitung ulang.
const NO_RECORDS = [];

// Label chip group bertingkat (spec datatable2-group-tree, Requirement 12.1):
// level di-join " > " (mis. "Kategori > Status"); level date/number membawa
// pilihannya dgn titik dua (`Tgl Order: Bulan`, `Jumlah: 100`) supaya ">"
// hanya berarti NESTING.
const groupChipLabel = (groups, columns, t) =>
  groups
    .map((level) => {
      const col = columns?.[level.column];
      const title = col ? columnTitle(col, t) : level.column;
      if (isDateGroupType(col?.type)) {
        return `${title}: ${t(`core.datatable.granularity.${level.granularity ?? "month"}`)}`;
      }
      if (isNumberGroupType(col?.type) && level.range != null) {
        return `${title}: ${level.range}`;
      }
      return title;
    })
    .join(" > ");

// Revisi 3: kolom yg baru dipakai per model, dipakai boost ranking saran
// (Requirement 20.4-20.5). localStorage per-viewer, bukan state yg wajib
// sinkron -- gagal baca/tulis (private browsing, storage penuh/dinonaktifkan)
// diam-diam diabaikan, TIDAK pernah melempar ke pemanggil.
const recentColumnsKey = (model) => `searchbar.recent.${model}`;
const readRecentColumns = (model) => {
  if (!model) return [];
  try {
    const raw = window.localStorage?.getItem(recentColumnsKey(model));
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed)
      ? parsed.filter((n) => typeof n === "string")
      : [];
  } catch {
    return [];
  }
};
const writeRecentColumns = (model, names) => {
  if (!model) return;
  try {
    window.localStorage?.setItem(
      recentColumnsKey(model),
      JSON.stringify(names),
    );
  } catch {
    // diam-diam diabaikan (private browsing / storage penuh) -- fitur
    // boost bukan kebutuhan kritikal.
  }
};

/**
 * SearchBar — kontrak lengkap di `resources/js/Components/Table/Search/`
 * (design.md §2).
 * @param {object} root0
 * @param {object} root0.columns peta kolom hasil getColumns() -- sumber
 *   tipe/opsi/operator/title.
 * @param {object|null} root0.tree Filter Tree controlled; null = tanpa filter.
 * @param {(tree: object|null) => void|Promise<void>} root0.onTreeChange
 *   transport milik host; boleh return Promise (busy state, §8).
 * @param {() => string[]} [root0.getSearchColumns] dipanggil SAAT chip
 *   "Cari" dibuat (bukan state) -- lihat §6.2.
 * @param {string} [root0.model] opsional -> aktifkan saran & panel Filter
 *   Tersimpan.
 * @param {string|number} [root0.activeFid] opsional -> deteksi badge sumber
 *   setelah reload (§5.5).
 * @param {(saved: object) => void} [root0.onPickSaved] opsional -> host
 *   terapkan saved filter (tree + fid + sort + group).
 * @param {() => {sort: string|null, group: object|null}} [root0.getViewSnapshot]
 *   opsional -> dipakai "Simpan sebagai baru"/"Timpa".
 * @param {Array<{column: string, granularity: unknown, range: unknown}>} [root0.group] `Groups` aktif (urutan = nesting, maks 4)
 * @param {Array<{value: string, label: string}>} [root0.groupOptions] semua kolom groupable (tanpa sentinel "Tidak ada")
 * @param {(groups: Array) => void} [root0.onGroupChange]
 * @param {"asc"|"desc"} [root0.groupSort] arah urutan baris grup menurut nilai
 *   grup (param `groupSort`); TERPISAH dari sort tabel/`sort` URL
 * @param {(direction: "asc"|"desc") => void} [root0.onGroupSortChange] klik ikon
 *   chip group -> ubah arah urutan grup (langsung berlaku, tanpa draft)
 * @param {(draftTree: object|null) => void} [root0.onOpenBuilder] buka
 *   FilterTable2 -- dipanggil dgn `draftTree` TERKINI (Requirement 25: tanpa
 *   ini, Builder lanjutan selalu tampilkan `tree` prop lama, bukan draft yg
 *   sedang disusun tapi belum di-apply).
 * @param {string} [root0.placeholder]
 * @param {object} [root0.draft] draft TERKONTROL milik host (`useSearchDraft`) --
 *   dibagi dgn Baris Filter Kolom supaya chip atas & badge sel selalu sama
 *   (spec datatable2-column-search-row, Requirement 7.3). Tanpa prop ini
 *   SearchBar memakai draft internal (mode tak terkontrol: perilaku lama,
 *   mis. Advance Search Dialog LinkModel).
 * @returns {React.JSX.Element}
 */
export default function SearchBar({
  columns,
  tree,
  onTreeChange,
  getSearchColumns,
  model,
  activeFid,
  onPickSaved,
  getViewSnapshot,
  group,
  groupOptions,
  onGroupChange,
  groupSort = "asc",
  onGroupSortChange,
  onOpenBuilder,
  placeholder,
  draft: draftProp,
}) {
  // `currentLocale` (BUKAN `usePage().props.lang`, pola `Filter/DateSelector.jsx`)
  // -- kontrak host-agnostic SearchBar (Requirement 14.1) melarang `usePage`.
  const { t } = useLaravelReactI18n();
  const inputRef = useRef(null);
  const wrapperRef = useRef(null);
  // Requirement 33: ref container Panel (dibungkus di sekitar `<SearchPanel>`
  // saat dirender) -- dipakai `handleInputKeyDown` utk fokus item PERTAMA
  // ketika panah ditekan SELAGI fokus masih di input (belum pindah ke
  // Panel); navigasi lanjutan (antar item) ditangani `SearchPanel` sendiri.
  const panelContainerRef = useRef(null);

  const [open, setOpen] = useState(false);
  // Chevron / klik chip sumber MEMAKSA Panel tampil walau `inputValue` terisi
  // (Requirement revisi 2: "panel tidak hanya muncul saat chevron ditekan" --
  // fokus dgn input kosong SUDAH menampilkan Panel lewat formula `showPanel`
  // di bawah tanpa flag ini; flag ini utk override eksplisit).
  const [panelForced, setPanelForced] = useState(false);
  // Revisi 12: fokus DOM di dalam Panel -- dipakai tips (`SearchLegend`) yg
  // menyesuaikan fungsi tombol dgn fokus saat ini.
  const [panelFocus, setPanelFocus] = useState(false);
  const [editingChip, setEditingChip] = useState(null); // {kind:"search"|"group", ...}
  const [highlightedChipId, setHighlightedChipId] = useState(null);
  const [sourceSaved, setSourceSaved] = useState(null);
  const [savedFilters, setSavedFilters] = useState([]);
  const [loadingSaved, setLoadingSaved] = useState(false);
  const fetchStartedRef = useRef(false);

  // --- Revisi 3: kolom yg baru dipakai per model (localStorage), utk boost
  // ranking saran (Requirement 20.2, 20.4-20.5). Tanpa `model` -> selalu []
  // (fitur nonaktif, bukan error) -- akses localStorage dibungkus try/catch
  // (private browsing / storage penuh / dinonaktifkan browser).
  const [lastUsedColumns, setLastUsedColumns] = useState(() =>
    readRecentColumns(model),
  );
  useEffect(() => {
    setLastUsedColumns(readRecentColumns(model));
  }, [model]);
  const rememberUsedColumn = useCallback(
    (name) => {
      if (!model || !name) return;
      setLastUsedColumns((prev) => {
        const next = [name, ...prev.filter((n) => n !== name)].slice(0, 8);
        writeRecentColumns(model, next);
        return next;
      });
    },
    [model],
  );

  // --- Revisi 3: model staged-apply (design.md §11, Requirement 17). -------
  // Chip dirender dari draftTree/draftGroup (BUKAN prop tree/group langsung)
  // -- SEMUA aksi (pilih kolom+nilai, edit/hapus chip, pilih saved filter,
  // ganti group) hanya mengubah state draft ini, KECUALI chip Cari (teks
  // bebas) yang tetap instant-apply lewat `commitTree` langsung seperti
  // sebelumnya. `applyDraft()` adalah SATU-SATUNYA jalur yang benar2
  // memanggil onTreeChange/onGroupChange/onPickSaved ke host. State draft +
  // busy + commit/apply dipindah ke `useSearchDraft` (spec
  // datatable2-column-search-row) supaya bisa dimiliki host dan dipakai
  // bersama Baris Filter Kolom.
  // Hook SELALU dipanggil (aturan hooks); bila host menyuplai `draft` yang
  // dipakai adalah milik host dan draft internal ini diam (hanya satu effect).
  const ownDraft = useSearchDraft({
    tree,
    group,
    onTreeChange,
    onGroupChange,
    onPickSaved,
  });
  const draft = draftProp ?? ownDraft;
  const {
    draftTree,
    draftTreeRef,
    setDraftTree,
    draftGroup,
    setDraftGroup,
    pendingSaved,
    setPendingSaved,
    busy,
    commitTree,
    applyDraft,
  } = draft;

  const closeDropdown = useCallback(() => {
    setOpen(false);
    setPanelForced(false);
  }, []);

  // --- Filter Tersimpan: fetch lazy (fokus pertama) / saat mount bila
  // `activeFid` ada (Requirement 3.11). ------------------------------------
  const refreshSaved = useCallback(() => {
    if (!model) return Promise.resolve([]);
    setLoadingSaved(true);
    return axios
      .get(window.route("saved-filters.index"), { params: { model } })
      .then((res) => {
        const list = res.data?.data ?? res.data ?? [];
        setSavedFilters(list);
        return list;
      })
      .catch(() => {
        setSavedFilters([]);
        return [];
      })
      .finally(() => setLoadingSaved(false));
  }, [model]);

  const ensureSavedFetched = useCallback(() => {
    if (!model || fetchStartedRef.current) return;
    fetchStartedRef.current = true;
    refreshSaved();
  }, [model, refreshSaved]);

  useEffect(() => {
    if (activeFid) ensureSavedFetched();
  }, [activeFid, ensureSavedFetched]);

  // Deteksi sumber setelah reload `?fid=` -- nama dari `index` (bukan
  // `show`, yang menyembunyikan nama dari non-owner). Hanya MENGISI, tidak
  // pernah mengosongkan berdasar prop (clear selalu eksplisit lewat aksi
  // user) -- lihat catatan dirty-tracking §5.5.
  useEffect(() => {
    if (!activeFid) return;
    const found = savedFilters.find((s) => s.id === activeFid);
    if (found && sourceSaved?.id !== found.id) setSourceSaved(found);
  }, [activeFid, savedFilters]);

  const removeSavedFilter = useCallback(
    (id) => {
      if (!id) return;
      axios
        .delete(window.route("saved-filters.destroy", { savedFilter: id }))
        .then(() => {
          setSavedFilters((prev) => prev.filter((x) => x.id !== id));
          setSourceSaved((prev) => (prev?.id === id ? null : prev));
          if (id === activeFid) {
            Promise.resolve(onTreeChange?.(null)).catch(() => {});
          }
        })
        .catch(() => {});
    },
    [activeFid, onTreeChange],
  );

  // Alias -- revisi 4 (§13.3) menghapus hydrate anak kolom relasi: leaf BARU
  // untuk kolom relation dibentuk dari record utuh hasil live-suggestion
  // (§13.2), bukan lagi `matches` pada kolom anak string, jadi anak kolom
  // relasi tidak pernah dibutuhkan lagi di sini. Leaf `matches` LAMA pada
  // kolom anak (saved filter sebelum revisi ini) tetap bisa diedit lewat
  // fallback dotted-key di `openEditorForChip` TANPA butuh hydrate apa pun
  // (fallback itu sudah dirancang untuk kasus "belum ter-hydrate").
  const effectiveColumns = columns;

  // --- Mode value (state + aksi nilai satu kolom) dipindah ke
  // `useColumnValueInput` supaya dipakai BERSAMA Baris Filter Kolom (spec
  // datatable2-column-search-row, Requirement 10.2). Search Bar atas
  // menyambungkannya ke draft: `onCommit` menulis leaf ke `draftTree` secara
  // SINKRON dan mengembalikan tree hasil (jalur klik-luar/tombol Search);
  // `apply` true = pilihan tunggal yang langsung di-apply (boolean, "Diisi").
  // Draft LANGSUNG (spec datatable2-column-search-row, Requirement 14): hanya
  // aktif saat host menyuplai draft terkontrol (DataTable2) -- ketikan valid
  // ditulis ke draft tanpa apply sehingga badge sel kolom ikut berubah. Mode
  // tak terkontrol (mis. Advance Search Dialog) tak berubah.
  const live = useLiveDraftState(draft);
  const { baseFor, markCommitted, liveLeafId } = live;
  const onValueCommit = useCallback(
    (patch, { editId, apply }) => {
      markCommitted();
      const base = baseFor(draftTreeRef.current);
      const nextTree = editId
        ? updateChip(base, editId, patch)
        : addLeafChip(base, patch);
      setDraftTree(nextTree);
      if (apply) applyDraft(nextTree);
      return nextTree;
    },
    [draftTreeRef, setDraftTree, applyDraft, baseFor, markCommitted],
  );
  const onValueRequestOpen = useCallback(() => {
    setPanelForced(false);
    setOpen(true);
  }, []);
  const value = useColumnValueInput({
    inputRef,
    onCommit: onValueCommit,
    onRequestOpen: onValueRequestOpen,
    onRequestClose: closeDropdown,
  });
  useLiveDraftSync({ live, value, enabled: Boolean(draftProp) });
  const {
    handleChange: handleValueChange,
    handleKeyDown: handleValueKeyDown,
    commitCheckedSelectionSync,
    dateChips,
    dateLocale,
    dateParseI18nLabels,
    editingLeafId,
    editingValueChipKey,
    enterValueMode,
    excludeMode,
    hasOptionIntent,
    highlightedKey,
    highlightedValueChipKey,
    inputValue,
    isBooleanColumn,
    mode,
    multiParts,
    optionNavigated,
    setHighlightedKey,
    setInputValue,
    setWidgetFocus,
    showHint,
    showRelationResults,
    showValueList,
    skipFocusOpenRef,
    textChips,
    valueColumn,
    valueError,
    valueVisibleKeys,
    visibleValueChips,
    vmode,
    widgetFocus,
  } = value;

  // --- Dirty (Requirement 10.3). -------------------------------------------
  // Sengaja BUKAN useMemo: `getViewSnapshot` bisa stabil identitasnya tapi
  // membaca state host yang berubah (mis. lewat ref) -- dihitung ulang tiap
  // render (murah: satu walk tree kecil) supaya sort/group terbaru selalu
  // terbaca. Dibandingkan ke draftTree/draftGroup (bukan tree/group prop)
  // sejak revisi 3 -- "dirty" berarti beda dari yang TERLIHAT sekarang di
  // bar, bukan dari yang terakhir benar2 di-apply ke tabel.
  const computeDirty = () => {
    if (!sourceSaved) return false;
    if (isFilterTreeDirty(sourceSaved.filter, draftTree)) return true;
    const snapshot = getViewSnapshot?.() ?? {};
    if (sourceSaved.sort != null && sourceSaved.sort !== snapshot.sort) {
      return true;
    }
    if (
      sourceSaved.group != null &&
      !sameGroups(sourceSaved.group, draftGroup)
    ) {
      return true;
    }
    return false;
  };
  const dirty = computeDirty();

  // --- Chips (Requirement 2, 17.1: dirender dari draftTree/draftGroup). -----
  const baseChips = useMemo(
    () =>
      treeToChips(draftTree, effectiveColumns, t, {
        monthsShort: dateParseI18nLabels.monthsShort,
      }),
    [draftTree, effectiveColumns, t, dateParseI18nLabels],
  );
  // SATU chip `__group` utk seluruh level (label "A > B"); tanpa level -> tak ada chip.
  const groupChip = useMemo(
    () =>
      draftGroup.length > 0
        ? {
            id: "__group",
            kind: "group",
            label: groupChipLabel(draftGroup, effectiveColumns, t),
          }
        : null,
    [draftGroup, effectiveColumns, t],
  );
  const chips = useMemo(() => {
    const list = [...baseChips];
    if (groupChip) list.push(groupChip);
    return list;
  }, [baseChips, groupChip]);
  // Revisi 12: chip filter yg sedang DIEDIT (mode value utk leaf itu) tak
  // ditampilkan -- nilainya sudah dimuat ke kotak; tetap terlihat = dikira
  // filter kedua pada kolom yg sama. Kembali muncul (nilai baru) saat selesai.
  const displayChips = useMemo(
    () =>
      mode === "value" && (editingLeafId || liveLeafId)
        ? chips.filter(
            (chip) => chip.id !== editingLeafId && chip.id !== liveLeafId,
          )
        : chips,
    [chips, mode, editingLeafId, liveLeafId],
  );
  const hasTreeItems = Boolean(
    draftTree?.root?.c && Object.keys(draftTree.root.c).length > 0,
  );
  const isDraftDirty =
    Boolean(pendingSaved) ||
    isFilterTreeDirty(tree, draftTree) ||
    !sameGroups(group, draftGroup);

  // --- Kolom Panel "Kolom" -- daftar kolom yang bisa dicari, sama dgn yang
  // dipakai buildSuggestions seksi "Kolom" (Requirement 9, kolom ke-3 Panel).
  const columnList = useMemo(
    () =>
      Object.values(effectiveColumns ?? {})
        .filter((col) => isColumnSearchable(col, t))
        .map((col) => ({ name: col.name, label: columnTitle(col, t) }))
        .sort((a, b) => compareLabels(a.label, b.label)),
    [effectiveColumns, t],
  );

  // --- Saran nilai kolom relation (revisi 13). ------------------------------
  // Ketikan menyebut judul kolom relation ("kategori", "kategori elek") ->
  // fetch record lewat hook LinkModel yg SAMA dgn daftar nilai (`search` = sisa
  // kata), hasilnya masuk seksi Nilai. `settled`: jangan tampilkan `options`
  // sebelum debounce hook mengejar ketikan (fetch awal tanpa kata kunci).
  const relationScope = useMemo(
    () =>
      mode === "key"
        ? findRelationScope(inputValue, { columns: effectiveColumns, t })
        : null,
    [mode, inputValue, effectiveColumns, t],
  );
  const relationSuggest = useLinkModelOptions({
    model: relationScope?.column.related,
    search: relationScope?.search ?? "",
    open: open && mode === "key" && !panelForced && Boolean(relationScope),
    limit: 5,
  });
  const relationSuggestRecords =
    relationSuggest.settled && relationSuggest.options.length > 0
      ? relationSuggest.options
      : NO_RECORDS;
  const relationRecords = useMemo(
    () =>
      relationScope && relationSuggestRecords.length > 0
        ? {
            column: relationScope.column.name,
            records: relationSuggestRecords.map((record) => ({
              record,
              label: recordLabel(record),
            })),
          }
        : null,
    [relationScope, relationSuggestRecords],
  );

  // --- Saran (Requirement 3). ------------------------------------------------
  // `getSearchColumns` dipanggil ULANG tiap kali saran dihitung (bukan
  // disimpan sbg state) -- cookie visibility kolom bisa berubah di Table2
  // tanpa me-render ulang host (design.md §6.2).
  const sections = useMemo(() => {
    if (mode !== "key" || !inputValue.trim()) return [];
    return buildSuggestions(inputValue, {
      columns: effectiveColumns,
      searchColumns: getSearchColumns?.() ?? [],
      savedFilters: model ? savedFilters : undefined,
      groupOptions: groupOptions?.length ? groupOptions : undefined,
      activeGroupColumns: draftGroup.map((level) => level.column),
      t,
      recentColumns: lastUsedColumns,
      dateContext: { i18nLabels: dateParseI18nLabels, dateLocale },
      relationRecords,
    });
  }, [
    mode,
    inputValue,
    effectiveColumns,
    getSearchColumns,
    model,
    savedFilters,
    groupOptions,
    draftGroup,
    t,
    lastUsedColumns,
    dateParseI18nLabels,
    dateLocale,
    relationRecords,
  ]);

  // --- Panel vs saran vs daftar nilai -- SATU dropdown, kontennya berganti
  // sesuai state (revisi 2: fokus/chevron dgn input kosong -> Panel; mengetik
  // -> saran; mode value list/date -> daftar nilai; tanpa dialog terpisah). --
  const showPanel = mode === "key" && (panelForced || inputValue.trim() === "");
  const showSuggestions = mode === "key" && !showPanel && sections.length > 0;
  const dropdownVisible =
    open &&
    (showPanel ||
      showSuggestions ||
      showValueList ||
      showRelationResults ||
      showHint);

  // Kunci item yang bisa disorot cmdk: saran (mode key) ATAU opsi nilai (mode
  // value, dihitung `useColumnValueInput`).
  const visibleKeys = useMemo(
    () =>
      showSuggestions
        ? sections.flatMap((s) => s.items.map((i) => i.key))
        : valueVisibleKeys,
    [showSuggestions, sections, valueVisibleKeys],
  );
  useEffect(() => {
    // Date: Diisi/Tidak diisi SELALU tampil (di ujung daftar) sehingga sorotan
    // lama bisa "menempel" di sana saat saran muncul -- tanpa navigasi panah,
    // sorotan selalu kembali ke item pertama (saran/preset).
    if (
      !visibleKeys.includes(highlightedKey) ||
      (vmode === "date" &&
        !optionNavigated &&
        highlightedKey !== visibleKeys[0])
    ) {
      setHighlightedKey(visibleKeys[0]);
    }
  }, [visibleKeys]);

  // --- Klik-luar (jalur trigger 3) -- IMPLEMENTASI SENDIRI, bukan
  // `react-click-away-listener` (dipakai sebelumnya). BUG NYATA ketauan
  // verifikasi visual browser sungguhan (tak kedeteksi RTL/jsdom): library
  // itu mendeteksi "di luar" di event `click` (BUBBLE, native listener di
  // `document`) via `ref.contains(e.target)` -- tapi banyak aksi Search Bar
  // (pilih saran/opsi value/Builder lanjutan) MENGUBAH STATE React yg
  // meng-unmount elemen portal (Popover) SECARA SINKRON sebelum event
  // `click` itu selesai bubbling sampai ke listener `document`. Begitu
  // elemen ter-unmount, `e.target` jadi node YATIM (terlepas dari DOM),
  // `.contains()`/`.closest()` apa pun terhadapnya gagal mengenali dia
  // "sebenarnya di dalam" -- klik internal (pilih opsi, Builder lanjutan,
  // dst) SALAH kedeteksi sbg "di luar" & memicu applyDraft() keliru (persis
  // kekhawatiran eksplisit user).
  //
  // Fix: dengar `mousedown` di FASE CAPTURE (bukan `click`/bubble) di
  // `document` -- capture berjalan SEBELUM event mencapai target sama
  // sekali, jauh sebelum React sempat memproses apa pun & meng-unmount
  // elemen manapun. Di titik itu DOM masih utuh, jadi `.closest()` terhadap
  // marker/role overlay Radix reliabel menentukan target-nya.
  //
  // DAFTAR SELECTOR bukan cuma `data-radix-popper-content-wrapper` (Popover/
  // Tooltip/DropdownMenu/Select, posisi dinamis via @radix-ui/react-popper)
  // -- "Builder lanjutan" (AlertDialog, `@radix-ui/react-alert-dialog`)
  // TERBUKTI di verifikasi visual TIDAK carry marker itu (AlertDialog bukan
  // popper, cuma overlay tengah layar) sehingga klik tombol "Batal" DI
  // DALAM Builder lanjutan (dibuka dari Panel Search Bar) masih salah
  // kedeteksi "di luar" & memicu applyDraft() keliru walau "Builder
  // lanjutan" sendiri sudah aman. `role="dialog"`/`"alertdialog"` adalah
  // atribut ARIA standar Radix Dialog/AlertDialog manapun -- generalisasi
  // ini menghindari whack-a-mole per primitif Radix baru ke depan.
  useEffect(() => {
    const OVERLAY_SELECTOR =
      '[data-radix-popper-content-wrapper], [role="dialog"], [role="alertdialog"], [role="menu"], [role="listbox"]';
    const handlePointerDown = (e) => {
      const target = e.target;
      if (wrapperRef.current?.contains(target)) return;
      // Baris Filter Kolom (Table2) berbagi draft yang sama: klik di dalamnya
      // BUKAN klik-luar (tak meng-apply draft), supaya ketikan sel yang sudah
      // tampil sbg chip tak ter-apply hanya karena pindah sel (Requirement 14).
      if (target?.closest?.("[data-column-filter-row]")) return;
      // Overlay yang MEMUAT wrapper (mis. dialog Advance Search tempat SearchBar
      // ini hidup) bukan overlay anak -- klik di dalamnya tetap "di luar".
      const overlay = target?.closest?.(OVERLAY_SELECTOR);
      if (overlay && !overlay.contains(wrapperRef.current)) return;
      // Requirement 27.3, jalur exit "klik-luar": commit checkbox-multi dulu
      // (no-op aman bila tak ada yg tercentang) LEWAT versi sync-nya --
      // `applyDraft` yg menyusul di tick yg SAMA butuh nilai tree TERBARU,
      // bukan `draftTree` state yg baru ke-`setDraftTree` (belum re-render).
      closeDropdown();
      applyDraft(commitCheckedSelectionSync());
    };
    document.addEventListener("mousedown", handlePointerDown, true);
    return () =>
      document.removeEventListener("mousedown", handlePointerDown, true);
  }, [closeDropdown, applyDraft, commitCheckedSelectionSync]);

  // --- Pilih saran / kolom Panel. ---------------------------------------------
  // Revisi 3: TIDAK lagi memanggil `onPickSaved` (host) di sini -- hanya
  // preview lokal (badge sumber + draftTree/draftGroup). `onPickSaved` yang
  // sesungguhnya menunggu `applyDraft()` lewat `pendingSaved`.
  const pickSaved = useCallback(
    (saved) => {
      setSourceSaved(saved);
      setDraftTree(saved?.filter ?? null);
      if (saved?.group != null)
        setDraftGroup(normalizeGroupLevels(saved.group));
      setPendingSaved(saved);
      setInputValue("");
      closeDropdown();
    },
    [closeDropdown],
  );

  /**
   * Pilih kolom (saran "Kolom" / Panel) -> mode value. Revisi 4: kolom
   * relation TIDAK LAGI butuh hydrate anak kolom sebelum masuk mode value --
   * live-suggestion record (`relationSearch`) fetch reaktif begitu
   * `vmode==="relation"` aktif (§13.3), jadi sesederhana kolom lain.
   *
   * Revisi 6 (Requirement 27.3, jalur exit "pilih kolom lain"): commit dulu
   * checkbox-multi kolom SEBELUMNYA (no-op bila kosong) sebelum pindah,
   * supaya centangan yang sudah dibuat tidak diam-diam hilang.
   */
  const pickColumn = useCallback(
    (name) => {
      const col = effectiveColumns?.[name];
      if (!col) return;
      commitCheckedSelectionSync();
      rememberUsedColumn(name); // revisi 3: boost ranking (Requirement 20.4)
      enterValueMode(col);
    },
    [
      effectiveColumns,
      enterValueMode,
      rememberUsedColumn,
      commitCheckedSelectionSync,
    ],
  );

  const selectSuggestion = useCallback(
    (section, item) => {
      if (section === "text") {
        // Chip Cari SATU-SATUNYA yang tetap instant-apply (Requirement 17.4)
        // -- dibangun di atas draftTree (bukan tree stale) supaya chip lain
        // yang lagi di-draft ikut ter-apply bareng, bukan ketinggalan diam2.
        const cols = getSearchColumns?.() ?? [];
        commitTree(addSearchChip(draftTree, item.payload.text, cols))
          .then(() => setInputValue(""))
          .catch(() => {});
        return;
      }
      if (section === "saved") {
        pickSaved(item.payload);
        return;
      }
      if (section === "column") {
        pickColumn(item.payload.column);
        return;
      }
      if (section === "value") {
        setDraftTree((prev) => addLeafChip(prev, item.payload));
        setInputValue("");
        return;
      }
      if (section === "group") {
        const column = item.payload.column;
        setDraftGroup((prev) =>
          toggleGroupLevel(prev, column, effectiveColumns?.[column]),
        );
        setInputValue("");
      }
    },
    [
      getSearchColumns,
      commitTree,
      draftTree,
      pickSaved,
      pickColumn,
      effectiveColumns,
    ],
  );

  // --- Chip: klik badan / hapus / edit. --------------------------------------
  // Klik chip `leaf` existing membuka widget nilai yang SAMA dgn membuat baru
  // (bukan editor operator terpisah) -- kolom & operator TETAP, hanya nilai
  // yang bisa diubah. Kolom yang tak lagi punya mode nilai yang didukung
  // (mis. sudah dihapus / tipe json) -> fallback buka Builder lanjutan.
  const openEditorForChip = useCallback(
    (chip) => {
      if (chip.kind === "advanced") {
        onOpenBuilder?.(draftTree);
        return;
      }
      if (chip.kind === "group") {
        setEditingChip({ kind: "group" });
        return;
      }
      if (chip.kind === "search") {
        const value = Object.values(chip.node?.c ?? {})[0]?.v ?? "";
        const searchColumnTitles = (chip.columns ?? []).map((k) => {
          const col = resolveColumnPath(effectiveColumns, k);
          return col ? columnTitle(col, t) : k;
        });
        setEditingChip({
          kind: "search",
          chipId: chip.id,
          value,
          searchColumnTitles,
        });
        return;
      }
      const column = resolveColumnPath(effectiveColumns, chip.node?.k);
      // Edit di kotak nilai vs Builder diputuskan `canEditLeafInCell` -- SATU
      // fungsi yang dipakai BERSAMA Sel Filter (spec datatable2-column-search-
      // row, Requirement 8.6). Leaf yg operatornya tak punya sintaks ketik
      // (mis. `starts_with`, `!between`, mode kolom) ke Builder, supaya edit
      // tak diam-diam mengubah operator (Requirement 25). Kolom relasi BARE
      // (Revisi 4, §13.2) masuk mode value relation dgn record lama sbg chip;
      // kolom anak relasi bertitik yg belum ter-hydrate ("dotted") diedit sbg
      // teks polos tanpa fetch ulang.
      const editable = canEditLeafInCell(column, chip.node);
      if (editable === "edit") {
        enterValueMode(
          column,
          buildEditorPrefill(column, chip, {
            monthsShort: dateParseI18nLabels.monthsShort,
          }),
        );
        return;
      }
      if (editable === "dotted") {
        enterValueMode(
          dottedColumnFor(chip.node),
          buildEditorPrefill(null, chip),
        );
        return;
      }
      onOpenBuilder?.(draftTree);
    },
    [
      effectiveColumns,
      t,
      onOpenBuilder,
      enterValueMode,
      draftTree,
      dateParseI18nLabels,
    ],
  );

  const removeChipByKind = useCallback((chip) => {
    if (chip.kind === "group") {
      setDraftGroup([]);
      return;
    }
    setDraftTree((prev) => removeChip(prev, chip.id));
  }, []);

  const applyEditingChip = useCallback(
    (patch) => {
      if (!editingChip) return;
      if (editingChip.kind === "group") {
        // Popover TETAP terbuka: user bisa mencentang/mengurutkan beberapa level
        // berturut-turut; ditutup lewat klik-luar/Escape (draft di-apply host
        // lewat applyDraft).
        setDraftGroup(normalizeGroupLevels(patch));
        return;
      }
      setDraftTree((prev) => updateChip(prev, editingChip.chipId, patch));
      setEditingChip(null);
    },
    [editingChip],
  );

  const removeSource = useCallback(() => {
    setDraftTree(null);
    setPendingSaved(null);
    setSourceSaved(null);
  }, []);

  // --- Keyboard (Requirement 8, 17.6). ----------------------------------------
  // Saran kolom yg lagi ke-highlight (seksi "Kolom") -- dipakai `:` (revisi 3)
  // DAN Tab (revisi 7, Requirement 38.1).
  const highlightedColumnItem = () => {
    const sec = sections.find((s) =>
      s.items.some((item) => item.key === highlightedKey),
    );
    return sec?.section === "column"
      ? sec.items.find((item) => item.key === highlightedKey)
      : undefined;
  };

  const handleInputKeyDown = useCallback(
    (e) => {
      // Revisi 8 (Requirement 44): navigasi panah chip UTAMA (Filter/Group,
      // mode key) -- pola sama chip nilai (Requirement 37.5-37.6): ArrowLeft
      // dari input kosong / kursor di awal menyorot chip terakhir, ArrowLeft/
      // Right menggeser, ArrowRight lewat ujung kembali ke input, Backspace/
      // Delete menghapus yg tersorot, Enter mengeditnya. Didahulukan dari
      // cabang Panel di bawah (yg memfokuskan Panel utk SEMUA panah) -- panah
      // atas/bawah tetap ke Panel.
      if (mode === "key" && chips.length > 0) {
        const idx = chips.findIndex((c) => c.id === highlightedChipId);
        const el = e.currentTarget;
        const caretAtStart = el.selectionStart === 0 && el.selectionEnd === 0;
        if (e.key === "ArrowLeft" && (idx >= 0 || caretAtStart)) {
          e.preventDefault();
          setHighlightedChipId(
            chips[idx < 0 ? chips.length - 1 : Math.max(idx - 1, 0)].id,
          );
          return;
        }
        if (e.key === "ArrowRight" && idx >= 0) {
          e.preventDefault();
          setHighlightedChipId(chips[idx + 1]?.id ?? null);
          return;
        }
        if ((e.key === "Backspace" || e.key === "Delete") && idx >= 0) {
          e.preventDefault();
          removeChipByKind(chips[idx]);
          setHighlightedChipId(null);
          return;
        }
        if ((e.key === "Enter" || e.key === " ") && idx >= 0) {
          e.preventDefault();
          e.stopPropagation();
          setHighlightedChipId(null);
          openEditorForChip(chips[idx]);
          return;
        }
      }
      // Revisi 3, jalur trigger 1: Enter SELAGI dropdown/panel tertutup
      // (`!open`) -- cabang PALING AWAL supaya tidak pernah bentrok dgn Enter
      // yang dipakai cmdk/mode-value existing (keduanya cuma relevan saat
      // `open` true / ada suggestion dirender).
      if (e.key === "Enter" && !open) {
        applyDraft();
        return;
      }
      // Requirement 33: panah SELAGI fokus masih di input (Panel tampil,
      // belum ada item Panel yg fokus) -> fokuskan item PERTAMA di Panel.
      // Navigasi ANTAR item (dalam/antar kolom) sesudahnya ditangani
      // `SearchPanel` sendiri (fokus sudah pindah ke tombol di dalamnya,
      // event tak lagi lewat handler ini).
      if (
        showPanel &&
        ["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(e.key)
      ) {
        const first = panelContainerRef.current?.querySelector(
          'button:not([disabled]), [href], input:not([disabled]), [tabindex]:not([tabindex="-1"])',
        );
        if (first) {
          e.preventDefault();
          first.focus();
        }
        return;
      }
      // Mode value: navigasi opsi/chip nilai, Backspace/Escape/Tab dan Enter
      // ada di `useColumnValueInput.handleKeyDown` (dipakai bersama Sel Filter).
      if (mode === "value") {
        if (highlightedChipId) setHighlightedChipId(null);
        handleValueKeyDown(e);
        return;
      }

      // --- Mode key ---------------------------------------------------------
      if (e.key === "Backspace" && inputValue === "") {
        if (highlightedChipId) {
          // Lewat removeChipByKind (bukan removeChip langsung): chip `group`
          // bukan node tree -- hapusnya = onGroupChange({column:null}).
          const target = chips.find((c) => c.id === highlightedChipId);
          if (target) removeChipByKind(target);
          setHighlightedChipId(null);
        } else if (chips.length > 0) {
          setHighlightedChipId(chips[chips.length - 1].id);
        }
        return;
      }
      if (highlightedChipId) setHighlightedChipId(null);

      if (e.key === "Escape") {
        closeDropdown();
        return;
      }

      // Revisi 7 (Requirement 38): Tab CUMA melengkapi -- memilih saran kolom
      // ter-highlight, setara `:`. Tak ada yg bisa dilengkapi -> Tab normal.
      // Revisi 3, sintaks ketik `kolom:...` (Requirement 19.1-19.2): `:` selagi
      // ada saran seksi "Kolom" yang lagi ke-highlight keyboard -> konfirmasi
      // kolom itu (SAMA persis dgn klik saran), TANPA `:` masuk ke inputValue.
      // Kalau yg ke-highlight BUKAN dari seksi Kolom, `:` diketik apa adanya.
      if ((e.key === "Tab" && !e.shiftKey) || e.key === ":") {
        const item = highlightedColumnItem();
        if (item) {
          e.preventDefault();
          pickColumn(item.payload.column);
          return;
        }
      }
    },
    [
      open,
      applyDraft,
      inputValue,
      mode,
      showPanel,
      highlightedChipId,
      chips,
      removeChipByKind,
      sections,
      highlightedKey,
      pickColumn,
      openEditorForChip,
      closeDropdown,
      handleValueKeyDown,
    ],
  );

  const handleInputChange = useCallback(
    (e) => {
      handleValueChange(e);
    },
    [handleValueChange],
  );

  const openChevron = useCallback(() => {
    setPanelForced(true);
    setOpen(true);
    ensureSavedFetched();
    inputRef.current?.focus();
  }, [ensureSavedFetched]);

  // Revisi 12: tips mengikuti kondisi saat ini. Fokus Panel/widget hilang
  // bersama unmount-nya (blur tak selalu terpicu saat elemen dilepas).
  useEffect(() => {
    if (!showPanel) setPanelFocus(false);
  }, [showPanel]);
  useEffect(() => {
    if (!(mode === "value" && vmode === "date")) setWidgetFocus(false);
  }, [mode, vmode]);
  const legendCtx = useMemo(() => {
    const scope =
      mode === "value"
        ? "value"
        : showPanel
          ? panelFocus
            ? "panelItem"
            : "panel"
          : "suggest";
    // number/date: sudah ada nilai polos -> simbol ditolak; satu nilai
    // bersimbol -> tak ada nilai lain (aturan daftar, `chipEntryViolation`).
    const others =
      vmode === "date"
        ? dateChips.filter((p) => dateSignature(p) !== editingValueChipKey)
        : vmode === "number"
          ? textChips.filter((c) => c !== editingValueChipKey)
          : [];
    const chipLock = mode === "value" && others.length > 0 ? "plain" : null;
    return {
      scope,
      vmode,
      isBoolean: isBooleanColumn,
      hasChips:
        mode === "value"
          ? visibleValueChips.length > 0
          : displayChips.length > 0,
      chipFocused:
        mode === "value"
          ? highlightedValueChipKey !== null
          : highlightedChipId !== null,
      typing: mode === "value" && multiParts.pending.trim() !== "",
      optionActive: mode === "value" && hasOptionIntent,
      editing: mode === "value" && editingValueChipKey !== null,
      excluded: excludeMode,
      chipLock,
      typingSymbol:
        mode === "value" && hasValueSymbol(vmode, multiParts.pending),
      widgetFocused: widgetFocus,
    };
  }, [
    mode,
    showPanel,
    panelFocus,
    vmode,
    dateChips,
    textChips,
    editingValueChipKey,
    isBooleanColumn,
    visibleValueChips,
    displayChips,
    highlightedValueChipKey,
    highlightedChipId,
    multiParts.pending,
    hasOptionIntent,
    excludeMode,
    widgetFocus,
  ]);

  const valueColumnTitle = valueColumn ? columnTitle(valueColumn, t) : null;
  const valueNeedsRoom =
    mode === "value" && (displayChips.length > 0 || Boolean(sourceSaved));
  // Date/datetime: dropdown nilai 2 KOLOM (saran di kiri, widget di kanan);
  // tips tetap di bawah, selebar penuh.
  const dateTwoColumn = mode === "value" && vmode === "date";

  return (
    // Requirement 32: `<Popover>` (Root) jadi PEMBUNGKUS TERLUAR komponen ini
    // (BUKAN nested di dalam <Command>/<div> spt sebelumnya) supaya
    // `<PopoverAnchor asChild>` bisa melingkupi `wrapperRef` (div TERLUAR,
    // posisi STABIL) sbg anchor visual dropdown -- TERPISAH dari
    // `PopoverTrigger` (triggerDiv kecil di dalam, tetap tempat interaksi
    // fokus/klik). `open`/`onOpenChange` TETAP `dropdownVisible`/no-op sama
    // seperti sebelum dipindah -- cuma posisi Popover di JSX tree yg berubah.
    <Popover open={dropdownVisible} onOpenChange={() => {}}>
      <PopoverAnchor asChild>
        <div ref={wrapperRef} className="flex flex-col gap-1 flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-1 rounded-lg border border-input bg-background px-1.5 min-h-8 py-1 focus-within:ring-1 focus-within:ring-ring">
            <Filter className="size-3.5 text-muted-foreground shrink-0" />

            {sourceSaved && (
              <span
                className={cn(
                  "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs shrink-0",
                  chipClass("source"),
                )}
              >
                <button
                  type="button"
                  className="inline-flex items-center gap-1 cursor-pointer max-w-40"
                  onClick={() => {
                    setPanelForced(true);
                    setOpen(true);
                    ensureSavedFetched();
                  }}
                >
                  <Star className="size-3 shrink-0 fill-current" />
                  <span className="truncate">
                    {sourceSaved.name ||
                      t("core.datatable.filter.saved.untitled")}
                  </span>
                  {dirty && (
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <span
                          role="img"
                          aria-label={t("core.datatable.filter.saved.dirty")}
                          className="size-1.5 rounded-full bg-amber-500 shrink-0"
                        />
                      </TooltipTrigger>
                      <TooltipContent>
                        {t("core.datatable.filter.saved.dirty")}
                      </TooltipContent>
                    </Tooltip>
                  )}
                </button>
                <button
                  type="button"
                  aria-label={t("core.datatable.search.remove_chip", {
                    label: sourceSaved.name ?? "",
                  })}
                  className="cursor-pointer opacity-70 hover:opacity-100"
                  onClick={removeSource}
                >
                  <X className="size-3" />
                </button>
              </span>
            )}

            {displayChips.map((chip) => {
              const isEditing = editingChip
                ? chip.kind === "group"
                  ? editingChip.kind === "group"
                  : editingChip.chipId === chip.id
                : false;
              return (
                <Popover
                  key={chip.id}
                  open={isEditing}
                  onOpenChange={(o) => {
                    if (!o) setEditingChip(null);
                  }}
                >
                  <PopoverTrigger asChild>
                    <span
                      // Chip Cari/Group yg popover editornya terbuka diberi
                      // cincin `primary` -- beda dari cincin `destructive`
                      // sorotan hapus. (Chip leaf yg diedit lewat mode value
                      // disembunyikan: `displayChips`.)
                      data-editing={isEditing ? "true" : undefined}
                      className={cn(
                        "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs shrink-0",
                        chipClass(chip.kind),
                        isEditing && "ring-2 ring-primary",
                        highlightedChipId === chip.id &&
                          "ring-2 ring-destructive",
                      )}
                    >
                      {chip.kind === "group" &&
                        (onGroupSortChange ? (
                          // Ikon chip group = tombol urutan grup (nilai grup
                          // naik/turun). TIDAK mengubah sort tabel/`sort` URL;
                          // stopPropagation supaya klik tak ikut membuka editor
                          // level (chip = PopoverTrigger).
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <button
                                type="button"
                                aria-label={t(
                                  groupSort === "desc"
                                    ? "core.datatable.search.group_sort_desc"
                                    : "core.datatable.search.group_sort_asc",
                                )}
                                className="inline-flex items-center shrink-0 cursor-pointer rounded-sm opacity-80 hover:opacity-100 hover:bg-emerald-500/20"
                                onClick={(event) => {
                                  event.stopPropagation();
                                  onGroupSortChange(
                                    groupSort === "desc" ? "asc" : "desc",
                                  );
                                }}
                              >
                                <Layers className="size-3" />
                                {groupSort === "desc" ? (
                                  <ArrowDown className="size-3" />
                                ) : (
                                  <ArrowUp className="size-3" />
                                )}
                              </button>
                            </TooltipTrigger>
                            <TooltipContent>
                              {t(
                                groupSort === "desc"
                                  ? "core.datatable.search.group_sort_desc"
                                  : "core.datatable.search.group_sort_asc",
                              )}
                            </TooltipContent>
                          </Tooltip>
                        ) : (
                          <Layers className="size-3 shrink-0" />
                        ))}
                      {/* Requirement 34: chip yg truncate (max-w-48) bisa
                      menyembunyikan sebagian teks -- tooltip isi label
                      LENGKAP (chip.kind !== "search": search chip SUDAH
                      py native `title` sendiri berisi daftar kolom, beda
                      info, tak diganti). */}
                      {chip.kind === "search" ? (
                        <button
                          type="button"
                          className="cursor-pointer max-w-48 truncate"
                          title={(chip.columns ?? []).join(", ")}
                          onClick={() => openEditorForChip(chip)}
                        >
                          {chip.label}
                        </button>
                      ) : (
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <button
                              type="button"
                              className="cursor-pointer max-w-48 truncate"
                              onClick={() => openEditorForChip(chip)}
                            >
                              {chip.label}
                            </button>
                          </TooltipTrigger>
                          <TooltipContent>{chip.label}</TooltipContent>
                        </Tooltip>
                      )}
                      <button
                        type="button"
                        aria-label={t("core.datatable.search.remove_chip", {
                          label: chip.label,
                        })}
                        className="cursor-pointer opacity-70 hover:opacity-100"
                        onClick={() => removeChipByKind(chip)}
                      >
                        <X className="size-3" />
                      </button>
                    </span>
                  </PopoverTrigger>
                  {isEditing && (
                    <PopoverContent
                      className="w-auto p-2"
                      onOpenAutoFocus={(e) => e.preventDefault()}
                    >
                      <ChipEditor
                        kind={editingChip.kind}
                        value={
                          editingChip.kind === "group"
                            ? draftGroup
                            : editingChip.value
                        }
                        searchColumnTitles={editingChip.searchColumnTitles}
                        groupOptions={groupOptions}
                        columns={effectiveColumns}
                        onApply={applyEditingChip}
                      />
                    </PopoverContent>
                  )}
                </Popover>
              );
            })}

            {/* Command MEMBUNGKUS Popover UTUH (trigger + content), bukan cuma
              CommandList -- cmdk mengaitkan Enter->pilih-item-highlighted
              lewat keydown yg bubbling di DOM subtree Command sendiri; input
              (di PopoverTrigger, TIDAK terportal) wajib jadi keturunan DOM
              Command yg SAMA dgn CommandItem (yg terportal via
              PopoverContent) supaya Enter di input benar-benar memicu
              cmdk. Command nested di dalam SearchPanel (GroupPicker) aman --
              tiap <Command> React punya context sendiri, tak bentrok. */}
            <Command
              shouldFilter={false}
              value={highlightedKey}
              onValueChange={setHighlightedKey}
              className="contents"
            >
              <>
                {/* Requirement 32: anchor visual (posisi Panel/dropdown) BEDA
                dari trigger interaksi (fokus/klik) -- `triggerDiv` (div kecil
                pembungkus icon+input) bergeser jauh ke kanan/bawah begitu
                chip menumpuk banyak baris (flex-wrap), Panel lebar tetap
                (`w-[min(90vw,42rem)]`) yg anchor ke situ jadi OVERFLOW keluar
                viewport (dikonfirmasi via DOM measurement, bukan spekulasi).
                Fix: `<Popover>` (Root) DIPINDAH jadi PEMBUNGKUS TERLUAR
                komponen ini (lihat `return` di bawah), dgn `<PopoverAnchor
                asChild>` melingkupi `wrapperRef` (div TERLUAR, posisi `left`
                SELALU sama walau chip berapa baris pun) -- `PopoverTrigger`
                TETAP di `triggerDiv` kecil di sini (interaksi fokus/klik
                tak berubah). PERCOBAAN PERTAMA pakai `virtualRef` (anchor
                TANPA elemen DOM nyata, cuma butuh ref objek yg py
                `getBoundingClientRect()`) TERBUKTI GAGAL via DOM measurement
                sungguhan (`--radix-popper-anchor-width` SELALU 0, popover
                collapse ke pojok kiri-atas viewport) -- root cause belum
                jelas (kemungkinan ketidaksesuaian versi/API @radix-ui/
                react-popper utk virtual anchor dgn setup ini), diganti pola
                `asChild` standar yg TERBUKTI benar via DOM measurement sama. */}
                <PopoverTrigger asChild>
                  {/* Revisi 5: min-w naik dari 24 (96px) ke 40 (160px) -- chip
                  numpuk banyak baris bikin input jadi sangat sempit di baris
                  terakhir (flex-wrap sisakan sedikit ruang), 96px kerasa
                  sesak buat ngetik. */}
                  <div
                    className={cn(
                      "flex flex-wrap items-center gap-1 flex-1 min-w-40",
                      // Mode value + sudah ada chip lain: area nilai (penanda
                      // kolom + chip nilai + input) butuh dasar lebar 24rem.
                      // Induknya `flex-wrap`, jadi area ini turun ke BARIS BARU
                      // (dan melebar penuh) HANYA bila sisa ruang di kanan chip
                      // kurang dari itu -- bukan selalu turun (revisi 9).
                      valueNeedsRoom && "basis-96",
                    )}
                  >
                    {valueColumn && (
                      <span
                        className={cn(
                          "inline-flex shrink-0 items-center gap-1 rounded-md px-2 py-0.5 text-xs font-semibold",
                          excludeMode
                            ? "bg-destructive text-white"
                            : "bg-foreground text-background",
                        )}
                        title={
                          excludeMode
                            ? t("core.datatable.search.exclude_badge")
                            : undefined
                        }
                      >
                        {excludeMode && (
                          <Ban className="size-3 shrink-0" aria-hidden="true" />
                        )}
                        [{valueColumnTitle}:]
                      </span>
                    )}
                    {/* Revisi 7 (Requirement 36.1): nilai terpilih sbg chip di
                    dalam kotak (list/boolean, relation, text, number) --
                    input hanya berisi ketikan sementara. `onMouseDown
                    preventDefault` di tombol x: fokus tetap di input. */}
                    <ValueChipList value={value} />
                    <input
                      ref={inputRef}
                      value={inputValue}
                      placeholder={
                        mode === "value" && valueColumn
                          ? t("core.datatable.search.value_placeholder", {
                              name: valueColumnTitle,
                            })
                          : placeholder
                      }
                      onChange={handleInputChange}
                      onFocus={() => {
                        if (skipFocusOpenRef.current) return;
                        setOpen(true);
                        ensureSavedFetched();
                      }}
                      // Enter-selesai menutup dropdown SAMBIL fokus tetap di
                      // input -- klik ulang harus membukanya lagi (onFocus
                      // tak terpicu ulang utk input yg sudah fokus).
                      onClick={() => setOpen(true)}
                      onKeyDown={handleInputKeyDown}
                      // @tailwindcss/forms plugin (strategy "base") memasang
                      // border + ring bawaan ke SETIAP <input> native (matcher
                      // `input:where(:not([type]))`) -- border ini SELALU tampil
                      // & ring muncul saat :focus, dobel dgn border/ring milik
                      // wadah (div pembungkus icon+input+chevron di atas).
                      // Pola yg SAMA sudah dipakai LinkModel.jsx/Select.jsx utk
                      // <Input> mereka (border-0! + focus-visible:ring-0!) --
                      // di sini `<input>` native, jadi tambahan `shadow-none!`
                      // eksplisit (forms plugin set `box-shadow` langsung di
                      // :focus, bukan cuma lewat utility ring Tailwind).
                      className="flex-1 min-w-24 h-6 bg-transparent text-sm outline-none placeholder:text-muted-foreground disabled:opacity-60 border-0! shadow-none! focus:ring-0! focus-visible:ring-0! focus-visible:ring-offset-0!"
                    />
                  </div>
                </PopoverTrigger>
                {dropdownVisible && (
                  <PopoverContent
                    align="start"
                    onOpenAutoFocus={(e) => e.preventDefault()}
                    collisionPadding={8}
                    className={cn(
                      "p-0 max-w-[calc(100vw-1rem)]",
                      showPanel || dateTwoColumn
                        ? "w-[min(90vw,42rem)]"
                        : "w-(--radix-popover-trigger-width)",
                    )}
                  >
                    {showPanel ? (
                      <div
                        ref={panelContainerRef}
                        onFocusCapture={() => setPanelFocus(true)}
                        onBlurCapture={(e) => {
                          if (!e.currentTarget.contains(e.relatedTarget)) {
                            setPanelFocus(false);
                          }
                        }}
                      >
                        <SearchPanel
                          model={model}
                          columns={effectiveColumns}
                          savedFilters={savedFilters}
                          loadingSaved={loadingSaved}
                          sourceId={sourceSaved?.id}
                          onPickSaved={pickSaved}
                          onRemoveSaved={removeSavedFilter}
                          filter={draftTree}
                          saveItems={
                            sourceSaved && dirty && !sourceSaved.is_shared
                              ? [sourceSaved]
                              : []
                          }
                          getViewSnapshot={getViewSnapshot}
                          onSaved={(saved) => {
                            refreshSaved();
                            if (saved) {
                              setSourceSaved(saved);
                              onPickSaved?.(saved);
                            }
                          }}
                          onOpenBuilder={() => {
                            closeDropdown();
                            onOpenBuilder?.(draftTree);
                          }}
                          onClearAll={() => {
                            // Revisi 3: "Hapus semua filter" juga staged (bukan
                            // instant) -- konsisten dgn aksi lain, di-apply lewat
                            // 3 jalur trigger yg sama.
                            setDraftTree(null);
                            setPendingSaved(null);
                            setSourceSaved(null);
                            closeDropdown();
                          }}
                          hasFilters={hasTreeItems}
                          groupOptions={groupOptions}
                          group={draftGroup}
                          onGroupChange={(patch) => setDraftGroup(patch)}
                          columnList={columnList}
                          onPickColumn={pickColumn}
                          onClose={closeDropdown}
                          onFocusInput={() => inputRef.current?.focus()}
                        />
                        {/* Tips = pintasan keyboard: hanya di layar >= md (desktop);
                        disembunyikan di mobile/layar sentuh supaya daftar tak terdesak. */}
                        <SearchLegend
                          ctx={legendCtx}
                          className="hidden md:block"
                        />
                      </div>
                    ) : (
                      <>
                        <ColumnValueDropdown
                          value={value}
                          legendCtx={legendCtx}
                          suggestions={{
                            show: showSuggestions,
                            sections,
                            onSelect: selectSuggestion,
                          }}
                        />
                      </>
                    )}
                  </PopoverContent>
                )}
              </>
            </Command>

            <div className="ml-auto flex shrink-0 items-center gap-1">
              {busy && (
                <LoadingIcon
                  role="status"
                  aria-label={t("core.datatable.search.applying")}
                  className="size-4 text-primary shrink-0"
                />
              )}

              {/* Revisi 3: tombol Search eksplisit -- jalur trigger 2 (Requirement
                17.6, 18.1-18.3). Titik aksen = ada draftTree/draftGroup/
                pendingSaved yg belum benar2 di-apply ke host (pola sama titik
                dirty saved-filter §5.5). */}
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="relative size-6 shrink-0 bg-muted hover:bg-muted/70"
                aria-label={t("core.datatable.search.apply_search")}
                disabled={busy}
                // Revisi 6: `applyDraft` sekarang punya param opsional
                // `treeOverride` -- `onClick={applyDraft}` LANGSUNG akan meneruskan
                // SyntheticEvent klik sbg argumen pertama itu (bug nyata, ketauan
                // dari 19 test gagal serentak lintas SEMUA vmode). Wrapper eksplisit
                // JUGA commit checkbox-multi yg mungkin masih tercentang (mode
                // value belum di-exit) SEBELUM apply -- tanpa ini, klik tombol
                // Search langsung (tanpa Escape/klik-luar dulu) diam2 membuang
                // centangan yg belum sempat commit ke draftTree.
                onClick={() => applyDraft(commitCheckedSelectionSync())}
              >
                <Search className="size-3.5" />
                {isDraftDirty && (
                  <span
                    role="img"
                    aria-label={t("core.datatable.search.unapplied")}
                    className="absolute top-0.5 right-0.5 size-1.5 rounded-full bg-amber-500"
                  />
                )}
              </Button>

              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="size-6 shrink-0 bg-muted hover:bg-muted/70"
                aria-label={t("core.datatable.search.open_panel")}
                onClick={openChevron}
              >
                {/* Revisi 3: rotasi 180 derajat saat Panel terbuka (Requirement 18.4). */}
                <ChevronDown
                  className={cn(
                    "size-3.5 transition-transform",
                    showPanel && "rotate-180",
                  )}
                />
              </Button>
            </div>
          </div>
          {valueError && (
            <span className="text-destructive text-xs px-1">{valueError}</span>
          )}
        </div>
      </PopoverAnchor>
    </Popover>
  );
}
