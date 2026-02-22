import { ChevronDown, ChevronRight, Loader2 } from "lucide-react";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandItem,
  CommandList,
} from "./ui/command";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "./ui/dropdown-menu";
import React, {
  forwardRef,
  memo,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";

import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { cn } from "@/lib/utils";

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
 *   loadable?: boolean,             // true => call fetchChildren on hover/arrow
 *   children?: Option[],            // preloaded children
 * }
 */
const NestedSelect = forwardRef(function NestedSelect(
  {
    options = [],
    value,
    onValueChange,
    placeholder = "Select...",
    className,
    disabled,
    readOnly,
    fetchChildren,
  },
  ref,
) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [tree, setTree] = useState([]);

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

  const selectedNode = useMemo(() => {
    const all = [];
    const walk = (nodes, trail = []) => {
      nodes?.forEach((n) => {
        if (!n) return;
        const path = [...trail, n];
        all.push({
          ...n,
          pathLabel: path.map((p) => p.label).join(" / "),
        });
        if (n.children?.length) walk(n.children, path);
      });
    };
    walk(tree);
    return all.find((n) => n.value === value);
  }, [tree, value]);

  const flatten = useMemo(() => {
    const res = [];
    const walk = (nodes, trail = []) => {
      nodes?.forEach((n) => {
        if (!n) return;
        const path = [...trail, n];
        res.push({
          ...n,
          pathLabel: path.map((p) => p.label).join(" / "),
        });
        if (n.children?.length) walk(n.children, path);
      });
    };
    walk(tree);
    return res;
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
    },
    [onValueChange, readOnly, disabled],
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
      if (!fetchChildren || node.loaded || node.loading || !node.loadable)
        return;
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

  const renderOption = (opt) => {
    const hasChildren = opt.children?.length > 0 || opt.loadable;
    const isActive = selectedNode?.value === opt.value;
    if (hasChildren) {
      return (
        <DropdownMenuSub key={opt.value ?? opt.label}>
          <DropdownMenuSubTrigger
            className={cn(
              "justify-between",
              isActive && "bg-accent text-accent-foreground",
            )}
            useDefaultIcon={false}
            onPointerEnter={() => ensureChildren(opt)}
            onKeyDown={(e) => {
              if (e.key === "ArrowRight") ensureChildren(opt);
            }}
          >
            <span className="truncate flex-1">{opt.label}</span>
            {opt.loading ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <ChevronRight className="size-4 shrink-0" />
            )}
          </DropdownMenuSubTrigger>
          <DropdownMenuSubContent
            sideOffset={6}
            alignOffset={-4}
            className="max-h-72 overflow-y-auto"
          >
            <DropdownMenuItem
              onSelect={(e) => {
                e.preventDefault();
                handleSelect(opt.value);
              }}
              className={cn(
                "justify-between",
                isActive && "bg-accent text-accent-foreground",
              )}
            >
              {opt.label}
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            {opt.loading && (
              <DropdownMenuItem disabled>Loading…</DropdownMenuItem>
            )}
            {!opt.loading && opt.children?.length === 0 && (
              <DropdownMenuItem disabled>No columns</DropdownMenuItem>
            )}
            {!opt.loading && opt.children?.map((child) => renderOption(child))}
          </DropdownMenuSubContent>
        </DropdownMenuSub>
      );
    }

    return (
      <DropdownMenuItem
        key={opt.value ?? opt.label}
        onSelect={(e) => {
          e.preventDefault();
          handleSelect(opt.value);
        }}
        className={cn(
          "justify-between",
          isActive && "bg-accent text-accent-foreground",
        )}
      >
        <span className="truncate">{opt.label}</span>
      </DropdownMenuItem>
    );
  };

  return (
    <DropdownMenu
      open={open}
      onOpenChange={(v) => {
        setOpen(v);
        if (!v) setSearch("");
      }}
    >
      <DropdownMenuTrigger asChild>
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
      </DropdownMenuTrigger>
      <DropdownMenuContent
        className="min-w-[16rem] p-0"
        align="start"
        sideOffset={4}
        onCloseAutoFocus={(e) => e.preventDefault()}
      >
        <div className="p-2 pb-1">
          <Input
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              if (!open) setOpen(true);
            }}
            placeholder="Cari kolom..."
            className="h-8"
          />
        </div>
        <div className="max-h-80 overflow-y-auto">
          {search.trim() ? (
            <Command shouldFilter={false}>
              <CommandList>
                <CommandEmpty>Tidak ditemukan</CommandEmpty>
                <CommandGroup>
                  {filtered.map((item) => (
                    <CommandItem
                      key={item.value}
                      value={item.value}
                      onSelect={() => handleSelect(item.value)}
                      className="flex gap-2"
                    >
                      <span className="truncate">{item.pathLabel}</span>
                    </CommandItem>
                  ))}
                </CommandGroup>
              </CommandList>
            </Command>
          ) : tree?.length ? (
            tree.filter(Boolean).map((opt) => renderOption(opt))
          ) : (
            <DropdownMenuItem disabled>No options</DropdownMenuItem>
          )}
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
});

export default memo(NestedSelect);
