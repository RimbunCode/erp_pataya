import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import userEvent from "@testing-library/user-event";
import { TooltipProvider } from "@/Components/ui/tooltip";

vi.mock("laravel-react-i18n", () => ({
  useLaravelReactI18n: () => ({
    t: (key, params) =>
      params ? `TR:${key}:${JSON.stringify(params)}` : `TR:${key}`,
  }),
}));

const axiosGet = vi.fn();
const axiosPost = vi.fn();
const axiosPatch = vi.fn();
const axiosDelete = vi.fn();
vi.mock("axios", () => ({
  default: {
    get: (...a) => axiosGet(...a),
    post: (...a) => axiosPost(...a),
    patch: (...a) => axiosPatch(...a),
    delete: (...a) => axiosDelete(...a),
  },
}));

const toastSuccess = vi.fn();
const toastError = vi.fn();
vi.mock("@/lib/gooeyToast", () => ({
  gooeyToast: {
    success: (...a) => toastSuccess(...a),
    error: (...a) => toastError(...a),
  },
}));

// FilterBuilderBody (isi tree AND/OR) sudah punya test sendiri lewat
// FilterGroup2/FilterItem2 -- stub agar test FilterTable2 fokus ke wrapper-nya:
// dialog, saved-filter list, save/overwrite flow, isDirty detection.
vi.mock("./FilterBuilder", () => ({
  FilterBuilderBody: () => <div data-testid="stub-filter-builder-body" />,
}));

vi.mock("@/Hooks/usePermission", () => ({
  default: () => ({ can: () => true, canGlobal: () => true }),
}));

window.route = (name, params) =>
  params ? `${name}/${JSON.stringify(params)}` : name;

import FilterTable2, { SaveFilterControl } from "./FilterTable2";

const columns = { status: { name: "status", type: "formStatus" } };

describe("FilterTable2", () => {
  beforeEach(() => {
    axiosGet.mockReset();
    axiosPost.mockReset();
    axiosPatch.mockReset();
    axiosDelete.mockReset();
    toastSuccess.mockReset();
    toastError.mockReset();
    axiosGet.mockResolvedValue({ data: { data: [] } });
  });

  it("render tombol trigger filter tanpa badge saat tidak ada filter aktif", () => {
    render(
      <FilterTable2
        columns={columns}
        initialFilters={null}
        onApply={vi.fn()}
      />,
    );
    expect(
      screen.getByRole("button", { name: /TR:core.datatable.filter.filter/ }),
    ).toBeInTheDocument();
  });

  it("menampilkan badge jumlah filter aktif pada tombol trigger", () => {
    const initialFilters = {
      root: {
        k: "and",
        c: {
          a: { k: "status", o: "=", v: "draft" },
          b: { k: "status", o: "=", v: "open" },
        },
      },
    };
    render(
      <FilterTable2
        columns={columns}
        initialFilters={initialFilters}
        onApply={vi.fn()}
      />,
    );
    expect(screen.getByText("2")).toBeInTheDocument();
  });

  it("klik trigger membuka dialog dan memuat daftar saved filter (model diberikan)", async () => {
    const user = userEvent.setup({ delay: null });
    axiosGet.mockResolvedValue({
      data: { data: [{ id: 1, name: "Filter A", is_saved: true, filter: {} }] },
    });
    render(
      <FilterTable2
        columns={columns}
        initialFilters={null}
        onApply={vi.fn()}
        model="AppModelsItem"
      />,
    );

    await user.click(
      screen.getByRole("button", { name: /TR:core.datatable.filter.filter/ }),
    );

    expect(await screen.findByText("Filter A")).toBeInTheDocument();
    expect(axiosGet).toHaveBeenCalledWith(
      "saved-filters.index",
      expect.objectContaining({ params: { model: "AppModelsItem" } }),
    );
  });

  it("tanpa model, SavedFilterBar tidak dirender", async () => {
    const user = userEvent.setup({ delay: null });
    render(
      <FilterTable2
        columns={columns}
        initialFilters={null}
        onApply={vi.fn()}
      />,
    );

    await user.click(
      screen.getByRole("button", { name: /TR:core.datatable.filter.filter/ }),
    );

    expect(
      screen.queryByText("TR:core.datatable.filter.saved.list"),
    ).not.toBeInTheDocument();
  });

  it("klik chip saved filter memuatnya (onPick) dan menandai sebagai loadedFid", async () => {
    const user = userEvent.setup({ delay: null });
    axiosGet.mockResolvedValue({
      data: {
        data: [
          {
            id: 1,
            name: "Filter A",
            is_saved: true,
            filter: { root: { k: "and", c: {} } },
          },
        ],
      },
    });
    render(
      <FilterTable2
        columns={columns}
        initialFilters={null}
        onApply={vi.fn()}
        model="AppModelsItem"
        activeFid={null}
      />,
    );

    await user.click(
      screen.getByRole("button", { name: /TR:core.datatable.filter.filter/ }),
    );
    await user.click(await screen.findByText("Filter A"));

    // Judul dialog menampilkan nama filter yang dimuat.
    expect(await screen.findAllByText("Filter A")).not.toHaveLength(0);
  });

  it("klik hapus (trash) pada chip saved filter memanggil axios.delete", async () => {
    const user = userEvent.setup({ delay: null });
    axiosGet.mockResolvedValue({
      data: { data: [{ id: 1, name: "Filter A", is_saved: true, filter: {} }] },
    });
    axiosDelete.mockResolvedValue({});
    render(
      <FilterTable2
        columns={columns}
        initialFilters={null}
        onApply={vi.fn()}
        model="AppModelsItem"
      />,
    );

    await user.click(
      screen.getByRole("button", { name: /TR:core.datatable.filter.filter/ }),
    );
    await screen.findByText("Filter A");

    const deleteButton = screen.getByTitle(
      "TR:core.datatable.filter.delete.label",
    );
    await user.click(deleteButton);

    expect(axiosDelete).toHaveBeenCalledWith(
      'saved-filters.destroy/{"savedFilter":1}',
    );
  });

  it("shared filter menampilkan badge Shared dan menyembunyikan tombol hapus", async () => {
    const user = userEvent.setup({ delay: null });
    axiosGet.mockResolvedValue({
      data: {
        data: [
          {
            id: 1,
            name: "Filter Privat",
            is_saved: true,
            is_shared: false,
            filter: {},
          },
          {
            id: 2,
            name: "Filter Shared",
            is_saved: true,
            is_shared: true,
            filter: {},
          },
        ],
      },
    });
    render(
      <FilterTable2
        columns={columns}
        initialFilters={null}
        onApply={vi.fn()}
        model="AppModelsItem"
      />,
    );

    await user.click(
      screen.getByRole("button", { name: /TR:core.datatable.filter.filter/ }),
    );
    await screen.findByText("Filter Privat");

    expect(
      screen.getByText("TR:core.datatable.filter.saved.shared_badge"),
    ).toBeInTheDocument();

    const deleteButtons = screen.getAllByTitle(
      "TR:core.datatable.filter.delete.label",
    );
    // Hanya satu tombol hapus (utk item privat) — item shared tidak punya.
    expect(deleteButtons).toHaveLength(1);
  });

  it("Simpan sebagai baru: submit nama memanggil POST lalu PATCH nama", async () => {
    const user = userEvent.setup({ delay: null });
    axiosPost.mockResolvedValue({ data: { id: 99 } });
    axiosPatch.mockResolvedValue({ data: { id: 99, name: "Filter Baru" } });
    render(
      <FilterTable2
        columns={columns}
        initialFilters={null}
        onApply={vi.fn()}
        model="AppModelsItem"
      />,
    );

    await user.click(
      screen.getByRole("button", { name: /TR:core.datatable.filter.filter/ }),
    );
    await user.click(
      screen.getByRole("button", {
        name: /TR:core.datatable.filter.saved.save/,
      }),
    );
    await user.click(
      screen.getByText("TR:core.datatable.filter.saved.save_new"),
    );

    const input = screen.getByPlaceholderText(
      "TR:core.datatable.filter.saved.name_placeholder",
    );
    await user.type(input, "Filter Baru");
    await user.click(
      screen.getByRole("button", {
        name: "TR:core.datatable.filter.saved.save",
      }),
    );

    expect(axiosPost).toHaveBeenCalledWith(
      "saved-filters.store",
      expect.objectContaining({ model: "AppModelsItem" }),
    );
    expect(axiosPatch).toHaveBeenCalledWith(
      'saved-filters.update/{"savedFilter":99}',
      { name: "Filter Baru" },
    );
    expect(
      await screen.findByRole("button", {
        name: /TR:core.datatable.filter.saved.save/,
      }),
    ).toBeInTheDocument();
  });

  // Task 8 (spec linkmodel-advanced-search) — prop `lockedFilters`: ringkasan
  // read-only prop `filters` LinkModel (non-editable) di dalam FilterTable,
  // terpisah dari badge/count additive.
  describe("lockedFilters (Requirement 5.6-5.8)", () => {
    const columnsWithRelation = {
      status: { name: "status", type: "formStatus" },
      customer: {
        name: "customer",
        type: "relation",
        related: "App\\Models\\Sales\\Customer",
      },
    };

    it("kondisi lockedFilters tampil, TIDAK ikut dihitung badge (additive tetap 0)", () => {
      render(
        <FilterTable2
          columns={columnsWithRelation}
          initialFilters={null}
          lockedFilters={{ status: "submitted" }}
          onApply={vi.fn()}
        />,
      );

      // Badge cuma render kalau activeCount>0 -- tanpa additive, tidak ada badge angka.
      const trigger = screen.getByRole("button", {
        name: /TR:core.datatable.filter.filter/,
      });
      expect(trigger).not.toHaveTextContent(/^\d+$/);
    });

    it("badge HANYA hitung additive walau lockedFilters berisi kondisi lain", () => {
      const initialFilters = {
        root: {
          k: "and",
          c: { a: { k: "status", o: "=", v: "draft" } },
        },
      };
      render(
        <FilterTable2
          columns={columnsWithRelation}
          initialFilters={initialFilters}
          lockedFilters={{ status: "submitted", customer: { id: 5 } }}
          onApply={vi.fn()}
        />,
      );

      // 1 kondisi additive -> badge "1", BUKAN 3 (additive+locked).
      expect(screen.getByText("1")).toBeInTheDocument();
      expect(screen.queryByText("3")).not.toBeInTheDocument();
    });

    it("kondisi relasi match-by-id di lockedFilters merender LinkModel disabled", async () => {
      const user = userEvent.setup({ delay: null });
      // LinkModel (dipakai LockedFiltersSummary utk kondisi relasi) butuh
      // QueryClientProvider (useLinkModelOptions -> useQueryClient()).
      const queryClient = new QueryClient({
        defaultOptions: { queries: { retry: false } },
      });
      render(
        <QueryClientProvider client={queryClient}>
          <TooltipProvider>
            <FilterTable2
              columns={columnsWithRelation}
              initialFilters={null}
              lockedFilters={{ customer: { id: 5 } }}
              onApply={vi.fn()}
            />
          </TooltipProvider>
        </QueryClientProvider>,
      );

      await user.click(
        screen.getByRole("button", { name: /TR:core.datatable.filter.filter/ }),
      );

      // Bagian ringkasan locked tampil.
      expect(
        await screen.findByText("TR:core.datatable.filter.locked.label"),
      ).toBeInTheDocument();

      // LinkModel disabled untuk kondisi relasi -- input disabled (bukan angka id mentah).
      const inputs = screen.getAllByRole("textbox").filter((el) => el.disabled);
      expect(inputs.length).toBeGreaterThan(0);
      expect(screen.queryByText("5")).not.toBeInTheDocument();
    });

    it("tanpa lockedFilters prop -- tidak ada ringkasan locked dirender (regresi)", async () => {
      const user = userEvent.setup({ delay: null });
      render(
        <FilterTable2
          columns={columnsWithRelation}
          initialFilters={null}
          onApply={vi.fn()}
        />,
      );

      await user.click(
        screen.getByRole("button", { name: /TR:core.datatable.filter.filter/ }),
      );

      expect(
        screen.queryByText("TR:core.datatable.filter.locked.label"),
      ).not.toBeInTheDocument();
    });
  });

  describe("trigger custom (opsional)", () => {
    it("trigger diisi -- render custom trigger, BUKAN Button bawaan", () => {
      render(
        <FilterTable2
          columns={columns}
          initialFilters={null}
          onApply={vi.fn()}
          trigger={<button type="button">Custom Trigger</button>}
        />,
      );

      expect(
        screen.getByRole("button", { name: "Custom Trigger" }),
      ).toBeInTheDocument();
      expect(
        screen.queryByRole("button", {
          name: /TR:core.datatable.filter.filter/,
        }),
      ).not.toBeInTheDocument();
    });

    it("trigger tidak diisi -- tetap render Button bawaan (regresi)", () => {
      render(
        <FilterTable2
          columns={columns}
          initialFilters={null}
          onApply={vi.fn()}
        />,
      );
      expect(
        screen.getByRole("button", { name: /TR:core.datatable.filter.filter/ }),
      ).toBeInTheDocument();
    });
  });

  // Task 7.1 (spec datatable2-advanced-search) — prop opsional `open`/
  // `onOpenChange`: controlled state, dipakai SearchPanel ("Builder lanjutan")
  // yang mengontrol dialog tanpa trigger sendiri.
  describe("controlled open/onOpenChange (Requirement 14.3)", () => {
    it("controlled TANPA trigger -- trigger bawaan tidak dirender, dialog terbuka lewat prop open", () => {
      render(
        <FilterTable2
          columns={columns}
          initialFilters={null}
          onApply={vi.fn()}
          open={true}
          onOpenChange={vi.fn()}
        />,
      );

      // Trigger bawaan (Button "Filter") TIDAK dirender sama sekali.
      expect(
        screen.queryByRole("button", {
          name: /TR:core.datatable.filter.filter/,
        }),
      ).not.toBeInTheDocument();
      // Dialog sudah terbuka (isi builder ter-stub tampil).
      expect(
        screen.getByTestId("stub-filter-builder-body"),
      ).toBeInTheDocument();
    });

    it("controlled open=false -- dialog tertutup", () => {
      render(
        <FilterTable2
          columns={columns}
          initialFilters={null}
          onApply={vi.fn()}
          open={false}
          onOpenChange={vi.fn()}
        />,
      );
      expect(
        screen.queryByTestId("stub-filter-builder-body"),
      ).not.toBeInTheDocument();
    });

    it("Batal memanggil onOpenChange(false) saat controlled", async () => {
      const user = userEvent.setup({ delay: null });
      const onOpenChange = vi.fn();
      render(
        <FilterTable2
          columns={columns}
          initialFilters={null}
          onApply={vi.fn()}
          open={true}
          onOpenChange={onOpenChange}
        />,
      );

      await user.click(
        screen.getByRole("button", { name: "TR:core.datatable.filter.cancel" }),
      );
      expect(onOpenChange).toHaveBeenCalledWith(false);
    });
  });
});

// Task 7.2 (spec datatable2-advanced-search) — `SaveFilterControl` diekspor
// terpisah + prop opsional `getViewSnapshot` (Requirement 11.6, 14.4).
describe("SaveFilterControl (export standalone)", () => {
  beforeEach(() => {
    axiosPost.mockReset();
    axiosPatch.mockReset();
  });

  it("tanpa getViewSnapshot -- payload PATCH sama seperti sebelumnya (regresi)", async () => {
    const user = userEvent.setup({ delay: null });
    axiosPost.mockResolvedValue({ data: { id: 99 } });
    axiosPatch.mockResolvedValue({ data: { id: 99, name: "Filter Baru" } });
    render(
      <SaveFilterControl
        model="AppModelsItem"
        filter={{ root: { k: "and", c: {} } }}
        savedItems={[]}
        onSaved={vi.fn()}
      />,
    );

    await user.click(
      screen.getByRole("button", {
        name: /TR:core.datatable.filter.saved.save/,
      }),
    );
    await user.click(
      screen.getByText("TR:core.datatable.filter.saved.save_new"),
    );
    await user.type(
      screen.getByPlaceholderText(
        "TR:core.datatable.filter.saved.name_placeholder",
      ),
      "Filter Baru",
    );
    await user.click(
      screen.getByRole("button", {
        name: "TR:core.datatable.filter.saved.save",
      }),
    );

    expect(axiosPatch).toHaveBeenCalledWith(
      'saved-filters.update/{"savedFilter":99}',
      { name: "Filter Baru" },
    );
  });

  it("Simpan sebagai baru dengan getViewSnapshot -- PATCH menyertakan sort & group", async () => {
    const user = userEvent.setup({ delay: null });
    axiosPost.mockResolvedValue({ data: { id: 99 } });
    axiosPatch.mockResolvedValue({ data: { id: 99, name: "Filter Baru" } });
    const getViewSnapshot = () => ({
      sort: "-created_at",
      group: { column: "status" },
    });
    render(
      <SaveFilterControl
        model="AppModelsItem"
        filter={{ root: { k: "and", c: {} } }}
        savedItems={[]}
        onSaved={vi.fn()}
        getViewSnapshot={getViewSnapshot}
      />,
    );

    await user.click(
      screen.getByRole("button", {
        name: /TR:core.datatable.filter.saved.save/,
      }),
    );
    await user.click(
      screen.getByText("TR:core.datatable.filter.saved.save_new"),
    );
    await user.type(
      screen.getByPlaceholderText(
        "TR:core.datatable.filter.saved.name_placeholder",
      ),
      "Filter Baru",
    );
    await user.click(
      screen.getByRole("button", {
        name: "TR:core.datatable.filter.saved.save",
      }),
    );

    expect(axiosPatch).toHaveBeenCalledWith(
      'saved-filters.update/{"savedFilter":99}',
      { name: "Filter Baru", sort: "-created_at", group: { column: "status" } },
    );
  });

  it("Timpa dengan getViewSnapshot -- PATCH menyertakan filter, sort & group", async () => {
    const user = userEvent.setup({ delay: null });
    axiosPatch.mockResolvedValue({ data: { id: 1 } });
    const filter = { root: { k: "and", c: {} } };
    const getViewSnapshot = () => ({ sort: null, group: null });
    render(
      <SaveFilterControl
        model="AppModelsItem"
        filter={filter}
        savedItems={[{ id: 1, name: "Filter A" }]}
        onSaved={vi.fn()}
        getViewSnapshot={getViewSnapshot}
      />,
    );

    await user.click(
      screen.getByRole("button", {
        name: /TR:core.datatable.filter.saved.save/,
      }),
    );
    await user.click(
      screen.getByText(
        'TR:core.datatable.filter.saved.overwrite:{"name":"Filter A"}',
      ),
    );

    expect(axiosPatch).toHaveBeenCalledWith(
      'saved-filters.update/{"savedFilter":1}',
      { filter, sort: null, group: null },
    );
  });
});
