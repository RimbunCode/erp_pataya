import { describe, expect, it } from "vitest";
import {
  resolveComponentPrimarySelector,
  normalizeCssInputToSelectorMap,
  resolveProtectedSelectorsForComponent,
  ensureComponentIdRuleFirst,
  hasStyleDeclarations,
  stripEmptyStyleRules,
  mergeProtectedSelectorStyles,
  findProtectedSelectorsInCssText,
} from "./manualCssRuleUtils";

describe("resolveComponentPrimarySelector", () => {
  it("mengutamakan id komponen sebagai selector (#id)", () => {
    const component = { getId: () => "hero-1" };
    expect(resolveComponentPrimarySelector(component)).toBe("#hero-1");
  });

  it("fallback ke selectorsString (ambil selector pertama) bila tanpa id", () => {
    const component = {
      getId: () => "",
      getSelectorsString: () => ".card, .card-highlight",
    };
    expect(resolveComponentPrimarySelector(component)).toBe(".card");
  });

  it("fallback ke tagName bila tanpa id dan selector", () => {
    const component = {
      getId: () => "",
      getSelectorsString: () => "",
      get: (key) => (key === "tagName" ? "div" : undefined),
    };
    expect(resolveComponentPrimarySelector(component)).toBe("div");
  });

  it("component null/undefined -> string kosong", () => {
    expect(resolveComponentPrimarySelector(null)).toBe("");
    expect(resolveComponentPrimarySelector(undefined)).toBe("");
  });
});

describe("normalizeCssInputToSelectorMap", () => {
  it("cssText kosong -> object kosong", () => {
    expect(normalizeCssInputToSelectorMap("")).toEqual({});
  });

  it("teks tanpa rule-block syntax (tanpa { }) diperlakukan sebagai deklarasi utk primarySelector", () => {
    const result = normalizeCssInputToSelectorMap(
      "color: red; font-weight: bold;",
      "#comp-1",
    );
    expect(result).toEqual({
      "#comp-1": { color: "red", "font-weight": "bold" },
    });
  });

  it("tanpa primarySelector dan tanpa rule-block -> object kosong", () => {
    expect(normalizeCssInputToSelectorMap("color: red;", "")).toEqual({});
  });

  it("teks dengan rule-block syntax ({ }) diparse sebagai selector map, key ter-trim", () => {
    const result = normalizeCssInputToSelectorMap("  .card  { color: red; }");
    expect(result).toEqual({ ".card": { color: "red" } });
  });
});

describe("resolveProtectedSelectorsForComponent", () => {
  it("component null -> Set kosong", () => {
    expect(resolveProtectedSelectorsForComponent(null)).toEqual(new Set());
  });

  it("componentType 'grid' menghasilkan kandidat .gjs-grid, difilter oleh availability di currentRules", () => {
    const component = { getType: () => "grid", getClasses: () => [] };
    const currentRules = [{ selectors: ".gjs-grid" }, { selectors: ".other" }];
    const result = resolveProtectedSelectorsForComponent(
      component,
      currentRules,
    );
    expect(result).toEqual(new Set([".gjs-grid"]));
  });

  it("class dengan prefix gjs- ditambahkan sebagai kandidat protected selector", () => {
    const component = {
      getType: () => "text",
      getClasses: () => ["gjs-row", "custom-class"],
    };
    const currentRules = [{ selectors: ".gjs-row" }];
    const result = resolveProtectedSelectorsForComponent(
      component,
      currentRules,
    );
    expect(result).toEqual(new Set([".gjs-row"]));
  });

  it("kandidat yang tidak ada di currentRules tidak ikut ke hasil akhir", () => {
    const component = { getType: () => "grid", getClasses: () => [] };
    const result = resolveProtectedSelectorsForComponent(component, []);
    expect(result).toEqual(new Set());
  });
});

describe("ensureComponentIdRuleFirst", () => {
  it("menyisipkan rule id kosong di posisi pertama bila belum ada", () => {
    const result = ensureComponentIdRuleFirst(
      [{ selectors: ".card", style: { color: "red" } }],
      "hero-1",
    );
    expect(result[0]).toEqual({ selectors: "#hero-1", style: {} });
    expect(result).toHaveLength(2);
  });

  it("tidak menduplikasi rule id yang sudah ada", () => {
    const rules = [{ selectors: "#hero-1", style: { color: "blue" } }];
    const result = ensureComponentIdRuleFirst(rules, "hero-1");
    expect(result).toHaveLength(1);
    expect(result[0].style).toEqual({ color: "blue" });
  });

  it("componentId kosong -> array dikembalikan apa adanya (shallow copy)", () => {
    const rules = [{ selectors: ".x", style: {} }];
    const result = ensureComponentIdRuleFirst(rules, "");
    expect(result).toEqual(rules);
    expect(result).not.toBe(rules);
  });

  it("cssRules bukan array -> array kosong", () => {
    expect(ensureComponentIdRuleFirst(null, "x")).toEqual([]);
  });
});

describe("hasStyleDeclarations", () => {
  it("true bila ada minimal satu value non-kosong", () => {
    expect(hasStyleDeclarations({ color: "red" })).toBe(true);
  });

  it("false untuk object kosong", () => {
    expect(hasStyleDeclarations({})).toBe(false);
  });

  it("false bila semua value string kosong/whitespace", () => {
    expect(hasStyleDeclarations({ color: "", padding: "   " })).toBe(false);
  });

  it("false untuk null/array/non-object", () => {
    expect(hasStyleDeclarations(null)).toBe(false);
    expect(hasStyleDeclarations([])).toBe(false);
    expect(hasStyleDeclarations("string")).toBe(false);
  });
});

describe("stripEmptyStyleRules", () => {
  it("membuang rule tanpa selector atau tanpa style declaration", () => {
    const rules = [
      { selectors: ".a", style: { color: "red" } },
      { selectors: "", style: { color: "blue" } },
      { selectors: ".c", style: {} },
    ];
    expect(stripEmptyStyleRules(rules)).toEqual([
      { selectors: ".a", style: { color: "red" } },
    ]);
  });

  it("input bukan array -> array kosong", () => {
    expect(stripEmptyStyleRules(null)).toEqual([]);
  });
});

describe("mergeProtectedSelectorStyles", () => {
  it("selector tidak protected -> incoming style dipakai langsung", () => {
    const result = mergeProtectedSelectorStyles(
      { ".card": { color: "red" } },
      [],
      new Set(),
    );
    expect(result).toEqual({ ".card": { color: "red" } });
  });

  it("selector protected dengan existing style -> merge (existing lalu incoming menang)", () => {
    const result = mergeProtectedSelectorStyles(
      { ".gjs-grid": { color: "red" } },
      [{ selectors: ".gjs-grid", style: { color: "blue", padding: "8px" } }],
      new Set([".gjs-grid"]),
    );
    expect(result).toEqual({
      ".gjs-grid": { color: "red", padding: "8px" },
    });
  });

  it("selector protected tanpa existing style declaration -> incoming dipakai langsung", () => {
    const result = mergeProtectedSelectorStyles(
      { ".gjs-grid": { color: "red" } },
      [{ selectors: ".gjs-grid", style: {} }],
      new Set([".gjs-grid"]),
    );
    expect(result).toEqual({ ".gjs-grid": { color: "red" } });
  });

  it("nextSelectorMap bukan object valid -> object kosong", () => {
    expect(mergeProtectedSelectorStyles(null)).toEqual({});
    expect(mergeProtectedSelectorStyles([])).toEqual({});
  });
});

describe("findProtectedSelectorsInCssText", () => {
  it("protectedSelectors kosong -> array kosong", () => {
    expect(
      findProtectedSelectorsInCssText(".card { color: red; }", []),
    ).toEqual([]);
  });

  it("mendeteksi protected selector yang muncul sebagai selector map key", () => {
    const result = findProtectedSelectorsInCssText(
      ".gjs-grid { color: red; }",
      [".gjs-grid"],
    );
    expect(result).toEqual([".gjs-grid"]);
  });

  it("mendeteksi protected selector via raw text match (fallback regex)", () => {
    const result = findProtectedSelectorsInCssText(
      "some text mentioning .gjs-grid inline",
      [".gjs-grid"],
    );
    expect(result).toEqual([".gjs-grid"]);
  });

  it("tidak mendeteksi selector yang jadi substring token lain (word-boundary)", () => {
    const result = findProtectedSelectorsInCssText(
      ".gjs-grid-extended { color: red; }",
      [".gjs-grid"],
    );
    expect(result).toEqual([]);
  });
});
