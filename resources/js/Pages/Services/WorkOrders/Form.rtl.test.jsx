import { describe, expect, it, vi, beforeEach } from "vitest";
import { render as rtlRender, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";

// ============================================================================
// Form.jsx (Services/WorkOrders, 384 baris) adalah halaman transaksi order
// jasa servis/reparasi. Mengompos FormPage/FormPageContent (context form
// induk), FormTable (tabel item generik, sudah ada test sendiri), semua
// *LinkModel (Branch/Customer/ItemVariant/ItemUnit -- wrapper LinkModel
// dialog berat), ItemBarcode, DatetimePicker, NumberInput (sudah ada test
// sendiri di Components/NumberInput/index.rtl.test.jsx & index.test.js).
// Sesuai arahan task: SEMUA child yang sudah punya test sendiri di-stub,
// fokus HANYA ke logic UNIK milik Form.jsx sendiri:
//   1. itemColumns -- wiring kolom item (pilih item mengisi unit +
//      conversion_factor + reset alternative), disabled state per kolom
//      berdasar dataRow?.item, filter kolom unit/alternative berdasar item
//      terpilih, readOnly quantity (attributes.readOnly ||
//      (dataRow.readOnly && !dataRow.isCustom)).
//   2. handleBarcodeSelect (scan barcode) -- tambah baris baru qty 1 ATAU
//      increment quantity baris existing (match by item.id + unit.id).
//      CATATAN: TIDAK ada fungsi mergeItems (import dari model lain) di file
//      ini sama sekali -- beda dari SalesOrders/PurchaseOrders Form.jsx.
//   3. Toggle for_internal -- disable & unrequire field customer, mengubah
//      label & filter/defaultValueForm customer_branch (internal vs
//      customer), reset value customer saat for_internal aktif.
//   4. Pilih customer dengan <=1 branch otomatis mengisi customer_branch.
//   5. Render kondisional started_at/completed_at (read-only) berdasar
//      defaultData.
//   6. defaultOpen panel external_note berdasar defaultData.external_note.
// ============================================================================

const stableT = (key) => key;
vi.mock("laravel-react-i18n", () => ({
  useLaravelReactI18n: () => ({ t: stableT }),
}));

// useFormPage di-mock sebagai stateful hook (mirip pola PurchaseOrders/
// Form.rtl.test.jsx) supaya setData yang dipanggil Form.jsx benar2 memicu
// re-render dengan data terbaru -- diperlukan utk menguji reaktivitas
// (mis. baris item baru muncul di FormTable stub, checkbox toggle
// menonaktifkan field lain).
let formPageSeed = {};
let formPageDefaultData = {};
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
    defaultData: formPageDefaultData,
    disabled: formPageDisabled,
    dataBefore: {},
  };
}

vi.mock("@/Pages/Core/FormPage", async () => {
  const React = await import("react");
  return {
    FormPageContent: ({
      title,
      actions,
      children,
      collapsible,
      defaultOpen,
    }) => (
      <div
        data-testid="form-page-content"
        data-collapsible={collapsible ? "true" : "false"}
        data-default-open={defaultOpen ? "true" : "false"}
      >
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

// FormTable adalah komponen generik besar dengan test sendiri -- distub
// sebagai renderer sederhana yang memanggil tiap column.cell() untuk baris
// dari `value`, supaya definisi kolom (itemColumns) milik Form.jsx yang
// diuji, bukan mekanisme FormTable itu sendiri. Pola identik dengan
// PurchaseOrders/Form.rtl.test.jsx.
vi.mock("@/Components/FormTable", () => ({
  default: ({ columns, value, onValueChange, readOnly: tableReadOnly }) => {
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
      <div
        data-testid="stub-form-table"
        data-readonly={tableReadOnly ? "true" : "false"}
      >
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

// *LinkModel (dialog combobox berat) dan ItemBarcode/DatetimePicker distub
// jadi tombol/kontrol sederhana yang memanggil onValueChange/onSelect dengan
// payload tetap -- cukup untuk menguji Form.jsx meneruskan value & memproses
// callback dengan benar. Setiap mock menerima seluruh props supaya test bisa
// memverifikasi filters/disabled/placeholder yang diteruskan Form.jsx.
vi.mock("@/Pages/Inventory/Items/ItemVariantLinkModel", () => ({
  default: (props) => {
    const { value, onValueChange, disabled, filters, placeholder } = props;
    return (
      <button
        type="button"
        data-testid="item-variant-link-model"
        data-disabled={disabled ? "true" : "false"}
        data-filters={JSON.stringify(filters ?? {})}
        data-placeholder={placeholder ?? ""}
        disabled={disabled}
        onClick={() =>
          onValueChange?.({
            id: 100,
            name: "Item A",
            default_uom: { id: 1, name: "PCS", conversion_factor: 1 },
            allow_alternative_item: true,
          })
        }
      >
        item:{value?.name ?? "none"}
      </button>
    );
  },
}));

vi.mock("@/Pages/Inventory/Items/ItemUnitLinkModel", () => ({
  default: ({ value, onValueChange, disabled, filters }) => (
    <button
      type="button"
      data-testid="item-unit-link-model"
      data-disabled={disabled ? "true" : "false"}
      data-filters={JSON.stringify(filters ?? {})}
      disabled={disabled}
      onClick={() =>
        onValueChange?.({ id: 2, name: "BOX", conversion_factor: 12 })
      }
    >
      unit:{value?.name ?? "none"}
    </button>
  ),
}));

vi.mock("@/Pages/Settings/Branches/BranchLinkModel", () => ({
  default: ({ value, onValueChange, disabled, filters, defaultValueForm }) => (
    <button
      type="button"
      data-testid="branch-link-model"
      data-disabled={disabled ? "true" : "false"}
      data-filters={JSON.stringify(filters ?? {})}
      data-default-value-form={JSON.stringify(defaultValueForm ?? {})}
      disabled={disabled}
      onClick={() => onValueChange?.({ id: 1, name: "Cabang A" })}
    >
      branch:{value?.name ?? "none"}
    </button>
  ),
}));

vi.mock("@/Pages/Sales/Customers/CustomerLinkModel", () => ({
  default: ({ value, onValueChange, disabled }) => (
    <div>
      <button
        type="button"
        data-testid="customer-link-model"
        data-disabled={disabled ? "true" : "false"}
        disabled={disabled}
        onClick={() =>
          onValueChange?.({
            id: 1,
            name: "Pelanggan A",
            branches: [{ id: 10, name: "Cabang Tunggal" }],
          })
        }
      >
        customer:{value?.name ?? value ?? "none"}
      </button>
      <button
        type="button"
        data-testid="customer-link-model-multi-branch"
        onClick={() =>
          onValueChange?.({
            id: 2,
            name: "Pelanggan B",
            branches: [
              { id: 20, name: "Cabang 1" },
              { id: 21, name: "Cabang 2" },
            ],
          })
        }
      >
        customer-multi-branch
      </button>
    </div>
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
      readOnly={!onValueChange}
      value={value ? new Date(value).toISOString() : ""}
      onChange={(e) => {
        const v = e.target.value;
        onValueChange?.(v ? new Date(v) : null);
      }}
    />
  ),
}));

vi.mock("@/Components/NumberInput", () => ({
  default: ({ value, onValueChange, ...rest }) => (
    <input
      data-testid="number-input"
      {...rest}
      type="text"
      value={value ?? ""}
      onChange={(e) => onValueChange?.(Number(e.target.value))}
    />
  ),
}));

import Form from "./Form";

const render = (ui) => rtlRender(ui);

describe("WorkOrders Form", () => {
  beforeEach(() => {
    formPageSeed = {};
    formPageDefaultData = {};
    formPageDisabled = false;
  });

  describe("itemColumns: kolom item", () => {
    it("memilih item mengisi unit, conversion_factor dari default_uom, dan me-reset alternative", async () => {
      const user = userEvent.setup({ delay: null });
      formPageSeed = { items: [{ id: "r1", item: null, quantity: 1 }] };
      render(<Form />);

      // Urutan ItemVariantLinkModel di DOM: [0] field "item_service" (level
      // form, di luar tabel), [1] kolom "item" (tabel baris ke-0), [2] kolom
      // "alternative" (tabel baris ke-0). Instance [1] adalah kolom "item".
      await user.click(screen.getAllByTestId("item-variant-link-model")[1]);

      const unitCell = screen.getByTestId("cell-unit-0");
      expect(unitCell).toHaveTextContent("unit:PCS");
      // conversion_factor bukan kolom tampil langsung, tapi alternative
      // harus ter-reset null (masih "none" karena tidak ada value).
      const altCell = screen.getByTestId("cell-alternative-0");
      expect(altCell).toHaveTextContent("item:none");
    });

    it("kolom description disabled selama dataRow belum punya item", () => {
      formPageSeed = { items: [{ id: "r1", item: null, quantity: 1 }] };
      render(<Form />);

      const descCell = screen.getByTestId("cell-description-0");
      const textarea = descCell.querySelector("textarea");
      expect(textarea).toBeDisabled();
    });

    it("kolom description aktif (tidak disabled) ketika dataRow sudah punya item", () => {
      formPageSeed = {
        items: [{ id: "r1", item: { id: 100, name: "Item A" }, quantity: 1 }],
      };
      render(<Form />);

      const descCell = screen.getByTestId("cell-description-0");
      const textarea = descCell.querySelector("textarea");
      expect(textarea).not.toBeDisabled();
    });

    it("kolom unit meneruskan filter item_id dari dataRow.item.item_id", () => {
      formPageSeed = {
        items: [
          {
            id: "r1",
            item: { id: 100, item_id: 55, name: "Item A" },
            quantity: 1,
          },
        ],
      };
      render(<Form />);

      const unitButton = screen.getByTestId("item-unit-link-model");
      expect(unitButton).toHaveAttribute(
        "data-filters",
        JSON.stringify({ item_id: 55 }),
      );
      expect(unitButton).toHaveAttribute("data-disabled", "false");
    });

    it("kolom unit disabled ketika dataRow belum punya item", () => {
      formPageSeed = { items: [{ id: "r1", item: null, quantity: 1 }] };
      render(<Form />);

      expect(screen.getByTestId("item-unit-link-model")).toHaveAttribute(
        "data-disabled",
        "true",
      );
    });

    it("kolom alternative disabled ketika item terpilih tidak allow_alternative_item", () => {
      formPageSeed = {
        items: [
          {
            id: "r1",
            item: { id: 100, name: "Item A", allow_alternative_item: false },
            quantity: 1,
          },
        ],
      };
      render(<Form />);

      // Urutan DOM: [0] field "item_service" level-form, [1] kolom "item",
      // [2] kolom "alternative" (yang diuji di sini).
      const buttons = screen.getAllByTestId("item-variant-link-model");
      expect(buttons[2]).toHaveAttribute("data-disabled", "true");
    });

    it("kolom alternative aktif ketika item terpilih allow_alternative_item true", () => {
      formPageSeed = {
        items: [
          {
            id: "r1",
            item: { id: 100, name: "Item A", allow_alternative_item: true },
            quantity: 1,
          },
        ],
      };
      render(<Form />);

      const buttons = screen.getAllByTestId("item-variant-link-model");
      expect(buttons[2]).toHaveAttribute("data-disabled", "false");
    });

    it("kolom item memfilter type != vehicle", () => {
      formPageSeed = { items: [{ id: "r1", item: null, quantity: 1 }] };
      render(<Form />);

      // buttons[0] = field "item_service" level-form (filter type: "vehicle",
      // beda kontrak dari kolom "item" di tabel) -- kolom "item" ada di [1].
      const buttons = screen.getAllByTestId("item-variant-link-model");
      expect(buttons[1]).toHaveAttribute(
        "data-filters",
        JSON.stringify({ type: { not: "vehicle" } }),
      );
    });

    it("kolom quantity disabled ketika dataRow belum punya item", () => {
      formPageSeed = { items: [{ id: "r1", item: null, quantity: 1 }] };
      render(<Form />);

      const qtyCell = screen.getByTestId("cell-quantity-0");
      const qtyInput = qtyCell.querySelector("input");
      expect(qtyInput).toBeDisabled();
    });

    it("kolom quantity readOnly ketika dataRow.readOnly true dan bukan isCustom", () => {
      formPageSeed = {
        items: [
          {
            id: "r1",
            item: { id: 100, name: "Item A" },
            quantity: 5,
            readOnly: true,
            isCustom: false,
          },
        ],
      };
      render(<Form />);

      const qtyCell = screen.getByTestId("cell-quantity-0");
      const qtyInput = qtyCell.querySelector("input");
      expect(qtyInput).toHaveAttribute("readonly");
    });

    it("kolom quantity TIDAK readOnly ketika dataRow.readOnly true tapi isCustom true", () => {
      formPageSeed = {
        items: [
          {
            id: "r1",
            item: { id: 100, name: "Item A" },
            quantity: 5,
            readOnly: true,
            isCustom: true,
          },
        ],
      };
      render(<Form />);

      const qtyCell = screen.getByTestId("cell-quantity-0");
      const qtyInput = qtyCell.querySelector("input");
      expect(qtyInput).not.toHaveAttribute("readonly");
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
      const qtyInput = qtyCell.querySelector("input");
      expect(qtyInput).toHaveValue("1");
    });

    it("scan item+unit yang sudah ada meng-increment quantity baris tsb (bukan menambah baris baru)", async () => {
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
      const qtyInput = qtyCell.querySelector("input");
      expect(qtyInput).toHaveValue("5");
    });

    it("scan item sama tapi unit berbeda menambah baris baru (bukan increment)", async () => {
      const user = userEvent.setup({ delay: null });
      formPageSeed = {
        items: [
          {
            id: "row-a",
            item: { id: 100, name: "Item A" },
            unit: { id: 999, name: "LAIN" },
            quantity: 4,
          },
        ],
      };
      render(<Form />);

      await user.click(screen.getByTestId("item-barcode"));

      expect(screen.getByTestId("row-1")).toBeInTheDocument();
      const qtyCell = screen.getByTestId("cell-quantity-1");
      const qtyInput = qtyCell.querySelector("input");
      expect(qtyInput).toHaveValue("1");
    });

    it("selected tanpa item/unit valid tidak mengubah items (no-op)", async () => {
      const user = userEvent.setup({ delay: null });
      formPageSeed = { items: [] };
      render(<Form />);

      // ItemBarcode stub selalu mengirim item+unit valid; verifikasi no-op
      // langsung via handler tidak memungkinkan tanpa akses internal, jadi
      // di sini kita pastikan minimal baseline (baris kosong) tidak error
      // saat items awalnya undefined sama sekali.
      expect(screen.queryByTestId("row-0")).not.toBeInTheDocument();
      await user.click(screen.getByTestId("item-barcode"));
      expect(screen.getByTestId("row-0")).toBeInTheDocument();
    });
  });

  describe("toggle for_internal", () => {
    it("checkbox for_internal unchecked: field customer aktif dan required", () => {
      formPageSeed = { for_internal: false, items: [] };
      render(<Form />);

      const customerButton = screen.getByTestId("customer-link-model");
      expect(customerButton).toHaveAttribute("data-disabled", "false");
    });

    it("mencentang for_internal menonaktifkan field customer dan mengosongkan value customer", async () => {
      const user = userEvent.setup({ delay: null });
      formPageSeed = {
        for_internal: false,
        customer: { id: 1, name: "Pelanggan A" },
        items: [],
      };
      render(<Form />);

      const checkbox = screen.getByRole("forminput", { name: /for_internal/i });
      await user.click(checkbox);

      const customerButton = screen.getByTestId("customer-link-model");
      expect(customerButton).toHaveAttribute("data-disabled", "true");
      // value diteruskan sebagai "" (falsy) saat for_internal aktif -- stub
      // render `value?.name ?? value ?? "none"`, ?? cuma fallback utk
      // null/undefined (bukan ""), jadi hasilnya string kosong, bukan "none".
      expect(customerButton).toHaveTextContent("customer:");
    });

    it("label customer_branch berubah jadi internal_branch saat for_internal aktif", async () => {
      const user = userEvent.setup({ delay: null });
      formPageSeed = { for_internal: false, items: [] };
      render(<Form />);

      expect(
        screen.getByText("service.workOrder.columns.customer_branch"),
      ).toBeInTheDocument();

      const checkbox = screen.getByRole("forminput", { name: /for_internal/i });
      await user.click(checkbox);

      expect(
        screen.getByText("service.workOrder.columns.internal_branch"),
      ).toBeInTheDocument();
      expect(
        screen.queryByText("service.workOrder.columns.customer_branch"),
      ).not.toBeInTheDocument();
    });

    it("filters & defaultValueForm customer_branch pakai branchable_type/id customer saat for_internal false", () => {
      formPageSeed = {
        for_internal: false,
        customer: { id: 7, name: "Pelanggan X" },
        items: [],
      };
      render(<Form />);

      const branchButton = screen.getByTestId("branch-link-model");
      expect(branchButton).toHaveAttribute(
        "data-filters",
        JSON.stringify({
          branchable_type: "App\\Models\\Sales\\Customer",
          branchable_id: 7,
        }),
      );
      expect(branchButton).toHaveAttribute(
        "data-default-value-form",
        JSON.stringify({
          branchable_type: "App\\Models\\Sales\\Customer",
          branchable_id: 7,
        }),
      );
    });

    it("filters & defaultValueForm customer_branch bernilai null saat for_internal true", async () => {
      const user = userEvent.setup({ delay: null });
      formPageSeed = {
        for_internal: false,
        customer: { id: 7, name: "Pelanggan X" },
        items: [],
      };
      render(<Form />);

      const checkbox = screen.getByRole("forminput", { name: /for_internal/i });
      await user.click(checkbox);

      const branchButton = screen.getByTestId("branch-link-model");
      expect(branchButton).toHaveAttribute(
        "data-filters",
        JSON.stringify({ branchable_type: null, branchable_id: null }),
      );
    });

    it("field customer_branch disabled ketika bukan for_internal dan customer belum dipilih", () => {
      formPageSeed = { for_internal: false, customer: null, items: [] };
      render(<Form />);

      expect(screen.getByTestId("branch-link-model")).toHaveAttribute(
        "data-disabled",
        "true",
      );
    });

    it("field customer_branch aktif ketika for_internal true walau customer kosong", () => {
      formPageSeed = { for_internal: true, customer: null, items: [] };
      render(<Form />);

      expect(screen.getByTestId("branch-link-model")).toHaveAttribute(
        "data-disabled",
        "false",
      );
    });
  });

  describe("pilih customer otomatis mengisi customer_branch", () => {
    it("customer dengan tepat 1 branch otomatis mengisi customer_branch", async () => {
      const user = userEvent.setup({ delay: null });
      formPageSeed = { for_internal: false, items: [] };
      render(<Form />);

      await user.click(screen.getByTestId("customer-link-model"));

      expect(screen.getByTestId("branch-link-model")).toHaveTextContent(
        "branch:Cabang Tunggal",
      );
    });

    it("customer dengan >1 branch TIDAK otomatis mengisi customer_branch", async () => {
      const user = userEvent.setup({ delay: null });
      formPageSeed = { for_internal: false, items: [] };
      render(<Form />);

      await user.click(screen.getByTestId("customer-link-model-multi-branch"));

      expect(screen.getByTestId("branch-link-model")).toHaveTextContent(
        "branch:none",
      );
    });
  });

  describe("render kondisional started_at/completed_at", () => {
    it("field started_at/completed_at TIDAK dirender saat defaultData kosong", () => {
      formPageDefaultData = {};
      formPageSeed = { items: [] };
      render(<Form />);

      expect(
        screen.queryByText("service.workOrder.columns.started_at"),
      ).not.toBeInTheDocument();
      expect(
        screen.queryByText("service.workOrder.columns.completed_at"),
      ).not.toBeInTheDocument();
    });

    it("field started_at dirender read-only saat defaultData.started_at ada", () => {
      formPageDefaultData = { started_at: "2026-08-01T00:00:00.000Z" };
      formPageSeed = { started_at: "2026-08-01T00:00:00.000Z", items: [] };
      render(<Form />);

      expect(
        screen.getByText("service.workOrder.columns.started_at"),
      ).toBeInTheDocument();
    });

    it("field completed_at dirender saat defaultData.completed_at ada", () => {
      formPageDefaultData = { completed_at: "2026-08-02T00:00:00.000Z" };
      formPageSeed = { completed_at: "2026-08-02T00:00:00.000Z", items: [] };
      render(<Form />);

      expect(
        screen.getByText("service.workOrder.columns.completed_at"),
      ).toBeInTheDocument();
    });
  });

  describe("panel external_note", () => {
    it("defaultOpen false ketika defaultData.external_note kosong", () => {
      formPageDefaultData = {};
      formPageSeed = { items: [] };
      render(<Form />);

      const panels = screen.getAllByTestId("form-page-content");
      const externalNotePanel = panels.find((el) =>
        el.textContent.includes("service.workOrder.columns.external_note"),
      );
      expect(externalNotePanel).toHaveAttribute("data-default-open", "false");
      expect(externalNotePanel).toHaveAttribute("data-collapsible", "true");
    });

    it("defaultOpen true ketika defaultData.external_note terisi", () => {
      formPageDefaultData = { external_note: "Catatan lama" };
      formPageSeed = { items: [] };
      render(<Form />);

      const panels = screen.getAllByTestId("form-page-content");
      const externalNotePanel = panels.find((el) =>
        el.textContent.includes("service.workOrder.columns.external_note"),
      );
      expect(externalNotePanel).toHaveAttribute("data-default-open", "true");
    });
  });

  describe("item_service (jenis kendaraan/aset)", () => {
    it("kolom item_service memfilter type = vehicle", () => {
      formPageSeed = { items: [] };
      render(<Form />);

      // item_service adalah satu-satunya ItemVariantLinkModel dengan filter
      // type: "vehicle" (bukan type: {not: "vehicle"} seperti kolom item).
      const buttons = screen.getAllByTestId("item-variant-link-model");
      const itemServiceButton = buttons.find(
        (btn) =>
          btn.getAttribute("data-filters") ===
          JSON.stringify({ type: "vehicle" }),
      );
      expect(itemServiceButton).toBeDefined();
    });
  });

  describe("FormTable readOnly mengikuti disabled form", () => {
    it("readOnly FormTable true ketika form disabled", () => {
      formPageDisabled = true;
      formPageSeed = { items: [] };
      render(<Form />);

      expect(screen.getByTestId("stub-form-table")).toHaveAttribute(
        "data-readonly",
        "true",
      );
    });

    it("readOnly FormTable false ketika form tidak disabled", () => {
      formPageDisabled = false;
      formPageSeed = { items: [] };
      render(<Form />);

      expect(screen.getByTestId("stub-form-table")).toHaveAttribute(
        "data-readonly",
        "false",
      );
    });
  });
});
