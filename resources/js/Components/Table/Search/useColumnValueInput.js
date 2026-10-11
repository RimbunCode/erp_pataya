// useColumnValueInput — state + turunan + aksi input NILAI satu kolom (mode
// value) yang diekstrak dari `SearchBar.jsx` supaya dipakai BERSAMA oleh Search
// Bar atas (satu instance, kolom berganti) dan Sel Filter per kolom (satu
// instance per sel) -- spec datatable2-column-search-row, Requirement 10.2.
// Isinya dipindah apa adanya; satu-satunya perubahan: efek ke host
// (menulis draft / membuka-menutup dropdown) lewat callback `onCommit`,
// `onRequestOpen`, `onRequestClose` sehingga hook ini tak tahu soal tree/draft.
//
// Kontrak callback:
//  - `onCommit(patch, {editId, apply})`: sesi menghasilkan leaf `patch`
//    (`{k,o,v}`). `editId` = id leaf yang diedit (null = leaf baru). `apply`
//    true = pilihan tunggal yang langsung ter-apply (boolean, Diisi/Tidak
//    diisi). Mengembalikan tree draft hasil (utk jalur klik-luar Search Bar).
//  - `onRequestOpen()` / `onRequestClose()`: minta host membuka/menutup dropdown.

import {
  buildChipsLeaf,
  buildDateChipsLeaf,
  buildDatePresets,
  buildDateWidgetValue,
  buildListLeaf,
  chipEntryViolation,
  dateSignature,
  formatPeriodValue,
  hasValueSymbol,
  mergeDatePeriods,
  parseDatePeriod,
  parseDateText,
  parseMultiValueText,
  periodValueToText,
  resolveValueMode,
  separatorsFor,
  suggestPeriodTokens,
  DATE_OPERATOR_BY_SYMBOL,
} from "./columnSearch";
import {
  SET_OPTIONS,
  dateNoticeText,
  listOptionsFor,
  normalizeDatePayload,
  recordLabel,
  sameLabel,
} from "./valueInputUtils";
import {
  buildPeriodI18nLabels,
  buildReuiDateI18n,
  defaultYearBounds,
  parseLocalDate,
} from "../Filter/periodParsing";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import axios from "axios";
import { getLocaleDate } from "@/lib/utils";
import useLinkModelOptions, {
  buildOptionsPayload,
} from "@/Hooks/useLinkModelOptions";
import { useLaravelReactI18n } from "laravel-react-i18n";

/**
 * @param {object} p
 * @param {React.RefObject} p.inputRef input yang difokuskan secara programatik
 * @param {(patch: {k: string, o: string, v?: unknown}, meta: {editId: string|null, apply: boolean}) => (object|null|undefined)} p.onCommit
 * @param {() => void} [p.onRequestOpen]
 * @param {() => void} [p.onRequestClose]
 * @param {boolean} [p.commitOnEscape] Search Bar atas: true (Escape meng-commit
 *   chip nilai, Requirement 27.3); Sel Filter: false (Escape membuang sesi)
 * @returns {object} state, turunan, aksi, handler (lihat daftar `return`)
 */
export default function useColumnValueInput({
  inputRef,
  onCommit,
  onRequestOpen,
  onRequestClose,
  commitOnEscape = true,
}) {
  const { t, currentLocale } = useLaravelReactI18n();
  const [inputValue, setInputValue] = useState("");
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
  const [highlightedKey, setHighlightedKey] = useState();
  // Mode value <=> ada kolom yang sedang diisi (tak ada state `mode` terpisah).
  const mode = valueColumn ? "value" : "key";

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
  const valueVisibleKeys = useMemo(() => {
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
    vmode,
    listUncheckedOptions,
    datePresets,
    dateSuggestions,
    relationUncheckedOptions,
    setOptions,
  ]);
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
  const enterValueMode = useCallback(
    (col, opts = {}) => {
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
      setValueColumn(col);
      onRequestOpen?.();
    },
    [onRequestOpen],
  );

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
      onCommit(
        { k: valueColumn.name, o: excludeMode ? "!=" : "=", v: value },
        { editId: editingLeafId, apply: false },
      );
      exitValueMode();
      onRequestClose?.();
    },
    [
      valueColumn,
      excludeMode,
      editingLeafId,
      onCommit,
      exitValueMode,
      onRequestClose,
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
      onCommit(patch, { editId: editingLeafId, apply: false });
      exitValueMode();
      onRequestClose?.();
    },
    [onCommit, editingLeafId, exitValueMode, onRequestClose],
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
   * Commit checkbox-multi tercentang (bila ada) SECARA SINKRON lalu keluar
   * mode value -- Requirement 27.3, dipakai jalur exit yang BUTUH nilai tree
   * TERBARU di tick yang sama (klik-luar, tombol Search). `onCommit` host
   * mengembalikan tree hasil (utk dioper ke `apply-draft host`). Return `undefined`
   * bila tak ada yang perlu dikomit.
   */
  const commitCheckedSelectionSync = useCallback(() => {
    const patch = computeCheckedLeafPatch();
    if (!patch) return undefined;
    const nextTree = onCommit(patch, { editId: editingLeafId, apply: false });
    exitValueMode();
    return nextTree;
  }, [computeCheckedLeafPatch, editingLeafId, onCommit, exitValueMode]);

  /**
   * Komit `patch` LALU langsung meng-apply (Requirement 37.8) -- utk pilihan
   * TANPA chip (boolean, "Diisi"/"Tidak diisi"): nilainya tunggal, jadi Enter
   * PERTAMA sudah cukup (tak menunggu Enter kedua).
   */
  const commitLeafAndApply = useCallback(
    (patch) => {
      onCommit(patch, { editId: editingLeafId, apply: true });
      exitValueMode();
      onRequestClose?.();
    },
    [editingLeafId, onCommit, exitValueMode, onRequestClose],
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
      onCommit(patch, { editId: editingLeafId, apply: false });
      exitValueMode();
      onRequestClose?.();
    },
    [
      valueColumn,
      excludeMode,
      commitLeafAndApply,
      onCommit,
      editingLeafId,
      exitValueMode,
      onRequestClose,
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
    if (patch) onCommit(patch, { editId: editingLeafId, apply: false });
    exitValueMode();
    onRequestClose?.();
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
    onCommit,
    exitValueMode,
    onRequestClose,
    t,
  ]);
  useEffect(() => {
    latestRef.current = {
      text: inputValue,
      sync: absorbTypedText,
      finish: finishValueMode,
    };
  });

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

  // Event ketik -- bagian `handleInputChange` SearchBar yg menyangkut nilai.
  const handleChange = (e) => {
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
            ? dateChips.filter((p) => dateSignature(p) !== editingValueChipKey)
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
    onRequestOpen?.();
  };

  // Event keyboard mode-value. SearchBar memanggil ini bila `mode === "value"`
  // SETELAH cabang mode key-nya sendiri; Sel Filter memanggilnya langsung.
  const handleKeyDown = (e) => {
    // Cabang mode-value `handleInputKeyDown` SearchBar (urutan sama persis).
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
        setHighlightedKey(valueVisibleKeys[0]);
        setOptionNavigated(true);
        return;
      }
      // Revisi 12: panah ATAS di opsi pertama -> kembali ke kotak search
      // (tanpa ini cmdk memutar ke opsi TERAKHIR).
      if (e.key === "ArrowUp" && highlightedKey === valueVisibleKeys[0]) {
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
      // Backspace-saat-kosong (tanpa chip nilai) = "batal keluar" (bukan
      // salah satu dari 4 jalur commit Requirement 27.3) -- TIDAK commit
      // apa pun, cuma tutup mode value apa adanya.
      exitValueMode();
      return;
    }
    if (e.key === "Escape") {
      // Requirement 27.3, jalur exit "Escape": commit chip nilai jadi leaf
      // DULU (Search Bar atas); Sel Filter (`commitOnEscape: false`) membuang
      // sesi -- commit sel hanya lewat Enter (Requirement 6.4-6.5).
      if (commitOnEscape) commitCheckedSelectionSync();
      exitValueMode();
      return;
    }
    // Revisi 7 (Requirement 38): Tab melengkapi label opsi/record/periode
    // ke input, TIDAK memilihnya. Tak ada yg bisa dilengkapi -> Tab normal.
    if (e.key === "Tab" && !e.shiftKey) {
      const label = completionLabel();
      if (label !== null) {
        e.preventDefault();
        setInputValue(`${excludeMode ? "!" : ""}${label}`);
        setValueError(null);
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
          vmode === "list" || vmode === "relation" ? highlightedOption() : null;
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
        highlightedSuggestion?.value ?? typedPeriod ?? highlightedPreset?.value;
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
  };

  // Konteks petunjuk (`SearchLegend`) scope "value" -- dipakai Sel Filter;
  // Search Bar atas menurunkan konteks lengkapnya sendiri (panel/saran/value).
  const valueLegendCtx = useMemo(() => {
    // number/date: sudah ada nilai polos -> simbol ditolak; satu nilai
    // bersimbol -> tak ada nilai lain (aturan daftar, `chipEntryViolation`).
    const others =
      vmode === "date"
        ? dateChips.filter((p) => dateSignature(p) !== editingValueChipKey)
        : vmode === "number"
          ? textChips.filter((c) => c !== editingValueChipKey)
          : [];
    return {
      scope: "value",
      vmode,
      isBoolean: isBooleanColumn,
      hasChips: visibleValueChips.length > 0,
      chipFocused: highlightedValueChipKey !== null,
      typing: multiParts.pending.trim() !== "",
      optionActive: hasOptionIntent,
      editing: editingValueChipKey !== null,
      excluded: excludeMode,
      chipLock: others.length > 0 ? "plain" : null,
      typingSymbol: hasValueSymbol(vmode, multiParts.pending),
      widgetFocused: widgetFocus,
    };
  }, [
    vmode,
    dateChips,
    textChips,
    editingValueChipKey,
    isBooleanColumn,
    visibleValueChips,
    highlightedValueChipKey,
    multiParts.pending,
    hasOptionIntent,
    excludeMode,
    widgetFocus,
  ]);

  return {
    absorbPendingText,
    absorbTypedText,
    addDateValues,
    allListOptions,
    checkedValues,
    chipSeparators,
    clearTyped,
    commitCheckedSelectionSync,
    commitLeafAndApply,
    completionLabel,
    computeCheckedLeafPatch,
    computeDatePreview,
    dateBody,
    dateChips,
    dateLocale,
    dateParseCtx,
    dateParseI18nLabels,
    datePendingPeriod,
    datePickerRef,
    datePickerValue,
    datePresets,
    dateSuggestions,
    dateSymbol,
    dateSymbolMatch,
    dateTyped,
    dateYearBounds,
    editingLeafId,
    editingValueChipKey,
    enterValueMode,
    excludeMode,
    exitValueMode,
    findRecordByLabel,
    finishValueMode,
    finishWithPatch,
    followPeriodOf,
    handleChange,
    handleDatePickerChange,
    handleKeyDown,
    hasOptionIntent,
    highlightedKey,
    highlightedOption,
    highlightedValueChipKey,
    inlineValueOptions,
    inputValue,
    isBooleanColumn,
    isChipMode,
    isKnownLabel,
    isOptionMode,
    knownRecordsRef,
    latestRef,
    listUncheckedOptions,
    mode,
    multiParts,
    optionClass,
    optionDismissed,
    optionNavigated,
    pickBooleanValue,
    pickListValue,
    pickRecord,
    pickSetOperator,
    relationCheckedRecords,
    relationSearch,
    relationUncheckedOptions,
    removeValueChip,
    resolveRelationLabels,
    resolveSegments,
    reuiDateI18n,
    reuiDateValue,
    searchText,
    selectedRecords,
    setCheckedValues,
    setDateChips,
    setDatePickerValue,
    setEditingLeafId,
    setEditingValueChipKey,
    setHighlightedKey,
    setHighlightedValueChipKey,
    setInputValue,
    setOptionDismissed,
    setOptionNavigated,
    setOptions,
    setSelectedRecords,
    setTextChips,
    setValueColumn,
    setValueError,
    setWidgetFocus,
    showHint,
    showRelationResults,
    showValueList,
    skipFocusOpenRef,
    startEditValueChip,
    textChips,
    valueChips,
    valueColumn,
    valueError,
    valueLegendCtx,
    valueVisibleKeys,
    visibleValueChips,
    vmode,
    widgetFocus,
    widgetPointerRef,
  };
}
