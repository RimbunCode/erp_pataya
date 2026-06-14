import React from "react";
import {
  Select as UISelect,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/Components/ui/select";

function SelectField({ prop }) {
  const value = prop.getValue?.();
  const defaultValue = prop.getDefaultValue?.() ?? "";
  const selectedValue =
    value === null || value === undefined || value === ""
      ? undefined
      : String(value);
  const options = (prop.getOptions?.() || []).map((option) => ({
    value: String(prop.getOptionId?.(option)),
    label: prop.getOptionLabel?.(option),
  }));

  return (
    <UISelect
      value={selectedValue}
      onValueChange={(nextValue) => prop.upValue?.(nextValue)}
    >
      <SelectTrigger className="h-8 text-xs">
        <SelectValue placeholder={defaultValue || "Select value"} />
      </SelectTrigger>
      <SelectContent>
        {options.map((option) => (
          <SelectItem
            key={option.value}
            value={String(option.value)}
            className="text-xs"
          >
            {option.label}
          </SelectItem>
        ))}
      </SelectContent>
    </UISelect>
  );
}

export default SelectField;
