/**
 * Property 4, spec asset-items-section: total dokumen tidak bergantung pada
 * pembagian baris ke dua tabel. Diuji terhadap allocateDiscount (replikasi
 * DocumentDiscountCalculator) lewat getAllItems/allocationContext.
 *
 * Precondition generator SELARAS dengan source: baris valid = quantity > 0 dan
 * price >= 0 (filter `item?.item` di SO Form membuang baris tanpa item, jadi
 * generator selalu memberi `item`), tax_rate 0..100.
 */

import { describe, it, expect } from "vitest";
import fc from "fast-check";
import { allocateDiscount } from "./discountAllocation";
import { allocationContext, getAllItems } from "./assetItems";

const rowArb = fc.record({
  id: fc.uuid(),
  item: fc.constant({ id: "variant" }),
  quantity: fc.integer({ min: 1, max: 50 }),
  price: fc.integer({ min: 0, max: 5_000_000 }),
  tax: fc.record({ rate: fc.constantFrom(0, 10, 11, 12) }),
});

const discountArb = fc.oneof(
  fc.constant({ on: null, rate: 0, amount: 0, key: "discount_rate" }),
  fc.record({
    on: fc.constantFrom("net_total", "grand_total"),
    rate: fc.integer({ min: 0, max: 100 }),
    amount: fc.constant(0),
    key: fc.constant("discount_rate"),
  }),
  fc.record({
    on: fc.constantFrom("net_total", "grand_total"),
    rate: fc.constant(0),
    amount: fc.integer({ min: 0, max: 1_000_000 }),
    key: fc.constant("discount_amount"),
  }),
);

const toLines = (rows) =>
  rows.map((row) => ({
    basic_amount: row.quantity * row.price,
    tax_rate: row.tax.rate,
  }));

const allocate = (rows, discount) =>
  allocateDiscount(
    toLines(rows),
    discount.on,
    discount.rate,
    discount.amount,
    discount.key,
  );

const totals = (allocated) => ({
  basic: allocated.reduce((sum, line) => sum + line.basic_amount, 0),
  tax: allocated.reduce((sum, line) => sum + line.tax_amount, 0),
});

// split[i] === true -> baris ke-i masuk asset_items, selain itu items
const splitRows = (rows, split) => ({
  items: rows.filter((_, i) => !split[i]),
  asset_items: rows.filter((_, i) => split[i]),
});

describe("Property 4: total tidak bergantung pada pembagian tabel", () => {
  it("jumlah basic_amount dan tax_amount gabungan sama untuk pembagian mana pun", () => {
    fc.assert(
      fc.property(
        fc.array(rowArb, { minLength: 1, maxLength: 8 }),
        discountArb,
        fc.array(fc.boolean(), { minLength: 8, maxLength: 8 }),
        fc.array(fc.boolean(), { minLength: 8, maxLength: 8 }),
        (rows, discount, splitA, splitB) => {
          const single = totals(allocate(rows, discount));
          const viaA = totals(
            allocate(getAllItems(splitRows(rows, splitA)), discount),
          );
          const viaB = totals(
            allocate(getAllItems(splitRows(rows, splitB)), discount),
          );

          // residual pembulatan hanya berpindah baris, jadi jumlah tetap sama
          // dalam toleransi 1 sen per komponen
          expect(Math.abs(viaA.basic - single.basic)).toBeLessThanOrEqual(
            0.011,
          );
          expect(Math.abs(viaB.basic - single.basic)).toBeLessThanOrEqual(
            0.011,
          );
          expect(Math.abs(viaA.tax - single.tax)).toBeLessThanOrEqual(0.011);
          expect(Math.abs(viaB.tax - single.tax)).toBeLessThanOrEqual(0.011);
        },
      ),
      { numRuns: 200 },
    );
  });

  it("allocationContext selalu menunjuk baris yang sedang dipetakan, untuk kind dan posisi mana pun", () => {
    fc.assert(
      fc.property(
        fc.array(rowArb, { minLength: 1, maxLength: 8 }),
        fc.array(fc.boolean(), { minLength: 8, maxLength: 8 }),
        (rows, split) => {
          const data = splitRows(rows, split);

          data.items.forEach((row, index) => {
            const ctx = allocationContext({
              kind: "item",
              dataTable: data.items,
              index,
              data,
            });
            expect(ctx.rows[ctx.index]).toBe(row);
            expect(ctx.rows).toHaveLength(rows.length);
          });

          data.asset_items.forEach((row, index) => {
            const ctx = allocationContext({
              kind: "asset",
              dataTable: data.asset_items,
              index,
              data,
            });
            expect(ctx.rows[ctx.index]).toBe(row);
            expect(ctx.rows).toHaveLength(rows.length);
          });
        },
      ),
      { numRuns: 200 },
    );
  });

  it("hasil alokasi satu baris sama di kedua tabel selama dihitung dari daftar gabungan yang sama", () => {
    fc.assert(
      fc.property(
        fc.array(rowArb, { minLength: 2, maxLength: 8 }),
        discountArb,
        fc.array(fc.boolean(), { minLength: 8, maxLength: 8 }),
        (rows, discount, split) => {
          const data = splitRows(rows, split);
          const combined = allocate(getAllItems(data), discount);

          const viaItem = data.items.map((_, index) => {
            const ctx = allocationContext({
              kind: "item",
              dataTable: data.items,
              index,
              data,
            });
            return allocate(ctx.rows, discount)[ctx.index];
          });
          const viaAsset = data.asset_items.map((_, index) => {
            const ctx = allocationContext({
              kind: "asset",
              dataTable: data.asset_items,
              index,
              data,
            });
            return allocate(ctx.rows, discount)[ctx.index];
          });

          expect([...viaItem, ...viaAsset]).toEqual(combined);
        },
      ),
      { numRuns: 200 },
    );
  });
});
