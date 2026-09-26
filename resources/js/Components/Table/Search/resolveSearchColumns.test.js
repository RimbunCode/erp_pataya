import { describe, expect, it } from "vitest";
import { resolveSearchColumns } from "./resolveSearchColumns";

describe("resolveSearchColumns", () => {
  const columns = {
    code: { name: "code", type: "string", searchable: true },
    description: { name: "description", type: "string" },
    notSearchable: { name: "notSearchable", type: "string", searchable: false },
    total: { name: "total", type: "currency" },
    "customer.name": {
      name: "customer.name",
      type: "string",
      parentCol: { name: "customer" },
    },
  };

  it("scope tidak kosong menang, dipakai apa adanya", () => {
    const result = resolveSearchColumns({
      searchScope: ["code", "customer.name"],
      columns,
      visibleNames: ["total"],
    });
    expect(result).toEqual(["code", "customer.name"]);
  });

  it("scope kosong -> fallback ke visibleNames yang searchable & bertipe string level-atas", () => {
    const result = resolveSearchColumns({
      searchScope: [],
      columns,
      visibleNames: [
        "code",
        "description",
        "notSearchable",
        "total",
        "customer.name",
      ],
    });
    expect(result).toEqual(["code", "description"]);
  });

  it("scope undefined diperlakukan sama seperti kosong", () => {
    const result = resolveSearchColumns({
      columns,
      visibleNames: ["code"],
    });
    expect(result).toEqual(["code"]);
  });

  it("menyaring kolom searchable:false", () => {
    const result = resolveSearchColumns({
      columns,
      visibleNames: ["notSearchable"],
    });
    expect(result).toEqual([]);
  });

  it("menyaring kolom non-string", () => {
    const result = resolveSearchColumns({
      columns,
      visibleNames: ["total"],
    });
    expect(result).toEqual([]);
  });

  it("menyaring kolom anak relasi (parentCol)", () => {
    const result = resolveSearchColumns({
      columns,
      visibleNames: ["customer.name"],
    });
    expect(result).toEqual([]);
  });

  it("menyaring nama yang tidak ada di columns", () => {
    const result = resolveSearchColumns({
      columns,
      visibleNames: ["unknown"],
    });
    expect(result).toEqual([]);
  });

  it("semua kosong -> []", () => {
    expect(resolveSearchColumns({})).toEqual([]);
    expect(
      resolveSearchColumns({ searchScope: [], columns: {}, visibleNames: [] }),
    ).toEqual([]);
  });
});
