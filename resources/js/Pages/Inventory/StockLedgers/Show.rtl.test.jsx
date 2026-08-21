import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";

// Show.jsx (Inventory/StockLedgers) compose <FormPage><Form/></FormPage>.
// Logic UNIK:
// - controls BUKAN render-prop function, melainkan JSX element langsung:
//   referenceable && <Button><Link href={route(`${referenceable.route}.show`, referenceable.id)}>...
// - FormPage selalu isCreate=false, disabled=true, deleteable=false,
//   sidebarContent=false, bottombarContent=false (statis, StockLedger
//   read-only murni, tidak pernah dibuat/dihapus dari sini)
// - route dinamis: nama route diambil dari referenceable.route (data),
//   bukan hardcode

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
  FormPage: ({
    isCreate,
    disabled,
    deleteable,
    sidebarContent,
    bottombarContent,
    controls,
    children,
  }) => (
    <div data-testid="stub-form-page">
      <div data-testid="form-page-meta">
        {JSON.stringify({
          isCreate: !!isCreate,
          disabled: !!disabled,
          deleteable: !!deleteable,
          sidebarContent: !!sidebarContent,
          bottombarContent: !!bottombarContent,
        })}
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

describe("Show (Inventory/StockLedgers)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("merender Form (black-box) di dalam FormPage", () => {
    render(<Show stockLedger={{ id: 1 }} />);

    expect(screen.getByTestId("form-stub")).toBeInTheDocument();
  });

  it("FormPage selalu read-only: isCreate false, disabled true, deleteable/sidebarContent/bottombarContent false", () => {
    render(<Show stockLedger={{ id: 1 }} />);

    expect(screen.getByTestId("form-page-meta")).toHaveTextContent(
      JSON.stringify({
        isCreate: false,
        disabled: true,
        deleteable: false,
        sidebarContent: false,
        bottombarContent: false,
      }),
    );
  });

  it("stockLedger tanpa referenceable: controls kosong", () => {
    render(<Show stockLedger={{ id: 1, referenceable: null }} />);

    expect(screen.getByTestId("form-page-controls")).toBeEmptyDOMElement();
  });

  it("stockLedger dengan referenceable: tombol view_reference muncul dengan href dinamis dari referenceable.route", () => {
    render(
      <Show
        stockLedger={{
          id: 1,
          referenceable: { route: "purchaseOrders", id: 42 },
        }}
      />,
    );

    const link = screen.getByText(
      "inventory.stockLedger.actions.view_reference",
    ).closest("a");
    expect(link).toHaveAttribute(
      "href",
      `purchaseOrders.show/${JSON.stringify(42)}`,
    );
  });

  it("referenceable dengan route berbeda (salesOrders): href mengikuti route yang sesuai", () => {
    render(
      <Show
        stockLedger={{
          id: 1,
          referenceable: { route: "salesOrders", id: 7 },
        }}
      />,
    );

    const link = screen.getByText(
      "inventory.stockLedger.actions.view_reference",
    ).closest("a");
    expect(link).toHaveAttribute(
      "href",
      `salesOrders.show/${JSON.stringify(7)}`,
    );
  });
});
