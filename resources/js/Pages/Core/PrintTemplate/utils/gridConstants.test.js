import { describe, it, expect } from "vitest";
import {
  GRID_CLASS,
  SUBGRID_CLASS,
  GRID_RULE_STYLE,
  SUBGRID_RULE_STYLE,
} from "./gridConstants";

describe("GRID_CLASS", () => {
  it("equals 'gjs-grid'", () => {
    expect(GRID_CLASS).toBe("gjs-grid");
  });
});

describe("SUBGRID_CLASS", () => {
  it("equals 'gjs-subgrid'", () => {
    expect(SUBGRID_CLASS).toBe("gjs-subgrid");
  });
});

describe("GRID_RULE_STYLE", () => {
  it("has correct properties and values", () => {
    expect(GRID_RULE_STYLE).toEqual({
      display: "grid",
      "grid-template-columns": "max-content 1fr",
      "column-gap": "12px",
      "padding-top": "10px",
      "padding-bottom": "10px",
    });
  });

  it("is frozen (immutable)", () => {
    expect(Object.isFrozen(GRID_RULE_STYLE)).toBe(true);
  });

  it("throws when attempting to modify existing properties", () => {
    expect(() => {
      GRID_RULE_STYLE.display = "flex";
    }).toThrow(TypeError);
  });

  it("throws when attempting to add new properties", () => {
    expect(() => {
      GRID_RULE_STYLE.newProp = "value";
    }).toThrow(TypeError);
  });
});

describe("SUBGRID_RULE_STYLE", () => {
  it("has correct properties and values", () => {
    expect(SUBGRID_RULE_STYLE).toEqual({
      display: "grid",
      "grid-template-columns": "subgrid",
      gap: "8px",
      "grid-column": "1 / -1",
      padding: "0px",
    });
  });

  it("is frozen (immutable)", () => {
    expect(Object.isFrozen(SUBGRID_RULE_STYLE)).toBe(true);
  });

  it("throws when attempting to modify existing properties", () => {
    expect(() => {
      SUBGRID_RULE_STYLE.display = "flex";
    }).toThrow(TypeError);
  });

  it("throws when attempting to add new properties", () => {
    expect(() => {
      SUBGRID_RULE_STYLE.newProp = "value";
    }).toThrow(TypeError);
  });
});
