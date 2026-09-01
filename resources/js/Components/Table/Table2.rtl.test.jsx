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
});
