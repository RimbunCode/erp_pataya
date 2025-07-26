import * as React from "react";

import { CalendarIcon, Clock } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "./ui/popover";
import { cn, getLocaleDate } from "@/lib/utils";

import { Button } from "./ui/button";
import { Calendar } from "./ui/calendar";
import { TimePickerInput } from "./TimePicker/time-picker-input";
import { format } from "date-fns";
import { useLaravelReactI18n } from "laravel-react-i18n";
import { usePage } from "@inertiajs/react";

export default React.memo(function DatetimePicker({
  className,
  type = "datetime",
  fromYear,
  toYear,
  disabled,
  value: valueProps,
  onValueChange,
}) {
  const { t } = useLaravelReactI18n();
  const lang = usePage().props.lang;
  const [_value, _setValue] = React.useState();
  const minuteRef = React.useRef();
  const hourRef = React.useRef();

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

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          disabled={disabled}
          id="date"
          variant={"outline"}
          className={cn(
            "h-8 w-auto justify-start bg-muted text-left font-normal overflow-hidden truncate",
            !value && "text-muted-foreground",
            className,
          )}
        >
          <CalendarIcon />
          <span className="truncate">
            {(() => {
              switch (type) {
                case "daterange": {
                  return value?.from ? (
                    value.to ? (
                      <>
                        {format(value.from, "PPP", {
                          locale: getLocaleDate(lang),
                        })}{" "}
                        -{" "}
                        {format(value.to, "PPP", {
                          locale: getLocaleDate(lang),
                        })}
                      </>
                    ) : (
                      format(value.from, "PPP", { locale: getLocaleDate(lang) })
                    )
                  ) : (
                    "Pick a date"
                  );
                }
                case "date": {
                  return value
                    ? format(value, "PPP", { locale: getLocaleDate(lang) })
                    : "Pick a date";
                }
                case "datetime": {
                  return value
                    ? format(value, "PPPp", { locale: getLocaleDate(lang) })
                    : "Pick a date";
                }
              }
            })()}
          </span>
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="end">
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
    </Popover>
  );
});
