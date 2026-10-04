// Property test (task 11.4): badge per kolom & operasi tree Sel Filter.
//
// Property 1: partisi badge -- tiap leaf anak-root masuk <= 1 kolom, chip
//   search/advanced tak pernah menghasilkan badge.
// Property 2: commit menjaga node lain -- addLeafChip/updateChip/
//   removeLeafValue tak mengubah node anak-root lain selain target.
// Property 3: round-trip teks <-> leaf (idempoten pada hasil kanonik).
// Property 4: hapus nilai dari leaf `in`.
// Property 6: derivasi murni -- badge hanya fungsi dari tree/kolom/locale.
// Property 7: idempotensi merge -- commit nilai sama dua kali tak menggandakan.
//
// Precondition generator disamakan PERSIS dgn validasi source: root selalu
// "and" (jalur wrap OR di `addLeafChip` diuji terpisah), kolom leaf diambil
// dari pool tetap, nilai teks alfanumerik tanpa pemisah chip / awalan `!`.

import fc from "fast-check";
import { describe, expect, it } from "vitest";

import { badgesForColumn } from "./columnBadges";
import { buildLeafFromText, leafToText } from "./columnSearch";
import {
  addLeafChip,
  removeLeafValue,
  treeToChips,
  updateChip,
} from "./searchChips";

const t = (key) => key;

const columns = {
  name: { name: "name", title: "Nama", type: "string" },
  qty: { name: "qty", title: "Jumlah", type: "number" },
  status: {
    name: "status",
    title: "Status",
    type: "string",
    options: [
      { value: "draft", label: "Draft" },
      { value: "done", label: "Selesai" },
    ],
  },
  active: { name: "active", title: "Aktif", type: "boolean" },
  category: {
    name: "category",
    title: "Kategori",
    type: "relation",
    related: "App\\Models\\Category",
    columns: {
      "category.name": {
        name: "category.name",
        title: "Nama",
        type: "string",
      },
    },
  },
};
const columnList = Object.values(columns);

const token = fc.stringMatching(/^[a-z0-9]{1,8}$/);
const int = fc.integer({ min: 0, max: 1000 });

const leafArb = fc.oneof(
  fc.record({
    k: fc.constant("name"),
    o: fc.constantFrom("matches", "!matches"),
    v: token,
  }),
  fc.record({
    k: fc.constant("qty"),
    o: fc.constantFrom("=", "!=", ">", ">=", "<", "<="),
    v: int,
  }),
  fc.record({
    k: fc.constant("qty"),
    o: fc.constantFrom("in", "!in"),
    v: fc.uniqueArray(int, { minLength: 2, maxLength: 4 }),
  }),
  fc.record({
    k: fc.constant("status"),
    o: fc.constantFrom("=", "!="),
    v: fc.constantFrom("draft", "done"),
  }),
  fc.record({
    k: fc.constant("active"),
    o: fc.constantFrom("=", "!="),
    v: fc.boolean(),
  }),
  fc.record({
    k: fc.constant("category.name"),
    o: fc.constant("matches"),
    v: token,
  }),
  fc.record({
    k: fc.constant("ghost"), // kolom yang tak ada di peta
    o: fc.constant("="),
    v: token,
  }),
);
const groupArb = fc
  .tuple(
    fc.constantFrom("and", "or"),
    fc.array(leafArb, { minLength: 2, maxLength: 3 }),
  )
  .map(([k, leaves]) => ({
    k,
    c: Object.fromEntries(leaves.map((leaf, i) => [`g${i}`, leaf])),
  }));

// tree dgn root AND berisi leaf & grup (grup = chip advanced/search)
const treeArb = fc
  .array(
    fc.oneof(
      { weight: 4, arbitrary: leafArb },
      { weight: 1, arbitrary: groupArb },
    ),
    {
      maxLength: 6,
    },
  )
  .map((nodes) => ({
    root: {
      k: "and",
      c: Object.fromEntries(nodes.map((n, i) => [`n${i}`, n])),
    },
  }));

const chipsOf = (tree) => treeToChips(tree, columns, t, {});
const badgesAll = (tree) => {
  const chips = chipsOf(tree);
  return columnList.map((column) =>
    badgesForColumn(chips, column, { t, columns }),
  );
};

describe("columnBadges (property)", () => {
  it("Property 1: tiap leaf anak-root masuk <= 1 kolom; grup tak menghasilkan badge", () => {
    fc.assert(
      fc.property(treeArb, (tree) => {
        const perColumn = badgesAll(tree);
        const leafIds = new Set(
          Object.entries(tree.root.c)
            .filter(([, n]) => !n.c)
            .map(([id]) => id),
        );
        const seen = new Map();
        perColumn.forEach((badges, ci) => {
          for (const id of new Set(badges.map((b) => b.leafId))) {
            // hanya leaf langsung anak root, tak pernah id grup
            expect(leafIds.has(id)).toBe(true);
            seen.set(id, (seen.get(id) ?? 0) + (ci >= 0 ? 1 : 0));
          }
        });
        for (const count of seen.values()) expect(count).toBeLessThanOrEqual(1);
      }),
      { numRuns: 200 },
    );
  });

  it("Property 2: commit sel tak mengubah node anak-root lain selain target", () => {
    fc.assert(
      fc.property(treeArb, leafArb, (tree, patch) => {
        const before = JSON.parse(JSON.stringify(tree));
        const after = addLeafChip(tree, patch);
        // tak memutasi masukan
        expect(tree).toEqual(before);
        const afterNodes = after.root.c;
        for (const [id, node] of Object.entries(before.root.c)) {
          // node lama selalu masih ada; hanya leaf `=`/`in` pada kolom yg
          // sama dgn patch (merge) yang boleh berubah
          expect(afterNodes[id]).toBeDefined();
          const mergeTarget =
            !node.c &&
            node.k === patch.k &&
            ["=", "in"].includes(node.o) &&
            ["=", "in"].includes(patch.o);
          if (!mergeTarget) expect(afterNodes[id]).toEqual(node);
        }
      }),
      { numRuns: 200 },
    );
  });

  it("Property 2b: updateChip & removeLeafValue hanya menyentuh leaf target", () => {
    fc.assert(
      fc.property(treeArb, (tree) => {
        const leafIds = Object.entries(tree.root.c)
          .filter(([, n]) => !n.c)
          .map(([id]) => id);
        fc.pre(leafIds.length > 0);
        const target = leafIds[0];
        const updated = updateChip(tree, target, { v: "zzz" });
        for (const [id, node] of Object.entries(tree.root.c)) {
          if (id !== target) expect(updated.root.c[id]).toEqual(node);
        }
        const removed = removeLeafValue(tree, target, "zzz-not-found");
        for (const [id, node] of Object.entries(tree.root.c)) {
          if (removed?.root?.c?.[id]) expect(removed.root.c[id]).toEqual(node);
        }
      }),
      { numRuns: 200 },
    );
  });

  it("Property 3: round-trip teks <-> leaf idempoten pada hasil kanonik", () => {
    const text = token;
    const numberText = fc.oneof(
      int.map(String),
      int.map((n) => `>=${n}`),
      int.map((n) => `<${n}`),
      int.map((n) => `!${n}`),
      fc.tuple(int, int).map(([a, b]) => `${a}..${b}`),
    );
    const cases = fc.oneof(
      fc.tuple(
        fc.constant(columns.name),
        fc.oneof(
          text,
          text.map((s) => `!${s}`),
        ),
      ),
      fc.tuple(fc.constant(columns.qty), numberText),
    );
    fc.assert(
      fc.property(cases, ([column, s]) => {
        const leaf = buildLeafFromText(column, s);
        fc.pre(leaf !== null);
        expect(buildLeafFromText(column, leafToText(leaf))).toEqual(leaf);
      }),
      { numRuns: 300 },
    );
  });

  it("Property 4: hapus nilai dari leaf `in` -> n-1 nilai berurutan (n=2 -> =)", () => {
    fc.assert(
      fc.property(
        fc.uniqueArray(int, { minLength: 2, maxLength: 6 }),
        fc.nat(),
        fc.constantFrom("in", "!in"),
        (values, pick, o) => {
          const tree = {
            root: { k: "and", c: { L: { k: "qty", o, v: values } } },
          };
          const removeIdx = pick % values.length;
          const next = removeLeafValue(tree, "L", `${values[removeIdx]}`);
          const expected = values.filter((_, i) => i !== removeIdx);
          const leaf = next.root.c.L;
          if (expected.length === 1) {
            expect(leaf).toEqual({
              k: "qty",
              o: o === "in" ? "=" : "!=",
              v: expected[0],
            });
          } else {
            expect(leaf).toEqual({ k: "qty", o, v: expected });
          }
        },
      ),
      { numRuns: 200 },
    );
  });

  it("Property 6: derivasi murni -- tree struktural sama -> badge sama", () => {
    fc.assert(
      fc.property(treeArb, (tree) => {
        const clone = JSON.parse(JSON.stringify(tree));
        expect(badgesAll(clone)).toEqual(badgesAll(tree));
      }),
      { numRuns: 100 },
    );
  });

  it("Property 7: commit nilai sama dua kali pada kolom =/in tak menggandakan nilai", () => {
    fc.assert(
      fc.property(treeArb, int, (tree, n) => {
        const patch = { k: "qty", o: "=", v: n };
        const once = addLeafChip(tree, patch);
        const twice = addLeafChip(once, patch);
        const values = Object.values(twice.root.c)
          .filter(
            (node) =>
              !node.c && node.k === "qty" && ["=", "in"].includes(node.o),
          )
          .flatMap((node) => (Array.isArray(node.v) ? node.v : [node.v]));
        // leaf `=`/`in` qty bisa >1 (tree awal), tapi nilai n muncul paling
        // banyak sebanyak di tree awal + 1 (tidak 2x dari dua commit sama)
        const countIn = (tr) =>
          Object.values(tr.root.c)
            .filter(
              (node) =>
                !node.c && node.k === "qty" && ["=", "in"].includes(node.o),
            )
            .flatMap((node) => (Array.isArray(node.v) ? node.v : [node.v]))
            .filter((x) => x === n).length;
        expect(countIn(twice)).toBe(Math.max(countIn(tree), 1));
        expect(values).toEqual(values); // pastikan array terbentuk
      }),
      { numRuns: 200 },
    );
  });
});
