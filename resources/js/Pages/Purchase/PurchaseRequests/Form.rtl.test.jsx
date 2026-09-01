import { describe, expect, it, vi, beforeEach } from "vitest";
import { render as rtlRender, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";

// ============================================================================
// Form.jsx (PurchaseRequests) adalah halaman transaksi (357 baris) untuk
// dokumen Purchase Request (permintaan pembelian, biasanya jadi asal Purchase
// Order). Struktur & pola sangat mirip Purchase/PurchaseOrders/Form.jsx
// (lihat komentar panjang di file itu), tapi jauh lebih sederhana -- tidak
// ada kalkulasi total/diskon/pajak/mata uang sama sekali. Sesuai arahan
// task, SEMUA child yang sudah punya test sendiri di-stub (FormPage/
// FormPageContent/useFormPage, FormTable generik, ItemForm, semua
// *LinkModel, ItemBarcode, DatetimePicker, NumberInput, SelectModel), fokus
// HANYA ke logic UNIK milik Form.jsx sendiri:
//   1. mergeItems (import dari WorkOrder via SelectModel) -- dedupe by
//      referenceable_type+id, dan BUG produksi terkonfirmasi di sini (lihat
//      komentar detail di describe blok mergeItems di bawah).
//   2. handleBarcodeSelect (scan barcode) -- increment qty baris existing
//      atau tambah baris baru.
//   3. Cascade required_date header -> seluruh items.
//   4. Wiring kolom item (itemColumns) -- pilih item mengisi unit +
//      conversion_factor + required_date sekaligus dari header.
// ============================================================================

const stableT = (key) => key;
vi.mock("laravel-react-i18n", () => ({
  useLaravelReactI18n: () => ({ t: stableT }),
}));

// useFormPage di-mock sebagai stateful hook (identik dgn pola
// PurchaseOrders/Form.rtl.test.jsx) supaya setData yang dipanggil Form.jsx
// benar2 memicu re-render dengan data terbaru -- diperlukan utk menguji
// cascade required_date -> items dan mergeItems/handleBarcodeSelect yang
// membaca/menulis prev state via functional setData.
let formPageSeed = {};
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
    disabled: false,
    dataBefore: {},
  };
}

vi.mock("@/Pages/Core/FormPage", async () => {
  const React = await import("react");
  return {
    FormPageContent: ({ title, actions, children }) => (
      <div>
        {title && <h2>{title}</h2>}
        {actions}
        {children}
      </div>
    ),
    useFormPage: (...args) => useFormPageStateful(...args),
    useFormPageMeta: () => undefined,
    FormPageContext: React.createContext(),
  };
});

// FormTable adalah komponen generik besar dengan test sendiri (FormTable.
// test.js) -- distub sebagai renderer sederhana yang memanggil tiap
// column.cell() untuk baris dari `value`, supaya definisi kolom
// (itemColumns) milik Form.jsx yang diuji, bukan mekanisme drag-drop/tabel
// FormTable itu sendiri. Pola identik dgn PurchaseOrders/Form.rtl.test.jsx.
vi.mock("@/Components/FormTable", () => ({
  default: ({ columns, value, onValueChange }) => {
    const rows = value ?? [];
    const updateRow = (index, keyOrObj, val) => {
      const next = [...rows];
      const row = { ...next[index] };
      if (typeof keyOrObj === "object") {
        Object.assign(row, keyOrObj);
      } else {
        row[keyOrObj] = val;
      }
      next[index] = row;
      onValueChange?.(next);
    };
    return (
      <div data-testid="stub-form-table">
        {rows.map((row, index) => (
          <div key={row.id ?? index} data-testid={`row-${index}`}>
            {columns.map((col) => (
              <div key={col.name} data-testid={`cell-${col.name}-${index}`}>
                {col.cell({
                  dataRow: row,
                  data: row[col.name],
                  setData: (keyOrObj, val) => updateRow(index, keyOrObj, val),
                  attributes: {},
                })}
              </div>
            ))}
          </div>
        ))}
      </div>
    );
  },
}));

vi.mock("./ItemForm", () => ({
  default: () => <div data-testid="stub-item-form" />,
}));

// Semua *LinkModel (dialog combobox berat via Components/LinkModel.jsx) dan
// ItemBarcode/DatetimePicker/NumberInput/SelectModel distub jadi tombol
// sederhana yang memanggil onValueChange/onSelect/onSelected dengan payload
// tetap -- cukup untuk menguji bahwa Form.jsx meneruskan value & memproses
// callback dengan benar (semua ini sudah punya test sendiri).
vi.mock("@/Pages/Inventory/Items/ItemVariantLinkModel", () => ({
  default: ({ value, onValueChange, filters }) => (
    <button
      type="button"
      data-testid="item-link-model"
      onClick={() =>
        onValueChange?.({
          id: 100,
          item_id: 50,
          name: "Item A",
          default_uom: { id: 1, name: "PCS", conversion_factor: 1 },
        })
      }
    >
      item:{value?.name ?? "none"}
      {filters?.is_stock_item ? ":stock" : ""}
    </button>
  ),
}));

vi.mock("@/Pages/Inventory/Items/ItemUnitLinkModel", () => ({
  default: ({ value, onValueChange, disabled }) => (
    <button
      type="button"
      data-testid="unit-link-model"
      disabled={disabled}
      onClick={() =>
        onValueChange?.({ id: 2, name: "BOX", conversion_factor: 12 })
      }
    >
      unit:{value?.name ?? "none"}
    </button>
  ),
}));

vi.mock("@/Pages/Inventory/Items/ItemBarcode", () => ({
  default: ({ onSelect }) => (
    <button
      type="button"
      data-testid="item-barcode"
      onClick={() =>
        onSelect?.({
          item: { id: 100, name: "Item A" },
          unit: { id: 1, name: "PCS" },
        })
      }
    >
      scan-barcode
    </button>
  ),
}));

vi.mock("@/Components/DatetimePicker", () => ({
  default: ({ value, onValueChange, ...rest }) => (
    <input
      data-testid="datetime-picker"
      {...rest}
      type="text"
      value={value ? new Date(value).toISOString() : ""}
      onChange={(e) => {
        const v = e.target.value;
        onValueChange?.(v ? new Date(v) : null);
      }}
    />
  ),
}));

vi.mock("@/Components/NumberInput", () => ({
  default: ({ value, onValueChange, disabled, readOnly, ...rest }) => (
    <input
      data-testid="number-input"
      {...rest}
      type="text"
      disabled={disabled}
      readOnly={readOnly}
      value={value ?? ""}
      onChange={(e) => {
        const v = e.target.value;
        onValueChange?.(v === "" ? null : Number(v));
      }}
    />
  ),
}));

vi.mock("@/Components/SelectModel", () => ({
  default: ({ label, onSelected }) => (
    <button
      type="button"
      data-testid="select-model-import"
      onClick={() =>
        onSelected?.({
          items: [
            {
              id: 1,
              item: { id: 200, name: "Item Import" },
              description: "dari WO",
              required_quantity: 3,
              unit: { id: 1, name: "PCS" },
            },
          ],
          model: "App\\Models\\Service\\WorkOrder",
        })
      }
    >
      {label}
    </button>
  ),
}));

import Form from "./Form";
import { TooltipProvider } from "@/Components/ui/tooltip";

// beberapa cell FormTable (mis. NumberInput di kolom quantity) membungkus
// diri dengan <Tooltip> internal tanpa provider sendiri -- tanpa ini semua
// test gagal dengan "Tooltip must be used within TooltipProvider".
const render = (ui) => rtlRender(<TooltipProvider>{ui}</TooltipProvider>);

window.route = (name, params) =>
  params !== undefined ? `${name}/${JSON.stringify(params)}` : name;

describe("PurchaseRequests Form", () => {
  beforeEach(() => {
    formPageSeed = {};
  });

  describe("mergeItems (import dari WorkOrder)", () => {
    it("klik tombol import (SelectModel) menambah baris baru ke data.items", async () => {
      const user = userEvent.setup({ delay: null });
      formPageSeed = { items: [] };
      render(<Form />);

      await user.click(screen.getByTestId("select-model-import"));

      expect(screen.getByTestId("row-0")).toBeInTheDocument();
      const itemCell = screen.getByTestId("cell-item-0");
      expect(itemCell).toHaveTextContent("item:Item Import");
    });

    it("baris baru hasil import quantity-nya berasal dari required_quantity sumber", async () => {
      const user = userEvent.setup({ delay: null });
      formPageSeed = { items: [] };
      render(<Form />);

      await user.click(screen.getByTestId("select-model-import"));

      const qtyCell = screen.getByTestId("cell-quantity-0");
      const qtyInput = within(qtyCell).getByTestId("number-input");
      expect(qtyInput).toHaveValue("3");
    });

    it("BUG PRODUKSI (Form.jsx baris 40-66, pola identik SalesOrders): import baris dengan referenceable yang sudah ada meng-update baris existing (bukan duplikat) TAPI id baris di-regenerate", async () => {
      const user = userEvent.setup({ delay: null });
      formPageSeed = {
        items: [
          {
            id: "existing-1",
            item: { id: 200, name: "Item Import" },
            referenceable_type: "App\\Models\\Service\\WorkOrder",
            referenceable_id: 1,
            quantity: 1,
          },
        ],
      };
      render(<Form />);

      await user.click(screen.getByTestId("select-model-import"));

      // Tetap 1 baris (update, bukan tambah baris baru).
      expect(screen.queryByTestId("row-1")).not.toBeInTheDocument();
      expect(screen.getByTestId("row-0")).toBeInTheDocument();
      // quantity ter-update dari required_quantity sumber (3).
      const qtyCell = screen.getByTestId("cell-quantity-0");
      expect(within(qtyCell).getByTestId("number-input")).toHaveValue("3");
    });

    it("BUG PRODUKSI (Form.jsx baris 53-55 & 56): import baris dengan required_quantity<=0 SEHARUSNYA menghapus baris existing, tapi itemMap.delete() diikuti itemMap.has() yang selalu false setelah delete -- baris malah TETAP ADA (di-insert ulang) dengan quantity 0, bukan terhapus", async () => {
      const user = userEvent.setup({ delay: null });
      // Override stub SelectModel khusus test ini: kirim required_quantity 0
      // supaya jalur newItem.quantity <= 0 di mergeItems teruji.
      vi.doMock("@/Components/SelectModel", () => ({
        default: ({ label, onSelected }) => (
          <button
            type="button"
            data-testid="select-model-import"
            onClick={() =>
              onSelected?.({
                items: [
                  {
                    id: 1,
                    item: { id: 200, name: "Item Import" },
                    required_quantity: 0,
                    unit: { id: 1, name: "PCS" },
                  },
                ],
                model: "App\\Models\\Service\\WorkOrder",
              })
            }
          >
            {label}
          </button>
        ),
      }));
      vi.resetModules();
      const { default: FormReloaded } = await import("./Form");

      formPageSeed = {
        items: [
          {
            id: "existing-1",
            item: { id: 200, name: "Item Import" },
            referenceable_type: "App\\Models\\Service\\WorkOrder",
            referenceable_id: 1,
            quantity: 5,
          },
        ],
      };
      render(<FormReloaded />);

      await user.click(screen.getByTestId("select-model-import"));

      // Ekspektasi behavior YANG BENAR adalah baris terhapus (row-0 hilang).
      // Behavior AKTUAL (bug): baris tetap ada dengan quantity 0 karena
      // itemMap.has(key) setelah delete() selalu false, sehingga jatuh ke
      // cabang else (itemMap.set ulang) alih-alih benar-benar terhapus.
      expect(screen.getByTestId("row-0")).toBeInTheDocument();
      const qtyCell = screen.getByTestId("cell-quantity-0");
      expect(within(qtyCell).getByTestId("number-input")).toHaveValue("0");

      vi.doUnmock("@/Components/SelectModel");
      vi.resetModules();
    });
  });

  describe("handleBarcodeSelect (scan barcode)", () => {
    it("scan item+unit baru menambah baris baru dengan quantity 1", async () => {
      const user = userEvent.setup({ delay: null });
      formPageSeed = { items: [] };
      render(<Form />);

      await user.click(screen.getByTestId("item-barcode"));

      expect(screen.getByTestId("row-0")).toBeInTheDocument();
      const qtyCell = screen.getByTestId("cell-quantity-0");
      const qtyInput = within(qtyCell).getByTestId("number-input");
      expect(qtyInput).toHaveValue("1");
    });

    it("scan item+unit yang sudah ada di baris manapun meng-increment quantity baris tsb (bukan menambah baris baru)", async () => {
      const user = userEvent.setup({ delay: null });
      formPageSeed = {
        items: [
          {
            id: "row-a",
            item: { id: 100, name: "Item A" },
            unit: { id: 1, name: "PCS" },
            quantity: 4,
          },
        ],
      };
      render(<Form />);

      await user.click(screen.getByTestId("item-barcode"));

      expect(screen.queryByTestId("row-1")).not.toBeInTheDocument();
      const qtyCell = screen.getByTestId("cell-quantity-0");
      const qtyInput = within(qtyCell).getByTestId("number-input");
      expect(qtyInput).toHaveValue("5");
    });

    it("scan item dengan unit BERBEDA dari baris existing menambah baris baru (bukan increment)", async () => {
      const user = userEvent.setup({ delay: null });
      formPageSeed = {
        items: [
          {
            id: "row-a",
            item: { id: 100, name: "Item A" },
            unit: { id: 99, name: "DUS" },
            quantity: 4,
          },
        ],
      };
      render(<Form />);

      await user.click(screen.getByTestId("item-barcode"));

      // unit hasil scan (id:1 PCS) beda dari unit baris existing (id:99
      // DUS) -- harus jadi baris baru, bukan increment baris lama.
      expect(screen.getByTestId("row-1")).toBeInTheDocument();
      const row0QtyCell = screen.getByTestId("cell-quantity-0");
      expect(within(row0QtyCell).getByTestId("number-input")).toHaveValue("4");
      const row1QtyCell = screen.getByTestId("cell-quantity-1");
      expect(within(row1QtyCell).getByTestId("number-input")).toHaveValue("1");
    });
  });

  describe("cascade required_date header ke items", () => {
    it("mengubah required_date header ikut memperbarui required_date semua baris items", async () => {
      formPageSeed = {
        items: [
          { id: "r1", item: { id: 1 }, quantity: 1 },
          { id: "r2", item: { id: 2 }, quantity: 1 },
        ],
      };
      render(<Form />);

      // Label dirender sebagai `{label} <span>*</span>` (dua text node
      // terpisah + elemen required), sehingga exact string match gagal --
      // pakai regex prefix mengikuti pola PurchaseOrders/Form.rtl.test.jsx.
      const requiredDateInput = screen.getByLabelText(
        /^purchase\.purchaseRequest\.columns\.required_date/,
      );

      const { fireEvent } = await import("@testing-library/react");
      fireEvent.change(requiredDateInput, {
        target: { value: "2026-03-01T00:00:00.000Z" },
      });

      const row0DateCell = screen.getByTestId("cell-required_date-0");
      const row1DateCell = screen.getByTestId("cell-required_date-1");
      const row0Input = within(row0DateCell).getByTestId("datetime-picker");
      const row1Input = within(row1DateCell).getByTestId("datetime-picker");
      expect(row0Input).toHaveValue("2026-03-01T00:00:00.000Z");
      expect(row1Input).toHaveValue("2026-03-01T00:00:00.000Z");
    });

    it("required_date header TIDAK error saat items masih kosong/undefined", async () => {
      formPageSeed = {};
      render(<Form />);

      const requiredDateInput = screen.getByLabelText(
        /^purchase\.purchaseRequest\.columns\.required_date/,
      );

      const { fireEvent } = await import("@testing-library/react");
      expect(() =>
        fireEvent.change(requiredDateInput, {
          target: { value: "2026-03-01T00:00:00.000Z" },
        }),
      ).not.toThrow();
      expect(requiredDateInput).toHaveValue("2026-03-01T00:00:00.000Z");
    });
  });

  describe("wiring kolom item", () => {
    it("memilih item pada kolom item mengisi unit + conversion_factor dari default_uom dan required_date dari header pada baris tsb", async () => {
      const user = userEvent.setup({ delay: null });
      formPageSeed = {
        required_date: new Date("2026-05-01T00:00:00.000Z"),
        items: [{ id: "r1", item: null, quantity: 1 }],
      };
      render(<Form />);

      await user.click(screen.getByTestId("item-link-model"));

      const unitCell = screen.getByTestId("cell-unit-0");
      expect(unitCell).toHaveTextContent("unit:PCS");

      // required_date baris ikut diisi dari data.required_date header saat
      // item dipilih (lihat Form.jsx baris 93-100).
      const dateCell = screen.getByTestId("cell-required_date-0");
      const dateInput = within(dateCell).getByTestId("datetime-picker");
      expect(dateInput).toHaveValue("2026-05-01T00:00:00.000Z");
    });

    it("filter ItemVariantLinkModel hanya menampilkan item is_stock_item", async () => {
      formPageSeed = { items: [{ id: "r1", item: null, quantity: 1 }] };
      render(<Form />);

      const itemCell = screen.getByTestId("cell-item-0");
      expect(itemCell).toHaveTextContent(":stock");
    });

    it("kolom unit item filter berdasarkan item_id dari baris terpilih", async () => {
      formPageSeed = {
        items: [
          {
            id: "r1",
            item: { id: 100, item_id: 50, name: "Item A" },
            quantity: 1,
          },
        ],
      };
      render(<Form />);

      const unitCell = screen.getByTestId("cell-unit-0");
      // Unit link model distub, tapi pastikan komponen ter-render (tidak
      // disabled) karena dataRow.item sudah ada.
      const unitButton = within(unitCell).getByTestId("unit-link-model");
      expect(unitButton).not.toBeDisabled();
    });
  });

  describe("field external_note", () => {
    it("mengetik di textarea external_note memanggil setData", async () => {
      const user = userEvent.setup({ delay: null });
      // DatetimePicker (2x di header) di-stub sebagai <input type="text">,
      // yang JUGA punya role="textbox" -- getByRole("textbox") tanpa scope
      // jadi ambigu. FormInput external_note tidak diberi prop `label`
      // (hanya section title h2), jadi query via <textarea> tag langsung
      // (satu-satunya <textarea> di layar karena items: []).
      formPageSeed = { items: [] };
      const { container } = render(<Form />);

      const textarea = container.querySelector("textarea");
      await user.type(textarea, "catatan tambahan");

      expect(textarea).toHaveValue("catatan tambahan");
    });
  });
});
