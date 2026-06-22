import {
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Select as UISelect,
} from "../ui/select";
import { useCallback, useMemo, useState } from "react";

import { Button } from "../ui/button";
import DatetimePicker from "../DatetimePicker";
import { Input } from "../ui/input";
import NestedSelect from "../NestedSelect";
import { ScrollArea } from "../ui/scroll-area";
import Select from "../Select";
import { X } from "lucide-react";
import axios from "axios";
import useDidMountEffect from "@/Hooks/useDidMountEffect";
import { useLaravelReactI18n } from "laravel-react-i18n";
import { usePage } from "@inertiajs/react";

function FilterItem({ columns, id, onChanged, removeFilter, ...props }) {
  const { t } = useLaravelReactI18n();
  const lang = usePage().props.lang;
  const operatorsGeneral = useMemo(
    () => [
      { title: t("core.datatable.filter.operator.equals"), name: "eq" },
      { title: t("core.datatable.filter.operator.not_equals"), name: "!eq" },
      {
        title: t("core.datatable.filter.operator.like"),
        name: "like",
        description: t("core.datatable.filter.operator.like.description"),
      },
      {
        title: t("core.datatable.filter.operator.not_like"),
        name: "!like",
        description: t("core.datatable.filter.operator.like.description"),
      },
      {
        title: t("core.datatable.filter.operator.in"),
        name: "in",
        description: t("core.datatable.filter.operator.in.description"),
      },
      {
        title: t("core.datatable.filter.operator.not_in"),
        name: "!in",
        description: t("core.datatable.filter.operator.in.description"),
      },
    ],
    [lang],
  );
  const operatorsNumber = useMemo(
    () => [
      { title: t("core.datatable.filter.operator.greater_than"), name: ">" },
      {
        title: t("core.datatable.filter.operator.less_than"),
        name: "<",
      },
      {
        title: t("core.datatable.filter.operator.greater_than_or_equals"),
        name: ">=",
      },
      {
        title: t("core.datatable.filter.operator.less_than_or_equals"),
        name: "<=",
      },
      {
        title: t("core.datatable.filter.operator.in"),
        name: "in",
        description: t("core.datatable.filter.operator.in.description"),
      },
      {
        title: t("core.datatable.filter.operator.not_in"),
        name: "!in",
        description: t("core.datatable.filter.operator.in.description"),
      },
      {
        title: t("core.datatable.filter.operator.between"),
        name: "between",
        description: t("core.datatable.filter.operator.between.description"),
      },
      {
        title: t("core.datatable.filter.operator.not_between"),
        name: "!between",
        description: t("core.datatable.filter.operator.between.description"),
      },
    ],
    [lang],
  );
  const operatorsDate = useMemo(
    () => [
      {
        title: t("core.datatable.filter.operator.equals"),
        name: "eq",
        searchType: "date",
      },
      {
        title: t("core.datatable.filter.operator.not_equals"),
        name: "!eq",
        searchType: "date",
      },
      {
        title: t("core.datatable.filter.operator.greater_than"),
        name: ">",
        searchType: "date",
      },
      {
        title: t("core.datatable.filter.operator.less_than"),
        name: "<",
        searchType: "date",
      },
      {
        title: t("core.datatable.filter.operator.greater_than_or_equals"),
        name: ">=",
        searchType: "date",
      },
      {
        title: t("core.datatable.filter.operator.less_than_or_equals"),
        name: "<=",
        searchType: "date",
      },
      {
        title: t("core.datatable.filter.operator.between"),
        name: "between",
        searchType: "daterange",
      },
      {
        title: t("core.datatable.filter.operator.not_between"),
        name: "!between",
        searchType: "daterange",
      },
    ],
    [lang],
  );

  const toArrayColumns = useCallback((cols) => {
    if (!cols) return [];
    return Array.isArray(cols) ? cols : Object.values(cols);
  }, []);

  const buildColumnNode = useCallback(
    function build(col, parentPath = "") {
      if (col.searchable === false || col.hidden || col.ignore) return null;
      const value = parentPath ? `${parentPath}.${col.name}` : col.name;
      const isRelation = col.type === "relation" || col.type === "relations";
      const children =
        col.columns && toArrayColumns(col.columns).length > 0
          ? toArrayColumns(col.columns)
              .map((child) => build(child, value))
              .filter((x) => x)
          : [];
      return {
        label: col.title ?? t(col.titleTrans),
        value,
        type: col.type,
        relation: col.related,
        children,
        // relation nodes still lazy-load if backend hasn't supplied columns
        loadable: isRelation && children.length === 0,
      };
    },
    [t, toArrayColumns],
  );

  const findColumnByName = useCallback(
    (cols, name) => {
      const list = toArrayColumns(cols);
      for (const col of list) {
        if (col.name === name) return col;
        if (col.columns) {
          const nested = findColumnByName(col.columns, name);
          if (nested) return nested;
        }
      }
      return null;
    },
    [toArrayColumns],
  );

  const changeOperators = useCallback(
    (cols, columnName) => {
      if (!columnName || !cols) return [];
      const column = findColumnByName(cols, columnName);
      if (!column) return [];
      if (Array.isArray(column.searchType)) {
        const options = column.parse
          ? column.searchType.map((x) => {
              return {
                title: column.parse[x],
                value: x,
              };
            })
          : column.searchType;
        return [
          {
            title: t("core.datatable.filter.operator.equals"),
            name: "eq",
            options,
          },
          {
            title: t("core.datatable.filter.operator.not_equals"),
            name: "!eq",
            options,
          },
          ...operatorsGeneral.filter((x) => ["eq", "!eq"].indexOf(x.name) < 0),
        ];
      }
      switch (column.searchType) {
        case "boolean": {
          const options = column.parse
            ? [
                { title: column.parse["true"], value: "true" },
                { title: column.parse["false"], value: "false" },
              ]
            : ["true", "false"];
          return [
            {
              title: t("core.datatable.filter.operator.equals"),
              name: "eq",
              options,
            },
            {
              title: t("core.datatable.filter.operator.not_equals"),
              name: "!eq",
              options,
            },
          ];
        }
        case "text":
          return [...operatorsGeneral];
        case "number":
          return [...operatorsGeneral, ...operatorsNumber].map((x) => ({
            ...x,
            searchType: "number",
          }));
        case "date":
          return [...operatorsDate];
        default:
          return [...operatorsGeneral];
      }
    },
    [operatorsGeneral, operatorsNumber, operatorsDate, findColumnByName, t],
  );

  const [operators, setOperators] = useState(
    changeOperators(columns, props.column) ?? [],
  );
  const [operator, setOperator] = useState(
    operators.filter((x) => x.name === props.operator).at(0) ?? {},
  );

  const onFilterChanged = (payload) => {
    onChanged(id, payload);
  };

  const onColumnChanged = (val) => {
    setOperators(changeOperators(columns, val));
    onFilterChanged({ column: val, operator: "", value: "" });
  };

  useDidMountEffect(() => {
    onOperatorsChanged(props.operator);
  }, [operators]);

  const onOperatorsChanged = (val) => {
    const newOperator = operators.filter((x) => x.name === val).at(0);
    setOperator(newOperator);
    if (!newOperator) {
      onFilterChanged({ operator: "" });
      return;
    }
    if (
      newOperator?.searchType != operator?.searchType ||
      newOperator?.options != operator?.options
    ) {
      onFilterChanged({ operator: val, value: "" });
    }
    onFilterChanged({ operator: val });
  };

  const onValueChanged = (val) => {
    onFilterChanged({ value: val });
  };

  const fetchRelationColumns = useCallback(
    async (node) => {
      if (!node?.relation) return [];
      try {
        const res = await axios.get(
          window.route("model.columns", { model: node.relation }),
        );
        const cols = res.data?.columns ?? [];
        return toArrayColumns(cols).map((col) =>
          buildColumnNode(col, node.value),
        );
      } catch (error) {
        console.error(error);
        return [];
      }
    },
    [buildColumnNode, toArrayColumns],
  );

  const columnOptions = useMemo(() => {
    return toArrayColumns(columns)
      .filter(
        (col) =>
          !col.parentCol &&
          col.searchable !== false &&
          !col.hidden &&
          !col.ignore,
      )
      .map((col) => buildColumnNode(col));
  }, [columns, buildColumnNode, toArrayColumns]);
  return (
    <div className="relative flex flex-col col-span-4 p-3 pr-10 border rounded-lg border-muted-foreground/30 gap-y-3 md:p-0 md:border-0 md:grid grid-cols-subgrid md:gap-x-2">
      <NestedSelect
        options={columnOptions}
        value={props.column}
        onValueChange={onColumnChanged}
        placeholder={t("core.datatable.filter.select_column")}
        className="m-1 min-w-[12rem]"
        fetchChildren={fetchRelationColumns}
      />
      <Select
        disabled={operators.length <= 0}
        value={props.operator}
        onValueChange={onOperatorsChanged}
        options={operators.map(({ title, name }) => ({
          label: title,
          value: name,
        }))}
        placeholder={t("core.datatable.filter.select_operator")}
        className="m-1"
      />
      {(() => {
        if (operator?.options) {
          return (
            <UISelect
              disabled={!operator.name}
              value={props.value}
              onValueChange={onValueChanged}
            >
              <SelectTrigger className="m-1 capitalize">
                <SelectValue
                  placeholder={t("core.datatable.filter.select_value", {
                    name: props.column,
                  })}
                />
              </SelectTrigger>
              <SelectContent>
                <ScrollArea className="max-h-56">
                  {operator.options.map((val) =>
                    typeof val == "string" ? (
                      <SelectItem key={val} value={val} className="capitalize">
                        {val.replace(/(-|_)/g, " ")}
                      </SelectItem>
                    ) : (
                      <SelectItem key={val.value} value={val.value}>
                        {val.title}
                      </SelectItem>
                    ),
                  )}
                </ScrollArea>
              </SelectContent>
            </UISelect>
          );
        }
        if (
          operator?.searchType == "daterange" ||
          operator?.searchType == "date"
        ) {
          return (
            <DatetimePicker
              type={operator?.searchType}
              value={props.value}
              onValueChange={onValueChanged}
              className="m-1 min-w-32"
            />
          );
        }
        return (
          <Input
            className="m-1 min-w-32"
            disabled={!operator?.name}
            type={operator?.searchType == "number" ? "number" : "text"}
            value={props.value}
            onChange={(e) => onValueChanged(e.target.value)}
          />
        );
      })()}
      <Button
        className="absolute px-2 md:static right-1 top-1"
        variant="ghost"
        onClick={() => removeFilter(id)}
      >
        <X />
      </Button>
      {operator && operator.description && (
        <p className="col-start-3 px-1 -mt-3 text-xs text-foreground/90">
          {operator.description}
        </p>
      )}
    </div>
  );
}

export default FilterItem;
