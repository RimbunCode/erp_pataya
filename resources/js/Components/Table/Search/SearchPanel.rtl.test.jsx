import { describe, expect, it, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

vi.mock("laravel-react-i18n", () => ({
  useLaravelReactI18n: () => ({
    t: (key, params) =>
      params ? `TR:${key}:${JSON.stringify(params)}` : `TR:${key}`,
  }),
}));

vi.mock("@/Components/Table/Table2", () => ({
  DATE_GROUP_GRANULARITIES: ["day", "month", "quarter", "half", "year"],
  DEFAULT_NUMBER_GROUP_RANGE_OPTIONS: [10, 100, 1000],
}));

// SaveFilterControl asli (isian nama inline + axios) sudah punya test
// sendiri di FilterTable2.rtl.test.jsx -- di sini cukup stub yang
// mengekspos props yang diteruskan SearchPanel.
vi.mock("../Filter/FilterTable2", () => ({
  SaveFilterControl: (props) => (
    <div
      data-testid="save-control"
      data-model={props.model}
      data-items={JSON.stringify(props.savedItems)}
      data-has-snapshot={String(typeof props.getViewSnapshot === "function")}
      data-default-name={props.defaultName ?? ""}
      data-disabled={String(Boolean(props.disabled))}
      data-class-name={props.className ?? ""}
    >
      <button
        type="button"
        onClick={() => props.onSaved({ id: 42, name: "Baru" })}
      >
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
    columnList: [
      { name: "created_at", label: "Dibuat" },
      { name: "customer", label: "Customer" },
    ],
    onPickColumn: vi.fn(),
    ...overrides,
  };
  render(<SearchPanel {...props} />);
  return props;
};

describe("SearchPanel — kolom Filter Tersimpan", () => {
  it("menampilkan daftar, badge Shared hanya utk is_shared, hapus hanya utk non-shared", () => {
    renderPanel();

    expect(
      screen.getByText("TR:core.datatable.filter.filter"),
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

    await user.click(
      screen.getByTitle("TR:core.datatable.filter.delete.label"),
    );

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

  it("SaveFilterControl menerima model, filter tersimpan MILIK SENDIRI (bukan shared) & getViewSnapshot; onSaved diteruskan", async () => {
    const user = userEvent.setup({ delay: null });
    const props = renderPanel({ saveItems: [savedFilters[0]] });

    const control = screen.getByTestId("save-control");
    expect(control).toHaveAttribute("data-model", "AppModelsItem");
    // savedFilters[1] is_shared -> tak ikut (tak boleh ditimpa dari sini).
    expect(control).toHaveAttribute(
      "data-items",
      JSON.stringify([savedFilters[0]]),
    );
    expect(control).toHaveAttribute("data-has-snapshot", "true");

    await user.click(screen.getByText("stub-save"));
    expect(props.onSaved).toHaveBeenCalledWith({ id: 42, name: "Baru" });
  });

  it("SaveFilterControl: nama sumber jadi isi awal (Enter = timpa), lebar penuh; nonaktif bila belum ada filter", () => {
    renderPanel({ saveItems: [savedFilters[0]] });
    const control = screen.getByTestId("save-control");
    expect(control).toHaveAttribute("data-default-name", "Draft saya");
    expect(control).toHaveAttribute("data-disabled", "false");
    expect(control.getAttribute("data-class-name")).toContain("w-full");
  });

  it("SaveFilterControl nonaktif saat hasFilters=false (backend menolak tree kosong)", () => {
    renderPanel({ hasFilters: false });
    expect(screen.getByTestId("save-control")).toHaveAttribute(
      "data-disabled",
      "true",
    );
  });

  it("tanpa model: daftar & SaveFilterControl tidak dirender, judul Filter & Builder tetap ada", () => {
    renderPanel({ model: undefined });

    expect(
      screen.getByText("TR:core.datatable.filter.filter"),
    ).toBeInTheDocument();
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
      screen.getByRole("button", {
        name: "TR:core.datatable.search.clear_all",
      }),
    );
    expect(props.onClearAll).toHaveBeenCalledTimes(1);
  });

  it("tanpa hasFilters tombol Hapus semua filter tidak ada", () => {
    renderPanel({ hasFilters: false });
    expect(
      screen.queryByRole("button", {
        name: "TR:core.datatable.search.clear_all",
      }),
    ).not.toBeInTheDocument();
  });
});

describe("SearchPanel — kolom Group by", () => {
  it("dirender bila groupOptions tidak kosong; pilih kolom -> onGroupChange default", async () => {
    const user = userEvent.setup({ delay: null });
    const props = renderPanel();

    expect(screen.getByText("TR:core.datatable.group_by")).toBeInTheDocument();

    // "Dibuat" juga ada di daftar Kolom -- cari di dalam seksi Group saja.
    const groupSection = screen
      .getByText("TR:core.datatable.group_by")
      .closest("section");
    await user.click(within(groupSection).getByText("Dibuat"));

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
      screen.getByRole("button", {
        name: "TR:core.datatable.granularity.quarter",
      }),
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

  it("GroupPicker memakai lebar penuh kolom grid (bukan w-64 tetap) -- regresi visual: 'Group by melebihi batasnya'", () => {
    renderPanel();
    const groupSection = screen
      .getByText("TR:core.datatable.group_by")
      .closest("section");
    // Root GroupPicker = anak langsung <ul> daftar opsi di section ini.
    const groupRoot = within(groupSection)
      .getByText("Dibuat")
      .closest("ul").parentElement;
    expect(groupRoot.className).toContain("w-full");
    expect(groupRoot.className).not.toContain("w-64");
  });
});

describe("SearchPanel — kolom Kolom (pencarian per kolom)", () => {
  it("menampilkan judul & daftar kolom yang bisa dicari", () => {
    renderPanel();

    expect(
      screen.getByText("TR:core.datatable.search.section.column"),
    ).toBeInTheDocument();
    // "Dibuat"/"Customer" juga ada di GroupPicker -- daftar Kolom dicari via
    // tombolnya di dalam <section> Kolom.
    const section = screen
      .getByText("TR:core.datatable.search.section.column")
      .closest("section");
    expect(section.querySelectorAll("button")).toHaveLength(2);
  });

  it("klik kolom memanggil onPickColumn(name) -- tanpa dialog/operator", async () => {
    const user = userEvent.setup({ delay: null });
    const props = renderPanel();
    const section = screen
      .getByText("TR:core.datatable.search.section.column")
      .closest("section");

    await user.click(section.querySelectorAll("button")[1]);

    expect(props.onPickColumn).toHaveBeenCalledWith("customer");
    // Tidak ada pemilih operator / dialog apa pun yang muncul.
    expect(
      screen.queryByText("TR:core.datatable.filter.select_operator"),
    ).not.toBeInTheDocument();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(props.onOpenBuilder).not.toHaveBeenCalled();
  });

  it("tanpa columnList (kosong/undefined) seksi Kolom tidak dirender", () => {
    renderPanel({ columnList: [] });
    expect(
      screen.queryByText("TR:core.datatable.search.section.column"),
    ).not.toBeInTheDocument();
    renderPanel({ columnList: undefined });
    expect(
      screen.queryByText("TR:core.datatable.search.section.column"),
    ).not.toBeInTheDocument();
  });
});

describe("SearchPanel — tata letak kolom", () => {
  const gridOf = () =>
    screen.getByText("TR:core.datatable.filter.filter").closest("section")
      .parentElement;

  it("3 seksi (Filter, Group, Kolom) -> grid 3 kolom", () => {
    renderPanel();
    expect(gridOf().className).toContain("md:grid-cols-3");
    const titles = [
      ...gridOf().querySelectorAll("section > span:first-child"),
    ].map((el) => el.textContent);
    expect(titles).toEqual([
      "TR:core.datatable.filter.filter",
      "TR:core.datatable.group_by",
      "TR:core.datatable.search.section.column",
    ]);
  });

  it("tanpa Group -> 2 kolom; tanpa Group & Kolom -> 1 kolom", () => {
    renderPanel({ groupOptions: undefined });
    expect(gridOf().className).toContain("md:grid-cols-2");
    document.body.innerHTML = "";
    renderPanel({ groupOptions: undefined, columnList: [] });
    expect(gridOf().className).toContain("md:grid-cols-1");
  });

  it("area panel bisa di-scroll (batas tinggi) agar tak menutupi layar", () => {
    renderPanel();
    expect(gridOf().className).toContain("overflow-y-auto");
  });
});

describe("SearchPanel — navigasi keyboard roving-tabindex (Requirement 33)", () => {
  const sectionOf = (heading) => screen.getByText(heading).closest("section");
  const focusables = (section) =>
    Array.from(
      section.querySelectorAll(
        'button:not([disabled]), [href], input:not([disabled]), [tabindex]:not([tabindex="-1"])',
      ),
    );

  it("Down/Up pindah fokus antar item DALAM kolom Filter yang sama (tak wrap)", async () => {
    const user = userEvent.setup({ delay: null });
    renderPanel();
    const filterSection = sectionOf("TR:core.datatable.filter.filter");
    const items = focusables(filterSection);
    expect(items.length).toBeGreaterThan(2);

    items[0].focus();
    await user.keyboard("{ArrowDown}");
    expect(document.activeElement).toBe(items[1]);

    await user.keyboard("{ArrowDown}");
    expect(document.activeElement).toBe(items[2]);

    await user.keyboard("{ArrowUp}");
    expect(document.activeElement).toBe(items[1]);
  });

  it("ArrowUp pada item PERTAMA kolom -> tetap di situ (clamp, tak wrap)", async () => {
    const user = userEvent.setup({ delay: null });
    renderPanel();
    const items = focusables(sectionOf("TR:core.datatable.filter.filter"));
    items[0].focus();
    await user.keyboard("{ArrowUp}");
    expect(document.activeElement).toBe(items[0]);
  });

  it("Right pindah ANTAR kolom (Filter -> Group -> Kolom -> wrap ke Filter)", async () => {
    const user = userEvent.setup({ delay: null });
    renderPanel();
    const filterItems = focusables(
      sectionOf("TR:core.datatable.filter.filter"),
    );
    const groupItems = focusables(sectionOf("TR:core.datatable.group_by"));
    const columnItems = focusables(
      sectionOf("TR:core.datatable.search.section.column"),
    );

    filterItems[0].focus();
    await user.keyboard("{ArrowRight}");
    expect(document.activeElement).toBe(groupItems[0]);

    await user.keyboard("{ArrowRight}");
    expect(document.activeElement).toBe(columnItems[0]);

    // Wrap-around: dari kolom TERAKHIR (Kolom) -> kolom PERTAMA (Filter).
    await user.keyboard("{ArrowRight}");
    expect(document.activeElement).toBe(filterItems[0]);
  });

  it("Left dari kolom Filter wrap ke kolom TERAKHIR (Kolom)", async () => {
    const user = userEvent.setup({ delay: null });
    renderPanel();
    const filterItems = focusables(
      sectionOf("TR:core.datatable.filter.filter"),
    );
    const columnItems = focusables(
      sectionOf("TR:core.datatable.search.section.column"),
    );

    filterItems[0].focus();
    await user.keyboard("{ArrowLeft}");
    expect(document.activeElement).toBe(columnItems[0]);
  });

  it("pindah kolom ke kolom yg lebih PENDEK -> index di-clamp (tak error)", async () => {
    const user = userEvent.setup({ delay: null });
    renderPanel();
    const filterSection = sectionOf("TR:core.datatable.filter.filter");
    const groupSection = sectionOf("TR:core.datatable.group_by");
    const filterItems = focusables(filterSection);
    const groupItems = focusables(groupSection);
    // Group section LEBIH PENDEK dari Filter -- skenario yg diuji: index
    // sisi Filter (item TERAKHIR) tak boleh di luar jangkauan Group.
    expect(groupItems.length).toBeLessThan(filterItems.length);

    // Fokus item TERAKHIR Filter (index > jumlah item Group) -> harus
    // di-clamp ke item TERAKHIR Group, TANPA error/undefined.
    filterItems[filterItems.length - 1].focus();
    await user.keyboard("{ArrowRight}");
    expect(groupSection.contains(document.activeElement)).toBe(true);
    expect(document.activeElement).toBe(groupItems[groupItems.length - 1]);
  });

  it("Escape memanggil onClose", async () => {
    const user = userEvent.setup({ delay: null });
    const onClose = vi.fn();
    renderPanel({ onClose });
    const items = focusables(sectionOf("TR:core.datatable.filter.filter"));
    items[0].focus();
    await user.keyboard("{Escape}");
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("Enter pada tombol kolom ter-fokus mengaktifkannya (perilaku native <button>)", async () => {
    const user = userEvent.setup({ delay: null });
    const onPickColumn = vi.fn();
    renderPanel({ onPickColumn });
    const columnItems = focusables(
      sectionOf("TR:core.datatable.search.section.column"),
    );
    columnItems[0].focus();
    await user.keyboard("{Enter}");
    expect(onPickColumn).toHaveBeenCalledTimes(1);
  });
});
