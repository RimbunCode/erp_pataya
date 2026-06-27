import { ArrowRight, PlusIcon, XIcon } from "lucide-react";
import {
  Command,
  CommandEmpty,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "./ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "./ui/popover";
import { Tooltip, TooltipContent, TooltipTrigger } from "./ui/tooltip";
import { camelize, cn } from "@/lib/utils";
import { convertTemplateLink, validate } from "@/lib/linkModelUtils";
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
import { Command as CommandPrimitive } from "cmdk";
import { FormPageDialog } from "@/Pages/Core/FormPage";
import { Input } from "./ui/input";
import LoadingIcon from "./LoadingIcon";
import axios from "axios";
import { gooeyToast } from "@/lib/gooeyToast";
import { isEqual } from "lodash";
import pluralize from "pluralize";
import useDidMountEffect from "@/Hooks/useDidMountEffect";
import { useLaravelReactI18n } from "laravel-react-i18n";
import usePermission from "@/Hooks/usePermission";
import { useRef } from "react";

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
 * @param props.fields kolom non-templateLink yang form butuh (di luar tampilan dropdown).
 *   Hanya kolom ber-`linkable` di server yang akan keluar; kolom sensitif tetap di-gate
 *   `visibleFor`. Default `[]` (hanya kolom templateLink). Lihat spec linkmodel-column-security.
 * @param props.keywords
 * @param props.cache boolean | { enabled?: boolean, refreshMs?: number }
 * @param props.cacheStorage "memory" | "localStorage" | "sessionStorage" | "indexedDB"
 */
export default memo(
  forwardRef(function LinkModel(
    {
      id,
      as,
      valueBefore,
      defaultValue,
      value,
      onValueChange,
      placeholder,
      className,
      disabled,
      readOnly,
      required,
      model,
      limit = 10,
      filters,
      joins,
      keywords,
      cache = false,
      cacheStorage = "memory",
      translate,
      titleDialog,
      classNameDialog,
      disabledNavigation,
      disabledAddButton,
      defaultValueForm,
      form,
      postOption,
      onKeyDown,
      with: _with,
      fields,
      order,
      customNavigation,
    },
    ref,
  ) {
    const { t } = useLaravelReactI18n();
    const [open, setOpen] = useState(false);
    const [_option, _setOption] = useState(value);
    const [search, setSearch] = useState(convertTemplateLink(value ?? ""));
    const [total, setTotal] = useState(0);
    const [options, setOptions] = useState([]);
    const [cacheLoaded, setCacheLoaded] = useState(false);
    const [allowSearch, setAllowSearch] = useState(true);
    const [loading, setLoading] = useState(false);
    const [openDialog, setOpenDialog] = useState(false);
    const { can } = usePermission(model);
    const cacheConfig = useMemo(() => {
      if (typeof cache === "object") {
        return {
          enabled: cache.enabled ?? true,
          refreshMs: cache.refreshMs ?? null,
        };
      }
      return {
        enabled: !!cache,
        refreshMs: null,
      };
    }, [cache]);

    const stableStringify = useCallback((val) => {
      try {
        return JSON.stringify(val, (_key, value) => {
          if (value && typeof value === "object" && !Array.isArray(value)) {
            return Object.keys(value)
              .sort()
              .reduce((acc, k) => {
                acc[k] = value[k];
                return acc;
              }, {});
          }
          return value;
        });
      } catch {
        return JSON.stringify(val);
      }
    }, []);

    const cacheKey = useMemo(() => {
      if (!cacheConfig.enabled) return null;
      return `linkmodel:${model}:${stableStringify({
        joins,
        filters,
        with: _with,
        keywords,
        order,
        translate,
      })}`;
    }, [
      cacheConfig.enabled,
      joins,
      filters,
      _with,
      keywords,
      order,
      translate,
      model,
      stableStringify,
    ]);

    const cacheStore = useMemo(() => {
      if (!cacheConfig.enabled) return null;
      if (cacheStorage === "localStorage") return window?.localStorage ?? null;
      if (cacheStorage === "sessionStorage")
        return window?.sessionStorage ?? null;
      if (cacheStorage === "indexedDB") return "indexedDB";
      return null; // memory handled by state
    }, [cacheConfig.enabled, cacheStorage]);

    const memoryCacheRef = useRef(new Map());
    const idbInstanceRef = useRef(null);

    const getIdb = useCallback(() => {
      if (idbInstanceRef.current) return idbInstanceRef.current;
      idbInstanceRef.current = new Promise((resolve, reject) => {
        const request = window.indexedDB.open("linkmodel-cache", 1);
        request.onupgradeneeded = () => {
          const db = request.result;
          if (!db.objectStoreNames.contains("entries")) {
            db.createObjectStore("entries", { keyPath: "key" });
          }
        };
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });
      return idbInstanceRef.current;
    }, []);

    const readCache = useCallback(
      async (key) => {
        if (!cacheConfig.enabled || !key) return null;
        if (cacheStore === "indexedDB") {
          try {
            const db = await getIdb();
            return await new Promise((resolve, reject) => {
              const tx = db.transaction("entries", "readonly");
              const store = tx.objectStore("entries");
              const req = store.get(key);
              req.onsuccess = () => resolve(req.result);
              req.onerror = () => reject(req.error);
            });
          } catch {
            return null;
          }
        }
        if (cacheStore) {
          const raw = cacheStore.getItem(key);
          return raw ? JSON.parse(raw) : null;
        }
        return memoryCacheRef.current.get(key) ?? null;
      },
      [cacheConfig.enabled, cacheStore, getIdb],
    );

    const writeCache = useCallback(
      async (key, value) => {
        if (!cacheConfig.enabled || !key) return;
        if (cacheStore === "indexedDB") {
          try {
            const db = await getIdb();
            await new Promise((resolve, reject) => {
              const tx = db.transaction("entries", "readwrite");
              tx.oncomplete = () => resolve();
              tx.onerror = () => reject(tx.error);
              tx.objectStore("entries").put({ key, ...value });
            });
          } catch {
            // ignore cache errors
          }
          return;
        }
        if (cacheStore) {
          cacheStore.setItem(key, JSON.stringify(value));
          return;
        }
        memoryCacheRef.current.set(key, value);
      },
      [cacheConfig.enabled, cacheStore, getIdb],
    );

    const removeCache = useCallback(
      async (key) => {
        if (!cacheConfig.enabled || !key) return;
        if (cacheStore === "indexedDB") {
          try {
            const db = await getIdb();
            await new Promise((resolve, reject) => {
              const tx = db.transaction("entries", "readwrite");
              tx.oncomplete = () => resolve();
              tx.onerror = () => reject(tx.error);
              tx.objectStore("entries").delete(key);
            });
          } catch {
            // ignore
          }
          return;
        }
        if (cacheStore) {
          cacheStore.removeItem(key);
          return;
        }
        memoryCacheRef.current.delete(key);
      },
      [cacheConfig.enabled, cacheStore, getIdb],
    );

    const { name, keyRoute } = useMemo(() => {
      if (as) {
        const [name, keyRoute] = as.split(":");
        return { name: camelize(name), keyRoute };
      }
      return {
        name: camelize((model ?? "").split("\\").pop()),
        keyRoute: "id",
      };
    }, [as, model]);

    const route = window.route;
    const isControlled = value !== undefined;
    const commandRef = useRef(null);

    const option = useMemo(() => {
      // eslint-disable-next-line react-hooks/set-state-in-render
      setLoading(false);
      return isControlled ? value : _option;
    }, [isControlled, value, _option]);

    useDidMountEffect(() => {
      _setOption((prev) => {
        // kalau sama, jangan trigger apa-apa
        if (isEqual(prev, value)) return prev;

        return value;
      });
    }, [value]);

    const setOption = useCallback(
      (val) => {
        if (disabled || readOnly) return;
        if (val) {
          const isValid = validate(val, model);
          if (!isValid) return;
        }
        if (isControlled) {
          if (isEqual(value, val)) return;
          onValueChange?.(val);
          return;
        }
        _setOption((prev) => {
          // kalau sama, jangan trigger apa-apa
          if (isEqual(prev, val)) return prev;
          onValueChange?.(val);
          return val;
        });
      },
      [
        onValueChange,
        _setOption,
        disabled,
        readOnly,
        filters,
        isControlled,
        value,
      ],
    );

    useEffect(() => {
      if (open) return;

      setLoading(false);
      if (isControlled && value === null) {
        setAllowSearch(true);
        if (search) {
          setSearch("");
        }
        return;
      }
      if (!option && search) {
        const findOption = options.find(
          (x) => convertTemplateLink(x).toLowerCase() == search.toLowerCase(),
        );
        if (findOption) {
          setOption(findOption);

          return;
        }
        setAllowSearch(false);
        setSearch("");
      }
    }, [open, isControlled, value, search, option, options, setOption]);

    useEffect(() => {
      if (option) {
        setAllowSearch(false);
        setSearch(convertTemplateLink(option));
      } else if (!open) {
        setAllowSearch(true);
        setSearch("");
      }
    }, [option]);

    useEffect(() => {
      if (valueBefore !== undefined) {
        return;
      }
      if (!(option || value)) return;
      const isValid = validate(option || value, model);

      if (!isValid) {
        setOption(null);
      }
    }, [filters, option, value, model]);

    useEffect(() => {
      if (!cacheConfig.enabled) return;
      setCacheLoaded(false);
      setOptions([]);
      setTotal(0);
      if (cacheKey) {
        removeCache(cacheKey);
      }
    }, [
      cacheConfig.enabled,
      cacheConfig.refreshMs,
      cacheKey,
      removeCache,
      model,
    ]);

    useEffect(() => {
      if (!cacheConfig.enabled || !cacheKey) return;
      let active = true;
      (async () => {
        const parsed = await readCache(cacheKey);
        if (!parsed || !active) return;
        const expired =
          cacheConfig.refreshMs &&
          parsed.ts &&
          Date.now() - parsed.ts > cacheConfig.refreshMs;
        if (!expired && parsed.data) {
          setOptions(parsed.data);
          setTotal(parsed.total ?? parsed.data.length);
          setCacheLoaded(true);
          setLoading(false);
          return;
        }
        if (expired) {
          removeCache(cacheKey);
        }
      })();
      return () => {
        active = false;
      };
    }, [
      cacheConfig.enabled,
      cacheConfig.refreshMs,
      cacheKey,
      readCache,
      removeCache,
    ]);

    const getModels = (
      filterForDefaultValue = {},
      callback,
      { cacheMode = false } = {},
    ) => {
      const isCacheRequest = cacheMode && cacheConfig.enabled;
      const payload = {
        model,
        cacheMode: isCacheRequest,
        joins,
      };

      if (!isCacheRequest) {
        Object.assign(payload, {
          limit: limit ?? 10,
          search,
          with: _with,
          fields,
          filters: {
            ...filters,
            ...filterForDefaultValue,
          },
          keywords,
          order,
          translate,
        });
      }

      axios
        .post(route("model"), payload)
        .then((res) => {
          const data = res.data.data;
          setTotal(res.data.total ?? data.length);
          setOptions(data);
          if (cacheMode) {
            setCacheLoaded(true);
            if (cacheKey) {
              writeCache(cacheKey, {
                data,
                total: res.data.total ?? data.length,
                ts: Date.now(),
              });
            }
          }
          callback?.(data);
        })
        .catch(() => {
          gooeyToast.error(t("core.errors.fetch_failed"));
        })
        .finally(() => {
          setLoading(false);
        });
    };
    useEffect(() => {
      if (!cacheConfig.enabled || !cacheConfig.refreshMs) return;
      const refresh = setInterval(() => {
        setLoading(true);
        getModels({}, null, { cacheMode: true });
      }, cacheConfig.refreshMs);
      return () => clearInterval(refresh);
    }, [
      cacheConfig.enabled,
      cacheConfig.refreshMs,
      model,
      JSON.stringify(joins),
    ]);

    useEffect(() => {
      if (!cacheConfig.enabled || cacheLoaded) return;
      setLoading(true);
      getModels({}, null, { cacheMode: true });
    }, [cacheConfig, cacheLoaded]);

    useDidMountEffect(() => {
      if (!allowSearch) return;
      if (cacheConfig.enabled) return;
      setLoading(true);
      const reloadModel = setTimeout(() => {
        getModels();
      }, 500);
      return () => {
        clearTimeout(reloadModel);
      };
    }, [search]);
    const defaultKey = useMemo(
      () => (defaultValue ? JSON.stringify(defaultValue) : null),
      [defaultValue],
    );

    const loadedDefaultKeyRef = useRef(null);

    useEffect(() => {
      if (!defaultKey || value) return;

      if (loadedDefaultKeyRef.current === defaultKey) return;
      loadedDefaultKeyRef.current = defaultKey;

      setLoading(true);
      const reloadModel = setTimeout(() => {
        getModels(
          defaultValue,
          (data) => {
            if (data.length <= 0) return;
            setOption(data[0]);
          },
          { cacheMode: cacheConfig.enabled },
        );
      }, 500);

      return () => clearTimeout(reloadModel);
    }, [defaultKey, value]);
    useDidMountEffect(() => {
      if (!open) return;
      if (cacheConfig.enabled) {
        if (!cacheLoaded) {
          setLoading(true);
          const reloadModel = setTimeout(() => {
            getModels({}, null, { cacheMode: true });
          }, 100);
          return () => {
            clearTimeout(reloadModel);
          };
        }
        return;
      }
      setLoading(true);
      const reloadModel = setTimeout(() => {
        getModels();
      }, 100);
      return () => {
        clearTimeout(reloadModel);
      };
    }, [open]);
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
      if (option) {
        setOption(null);
      }
      if (!open) {
        setOpen(true);
      }
    };

    const onSuccessFormPageDialog = (e) => {
      setOpen(false);
      axios
        .post(route("model"), {
          model,
          with: _with,
          id: e.props.flash.id ?? null,
        })
        .then((res) => {
          setOption(res.data);
        })
        .catch(() => {
          gooeyToast.error(t("core.errors.fetch_failed"));
        })
        .finally(() => {
          setLoading(false);
        });
    };

    const diff = useMemo(() => {
      const before = convertTemplateLink(valueBefore);
      const after = convertTemplateLink(value);
      return {
        before: before != after && before,
        after,
        same: before == after,
      };
    }, [value, valueBefore]);

    const filteredOptions = useMemo(() => {
      if (!cacheConfig.enabled) return options;
      let list = options.filter((opt) => validate(opt, model));
      if (cacheConfig.enabled && order) {
        const [col, dir = "asc"] = (order ?? "").split(":");
        list = [...list].sort((a, b) => {
          const va = col ? a[col] : convertTemplateLink(a);
          const vb = col ? b[col] : convertTemplateLink(b);
          if (va == null && vb == null) return 0;
          if (va == null) return dir === "asc" ? -1 : 1;
          if (vb == null) return dir === "asc" ? 1 : -1;
          if (typeof va === "number" && typeof vb === "number") {
            return dir === "asc" ? va - vb : vb - va;
          }
          return (
            String(va).localeCompare(String(vb)) * (dir === "asc" ? 1 : -1)
          );
        });
      }
      if (!search) return list;
      const keyword = (search ?? "")?.toLowerCase();
      return list.filter((opt) =>
        convertTemplateLink(opt, "", true).toLowerCase().includes(keyword),
      );
    }, [cacheConfig.enabled, options, search, filters, order]);

    const showMore = useMemo(
      () => !cacheConfig.enabled && total > limit,
      [cacheConfig.enabled, limit, total],
    );

    const disabledAdd = useMemo(() => {
      if (disabledAddButton) return true;
      else if (!form) return true;
      else if (!can("create")) return true;
      return false;
    }, [disabledAddButton, form, can]);
    return (
      <ClickAwayListener onClickAway={() => setOpen(false)}>
        <div className={cn("w-full", className)}>
          <Popover open={open} onOpenChange={() => {}}>
            <Command
              className="relative h-full overflow-visible bg-transparent"
              ref={commandRef}
              loop
            >
              <Tooltip>
                <TooltipTrigger asChild>
                  <PopoverTrigger
                    asChild
                    className={cn(
                      "flex h-full bg-muted items-center  overflow-hidden border rounded-md cursor-default group/model relative focus-within:border-0 border-input ring-offset-background  focus-within:outline-none focus-within:ring-1 focus-within:ring-ring focus-within:ring-offset-1",
                      valueBefore !== undefined &&
                        !diff?.same &&
                        "bg-yellow-200 dark:bg-yellow-900",
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
                          if (!(option && search) && !open) {
                            setOpen(true);
                          }
                        }}
                        required={required}
                        value={search}
                        onChange={(e) => {
                          setAllowSearch(true);
                          setSearch(e.target.value);
                        }}
                        className={cn(
                          "focus:border-0! bg-inherit! disabled:opacity-100! h-8 w-full rounded-none! pr-2! border-0!  focus-visible:ring-0! focus-visible:ring-offset-0!  ",
                          // diff.same && "text-",
                        )}
                        placeholder={placeholder}
                      />
                      <div className="flex items-center h-8 pr-2 w-fit gap-x-2">
                        {loading ? (
                          <LoadingIcon className="size-4" />
                        ) : (
                          <>
                            {!disabledNavigation &&
                              name &&
                              option &&
                              search &&
                              can("read", {
                                user_id: option.created_by_id,
                              }) && (
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="icon"
                                  className={cn(
                                    "size-6 hidden",
                                    valueBefore && "inline-flex!",
                                    option &&
                                      search &&
                                      "group-focus-within/model:inline-flex",
                                  )}
                                  onClick={() => {
                                    if (!name || !option || !search) return;
                                    if (
                                      customNavigation &&
                                      typeof customNavigation === "function"
                                    ) {
                                      customNavigation(value);
                                    }
                                    const pluralized = `${pluralize.plural(name ?? "")}.show`;
                                    window.open(
                                      route(
                                        pluralized,
                                        option[keyRoute ?? "id"],
                                      ),
                                      "_blank",
                                    );
                                  }}
                                >
                                  <ArrowRight className="size-3" />
                                </Button>
                              )}
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
                              }}
                            >
                              <XIcon className="size-3" />
                            </Button>
                          </>
                        )}
                      </div>
                    </div>
                  </PopoverTrigger>
                </TooltipTrigger>
                {valueBefore && !diff?.same && (
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
                        {filteredOptions &&
                          filteredOptions?.map((opt, index) => {
                            return (
                              <CommandItem
                                key={opt.id ?? index}
                                value={opt.id ?? index}
                                onSelect={() => {
                                  setOption(opt);

                                  setOpen(false);
                                }}
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
                        {showMore && !disabledAdd && <CommandSeparator />}
                        {showMore && (
                          <CommandItem
                            className="text-blue-700 hover:text-blue-900! dark:text-blue-300 dark:hover:text-blue-200!"
                            onSelect={() => {
                              // setOpenDialog(true);
                            }}
                          >
                            {t("core.form.linkmodel.more")}
                          </CommandItem>
                        )}
                        {!disabledAdd && (
                          <CommandItem
                            onSelect={() => {
                              if (form) {
                                setOpenDialog(true);
                                return;
                              }

                              if (!name) return;
                              const pluralized = `${pluralize.plural(name ?? "")}.create`;
                              window.open(route(pluralized), "_blank");
                            }}
                          >
                            <PlusIcon className="size-4" />
                            {titleDialog}
                          </CommandItem>
                        )}
                      </>
                    )}
                  </CommandList>
                </PopoverContent>
              )}
            </Command>
            {!disabledAdd && (
              <FormPageDialog
                title={titleDialog}
                name={name}
                open={openDialog}
                onOpenChange={setOpenDialog}
                className={cn("max-w-4xl", classNameDialog)}
                defaultValue={defaultValueForm}
                onSuccess={onSuccessFormPageDialog}
                postOption={postOption}
              >
                {form}
              </FormPageDialog>
            )}
          </Popover>
        </div>
      </ClickAwayListener>
    );
  }),
);
