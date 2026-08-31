import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
} from "@/Components/ui/input-group";
import { useEffect, useMemo, useState } from "react";

import { XIcon } from "lucide-react";

function normalizeHexColor(value) {
  const normalized = String(value || "").trim();
  const shortHexMatch = normalized.match(/^#([0-9a-f]{3})$/i);
  if (shortHexMatch) {
    const [r, g, b] = shortHexMatch[1].split("");
    return `#${r}${r}${g}${g}${b}${b}`.toLowerCase();
  }

  return normalized.toLowerCase();
}

function isValidHexColor(value) {
  return /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(String(value || "").trim());
}

function toPickerColor(value) {
  const normalized = normalizeHexColor(value);

  return isValidHexColor(normalized) ? normalized : "#000000";
}

export default function ColorInput({
  value,
  onValueChange,
  placeholder,
  className,
}) {
  const currentValue = String(value ?? "");
  const [draftValue, setDraftValue] = useState(currentValue);

  useEffect(() => {
    setDraftValue(currentValue);
  }, [currentValue]);

  const pickerValue = useMemo(
    () => toPickerColor(currentValue || draftValue),
    [currentValue, draftValue],
  );

  const swatchColor = currentValue || pickerValue;

  const handlePickerChange = (event) => {
    const nextValue = event.target.value;
    setDraftValue(nextValue);
    onValueChange?.(nextValue);
  };

  const handleTextChange = (nextValue) => {
    setDraftValue(nextValue);

    if (isValidHexColor(nextValue)) {
      onValueChange?.(normalizeHexColor(nextValue));
    }
  };

  const handleReset = () => {
    setDraftValue("");
    onValueChange?.(null);
  };

  return (
    <InputGroup className={className}>
      <InputGroupAddon align="inline-start" className="pl-2 pr-1.5">
        <span
          className="relative inline-flex h-4 w-4 overflow-hidden rounded border border-border/80"
          style={{ backgroundColor: swatchColor || "#000000" }}
        >
          <input
            type="color"
            value={pickerValue}
            onChange={handlePickerChange}
            className="absolute inset-0 cursor-pointer opacity-0"
            aria-label="Pick color"
          />
        </span>
      </InputGroupAddon>
      <InputGroupInput
        value={draftValue}
        onValueChange={handleTextChange}
        placeholder={placeholder}
        className="font-mono text-xs"
      />
      {draftValue && (
        <InputGroupAddon align="inline-end">
          <InputGroupButton
            type="button"
            size="icon-xs"
            onClick={handleReset}
            aria-label="Reset warna"
          >
            <XIcon />
          </InputGroupButton>
        </InputGroupAddon>
      )}
    </InputGroup>
  );
}
