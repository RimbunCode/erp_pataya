import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

vi.mock("laravel-react-i18n", () => ({
  useLaravelReactI18n: () => ({ t: (key) => key }),
}));

const usePageMock = vi.fn();
vi.mock("@inertiajs/react", () => ({
  usePage: () => usePageMock(),
  router: { visit: vi.fn(), post: vi.fn() },
}));

window.route = (name, id) => `${name}/${id}`;

import RelationPanel from "./RelationPanel";

const RECEIPT_COLUMNS = [
  { key: "code", label: "purchase.purchaseReceipt.panel.code", align: "left" },
  {
    key: "date",
    label: "purchase.purchaseReceipt.panel.date",
    align: "left",
    format: "date",
  },
  {
    key: "total_quantity",
    label: "purchase.purchaseReceipt.panel.quantity",
    align: "right",
    format: "number",
    aggregate: "sum",
  },
];

const filledPanel = {
  reference_type: "App\\Models\\Purchase\\PurchaseReceipt",
  title: "purchase.purchaseReceipt.panel.title",
  columns: RECEIPT_COLUMNS,
  rows: [
    {
      id: "r1",
      code: "PR-001",
      date: "2026-10-01T00:00:00.000000Z",
      total_quantity: 3,
    },
    {
      id: "r2",
      code: "PR-002",
      date: "2026-10-05T00:00:00.000000Z",
      total_quantity: 5,
    },
  ],
  totals: { total_quantity: 8 },
  action: null,
  is_empty: false,
  route: "purchaseReceipts.show",
};

const emptyPanelWithAction = {
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

describe("RelationPanel", () => {
  beforeEach(() => {
    usePageMock.mockReturnValue({
      props: {
        lang: "id",
        preferences: { default_number_format: "#.###,##" },
      },
    });
  });

  it("merender judul, header kolom, dan baris dengan angka sesuai format company", () => {
    render(<RelationPanel panel={filledPanel} />);

    expect(
      screen.getByRole("heading", {
        name: "purchase.purchaseReceipt.panel.title",
      }),
    ).toBeInTheDocument();

    const table = screen.getByRole("table");
    expect(
      within(table).getByRole("columnheader", {
        name: "purchase.purchaseReceipt.panel.quantity",
      }),
    ).toBeInTheDocument();

    expect(within(table).getByText("3,00")).toBeInTheDocument();
    expect(within(table).getByText("5,00")).toBeInTheDocument();
  });

  it("kolom pertama menjadi tautan ke route baris", () => {
    render(<RelationPanel panel={filledPanel} />);

    expect(screen.getByRole("link", { name: "PR-001" })).toHaveAttribute(
      "href",
      "purchaseReceipts.show/r1",
    );
    expect(screen.getByRole("link", { name: "PR-002" })).toHaveAttribute(
      "href",
      "purchaseReceipts.show/r2",
    );
  });

  it("menampilkan baris total dengan nilai agregat hanya di kolom yang punya aggregate", () => {
    render(<RelationPanel panel={filledPanel} />);

    const table = screen.getByRole("table");
    // 1 header + 2 baris data + 1 baris total
    expect(within(table).getAllByRole("row")).toHaveLength(4);
    expect(within(table).getByText("8,00")).toBeInTheDocument();
  });

  it("kolom status menampilkan satu badge per status dari array", () => {
    const statusPanel = {
      ...filledPanel,
      columns: [
        {
          key: "code",
          label: "purchase.purchaseReceipt.panel.code",
          align: "left",
        },
        {
          key: "status",
          label: "purchase.purchaseReceipt.panel.status",
          align: "left",
          format: "status",
        },
      ],
      rows: [{ id: "r1", code: "PR-001", status: ["submitted", "received"] }],
      totals: {},
    };

    render(<RelationPanel panel={statusPanel} />);

    const table = screen.getByRole("table");
    expect(within(table).getByText("status.submitted")).toBeInTheDocument();
    expect(within(table).getByText("status.received")).toBeInTheDocument();
  });

  it("tidak menampilkan baris total bila panel tidak punya kolom aggregate", () => {
    const panelWithoutAggregate = {
      ...filledPanel,
      columns: RECEIPT_COLUMNS.map(
        ({ aggregate: _aggregate, ...column }) => column,
      ),
      totals: {},
    };

    render(<RelationPanel panel={panelWithoutAggregate} />);

    const table = screen.getByRole("table");
    expect(within(table).getAllByRole("row")).toHaveLength(3);
  });

  it("empty state dengan tombol aksi menampilkan tautan ke halaman pembuatan dokumen", () => {
    render(<RelationPanel panel={emptyPanelWithAction} />);

    expect(screen.getByText("core.form.relation_empty")).toBeInTheDocument();
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
    expect(
      screen.getByRole("link", {
        name: "purchase.purchaseOrder.actions.create_purchase_invoice",
      }),
    ).toHaveAttribute("href", "purchaseInvoices/create/purchaseOrder/po1");
  });

  it("empty state tanpa aksi hanya menampilkan teks kosong", () => {
    const emptyPanelWithoutAction = { ...emptyPanelWithAction, action: null };

    render(<RelationPanel panel={emptyPanelWithoutAction} />);

    expect(screen.getByText("core.form.relation_empty")).toBeInTheDocument();
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
  });

  describe("rincian per baris dan sisa", () => {
    const detailPanel = {
      ...filledPanel,
      detail_columns: [
        {
          key: "item",
          label: "purchase.purchaseReceipt.columns.item",
          align: "left",
        },
        {
          key: "quantity",
          label: "purchase.purchaseReceipt.columns.quantity",
          align: "right",
          format: "number",
        },
      ],
      rows: [
        {
          ...filledPanel.rows[0],
          detail_rows: [{ item: "Kertas A4", quantity: 2 }],
        },
        { ...filledPanel.rows[1], detail_rows: [] },
      ],
    };

    const remainder = {
      title: "purchase.purchaseOrder.panel.receipt.remainder",
      columns: [
        {
          key: "item",
          label: "purchase.purchaseOrder.columns.item",
          align: "left",
        },
        {
          key: "remaining",
          label: "purchase.purchaseOrder.panel.remaining",
          align: "right",
          format: "number",
        },
      ],
      rows: [{ item: "Map", remaining: 6 }],
    };

    it("baris dengan rincian dapat dibuka dan ditutup", async () => {
      const user = userEvent.setup({ delay: null });
      render(<RelationPanel panel={detailPanel} />);

      expect(screen.queryByText("Kertas A4")).not.toBeInTheDocument();

      await user.click(
        screen.getByRole("button", { name: "core.form.show_more" }),
      );
      expect(screen.getByText("Kertas A4")).toBeInTheDocument();
      expect(
        screen.getByRole("columnheader", {
          name: "purchase.purchaseReceipt.columns.item",
        }),
      ).toBeInTheDocument();

      await user.click(
        screen.getByRole("button", { name: "core.form.show_less" }),
      );
      expect(screen.queryByText("Kertas A4")).not.toBeInTheDocument();
    });

    it("baris tanpa rincian tidak punya kontrol buka", () => {
      render(<RelationPanel panel={detailPanel} />);

      // Hanya baris pertama yang punya rincian, jadi hanya satu kontrol.
      expect(
        screen.getAllByRole("button", { name: "core.form.show_more" }),
      ).toHaveLength(1);
    });

    it("blok sisa muncul bila ada dan hilang bila tidak ada", () => {
      const { rerender } = render(
        <RelationPanel panel={{ ...filledPanel, remainder }} />,
      );

      expect(
        screen.getByRole("heading", {
          name: "purchase.purchaseOrder.panel.receipt.remainder",
        }),
      ).toBeInTheDocument();
      expect(screen.getByText("Map")).toBeInTheDocument();
      expect(screen.getByText("6,00")).toBeInTheDocument();

      rerender(<RelationPanel panel={filledPanel} />);

      expect(
        screen.queryByRole("heading", {
          name: "purchase.purchaseOrder.panel.receipt.remainder",
        }),
      ).not.toBeInTheDocument();
    });
  });
});
