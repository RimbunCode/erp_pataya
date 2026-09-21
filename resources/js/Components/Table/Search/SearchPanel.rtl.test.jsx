import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

vi.mock("laravel-react-i18n", () => ({
  useLaravelReactI18n: () => ({
    t: (key, params) =>
      params ? `TR:${key}:${JSON.stringify(params)}` : `TR:${key}`,
  }),
}));

const mobileState = vi.hoisted(() => ({ value: false }));
vi.mock("@/Hooks/use-mobile", () => ({
  useIsMobile: () => mobileState.value,
}));

vi.mock("@/Components/Table/Table2", () => ({
  DATE_GROUP_GRANULARITIES: ["day", "month", "quarter", "half", "year"],
  DEFAULT_NUMBER_GROUP_RANGE_OPTIONS: [10, 100, 1000],
}));

// SaveFilterControl asli (dropdown simpan/timpa + axios) sudah punya test
// sendiri di FilterTable2.rtl.test.jsx -- di sini cukup stub yang
// mengekspos props yang diteruskan SearchPanel.
vi.mock("../Filter/FilterTable2", () => ({
  SaveFilterControl: (props) => (
    <div
      data-testid="save-control"
      data-model={props.model}
      data-items={JSON.stringify(props.savedItems)}
      data-has-snapshot={String(typeof props.getViewSnapshot === "function")}
    >
      <button type="button" onClick={() => props.onSaved({ id: 42, name: "Baru" })}>
        stub-save
      </button>
    </div>
  ),
}));

import SearchPanel from "./SearchPanel";

const columns = {
  customer: { name: "customer", title: "Customer", type: "string" },
  created_at: { name: "created_at", title: "Dibuat", type: "date" },
};
const groupOptions = [
  { value: "__no_group__", label: "Tidak ada" },
  { value: "customer", label: "Customer" },
  { value: "created_at", label: "Dibuat" },
];
const savedFilters = [
  { id: 1, name: "Draft saya", is_shared: false },
  { id: 2, name: "PO Bulan Ini", is_shared: true },
];

const renderPanel = (overrides = {}) => {
  const props = {
    trigger: <button type="button">trigger</button>,
    open: true,
    onOpenChange: vi.fn(),
    model: "AppModelsItem",
    columns,
    savedFilters,
    loadingSaved: false,
    sourceId: undefined,
    onPickSaved: vi.fn(),
    onRemoveSaved: vi.fn(),
    filter: { root: { k: "and", c: {} } },
    saveItems: [],
    getViewSnapshot: () => ({ sort: null, group: null }),
    onSaved: vi.fn(),
    onOpenBuilder: vi.fn(),
    onClearAll: vi.fn(),
    hasFilters: true,
    groupOptions,
    group: { column: null, granularity: null, range: null },
    onGroupChange: vi.fn(),
    ...overrides,
  };
  render(<SearchPanel {...props} />);
  return props;
};

describe("SearchPanel — kolom Filter Tersimpan", () => {
  beforeEach(() => {
    mobileState.value = false;
  });

  it("menampilkan daftar, badge Shared hanya utk is_shared, hapus hanya utk non-shared", () => {
    renderPanel();

    expect(
      screen.getByText("TR:core.datatable.search.section.saved"),
    ).toBeInTheDocument();
    expect(screen.getByText("Draft saya")).toBeInTheDocument();
    expect(screen.getByText("PO Bulan Ini")).toBeInTheDocument();
    // 1 badge Shared (item #2) dan 1 tombol hapus (item #1 saja).
    expect(
      screen.getAllByText("TR:core.datatable.filter.saved.shared_badge"),
    ).toHaveLength(1);
    expect(
      screen.getAllByTitle("TR:core.datatable.filter.delete.label"),
    ).toHaveLength(1);
  });

  it("klik hapus memanggil onRemoveSaved(id) item non-shared", async () => {
    const user = userEvent.setup({ delay: null });
    const props = renderPanel();

    await user.click(screen.getByTitle("TR:core.datatable.filter.delete.label"));

    expect(props.onRemoveSaved).toHaveBeenCalledWith(1);
  });

  it("klik nama saved filter memanggil onPickSaved(item)", async () => {
    const user = userEvent.setup({ delay: null });
    const props = renderPanel();

    await user.click(screen.getByText("PO Bulan Ini"));

    expect(props.onPickSaved).toHaveBeenCalledWith(savedFilters[1]);
  });

  it("sourceId menandai item sumber aktif (aria-current)", () => {
    renderPanel({ sourceId: 2 });

    const active = screen.getByText("PO Bulan Ini").closest("button");
    const inactive = screen.getByText("Draft saya").closest("button");
    expect(active).toHaveAttribute("aria-current", "true");
    expect(inactive).not.toHaveAttribute("aria-current");
  });

  it("daftar kosong menampilkan pesan kosong", () => {
    renderPanel({ savedFilters: [] });
    expect(
      screen.getByText("TR:core.datatable.filter.saved.empty"),
    ).toBeInTheDocument();
  });

  it("loadingSaved menampilkan indikator loading", () => {
    renderPanel({ loadingSaved: true });
    expect(
      screen.getByText("TR:core.datatable.filter.saved.loading"),
    ).toBeInTheDocument();
  });

  it("SaveFilterControl menerima model, saveItems & getViewSnapshot; onSaved diteruskan", async () => {
    const user = userEvent.setup({ delay: null });
    const props = renderPanel({ saveItems: [savedFilters[0]] });

    const control = screen.getByTestId("save-control");
    expect(control).toHaveAttribute("data-model", "AppModelsItem");
    expect(control).toHaveAttribute("data-items", JSON.stringify([savedFilters[0]]));
    expect(control).toHaveAttribute("data-has-snapshot", "true");

    await user.click(screen.getByText("stub-save"));
    expect(props.onSaved).toHaveBeenCalledWith({ id: 42, name: "Baru" });
  });

  it("tanpa model: judul, daftar & SaveFilterControl tidak dirender, Builder tetap ada", () => {
    renderPanel({ model: undefined });

    expect(
      screen.queryByText("TR:core.datatable.search.section.saved"),
    ).not.toBeInTheDocument();
    expect(screen.queryByText("Draft saya")).not.toBeInTheDocument();
    expect(screen.queryByTestId("save-control")).not.toBeInTheDocument();
    expect(
      screen.getByRole("button", {
        name: "TR:core.datatable.search.advanced_builder",
      }),
    ).toBeInTheDocument();
  });

  it("Builder lanjutan memanggil onOpenBuilder", async () => {
    const user = userEvent.setup({ delay: null });
    const props = renderPanel();

    await user.click(
      screen.getByRole("button", {
        name: "TR:core.datatable.search.advanced_builder",
      }),
    );

    expect(props.onOpenBuilder).toHaveBeenCalledTimes(1);
  });

  it("Hapus semua filter hanya muncul saat hasFilters, dan memanggil onClearAll", async () => {
    const user = userEvent.setup({ delay: null });
    const props = renderPanel({ hasFilters: true });

    await user.click(
      screen.getByRole("button", { name: "TR:core.datatable.search.clear_all" }),
    );
    expect(props.onClearAll).toHaveBeenCalledTimes(1);
  });

  it("tanpa hasFilters tombol Hapus semua filter tidak ada", () => {
    renderPanel({ hasFilters: false });
    expect(
      screen.queryByRole("button", { name: "TR:core.datatable.search.clear_all" }),
    ).not.toBeInTheDocument();
  });
});

describe("SearchPanel — kolom Group by", () => {
  beforeEach(() => {
    mobileState.value = false;
  });

  it("dirender bila groupOptions tidak kosong; pilih kolom -> onGroupChange default", async () => {
    const user = userEvent.setup({ delay: null });
    const props = renderPanel();

    expect(
      screen.getByText("TR:core.datatable.group_by"),
    ).toBeInTheDocument();

    await user.click(screen.getByText("Dibuat"));

    expect(props.onGroupChange).toHaveBeenCalledWith({
      column: "created_at",
      granularity: "month",
      range: null,
    });
  });

  it("kolom date aktif menampilkan granularity; klik mengganti granularity", async () => {
    const user = userEvent.setup({ delay: null });
    const props = renderPanel({
      group: { column: "created_at", granularity: "month", range: null },
    });

    await user.click(
      screen.getByRole("button", { name: "TR:core.datatable.granularity.quarter" }),
    );

    expect(props.onGroupChange).toHaveBeenCalledWith({
      column: "created_at",
      granularity: "quarter",
      range: null,
    });
  });

  it("'Tidak ada' mengosongkan group", async () => {
    const user = userEvent.setup({ delay: null });
    const props = renderPanel({
      group: { column: "customer", granularity: null, range: null },
    });

    await user.click(screen.getByText("Tidak ada"));

    expect(props.onGroupChange).toHaveBeenCalledWith({
      column: null,
      granularity: null,
      range: null,
    });
  });

  it("tanpa groupOptions (atau kosong) kolom Group by tidak dirender", () => {
    renderPanel({ groupOptions: undefined });
    expect(
      screen.queryByText("TR:core.datatable.group_by"),
    ).not.toBeInTheDocument();
  });
});

describe("SearchPanel — chrome desktop vs mobile", () => {
  it("desktop: konten ada di Popover (tanpa judul Dialog)", () => {
    mobileState.value = false;
    renderPanel();

    // Radix Popover juga ber-role "dialog" -- pembeda: Dialog mobile punya
    // DialogTitle, Popover desktop tidak.
    expect(
      screen.queryByText("TR:core.datatable.search.open_panel"),
    ).not.toBeInTheDocument();
    expect(screen.getByText("Draft saya")).toBeInTheDocument();
  });

  it("mobile: Dialog dengan kedua seksi bertumpuk", () => {
    mobileState.value = true;
    renderPanel();

    expect(
      screen.getByText("TR:core.datatable.search.open_panel", {
        selector: "h2",
      }),
    ).toBeInTheDocument();
    const dialog = screen.getByRole("dialog");
    expect(
      within(dialog).getByText("TR:core.datatable.search.section.saved"),
    ).toBeInTheDocument();
    expect(
      within(dialog).getByText("TR:core.datatable.group_by"),
    ).toBeInTheDocument();
    expect(within(dialog).getByText("Draft saya")).toBeInTheDocument();
  });

  it("klik trigger meminta buka via onOpenChange", async () => {
    mobileState.value = false;
    const user = userEvent.setup({ delay: null });
    const props = renderPanel({ open: false });

    await user.click(screen.getByRole("button", { name: "trigger" }));

    expect(props.onOpenChange).toHaveBeenCalledWith(true);
  });
});
