import React from "react";
import {
  Select as UISelect,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/Components/ui/select";
import ColorField from "./ColorField";
import LegacyStyleField from "./LegacyStyleField";
import UnitInputField from "./UnitInputField";
import { BORDER_STYLE_OPTIONS } from "../../utils/styleManagerUtils";

function normalizePropertyId(propertyId) {
  return String(propertyId ?? "")
    .trim()
    .toLowerCase();
}

function findSubProperty(subProperties, candidates, predicate) {
  for (const subProperty of subProperties) {
    const subPropertyId = normalizePropertyId(subProperty?.getId?.());

    if (candidates.includes(subPropertyId)) {
      return subProperty;
    }

    if (
      typeof predicate === "function" &&
      predicate(subPropertyId, subProperty)
    ) {
      return subProperty;
    }
  }

  return null;
}

function BorderField({ prop }) {
  const subProperties = prop.getProperties?.() || [];

  if (!subProperties.length) {
    return <LegacyStyleField prop={prop} />;
  }

  const borderWidthProperty = findSubProperty(
    subProperties,
    ["border-width"],
    (id) => id.includes("width"),
  );
  const borderStyleProperty = findSubProperty(
    subProperties,
    ["border-style"],
    (id) => id.includes("style"),
  );
  const borderColorProperty = findSubProperty(
    subProperties,
    ["border-color"],
    (id, property) => id.includes("color") || property.getType?.() === "color",
  );

  const styleOptions = BORDER_STYLE_OPTIONS.map((value) => ({
    value,
    label: value,
  }));

  const styleValue =
    borderStyleProperty?.getValue?.() ||
    borderStyleProperty?.getDefaultValue?.() ||
    "none";

  return (
    <div className="grid grid-cols-3 gap-1">
      {borderWidthProperty ? (
        <UnitInputField prop={borderWidthProperty} compact />
      ) : (
        <div className="h-8 rounded-md border border-dashed border-border/70 bg-muted/40" />
      )}

      {borderStyleProperty ? (
        <UISelect
          value={styleValue}
          onValueChange={(nextValue) =>
            borderStyleProperty.upValue?.(nextValue)
          }
        >
          <SelectTrigger className="h-8 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {styleOptions.map((option) => (
              <SelectItem
                key={option.value}
                value={option.value}
                className="text-xs"
              >
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </UISelect>
      ) : (
        <div className="h-8 rounded-md border border-dashed border-border/70 bg-muted/40" />
      )}

      {borderColorProperty ? (
        <ColorField prop={borderColorProperty} compact />
      ) : (
        <div className="h-8 rounded-md border border-dashed border-border/70 bg-muted/40" />
      )}
    </div>
  );
}

export default BorderField;
