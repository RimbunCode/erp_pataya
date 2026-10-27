import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";

vi.mock("laravel-react-i18n", () => ({
  useLaravelReactI18n: () => ({ t: (key) => key }),
}));

const usePageMock = vi.fn();
vi.mock("@inertiajs/react", () => ({
  usePage: () => usePageMock(),
  router: { visit: vi.fn(), post: vi.fn() },
  // Deferred menampilkan fallback selama prop belum ada, lalu children setelah prop terisi.
  Deferred: ({ data, fallback, children }) => {
    const props = usePageMock().props;
    const loaded = data.every((key) => props[key] !== undefined);
    return loaded ? children : fallback;
  },
}));

// FormPageContent butuh konteks FormPage penuh (tab). Test ini hanya menguji
// isi tab, jadi wrapper diganti elemen region berlabel.
vi.mock("@/Pages/Core/FormPage", () => ({
  FormPageContent: ({ title, children }) => (
    <section aria-label={title}>{children}</section>
  ),
}));

window.route = (name, id) => `${name}/${id}`;

import RelationPanels from "./RelationPanels";

const panelA = {
  reference_type: "App\\Models\\Purchase\\PurchaseReceipt",
  title: "purchase.purchaseReceipt.panel.title",
  columns: [
    {
      key: "code",
      label: "purchase.purchaseReceipt.panel.code",
      align: "left",
    },
  ],
  rows: [{ id: "r1", code: "PR-001" }],
  totals: {},
  action: null,
  is_empty: false,
  route: "purchaseReceipts.show",
};

const panelB = {
  reference_type: "App\\Models\\Finances\\PurchaseInvoice",
  title: "purchase.purchaseOrder.panel.invoice.title",
  columns: [
    {
      key: "code",
      label: "purchase.purchaseOrder.panel.invoice.code",
      align: "left",
    },
  ],
  rows: [],
  totals: {},
  action: {
    url: "purchaseInvoices/create/purchaseOrder/po1",
    label: "purchase.purchaseOrder.actions.create_purchase_invoice",
  },
  is_empty: true,
  route: "purchaseInvoices.show",
};

describe("RelationPanels", () => {
  beforeEach(() => {
    usePageMock.mockReset();
  });

  it("menampilkan skeleton saat prop relationPanels belum ada", () => {
    usePageMock.mockReturnValue({
      props: { lang: "id", preferences: {} },
    });

    const { container } = render(<RelationPanels />);

    expect(
      screen.getByRole("region", { name: "core.form.relations" }),
    ).toBeInTheDocument();
    expect(container.querySelector(".animate-pulse")).not.toBeNull();
    expect(screen.queryByRole("heading")).not.toBeInTheDocument();
  });

  it("menampilkan satu kartu per panel saat prop relationPanels sudah terisi", () => {
    usePageMock.mockReturnValue({
      props: {
        lang: "id",
        preferences: {},
        relationPanels: [panelA, panelB],
      },
    });

    const { container } = render(<RelationPanels />);

    expect(
      screen.getByRole("heading", {
        name: "purchase.purchaseReceipt.panel.title",
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", {
        name: "purchase.purchaseOrder.panel.invoice.title",
      }),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "PR-001" })).toHaveAttribute(
      "href",
      "purchaseReceipts.show/r1",
    );
    expect(container.querySelector(".animate-pulse")).toBeNull();
  });
});
