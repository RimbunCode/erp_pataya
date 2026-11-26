import { describe, expect, it } from "vitest";

import {
  MAX_PRIORITY,
  clearedItemConditions,
  conditionKey,
  emptyRow,
  hasItemCondition,
  rowFromRule,
  toPayload,
  validateRows,
} from "./ruleEditor";

const roles = [
  { value: "revenue", line_sensitive: true },
  { value: "receivable", line_sensitive: false },
  { value: "discount", line_sensitive: false },
];

const account = { id: "a1", thisModel: "App\\Models\\Finances\\Account" };

const row = (overrides = {}) => ({
  ...emptyRow(),
  role: "revenue",
  account,
  ...overrides,
});

describe("ruleEditor", () => {
  describe("rowFromRule / toPayload", () => {
    it("membawa id kategori mentah walau objek kategori tidak ada, dan mengirim hanya id", () => {
      const built = rowFromRule({
        id: "r1",
        role: "revenue",
        document_type: "sales_invoice",
        variant: "return",
        item_type: "inventory",
        is_stock_item: false,
        item_category_id: "cat-1",
        category: null,
        account,
        priority: 3,
      });

      expect(built.item_category_id).toBe("cat-1");
      expect(toPayload(built)).toEqual({
        role: "revenue",
        document_type: "sales_invoice",
        variant: "return",
        item_type: "inventory",
        is_stock_item: false,
        item_category_id: "cat-1",
        account_id: "a1",
        priority: 3,
      });
    });

    it("memberi kunci baris unik yang tidak bergantung pada id server", () => {
      const first = rowFromRule({ id: "same", role: "revenue" });
      const second = rowFromRule({ id: "same", role: "revenue" });

      expect(first.key).not.toBe(second.key);
    });

    it("kondisi kosong dikirim null dan prioritas kosong menjadi 0", () => {
      expect(
        toPayload({ ...emptyRow(), role: "revenue", priority: "" }),
      ).toEqual({
        role: "revenue",
        document_type: null,
        variant: null,
        item_type: null,
        is_stock_item: null,
        item_category_id: null,
        account_id: "",
        priority: 0,
      });
    });
  });

  describe("conditionKey", () => {
    it("menganggap kosong dan null sama, tetapi false pada barang stok berbeda dari null", () => {
      expect(conditionKey(row({ variant: "" }))).toBe(
        conditionKey(row({ variant: null })),
      );
      expect(conditionKey(row({ is_stock_item: false }))).not.toBe(
        conditionKey(row({ is_stock_item: null })),
      );
    });

    it("tidak memasukkan prioritas dan akun, tetapi memasukkan peran dan semua kondisi", () => {
      const base = row();

      expect(conditionKey({ ...base, priority: "9", account: null })).toBe(
        conditionKey(base),
      );
      expect(conditionKey(row({ role: "discount" }))).not.toBe(
        conditionKey(base),
      );
      for (const patch of [
        { document_type: "sales_invoice" },
        { variant: "return" },
        { item_type: "service" },
        { item_category_id: "c" },
      ]) {
        expect(conditionKey(row(patch))).not.toBe(conditionKey(base));
      }
    });
  });

  describe("hasItemCondition / clearedItemConditions", () => {
    it("mendeteksi kondisi barang (false pada barang stok juga kondisi) dan menguranginya", () => {
      expect(hasItemCondition(row())).toBe(false);
      expect(hasItemCondition(row({ is_stock_item: false }))).toBe(true);
      expect(hasItemCondition(row({ item_type: "inventory" }))).toBe(true);
      expect(hasItemCondition(row({ item_category_id: "c" }))).toBe(true);
      expect(hasItemCondition(row({ ...clearedItemConditions() }))).toBe(false);
    });
  });

  describe("validateRows", () => {
    it("baris valid tanpa galat", () => {
      expect(validateRows([row()], roles)).toEqual({});
    });

    it("peran dan akun wajib", () => {
      const noRole = row({ role: "" });
      const noAccount = row({ account: null });
      const errors = validateRows([noRole, noAccount], roles);

      expect(errors[noRole.key].map((e) => e.message)).toContain(
        "role_required",
      );
      expect(errors[noAccount.key].map((e) => e.message)).toEqual([
        "account_required",
      ]);
    });

    it("prioritas harus bilangan bulat tak negatif dan tidak melebihi batas", () => {
      const bad = ["-1", "1.5", "abc", ""].map((priority, index) =>
        row({ priority, document_type: `type_${index}` }),
      );
      const tooLarge = row({ priority: String(MAX_PRIORITY + 1) });
      const max = row({ priority: String(MAX_PRIORITY), role: "receivable" });
      const errors = validateRows([...bad, tooLarge, max], roles);

      for (const item of bad) {
        expect(errors[item.key].map((e) => e.message)).toEqual([
          "priority_invalid",
        ]);
      }
      expect(errors[tooLarge.key].map((e) => e.message)).toEqual([
        "priority_too_large",
      ]);
      expect(errors[max.key]).toBeUndefined();
    });

    it("menolak kondisi barang pada peran non peka-barang", () => {
      const bad = row({ role: "discount", item_type: "inventory" });
      const errors = validateRows([bad], roles);

      expect(errors[bad.key]).toEqual([
        { field: "role", message: "item_condition_role" },
      ]);
    });

    it("melaporkan kombinasi kembar pada kemunculan kedua, bukan yang pertama", () => {
      const first = row({ document_type: "sales_invoice", priority: "1" });
      const second = row({ document_type: "sales_invoice", priority: "9" });
      const other = row({ document_type: "purchase_invoice" });
      const errors = validateRows([first, second, other], roles);

      expect(errors[first.key]).toBeUndefined();
      expect(errors[second.key]).toEqual([
        { field: "role", message: "duplicate" },
      ]);
      expect(errors[other.key]).toBeUndefined();
    });

    it("peran sama dengan kondisi berbeda atau peran berbeda dengan kondisi sama tidak kembar", () => {
      const rows = [
        row({ variant: "return" }),
        row({ variant: null }),
        row({ role: "receivable", variant: "return" }),
      ];

      expect(validateRows(rows, roles)).toEqual({});
    });
  });
});
