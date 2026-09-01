import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";

// Show.jsx (Finances/PaymentEntries) thin wrapper <FormPage><Form/></FormPage>.
// Logic yang diverifikasi: isCreate dari !paymentEntry, disabled dari
// paymentEntry?.submitted_at, ignoreDraft & defaultValues dari defaultData.

vi.mock("./Form", () => ({
  default: () => <div data-testid="form-stub" />,
}));

vi.mock("@/Pages/Core/FormPage", () => ({
  FormPage: ({
    isCreate,
    disabled,
    submitable,
    ignoreDraft,
    defaultValues,
    children,
  }) => (
    <div data-testid="stub-form-page">
      <div data-testid="form-page-meta">
        {JSON.stringify({
          isCreate: !!isCreate,
          disabled: !!disabled,
          submitable: !!submitable,
          ignoreDraft: !!ignoreDraft,
          defaultValues: defaultValues ?? null,
        })}
      </div>
      {children}
    </div>
  ),
}));

import Show from "./Show";

describe("Show (Finances/PaymentEntries)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("merender Form (black-box) di dalam FormPage", () => {
    render(<Show paymentEntry={{ id: 1 }} />);

    expect(screen.getByTestId("form-stub")).toBeInTheDocument();
  });

  it("isCreate true, disabled false saat paymentEntry tidak ada (tanpa crash walau tidak dikirim)", () => {
    render(<Show paymentEntry={undefined} />);

    expect(screen.getByTestId("form-page-meta")).toHaveTextContent(
      JSON.stringify({
        isCreate: true,
        disabled: false,
        submitable: true,
        ignoreDraft: false,
        defaultValues: null,
      }),
    );
  });

  it("disabled true saat paymentEntry.submitted_at ada", () => {
    render(<Show paymentEntry={{ id: 1, submitted_at: "2026-08-01" }} />);

    expect(screen.getByTestId("form-page-meta")).toHaveTextContent(
      '"disabled":true',
    );
  });

  it("ignoreDraft dan defaultValues diteruskan dari defaultData", () => {
    render(
      <Show paymentEntry={null} defaultData={{ payment_type: "receive" }} />,
    );

    expect(screen.getByTestId("form-page-meta")).toHaveTextContent(
      JSON.stringify({
        isCreate: true,
        disabled: false,
        submitable: true,
        ignoreDraft: true,
        defaultValues: { payment_type: "receive" },
      }),
    );
  });
});
