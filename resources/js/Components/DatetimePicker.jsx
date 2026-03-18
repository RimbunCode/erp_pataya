import {
  CalendarIcon,
  CheckIcon,
  ChevronDownIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  ChevronUpIcon,
  Clock,
  XIcon,
} from "lucide-react";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "./ui/collapsible";
import { DayPicker, TZDate } from "react-day-picker";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/Components/ui/popover";
import { Tooltip, TooltipTrigger } from "./ui/tooltip";
import {
  addHours,
  addMonths,
  endOfDay,
  endOfHour,
  endOfMinute,
  endOfMonth,
  endOfYear,
  format,
  getMonth,
  getYear,
  isValid,
  parse,
  setHours,
  setMilliseconds,
  setMinutes,
  setMonth as setMonthFns,
  setSeconds,
  setYear,
  startOfDay,
  startOfHour,
  startOfMinute,
  startOfMonth,
  startOfYear,
  subHours,
  subMonths,
} from "date-fns";
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
import { Input } from "./ui/input";
import { ScrollArea } from "@/Components/ui/scroll-area";
import { useLaravelReactI18n } from "laravel-react-i18n";
import { usePage } from "@inertiajs/react";

const AM_VALUE = 0;
const PM_VALUE = 1;
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
      use12HourFormat,
      disabled,
      timePicker = {
        hour: true,
        minute: true,
      },
      modal = false,
      readOnly,
      ...props
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
    const [monthYearPicker, setMonthYearPicker] = useState(false);
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

    const endMonth = useMemo(() => {
      return setYear(month, getYear(month) + 1);
    }, [month]);
    const minDate = useMemo(
      () => (min ? new TZDate(min, timezone) : undefined),
      [min, timezone],
    );
    const maxDate = useMemo(
      () => (max ? new TZDate(max, timezone) : undefined),
      [max, timezone],
    );
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

    const onMonthYearChanged = useCallback(
      (d, mode) => {
        setMonth(d);
        if (mode === "year") {
          setMonthYearPicker("month");
        } else {
          setMonthYearPicker(false);
        }
      },
      [setMonth, setMonthYearPicker],
    );
    const onNextMonth = useCallback(() => {
      setMonth(addMonths(month, 1));
    }, [month]);
    const onPrevMonth = useCallback(() => {
      setMonth(subMonths(month, 1));
    }, [month]);

    useEffect(() => {
      if (open && !wasOpenRef.current) {
        setDate(initialSelectedValue);
        setMonth(initDate ?? defaultCalendarDate);
        setMonthYearPicker(false);
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
              className="relative z-50 w-auto /min-w-(--radix-popover-trigger-width) p-2"
              onOpenAutoFocus={(e) => e.preventDefault()}
              align="start"
              side="bottom"
              forceMount
            >
              <div className="flex items-center justify-between">
                <div className="text-md font-bold ms-2 flex items-center cursor-pointer">
                  <div>
                    <span
                      onClick={() =>
                        setMonthYearPicker(
                          monthYearPicker === "month" ? false : "month",
                        )
                      }
                    >
                      {format(month, "MMMM")}
                    </span>
                    <span
                      className="ms-1"
                      onClick={() =>
                        setMonthYearPicker(
                          monthYearPicker === "year" ? false : "year",
                        )
                      }
                    >
                      {format(month, "yyyy")}
                    </span>
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() =>
                      setMonthYearPicker(monthYearPicker ? false : "year")
                    }
                  >
                    {monthYearPicker ? <ChevronUpIcon /> : <ChevronDownIcon />}
                  </Button>
                </div>
                <div
                  className={cn(
                    "flex space-x-2",
                    monthYearPicker ? "hidden" : "",
                  )}
                >
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={onPrevMonth}
                  >
                    <ChevronLeftIcon />
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={onNextMonth}
                  >
                    <ChevronRightIcon />
                  </Button>
                </div>
              </div>
              <div className="relative overflow-hidden">
                <DayPicker
                  timeZone={timezone}
                  mode={
                    type == "daterange"
                      ? "range"
                      : type == "multipleDate"
                        ? "multiple"
                        : "single"
                  }
                  selected={date}
                  onSelect={(d) => {
                    return d && onDayChanged(d);
                  }}
                  month={month}
                  endMonth={endMonth}
                  disabled={[
                    max ? { after: max } : null,
                    min ? { before: min } : null,
                  ].filter(Boolean)}
                  onMonthChange={setMonth}
                  classNames={{
                    dropdowns: "flex w-full gap-2",
                    months: "flex w-full h-fit",
                    month: "flex flex-col w-full",
                    month_caption: "hidden",
                    button_previous: "hidden",
                    button_next: "hidden",
                    month_grid: "w-full border-collapse",
                    weekdays: "flex justify-between mt-2",
                    weekday:
                      "text-muted-foreground rounded-md w-9 font-normal text-[0.8rem]",
                    week: "flex w-full justify-between mt-2",
                    day: "h-9 w-9 text-center text-sm p-0 relative flex items-center justify-center  [&:has([aria-selected].day-range-end.day-range-start)]:rounded-full!  [&:has([aria-selected].day-range-end)]:rounded-r-md [&:has([aria-selected].day-outside)]:bg-accent/50 [&:has([aria-selected])]:bg-accent first:[&:has([aria-selected])]:rounded-l-md last:[&:has([aria-selected])]:rounded-r-md focus-within:relative focus-within:z-20 rounded-1",
                    day_button: cn(
                      // buttonVariants({ variant: "ghost" }),
                      "size-9 rounded-md p-0 font-normal aria-selected:opacity-100",
                    ),
                    today:
                      "border bg-muted border-muted-foreground [&:not([data-selected=true])]:rounded-full ",
                    outside:
                      "day-outside text-muted-foreground opacity-50 aria-selected:bg-accent/50 aria-selected:text-muted-foreground aria-selected:opacity-30",
                    disabled: "text-muted-foreground opacity-50",
                    selected:
                      "bg-foreground! text-background! border-none! hover:bg-foreground hover:text-background focus:bg-foreground focus:text-background [&:not(.day-range-start):not(.day-range-middle):not(.day-range-end)]:rounded-full",
                    range_start: "day-range-start rounded-l-full ",
                    range_middle: "day-range-middle rounded-none!",
                    range_end: "day-range-end rounded-r-full ",
                    hidden: "invisible",
                  }}
                  showOutsideDays={true}
                  {...props}
                />
                <div
                  className={cn(
                    "absolute top-0 left-0 bottom-0 right-0",
                    monthYearPicker ? "bg-popover" : "hidden",
                  )}
                ></div>
                <MonthYearPicker
                  value={month}
                  mode={monthYearPicker}
                  onChange={onMonthYearChanged}
                  minDate={minDate}
                  maxDate={maxDate}
                  className={cn(
                    "absolute top-0 left-0 bottom-0 right-0 ",
                    monthYearPicker ? "" : "hidden",
                  )}
                />
              </div>
              <div className="flex flex-col gap-2 mt-2">
                {!hideTime && type === "datetime" && (
                  <TimePicker
                    timePicker={timePicker}
                    value={timePickerValue}
                    onChange={(nextDate) => {
                      if (!isValid(nextDate)) {
                        return;
                      }

                      if (
                        timePickerValue &&
                        timePickerValue.getTime() === nextDate.getTime()
                      ) {
                        return;
                      }

                      setTimeDraft(nextDate);
                      if (!(date instanceof Date)) {
                        const todayWithSelectedTime = new Date();
                        todayWithSelectedTime.setHours(
                          nextDate.getHours(),
                          nextDate.getMinutes(),
                          nextDate.getSeconds(),
                          nextDate.getMilliseconds(),
                        );

                        const nextTodayDate = clampDateValue(
                          todayWithSelectedTime,
                        );
                        setDate(nextTodayDate);
                        setMonth(nextTodayDate);
                        onValueChange?.(new Date(nextTodayDate));

                        return;
                      }

                      setDate(nextDate);
                      onValueChange?.(new Date(nextDate));
                    }}
                    use12HourFormat={use12HourFormat}
                    min={minDate}
                    max={maxDate}
                  />
                )}
                {/* <div className="flex flex-row-reverse items-center justify-between">
                    <Button className="ms-2 h-7 px-2" onClick={onSubmit}>
                      Done
                    </Button>
                    {timezone && (
                      <div className="text-sm">
                        <span>Timezone:</span>
                        <span className="font-semibold ms-1">{timezone}</span>
                      </div>
                    )}
                  </div> */}
              </div>
            </PopoverContent>
          )}
        </Command>
      </Popover>
    );
  }),
);

function MonthYearPicker({
  value,
  minDate,
  maxDate,
  mode = "month",
  onChange,
  className,
}) {
  const yearRef = useRef(null);
  const years = useMemo(() => {
    const years = [];
    for (let i = 1912; i < 2100; i++) {
      let disabled = false;
      const startY = startOfYear(setYear(value, i));
      const endY = endOfYear(setYear(value, i));
      if (minDate && endY < minDate) disabled = true;
      if (maxDate && startY > maxDate) disabled = true;
      years.push({ value: i, label: i.toString(), disabled });
    }
    return years;
  }, [value, minDate, maxDate]);
  const months = useMemo(() => {
    const months = [];
    for (let i = 0; i < 12; i++) {
      let disabled = false;
      const startM = startOfMonth(setMonthFns(value, i));
      const endM = endOfMonth(setMonthFns(value, i));
      if (minDate && endM < minDate) disabled = true;
      if (maxDate && startM > maxDate) disabled = true;
      months.push({ value: i, label: format(new Date(0, i), "MMM"), disabled });
    }
    return months;
  }, [value, minDate, maxDate]);

  const onYearChange = useCallback(
    (v) => {
      let newDate = setYear(value, v.value);
      if (minDate && newDate < minDate) {
        newDate = setMonthFns(newDate, getMonth(minDate));
      }
      if (maxDate && newDate > maxDate) {
        newDate = setMonthFns(newDate, getMonth(maxDate));
      }
      onChange(newDate, "year");
    },
    [onChange, value, minDate, maxDate],
  );

  useEffect(() => {
    if (mode === "year") {
      yearRef.current?.scrollIntoView({ behavior: "auto", block: "center" });
    }
  }, [mode, value]);
  return (
    <div className={cn(className)}>
      <ScrollArea className="h-full">
        {mode === "year" && (
          <div className="grid grid-cols-4">
            {years.map((year) => (
              <div
                key={year.value}
                ref={year.value === getYear(value) ? yearRef : undefined}
              >
                <Button
                  type="button"
                  disabled={year.disabled}
                  variant={getYear(value) === year.value ? "default" : "ghost"}
                  className="rounded-full"
                  onClick={() => onYearChange(year)}
                >
                  {year.label}
                </Button>
              </div>
            ))}
          </div>
        )}
        {mode === "month" && (
          <div className="grid grid-cols-3 gap-4">
            {months.map((month) => (
              <Button
                type="button"
                key={month.value}
                size="lg"
                disabled={month.disabled}
                variant={getMonth(value) === month.value ? "default" : "ghost"}
                className="rounded-full"
                onClick={() =>
                  onChange(setMonthFns(value, month.value), "month")
                }
              >
                {month.label}
              </Button>
            ))}
          </div>
        )}
      </ScrollArea>
    </div>
  );
}

function TimePicker({
  value,
  onChange,
  use12HourFormat,
  min,
  max,
  timePicker,
}) {
  const { t } = useLaravelReactI18n();
  // hours24h = HH
  // hours12h = hh
  const formatStr = useMemo(
    () =>
      use12HourFormat
        ? "yyyy-MM-dd hh:mm:ss.SSS a xxxx"
        : "yyyy-MM-dd HH:mm:ss.SSS xxxx",
    [use12HourFormat],
  );
  const [ampm, setAmpm] = useState(
    format(value, "a") === "AM" ? AM_VALUE : PM_VALUE,
  );
  const [hour, setHour] = useState(
    use12HourFormat ? +format(value, "hh") : value.getHours(),
  );
  const [minute, setMinute] = useState(value.getMinutes());
  const [second, setSecond] = useState(value.getSeconds());
  const onChangeRef = useRef(onChange);

  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  useEffect(() => {
    onChangeRef.current?.(
      buildTime({
        use12HourFormat,
        value,
        formatStr,
        hour,
        minute,
        second,
        ampm,
      }),
    );
  }, [hour, minute, second, ampm, formatStr, use12HourFormat]);

  const _hourIn24h = useMemo(() => {
    // if (use12HourFormat) {
    //   return (hour % 12) + ampm * 12;
    // }
    return use12HourFormat ? (hour % 12) + ampm * 12 : hour;
  }, [hour, use12HourFormat, ampm]);

  const hours = useMemo(
    () =>
      Array.from({ length: use12HourFormat ? 12 : 24 }, (_, i) => {
        let disabled = false;
        const hourValue = use12HourFormat ? (i === 0 ? 12 : i) : i;
        const hDate = setHours(value, use12HourFormat ? i + ampm * 12 : i);
        const hStart = startOfHour(hDate);
        const hEnd = endOfHour(hDate);
        if (min && hEnd < min) disabled = true;
        if (max && hStart > max) disabled = true;
        return {
          value: hourValue,
          label: hourValue.toString().padStart(2, "0"),
          disabled,
        };
      }),
    [value, min, max, use12HourFormat, ampm],
  );
  const minutes = useMemo(() => {
    const anchorDate = setHours(value, _hourIn24h);
    return Array.from({ length: 60 }, (_, i) => {
      let disabled = false;
      const mDate = setMinutes(anchorDate, i);
      const mStart = startOfMinute(mDate);
      const mEnd = endOfMinute(mDate);
      if (min && mEnd < min) disabled = true;
      if (max && mStart > max) disabled = true;
      return {
        value: i,
        label: i.toString().padStart(2, "0"),
        disabled,
      };
    });
  }, [value, min, max, _hourIn24h]);
  const seconds = useMemo(() => {
    const anchorDate = setMilliseconds(
      setMinutes(setHours(value, _hourIn24h), minute),
      0,
    );
    const _min = min ? setMilliseconds(min, 0) : undefined;
    const _max = max ? setMilliseconds(max, 0) : undefined;
    return Array.from({ length: 60 }, (_, i) => {
      let disabled = false;
      const sDate = setSeconds(anchorDate, i);
      if (_min && sDate < _min) disabled = true;
      if (_max && sDate > _max) disabled = true;
      return {
        value: i,
        label: i.toString().padStart(2, "0"),
        disabled,
      };
    });
  }, [value, minute, min, max, _hourIn24h]);
  const ampmOptions = useMemo(() => {
    const startD = startOfDay(value);
    const endD = endOfDay(value);
    return [
      { value: AM_VALUE, label: "AM" },
      { value: PM_VALUE, label: "PM" },
    ].map((v) => {
      let disabled = false;
      const start = addHours(startD, v.value * 12);
      const end = subHours(endD, (1 - v.value) * 12);
      if (min && end < min) disabled = true;
      if (max && start > max) disabled = true;
      return { ...v, disabled };
    });
  }, [value, min, max]);

  const [open, setOpen] = useState(false);

  const hourRef = useRef(null);
  const minuteRef = useRef(null);
  const secondRef = useRef(null);

  useEffect(() => {
    const timeoutId = setTimeout(() => {
      if (open) {
        hourRef.current?.scrollIntoView({ behavior: "auto" });
        minuteRef.current?.scrollIntoView({ behavior: "auto" });
        secondRef.current?.scrollIntoView({ behavior: "auto" });
      }
    }, 1);
    return () => clearTimeout(timeoutId);
  }, [open]);

  const onHourChange = useCallback(
    (v) => {
      if (min) {
        let newTime = buildTime({
          use12HourFormat,
          value,
          formatStr,
          hour: v.value,
          minute,
          second,
          ampm,
        });
        if (newTime < min) {
          setMinute(min.getMinutes());
          setSecond(min.getSeconds());
        }
      }
      if (max) {
        let newTime = buildTime({
          use12HourFormat,
          value,
          formatStr,
          hour: v.value,
          minute,
          second,
          ampm,
        });
        if (newTime > max) {
          setMinute(max.getMinutes());
          setSecond(max.getSeconds());
        }
      }
      setHour(v.value);
    },
    [use12HourFormat, value, formatStr, minute, second, ampm, min, max],
  );

  const onMinuteChange = useCallback(
    (v) => {
      if (min) {
        let newTime = buildTime({
          use12HourFormat,
          value,
          formatStr,
          hour,
          minute: v.value,
          second,
          ampm,
        });
        if (newTime < min) {
          setSecond(min.getSeconds());
        }
      }
      if (max) {
        let newTime = buildTime({
          use12HourFormat,
          value,
          formatStr,
          hour,
          minute: v.value,
          second,
          ampm,
        });
        if (newTime > max) {
          setSecond(newTime.getSeconds());
        }
      }
      setMinute(v.value);
    },
    [use12HourFormat, value, formatStr, hour, second, ampm, min, max],
  );

  const onAmpmChange = useCallback(
    (v) => {
      if (min) {
        let newTime = buildTime({
          use12HourFormat,
          value,
          formatStr,
          hour,
          minute,
          second,
          ampm: v.value,
        });
        if (newTime < min) {
          const minH = min.getHours() % 12;
          setHour(minH === 0 ? 12 : minH);
          setMinute(min.getMinutes());
          setSecond(min.getSeconds());
        }
      }
      if (max) {
        let newTime = buildTime({
          use12HourFormat,
          value,
          formatStr,
          hour,
          minute,
          second,
          ampm: v.value,
        });
        if (newTime > max) {
          const maxH = max.getHours() % 12;
          setHour(maxH === 0 ? 12 : maxH);
          setMinute(max.getMinutes());
          setSecond(max.getSeconds());
        }
      }
      setAmpm(v.value);
    },
    [use12HourFormat, value, formatStr, hour, minute, second, min, max],
  );

  const display = useMemo(() => {
    let arr = [];
    for (const element of ["hour", "minute", "second"]) {
      if (!timePicker || timePicker[element]) {
        if (element === "hour") {
          arr.push(use12HourFormat ? "hh" : "HH");
        } else {
          arr.push(element === "minute" ? "mm" : "ss");
        }
      }
    }
    return format(value, arr.join(":") + (use12HourFormat ? " a" : ""));
  }, [value, use12HourFormat, timePicker]);

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <CollapsibleTrigger asChild>
        <Button
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="justify-between w-full!"
        >
          <Clock className="mr-2 size-4" />
          {display}
          <ChevronDownIcon className="ml-2 size-4 shrink-0 opacity-50" />
        </Button>
      </CollapsibleTrigger>
      <CollapsibleContent className="p-0" side="top">
        <div className="flex-col gap-2 p-2">
          <div className="flex h-56 grow justify-center">
            {(!timePicker || timePicker.hour) && (
              <div className="h-full flex flex-col">
                <p className="h-8 text-center"> {t(".hour")}</p>
                <ScrollArea className="h-full grow">
                  <div className="flex grow flex-col items-stretch overflow-y-auto pe-2 pb-48">
                    {hours.map((v) => (
                      <div
                        key={v.value}
                        ref={v.value === hour ? hourRef : undefined}
                      >
                        <TimeItem
                          option={v}
                          selected={v.value === hour}
                          onSelect={onHourChange}
                          className="h-8"
                          disabled={v.disabled}
                        />
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              </div>
            )}
            {(!timePicker || timePicker.minute) && (
              <div className="h-full flex flex-col">
                <p className="h-8 text-center"> {t(".minute")}</p>
                <ScrollArea className="h-full grow">
                  <div className="flex grow flex-col items-stretch overflow-y-auto pe-2 pb-48">
                    {minutes.map((v) => (
                      <div
                        key={v.value}
                        ref={v.value === minute ? minuteRef : undefined}
                      >
                        <TimeItem
                          option={v}
                          selected={v.value === minute}
                          onSelect={onMinuteChange}
                          className="h-8"
                          disabled={v.disabled}
                        />
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              </div>
            )}
            {(!timePicker || timePicker.second) && (
              <div className="h-full flex flex-col">
                <p className="h-8 text-center"> {t(".second")}</p>
                <ScrollArea className="h-full grow">
                  <div className="flex grow flex-col items-stretch overflow-y-auto pe-2 pb-48">
                    {seconds.map((v) => (
                      <div
                        key={v.value}
                        ref={v.value === second ? secondRef : undefined}
                      >
                        <TimeItem
                          option={v}
                          selected={v.value === second}
                          onSelect={(v) => setSecond(v.value)}
                          className="h-8"
                          disabled={v.disabled}
                        />
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              </div>
            )}
            {use12HourFormat && (
              <div className="h-full flex flex-col">
                <p className="h-8 text-center"> </p>
                <ScrollArea className="h-full grow">
                  <div className="flex grow flex-col items-stretch overflow-y-auto pe-2">
                    {ampmOptions.map((v) => (
                      <TimeItem
                        key={v.value}
                        option={v}
                        selected={v.value === ampm}
                        onSelect={onAmpmChange}
                        className="h-8"
                        disabled={v.disabled}
                      />
                    ))}
                  </div>
                </ScrollArea>
              </div>
            )}
          </div>
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}

const TimeItem = ({ option, selected, onSelect, className, disabled }) => {
  return (
    <Button
      type="button"
      variant="ghost"
      className={cn("flex justify-center px-1 pe-2 ps-1", className)}
      onClick={() => onSelect(option)}
      disabled={disabled}
    >
      <div className="w-4">
        {selected && <CheckIcon className="my-auto size-4" />}
      </div>
      <span className="ms-2">{option.label}</span>
    </Button>
  );
};

function buildTime(options) {
  const { use12HourFormat, value, formatStr, hour, minute, second, ampm } =
    options;
  let date;
  if (use12HourFormat) {
    const dateStrRaw = format(value, formatStr);
    // yyyy-MM-dd hh:mm:ss.SSS a zzzz
    // 2024-10-14 01:20:07.524 AM GMT+00:00
    let dateStr =
      dateStrRaw.slice(0, 11) +
      hour.toString().padStart(2, "0") +
      dateStrRaw.slice(13);
    dateStr =
      dateStr.slice(0, 14) +
      minute.toString().padStart(2, "0") +
      dateStr.slice(16);
    dateStr =
      dateStr.slice(0, 17) +
      second.toString().padStart(2, "0") +
      dateStr.slice(19);
    dateStr =
      dateStr.slice(0, 24) +
      (ampm == AM_VALUE ? "AM" : "PM") +
      dateStr.slice(26);
    date = parse(dateStr, formatStr, value);
  } else {
    date = setHours(setMinutes(setSeconds(value, second), minute), hour);
  }
  return date;
}
