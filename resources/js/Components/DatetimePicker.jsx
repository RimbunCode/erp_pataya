import { CalendarIcon, XIcon } from "lucide-react";
import { TZDate } from "react-day-picker";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/Components/ui/popover";
import { Tooltip, TooltipTrigger } from "./ui/tooltip";
import { format, isValid, parse } from "date-fns";
import { cn, getLocaleDate, mergeRefs } from "@/lib/utils";
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
import { Command } from "cmdk";
import {
  DateSelectorContext,
  DateSelectorDayPicker,
  DEFAULT_DATE_SELECTOR_I18N,
} from "@/Components/ui/date-selector";
import { Input } from "./ui/input";
import { useLaravelReactI18n } from "laravel-react-i18n";
import { usePage } from "@inertiajs/react";

const DATE_DISPLAY_FORMAT = "PPP";
const DATETIME_DISPLAY_FORMAT = "PPPp";
const DATE_INPUT_FORMATS = [
  "yyyy-MM-dd",
  "dd-MM-yyyy",
  "dd/MM/yyyy",
  "dd.MM.yyyy",
  "MM/dd/yyyy",
  "M/d/yyyy",
  "d/M/yyyy",
  "d MMMM yyyy",
  "d MMM yyyy",
  "MMMM d yyyy",
  "MMM d yyyy",
  "d LLLL yyyy",
  "LLLL d yyyy",
  "PPP",
];
const DATETIME_INPUT_FORMATS = [
  "yyyy-MM-dd HH:mm:ss",
  "yyyy-MM-dd HH:mm",
  "yyyy-MM-dd H:m:s",
  "yyyy-MM-dd H:m",
  "yyyy-MM-dd HH.mm",
  "yyyy-MM-dd'T'HH:mm:ss",
  "yyyy-MM-dd'T'HH:mm",
  "dd-MM-yyyy HH:mm:ss",
  "dd-MM-yyyy HH:mm",
  "dd-MM-yyyy H:m:s",
  "dd-MM-yyyy H:m",
  "dd/MM/yyyy HH:mm:ss",
  "dd/MM/yyyy HH:mm",
  "dd/MM/yyyy H:m:s",
  "dd/MM/yyyy H:m",
  "dd.MM.yyyy HH:mm:ss",
  "dd.MM.yyyy HH:mm",
  "dd.MM.yyyy H:m:s",
  "dd.MM.yyyy H:m",
  "MM/dd/yyyy HH:mm:ss",
  "MM/dd/yyyy HH:mm",
  "MM/dd/yyyy H:m:s",
  "MM/dd/yyyy H:m",
  "d MMMM yyyy HH:mm:ss",
  "d MMMM yyyy HH:mm",
  "d MMMM yyyy H:m:s",
  "d MMMM yyyy H:m",
  "d MMM yyyy HH:mm:ss",
  "d MMM yyyy HH:mm",
  "d MMM yyyy H:m:s",
  "d MMM yyyy H:m",
  "MMMM d yyyy HH:mm:ss",
  "MMMM d yyyy HH:mm",
  "MMMM d yyyy H:m:s",
  "MMMM d yyyy H:m",
  "d LLLL yyyy HH:mm:ss",
  "d LLLL yyyy HH:mm",
  "d LLLL yyyy H:m:s",
  "d LLLL yyyy H:m",
  "yyyy-MM-dd hh:mm a",
  "yyyy-MM-dd h:m a",
  "dd-MM-yyyy hh:mm a",
  "dd-MM-yyyy h:m a",
  "dd/MM/yyyy hh:mm a",
  "dd/MM/yyyy h:m a",
  "dd.MM.yyyy hh:mm a",
  "dd.MM.yyyy h:m a",
  "MM/dd/yyyy hh:mm a",
  "MM/dd/yyyy h:m a",
  "d MMMM yyyy hh:mm a",
  "d MMMM yyyy h:m a",
  "d MMM yyyy hh:mm a",
  "d MMM yyyy h:m a",
  "MMMM d yyyy hh:mm a",
  "MMMM d yyyy h:m a",
  "d LLLL yyyy hh:mm a",
  "d LLLL yyyy h:m a",
  "PPPp",
  "PPP p",
  "PPP",
];

export default memo(
  forwardRef(function DateTimePicker(
    {
      id,
      className,
      type = "datetime",
      required,
      placeholder,
      onKeyDown,
      value,
      onValueChange,
      min,
      max,
      timezone,
      hideTime,
      disabled,
      modal = false,
      readOnly,
      yearRange = 11,
      baseYear,
      minYear,
      maxYear,
    },
    ref,
  ) {
    const { t } = useLaravelReactI18n();
    const lang = usePage().props.lang;
    const dateLocale = useMemo(() => getLocaleDate(lang), [lang]);
    const parseLocales = useMemo(() => {
      return Array.from(
        new Set([dateLocale, getLocaleDate("id"), getLocaleDate("en")]),
      );
    }, [dateLocale]);
    const dateParseFormats = useMemo(
      () => Array.from(new Set([DATE_DISPLAY_FORMAT, ...DATE_INPUT_FORMATS])),
      [],
    );
    const datetimeParseFormats = useMemo(
      () =>
        Array.from(
          new Set([
            DATETIME_DISPLAY_FORMAT,
            DATE_DISPLAY_FORMAT,
            ...DATETIME_INPUT_FORMATS,
          ]),
        ),
      [],
    );
    const [search, setSearch] = useState("");
    const inputRef = useRef(null);
    const commandRef = useRef(null);
    const [open, setOpen] = useState(false);
    const wasOpenRef = useRef(false);
    const prevOpenRef = useRef(false);
    const initDate = useMemo(() => {
      if (!value) {
        return undefined;
      }

      if (type === "daterange") {
        const anchorDate = value?.from ?? value?.to;
        return anchorDate ? new TZDate(anchorDate, timezone) : undefined;
      }

      if (type === "multipleDate") {
        const anchorDate = Array.isArray(value) ? value.at(0) : undefined;
        return anchorDate ? new TZDate(anchorDate, timezone) : undefined;
      }

      return new TZDate(value, timezone);
    }, [type, value, timezone]);

    const initialSelectedValue = useMemo(() => {
      if (!value) {
        return undefined;
      }

      if (type === "daterange" || type === "multipleDate") {
        return value;
      }

      return new TZDate(value, timezone);
    }, [type, value, timezone]);

    const defaultCalendarDate = useMemo(
      () => new TZDate(new Date(), timezone),
      [timezone],
    );

    const [month, setMonth] = useState(initDate ?? defaultCalendarDate);
    const [date, setDate] = useState(initialSelectedValue);
    const [timeDraft, setTimeDraft] = useState(() =>
      initDate ? new Date(initDate) : new Date(),
    );
    const [hoverDate, setHoverDate] = useState(undefined);

    const minDate = useMemo(
      () => (min ? new TZDate(min, timezone) : undefined),
      [min, timezone],
    );
    const maxDate = useMemo(
      () => (max ? new TZDate(max, timezone) : undefined),
      [max, timezone],
    );

    const years = useMemo(() => {
      const currentYear = baseYear ?? new Date().getFullYear();
      const effectiveMinYear =
        minYear ?? (minDate ? minDate.getFullYear() : undefined);
      const effectiveMaxYear =
        maxYear ?? (maxDate ? maxDate.getFullYear() : undefined);
      const hasMin = effectiveMinYear !== undefined;
      const hasMax = effectiveMaxYear !== undefined;
      if (hasMin && hasMax) {
        return Array.from(
          { length: effectiveMaxYear - effectiveMinYear + 1 },
          (_, i) => effectiveMinYear + i,
        );
      }
      if (hasMin) {
        return Array.from(
          { length: yearRange + 1 },
          (_, i) => effectiveMinYear + i,
        );
      }
      if (hasMax) {
        return Array.from(
          { length: yearRange + 1 },
          (_, i) => effectiveMaxYear - yearRange + i,
        );
      }
      return Array.from(
        { length: yearRange },
        (_, i) => currentYear - Math.floor(yearRange / 2) + i,
      );
    }, [baseYear, yearRange, minYear, maxYear, minDate, maxDate]);

    const clampDateValue = useCallback(
      (inputDate) => {
        let nextDate = new Date(inputDate);

        if (minDate && nextDate < minDate) {
          nextDate = new Date(minDate);
        }

        if (maxDate && nextDate > maxDate) {
          nextDate = new Date(maxDate);
        }

        return nextDate;
      },
      [maxDate, minDate],
    );

    const parseByFormats = useCallback(
      (input, formats) => {
        const referenceDate = initDate ?? defaultCalendarDate;
        const normalizedInput = (input ?? "")
          .trim()
          .replace(/\s+/g, " ")
          .replace(/\b(pukul|jam|at)\b/gi, " ")
          .replace(/\s+/g, " ")
          .trim();
        const normalizedTimeSeparator = normalizedInput.replace(
          /(^|\s)(\d{1,2})[:.](\d{1,2})(?:[:.](\d{1,2}))?(?=\s|$)/g,
          (_, prefix, hh, mm, ss) =>
            `${prefix}${hh.padStart(2, "0")}:${mm.padStart(2, "0")}${ss ? `:${ss.padStart(2, "0")}` : ""}`,
        );
        const candidates = Array.from(
          new Set([input, normalizedInput, normalizedTimeSeparator]),
        ).filter(Boolean);

        for (const candidate of candidates) {
          for (const locale of parseLocales) {
            for (const formatString of formats) {
              const parsedDate = parse(candidate, formatString, referenceDate, {
                locale,
              });

              if (isValid(parsedDate)) {
                return parsedDate;
              }
            }
          }
        }

        return null;
      },
      [defaultCalendarDate, initDate, parseLocales],
    );

    const onDayChanged = useCallback(
      (nextValue) => {
        if (!nextValue) {
          setDate(null);
          onValueChange?.(null);
          return;
        }

        if (type === "datetime") {
          const nextDate = new Date(nextValue);
          const timeSource =
            date ?? timeDraft ?? initDate ?? defaultCalendarDate;

          nextDate.setHours(
            timeSource.getHours(),
            timeSource.getMinutes(),
            timeSource.getSeconds(),
            timeSource.getMilliseconds(),
          );

          if (minDate && nextDate < minDate) {
            nextDate.setHours(
              minDate.getHours(),
              minDate.getMinutes(),
              minDate.getSeconds(),
              minDate.getMilliseconds(),
            );
          }

          if (maxDate && nextDate > maxDate) {
            nextDate.setHours(
              maxDate.getHours(),
              maxDate.getMinutes(),
              maxDate.getSeconds(),
              maxDate.getMilliseconds(),
            );
          }

          setDate(nextDate);
          onValueChange?.(new Date(nextDate));
          return;
        }

        setDate(nextValue);
        onValueChange?.(nextValue);
      },
      [
        date,
        defaultCalendarDate,
        initDate,
        maxDate,
        minDate,
        onValueChange,
        timeDraft,
        type,
      ],
    );

    const handleDayClick = useCallback(
      (dayOrDays) => {
        if (type === "daterange") {
          if (!date?.from || (date?.from && date?.to)) {
            const next = { from: dayOrDays, to: undefined };
            setDate(next);
            onValueChange?.(next);
          } else if (dayOrDays < date.from) {
            const next = { from: dayOrDays, to: date.from };
            setDate(next);
            onValueChange?.(next);
          } else {
            const next = { from: date.from, to: dayOrDays };
            setDate(next);
            onValueChange?.(next);
          }
        } else if (type === "multipleDate") {
          const next = dayOrDays ?? [];
          setDate(next);
          onValueChange?.(next);
        } else {
          onDayChanged(dayOrDays);
        }
      },
      [type, date, onDayChanged, onValueChange],
    );

    const handleTimeChange = useCallback(
      (nextDate) => {
        if (!isValid(nextDate)) return;
        setTimeDraft(nextDate);
        if (!(date instanceof Date)) {
          const clamped = clampDateValue(nextDate);
          setDate(clamped);
          setMonth(clamped);
          onValueChange?.(new Date(clamped));
          return;
        }
        setDate(nextDate);
        onValueChange?.(new Date(nextDate));
      },
      [date, clampDateValue, onValueChange],
    );

    useEffect(() => {
      if (open && !wasOpenRef.current) {
        setDate(initialSelectedValue);
        setMonth(initDate ?? defaultCalendarDate);
        setHoverDate(undefined);
        if (initialSelectedValue instanceof Date) {
          setTimeDraft(new Date(initialSelectedValue));
        } else {
          setTimeDraft(new Date());
        }
      }
      wasOpenRef.current = open;
    }, [defaultCalendarDate, initialSelectedValue, open, initDate]);

    const timePickerValue = useMemo(() => {
      if (date instanceof Date) {
        return date;
      }

      return timeDraft;
    }, [date, timeDraft]);

    const getDateValue = useCallback(
      (value) => {
        switch (type) {
          case "daterange": {
            if (value?.from) {
              const from = format(value.from, DATE_DISPLAY_FORMAT, {
                locale: dateLocale,
              });
              if (value?.to) {
                const to = format(value.to, DATE_DISPLAY_FORMAT, {
                  locale: dateLocale,
                });
                return `${from} - ${to}`;
              }
              return from;
            }
            break;
          }
          case "multipleDate": {
            if (!Array.isArray(value)) {
              return "";
            }
            return (
              value
                ?.map((date) =>
                  format(date, DATE_DISPLAY_FORMAT, { locale: dateLocale }),
                )
                .join(", ") ?? []
            );
          }
          case "date": {
            if (value) {
              return format(value, DATE_DISPLAY_FORMAT, { locale: dateLocale });
            }
            break;
          }
          case "datetime": {
            if (value) {
              return format(value, DATETIME_DISPLAY_FORMAT, {
                locale: dateLocale,
              });
            }
            break;
          }
        }
        return "";
      },
      [dateLocale, type],
    );

    // useEffect(() => {
    //   if (!open || search || isValid) return;
    //   setValue(Date.now());
    // }, [open]);
    useEffect(() => {
      if (inputRef.current && document.activeElement === inputRef.current) {
        return;
      }

      if (value) {
        const val = getDateValue(value);
        setSearch(val);
      } else if (!open) {
        setSearch("");
      }
    }, [getDateValue, value, open]);

    const commitInputValue = useCallback(
      (inputValue) => {
        if (readOnly || disabled) {
          return false;
        }

        const rawValue = (inputValue ?? "").trim();
        const currentValueText = value ? getDateValue(value) : "";

        if (!rawValue) {
          if (value == null) {
            setSearch("");
            return true;
          }
          onDayChanged(null);
          setSearch("");
          return true;
        }

        if (rawValue === currentValueText) {
          setSearch(currentValueText);
          return true;
        }

        if (type === "daterange") {
          const rangeParts = rawValue.includes(" - ")
            ? rawValue.split(/\s+-\s+/)
            : rawValue.split(/\s+(?:to|until|s\/d|sampai|hingga)\s+/i);

          if (rangeParts.length > 2 || rangeParts.length <= 0) {
            setSearch(value ? getDateValue(value) : "");
            return false;
          }

          const fromRaw = rangeParts.at(0)?.trim() ?? "";
          const toRaw = rangeParts.at(1)?.trim() ?? "";

          const fromDate = fromRaw
            ? parseByFormats(fromRaw, dateParseFormats)
            : null;
          const toDate = toRaw ? parseByFormats(toRaw, dateParseFormats) : null;

          if (!fromDate || (toRaw && !toDate)) {
            setSearch(value ? getDateValue(value) : "");
            return false;
          }

          let fromValue = clampDateValue(fromDate);
          let toValue = toDate ? clampDateValue(toDate) : undefined;

          if (toValue && toValue < fromValue) {
            [fromValue, toValue] = [toValue, fromValue];
          }

          const nextRangeValue = { from: fromValue, to: toValue };

          setDate(nextRangeValue);
          setMonth(fromValue);
          onValueChange?.(nextRangeValue);
          setSearch(getDateValue(nextRangeValue));

          return true;
        }

        if (type === "multipleDate") {
          const parsedValues = rawValue
            .split(",")
            .map((item) => item.trim())
            .filter(Boolean)
            .map((item) => parseByFormats(item, dateParseFormats));

          if (parsedValues.some((item) => !item)) {
            setSearch(value ? getDateValue(value) : "");
            return false;
          }

          const nextValues = parsedValues.map((item) => clampDateValue(item));

          setDate(nextValues);
          if (nextValues.length > 0) {
            setMonth(nextValues[0]);
          }
          onValueChange?.(nextValues);
          setSearch(getDateValue(nextValues));

          return true;
        }

        const parsedValue = parseByFormats(
          rawValue,
          type === "datetime" ? datetimeParseFormats : dateParseFormats,
        );

        if (!parsedValue) {
          setSearch(value ? getDateValue(value) : "");
          return false;
        }

        let nextDateValue = new Date(parsedValue);

        if (type === "datetime") {
          const hasTimeInput =
            /(?:\d{1,2}[:.]\d{1,2})(?:[:.]\d{1,2})?|\b(am|pm)\b/i.test(
              rawValue,
            );

          if (!hasTimeInput) {
            const timeSource =
              date instanceof Date
                ? date
                : (timeDraft ?? initDate ?? defaultCalendarDate);

            nextDateValue.setHours(
              timeSource.getHours(),
              timeSource.getMinutes(),
              timeSource.getSeconds(),
              timeSource.getMilliseconds(),
            );
          }
        }

        nextDateValue = clampDateValue(nextDateValue);

        setDate(nextDateValue);
        setMonth(nextDateValue);
        onValueChange?.(
          type === "datetime" ? new Date(nextDateValue) : nextDateValue,
        );
        setSearch(getDateValue(nextDateValue));

        return true;
      },
      [
        clampDateValue,
        date,
        defaultCalendarDate,
        disabled,
        getDateValue,
        initDate,
        onDayChanged,
        onValueChange,
        parseByFormats,
        dateParseFormats,
        datetimeParseFormats,
        readOnly,
        timeDraft,
        type,
        value,
      ],
    );

    useEffect(() => {
      if (prevOpenRef.current && !open) {
        const rawValue = inputRef.current?.value ?? search;
        const timeoutId = setTimeout(() => {
          commitInputValue(rawValue);
        }, 0);

        prevOpenRef.current = open;

        return () => clearTimeout(timeoutId);
      }

      prevOpenRef.current = open;
    }, [commitInputValue, open, search]);

    const onInputKeyDown = (e) => {
      if (e.ctrlKey || e.metaKey || e.shiftKey || e.altKey) {
        onKeyDown?.(e);
        return;
      }

      if (e.key === "Enter") {
        e.preventDefault();
        commitInputValue(e.currentTarget.value);
        setOpen(false);
        onKeyDown?.(e);
        return;
      }

      if (e.key === "Tab") {
        commitInputValue(e.currentTarget.value);
        onKeyDown?.(e);
        return;
      }

      if (e.key === "Escape") {
        setOpen(false);
        onKeyDown?.(e);
        return;
      }

      if (e.key === "ArrowDown" && !open && !readOnly && !disabled) {
        setOpen(true);
      }

      onKeyDown?.(e);
    };
    return (
      <Popover open={open} onOpenChange={setOpen} modal={modal}>
        <Command
          className="relative h-full w-full overflow-visible bg-transparent"
          ref={commandRef}
          loop
        >
          <Tooltip>
            <TooltipTrigger asChild>
              <PopoverTrigger
                asChild
                className={cn(
                  "flex h-full bg-muted items-center  overflow-hidden border rounded-md cursor-default group/model relative focus-within:border-0 border-input ring-offset-background  focus-within:outline-none focus-within:ring-1 focus-within:ring-ring focus-within:ring-offset-1",
                  // valueBefore !== undefined &&
                  // !diff?.same &&
                  // "bg-yellow-200 dark:bg-yellow-900",
                  disabled && "cursor-not-allowed opacity-50",
                  className,
                )}
              >
                <div>
                  <div className="flex items-center h-8 pl-2 w-fit gap-x-2">
                    <CalendarIcon className="size-4" />
                  </div>
                  <Input
                    id={id}
                    ref={mergeRefs(ref, inputRef)}
                    type="text"
                    placeholder={
                      placeholder ?? t(`core.form.${type}.placeholder`)
                    }
                    disabled={disabled}
                    readOnly={readOnly}
                    onKeyDown={onInputKeyDown}
                    onClick={(e) => {
                      e.preventDefault();
                      if (!open && !readOnly && !disabled) {
                        setOpen(true);
                      }
                    }}
                    onBlur={(e) => {
                      if (open) {
                        return;
                      }
                      commitInputValue(e.target.value);
                    }}
                    required={required}
                    value={search}
                    onChange={(e) => {
                      setSearch(e.target.value);
                    }}
                    className={cn(
                      "focus:border-0! bg-inherit! disabled:opacity-100! h-8 w-full rounded-none! px-2! border-0!  focus-visible:ring-0! focus-visible:ring-offset-0!  ",
                      // diff.same && "text-",
                    )}
                  />
                  <div className="flex items-center pr-2 w-fit gap-x-2">
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className={cn(
                        "size-6 ",
                        (!search || disabled || readOnly) && "hidden",
                      )}
                      onClick={() => {
                        onDayChanged(null);
                        setSearch("");
                      }}
                    >
                      <XIcon className="size-3" />
                    </Button>
                  </div>
                </div>
              </PopoverTrigger>
            </TooltipTrigger>
            {/* {valueBefore && !diff?.same && (
              <TooltipContent side="top" align="start">
                {diff?.before && (
                  <>
                    <s>{diff?.before}</s>
                    <br />
                  </>
                )}
                <span>{diff?.after}</span>
              </TooltipContent>
            )} */}
          </Tooltip>
          {!(disabled || readOnly) && (
            <PopoverContent
              className="relative z-50 w-auto p-2"
              onOpenAutoFocus={(e) => e.preventDefault()}
              align="start"
              side="bottom"
              forceMount
            >
              <DateSelectorContext.Provider
                value={{
                  i18n: DEFAULT_DATE_SELECTOR_I18N,
                  variant: "outline",
                  size: "default",
                }}
              >
                <DateSelectorDayPicker
                  currentMonth={month}
                  onMonthChange={setMonth}
                  selectedDate={
                    type === "daterange"
                      ? date?.from
                      : date instanceof Date
                        ? date
                        : undefined
                  }
                  selectedEndDate={type === "daterange" ? date?.to : undefined}
                  selectedDates={
                    type === "multipleDate" && Array.isArray(date)
                      ? date
                      : undefined
                  }
                  onDayClick={handleDayClick}
                  isRange={type === "daterange"}
                  mode={type === "multipleDate" ? "multiple" : undefined}
                  onDayHover={type === "daterange" ? setHoverDate : undefined}
                  hoverDate={hoverDate}
                  years={years}
                  showTwoMonths={false}
                  minDate={minDate}
                  maxDate={maxDate}
                  withTime={!hideTime && type === "datetime"}
                  timeValue={timePickerValue}
                  onTimeChange={handleTimeChange}
                  scrollTick={0}
                />
              </DateSelectorContext.Provider>
            </PopoverContent>
          )}
        </Command>
      </Popover>
    );
  }),
);
