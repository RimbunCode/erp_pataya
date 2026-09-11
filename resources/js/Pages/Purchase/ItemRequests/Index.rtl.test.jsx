import { beforeEach, describe, expect, it, vi } from "vitest";
import { render as rtlRender, screen, waitFor } from "@testing-library/react";

import userEvent from "@testing-library/user-event";
import { TooltipProvider } from "@/Components/ui/tooltip";

// MultiSelect membungkus dirinya dengan <Tooltip> internal (ringkasan value
// terpilih saat popover tertutup) tanpa menyediakan <TooltipProvider>
// sendiri -- provider itu disediakan sekali di app-level (MasterLayout.jsx),
// tapi `@/Layouts/AppLayout` di-mock jadi div polos di atas, jadi provider
// asli gak ikut ke-mount. Sediakan di sini, pola sama MultiSelect.rtl.test.jsx.
const render = (ui) =>
  rtlRender(<TooltipProvider delayDuration={0}>{ui}</TooltipProvider>);

vi.mock("laravel-react-i18n", () => ({
  useLaravelReactI18n: () => ({ t: (key) => key }),
}));

const routerGet = vi.fn();
const routerPost = vi.fn();
let pageProps = { auth: { user: { id: "u1" } }, permissions: {} };
vi.mock("@inertiajs/react", () => ({
  router: {
    get: (...args) => routerGet(...args),
    post: (...args) => routerPost(...args),
  },
  usePage: () => ({ props: pageProps }),
  Head: ({ title }) => <title>{title}</title>,
  Link: ({ href, children, ...props }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

vi.mock("@/Layouts/AppLayout", () => ({
  default: ({ children, actions }) => (
    <div>
      <div data-testid="actions">{actions}</div>
      {children}
    </div>
  ),
}));

vi.mock("@/Components/Table/Pagination", () => ({
  default: () => <div data-testid="pagination" />,
}));

import Index from "./Index";

window.route = (name) => name;

const filterOptions = {
  warehouses: [
    { id: "wh-1", name: "Warehouse 1" },
    { id: "wh-2", name: "Warehouse 2" },
  ],
  branches: [{ id: "br-1", name: "Branch 1" }],
  sourceTypes: [{ value: "sales_order", label: "Sales Order" }],
};

const documentModels = {
  purchaseRequest: "App\\Models\\Purchase\\PurchaseRequest",
  purchaseOrder: "App\\Models\\Purchase\\PurchaseOrder",
};

function permissionsFor(model, action = "create") {
  return {
    [model]: { 0: [{ permissions: { [action]: true }, only_creator: false }] },
  };
}

function makeRow(overrides = {}) {
  return {
    source_type: "App\\Models\\Sales\\SalesOrderItem",
    source_id: "so-item-1",
    source_label: "sales_order",
    item_name: "Widget A",
    warehouse_names: ["Warehouse 1"],
    branch_name: "Branch 1",
    required_quantity: 10,
    covered_quantity: 0,
    available_quantity: 3,
    shortage_quantity: 7,
    ...overrides,
  };
}

describe("Purchase/ItemRequests Index", () => {
  beforeEach(() => {
    routerGet.mockClear();
    routerPost.mockClear();
    pageProps = {
      auth: { user: { id: "u1" } },
      permissions: {
        ...permissionsFor(documentModels.purchaseRequest),
        ...permissionsFor(documentModels.purchaseOrder),
      },
    };
  });

  it("menampilkan pesan kosong saat tidak ada baris shortage", () => {
    render(
      <Index
        rows={{ data: [], current_page: 1, last_page: 1 }}
        filterOptions={filterOptions}
        appliedFilters={{}}
      />,
    );

    expect(screen.getByText("purchase.itemRequest.empty")).toBeInTheDocument();
  });

  it("menampilkan baris shortage dari props", () => {
    render(
      <Index
        rows={{ data: [makeRow()], current_page: 1, last_page: 1 }}
        filterOptions={filterOptions}
        appliedFilters={{}}
      />,
    );

    expect(screen.getByText("Widget A")).toBeInTheDocument();
    expect(screen.getByText("7")).toBeInTheDocument();
  });

  it("tombol Buat PR & trigger dropdown disabled saat belum ada baris terpilih", () => {
    render(
      <Index
        rows={{ data: [makeRow()], current_page: 1, last_page: 1 }}
        filterOptions={filterOptions}
        appliedFilters={{}}
        documentModels={documentModels}
      />,
    );

    expect(
      screen.getByRole("button", {
        name: /purchase.itemRequest.actions.createPurchaseRequest/,
      }),
    ).toBeDisabled();
    expect(
      screen.getByRole("button", {
        name: "purchase.itemRequest.actions.moreActions",
      }),
    ).toBeDisabled();
  });

  it("centang baris mengaktifkan tombol, lalu klik Buat PR memanggil router.post dengan payload benar", async () => {
    const user = userEvent.setup();
    const row = makeRow();
    render(
      <Index
        rows={{ data: [row], current_page: 1, last_page: 1 }}
        filterOptions={filterOptions}
        appliedFilters={{}}
        documentModels={documentModels}
      />,
    );

    await user.click(
      screen.getByRole("forminput", {
        name: "purchase.itemRequest.selectRow",
      }),
    );

    const createPrButton = screen.getByRole("button", {
      name: /purchase.itemRequest.actions.createPurchaseRequest/,
    });
    expect(createPrButton).toBeEnabled();

    await user.click(createPrButton);

    expect(routerPost).toHaveBeenCalledTimes(1);
    expect(routerPost).toHaveBeenCalledWith("itemRequests.stageBatch", {
      document_type: "purchaseRequest",
      selections: [
        {
          source_type: row.source_type,
          source_id: row.source_id,
          quantity: row.shortage_quantity,
        },
      ],
    });
  });

  it("centang baris, buka dropdown, klik Buat PO memanggil router.post dengan document_type purchaseOrder", async () => {
    const user = userEvent.setup();
    const row = makeRow();
    render(
      <Index
        rows={{ data: [row], current_page: 1, last_page: 1 }}
        filterOptions={filterOptions}
        appliedFilters={{}}
        documentModels={documentModels}
      />,
    );

    await user.click(
      screen.getByRole("forminput", {
        name: "purchase.itemRequest.selectRow",
      }),
    );
    await user.click(
      screen.getByRole("button", {
        name: "purchase.itemRequest.actions.moreActions",
      }),
    );
    await user.click(
      await screen.findByRole("menuitem", {
        name: /purchase.itemRequest.actions.createPurchaseOrder/,
      }),
    );

    expect(routerPost).toHaveBeenCalledWith(
      "itemRequests.stageBatch",
      expect.objectContaining({ document_type: "purchaseOrder" }),
    );
  });

  it("kolom source jadi link ke halaman show kalau user punya izin read", () => {
    pageProps = {
      auth: { user: { id: "u1" } },
      permissions: {
        "App\\Models\\Sales\\SalesOrder": {
          0: [{ permissions: { read: true }, only_creator: false }],
        },
      },
    };
    const row = makeRow({
      source_document: {
        id: "so-1",
        code: "SO-0001",
        thisModel: "App\\Models\\Sales\\SalesOrder",
        route: "salesOrders",
      },
    });
    render(
      <Index
        rows={{ data: [row], current_page: 1, last_page: 1 }}
        filterOptions={filterOptions}
        appliedFilters={{}}
      />,
    );

    const link = screen.getByRole("link", { name: "SO-0001" });
    expect(link).toHaveAttribute("href", "salesOrders.show");
  });

  it("kolom source tampil teks kode saja (tanpa link) kalau user tidak punya izin read", () => {
    const row = makeRow({
      source_document: {
        id: "so-1",
        code: "SO-0001",
        thisModel: "App\\Models\\Sales\\SalesOrder",
        route: "salesOrders",
      },
    });
    render(
      <Index
        rows={{ data: [row], current_page: 1, last_page: 1 }}
        filterOptions={filterOptions}
        appliedFilters={{}}
      />,
    );

    expect(screen.getByText("SO-0001")).toBeInTheDocument();
    expect(
      screen.queryByRole("link", { name: "SO-0001" }),
    ).not.toBeInTheDocument();
  });

  it("kolom item jadi link ke halaman show ItemVariant kalau user punya izin read", () => {
    pageProps = {
      auth: { user: { id: "u1" } },
      permissions: {
        "App\\Models\\Inventory\\ItemVariant": {
          0: [{ permissions: { read: true }, only_creator: false }],
        },
      },
    };
    const row = makeRow({
      item_document: {
        id: "iv-1",
        thisModel: "App\\Models\\Inventory\\ItemVariant",
        route: "itemVariants",
      },
    });
    render(
      <Index
        rows={{ data: [row], current_page: 1, last_page: 1 }}
        filterOptions={filterOptions}
        appliedFilters={{}}
      />,
    );

    const link = screen.getByRole("link", { name: "Widget A" });
    expect(link).toHaveAttribute("href", "itemVariants.show");
  });

  it("kolom branch jadi link ke halaman show Branch kalau user punya izin read", () => {
    pageProps = {
      auth: { user: { id: "u1" } },
      permissions: {
        "App\\Models\\Core\\Branch": {
          0: [{ permissions: { read: true }, only_creator: false }],
        },
      },
    };
    const row = makeRow({
      branch_document: {
        id: "br-1",
        thisModel: "App\\Models\\Core\\Branch",
        route: "branches",
      },
    });
    render(
      <Index
        rows={{ data: [row], current_page: 1, last_page: 1 }}
        filterOptions={filterOptions}
        appliedFilters={{}}
      />,
    );

    const link = screen.getByRole("link", { name: "Branch 1" });
    expect(link).toHaveAttribute("href", "branches.show");
  });

  it("kolom warehouse render link per-warehouse independen (bisa campur: satu linkable, satu tidak)", () => {
    pageProps = {
      auth: { user: { id: "u1" } },
      permissions: {
        "App\\Models\\Inventory\\Warehouse": {
          0: [{ permissions: { read: true }, only_creator: false }],
        },
      },
    };
    const row = makeRow({
      warehouse_names: ["Warehouse Visible", "Warehouse Hidden"],
      warehouse_documents: [
        {
          id: "wh-visible",
          thisModel: "App\\Models\\Inventory\\Warehouse",
          route: "warehouses",
        },
        null,
      ],
    });
    render(
      <Index
        rows={{ data: [row], current_page: 1, last_page: 1 }}
        filterOptions={filterOptions}
        appliedFilters={{}}
      />,
    );

    const link = screen.getByRole("link", { name: "Warehouse Visible" });
    expect(link).toHaveAttribute("href", "warehouses.show");
    expect(screen.getByText("Warehouse Hidden")).toBeInTheDocument();
    expect(
      screen.queryByRole("link", { name: "Warehouse Hidden" }),
    ).not.toBeInTheDocument();
  });

  it("hanya izin create PurchaseRequest -> cuma tombol Buat PR tunggal, tanpa dropdown/Buat PO", () => {
    pageProps = {
      auth: { user: { id: "u1" } },
      permissions: permissionsFor(documentModels.purchaseRequest),
    };
    render(
      <Index
        rows={{ data: [makeRow()], current_page: 1, last_page: 1 }}
        filterOptions={filterOptions}
        appliedFilters={{}}
        documentModels={documentModels}
      />,
    );

    expect(
      screen.getByRole("button", {
        name: /purchase.itemRequest.actions.createPurchaseRequest/,
      }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", {
        name: "purchase.itemRequest.actions.moreActions",
      }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByText(/purchase.itemRequest.actions.createPurchaseOrder/),
    ).not.toBeInTheDocument();
  });

  it("hanya izin create PurchaseOrder -> cuma tombol Buat PO tunggal, tanpa Buat PR", () => {
    pageProps = {
      auth: { user: { id: "u1" } },
      permissions: permissionsFor(documentModels.purchaseOrder),
    };
    render(
      <Index
        rows={{ data: [makeRow()], current_page: 1, last_page: 1 }}
        filterOptions={filterOptions}
        appliedFilters={{}}
        documentModels={documentModels}
      />,
    );

    expect(
      screen.getByRole("button", {
        name: /purchase.itemRequest.actions.createPurchaseOrder/,
      }),
    ).toBeInTheDocument();
    expect(
      screen.queryByText(/purchase.itemRequest.actions.createPurchaseRequest/),
    ).not.toBeInTheDocument();
  });

  it("tanpa izin create PR maupun PO -> tidak ada tombol Buat PR/PO sama sekali", () => {
    pageProps = { auth: { user: { id: "u1" } }, permissions: {} };
    render(
      <Index
        rows={{ data: [makeRow()], current_page: 1, last_page: 1 }}
        filterOptions={filterOptions}
        appliedFilters={{}}
        documentModels={documentModels}
      />,
    );

    expect(
      screen.queryByText(/purchase.itemRequest.actions.createPurchaseRequest/),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByText(/purchase.itemRequest.actions.createPurchaseOrder/),
    ).not.toBeInTheDocument();
  });

  describe("filter MultiSelect -- changeOnBlur + debounce", () => {
    // Real timers + waitFor (act()-aware) -- fake timers macet dgn
    // scheduler internal Radix/cmdk (lihat memory project: vi.waitFor gak
    // act()-aware, tapi fake timers + userEvent juga rawan hang di sini).
    // Delay debounce beneran (FILTER_DEBOUNCE_MS = 1500ms) ditunggu nyata.

    it("pilih 1 opsi TIDAK langsung panggil router.get -- baru setelah popover ditutup & debounce lewat", async () => {
      const user = userEvent.setup();
      render(
        <Index
          rows={{ data: [], current_page: 1, last_page: 1 }}
          filterOptions={filterOptions}
          appliedFilters={{}}
        />,
      );

      await user.click(
        screen.getByPlaceholderText("purchase.itemRequest.filters.warehouse"),
      );
      await user.click(screen.getByText("Warehouse 1"));

      // changeOnBlur: belum ditutup -> belum ada onValueChange -> belum ada fetch.
      expect(routerGet).not.toHaveBeenCalled();

      await user.click(document.body);
      // debounce: baru fetch setelah FILTER_DEBOUNCE_MS lewat.
      expect(routerGet).not.toHaveBeenCalled();

      await waitFor(
        () =>
          expect(routerGet).toHaveBeenCalledWith(
            "itemRequests.index",
            expect.objectContaining({ warehouse_ids: ["wh-1"], page: 1 }),
            expect.objectContaining({ preserveState: true, replace: true }),
          ),
        { timeout: 3000 },
      );
    }, 10000);

    it("klik All lalu tutup popover -> router.get dgn seluruh id warehouse, label All kustom per-domain", async () => {
      const user = userEvent.setup();
      render(
        <Index
          rows={{ data: [], current_page: 1, last_page: 1 }}
          filterOptions={filterOptions}
          appliedFilters={{}}
        />,
      );

      await user.click(
        screen.getByPlaceholderText("purchase.itemRequest.filters.warehouse"),
      );
      await user.click(
        screen.getByText("purchase.itemRequest.filters.allWarehouses"),
      );
      await user.click(document.body);

      await waitFor(
        () =>
          expect(routerGet).toHaveBeenCalledWith(
            "itemRequests.index",
            expect.objectContaining({
              warehouse_ids: ["wh-1", "wh-2"],
              page: 1,
            }),
            expect.objectContaining({ preserveState: true, replace: true }),
          ),
        { timeout: 3000 },
      );
    }, 10000);

    it("ubah 2 filter berbeda (Warehouse lalu Branch) dalam window debounce -> DIGABUNG jadi 1 request, bukan 2", async () => {
      const user = userEvent.setup();
      render(
        <Index
          rows={{ data: [], current_page: 1, last_page: 1 }}
          filterOptions={filterOptions}
          appliedFilters={{}}
        />,
      );

      await user.click(
        screen.getByPlaceholderText("purchase.itemRequest.filters.warehouse"),
      );
      await user.click(screen.getByText("Warehouse 1"));
      await user.click(document.body);

      await user.click(
        screen.getByPlaceholderText("purchase.itemRequest.filters.branch"),
      );
      await user.click(screen.getByText("Branch 1"));
      await user.click(document.body);

      expect(routerGet).not.toHaveBeenCalled();

      await waitFor(() => expect(routerGet).toHaveBeenCalledTimes(1), {
        timeout: 3000,
      });
      expect(routerGet).toHaveBeenCalledWith(
        "itemRequests.index",
        expect.objectContaining({
          warehouse_ids: ["wh-1"],
          branch_ids: ["br-1"],
          page: 1,
        }),
        expect.objectContaining({ preserveState: true, replace: true }),
      );
    }, 10000);
  });
});
