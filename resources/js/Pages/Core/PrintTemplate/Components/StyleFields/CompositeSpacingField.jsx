import React from "react";
import UnitInputField from "./UnitInputField";

const DEFAULT_SIDE_LABELS = ["T", "R", "B", "L"];

function normalizePropertyId(propertyId) {
  return String(propertyId ?? "")
    .trim()
    .toLowerCase();
}

function getSideProperties(property) {
  const propertyId = normalizePropertyId(property?.getId?.());
  const subProperties = property?.getProperties?.() || [];

  const byId = new Map(
    subProperties.map((subProperty) => [
      normalizePropertyId(subProperty?.getId?.()),
      subProperty,
    ]),
  );

  const sideMap = {
    T: [`${propertyId}-top`],
    R: [`${propertyId}-right`],
    B: [`${propertyId}-bottom`],
    L: [`${propertyId}-left`],
  };

  return DEFAULT_SIDE_LABELS.map((sideLabel, index) => {
    const candidates = sideMap[sideLabel] || [];
    const fromId = candidates
      .map((candidate) => byId.get(candidate))
      .find(Boolean);

    return fromId || subProperties[index] || null;
  });
}

function CompositeSpacingField({ prop, labels = DEFAULT_SIDE_LABELS }) {
  const sideProperties = getSideProperties(prop);

  return (
    <div className="grid grid-cols-4 gap-1.5">
      {labels.map((label, index) => {
        const sideProperty = sideProperties[index];

        return (
          <div key={label} className="space-y-1 min-w-0">
            <p className="text-[10px] font-medium uppercase text-muted-foreground">
              {label}
            </p>
            {sideProperty ? (
              <UnitInputField prop={sideProperty} compact />
            ) : (
              <div className="h-8 rounded-md border border-dashed border-border/70 bg-muted/40" />
            )}
          </div>
        );
      })}
    </div>
  );
}

export default CompositeSpacingField;
