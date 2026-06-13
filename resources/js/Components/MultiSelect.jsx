import { Command, CommandEmpty, CommandItem, CommandList } from "./ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "./ui/popover";
import { cn, isNullOrWhitespace } from "@/lib/utils";
import {
  forwardRef,
  memo,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import { Button } from "./ui/button";
import { Checkbox } from "./ui/checkbox";
import ClickAwayListener from "react-click-away-listener";
import { Input } from "./ui/input";
import { XIcon } from "lucide-react";
import useDidMountEffect from "@/Hooks/useDidMountEffect";
import { useLaravelReactI18n } from "laravel-react-i18n";

/**
 * MultiSelect — varian multi-pilih dari Select, dengan kontrak option yang sama.
 *
 * Normalisasi option (selaras Select):
 *   - { value, label }                 → pakai apa adanya
 *   - { value, titleTrans }            → label = t(titleTrans)
 *   - optionTrans + nilai mentah       → label = t(`${optionTrans}.${value}`)
 *   - nilai mentah (string/number)     → label = value
 *
 * Props:
 *   value         : array nilai terpilih
 *   onValueChange : (array) => void
 *   options       : array option (bentuk apa pun di atas)
 *   optionTrans   : prefix lang key untuk label (mis. "status")
 *   onSearchChange: (string) => void — opsional
 */
const MultiSelect = memo(
  forwardRef(function MultiSelect(
    {
      id,
      value,
      onValueChange,
      className,
      disabled,
      readOnly,
      onKeyDown,
      onSearchChange,
      required,
      placeholder,
      optionTrans,
      options: _options,
    },
    ref,
  ) {
    const { t } = useLaravelReactI18n();
    const [open, setOpen] = useState(false);
    const [search, setSearch] = useState("");
    const [isDirty, setIsDirty] = useState(false);
    const [values, _setValues] = useState(value ?? []);
    const commandRef = useRef(null);
    const popoverRef = useRef(null);

    // Normalisasi option identik dengan Select.
    const oriOptions = useMemo(() => {
      return (
        _options
          ?.filter((x) => x)
          ?.map((x) => {
            const label =
              typeof x === "object" && x.label
                ? x.label
                : x.titleTrans
                  ? t(x.titleTrans)
                  : optionTrans
                    ? t(`${optionTrans}.${x.value ?? x}`)
                    : (x.value ?? x);
            const optValue = typeof x === "object" ? x.value : x;
            return { label, value: optValue };
          }) ?? []
      );
    }, [_options, optionTrans, t]);

    // Sinkronkan values dari prop bila berubah dari luar.
    useDidMountEffect(() => {
      _setValues(value ?? []);
    }, [value]);

    const setValues = useCallback(
      (updater) => {
        _setValues((prev) => {
          const next =
            typeof updater === "function" ? updater(prev ?? []) : updater;
          onValueChange?.(next);
          return next;
        });
      },
      [onValueChange],
    );

    // Ringkasan label option terpilih untuk ditampilkan di input.
    const labelOfValues = useCallback(
      (vals) =>
        oriOptions
          .filter((opt) => (vals ?? []).includes(opt.value))
          .map((opt) => opt.label)
          .join(", "),
      [oriOptions],
    );

    const toggleValue = useCallback(
      (val) => {
        setValues((prev) => {
          const included = (prev ?? []).includes(val);
          return included
            ? prev.filter((x) => x !== val)
            : [...(prev ?? []), val];
        });
        setIsDirty(false);
      },
      [setValues],
    );

    // Daftar option yang difilter oleh teks pencarian (saat user mengetik).
    const options = useMemo(() => {
      if (!search || !isDirty) return oriOptions;
      const q = search.toLowerCase();
      return oriOptions.filter((opt) =>
        opt.label?.toString().toLowerCase().includes(q),
      );
    }, [oriOptions, search, isDirty]);

    // Saat popover tertutup, tampilkan ringkasan; saat dibuka, kosongkan agar bisa mencari.
    useEffect(() => {
      if (open) {
        setSearch("");
      } else {
        setSearch(labelOfValues(values));
        setIsDirty(false);
      }
      // eslint-disable-next-line react-hooks/exhaustive-deps
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
        setIsDirty(true);
        if (!open) setOpen(true);
      },
      [open, readOnly, disabled, onKeyDown],
    );

    // Highlight tanpa dangerouslySetInnerHTML: pecah label jadi array React node
    // (teks biasa + <mark> untuk bagian yang cocok). React meng-escape otomatis,
    // sehingga aman dari XSS meski label/search berisi karakter HTML.
    const highlightItem = useCallback((item, search) => {
      const text = `${item ?? ""}`;
      const searchWords =
        search
          ?.split(/\s+/)
          ?.map((s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
          .filter((x) => !isNullOrWhitespace(x)) || [];
      if (searchWords.length < 1) return text;
      const splitRegex = new RegExp(`(${searchWords.join("|")})`, "gi");
      const matchRegex = new RegExp(`^(?:${searchWords.join("|")})$`, "i");
      return text
        .split(splitRegex)
        .filter((part) => part !== "")
        .map((part, i) =>
          matchRegex.test(part) ? (
            <mark key={i} className="bg-yellow-500">
              {part}
            </mark>
          ) : (
            part
          ),
        );
    }, []);

    return (
      <ClickAwayListener onClickAway={() => setOpen(false)}>
        <div className={cn("w-full", className)}>
          <Popover open={open} onOpenChange={() => {}}>
            <Command
              ref={commandRef}
              className="relative h-full overflow-visible bg-transparent"
              loop
              shouldFilter={false}
              onKeyDown={(e) => {
                const item = popoverRef.current?.querySelector(
                  `[cmdk-item=""][data-selected="true"]`,
                );
                const val = item?.getAttribute("data-value");
                if (!val || e.key !== "Enter") return;
                e.preventDefault();
                e.stopPropagation();
                toggleValue(val);
              }}
            >
              <PopoverTrigger
                asChild
                className={cn(
                  "flex h-8 items-center overflow-hidden border rounded-md cursor-default group/model relative focus-within:border-0 border-input ring-offset-background bg-muted focus-within:outline-none focus-within:ring-1 focus-within:ring-ring focus-within:ring-offset-1",
                  disabled && "cursor-not-allowed opacity-50",
                  className,
                )}
              >
                <div>
                  <Input
                    id={id}
                    ref={ref}
                    disabled={disabled}
                    readOnly={readOnly}
                    onKeyDown={onInputKeyDown}
                    onClick={(e) => {
                      e.preventDefault();
                      if (!open) setOpen(true);
                    }}
                    required={required}
                    value={search}
                    onChange={(e) => {
                      setIsDirty(true);
                      setSearch(e.target.value);
                      onSearchChange?.(e.target.value);
                    }}
                    className={cn(
                      "focus:border-0! bg-inherit! disabled:opacity-100! h-8 w-full rounded-none! pr-2! border-0! focus-visible:ring-0! focus-visible:ring-offset-0!",
                    )}
                    placeholder={
                      placeholder ?? (values?.length ? labelOfValues(values) : "")
                    }
                  />
                  <div className="flex items-center h-8 pr-2 gap-x-2">
                    {!(readOnly || disabled) && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className={cn(
                          "size-6",
                          (!(values?.length || search) || disabled || readOnly) &&
                            "hidden",
                        )}
                        onClick={() => {
                          setValues([]);
                          setSearch("");
                          onSearchChange?.("");
                        }}
                      >
                        <XIcon className="size-3" />
                      </Button>
                    )}
                  </div>
                </div>
              </PopoverTrigger>
              {!(disabled || readOnly) && (
                <PopoverContent
                  onOpenAutoFocus={(e) => e.preventDefault()}
                  ref={popoverRef}
                  align="start"
                  side="bottom"
                  className="relative z-50 w-auto min-w-(--radix-popover-trigger-width) p-0"
                  forceMount
                  asChild
                >
                  <CommandList className="p-1 space-y-2">
                    <CommandEmpty>{t("core.form.not_found")}</CommandEmpty>
                    {options?.map((opt) => (
                      <CommandItem
                        key={opt.value}
                        value={opt.value}
                        onSelect={() => toggleValue(opt.value)}
                        asChild
                      >
                        <label
                          htmlFor={`${id ?? "ms"}-${opt.value}-checkbox`}
                          className="flex items-center space-x-2"
                        >
                          <Checkbox
                            id={`${id ?? "ms"}-${opt.value}-checkbox`}
                            checked={values?.includes(opt.value)}
                            onCheckedChange={() => toggleValue(opt.value)}
                          />
                          <span className="flex-1 text-sm font-medium leading-none">
                            {highlightItem(opt.label, search ?? "")}
                          </span>
                        </label>
                      </CommandItem>
                    ))}
                  </CommandList>
                </PopoverContent>
              )}
            </Command>
          </Popover>
        </div>
      </ClickAwayListener>
    );
  }),
);

export default MultiSelect;
