import { Command, CommandEmpty, CommandItem, CommandList } from "./ui/command";
import {
  DIFF_ADDED,
  DIFF_HIGHLIGHT,
  DIFF_REMOVED,
  DIFF_REMOVED_TEXT,
} from "@/lib/diffUtils";
import { Popover, PopoverContent, PopoverTrigger } from "./ui/popover";
import { Tooltip, TooltipContent, TooltipTrigger } from "./ui/tooltip";
import { cn, isNullOrWhitespace } from "@/lib/utils";
import {
  forwardRef,
  memo,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import { Button } from "./ui/button";
import { Checkbox } from "./ui/checkbox";
import ClickAwayListener from "react-click-away-listener";
import { Input } from "./ui/input";
import { XIcon } from "lucide-react";
import useDidMountEffect from "@/Hooks/useDidMountEffect";
import { useLaravelReactI18n } from "laravel-react-i18n";

const ALL_OPTION_VALUE = "__multiselect_all__";

const escapeRegExp = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/**
 * MultiSelect — varian multi-pilih dari Select, dengan kontrak option yang sama.
 *
 * Normalisasi option (selaras Select):
 *   - { value, label }                 → pakai apa adanya
 *   - { value, titleTrans }            → label = t(titleTrans)
 *   - optionTrans + nilai mentah       → label = t(`${optionTrans}.${value}`)
 *   - nilai mentah (string/number)     → label = value
 *
 * Props:
 *   value          : array nilai terpilih
 *   onValueChange  : (array) => void
 *   valueBefore    : array nilai SEBELUM perubahan (opsional, pola sama
 *                    Select.jsx/LinkModel.jsx) -- kalau diisi & beda dari
 *                    `value`, border di-highlight (`DIFF_HIGHLIGHT`) & tooltip
 *                    (Radix, muncul saat hover popover tertutup) menandai
 *                    tiap entry yang ditambah/dihapus
 *                    (`DIFF_ADDED`/`DIFF_REMOVED`), bukan cuma satu baris
 *                    before/after spt varian single-value.
 *   options        : array option (bentuk apa pun di atas)
 *   optionTrans    : prefix lang key untuk label (mis. "status")
 *   onSearchChange : (string) => void — opsional
 *   showAllOption  : tampilkan baris "All"/"Semua" di atas daftar option --
 *                    check -> select semua option, uncheck -> kosongkan semua,
 *                    sebagian terpilih -> checkbox jadi indeterminate. Hanya
 *                    tampil saat TIDAK sedang searching (select-all mengacu ke
 *                    seluruh option, bukan hasil filter, jadi disembunyikan
 *                    dulu daripada ambigu).
 *   allOptionLabel : label kustom baris All (default t("core.form.all")) --
 *                    dipakai utk RINGKASAN saat popover TERTUTUP (placeholder
 *                    fallback), bukan utk teks yang lagi diedit (lihat
 *                    `delimiters` di bawah -- teks yg diedit SELALU daftar
 *                    literal, gak pernah "diciutkan" jadi label All).
 *   defaultValue   : array atau nilai tunggal -- dipakai sebagai value efektif
 *                    kapan pun prop `value` null/undefined, supaya komponen
 *                    TIDAK PERNAH resolve ke value kosong/null begitu saja
 *                    (mis. filter yang harus selalu punya default terisi).
 *   changeOnBlur   : default false (preserve perilaku lama -- tiap toggle
 *                    langsung panggil onValueChange). true -> checkbox tetap
 *                    update REALTIME secara visual (state lokal `values`),
 *                    tapi `onValueChange` ke parent baru dipanggil SEKALI saat
 *                    popover ditutup (blur/klik-luar/Escape) DAN value-nya
 *                    benar memang berubah sejak dibuka -- mencegah request
 *                    beruntun tiap 1 klik utk consumer yang side-effect-nya
 *                    mahal (mis. fetch server per filter). Tombol clear (X)
 *                    SELALU langsung trigger onValueChange terlepas dari prop
 *                    ini -- itu aksi eksplisit tunggal, bukan bagian rentetan
 *                    toggle yang perlu di-batch.
 *   delimiters     : string atau array string, default [","]. Input punya DUA
 *                    MODE:
 *                      - Popover TERTUTUP -> isi Input = RINGKASAN value
 *                        terpilih (join label, atau label All kalau semua
 *                        kecheck & `showAllOption` aktif -- sama seperti
 *                        `labelOfValues`). Ini murni tampilan, bukan buffer
 *                        yang diedit.
 *                      - Popover TERBUKA ("mode edit") -> Input jadi buffer
 *                        ketikan TRANSIEN, mulai KOSONG tiap dibuka (ringkasan
 *                        di atas TIDAK ikut disuntikkan ke buffer edit). Ketik
 *                        label yg PERSIS cocok (case-insensitive, trimmed)
 *                        lalu delimiter -> option ke-check DAN input langsung
 *                        dikosongkan lagi, siap ketik entry berikutnya (utk
 *                        uncheck, klik checkbox-nya langsung, bukan lewat
 *                        edit teks). Blur/Tab-pindah-fokus juga commit entry
 *                        yang lagi diketik kalau match; sisa teks yg tetap
 *                        gak cocok apapun dibuang -- baik match maupun tidak,
 *                        input akan kembali ke mode "ringkasan" begitu
 *                        popover tertutup. Paste teks berisi BEBERAPA entry
 *                        sekaligus (mis. "Demo Warehouse, Warehouse Utama")
 *                        tetap didukung -- semua entry yang match langsung
 *                        ke-check begitu di-paste (gak perlu delimiter di
 *                        ujung teks paste-nya).
 */
const MultiSelect = memo(
  forwardRef(function MultiSelect(
    {
      id,
      value,
      valueBefore,
      onValueChange,
      className,
      disabled,
      readOnly,
      onKeyDown,
      onSearchChange,
      required,
      placeholder,
      optionTrans,
      options: _options,
      showAllOption = false,
      allOptionLabel,
      defaultValue,
      changeOnBlur = false,
      delimiters,
    },
    ref,
  ) {
    const { t } = useLaravelReactI18n();
    const [open, setOpen] = useState(false);
    const [isDirty, setIsDirty] = useState(false);

    // defaultValue boleh array atau nilai tunggal -- selalu dinormalisasi ke
    // array agar konsisten dgn bentuk `value`.
    const normalizedDefaultValue = useMemo(() => {
      if (defaultValue === undefined) return undefined;
      return Array.isArray(defaultValue) ? defaultValue : [defaultValue];
    }, [defaultValue]);
    const resolveValue = useCallback(
      (v) => v ?? normalizedDefaultValue ?? [],
      [normalizedDefaultValue],
    );

    // Normalisasi option identik dengan Select.
    const oriOptions = useMemo(() => {
      return (
        _options
          ?.filter((x) => x)
          ?.map((x) => {
            const label =
              typeof x === "object" && x.label
                ? x.label
                : x.titleTrans
                  ? t(x.titleTrans)
                  : optionTrans
                    ? t(`${optionTrans}.${x.value ?? x}`)
                    : (x.value ?? x);
            const optValue = typeof x === "object" ? x.value : x;
            return { label, value: optValue };
          }) ?? []
      );
    }, [_options, optionTrans, t]);

    // delimiters boleh string tunggal atau array -- selalu dinormalisasi ke
    // array (konsisten dgn pola defaultValue di atas).
    const normalizedDelimiters = useMemo(() => {
      const raw = delimiters === undefined ? [","] : delimiters;
      return (Array.isArray(raw) ? raw : [raw]).filter(Boolean);
    }, [delimiters]);
    const delimiterRegex = useMemo(() => {
      if (normalizedDelimiters.length === 0) return null;
      return new RegExp(normalizedDelimiters.map(escapeRegExp).join("|"));
    }, [normalizedDelimiters]);

    const allValues = useMemo(
      () => oriOptions.map((opt) => opt.value),
      [oriOptions],
    );

    // Ringkasan label option terpilih -- dipakai sbg ISI Input saat popover
    // TERTUTUP (lihat efek [open] di bawah), bukan cuma placeholder fallback.
    // Saat All aktif & semua option terpilih, tampilkan label All (bukan
    // daftar seluruh label satu-satu -- bisa sangat panjang).
    const labelOfValues = useCallback(
      (vals) => {
        if (
          showAllOption &&
          allValues.length > 0 &&
          allValues.every((v) => (vals ?? []).includes(v))
        ) {
          return allOptionLabel ?? t("core.form.all");
        }
        return oriOptions
          .filter((opt) => (vals ?? []).includes(opt.value))
          .map((opt) => opt.label)
          .join(", ");
      },
      [oriOptions, showAllOption, allOptionLabel, allValues, t],
    );

    // search PUNYA DUA MODE: popover TERTUTUP -> ringkasan (`labelOfValues`,
    // sama kayak dulu, termasuk diciutkan jadi "All" kalau semua kecheck);
    // popover TERBUKA ("mode edit") -> buffer ketikan transien, mulai kosong
    // tiap dibuka (lihat efek [open] di bawah). Init via labelOfValues supaya
    // render pertama (closed state) langsung benar, gak nunggu efek jalan.
    const initialValues = resolveValue(value);
    const [values, _setValues] = useState(() => initialValues);
    const [search, setSearch] = useState(() => labelOfValues(initialValues));
    const commandRef = useRef(null);
    const popoverRef = useRef(null);

    // Sinkronkan values dari prop bila berubah dari luar. defaultValue jadi
    // fallback kapan pun `value` null/undefined -- lihat dok prop di atas.
    // Search TIDAK ikut disentuh di sini -- ringkasannya di-refresh lewat
    // efek [open] begitu popover berikutnya ditutup/dibuka.
    useDidMountEffect(() => {
      _setValues(resolveValue(value));
    }, [value, resolveValue]);

    // Snapshot awal `search` (baris 208) dihitung sinkron pas mount -- kalau
    // translasi (`t()`) belum kepasang di render pertama (chunk locale
    // dimuat async terpisah), hasilnya raw key mentah, bukan label, dan
    // ke-freeze permanen krn tidak ada efek lain yg nge-refresh selain
    // toggle buka/tutup popover. Efek ini nyusul refresh begitu label opsi
    // BERUBAH (oriOptions, termasuk saat translasi baru kepasang) -- guard
    // `open` biar gak nimpa buffer ketikan yg lagi aktif diedit.
    useEffect(() => {
      if (open) return;
      setSearch(labelOfValues(values));
    }, [oriOptions]);

    // Update state lokal SAJA -- tidak notify parent. Dipakai toggle per-item
    // saat changeOnBlur aktif (checkbox tetap realtime visual, onValueChange
    // ditunda ke efek close-popover di bawah).
    const setValuesLocalOnly = useCallback((updater) => {
      _setValues((prev) =>
        typeof updater === "function" ? updater(prev ?? []) : updater,
      );
    }, []);

    const setValues = useCallback(
      (updater) => {
        if (changeOnBlur) {
          setValuesLocalOnly(updater);
          return;
        }
        _setValues((prev) => {
          const next =
            typeof updater === "function" ? updater(prev ?? []) : updater;
          onValueChange?.(next);
          return next;
        });
      },
      [onValueChange, changeOnBlur, setValuesLocalOnly],
    );

    const isAllSelected =
      allValues.length > 0 &&
      allValues.every((v) => (values ?? []).includes(v));
    const isSomeSelected =
      !isAllSelected && (values ?? []).some((v) => allValues.includes(v));
    const allCheckedState = isAllSelected
      ? true
      : isSomeSelected
        ? "indeterminate"
        : false;

    // Pecah teks mentah jadi { completeSegments, inProgressSegment }.
    // completeSegments = semua entry yg SUDAH diakhiri delimiter (siap
    // dicocokkan). inProgressSegment = sisa teks setelah delimiter TERAKHIR
    // (belum diakhiri delimiter -- ini juga dipakai sbg query pencarian
    // dropdown). Kalau teks berakhir dgn delimiter, tidak ada yg in-progress.
    const analyzeText = useCallback(
      (text) => {
        const raw = text ?? "";
        const rawSegments = delimiterRegex ? raw.split(delimiterRegex) : [raw];
        const endsWithDelimiter = normalizedDelimiters.some(
          (d) => d && raw.endsWith(d),
        );
        const completeRaw = endsWithDelimiter
          ? rawSegments
          : rawSegments.slice(0, -1);
        const inProgressRaw = endsWithDelimiter
          ? ""
          : (rawSegments[rawSegments.length - 1] ?? "");
        return {
          completeSegments: completeRaw.map((s) => s.trim()).filter(Boolean),
          inProgressSegment: inProgressRaw.trim(),
        };
      },
      [delimiterRegex, normalizedDelimiters],
    );

    const sameSet = useCallback((a, b) => {
      if ((a?.length ?? 0) !== (b?.length ?? 0)) return false;
      const setA = new Set(a ?? []);
      return (b ?? []).every((x) => setA.has(x));
    }, []);

    // Baris tooltip (Radix) saat popover tertutup -- SELALU daftar per-item
    // (bukan satu string gabungan), biar gampang dibaca utk value banyak.
    // Kalau `valueBefore` diisi & memang beda dari `values` saat ini, tiap
    // baris ditandai status "added"/"removed" (dibanding satu baris
    // before/after spt Select.jsx/LinkModel.jsx -- masuk akal di sana krn
    // single-value, tapi kurang informatif kalau diterapkan mentah2 ke array).
    const tooltipRows = useMemo(() => {
      const currentRows = (values ?? []).map((v) => ({
        key: `${v}`,
        label: oriOptions.find((opt) => opt.value === v)?.label ?? v,
        status: undefined,
      }));
      if (valueBefore === undefined) return currentRows;

      const beforeArr = Array.isArray(valueBefore)
        ? valueBefore
        : (valueBefore ?? []);
      if (sameSet(beforeArr, values ?? [])) return currentRows;

      const beforeSet = new Set(beforeArr);
      const afterSet = new Set(values ?? []);
      const addedMarked = currentRows.map((row, i) =>
        beforeSet.has(values[i]) ? row : { ...row, status: "added" },
      );
      const removedRows = beforeArr
        .filter((v) => !afterSet.has(v))
        .map((v) => ({
          key: `removed-${v}`,
          label: oriOptions.find((opt) => opt.value === v)?.label ?? v,
          status: "removed",
        }));
      return [...addedMarked, ...removedRows];
    }, [values, valueBefore, oriOptions, sameSet]);
    const hasDiffChange = tooltipRows.some((row) => row.status);

    // Cari segmen teks yg match persis label option, lalu CHECK yg belum
    // ke-check -- TIDAK PERNAH uncheck (beda dari desain lama). Entry
    // "complete" (diakhiri delimiter) selalu diproses; entry in-progress
    // (belum diakhiri delimiter) cuma kalau includeInProgress true --
    // dipakai saat blur/close/paste, bukan saat masih ngetik biasa. Segmen
    // yg persis match label baris All (`showAllOption` aktif) select SEMUA
    // option -- konsisten sama Tab-fill All (lihat onKeyDown Command).
    const commitMatchingSegments = useCallback(
      (text, prevValues, { includeInProgress = false } = {}) => {
        const { completeSegments, inProgressSegment } = analyzeText(text);
        const toCommit = includeInProgress
          ? [...completeSegments, inProgressSegment].filter(Boolean)
          : completeSegments;
        const allLabel = showAllOption
          ? (allOptionLabel ?? t("core.form.all"))
              ?.toString()
              .trim()
              .toLowerCase()
          : null;

        let next = prevValues ?? [];
        for (const seg of toCommit) {
          const segLower = seg.toLowerCase();
          if (allLabel && segLower === allLabel) {
            for (const v of allValues) {
              if (!next.includes(v)) next = [...next, v];
            }
            continue;
          }
          const match = oriOptions.find(
            (opt) => opt.label?.toString().trim().toLowerCase() === segLower,
          );
          if (match && !next.includes(match.value)) {
            next = [...next, match.value];
          }
        }
        return next;
      },
      [analyzeText, oriOptions, showAllOption, allOptionLabel, t, allValues],
    );

    // Toggle murni -- klik checkbox TIDAK menyentuh search/isDirty, biar
    // user bisa lanjut nyari/filter setelah centang 1 opsi (search dibiarkan
    // apa adanya, bukan diregenerasi jadi daftar value terpilih).
    const toggleAll = useCallback(() => {
      const allSelected =
        allValues.length > 0 &&
        allValues.every((v) => (values ?? []).includes(v));
      setValues(allSelected ? [] : allValues);
    }, [allValues, values, setValues]);

    const toggleValue = useCallback(
      (val) => {
        const included = (values ?? []).includes(val);
        const next = included
          ? (values ?? []).filter((x) => x !== val)
          : [...(values ?? []), val];
        setValues(next);
      },
      [values, setValues],
    );

    // Teks in-progress (setelah delimiter terakhir) dipakai sbg query filter
    // dropdown & utk highlight -- BUKAN seluruh `search` (yg bisa berisi
    // banyak entry sudah ter-commit).
    const { inProgressSegment } = useMemo(
      () => analyzeText(search),
      [search, analyzeText],
    );
    const isFiltering = Boolean(inProgressSegment) && isDirty;
    const options = useMemo(() => {
      if (!isFiltering) return oriOptions;
      const q = inProgressSegment.toLowerCase();
      return oriOptions.filter((opt) =>
        opt.label?.toString().toLowerCase().includes(q),
      );
    }, [oriOptions, inProgressSegment, isFiltering]);
    // All row cuma tampil saat TIDAK searching -- select-all mengacu ke
    // seluruh option, ambigu kalau ditampilkan bareng hasil filter parsial.
    const showAllRow = showAllOption && !isFiltering && oriOptions.length > 0;

    // cmdk kontrol via `value`/`onValueChange` sendiri (bukan diserahkan ke
    // auto-highlight bawaan cmdk) -- ketauan lewat testing: auto-highlight
    // cmdk cuma jalan SEKALI saat mount/registrasi item pertama, TIDAK
    // otomatis pindah ke item lain kalau item yg lagi ke-highlight hilang
    // dari DOM krn filtering kita (`options` conditional render, bukan
    // filtering internal cmdk -- shouldFilter={false}). Tanpa ini, ketik
    // teks yg mempersempit hasil bisa bikin TIDAK ADA item ke-highlight
    // sama sekali, Tab-commit jadi no-op walau hasil filter cuma 1 opsi.
    const [highlightedValue, setHighlightedValue] = useState();
    const visibleValues = useMemo(() => {
      const vals = options.map((opt) => `${opt.value}`);
      return showAllRow ? [ALL_OPTION_VALUE, ...vals] : vals;
    }, [options, showAllRow]);
    useEffect(() => {
      if (!visibleValues.includes(highlightedValue)) {
        setHighlightedValue(visibleValues[0]);
      }
    }, [visibleValues]);

    // Snapshot values pas popover dibuka -- dipakai efek close di bawah utk
    // tau apakah benar ada perubahan sejak dibuka (changeOnBlur). Efek ini
    // aman jalan di mount jg (branch close: search awal = labelOfValues(nilai
    // awal), commitMatchingSegments gak nemu segmen match apapun di teks
    // ringkasan itu -> values gak berubah, cuma teks di-set ulang ke
    // ringkasan yg sama -- tidak seperti desain lama yg bisa keliru
    // menghapus value awal).
    const openSnapshotRef = useRef(values);

    useEffect(() => {
      if (open) {
        // Buka = mulai "mode edit" -- kosongkan buffer ketikan (ringkasan yg
        // lagi tampil BUKAN teks yg dimaksud diedit lewat delimiter/paste,
        // beda dari desain lama yg langsung nyuntik ringkasan ke buffer edit).
        openSnapshotRef.current = values;
        setIsDirty(false);
        setSearch("");
        onSearchChange?.("");
        return;
      }
      // Tutup: commit sisa entry yg lagi diketik (kalau match), lalu isi
      // input dgn RINGKASAN value final (sama kayak sebelum fitur delimiter
      // ada -- join label, atau label All kalau semua kecheck).
      const finalValues = commitMatchingSegments(search, values, {
        includeInProgress: true,
      });
      if (!sameSet(finalValues, values)) {
        setValues(finalValues);
      }
      setSearch(labelOfValues(finalValues));
      setIsDirty(false);
      onSearchChange?.("");

      if (changeOnBlur) {
        const before = openSnapshotRef.current ?? [];
        if (!sameSet(before, finalValues)) {
          onValueChange?.(finalValues);
        }
      }
    }, [open]);

    const onInputKeyDown = useCallback(
      (e) => {
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
        setIsDirty(true);
        if (!open) setOpen(true);
      },
      [open, readOnly, disabled, onKeyDown],
    );

    // Highlight tanpa dangerouslySetInnerHTML: pecah label jadi array React node
    // (teks biasa + <mark> untuk bagian yang cocok). React meng-escape otomatis,
    // sehingga aman dari XSS meski label/search berisi karakter HTML.
    const highlightItem = useCallback((item, search) => {
      const text = `${item ?? ""}`;
      const searchWords =
        search
          ?.split(/\s+/)
          ?.map((s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
          .filter((x) => !isNullOrWhitespace(x)) || [];
      if (searchWords.length < 1) return text;
      const splitRegex = new RegExp(`(${searchWords.join("|")})`, "gi");
      const matchRegex = new RegExp(`^(?:${searchWords.join("|")})$`, "i");
      return text
        .split(splitRegex)
        .filter((part) => part !== "")
        .map((part, i) =>
          matchRegex.test(part) ? (
            <mark key={i} className="bg-yellow-500">
              {part}
            </mark>
          ) : (
            part
          ),
        );
    }, []);

    return (
      <ClickAwayListener onClickAway={() => setOpen(false)}>
        <div className={cn("w-full", className)}>
          <Popover open={open} onOpenChange={() => {}}>
            <Command
              ref={commandRef}
              className="relative h-full overflow-visible bg-transparent"
              loop
              shouldFilter={false}
              value={highlightedValue}
              onValueChange={setHighlightedValue}
              onKeyDown={(e) => {
                const val = highlightedValue;
                if (!val) return;
                if (e.key === "Enter") {
                  // Enter LANGSUNG commit option yg lagi di-highlight (arrow
                  // key -- BUKAN hover mouse). preventDefault biar gak
                  // nge-submit form pembungkus.
                  e.preventDefault();
                  e.stopPropagation();
                  if (val === ALL_OPTION_VALUE) {
                    toggleAll();
                  } else {
                    const matched = oriOptions.find(
                      (opt) => `${opt.value}` === val,
                    );
                    if (matched) toggleValue(matched.value);
                  }
                  setSearch("");
                  setIsDirty(false);
                  return;
                }
                if (e.key === "Tab") {
                  // Tab TIDAK langsung check -- cuma "autocomplete" nulis
                  // label opsi yg lagi di-highlight ke buffer edit, sama kayak
                  // ngetik manual. Commit beneran nunggu delimiter berikutnya
                  // atau blur (lihat commitMatchingSegments, yg jg dipanggil
                  // dari onChange & efek [open] close). Label baris All
                  // (allOptionLabel/"All") jg didukung sbg teks yg di-match
                  // saat commit. isDirty HANYA di-preventDefault (fokus
                  // terkunci di input) kalau SUDAH dirty sebelum Tab ini --
                  // kalau tidak, fokus pindah keluar spt biasa, yg otomatis
                  // trigger blur -> commit teks yg baru ditulis (bukan bikin
                  // fitur "jangan langsung check" ini gagal).
                  if (isDirty) e.preventDefault();
                  const label =
                    val === ALL_OPTION_VALUE
                      ? (allOptionLabel ?? t("core.form.all"))
                      : oriOptions.find((opt) => `${opt.value}` === val)?.label;
                  if (label != null) {
                    setSearch(`${label}`);
                    setIsDirty(true);
                  }
                }
              }}
            >
              <Tooltip>
                <TooltipTrigger asChild>
                  <PopoverTrigger
                    asChild
                    className={cn(
                      "flex h-8 items-center overflow-hidden border rounded-md cursor-default group/model relative focus-within:border-0 border-input ring-offset-background bg-muted focus-within:outline-none focus-within:ring-1 focus-within:ring-ring focus-within:ring-offset-1",
                      valueBefore !== undefined &&
                        hasDiffChange &&
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
                          if (!open) setOpen(true);
                        }}
                        required={required}
                        value={search}
                        onChange={(e) => {
                          const nextValue = e.target.value;
                          onSearchChange?.(nextValue);
                          // Ketik delimiter = "selesai" utk entry ini -> commit
                          // (kalau match) & kosongkan lagi input siap utk entry
                          // berikutnya (bukan disimpan sbg representasi teks
                          // permanen -- lihat dok prop `delimiters`).
                          const endsWithDelimiter = normalizedDelimiters.some(
                            (d) => d && nextValue.endsWith(d),
                          );
                          if (endsWithDelimiter) {
                            const nextValues = commitMatchingSegments(
                              nextValue,
                              values,
                            );
                            if (!sameSet(nextValues, values)) {
                              setValues(nextValues);
                            }
                            setSearch("");
                            setIsDirty(false);
                            return;
                          }
                          setIsDirty(true);
                          setSearch(nextValue);
                        }}
                        onPaste={(e) => {
                          // Paste teks berisi >1 entry (mis. "Demo Warehouse,
                          // Warehouse Utama") langsung di-commit SEMUA yg match
                          // walau entry terakhir gak diakhiri delimiter -- beda
                          // dari ngetik manual (yg nunggu delimiter/blur dulu utk
                          // entry terakhir), krn paste itu aksi sekali-jadi, bukan
                          // "lagi diketik". Paste 1 entry biasa (tanpa delimiter
                          // sama sekali) dibiarkan lewat jalur onChange normal.
                          if (readOnly || disabled) return;
                          const pasted = e.clipboardData?.getData("text") ?? "";
                          if (!delimiterRegex?.test(pasted)) return;
                          e.preventDefault();
                          const el = e.target;
                          const before = search.slice(
                            0,
                            el.selectionStart ?? search.length,
                          );
                          const after = search.slice(
                            el.selectionEnd ?? search.length,
                          );
                          const combined = `${before}${pasted}${after}`;
                          const nextValues = commitMatchingSegments(
                            combined,
                            values,
                            { includeInProgress: true },
                          );
                          if (!sameSet(nextValues, values)) {
                            setValues(nextValues);
                          }
                          setSearch("");
                          setIsDirty(false);
                          onSearchChange?.("");
                        }}
                        onBlur={() => {
                          // Logika commit+rebuild teks ada di efek [open] di atas
                          // (satu sumber kebenaran utk semua jalur tutup --
                          // blur, klik-luar via ClickAwayListener, dst).
                          setOpen(false);
                        }}
                        className={cn(
                          "focus:border-0! bg-inherit! disabled:opacity-100! h-8 w-full rounded-none! pr-2! border-0! focus-visible:ring-0! focus-visible:ring-offset-0!",
                        )}
                        placeholder={
                          placeholder ??
                          (values?.length ? labelOfValues(values) : "")
                        }
                      />
                      <div className="flex items-center h-8 pr-2 gap-x-2">
                        {/* Terbuka: selalu tampil kalau ada value (umpan balik
                        realtime, gak berubah). Tertutup: tampil jg (quick-
                        glance count) KECUALI ringkasan teks udah diciutkan
                        jadi label All (showAllOption + semua ke-check) --
                        badge angka jadi redundan di samping teks "All". */}
                        {values?.length > 0 &&
                          (open || !(showAllOption && isAllSelected)) && (
                            <span className="badge secondary text-xs px-1.5 py-0 h-5 min-w-5 justify-center">
                              {values.length}
                            </span>
                          )}
                        {!(readOnly || disabled) && (
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className={cn(
                              "size-6",
                              (!(values?.length || search) ||
                                disabled ||
                                readOnly) &&
                                "hidden",
                            )}
                            onClick={() => {
                              // Selalu commit langsung -- aksi eksplisit tunggal,
                              // bukan bagian rentetan toggle yang perlu di-batch
                              // walau changeOnBlur aktif.
                              setValuesLocalOnly([]);
                              onValueChange?.([]);
                              setSearch("");
                              onSearchChange?.("");
                            }}
                          >
                            <XIcon className="size-3" />
                          </Button>
                        )}
                      </div>
                    </div>
                  </PopoverTrigger>
                </TooltipTrigger>
                {!open && tooltipRows.length > 0 && (
                  <TooltipContent side="top" align="start" className="max-w-xs">
                    <ul className="space-y-0.5">
                      {tooltipRows.map((row) => (
                        <li
                          key={row.key}
                          className={cn(
                            "rounded px-1 truncate",
                            row.status === "added" && DIFF_ADDED,
                            row.status === "removed" &&
                              cn(DIFF_REMOVED, DIFF_REMOVED_TEXT),
                          )}
                        >
                          {row.label}
                        </li>
                      ))}
                    </ul>
                  </TooltipContent>
                )}
              </Tooltip>
              {!(disabled || readOnly) && (
                <PopoverContent
                  onOpenAutoFocus={(e) => e.preventDefault()}
                  ref={popoverRef}
                  align="start"
                  side="bottom"
                  className="relative z-50 w-auto min-w-(--radix-popover-trigger-width) p-0"
                  forceMount
                  asChild
                >
                  <CommandList
                    className="p-1 space-y-2"
                    // Cegah browser memindah/menghapus fokus dari Input saat
                    // area ini di-mousedown (klik checkbox dsb) -- TANPA ini,
                    // tiap klik checkbox bikin Input blur, yang sekarang
                    // punya efek samping nyata (onBlur: tutup popover via
                    // efek [open]) -- popover bakal langsung nutup abis 1
                    // klik, merusak alur multi-pilih. mousedown preventDefault
                    // TIDAK mencegah event click itu sendiri, jadi
                    // onSelect/onCheckedChange tetap jalan normal.
                    onMouseDown={(e) => e.preventDefault()}
                  >
                    <CommandEmpty>{t("core.form.not_found")}</CommandEmpty>
                    {showAllRow && (
                      <CommandItem
                        value={ALL_OPTION_VALUE}
                        onSelect={toggleAll}
                        asChild
                      >
                        {/* DIV, bukan <label htmlFor>: label+for ke Checkbox bikin
                            browser dispatch klik sintetis TERPISAH ke Checkbox saat
                            label diklik (native label-forwarding), yang lalu
                            bubble lagi ke sini -> CommandItem.onSelect terpanggil
                            DUA KALI per satu klik user (net jadi no-op). Checkbox
                            murni presentational (checked controlled, tanpa
                            handler-nya sendiri), aria-label gantikan asosiasi label. */}
                        <div className="flex items-center space-x-2 border-b pb-1.5 mb-1 border-muted-foreground/25">
                          <Checkbox
                            checked={allCheckedState}
                            tabIndex={-1}
                            aria-label={allOptionLabel ?? t("core.form.all")}
                          />
                          <span className="flex-1 text-sm font-medium leading-none">
                            {allOptionLabel ?? t("core.form.all")}
                          </span>
                        </div>
                      </CommandItem>
                    )}
                    {options?.map((opt) => (
                      <CommandItem
                        key={opt.value}
                        value={`${opt.value}`}
                        onSelect={() => toggleValue(opt.value)}
                        asChild
                      >
                        {/* DIV, bukan <label htmlFor> -- lihat komentar di baris
                            "All" di atas, alasan sama persis. */}
                        <div className="flex items-center space-x-2">
                          <Checkbox
                            checked={values?.includes(opt.value)}
                            tabIndex={-1}
                            aria-label={
                              typeof opt.label === "string"
                                ? opt.label
                                : undefined
                            }
                          />
                          <span className="flex-1 text-sm font-medium leading-none">
                            {/* Gate isDirty -- highlight cuma relevan saat
                                user BENERAN lagi ngetik/nyari (samain dgn
                                isFiltering yg jg pakai isDirty). */}
                            {highlightItem(
                              opt.label,
                              isDirty ? (inProgressSegment ?? "") : "",
                            )}
                          </span>
                        </div>
                      </CommandItem>
                    ))}
                  </CommandList>
                </PopoverContent>
              )}
            </Command>
          </Popover>
        </div>
      </ClickAwayListener>
    );
  }),
);

export default MultiSelect;
