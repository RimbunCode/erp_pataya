import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

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

window.route = (name, params) =>
  params ? `${name}/${JSON.stringify(params)}` : name;

import FilterTable2 from "./FilterTable2";

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
});
