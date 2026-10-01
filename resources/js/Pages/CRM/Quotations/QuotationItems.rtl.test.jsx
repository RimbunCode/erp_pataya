import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

// Kolom tabel item menurut jenis Quotation (AC9.4), judul kolom dinamis
// (AC9.3), kunci preferensi kolom per jenis (AC9.6), dan penyalinan
// description dari master item (AC4.4). FormTable di-stub: yang diuji di sini
// adalah definisi kolom yang diberikan QuotationItems, sedangkan perilaku
// FormTable sendiri sudah punya test di tempat lain. Stub meniru
// `.filter((col) => col)` milik FormTable.jsx (createHeaders).

const stableT = (key) => key;
vi.mock("laravel-react-i18n", () => ({
  useLaravelReactI18n: () => ({ t: stableT }),
}));

let formTableProps = null;
vi.mock("@/Components/FormTable", () => ({
  default: (props) => {
    formTableProps = props;
    const columns = props.columns.filter((col) => col);
    return (
      <div data-testid="form-table" data-name={props.name}>
        {columns.map((col) => (
          <span key={col.name} data-testid={`column-${col.name}`}>
            {col.title ?? col.titleTrans}
          </span>
        ))}
      </div>
    );
  },
}));

vi.mock("@/Pages/Core/FormPage", () => ({
  FormPageContent: ({ title, children }) => (
    <section aria-label={title}>{children}</section>
  ),
}));

vi.mock("@/Pages/Inventory/Items/ItemVariantLinkModel", () => ({
  default: ({ onValueChange, fields, with: withRelations }) => (
    <button
      type="button"
      data-testid="item-link-model"
      data-fields={(fields ?? []).join(",")}
      data-with={(withRelations ?? []).join(",")}
      onClick={() =>
        onValueChange({
          id: "variant-1",
          item_code: "SP-001",
          description: "Baris 1\nBaris 2",
          default_uom: { id: "unit-pc", name: "Piece" },
        })
      }
    >
      pilih item
    </button>
  ),
}));

vi.mock("@/Components/NumberInput", () => ({
  default: ({ value, readOnly }) => (
    <input
      readOnly={readOnly}
      value={Number(value ?? 0).toFixed(2)}
      onChange={() => {}}
    />
  ),
}));

vi.mock("@/Pages/Inventory/Items/ItemUnitLinkModel", () => ({
  default: () => <div data-testid="item-unit-link-model" />,
}));

import QuotationItems, { buildQuotationItemColumns } from "./QuotationItems";

const columnNames = () =>
  formTableProps.columns.filter((col) => col).map((col) => col.name);

describe("CRM QuotationItems", () => {
  beforeEach(() => {
    formTableProps = null;
  });

  describe("kolom per jenis (AC9.4)", () => {
    it("spare_part: Part No, Description, Quantity, Unit, Harga, Remark, Amount", () => {
      render(<QuotationItems type="spare_part" value={[]} />);

      expect(columnNames()).toEqual([
        "item_code",
        "item",
        "description",
        "quantity",
        "item_unit",
        "price",
        "remark",
        "amount",
      ]);
    });

    it("new_unit: tanpa Part No dan Unit, ada Lead Time dan Amount", () => {
      render(<QuotationItems type="new_unit" value={[]} />);

      expect(columnNames()).toEqual([
        "item",
        "description",
        "quantity",
        "price",
        "remark",
        "amount",
      ]);
    });

    it("rental: tanpa Part No, Remark, dan Amount; Unit tetap ada", () => {
      render(<QuotationItems type="rental" value={[]} />);

      expect(columnNames()).toEqual([
        "item",
        "description",
        "quantity",
        "item_unit",
        "price",
      ]);
    });

    it("kolom yang tidak berlaku tidak dirender sama sekali", () => {
      render(<QuotationItems type="rental" value={[]} />);

      expect(screen.queryByTestId("column-remark")).not.toBeInTheDocument();
      expect(screen.queryByTestId("column-amount")).not.toBeInTheDocument();
      expect(screen.queryByTestId("column-item_code")).not.toBeInTheDocument();
      expect(screen.getByTestId("column-item_unit")).toBeInTheDocument();
    });

    it("kolom item dan quantity wajib di semua jenis", () => {
      for (const type of ["spare_part", "new_unit", "rental"]) {
        const columns = buildQuotationItemColumns(type, stableT).filter(
          (col) => col,
        );
        const required = columns.filter((col) => col.required);

        expect(required.map((col) => col.name)).toEqual(["item", "quantity"]);
      }
    });
  });

  describe("judul kolom dinamis (AC9.3)", () => {
    it.each([
      ["spare_part", "Unit Price"],
      ["new_unit", "Harga / unit"],
      ["rental", "Harga / bulan"],
    ])("judul kolom harga untuk %s mengikuti jenis (%s)", (type) => {
      render(<QuotationItems type={type} value={[]} />);

      expect(screen.getByTestId("column-price")).toHaveTextContent(
        `crm.quotation.columns.price.by_type.${type}`,
      );
    });

    it("judul kolom remark: Remark untuk spare_part, Lead Time untuk new_unit", () => {
      const { unmount } = render(
        <QuotationItems type="spare_part" value={[]} />,
      );
      expect(screen.getByTestId("column-remark")).toHaveTextContent(
        "crm.quotation.columns.remark.by_type.spare_part",
      );
      unmount();

      render(<QuotationItems type="new_unit" value={[]} />);
      expect(screen.getByTestId("column-remark")).toHaveTextContent(
        "crm.quotation.columns.remark.by_type.new_unit",
      );
    });
  });

  describe("kunci preferensi kolom (AC9.6)", () => {
    it.each(["spare_part", "new_unit", "rental"])(
      "name FormTable menyertakan jenis %s",
      (type) => {
        render(<QuotationItems type={type} value={[]} />);

        expect(screen.getByTestId("form-table")).toHaveAttribute(
          "data-name",
          `quotation-items-${type}`,
        );
      },
    );

    it("ketiga jenis memakai name yang berbeda", () => {
      const names = new Set();
      for (const type of ["spare_part", "new_unit", "rental"]) {
        const { unmount } = render(<QuotationItems type={type} value={[]} />);
        names.add(formTableProps.name);
        unmount();
      }

      expect(names.size).toBe(3);
    });
  });

  describe("props diteruskan ke FormTable", () => {
    it("value, onValueChange, dan readOnly diteruskan apa adanya", () => {
      const onValueChange = vi.fn();
      const value = [{ id: "a", quantity: 1 }];
      render(
        <QuotationItems
          type="spare_part"
          value={value}
          onValueChange={onValueChange}
          readOnly
        />,
      );

      expect(formTableProps.value).toBe(value);
      expect(formTableProps.onValueChange).toBe(onValueChange);
      expect(formTableProps.readOnly).toBe(true);
    });

    it("jenis default spare_part bila type tidak diberikan", () => {
      render(<QuotationItems value={[]} />);

      expect(formTableProps.name).toBe("quotation-items-spare_part");
    });
  });

  describe("sel kolom item (AC4.4)", () => {
    const renderItemCell = (setData) => {
      const column = buildQuotationItemColumns("spare_part", stableT).find(
        (col) => col?.name === "item",
      );
      render(
        column.cell({
          dataRow: {},
          setData,
          attributes: {},
        }),
      );
    };

    it("meminta item_code dan description dari master item", () => {
      renderItemCell(vi.fn());

      const link = screen.getByTestId("item-link-model");
      expect(link.dataset.fields).toBe("item_code,description");
      expect(link.dataset.with).toBe("defaultUom");
    });

    it("memilih item menyalin description multi-baris dan satuan bawaan", async () => {
      const setData = vi.fn();
      renderItemCell(setData);

      await userEvent.click(screen.getByTestId("item-link-model"));

      expect(setData).toHaveBeenCalledTimes(1);
      const patch = setData.mock.calls[0][0];
      expect(patch.item.id).toBe("variant-1");
      expect(patch.description).toBe("Baris 1\nBaris 2");
      expect(patch.item_unit).toEqual({ id: "unit-pc", name: "Piece" });
    });
  });

  describe("sel kolom lain", () => {
    it("Part No menampilkan item_code dari item terpilih, hanya baca", () => {
      const column = buildQuotationItemColumns("spare_part", stableT).find(
        (col) => col?.name === "item_code",
      );
      render(
        column.cell({
          dataRow: { item: { item_code: "SP-001" } },
          attributes: {},
        }),
      );

      const input = screen.getByDisplayValue("SP-001");
      expect(input).toHaveAttribute("readonly");
    });

    it("Amount dihitung dari quantity x price baris, hanya baca", () => {
      const column = buildQuotationItemColumns("spare_part", stableT).find(
        (col) => col?.name === "amount",
      );
      render(
        column.cell({
          dataRow: { quantity: 3, price: 125 },
          attributes: {},
        }),
      );

      const input = screen.getByDisplayValue("375.00");
      expect(input).toHaveAttribute("readonly");
    });
  });
});
