import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";

// Show.jsx (Settings/ApprovalScheme) thin wrapper <FormPage><Form/></FormPage>.
// Logic yang diverifikasi: isCreate derivation dari !approvalScheme.

vi.mock("./Form", () => ({
  default: () => <div data-testid="form-stub" />,
}));

vi.mock("@/Pages/Core/FormPage", () => ({
  FormPage: ({ isCreate, children }) => (
    <div data-testid="stub-form-page">
      <div data-testid="form-page-meta">
        {JSON.stringify({ isCreate: !!isCreate })}
      </div>
      {children}
    </div>
  ),
}));

import Show from "./Show";

describe("Show (Settings/ApprovalScheme)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("merender Form (black-box) di dalam FormPage", () => {
    render(<Show approvalScheme={{ id: 1 }} />);

    expect(screen.getByTestId("form-stub")).toBeInTheDocument();
  });

  it("isCreate true saat approvalScheme tidak ada", () => {
    render(<Show approvalScheme={null} />);

    expect(screen.getByTestId("form-page-meta")).toHaveTextContent(
      '"isCreate":true',
    );
  });

  it("isCreate false saat approvalScheme ada", () => {
    render(<Show approvalScheme={{ id: 1 }} />);

    expect(screen.getByTestId("form-page-meta")).toHaveTextContent(
      '"isCreate":false',
    );
  });
});
