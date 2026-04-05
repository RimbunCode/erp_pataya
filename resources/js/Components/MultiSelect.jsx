import { Command, CommandEmpty, CommandItem, CommandList } from "./ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "./ui/popover";
import { cn, isNullOrWhitespace } from "@/lib/utils";
import { forwardRef, useCallback, useEffect, useRef, useState } from "react";

import { Button } from "./ui/button";
import { Checkbox } from "./ui/checkbox";
import ClickAwayListener from "react-click-away-listener";
import { Input } from "./ui/input";
import { XIcon } from "lucide-react";
import useDidMountEffect from "@/Hooks/useDidMountEffect";
import { useLaravelReactI18n } from "laravel-react-i18n";

export default forwardRef(function MultiSelect(
  {
    value,
    onValueChange,
    className,
    disabled,
    readOnly,
    onKeyDown,
    required,
    placeholder,
    options: optionsProps,
  },
  ref,
) {
  const { t } = useLaravelReactI18n();
  const [open, setOpen] = useState(false);
  const [search, _setSearch] = useState("");
  const [values, _setValues] = useState(value ?? []);
  const [options, setOptions] = useState(optionsProps);
  const commandRef = useRef(null);
  const popoverRef = useRef(null);

  const convertValues = (values) => {
    const options = optionsProps
      ?.filter((opt) => values.includes(opt.value))
      .map((opt) => opt.label);
    return options?.join(", ") ?? "";
  };

  const setValues = useCallback(
    (val) => {
      _setValues(val);
      onValueChange?.(val);
    },
    [onValueChange, _setValues],
  );
  const setSearch = (search) => {
    _setSearch(search);
    // if (!allowSearch) return;
    if (!isNullOrWhitespace(search)) {
      const keywords = search
        .split(",")
        .map((s) => s.replace(/\s/g, "").toLowerCase()); // Hapus spasi ekstra

      const options = optionsProps?.filter((opt) => {
        const lowerOpt = opt.label?.toString().toLowerCase();
        return keywords.some((keyword) => lowerOpt.includes(keyword));
      });
      const values = optionsProps
        ?.filter((opt) => {
          const lowerOpt = opt.label?.toString().toLowerCase();
          return keywords.some((keyword) => lowerOpt == keyword);
        })
        .map((x) => x.value);
      setValues(values);
      setOptions(options);
    } else {
      setOptions(optionsProps);
    }
  };

  useDidMountEffect(() => {
    _setValues(value ?? []);
  }, [value]);

  const onChecked = (val, checked) => {
    setValues((prev) => {
      const isNumber = Number(val);
      val = !isNaN(isNumber) ? isNumber : val.toString();
      if (checked == null || checked === true) {
        const included = prev?.includes(val);
        if (included && checked === true) return prev;
        checked = !included;
      }
      const newValues = checked
        ? [...(prev ?? []), val]
        : (prev ?? []).filter((x) => x !== val);
      setSearch(
        newValues && newValues.length > 0
          ? convertValues(newValues) + ", "
          : "",
      );
      return newValues;
    });
    // setAllowSearch(false);
  };

  useEffect(() => {
    if (!open) {
      setSearch(convertValues(values));
    } else {
      setSearch(
        values && values.length > 0 ? convertValues(values) + ", " : "",
      );
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
      if (!open) {
        setOpen(true);
      }
    },
    [open, readOnly, disabled, onKeyDown],
  );
  return (
    <ClickAwayListener onClickAway={() => setOpen(false)}>
      <div className={cn("w-full", className)}>
        <Popover open={open} onOpenChange={() => {}}>
          <Command
            ref={commandRef}
            className="relative h-auto overflow-visible bg-transparent"
            loop
            shouldFilter
            onKeyDown={(e) => {
              const item = popoverRef.current?.querySelector(
                `[cmdk-item=""][data-selected="true"]`,
              );
              const value = item?.getAttribute("data-value");
              if (!value || e.key !== "Enter") return;
              e.preventDefault();
              e.stopPropagation();
              onChecked(value);
            }}
          >
            <PopoverTrigger
              asChild
              className={cn(
                "flex h-8 overflow-hidden border rounded-md cursor-default group/model rrelative focus-within:border-0 border-input ring-offset-background bg-muted focus-within:outline-none focus-within:ring-1 focus-within:ring-ring focus-within:ring-offset-1",
                className,
              )}
            >
              <div>
                <Input
                  ref={ref}
                  disabled={disabled}
                  readOnly={readOnly}
                  onKeyDown={onInputKeyDown}
                  required={required}
                  value={search}
                  onDoubleClick={(e) => {
                    e.preventDefault();
                    setOpen(true);
                  }}
                  onChange={(e) => {
                    // setAllowSearch(true);
                    setSearch(e.target.value);
                  }}
                  className={cn(
                    "focus:border-0! bg-inherit! h-8 w-full rounded-none! pr-2! border-0!  focus-visible:ring-0! focus-visible:ring-offset-0!  ",
                  )}
                  placeholder={placeholder}
                />
                <div className="flex items-center h-8 pr-2 gap-x-2">
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className={cn(
                      "size-6 ",
                      (!search || disabled || readOnly) && "hidden",
                    )}
                    onClick={() => {
                      _setValues([]);
                      setSearch("");
                    }}
                  >
                    <XIcon className="size-3" />
                  </Button>
                </div>
              </div>
            </PopoverTrigger>
            {!(disabled || readOnly) && (
              <PopoverContent
                onOpenAutoFocus={(e) => e.preventDefault()}
                ref={popoverRef}
                align="start"
                side="bottom"
                className="relative z-50  w-(--radix-popover-trigger-width) p-0 "
                forceMount
                asChild
              >
                <CommandList className="p-1 space-y-2">
                  <CommandEmpty>{t("core.form.not_found")}</CommandEmpty>
                  {options &&
                    options?.map((opt) => {
                      return (
                        <CommandItem
                          key={opt.value}
                          value={opt.value}
                          onSelect={() => {
                            setOpen(true);
                          }}
                          asChild
                        >
                          <label
                            htmlFor={`${opt.value}-checkbox`}
                            className="flex items-center space-x-2"
                          >
                            <Checkbox
                              id={`${opt.value}-checkbox`}
                              checked={values?.includes(opt.value)}
                              onCheckedChange={(val) =>
                                onChecked(opt.value, val)
                              }
                            />
                            <span
                              htmlFor={`${opt.value}-checkbox`}
                              className="flex-1 text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                            >
                              {opt.label}
                            </span>
                          </label>
                        </CommandItem>
                      );
                    })}
                </CommandList>
              </PopoverContent>
            )}
          </Command>
        </Popover>
      </div>
    </ClickAwayListener>
  );
});
