import React, { useEffect, useMemo, useState } from "react";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from "@/Components/ui/input-group";

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

function rgbToHex(value) {
  const rgbMatch = String(value || "")
    .trim()
    .match(/^rgba?\((\d+),\s*(\d+),\s*(\d+)/i);

  if (!rgbMatch) {
    return "";
  }

  const [r, g, b] = rgbMatch.slice(1, 4).map((channel) => Number(channel));
  if ([r, g, b].some((channel) => Number.isNaN(channel))) {
    return "";
  }

  return `#${[r, g, b]
    .map((channel) => channel.toString(16).padStart(2, "0"))
    .join("")}`;
}

function toPickerColor(value) {
  const normalized = normalizeHexColor(value);

  if (isValidHexColor(normalized)) {
    return normalizeHexColor(normalized);
  }

  if (typeof document === "undefined" || !value) {
    return "#000000";
  }

  const probe = document.createElement("span");
  probe.style.color = String(value);
  probe.style.position = "absolute";
  probe.style.pointerEvents = "none";
  probe.style.opacity = "0";
  document.body.appendChild(probe);
  const computed = window.getComputedStyle(probe).color;
  document.body.removeChild(probe);

  return rgbToHex(computed) || "#000000";
}

function ColorField({ prop, compact = false }) {
  const defaultValue = prop.getDefaultValue?.() ?? "";
  const currentValue = String(
    prop.hasValue?.() ? prop.getValue?.() : defaultValue,
  );
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
    prop.upValue?.(nextValue);
  };

  const handleTextChange = (nextValue) => {
    setDraftValue(nextValue);

    if (isValidHexColor(nextValue)) {
      prop.upValue?.(normalizeHexColor(nextValue));
    }
  };

  return (
    <InputGroup className="h-8">
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
        placeholder={defaultValue}
        className={
          compact ? "font-mono text-[11px] px-1.5" : "font-mono text-xs"
        }
      />
    </InputGroup>
  );
}

export default ColorField;
