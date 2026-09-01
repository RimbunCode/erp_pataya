import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";

// Show.jsx (Core/Todos) compose <FormPage><Form/>{referensi}</FormPage>.
// Logic UNIK yang jadi fokus:
// - blok referensi hanya render kalau todo?.reference_type ada
// - di dalam blok: referenceRoute && referenceLabel (dari usePage().props)
//   -> tampilkan Link ke route(referenceRoute, todo.reference_id) dengan
//      teks referenceLabel; else -> pesan "reference_deleted"

const stableT = (key) => key;
vi.mock("laravel-react-i18n", () => ({
  useLaravelReactI18n: () => ({ t: stableT }),
}));

const usePageMock = vi.fn();
vi.mock("@inertiajs/react", () => ({
  usePage: () => usePageMock(),
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
  FormPage: ({ isCreate, ignoreDraft, defaultValues, children }) => (
    <div data-testid="stub-form-page">
      <div data-testid="form-page-meta">
        {JSON.stringify({
          isCreate: !!isCreate,
          ignoreDraft: !!ignoreDraft,
          defaultValues: defaultValues ?? null,
        })}
      </div>
      {children}
    </div>
  ),
}));

window.route = (name, params) =>
  params !== undefined ? `${name}/${JSON.stringify(params)}` : name;

import Show from "./Show";

function renderShow({
  todo,
  defaultData,
  referenceRoute,
  referenceLabel,
} = {}) {
  usePageMock.mockReturnValue({ props: { referenceRoute, referenceLabel } });
  return render(<Show todo={todo} defaultData={defaultData} />);
}

describe("Show (Core/Todos)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("merender Form (black-box) di dalam FormPage", () => {
    renderShow({ todo: { id: 1 } });

    expect(screen.getByTestId("form-stub")).toBeInTheDocument();
  });

  it("isCreate true saat todo tidak ada", () => {
    renderShow({ todo: null });

    expect(screen.getByTestId("form-page-meta")).toHaveTextContent(
      '"isCreate":true',
    );
  });

  it("ignoreDraft dan defaultValues diteruskan dari defaultData", () => {
    renderShow({ todo: null, defaultData: { title: "Draft awal" } });

    expect(screen.getByTestId("form-page-meta")).toHaveTextContent(
      JSON.stringify({
        isCreate: true,
        ignoreDraft: true,
        defaultValues: { title: "Draft awal" },
      }),
    );
  });

  it("todo tanpa reference_type: blok referensi tidak dirender", () => {
    renderShow({ todo: { id: 1, reference_type: null } });

    expect(
      screen.queryByText("core.todo.columns.reference"),
    ).not.toBeInTheDocument();
  });

  it("reference_type ada + referenceRoute & referenceLabel tersedia: tampilkan Link", () => {
    renderShow({
      todo: { id: 1, reference_type: "PurchaseOrder", reference_id: 9 },
      referenceRoute: "purchaseOrders.show",
      referenceLabel: "PO-0001",
    });

    expect(screen.getByText("core.todo.columns.reference")).toBeInTheDocument();
    const link = screen.getByText("PO-0001");
    expect(link.closest("a")).toHaveAttribute(
      "href",
      `purchaseOrders.show/${JSON.stringify(9)}`,
    );
  });

  it("reference_type ada tapi referenceRoute/referenceLabel kosong: tampilkan pesan reference_deleted", () => {
    renderShow({
      todo: { id: 1, reference_type: "PurchaseOrder", reference_id: 9 },
      referenceRoute: null,
      referenceLabel: null,
    });

    expect(screen.getByText("core.todo.reference_deleted")).toBeInTheDocument();
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
  });

  it("reference_type ada, referenceRoute ada tapi referenceLabel kosong: tetap tampilkan pesan reference_deleted (butuh KEDUANYA)", () => {
    renderShow({
      todo: { id: 1, reference_type: "PurchaseOrder", reference_id: 9 },
      referenceRoute: "purchaseOrders.show",
      referenceLabel: null,
    });

    expect(screen.getByText("core.todo.reference_deleted")).toBeInTheDocument();
  });
});
