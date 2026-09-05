import { describe, expect, it } from "vitest";
import { FIELD_COMPONENT_TYPES } from "../../utils/styleManagerUtils";
import {
  BorderField,
  ColorField,
  CompositeSpacingField,
  DefaultInputField,
  FIELD_COMPONENT_MAP,
  FontStyleButtons,
  LegacyStyleField,
  SelectField,
  TextAlignButtons,
  TextDecorationButtons,
  UnitInputField,
  getStyleFieldComponent,
} from "./index";

describe("FIELD_COMPONENT_MAP", () => {
  it("maps every FIELD_COMPONENT_TYPES key to its matching component", () => {
    expect(FIELD_COMPONENT_MAP[FIELD_COMPONENT_TYPES.TEXT_ALIGN_BUTTONS]).toBe(
      TextAlignButtons,
    );
    expect(
      FIELD_COMPONENT_MAP[FIELD_COMPONENT_TYPES.TEXT_DECORATION_BUTTONS],
    ).toBe(TextDecorationButtons);
    expect(FIELD_COMPONENT_MAP[FIELD_COMPONENT_TYPES.FONT_STYLE_BUTTONS]).toBe(
      FontStyleButtons,
    );
    expect(FIELD_COMPONENT_MAP[FIELD_COMPONENT_TYPES.COMPOSITE_SPACING]).toBe(
      CompositeSpacingField,
    );
    expect(FIELD_COMPONENT_MAP[FIELD_COMPONENT_TYPES.BORDER_FIELD]).toBe(
      BorderField,
    );
    expect(FIELD_COMPONENT_MAP[FIELD_COMPONENT_TYPES.COLOR_FIELD]).toBe(
      ColorField,
    );
    expect(FIELD_COMPONENT_MAP[FIELD_COMPONENT_TYPES.UNIT_INPUT]).toBe(
      UnitInputField,
    );
    expect(FIELD_COMPONENT_MAP[FIELD_COMPONENT_TYPES.SELECT_FIELD]).toBe(
      SelectField,
    );
    expect(FIELD_COMPONENT_MAP[FIELD_COMPONENT_TYPES.LEGACY_FIELD]).toBe(
      LegacyStyleField,
    );
    expect(FIELD_COMPONENT_MAP[FIELD_COMPONENT_TYPES.DEFAULT_INPUT]).toBe(
      DefaultInputField,
    );
  });

  it("covers every key declared in FIELD_COMPONENT_TYPES (no gaps in either direction)", () => {
    expect(Object.keys(FIELD_COMPONENT_MAP).sort()).toEqual(
      Object.values(FIELD_COMPONENT_TYPES).sort(),
    );
  });

  it("is frozen so callers cannot mutate the registry", () => {
    expect(Object.isFrozen(FIELD_COMPONENT_MAP)).toBe(true);
  });
});

describe("getStyleFieldComponent", () => {
  it.each(Object.values(FIELD_COMPONENT_TYPES))(
    "resolves the registered component for known type %s",
    (fieldType) => {
      expect(getStyleFieldComponent(fieldType)).toBe(
        FIELD_COMPONENT_MAP[fieldType],
      );
    },
  );

  it("falls back to DefaultInputField for an unrecognized field type", () => {
    expect(getStyleFieldComponent("some-unregistered-type")).toBe(
      DefaultInputField,
    );
  });

  it("falls back to DefaultInputField when fieldType is undefined or null", () => {
    expect(getStyleFieldComponent(undefined)).toBe(DefaultInputField);
    expect(getStyleFieldComponent(null)).toBe(DefaultInputField);
  });

  it("falls back to DefaultInputField for an empty string field type", () => {
    expect(getStyleFieldComponent("")).toBe(DefaultInputField);
  });
});
