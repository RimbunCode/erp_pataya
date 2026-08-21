import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";

// Show.jsx (Asset/ValueAdjustments) thin wrapper <FormPage><Form/></FormPage>.
// Logic yang diverifikasi: isCreate dari !assetValueAdjustment, disabled
// dari assetValueAdjustment?.submitted_at, ignoreDraft & defaultValues dari
// defaultData.

vi.mock("./Form", () => ({
  default: () => <div data-testid="form-stub" />,
}));

vi.mock("@/Pages/Core/FormPage", () => ({
  FormPage: ({ isCreate, disabled, submitable, ignoreDraft, defaultValues, children }) => (
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

describe("Show (Asset/ValueAdjustments)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("merender Form (black-box) di dalam FormPage", () => {
    render(<Show assetValueAdjustment={{ id: 1 }} />);

    expect(screen.getByTestId("form-stub")).toBeInTheDocument();
  });

  it("isCreate true, disabled false saat assetValueAdjustment tidak ada (tanpa crash walau tidak dikirim)", () => {
    render(<Show assetValueAdjustment={undefined} />);

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

  it("disabled true saat assetValueAdjustment.submitted_at ada", () => {
    render(
      <Show
        assetValueAdjustment={{ id: 1, submitted_at: "2026-08-01" }}
      />,
    );

    expect(screen.getByTestId("form-page-meta")).toHaveTextContent(
      '"disabled":true',
    );
  });

  it("ignoreDraft dan defaultValues diteruskan dari defaultData", () => {
    render(
      <Show
        assetValueAdjustment={null}
        defaultData={{ asset: { id: 1 } }}
      />,
    );

    expect(screen.getByTestId("form-page-meta")).toHaveTextContent(
      JSON.stringify({
        isCreate: true,
        disabled: false,
        submitable: true,
        ignoreDraft: true,
        defaultValues: { asset: { id: 1 } },
      }),
    );
  });
});
