import { Alert, AlertIcon, AlertTitle } from "./ui/alert";
import {
  Command,
  CommandEmpty,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "./ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "./ui/popover";
import {
  RiBarcodeBoxLine,
  RiCheckboxCircleLine,
  RiErrorWarningFill,
} from "@remixicon/react";
import {
  forwardRef,
  memo,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";

import { Command as CommandPrimitive } from "cmdk";
import { Input } from "./ui/input";
import LoadingIcon from "./LoadingIcon";
import React from "react";
import axios from "axios";
import ClickAwayListener from "react-click-away-listener";
import { cn } from "@/lib/utils";
import { convertTemplateLink } from "@/lib/linkModelUtils";
import { toast } from "sonner";
import { useLaravelReactI18n } from "laravel-react-i18n";

/**
 *
 * @param props
 * @param props.value
 * @param props.onValueChange
 * @param props.placeholder
 * @param props.className
 * @param props.disabled
 * @param props.model
 * @param props.limit
 * @param props.filters
 * @param props.joins
 * @param props.keywords
 */
export default memo(
  forwardRef(function InputBarcode(
    {
      id,
      placeholder,
      className,
      disabled,
      required,
      model,
      sort,
      limit = 10,
      filters,
      joins,
      keywords,
      translate,
      onKeyDown,
      with: _with,
      order,
      onSelect: _onSelect,
    },
    ref,
  ) {
    const { t } = useLaravelReactI18n();
    const [open, setOpen] = useState(false);
    const [search, setSearch] = useState("");
    const [total, setTotal] = useState(0);
    const [options, setOptions] = useState([]);
    const [loading, setLoading] = useState(false);

    // Refs to manage debounce & barcode detection
    const debounceRef = useRef(null);
    const lastKeyTimeRef = useRef(0);
    const fastKeyCountRef = useRef(0);
    const sequenceStartRef = useRef(null);
    const latestSearchRef = useRef("");

    const BARCODE_GAP_MS = 35; // keystroke gap that indicates a scanner
    const BARCODE_WINDOW_MS = 300; // total time window for a scan burst
    const BARCODE_MIN_STREAK = 4; // number of rapid keys to treat as scanner

    const route = window.route;
    const commandRef = useRef(null);

    const getActiveOption = useCallback(() => {
      const el =
        commandRef.current?.querySelector?.(
          "[cmdk-item][data-selected='true']",
        ) ??
        commandRef.current?.querySelector?.(
          "[cmdk-item][aria-selected='true']",
        );

      if (!el) return null;

      const valueAttr =
        el.getAttribute("data-value") ??
        el.getAttribute("cmdk-value") ??
        el.getAttribute("value");

      if (!valueAttr) return null;

      return options.find(
        (opt, index) => String(opt.id ?? index) === String(valueAttr),
      );
    }, [commandRef, options]);

    const getModels = (
      keyword = latestSearchRef.current,
      callback,
      fetchLimit = limit ?? 10,
    ) => {
      axios
        .post(route("model"), {
          model,
          limit: fetchLimit,
          search: keyword,
          with: _with,
          filters: {
            ...filters,
          },
          sort,
          joins,
          keywords,
          order,
          translate,
        })
        .then((res) => {
          const data = res.data.data;
          setTotal(res.data.total ?? data.length);
          setOptions(data);
          callback?.(data);
        })
        .catch((e) => {
          console.error(e);
          toast.custom((toastId) => (
            <Alert
              variant="destructive"
              icon="destructive"
              onClose={() => toast.dismiss(toastId)}
            >
              <AlertIcon>
                <RiErrorWarningFill />
              </AlertIcon>
              <AlertTitle>
                {t("core.form.errors.something_went_wrong")}
              </AlertTitle>
            </Alert>
          ));
        })
        .finally(() => {
          setLoading(false);
        });
    };

    useEffect(() => {
      latestSearchRef.current = search;
    }, [search]);

    useEffect(() => {
      return () => {
        if (debounceRef.current) clearTimeout(debounceRef.current);
      };
    }, []);

    const resetKeySpeed = () => {
      lastKeyTimeRef.current = 0;
      fastKeyCountRef.current = 0;
      sequenceStartRef.current = null;
    };

    const scheduleManualFetch = (value) => {
      const keyword = value ?? latestSearchRef.current ?? "";
      if (!keyword.trim()) {
        // kosong: jangan query, kosongkan hasil
        if (debounceRef.current) clearTimeout(debounceRef.current);
        setOptions([]);
        setTotal(0);
        return;
      }
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => {
        setLoading(true);
        setOpen(true);
        getModels(keyword);
      }, 500);
    };

    const triggerImmediateFetch = (value, afterFetch, isScanner = false) => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      const keyword = value ?? latestSearchRef.current;
      if (isScanner) {
        setOpen(false);
        setOptions([]);
        setTotal(0);
      }
      setLoading(true);
      getModels(
        keyword,
        (data) => {
          if (isScanner && (!data || data.length === 0)) {
            toast.custom((toastId) => (
              <Alert
                variant="warning"
                icon="warning"
                onClose={() => toast.dismiss(toastId)}
              >
                <AlertIcon>
                  <RiErrorWarningFill />
                </AlertIcon>
                <AlertTitle>
                  {t("core.form.input_barcode.no_barcode")}
                </AlertTitle>
              </Alert>
            ));
          }
          afterFetch?.(data);
        },
        1,
      );
    };
    const onSelect = useCallback(
      (value) => {
        setOpen(false);
        setSearch("");
        _onSelect?.(value);
        toast.custom((toastId) => (
          <Alert
            variant="success"
            icon="success"
            onClose={() => toast.dismiss(toastId)}
          >
            <AlertIcon>
              <RiCheckboxCircleLine />
            </AlertIcon>
            <div className="flex flex-col w-full">
              <AlertTitle>{t("core.form.input_barcode.success")}</AlertTitle>
              <p
                className="text-sm"
                dangerouslySetInnerHTML={{
                  __html: convertTemplateLink(value, "", true),
                }}
              />
            </div>
          </Alert>
        ));
      },
      [_onSelect],
    );

    const onInputKeyDown = (e) => {
      if (e.ctrlKey || e.metaKey || e.shiftKey || e.altKey || e.key == "Tab") {
        onKeyDown?.(e);
        return;
      }
      if (disabled) return;

      const now = performance.now();

      if (e.key === "Enter") {
        onKeyDown?.(e);
        const elapsed = sequenceStartRef.current
          ? now - sequenceStartRef.current
          : Number.POSITIVE_INFINITY;
        const isScannerInput =
          fastKeyCountRef.current >= BARCODE_MIN_STREAK &&
          elapsed < BARCODE_WINDOW_MS;

        if (isScannerInput) {
          e.preventDefault();
          e.stopPropagation();
          setSearch("");
          triggerImmediateFetch(
            e.target.value,
            (data) => {
              const first = data?.[0];
              if (first) onSelect(first);
            },
            true,
          );
        } else if (open && search && options?.length) {
          const activeOpt = getActiveOption();
          if (activeOpt) {
            e.preventDefault();
            onSelect(activeOpt);
          }
        }
        resetKeySpeed();
        return;
      }

      if (!sequenceStartRef.current) sequenceStartRef.current = now;

      if (lastKeyTimeRef.current) {
        const gap = now - lastKeyTimeRef.current;
        if (gap > BARCODE_WINDOW_MS) {
          sequenceStartRef.current = now;
          fastKeyCountRef.current = 0;
        } else {
          fastKeyCountRef.current =
            gap < BARCODE_GAP_MS ? fastKeyCountRef.current + 1 : 0;
        }
      }

      lastKeyTimeRef.current = now;
    };

    return (
      <ClickAwayListener onClickAway={() => setOpen(false)}>
        <div className="contents">
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
                  disabled && "cursor-not-allowed opacity-50",
                  className,
                )}
              >
                <div>
                  <Input
                    id={id}
                    ref={ref}
                    disabled={disabled}
                    onKeyDown={onInputKeyDown}
                    onClick={(e) => {
                      e.preventDefault();
                      if (search && !open) {
                        setOpen(true);
                      }
                    }}
                    required={required}
                    autoComplete="off"
                    value={search}
                    onChange={(e) => {
                      setSearch(e.target.value);
                      scheduleManualFetch(e.target.value);
                      // if (!open && e.target.value) {
                      //   setOpen(true);
                      // }
                    }}
                    className={cn(
                      "focus:border-0! bg-inherit! disabled:opacity-100! h-8 w-full rounded-none! pr-2! border-0!  focus-visible:ring-0! focus-visible:ring-offset-0!  ",
                    )}
                    placeholder={
                      placeholder ?? t("core.form.input_barcode.placeholder")
                    }
                  />
                  <div className="flex items-center h-8 pr-2 w-fit gap-x-2">
                    {loading ? (
                      <LoadingIcon className="size-4" />
                    ) : (
                      <RiBarcodeBoxLine className="size-4 fill-muted-foreground" />
                    )}
                  </div>
                </div>
              </PopoverTrigger>
              {!disabled && (
                <PopoverContent
                  onOpenAutoFocus={(e) => e.preventDefault()}
                  align="start"
                  side="bottom"
                  className="relative z-50 w-auto  min-w-(--radix-popover-trigger-width) p-0 "
                  forceMount
                  asChild
                >
                  <CommandList className="p-1 space-y-2">
                    {loading ? (
                      <CommandPrimitive.Loading>
                        <div className="flex justify-center py-6 text-sm font-normal text-center text-foreground gap-x-4">
                          <LoadingIcon className="size-4" />
                          <span>{t("core.form.loading")} ...</span>
                        </div>
                      </CommandPrimitive.Loading>
                    ) : (
                      <>
                        <CommandEmpty>{t("core.form.not_found")}</CommandEmpty>
                        {options &&
                          options?.map((opt, index) => {
                            return (
                              <CommandItem
                                key={opt.id ?? index}
                                value={String(opt.id ?? index)}
                                data-value={String(opt.id ?? index)}
                                onSelect={() => onSelect(opt)}
                              >
                                <p
                                  dangerouslySetInnerHTML={{
                                    __html: convertTemplateLink(
                                      opt,
                                      search ?? "",
                                    ),
                                  }}
                                />
                              </CommandItem>
                            );
                          })}
                        {total > limit && <CommandSeparator />}
                        {total > limit && (
                          <CommandItem
                            className="text-blue-700 hover:text-blue-900! dark:text-blue-300 dark:hover:text-blue-200!"
                            onSelect={() => {
                              // setOpenDialog(true);
                            }}
                          >
                            {t("core.form.linkmodel.more")}
                          </CommandItem>
                        )}
                      </>
                    )}
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
