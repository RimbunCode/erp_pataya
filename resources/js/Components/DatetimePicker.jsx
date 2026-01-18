import { Popover, PopoverContent, PopoverTrigger } from "./ui/popover";
import { cn, getLocaleDate } from "@/lib/utils";
import {
  forwardRef,
  memo,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";

import { Button } from "./ui/button";
import { Calendar } from "./ui/calendar";
import { Clock } from "lucide-react";
import { Command } from "./ui/command";
import { Input } from "./ui/input";
import React from "react";
import { TimePickerInput } from "./TimePicker/time-picker-input";
import { format } from "date-fns";
import { useDetectClickOutside } from "react-detect-click-outside";
import { useLaravelReactI18n } from "laravel-react-i18n";
import { usePage } from "@inertiajs/react";

export default memo(
  forwardRef(function DatetimePicker(
    {
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
      onKeyDown,
    },
    ref,
  ) {
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
      },
    });
    const popoverContentRef = useDetectClickOutside({
      onTriggered: () => {
        if (!isInputFocused && !isPopoverFocused) setOpen(false);
      },
    });
    const [isInputFocused, setIsInputFocused] = useState(false);
    const [isPopoverFocused, setIsPopoverFocused] = useState(false);

    const value = valueProps ?? _value;
    const setValue = (value) => {
      value = value instanceof Date ? value?.toISOString() : value;
      if (onValueChange) {
        onValueChange(value);
        // return;
      }
      _setValue(value);
    };

    const setDate = (dateInput) => {
      const date = value ? new Date(value) : new Date();
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
      const time = value ? new Date(value) : new Date();
      time.setHours(dateInput.getHours());
      time.setMinutes(dateInput.getMinutes());
      setValue(time);
    };
    const getDateValue = useCallback(
      (value) => {
        switch (type) {
          case "daterange": {
            if (value?.from) {
              const from = format(value.from, "PPP", {
                locale: getLocaleDate(lang),
              });
              if (value?.to) {
                const to = format(value.to, "PPP", {
                  locale: getLocaleDate(lang),
                });
                return `${from} - ${to}`;
              }
              return from;
            }
            break;
          }
          case "date": {
            if (value) {
              return format(value, "PPP", { locale: getLocaleDate(lang) });
            }
            break;
          }
          case "datetime": {
            if (value) {
              return format(value, "PPPp", { locale: getLocaleDate(lang) });
            }
            break;
          }
        }
        return "";
      },
      [lang, type],
    );

    // useEffect(() => {
    //   if (!open || search || isValid) return;
    //   setValue(Date.now());
    // }, [open]);
    useEffect(() => {
      if (value) {
        setSearch(getDateValue(value));
      } else if (!open) {
        setSearch("");
      }
    }, [value, open]);
    const onInputKeyDown = (e) => {
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
      if (value) {
        setValue(null);
      }
      if (!open) {
        setOpen(true);
      }
    };
    // const dateValue = useMemo(() => {}, [value, type]);

    return type == "time" ? (
      <Input
        ref={ref}
        type="time"
        placeholder={placeholder ?? t(`core.form.time.placeholder`)}
        // value={value}
        readOnly={readOnly}
        disabled={disabled}
        className={className}
        required={required}
        onChange={(e) => console.log(e.target.value)}
      />
    ) : (
      <Popover open={open} onOpenChange={() => {}}>
        <Command
          ref={commandRef}
          className="relative h-full overflow-visible bg-transparent"
          loop
        >
          <PopoverTrigger
            asChild
            className={cn(
              "flex h-full bg-muted items-center  overflow-hidden border rounded-md cursor-default group/model relative focus-within:border-0 border-input ring-offset-background  focus-within:outline-none focus-within:ring-1 focus-within:ring-ring focus-within:ring-offset-1",
              disabled && "cursor-not-allowed opacity-50",
              className,
            )}
          >
            <div>
              <Input
                id={id}
                onKeyDown={onInputKeyDown}
                ref={ref}
                type="text"
                placeholder={placeholder ?? t(`core.form.${type}.placeholder`)}
                value={search}
                readOnly={readOnly}
                disabled={disabled}
                className={cn(
                  "focus:border-0! bg-inherit! disabled:opacity-100! h-8 w-full rounded-none! pr-2! border-0!  focus-visible:ring-0! focus-visible:ring-offset-0!  ",
                )}
                required={required}
                onClick={(e) => {
                  e.preventDefault();
                  if (!open && !readOnly && !disabled) {
                    setOpen(true);
                  }
                }}
                onChange={(e) => setSearch(e.target.value)}
                onFocus={() => setIsInputFocused(true)}
                onBlur={() => setIsInputFocused(false)}
              />
            </div>
          </PopoverTrigger>
          <PopoverContent
            className="w-auto p-0"
            ref={popoverContentRef}
            onOpenAutoFocus={(e) => e.preventDefault()}
            align="start"
            side="bottom"
            forceMount
            onFocus={() => setIsPopoverFocused(true)}
            onBlur={() => setIsPopoverFocused(false)}
          >
            <Calendar
              fromYear={fromYear}
              toYear={toYear}
              mode={type == "daterange" ? "range" : "single"}
              defaultMonth={new Date()}
              selected={value}
              onSelect={(val) => {
                type == "daterange" ? setValue(val) : setDate(val);
              }}
              numberOfMonths={1}
            />
            {type == "datetime" && (
              <>
                <div className="flex justify-between px-3 py-2">
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Clock className="w-5 h-5" />
                    <p className="text-sm font-medium">{t("core.form.time")}</p>
                  </div>
                  <div className="font-medium">
                    <div className="flex items-center gap-2">
                      <TimePickerInput
                        picker="hours"
                        date={value ?? Date.now()}
                        setDate={setTime}
                        ref={hourRef}
                        onRightFocus={() => minuteRef.current?.focus()}
                      />
                      <span>:</span>
                      <TimePickerInput
                        picker="minutes"
                        date={value ?? Date.now()}
                        setDate={setTime}
                        ref={minuteRef}
                        onLeftFocus={() => hourRef.current?.focus()}
                      />
                    </div>
                  </div>
                </div>
              </>
            )}
            {(type == "datetime" || type == "date") && (
              <>
                <hr className="my-0" />
                <div className="flex justify-between px-3 py-2">
                  <Button
                    variant="secondary"
                    size="sm"
                    className="w-full h-8"
                    onClick={() => setValue(new Date())}
                  >
                    {type == "date" ? t("core.form.today") : t("core.form.now")}
                  </Button>
                </div>
              </>
            )}
          </PopoverContent>
        </Command>
      </Popover>
    );
  }),
);
