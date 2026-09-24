// Property test (opsional, task 5.6): round-trip add/remove leaf.
//
// Untuk leaf pada kolom yang BELUM ADA di tree, menambah lalu langsung
// menghapus leaf itu (via id barunya) harus menghasilkan tree yang
// ekuivalen dengan tree semula (Requirement 2.2, 6.6).
//
// Generator sengaja memakai 2 pool kolom yang TERPISAH TOTAL (existing vs
// baru) -- bukan `fc.pre()` filter setelah generate -- supaya kondisi "leaf
// pada kolom baru" selalu benar SECARA KONSTRUKSI, tidak bergantung pada
// precondition yang bisa lupa disamakan dgn validasi source (gotcha CLAUDE.md:
// precondition harus selaras PERSIS dgn source, bukan sekadar mirip).
// Root generator selalu "and" (bukan "or") supaya `addLeafChip` selalu lewat
// jalur "tambah leaf baru" tanpa wrap -- ini yg membuat id baru bisa
// ditemukan dgn diff key top-level (satu-satunya key baru).

import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { addLeafChip, removeChip } from "./searchChips";
import { isFilterTreeDirty } from "../Filter/filterTreeCompare";

const EXISTING_COLUMNS = ["colA", "colB", "colC"];
const NEW_COLUMNS = ["colX", "colY", "colZ"]; // disjoint dari EXISTING_COLUMNS

const existingLeafArb = fc.record({
  k: fc.constantFrom(...EXISTING_COLUMNS),
  o: fc.constantFrom("=", "!=", "matches", "in"),
  v: fc.string(),
});

const treeArb = fc.array(existingLeafArb, { maxLength: 5 }).map((leaves) => {
  const c = {};
  leaves.forEach((leaf, i) => {
    c[`leaf_${i}`] = leaf;
  });
  return { root: { k: "and", c } };
});

// `v` HARUS non-kosong dgn definisi yang SAMA PERSIS seperti `isEmptyValue` di
// searchChips.js (string ber-trim kosong ditolak -- `addLeafChip` mengembalikan
// tree apa adanya, jadi tak ada leaf baru utk di-round-trip). Filter di sini
// memakai `trim()` juga, bukan sekadar `!== ""`, krn whitespace-only lolos
// filter yang lebih longgar tapi ditolak source (gotcha CLAUDE.md).
const newLeafArb = fc.record({
  k: fc.constantFrom(...NEW_COLUMNS),
  o: fc.constantFrom("=", "in"),
  v: fc.string().filter((s) => s.trim() !== ""),
});

describe("addLeafChip + removeChip round-trip (property)", () => {
  it("hapus leaf baru pada kolom yang belum ada di tree -> ekuivalen dgn tree semula", () => {
    fc.assert(
      fc.property(treeArb, newLeafArb, (tree, newLeaf) => {
        const idsBefore = new Set(Object.keys(tree.root.c));
        const afterAdd = addLeafChip(tree, newLeaf);
        const idsAfter = Object.keys(afterAdd?.root?.c ?? {});
        const newIds = idsAfter.filter((id) => !idsBefore.has(id));

        // Kolom baru (disjoint) + root selalu "and" -> tidak pernah merge
        // ataupun wrap -> persis satu id baru (leaf yang baru ditambahkan).
        expect(newIds).toHaveLength(1);

        const roundTripped = removeChip(afterAdd, newIds[0]);
        expect(isFilterTreeDirty(tree, roundTripped)).toBe(false);
      }),
    );
  });
});
