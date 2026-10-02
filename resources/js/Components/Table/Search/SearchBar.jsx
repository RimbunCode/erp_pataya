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

import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/Components/ui/command";
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
  buildOptionList,
  isStatusColumn,
  removeChip,
  treeToChips,
  updateChip,
} from "./searchChips";
import {
  buildChipsLeaf,
  buildDateChipsLeaf,
  buildDatePresets,
  buildDateWidgetValue,
  buildListLeaf,
  chipEntryViolation,
  columnTitle,
  hasValueSymbol,
  dateSignature,
  formatPeriodValue,
  isColumnSearchable,
  leafDatePeriods,
  leafToText,
  MAX_DATE_VALUES,
  mergeDatePeriods,
  parseDatePeriod,
  parseMultiValueText,
  resolveColumnPath,
  resolveValueMode,
  separatorsFor,
  DATE_OPERATOR_BY_SYMBOL,
  suggestPeriodTokens,
  parseDateText,
  periodValueToText,
} from "./columnSearch";
import {
  buildPeriodI18nLabels,
  buildReuiDateI18n,
  defaultYearBounds,
  parseLocalDate,
  toLocalDateValue,
} from "../Filter/periodParsing";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import BadgeStatus from "@/Components/BadgeStatus";
import { Button } from "@/Components/ui/button";
import ChipEditor from "./ChipEditor";
import {
  isDateGroupType,
  isNumberGroupType,
  normalizeGroupLevels,
  sameGroups,
  toggleGroupLevel,
} from "@/Components/Table/Group/groupLevels";
import { DateSelector as ReuiDateSelector } from "@/Components/ui/date-selector";
import LoadingIcon from "@/Components/LoadingIcon";
import SearchLegend from "./SearchLegend";
import SearchPanel from "./SearchPanel";
import axios from "axios";
import { buildSuggestions, findRelationScope } from "./searchSuggestions";
import { cn, getLocaleDate } from "@/lib/utils";
import { compareLabels } from "@/lib/compareLabels";
import { convertTemplateLink } from "@/lib/linkModelUtils";
import { highlightMatch } from "@/lib/highlightMatch";
import { isFilterTreeDirty } from "../Filter/filterTreeCompare";
import useLinkModelOptions, {
  buildOptionsPayload,
} from "@/Hooks/useLinkModelOptions";
import { useLaravelReactI18n } from "laravel-react-i18n";

// Warna chip berdasarkan PERAN, bukan urutan (revisi 9): filter tersimpan
// (sumber) = emas + ikon bintang, filter (leaf/search/advanced) = biru tanpa
// ikon, group = hijau + ikon tumpukan, nilai (chip di dalam kotak nilai) =
// secondary -- sama seperti Button variant="secondary".
const CHIP_CLASS = {
  source:
    "bg-amber-500/20 text-amber-800 ring-1 ring-amber-500/40 dark:text-amber-300",
  filter: "bg-blue-500/15 text-blue-700 dark:text-blue-300",
  group: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300",
  value: "bg-secondary text-secondary-foreground",
};
const chipClass = (kind) => CHIP_CLASS[kind] ?? CHIP_CLASS.filter;

// Referensi stabil utk "belum ada record" -- `useLinkModelOptions` mengembalikan
// `[]` BARU tiap render saat data belum ada; memo yg bergantung padanya akan
// selalu dihitung ulang.
const NO_RECORDS = [];

// Requirement 31: vmode yg dapat footer hint sintaks ketik. list/boolean ikut
// sejak feedback revisi 6 (Requirement 27.6): search box kini bisa diketik
// langsung (`a | b |`), bukan cuma centang.
// Revisi 8 (Requirement 40): opsi tetap "Diisi" / "Tidak diisi" (`set`/`!set`)
// di dropdown nilai SEMUA tipe kolom -- kunci di luar ruang nilai opsi.
const SET_OPTIONS = [
  { key: "__set__", op: "set", labelKey: "core.datatable.filter.operator.set" },
  {
    key: "__not_set__",
    op: "!set",
    labelKey: "core.datatable.filter.operator.!set",
  },
];

// Revisi 6 (Requirement 27): kebalikan proses commit checkbox-multi -- dari
// leaf `=`/`in`/`!=`/`!in` existing, balikin array value/record yg tercentang
// (dipakai prefill `enterValueMode` saat EDIT chip list/boolean/relation).
// Leaf operator lain (mis. `matches`, `in_period`) -> [] (bukan multi-value).
const leafCheckedList = (leaf) => {
  if (!leaf) return [];
  const { o, v } = leaf;
  if (o === "=" || o === "!=") return v === undefined ? [] : [v];
  // `has`/`!has` = padanan `in`/`!in` utk kolom formStatuses (Builder).
  if (o === "in" || o === "!in" || o === "has" || o === "!has") {
    return Array.isArray(v) ? v : v === undefined ? [] : [v];
  }
  return [];
};

// Leaf multi-value bernegasi (`!=`/`!in`) -> prefill teks search box diawali `!`.
const leafExcluded = (leaf) =>
  leaf?.o === "!=" ||
  leaf?.o === "!in" ||
  leaf?.o === "!has" ||
  leaf?.o === "!in_period";

// Opsi list/boolean utk `column` -- SATU sumber utk daftar opsi DAN resolusi
// teks-ketik -> opsi (revisi 6 feedback, Requirement 27.6).
const listOptionsFor = (column, t) =>
  column?.type === "boolean"
    ? [
        { value: true, label: t("core.datatable.yes") },
        { value: false, label: t("core.datatable.no") },
      ]
    : buildOptionList(column, t);

// Label record relation (sama persis yg dirender di daftar centang).
const recordLabel = (record) =>
  convertTemplateLink(record, "") ||
  `${record.name ?? record.code ?? record.id}`;

// Pencocokan label ketikan <-> label opsi: tanpa beda huruf besar/kecil & spasi tepi.
const sameLabel = (a, b) =>
  `${a}`.trim().toLowerCase() === `${b}`.trim().toLowerCase();

// Payload widget `DateSelector` -> bentuk leaf: tanggal jadi string LOKAL
// (kolom date membuang jam), sisanya apa adanya. Mode multi: `selections`
// (daftar periode "Pada") dinormalkan per item.
const normalizeDatePayload = (next, isDatetime) => {
  const payload = { ...next };
  if (next.startDate) {
    payload.startDate = toLocalDateValue(next.startDate, { isDatetime });
  }
  if (next.endDate) {
    payload.endDate = toLocalDateValue(next.endDate, { isDatetime });
  }
  if (Array.isArray(next.selections)) {
    payload.selections = next.selections.map((s) =>
      normalizeDatePayload(s, isDatetime),
    );
  }
  return payload;
};

// Pesan pelanggaran daftar chip date (`mergeDatePeriods().error` / catatan
// turunan) -> teks i18n.
const dateNoticeText = (kind, t) =>
  kind === "limit"
    ? t("core.datatable.search.date_limit", { max: MAX_DATE_VALUES })
    : t("core.datatable.search.date_multi_only_is");

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
}) {
  // `currentLocale` (BUKAN `usePage().props.lang`, pola `Filter/DateSelector.jsx`)
  // -- kontrak host-agnostic SearchBar (Requirement 14.1) melarang `usePage`.
  const { t, currentLocale } = useLaravelReactI18n();
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
  const [inputValue, setInputValue] = useState("");
  const [mode, setMode] = useState("key"); // "key" | "value"
  const [valueColumn, setValueColumn] = useState(null);
  // Id chip leaf yang sedang DIEDIT (bukan dibuat baru) -- commit lewat
  // `updateChip`, bukan `addLeafChip`. `null` = mode value sedang membuat
  // chip baru.
  const [editingLeafId, setEditingLeafId] = useState(null);
  // Revisi 6 (Requirement 27, 28): checkbox-multi -- kumpulan value/record yg
  // SEDANG tercentang SELAMA mode value list/boolean/relation aktif, BUKAN
  // langsung commit per klik (preset date TETAP radio-style via
  // `pickValueOption`). Baru jadi SATU leaf `=`/`in` saat keluar mode value
  // (`commitCheckedSelectionSync`, lihat di bawah). `selectedRecords` Map by
  // `.id` supaya record TAK hilang dari tampilan begitu fetch relation baru
  // (search text ganti) tak lagi mengandungnya (§15.3, Requirement 28).
  const [checkedValues, setCheckedValues] = useState([]);
  const [selectedRecords, setSelectedRecords] = useState(new Map());
  // Revisi 6 (Requirement 30.1): nilai widget `DateSelector` (`ui/date-
  // selector.jsx`) yang di-embed di dropdown date -- BUKAN commit langsung
  // per onChange (interaksi range butuh >1 klik), disimpan dulu di sini.
  // Revisi 11: nilai ini hanya CERMIN kotak search (chip `dateChips` +
  // ketikan, `buildDateWidgetValue`) yg dikirim ke widget; sumber kebenaran
  // nilai date = `dateChips` (daftar periode; commit jadi leaf lewat jalur
  // exit yang SAMA dgn chip list/text: `computeCheckedLeafPatch`).
  const [datePickerValue, setDatePickerValue] = useState(undefined);
  const [dateChips, setDateChips] = useState([]);
  // Cermin `datePickerValue` yg diperbarui SINKRON (bukan lewat render) --
  // dipakai `handleDatePickerChange` utk mengabaikan emisi ulang nilai yg
  // SAMA (widget meng-emit saat mount / setelah hydrate prefill).
  const datePickerRef = useRef(undefined);
  // Fokus programatik ke input (mengembalikan fokus yg dicuri sel kalender)
  // tak boleh memicu `onFocus` -> buka dropdown lagi.
  const skipFocusOpenRef = useRef(false);
  // Interaksi widget terakhir lewat mouse (bukan keyboard) -> setelah emisi,
  // fokus dikembalikan ke input (sel kalender mencurinya).
  const widgetPointerRef = useRef(false);
  const [valueError, setValueError] = useState(null);
  // Revisi 7 (Requirement 36): chip nilai text/number (list/boolean =
  // `checkedValues`, relation = `selectedRecords`) -- SUMBER KEBENARAN nilai
  // adalah state ini, bukan teks search box (yg hanya berisi ketikan
  // sementara). `highlightedValueChipKey` = chip nilai yg tersorot utk dihapus
  // (2 langkah, pola sama `highlightedChipId` chip utama).
  const [textChips, setTextChips] = useState([]);
  const [highlightedValueChipKey, setHighlightedValueChipKey] = useState(null);
  // Panah atas/bawah ditekan di daftar opsi (list/relation) -- tanda niat
  // memilih opsi utk Enter (lihat `hasOptionIntent`); direset tiap chip
  // berubah / mengetik / masuk-keluar mode value.
  const [optionNavigated, setOptionNavigated] = useState(false);
  // Revisi 12: panah ATAS di opsi PERTAMA = "kembali ke kotak search" --
  // sorotan opsi disembunyikan lagi & Enter tak lagi memilih opsi (walau ada
  // ketikan) sampai user mengetik / menekan panah bawah.
  const [optionDismissed, setOptionDismissed] = useState(false);
  // Revisi 12: fokus DOM di dalam Panel / widget kalender -- dipakai tips
  // (`SearchLegend`) yg menyesuaikan fungsi tombol dgn fokus saat ini.
  const [panelFocus, setPanelFocus] = useState(false);
  const [widgetFocus, setWidgetFocus] = useState(false);
  // Revisi 8 (Requirement 41): kunci (teks) chip nilai text yg SEDANG diedit --
  // chip tetap di daftar (penanda cincin `primary`) sampai hasil edit dikomit.
  const [editingValueChipKey, setEditingValueChipKey] = useState(null);
  // Record relation yg pernah terlihat di sesi mode-value ini (hasil fetch
  // reaktif + hasil resolve label ketikan) -- dipakai mencocokkan label yg
  // diketik ke record; `latestRef` menyimpan teks & fungsi TERBARU utk
  // callback async (resolve label relation yg diketik lebih cepat dari
  // debounce fetch).
  const knownRecordsRef = useRef(new Map());
  const latestRef = useRef({ text: "", sync: null, finish: null });
  const [editingChip, setEditingChip] = useState(null); // {kind:"search"|"group", ...}
  const [highlightedChipId, setHighlightedChipId] = useState(null);
  const [highlightedKey, setHighlightedKey] = useState();
  const [busy, setBusy] = useState(false);
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
  // sebelumnya. `applyDraft()` di bawah adalah SATU-SATUNYA jalur yang
  // benar2 memanggil onTreeChange/onGroupChange/onPickSaved ke host.
  const [draftTree, setDraftTree] = useState(tree);
  const [draftGroup, setDraftGroup] = useState(() =>
    normalizeGroupLevels(group),
  );
  // Saved filter yang DIPILIH tapi belum di-apply -- `onPickSaved` (host)
  // baru dipanggil saat applyDraft(), bukan saat dipilih.
  const [pendingSaved, setPendingSaved] = useState(null);
  useEffect(() => {
    setDraftTree(tree);
  }, [tree]);
  useEffect(() => {
    setDraftGroup(normalizeGroupLevels(group));
  }, [group]);

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

  // --- Commit tree: busy state + tolak commit baru saat Promise pending
  // (Requirement 15.1-15.2). ------------------------------------------------
  const busyRef = useRef(false);
  const commitTree = useCallback(
    (nextTree) => {
      if (busyRef.current) return Promise.reject(new Error("busy"));
      const result = onTreeChange?.(nextTree);
      if (result && typeof result.then === "function") {
        busyRef.current = true;
        setBusy(true);
        return result.finally(() => {
          busyRef.current = false;
          setBusy(false);
        });
      }
      return Promise.resolve(result);
    },
    [onTreeChange],
  );

  // --- applyDraft: SATU-SATUNYA jalur draftTree/draftGroup/pendingSaved
  // benar2 sampai ke host (Requirement 17.5-17.9, design.md §11.2). Dipanggil
  // dari 3 jalur saja: Enter selagi dropdown tertutup, tombol Search, dan
  // klik-luar (lihat handleInputKeyDown/tombol Search/ClickAwayListener di
  // bawah) -- BUKAN dipanggil dari mana pun lagi.
  // `treeOverride` (revisi 6, Requirement 27.3 jalur klik-luar): nilai tree
  // SINKRON dipakai gantinya state `draftTree` -- `setDraftTree` yg baru
  // dipanggil detik yg sama (commit checkbox-multi) belum ter-render ulang,
  // jadi baca `draftTree` langsung di sini masih dapat versi LAMA (tanpa
  // leaf yg baru saja dicentang). Semua pemanggil lain tetap tanpa argumen.
  const applyDraft = useCallback(
    (treeOverride) => {
      if (busyRef.current) return;
      if (pendingSaved) {
        onPickSaved?.(pendingSaved);
        setPendingSaved(null);
        return;
      }
      const nextTree = treeOverride !== undefined ? treeOverride : draftTree;
      const treeChanged = isFilterTreeDirty(tree, nextTree);
      const groupChanged = !sameGroups(group, draftGroup);
      if (!treeChanged && !groupChanged) return;
      if (treeChanged) commitTree(nextTree).catch(() => {});
      if (groupChanged) onGroupChange?.(draftGroup);
    },
    [
      pendingSaved,
      onPickSaved,
      tree,
      draftTree,
      group,
      draftGroup,
      commitTree,
      onGroupChange,
    ],
  );

  /**
   * Tambah leaf baru, ATAU perbarui leaf `editId` bila diberikan -- ke
   * `draftTree` (revisi 3, staged -- BUKAN commit ke host langsung lagi).
   * Sinkron (bukan Promise): `applyDraft()` yang nanti memanggil host.
   */
  const updateDraftLeaf = useCallback((patch, editId) => {
    setDraftTree((prev) =>
      editId ? updateChip(prev, editId, patch) : addLeafChip(prev, patch),
    );
  }, []);

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

  // Revisi 6 (Requirement 30): locale/label i18n utk parse & embed widget
  // date -- `currentLocale()` (BUKAN `usePage().props.lang`, lihat komentar
  // atas kontrak host-agnostic).
  const dateLocale = useMemo(
    () => getLocaleDate(currentLocale?.()),
    [currentLocale],
  );
  const dateParseI18nLabels = useMemo(
    () => buildPeriodI18nLabels({ t, dateLocale }),
    [t, dateLocale],
  );
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
      mode === "value" && editingLeafId
        ? chips.filter((chip) => chip.id !== editingLeafId)
        : chips,
    [chips, mode, editingLeafId],
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
  const vmode = valueColumn ? resolveValueMode(valueColumn) : null;
  // Revisi 6 (Requirement 29): `!` di AWAL search box (mode value, SEMUA
  // tipe) -> badge "Kecualikan" (render di bawah); SISA teks tetap dipakai
  // sbg filter pencarian biasa (list/boolean: label lokal; relation: param
  // `search`) -- bukan literal ikut dicari sbg substring "!...".
  const excludeMode = mode === "value" && inputValue.startsWith("!");
  // Revisi 7 (Requirement 36): list/boolean, relation, text, number memakai
  // chip nilai (operator `in`). Search box hanya berisi ketikan sementara;
  // `pending` (sesudah pemisah terakhir) = filter pencarian, `committed` =
  // segmen yg sudah diketik pemisah tapi belum bisa jadi chip (mis. tak cocok).
  const isChipMode =
    mode === "value" &&
    (vmode === "list" ||
      vmode === "relation" ||
      vmode === "text" ||
      vmode === "number" ||
      vmode === "date");
  const isBooleanColumn = valueColumn?.type === "boolean";
  const allListOptions = useMemo(
    () => (vmode === "list" ? listOptionsFor(valueColumn, t) : []),
    [vmode, valueColumn, t],
  );
  // Pemisah chip: `|` `;` (semua tipe), `,` (selain number -- desimal).
  const chipSeparators = separatorsFor(vmode);
  // Seluruh ketikan = SATU label opsi/record yg memuat karakter pemisah (mis.
  // "PT Maju, Tbk") -> tidak dipecah. Relation: hanya record yg pernah tampil
  // (`knownRecordsRef`) / sudah terpilih -- bukan `relationSearch` (dipakai
  // menurunkan `searchText`, akan sirkular).
  const isKnownLabel = useCallback(
    (label) => {
      if (!label) return false;
      if (vmode === "list") {
        return allListOptions.some((o) => sameLabel(o.label, label));
      }
      if (vmode === "relation") {
        return [
          ...selectedRecords.values(),
          ...knownRecordsRef.current.values(),
        ].some((r) => sameLabel(recordLabel(r), label));
      }
      return false;
    },
    [vmode, allListOptions, selectedRecords],
  );
  const multiParts = useMemo(
    () =>
      parseMultiValueText(inputValue, {
        separators: chipSeparators,
        isLabel: isKnownLabel,
      }),
    [inputValue, chipSeparators, isKnownLabel],
  );
  const searchText = isChipMode
    ? multiParts.pending
    : excludeMode
      ? inputValue.slice(1)
      : inputValue;
  const inlineValueOptions = useMemo(() => {
    const needle = searchText.trim().toLowerCase();
    if (!needle) return allListOptions;
    return allListOptions.filter((o) =>
      `${o.label}`.toLowerCase().includes(needle),
    );
  }, [allListOptions, searchText]);
  // Revisi 7 (Requirement 36.10): opsi yg sudah jadi chip TIDAK ditampilkan
  // lagi di daftar (tanpa checkbox / kelompok tercentang) -- chip di kotak
  // sudah menampilkannya; daftar hanya berisi yg BELUM dipilih.
  const listUncheckedOptions = useMemo(
    () => inlineValueOptions.filter((o) => !checkedValues.includes(o.value)),
    [inlineValueOptions, checkedValues],
  );
  // Revisi 10: simbol perbandingan di depan (`>`, `>=`, `<`, `<=`) BUKAN bagian
  // kata kunci saring -- preset & Diisi/Tidak diisi disaring memakai isi tanpa
  // simbol, dan preset membawa operator simbol itu (`>Bulan ini` = sesudah bulan
  // ini). Rentang (`..`) tak punya preset.
  const dateSymbolMatch =
    vmode === "date" ? searchText.trim().match(/^(>=|<=|>|<)\s*(.*)$/) : null;
  const dateSymbol = dateSymbolMatch?.[1] ?? "";
  const dateBody = dateSymbolMatch ? dateSymbolMatch[2] : searchText;
  const datePresets = useMemo(() => {
    if (vmode !== "date" || searchText.includes("..")) return [];
    const operator = DATE_OPERATOR_BY_SYMBOL[dateSymbol] ?? "is";
    const all = buildDatePresets(new Date(), t).map((p) =>
      dateSymbol
        ? {
            ...p,
            label: `${dateSymbol}${p.label}`,
            value: { ...p.value, operator },
          }
        : p,
    );
    const needle = dateBody.trim().toLowerCase();
    if (!needle) return all;
    return all.filter((p) => p.label.toLowerCase().includes(needle));
  }, [vmode, searchText, dateSymbol, dateBody, t]);
  const dateParseCtx = useMemo(
    () => ({
      isDatetime: valueColumn?.type === "datetime",
      dateLocale,
      i18nLabels: dateParseI18nLabels,
    }),
    [valueColumn, dateLocale, dateParseI18nLabels],
  );
  const reuiDateI18n = useMemo(
    () => buildReuiDateI18n({ t, i18nLabels: dateParseI18nLabels }),
    [t, dateParseI18nLabels],
  );
  // Revisi 9 (Requirement 54): saran nilai tanggal MENIRU format ketikan
  // (tahun sekitar tahun sistem, ketikan sendiri paling atas). Dicek dari
  // `searchText` (bukan `inputValue` mentah) -- `!Jan` tetap tersuggest
  // (badge "Kecualikan" yg menandai negasinya, bukan teks yg diparse).
  const dateSuggestions = useMemo(() => {
    if (vmode !== "date") return [];
    return suggestPeriodTokens(searchText, {
      i18nLabels: dateParseI18nLabels,
      dateLocale,
      isDatetime: valueColumn?.type === "datetime",
    });
  }, [vmode, searchText, dateParseI18nLabels, dateLocale, valueColumn]);
  // Requirement 30.1: `value` widget `DateSelector` ter-embed butuh Date asli
  // (bukan ISO string) -- `datePickerValue` sendiri SELALU simpan ISO string.
  const dateYearBounds = useMemo(() => defaultYearBounds(), []);
  const reuiDateValue = useMemo(() => {
    if (!datePickerValue) return undefined;
    return {
      ...datePickerValue,
      startDate: parseLocalDate(datePickerValue.startDate),
      endDate: parseLocalDate(datePickerValue.endDate),
      // Mode multi: tiap pilihan hari juga butuh Date asli.
      ...(datePickerValue.selections
        ? {
            selections: datePickerValue.selections.map((s) => ({
              ...s,
              startDate: parseLocalDate(s.startDate),
              endDate: parseLocalDate(s.endDate),
            })),
          }
        : {}),
    };
  }, [datePickerValue]);
  const showValueList =
    mode === "value" && (vmode === "list" || vmode === "date");
  // Revisi 4 (§13.3, Requirement 22): kolom relation live-suggestion record
  // dari server, reuse penuh hook LinkModel -- TANPA fetch/debounce baru.
  // Fetch opsi awal (search kosong) begitu kolom dipilih, bukan menunggu
  // user ketik dulu (§13, keputusan 1).
  const showRelationResults = mode === "value" && vmode === "relation";
  const relationSearch = useLinkModelOptions({
    model: showRelationResults ? valueColumn?.related : undefined,
    search: searchText,
    open: showRelationResults,
    limit: 8,
  });
  // Requirement 28/36.10: record terpilih (`selectedRecords`) tampil sbg chip
  // TERLEPAS match fetch terbaru atau tidak; daftar hasil fetch hanya berisi
  // yg belum terpilih.
  const relationCheckedRecords = useMemo(
    () => Array.from(selectedRecords.values()),
    [selectedRecords],
  );
  const relationUncheckedOptions = useMemo(
    () => relationSearch.options.filter((r) => !selectedRecords.has(r.id)),
    [relationSearch.options, selectedRecords],
  );
  // Record yg pernah tampil di daftar tetap dikenali walau daftar berganti
  // (fetch relation di-debounce & tak menyimpan data lama saat key berubah) --
  // label yg diketik sesudah Tab/klik masih bisa diresolusi ke record.
  useEffect(() => {
    relationSearch.options.forEach((r) => knownRecordsRef.current.set(r.id, r));
  }, [relationSearch.options]);
  // Revisi 7 (Requirement 36.1): tiga sumber nilai (list/boolean, relation,
  // text/number) diseragamkan jadi chip `{key, label}` utk dirender di dalam
  // kotak search. Urutan = urutan dipilih.
  const valueChips = useMemo(() => {
    if (mode !== "value") return [];
    if (vmode === "list") {
      return checkedValues.map((v) => ({
        key: `${v}`,
        label: `${allListOptions.find((o) => o.value === v)?.label ?? v}`,
      }));
    }
    if (vmode === "relation") {
      return relationCheckedRecords.map((r) => ({
        key: `${r.id}`,
        label: recordLabel(r),
      }));
    }
    if (vmode === "text" || vmode === "number") {
      return textChips.map((s) => ({ key: s, label: s }));
    }
    if (vmode === "date") {
      return dateChips.map((p) => ({
        key: dateSignature(p),
        label: formatPeriodValue(p, dateParseI18nLabels.monthsShort),
      }));
    }
    return [];
  }, [
    mode,
    vmode,
    checkedValues,
    allListOptions,
    relationCheckedRecords,
    textChips,
    dateChips,
    dateParseI18nLabels,
  ]);
  // Revisi 12: chip nilai yg sedang DIEDIT (teksnya sudah dimuat ke kotak)
  // disembunyikan -- tak ada dua "salinan" nilai yg sama. Data-nya tetap di
  // daftar (Escape membuang edit -> chip utuh); navigasi panah memakai daftar
  // yg tampil.
  const visibleValueChips = useMemo(
    () =>
      editingValueChipKey === null
        ? valueChips
        : valueChips.filter((chip) => chip.key !== editingValueChipKey),
    [valueChips, editingValueChipKey],
  );
  // Requirement 31: text/number TIDAK punya listing apa pun (langsung ketik,
  // tanpa daftar nilai) -- dropdown SEBELUMNYA tak pernah terbuka utk vmode
  // ini. `showHint` membuka dropdown KHUSUS utk menampilkan footer hint
  // (CommandList sendiri disembunyikan lewat kondisi CommandEmpty di bawah,
  // supaya tak ada pesan "tidak ditemukan" yg tak relevan utk mode ketik).
  const showHint = mode === "value" && (vmode === "text" || vmode === "number");
  const dropdownVisible =
    open &&
    (showPanel ||
      showSuggestions ||
      showValueList ||
      showRelationResults ||
      showHint);

  // cmdk dikontrol via `value`/`onValueChange` sendiri -- auto-highlight
  // bawaan cmdk cuma jalan sekali saat mount (gotcha yg sama dgn
  // Select.jsx:139-154 & MultiSelect.jsx). Panel TIDAK ikut (native
  // button/ul, bukan cmdk) -- highlight hanya relevan utk saran & daftar nilai.
  // Revisi 8 (Requirement 40.1): "Diisi"/"Tidak diisi" -- tersaring oleh
  // ketikan utk list/relation/date; utk text/number ketikan adalah NILAI (bukan
  // filter) sehingga keduanya selalu tampil.
  const setOptions = useMemo(() => {
    if (mode !== "value" || !valueColumn || !vmode) return [];
    const all = SET_OPTIONS.map((o) => ({ ...o, label: t(o.labelKey) }));
    const needle =
      vmode === "text" || vmode === "number"
        ? ""
        : vmode === "date"
          ? "" // date: Diisi/Tidak diisi selalu tampil (aksi tetap, bukan hasil pencarian)
          : searchText.trim().toLowerCase();
    return needle
      ? all.filter((o) => o.label.toLowerCase().includes(needle))
      : all;
  }, [mode, valueColumn, vmode, searchText, t]);
  const visibleKeys = useMemo(() => {
    if (showSuggestions)
      return sections.flatMap((s) => s.items.map((i) => i.key));
    const setKeys = setOptions.map((o) => o.key);
    if (vmode === "list") {
      return [...listUncheckedOptions.map((o) => `${o.value}`), ...setKeys];
    }
    if (vmode === "date") {
      return [
        ...datePresets.map((p) => p.key),
        ...dateSuggestions.map((s) => s.key),
        ...setKeys,
      ];
    }
    if (vmode === "relation") {
      return [...relationUncheckedOptions.map((r) => `${r.id}`), ...setKeys];
    }
    if (vmode === "text" || vmode === "number") return setKeys;
    return [];
  }, [
    showSuggestions,
    sections,
    vmode,
    listUncheckedOptions,
    datePresets,
    dateSuggestions,
    relationUncheckedOptions,
    setOptions,
  ]);
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
  // Revisi 7 (Requirement 37.1): daftar opsi list/relation tanpa checkbox --
  // Enter MEMILIH opsi ter-highlight HANYA bila user sedang "menuju" opsi
  // (ada ketikan, atau baru saja panah atas/bawah); tanpa itu Enter =
  // SELESAI. Sorotan cmdk (item pertama, otomatis) DISEMBUNYIKAN secara
  // visual selama tak ada niat (`optionClass`) supaya tak menyesatkan --
  // hover mouse tetap terlihat. Tak memakai nilai `value` sentinel: cmdk
  // memilih ulang item pertama sendiri begitu item ter-highlight dihapus.
  const isOptionMode =
    mode === "value" &&
    (vmode === "list" ||
      vmode === "relation" ||
      vmode === "text" ||
      vmode === "number");
  // list/relation: ketikan = filter -> niat; text/number: ketikan = NILAI,
  // niat hanya dari panah (utk opsi Diisi/Tidak diisi).
  const hasOptionIntent =
    !optionDismissed &&
    (((vmode === "list" || vmode === "relation") &&
      multiParts.pending.trim() !== "") ||
      (vmode === "date" && dateBody.trim() !== "") ||
      optionNavigated);
  const optionClass = !hasOptionIntent
    ? "data-[selected=true]:not-hover:bg-transparent! data-[selected=true]:not-hover:text-inherit!"
    : undefined;

  // --- Mode value: masuk/keluar, commit. ------------------------------------
  // Fokus otomatis ke input begitu mode value siap dipakai (kolom baru
  // dipilih dari suggestion CommandItem ATAU dari SearchPanel ColumnList --
  // keduanya lewat `pickColumn`/`enterValueMode`, TIDAK selalu menyisakan
  // fokus di input karena klik native <button> di ColumnList mengambil
  // fokus browser tanpa `onMouseDown preventDefault` seperti CommandList).
  useEffect(() => {
    if (mode !== "value") return;
    inputRef.current?.focus();
  }, [mode, valueColumn]);

  const exitValueMode = useCallback(() => {
    setMode("key");
    setValueColumn(null);
    setEditingLeafId(null);
    setInputValue("");
    setValueError(null);
    setCheckedValues([]);
    setSelectedRecords(new Map());
    setTextChips([]);
    setHighlightedValueChipKey(null);
    setOptionNavigated(false);
    setOptionDismissed(false);
    setEditingValueChipKey(null);
    setDatePickerValue(undefined);
    setDateChips([]);
    datePickerRef.current = undefined;
    knownRecordsRef.current = new Map();
  }, []);

  /**
   * Masuk mode value utk kolom `col` -- dipakai baik saat MEMBUAT chip baru
   * (saran/Panel "Kolom") maupun MENGEDIT chip existing (`opts.editId`).
   * Tanpa dialog/menu operator: operator SELALU tetap (ditentukan
   * `resolveValueMode`), user hanya mengisi/memilih nilai.
   *
   * Revisi 6 (Requirement 27): `opts.initialChecked`/`opts.initialRecords`
   * prefill checkbox-multi saat EDIT chip existing `=`/`in` -- tanpa ini,
   * membuka kembali chip multi-value akan mulai dari kosong & memaksa user
   * mencentang ulang semua pilihan lama. `opts.initialDateChips` (revisi 11)
   * sama utk chip nilai date/datetime -- widget `DateSelector` ter-embed
   * langsung dimuat dari chip itu (Requirement 30.1, 60.6).
   */
  const enterValueMode = useCallback((col, opts = {}) => {
    if (!col) return;
    setInputValue(opts.initialText ?? "");
    setValueError(null);
    setEditingLeafId(opts.editId ?? null);
    setCheckedValues(opts.initialChecked ?? []);
    setSelectedRecords(
      new Map((opts.initialRecords ?? []).map((r) => [r.id, r])),
    );
    setTextChips(opts.initialTextChips ?? []);
    setHighlightedValueChipKey(null);
    setOptionNavigated(false);
    setOptionDismissed(false);
    setEditingValueChipKey(null);
    // Nilai awal widget (mode multi) = cermin chip awal, dipasang SEKARANG
    // (bukan menunggu efek sinkron) supaya emisi-mount widget dikenali sbg
    // gema, bukan sbg perubahan user yg mengosongkan chip hasil prefill.
    const initialDateChips = opts.initialDateChips ?? [];
    const initialWidget =
      resolveValueMode(col) === "date"
        ? normalizeDatePayload(
            buildDateWidgetValue({ chips: initialDateChips }),
            col.type === "datetime",
          )
        : undefined;
    setDateChips(initialDateChips);
    setDatePickerValue(initialWidget);
    datePickerRef.current = initialWidget;
    knownRecordsRef.current = new Map();
    setMode("value");
    setValueColumn(col);
    setPanelForced(false);
    setOpen(true);
  }, []);

  // --- Chip nilai list/boolean/relation/text/number (Requirement 36). -------
  // Revisi 7: nilai = STATE (`checkedValues`/`selectedRecords`/`textChips`),
  // search box hanya berisi ketikan sementara (menggantikan model teks
  // `a | b |` revisi 6 feedback -- input jadi panjang & sulit dipakai
  // mencari opsi berikutnya). Memilih opsi dari daftar (klik / Enter)
  // MENAMBAH chip lalu mengosongkan ketikan (awalan `!` tetap); menghapus
  // lewat x / Backspace pada chip.
  const clearTyped = useCallback(() => {
    setValueError(null);
    setOptionNavigated(false);
    setOptionDismissed(false);
    setInputValue(excludeMode ? "!" : "");
  }, [excludeMode]);

  const pickListValue = useCallback(
    (value) => {
      setCheckedValues((prev) =>
        prev.includes(value)
          ? prev
          : isBooleanColumn
            ? [value]
            : [...prev, value],
      );
      clearTyped();
    },
    [isBooleanColumn, clearTyped],
  );

  // Boolean tak punya operator `in` (nilai tunggal): klik opsi = komit leaf +
  // tutup dropdown (revisi 9) -- tak perlu Enter hanya untuk menutup. Apply
  // tetap lewat Enter (dropdown tertutup) / tombol Search.
  const pickBooleanValue = useCallback(
    (value) => {
      if (!valueColumn) return;
      updateDraftLeaf(
        { k: valueColumn.name, o: excludeMode ? "!=" : "=", v: value },
        editingLeafId,
      );
      exitValueMode();
      closeDropdown();
    },
    [
      valueColumn,
      excludeMode,
      editingLeafId,
      updateDraftLeaf,
      exitValueMode,
      closeDropdown,
    ],
  );

  const pickRecord = useCallback(
    (record) => {
      knownRecordsRef.current.set(record.id, record);
      setSelectedRecords((prev) => new Map(prev).set(record.id, record));
      clearTyped();
    },
    [clearTyped],
  );

  // --- Chip nilai date/datetime (revisi 11, Requirement 60). ----------------
  // `dateChips` = daftar periode (SUMBER KEBENARAN nilai); search box hanya
  // ketikan sementara. Widget `DateSelector` (mode multi) MENCERMINKAN chip +
  // ketikan (`buildDateWidgetValue`) dan sebaliknya: klik sel di widget
  // MENGGANTI daftar chip dgn `selections` widget (chip ditambah/dilepas),
  // ketikan yg sudah ikut terpilih di widget dikosongkan.
  const dateTyped = useMemo(
    () =>
      mode === "value" && vmode === "date" && multiParts.pending.trim()
        ? parseDateText(multiParts.pending, dateParseCtx)
        : null,
    [mode, vmode, multiParts.pending, dateParseCtx],
  );
  // Nilai periode dari ketikan (rentang separuh dilengkapi) -- null bila tak
  // terparse / hanya simbol.
  const datePendingPeriod = useMemo(() => {
    if (!dateTyped) return null;
    const period = parseDatePeriod(multiParts.pending, dateParseCtx);
    return period
      ? normalizeDatePayload(period, dateParseCtx.isDatetime)
      : null;
  }, [dateTyped, multiParts.pending, dateParseCtx]);
  const computeDatePreview = useCallback(
    () =>
      normalizeDatePayload(
        buildDateWidgetValue({
          chips: dateChips,
          typed: dateTyped,
          editingKey: editingValueChipKey,
          prevPeriod: datePickerRef.current?.period,
        }),
        dateParseCtx.isDatetime,
      ),
    [dateChips, dateTyped, editingValueChipKey, dateParseCtx],
  );
  // Kotak search -> widget. Efek (bukan panggilan di tiap handler) supaya SEMUA
  // perubahan chip/ketikan (ketik, Tab, chip tambah/hapus/edit, preset) lewat
  // satu jalur. `datePickerRef` diisi sinkron di sini sehingga emisi ulang
  // widget atas nilai ini dikenali sbg gema (`handleDatePickerChange`).
  useEffect(() => {
    if (mode !== "value" || vmode !== "date") return;
    const payload = computeDatePreview();
    if (dateSignature(payload) === dateSignature(datePickerRef.current)) return;
    datePickerRef.current = payload;
    setDatePickerValue(payload);
  }, [mode, vmode, computeDatePreview]);

  // Widget -> kotak search. Mode multi (Kondisi Pada): daftar chip := pilihan
  // widget. Kondisi lain (mode tunggal): nilai widget ditulis sbg TEKS
  // (`periodValueToText`, simbol + nilai) tanpa komit -- chip tunggal lama
  // (yg widget sudah kosongkan) ikut dilepas.
  const handleDatePickerChange = useCallback(
    (next) => {
      if (!next) return;
      const isDatetime = dateParseCtx.isDatetime;
      const payload = normalizeDatePayload(next, isDatetime);
      if (dateSignature(payload) === dateSignature(datePickerRef.current)) {
        return;
      }
      datePickerRef.current = payload;
      setDatePickerValue(payload);
      const refocus = () => {
        // Klik sel kalender memindahkan fokus dari input (day-picker
        // memfokuskan tombol hari): kembalikan supaya Enter berikutnya jalan
        // -- tanpa membuka ulang dropdown.
        if (!widgetPointerRef.current) return;
        setTimeout(() => {
          const el = inputRef.current;
          if (el && document.activeElement !== el) {
            skipFocusOpenRef.current = true;
            el.focus();
            skipFocusOpenRef.current = false;
          }
        }, 0);
      };

      if (payload.operator === "is" && Array.isArray(payload.selections)) {
        // Sama dgn pratinjau saat ini (mis. ganti Periode saja) -> chip tetap.
        // Pratinjau bersimbol (Kondisi != Pada) lalu widget kembali ke Pada
        // = perubahan user (simbol & nilai lama dilepas).
        const preview = computeDatePreview();
        if (
          preview.operator === "is" &&
          dateSignature({ selections: preview.selections }) ===
            dateSignature({ selections: payload.selections })
        ) {
          return;
        }
        setDateChips(payload.selections);
        setEditingValueChipKey(null);
        clearTyped();
        refocus();
        return;
      }

      const { selections: _selections, ...single } = payload;
      setDateChips([]);
      setEditingValueChipKey(null);
      // Teks sudah menyatakan hal yg sama (mis. hydrate dari ketikan) ->
      // jangan ditimpa.
      const typed = parseDateText(multiParts.pending, dateParseCtx);
      const typedPayload = normalizeDatePayload(
        typed.value ?? { period: payload.period, operator: typed.operator },
        isDatetime,
      );
      if (dateSignature(typedPayload) === dateSignature(single)) return;
      setInputValue(
        `${excludeMode ? "!" : ""}${periodValueToText(
          single,
          dateParseI18nLabels.monthsShort,
        )}`,
      );
      setValueError(null);
      setOptionNavigated(false);
      refocus();
    },
    [
      dateParseCtx,
      dateParseI18nLabels,
      excludeMode,
      multiParts.pending,
      computeDatePreview,
      clearTyped,
    ],
  );

  // Chip baru dgn Periode lain (ketik/tempel/preset) -> Periode widget ikut
  // chip terakhir supaya pilihannya terlihat; Periode yg dipilih user lewat
  // widget sendiri tak diubah (pratinjau memakai `prevPeriod` = ref ini).
  const followPeriodOf = useCallback((periods) => {
    const last = periods.at(-1);
    if (last?.period && datePickerRef.current) {
      datePickerRef.current = {
        ...datePickerRef.current,
        period: last.period,
      };
    }
  }, []);

  // Revisi 12b: nilai bersimbol (`>5`, `>=2027`, `a..b`) = SATU-satunya nilai,
  // jadi begitu terbentuk langsung SELESAI (leaf ke draft, mode value keluar,
  // dropdown tutup) -- tak menunggu Enter kedua. Apply tetap Enter berikutnya.
  const finishWithPatch = useCallback(
    (patch) => {
      updateDraftLeaf(patch, editingLeafId);
      exitValueMode();
      closeDropdown();
    },
    [updateDraftLeaf, editingLeafId, exitValueMode, closeDropdown],
  );

  // Tambah nilai periode ke daftar chip (Enter / klik preset & saran):
  // menggantikan chip yg sedang diedit di posisinya; pelanggaran aturan daftar
  // (banyak nilai hanya utk "Pada", batas) -> pesan & daftar tak berubah.
  // Hasilnya SATU nilai bersimbol -> langsung selesai (`finishWithPatch`).
  const addDateValues = useCallback(
    (incoming) => {
      const merged = mergeDatePeriods(
        dateChips,
        incoming.map((p) => normalizeDatePayload(p, dateParseCtx.isDatetime)),
        { replaceKey: editingValueChipKey },
      );
      if (merged.error) {
        setValueError(dateNoticeText(merged.error, t));
        return false;
      }
      if (merged.chips.length === 1 && merged.chips[0].operator !== "is") {
        finishWithPatch(
          buildDateChipsLeaf(valueColumn, merged.chips, excludeMode),
        );
        return true;
      }
      followPeriodOf(incoming);
      setDateChips(merged.chips);
      setEditingValueChipKey(null);
      clearTyped();
      return true;
    },
    [
      valueColumn,
      excludeMode,
      finishWithPatch,
      dateChips,
      editingValueChipKey,
      dateParseCtx,
      clearTyped,
      followPeriodOf,
      t,
    ],
  );

  const removeValueChip = useCallback(
    (key) => {
      if (vmode === "list") {
        setCheckedValues((prev) => prev.filter((v) => `${v}` !== key));
      } else if (vmode === "relation") {
        setSelectedRecords((prev) => {
          const next = new Map(prev);
          for (const id of prev.keys()) if (`${id}` === key) next.delete(id);
          return next;
        });
      } else if (vmode === "date") {
        setDateChips((prev) => prev.filter((p) => dateSignature(p) !== key));
      } else {
        setTextChips((prev) => prev.filter((s) => s !== key));
      }
      // Chip yg sedang diedit dihapus -> batalkan edit & kosongkan input.
      if (key === editingValueChipKey) {
        setEditingValueChipKey(null);
        setInputValue(excludeMode ? "!" : "");
      }
      setValueError(null);
      setOptionNavigated(false);
    },
    [vmode, editingValueChipKey, excludeMode],
  );

  /**
   * Edit chip nilai TEXT (Requirement 41): teks chip dimuat ke input, chip
   * ditandai (`editingValueChipKey`); hasil edit menggantikan chip di posisi
   * yg sama saat pemisah/Enter (kosong = hapus), Escape/klik-luar membuangnya
   * (chip lama utuh -- tak ada data hilang). Ketikan yg sedang ada / edit
   * sebelumnya diselesaikan dulu supaya tak hilang saat pindah ke chip lain.
   */
  const startEditValueChip = useCallback(
    (key) => {
      // list/boolean/relation: chip dilepas, labelnya dimuat ke input (pilih
      // ulang / ubah ketikan lalu Enter). Nilai bebas (text/number): diganti
      // di posisi yg sama (di bawah).
      if (vmode === "list" || vmode === "relation") {
        const chip = valueChips.find((c) => c.key === key);
        if (!chip) return;
        removeValueChip(key);
        setInputValue(`${excludeMode ? "!" : ""}${chip.label}`);
        setHighlightedValueChipKey(null);
        setValueError(null);
        inputRef.current?.focus();
        return;
      }
      if (vmode === "date") {
        const chip = dateChips.find((p) => dateSignature(p) === key);
        if (!chip) return;
        // Ketikan yg sedang ada (atau edit sebelumnya) diselesaikan dulu supaya
        // tak hilang saat pindah ke chip lain -- pola sama text/number.
        const settled = mergeDatePeriods(
          dateChips,
          datePendingPeriod ? [datePendingPeriod] : [],
          {
            replaceKey: editingValueChipKey,
            dropReplaced: multiParts.pending.trim() === "",
          },
        );
        const list = settled.error ? dateChips : settled.chips;
        if (!list.some((p) => dateSignature(p) === key)) return;
        setDateChips(list);
        setEditingValueChipKey(key);
        setInputValue(
          `${excludeMode ? "!" : ""}${periodValueToText(
            chip,
            dateParseI18nLabels.monthsShort,
          )}`,
        );
        setHighlightedValueChipKey(null);
        setValueError(null);
        inputRef.current?.focus();
        return;
      }
      if (vmode !== "text" && vmode !== "number") return;
      const typed = multiParts.pending.trim();
      const list = [...textChips];
      const editing =
        editingValueChipKey === null ? -1 : list.indexOf(editingValueChipKey);
      if (editing >= 0) {
        if (typed) list[editing] = typed;
        else list.splice(editing, 1);
      } else if (typed) {
        list.push(typed);
      }
      const settled = Array.from(new Set(list));
      if (!settled.includes(key)) return;
      setTextChips(settled);
      setEditingValueChipKey(key);
      setInputValue(`${excludeMode ? "!" : ""}${key}`);
      setHighlightedValueChipKey(null);
      setValueError(null);
      inputRef.current?.focus();
    },
    [
      vmode,
      multiParts,
      textChips,
      dateChips,
      datePendingPeriod,
      dateParseI18nLabels,
      editingValueChipKey,
      excludeMode,
      valueChips,
      removeValueChip,
    ],
  );

  // Beberapa record berlabel sama (mis. dua kategori "Sparepart") -> pilih
  // yg BELUM terpilih (`taken`), supaya keduanya bisa dicapai lewat ketikan
  // (Requirement 36.3).
  const findRecordByLabel = useCallback(
    (label, taken) => {
      const matches = [
        ...selectedRecords.values(),
        ...relationSearch.options,
        ...knownRecordsRef.current.values(),
      ].filter((r) => sameLabel(recordLabel(r), label));
      return matches.find((r) => !taken?.has(r.id)) ?? matches[0];
    },
    [selectedRecords, relationSearch.options],
  );

  // Label relation yg diketik LEBIH CEPAT dari debounce fetch (500ms) tak ada
  // di `relationSearch.options` -- cari langsung ke endpoint yg SAMA (payload
  // `buildOptionsPayload`, sama dgn hook), lalu sinkron ulang ketikan terbaru
  // (`thenFinish`: lanjutkan Enter yg tertunda menunggu resolusi ini).
  const resolveRelationLabels = useCallback(
    async (text, labels, thenFinish = false) => {
      const found = await Promise.all(
        labels.map(async (label) => {
          try {
            const res = await axios.post(
              window.route("model"),
              buildOptionsPayload({
                model: valueColumn?.related,
                limit: 8,
                search: label,
              }),
            );
            return (res.data.data ?? []).find((r) =>
              sameLabel(recordLabel(r), label),
            );
          } catch {
            return undefined;
          }
        }),
      );
      // Hasil SELALU disimpan (walau teks sudah berubah lagi) supaya pass
      // berikutnya bisa meresolusi label yg sama tanpa fetch ulang.
      const hits = found.filter(Boolean);
      hits.forEach((r) => knownRecordsRef.current.set(r.id, r));
      // Teks berubah lagi selama fetch -> perubahan terbaru menanganinya sendiri.
      if (latestRef.current.text !== text) return;
      if (hits.length === 0) {
        if (thenFinish) {
          setValueError(
            t("core.datatable.search.option_not_found", { text: labels[0] }),
          );
        }
        return;
      }
      if (thenFinish) latestRef.current.finish();
      else latestRef.current.sync(text);
    },
    [valueColumn, t],
  );

  // Label yg diketik -> nilai: list = value opsi (label PERSIS, tanpa beda
  // huruf besar/kecil), relation = record, number = teks angka valid, text =
  // apa adanya. `takenIds` (relation) = record yg sudah terpilih.
  const resolveSegments = useCallback(
    (labels, takenIds) => {
      const resolved = [];
      const unresolved = [];
      const taken = new Set(takenIds);
      for (const label of labels) {
        if (vmode === "list") {
          const opt = allListOptions.find((o) => sameLabel(o.label, label));
          if (opt) resolved.push(opt.value);
          else unresolved.push(label);
        } else if (vmode === "relation") {
          const rec = findRecordByLabel(label, taken);
          if (rec) {
            taken.add(rec.id);
            resolved.push(rec);
          } else {
            unresolved.push(label);
          }
        } else if (vmode === "number") {
          if (Number.isNaN(Number(label))) unresolved.push(label);
          else resolved.push(label);
        } else if (vmode === "date") {
          const period = parseDatePeriod(label, dateParseCtx);
          if (period) {
            resolved.push(
              normalizeDatePayload(period, dateParseCtx.isDatetime),
            );
          } else {
            unresolved.push(label);
          }
        } else {
          resolved.push(label);
        }
      }
      return { resolved, unresolved };
    },
    [vmode, allListOptions, findRecordByLabel, dateParseCtx],
  );

  /**
   * Ketikan search box -> chip (Requirement 36.2-36.3): segmen SEBELUM `|`
   * terakhir jadi chip ATOMIK (semua atau tak satu pun); sisa (`pending`)
   * tetap di input, `!` di awal dipertahankan. Segmen tak dapat diresolusi ->
   * tak ada chip, teks dibiarkan, pesan tampil (relation: dicari dulu ke
   * endpoint). Belum ada `|` -> hanya ketikan biasa (filter pencarian).
   */
  const absorbTypedText = useCallback(
    (next) => {
      const { exclude, committed, pending } = parseMultiValueText(next, {
        separators: chipSeparators,
        isLabel: isKnownLabel,
      });
      if (committed.length === 0) {
        setInputValue(next);
        setValueError(null);
        return;
      }
      const { resolved, unresolved } = resolveSegments(
        committed,
        vmode === "relation" ? selectedRecords.keys() : undefined,
      );
      if (unresolved.length > 0) {
        setInputValue(next);
        setValueError(
          vmode === "number"
            ? t("core.datatable.search.number_invalid")
            : vmode === "date"
              ? t("core.datatable.search.date_invalid", {
                  text: unresolved[0],
                })
              : t("core.datatable.search.option_not_found", {
                  text: unresolved[0],
                }),
        );
        if (vmode === "relation") resolveRelationLabels(next, unresolved);
        return;
      }
      if (vmode === "list") {
        // Boolean maksimal satu chip (yang terakhir menang) -- backend
        // (`FilterTreeCleaner`) hanya menerima `=`/`!=` utk kolom boolean.
        setCheckedValues((prev) =>
          isBooleanColumn
            ? [resolved.at(-1)]
            : Array.from(new Set([...prev, ...resolved])),
        );
      } else if (vmode === "relation") {
        resolved.forEach((r) => knownRecordsRef.current.set(r.id, r));
        setSelectedRecords((prev) => {
          const map = new Map(prev);
          resolved.forEach((r) => map.set(r.id, r));
          return map;
        });
      } else if (vmode === "date") {
        // Aturan daftar (banyak nilai hanya "Pada", batas 20) dicek dulu:
        // melanggar -> pesan, ketikan dibiarkan, chip tak berubah.
        const merged = mergeDatePeriods(dateChips, resolved, {
          replaceKey: editingValueChipKey,
        });
        if (merged.error) {
          setInputValue(next);
          setValueError(dateNoticeText(merged.error, t));
          return;
        }
        if (merged.chips.length === 1 && merged.chips[0].operator !== "is") {
          finishWithPatch(
            buildDateChipsLeaf(valueColumn, merged.chips, exclude),
          );
          return true; // selesai: pemanggil TIDAK boleh membuka dropdown lagi
        }
        followPeriodOf(resolved);
        setDateChips(merged.chips);
        setEditingValueChipKey(null);
      } else {
        // Sedang mengedit chip -> hasil menggantikan chip itu di posisinya.
        setTextChips((prev) => {
          const i =
            editingValueChipKey === null
              ? -1
              : prev.indexOf(editingValueChipKey);
          const next =
            i >= 0
              ? [...prev.slice(0, i), ...resolved, ...prev.slice(i + 1)]
              : [...prev, ...resolved];
          return Array.from(new Set(next));
        });
        setEditingValueChipKey(null);
      }
      setInputValue(`${exclude ? "!" : ""}${pending}`);
      setValueError(null);
    },
    [
      vmode,
      editingValueChipKey,
      isBooleanColumn,
      selectedRecords,
      dateChips,
      valueColumn,
      finishWithPatch,
      chipSeparators,
      isKnownLabel,
      followPeriodOf,
      resolveSegments,
      resolveRelationLabels,
      t,
    ],
  );

  /**
   * Versi PURE (tanpa efek samping) dari commit chip nilai -- bentuk SATU
   * patch leaf `{k,o,v}` dari SEMUA chip saat ini (`=` bila satu, `in` bila
   * lebih -- Requirement 27.3/36.7; date: SELALU `in_period`, `v` objek bila
   * satu & daftar bila lebih -- revisi 16). `null` bila tak ada apa pun yg
   * perlu dikomit. Ketikan yg cocok PERSIS ikut dikomit utk list/relation --
   * tanpa ini `Aktif` yg diketik lalu klik-luar/Search dibuang diam-diam;
   * utk text/number HANYA bila `withTyped` (Enter): Escape/klik-luar tak
   * pernah mengomit teks bebas (Requirement 25). Dipisah dari
   * `commitCheckedSelectionSync` (di bawah) supaya bagian yang PURE (hitung
   * leaf) terpisah dari efek samping (update state, keluar mode value).
   */
  const computeCheckedLeafPatch = useCallback(
    ({ withTyped = false } = {}) => {
      if (!valueColumn) return null;
      const negate = excludeMode; // Requirement 29.3
      const pending = multiParts.pending.trim();
      const typed = [...multiParts.committed, ...(pending ? [pending] : [])];
      if (vmode === "list") {
        const { resolved } = resolveSegments(typed);
        const values =
          isBooleanColumn && resolved.length > 0
            ? [resolved.at(-1)]
            : Array.from(new Set([...checkedValues, ...resolved]));
        if (values.length > 0) {
          return buildListLeaf(valueColumn, values, negate);
        }
      }
      if (vmode === "relation") {
        const { resolved } = resolveSegments(typed, selectedRecords.keys());
        const map = new Map(selectedRecords);
        resolved.forEach((r) => map.set(r.id, r));
        const records = Array.from(map.values());
        if (records.length > 0) {
          return records.length === 1
            ? { k: valueColumn.name, o: negate ? "!=" : "=", v: records[0] }
            : { k: valueColumn.name, o: negate ? "!in" : "in", v: records };
        }
      }
      if (vmode === "text" || vmode === "number") {
        // Enter saat mengedit chip: ketikan MENGGANTIKAN chip yg diedit (kosong
        // = hapus). Tanpa `withTyped` (Escape/klik-luar) edit dibuang.
        let base = textChips;
        let extra = withTyped ? typed : [];
        if (
          withTyped &&
          editingValueChipKey !== null &&
          textChips.includes(editingValueChipKey)
        ) {
          base = textChips.flatMap((c) =>
            c === editingValueChipKey ? typed : [c],
          );
          extra = [];
        }
        return buildChipsLeaf(
          valueColumn,
          Array.from(new Set([...base, ...extra])),
          negate,
        );
      }
      if (vmode === "date") {
        // Revisi 11: leaf dari chip nilai; ketikan yg terparse ikut (kecuali
        // edit chip dibuang: Escape/klik-luar). Saat mengedit chip (Enter),
        // ketikan menggantikan chip itu -- kosong = hapus. Daftar yg melanggar
        // aturan -> hanya chip yg sudah sah.
        const editing =
          editingValueChipKey !== null &&
          dateChips.some((p) => dateSignature(p) === editingValueChipKey);
        const merged = editing
          ? withTyped
            ? mergeDatePeriods(
                dateChips,
                datePendingPeriod ? [datePendingPeriod] : [],
                {
                  replaceKey: editingValueChipKey,
                  dropReplaced: pending === "",
                },
              )
            : { chips: dateChips }
          : mergeDatePeriods(
              dateChips,
              datePendingPeriod ? [datePendingPeriod] : [],
            );
        return buildDateChipsLeaf(
          valueColumn,
          merged.error ? dateChips : merged.chips,
          negate,
        );
      }
      return null;
    },
    [
      valueColumn,
      vmode,
      excludeMode,
      checkedValues,
      selectedRecords,
      textChips,
      dateChips,
      datePendingPeriod,
      editingValueChipKey,
      multiParts,
      resolveSegments,
      isBooleanColumn,
    ],
  );

  /**
   * Commit checkbox-multi tercentang (bila ada) ke `draftTree` SECARA
   * SINKRON lalu keluar mode value -- Requirement 27.3, dipakai jalur exit
   * yang BUTUH nilai tree TERBARU di tick yang sama (klik-luar, tombol
   * Search) -- `setDraftTree` async, membaca balik state `draftTree`
   * setelahnya di render yang sama masih dapat versi LAMA. Return tree
   * hasil (buat dioper ke `applyDraft`), atau `undefined` bila tak ada yang
   * perlu dikomit (vmode text/number, atau list/relation/date tanpa
   * centangan/widget-value -- pemanggil lalu jatuh ke `applyDraft()` baca
   * state biasa). Escape/pilih-kolom-lain TIDAK butuh sinkron (apply
   * sesungguhnya nunggu jalur terpisah) tapi tetap aman pakai fungsi yang
   * SAMA -- lebih sederhana drpd 2 versi (sync & async) yang harus dijaga
   * konsisten.
   */
  const commitCheckedSelectionSync = useCallback(() => {
    const patch = computeCheckedLeafPatch();
    if (!patch) return undefined;
    const nextTree = editingLeafId
      ? updateChip(draftTree, editingLeafId, patch)
      : addLeafChip(draftTree, patch);
    setDraftTree(nextTree);
    exitValueMode();
    return nextTree;
  }, [computeCheckedLeafPatch, editingLeafId, draftTree, exitValueMode]);

  /**
   * Komit `patch` ke draft tree LALU langsung meng-apply (Requirement 37.8) --
   * utk pilihan TANPA chip (boolean, "Diisi"/"Tidak diisi"): nilainya tunggal,
   * jadi Enter PERTAMA sudah cukup (tak menunggu Enter kedua). Date/datetime
   * sejak revisi 11 memakai chip (Enter chip -> Enter selesai). Tree baru
   * dihitung sinkron & dioper ke `applyDraft` (`setDraftTree` belum ter-render).
   */
  const commitLeafAndApply = useCallback(
    (patch) => {
      const nextTree = editingLeafId
        ? updateChip(draftTree, editingLeafId, patch)
        : addLeafChip(draftTree, patch);
      setDraftTree(nextTree);
      exitValueMode();
      closeDropdown();
      applyDraft(nextTree);
    },
    [editingLeafId, draftTree, exitValueMode, closeDropdown, applyDraft],
  );

  /**
   * Pilih "Diisi"/"Tidak diisi" (Requirement 40.2): leaf `set`/`!set` TANPA
   * value (`v` dikosongkan eksplisit supaya edit leaf lama tak menyisakan
   * value basi). `!` di awal ketikan membalik pilihan. `apply` (Enter):
   * langsung meng-apply -- operator ini tak punya `in` (Requirement 37.8);
   * klik hanya mengomit.
   */
  const pickSetOperator = useCallback(
    (op, { apply = false } = {}) => {
      if (!valueColumn) return;
      const o = excludeMode ? (op === "set" ? "!set" : "set") : op;
      const patch = { k: valueColumn.name, o, v: undefined };
      if (apply) {
        commitLeafAndApply(patch);
        return;
      }
      updateDraftLeaf(patch, editingLeafId);
      exitValueMode();
      closeDropdown();
    },
    [
      valueColumn,
      excludeMode,
      commitLeafAndApply,
      updateDraftLeaf,
      editingLeafId,
      exitValueMode,
      closeDropdown,
    ],
  );

  /**
   * Enter di mode value chip (Requirement 37.1-37.3) = SELESAI: ketikan
   * cocok/valid ikut jadi chip, semua chip dikomit ke draft tree, mode value
   * keluar, dropdown ditutup (Enter berikutnya saat tertutup meng-apply --
   * jalur trigger 1). Ketikan tak valid (label tak cocok / bukan angka) ->
   * pesan, TIDAK selesai. Tanpa chip & tanpa ketikan -> keluar tanpa
   * mengubah draft tree.
   */
  /**
   * Enter di kolom text/number dgn ketikan (revisi 9): ketikan menjadi CHIP
   * dulu (menggantikan chip yg sedang diedit di posisinya), dropdown tetap
   * terbuka; Enter berikutnya (input kosong) baru menyelesaikan
   * (`finishValueMode`). Ketikan yg tak valid (number bukan angka / bentuk
   * yg tak menghasilkan leaf) -> pesan, tak jadi chip.
   */
  const absorbPendingText = useCallback(() => {
    const pending = multiParts.pending.trim();
    if (!pending || !valueColumn) return;
    const list = [...textChips];
    const i =
      editingValueChipKey === null ? -1 : list.indexOf(editingValueChipKey);
    if (i >= 0) list[i] = pending;
    else list.push(pending);
    const next = Array.from(new Set(list));
    const leaf = buildChipsLeaf(valueColumn, next, excludeMode);
    if (!leaf) {
      setValueError(t("core.datatable.search.number_invalid"));
      return;
    }
    // Nilai bersimbol (`>5`, `1..5`) = satu-satunya nilai -> langsung selesai.
    if (next.length === 1 && hasValueSymbol(vmode, next[0])) {
      finishWithPatch(leaf);
      return;
    }
    setTextChips(next);
    setEditingValueChipKey(null);
    setInputValue(excludeMode ? "!" : "");
    setValueError(null);
  }, [
    multiParts,
    valueColumn,
    vmode,
    textChips,
    editingValueChipKey,
    excludeMode,
    finishWithPatch,
    t,
  ]);

  const finishValueMode = useCallback(() => {
    if (!valueColumn) return;
    const pending = multiParts.pending.trim();
    const typed = [...multiParts.committed, ...(pending ? [pending] : [])];
    if (vmode === "list" || vmode === "relation") {
      const { unresolved } = resolveSegments(
        typed,
        vmode === "relation" ? selectedRecords.keys() : undefined,
      );
      if (unresolved.length > 0) {
        if (vmode === "relation") {
          resolveRelationLabels(inputValue, unresolved, true);
        } else {
          setValueError(
            t("core.datatable.search.option_not_found", {
              text: unresolved[0],
            }),
          );
        }
        return;
      }
    }
    const patch = computeCheckedLeafPatch({ withTyped: true });
    if (
      !patch &&
      vmode === "number" &&
      (textChips.length > 0 || typed.length > 0)
    ) {
      setValueError(t("core.datatable.search.number_invalid"));
      return;
    }
    // Boolean tak punya operator `in` -> selesai = langsung apply.
    if (patch && isBooleanColumn) {
      commitLeafAndApply(patch);
      return;
    }
    if (patch) updateDraftLeaf(patch, editingLeafId);
    exitValueMode();
    closeDropdown();
  }, [
    valueColumn,
    isBooleanColumn,
    commitLeafAndApply,
    vmode,
    multiParts,
    inputValue,
    selectedRecords,
    textChips,
    editingLeafId,
    resolveSegments,
    resolveRelationLabels,
    computeCheckedLeafPatch,
    updateDraftLeaf,
    exitValueMode,
    closeDropdown,
    t,
  ]);
  useEffect(() => {
    latestRef.current = {
      text: inputValue,
      sync: absorbTypedText,
      finish: finishValueMode,
    };
  });

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
      // Revisi 4 (§13.2, Requirement 22.8): kolom relasi BARE (`k` = nama
      // relasi, leaf `{k:"category", o:"=", v:<record>}` -- baik hasil
      // live-suggestion baru maupun Builder lanjutan/quick-filter klik sel)
      // masuk mode value relation dari 0 (search kosong, tanpa prefill teks
      // -- record lama tidak direka ulang jadi teks apa pun).
      if (column?.type === "relation") {
        // Revisi 6 (Requirement 27): prefill chip dari leaf existing -- tanpa
        // ini, buka-ulang chip relation multi-value mulai dari 0 pilihan,
        // memaksa user memilih ulang semua record lama. Revisi 7 (Requirement
        // 36.8): nilai tampil sbg chip; `!` di input bila leaf bernegasi.
        enterValueMode(column, {
          editId: chip.id,
          initialRecords: leafCheckedList(chip.node),
          initialText: leafExcluded(chip.node) ? "!" : "",
        });
        return;
      }
      const valueMode = column ? resolveValueMode(column) : null;
      if (valueMode) {
        const isTyped = valueMode === "text" || valueMode === "number";
        const checked = valueMode === "list" ? leafCheckedList(chip.node) : [];
        // Revisi 7 (Requirement 36.8): leaf `in`/`!in` text/number tampil sbg
        // chip; operator lain (matches, perbandingan, between) tetap teks.
        const asChips =
          isTyped && (chip.node?.o === "in" || chip.node?.o === "!in");
        const datePeriods =
          valueMode === "date"
            ? leafDatePeriods(chip.node).map((p) =>
                normalizeDatePayload(p, column.type === "datetime"),
              )
            : [];
        const dateAsText = datePeriods.length === 1;
        enterValueMode(column, {
          editId: chip.id,
          // Revisi 5 (Requirement 25): prefill LEWAT `leafToText` (bukan
          // cuma `v` mentah) -- leaf `{o:"!=", v:500}` prefill jadi "!500",
          // bukan "500" (yg kalau langsung commit ulang tanpa retype "!"
          // diam2 balik jadi operator `=`). List/boolean: nilai jadi chip,
          // `!` bila negasi.
          initialText:
            isTyped && !asChips
              ? leafToText(chip.node)
              : dateAsText
                ? `${leafExcluded(chip.node) ? "!" : ""}${periodValueToText(
                    datePeriods[0],
                    dateParseI18nLabels.monthsShort,
                  )}`
                : leafExcluded(chip.node)
                  ? "!"
                  : "",
          initialTextChips: asChips
            ? (Array.isArray(chip.node.v) ? chip.node.v : [chip.node.v]).map(
                (x) => `${x}`,
              )
            : [],
          // Revisi 6 (Requirement 27): sama, KHUSUS list/boolean.
          initialChecked: checked,
          // Revisi 11/12b/16: leaf date `in_period`/`!in_period` ber-`v` DAFTAR
          // (banyak nilai) tampil sbg chip nilai; SATU nilai (objek, polos atau
          // bersimbol) langsung dikonversi ke TEKS di kotak (`dateAsText`),
          // spt number/text.
          initialDateChips: dateAsText ? [] : datePeriods,
        });
        return;
      }
      // Kolom anak relasi (dotted) yg BELUM ter-hydrate dalam sesi ini (mis.
      // tree dari saved filter, relasinya tak pernah dipilih lewat UI ini) --
      // satu2nya cara leaf dotted terbentuk adalah `matches` pada kolom anak
      // string (`buildLeafFromText`), jadi aman diedit sbg teks polos tanpa
      // fetch ulang (judul kolom fallback ke segmen terakhir key).
      const key = String(chip.node?.k ?? "");
      if (!column && key.includes(".")) {
        enterValueMode(
          { name: key, type: "string", title: key.split(".").pop() },
          { editId: chip.id, initialText: leafToText(chip.node) },
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

  // Opsi list/record relation yg lagi ter-highlight DAN cocok dgn ketikan
  // (fetch relation di-debounce -- daftar bisa masih milik ketikan sebelumnya).
  // Dipakai Enter (memilih, Requirement 37.1) & Tab (melengkapi, 38.2).
  const highlightedOption = () => {
    const typed = multiParts.pending.trim().toLowerCase();
    const fits = (label) => !typed || `${label}`.toLowerCase().includes(typed);
    if (vmode === "list") {
      const opt = listUncheckedOptions.find(
        (o) => `${o.value}` === highlightedKey,
      );
      return opt && fits(opt.label) ? opt : null;
    }
    if (vmode === "relation") {
      const rec = relationUncheckedOptions.find(
        (r) => `${r.id}` === highlightedKey,
      );
      return rec && fits(recordLabel(rec)) ? rec : null;
    }
    return null;
  };

  // Label yg dituliskan Tab ke input (Requirement 38.2-38.3): opsi/record
  // ter-highlight (hanya bila ada ketikan), atau saran periode date. `null` =
  // tak ada yg dilengkapi (Tab berperilaku normal).
  const completionLabel = () => {
    if (vmode === "date") {
      return (
        dateSuggestions.find((s) => s.key === highlightedKey)?.label ?? null
      );
    }
    if (!multiParts.pending.trim()) return null;
    const opt = highlightedOption();
    if (!opt) return null;
    return vmode === "list" ? `${opt.label}` : recordLabel(opt);
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
      if (
        (isOptionMode || (mode === "value" && vmode === "date")) &&
        (e.key === "ArrowDown" || e.key === "ArrowUp")
      ) {
        // Panah PERTAMA (belum ada niat) cuma MEMUNCULKAN sorotan pada opsi
        // PERTAMA -- tanpa ini cmdk langsung menggeser sorotan diam2 (yg bisa
        // saja sudah bukan item pertama, mis. sisa pilihan cmdk sebelumnya).
        if (!hasOptionIntent) {
          e.preventDefault();
          e.stopPropagation();
          setOptionDismissed(false);
          setHighlightedKey(visibleKeys[0]);
          setOptionNavigated(true);
          return;
        }
        // Revisi 12: panah ATAS di opsi pertama -> kembali ke kotak search
        // (tanpa ini cmdk memutar ke opsi TERAKHIR).
        if (e.key === "ArrowUp" && highlightedKey === visibleKeys[0]) {
          e.preventDefault();
          e.stopPropagation();
          setOptionNavigated(false);
          setOptionDismissed(true);
          return;
        }
        // Menavigasi opsi = niat eksplisit (melindungi sorotan dari efek
        // reset item-pertama di atas); cmdk yg menggeser sorotannya.
        setOptionNavigated(true);
      }
      // Revisi 7 (Requirement 37.5-37.6): navigasi & hapus chip nilai --
      // ArrowLeft/Right menggeser sorotan (ArrowLeft dari input kosong/kursor
      // di awal masuk ke chip terakhir), Backspace/Delete pada chip tersorot
      // menghapusnya, Backspace di input kosong menyorot chip terakhir dulu
      // (2 langkah, pola sama chip utama).
      if (isChipMode && visibleValueChips.length > 0) {
        const idx = visibleValueChips.findIndex(
          (c) => c.key === highlightedValueChipKey,
        );
        const el = e.currentTarget;
        const caretAtStart = el.selectionStart === 0 && el.selectionEnd === 0;
        if (e.key === "ArrowLeft" && (idx >= 0 || caretAtStart)) {
          e.preventDefault();
          setHighlightedValueChipKey(
            visibleValueChips[
              idx < 0 ? visibleValueChips.length - 1 : Math.max(idx - 1, 0)
            ].key,
          );
          return;
        }
        if (e.key === "ArrowRight" && idx >= 0) {
          e.preventDefault();
          setHighlightedValueChipKey(visibleValueChips[idx + 1]?.key ?? null);
          return;
        }
        if ((e.key === "Backspace" || e.key === "Delete") && idx >= 0) {
          e.preventDefault();
          removeValueChip(visibleValueChips[idx].key);
          setHighlightedValueChipKey(null);
          return;
        }
        // Enter / Space pada chip nilai tersorot (panah) = edit chip itu
        // (revisi 9, semua tipe chip nilai).
        if ((e.key === "Enter" || e.key === " ") && idx >= 0) {
          e.preventDefault();
          e.stopPropagation();
          startEditValueChip(visibleValueChips[idx].key);
          return;
        }
        if (e.key === "Backspace" && inputValue === "") {
          e.preventDefault();
          setHighlightedValueChipKey(
            visibleValueChips[visibleValueChips.length - 1].key,
          );
          return;
        }
      }
      if (
        highlightedValueChipKey !== null &&
        !["Shift", "Control", "Alt", "Meta"].includes(e.key)
      ) {
        setHighlightedValueChipKey(null);
      }
      if (e.key === "Backspace" && inputValue === "") {
        if (mode === "value") {
          // Backspace-saat-kosong (tanpa chip nilai) = "batal keluar" (bukan
          // salah satu dari 4 jalur commit Requirement 27.3) -- TIDAK commit
          // apa pun, cuma tutup mode value apa adanya.
          exitValueMode();
          return;
        }
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
        if (mode === "value") {
          // Requirement 27.3, jalur exit "Escape": commit chip nilai jadi leaf
          // DULU -- no-op aman utk vmode date tanpa nilai widget.
          // `exitValueMode()` tetap dipanggil eksplisit sesudahnya -- aman
          // dipanggil dobel (idempotent) utk kasus TIDAK ada yg dikomit.
          commitCheckedSelectionSync();
          exitValueMode();
          return;
        }
        closeDropdown();
        return;
      }

      // Revisi 7 (Requirement 38): Tab completion, mirip `Select.jsx` -- Tab
      // CUMA melengkapi (mode key: memilih saran kolom ter-highlight, setara
      // `:`; mode value: menulis label ke input, TIDAK memilihnya -- dipilih
      // lewat `|`/Enter). Tak ada yg bisa dilengkapi -> Tab normal.
      if (e.key === "Tab" && !e.shiftKey) {
        if (mode === "key") {
          const item = highlightedColumnItem();
          if (item) {
            e.preventDefault();
            pickColumn(item.payload.column);
            return;
          }
        } else if (mode === "value") {
          const label = completionLabel();
          if (label !== null) {
            e.preventDefault();
            setInputValue(`${excludeMode ? "!" : ""}${label}`);
            setValueError(null);
            return;
          }
        }
      }

      // Revisi 3, sintaks ketik `kolom:...` (Requirement 19.1-19.2): `:`
      // selagi ada saran seksi "Kolom" yang lagi ke-highlight keyboard ->
      // konfirmasi kolom itu (SAMA persis dgn klik saran), TANPA `:` masuk
      // ke inputValue. Kalau yg ke-highlight BUKAN dari seksi Kolom (atau
      // tak ada), `:` diketik apa adanya -- tak ada aksi khusus.
      if (e.key === ":" && mode === "key") {
        const item = highlightedColumnItem();
        if (item) {
          e.preventDefault();
          pickColumn(item.payload.column);
          return;
        }
      }

      // Revisi 7 (Requirement 37.1): Enter di mode value chip. list/relation:
      // MEMILIH opsi ter-highlight bila user sedang menuju opsi (ada ketikan /
      // panah atas-bawah) -> chip, dropdown tetap terbuka; selain itu (dan utk
      // text/number) Enter = SELESAI. `stopPropagation` supaya handler Enter
      // root cmdk tak ikut memilih item ter-highlight.
      if (
        mode === "value" &&
        isChipMode &&
        vmode !== "date" &&
        e.key === "Enter"
      ) {
        e.preventDefault();
        e.stopPropagation();
        if (isOptionMode && hasOptionIntent) {
          // "Diisi"/"Tidak diisi" ter-highlight -> pilih + apply (Requirement 40.2).
          const setOpt = setOptions.find((o) => o.key === highlightedKey);
          if (setOpt) {
            pickSetOperator(setOpt.op, { apply: true });
            return;
          }
          const opt =
            vmode === "list" || vmode === "relation"
              ? highlightedOption()
              : null;
          if (opt) {
            if (isBooleanColumn) {
              // Boolean: nilai tunggal, tanpa `in` -> memilih = selesai + apply.
              commitLeafAndApply({
                k: valueColumn.name,
                o: excludeMode ? "!=" : "=",
                v: opt.value,
              });
            } else if (vmode === "list") {
              pickListValue(opt.value);
            } else {
              pickRecord(opt);
            }
            return;
          }
        }
        // Text/number dgn ketikan: jadi chip dulu, Enter berikutnya selesai.
        if (
          (vmode === "text" || vmode === "number") &&
          multiParts.committed.length === 0 &&
          multiParts.pending.trim() !== ""
        ) {
          absorbPendingText();
          return;
        }
        finishValueMode();
        return;
      }

      // Revisi 11 (Requirement 60.3): date/datetime memakai alur CHIP seperti
      // text/number -- Enter dgn ketikan (atau saran/preset yg ditavigasi
      // panah) = jadi chip & dropdown tetap terbuka; Enter dgn kotak kosong =
      // SELESAI; Enter saat dropdown tertutup = apply (cabang paling awal).
      // Saran ter-highlight MENANG atas ketikan (saran pertama = ketikan itu
      // sendiri; bila user menavigasi ke saran lain, itulah yg dipakai).
      // Preset/saran hanya dihitung bila ada NIAT: user mengetik isi (bukan
      // hanya simbol) atau menavigasi dgn panah -- sorotan otomatis item
      // pertama tak boleh dikomit diam-diam oleh Enter.
      if (mode === "value" && vmode === "date" && e.key === "Enter") {
        e.preventDefault();
        e.stopPropagation();
        const hasIntent = hasOptionIntent;
        const highlightedSuggestion = hasIntent
          ? dateSuggestions.find((item) => item.key === highlightedKey)
          : undefined;
        const typedPeriod = highlightedSuggestion ? null : datePendingPeriod;
        const highlightedPreset =
          typedPeriod || highlightedSuggestion || !hasIntent
            ? undefined
            : datePresets.find((item) => item.key === highlightedKey);
        // "Diisi"/"Tidak diisi" HANYA bila user menavigasi ke sana (panah):
        // teks transisi (mis. simbol `>` saja) tak boleh diam-diam memilihnya
        // hanya karena item pertama otomatis tersorot.
        const highlightedSet =
          typedPeriod ||
          highlightedSuggestion ||
          highlightedPreset ||
          !optionNavigated
            ? null
            : setOptions.find((o) => o.key === highlightedKey);
        if (highlightedSet) {
          pickSetOperator(highlightedSet.op, { apply: true });
          return;
        }
        const candidate =
          highlightedSuggestion?.value ??
          typedPeriod ??
          highlightedPreset?.value;
        if (candidate) {
          addDateValues([candidate]);
          return;
        }
        // Ketikan berisi tapi tak dikenali -> pesan, tak selesai. Kosong /
        // hanya simbol: Enter = SELESAI (keluar mode value, tutup dropdown).
        if (dateBody.trim() !== "") {
          setValueError(
            t("core.datatable.search.date_invalid", { text: dateBody.trim() }),
          );
          return;
        }
        finishValueMode();
        return;
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
      exitValueMode,
      sections,
      highlightedKey,
      pickColumn,
      vmode,
      isChipMode,
      visibleValueChips,
      highlightedValueChipKey,
      removeValueChip,
      startEditValueChip,
      finishValueMode,
      absorbPendingText,
      optionNavigated,
      addDateValues,
      datePendingPeriod,
      dateBody,
      t,
      updateDraftLeaf,
      editingLeafId,
      commitCheckedSelectionSync,
      closeDropdown,
      excludeMode,
      multiParts,
      listUncheckedOptions,
      relationUncheckedOptions,
      dateSuggestions,
      isOptionMode,
      hasOptionIntent,
      visibleKeys,
      pickListValue,
      pickRecord,
      isBooleanColumn,
      commitLeafAndApply,
      valueColumn,
      excludeMode,
      datePresets,
      openEditorForChip,
      setOptions,
      pickSetOperator,
      startEditValueChip,
    ],
  );

  const handleInputChange = useCallback(
    (e) => {
      let next = e.target.value;
      if (isChipMode) {
        // Paste yg mengandung `|`: segmen terakhir dianggap selesai juga
        // (preseden `MultiSelect`: paste = aksi massal sekali jalan).
        const sepClass = new RegExp(`[${chipSeparators}]`);
        if (
          e.nativeEvent?.inputType === "insertFromPaste" &&
          sepClass.test(next) &&
          !sepClass.test(next.trimEnd().slice(-1))
        ) {
          next += "|";
        }
        // Revisi 12: number/date -- daftar chip = N nilai polos ATAU satu nilai
        // bersimbol. Ketikan yg melanggar DITOLAK (kotak tak berubah) + pesan.
        if (vmode === "number" || vmode === "date") {
          const { committed, pending } = parseMultiValueText(next, {
            separators: chipSeparators,
          });
          const others =
            vmode === "date"
              ? dateChips.filter(
                  (p) => dateSignature(p) !== editingValueChipKey,
                )
              : textChips.filter((c) => c !== editingValueChipKey);
          const violation = chipEntryViolation(vmode, others, [
            ...committed,
            pending,
          ]);
          if (violation) {
            setValueError(t(`core.datatable.search.chip_${violation}`));
            return;
          }
        }
        setHighlightedValueChipKey(null);
        setOptionNavigated(false);
        setOptionDismissed(false);
        // Nilai bersimbol terbentuk -> sudah SELESAI (dropdown ditutup): jangan
        // dibuka lagi di bawah, supaya Enter berikutnya meng-apply.
        if (absorbTypedText(next) === true) return;
      } else {
        setInputValue(next);
        setValueError(null);
      }
      setPanelForced(false);
      setOpen(true);
    },
    [
      isChipMode,
      chipSeparators,
      absorbTypedText,
      vmode,
      dateChips,
      textChips,
      editingValueChipKey,
      t,
    ],
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
                    {visibleValueChips.map((chip) => (
                      <span
                        key={chip.key}
                        data-excluded={excludeMode ? "true" : undefined}
                        className={cn(
                          "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs shrink-0",
                          // Mode kecualikan cukup ditandai badge kolom merah +
                          // `data-excluded`; chip TIDAK merah -- bentrok dgn
                          // ring merah penanda chip yg sedang tersorot.
                          chipClass("value"),
                          highlightedValueChipKey === chip.key &&
                            "ring-2 ring-destructive",
                        )}
                      >
                        {vmode === "text" ||
                        vmode === "number" ||
                        vmode === "date" ? (
                          // Chip nilai text/number/date dapat diklik utk diedit (Requirement 41.1).
                          <button
                            type="button"
                            className="max-w-40 truncate cursor-text hover:underline"
                            onMouseDown={(e) => e.preventDefault()}
                            onClick={() => startEditValueChip(chip.key)}
                          >
                            {chip.label}
                          </button>
                        ) : (
                          <span className="max-w-40 truncate">
                            {chip.label}
                          </span>
                        )}
                        <button
                          type="button"
                          aria-label={t("core.datatable.search.remove_chip", {
                            label: chip.label,
                          })}
                          className="cursor-pointer opacity-70 hover:opacity-100"
                          onMouseDown={(e) => e.preventDefault()}
                          onClick={() => removeValueChip(chip.key)}
                        >
                          <X className="size-3" />
                        </button>
                      </span>
                    ))}
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
                        {/* Requirement 29.1: indikator "Kecualikan" -- SEMUA
                        tipe kolom mode value, bukan cuma list/relation
                        (text/number sudah punya negasi lewat sintaks ketik
                        `!`, ini cuma penegasan visual yg sama). */}
                        {excludeMode && (
                          <div className="px-2 py-1 text-xs font-medium text-destructive border-b">
                            {t("core.datatable.search.exclude_badge")}
                          </div>
                        )}
                        <div
                          className={cn(
                            dateTwoColumn && "md:flex md:items-stretch",
                          )}
                        >
                          <div
                            className={cn(
                              "min-w-0",
                              dateTwoColumn && "md:flex-1",
                            )}
                          >
                            {showRelationResults && relationSearch.loading && (
                              <div className="flex items-center justify-center py-2 border-b">
                                <LoadingIcon
                                  role="status"
                                  aria-label={t(
                                    "core.datatable.search.applying",
                                  )}
                                  className="size-4 text-muted-foreground"
                                />
                              </div>
                            )}
                            <CommandList
                              onMouseDown={(e) => e.preventDefault()}
                            >
                              {/* Revisi 5: cmdk render <CommandEmpty> otomatis begitu
                          0 CommandItem terdaftar -- SELAMA fetch relation
                          masih pending, options masih [] (belum ada item),
                          jadi "tidak ditemukan" nongol BARENGAN LoadingIcon
                          (bug nyata, ketauan verifikasi visual). Sembunyikan
                          eksplisit selama loading -- baru muncul kalau fetch
                          BENAR-BENAR selesai dgn hasil kosong.
                          Revisi 6 (Requirement 31): JUGA disembunyikan utk
                          `showHint` (text/number) -- dropdown itu dibuka
                          KHUSUS utk footer hint di bawah, bukan listing;
                          "tidak ditemukan" di situ cuma pesan tak relevan. */}
                              {!(
                                showRelationResults && relationSearch.loading
                              ) &&
                                !showHint && (
                                  <CommandEmpty>
                                    {t("core.form.not_found")}
                                  </CommandEmpty>
                                )}
                              {showSuggestions &&
                                sections.map((sec) => (
                                  <CommandGroup
                                    key={sec.section}
                                    heading={
                                      sec.section !== "text"
                                        ? t(
                                            `core.datatable.search.section.${sec.section}`,
                                          )
                                        : undefined
                                    }
                                  >
                                    {sec.items.map((item) => (
                                      <CommandItem
                                        key={item.key}
                                        value={item.key}
                                        onSelect={() =>
                                          selectSuggestion(sec.section, item)
                                        }
                                      >
                                        {/* Dibungkus 1 <span> -- CommandItem ber-`gap-2`
                                    flex, hasil highlightMatch (array node)
                                    kalau langsung jadi children akan dianggap
                                    flex-item TERPISAH & dapat gap visual di
                                    antara <mark> & teks sisanya (bug nyata,
                                    lihat screenshot verifikasi visual). */}
                                        <span>
                                          {item.prefix}
                                          {item.badgeStatus !== undefined ? (
                                            <BadgeStatus
                                              status={item.badgeStatus}
                                              label={highlightMatch(
                                                item.label.slice(
                                                  item.prefix?.length ?? 0,
                                                ),
                                                inputValue,
                                              )}
                                              className="text-xs py-0.5 px-2"
                                            />
                                          ) : (
                                            highlightMatch(
                                              item.label.slice(
                                                item.prefix?.length ?? 0,
                                              ),
                                              inputValue,
                                            )
                                          )}
                                        </span>
                                      </CommandItem>
                                    ))}
                                  </CommandGroup>
                                ))}
                              {/* Revisi 7 (Requirement 36.10): opsi list/boolean
                          TANPA checkbox -- klik / Enter menambah chip; opsi
                          yg sudah jadi chip tak ditampilkan lagi. */}
                              {showValueList &&
                                vmode === "list" &&
                                listUncheckedOptions.map((opt) => (
                                  <CommandItem
                                    key={`${opt.value}`}
                                    value={`${opt.value}`}
                                    onSelect={() =>
                                      isBooleanColumn
                                        ? pickBooleanValue(opt.value)
                                        : pickListValue(opt.value)
                                    }
                                    className={optionClass}
                                  >
                                    {isStatusColumn(valueColumn) ? (
                                      <BadgeStatus
                                        status={opt.value}
                                        label={highlightMatch(
                                          opt.label,
                                          searchText,
                                        )}
                                        className="text-xs py-0.5 px-2"
                                      />
                                    ) : (
                                      <span>
                                        {highlightMatch(opt.label, searchText)}
                                      </span>
                                    )}
                                  </CommandItem>
                                ))}
                              {showValueList &&
                                vmode === "date" &&
                                datePresets.map((preset) => (
                                  <CommandItem
                                    key={preset.key}
                                    value={preset.key}
                                    onSelect={() =>
                                      addDateValues([preset.value])
                                    }
                                    className={optionClass}
                                  >
                                    <span>
                                      {highlightMatch(preset.label, searchText)}
                                    </span>
                                  </CommandItem>
                                ))}
                              {/* Requirement 30.5: token belum lengkap (tanpa tahun
                          spesifik, mis. "Q2") -> kandidat tahun terdekat.
                          Revisi 11: klik menambah chip (dropdown tetap
                          terbuka), SAMA dgn preset. */}
                              {showValueList &&
                                vmode === "date" &&
                                dateSuggestions.length > 0 && (
                                  <CommandSeparator />
                                )}
                              {showValueList &&
                                vmode === "date" &&
                                dateSuggestions.map((suggestion) => (
                                  <CommandItem
                                    key={suggestion.key}
                                    value={suggestion.key}
                                    onSelect={() =>
                                      addDateValues([suggestion.value])
                                    }
                                    className={optionClass}
                                  >
                                    <span>{suggestion.label}</span>
                                  </CommandItem>
                                ))}
                              {/* Revisi 7 (Requirement 36.10): record relation tanpa
                          checkbox -- klik / Enter menambah chip; record yg
                          sudah jadi chip tak ditampilkan lagi (chip persist
                          walau kata kunci berubah, Requirement 28). */}
                              {showRelationResults &&
                                relationUncheckedOptions.map((record) => (
                                  <CommandItem
                                    key={`${record.id}`}
                                    value={`${record.id}`}
                                    onSelect={() => pickRecord(record)}
                                    className={optionClass}
                                  >
                                    <span>{recordLabel(record)}</span>
                                  </CommandItem>
                                ))}
                              {/* `CommandEmpty` cmdk tak pernah tampil selama opsi
                          Diisi/Tidak diisi ada -- pesan "tidak ditemukan"
                          dirender eksplisit HANYA utk relation tanpa ketikan
                          & tanpa record sama sekali. Sejak Revisi 15 TIDAK
                          muncul bila ada ketikan: opsi Diisi/Tidak diisi yg
                          tampil itu SUDAH cocok dgn ketikan (di-filter
                          `setOptions`), jadi "tidak ada hasil" di atasnya
                          kontradiktif; bila ketikan tak cocok apa pun,
                          `setOptions` kosong & CommandEmpty bawaan yg muncul.
                          List: nilai kosong krn semua sudah jadi chip bukan
                          "tidak ditemukan". */}
                              {setOptions.length > 0 &&
                                showRelationResults &&
                                !relationSearch.loading &&
                                relationUncheckedOptions.length === 0 &&
                                !searchText.trim() && (
                                  <div className="py-2 text-center text-sm text-muted-foreground">
                                    {t("core.form.not_found")}
                                  </div>
                                )}
                              {/* Revisi 8 (Requirement 40): "Diisi"/"Tidak diisi"
                          utk SEMUA tipe kolom, di bawah daftar nilai. */}
                              {mode === "value" && setOptions.length > 0 && (
                                <>
                                  {((vmode === "list" &&
                                    listUncheckedOptions.length > 0) ||
                                    (vmode === "relation" &&
                                      relationUncheckedOptions.length > 0) ||
                                    (vmode === "date" &&
                                      datePresets.length +
                                        dateSuggestions.length >
                                        0)) && <CommandSeparator />}
                                  {setOptions.map((opt) => (
                                    <CommandItem
                                      key={opt.key}
                                      value={opt.key}
                                      onSelect={() => pickSetOperator(opt.op)}
                                      className={optionClass}
                                    >
                                      <span>
                                        {highlightMatch(
                                          opt.label,
                                          vmode === "text" || vmode === "number"
                                            ? ""
                                            : searchText,
                                        )}
                                      </span>
                                    </CommandItem>
                                  ))}
                                </>
                              )}
                            </CommandList>
                          </div>
                          {/* Requirement 30.1: widget `DateSelector` (ui/date-
                        selector.jsx) ter-embed PENUH, di LUAR `CommandList`
                        (bukan cmdk item -- kalender punya navigasi keyboard
                        sendiri, tak boleh diintersep arrow-key cmdk). Text-
                        parse (Enter) & preset TETAP jalan berdampingan --
                        embed ini TAMBAHAN, bukan pengganti (Requirement
                        30.2). Nilai widget DISIMPAN dulu (`datePickerValue`),
                        BUKAN langsung commit per onChange -- interaksi range
                        butuh >1 klik; commit sesungguhnya lewat Enter atau
                        jalur exit yg sama dgn checkbox-multi. */}
                          {showValueList && vmode === "date" && (
                            <div
                              className="p-2 border-t md:border-t-0 md:border-l md:shrink-0"
                              onMouseDown={(e) => {
                                e.preventDefault();
                                widgetPointerRef.current = true;
                              }}
                              onKeyDown={() => {
                                widgetPointerRef.current = false;
                              }}
                              onFocusCapture={() => setWidgetFocus(true)}
                              onBlurCapture={(e) => {
                                if (
                                  !e.currentTarget.contains(e.relatedTarget)
                                ) {
                                  setWidgetFocus(false);
                                }
                              }}
                            >
                              <ReuiDateSelector
                                value={reuiDateValue}
                                onChange={handleDatePickerChange}
                                i18n={reuiDateI18n}
                                showTwoMonths={false}
                                withTime={dateParseCtx.isDatetime}
                                minYear={dateYearBounds.minYear}
                                maxYear={dateYearBounds.maxYear}
                                allowMultiple
                                maxSelections={MAX_DATE_VALUES}
                                onSelectionLimit={() =>
                                  setValueError(dateNoticeText("limit", t))
                                }
                              />
                            </div>
                          )}
                        </div>
                        {/* Requirement 31 / 42: petunjuk (legend tombol + penjelasan)
                        selama mode value aktif, sesuai tipe kolom. */}
                        {(mode === "value" || showSuggestions) && (
                          <SearchLegend ctx={legendCtx} />
                        )}
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
