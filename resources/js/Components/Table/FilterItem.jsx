import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../ui/select";
import { useCallback, useMemo, useState } from "react";

import { Button } from "../ui/button";
import DatetimePicker from "../DatetimePicker";
import { Input } from "../ui/input";
import { ScrollArea } from "../ui/scroll-area";
import { X } from "lucide-react";
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

  const changeOperators = useCallback(
    (columns, columnName) => {
      if (!columnName || !columns) return [];
      const column = columns.find((c) => c.name === columnName);
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
    [operatorsGeneral, operatorsNumber, operatorsDate],
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
    onFilterChanged({ column: val });
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
  return (
    <div className="relative flex flex-col col-span-4 p-3 pr-10 border rounded-lg border-muted-foreground/30 gap-y-3 md:p-0 md:border-0 md:grid grid-cols-subgrid md:gap-x-2">
      <Select value={props.column} onValueChange={onColumnChanged}>
        <SelectTrigger className="m-1">
          <SelectValue placeholder={t("core.datatable.filter.select_column")} />
        </SelectTrigger>
        <SelectContent>
          <ScrollArea className="max-h-56">
            {columns
              ?.filter((x) => x.searchType)
              .map((col) => (
                <SelectItem key={col.name} value={col.name}>
                  {col.title}
                </SelectItem>
              ))}
          </ScrollArea>
        </SelectContent>
      </Select>
      <Select
        disabled={operators.length <= 0}
        value={props.operator}
        onValueChange={onOperatorsChanged}
      >
        <SelectTrigger className="m-1">
          <SelectValue
            placeholder={t("core.datatable.filter.select_operator")}
          />
        </SelectTrigger>
        <SelectContent>
          <ScrollArea className="max-h-56">
            {operators.map(({ title, name }) => (
              <SelectItem key={name} value={name}>
                {title}
              </SelectItem>
            ))}
          </ScrollArea>
        </SelectContent>
      </Select>
      {(() => {
        if (operator?.options) {
          return (
            <Select
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
                        {val.replace(/(\-|\_)/g, " ")}
                      </SelectItem>
                    ) : (
                      <SelectItem key={val.value} value={val.value}>
                        {val.title}
                      </SelectItem>
                    ),
                  )}
                </ScrollArea>
              </SelectContent>
            </Select>
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
