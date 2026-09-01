import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

// t harus stabil (konstanta module-level) -- DataTable2 punya beberapa
// useEffect/useCallback ber-dependency `t` (mis. persistFilterTree), fungsi
// baru tiap render dapat memicu infinite loop / re-fetch tak terkendali.
const stableT = (key) => `TR:${key}`;
vi.mock("laravel-react-i18n", () => ({
  useLaravelReactI18n: () => ({ t: stableT }),
}));

const routerGet = vi.fn();
const usePageMock = vi.fn();
vi.mock("@inertiajs/react", () => ({
  usePage: () => usePageMock(),
  router: { get: (...a) => routerGet(...a) },
  Head: ({ title }) => <title>{title}</title>,
}));

const axiosGet = vi.fn();
const axiosPost = vi.fn();
vi.mock("axios", () => ({
  default: {
    get: (...a) => axiosGet(...a),
    post: (...a) => axiosPost(...a),
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

// useDeleteModal adalah zustand store -- mock deleteItem sebagai spy agar
// dapat diverifikasi dipanggil dengan route/id/attributes yang benar, tanpa
// perlu merender DeleteDialog sungguhan (concern-nya sendiri, sudah di luar
// scope orkestrasi DataTable2).
const deleteItemSpy = vi.fn();
vi.mock("@/Hooks/useDeleteModal", () => ({
  default: () => ({ deleteItem: (...a) => deleteItemSpy(...a) }),
}));

// usePermission -- default izinkan semua aksi agar behavior default (create,
// delete) dapat diuji; test spesifik override lewat mockImplementation.
const canMock = vi.fn(() => true);
vi.mock("@/Hooks/usePermission", () => ({
  default: () => ({ can: (...a) => canMock(...a) }),
}));

// useIsMobile -- default desktop (false); test mobile override lewat
// mockReturnValue.
const isMobileMock = vi.fn(() => false);
vi.mock("@/Hooks/use-mobile", () => ({
  useIsMobile: () => isMobileMock(),
}));

// createFilterGroup/createFilterItem -- factory sederhana, cukup stub agar
// bentuk objek yang dikembalikan dapat diprediksi test tanpa menarik logic
// asli useNestedFilters (concern terpisah, sudah ditest sendiri).
vi.mock("@/Hooks/useNestedFilters", () => ({
  createFilterGroup: (props) => ({ k: "and", c: {}, ...props }),
  createFilterItem: (props) => ({ ...props }),
}));

// AppLayout membungkus navbar/sidebar penuh -- tidak relevan untuk test
// orkestrasi DataTable2, stub sebagai passthrough agar tidak ikut merender.
vi.mock("@/Layouts/AppLayout", () => ({
  default: ({ children }) => (
    <div data-testid="stub-app-layout">{children}</div>
  ),
}));

// FormPageDialog -- dialog create punya kompleksitas form tersendiri (sudah
// concern FormPage.jsx). Stub sederhana yang "open" saat tombol Add diklik
// (meniru dialogRef.current.open() asli) dan merender children (form) saat
// terbuka.
vi.mock("./FormPage", () => ({
  FormPageDialog: React.forwardRef(function StubFormPageDialog(
    { children, title, name },
    ref,
  ) {
    const [open, setOpen] = React.useState(false);
    React.useImperativeHandle(ref, () => ({ open: () => setOpen(true) }));
    if (!open) return null;
    return (
      <div
        data-testid="stub-form-page-dialog"
        data-title={title}
        data-name={name}
      >
        {children}
      </div>
    );
  }),
}));

// Table2 -- render tabel sungguhan sudah ditest di Table2.rtl.test.jsx. Stub
// capture props penting (columns, data, options, actions) agar test
// DataTable2 fokus ke apa yang DITERUSKAN, bukan cara Table2 merendernya.
const table2Props = vi.fn();
vi.mock("@/Components/Table/Table2", () => ({
  default: (props) => {
    table2Props(props);
    return (
      <div data-testid="stub-table2">
        <button onClick={() => props.setSort("name")}>trigger-set-sort</button>
        <button onClick={() => props.resetSorting()}>trigger-reset-sort</button>
        <button
          onClick={() => props.onOptionsChanged({ ...props.options, page: 9 })}
        >
          trigger-options-changed
        </button>
        {props.data?.map((row) => (
          <div key={row.id} data-testid={`row-${row.id}`}>
            {props.actions?.({ dataRow: row })}
          </div>
        ))}
      </div>
    );
  },
}));

// FilterTable2 -- dialog filter builder sudah ditest sendiri
// (FilterTable2.rtl.test.jsx). Stub capture props & expose tombol untuk
// memicu callback onApply/onSaved dari test.
const filterTableProps = vi.fn();
vi.mock("@/Components/Table/Filter/FilterTable2", () => ({
  default: (props) => {
    filterTableProps(props);
    return (
      <div data-testid={`stub-filter-table2${props.isMobile ? "-mobile" : ""}`}>
        <button
          onClick={() =>
            // FilterTable2 asli menangani reject onApply sendiri (update state
            // loading dialog) -- stub ini cuma memicu callback, jadi reject
            // harus ditelan manual di sini agar tidak jadi unhandled rejection
            // saat test sengaja mensimulasikan onApply gagal (422/500).
            props
              .onApply(
                {
                  root: {
                    k: "and",
                    c: { a: { k: "status", o: "=", v: "open" } },
                  },
                },
                null,
              )
              .catch(() => {})
          }
        >
          trigger-apply-filter
        </button>
        <button onClick={() => props.onSaved({ id: 55, filter: {} })}>
          trigger-saved-filter
        </button>
        <button onClick={() => props.onSaved(null)}>
          trigger-clear-saved-filter
        </button>
      </div>
    );
  },
}));

// Pagination -- sudah ditest sendiri (Pagination.rtl.test.jsx). Stub capture
// props agar test cukup verifikasi currentPage/totalPages/onPageChanged
// diteruskan dengan benar oleh DataTable2.
const paginationProps = vi.fn();
vi.mock("@/Components/Table/Pagination", () => ({
  default: (props) => {
    paginationProps(props);
    return (
      <div data-testid="stub-pagination">
        <button onClick={() => props.onPageChanged(props.currentPage + 1)}>
          next-page
        </button>
      </div>
    );
  },
}));

vi.mock("@/Components/Table/NoDataImg", () => ({
  default: (props) => <div data-testid="stub-no-data-img" {...props} />,
}));

window.route = (name, params) =>
  params ? `${name}/${JSON.stringify(params)}` : name;

import React from "react";
import DataTable2 from "./DataTable2";
import { TooltipProvider } from "@/Components/ui/tooltip";

// DataTable2 memakai <Tooltip> (tombol reload & sort order) tanpa membungkus
// TooltipProvider sendiri -- di app nyata provider ini datang dari ancestor
// (root layout). Karena AppLayout di-stub di atas, sediakan provider di sini
// agar Tooltip tidak throw "must be used within TooltipProvider".
function renderDataTable2(ui, options) {
  return render(<TooltipProvider>{ui}</TooltipProvider>, options);
}

const dataTableColumns = {
  name: {
    name: "name",
    titleTrans: "supplier.columns.name",
    searchType: "text",
    sortable: true,
    show: true,
  },
  code: {
    name: "code",
    titleTrans: "supplier.columns.code",
    searchType: "text",
    sortable: true,
    show: true,
  },
  // hidden -- tidak boleh muncul di columns/mapColumns.
  secret_field: {
    name: "secret_field",
    titleTrans: "supplier.columns.secret",
    hidden: true,
  },
  // meta-append column -- juga tidak boleh muncul (lihat
  // lib/utils.js#META_APPEND_COLUMN_NAMES).
  canDelete: {
    name: "canDelete",
    titleTrans: "supplier.columns.can_delete",
  },
};

const baseData = {
  data: [
    {
      id: 1,
      name: "Supplier A",
      code: "S1",
      canDelete: true,
      created_by_id: 1,
    },
    {
      id: 2,
      name: "Supplier B",
      code: "S2",
      canDelete: true,
      created_by_id: 2,
    },
  ],
  last_page: 1,
};

function makePageProps(overrides = {}) {
  return {
    ziggy: { query: {} },
    data: baseData,
    defaultSort: "name",
    dataTableColumns,
    translateKey: "supplier",
    model: "App\\Models\\Purchase\\Supplier",
    name: "supplier",
    preferences: { num_per_page: 25, per_page_options: [25, 50, 100] },
    auth: { user: { id: 1 } },
    ...overrides,
  };
}

describe("DataTable2", () => {
  beforeEach(() => {
    routerGet.mockReset();
    axiosGet.mockReset();
    axiosPost.mockReset();
    toastSuccess.mockReset();
    toastError.mockReset();
    deleteItemSpy.mockReset();
    canMock.mockReset();
    canMock.mockReturnValue(true);
    isMobileMock.mockReset();
    isMobileMock.mockReturnValue(false);
    table2Props.mockReset();
    filterTableProps.mockReset();
    paginationProps.mockReset();
    axiosGet.mockResolvedValue({ data: {} });
    axiosPost.mockResolvedValue({ data: { id: 1 } });
    usePageMock.mockReturnValue({ props: makePageProps() });
    // `document.cookie = ""` TIDAK menghapus cookie yang sudah ada (no-op) --
    // expire eksplisit agar datatable_show tidak bocor antar test.
    document.cookie = "datatable_show=; expires=Thu, 01 Jan 1970 00:00:00 UTC";
    vi.useFakeTimers({ shouldAdvanceTime: true });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("merender judul halaman dari translateKey", () => {
    renderDataTable2(<DataTable2 />);
    expect(screen.getByText("TR:supplier.title")).toBeInTheDocument();
  });

  it("meneruskan mapColumns yang sudah difilter (tanpa hidden & meta-append) ke Table2", () => {
    renderDataTable2(<DataTable2 />);
    const props = table2Props.mock.calls.at(-1)[0];
    const columnNames = Object.keys(props.columns);
    expect(columnNames).toEqual(["name", "code"]);
    expect(columnNames).not.toContain("secret_field");
    expect(columnNames).not.toContain("canDelete");
  });

  it("meneruskan data.data dan options awal (sort/page/show) ke Table2", () => {
    renderDataTable2(<DataTable2 />);
    const props = table2Props.mock.calls.at(-1)[0];
    expect(props.data).toEqual(baseData.data);
    expect(props.options).toEqual(
      expect.objectContaining({ sort: "name", page: 1, show: 25, fid: null }),
    );
  });

  it("options.show awal mengikuti query param ?show jika ada", () => {
    usePageMock.mockReturnValue({
      props: makePageProps({ ziggy: { query: { show: "50" } } }),
    });
    renderDataTable2(<DataTable2 />);
    const props = table2Props.mock.calls.at(-1)[0];
    expect(props.options.show).toBe("50");
  });

  it("options.show awal fallback ke cookie datatable_show jika query tidak ada", () => {
    document.cookie = "datatable_show=100";
    renderDataTable2(<DataTable2 />);
    const props = table2Props.mock.calls.at(-1)[0];
    expect(props.options.show).toBe("100");
  });

  it("Select show (desktop footer) menampilkan value show saat ini, termasuk value non-default dari query", () => {
    usePageMock.mockReturnValue({
      props: makePageProps({ ziggy: { query: { show: "77" } } }),
    });
    renderDataTable2(<DataTable2 />);

    expect(screen.getByText("77")).toBeInTheDocument();
  });

  it("mengubah show via Select mereset page ke 1 dan memicu loadData setelah debounce", async () => {
    // Radix Select pakai pointer capture + async open yang tidak kooperatif
    // dengan fake timers -- lepas fake timers untuk interaksi buka/pilih,
    // lalu pasang lagi fake timers khusus untuk menguji debounce loadData.
    vi.useRealTimers();
    const user = userEvent.setup({ delay: null, pointerEventsCheck: 0 });
    renderDataTable2(<DataTable2 />);

    const showTrigger = screen.getByText("25").closest("button");
    showTrigger.focus();
    await user.keyboard("{Enter}");
    const listbox = await screen.findByRole("listbox");
    const option50 = within(listbox).getByText("50");
    await user.click(option50);

    await screen.findByText("50");

    // loadData didebounce 500ms lewat setTimeout asli (real timers, karena
    // Select dibuka/dipilih di luar fake timers) -- tunggu via waitFor,
    // bukan vi.advanceTimersByTimeAsync yang cuma memajukan clock palsu.
    await vi.waitFor(
      () => {
        expect(routerGet).toHaveBeenCalledTimes(1);
      },
      { timeout: 2000 },
    );
    const [url] = routerGet.mock.calls[0];
    expect(url).toContain("show=50");
    expect(url).toContain("page=1");
  });

  it("klik tombol reload memanggil loadData langsung", async () => {
    const user = userEvent.setup({ delay: null });
    renderDataTable2(<DataTable2 />);

    const reloadButton = document
      .querySelector("button svg.lucide-refresh-cw")
      ?.closest("button");
    expect(reloadButton).toBeTruthy();
    await user.click(reloadButton);

    expect(routerGet).toHaveBeenCalledTimes(1);
    const [url, , options] = routerGet.mock.calls[0];
    expect(url).toContain(window.location.pathname);
    expect(options).toEqual(
      expect.objectContaining({
        reset: ["data", "ziggy"],
        preserveScroll: true,
        preserveState: true,
        replace: true,
      }),
    );
  });

  it("setSort dari Table2 (tanpa arg) toggle asc->desc pada kolom yang sama, lalu reset page", async () => {
    const user = userEvent.setup({
      delay: null,
      advanceTimers: vi.advanceTimersByTime,
    });
    usePageMock.mockReturnValue({
      props: makePageProps({ ziggy: { query: { sort: "name", page: "3" } } }),
    });
    renderDataTable2(<DataTable2 />);

    await user.click(screen.getByText("trigger-set-sort"));
    await vi.advanceTimersByTimeAsync(600);

    expect(routerGet).toHaveBeenCalledTimes(1);
    const [url] = routerGet.mock.calls[0];
    expect(url).toContain("sort=-name");
    expect(url).toContain("page=1");
  });

  it("resetSorting mengembalikan sort ke defaultSort dan page ke 1", async () => {
    const user = userEvent.setup({
      delay: null,
      advanceTimers: vi.advanceTimersByTime,
    });
    usePageMock.mockReturnValue({
      props: makePageProps({
        defaultSort: "code",
        ziggy: { query: { sort: "-name", page: "5" } },
      }),
    });
    renderDataTable2(<DataTable2 />);

    await user.click(screen.getByText("trigger-reset-sort"));
    await vi.advanceTimersByTimeAsync(600);

    const [url] = routerGet.mock.calls[0];
    expect(url).toContain("sort=code");
    expect(url).toContain("page=1");
  });

  it("onOptionsChanged dari Table2 (mis. resize/reorder kolom) langsung sinkron ke options & memicu loadData", async () => {
    const user = userEvent.setup({
      delay: null,
      advanceTimers: vi.advanceTimersByTime,
    });
    renderDataTable2(<DataTable2 />);

    await user.click(screen.getByText("trigger-options-changed"));
    await vi.advanceTimersByTimeAsync(600);

    const [url] = routerGet.mock.calls[0];
    expect(url).toContain("page=9");
  });

  it("Pagination menerima currentPage, totalPages dari data.last_page, dan onPageChanged memicu loadData", async () => {
    usePageMock.mockReturnValue({
      props: makePageProps({
        data: { data: baseData.data, last_page: 4 },
        ziggy: { query: { page: "2" } },
      }),
    });
    const user = userEvent.setup({
      delay: null,
      advanceTimers: vi.advanceTimersByTime,
    });
    renderDataTable2(<DataTable2 />);

    const props = paginationProps.mock.calls.at(-1)[0];
    expect(props.currentPage).toBe(2);
    expect(props.totalPages).toBe(4);

    await user.click(screen.getByText("next-page"));
    await vi.advanceTimersByTimeAsync(600);

    const [url] = routerGet.mock.calls[0];
    expect(url).toContain("page=3");
  });

  it("tombol delete (actions bawaan) memanggil deleteItem dengan route plural & id yang benar", async () => {
    const user = userEvent.setup({ delay: null });
    renderDataTable2(<DataTable2 />);

    const row1 = screen.getByTestId("row-1");
    const deleteButton = within(row1).getByRole("button");
    await user.click(deleteButton);

    expect(deleteItemSpy).toHaveBeenCalledWith(
      "suppliers.destroy",
      1,
      expect.objectContaining({ usePasswordConfirmation: undefined }),
    );
  });

  it("tombol delete tidak muncul saat dataRow.canDelete === false", () => {
    usePageMock.mockReturnValue({
      props: makePageProps({
        data: {
          data: [{ id: 3, name: "No Delete", code: "S3", canDelete: false }],
          last_page: 1,
        },
      }),
    });
    renderDataTable2(<DataTable2 />);

    const row = screen.getByTestId("row-3");
    expect(within(row).queryByRole("button")).not.toBeInTheDocument();
  });

  it("tombol delete tidak muncul saat can('delete') false", () => {
    canMock.mockImplementation((action) => action !== "delete");
    renderDataTable2(<DataTable2 />);

    const row1 = screen.getByTestId("row-1");
    expect(within(row1).queryByRole("button")).not.toBeInTheDocument();
  });

  it("usePasswordConfirmationForDelete diteruskan ke deleteItem", async () => {
    const user = userEvent.setup({ delay: null });
    renderDataTable2(<DataTable2 usePasswordConfirmationForDelete />);

    const row1 = screen.getByTestId("row-1");
    await user.click(within(row1).getByRole("button"));

    expect(deleteItemSpy).toHaveBeenCalledWith(
      "suppliers.destroy",
      1,
      expect.objectContaining({ usePasswordConfirmation: true }),
    );
  });

  describe("tombol tambah (create) & FormPageDialog", () => {
    it("menampilkan tombol Add saat form diberikan dan canCreate true", () => {
      renderDataTable2(<DataTable2 form={<div>Form Isi</div>} />);
      expect(screen.getByText("TR:supplier.add")).toBeInTheDocument();
    });

    it("tidak menampilkan tombol Add saat form tidak diberikan", () => {
      renderDataTable2(<DataTable2 />);
      expect(screen.queryByText("TR:supplier.add")).not.toBeInTheDocument();
    });

    it("tidak menampilkan tombol Add saat can('create') false", () => {
      canMock.mockImplementation((action) => action !== "create");
      renderDataTable2(<DataTable2 form={<div>Form Isi</div>} />);
      expect(screen.queryByText("TR:supplier.add")).not.toBeInTheDocument();
    });

    it("forceCanCreate=true menampilkan tombol Add walau can('create') false", () => {
      canMock.mockImplementation((action) => action !== "create");
      renderDataTable2(
        <DataTable2 form={<div>Form Isi</div>} forceCanCreate />,
      );
      expect(screen.getByText("TR:supplier.add")).toBeInTheDocument();
    });

    it("klik tombol Add membuka FormPageDialog berisi form", async () => {
      const user = userEvent.setup({ delay: null });
      renderDataTable2(<DataTable2 form={<div>Form Isi</div>} />);

      await user.click(screen.getByText("TR:supplier.add"));

      expect(screen.getByTestId("stub-form-page-dialog")).toBeInTheDocument();
      expect(screen.getByText("Form Isi")).toBeInTheDocument();
    });
  });

  describe("mode mobile (isMobile=true)", () => {
    beforeEach(() => {
      isMobileMock.mockReturnValue(true);
    });

    it("merender templateItem per baris data, bukan Table2", () => {
      const templateItem = ({ dataRow }) => (
        <div>Mobile Row {dataRow.name}</div>
      );
      renderDataTable2(<DataTable2 templateItem={templateItem} />);

      expect(screen.getByText("Mobile Row Supplier A")).toBeInTheDocument();
      expect(screen.getByText("Mobile Row Supplier B")).toBeInTheDocument();
      expect(screen.queryByTestId("stub-table2")).not.toBeInTheDocument();
    });

    it("menampilkan NoDataImg saat data kosong", () => {
      usePageMock.mockReturnValue({
        props: makePageProps({ data: { data: [], last_page: 1 } }),
      });
      renderDataTable2(<DataTable2 />);

      expect(screen.getByTestId("stub-no-data-img")).toBeInTheDocument();
    });

    it("templateItem menerima closure deleteItem yang memanggil deleteItem hook saat dipanggil", async () => {
      const user = userEvent.setup({ delay: null });
      const templateItem = ({ dataRow, deleteItem }) => (
        <button onClick={deleteItem}>Hapus {dataRow.name}</button>
      );
      renderDataTable2(<DataTable2 templateItem={templateItem} />);

      await user.click(screen.getByText("Hapus Supplier A"));

      expect(deleteItemSpy).toHaveBeenCalledWith(
        "suppliers.destroy",
        1,
        expect.objectContaining({ usePasswordConfirmation: undefined }),
      );
    });
  });

  describe("filter builder (FilterTable2) & saved filter", () => {
    it("meneruskan mapColumns & activeFid (dari options.fid) ke FilterTable2", () => {
      usePageMock.mockReturnValue({
        props: makePageProps({ ziggy: { query: { fid: "12" } } }),
      });
      renderDataTable2(<DataTable2 />);

      const props = filterTableProps.mock.calls.at(-1)[0];
      expect(props.activeFid).toBe("12");
      expect(Object.keys(props.columns)).toEqual(["name", "code"]);
    });

    it("saat mount dengan ?fid, fetch saved-filters.show dan set filterTree dari response", async () => {
      axiosGet.mockResolvedValue({
        data: { filter: { root: { k: "and", c: {} } } },
      });
      usePageMock.mockReturnValue({
        props: makePageProps({ ziggy: { query: { fid: "12" } } }),
      });
      renderDataTable2(<DataTable2 />);

      await vi.waitFor(() => {
        expect(axiosGet).toHaveBeenCalledWith(
          'saved-filters.show/{"savedFilter":"12"}',
        );
      });
    });

    it("onApply (bukan useExisting) memanggil axios.post saved-filters.store dengan model & tree, lalu set fid dari response & toast success", async () => {
      const user = userEvent.setup({ delay: null });
      axiosPost.mockResolvedValue({ data: { id: 77 } });
      renderDataTable2(<DataTable2 />);

      await user.click(screen.getByText("trigger-apply-filter"));

      expect(axiosPost).toHaveBeenCalledWith(
        "saved-filters.store",
        expect.objectContaining({
          model: "App\\Models\\Purchase\\Supplier",
          fid: null,
        }),
      );
      await vi.waitFor(() => {
        expect(toastSuccess).toHaveBeenCalledWith(
          "TR:core.datatable.filter.save.success",
        );
      });
    });

    it("onApply gagal (422) menampilkan toast error dari response.errors.filter", async () => {
      const user = userEvent.setup({ delay: null });
      axiosPost.mockRejectedValue({
        response: {
          status: 422,
          data: { errors: { filter: ["Filter kosong"] } },
        },
      });
      renderDataTable2(<DataTable2 />);

      await user.click(screen.getByText("trigger-apply-filter"));

      await vi.waitFor(() => {
        expect(toastError).toHaveBeenCalledWith("Filter kosong");
      });
    });

    it("onApply gagal non-422 menampilkan toast error umum", async () => {
      const user = userEvent.setup({ delay: null });
      axiosPost.mockRejectedValue({ response: { status: 500 } });
      renderDataTable2(<DataTable2 />);

      await user.click(screen.getByText("trigger-apply-filter"));

      await vi.waitFor(() => {
        expect(toastError).toHaveBeenCalledWith(
          "TR:core.datatable.filter.save.error",
        );
      });
    });

    it("onSaved dengan item (mis. pilih saved filter) mengeset options.fid", async () => {
      const user = userEvent.setup({
        delay: null,
        advanceTimers: vi.advanceTimersByTime,
      });
      renderDataTable2(<DataTable2 />);

      await user.click(screen.getByText("trigger-saved-filter"));
      await vi.advanceTimersByTimeAsync(600);

      const [url] = routerGet.mock.calls[0];
      expect(url).toContain("fid=55");
    });

    it("onSaved(null) (mis. named filter aktif dihapus) menghapus fid dari options", async () => {
      const user = userEvent.setup({
        delay: null,
        advanceTimers: vi.advanceTimersByTime,
      });
      usePageMock.mockReturnValue({
        props: makePageProps({ ziggy: { query: { fid: "12" } } }),
      });
      renderDataTable2(<DataTable2 />);

      await user.click(screen.getByText("trigger-clear-saved-filter"));
      await vi.advanceTimersByTimeAsync(600);

      const [url] = routerGet.mock.calls[0];
      expect(url).not.toContain("fid=12");
    });

    it("tombol X (clear filter) muncul saat options.fid aktif dan menghapusnya saat diklik", async () => {
      const user = userEvent.setup({
        delay: null,
        advanceTimers: vi.advanceTimersByTime,
      });
      usePageMock.mockReturnValue({
        props: makePageProps({ ziggy: { query: { fid: "12" } } }),
      });
      renderDataTable2(<DataTable2 />);

      const clearButton = document
        .querySelector("button svg.lucide-x")
        ?.closest("button");
      expect(clearButton).toBeTruthy();
      await user.click(clearButton);
      await vi.advanceTimersByTimeAsync(600);

      const [url] = routerGet.mock.calls[0];
      expect(url).not.toContain("fid=12");
    });

    it("tombol X (clear filter) tidak muncul saat tidak ada fid aktif", () => {
      renderDataTable2(<DataTable2 />);
      const clearButton = document.querySelector("button svg.lucide-x");
      expect(clearButton).toBeFalsy();
    });
  });

  describe("useImperativeHandle addFilter (quick filter dari klik cell)", () => {
    it("memanggil ref.addFilter membangun filter item baru dan mem-persist via axios.post", async () => {
      axiosPost.mockResolvedValue({ data: { id: 88 } });
      const ref = React.createRef();
      renderDataTable2(<DataTable2 ref={ref} />);

      ref.current.addFilter("name", "=", "Supplier A");

      await vi.waitFor(() => {
        expect(axiosPost).toHaveBeenCalledTimes(1);
      });

      const [routeName, payload] = axiosPost.mock.calls[0];
      expect(routeName).toBe("saved-filters.store");
      expect(payload.model).toBe("App\\Models\\Purchase\\Supplier");
      // `c` diberi key dinamis (Date.now()) oleh addFilter -- ambil satu2nya
      // value-nya alih-alih menebak key persis.
      const items = Object.values(payload.filter.root.c);
      expect(items).toEqual([{ k: "name", o: "=", v: "Supplier A" }]);
    });
  });
});
