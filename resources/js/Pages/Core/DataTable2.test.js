// Unit test fungsi murni `classifyOptionsChange` (Requirement 24, permintaan
// user): keputusan skip-fetch Inertia utk perubahan `options` grup/sort
// tertentu. Lihat komentar di atas fungsinya (DataTable2.jsx) utk definisi
// tiap rule.

import { describe, expect, it } from "vitest";
import { classifyOptionsChange } from "./DataTable2";

const baseOptions = () => ({
  sort: "-created_at",
  fid: null,
  page: 1,
  show: 25,
  group: [
    { column: "stage", granularity: null, range: null },
    { column: "customer", granularity: null, range: null },
  ],
  groupSort: "asc",
});

const classify = (
  patchPrev,
  patchNext,
  groupAggregateColumns = [],
  hasGroupTree = true,
) =>
  classifyOptionsChange(
    { ...baseOptions(), ...patchPrev },
    { ...baseOptions(), ...patchNext },
    { groupAggregateColumns, hasGroupTree },
  );

describe("classifyOptionsChange", () => {
  it("ganti sub-level (level 0 identik) -> group-sublevel", () => {
    const decision = classify(
      {},
      {
        group: [
          { column: "stage", granularity: null, range: null },
          { column: "status", granularity: null, range: null },
        ],
      },
    );
    expect(decision).toBe("group-sublevel");
  });

  it("ganti level 0 -> full (daftar grup level-0 ikut berubah)", () => {
    const decision = classify(
      {},
      {
        group: [
          { column: "customer", granularity: null, range: null },
          { column: "status", granularity: null, range: null },
        ],
      },
    );
    expect(decision).toBe("full");
  });

  it("hapus semua grup ('Tidak ada') -> full", () => {
    const decision = classify({}, { group: [] });
    expect(decision).toBe("full");
  });

  it("aktifkan grup dari kosong -> full", () => {
    const decision = classify({ group: [] }, {});
    expect(decision).toBe("full");
  });

  it("sort kolom BUKAN grup & BUKAN aggregate, grup aktif -> sort-leaf-only", () => {
    const decision = classify({}, { sort: "-probability" }, ["expected_value"]);
    expect(decision).toBe("sort-leaf-only");
  });

  it("sort kolom yg JADI kolom grup -> full", () => {
    const decision = classify({}, { sort: "customer" }, []);
    expect(decision).toBe("full");
  });

  it("sort kolom groupAggregate -> full", () => {
    const decision = classify({}, { sort: "-expected_value" }, [
      "expected_value",
    ]);
    expect(decision).toBe("full");
  });

  it("sort berubah tanpa grup aktif (flat mode) -> full", () => {
    const decision = classify(
      { group: [] },
      { group: [], sort: "-probability" },
      [],
    );
    expect(decision).toBe("full");
  });

  it("dua field berubah sekaligus (group & sort) -> full", () => {
    const decision = classify(
      {},
      {
        sort: "-probability",
        group: [
          { column: "stage", granularity: null, range: null },
          { column: "status", granularity: null, range: null },
        ],
      },
      [],
    );
    expect(decision).toBe("full");
  });

  it("hanya `page` berubah (reset ke 1 tanpa perubahan lain) -> full (diabaikan, tak ada field relevan lain)", () => {
    const decision = classify({ page: 3 }, { page: 1 });
    expect(decision).toBe("full");
  });

  it("fid berubah -> full", () => {
    const decision = classify({}, { fid: "abc" });
    expect(decision).toBe("full");
  });

  it("show berubah -> full", () => {
    const decision = classify({}, { show: 50 });
    expect(decision).toBe("full");
  });

  it("granularity level 0 berubah (kolom sama) -> full (level 0 dianggap berubah)", () => {
    const decision = classify(
      {
        group: [
          { column: "created_at", granularity: "month", range: null },
          { column: "customer", granularity: null, range: null },
        ],
      },
      {
        group: [
          { column: "created_at", granularity: "quarter", range: null },
          { column: "customer", granularity: null, range: null },
        ],
      },
    );
    expect(decision).toBe("full");
  });

  it("tak ada field yg berubah sama sekali -> full (aman, bukan bug)", () => {
    const decision = classify({}, {});
    expect(decision).toBe("full");
  });

  it("tanpa pohon grup aktif di server (groupMeta null) -> full, walau sub-level cocok", () => {
    const decision = classify(
      {},
      {
        group: [
          { column: "stage", granularity: null, range: null },
          { column: "status", granularity: null, range: null },
        ],
      },
      [],
      false,
    );
    expect(decision).toBe("full");
  });
});
