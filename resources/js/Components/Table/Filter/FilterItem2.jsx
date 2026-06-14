import { Trash2Icon } from "lucide-react";
import { useCallback, useMemo, useState } from "react";
import useNestedFilters, {
  getNodeById,
  isGroupNode,
  isOnlyChildOfRoot,
  MAX_NESTED_DEPTH,
} from "@/Hooks/useNestedFilters";

import { Button } from "@/Components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/Components/ui/tooltip";
import NestedSelect from "@/Components/NestedSelect";
import { RiGitMergeLine } from "@remixicon/react";
import Select from "@/Components/Select";
import ValueField from "./ValueField";
import axios from "axios";
import { cn } from "@/lib/utils";
import { columnHasOptions, getOperators } from "./operators";
import { useLaravelReactI18n } from "laravel-react-i18n";

function FilterItem2({ id, depth = 0 }) {
  const {
    columns,
    filters,
    errors,
    updateItem,
    wrapItemWithGroup,
    removeNode,
    getCachedChildren,
    setCachedChildren,
  } = useNestedFilters();
  const errorKey = errors?.[id];
  const f = getNodeById(filters, id);
  const filter = f
    ? {
        key: f.k,
        operator: f.o,
        value: f.v,
      }
    : {
        key: "",
        operator: "",
        value: "",
      };
  const { t } = useLaravelReactI18n();
  const [cacheVersion, setCacheVersion] = useState(0);

  const toArrayColumns = useCallback((cols) => {
    if (!cols) return [];
    return Array.isArray(cols) ? cols : Object.values(cols);
  }, []);

  const buildColumnNode = useCallback(
    function build(col, parentPath = "") {
      if (col.searchable === false) return null;
      // `col.name` bisa berupa nama segmen ("type") ATAU sudah berkualifikasi
      // penuh ("category.type") — tergantung sumber kolom: hasil getColumns
      // frontend (DataTable2) memprefix nama anak relasi, sedangkan kolom dari
      // fetch API masih nama segmen. Cegah double-prefix: pakai segmen terakhir.
      const segment = `${col.name}`.includes(".")
        ? `${col.name}`.split(".").pop()
        : col.name;
      const value = parentPath ? `${parentPath}.${segment}` : segment;
      const isRelation = col.type === "relation" || col.type === "relations";
      const cachedChildren = getCachedChildren?.(value);
      const children =
        col.columns && toArrayColumns(col.columns).length > 0
          ? toArrayColumns(col.columns)
              .map((child) => build(child, value))
              .filter((x) => x)
          : (cachedChildren ?? []);
      const resolvedChildren = Array.isArray(children) ? children : [];
      return {
        label: col.title ?? t(col.titleTrans),
        title: col.title ?? (col.titleTrans ? t(col.titleTrans) : col.name),
        value,
        type: col.type,
        related: col.related,
        relation: col.related,
        typeRelation: col.typeRelation,
        options: col.options,
        valueTrans: col.valueTrans,
        children: resolvedChildren,
        loadable: isRelation && resolvedChildren.length === 0,
      };
    },
    [getCachedChildren, t, toArrayColumns],
  );

  const findNodeByValue = useCallback((nodes, value) => {
    if (!value) return null;
    for (const node of nodes ?? []) {
      if (!node) continue;
      if (node.value === value) return node;
      const found = findNodeByValue(node.children, value);
      if (found) return found;
    }
    return null;
  }, []);

  const columnOptions = useMemo(() => {
    return toArrayColumns(columns)
      .filter((col) => !col.parentCol && col.searchable !== false)
      .map((col) => buildColumnNode(col));
  }, [columns, buildColumnNode, toArrayColumns, cacheVersion]);

  const isValidFilter = Boolean(filter && !isGroupNode(filter));
  const isOnlyChild = isOnlyChildOfRoot(filters, id);
  // Branch item membungkusnya dalam group baru pada depth + 1 (slot child parent).
  // Hanya berdasar posisi: item di group dangkal tetap normal.
  const branchWillBeTooDeep = depth + 1 >= MAX_NESTED_DEPTH;
  const selectedColumn = useMemo(() => {
    if (!filter?.key) return null;
    return findNodeByValue(columnOptions, filter.key);
  }, [columnOptions, filter?.key, findNodeByValue]);
  const operators = useMemo(() => {
    return getOperators(selectedColumn?.type, {
      typeRelation: selectedColumn?.typeRelation,
      hasOptions: columnHasOptions(selectedColumn),
    });
  }, [
    selectedColumn?.type,
    selectedColumn?.typeRelation,
    selectedColumn?.options,
  ]);

  const onFilterChanged = (payload) => {
    updateItem(id, {
      k: payload?.key ?? filter.key,
      o: payload?.operator ?? filter.operator ?? "",
      v: "value" in (payload ?? {}) ? payload.value : (filter.value ?? ""),
    });
  };

  const onColumnChanged = (val) => {
    onFilterChanged({ key: val, operator: "", value: "" });
  };

  const onOperatorsChanged = (val) => {
    if (!selectedColumn) return;
    const newOperator = operators[val];
    if (!newOperator) {
      onFilterChanged({ operator: "", value: "" });
      return;
    }
    // Reset value bila jenis input value berubah antar operator.
    const oldInput = operators[filter?.operator]?.valueInput;
    if (newOperator.valueInput !== oldInput) {
      onFilterChanged({ operator: val, value: "" });
      return;
    }
    onFilterChanged({ operator: val });
  };

  const onValueChanged = (val) => {
    onFilterChanged({ value: val });
  };

  const fetchRelationColumns = useCallback(
    async (node) => {
      if (!node?.relation) return [];
      const cached = getCachedChildren?.(node.value);
      if (Array.isArray(cached)) {
        setCacheVersion((prev) => prev + 1);
        return cached;
      }
      try {
        const res = await axios.get(
          window.route("model.columns", { model: node.relation }),
        );
        const cols = res.data?.columns ?? [];
        const mapped = toArrayColumns(cols).map((col) =>
          buildColumnNode(col, node.value),
        );
        setCachedChildren?.(node.value, mapped);
        setCacheVersion((prev) => prev + 1);
        return mapped;
      } catch (error) {
        console.error(error);
        return [];
      }
    },
    [buildColumnNode, getCachedChildren, setCachedChildren, toArrayColumns],
  );

  const operatorOptions = useMemo(() => {
    return Object.keys(operators);
  }, [operators]);
  if (!isValidFilter) return null;
  return (
    <div
      className={cn(
        "grid grid-cols-subgrid col-span-full items-start pb-2",
        errorKey &&
          "rounded-md ring-1 ring-destructive/60 bg-destructive/5 p-1 -m-1",
      )}
    >
      <NestedSelect
        options={columnOptions}
        value={filter.key}
        onValueChange={onColumnChanged}
        placeholder={t("core.datatable.filter.select_column")}
        className="min-w-[12rem]"
        fetchChildren={fetchRelationColumns}
      />
      <Select
        disabled={!filter.key}
        value={filter.operator}
        onValueChange={onOperatorsChanged}
        optionTrans="core.datatable.filter.operator"
        options={operatorOptions}
        placeholder={t("core.datatable.filter.select_operator")}
      />
      <ValueField
        column={selectedColumn}
        operator={filter.operator}
        value={filter.value}
        onChange={onValueChanged}
      />
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            className={cn(
              "col-start-5",
              isOnlyChild && "opacity-50 cursor-not-allowed",
              !isOnlyChild &&
                branchWillBeTooDeep &&
                "text-amber-600 hover:text-amber-700 dark:text-amber-400",
            )}
            size="icon"
            variant="ghost"
            type="button"
            aria-disabled={isOnlyChild}
            onClick={() => {
              if (isOnlyChild) return;
              wrapItemWithGroup(id);
            }}
          >
            <RiGitMergeLine />
          </Button>
        </TooltipTrigger>
        {isOnlyChild ? (
          <TooltipContent>
            {t("core.datatable.filter.branch.disabled_single_item")}
          </TooltipContent>
        ) : branchWillBeTooDeep ? (
          <TooltipContent>
            {t("core.datatable.filter.depth_warning.branch", {
              max: MAX_NESTED_DEPTH,
            })}
          </TooltipContent>
        ) : null}
      </Tooltip>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            className={cn(isOnlyChild && "opacity-50 cursor-not-allowed")}
            size="icon"
            variant="ghost"
            type="button"
            aria-disabled={isOnlyChild}
            onClick={() => {
              if (isOnlyChild) return;
              removeNode(id);
            }}
          >
            <Trash2Icon />
          </Button>
        </TooltipTrigger>
        {isOnlyChild && (
          <TooltipContent>
            {t("core.datatable.filter.delete.disabled_single_item")}
          </TooltipContent>
        )}
      </Tooltip>
      {errorKey && (
        <p className="col-span-full text-destructive text-xs pt-0.5">
          {t(errorKey)}
        </p>
      )}
    </div>
  );
}

export default FilterItem2;
