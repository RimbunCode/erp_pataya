// Property test (task 2.4, Property 5): konsistensi keputusan edit.
//
// Jika `canEditLeafInCell` = "edit", maka mengedit leaf itu TANPA mengubah
// apa pun (prefill -> commit ulang, persis jalur `computeCheckedLeafPatch`
// di SearchBar) harus menghasilkan leaf yang ekuivalen dengan leaf asal --
// edit tanpa perubahan bersifat identitas dan TIDAK diam-diam mengubah
// operator (pelajaran Requirement 25 spec datatable2-advanced-search).
//
// Precondition generator disamakan PERSIS dgn validasi source: nilai teks
// tidak boleh memuat pemisah chip (`| ; ,`) maupun diawali `!` karena
// `parseMultiValueText`/`buildLeafFromText` menafsirkannya sbg sintaks
// (nilai seperti itu memang tak bisa round-trip lewat kotak ketik -- itu
// batas sintaks, bukan bug), sehingga generator memakai token alfanumerik.

import fc from "fast-check";
import { describe, expect, it } from "vitest";
import {
  buildChipsLeaf,
  buildListLeaf,
  parseMultiValueText,
  resolveValueMode,
  separatorsFor,
} from "./columnSearch";
import { buildEditorPrefill, canEditLeafInCell } from "./valueInputUtils";

const token = fc.stringMatching(/^[a-z0-9]{1,8}$/);
const int = fc.integer({ min: 0, max: 1000 });
const uniq = (arb, minLength, maxLength) =>
  fc.uniqueArray(arb, { minLength, maxLength });

const stringFree = { name: "name", type: "string" };
const stringOpts = {
  name: "status",
  type: "string",
  options: ["a1", "b2", "c3", "d4"],
};
const number = { name: "qty", type: "number" };
const bool = { name: "active", type: "boolean" };
const relation = {
  name: "category",
  type: "relation",
  related: "App\\Models\\Category",
};

// [kolom, arbitrary leaf] -- tiap leaf memakai operator yg DIIZINKAN mode itu.
const textLeaf = fc.oneof(
  fc.record({
    k: fc.constant(stringFree.name),
    o: fc.constantFrom("matches", "!matches"),
    v: token,
  }),
  fc.record({
    k: fc.constant(stringFree.name),
    o: fc.constantFrom("in", "!in"),
    v: uniq(token, 2, 4),
  }),
);
const numberLeaf = fc.oneof(
  fc.record({
    k: fc.constant(number.name),
    o: fc.constantFrom("=", "!=", ">", ">=", "<", "<="),
    v: int,
  }),
  fc
    .tuple(int, int)
    .filter(([a, b]) => a < b)
    .map(([a, b]) => ({ k: number.name, o: "between", v: [a, b] })),
  fc.record({
    k: fc.constant(number.name),
    o: fc.constantFrom("in", "!in"),
    v: uniq(int, 2, 4),
  }),
);
const listLeaf = fc.oneof(
  fc.record({
    k: fc.constant(stringOpts.name),
    o: fc.constantFrom("=", "!="),
    v: fc.constantFrom(...stringOpts.options),
  }),
  fc.record({
    k: fc.constant(stringOpts.name),
    o: fc.constantFrom("in", "!in"),
    v: uniq(fc.constantFrom(...stringOpts.options), 2, 4),
  }),
);
const boolLeaf = fc.record({
  k: fc.constant(bool.name),
  o: fc.constantFrom("=", "!="),
  v: fc.boolean(),
});
const record = fc.integer({ min: 1, max: 50 }).map((id) => ({
  id,
  name: `Rec${id}`,
}));
const relationLeaf = fc.oneof(
  fc.record({
    k: fc.constant(relation.name),
    o: fc.constantFrom("=", "!="),
    v: record,
  }),
  fc.record({
    k: fc.constant(relation.name),
    o: fc.constantFrom("in", "!in"),
    v: fc.uniqueArray(record, {
      minLength: 2,
      maxLength: 4,
      selector: (r) => r.id,
    }),
  }),
);

const cases = fc.oneof(
  textLeaf.map((leaf) => [stringFree, leaf]),
  numberLeaf.map((leaf) => [number, leaf]),
  listLeaf.map((leaf) => [stringOpts, leaf]),
  boolLeaf.map((leaf) => [bool, leaf]),
  relationLeaf.map((leaf) => [relation, leaf]),
);

// Cermin `computeCheckedLeafPatch({withTyped: true})` untuk sesi yg tak diubah
// user: nilai awal = hasil `buildEditorPrefill`, ketikan (`initialText`) ikut.
const recommit = (column, prefill) => {
  const mode = resolveValueMode(column);
  const { exclude, committed, pending } = parseMultiValueText(
    prefill.initialText,
    { separators: separatorsFor(mode) },
  );
  const typed = [...committed, ...(pending.trim() ? [pending.trim()] : [])];
  if (mode === "list") {
    const values = Array.from(new Set([...prefill.initialChecked, ...typed]));
    return buildListLeaf(column, values, exclude);
  }
  if (mode === "relation") {
    const records = prefill.initialRecords;
    return records.length === 1
      ? { k: column.name, o: exclude ? "!=" : "=", v: records[0] }
      : { k: column.name, o: exclude ? "!in" : "in", v: records };
  }
  // text / number
  const values = Array.from(new Set([...prefill.initialTextChips, ...typed]));
  return buildChipsLeaf(column, values, exclude);
};

describe("canEditLeafInCell + buildEditorPrefill (property)", () => {
  it("Property 5: leaf 'edit' yang diedit tanpa perubahan = leaf semula", () => {
    fc.assert(
      fc.property(cases, ([column, leaf]) => {
        expect(canEditLeafInCell(column, leaf)).toBe("edit");
        const prefill = buildEditorPrefill(column, { id: "L1", node: leaf });
        expect(prefill.editId).toBe("L1");
        expect(recommit(column, prefill)).toEqual(leaf);
      }),
      { numRuns: 300 },
    );
  });
});
