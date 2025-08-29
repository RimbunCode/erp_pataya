import { Clock } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "./ui/popover";
import { cn, getLocaleDate } from "@/lib/utils";

import { Button } from "./ui/button";
import { Calendar } from "./ui/calendar";
import { TimePickerInput } from "./TimePicker/time-picker-input";
import { format } from "date-fns";
import { useLaravelReactI18n } from "laravel-react-i18n";
import { usePage } from "@inertiajs/react";
import {
  forwardRef,
  memo,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import { Input } from "./ui/input";
import { Command } from "./ui/command";
import { useDetectClickOutside } from "react-detect-click-outside";
import React from "react";

export default memo(
  forwardRef(function DatetimePicker(
    {
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
        setOpen(false);
      },
    });

    const value = valueProps ?? _value;
    const setValue = (value) => {
      value = value instanceof Date ? value?.toISOString() : value;
      if (valueProps != null) {
        onValueChange(value);
        return;
      }
      _setValue(value);
    };

    const setDate = (dateInput) => {
      const date = new Date(value);
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
      const time = new Date(value);
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
    useEffect(() => {
      console.log(value, open);
      if (value) {
        // setAllowSearch(false);
        setSearch(getDateValue(value));
      } else if (!open) {
        // setAllowSearch(true);
        setSearch("");
      }
    }, [value, open]);
    const onInputKeyDown = (e) => {
      console.log(e.key);
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
    useEffect(() => {});
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
          className="relative h-full overflow-visible bg-transparent"
          ref={commandRef}
          loop
        >
          <PopoverTrigger
            asChild
            className={cn(
              "flex h-full bg-muted items-center  overflow-hidden border rounded-md cursor-default group/model relative focus-within:border-0 border-input ring-offset-background  focus-within:outline-none focus-within:ring-1 focus-within:ring-ring focus-within:ring-offset-1",
              // valueBefore !== undefined &&
              //   !diff?.same &&
              //   "bg-yellow-200 dark:bg-yellow-900",
              disabled && "cursor-not-allowed opacity-50",
              className,
            )}
          >
            <div>
              <Input
                onKeyDown={onInputKeyDown}
                ref={ref}
                type="text"
                placeholder={placeholder ?? t(`core.form.${type}.placeholder`)}
                value={search}
                readOnly={readOnly}
                disabled={disabled}
                className={cn(
                  "focus:!border-0 !bg-inherit disabled:!opacity-100 h-8 w-full !rounded-none !pr-2 !border-0  focus-visible:!ring-0 focus-visible:!ring-offset-0  ",
                  // diff.same && "text-",
                )}
                required={required}
                onClick={(e) => {
                  e.preventDefault();
                  if (!open) {
                    setOpen(true);
                  }
                }}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>

            {/* <Button
            disabled={disabled}
            id="date"
            variant={"outline"}
            className={cn(
              "h-8 w-auto justify-start bg-muted text-left font-normal overflow-hidden truncate",
              !value && "text-muted-foreground",
              readOnly && "pointer-events-none",
              className,
            )}
          >
            <CalendarIcon />
            <span className="truncate">
              {(() => {

              })()}
            </span>
          </Button> */}
          </PopoverTrigger>
          <PopoverContent
            className="w-auto p-0"
            onOpenAutoFocus={(e) => e.preventDefault()}
            align="start"
            side="bottom"
            forceMount
          >
            <Calendar
              fromYear={fromYear}
              toYear={toYear}
              mode={type == "daterange" ? "range" : "single"}
              defaultMonth={new Date()}
              selected={value}
              onSelect={(val) => {
                type == "daterange" ? setValue(val) : setDate(val);
                setOpen(false);
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
                        date={value}
                        setDate={setTime}
                        ref={hourRef}
                        onRightFocus={() => minuteRef.current?.focus()}
                      />
                      <span>:</span>
                      <TimePickerInput
                        picker="minutes"
                        date={value}
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
