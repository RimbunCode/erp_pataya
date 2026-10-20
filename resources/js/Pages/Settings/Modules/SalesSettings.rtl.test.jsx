import React from "react";
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";

import SalesSettings from "./SalesSettings";

const putMock = vi.fn();
const translationMock = vi.hoisted(() => vi.fn((key, fallback) => fallback || key));

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

vi.mock("@/Pages/Finances/Taxes/TaxLinkModel", () => ({
  default: ({ value, disabled }) => (
    <input
      data-testid="tax-link-model"
      value={value || ""}
      disabled={disabled}
      onChange={() => {}}
    />
  ),
}));

describe("SalesSettings RTL", () => {
  it("renders sales settings page with default tax input", () => {
    render(
      <SalesSettings
        setting={{
          default_tax_id: "01TAXID",
        }}
        canWrite={true}
      />,
    );

    expect(screen.getByTestId("sales-settings-form")).toBeInTheDocument();
    expect(screen.getByText("Sales Settings")).toBeInTheDocument();
    expect(translationMock).toHaveBeenCalledWith("sales.setting.title", "Sales Settings");
    expect(translationMock).toHaveBeenCalledWith("sales.setting.default.title", "Default");
    expect(translationMock).toHaveBeenCalledWith("sales.setting.default_tax", "Default Tax");
    expect(screen.getByTestId("tax-link-model")).toBeInTheDocument();
    expect(screen.getByTestId("tax-link-model")).not.toBeDisabled();
  });

  it("disables tax link model input when canWrite is false", () => {
    render(
      <SalesSettings
        setting={{
          default_tax_id: "01TAXID",
        }}
        canWrite={false}
      />,
    );

    expect(screen.getByTestId("tax-link-model")).toBeDisabled();
  });
});
