import React from "react";
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";

import FinanceSettings from "./FinanceSettings";

const putMock = vi.fn();
const translationMock = vi.hoisted(() =>
  vi.fn((key, fallback) => fallback || key),
);

vi.mock("@inertiajs/react", async (importOriginal) => ({
  ...(await importOriginal()),
  Head: ({ title }) => <title>{title}</title>,
  useForm: (initial) => ({
    data: initial,
    setData: vi.fn(),
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
});
