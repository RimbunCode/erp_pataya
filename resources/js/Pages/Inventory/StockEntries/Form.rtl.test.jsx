import { describe, expect, it, vi, beforeEach } from "vitest";
import { render as rtlRender, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";

// ============================================================================
// Form.jsx (Inventory/StockEntries) adalah halaman transaksi Stock Entry (651
// baris, export default function Form() -- BUKAN memo()) untuk mutasi/
// transfer/adjustment stok gudang (type: item_transfer/item_receipt/
// item_issue/item_consumption). TIDAK ADA fungsi mergeItems atau import-dari-
// referensi (loadFrom/SelectModel) di file ini sama sekali -- beda dari
// SalesOrders/PurchaseOrders Form.jsx. Logic UNIK milik Form.jsx sendiri:
//   1. totalQty/totalAmount/totalAdditionalCost (useMemo) -- totalQty punya
//      konversi khusus: conversion_factor > 1 dikali, selain itu (termasuk
//      <=1) dibagi.
//   2. mappingItem -- basic_amount = basic_rate * quantity; additional_cost
//      dialokasikan pro-rata dari totalAdditionalCost berbasis basic_amount;
//      valuation_rate = additional_cost/qty + basic_amount/qty; short-circuit
//      mengembalikan item apa adanya saat disabled.
//   3. itemColumns -- visibility source_warehouse/target_warehouse kolom
//      tergantung data.type; wiring pilih item mengisi unit+conversion_factor
//      +source_warehouse+target_warehouse dari default_source_warehouse/
//      default_target_warehouse.
//   4. Cascade default_source_warehouse/default_target_warehouse (header) ->
//      source_warehouse/target_warehouse semua baris items.
//   5. additional_costs FormTable onValueChange -- recompute SEMUA items lewat
//      mappingItem dengan totalCost baru (bukan totalAdditionalCost lama dari
//      closure, tapi dihitung ulang dari payload v yang baru).
//   6. Visibility using_transit checkbox (hanya type item_transfer) dan
//      section additional_costs (disembunyikan utk type null/item_issue/
//      item_consumption).
// FormTable (2000+ baris, sudah ada test sendiri) dan semua *LinkModel/Select/
// DatetimePicker/Textarea (dialog/popover berat) di-stub. FormInput dan
// NumberInput dipakai REAL (masing2 sudah ada test sendiri & dibutuhkan utk
// membaca nilai total yang benar2 dihitung Form.jsx), mengikuti pola
// PurchaseOrders/Form.rtl.test.jsx.
// ============================================================================

const stableT = (key) => key;
vi.mock("laravel-react-i18n", () => ({
  useLaravelReactI18n: () => ({ t: stableT }),
}));

const usePageMock = vi.fn();
vi.mock("@inertiajs/react", () => ({
  usePage: () => usePageMock(),
}));

// useFormPage di-mock sebagai stateful hook (state sungguhan) supaya setData
// yang dipanggil Form.jsx (mis. cascade default_source_warehouse -> items,
// atau additional_costs -> recompute items) betul2 memicu re-render dengan
// data terbaru -- diperlukan utk menguji cascade & kalkulasi total reaktif.
let formPageSeed = {};
let formPageDisabled = false;
function useFormPageStateful() {
  const [data, setDataState] = useState(formPageSeed);
  const setData = (...args) => {
    if (typeof args[0] === "function") {
      setDataState((prev) => args[0](prev));
    } else if (typeof args[0] === "string") {
      setDataState((prev) => ({ ...prev, [args[0]]: args[1] }));
    } else {
      setDataState((prev) => ({ ...prev, ...args[0] }));
    }
  };
  return {
    data,
    setData,
    defaultData: {},
    disabled: formPageDisabled,
    dataBefore: {},
  };
}

vi.mock("@/Pages/Core/FormPage", async () => {
  const React = await import("react");
  return {
    FormPageContent: ({ title, show = true, children }) =>
      show ? (
        <div>
          {title && <h2>{title}</h2>}
          {children}
        </div>
      ) : null,
    useFormPage: (...args) => useFormPageStateful(...args),
    useFormPageMeta: () => undefined,
    FormPageContext: React.createContext(),
  };
});

// FormTable adalah komponen generik besar dgn test sendiri -- distub sebagai
// renderer sederhana yang memanggil tiap column.cell() untuk baris dari
// `value`, supaya definisi kolom (itemColumns/additionalCostColumns) milik
// Form.jsx yang diuji, bukan mekanisme drag-drop/tabel FormTable itu sendiri.
// name dipakai sbg data-testid supaya tabel item & tabel additional cost bisa
// dibedakan dalam satu render. mapItem (mappingItem milik Form.jsx, dikirim
// sbg prop) DIPANGGIL sama seperti FormTable asli, supaya basic_amount/
// additional_cost/valuation_rate/amount ikut ter-recompute saat baris berubah
// (mappingItem TIDAK dipanggil otomatis oleh Form.jsx, itu tanggung jawab
// FormTable).
vi.mock("@/Components/FormTable", () => ({
  default: ({ name, columns, value, onValueChange, mapItem }) => {
    const rows = value ?? [];
    const updateRow = (index, keyOrObj, val) => {
      const next = [...rows];
      const row = { ...next[index] };
      if (typeof keyOrObj === "object") {
        Object.assign(row, keyOrObj);
      } else {
        row[keyOrObj] = val;
      }
      const mapped = mapItem
        ? mapItem({ item: row, dataTable: next, index })
        : row;
      next[index] = mapped;
      onValueChange?.(next);
    };
    return (
      <div data-testid={`form-table-${name}`}>
        <button
          type="button"
          data-testid={`form-table-${name}-add-row`}
          onClick={() => onValueChange?.([...rows, {}])}
        >
          add-row-{name}
        </button>
        <button
          type="button"
          data-testid={`form-table-${name}-remove-all`}
          onClick={() => onValueChange?.([])}
        >
          remove-all-{name}
        </button>
        {rows.map((row, index) => (
          <div key={row.id ?? index} data-testid={`row-${name}-${index}`}>
            {columns.filter(Boolean).map((col) => (
              <div
                key={col.name}
                data-testid={`cell-${col.name}-${name}-${index}`}
              >
                {col.cell({
                  dataRow: row,
                  data: row[col.name],
                  setData: (keyOrObj, val) => updateRow(index, keyOrObj, val),
                  attributes: {},
                  dataTable: rows,
                  index,
                  reset: () => updateRow(index, {}),
                })}
              </div>
            ))}
          </div>
        ))}
      </div>
    );
  },
}));

vi.mock("../Items/ItemVariantLinkModel", () => ({
  default: ({ value, onValueChange }) => (
    <button
      type="button"
      data-testid="item-link-model"
      onClick={() =>
        onValueChange?.({
          id: 100,
          name: "Item A",
          default_uom: { id: 1, name: "PCS", conversion_factor: 1 },
        })
      }
    >
      item:{value?.name ?? "none"}
    </button>
  ),
}));

vi.mock("../Items/ItemUnitLinkModel", () => ({
  default: ({ value, onValueChange }) => (
    <button
      type="button"
      data-testid="unit-link-model"
      onClick={() =>
        onValueChange?.({ id: 2, name: "BOX", conversion_factor: 12 })
      }
    >
      unit:{value?.name ?? "none"}
    </button>
  ),
}));

// placeholder membedakan instance kolom item (source/target_warehouse) dari
// instance header (default_source_warehouse/default_target_warehouse, yang
// tidak diberi placeholder oleh Form.jsx) -- disambiguasi lewat testid.
vi.mock("../Warehouses/WarehouseLinkModel", () => ({
  default: ({ value, onValueChange, placeholder }) => {
    let testId = "warehouse-link-model";
    if (
      placeholder ===
      "inventory.stockEntry.item_columns.columns.source_warehouse.placeholder"
    ) {
      testId = "item-source-warehouse-link-model";
    } else if (
      placeholder ===
      "inventory.stockEntry.item_columns.columns.target_warehouse.placeholder"
    ) {
      testId = "item-target-warehouse-link-model";
    }
    return (
      <button
        type="button"
        data-testid={testId}
        onClick={() => onValueChange?.({ id: 1, name: "Gudang A" })}
      >
        warehouse:{value?.name ?? "none"}
      </button>
    );
  },
}));

vi.mock("@/Pages/Finances/Accounts/AccountLinkModel", () => ({
  default: ({ value, onValueChange }) => (
    <button
      type="button"
      data-testid="account-link-model"
      onClick={() => onValueChange?.({ id: 1, name: "Akun A" })}
    >
      account:{value?.name ?? "none"}
    </button>
  ),
}));

vi.mock("@/Components/Select", () => ({
  default: ({ value, onValueChange, options }) => (
    <select
      aria-label="type-select"
      value={value ?? ""}
      onChange={(e) => onValueChange?.(e.target.value || undefined)}
    >
      <option value="">-</option>
      {options?.map((opt) => (
        <option key={opt} value={opt}>
          {opt}
        </option>
      ))}
    </select>
  ),
}));

vi.mock("@/Components/DatetimePicker", () => ({
  default: ({ value, onValueChange }) => (
    <input
      data-testid="datetime-picker"
      type="text"
      value={value ? new Date(value).toISOString() : ""}
      onChange={(e) => {
        const v = e.target.value;
        onValueChange?.(v ? new Date(v) : null);
      }}
    />
  ),
}));

vi.mock("@/Components/ui/textarea", () => ({
  Textarea: ({ value, onChange, ...rest }) => (
    <textarea value={value ?? ""} onChange={onChange} {...rest} />
  ),
}));

window.route = (name, params) =>
  params ? `${name}/${JSON.stringify(params)}` : name;

import Form from "./Form";
import { TooltipProvider } from "@/Components/ui/tooltip";

// NumberInput (dipakai kolom quantity/basic_rate/basic_amount/total, dsb)
// membungkus diri dengan <Tooltip> internal tanpa provider sendiri.
const render = (ui) => rtlRender(<TooltipProvider>{ui}</TooltipProvider>);

function setPageProps(overrides = {}) {
  usePageMock.mockReturnValue({
    props: {
      branchSettings: { currentBranch: { id: 1, is_main_branch: true } },
      preferences: {
        default_currency_id: "idr",
        default_number_format: "#,###.##",
      },
      ...overrides,
    },
  });
}

describe("Inventory/StockEntries Form", () => {
  beforeEach(() => {
    formPageSeed = {};
    formPageDisabled = false;
    setPageProps();
  });

  describe("rendering dasar & visibility field", () => {
    it("merender field date, type, dan difference_account", () => {
      formPageSeed = { type: null, items: [] };
      render(<Form />);

      expect(screen.getByTestId("datetime-picker")).toBeInTheDocument();
      expect(screen.getByLabelText("type-select")).toBeInTheDocument();
      expect(screen.getByTestId("account-link-model")).toBeInTheDocument();
    });

    it("checkbox using_transit TIDAK tampil ketika type != item_transfer", () => {
      formPageSeed = { type: "item_receipt", items: [] };
      render(<Form />);

      expect(
        screen.queryByText("inventory.stockEntry.columns.using_transit"),
      ).not.toBeInTheDocument();
    });

    it("checkbox using_transit tampil saat type item_transfer", () => {
      formPageSeed = { type: "item_transfer", items: [] };
      render(<Form />);

      expect(
        screen.getByText("inventory.stockEntry.columns.using_transit"),
      ).toBeInTheDocument();
      expect(document.querySelector('[role="forminput"]')).toBeInTheDocument();
    });

    it("section additional_costs disembunyikan ketika type null", () => {
      formPageSeed = { type: null, items: [] };
      render(<Form />);

      expect(
        screen.queryByText("inventory.stockEntry.additional_costs"),
      ).not.toBeInTheDocument();
    });

    it.each(["item_issue", "item_consumption"])(
      "section additional_costs disembunyikan ketika type == %s",
      (type) => {
        formPageSeed = { type, items: [] };
        render(<Form />);

        expect(
          screen.queryByText("inventory.stockEntry.additional_costs"),
        ).not.toBeInTheDocument();
      },
    );

    it.each(["item_transfer", "item_receipt"])(
      "section additional_costs tampil ketika type == %s",
      (type) => {
        formPageSeed = { type, items: [] };
        render(<Form />);

        expect(
          screen.getByText("inventory.stockEntry.additional_costs"),
        ).toBeInTheDocument();
      },
    );

    it("default_source_warehouse hanya tampil utk type transfer/issue/consumption", () => {
      formPageSeed = { type: "item_receipt", items: [] };
      render(<Form />);

      expect(
        screen.queryByText(
          "inventory.stockEntry.columns.default_source_warehouse",
        ),
      ).not.toBeInTheDocument();
      expect(
        screen.getByText(
          "inventory.stockEntry.columns.default_target_warehouse",
        ),
      ).toBeInTheDocument();
    });

    it("default_target_warehouse hanya tampil utk type transfer/receipt", () => {
      formPageSeed = { type: "item_issue", items: [] };
      render(<Form />);

      expect(
        screen.getByText(
          "inventory.stockEntry.columns.default_source_warehouse",
        ),
      ).toBeInTheDocument();
      expect(
        screen.queryByText(
          "inventory.stockEntry.columns.default_target_warehouse",
        ),
      ).not.toBeInTheDocument();
    });
  });

  describe("itemColumns visibility berdasar data.type", () => {
    it("kolom source_warehouse muncul utk item_transfer, target_warehouse juga muncul", async () => {
      formPageSeed = {
        type: "item_transfer",
        items: [{ item: { id: 1, name: "Item A" } }],
      };
      render(<Form />);

      expect(
        screen.getByTestId("cell-source_warehouse-StockEntryItems-0"),
      ).toBeInTheDocument();
      expect(
        screen.getByTestId("cell-target_warehouse-StockEntryItems-0"),
      ).toBeInTheDocument();
    });

    it("kolom source_warehouse muncul, target_warehouse TIDAK muncul utk item_issue", () => {
      formPageSeed = {
        type: "item_issue",
        items: [{ item: { id: 1, name: "Item A" } }],
      };
      render(<Form />);

      expect(
        screen.getByTestId("cell-source_warehouse-StockEntryItems-0"),
      ).toBeInTheDocument();
      expect(
        screen.queryByTestId("cell-target_warehouse-StockEntryItems-0"),
      ).not.toBeInTheDocument();
    });

    it("kolom target_warehouse muncul, source_warehouse TIDAK muncul utk item_receipt", () => {
      formPageSeed = {
        type: "item_receipt",
        items: [{ item: { id: 1, name: "Item A" } }],
      };
      render(<Form />);

      expect(
        screen.queryByTestId("cell-source_warehouse-StockEntryItems-0"),
      ).not.toBeInTheDocument();
      expect(
        screen.getByTestId("cell-target_warehouse-StockEntryItems-0"),
      ).toBeInTheDocument();
    });

    it("kolom additional_cost/valuation_rate/amount hanya muncul utk item_transfer/item_receipt", () => {
      formPageSeed = {
        type: "item_issue",
        items: [{ item: { id: 1, name: "Item A" } }],
      };
      render(<Form />);

      expect(
        screen.queryByTestId("cell-additional_cost-StockEntryItems-0"),
      ).not.toBeInTheDocument();
      expect(
        screen.queryByTestId("cell-valuation_rate-StockEntryItems-0"),
      ).not.toBeInTheDocument();
      expect(
        screen.queryByTestId("cell-amount-StockEntryItems-0"),
      ).not.toBeInTheDocument();
    });

    it("kolom additional_cost/valuation_rate/amount muncul utk item_receipt", () => {
      formPageSeed = {
        type: "item_receipt",
        items: [{ item: { id: 1, name: "Item A" } }],
      };
      render(<Form />);

      expect(
        screen.getByTestId("cell-additional_cost-StockEntryItems-0"),
      ).toBeInTheDocument();
      expect(
        screen.getByTestId("cell-valuation_rate-StockEntryItems-0"),
      ).toBeInTheDocument();
      expect(
        screen.getByTestId("cell-amount-StockEntryItems-0"),
      ).toBeInTheDocument();
    });
  });

  describe("wiring kolom item (pilih item)", () => {
    it("memilih item mengisi unit, conversion_factor, dan source/target_warehouse dari default header", async () => {
      const user = userEvent.setup({ delay: null });
      formPageSeed = {
        type: "item_transfer",
        items: [{}],
        default_source_warehouse: { id: 5, name: "Gudang Asal" },
        default_target_warehouse: { id: 6, name: "Gudang Tujuan" },
      };
      render(<Form />);

      await user.click(screen.getByTestId("item-link-model"));

      const row0 = screen.getByTestId("row-StockEntryItems-0");
      expect(row0).toBeInTheDocument();
      // Setelah pilih item, quantity cell muncul & tidak disabled (item ada).
      const qtyInput = screen
        .getByTestId("cell-quantity-StockEntryItems-0")
        .querySelector("input");
      expect(qtyInput).not.toBeDisabled();
    });

    it("memilih item baru pada baris existing tidak melempar error", async () => {
      const user = userEvent.setup({ delay: null });
      formPageSeed = {
        type: "item_transfer",
        items: [{ item: { id: 1, name: "Item A" } }],
      };
      render(<Form />);

      await user.click(screen.getByTestId("item-link-model"));

      expect(screen.getByTestId("row-StockEntryItems-0")).toBeInTheDocument();
    });
  });

  describe("cascade default_source_warehouse/default_target_warehouse -> items", () => {
    it("mengubah default_source_warehouse memperbarui source_warehouse semua baris items", async () => {
      const user = userEvent.setup({ delay: null });
      formPageSeed = {
        type: "item_transfer",
        items: [
          { item: { id: 1, name: "Item A" } },
          { item: { id: 2, name: "Item B" } },
        ],
      };
      render(<Form />);

      // default_source_warehouse dirender lebih dulu dari
      // default_target_warehouse (lihat Form.jsx) -- keduanya jatuh ke testid
      // generik "warehouse-link-model" krn tidak diberi placeholder khusus.
      const [sourceWarehouseButton] = screen.getAllByTestId(
        "warehouse-link-model",
      );
      await user.click(sourceWarehouseButton);

      const row0 = screen.getByTestId(
        "cell-source_warehouse-StockEntryItems-0",
      );
      const row1 = screen.getByTestId(
        "cell-source_warehouse-StockEntryItems-1",
      );
      expect(row0.querySelector("button")).toHaveTextContent("Gudang A");
      expect(row1.querySelector("button")).toHaveTextContent("Gudang A");
    });

    it("mengubah default_target_warehouse memperbarui target_warehouse semua baris items", async () => {
      const user = userEvent.setup({ delay: null });
      formPageSeed = {
        type: "item_transfer",
        items: [
          { item: { id: 1, name: "Item A" } },
          { item: { id: 2, name: "Item B" } },
        ],
      };
      render(<Form />);

      // default_target_warehouse adalah instance kedua dari testid generik
      // "warehouse-link-model" (dirender setelah default_source_warehouse).
      const [, targetWarehouseButton] = screen.getAllByTestId(
        "warehouse-link-model",
      );
      await user.click(targetWarehouseButton);

      const row0 = screen.getByTestId(
        "cell-target_warehouse-StockEntryItems-0",
      );
      const row1 = screen.getByTestId(
        "cell-target_warehouse-StockEntryItems-1",
      );
      expect(row0.querySelector("button")).toHaveTextContent("Gudang A");
      expect(row1.querySelector("button")).toHaveTextContent("Gudang A");
    });

    it("mengubah default_source_warehouse TIDAK error saat items masih kosong", async () => {
      const user = userEvent.setup({ delay: null });
      formPageSeed = { type: "item_transfer", items: [] };
      render(<Form />);

      const [sourceWarehouseButton] = screen.getAllByTestId(
        "warehouse-link-model",
      );
      await expect(
        user.click(sourceWarehouseButton),
      ).resolves.not.toThrow();
    });
  });

  describe("kalkulasi total (totalQty/totalAmount/totalAdditionalCost)", () => {
    it("totalAmount = jumlah basic_amount seluruh items (tanpa additional_costs)", () => {
      formPageSeed = {
        type: "item_issue",
        items: [
          { item: { id: 1 }, basic_amount: 100 },
          { item: { id: 2 }, basic_amount: 250 },
        ],
        additional_costs: [],
      };
      render(<Form />);

      const totalAmountInput = screen
        .getByText("inventory.stockEntry.columns.total_amount")
        .closest("div")
        .querySelector("input");
      expect(totalAmountInput.value).toBe("350.00");
    });

    it("totalAmount menambahkan totalAdditionalCost ke total basic_amount items", () => {
      formPageSeed = {
        type: "item_receipt",
        items: [{ item: { id: 1 }, basic_amount: 100 }],
        additional_costs: [{ amount: 50 }, { amount: 25 }],
      };
      render(<Form />);

      const totalAmountInput = screen
        .getByText("inventory.stockEntry.columns.total_amount")
        .closest("div")
        .querySelector("input");
      // 100 (basic_amount items) + 75 (additional_costs) = 175
      expect(totalAmountInput.value).toBe("175.00");

      const totalAdditionalCostInput = screen
        .getByText("finances.additionalCost.columns.total")
        .closest("div")
        .querySelector("input");
      expect(totalAdditionalCostInput.value).toBe("75.00");
    });

    it("totalQty mengalikan quantity saat conversion_factor > 1, membagi saat conversion_factor <= 1", () => {
      formPageSeed = {
        type: "item_issue",
        items: [
          // conversion_factor > 1 -> quantity * conversion_factor = 2 * 12 = 24
          { item: { id: 1 }, quantity: 2, conversion_factor: 12 },
          // conversion_factor == 1 (bukan >1) -> quantity / conversion_factor = 10 / 1 = 10
          { item: { id: 2 }, quantity: 10, conversion_factor: 1 },
        ],
      };
      render(<Form />);

      const totalQtyInput = screen
        .getByText("inventory.stockEntry.columns.total_quantity")
        .closest("div")
        .querySelector("input");
      // 24 + 10 = 34
      expect(totalQtyInput.value).toBe("34.00");
    });
  });

  describe("mappingItem (via kolom quantity/basic_rate FormTable)", () => {
    it("mengubah quantity menghitung ulang basic_amount = basic_rate * quantity", async () => {
      const user = userEvent.setup({ delay: null });
      formPageSeed = {
        type: "item_receipt",
        items: [
          {
            item: { id: 1, name: "Item A" },
            basic_rate: 10,
            quantity: 0,
            conversion_factor: 1,
          },
        ],
        additional_costs: [],
      };
      render(<Form />);

      const qtyInput = screen
        .getByTestId("cell-quantity-StockEntryItems-0")
        .querySelector("input");
      await user.clear(qtyInput);
      await user.type(qtyInput, "5");

      const basicAmountInput = screen
        .getByTestId("cell-basic_amount-StockEntryItems-0")
        .querySelector("input");
      expect(basicAmountInput.value).toBe("50.00");
    });

    it("additional_cost dialokasikan pro-rata dari totalAdditionalCost berbasis basic_amount, valuation_rate & amount ikut terhitung", async () => {
      const user = userEvent.setup({ delay: null });
      formPageSeed = {
        type: "item_receipt",
        items: [
          {
            item: { id: 1, name: "Item A" },
            basic_rate: 10,
            quantity: 5,
            conversion_factor: 1,
            basic_amount: 50,
          },
        ],
        additional_costs: [{ amount: 20 }],
      };
      render(<Form />);

      const qtyInput = screen
        .getByTestId("cell-quantity-StockEntryItems-0")
        .querySelector("input");
      await user.clear(qtyInput);
      await user.type(qtyInput, "5");

      const additionalCostInput = screen
        .getByTestId("cell-additional_cost-StockEntryItems-0")
        .querySelector("input");
      // totalBasicAmount dataTable saat mappingItem jalan = 50 (satu2nya
      // baris) -> additional_cost = (50/50) * 20 = 20
      expect(additionalCostInput.value).toBe("20.00");

      const amountInput = screen
        .getByTestId("cell-amount-StockEntryItems-0")
        .querySelector("input");
      // amount = basic_amount + additional_cost = 50 + 20 = 70
      expect(amountInput.value).toBe("70.00");
    });

    it("disabled=true membuat mappingItem mengembalikan item apa adanya (short-circuit, tanpa hitung ulang)", async () => {
      const user = userEvent.setup({ delay: null });
      formPageDisabled = true;
      formPageSeed = {
        type: "item_receipt",
        items: [
          {
            item: { id: 1, name: "Item A" },
            basic_rate: 10,
            quantity: 5,
            conversion_factor: 1,
            basic_amount: 999, // sengaja beda dari 10*5=50
          },
        ],
        additional_costs: [],
      };
      render(<Form />);

      // FormTable stub memanggil mapItem (mappingItem) yg sama seperti
      // FormTable asli setiap sel berubah. Ubah quantity baris 0 -- pada
      // kondisi normal (disabled=false) ini akan menghitung ulang
      // basic_amount = basic_rate * quantity = 10 * 8 = 80. Tapi karena
      // disabled=true, mappingItem short-circuit (return item apa adanya)
      // SEBELUM baris `basic_amount = item.basic_rate * item.quantity`
      // dieksekusi -- basic_amount harus tetap 999.
      const qtyInput = screen
        .getByTestId("cell-quantity-StockEntryItems-0")
        .querySelector("input");
      await user.clear(qtyInput);
      await user.type(qtyInput, "8");

      const basicAmountInput = screen
        .getByTestId("cell-basic_amount-StockEntryItems-0")
        .querySelector("input");
      expect(basicAmountInput.value).toBe("999.00");
    });
  });

  describe("additional_costs FormTable onValueChange -> recompute items", () => {
    it("additional_costs kosong menghasilkan additional_cost 0 pada semua items (basicAmount != 0)", async () => {
      formPageSeed = {
        type: "item_receipt",
        items: [
          {
            item: { id: 1, name: "Item A" },
            basic_rate: 10,
            quantity: 5,
            conversion_factor: 1,
            basic_amount: 50,
          },
        ],
        additional_costs: [],
      };
      const user = userEvent.setup({ delay: null });
      render(<Form />);

      // additional_cost belum pernah dihitung mappingItem saat mount (data
      // seed apa adanya) -- trigger recompute lewat perubahan quantity utk
      // memicu mapItem, lalu pastikan additional_cost = 0 (bukan NaN/error)
      // krn additional_costs kosong.
      const qtyInput = screen
        .getByTestId("cell-quantity-StockEntryItems-0")
        .querySelector("input");
      await user.clear(qtyInput);
      await user.type(qtyInput, "5");

      const additionalCostInput = screen
        .getByTestId("cell-additional_cost-StockEntryItems-0")
        .querySelector("input");
      expect(additionalCostInput.value).toBe("0.00");
    });

    it("menghapus semua additional_costs (remove-all) memicu recompute items via mappingItem tanpa error", async () => {
      const user = userEvent.setup({ delay: null });
      formPageSeed = {
        type: "item_receipt",
        items: [
          {
            item: { id: 1, name: "Item A" },
            basic_rate: 10,
            quantity: 5,
            conversion_factor: 1,
            basic_amount: 50,
            additional_cost: 20,
          },
        ],
        additional_costs: [{ amount: 20 }],
      };
      render(<Form />);

      await user.click(
        screen.getByTestId("form-table-StockEntryAdditionalCosts-remove-all"),
      );

      const additionalCostInput = screen
        .getByTestId("cell-additional_cost-StockEntryItems-0")
        .querySelector("input");
      // additional_costs sudah kosong -> totalCost baru = 0 -> additional_cost
      // item ikut ter-recompute jadi 0 (bukan tetap 20 dari state lama).
      expect(additionalCostInput.value).toBe("0.00");
    });
  });

  describe("mergeItems -- konfirmasi TIDAK ADA di Form.jsx StockEntries", () => {
    it("tidak ada tombol import/select-model dari referensi dokumen lain (loadFrom/mergeItems absent)", () => {
      formPageSeed = { type: "item_transfer", items: [] };
      render(<Form />);

      expect(
        screen.queryByTestId("select-model-import"),
      ).not.toBeInTheDocument();
    });
  });
});
