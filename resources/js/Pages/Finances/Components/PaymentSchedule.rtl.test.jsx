import { describe, expect, it, vi, beforeEach } from "vitest";
import { render as rtlRender, screen, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

vi.mock("laravel-react-i18n", () => ({
  useLaravelReactI18n: () => ({ t: (key) => `TR:${key}` }),
}));

// NumberInput (dipakai banyak kolom PaymentSchedule) butuh usePage() untuk
// preferences.default_number_format -- tanpa Inertia provider di test, perlu
// mock manual.
vi.mock("@inertiajs/react", () => ({
  usePage: () => ({
    props: { preferences: { default_number_format: "#,###.##" } },
  }),
}));

// FormPageContent hanya wrapper tab/collapsible -- disederhanakan jadi <div>
// agar children tetap dirender tanpa perlu Tabs provider asli. FormPageContext
// context React sungguhan supaya useCanUpdate (dipakai FormInput di dalam
// FormTable stub) tidak error walau tanpa provider (default undefined ->
// dianggap boleh update).
vi.mock("@/Pages/Core/FormPage", async () => {
  const React = await import("react");
  return {
    FormPageContent: ({ title, children }) => (
      <div>
        {title && <h2>{title}</h2>}
        {children}
      </div>
    ),
    useFormPageMeta: () => undefined,
    FormPageContext: React.createContext(),
  };
});

// DatetimePicker adalah komponen berat (Popover + day-picker calendar) yang
// bukan concern PaymentSchedule -- distub jadi input text sederhana yang
// tetap memanggil onValueChange dengan Date, supaya logic cross-field
// (due_date -> discount_date) tetap dapat diuji.
vi.mock("@/Components/DatetimePicker", () => ({
  default: ({ value, onValueChange, name }) => (
    <input
      aria-label={name ?? "datetime"}
      type="text"
      value={value ? new Date(value).toISOString() : ""}
      onChange={(e) => {
        const v = e.target.value;
        onValueChange?.(v ? new Date(v) : null);
      }}
    />
  ),
}));

// PaymentMethodLinkModel & PaymentTermTemplateLinkModel membungkus LinkModel
// (dialog CRUD berat, concern-nya sendiri) -- distub jadi tombol pilih value
// tetap (cukup untuk menguji bahwa onValueChange diteruskan dgn benar).
vi.mock("../PaymentMethods/PaymentMethodLinkModel", () => ({
  default: ({ value, onValueChange }) => (
    <button
      type="button"
      onClick={() => onValueChange?.({ id: 1, name: "Transfer Bank" })}
    >
      payment-method:{value?.name ?? value ?? "none"}
    </button>
  ),
}));

vi.mock("../PaymentTermTemplate/PaymentTermTemplateLinkModel", () => ({
  default: ({ onValueChange }) => (
    <button
      type="button"
      onClick={() =>
        onValueChange?.({
          items: [
            {
              due_date_based_on: "days_after_invoice_date",
              credit_period: 30,
              invoice_portion: 50,
              discount_type: "percentage",
              discount: 5,
              payment_method: null,
            },
            {
              due_date_based_on: "months_after_invoice_month",
              credit_period: 1,
              invoice_portion: 50,
              discount_type: undefined,
              discount: undefined,
              payment_method: null,
            },
          ],
        })
      }
    >
      apply-template
    </button>
  ),
}));

// FormTable adalah komponen besar (2074 baris) dengan test sendiri
// (FormTable.test.js) -- distub sebagai renderer sederhana yang memanggil
// setiap column.cell() untuk satu baris dari `value`, supaya logic murni
// PaymentSchedule (definisi kolom & cell renderer) yang diuji, bukan
// mekanisme drag-drop/tabel FormTable itu sendiri.
vi.mock("@/Components/FormTable", () => ({
  default: ({ columns, value, onValueChange, additionalData }) => {
    const rows = value && value.length > 0 ? value : [{}];
    const updateData = (index, keyOrObj, val) => {
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
              <div key={col.name} data-testid={`cell-${col.name}`}>
                {col.cell({
                  dataRow: row,
                  data: row[col.name],
                  setData: (keyOrObj, val) =>
                    updateData(index, keyOrObj, val),
                  additionalData,
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

import PaymentSchedule from "./PaymentSchedule";
import { TooltipProvider } from "@/Components/ui/tooltip";

// Select (dipakai discount_type) & NumberInput bawa <Tooltip> internal tanpa
// provider sendiri.
const render = (ui) => rtlRender(<TooltipProvider>{ui}</TooltipProvider>);

describe("PaymentSchedule", () => {
  const baseProps = {
    date: "2026-01-01",
    value: [],
    onValueChange: vi.fn(),
    readOnly: false,
    currencyCode: "default",
    additionalData: {},
  };

  beforeEach(() => {
    baseProps.onValueChange = vi.fn();
  });

  it("render tanpa error dan menampilkan judul section terms", () => {
    render(<PaymentSchedule {...baseProps} />);
    expect(
      screen.getByText("TR:finances.paymentSchedule.columns.terms"),
    ).toBeInTheDocument();
  });

  it("mengetik invoice_portion memperbarui data lewat setData (via FormTable stub)", async () => {
    const user = userEvent.setup({ delay: null });
    const onValueChange = vi.fn();
    render(
      <PaymentSchedule
        {...baseProps}
        value={[{ id: "row1", invoice_portion: null }]}
        onValueChange={onValueChange}
      />,
    );

    const portionCell = screen.getByTestId("cell-invoice_portion");
    const input = portionCell.querySelector("input");
    await user.type(input, "25");

    expect(onValueChange).toHaveBeenLastCalledWith([
      expect.objectContaining({ id: "row1", invoice_portion: 25 }),
    ]);
  });

  it("mengubah discount_type mengisi discount_date dari due_date baris yang sama", async () => {
    const user = userEvent.setup({ delay: null });
    const onValueChange = vi.fn();
    const dueDate = new Date("2026-02-10T00:00:00.000Z");
    render(
      <PaymentSchedule
        {...baseProps}
        value={[{ id: "row1", due_date: dueDate }]}
        onValueChange={onValueChange}
      />,
    );

    const discountTypeCell = screen.getByTestId("cell-discount_type");
    const selectInput = discountTypeCell.querySelector("input");
    await user.click(selectInput);
    await user.click(
      await screen.findByText(
        "TR:finances.paymentSchedule.columns.discount_type.options.percentage",
      ),
    );

    expect(onValueChange).toHaveBeenLastCalledWith([
      expect.objectContaining({
        discount_type: "percentage",
        discount_date: dueDate,
      }),
    ]);
  });

  it("mengosongkan discount_type (clear) menghapus discount_date juga", async () => {
    const user = userEvent.setup({ delay: null });
    const onValueChange = vi.fn();
    render(
      <PaymentSchedule
        {...baseProps}
        value={[
          {
            id: "row1",
            due_date: new Date("2026-02-10"),
            discount_type: "percentage",
            discount_date: new Date("2026-02-10"),
          },
        ]}
        onValueChange={onValueChange}
      />,
    );

    const discountTypeCell = screen.getByTestId("cell-discount_type");
    const clearButton = discountTypeCell.querySelector("button");
    await user.click(clearButton);

    expect(onValueChange).toHaveBeenLastCalledWith([
      expect.objectContaining({
        discount_type: undefined,
        discount_date: undefined,
      }),
    ]);
  });

  it("mengubah due_date ikut memperbarui discount_date bila discount_type sudah terisi", () => {
    const onValueChange = vi.fn();
    render(
      <PaymentSchedule
        {...baseProps}
        value={[
          {
            id: "row1",
            due_date: new Date("2026-01-01T00:00:00.000Z"),
            discount_type: "percentage",
          },
        ]}
        onValueChange={onValueChange}
      />,
    );

    const dueDateCell = screen.getByTestId("cell-due_date");
    const input = dueDateCell.querySelector("input");
    // fireEvent.change (bukan user.type per-karakter) -- stub DatetimePicker
    // tidak menyimpan state parsial sendiri, cukup satu perubahan nilai penuh
    // untuk menguji logic cross-field due_date -> discount_date di PaymentSchedule.
    fireEvent.change(input, {
      target: { value: "2026-03-15T00:00:00.000Z" },
    });

    const newDate = new Date("2026-03-15T00:00:00.000Z");
    expect(onValueChange).toHaveBeenLastCalledWith([
      expect.objectContaining({
        due_date: newDate,
        discount_date: newDate,
      }),
    ]);
  });

  it("kolom payment_amount fallback ke additionalData.payment_amount saat data baris kosong", () => {
    render(
      <PaymentSchedule
        {...baseProps}
        value={[{ id: "row1", invoice_portion: 50 }]}
        additionalData={{ payment_amount: 750 }}
      />,
    );

    const cell = screen.getByTestId("cell-payment_amount");
    const input = cell.querySelector("input");
    expect(input).toHaveValue("750.00");
  });

  it("kolom outstanding_amount fallback ke additionalData.outstanding_amount", () => {
    render(
      <PaymentSchedule
        {...baseProps}
        value={[{ id: "row1" }]}
        additionalData={{ outstanding_amount: 1234.5 }}
      />,
    );

    const cell = screen.getByTestId("cell-outstanding_amount");
    const input = cell.querySelector("input");
    expect(input).toHaveValue("1,234.50");
  });

  it("payment_amount disabled saat invoice_portion baris kosong", () => {
    render(
      <PaymentSchedule
        {...baseProps}
        value={[{ id: "row1", invoice_portion: null }]}
      />,
    );

    const cell = screen.getByTestId("cell-payment_amount");
    const input = cell.querySelector("input");
    expect(input).toBeDisabled();
  });

  it("memilih payment_method lewat PaymentMethodLinkModel memanggil setData", async () => {
    const user = userEvent.setup({ delay: null });
    const onValueChange = vi.fn();
    render(
      <PaymentSchedule
        {...baseProps}
        value={[{ id: "row1" }]}
        onValueChange={onValueChange}
      />,
    );

    const cell = screen.getByTestId("cell-payment_method");
    await user.click(cell.querySelector("button"));

    expect(onValueChange).toHaveBeenLastCalledWith([
      expect.objectContaining({
        payment_method: { id: 1, name: "Transfer Bank" },
      }),
    ]);
  });

  it("menerapkan template pembayaran menghitung due_date & discount_date per baris sesuai due_date_based_on", async () => {
    const user = userEvent.setup({ delay: null });
    const onValueChange = vi.fn();
    render(
      <PaymentSchedule
        {...baseProps}
        date="2026-01-01T00:00:00.000Z"
        onValueChange={onValueChange}
      />,
    );

    await user.click(screen.getByText("apply-template"));

    expect(onValueChange).toHaveBeenCalledTimes(1);
    const template = onValueChange.mock.calls[0][0];
    expect(template).toHaveLength(2);

    // Baris 1: days_after_invoice_date, credit_period 30 -> 2026-01-31.
    const row1DueDate = new Date(template[0].due_date);
    expect(row1DueDate.getUTCDate()).toBe(31);
    expect(row1DueDate.getUTCMonth()).toBe(0); // Januari (0-indexed)
    expect(template[0].invoice_portion).toBe(50);
    expect(template[0].discount_type).toBe("percentage");
    expect(template[0].discount).toBe(5);
    // discount_date ikut due_date krn discount_type terisi.
    expect(new Date(template[0].discount_date).getTime()).toBe(
      row1DueDate.getTime(),
    );

    // Baris 2: months_after_invoice_month, credit_period 1 -> Februari 2026.
    const row2DueDate = new Date(template[1].due_date);
    expect(row2DueDate.getUTCMonth()).toBe(1); // Februari
    // discount_type kosong -> discount_date undefined.
    expect(template[1].discount_date).toBeUndefined();
  });
});
