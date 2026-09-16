import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

vi.mock("laravel-react-i18n", () => ({
  useLaravelReactI18n: () => ({ t: (key) => `TR:${key}` }),
}));

vi.mock("@inertiajs/react", () => ({
  router: { get: vi.fn(), reload: vi.fn() },
  usePage: () => ({ props: {}, url: "/test" }),
}));

vi.mock("@/Hooks/usePermission", () => ({
  default: () => ({ can: () => true, canGlobal: () => true }),
}));

// Header (drag handle, resize handle, sort UI) punya kompleksitas dnd-kit
// tersendiri -- stub agar test Table2 fokus ke wrapper: selectable checkbox,
// loading/empty state, cell rendering dasar.
vi.mock("./Header", () => ({
  default: ({ title, id }) => <th data-testid={`header-${id}`}>{title}</th>,
}));

import Table2 from "./Table2";

const columns = {
  name: { name: "name", title: "Name", type: "text" },
};

const data = [
  { id: 1, name: "Item A" },
  { id: 2, name: "Item B" },
];

describe("Table2", () => {
  it("menampilkan loading state saat isLoading=true", () => {
    render(<Table2 columns={columns} data={[]} isLoading />);
    expect(screen.getByText(/TR:core.form.loading/)).toBeInTheDocument();
  });

  it("menampilkan NoDataImg saat data kosong dan bukan dynamic data", () => {
    render(<Table2 columns={columns} data={[]} />);
    expect(screen.queryByText(/TR:core.form.loading/)).not.toBeInTheDocument();
  });

  it("menampilkan pesan no_data saat data kosong dan isDynamicData=true", () => {
    render(<Table2 columns={columns} data={[]} isDynamicData />);
    expect(screen.getByText(/TR:core.datatable.no_data/)).toBeInTheDocument();
  });

  it("merender baris data dengan header kolom yang diberikan", () => {
    render(<Table2 columns={columns} data={data} />);
    expect(screen.getByTestId("header-name")).toBeInTheDocument();
    expect(screen.getByText("Item A")).toBeInTheDocument();
    expect(screen.getByText("Item B")).toBeInTheDocument();
  });

  it("tidak merender checkbox saat selectable=false", () => {
    render(<Table2 columns={columns} data={data} selectable={false} />);
    expect(screen.queryAllByRole("forminput")).toHaveLength(0);
  });

  it("selectable=true merender checkbox per baris + 1 checkbox select-all di header", () => {
    render(<Table2 columns={columns} data={data} selectable />);
    // 2 baris + 1 select-all header
    expect(screen.getAllByRole("forminput")).toHaveLength(3);
  });

  it("klik checkbox select-all menandai semua baris terpilih", async () => {
    const user = userEvent.setup({ delay: null });
    render(<Table2 columns={columns} data={data} selectable />);

    const [selectAll, ...rowChecks] = screen.getAllByRole("forminput");
    await user.click(selectAll);

    rowChecks.forEach((cb) =>
      expect(cb).toHaveAttribute("data-state", "checked"),
    );
  });

  // Task 6 (spec linkmodel-advanced-search) — onRowClick: mode single-select
  // klik-langsung (dipakai Advance Search Dialog), independen dari `selectable`
  // (checkbox multi-select, dipakai SelectModel). Prop opsional, default
  // undefined -- tidak boleh mengubah perilaku existing (selectable tetap jalan).
  it("onRowClick terisi -- klik baris memanggil callback dengan row yang benar, tanpa checkbox", async () => {
    const user = userEvent.setup({ delay: null });
    const onRowClick = vi.fn();
    render(<Table2 columns={columns} data={data} onRowClick={onRowClick} />);

    expect(screen.queryAllByRole("forminput")).toHaveLength(0);

    await user.click(screen.getByText("Item B"));

    expect(onRowClick).toHaveBeenCalledTimes(1);
    expect(onRowClick).toHaveBeenCalledWith(data[1]);
  });

  it("onRowClick tidak diisi (default) -- klik baris tidak memicu apapun (regresi)", async () => {
    const user = userEvent.setup({ delay: null });
    render(<Table2 columns={columns} data={data} />);

    // Tidak ada assertion callback (tak ada prop) -- cukup pastikan klik tidak throw.
    await expect(user.click(screen.getByText("Item A"))).resolves.not.toThrow();
  });

  // Kolom isLink tanpa `route` (mis. dari SelectModel/useSelectModel yang tak
  // menurunkan route seperti DataTable2) dulu crash: window.route(route ?? "", ...)
  // memanggil Ziggy dengan nama route kosong, lalu Link (Inertia mergeDataIntoQueryString)
  // memanggil href.toString() pada Router object rusak → "Cannot convert undefined
  // or null to object". Cell harus fallback ke teks biasa, bukan <Link>.
  it("kolom isLink tanpa route dirender sebagai teks biasa, bukan Link", () => {
    window.route = vi.fn(() => "/should-not-be-called");
    const isLinkColumns = {
      code: {
        name: "code",
        title: "Code",
        type: "string",
        isLink: true,
        primaryKey: "id",
      },
    };
    render(
      <Table2
        columns={isLinkColumns}
        data={[{ id: 1, code: "PSN/PR-0001" }]}
        persistColumns={false}
        isDynamicData
      />,
    );

    expect(screen.getByText("PSN/PR-0001")).toBeInTheDocument();
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
    expect(window.route).not.toHaveBeenCalled();
  });

  it("kolom isLink dengan route tetap dirender sebagai Link", () => {
    window.route = vi.fn(() => "/purchase-requests/1");
    const isLinkColumns = {
      code: {
        name: "code",
        title: "Code",
        type: "string",
        isLink: true,
        route: "purchaseRequests.show",
        primaryKey: "id",
      },
    };
    render(
      <Table2
        columns={isLinkColumns}
        data={[{ id: 1, code: "PSN/PR-0001" }]}
        persistColumns={false}
        isDynamicData
      />,
    );

    expect(screen.getByRole("link", { name: "PSN/PR-0001" })).toHaveAttribute(
      "href",
      "/purchase-requests/1",
    );
    expect(window.route).toHaveBeenCalledWith("purchaseRequests.show", 1);
  });
});
