import { jsxs, jsx, Fragment } from "react/jsx-runtime";
import { P as Popover, a as PopoverTrigger, b as PopoverContent } from "./popover-CziqY8mR.js";
import { c as cn, a as getLocaleDate } from "./utils-ClCZGsDL.js";
import * as React from "react";
import React__default, { memo, forwardRef, useState, useRef, useCallback, useEffect } from "react";
import { b as buttonVariants, B as Button } from "./button-Us2TB7GG.js";
import { ChevronRight, ChevronLeft, Clock } from "lucide-react";
import { S as Select, a as SelectTrigger, b as SelectValue, c as SelectContent, d as SelectItem } from "./select-XM4G_Lvw.js";
import { DayPicker } from "react-day-picker";
import * as ScrollAreaPrimitive from "@radix-ui/react-scroll-area";
import { usePage } from "@inertiajs/react";
import { C as Command } from "./command-BSnyCa9u.js";
import { I as Input } from "./input-wk3Ou7wI.js";
import { format } from "date-fns";
import { useDetectClickOutside } from "react-detect-click-outside";
import { useLaravelReactI18n } from "laravel-react-i18n";
const ScrollArea = React.forwardRef(
  ({ className, children, ...props }, ref) => /* @__PURE__ */ jsxs(
    ScrollAreaPrimitive.Root,
    {
      ref,
      className: cn("relative overflow-hidden"),
      ...props,
      children: [
        /* @__PURE__ */ jsx(ScrollAreaPrimitive.Viewport, { className: "h-full w-full rounded-[inherit]", children: /* @__PURE__ */ jsx("div", { className, children }) }),
        /* @__PURE__ */ jsx(ScrollBar, {}),
        /* @__PURE__ */ jsx(ScrollAreaPrimitive.Corner, {})
      ]
    }
  )
);
ScrollArea.displayName = ScrollAreaPrimitive.Root.displayName;
const ScrollBar = React.forwardRef(
  ({ className, orientation = "vertical", ...props }, ref) => /* @__PURE__ */ jsx(
    ScrollAreaPrimitive.ScrollAreaScrollbar,
    {
      ref,
      orientation,
      className: cn(
        "flex touch-none select-none transition-colors",
        orientation === "vertical" && "h-full w-2.5 border-l border-l-transparent p-px",
        orientation === "horizontal" && "h-2.5 flex-col border-t border-t-transparent p-px",
        className
      ),
      ...props,
      children: /* @__PURE__ */ jsx(ScrollAreaPrimitive.ScrollAreaThumb, { className: "relative flex-1 rounded-full bg-border" })
    }
  )
);
ScrollBar.displayName = ScrollAreaPrimitive.ScrollAreaScrollbar.displayName;
const DropdownMonthYear = React.forwardRef(function DropdownMonthYear2({ value, onChange, children }, ref) {
  var _a;
  const options = React.Children.toArray(children);
  const selected = options.find((child) => child.props.value === value);
  const handleChange = (value2) => {
    const changeEvent = {
      target: { value: value2 }
    };
    onChange == null ? void 0 : onChange(changeEvent);
  };
  return /* @__PURE__ */ jsxs(
    Select,
    {
      ref,
      value: value == null ? void 0 : value.toString(),
      onValueChange: (value2) => {
        handleChange(value2);
      },
      children: [
        /* @__PURE__ */ jsx(SelectTrigger, { className: "pr-1.5 focus:ring-0 py-1! bg-inherit", children: /* @__PURE__ */ jsx(SelectValue, { children: (_a = selected == null ? void 0 : selected.props) == null ? void 0 : _a.children }) }),
        /* @__PURE__ */ jsx(SelectContent, { position: "popper", children: /* @__PURE__ */ jsx(ScrollArea, { className: "max-h-56", children: options.map((option, id) => {
          var _a2;
          return /* @__PURE__ */ jsx(
            SelectItem,
            {
              value: ((_a2 = option.props.value) == null ? void 0 : _a2.toString()) ?? "",
              children: option.props.children
            },
            `${option.props.value}-${id}`
          );
        }) }) })
      ]
    }
  );
});
function Calendar({
  fromYear = 1945,
  toYear,
  className,
  classNames,
  showOutsideDays = true,
  ...props
}) {
  const lang = usePage().props.lang;
  return /* @__PURE__ */ jsx(
    DayPicker,
    {
      locale: getLocaleDate(lang),
      captionLayout: "dropdown-buttons",
      fromYear,
      toYear: toYear ?? (/* @__PURE__ */ new Date()).getFullYear() + 5,
      showOutsideDays,
      className: cn("p-3", className),
      classNames: {
        months: "flex flex-col sm:flex-row space-y-4 sm:space-x-4 sm:space-y-0",
        month: "space-y-4",
        caption: "flex justify-center pt-1 relative items-center",
        caption_label: "text-sm font-medium",
        caption_dropdowns: "flex justify-center gap-1",
        vhidden: "vhidden hidden",
        nav: "space-x-1 flex items-center",
        nav_button: cn(
          buttonVariants({ variant: "outline" }),
          "h-7 w-7 bg-transparent p-0 opacity-50 hover:opacity-100"
        ),
        nav_button_previous: "absolute left-1",
        nav_button_next: "absolute right-1",
        table: "w-full border-collapse space-y-1",
        head_row: "flex",
        head_cell: "text-muted-foreground rounded-md w-9 font-normal text-[0.8rem]",
        row: "flex w-full mt-2",
        cell: "h-9 w-9 text-center text-sm p-0 relative [&:has([aria-selected].day-range-end)]:rounded-r-md [&:has([aria-selected].day-outside)]:bg-accent/50 [&:has([aria-selected])]:bg-accent first:[&:has([aria-selected])]:rounded-l-md last:[&:has([aria-selected])]:rounded-r-md focus-within:relative focus-within:z-20",
        day: cn(
          buttonVariants({ variant: "ghost" }),
          "h-9 w-9 p-0 font-normal aria-selected:opacity-100"
        ),
        day_range_end: "day-range-end",
        day_selected: "bg-primary text-primary-foreground hover:bg-primary hover:text-primary-foreground focus:bg-primary focus:text-primary-foreground",
        day_today: "bg-accent text-accent-foreground",
        day_outside: "day-outside text-muted-foreground aria-selected:bg-accent/50 aria-selected:text-muted-foreground",
        day_disabled: "text-muted-foreground opacity-50",
        day_range_middle: "aria-selected:bg-accent aria-selected:text-accent-foreground",
        day_hidden: "invisible",
        ...classNames
      },
      components: {
        IconLeft: ({ className: className2, ...props2 }) => /* @__PURE__ */ jsx(ChevronLeft, { className: cn("h-4 w-4", className2), ...props2 }),
        IconRight: ({ className: className2, ...props2 }) => /* @__PURE__ */ jsx(ChevronRight, { className: cn("h-4 w-4", className2), ...props2 }),
        Dropdown: (props2) => {
          return /* @__PURE__ */ jsx(DropdownMonthYear, { ...props2 });
        }
      },
      ...props
    }
  );
}
Calendar.displayName = "Calendar";
function isValidHour(value) {
  return /^(0[0-9]|1[0-9]|2[0-3])$/.test(value);
}
function isValid12Hour(value) {
  return /^(0[1-9]|1[0-2])$/.test(value);
}
function isValidMinuteOrSecond(value) {
  return /^[0-5][0-9]$/.test(value);
}
function getValidNumber(value, { max, min = 0, loop = false }) {
  let numericValue = parseInt(value, 10);
  if (!isNaN(numericValue)) {
    if (!loop) {
      if (numericValue > max) numericValue = max;
      if (numericValue < min) numericValue = min;
    } else {
      if (numericValue > max) numericValue = min;
      if (numericValue < min) numericValue = max;
    }
    return numericValue.toString().padStart(2, "0");
  }
  return "00";
}
function getValidHour(value) {
  if (isValidHour(value)) return value;
  return getValidNumber(value, { max: 23 });
}
function getValid12Hour(value) {
  if (isValid12Hour(value)) return value;
  return getValidNumber(value, { min: 1, max: 12 });
}
function getValidMinuteOrSecond(value) {
  if (isValidMinuteOrSecond(value)) return value;
  return getValidNumber(value, { max: 59 });
}
function getValidArrowNumber(value, { min, max, step }) {
  let numericValue = parseInt(value, 10);
  if (!isNaN(numericValue)) {
    numericValue += step;
    return getValidNumber(String(numericValue), { min, max, loop: true });
  }
  return "00";
}
function getValidArrowHour(value, step) {
  return getValidArrowNumber(value, { min: 0, max: 23, step });
}
function getValidArrow12Hour(value, step) {
  return getValidArrowNumber(value, { min: 1, max: 12, step });
}
function getValidArrowMinuteOrSecond(value, step) {
  return getValidArrowNumber(value, { min: 0, max: 59, step });
}
function setMinutes(date, value) {
  const minutes = getValidMinuteOrSecond(value);
  date.setMinutes(parseInt(minutes, 10));
  return date;
}
function setSeconds(date, value) {
  const seconds = getValidMinuteOrSecond(value);
  date.setSeconds(parseInt(seconds, 10));
  return date;
}
function setHours(date, value) {
  const hours = getValidHour(value);
  date.setHours(parseInt(hours, 10));
  return date;
}
function set12Hours(date, value, period) {
  const hours = parseInt(getValid12Hour(value), 10);
  const convertedHours = convert12HourTo24Hour(hours, period);
  date.setHours(convertedHours);
  return date;
}
function setDateByType(date, value, type, period) {
  switch (type) {
    case "minutes":
      return setMinutes(date, value);
    case "seconds":
      return setSeconds(date, value);
    case "hours":
      return setHours(date, value);
    case "12hours": {
      if (!period) return date;
      return set12Hours(date, value, period);
    }
    default:
      return date;
  }
}
function getDateByType(date, type) {
  if ((date == null ? void 0 : date.from) || (date == null ? void 0 : date.to)) return "00";
  switch (type) {
    case "minutes":
      return getValidMinuteOrSecond(String(date.getMinutes()));
    case "seconds":
      return getValidMinuteOrSecond(String(date.getSeconds()));
    case "hours":
      return getValidHour(String(date.getHours()));
    case "12hours": {
      const hours = display12HourValue(date.getHours());
      return getValid12Hour(String(hours));
    }
    default:
      return "00";
  }
}
function getArrowByType(value, step, type) {
  switch (type) {
    case "minutes":
      return getValidArrowMinuteOrSecond(value, step);
    case "seconds":
      return getValidArrowMinuteOrSecond(value, step);
    case "hours":
      return getValidArrowHour(value, step);
    case "12hours":
      return getValidArrow12Hour(value, step);
    default:
      return "00";
  }
}
function convert12HourTo24Hour(hour, period) {
  if (period === "PM") {
    if (hour <= 11) {
      return hour + 12;
    } else {
      return hour;
    }
  } else if (period === "AM") {
    if (hour === 12) return 0;
    return hour;
  }
  return hour;
}
function display12HourValue(hours) {
  if (hours === 0 || hours === 12) return "12";
  if (hours >= 22) return `${hours - 12}`;
  if (hours % 12 > 9) return `${hours}`;
  return `0${hours % 12}`;
}
const TimePickerInput = React__default.forwardRef(
  ({
    className,
    type = "tel",
    value,
    id,
    name,
    date = new Date((/* @__PURE__ */ new Date()).setHours(0, 0, 0, 0)),
    setDate,
    onChange,
    onKeyDown,
    picker,
    period,
    onLeftFocus,
    onRightFocus,
    ...props
  }, ref) => {
    const [flag, setFlag] = React__default.useState(false);
    const [prevIntKey, setPrevIntKey] = React__default.useState("0");
    React__default.useEffect(() => {
      if (flag) {
        const timer = setTimeout(() => {
          setFlag(false);
        }, 2e3);
        return () => clearTimeout(timer);
      }
    }, [flag]);
    const calculatedValue = React__default.useMemo(() => {
      return getDateByType(
        date instanceof Date ? date : new Date(date),
        picker
      );
    }, [date, picker]);
    const calculateNewValue = (key) => {
      if (picker === "12hours") {
        if (flag && calculatedValue.slice(1, 2) === "1" && prevIntKey === "0")
          return "0" + key;
      }
      return !flag ? "0" + key : calculatedValue.slice(1, 2) + key;
    };
    const handleKeyDown = (e) => {
      if (e.key === "Tab") return;
      e.preventDefault();
      if (e.key === "ArrowRight") onRightFocus == null ? void 0 : onRightFocus();
      if (e.key === "ArrowLeft") onLeftFocus == null ? void 0 : onLeftFocus();
      if (["ArrowUp", "ArrowDown"].includes(e.key)) {
        const step = e.key === "ArrowUp" ? 1 : -1;
        const newValue = getArrowByType(calculatedValue, step, picker);
        if (flag) setFlag(false);
        const tempDate = new Date(date);
        setDate(setDateByType(tempDate, newValue, picker, period));
      }
      if (e.key >= "0" && e.key <= "9") {
        if (picker === "12hours") setPrevIntKey(e.key);
        const newValue = calculateNewValue(e.key);
        if (flag) onRightFocus == null ? void 0 : onRightFocus();
        setFlag((prev) => !prev);
        const tempDate = new Date(date);
        setDate(setDateByType(tempDate, newValue, picker, period));
      }
    };
    return /* @__PURE__ */ jsx(
      Input,
      {
        ref,
        id: id || picker,
        name: name || picker,
        className: cn(
          "w-[48px] text-center font-mono text-base tabular-nums caret-transparent focus:bg-accent focus:text-accent-foreground [&::-webkit-inner-spin-button]:appearance-none",
          className
        ),
        value: value || calculatedValue,
        onChange: (e) => {
          e.preventDefault();
          onChange == null ? void 0 : onChange(e);
        },
        type,
        inputMode: "decimal",
        onKeyDown: (e) => {
          onKeyDown == null ? void 0 : onKeyDown(e);
          handleKeyDown(e);
        },
        ...props
      }
    );
  }
);
TimePickerInput.displayName = "TimePickerInput";
const DatetimePicker = memo(
  forwardRef(function DatetimePicker2({
    id,
    className,
    type = "datetime",
    fromYear,
    toYear,
    readOnly,
    disabled,
    value: valueProps,
    onValueChange,
    required,
    placeholder,
    onKeyDown
  }, ref) {
    const { t } = useLaravelReactI18n();
    const lang = usePage().props.lang;
    const [open, setOpen] = useState(false);
    const [search, setSearch] = useState("");
    const [_value, _setValue] = useState();
    const minuteRef = useRef();
    const hourRef = useRef();
    const commandRef = useDetectClickOutside({
      onTriggered: () => {
        if (!isInputFocused && !isPopoverFocused) setOpen(false);
      }
    });
    const popoverContentRef = useDetectClickOutside({
      onTriggered: () => {
        if (!isInputFocused && !isPopoverFocused) setOpen(false);
      }
    });
    const [isInputFocused, setIsInputFocused] = useState(false);
    const [isPopoverFocused, setIsPopoverFocused] = useState(false);
    const value = valueProps ?? _value;
    const setValue = (value2) => {
      value2 = value2 instanceof Date ? value2 == null ? void 0 : value2.toISOString() : value2;
      if (onValueChange) {
        onValueChange(value2);
      }
      _setValue(value2);
    };
    const setDate = (dateInput) => {
      const date = value ? new Date(value) : /* @__PURE__ */ new Date();
      if (!dateInput) {
        setValue(date);
        return;
      }
      date.setDate(dateInput.getDate());
      date.setMonth(dateInput.getMonth());
      date.setFullYear(dateInput.getFullYear());
      setValue(date);
    };
    const setTime = (dateInput) => {
      if (!dateInput) return;
      const time = value ? new Date(value) : /* @__PURE__ */ new Date();
      time.setHours(dateInput.getHours());
      time.setMinutes(dateInput.getMinutes());
      setValue(time);
    };
    const getDateValue = useCallback(
      (value2) => {
        switch (type) {
          case "daterange": {
            if (value2 == null ? void 0 : value2.from) {
              const from = format(value2.from, "PPP", {
                locale: getLocaleDate(lang)
              });
              if (value2 == null ? void 0 : value2.to) {
                const to = format(value2.to, "PPP", {
                  locale: getLocaleDate(lang)
                });
                return `${from} - ${to}`;
              }
              return from;
            }
            break;
          }
          case "date": {
            if (value2) {
              return format(value2, "PPP", { locale: getLocaleDate(lang) });
            }
            break;
          }
          case "datetime": {
            if (value2) {
              return format(value2, "PPPp", { locale: getLocaleDate(lang) });
            }
            break;
          }
        }
        return "";
      },
      [lang, type]
    );
    useEffect(() => {
      if (value) {
        setSearch(getDateValue(value));
      } else if (!open) {
        setSearch("");
      }
    }, [value, open]);
    const onInputKeyDown = (e) => {
      if (e.key == "Enter" && open) return;
      if (e.ctrlKey || e.metaKey || e.shiftKey || e.altKey || e.key == "Tab" || e.key == "Enter") {
        onKeyDown == null ? void 0 : onKeyDown(e);
        return;
      }
      if (readOnly || disabled) return;
      if (value) {
        setValue(null);
      }
      if (!open) {
        setOpen(true);
      }
    };
    return type == "time" ? /* @__PURE__ */ jsx(
      Input,
      {
        ref,
        type: "time",
        placeholder: placeholder ?? t(`core.form.time.placeholder`),
        readOnly,
        disabled,
        className,
        required,
        onChange: (e) => console.log(e.target.value)
      }
    ) : /* @__PURE__ */ jsx(Popover, { open, onOpenChange: () => {
    }, children: /* @__PURE__ */ jsxs(
      Command,
      {
        ref: commandRef,
        className: "relative h-full overflow-visible bg-transparent",
        loop: true,
        children: [
          /* @__PURE__ */ jsx(
            PopoverTrigger,
            {
              asChild: true,
              className: cn(
                "flex h-full bg-muted items-center  overflow-hidden border rounded-md cursor-default group/model relative focus-within:border-0 border-input ring-offset-background  focus-within:outline-none focus-within:ring-1 focus-within:ring-ring focus-within:ring-offset-1",
                disabled && "cursor-not-allowed opacity-50",
                className
              ),
              children: /* @__PURE__ */ jsx("div", { children: /* @__PURE__ */ jsx(
                Input,
                {
                  id,
                  onKeyDown: onInputKeyDown,
                  ref,
                  type: "text",
                  placeholder: placeholder ?? t(`core.form.${type}.placeholder`),
                  value: search,
                  readOnly,
                  disabled,
                  className: cn(
                    "focus:border-0! bg-inherit! disabled:opacity-100! h-8 w-full rounded-none! pr-2! border-0!  focus-visible:ring-0! focus-visible:ring-offset-0!  "
                  ),
                  required,
                  onClick: (e) => {
                    e.preventDefault();
                    if (!open && !readOnly && !disabled) {
                      setOpen(true);
                    }
                  },
                  onChange: (e) => setSearch(e.target.value),
                  onFocus: () => setIsInputFocused(true),
                  onBlur: () => setIsInputFocused(false)
                }
              ) })
            }
          ),
          /* @__PURE__ */ jsxs(
            PopoverContent,
            {
              className: "w-auto p-0",
              ref: popoverContentRef,
              onOpenAutoFocus: (e) => e.preventDefault(),
              align: "start",
              side: "bottom",
              forceMount: true,
              onFocus: () => setIsPopoverFocused(true),
              onBlur: () => setIsPopoverFocused(false),
              children: [
                /* @__PURE__ */ jsx(
                  Calendar,
                  {
                    fromYear,
                    toYear,
                    mode: type == "daterange" ? "range" : "single",
                    defaultMonth: /* @__PURE__ */ new Date(),
                    selected: value,
                    onSelect: (val) => {
                      type == "daterange" ? setValue(val) : setDate(val);
                    },
                    numberOfMonths: 1
                  }
                ),
                type == "datetime" && /* @__PURE__ */ jsx(Fragment, { children: /* @__PURE__ */ jsxs("div", { className: "flex justify-between px-3 py-2", children: [
                  /* @__PURE__ */ jsxs("div", { className: "flex items-center gap-2 text-muted-foreground", children: [
                    /* @__PURE__ */ jsx(Clock, { className: "w-5 h-5" }),
                    /* @__PURE__ */ jsx("p", { className: "text-sm font-medium", children: t("core.form.time") })
                  ] }),
                  /* @__PURE__ */ jsx("div", { className: "font-medium", children: /* @__PURE__ */ jsxs("div", { className: "flex items-center gap-2", children: [
                    /* @__PURE__ */ jsx(
                      TimePickerInput,
                      {
                        picker: "hours",
                        date: value ?? Date.now(),
                        setDate: setTime,
                        ref: hourRef,
                        onRightFocus: () => {
                          var _a;
                          return (_a = minuteRef.current) == null ? void 0 : _a.focus();
                        }
                      }
                    ),
                    /* @__PURE__ */ jsx("span", { children: ":" }),
                    /* @__PURE__ */ jsx(
                      TimePickerInput,
                      {
                        picker: "minutes",
                        date: value ?? Date.now(),
                        setDate: setTime,
                        ref: minuteRef,
                        onLeftFocus: () => {
                          var _a;
                          return (_a = hourRef.current) == null ? void 0 : _a.focus();
                        }
                      }
                    )
                  ] }) })
                ] }) }),
                (type == "datetime" || type == "date") && /* @__PURE__ */ jsxs(Fragment, { children: [
                  /* @__PURE__ */ jsx("hr", { className: "my-0" }),
                  /* @__PURE__ */ jsx("div", { className: "flex justify-between px-3 py-2", children: /* @__PURE__ */ jsx(
                    Button,
                    {
                      variant: "secondary",
                      size: "sm",
                      className: "w-full h-8",
                      onClick: () => setValue(/* @__PURE__ */ new Date()),
                      children: type == "date" ? t("core.form.today") : t("core.form.now")
                    }
                  ) })
                ] })
              ]
            }
          )
        ]
      }
    ) });
  })
);
export {
  DatetimePicker as D,
  ScrollArea as S
};
