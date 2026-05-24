const DEFAULT_UNIT = "px";

export const STYLE_MANAGER_UNIT_OPTIONS = Object.freeze([
  "px",
  "%",
  "em",
  "rem",
  "vw",
  "vh",
  "auto",
]);

const RECOGNIZED_UNITS = STYLE_MANAGER_UNIT_OPTIONS.filter(
  (unit) => unit !== "auto",
);

const DIMENSION_PROPERTY_IDS = new Set([
  "width",
  "height",
  "max-width",
  "min-width",
  "max-height",
  "min-height",
  "margin",
  "margin-top",
  "margin-right",
  "margin-bottom",
  "margin-left",
  "padding",
  "padding-top",
  "padding-right",
  "padding-bottom",
  "padding-left",
]);

const TYPOGRAPHY_PROPERTY_IDS = new Set([
  "font-family",
  "font-size",
  "font-weight",
  "font-style",
  "letter-spacing",
  "line-height",
  "color",
  "text-align",
  "text-decoration",
  "text-shadow",
  "vertical-align",
]);

const DECORATION_PROPERTY_IDS = new Set([
  "background-color",
  "opacity",
  "border-collapse",
  "border-radius",
  "border-top-left-radius",
  "border-top-right-radius",
  "border-bottom-left-radius",
  "border-bottom-right-radius",
  "border",
  "border-width",
  "border-style",
  "border-color",
  "box-shadow",
]);

const BACKGROUND_PROPERTY_IDS = new Set([
  "background-image",
  "background-repeat",
  "background-position",
  "background-size",
  "background-attachment",
]);

export const STYLE_SECTION_IDS = Object.freeze([
  "dimension",
  "typography",
  "decorations",
  "background",
  "advanced",
]);

export const STYLE_SECTION_LABELS = Object.freeze({
  dimension: "Dimension",
  typography: "Typography",
  decorations: "Decorations",
  background: "Background",
  advanced: "Advanced",
});

const SECTION_PROPERTY_MAP = Object.freeze({
  dimension: DIMENSION_PROPERTY_IDS,
  typography: TYPOGRAPHY_PROPERTY_IDS,
  decorations: DECORATION_PROPERTY_IDS,
  background: BACKGROUND_PROPERTY_IDS,
});

export const BORDER_STYLE_OPTIONS = Object.freeze([
  "none",
  "solid",
  "dashed",
  "dotted",
  "double",
  "groove",
  "ridge",
  "inset",
  "outset",
]);

const SPACING_COMPOSITE_PROPERTY_IDS = new Set(["margin", "padding"]);

const UNIT_FIELD_PROPERTY_IDS = new Set([
  ...DIMENSION_PROPERTY_IDS,
  "font-size",
  "letter-spacing",
  "line-height",
]);

function normalizePropertyId(propertyId) {
  return String(propertyId ?? "")
    .trim()
    .toLowerCase();
}

function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

const VALUE_AND_UNIT_PATTERN = new RegExp(
  `^(-?(?:\\d+\\.?\\d*|\\.\\d+))(?:\\s*(${RECOGNIZED_UNITS.map(escapeRegex).join("|")}))?$`,
  "i",
);

export function parseValueAndUnit(rawValue) {
  if (rawValue === null || rawValue === undefined) {
    return { numericValue: "", unit: DEFAULT_UNIT };
  }

  const normalized = String(rawValue).trim();

  if (normalized === "") {
    return { numericValue: "", unit: DEFAULT_UNIT };
  }

  if (normalized.toLowerCase() === "auto") {
    return { numericValue: "", unit: "auto" };
  }

  const match = normalized.match(VALUE_AND_UNIT_PATTERN);
  if (match) {
    return {
      numericValue: match[1],
      unit: (match[2] || DEFAULT_UNIT).toLowerCase(),
    };
  }

  const numericFallback = Number(normalized);
  if (Number.isFinite(numericFallback)) {
    return { numericValue: normalized, unit: DEFAULT_UNIT };
  }

  return { numericValue: "", unit: DEFAULT_UNIT };
}

export function combineValueUnit(numericValue, unit) {
  const normalizedUnit = String(unit || DEFAULT_UNIT).toLowerCase();

  if (normalizedUnit === "auto") {
    return "auto";
  }

  if (!numericValue && numericValue !== "0") {
    return "";
  }

  return `${String(numericValue)}${normalizedUnit}`;
}

function createEmptySections() {
  return {
    dimension: {
      id: "dimension",
      label: STYLE_SECTION_LABELS.dimension,
      properties: [],
    },
    typography: {
      id: "typography",
      label: STYLE_SECTION_LABELS.typography,
      properties: [],
    },
    decorations: {
      id: "decorations",
      label: STYLE_SECTION_LABELS.decorations,
      properties: [],
    },
    background: {
      id: "background",
      label: STYLE_SECTION_LABELS.background,
      properties: [],
    },
    advanced: {
      id: "advanced",
      label: STYLE_SECTION_LABELS.advanced,
      properties: [],
    },
  };
}

function resolveSectionForProperty(propertyId) {
  const normalizedId = normalizePropertyId(propertyId);

  for (const sectionId of STYLE_SECTION_IDS) {
    if (sectionId === "advanced") {
      continue;
    }

    if (SECTION_PROPERTY_MAP[sectionId]?.has(normalizedId)) {
      return sectionId;
    }
  }

  return "advanced";
}

function getSectorProperties(sector) {
  if (!sector || typeof sector.getProperties !== "function") {
    return [];
  }

  const properties = sector.getProperties();
  if (!Array.isArray(properties)) {
    return [];
  }

  return properties;
}

export function mapSectorsToSections(
  sectors = [],
  hiddenPropertyIds = new Set(),
) {
  const sections = createEmptySections();
  const hiddenIds =
    hiddenPropertyIds instanceof Set
      ? hiddenPropertyIds
      : new Set(hiddenPropertyIds || []);

  sectors.forEach((sector) => {
    getSectorProperties(sector).forEach((property) => {
      const propertyId = normalizePropertyId(property?.getId?.());
      if (!propertyId || hiddenIds.has(propertyId)) {
        return;
      }

      const sectionId = resolveSectionForProperty(propertyId);
      sections[sectionId].properties.push(property);
    });
  });

  return sections;
}

export function isSpacingCompositeProperty(propertyId) {
  return SPACING_COMPOSITE_PROPERTY_IDS.has(normalizePropertyId(propertyId));
}

export function isUnitFieldProperty(propertyId) {
  return UNIT_FIELD_PROPERTY_IDS.has(normalizePropertyId(propertyId));
}

export const FIELD_COMPONENT_TYPES = Object.freeze({
  TEXT_ALIGN_BUTTONS: "text-align-buttons",
  TEXT_DECORATION_BUTTONS: "text-decoration-buttons",
  FONT_STYLE_BUTTONS: "font-style-buttons",
  COMPOSITE_SPACING: "composite-spacing",
  BORDER_FIELD: "border-field",
  COLOR_FIELD: "color-field",
  UNIT_INPUT: "unit-input",
  SELECT_FIELD: "select-field",
  LEGACY_FIELD: "legacy-field",
  DEFAULT_INPUT: "default-input",
});

export function resolveFieldComponent(prop, sectionId = "") {
  const propertyId = normalizePropertyId(prop?.getId?.());
  const propertyType = String(prop?.getType?.() || "").toLowerCase();
  const normalizedSectionId = String(sectionId || "").toLowerCase();

  if (propertyId === "text-align") {
    return FIELD_COMPONENT_TYPES.TEXT_ALIGN_BUTTONS;
  }

  if (propertyId === "text-decoration") {
    return FIELD_COMPONENT_TYPES.TEXT_DECORATION_BUTTONS;
  }

  if (propertyId === "font-style") {
    return FIELD_COMPONENT_TYPES.FONT_STYLE_BUTTONS;
  }

  if (propertyType === "composite" && isSpacingCompositeProperty(propertyId)) {
    return FIELD_COMPONENT_TYPES.COMPOSITE_SPACING;
  }

  if (propertyType === "composite" && propertyId.startsWith("border")) {
    return FIELD_COMPONENT_TYPES.BORDER_FIELD;
  }

  if (propertyType === "color") {
    return FIELD_COMPONENT_TYPES.COLOR_FIELD;
  }

  if (normalizedSectionId === "dimension" || isUnitFieldProperty(propertyId)) {
    return FIELD_COMPONENT_TYPES.UNIT_INPUT;
  }

  if (propertyType === "select" || propertyType === "radio") {
    return FIELD_COMPONENT_TYPES.SELECT_FIELD;
  }

  if (propertyType === "stack" || propertyType === "slider") {
    return FIELD_COMPONENT_TYPES.LEGACY_FIELD;
  }

  return FIELD_COMPONENT_TYPES.DEFAULT_INPUT;
}
