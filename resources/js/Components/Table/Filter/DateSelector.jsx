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
import { format, parse } from "date-fns";
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

// Simbol prefix operator untuk parse input cepat.
const OPERATOR_SYMBOLS = [
  { sym: ">=", op: "on-or-after" },
  { sym: "<=", op: "on-or-before" },
  { sym: ">", op: "after" },
  { sym: "<", op: "before" },
  { sym: "=", op: "is" },
];

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

    // i18n labels untuk panel reui + display/parse ringkasan.
    const i18nLabels = useMemo(
      () => ({
        operators: {
          is: t("core.datatable.filter.dateselector.subop.is"),
          after: t("core.datatable.filter.dateselector.subop.after"),
          "on-or-after": t(
            "core.datatable.filter.dateselector.subop.on-or-after",
          ),
          before: t("core.datatable.filter.dateselector.subop.before"),
          "on-or-before": t(
            "core.datatable.filter.dateselector.subop.on-or-before",
          ),
          between: t("core.datatable.filter.dateselector.subop.between"),
        },
        months: Array.from({ length: 12 }, (_, i) =>
          format(new Date(2000, i, 1), "MMMM", { locale: dateLocale }),
        ),
        monthsShort: Array.from({ length: 12 }, (_, i) =>
          format(new Date(2000, i, 1), "MMM", { locale: dateLocale }),
        ),
        quarters: ["Q1", "Q2", "Q3", "Q4"],
        halfYears: ["H1", "H2"],
      }),
      [t, dateLocale],
    );

    const reuiI18n = useMemo(
      () => ({
        today: t("core.datatable.filter.dateselector.today.day"),
        labels: {
          operator: t("core.datatable.filter.dateselector.label.operator"),
          period: t("core.datatable.filter.dateselector.label.period"),
        },
        todayLabels: {
          day: t("core.datatable.filter.dateselector.today.day"),
          month: t("core.datatable.filter.dateselector.today.month"),
          quarter: t("core.datatable.filter.dateselector.today.quarter"),
          "half-year": t("core.datatable.filter.dateselector.today.half-year"),
          year: t("core.datatable.filter.dateselector.today.year"),
        },
        filterTypes: i18nLabels.operators,
        periodTypes: {
          day: t("core.datatable.filter.period.unit.day"),
          month: t("core.datatable.filter.period.unit.month"),
          quarter: t("core.datatable.filter.period.unit.quarter"),
          halfYear: t("core.datatable.filter.period.unit.half-year"),
          year: t("core.datatable.filter.period.unit.year"),
        },
        months: i18nLabels.months,
        monthsShort: i18nLabels.monthsShort,
        quarters: i18nLabels.quarters,
        halfYears: i18nLabels.halfYears,
      }),
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
    const parsePeriodToken = useCallback(
      (raw) => {
        const text = raw.trim();
        if (!text) return null;

        // year: 2026
        const yearMatch = text.match(/^(\d{4})$/);
        if (yearMatch) {
          return { period: "year", year: parseInt(yearMatch[1], 10) };
        }
        // quarter: Q2 2025
        const qMatch = text.match(/^Q([1-4])\s+(\d{4})$/i);
        if (qMatch) {
          return {
            period: "quarter",
            year: parseInt(qMatch[2], 10),
            quarter: parseInt(qMatch[1], 10) - 1,
          };
        }
        // half-year: H1 2026
        const hMatch = text.match(/^H([1-2])\s+(\d{4})$/i);
        if (hMatch) {
          return {
            period: "half-year",
            year: parseInt(hMatch[2], 10),
            halfYear: parseInt(hMatch[1], 10) - 1,
          };
        }
        // month name (i18n full/short) + year: "Januari 2025" / "Jan 2025"
        const monthYear = text.match(/^(.+?)\s+(\d{4})$/);
        if (monthYear) {
          const name = monthYear[1].toLowerCase();
          const year = parseInt(monthYear[2], 10);
          const idx = i18nLabels.months.findIndex(
            (m) => m.toLowerCase() === name,
          );
          const idxShort = i18nLabels.monthsShort.findIndex(
            (m) => m.toLowerCase() === name,
          );
          const m = idx >= 0 ? idx : idxShort;
          if (m >= 0) return { period: "month", year, month: m };
        }
        // tanggal (day): coba beberapa format.
        const dayFormats = isDatetime
          ? [
              "dd MMMM yyyy HH:mm",
              "dd MMMM yyyy",
              "yyyy-MM-dd HH:mm",
              "yyyy-MM-dd",
            ]
          : ["dd MMMM yyyy", "yyyy-MM-dd", "dd/MM/yyyy", "dd-MM-yyyy"];
        for (const fmt of dayFormats) {
          const parsed = parse(text, fmt, new Date(), { locale: dateLocale });
          if (!isNaN(parsed.getTime())) {
            return { period: "day", startDate: parsed };
          }
        }
        return null;
      },
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

        // Range "a - b" → between.
        const rangeParts = rest.split(/\s+-\s+/);
        if (rangeParts.length === 2) {
          const a = parsePeriodToken(rangeParts[0]);
          const b = parsePeriodToken(rangeParts[1]);
          if (a && b && a.period === b.period && a.period !== "day") {
            return {
              period: a.period,
              operator: "between",
              year: a.year,
              rangeStart: { year: a.year, value: subValue(a) },
              rangeEnd: { year: b.year, value: subValue(b) },
            };
          }
          if (a && b && a.period === "day") {
            return {
              period: "day",
              operator: "between",
              startDate: a.startDate,
              endDate: b.startDate,
            };
          }
        }

        const token = parsePeriodToken(rest);
        if (!token) return null;
        return { ...token, operator };
      },
      [i18nLabels, parsePeriodToken],
    );

    // -- Serialisasi & loop-guard -----------------------------------------
    const [initialValue] = useState(() => {
      if (!value) return undefined;
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
    const reuiValue = useMemo(() => {
      if (!localValue) return undefined;
      return {
        ...localValue,
        startDate: toDate(localValue.startDate),
        endDate: toDate(localValue.endDate),
      };
    }, [localValue]);

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
      [onValueChange],
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

    const commitDraft = (raw) => {
      const parsed = parseSummary(raw);
      if (parsed) emit(parsed);
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
