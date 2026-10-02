import { describe, expect, it } from "vitest";

import {
  createLocalGroupFetcher,
  describeValue,
  groupNodeFromRows,
  inferLevels,
} from "./localGroups";

const rows = [
  { id: 1, code: "A1", category: "alpha", active: true, cat: { id: 10, name: "Cat A" } },
  { id: 2, code: "A2", category: "alpha", active: false, cat: { id: 10, name: "Cat A" } },
  { id: 3, code: "B1", category: "beta", active: true, cat: { id: 20, name: "Cat B" } },
  { id: 4, code: "N1", category: null, active: true, cat: null },
];

describe("describeValue", () => {
  it("null/kosong -> key 'null'; relasi -> id + label; boolean -> string key", () => {
    expect(describeValue(null)).toEqual({ key: "null", raw: null });
    expect(describeValue("")).toEqual({ key: "null", raw: null });
    expect(describeValue({ id: 5, name: "x" })).toEqual({
      key: "5",
      raw: 5,
      label: { id: 5, name: "x" },
    });
    expect(describeValue(false)).toEqual({ key: "false", raw: false });
    expect(describeValue("abc")).toEqual({ key: "abc", raw: "abc" });
  });
});

describe("inferLevels", () => {
  it("menebak tipe dari nilai pertama yang terisi dan membuang tipe array", () => {
    const levels = inferLevels(
      [{ column: "category" }, { column: "active" }, { column: "cat" }, { column: "tags" }],
      [...rows.map((r) => ({ ...r, tags: ["x"] }))],
    );

    expect(levels.map((l) => [l.column, l.type])).toEqual([
      ["category", "string"],
      ["active", "boolean"],
      ["cat", "relation"],
    ]);
  });
});

describe("groupNodeFromRows", () => {
  const levels = inferLevels([{ column: "category" }, { column: "active" }], rows);

  it("level-0: distinct + count, NULL paling awal", () => {
    const node = groupNodeFromRows(rows, levels);

    expect(node.type).toBe("groups");
    expect(node.data.map((g) => [g.key, g.count])).toEqual([
      ["null", 1],
      ["alpha", 2],
      ["beta", 1],
    ]);
    expect(node.total).toBe(3);
  });

  it("sub-grup mengikuti path; daun mengembalikan baris", () => {
    const sub = groupNodeFromRows(rows, levels, ["alpha"]);
    expect(sub.type).toBe("groups");
    expect(sub.data.map((g) => g.key)).toEqual(["false", "true"]);

    const leaf = groupNodeFromRows(rows, levels, ["alpha", true]);
    expect(leaf.type).toBe("rows");
    expect(leaf.data.map((r) => r.code)).toEqual(["A1"]);
  });

  it("path null mencocokkan nilai kosong", () => {
    const leaf = groupNodeFromRows(rows, levels, [null, true]);

    expect(leaf.data.map((r) => r.code)).toEqual(["N1"]);
  });

  it("paginasi: halaman di luar rentang -> data kosong, total benar", () => {
    const node = groupNodeFromRows(rows, levels, [], 5, 2);

    expect(node.data).toEqual([]);
    expect(node.total).toBe(3);
    expect(node.last_page).toBe(2);
  });

  it("relasi: deskriptor membawa label objek", () => {
    const relLevels = inferLevels([{ column: "cat" }], rows);
    const node = groupNodeFromRows(rows, relLevels);

    expect(node.data.find((g) => g.key === "10").label.name).toBe("Cat A");
  });
});

describe("createLocalGroupFetcher", () => {
  it("membaca rows TERBARU tiap dipanggil", async () => {
    let current = rows;
    const levels = inferLevels([{ column: "category" }], rows);
    const fetcher = createLocalGroupFetcher({ getRows: () => current, levels });

    const first = await fetcher({ rawPath: [], page: 1 });
    current = rows.slice(0, 1);
    const second = await fetcher({ rawPath: [], page: 1 });

    expect(first.total).toBe(3);
    expect(second.total).toBe(1);
  });
});
