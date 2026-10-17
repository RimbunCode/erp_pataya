import { describe, expect, it } from "vitest";
import { isColumnSearchable, resolveValueMode } from "./columnSearch";
import { resolveSearchColumns } from "./resolveSearchColumns";

// Kolom turunan (virtual / Attribute / expression): spec
// datatable-semantic-templates Req 9. Mode & syarat pencarian ditentukan
// `searchVia` dari backend, dan kolom tanpa `searchVia` tidak ditawarkan di
// baris pencarian kolom (Req 9.5).

describe("resolveValueMode - kolom turunan", () => {
  it("searchVia 'dependsOn' -> mode text (operator matches), apa pun type-nya", () => {
    expect(
      resolveValueMode({
        type: "string",
        virtual: true,
        searchVia: "dependsOn",
      }),
    ).toBe("text");
    expect(
      resolveValueMode({ type: "attribute", searchVia: "dependsOn" }),
    ).toBe("text");
  });

  it("searchVia 'expression' / 'single' -> mode number", () => {
    expect(
      resolveValueMode({ type: "progress", searchVia: "expression" }),
    ).toBe("number");
    expect(
      resolveValueMode({ type: "currency", searchVia: "expression" }),
    ).toBe("number");
    expect(resolveValueMode({ type: "attribute", searchVia: "single" })).toBe(
      "number",
    );
  });

  it("virtual / attribute / progress tanpa searchVia -> null (tidak dicari)", () => {
    expect(resolveValueMode({ type: "string", virtual: true })).toBeNull();
    expect(resolveValueMode({ type: "number", virtual: true })).toBeNull();
    expect(resolveValueMode({ type: "attribute" })).toBeNull();
    expect(resolveValueMode({ type: "progress" })).toBeNull();
  });

  it("kolom biasa tidak berubah (Property 10)", () => {
    expect(resolveValueMode({ type: "string" })).toBe("text");
    expect(resolveValueMode({ type: "number" })).toBe("number");
    expect(resolveValueMode({ type: "boolean" })).toBe("list");
    expect(resolveValueMode({ type: "date" })).toBe("date");
  });
});

describe("isColumnSearchable - kolom turunan", () => {
  it("kolom virtual tanpa searchVia tidak muncul di baris pencarian", () => {
    expect(
      isColumnSearchable({ name: "v", type: "string", virtual: true }),
    ).toBe(false);
    expect(
      isColumnSearchable({
        name: "v",
        type: "string",
        virtual: true,
        searchable: false,
      }),
    ).toBe(false);
  });

  it("kolom turunan ber-searchVia muncul", () => {
    expect(
      isColumnSearchable({
        name: "v",
        type: "string",
        virtual: true,
        searchVia: "dependsOn",
      }),
    ).toBe(true);
    expect(
      isColumnSearchable({
        name: "p",
        type: "progress",
        searchVia: "expression",
      }),
    ).toBe(true);
  });

  it("searchable:false mematikan kolom expression", () => {
    expect(
      isColumnSearchable({
        name: "p",
        type: "progress",
        searchVia: "expression",
        searchable: false,
      }),
    ).toBe(false);
  });
});

describe("resolveSearchColumns - kolom virtual", () => {
  it("fallback pencarian teks bebas tidak memuat kolom virtual", () => {
    const columns = {
      code: { name: "code", type: "string" },
      title: {
        name: "title",
        type: "string",
        virtual: true,
        searchVia: "dependsOn",
      },
    };

    expect(
      resolveSearchColumns({
        searchScope: [],
        columns,
        visibleNames: ["code", "title"],
      }),
    ).toEqual(["code"]);
  });
});
