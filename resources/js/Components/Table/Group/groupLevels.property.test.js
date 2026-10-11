import { describe, expect, it } from "vitest";
import * as fc from "fast-check";
import QueryString from "qs";
import {
  groupsFromQuery,
  groupsToQuery,
  MAX_GROUP_LEVELS,
  moveGroupLevel,
  normalizeGroupLevels,
  sameGroups,
  toggleGroupLevel,
} from "./groupLevels";

// Nama kolom nyata = identifier sederhana. Generator ini SENGAJA selaras dgn
// validasi sumber (normalizeLevel): tak ada koma/spasi/string kosong, jadi
// tidak ada `fc.pre` yang bisa meloloskan input yang seharusnya ditolak.
const columnName = fc.stringMatching(/^[a-z][a-z0-9_]{0,10}$/);
const granularity = fc.constantFrom(
  null,
  "day",
  "month",
  "quarter",
  "half",
  "year",
);
const range = fc.option(
  fc.double({ min: 0.001, max: 1_000_000, noNaN: true }),
  {
    nil: null,
  },
);

const groupsArb = fc
  .uniqueArray(columnName, { minLength: 0, maxLength: MAX_GROUP_LEVELS })
  .chain((columns) =>
    fc.tuple(
      ...columns.map((column) =>
        fc.record({ column: fc.constant(column), granularity, range }),
      ),
    ),
  );

describe("groupLevels — properti", () => {
  it("normalizeGroupLevels idempoten untuk JSON apa pun", () => {
    fc.assert(
      fc.property(fc.jsonValue(), (input) => {
        const once = normalizeGroupLevels(input);
        expect(normalizeGroupLevels(once)).toEqual(once);
      }),
    );
  });

  it("hasil normalize selalu punya kolom unik & string tak kosong", () => {
    fc.assert(
      fc.property(fc.jsonValue(), (input) => {
        const columns = normalizeGroupLevels(input).map((l) => l.column);
        expect(new Set(columns).size).toBe(columns.length);
        expect(columns.every((c) => typeof c === "string" && c !== "")).toBe(
          true,
        );
      }),
    );
  });

  it("Groups -> query string (qs) -> Groups mengembalikan Groups yang sama", () => {
    fc.assert(
      fc.property(groupsArb, (groups) => {
        fc.pre(groups.length > 0); // `Groups` kosong sengaja tak menghasilkan param
        const url = QueryString.stringify(groupsToQuery(groups), {
          skipNulls: true,
        });

        expect(groupsFromQuery(QueryString.parse(url))).toEqual(groups);
      }),
    );
  });

  it("toggle dua kali kolom yang sama (di bawah batas) mengembalikan Groups semula", () => {
    fc.assert(
      fc.property(groupsArb, columnName, (groups, column) => {
        fc.pre(
          groups.length < MAX_GROUP_LEVELS &&
            !groups.some((l) => l.column === column),
        );
        const added = toggleGroupLevel(groups, column, { name: column });
        const removed = toggleGroupLevel(added, column, { name: column });

        expect(added).toHaveLength(groups.length + 1);
        expect(added.at(-1).column).toBe(column);
        expect(sameGroups(removed, groups)).toBe(true);
      }),
    );
  });

  it("toggle tak pernah melebihi MAX_GROUP_LEVELS", () => {
    fc.assert(
      fc.property(
        groupsArb,
        fc.array(columnName, { maxLength: 8 }),
        (groups, more) => {
          const result = more.reduce(
            (acc, column) => toggleGroupLevel(acc, column, { name: column }),
            groups,
          );

          expect(result.length).toBeLessThanOrEqual(MAX_GROUP_LEVELS);
        },
      ),
    );
  });

  it("move mempertahankan himpunan kolom & panjang; move balik = semula", () => {
    fc.assert(
      fc.property(groupsArb, fc.nat(3), fc.nat(3), (groups, from, to) => {
        fc.pre(from < groups.length && to < groups.length);
        const moved = moveGroupLevel(groups, from, to);

        expect(moved.map((l) => l.column).sort()).toEqual(
          groups.map((l) => l.column).sort(),
        );
        expect(sameGroups(moveGroupLevel(moved, to, from), groups)).toBe(true);
      }),
    );
  });

  it("sameGroups sensitif urutan: membalik >=2 level berbeda kolom = tidak sama", () => {
    fc.assert(
      fc.property(groupsArb, (groups) => {
        fc.pre(groups.length >= 2);

        expect(sameGroups(groups, [...groups].reverse())).toBe(false);
        expect(sameGroups(groups, groups)).toBe(true);
      }),
    );
  });
});
