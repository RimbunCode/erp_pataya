import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";

// Show.jsx (CRM/Quotations) compose <FormPage><Form/></FormPage> dengan
// controls() render-prop. Logic UNIK:
// - controls: null kalau !quotation (create mode)
// - tombol "create sales order" muncul HANYA kalau isValidStatus(status)
//   DAN inArray(status, ["submitted"]) -- status HARUS persis "submitted"
// - disabled FormPage mengikuti quotation?.submitted_at
// - link ke salesOrders.create dengan ref quotation/{id}
//
// isValidStatus/inArray dari @/lib/utils TIDAK di-mock -- fungsi murni,
// dipakai asli supaya gating teruji end-to-end.

const stableT = (key) => key;
vi.mock("laravel-react-i18n", () => ({
  useLaravelReactI18n: () => ({ t: stableT }),
}));

vi.mock("@/Components/Link", () => ({
  default: ({ children, href, ...rest }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

vi.mock("./Form", () => ({
  default: () => <div data-testid="form-stub" />,
}));

vi.mock("@/Pages/Core/FormPage", () => ({
  FormPage: ({ isCreate, disabled, controls, children }) => (
    <div data-testid="stub-form-page">
      <div data-testid="form-page-meta">
        {JSON.stringify({ isCreate: !!isCreate, disabled: !!disabled })}
      </div>
      <div data-testid="form-page-controls">
        {typeof controls === "function" ? controls() : controls}
      </div>
      {children}
    </div>
  ),
}));

window.route = (name, params) =>
  params !== undefined ? `${name}/${JSON.stringify(params)}` : name;

import Show from "./Show";

describe("Show (CRM/Quotations)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("merender Form (black-box) di dalam FormPage", () => {
    render(<Show quotation={{ id: 1, status: "submitted" }} />);

    expect(screen.getByTestId("form-stub")).toBeInTheDocument();
  });

  it("isCreate true saat quotation tidak ada", () => {
    render(<Show quotation={null} />);

    expect(screen.getByTestId("form-page-meta")).toHaveTextContent(
      '"isCreate":true',
    );
  });

  it("disabled mengikuti quotation.submitted_at", () => {
    render(
      <Show
        quotation={{ id: 1, status: "submitted", submitted_at: "2026-08-01" }}
      />,
    );

    expect(screen.getByTestId("form-page-meta")).toHaveTextContent(
      '"disabled":true',
    );
  });

  it("create mode (quotation null): controls kosong", () => {
    render(<Show quotation={null} />);

    expect(screen.getByTestId("form-page-controls")).toBeEmptyDOMElement();
  });

  it("status submitted: tombol create_sales_order muncul dengan href ref quotation/{id}", () => {
    render(<Show quotation={{ id: 7, status: "submitted" }} />);

    const link = screen
      .getByText("crm.quotation.actions.create_sales_order")
      .closest("a");
    expect(link).toHaveAttribute(
      "href",
      `salesOrders.create/${JSON.stringify({ ref: "quotation/7" })}`,
    );
  });

  it("status draft (bukan submitted): tombol create_sales_order tidak muncul", () => {
    render(<Show quotation={{ id: 1, status: "draft" }} />);

    expect(
      screen.queryByText("crm.quotation.actions.create_sales_order"),
    ).not.toBeInTheDocument();
  });

  it("status canceled (invalid status walau submitted): tombol tidak muncul", () => {
    render(<Show quotation={{ id: 1, status: "canceled" }} />);

    expect(
      screen.queryByText("crm.quotation.actions.create_sales_order"),
    ).not.toBeInTheDocument();
  });

  it("status accepted (valid status tapi bukan 'submitted'): tombol tidak muncul", () => {
    render(<Show quotation={{ id: 1, status: "accepted" }} />);

    expect(
      screen.queryByText("crm.quotation.actions.create_sales_order"),
    ).not.toBeInTheDocument();
  });
});
