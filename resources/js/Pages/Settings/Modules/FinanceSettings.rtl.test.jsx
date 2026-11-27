import React from "react";
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import FinanceSettings from "./FinanceSettings";

const putMock = vi.fn();
const setDataMock = vi.hoisted(() => vi.fn());
const translationMock = vi.hoisted(() =>
  vi.fn((key, fallback) => fallback || key),
);

vi.mock("@inertiajs/react", async (importOriginal) => ({
  ...(await importOriginal()),
  Head: ({ title }) => <title>{title}</title>,
  useForm: (initial) => ({
    data: initial,
    setData: setDataMock,
    put: putMock,
    processing: false,
    isDirty: false,
    errors: {},
  }),
  usePage: () => ({
    props: {
      auth: { user: { id: "01TEST" } },
      flash: {},
      preferences: {},
    },
  }),
}));

vi.mock("@/Layouts/AppLayout", () => ({
  default: ({ children }) => <div data-testid="app-layout">{children}</div>,
}));

vi.mock("laravel-react-i18n", () => ({
  useLaravelReactI18n: () => ({
    t: translationMock,
  }),
}));

vi.mock("@/lib/gooeyToast", () => ({
  gooeyToast: { success: vi.fn(), error: vi.fn() },
}));

vi.mock("@/Components/FormInput", () => ({
  default: ({ label, children }) => (
    <div data-testid="form-input">
      <label>{label}</label>
      {children}
    </div>
  ),
}));

vi.mock("@/Components/DatetimePicker", () => ({
  default: ({ value, disabled, onValueChange }) => (
    <div>
      <input
        data-testid="date-input"
        value={value ?? ""}
        disabled={disabled}
        onChange={(event) => onValueChange(event.target.value || null)}
      />
      <button
        type="button"
        disabled={disabled}
        onClick={() => onValueChange(null)}
      >
        clear-date
      </button>
    </div>
  ),
}));

vi.mock("@/Components/NumberInput", () => ({
  default: ({ value, disabled }) => (
    <input
      data-testid="number-input"
      value={value}
      disabled={disabled}
      onChange={() => {}}
    />
  ),
}));

describe("FinanceSettings RTL", () => {
  it("renders finance settings page with tax invoice fields", () => {
    render(
      <FinanceSettings
        setting={{
          tax_invoice_serial_range_start: 100,
          tax_invoice_serial_range_end: 200,
          tax_invoice_serial_last_used: 150,
        }}
        canWrite={true}
      />,
    );

    expect(screen.getByTestId("finance-settings-form")).toBeInTheDocument();
    expect(screen.getByText("Finance Settings")).toBeInTheDocument();
    expect(translationMock).toHaveBeenCalledWith(
      "finances.setting.title",
      "Finance Settings",
    );
    expect(translationMock).toHaveBeenCalledWith(
      "finances.setting.tax_invoice.title",
      "Faktur Pajak",
    );
    expect(translationMock).toHaveBeenCalledWith(
      "finances.setting.tax_invoice.range_start",
      "Awal Rentang Nomor Seri",
    );
    expect(screen.queryAllByTestId("number-input")).toHaveLength(3);
  });

  it("disables inputs when canWrite is false", () => {
    render(
      <FinanceSettings
        setting={{
          tax_invoice_serial_range_start: 100,
          tax_invoice_serial_range_end: 200,
          tax_invoice_serial_last_used: 0,
        }}
        canWrite={false}
      />,
    );

    const inputs = screen.getAllByTestId("number-input");
    inputs.forEach((input) => {
      expect(input).toBeDisabled();
    });
  });
  describe("Posting tab (separate discount cutover)", () => {
    const setting = {
      tax_invoice_serial_range_start: 0,
      tax_invoice_serial_range_end: 0,
      tax_invoice_serial_last_used: 0,
      discount_split_from_sales_invoice: "2026-12-01",
      discount_split_from_purchase_invoice: null,
    };

    it("renders one date input per document type with help text", async () => {
      render(<FinanceSettings setting={setting} canWrite={true} />);

      await userEvent.click(screen.getByRole("tab", { name: "Posting" }));

      expect(
        screen.getByTestId("finance-posting-settings"),
      ).toBeInTheDocument();
      expect(
        screen.getByText("Diskon Terpisah Sales Invoice Mulai"),
      ).toBeInTheDocument();
      expect(
        screen.getByText("Diskon Terpisah Purchase Invoice Mulai"),
      ).toBeInTheDocument();
      expect(translationMock).toHaveBeenCalledWith(
        "finances.setting.posting.discount_split_help",
        expect.any(String),
      );

      const inputs = screen.getAllByTestId("date-input");
      expect(inputs).toHaveLength(2);
      expect(inputs[0]).toHaveValue("2026-12-01");
      expect(inputs[1]).toHaveValue("");
    });

    it("sends the chosen date and null when cleared", async () => {
      setDataMock.mockClear();
      render(<FinanceSettings setting={setting} canWrite={true} />);

      await userEvent.click(screen.getByRole("tab", { name: "Posting" }));
      const clearButtons = screen.getAllByRole("button", {
        name: "clear-date",
      });
      await userEvent.click(clearButtons[0]);

      expect(setDataMock).toHaveBeenCalledWith(
        "discount_split_from_sales_invoice",
        null,
      );

      await userEvent.type(screen.getAllByTestId("date-input")[1], "2");
      expect(setDataMock).toHaveBeenCalledWith(
        "discount_split_from_purchase_invoice",
        "2",
      );
    });

    it("disables the date inputs when canWrite is false", async () => {
      render(<FinanceSettings setting={setting} canWrite={false} />);

      await userEvent.click(screen.getByRole("tab", { name: "Posting" }));

      screen.getAllByTestId("date-input").forEach((input) => {
        expect(input).toBeDisabled();
      });
    });
  });
});
