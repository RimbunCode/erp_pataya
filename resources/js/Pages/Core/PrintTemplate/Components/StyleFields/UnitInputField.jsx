import React, { useEffect, useMemo, useRef, useState } from "react";
import { InputGroup, InputGroupInput } from "@/Components/ui/input-group";
import {
  Select as UISelect,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/Components/ui/select";
import {
  STYLE_MANAGER_UNIT_OPTIONS,
  combineValueUnit,
  parseValueAndUnit,
} from "../../utils/styleManagerUtils";

function UnitInputField({
  prop,
  units = STYLE_MANAGER_UNIT_OPTIONS,
  placeholder,
  compact = false,
}) {
  const defaultValue = prop.getDefaultValue?.() ?? "";
  const rawValue = prop.hasValue?.() ? prop.getValue?.() : defaultValue;
  const parsedValue = useMemo(() => parseValueAndUnit(rawValue), [rawValue]);
  const normalizedUnit = units.includes(parsedValue.unit)
    ? parsedValue.unit
    : units[0] || "px";
  const [draftNumericValue, setDraftNumericValue] = useState(
    parsedValue.numericValue,
  );
  const [draftUnit, setDraftUnit] = useState(normalizedUnit);
  const lastNumericValueRef = useRef(parsedValue.numericValue || "");
  const isAuto = draftUnit === "auto";

  useEffect(() => {
    setDraftNumericValue(parsedValue.numericValue);
    setDraftUnit(normalizedUnit);

    if (parsedValue.unit !== "auto" && parsedValue.numericValue !== "") {
      lastNumericValueRef.current = parsedValue.numericValue;
    }
  }, [normalizedUnit, parsedValue.numericValue, parsedValue.unit]);

  const handleNumericChange = (nextNumericValue) => {
    setDraftNumericValue(nextNumericValue);

    if (nextNumericValue !== "") {
      lastNumericValueRef.current = nextNumericValue;
    }

    prop.upValue?.(combineValueUnit(nextNumericValue, draftUnit));
  };

  const handleUnitChange = (nextUnit) => {
    setDraftUnit(nextUnit);

    if (nextUnit === "auto") {
      prop.upValue?.("auto");
      return;
    }

    const nextNumericValue =
      draftNumericValue || lastNumericValueRef.current || "";
    if (draftNumericValue !== nextNumericValue) {
      setDraftNumericValue(nextNumericValue);
    }
    prop.upValue?.(combineValueUnit(nextNumericValue, nextUnit));
  };

  return (
    <InputGroup className="h-8">
      <InputGroupInput
        type="number"
        step="any"
        value={draftNumericValue}
        disabled={isAuto}
        placeholder={placeholder ?? defaultValue}
        onValueChange={handleNumericChange}
      />
      <div className={compact ? "w-[64px] shrink-0" : "w-[84px] shrink-0"}>
        <UISelect value={draftUnit} onValueChange={handleUnitChange}>
          <SelectTrigger
            className={
              compact
                ? "h-8 rounded-none border-y-0 border-r-0 border-l px-1.5 text-[11px]"
                : "h-8 rounded-none border-y-0 border-r-0 border-l px-2 text-xs"
            }
          >
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {units.map((value) => (
              <SelectItem key={value} value={value} className="text-xs">
                {value}
              </SelectItem>
            ))}
          </SelectContent>
        </UISelect>
      </div>
    </InputGroup>
  );
}

export default UnitInputField;
