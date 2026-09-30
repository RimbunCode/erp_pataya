import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/Components/ui/popover";
import {
  forwardRef,
  memo,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import { Button } from "@/Components/ui/button";
import { DateSelector as ReuiDateSelector } from "@/Components/ui/date-selector";
import { Input } from "@/Components/ui/input";
import { CalendarIcon, XIcon } from "lucide-react";
import { cn, getLocaleDate, mergeRefs } from "@/lib/utils";
import { format } from "date-fns";
import {
  OPERATOR_SYMBOLS,
  buildBetweenPeriodValue,
  buildPeriodI18nLabels,
  buildReuiDateI18n,
  hasPeriodSelection,
  parseLocalDate,
  parsePeriodToken,
  toLocalDateValue,
} from "./periodParsing";
import {
  MAX_DATE_VALUES,
  cleanPeriodValue,
  mergeDatePeriods,
  parseDatePeriod,
  parseMultiValueText,
  periodValueToText,
} from "../Search/columnSearch";
import { useLaravelReactI18n } from "laravel-react-i18n";
import { usePage } from "@inertiajs/react";

/**
 * DateSelector (wrapper) — value field untuk operator in_period / !in_period
 * pada kolom date & datetime.
 *
 * UX: TextInput ringkas (menampilkan ringkasan teks i18n, mendukung ketik-parse)
 * → klik membuka Popover berisi panel reui (Components/ui/date-selector).
 *
 * Shape value (selaras backend FilterEvaluator::applyPeriod):
 *   { period, operator, startDate?, endDate?, year?, month?, quarter?,
 *     halfYear?, rangeStart?, rangeEnd? }
 *   operator: is | after | on-or-after | before | on-or-before | between
 *   period  : day | month | quarter | half-year | year
 *   Date diserialisasi ke ISO string (filter tree disimpan JSON).
 *
 * Revisi 16 -- BANYAK nilai "Pada" (maks 20): `value` boleh berupa DAFTAR objek
 * periode `is` (widget `allowMultiple`, atau ketik `a | b` / `a; b` gaya
 * Search Bar). Satu pilihan tetap dikirim sbg objek tunggal; daftar hanya utk
 * >= 2 pilihan. Nilai daftar/`is` disimpan sbg string tanggal LOKAL.
 *
 * Props rentang tahun diteruskan ke panel reui:
 *   yearRange — jumlah/span tahun (lihat ui/date-selector)
 *   baseYear  — tahun pusat daftar (default: tahun ini)
 *   minYear   — batas bawah (default 1975)
 *   maxYear   — batas atas (default tahun ini)
 */

// ISO string → Date.
const toDate = (v) => {
  if (!v) return undefined;
  if (v instanceof Date) return v;
  const d = new Date(v);
  return isNaN(d.getTime()) ? undefined : d;
};

// Date → ISO string.
const toISO = (v) => (v instanceof Date ? v.toISOString() : (v ?? undefined));

// Value → daftar periode "Pada" utk pilihan multi widget: daftar apa adanya;
// objek `is` yg lengkap = satu pilihan; selain itu (Kondisi lain / kosong) null.
const asSelections = (v) => {
  if (Array.isArray(v)) return v;
  return v?.operator === "is" && hasPeriodSelection(v) ? [v] : null;
};

export default memo(
  forwardRef(function DateSelector(
    {
      type = "date",
      value,
      onValueChange,
      yearRange,
      baseYear,
      minYear,
      maxYear = new Date().getFullYear(),
      disabled,
      readOnly,
    },
    ref,
  ) {
    const { t } = useLaravelReactI18n();
    const lang = usePage().props.lang;
    const dateLocale = useMemo(() => getLocaleDate(lang), [lang]);
    const isDatetime = type === "datetime";
    const [open, setOpen] = useState(false);
    const inputRef = useRef(null);
    const _commandRef = useRef(null);

    // i18n labels untuk panel reui + display/parse ringkasan (revisi 6:
    // diekstrak ke `periodParsing.js`, dipakai bersama SearchBar).
    const i18nLabels = useMemo(
      () => buildPeriodI18nLabels({ t, dateLocale }),
      [t, dateLocale],
    );

    // Revisi 6: diekstrak ke `buildReuiDateI18n` (periodParsing.js), dipakai
    // bersama SearchBar (embed widget yg sama) supaya label i18n konsisten.
    const reuiI18n = useMemo(
      () => buildReuiDateI18n({ t, i18nLabels }),
      [t, i18nLabels],
    );

    // -- Display ringkasan -------------------------------------------------
    // `showTime` dimatikan untuk operator range (between) pada period=day —
    // batas range = seluruh hari, jam tak relevan di ringkasan.
    const formatPeriod = useCallback(
      (v, useEnd, showTime = true) => {
        const dateFmt =
          isDatetime && showTime ? "dd MMMM yyyy HH:mm" : "dd MMMM yyyy";
        switch (v.period) {
          case "day": {
            const d = toDate(useEnd ? v.endDate : v.startDate);
            return d ? format(d, dateFmt, { locale: dateLocale }) : "";
          }
          case "month": {
            const r = useEnd ? v.rangeEnd : v.rangeStart;
            const year = r?.year ?? v.year;
            const m = r?.value ?? v.month;
            return year != null && m != null
              ? `${i18nLabels.months[m]} ${year}`
              : "";
          }
          case "quarter": {
            const r = useEnd ? v.rangeEnd : v.rangeStart;
            const year = r?.year ?? v.year;
            const q = r?.value ?? v.quarter;
            return year != null && q != null
              ? `${i18nLabels.quarters[q]} ${year}`
              : "";
          }
          case "half-year": {
            const r = useEnd ? v.rangeEnd : v.rangeStart;
            const year = r?.year ?? v.year;
            const h = r?.value ?? v.halfYear;
            return year != null && h != null
              ? `${i18nLabels.halfYears[h]} ${year}`
              : "";
          }
          case "year": {
            const r = useEnd ? v.rangeEnd : v.rangeStart;
            const year = r?.year ?? v.year;
            return year != null ? `${year}` : "";
          }
          default:
            return "";
        }
      },
      [isDatetime, dateLocale, i18nLabels],
    );

    const formatSummary = useCallback(
      (v) => {
        // Daftar "Pada": `a | b | c` (round-trip dgn ketikan gaya Search Bar).
        if (Array.isArray(v)) {
          return v
            .map((p) => periodValueToText(p, i18nLabels.monthsShort))
            .join(" | ");
        }
        if (!v || !v.period || !v.operator) return "";
        if (v.operator === "between") {
          // Range belum lengkap (end belum dipilih) → tampilkan start - start
          // sebagai preview. Range hari → tanpa jam (batas = seluruh hari).
          const filled = completeRange(v);
          const a = formatPeriod(filled, false, false);
          const b = formatPeriod(filled, true, false);
          return a && b ? `${a} - ${b}` : a || b;
        }
        const label = i18nLabels.operators[v.operator] ?? "";
        const period = formatPeriod(v, false);
        return period ? `${label} ${period}`.trim() : "";
      },
      [formatPeriod, i18nLabels],
    );

    // -- Parsing input -----------------------------------------------------
    // Revisi 6: `parsePeriodToken` diekstrak ke `periodParsing.js` (dipakai
    // bersama SearchBar) -- panggil versi imported dgn param eksplisit,
    // bungkus jadi callback stabil-referensi via `useCallback` seperti semula.
    const parseToken = useCallback(
      (raw) => parsePeriodToken(raw, { isDatetime, dateLocale, i18nLabels }),
      [isDatetime, dateLocale, i18nLabels],
    );

    const parseSummary = useCallback(
      (text) => {
        let rest = text.trim();
        if (!rest) return null;

        // Deteksi prefix operator: simbol dulu, lalu teks i18n.
        let operator = "is";
        const sym = OPERATOR_SYMBOLS.find((s) => rest.startsWith(s.sym));
        if (sym) {
          operator = sym.op;
          rest = rest.slice(sym.sym.length).trim();
        } else {
          const entry = Object.entries(i18nLabels.operators).find(
            ([, label]) =>
              label && rest.toLowerCase().startsWith(label.toLowerCase()),
          );
          if (entry) {
            operator = entry[0];
            rest = rest.slice(entry[1].length).trim();
          }
        }

        // Range "a - b" → between (revisi 6: gabung token diekstrak ke
        // `buildBetweenPeriodValue`, dipakai bersama sintaks ketik SearchBar).
        const rangeParts = rest.split(/\s+-\s+/);
        if (rangeParts.length === 2) {
          const a = parseToken(rangeParts[0]);
          const b = parseToken(rangeParts[1]);
          const value = buildBetweenPeriodValue(a, b);
          if (value) return value;
        }

        const token = parseToken(rest);
        if (!token) return null;
        return { ...token, operator };
      },
      [i18nLabels, parseToken],
    );

    // -- Serialisasi & loop-guard -----------------------------------------
    const [initialValue] = useState(() => {
      if (!value) return undefined;
      if (Array.isArray(value)) return value;
      return {
        ...value,
        startDate: toDate(value.startDate),
        endDate: toDate(value.endDate),
      };
    });

    const lastEmitted = useRef(null);

    // Echo lokal nilai terakhir yang di-emit panel reui. Dipakai agar input
    // ringkasan ter-update SEKETIKA saat memilih di calendar — tanpa menunggu
    // round-trip prop `value` dari parent (yang bisa tertunda / tak memicu render).
    const [localValue, setLocalValue] = useState(initialValue ?? value);

    // Sinkronkan echo lokal saat prop value berubah dari luar (reset / reload ?fid=).
    const lastValueRef = useRef(JSON.stringify(value ?? null));
    useEffect(() => {
      const serialized = JSON.stringify(value ?? null);
      if (serialized !== lastValueRef.current) {
        lastValueRef.current = serialized;
        setLocalValue(value);
      }
    }, [value]);

    // Value untuk panel reui — diturunkan dari echo lokal terbaru (ISO→Date).
    // PopoverContent Radix meng-unmount isinya saat tertutup, jadi reui remount
    // tiap dibuka & hydrate ulang dari prop value. Memberi localValue (bukan
    // initialValue mount-once) memastikan pilihan terakhir tetap muncul saat
    // popover dibuka lagi. reui punya loop-guard JSON sendiri → aman.
    // Kondisi "Pada" (`is`) -> widget mode multi membaca `selections` (objek
    // `is` tunggal = satu pilihan); Kondisi lain -> nilai tunggal seperti semula.
    const reuiValue = useMemo(() => {
      if (!localValue) return undefined;
      const picked = asSelections(localValue);
      if (picked) {
        return {
          period: picked.at(-1)?.period ?? "day",
          operator: "is",
          selections: picked.map((p) => ({
            ...p,
            startDate: parseLocalDate(p.startDate),
          })),
        };
      }
      return {
        ...localValue,
        startDate: toDate(localValue.startDate),
        endDate: toDate(localValue.endDate),
      };
    }, [localValue]);

    // Periode -> nilai leaf: string tanggal LOKAL (kolom date membuang jam),
    // kunci periode saja (tanpa `selections`).
    const normalizePeriod = useCallback(
      (p) =>
        cleanPeriodValue({
          ...p,
          startDate: p.startDate
            ? toLocalDateValue(p.startDate, { isDatetime })
            : undefined,
          endDate: p.endDate
            ? toLocalDateValue(p.endDate, { isDatetime })
            : undefined,
        }),
      [isDatetime],
    );

    // Satu pilihan -> objek tunggal; >= 2 -> daftar (Revisi 16).
    const emitPeriods = useCallback(
      (periods) => {
        const payload =
          periods.length === 1
            ? normalizePeriod(periods[0])
            : periods.map(normalizePeriod);
        setLocalValue(payload);
        const serialized = JSON.stringify(payload);
        if (serialized === lastEmitted.current) return;
        lastEmitted.current = serialized;
        onValueChange?.(payload);
      },
      [normalizePeriod, onValueChange],
    );

    const emit = useCallback(
      (next) => {
        if (!next) {
          setLocalValue(null);
          if (lastEmitted.current !== null) {
            lastEmitted.current = null;
            onValueChange?.(null);
          }
          return;
        }
        // Kondisi "Pada" dgn pilihan multi widget -> nilai dari `selections`.
        if (
          next.operator === "is" &&
          Array.isArray(next.selections) &&
          next.selections.length > 0
        ) {
          emitPeriods(next.selections);
          return;
        }
        const payload = {
          period: next.period,
          operator: next.operator,
          year: next.year,
          month: next.month,
          quarter: next.quarter,
          halfYear: next.halfYear,
          rangeStart: next.rangeStart,
          rangeEnd: next.rangeEnd,
        };
        if (next.startDate) payload.startDate = toISO(toDate(next.startDate));
        if (next.endDate) payload.endDate = toISO(toDate(next.endDate));

        setLocalValue(payload);

        const serialized = JSON.stringify(payload);
        if (serialized === lastEmitted.current) return;
        lastEmitted.current = serialized;
        onValueChange?.(payload);
      },
      [onValueChange, emitPeriods],
    );

    // -- Input ringkasan ----------------------------------------------------
    // Display SELALU mengikuti `summary` (echo realtime dari pilihan calendar),
    // KECUALI saat user sedang mengetik manual (`editing`). `editing` hanya aktif
    // saat ada perubahan teks (onChange), BUKAN saat fokus — fokus dipakai untuk
    // membuka popover, dan tak boleh membekukan display ke draft basi.
    const summary = useMemo(
      () => formatSummary(localValue),
      [formatSummary, localValue],
    );
    const [draft, setDraft] = useState(summary);
    const [editing, setEditing] = useState(false);
    const displayText = editing ? draft : summary;

    // Ketikan gaya Search Bar (`a | b`, `a; b`) -> daftar periode; null bila
    // ada segmen tak terparse / melanggar aturan daftar (N "Pada" ATAU satu
    // nilai lain) / melebihi batas. Negasi lewat operator `!in_period`.
    const parseList = (raw) => {
      const { exclude, committed, pending } = parseMultiValueText(raw, {
        separators: "|;",
      });
      const texts = [...committed, pending]
        .map((part) => part.trim())
        .filter(Boolean);
      if (exclude || texts.length === 0) return null;
      const ctx = { isDatetime, dateLocale, i18nLabels };
      const periods = texts.map((part) => parseDatePeriod(part, ctx));
      if (periods.some((p) => !p)) return null;
      const merged = mergeDatePeriods([], periods, { max: MAX_DATE_VALUES });
      return merged.error ? null : merged.chips;
    };

    const commitDraft = (raw) => {
      if (/[|;]/.test(raw)) {
        const periods = parseList(raw);
        if (periods) emitPeriods(periods);
      } else {
        const parsed = parseSummary(raw);
        if (parsed) emit(parsed);
      }
      setEditing(false);
    };

    // Saat popover dibuka/ditutup, keluar mode edit agar display kembali ke
    // `summary` (live) dan tak ada commit draft basi yang menghapus pilihan.
    // Saat DITUTUP dengan range belum lengkap (between tanpa end), kunci end =
    // start agar value tetap valid (toRange = fromRange).
    const handleOpenChange = (next) => {
      // Jangan tutup popover saat input sedang focused — user sedang mengetik manual.
      if (!next && document.activeElement === inputRef.current) return;
      setOpen(next);
      setEditing(false);
      if (!next) {
        const filled = completeRange(localValue);
        if (filled && filled !== localValue) emit(filled);
      }
    };

    return (
      <Popover open={open} onOpenChange={handleOpenChange}>
        <PopoverTrigger asChild>
          <div className="flex items-center bg-muted overflow-hidden border rounded-md border-input cursor-text focus-within:ring-1 focus-within:ring-ring">
            <div className="flex items-center h-8 pl-2 w-fit gap-x-2">
              <CalendarIcon className="size-4" />
            </div>
            <Input
              ref={mergeRefs(ref, inputRef)}
              value={displayText}
              onChange={(e) => {
                setEditing(true);
                setDraft(e.target.value);
              }}
              onClick={(e) => {
                e.preventDefault();
                if (!open && !readOnly && !disabled) {
                  setOpen(true);
                }
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  commitDraft(e.currentTarget.value);
                  setOpen(false);
                }
                if (e.key === "Escape") {
                  setEditing(false);
                  setOpen(false);
                }
              }}
              onBlur={(e) => {
                if (editing) commitDraft(e.target.value);
              }}
              placeholder={t("core.datatable.filter.dateselector.placeholder")}
              className={cn(
                "h-8 w-full bg-inherit! border-0! rounded-none! focus-visible:ring-0! focus-visible:ring-offset-0!",
              )}
            />
            {summary && (
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="size-6 mr-1"
                aria-label={t("core.datatable.filter.dateselector.clear")}
                onClick={(e) => {
                  e.stopPropagation();
                  emit(null);
                  setDraft("");
                  setEditing(false);
                }}
              >
                <XIcon className="size-3" />
              </Button>
            )}
          </div>
        </PopoverTrigger>
        <PopoverContent
          align="start"
          side="bottom"
          className="w-auto p-2"
          onOpenAutoFocus={(e) => e.preventDefault()}
          forceMount
        >
          <ReuiDateSelector
            value={reuiValue}
            onChange={emit}
            i18n={reuiI18n}
            showTwoMonths={false}
            withTime={isDatetime}
            yearRange={yearRange}
            baseYear={baseYear}
            minYear={minYear}
            maxYear={maxYear}
            allowMultiple
            maxSelections={MAX_DATE_VALUES}
          />
        </PopoverContent>
      </Popover>
    );
  }),
);

// Ambil index unit (month/quarter/half) dari token periode untuk range.
function subValue(token) {
  if (token.period === "month") return token.month;
  if (token.period === "quarter") return token.quarter;
  if (token.period === "half-year") return token.halfYear;
  return 0;
}

/**
 * Lengkapi range between yang belum punya end → end = start.
 * - day  : endDate = startDate
 * - lain : rangeEnd = rangeStart (atap dari year + unit index)
 * Mengembalikan objek baru (tak memutasi input). Bila bukan between atau end
 * sudah ada, kembalikan apa adanya.
 * @param {object} v
 * @returns {object}
 */
function completeRange(v) {
  if (!v || v.operator !== "between") return v;

  if (v.period === "day") {
    if (v.startDate && !v.endDate) {
      return { ...v, endDate: v.startDate };
    }
    return v;
  }

  // Non-day: pastikan rangeStart & rangeEnd terisi.
  const start =
    v.rangeStart ??
    (v.year != null
      ? { year: v.year, value: subValue({ period: v.period, ...v }) }
      : undefined);
  if (start && !v.rangeEnd) {
    return { ...v, rangeStart: start, rangeEnd: start };
  }
  return v;
}
