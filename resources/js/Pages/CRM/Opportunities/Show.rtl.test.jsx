import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";

// Show.jsx (CRM/Opportunities) compose <FormPage><Form/></FormPage> dengan
// controls() render-prop. Logic UNIK (lebih sederhana dari Leads/Quotations --
// tidak ada gating status/permission):
// - isCreate: !opportunity
// - controls: null kalau !opportunity (create mode)
// - ada opportunity: tombol "create_quotation" muncul, link ke
//   quotations.create dengan ref opportunity/{id} -- TIDAK ada gating status
//   sama sekali, selama opportunity ada tombol selalu muncul

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
  FormPage: ({ isCreate, controls, children }) => (
    <div data-testid="stub-form-page">
      <div data-testid="form-page-meta">
        {JSON.stringify({ isCreate: !!isCreate })}
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

describe("Show (CRM/Opportunities)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("merender Form (black-box) di dalam FormPage", () => {
    render(<Show opportunity={{ id: 1 }} defaultData={{}} />);

    expect(screen.getByTestId("form-stub")).toBeInTheDocument();
  });

  it("isCreate true saat opportunity tidak ada", () => {
    render(<Show opportunity={null} defaultData={{}} />);

    expect(screen.getByTestId("form-page-meta")).toHaveTextContent(
      JSON.stringify({ isCreate: true }),
    );
  });

  it("isCreate false saat opportunity ada", () => {
    render(<Show opportunity={{ id: 1 }} defaultData={{}} />);

    expect(screen.getByTestId("form-page-meta")).toHaveTextContent(
      JSON.stringify({ isCreate: false }),
    );
  });

  it("create mode (opportunity null): controls kosong", () => {
    render(<Show opportunity={null} defaultData={{}} />);

    expect(screen.getByTestId("form-page-controls")).toBeEmptyDOMElement();
  });

  it("ada opportunity: tombol create_quotation muncul dengan href ref opportunity/{id}", () => {
    render(<Show opportunity={{ id: 7 }} defaultData={{}} />);

    const link = screen
      .getByText("crm.opportunity.create_quotation")
      .closest("a");
    expect(link).toHaveAttribute(
      "href",
      `quotations.create/${JSON.stringify({ ref: "opportunity/7" })}`,
    );
  });

  it("tombol create_quotation tetap muncul apapun field lain di opportunity (tidak ada gating status)", () => {
    render(
      <Show
        opportunity={{ id: 3, status: "lost" }}
        defaultData={{}}
      />,
    );

    expect(
      screen.getByText("crm.opportunity.create_quotation"),
    ).toBeInTheDocument();
  });
});
