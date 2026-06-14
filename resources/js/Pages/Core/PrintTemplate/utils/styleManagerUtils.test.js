import { describe, expect, it } from "vitest";
import {
  FIELD_COMPONENT_TYPES,
  combineValueUnit,
  mapSectorsToSections,
  parseValueAndUnit,
  resolveFieldComponent,
} from "./styleManagerUtils";

function createMockProperty(id, type = "text") {
  return {
    getId: () => id,
    getType: () => type,
    getLabel: () => id,
  };
}

function createMockSector(properties) {
  return {
    getProperties: () => properties,
  };
}

describe("parseValueAndUnit", () => {
  it("returns auto unit for auto value", () => {
    expect(parseValueAndUnit("auto")).toEqual({
      numericValue: "",
      unit: "auto",
    });
  });

  it("splits numeric value and recognized unit", () => {
    expect(parseValueAndUnit("200px")).toEqual({
      numericValue: "200",
      unit: "px",
    });
    expect(parseValueAndUnit("1.5em")).toEqual({
      numericValue: "1.5",
      unit: "em",
    });
  });

  it("defaults to px when value has no unit", () => {
    expect(parseValueAndUnit("200")).toEqual({
      numericValue: "200",
      unit: "px",
    });
  });

  it("returns empty numeric value and px for empty input", () => {
    expect(parseValueAndUnit("")).toEqual({
      numericValue: "",
      unit: "px",
    });
    expect(parseValueAndUnit(null)).toEqual({
      numericValue: "",
      unit: "px",
    });
  });

  it("falls back to empty numeric value for unsupported expressions", () => {
    expect(parseValueAndUnit("calc(100% - 10px)")).toEqual({
      numericValue: "",
      unit: "px",
    });
    expect(parseValueAndUnit("inherit")).toEqual({
      numericValue: "",
      unit: "px",
    });
  });
});

describe("combineValueUnit", () => {
  it("returns auto when unit is auto", () => {
    expect(combineValueUnit("200", "auto")).toBe("auto");
    expect(combineValueUnit("", "auto")).toBe("auto");
  });

  it("returns empty string when numeric value is empty (except 0)", () => {
    expect(combineValueUnit("", "px")).toBe("");
    expect(combineValueUnit(null, "px")).toBe("");
  });

  it("keeps zero value as valid numeric", () => {
    expect(combineValueUnit("0", "px")).toBe("0px");
  });

  it("combines numeric value and unit", () => {
    expect(combineValueUnit("200", "px")).toBe("200px");
    expect(combineValueUnit("80", "%")).toBe("80%");
  });
});

describe("mapSectorsToSections", () => {
  it("maps known properties into predefined sections and unknown into advanced", () => {
    const width = createMockProperty("width");
    const fontFamily = createMockProperty("font-family");
    const backgroundColor = createMockProperty("background-color");
    const backgroundImage = createMockProperty("background-image");
    const customProperty = createMockProperty("custom-prop");

    const sectors = [
      createMockSector([
        width,
        fontFamily,
        backgroundColor,
        backgroundImage,
        customProperty,
      ]),
    ];

    const mapped = mapSectorsToSections(sectors);

    expect(mapped.dimension.properties).toEqual([width]);
    expect(mapped.typography.properties).toEqual([fontFamily]);
    expect(mapped.decorations.properties).toEqual([backgroundColor]);
    expect(mapped.background.properties).toEqual([backgroundImage]);
    expect(mapped.advanced.properties).toEqual([customProperty]);
  });

  it("respects hidden property ids", () => {
    const width = createMockProperty("width");
    const height = createMockProperty("height");

    const mapped = mapSectorsToSections(
      [createMockSector([width, height])],
      new Set(["height"]),
    );

    expect(mapped.dimension.properties).toEqual([width]);
  });
});

describe("resolveFieldComponent", () => {
  it("maps special typography ids to their dedicated button fields", () => {
    expect(resolveFieldComponent(createMockProperty("text-align"))).toBe(
      FIELD_COMPONENT_TYPES.TEXT_ALIGN_BUTTONS,
    );
    expect(resolveFieldComponent(createMockProperty("text-decoration"))).toBe(
      FIELD_COMPONENT_TYPES.TEXT_DECORATION_BUTTONS,
    );
    expect(resolveFieldComponent(createMockProperty("font-style"))).toBe(
      FIELD_COMPONENT_TYPES.FONT_STYLE_BUTTONS,
    );
  });

  it("maps composite spacing and border correctly", () => {
    expect(
      resolveFieldComponent(createMockProperty("margin", "composite")),
    ).toBe(FIELD_COMPONENT_TYPES.COMPOSITE_SPACING);
    expect(
      resolveFieldComponent(createMockProperty("border", "composite")),
    ).toBe(FIELD_COMPONENT_TYPES.BORDER_FIELD);
  });

  it("maps color, unit fields, select/radio, and fallback default", () => {
    expect(resolveFieldComponent(createMockProperty("color", "color"))).toBe(
      FIELD_COMPONENT_TYPES.COLOR_FIELD,
    );
    expect(
      resolveFieldComponent(createMockProperty("height"), "dimension"),
    ).toBe(FIELD_COMPONENT_TYPES.UNIT_INPUT);
    expect(resolveFieldComponent(createMockProperty("letter-spacing"))).toBe(
      FIELD_COMPONENT_TYPES.UNIT_INPUT,
    );
    expect(resolveFieldComponent(createMockProperty("display", "select"))).toBe(
      FIELD_COMPONENT_TYPES.SELECT_FIELD,
    );
    expect(resolveFieldComponent(createMockProperty("custom"))).toBe(
      FIELD_COMPONENT_TYPES.DEFAULT_INPUT,
    );
  });
});
