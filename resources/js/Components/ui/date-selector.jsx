import {
  createContext,
  memo,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  addMonths,
  format,
  isBefore,
  setHours,
  setMinutes,
  setMonth as setMonthFns,
  setYear as setYearFns,
  subMonths,
} from "date-fns";
import { ChevronLeftIcon, ChevronRightIcon, Clock } from "lucide-react";
import { DayPicker } from "react-day-picker";

import { useIsMobile } from "@/Hooks/use-mobile";
import { cn } from "@/lib/utils";
import { Button } from "@/Components/ui/button";
import { ScrollArea } from "@/Components/ui/scroll-area";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/Components/ui/select";

/**
 * Date Selector (adaptasi reui.io — TSX → JSX).
 * Value contract (DateSelectorValue):
 *   { period, operator, startDate?, endDate?, year?, month?, quarter?,
 *     halfYear?, rangeStart?, rangeEnd? }
 *   period   : "day" | "month" | "quarter" | "half-year" | "year"
 *   operator : "is" | "before" | "after" | "between"
 *   *Date    : objek Date (period=day)
 *   range*   : { year, value } (period non-day)
 */

export const DEFAULT_DATE_SELECTOR_I18N = {
  selectDate: "Select date",
  apply: "Apply",
  cancel: "Cancel",
  clear: "Clear",
  today: "Today",
  labels: { operator: "Condition", period: "Period" },
  filterTypes: {
    is: "is",
    "is-not": "is not",
    before: "before",
    "on-or-before": "on/before",
    after: "after",
    "on-or-after": "on/after",
    between: "between",
    "not-between": "not between",
  },
  periodTypes: {
    day: "Day",
    month: "Month",
    quarter: "Quarter",
    halfYear: "Half-year",
    year: "Year",
  },
  months: [
    "January",
    "February",
    "March",
    "April",
    "May",
    "June",
    "July",
    "August",
    "September",
    "October",
    "November",
    "December",
  ],
  monthsShort: [
    "Jan",
    "Feb",
    "Mar",
    "Apr",
    "May",
    "Jun",
    "Jul",
    "Aug",
    "Sep",
    "Oct",
    "Nov",
    "Dec",
  ],
  quarters: ["Q1", "Q2", "Q3", "Q4"],
  halfYears: ["H1", "H2"],
  weekdays: [
    "Sunday",
    "Monday",
    "Tuesday",
    "Wednesday",
    "Thursday",
    "Friday",
    "Saturday",
  ],
  weekdaysShort: ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"],
  placeholder: "Select date...",
  rangePlaceholder: "Select date range...",
};

const DateSelectorContext = createContext({
  i18n: DEFAULT_DATE_SELECTOR_I18N,
  variant: "outline",
  size: "default",
});

export const useDateSelectorContext = () => useContext(DateSelectorContext);

// Operator periode. Negasi (≠ / not-between) DITANGANI oleh operator !in_period
// di FilterItem, jadi tidak diduplikasi di sini.
const FILTER_OPTIONS = [
  { value: "is", range: false },
  { value: "after", range: false },
  { value: "on-or-after", range: false },
  { value: "before", range: false },
  { value: "on-or-before", range: false },
  { value: "between", range: true },
];

export const isRangeFilterType = (op) => op === "between";

export function formatDateValue(
  value,
  i18n = DEFAULT_DATE_SELECTOR_I18N,
  dayDateFormat = "MM/dd/yyyy",
) {
  const {
    period,
    startDate,
    endDate,
    year,
    month,
    quarter,
    halfYear,
    rangeStart,
    rangeEnd,
  } = value ?? {};

  if (period === "day") {
    if (startDate && endDate) {
      return `${format(startDate, dayDateFormat)} - ${format(endDate, dayDateFormat)}`;
    }
    if (startDate) return format(startDate, dayDateFormat);
    return "";
  }

  if (period === "month") {
    if (rangeStart && rangeEnd) {
      return `${i18n.monthsShort[rangeStart.value]} ${rangeStart.year} - ${i18n.monthsShort[rangeEnd.value]} ${rangeEnd.year}`;
    }
    if (year !== undefined && month !== undefined) {
      return `${i18n.monthsShort[month]} ${year}`;
    }
    return "";
  }

  if (period === "quarter") {
    if (rangeStart && rangeEnd) {
      return `${i18n.quarters[rangeStart.value]} ${rangeStart.year} - ${i18n.quarters[rangeEnd.value]} ${rangeEnd.year}`;
    }
    if (year !== undefined && quarter !== undefined) {
      return `${i18n.quarters[quarter]} ${year}`;
    }
    return "";
  }

  if (period === "half-year") {
    if (rangeStart && rangeEnd) {
      return `${i18n.halfYears[rangeStart.value]} ${rangeStart.year} - ${i18n.halfYears[rangeEnd.value]} ${rangeEnd.year}`;
    }
    if (year !== undefined && halfYear !== undefined) {
      return `${i18n.halfYears[halfYear]} ${year}`;
    }
    return "";
  }

  if (period === "year") {
    if (rangeStart && rangeEnd) return `${rangeStart.year} - ${rangeEnd.year}`;
    if (year !== undefined) return `${year}`;
    return "";
  }

  return "";
}

export function useDateSelector({
  value,
  onChange,
  defaultPeriodType = "day",
  defaultFilterType = "is",
  presetMode,
  allowRange = true,
  yearRange = 11,
  baseYear,
  minYear,
  maxYear,
  periodTypes,
}) {
  const currentYear = baseYear ?? new Date().getFullYear();

  const validDefaultPeriodType = useMemo(() => {
    if (!periodTypes || periodTypes.length === 0) return defaultPeriodType;
    if (periodTypes.includes(defaultPeriodType)) return defaultPeriodType;
    return periodTypes[0];
  }, [periodTypes, defaultPeriodType]);

  const effectiveFilterType =
    presetMode ?? value?.operator ?? defaultFilterType;

  const [periodType, setPeriodType] = useState(
    value?.period || validDefaultPeriodType,
  );
  const [filterType, setFilterType] = useState(effectiveFilterType);
  const [selectedDate, setSelectedDate] = useState(value?.startDate);
  const [selectedEndDate, setSelectedEndDate] = useState(value?.endDate);
  const [calendarMonth, setCalendarMonth] = useState(
    value?.startDate || new Date(),
  );
  const [selectedYear, setSelectedYear] = useState(value?.year);
  const [selectedMonth, setSelectedMonth] = useState(value?.month);
  const [selectedQuarter, setSelectedQuarter] = useState(value?.quarter);
  const [selectedHalfYear, setSelectedHalfYear] = useState(value?.halfYear);
  const [rangeStart, setRangeStart] = useState(value?.rangeStart);
  const [rangeEnd, setRangeEnd] = useState(value?.rangeEnd);
  const [hoverDate, setHoverDate] = useState(undefined);
  // Hover untuk grid periode (month/quarter/half/year) saat memilih akhir range.
  const [hoverPeriod, setHoverPeriod] = useState(undefined);

  const years = useMemo(() => {
    const hasMin = minYear !== undefined;
    const hasMax = maxYear !== undefined;
    // Kedua batas → rentang penuh [min, max].
    if (hasMin && hasMax) {
      return Array.from(
        { length: maxYear - minYear + 1 },
        (_, i) => minYear + i,
      );
    }
    // Hanya min → tumbuh ke atas: [min, min + yearRange] (inklusif).
    if (hasMin) {
      return Array.from({ length: yearRange + 1 }, (_, i) => minYear + i);
    }
    // Hanya max → tumbuh ke bawah: [max - yearRange, max] (inklusif).
    if (hasMax) {
      return Array.from(
        { length: yearRange + 1 },
        (_, i) => maxYear - yearRange + i,
      );
    }
    // Tanpa batas → terpusat pada baseYear, yearRange sebagai jumlah item.
    return Array.from(
      { length: yearRange },
      (_, i) => currentYear - Math.floor(yearRange / 2) + i,
    );
  }, [currentYear, yearRange, minYear, maxYear]);

  const currentValue = useMemo(
    () => ({
      period: periodType,
      operator: presetMode ?? filterType,
      startDate: selectedDate,
      endDate: selectedEndDate,
      year: selectedYear,
      month: selectedMonth,
      quarter: selectedQuarter,
      halfYear: selectedHalfYear,
      rangeStart,
      rangeEnd,
    }),
    [
      periodType,
      presetMode,
      filterType,
      selectedDate,
      selectedEndDate,
      selectedYear,
      selectedMonth,
      selectedQuarter,
      selectedHalfYear,
      rangeStart,
      rangeEnd,
    ],
  );

  const clearSelection = useCallback(() => {
    setSelectedDate(undefined);
    setSelectedEndDate(undefined);
    setSelectedYear(undefined);
    setSelectedMonth(undefined);
    setSelectedQuarter(undefined);
    setSelectedHalfYear(undefined);
    setRangeStart(undefined);
    setRangeEnd(undefined);
  }, []);

  const handleDayClick = useCallback(
    (day) => {
      if (isRangeFilterType(filterType) && allowRange) {
        if (!selectedDate || (selectedDate && selectedEndDate)) {
          setSelectedDate(day);
          setSelectedEndDate(undefined);
        } else if (isBefore(day, selectedDate)) {
          setSelectedEndDate(selectedDate);
          setSelectedDate(day);
        } else {
          setSelectedEndDate(day);
        }
      } else {
        setSelectedDate(day);
        setSelectedEndDate(undefined);
      }
    },
    [filterType, allowRange, selectedDate, selectedEndDate],
  );

  const handlePeriodSelect = useCallback(
    (year, value) => {
      if (isRangeFilterType(filterType) && allowRange) {
        if (!rangeStart || (rangeStart && rangeEnd)) {
          setRangeStart({ year, value });
          setRangeEnd(undefined);
          setSelectedYear(year);
          if (periodType === "month") setSelectedMonth(value);
          if (periodType === "quarter") setSelectedQuarter(value);
          if (periodType === "half-year") setSelectedHalfYear(value);
        } else {
          const startKey = rangeStart.year * 100 + rangeStart.value;
          const endKey = year * 100 + value;
          if (endKey < startKey) {
            setRangeEnd(rangeStart);
            setRangeStart({ year, value });
          } else {
            setRangeEnd({ year, value });
          }
        }
      } else {
        setSelectedYear(year);
        if (periodType === "month") setSelectedMonth(value);
        if (periodType === "quarter") setSelectedQuarter(value);
        if (periodType === "half-year") setSelectedHalfYear(value);
        setRangeStart(undefined);
        setRangeEnd(undefined);
      }
    },
    [filterType, allowRange, rangeStart, rangeEnd, periodType],
  );

  const handleYearSelect = useCallback(
    (year) => {
      if (isRangeFilterType(filterType) && allowRange) {
        if (!rangeStart || (rangeStart && rangeEnd)) {
          setRangeStart({ year, value: 0 });
          setRangeEnd(undefined);
          setSelectedYear(year);
        } else if (year < rangeStart.year) {
          setRangeEnd(rangeStart);
          setRangeStart({ year, value: 0 });
        } else {
          setRangeEnd({ year, value: 0 });
        }
      } else {
        setSelectedYear(year);
        setRangeStart(undefined);
        setRangeEnd(undefined);
      }
    },
    [filterType, allowRange, rangeStart, rangeEnd],
  );

  const handlePeriodTypeChange = useCallback(
    (type) => {
      setPeriodType(type);
      clearSelection();
    },
    [clearSelection],
  );

  const handleFilterTypeChange = useCallback(
    (type) => {
      if (presetMode !== undefined) return;
      setFilterType(type);
      clearSelection();
    },
    [clearSelection, presetMode],
  );

  const isInRange = useCallback(
    (year, value) => {
      if (!rangeStart || !rangeEnd) return false;
      const key = year * 100 + value;
      const startKey = rangeStart.year * 100 + rangeStart.value;
      const endKey = rangeEnd.year * 100 + rangeEnd.value;
      return key >= startKey && key <= endKey;
    },
    [rangeStart, rangeEnd],
  );

  const isYearInRange = useCallback(
    (year) => {
      if (!rangeStart || !rangeEnd) return false;
      return year >= rangeStart.year && year <= rangeEnd.year;
    },
    [rangeStart, rangeEnd],
  );

  useEffect(() => {
    if (value) {
      setPeriodType(value.period || validDefaultPeriodType);
      const newFilterType = presetMode ?? value.operator ?? defaultFilterType;
      setFilterType(newFilterType);
      setSelectedDate(value.startDate);
      setSelectedEndDate(value.endDate);
      setSelectedYear(value.year);
      setSelectedMonth(value.month);
      setSelectedQuarter(value.quarter);
      setSelectedHalfYear(value.halfYear);
      setRangeStart(value.rangeStart);
      setRangeEnd(value.rangeEnd);
    }
  }, [value, validDefaultPeriodType, defaultFilterType, presetMode]);

  useEffect(() => {
    if (presetMode !== undefined) setFilterType(presetMode);
  }, [presetMode]);

  // Emit hanya saat isi currentValue benar-benar berubah. `onChange` sengaja
  // TIDAK masuk deps: referensi handler yang tak-stabil (lazim dari parent)
  // jika tidak akan memicu emit tiap render → "Maximum update depth exceeded".
  const lastChangeRef = useRef(null);
  const onChangeRef = useRef(onChange);
  // Update ref di effect, BUKAN saat render (React 19 melarang mutasi ref
  // selama render — "Cannot update ref during render").
  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);
  useEffect(() => {
    const serialized = JSON.stringify(currentValue);
    if (serialized === lastChangeRef.current) return;
    lastChangeRef.current = serialized;
    onChangeRef.current?.(currentValue);
  }, [currentValue]);

  return {
    periodType,
    filterType,
    selectedDate,
    selectedEndDate,
    calendarMonth,
    selectedYear,
    selectedMonth,
    selectedQuarter,
    selectedHalfYear,
    rangeStart,
    rangeEnd,
    hoverDate,
    hoverPeriod,
    years,
    currentValue,
    allowRange,
    setPeriodType: handlePeriodTypeChange,
    setFilterType: handleFilterTypeChange,
    setSelectedDate,
    setSelectedEndDate,
    setCalendarMonth,
    setHoverDate,
    setHoverPeriod,
    clearSelection,
    handleDayClick,
    handlePeriodSelect,
    handleYearSelect,
    isInRange,
    isYearInRange,
  };
}

// Field berlabel: label kecil di atas kontrol.
function LabeledField({ label, children, className }) {
  return (
    <div className={cn("flex flex-col gap-1", className)}>
      <span className="text-sm font-medium text-foreground">{label}</span>
      {children}
    </div>
  );
}

// Select dropdown wajib (Radix) — TIDAK dapat dikosongkan (tanpa search/clear).
function PlainSelect({ value, onValueChange, options, disabled, className }) {
  return (
    <Select
      value={value}
      onValueChange={(v) => {
        if (v) onValueChange?.(v);
      }}
      disabled={disabled}
    >
      <SelectTrigger className={className}>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {options.map((opt) => (
          <SelectItem key={opt.value} value={opt.value}>
            {opt.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

const DateSelectorFilterToggle = memo(function DateSelectorFilterToggle({
  value,
  onChange,
  showBetween = true,
  showIs = true,
  presetMode,
  className,
}) {
  const { i18n } = useDateSelectorContext();
  const isDisabled = presetMode !== undefined;

  const options = FILTER_OPTIONS.filter((opt) => {
    if (opt.value === "is" && !showIs) return false;
    if (opt.range && !showBetween) return false;
    return true;
  }).map((opt) => ({ value: opt.value, label: i18n.filterTypes[opt.value] }));

  return (
    <LabeledField label={i18n.labels.operator} className={className}>
      <PlainSelect
        value={value}
        onValueChange={(v) => {
          if (!isDisabled) onChange(v);
        }}
        options={options}
        disabled={isDisabled}
        className="h-8"
      />
    </LabeledField>
  );
});

const DateSelectorPeriodTabs = memo(function DateSelectorPeriodTabs({
  value,
  onChange,
  periodTypes,
  className,
}) {
  const { i18n } = useDateSelectorContext();

  const tabs = [
    { value: "day", label: i18n.periodTypes.day },
    { value: "month", label: i18n.periodTypes.month },
    { value: "quarter", label: i18n.periodTypes.quarter },
    { value: "half-year", label: i18n.periodTypes.halfYear },
    { value: "year", label: i18n.periodTypes.year },
  ];

  const options = periodTypes
    ? tabs.filter((tab) => periodTypes.includes(tab.value))
    : tabs;

  return (
    <LabeledField label={i18n.labels.period} className={className}>
      <PlainSelect
        value={value}
        onValueChange={onChange}
        options={options}
        className="h-8"
      />
    </LabeledField>
  );
});

const DateSelectorDayPicker = memo(function DateSelectorDayPicker({
  currentMonth,
  onMonthChange,
  selectedDate,
  selectedEndDate,
  onDayClick,
  isRange,
  onDayHover,
  hoverDate,
  years,
  showTwoMonths = true,
  weekStartsOn,
  withTime = false,
  timeValue,
  onTimeChange,
  scrollTick,
  className,
}) {
  const { i18n } = useDateSelectorContext();
  const isMobile = useIsMobile();
  const [picker, setPicker] = useState(null); // null | "month" | "year"
  const [timeOpen, setTimeOpen] = useState(false);

  // Ringkasan HH:mm untuk trigger di header (basis: tanggal terpilih / sekarang).
  const timeBase = timeValue instanceof Date ? timeValue : new Date();
  const timeLabel = `${`${timeBase.getHours()}`.padStart(2, "0")}:${`${timeBase.getMinutes()}`.padStart(2, "0")}`;

  // Buka time → tutup picker bulan/tahun (overlay sama, tak boleh tumpang).
  const toggleTime = () => {
    setPicker(null);
    setTimeOpen((v) => !v);
  };

  const selected = isRange
    ? selectedDate && selectedEndDate
      ? { from: selectedDate, to: selectedEndDate }
      : selectedDate
        ? { from: selectedDate, to: hoverDate || selectedDate }
        : undefined
    : selectedDate;

  const formatters = {
    formatWeekdayName: (date) => {
      const dayIndex = date.getDay();
      return i18n.weekdaysShort[dayIndex] || i18n.weekdays[dayIndex];
    },
  };

  // classNames diselaraskan dengan DatetimePicker agar gaya calendar identik.
  const dayPickerClassNames = {
    dropdowns: "flex w-full gap-2",
    months: "flex w-full h-fit",
    month: "flex flex-col w-full",
    month_caption: "hidden",
    button_previous: "hidden",
    button_next: "hidden",
    month_grid: "w-full border-collapse",
    // Grid rapat (tanpa gap) agar rentang menyambung; hari square (w-9 h-9).
    weekdays: "flex justify-center mt-2",
    weekday: "text-muted-foreground w-9 font-normal text-[0.8rem]",
    week: "flex w-full justify-center mt-0.5",
    day: "h-9 w-9 text-center text-sm p-0 relative flex items-center justify-center [&:has([aria-selected].day-range-end.day-range-start)]:rounded-full! [&:has([aria-selected].day-range-end)]:rounded-r-full [&:has([aria-selected].day-outside)]:bg-accent/50 [&:has([aria-selected])]:bg-accent first:[&:has([aria-selected])]:rounded-l-full last:[&:has([aria-selected])]:rounded-r-full focus-within:relative focus-within:z-20",
    day_button:
      "size-9 rounded-md p-0 font-normal aria-selected:opacity-100 cursor-pointer",
    today:
      "border bg-muted border-muted-foreground [&:not([data-selected=true])]:rounded-full",
    outside:
      "day-outside text-muted-foreground opacity-50 aria-selected:bg-accent/50 aria-selected:text-muted-foreground aria-selected:opacity-30",
    disabled: "text-muted-foreground opacity-50",
    selected:
      "bg-foreground! text-background! border-none! hover:bg-foreground hover:text-background focus:bg-foreground focus:text-background [&:not(.day-range-start):not(.day-range-middle):not(.day-range-end)]:rounded-full",
    range_start: "day-range-start rounded-l-full",
    range_middle: "day-range-middle rounded-none!",
    range_end: "day-range-end rounded-r-full",
    hidden: "invisible",
  };

  return (
    <div className={cn("w-full", className)}>
      {/* Header: bulan & tahun dapat dipilih + navigasi prev/next. */}
      <div className="flex items-center justify-between mb-1">
        <div className="text-md font-bold ms-2 flex items-center [&_button]:cursor-pointer">
          <button
            type="button"
            className="hover:underline"
            onClick={() => setPicker(picker === "month" ? null : "month")}
          >
            {i18n.months[currentMonth.getMonth()]}
          </button>
          <button
            type="button"
            className="ms-1 hover:underline"
            onClick={() => setPicker(picker === "year" ? null : "year")}
          >
            {currentMonth.getFullYear()}
          </button>
        </div>
        <div className="flex items-center space-x-1">
          {/* Trigger time: ringkas HH:mm di header, buka panel overlay. */}
          {withTime && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              aria-expanded={timeOpen}
              className={cn(
                "h-7 gap-1 px-2 font-normal",
                timeOpen && SELECTED_ITEM_CLASS,
              )}
              onClick={toggleTime}
            >
              <Clock className="size-3.5" />
              {timeLabel}
            </Button>
          )}
          <div className={cn("flex space-x-2", picker && "invisible")}>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={() => onMonthChange?.(subMonths(currentMonth, 1))}
            >
              <ChevronLeftIcon />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={() => onMonthChange?.(addMonths(currentMonth, 1))}
            >
              <ChevronRightIcon />
            </Button>
          </div>
        </div>
      </div>
      <div className="relative">
        <DayPicker
          mode={isRange ? "range" : "single"}
          month={currentMonth}
          onMonthChange={onMonthChange}
          selected={selected}
          // onSelect WAJIB ada agar engine range RDP aktif (modifier
          // range_start/middle/end + preview hover via selected={{from,to}}).
          // Tapi onSelect menelan klik-kedua di tanggal start (dianggap deselect).
          // Solusi: onSelect jadi no-op; state digerakkan onDayClick (klik mentah,
          // fire tiap klik) → handleDayClick urus same-day.
          onSelect={() => {}}
          onDayClick={(day) => onDayClick(day)}
          onDayMouseEnter={(day) => {
            if (isRange && onDayHover) onDayHover(day);
          }}
          onDayMouseLeave={() => {
            if (isRange && onDayHover) onDayHover(undefined);
          }}
          numberOfMonths={isMobile ? 1 : showTwoMonths ? 2 : 1}
          showOutsideDays
          weekStartsOn={weekStartsOn}
          formatters={formatters}
          classNames={dayPickerClassNames}
        />
        {picker && (
          <MonthYearPicker
            mode={picker}
            current={currentMonth}
            months={i18n.monthsShort}
            years={years}
            onPick={(d, next) => {
              onMonthChange?.(d);
              setPicker(next);
            }}
            className="absolute inset-0"
          />
        )}
        {withTime && timeOpen && (
          <DaySelectorTimePicker
            value={timeValue}
            onChange={onTimeChange}
            scrollTick={scrollTick}
            className="absolute inset-0"
          />
        )}
      </div>
    </div>
  );
});

/**
 * MonthYearPicker — overlay pilih bulan / tahun di header calendar (pola
 * DatetimePicker). mode: "month" | "year".
 */
function MonthYearPicker({ mode, current, months, years, onPick, className }) {
  const yearRef = useRef(null);
  const curYear = current.getFullYear();
  const curMonth = current.getMonth();

  useEffect(() => {
    if (mode === "year") {
      yearRef.current?.scrollIntoView({ behavior: "auto", block: "center" });
    }
  }, [mode]);

  return (
    <div className={cn("overflow-hidden bg-popover", className)}>
      {/* h-full mengisi overlay (absolute inset-0 = setinggi calendar) lalu scroll
          saat konten lebih tinggi — berlaku untuk daftar tahun maupun bulan. */}
      <ScrollArea className="h-full">
        {mode === "year" ? (
          <div className="grid grid-cols-4 gap-1 p-1">
            {years.map((y) => (
              <div key={y} ref={y === curYear ? yearRef : undefined}>
                <Button
                  type="button"
                  variant="outline"
                  className={cn(
                    "w-full rounded-full",
                    y === curYear && SELECTED_ITEM_CLASS,
                  )}
                  onClick={() => onPick(setYearFns(current, y), "month")}
                >
                  {y}
                </Button>
              </div>
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-3 gap-2 p-1">
            {months.map((m, i) => (
              <Button
                key={m}
                type="button"
                variant="outline"
                className={cn(
                  "w-full rounded-full",
                  i === curMonth && SELECTED_ITEM_CLASS,
                )}
                onClick={() => onPick(setMonthFns(current, i), null)}
              >
                {m}
              </Button>
            ))}
          </div>
        )}
      </ScrollArea>
    </div>
  );
}

// Kelas item terpilih — putih, selaras day terpilih pada calendar.
const SELECTED_ITEM_CLASS =
  "bg-foreground! text-background! border-none! hover:bg-foreground hover:text-background";

const DateSelectorPeriodGrid = memo(function DateSelectorPeriodGrid({
  years,
  items,
  selectedYear,
  selectedValue,
  rangeStart,
  rangeEnd,
  hoverPeriod,
  isInRange,
  onSelect,
  onHover,
  isRange,
  columns,
  scrollTick,
  className,
}) {
  // Preview end saat range: rangeStart sudah ada, rangeEnd belum, dan hover aktif.
  const previewing = isRange && rangeStart && !rangeEnd && hoverPeriod;
  const inHoverRange = (year, index) => {
    if (!previewing) return false;
    const key = year * 100 + index;
    const a = rangeStart.year * 100 + rangeStart.value;
    const b = hoverPeriod.year * 100 + hoverPeriod.value;
    const lo = Math.min(a, b);
    const hi = Math.max(a, b);
    return key >= lo && key <= hi;
  };

  // Scroll ke item terpilih (atau tahun/nilai sekarang). Re-scroll saat pilihan
  // berubah — mis. klik tombol "Today".
  const targetRef = useRef(null);
  const targetYear = selectedYear ?? new Date().getFullYear();
  useEffect(() => {
    const id = setTimeout(() => {
      targetRef.current?.scrollIntoView({ behavior: "auto", block: "center" });
    }, 1);
    return () => clearTimeout(id);
  }, [targetYear, selectedValue, scrollTick]);

  return (
    <div className={cn("w-full space-y-6", className)}>
      {years.map((year) => (
        <div key={year} ref={year === targetYear ? targetRef : undefined}>
          <div className="text-muted-foreground mb-3 text-sm font-medium">
            {year}
          </div>
          <div
            className="grid w-full gap-1"
            style={{
              gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))`,
            }}
          >
            {items.map((item, index) => {
              const isSelected =
                selectedYear === year && selectedValue === index;
              const isRangeStart =
                rangeStart?.year === year && rangeStart?.value === index;
              const isRangeEnd =
                rangeEnd?.year === year && rangeEnd?.value === index;
              const inRange = isInRange(year, index);
              const isHoverEnd =
                previewing &&
                hoverPeriod.year === year &&
                hoverPeriod.value === index;
              // Selected, range start/end/middle, & preview hover → putih.
              const white =
                isSelected ||
                isRangeStart ||
                isRangeEnd ||
                isHoverEnd ||
                inRange ||
                inHoverRange(year, index);
              return (
                <Button
                  key={item}
                  size="sm"
                  variant="outline"
                  className={cn("w-full", white && SELECTED_ITEM_CLASS)}
                  onClick={() => onSelect(year, index)}
                  onMouseEnter={() =>
                    isRange && onHover?.({ year, value: index })
                  }
                  onMouseLeave={() => isRange && onHover?.(undefined)}
                >
                  {item}
                </Button>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
});

const DateSelectorYearList = memo(function DateSelectorYearList({
  years,
  selectedYear,
  rangeStart,
  rangeEnd,
  hoverPeriod,
  isYearInRange,
  onSelect,
  onHover,
  isRange,
  scrollTick,
  className,
}) {
  const previewing = isRange && rangeStart && !rangeEnd && hoverPeriod;
  const inHoverRange = (year) => {
    if (!previewing) return false;
    const lo = Math.min(rangeStart.year, hoverPeriod.year);
    const hi = Math.max(rangeStart.year, hoverPeriod.year);
    return year >= lo && year <= hi;
  };

  // Scroll ke tahun terpilih (atau tahun sekarang). Re-scroll saat pilihan
  // berubah — mis. klik tombol "Today".
  const targetRef = useRef(null);
  const targetYear = selectedYear ?? new Date().getFullYear();
  useEffect(() => {
    const id = setTimeout(() => {
      targetRef.current?.scrollIntoView({ behavior: "auto", block: "center" });
    }, 1);
    return () => clearTimeout(id);
  }, [targetYear, scrollTick]);

  return (
    <div className={cn("grid w-full grid-cols-4 gap-1", className)}>
      {years.map((year) => {
        const isSelected = selectedYear === year && !rangeStart && !rangeEnd;
        const isRangeStart = rangeStart?.year === year;
        const isRangeEnd = rangeEnd?.year === year;
        const inRange = isYearInRange(year);
        const isHoverEnd = previewing && hoverPeriod.year === year;
        // Selected, range start/end/middle, & preview hover → putih.
        const white =
          isSelected ||
          isRangeStart ||
          isRangeEnd ||
          isHoverEnd ||
          inRange ||
          inHoverRange(year);
        return (
          <Button
            key={year}
            ref={year === targetYear ? targetRef : undefined}
            size="sm"
            variant="outline"
            className={cn("w-full", white && SELECTED_ITEM_CLASS)}
            onClick={() => onSelect(year)}
            onMouseEnter={() => isRange && onHover?.({ year, value: 0 })}
            onMouseLeave={() => isRange && onHover?.(undefined)}
          >
            {year}
          </Button>
        );
      })}
    </div>
  );
});

/**
 * DaySelectorTimePicker — pemilih jam:menit (24 jam) untuk type datetime.
 * Mengubah komponen waktu pada Date terpilih; bila belum ada tanggal, pakai hari
 * ini sebagai basis agar waktu tetap tersimpan.
 */
const HOURS = Array.from({ length: 24 }, (_, i) => i);
const MINUTES = Array.from({ length: 60 }, (_, i) => i);

// Kolom waktu (jam / menit). Di luar komponen agar tak remount tiap render.
function TimeColumn({
  items,
  selected,
  onSelect,
  label,
  scrollTick,
  heightClass = "h-36",
}) {
  const selectedRef = useRef(null);
  useEffect(() => {
    const id = setTimeout(() => {
      selectedRef.current?.scrollIntoView({
        behavior: "auto",
        block: "center",
      });
    }, 1);
    return () => clearTimeout(id);
  }, [selected, scrollTick]);

  return (
    <div className="flex flex-col">
      <p className="h-6 text-center text-xs text-muted-foreground">{label}</p>
      <ScrollArea className={cn("w-14", heightClass)}>
        <div className="flex flex-col items-stretch pe-2">
          {items.map((v) => (
            <div key={v} ref={v === selected ? selectedRef : undefined}>
              <Button
                type="button"
                variant="ghost"
                className={cn(
                  "h-7 w-full justify-center font-normal",
                  v === selected && SELECTED_ITEM_CLASS,
                )}
                onClick={() => onSelect(v)}
              >
                {`${v}`.padStart(2, "0")}
              </Button>
            </div>
          ))}
        </div>
      </ScrollArea>
    </div>
  );
}

/**
 * DaySelectorTimePicker — panel pilih HH:mm. Dipakai sebagai overlay absolute di
 * area calendar (dibuka dari trigger time di header), jadi tinggi mengisi penuh
 * (`h-full`) agar tak menambah tinggi vertikal popup.
 */
function DaySelectorTimePicker({ value, onChange, scrollTick, className }) {
  const base = value instanceof Date ? value : new Date();
  const hour = base.getHours();
  const minute = base.getMinutes();

  const setHour = (h) =>
    onChange(setHours(value instanceof Date ? value : new Date(), h));
  const setMinute = (m) =>
    onChange(setMinutes(value instanceof Date ? value : new Date(), m));

  return (
    <div className={cn("flex flex-col bg-popover", className)}>
      <div className="flex grow justify-center gap-2 overflow-hidden">
        <TimeColumn
          items={HOURS}
          selected={hour}
          onSelect={setHour}
          label="HH"
          scrollTick={scrollTick}
          heightClass="h-full"
        />
        <TimeColumn
          items={MINUTES}
          selected={minute}
          onSelect={setMinute}
          label="mm"
          scrollTick={scrollTick}
          heightClass="h-full"
        />
      </div>
    </div>
  );
}

/**
 * @typedef {Object} PeriodRange Titik range periode non-day (month/quarter/half-year/year).
 * @property {number} year  Tahun penuh (mis. 2026).
 * @property {number} value Index 0-based dalam tahun: month 0–11, quarter 0–3,
 *   half-year 0–1; untuk period=year tak terpakai (0).
 *
 * @typedef {Object} DateSelectorValue Nilai terkontrol DateSelector.
 * @property {"day"|"month"|"quarter"|"half-year"|"year"} period Granularitas.
 * @property {"is"|"after"|"on-or-after"|"before"|"on-or-before"|"between"} operator
 *   Sub-operator periode. Negasi (≠ / not-between) ditangani operator `!in_period`
 *   di FilterItem, jadi tak ada di sini.
 * @property {Date} [startDate] period=day: tanggal (atau awal range).
 * @property {Date} [endDate]   period=day: akhir range (operator=between).
 * @property {number} [year]    period non-day non-range: tahun terpilih.
 * @property {number} [month]   period=month non-range: index bulan 0–11.
 * @property {number} [quarter] period=quarter non-range: index kuartal 0–3.
 * @property {number} [halfYear] period=half-year non-range: index semester 0–1.
 * @property {PeriodRange} [rangeStart] period non-day + operator=between: awal range.
 * @property {PeriodRange} [rangeEnd]   period non-day + operator=between: akhir range.
 */

/**
 * DateSelector — pemilih periode bergranularitas (hari/bulan/kuartal/semester/tahun)
 * dengan sub-operator (is/after/on-or-after/before/on-or-before/between) dan dukungan
 * range. Adaptasi reui.io (TSX → JSX). Dipakai sebagai value field operator
 * `in_period`/`!in_period` pada DataTable2; biasanya dibungkus Popover oleh
 * `Components/Table/Filter/DateSelector.jsx` (dengan `showInput={false}`).
 *
 * Time picker (HH:mm) hanya muncul saat `withTime` aktif, period=day, dan operator
 * non-range — waktu mempersempit batas query di backend (FilterEvaluator).
 *
 * @param {Object} props
 * @param {DateSelectorValue} [props.value] Nilai terkontrol. Komponen hydrate state
 *   internal dari sini saat mount.
 * @param {(value: DateSelectorValue) => void} [props.onChange] Dipanggil saat pilihan
 *   berubah. Diproteksi loop-guard (JSON-compare) agar emit hanya saat konten berubah.
 * @param {boolean} [props.allowRange=true] Izinkan operator `between` (mode range).
 * @param {Array<"day"|"month"|"quarter"|"half-year"|"year">} [props.periodTypes]
 *   Batasi granularitas yang tersedia. Default: semua.
 * @param {"day"|"month"|"quarter"|"half-year"|"year"} [props.defaultPeriodType="day"]
 *   Granularitas awal bila `value.period` kosong.
 * @param {DateSelectorValue["operator"]} [props.defaultFilterType="is"] Operator awal
 *   bila `value.operator` kosong.
 * @param {DateSelectorValue["operator"]} [props.presetMode] Kunci operator ke nilai ini
 *   (sembunyikan dropdown Condition); menimpa `filterType`.
 * @param {boolean} [props.showTwoMonths=true] Tampilkan dua bulan berdampingan di calendar.
 * @param {string} [props.label] Label opsional di atas komponen.
 * @param {string} [props.className] Kelas tambahan untuk container root.
 * @param {number} [props.yearRange=10] Jumlah tahun terdaftar (berpusat pada `baseYear`).
 *   Diabaikan bila `minYear`+`maxYear` di-set.
 * @param {number} [props.baseYear] Tahun pusat daftar tahun. Default: tahun ini.
 * @param {number} [props.minYear] Batas bawah tahun (override `yearRange` bila bersama `maxYear`).
 * @param {number} [props.maxYear] Batas atas tahun (override `yearRange` bila bersama `minYear`).
 * @param {Partial<typeof DEFAULT_DATE_SELECTOR_I18N>} [props.i18n] Override teks i18n
 *   (label operator/periode, nama bulan/kuartal/semester, dll).
 * @param {0|1|2|3|4|5|6} [props.weekStartsOn] Hari awal pekan (0=Minggu).
 * @param {boolean} [props.withTime=false] Aktifkan time picker (lihat aturan di atas).
 * @returns {JSX.Element}
 */
export function DateSelector({
  value,
  onChange,
  allowRange = true,
  periodTypes,
  defaultPeriodType = "day",
  defaultFilterType = "is",
  presetMode,
  showTwoMonths = true,
  label,
  className,
  yearRange = 10,
  baseYear,
  minYear,
  maxYear,
  i18n: i18nOverride,
  weekStartsOn,
  withTime = false,
}) {
  const mergedI18n = useMemo(
    () => ({ ...DEFAULT_DATE_SELECTOR_I18N, ...i18nOverride }),
    [i18nOverride],
  );

  // Memo value Provider agar consumer (Tabs/Grid/DayPicker) tak re-render tiap
  // render parent (perf: kurangi render saat popover muncul).
  const contextValue = useMemo(
    () => ({ i18n: mergedI18n, variant: "outline", size: "default" }),
    [mergedI18n],
  );

  const selector = useDateSelector({
    value,
    onChange,
    defaultPeriodType,
    defaultFilterType,
    presetMode,
    allowRange,
    yearRange,
    baseYear,
    minYear,
    maxYear,
    periodTypes,
  });

  const {
    periodType,
    filterType,
    selectedDate,
    selectedEndDate,
    calendarMonth,
    selectedYear,
    selectedMonth,
    selectedQuarter,
    selectedHalfYear,
    rangeStart,
    rangeEnd,
    hoverDate,
    hoverPeriod,
    years,
    setPeriodType,
    setFilterType,
    setSelectedDate,
    setCalendarMonth,
    setHoverDate,
    setHoverPeriod,
    handleDayClick,
    handlePeriodSelect,
    handleYearSelect,
    isInRange,
    isYearInRange,
  } = selector;

  const isRange = isRangeFilterType(filterType) && allowRange;

  // Time picker hanya untuk datetime + period=day + operator non-range.
  const showTimePicker = withTime && periodType === "day" && !isRange;

  // Penanda paksa-scroll. Klik "Today" pada nilai yang sama tak mengubah
  // selectedYear/value, sehingga effect scroll (deps berbasis nilai) tak fire.
  // Bump counter ini agar effect re-run tanpa peduli nilai berubah atau tidak.
  const [scrollTick, setScrollTick] = useState(0);

  return (
    <DateSelectorContext.Provider value={contextValue}>
      <div className={cn("w-[256px]", className)}>
        {label && (
          <h3 className="text-sm font-medium" data-slot="data-selector-label">
            {label}
          </h3>
        )}
        {/* Dua Select berlabel: granularitas periode + operator komparasi. */}
        <div className="grid grid-cols-2 gap-2">
          <DateSelectorFilterToggle
            value={filterType}
            onChange={setFilterType}
            showBetween={allowRange}
            presetMode={presetMode}
          />
          <DateSelectorPeriodTabs
            value={periodType}
            onChange={setPeriodType}
            periodTypes={periodTypes}
          />
        </div>

        {/* Pintasan ke periode sekarang (hari ini / bulan ini / dst). */}
        <div className="flex justify-start mt-2 mb-1">
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={() => {
              setScrollTick((t) => t + 1);
              const now = new Date();
              const y = now.getFullYear();
              switch (periodType) {
                case "day":
                  setCalendarMonth(now);
                  handleDayClick(now);
                  break;
                case "month":
                  handlePeriodSelect(y, now.getMonth());
                  break;
                case "quarter":
                  handlePeriodSelect(y, Math.floor(now.getMonth() / 3));
                  break;
                case "half-year":
                  handlePeriodSelect(y, now.getMonth() < 6 ? 0 : 1);
                  break;
                case "year":
                  handleYearSelect(y);
                  break;
                default:
                  break;
              }
            }}
          >
            {mergedI18n.todayLabels?.[periodType] ?? mergedI18n.today}
          </Button>
        </div>
        {periodType === "day" ? (
          <div className="w-full pb-1">
            <DateSelectorDayPicker
              currentMonth={calendarMonth}
              onMonthChange={setCalendarMonth}
              selectedDate={selectedDate}
              selectedEndDate={selectedEndDate}
              onDayClick={handleDayClick}
              isRange={isRangeFilterType(filterType) && allowRange}
              onDayHover={setHoverDate}
              hoverDate={hoverDate}
              years={years}
              showTwoMonths={showTwoMonths}
              weekStartsOn={weekStartsOn}
              withTime={showTimePicker}
              timeValue={selectedDate}
              scrollTick={scrollTick}
              onTimeChange={(next) => {
                setSelectedDate(next);
                setCalendarMonth(next);
              }}
            />
          </div>
        ) : (
          <div className="-mr-3 w-full">
            <ScrollArea key={periodType} className="h-[200px] w-full pe-3">
              {periodType === "month" && (
                <DateSelectorPeriodGrid
                  years={years}
                  items={mergedI18n.monthsShort}
                  selectedYear={selectedYear}
                  selectedValue={selectedMonth}
                  rangeStart={rangeStart}
                  rangeEnd={rangeEnd}
                  hoverPeriod={hoverPeriod}
                  onHover={setHoverPeriod}
                  isRange={isRange}
                  isInRange={isInRange}
                  onSelect={handlePeriodSelect}
                  columns={3}
                  scrollTick={scrollTick}
                />
              )}
              {periodType === "quarter" && (
                <DateSelectorPeriodGrid
                  years={years}
                  items={mergedI18n.quarters}
                  selectedYear={selectedYear}
                  selectedValue={selectedQuarter}
                  rangeStart={rangeStart}
                  rangeEnd={rangeEnd}
                  hoverPeriod={hoverPeriod}
                  onHover={setHoverPeriod}
                  isRange={isRange}
                  isInRange={isInRange}
                  onSelect={handlePeriodSelect}
                  columns={4}
                  scrollTick={scrollTick}
                />
              )}
              {periodType === "half-year" && (
                <DateSelectorPeriodGrid
                  years={years}
                  items={mergedI18n.halfYears}
                  selectedYear={selectedYear}
                  selectedValue={selectedHalfYear}
                  rangeStart={rangeStart}
                  rangeEnd={rangeEnd}
                  hoverPeriod={hoverPeriod}
                  onHover={setHoverPeriod}
                  isRange={isRange}
                  isInRange={isInRange}
                  onSelect={handlePeriodSelect}
                  columns={2}
                  scrollTick={scrollTick}
                />
              )}
              {periodType === "year" && (
                <DateSelectorYearList
                  years={years}
                  selectedYear={selectedYear}
                  rangeStart={rangeStart}
                  rangeEnd={rangeEnd}
                  hoverPeriod={hoverPeriod}
                  onHover={setHoverPeriod}
                  isRange={isRange}
                  isYearInRange={isYearInRange}
                  onSelect={handleYearSelect}
                  scrollTick={scrollTick}
                />
              )}
            </ScrollArea>
          </div>
        )}
      </div>
    </DateSelectorContext.Provider>
  );
}
