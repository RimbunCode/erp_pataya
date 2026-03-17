import { PlusIcon, Trash2Icon } from "lucide-react";
import { useCallback, useMemo, useState } from "react";
import useNestedFilters, {
  getNodeById,
  isGroupNode,
} from "@/Hooks/useNestedFilters";

import { Button } from "@/Components/ui/button";
import { Input } from "@/Components/ui/input";
import NestedSelect from "@/Components/NestedSelect";
import { RiGitMergeLine } from "@remixicon/react";
import Select from "@/Components/Select";
import axios from "axios";
import { getOperators } from "./operators";
import useDidMountEffect from "@/Hooks/useDidMountEffect";
import { useLaravelReactI18n } from "laravel-react-i18n";

function FilterItem2({ id }) {
  const {
    columns,
    filters,
    updateItem,
    addSiblingItem,
    wrapItemWithGroup,
    removeNode,
    getCachedChildren,
    setCachedChildren,
  } = useNestedFilters();
  const filter = getNodeById(filters, id);
  const { t } = useLaravelReactI18n();
  const [cacheVersion, setCacheVersion] = useState(0);

  const toArrayColumns = useCallback((cols) => {
    if (!cols) return [];
    return Array.isArray(cols) ? cols : Object.values(cols);
  }, []);

  const buildColumnNode = useCallback(
    function build(col, parentPath = "") {
      if (col.searchable === false) return null;
      const value = parentPath ? `${parentPath}.${col.name}` : col.name;
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
        value,
        type: col.type,
        relation: col.related,
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
  const selectedColumn = useMemo(() => {
    if (!filter?.key) return null;
    return findNodeByValue(columnOptions, filter.key);
  }, [columnOptions, filter?.key, findNodeByValue]);
  const operators = useMemo(() => {
    return getOperators(selectedColumn?.type);
  }, [selectedColumn?.type]);

  const onFilterChanged = (payload) => {
    updateItem(id, payload);
  };

  const onColumnChanged = (val) => {
    onFilterChanged({ key: val, operator: "", value: "" });
  };

  useDidMountEffect(() => {
    if (!isValidFilter) return;
    onOperatorsChanged(filter.operator);
  }, [operators, filter?.operator, isValidFilter]);

  const onOperatorsChanged = (val) => {
    if (!selectedColumn) return;
    const normalizedValue = val === "not_between" ? "!between" : val;
    const newOperator = operators[normalizedValue];
    if (!newOperator) {
      onFilterChanged({ operator: "" });
      return;
    }
    const oldOperator = operators[filter?.operator];
    if (newOperator?.searchType != oldOperator?.searchType) {
      onFilterChanged({ operator: normalizedValue, value: "" });
    }
    onFilterChanged({ operator: normalizedValue });
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

  const valueInput = useMemo(() => {}, []);
  if (!isValidFilter) return null;
  return (
    <div className="grid grid-cols-subgrid col-span-full">
      <NestedSelect
        options={columnOptions}
        value={filter.key}
        onValueChange={onColumnChanged}
        placeholder={t("core.datatable.filter.select_column")}
        className="m-1 min-w-[12rem]"
        fetchChildren={fetchRelationColumns}
      />
      <Select
        disabled={!filter.key}
        value={filter.operator}
        onValueChange={onOperatorsChanged}
        optionTrans="core.datatable.filter.operator"
        options={operatorOptions}
        placeholder={t("core.datatable.filter.select_operator")}
        className="m-1"
      />
      <Input
        disabled={!filter.operator}
        value={filter.value}
        onValueChange={onValueChanged}
        className="m-1"
      />
      <div className="flex gap-x-1 pr-2">
        <Button
          size="icon"
          variant="ghost"
          type="button"
          onClick={() => addSiblingItem(id)}
        >
          <PlusIcon />
        </Button>
        <Button
          size="icon"
          variant="ghost"
          type="button"
          onClick={() => wrapItemWithGroup(id)}
        >
          <RiGitMergeLine />
        </Button>
        <Button
          size="icon"
          variant="ghost"
          type="button"
          onClick={() => removeNode(id)}
        >
          <Trash2Icon />
        </Button>
      </div>
    </div>
  );
}

export default FilterItem2;
