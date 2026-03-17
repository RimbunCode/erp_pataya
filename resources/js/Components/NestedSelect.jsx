import { ChevronDown, ChevronLeft, ChevronRight, Loader2 } from "lucide-react";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "./ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "./ui/popover";
import React, {
  forwardRef,
  memo,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import { Button } from "./ui/button";
import { cn } from "@/lib/utils";
import { useCommandState } from "cmdk";
import { useLaravelReactI18n } from "laravel-react-i18n";

/**
 * NestedSearchSelect
 * A cascader-style select with typeahead search.
 *
 * Props:
 * - options: Option[]               initial tree to render.
 * - value: string | null            selected option value.
 * - onValueChange(val): void        fired when user picks a node.
 * - placeholder: string             shown when no selection.
 * - className, disabled, readOnly   styling / state flags.
 * - fetchChildren(node): Promise<Option[]> | undefined
 *     invoked when entering a `loadable` relation node to lazy-fetch children.
 *
 * Option shape:
 * {
 *   label: string,                  // display text
 *   value?: string,                 // defaults to label
 *   type?: string,                  // e.g., "relation"
 *   relation?: string,              // backend model for lazy fetch
 *   loadable?: boolean,             // true => call fetchChildren on enter
 *   children?: Option[],            // preloaded children
 * }
 */
const NestedSelect = forwardRef(function NestedSelect(
  {
    options = [],
    value,
    onValueChange,
    placeholder,
    className,
    disabled,
    readOnly,
    fetchChildren,
  },
  ref,
) {
  const inputRef = useRef(null);
  const { t } = useLaravelReactI18n();
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [tree, setTree] = useState([]);
  const [pathValues, setPathValues] = useState([]);
  const [activeValue, setActiveValue] = useState("");
  const [splitTarget, setSplitTarget] = useState("label");
  const pendingSplitTargetRef = useRef(null);

  const withMeta = useCallback((opts, parents = []) => {
    return (opts ?? []).filter(Boolean).map((opt) => {
      const label = opt.label ?? "";
      const path = [...parents, label];
      return {
        ...opt,
        label,
        value: opt.value ?? label,
        children: withMeta(opt.children, [...path]),
        loaded:
          !!(opt.children && opt.children.length > 0) || opt.loadable === false,
        loading: false,
      };
    });
  }, []);

  useEffect(() => {
    setTree(withMeta(options));
  }, [options, withMeta]);

  useEffect(() => {
    if (!open) {
      setSearch("");
      setPathValues([]);
      setActiveValue("");
      setSplitTarget("label");
      pendingSplitTargetRef.current = null;
      return;
    }
    inputRef.current?.focus();
  }, [open]);

  useEffect(() => {
    if (!activeValue) {
      setSplitTarget("label");
      pendingSplitTargetRef.current = null;
      return;
    }
    const pending = pendingSplitTargetRef.current;
    if (pending) {
      setSplitTarget(pending);
      pendingSplitTargetRef.current = null;
      return;
    }
    setSplitTarget("label");
  }, [activeValue]);

  const queueSplitTarget = useCallback(
    (target, value) => {
      pendingSplitTargetRef.current = target;
      if (value && value === activeValue) {
        setSplitTarget(target);
      }
    },
    [activeValue],
  );

  const updateNode = useCallback((nodes, target, updater) => {
    return nodes.map((n) => {
      if (n.value === target) {
        const updated =
          typeof updater === "function" ? updater(n) : { ...n, ...updater };
        return updated;
      }
      if (n.children?.length) {
        return { ...n, children: updateNode(n.children, target, updater) };
      }
      return n;
    });
  }, []);

  const ensureChildren = useCallback(
    async (node) => {
      if (!fetchChildren || node.loaded || node.loading || !node.loadable) {
        return;
      }
      setTree((prev) =>
        updateNode(prev, node.value, (old) => ({ ...old, loading: true })),
      );
      try {
        const children = (await fetchChildren(node))?.filter(Boolean) ?? [];
        setTree((prev) =>
          updateNode(prev, node.value, (old) => ({
            ...old,
            children,
            loaded: true,
            loading: false,
          })),
        );
      } catch (err) {
        console.error(err);
        setTree((prev) =>
          updateNode(prev, node.value, (old) => ({
            ...old,
            loaded: true,
            loading: false,
          })),
        );
      }
    },
    [fetchChildren, updateNode],
  );

  const selectedNode = useMemo(() => {
    const all = [];
    const walk = (nodes, trail = []) => {
      nodes?.forEach((n) => {
        if (!n) return;
        const path = [...trail, n];
        all.push({
          ...n,
          pathLabel: path.map((p) => p.label).join(" / "),
          pathValues: path.map((p) => p.value),
        });
        if (n.children?.length) walk(n.children, path);
      });
    };
    walk(tree);
    return all.find((n) => n.value === value);
  }, [tree, value]);

  const valuePath = useMemo(() => {
    if (!value || typeof value !== "string") return [];
    const segments = value.split(".").filter(Boolean);
    const path = [];
    segments.reduce((acc, seg) => {
      const next = acc ? `${acc}.${seg}` : seg;
      path.push(next);
      return next;
    }, "");
    return path;
  }, [value]);

  const currentNode = useMemo(() => {
    if (pathValues.length === 0) return null;
    let nodes = tree;
    let found = null;
    for (const val of pathValues) {
      found = nodes?.find((n) => n.value === val);
      if (!found) return null;
      nodes = found.children ?? [];
    }
    return found;
  }, [tree, pathValues]);

  useEffect(() => {
    if (!valuePath.length || !fetchChildren) return;
    let isActive = true;
    const loadPath = async () => {
      let nodes = tree;
      for (const pathValue of valuePath) {
        const node = nodes?.find((n) => n.value === pathValue);
        if (!node) return;
        if (node.loadable && !node.loaded && !node.loading) {
          await ensureChildren(node);
          if (!isActive) return;
        }
        nodes = node.children ?? [];
      }
    };
    loadPath();
    return () => {
      isActive = false;
    };
  }, [valuePath, tree, fetchChildren, ensureChildren]);

  useEffect(() => {
    if (!currentNode) return;
    ensureChildren(currentNode);
  }, [currentNode, ensureChildren]);

  useEffect(() => {
    if (pathValues.length > 0 && !currentNode) {
      setPathValues([]);
    }
  }, [currentNode, pathValues.length]);

  const currentOptions = currentNode ? (currentNode.children ?? []) : tree;

  const currentPathLabel = useMemo(() => {
    if (pathValues.length === 0) return "";
    let nodes = tree;
    const labels = [];
    for (const val of pathValues) {
      const node = nodes?.find((n) => n.value === val);
      if (!node) break;
      labels.push(node.label);
      nodes = node.children ?? [];
    }
    return labels.join(" / ");
  }, [tree, pathValues]);

  const flatten = useMemo(() => {
    const res = [];
    const walk = (nodes, trail = []) => {
      nodes?.forEach((n) => {
        if (!n) return;
        const path = [...trail, n];
        res.push({
          ...n,
          pathLabel: path.map((p) => p.label).join(" / "),
          pathValues: path.map((p) => p.value),
        });
        if (n.children?.length) walk(n.children, path);
      });
    };
    walk(tree);
    return res;
  }, [tree]);

  const nodeByValue = useMemo(() => {
    const map = new Map();
    const walk = (nodes) => {
      nodes?.forEach((n) => {
        if (!n) return;
        map.set(n.value, n);
        if (n.children?.length) walk(n.children);
      });
    };
    walk(tree);
    return map;
  }, [tree]);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return [];
    return flatten.filter(
      (n) =>
        (n.label ?? "").toLowerCase().includes(term) ||
        (n.pathLabel ?? "").toLowerCase().includes(term) ||
        (n.value ?? "").toLowerCase().includes(term),
    );
  }, [search, flatten]);

  const handleSelect = useCallback(
    (val) => {
      if (readOnly || disabled) return;
      onValueChange?.(val);
      setOpen(false);
      setSearch("");
      setPathValues([]);
    },
    [onValueChange, readOnly, disabled],
  );

  const enterNode = useCallback(
    async (node) => {
      if (readOnly || disabled) return;
      setSearch("");
      setPathValues((prev) => [...prev, node.value]);
      await ensureChildren(node);
    },
    [ensureChildren, readOnly, disabled],
  );

  const handleSearchEnter = useCallback(
    async (node) => {
      setSearch("");
      setPathValues(node.pathValues ?? []);
      await ensureChildren(node);
    },
    [ensureChildren],
  );

  const handleSplitSelect = useCallback(
    (node, hasChildren, enterHandler) => {
      if (!node) return;
      if (!hasChildren) {
        handleSelect(node.value);
        return;
      }
      const target = node.value === activeValue ? splitTarget : "label";
      if (target === "chevron") {
        enterHandler(node);
        return;
      }
      handleSelect(node.value);
    },
    [activeValue, handleSelect, splitTarget],
  );

  const handleCommandKeyDown = useCallback(
    (event) => {
      if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") {
        return;
      }
      if (!activeValue) return;
      const node = nodeByValue.get(activeValue);
      const hasChildren = node?.children?.length > 0 || node?.loadable;
      if (!hasChildren) return;
      event.preventDefault();
      event.stopPropagation();
      setSplitTarget(event.key === "ArrowRight" ? "chevron" : "label");
    },
    [activeValue, nodeByValue],
  );

  const CommandValueSync = ({ onChange }) => {
    const value = useCommandState((state) => state.value);
    useEffect(() => {
      onChange?.(value ?? "");
    }, [value, onChange]);
    return null;
  };

  return (
    <Popover
      open={open}
      onOpenChange={(valueOpen) => {
        setOpen(valueOpen);
        if (!valueOpen) {
          setSearch("");
          setPathValues([]);
        }
      }}
      modal={false}
    >
      <PopoverTrigger asChild>
        <Button
          ref={ref}
          variant="outline"
          size="sm"
          disabled={disabled}
          className={cn(
            "flex h-8 w-full justify-between gap-2 overflow-hidden",
            disabled && "cursor-not-allowed opacity-70",
            className,
          )}
        >
          <span className="truncate text-left">
            {selectedNode?.pathLabel ?? placeholder}
          </span>
          <ChevronDown className="size-4 shrink-0" />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        className="p-0"
        align="start"
        onEscapeKeyDown={(event) => {
          if (pathValues.length === 0) return;
          event.preventDefault();
          event.stopPropagation();
          setSearch("");
          setPathValues((prev) => prev.slice(0, -1));
        }}
      >
        <Command
          shouldFilter={false}
          className="min-w-[18rem]"
          onKeyDown={handleCommandKeyDown}
        >
          <CommandValueSync onChange={setActiveValue} />
          <div className="flex items-center gap-2 border-b border-muted px-2 py-1.5">
            {pathValues.length > 0 && (
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-6 w-6"
                onClick={() => {
                  setSearch("");
                  setPathValues((prev) => prev.slice(0, -1));
                  inputRef.current?.focus();
                }}
              >
                <ChevronLeft className="size-4" />
              </Button>
            )}
            <div className="text-xs text-muted-foreground truncate">
              {pathValues.length > 0
                ? currentPathLabel
                : t("core.datatable.filter.column.all_columns")}
            </div>
          </div>
          <CommandInput
            ref={inputRef}
            value={search}
            onValueChange={setSearch}
            placeholder={t("core.datatable.filter.column.search.placeholder")}
          />
          <CommandList className="max-h-72">
            {search.trim() ? (
              filtered.length === 0 ? (
                <CommandEmpty>
                  {t("core.datatable.filter.column.not_found")}
                </CommandEmpty>
              ) : (
                <CommandGroup>
                  {filtered.map((item) => {
                    const hasChildren =
                      item.children?.length > 0 || item.loadable;
                    const isActive = selectedNode?.value === item.value;
                    const isFocusedItem = activeValue === item.value;
                    const isSplitChevron =
                      hasChildren && isFocusedItem && splitTarget === "chevron";
                    const isSplitLabel =
                      !hasChildren || !isFocusedItem || splitTarget === "label";
                    return (
                      <CommandItem
                        key={item.value}
                        value={item.value}
                        onSelect={() =>
                          handleSplitSelect(
                            item,
                            hasChildren,
                            handleSearchEnter,
                          )
                        }
                        onKeyDown={(event) => {
                          if (!hasChildren) {
                            return;
                          }
                          if (event.key === "ArrowRight") {
                            event.preventDefault();
                            event.stopPropagation();
                            setSplitTarget("chevron");
                            return;
                          }
                          if (event.key === "ArrowLeft") {
                            event.preventDefault();
                            event.stopPropagation();
                            setSplitTarget("label");
                          }
                        }}
                        className="group justify-between gap-0 p-0 data-[selected=true]:bg-transparent"
                      >
                        <div
                          className={cn(
                            "flex-1 min-w-0 px-2 py-1.5 rounded-sm transition-colors hover:bg-accent/60 hover:text-accent-foreground",
                            isSplitLabel &&
                              "group-data-[selected=true]:bg-accent group-data-[selected=true]:text-accent-foreground",
                            !isSplitLabel &&
                              "group-data-[selected=true]:text-accent-foreground/80",
                            hasChildren &&
                              isSplitChevron &&
                              "text-muted-foreground",
                            isActive && "bg-accent/40 text-accent-foreground",
                          )}
                          onPointerEnter={() =>
                            queueSplitTarget("label", item.value)
                          }
                        >
                          <span className="truncate">{item.pathLabel}</span>
                        </div>
                        {hasChildren && (
                          <button
                            type="button"
                            className={cn(
                              "flex h-[34px] w-8 items-center justify-center rounded-sm border-l border-transparent transition-colors text-muted-foreground/70",
                              "hover:bg-accent/60 hover:text-accent-foreground",
                              "group-hover:border-muted-foreground/20 group-data-[selected=true]:border-muted-foreground/20",
                              isSplitChevron &&
                                "group-data-[selected=true]:bg-accent group-data-[selected=true]:text-accent-foreground group-data-[selected=true]:ring-1 group-data-[selected=true]:ring-ring/50",
                              !isSplitChevron &&
                                "group-data-[selected=true]:text-accent-foreground/80",
                            )}
                            aria-label={`Lihat kolom di dalam ${item.label}`}
                            onMouseDown={(event) => {
                              event.preventDefault();
                              event.stopPropagation();
                            }}
                            onPointerEnter={() =>
                              queueSplitTarget("chevron", item.value)
                            }
                            onClick={(event) => {
                              event.preventDefault();
                              event.stopPropagation();
                              handleSearchEnter(item);
                            }}
                          >
                            <ChevronRight className="size-4 shrink-0" />
                          </button>
                        )}
                      </CommandItem>
                    );
                  })}
                </CommandGroup>
              )
            ) : currentNode?.loading ? (
              <CommandGroup>
                <CommandItem disabled>
                  <Loader2 className="size-4 animate-spin" />
                  {t("core.datatable.filter.column.loading")}
                </CommandItem>
              </CommandGroup>
            ) : currentOptions.length === 0 ? (
              <CommandEmpty>Tidak ada kolom</CommandEmpty>
            ) : (
              <>
                {currentNode && (
                  <>
                    <CommandGroup>
                      <CommandItem
                        value={currentNode.value}
                        onSelect={() => handleSelect(currentNode.value)}
                        className="font-medium"
                      >
                        {t("core.datatable.filter.column.select", {
                          column: currentNode.label,
                        })}
                      </CommandItem>
                    </CommandGroup>
                    <CommandSeparator />
                  </>
                )}
                <CommandGroup>
                  {currentOptions.map((opt) => {
                    const hasChildren =
                      opt.children?.length > 0 || opt.loadable;
                    const isActive = selectedNode?.value === opt.value;
                    const isFocusedItem = activeValue === opt.value;
                    const isSplitChevron =
                      hasChildren && isFocusedItem && splitTarget === "chevron";
                    const isSplitLabel =
                      !hasChildren || !isFocusedItem || splitTarget === "label";
                    return (
                      <CommandItem
                        key={opt.value ?? opt.label}
                        value={opt.value}
                        onSelect={() =>
                          handleSplitSelect(opt, hasChildren, enterNode)
                        }
                        onKeyDown={(event) => {
                          if (!hasChildren) {
                            return;
                          }
                          if (event.key === "ArrowRight") {
                            event.preventDefault();
                            event.stopPropagation();
                            setSplitTarget("chevron");
                            return;
                          }
                          if (event.key === "ArrowLeft") {
                            event.preventDefault();
                            event.stopPropagation();
                            setSplitTarget("label");
                          }
                        }}
                        className={cn(
                          "group justify-between p-0 data-[selected=true]:bg-transparent",
                        )}
                      >
                        <div
                          className={cn(
                            "flex-1 min-w-0 px-2 py-1.5 rounded-sm transition-colors hover:bg-accent/60 hover:text-accent-foreground",
                            isSplitLabel &&
                              "group-data-[selected=true]:bg-accent group-data-[selected=true]:text-accent-foreground",
                            !isSplitLabel &&
                              "group-data-[selected=true]:text-accent-foreground/80",
                            hasChildren &&
                              isSplitChevron &&
                              "text-muted-foreground",
                            isActive && "bg-accent/40 text-accent-foreground",
                          )}
                          onPointerEnter={() =>
                            queueSplitTarget("label", opt.value)
                          }
                        >
                          <span className="truncate">{opt.label}</span>
                        </div>
                        {hasChildren &&
                          (opt.loading ? (
                            <Loader2 className="size-4 animate-spin" />
                          ) : (
                            <button
                              type="button"
                              className={cn(
                                "flex h-[34px] w-8 items-center justify-center rounded-sm border-l border-transparent transition-colors text-muted-foreground/70",
                                "hover:bg-accent/60 hover:text-accent-foreground",
                                "group-hover:border-muted-foreground/20 group-data-[selected=true]:border-muted-foreground/20",
                                isSplitChevron &&
                                  "group-data-[selected=true]:bg-accent group-data-[selected=true]:text-accent-foreground group-data-[selected=true]:ring-1 group-data-[selected=true]:ring-ring/50",
                                !isSplitChevron &&
                                  "group-data-[selected=true]:text-accent-foreground/80",
                              )}
                              aria-label={`Lihat kolom di dalam ${opt.label}`}
                              onMouseDown={(event) => {
                                event.preventDefault();
                                event.stopPropagation();
                              }}
                              onPointerEnter={() =>
                                queueSplitTarget("chevron", opt.value)
                              }
                              onClick={(event) => {
                                event.preventDefault();
                                event.stopPropagation();
                                enterNode(opt);
                              }}
                            >
                              <ChevronRight className="size-4 shrink-0" />
                            </button>
                          ))}
                      </CommandItem>
                    );
                  })}
                </CommandGroup>
              </>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
});

export default memo(NestedSelect);
