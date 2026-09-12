import { Command, CommandEmpty, CommandItem, CommandList } from "./ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "./ui/popover";
import { Tooltip, TooltipContent, TooltipTrigger } from "./ui/tooltip";
import { cn, isNullOrWhitespace } from "@/lib/utils";
import { DIFF_HIGHLIGHT, isChanged } from "@/lib/diffUtils";
import {
  forwardRef,
  memo,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";

import { Button } from "./ui/button";
import ClickAwayListener from "react-click-away-listener";
import { Input } from "./ui/input";
import React from "react";
import { XIcon } from "lucide-react";
import { useLaravelReactI18n } from "laravel-react-i18n";
import { useRef } from "react";

const Select = memo(
  forwardRef(function Select(
    {
      id,
      value,
      valueBefore,
      onValueChange,
      defaultValue,
      placeholder,
      className,
      disabled,
      required,
      readOnly,
      onKeyDown,
      onSearchChange,
      optionTrans,
      options: _options,
    },
    ref,
  ) {
    const { t } = useLaravelReactI18n();
    const [search, setSearch] = useState("");
    const oriOptions = useMemo(() => {
      const options = _options
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

          const value = typeof x === "object" ? x.value : x;
          return {
            label,
            value,
          };
        });
      return options;
    }, [_options, optionTrans, t]);

    const getOption = useCallback(
      (val) => {
        return oriOptions.find((x) => x.value == val);
      },
      [oriOptions],
    );
    const diff = useMemo(() => {
      const before = getOption(valueBefore)?.label ?? valueBefore;
      const after = getOption(value)?.label ?? value;
      const changed = isChanged(valueBefore, value);
      return {
        before: changed && before,
        after,
        same: !changed,
      };
    }, [value, valueBefore, getOption]);
    const [isDirty, setIsDirty] = useState(false);
    const [open, setOpen] = useState(false);
    const [_option, _setOption] = useState(getOption(value));
    const commandRef = useRef(null);
    const hasValue = value !== undefined;
    const option = hasValue ? getOption(value) : _option;
    const setOption = useCallback(
      (val) => {
        setIsDirty(false);
        if (disabled || readOnly) return;
        _setOption(val);
        onValueChange?.(val?.value);
      },
      [onValueChange, _setOption, disabled, readOnly],
    );
    const appliedDefaultKeyRef = useRef(null);

    useEffect(() => {
      if (option) return;
      if (!defaultValue) {
        // kalau defaultValue hilang, reset flag
        appliedDefaultKeyRef.current = null;
        return;
      }

      // kalau default yang sama sudah pernah diaplikasikan, jangan apa-apa
      if (appliedDefaultKeyRef.current === defaultValue) {
        return;
      }

      const opt = getOption(defaultValue);
      if (!opt) {
        return;
      }

      // apply default hanya sekali per key
      _setOption((prev) => {
        if (prev?.value === opt.value) return prev;
        return opt;
      });
      onValueChange?.(opt.value);

      appliedDefaultKeyRef.current = defaultValue;
    }, [defaultValue, getOption, onValueChange, option, _setOption]);

    const options = useMemo(() => {
      if (!oriOptions) return [];
      if (search && isDirty) {
        return oriOptions.filter((x) =>
          x.label.toLowerCase().includes(search.toLowerCase()),
        );
      }

      return oriOptions;
    }, [oriOptions, search, isDirty]);

    // cmdk dikontrol via `value`/`onValueChange` sendiri (bukan diserahkan ke
    // auto-highlight bawaan cmdk) -- auto-highlight cmdk cuma jalan SEKALI
    // saat mount/registrasi item pertama, TIDAK otomatis pindah ke item lain
    // kalau item yg lagi ke-highlight hilang dari DOM krn filtering `options`
    // di atas (lihat [[reference_cmdk_autohighlight_mount_only_needs_controlled_value]]
    // -- gotcha yg sama ditemukan & difix di MultiSelect.jsx).
    const [highlightedValue, setHighlightedValue] = useState();
    const visibleValues = useMemo(
      () => (options ?? []).map((opt) => opt.value),
      [options],
    );
    useEffect(() => {
      if (!visibleValues.includes(highlightedValue)) {
        setHighlightedValue(visibleValues[0]);
      }
    }, [visibleValues]);

    useEffect(() => {
      if (open) return;

      if (search && isDirty) {
        const findOption = oriOptions.find(
          (x) => x.label.toLowerCase() == search.toLowerCase(),
        );
        // if (findOption) {
        setOption(findOption);
        // return;
        // }
        if (!findOption) {
          setSearch("");
        }
      }
    }, [open, isDirty]);
    // useEffect(() => {
    //   if (search) {
    //     const findOption = oriOptions.find(
    //       (x) => x.label.toLowerCase() == search.toLowerCase(),
    //     );
    //     setOption(findOption);
    //     if (!findOption) {
    //       setSearch("");
    //     }
    //   }
    // }, [_options]);
    useEffect(() => {
      if (option) {
        setSearch(option.label);
      } else if (!open) {
        setSearch("");
      }
    }, [option]);

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
      // if (option) {
      //   setOption(null);
      // }
      setIsDirty(true);
      if (!open) {
        setOpen(true);
      }
    };
    const highlightItem = useCallback((item, search) => {
      const escaped = String(item ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;");

      let searchWords =
        search
          .split(/\s+/)
          ?.map((string) => string.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
          .filter((x) => !isNullOrWhitespace(x)) || [];

      if (searchWords.length < 1) return escaped;

      let regex = new RegExp(`(${searchWords.join("|")})`, "gi");
      return escaped.replace(regex, `<mark class="bg-yellow-500">$1</mark>`);
    }, []);
    return (
      <ClickAwayListener onClickAway={() => setOpen(false)}>
        <div className={cn("w-full", className)}>
          <Popover open={open} onOpenChange={() => {}}>
            <Command
              className="relative h-full overflow-visible bg-transparent"
              ref={commandRef}
              loop
              value={highlightedValue}
              onValueChange={setHighlightedValue}
              onKeyDown={(e) => {
                // Tab CUMA nulis label opsi yg lagi di-highlight keyboard ke
                // search (autocomplete) -- TIDAK langsung memilihnya. Commit
                // beneran tetap lewat mekanisme exact-match on-close yg SUDAH
                // ada (efek `[open, isDirty]` di atas), sama kayak kalau user
                // ngetik label itu manual lalu blur. isDirty (SEBELUM Tab ini)
                // nentuin fokus terkunci di input atau boleh pindah keluar --
                // kalau pindah keluar, itu trigger blur asli yg otomatis
                // commit teks yg baru ditulis.
                if (e.key !== "Tab") return;
                const opt = getOption(highlightedValue);
                if (!opt) return;
                if (isDirty) e.preventDefault();
                setSearch(opt.label);
                setIsDirty(true);
              }}
            >
              <Tooltip>
                <TooltipTrigger asChild>
                  <PopoverTrigger
                    asChild
                    className={cn(
                      "flex h-full bg-muted items-center  overflow-hidden border rounded-md cursor-default group/model relative focus-within:border-0 border-input ring-offset-background  focus-within:outline-none focus-within:ring-1 focus-within:ring-ring focus-within:ring-offset-1",
                      valueBefore !== undefined &&
                        !diff?.same &&
                        DIFF_HIGHLIGHT,
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
                          if ((!search && !open) || (!open && option)) {
                            setOpen(true);
                          }
                        }}
                        required={required}
                        value={search}
                        onChange={(e) => {
                          const newSearch = e.target.value;
                          setSearch(newSearch);
                          onSearchChange?.(newSearch);
                        }}
                        onBlur={() => {
                          // Diperlukan spesifik utk Tab-autocomplete: Tab
                          // TANPA klik gak lewat ClickAwayListener (itu cuma
                          // dengar mousedown/click), jadi tanpa onBlur ini
                          // popover gak pernah nutup+commit teks yg ditulis
                          // Tab abis fokus pindah keluar. Efek `[open,
                          // isDirty]` di atas yang commit -- satu sumber
                          // kebenaran, sama kayak jalur ngetik manual.
                          setOpen(false);
                        }}
                        className={cn(
                          "focus:border-0! bg-inherit! disabled:opacity-100! h-8 w-full rounded-none! pr-2! border-0!  focus-visible:ring-0! focus-visible:ring-offset-0!  ",
                          // diff.same && "text-",
                        )}
                        placeholder={placeholder}
                      />
                      <div className="flex items-center h-8 pr-2 w-fit gap-x-2">
                        {!(readOnly || disabled) && (
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className={cn(
                              "size-6 ",
                              (!search || disabled || readOnly) && "hidden",
                            )}
                            onClick={() => {
                              setOption(null);
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
                </TooltipTrigger>
                {valueBefore !== undefined && !diff?.same && (
                  <TooltipContent side="top" align="start">
                    {diff?.before && (
                      <>
                        <s>{diff?.before}</s>
                        <br />
                      </>
                    )}
                    <span>{diff?.after}</span>
                  </TooltipContent>
                )}
              </Tooltip>
              {!(disabled || readOnly) && (
                <PopoverContent
                  onOpenAutoFocus={(e) => e.preventDefault()}
                  align="start"
                  side="bottom"
                  className="relative z-50 w-auto  min-w-(--radix-popover-trigger-width) p-0 "
                  forceMount
                  asChild
                >
                  <CommandList
                    className="p-1 space-y-2"
                    // Cegah browser memindah/menghapus fokus dari Input saat
                    // area ini di-mousedown (klik opsi) -- sekarang Input
                    // punya `onBlur` (utk Tab-autocomplete di atas), jadi
                    // tanpa guard ini klik opsi bisa nge-trigger blur DULUAN
                    // (browser default: mousedown geser fokus) sebelum
                    // onSelect klik itu sendiri sempat jalan -- rawan bikin
                    // efek exact-match on-close nyoba commit teks lama yg
                    // BELUM final. mousedown preventDefault TIDAK mencegah
                    // event click/onSelect itu sendiri.
                    onMouseDown={(e) => e.preventDefault()}
                  >
                    <CommandEmpty>{t("core.form.not_found")}</CommandEmpty>
                    {options &&
                      options?.map((option) => {
                        return (
                          <CommandItem
                            key={option.value}
                            value={option.value}
                            onSelect={() => {
                              setOption(option);
                              setOpen(false);
                            }}
                          >
                            <p
                              dangerouslySetInnerHTML={{
                                __html: highlightItem(
                                  option.label,
                                  isDirty ? (search ?? "") : "",
                                ),
                              }}
                            />
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
  }),
);

export default Select;
