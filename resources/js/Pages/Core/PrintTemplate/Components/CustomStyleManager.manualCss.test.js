import { describe, expect, it } from "vitest";
import {
  ensureComponentIdRuleFirst,
  findProtectedSelectorsInCssText,
  hasStyleDeclarations,
  mergeProtectedSelectorStyles,
  normalizeCssInputToSelectorMap,
  resolveProtectedSelectorsForComponent,
  stripEmptyStyleRules,
} from "../utils/manualCssRuleUtils";

describe("normalizeCssInputToSelectorMap", () => {
  it("maps declarations to primary selector", () => {
    expect(
      normalizeCssInputToSelectorMap("color: red; margin-top: 4px;", "#test"),
    ).toEqual({
      "#test": {
        color: "red",
        "margin-top": "4px",
      },
    });
  });

  it("keeps selector map when input already has rule blocks", () => {
    expect(
      normalizeCssInputToSelectorMap(".gjs-grid { display: grid; gap: 8px; }"),
    ).toEqual({
      ".gjs-grid": {
        display: "grid",
        gap: "8px",
      },
    });
  });
});

describe("resolveProtectedSelectorsForComponent", () => {
  it("returns protected default selector for grid type", () => {
    const component = {
      getType: () => "gjsGrid",
      get: () => null,
      getClasses: () => ["gjs-grid", "other-class"],
    };
    const currentRules = [
      { selectors: ".gjs-grid", style: { display: "grid" } },
      { selectors: ".other-class", style: { color: "red" } },
    ];

    expect([
      ...resolveProtectedSelectorsForComponent(component, currentRules),
    ]).toEqual([".gjs-grid"]);
  });

  it("does not return selector that does not exist in current rules", () => {
    const component = {
      getType: () => "gjsSubGrid",
      get: () => null,
      getClasses: () => ["gjs-subgrid"],
    };

    expect([...resolveProtectedSelectorsForComponent(component, [])]).toEqual(
      [],
    );
  });
});

describe("ensureComponentIdRuleFirst", () => {
  it("prepends empty id selector when css rules do not target component id", () => {
    expect(
      ensureComponentIdRuleFirst(
        [{ selectors: ".gjs-grid", style: { display: "grid" } }],
        "block-1",
      ),
    ).toEqual([
      { selectors: "#block-1", style: {} },
      { selectors: ".gjs-grid", style: { display: "grid" } },
    ]);
  });

  it("does not prepend when selector already targets component id", () => {
    expect(
      ensureComponentIdRuleFirst(
        [{ selectors: ".gjs-grid #block-1 > span", style: { color: "red" } }],
        "block-1",
      ),
    ).toEqual([
      { selectors: ".gjs-grid #block-1 > span", style: { color: "red" } },
    ]);
  });
});

describe("hasStyleDeclarations", () => {
  it("returns false for empty style declarations", () => {
    expect(hasStyleDeclarations({})).toBe(false);
    expect(hasStyleDeclarations({ color: "" })).toBe(false);
    expect(hasStyleDeclarations({ color: "   " })).toBe(false);
    expect(hasStyleDeclarations({ color: null })).toBe(false);
  });

  it("returns true for non-empty style declarations", () => {
    expect(hasStyleDeclarations({ color: "red" })).toBe(true);
    expect(hasStyleDeclarations({ opacity: 0 })).toBe(true);
  });
});

describe("stripEmptyStyleRules", () => {
  it("removes css rules with empty styles", () => {
    expect(
      stripEmptyStyleRules([
        { selectors: "#a", style: {} },
        { selectors: "#b", style: { color: "" } },
        { selectors: "#c", style: { color: "red" } },
      ]),
    ).toEqual([{ selectors: "#c", style: { color: "red" } }]);
  });
});

describe("mergeProtectedSelectorStyles", () => {
  it("preserves existing protected properties when incoming style omits them", () => {
    const currentRules = [
      {
        selectors: ".gjs-grid",
        style: {
          display: "grid",
          "grid-template-columns": "max-content 1fr",
          gap: "12px",
        },
      },
    ];

    const nextSelectorMap = {
      ".gjs-grid": {
        gap: "16px",
      },
    };

    const protectedSelectors = new Set([".gjs-grid"]);

    expect(
      mergeProtectedSelectorStyles(
        nextSelectorMap,
        currentRules,
        protectedSelectors,
      ),
    ).toEqual({
      ".gjs-grid": {
        display: "grid",
        "grid-template-columns": "max-content 1fr",
        gap: "16px",
      },
    });
  });

  it("keeps non-protected selector behavior unchanged", () => {
    const currentRules = [{ selectors: ".foo", style: { color: "red" } }];
    const nextSelectorMap = { ".foo": { margin: "8px" } };
    const protectedSelectors = new Set([".gjs-grid"]);

    expect(
      mergeProtectedSelectorStyles(
        nextSelectorMap,
        currentRules,
        protectedSelectors,
      ),
    ).toEqual({
      ".foo": { margin: "8px" },
    });
  });
});

describe("findProtectedSelectorsInCssText", () => {
  it("finds protected selector in selector block syntax", () => {
    expect(
      findProtectedSelectorsInCssText(".gjs-grid { gap: 16px; }", [
        ".gjs-grid",
      ]),
    ).toEqual([".gjs-grid"]);
  });

  it("finds protected selector when selector is part of a complex selector", () => {
    expect(
      findProtectedSelectorsInCssText(".wrapper .gjs-subgrid > button { }", [
        ".gjs-subgrid",
      ]),
    ).toEqual([".gjs-subgrid"]);
  });

  it("returns empty array when protected selector is not present", () => {
    expect(
      findProtectedSelectorsInCssText(".wrapper .card { color: red; }", [
        ".gjs-grid",
      ]),
    ).toEqual([]);
  });
});
