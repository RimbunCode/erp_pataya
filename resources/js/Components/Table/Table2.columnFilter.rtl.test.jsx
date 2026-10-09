// Test integrasi Table2 + prop `columnFilter` (task 14.4, spec
// datatable2-column-search-row, Requirement 1.1-1.7, 2.2-2.3, 9.2, 9.4):
// baris filter hanya muncul bila prop diberikan, sel mengikuti kolom tampil,
// tetap tampil saat loading/data kosong, dan tinggi gabungan kedua baris
// dipublikasikan ke CSS var sticky.

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { TooltipProvider } from "@/Components/ui/tooltip";
import userEvent from "@testing-library/user-event";

vi.mock("laravel-react-i18n", () => ({
  useLaravelReactI18n: () => ({
    t: (key, params) =>
      params ? `TR:${key}:${JSON.stringify(params)}` : `TR:${key}`,
  }),
}));

vi.mock("@inertiajs/react", () => ({
  router: { get: vi.fn(), reload: vi.fn() },
  usePage: () => ({ props: {}, url: "/test" }),
}));

vi.mock("axios", () => ({
  default: {
    get: vi.fn(() => Promise.resolve({ data: { data: [] } })),
    post: vi.fn(() => Promise.resolve({ data: { data: [] } })),
  },
}));

vi.mock("@/Hooks/usePermission", () => ({
  default: () => ({ can: () => true, canGlobal: () => true }),
}));

// Header (drag handle, resize, sort) punya kompleksitas dnd-kit sendiri.
vi.mock("./Header", () => ({
  default: ({ title, id }) => <th data-testid={`header-${id}`}>{title}</th>,
}));

window.route = (name) => name;

import Table2 from "./Table2";
import useSearchDraft from "./Search/useSearchDraft";

const NO_GROUP = [];
const client = new QueryClient();

const columns = {
  name: { name: "name", title: "Nama", type: "string" },
  qty: { name: "qty", title: "Jumlah", type: "number" },
};
const data = [
  { id: 1, name: "Item A", qty: 1 },
  { id: 2, name: "Item B", qty: 2 },
];

function Host({ withFilter = true, onTreeChange, ...props }) {
  const draft = useSearchDraft({
    tree: null,
    group: NO_GROUP,
    onTreeChange: onTreeChange ?? (() => Promise.resolve()),
  });
  return (
    <QueryClientProvider client={client}>
      <TooltipProvider>
        <Table2
          columns={columns}
          data={data}
          columnFilter={
            withFilter ? { columns, draft, onOpenBuilder: vi.fn() } : undefined
          }
          {...props}
        />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

const headRows = () => document.querySelectorAll("thead tr");

describe("Table2 + columnFilter", () => {
  it("tanpa prop columnFilter: <thead> tetap SATU baris (regresi AdvanceSearchDialog/SelectModel)", () => {
    render(<Host withFilter={false} />);
    expect(headRows()).toHaveLength(1);
    expect(screen.queryByTestId("column-filter-row")).toBeNull();
    expect(screen.queryByLabelText("Nama")).toBeNull();
  });

  it("dengan columnFilter: baris kedua di <thead>, satu sel per kolom tampil", () => {
    render(<Host />);
    expect(headRows()).toHaveLength(2);
    const row = screen.getByTestId("column-filter-row");
    expect(row.parentElement.tagName).toBe("THEAD");
    // urutan sel = urutan header (showedColumns Table2, bukan urutan prop)
    const headerOrder = screen
      .getAllByTestId(/^header-/)
      .map((el) => el.textContent);
    const cellOrder = screen
      .getAllByRole("textbox")
      .map((el) => el.getAttribute("aria-label"));
    expect(cellOrder).toEqual(headerOrder);
    expect([...cellOrder].sort()).toEqual(["Jumlah", "Nama"]);
  });

  it("grid baris: satu track `auto` tambahan utk baris filter (data tak jatuh ke track 1fr)", () => {
    const { rerender } = render(<Host withFilter={false} />);
    // header + 2 data + filler 1fr
    expect(document.querySelector("table").style.gridTemplateRows).toBe(
      "auto auto auto 1fr",
    );
    rerender(<Host />);
    // header + filter + 2 data + filler 1fr
    expect(document.querySelector("table").style.gridTemplateRows).toBe(
      "auto auto auto auto 1fr",
    );
  });

  it("selectable + actions: sel pengisi di baris filter, sel lain tetap sejajar", () => {
    render(<Host selectable actions={() => null} />);
    const filterThs = document.querySelectorAll(
      '[data-testid="column-filter-row"] th',
    );
    // checkbox + aksi + 2 kolom
    expect(filterThs).toHaveLength(4);
    expect(filterThs[0].getAttribute("aria-hidden")).toBe("true");
    expect(filterThs[1].getAttribute("aria-hidden")).toBe("true");
  });

  it("tetap tampil saat loading dan saat data kosong", () => {
    const { rerender } = render(<Host isLoading data={[]} />);
    expect(screen.getByTestId("column-filter-row")).toBeInTheDocument();
    rerender(<Host data={[]} isDynamicData />);
    expect(screen.getByTestId("column-filter-row")).toBeInTheDocument();
  });

  it("klik sel filter tidak memicu klik baris data (onRowClick)", async () => {
    const user = userEvent.setup({ delay: null });
    const onRowClick = vi.fn();
    render(<Host onRowClick={onRowClick} />);
    await user.click(screen.getByLabelText("Nama"));
    expect(onRowClick).not.toHaveBeenCalled();
  });

  it("commit dari sel memanggil onTreeChange dengan tree yang benar", async () => {
    const user = userEvent.setup({ delay: null });
    const onTreeChange = vi.fn(() => Promise.resolve());
    render(<Host onTreeChange={onTreeChange} />);
    await user.type(screen.getByLabelText("Jumlah"), ">=5{Enter}");
    await waitFor(() => expect(onTreeChange).toHaveBeenCalledTimes(1));
    const leaves = Object.values(onTreeChange.mock.calls[0][0].root.c);
    expect(leaves).toEqual([{ k: "qty", o: ">=", v: 5 }]);
  });
});

describe("Table2 + columnFilter: CSS var sticky", () => {
  const original = {
    RO: globalThis.ResizeObserver,
    rect: Element.prototype.getBoundingClientRect,
  };

  const installMeasure = (heightFor) => {
    globalThis.ResizeObserver = class {
      observe() {}
      disconnect() {}
    };
    Element.prototype.getBoundingClientRect = function rect() {
      return { height: heightFor(this), width: 0, top: 0, left: 0 };
    };
  };
  const restore = () => {
    globalThis.ResizeObserver = original.RO;
    Element.prototype.getBoundingClientRect = original.rect;
  };

  it("--group-sticky-top = tinggi baris judul + baris filter; --column-header-height = baris judul", () => {
    installMeasure((el) =>
      el.closest("tr")?.dataset.testid === "column-filter-row" ? 40 : 30,
    );
    try {
      render(<Host />);
      const table = document.querySelector("table");
      expect(table.style.getPropertyValue("--column-header-height")).toBe(
        "30px",
      );
      expect(table.style.getPropertyValue("--group-sticky-top")).toBe("70px");
    } finally {
      restore();
    }
  });

  it("tanpa baris filter --group-sticky-top = tinggi baris judul saja (perilaku lama)", () => {
    installMeasure(() => 30);
    try {
      render(<Host withFilter={false} />);
      const table = document.querySelector("table");
      expect(table.style.getPropertyValue("--group-sticky-top")).toBe("30px");
    } finally {
      restore();
    }
  });
});
