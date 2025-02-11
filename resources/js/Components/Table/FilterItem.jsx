import * as React from "react";

import { CalendarIcon, X } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "../ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../ui/select";

import { Button } from "../ui/button";
import { Calendar } from "../ui/calendar";
import { Input } from "../ui/input";
import { ScrollArea } from "../ui/scroll-area";
import { cn } from "@/lib/utils";
import useDidMountEffect from "@/Hooks/useDidMountEffect";
import { useState } from "react";
import moment from "moment-timezone";

const operatorsGeneral = [
  { title: "Equals", name: "eq" },
  { title: "Not Equals", name: "!eq" },
  { title: "Like", name: "like", description: "Use % as wildcard" },
  { title: "Not Like", name: "!like", description: "Use % as wildcard" },
  { title: "In", name: "in", description: "Values separated by commas" },
  { title: "Not In", name: "!in", description: "Values separated by commas" },
];
const operatorsNumber = [
  { title: "Greater Than", name: ">" },
  { title: "Less Than", name: "<" },
  { title: "Greater Than or Equals", name: ">=" },
  { title: "Less Than or Equals", name: "<=" },
  {
    title: "Between",
    name: "between",
    description: "Values separated by commas",
  },
  {
    title: "Not Between",
    name: "!between",
    description: "Values separated by commas",
  },
];
const operatorsDate = [
  { title: "Equals", name: "eq", searchType: "date" },
  { title: "Not Equals", name: "!eq", searchType: "date" },
  { title: "Greater Than", name: ">", searchType: "date" },
  { title: "Less Than", name: "<", searchType: "date" },
  { title: "Greater Than or Equals", name: ">=", searchType: "date" },
  { title: "Less Than or Equals", name: "<=", searchType: "date" },
  {
    title: "Between",
    name: "between",
    searchType: "daterange",
  },
  {
    title: "Not Between",
    name: "!between",
    searchType: "daterange",
  },
];
const changeOperators = (columns, column) => {
  if (!column || !columns) return [];
  const columnType = columns.find((c) => c.name === column).searchType;
  if (Array.isArray(columnType))
    return [
      { title: "Equals", name: "eq", options: columnType },
      { title: "Not Equals", name: "!eq", options: columnType },
      ...operatorsGeneral.filter((x) => ["eq", "!eq"].indexOf(x.name) < 0),
    ];
  switch (columnType) {
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
};

function FilterItem({ columns, id, onChanged, removeFilter, ...props }) {
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
    <div className="relative flex flex-col col-span-4 p-3 pr-10 border rounded-lg border-muted-foreground/30 gap-y-3 sm:p-0 sm:border-0 sm:grid grid-cols-subgrid sm:gap-x-2">
      <Select value={props.column} onValueChange={onColumnChanged}>
        <SelectTrigger className="">
          <SelectValue placeholder="Select Column" />
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
        <SelectTrigger className="">
          <SelectValue placeholder="Select Operator" />
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
              <SelectTrigger className="capitalize ">
                <SelectValue placeholder={`Select ${props.column}`} />
              </SelectTrigger>
              <SelectContent>
                <ScrollArea className="max-h-56">
                  {operator.options.map((val) => (
                    <SelectItem key={val} value={val} className="capitalize">
                      {val.replace(/(\-|\_)/g, " ")}
                    </SelectItem>
                  ))}
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
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  disabled={!operator.name}
                  id="date"
                  variant={"outline"}
                  className={cn(
                    "w-auto justify-start text-left font-normal",
                    !props.value && "text-muted-foreground",
                  )}
                >
                  <CalendarIcon />
                  {operator?.searchType == "daterange" ? (
                    props.value?.from ? (
                      props.value.to ? (
                        <>
                          {moment(props.value.from).format("LL")} -{" "}
                          {moment(props.value.to).format("LL")}
                        </>
                      ) : (
                        moment(props.value.from).format("LL")
                      )
                    ) : (
                      <span>Pick a date</span>
                    )
                  ) : props.value ? (
                    moment(props.value).format("LL")
                  ) : (
                    <span>Pick a date</span>
                  )}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  initialFocus
                  mode={operator.searchType == "date" ? "single" : "range"}
                  defaultMonth={Date.now()}
                  selected={props.value}
                  onSelect={onValueChanged}
                  numberOfMonths={1}
                />
              </PopoverContent>
            </Popover>
          );
        }
        return (
          <Input
            className="min-w-32"
            disabled={!operator?.name}
            type={operator?.searchType == "number" ? "number" : "text"}
            value={props.value}
            onChange={(e) => onValueChanged(e.target.value)}
          />
        );
      })()}
      <Button
        className="absolute px-2 sm:static right-1 top-1"
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
