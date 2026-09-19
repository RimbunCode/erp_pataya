import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { act, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

// t harus stabil (konstanta module-level) -- DataTable2 punya beberapa
// useEffect/useCallback ber-dependency `t` (mis. persistFilterTree), fungsi
// baru tiap render dapat memicu infinite loop / re-fetch tak terkendali.
const stableT = (key) => `TR:${key}`;
// currentLocale: bahasa aktif app, dipakai utk pengurutan abjad opsi Sort
// By/Group by (default undefined -> locale bawaan runtime).
const { currentLocaleMock } = vi.hoisted(() => ({
  currentLocaleMock: vi.fn(),
}));
vi.mock("laravel-react-i18n", () => ({
  useLaravelReactI18n: () => ({
    t: stableT,
    currentLocale: currentLocaleMock,
  }),
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
  DATE_GROUP_GRANULARITIES: ["day", "month", "quarter", "half", "year"],
  DEFAULT_NUMBER_GROUP_RANGE_OPTIONS: [10, 100, 1000],
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
// DataTable2 menembak axios (loadData) di useEffect saat mount TANPA
// di-await test-nya -- render() polos RTL cuma membungkus bagian SINKRON
// dalam act(), promise mock (walau resolve instan) tetap lanjut di
// microtask SESUDAH act() itu selesai. Bungkus render() ITU SENDIRI dalam
// `await act(async () => {})` supaya semua microtask stabil dulu.
async function renderDataTable2(ui, options) {
  let result;
  await act(async () => {
    result = render(<TooltipProvider>{ui}</TooltipProvider>, options);
  });
  return result;
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
    currentLocaleMock.mockReset();
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

  it("merender judul halaman dari translateKey", async () => {
    await renderDataTable2(<DataTable2 />);
    expect(screen.getByText("TR:supplier.title")).toBeInTheDocument();
  });

  it("meneruskan mapColumns yang sudah difilter (tanpa hidden & meta-append) ke Table2", async () => {
    await renderDataTable2(<DataTable2 />);
    const props = table2Props.mock.calls.at(-1)[0];
    const columnNames = Object.keys(props.columns);
    expect(columnNames).toEqual(["name", "code"]);
    expect(columnNames).not.toContain("secret_field");
    expect(columnNames).not.toContain("canDelete");
  });

  it("meneruskan data.data dan options awal (sort/page/show) ke Table2", async () => {
    await renderDataTable2(<DataTable2 />);
    const props = table2Props.mock.calls.at(-1)[0];
    expect(props.data).toEqual(baseData.data);
    expect(props.options).toEqual(
      expect.objectContaining({ sort: "name", page: 1, show: 25, fid: null }),
    );
  });

  it("options.show awal mengikuti query param ?show jika ada", async () => {
    usePageMock.mockReturnValue({
      props: makePageProps({ ziggy: { query: { show: "50" } } }),
    });
    await renderDataTable2(<DataTable2 />);
    const props = table2Props.mock.calls.at(-1)[0];
    expect(props.options.show).toBe("50");
  });

  it("options.show awal fallback ke cookie datatable_show jika query tidak ada", async () => {
    document.cookie = "datatable_show=100";
    await renderDataTable2(<DataTable2 />);
    const props = table2Props.mock.calls.at(-1)[0];
    expect(props.options.show).toBe("100");
  });

  it("Select show (desktop footer) menampilkan value show saat ini, termasuk value non-default dari query", async () => {
    usePageMock.mockReturnValue({
      props: makePageProps({ ziggy: { query: { show: "77" } } }),
    });
    await renderDataTable2(<DataTable2 />);

    expect(screen.getByText("77")).toBeInTheDocument();
  });

  it("mengubah show via Select mereset page ke 1 dan memicu loadData setelah debounce", async () => {
    // Radix Select pakai pointer capture + async open yang tidak kooperatif
    // dengan fake timers -- lepas fake timers untuk interaksi buka/pilih,
    // lalu pasang lagi fake timers khusus untuk menguji debounce loadData.
    vi.useRealTimers();
    const user = userEvent.setup({ delay: null, pointerEventsCheck: 0 });
    await renderDataTable2(<DataTable2 />);

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
    await renderDataTable2(<DataTable2 />);

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
        reset: ["data", "ziggy", "groupCounts"],
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
    await renderDataTable2(<DataTable2 />);

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
    await renderDataTable2(<DataTable2 />);

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
    await renderDataTable2(<DataTable2 />);

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
    await renderDataTable2(<DataTable2 />);

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
    await renderDataTable2(<DataTable2 />);

    const row1 = screen.getByTestId("row-1");
    const deleteButton = within(row1).getByRole("button");
    await user.click(deleteButton);

    expect(deleteItemSpy).toHaveBeenCalledWith(
      "suppliers.destroy",
      1,
      expect.objectContaining({ usePasswordConfirmation: undefined }),
    );
  });

  it("tombol delete tidak muncul saat dataRow.canDelete === false", async () => {
    usePageMock.mockReturnValue({
      props: makePageProps({
        data: {
          data: [{ id: 3, name: "No Delete", code: "S3", canDelete: false }],
          last_page: 1,
        },
      }),
    });
    await renderDataTable2(<DataTable2 />);

    const row = screen.getByTestId("row-3");
    expect(within(row).queryByRole("button")).not.toBeInTheDocument();
  });

  it("tombol delete tidak muncul saat can('delete') false", async () => {
    canMock.mockImplementation((action) => action !== "delete");
    await renderDataTable2(<DataTable2 />);

    const row1 = screen.getByTestId("row-1");
    expect(within(row1).queryByRole("button")).not.toBeInTheDocument();
  });

  it("usePasswordConfirmationForDelete diteruskan ke deleteItem", async () => {
    const user = userEvent.setup({ delay: null });
    await renderDataTable2(<DataTable2 usePasswordConfirmationForDelete />);

    const row1 = screen.getByTestId("row-1");
    await user.click(within(row1).getByRole("button"));

    expect(deleteItemSpy).toHaveBeenCalledWith(
      "suppliers.destroy",
      1,
      expect.objectContaining({ usePasswordConfirmation: true }),
    );
  });

  describe("tombol tambah (create) & FormPageDialog", () => {
    it("menampilkan tombol Add saat form diberikan dan canCreate true", async () => {
      await renderDataTable2(<DataTable2 form={<div>Form Isi</div>} />);
      expect(screen.getByText("TR:supplier.add")).toBeInTheDocument();
    });

    it("tidak menampilkan tombol Add saat form tidak diberikan", async () => {
      await renderDataTable2(<DataTable2 />);
      expect(screen.queryByText("TR:supplier.add")).not.toBeInTheDocument();
    });

    it("tidak menampilkan tombol Add saat can('create') false", async () => {
      canMock.mockImplementation((action) => action !== "create");
      await renderDataTable2(<DataTable2 form={<div>Form Isi</div>} />);
      expect(screen.queryByText("TR:supplier.add")).not.toBeInTheDocument();
    });

    it("forceCanCreate=true menampilkan tombol Add walau can('create') false", async () => {
      canMock.mockImplementation((action) => action !== "create");
      await renderDataTable2(
        <DataTable2 form={<div>Form Isi</div>} forceCanCreate />,
      );
      expect(screen.getByText("TR:supplier.add")).toBeInTheDocument();
    });

    it("klik tombol Add membuka FormPageDialog berisi form", async () => {
      const user = userEvent.setup({ delay: null });
      await renderDataTable2(<DataTable2 form={<div>Form Isi</div>} />);

      await user.click(screen.getByText("TR:supplier.add"));

      expect(screen.getByTestId("stub-form-page-dialog")).toBeInTheDocument();
      expect(screen.getByText("Form Isi")).toBeInTheDocument();
    });
  });

  describe("mode mobile (isMobile=true)", () => {
    beforeEach(() => {
      isMobileMock.mockReturnValue(true);
    });

    it("merender templateItem per baris data, bukan Table2", async () => {
      const templateItem = ({ dataRow }) => (
        <div>Mobile Row {dataRow.name}</div>
      );
      await renderDataTable2(<DataTable2 templateItem={templateItem} />);

      expect(screen.getByText("Mobile Row Supplier A")).toBeInTheDocument();
      expect(screen.getByText("Mobile Row Supplier B")).toBeInTheDocument();
      expect(screen.queryByTestId("stub-table2")).not.toBeInTheDocument();
    });

    it("menampilkan NoDataImg saat data kosong", async () => {
      usePageMock.mockReturnValue({
        props: makePageProps({ data: { data: [], last_page: 1 } }),
      });
      await renderDataTable2(<DataTable2 />);

      expect(screen.getByTestId("stub-no-data-img")).toBeInTheDocument();
    });

    it("templateItem menerima closure deleteItem yang memanggil deleteItem hook saat dipanggil", async () => {
      const user = userEvent.setup({ delay: null });
      const templateItem = ({ dataRow, deleteItem }) => (
        <button onClick={deleteItem}>Hapus {dataRow.name}</button>
      );
      await renderDataTable2(<DataTable2 templateItem={templateItem} />);

      await user.click(screen.getByText("Hapus Supplier A"));

      expect(deleteItemSpy).toHaveBeenCalledWith(
        "suppliers.destroy",
        1,
        expect.objectContaining({ usePasswordConfirmation: undefined }),
      );
    });
  });

  describe("filter builder (FilterTable2) & saved filter", () => {
    it("meneruskan mapColumns & activeFid (dari options.fid) ke FilterTable2", async () => {
      usePageMock.mockReturnValue({
        props: makePageProps({ ziggy: { query: { fid: "12" } } }),
      });
      await renderDataTable2(<DataTable2 />);

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
      await renderDataTable2(<DataTable2 />);

      await vi.waitFor(() => {
        expect(axiosGet).toHaveBeenCalledWith(
          'saved-filters.show/{"savedFilter":"12"}',
        );
      });
    });

    it("onApply (bukan useExisting) memanggil axios.post saved-filters.store dengan model & tree, lalu set fid dari response & toast success", async () => {
      const user = userEvent.setup({ delay: null });
      axiosPost.mockResolvedValue({ data: { id: 77 } });
      await renderDataTable2(<DataTable2 />);

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
      await renderDataTable2(<DataTable2 />);

      await user.click(screen.getByText("trigger-apply-filter"));

      await vi.waitFor(() => {
        expect(toastError).toHaveBeenCalledWith("Filter kosong");
      });
    });

    it("onApply gagal non-422 menampilkan toast error umum", async () => {
      const user = userEvent.setup({ delay: null });
      axiosPost.mockRejectedValue({ response: { status: 500 } });
      await renderDataTable2(<DataTable2 />);

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
      await renderDataTable2(<DataTable2 />);

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
      await renderDataTable2(<DataTable2 />);

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
      await renderDataTable2(<DataTable2 />);

      const clearButton = document
        .querySelector("button svg.lucide-x")
        ?.closest("button");
      expect(clearButton).toBeTruthy();
      await user.click(clearButton);
      await vi.advanceTimersByTimeAsync(600);

      const [url] = routerGet.mock.calls[0];
      expect(url).not.toContain("fid=12");
    });

    it("tombol X (clear filter) tidak muncul saat tidak ada fid aktif", async () => {
      await renderDataTable2(<DataTable2 />);
      const clearButton = document.querySelector("button svg.lucide-x");
      expect(clearButton).toBeFalsy();
    });
  });

  describe("useImperativeHandle addFilter (quick filter dari klik cell)", () => {
    it("memanggil ref.addFilter membangun filter item baru dan mem-persist via axios.post", async () => {
      axiosPost.mockResolvedValue({ data: { id: 88 } });
      const ref = React.createRef();
      await renderDataTable2(<DataTable2 ref={ref} />);

      // addFilter dipanggil langsung via ref (bukan lewat userEvent), lalu
      // internal-nya memicu persistFilterTree (async, axios.post lalu
      // setFilterTree/setOptions) TANPA di-await si pemanggil (fire-and-
      // forget, lihat komentar addFilter di DataTable2.jsx). React tidak
      // tahu update state itu bagian dari "aksi test" kecuali dibungkus
      // act() -- bungkus panggilan & polling vi.waitFor terpisah supaya
      // microtask promise mock + setState-nya stabil sebelum lanjut.
      await act(async () => {
        ref.current.addFilter("name", "=", "Supplier A");
      });

      await act(async () => {
        await vi.waitFor(() => {
          expect(axiosPost).toHaveBeenCalledTimes(1);
        });
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

  describe("grouping (Group by control)", () => {
    const groupableColumns = {
      ...dataTableColumns,
      code: { ...dataTableColumns.code, groupable: true },
    };

    it("tidak menampilkan dropdown Group by saat tidak ada kolom groupable", async () => {
      await renderDataTable2(<DataTable2 />);
      expect(
        screen.queryByText("TR:core.datatable.no_grouping"),
      ).not.toBeInTheDocument();
    });

    it("memilih kolom di dropdown Group by TIDAK mengunci sort (BE urutkan primer by grup, sort tetap sekunder), reset page, dan meneruskan groupBy/groupCounts ke Table2", async () => {
      vi.useRealTimers();
      const user = userEvent.setup({ delay: null, pointerEventsCheck: 0 });
      usePageMock.mockReturnValue({
        props: makePageProps({
          dataTableColumns: groupableColumns,
          groupCounts: { S1: 1, S2: 1 },
          ziggy: { query: { page: "3" } },
        }),
      });
      await renderDataTable2(<DataTable2 />);

      // Belum ada grouping aktif -> trigger (Popover+Command, bukan lagi
      // Radix Select) menampilkan label opsi terpilih ("Tidak ada"), sesuai
      // groupColumnLabel yang di-resolve dari groupOptions via NO_GROUP_VALUE.
      const groupTrigger = screen
        .getByText("TR:core.datatable.no_grouping")
        .closest("button");
      groupTrigger.focus();
      await user.keyboard("{Enter}");
      const listbox = await screen.findByRole("listbox");
      await user.click(within(listbox).getByText("TR:supplier.columns.code"));

      await vi.waitFor(() => {
        const props = table2Props.mock.calls.at(-1)[0];
        expect(props.groupBy).toBe("code");
      });
      const props = table2Props.mock.calls.at(-1)[0];
      // Sort TIDAK ikut berubah -- tetap defaultSort ("name"), bukan "code".
      // BE selalu urutkan primer by kolom grup terlepas dari pilihan ini.
      expect(props.options.sort).toBe("name");
      expect(props.options.page).toBe(1);
      expect(props.groupCounts).toEqual({ S1: 1, S2: 1 });
    });

    it("dropdown Sort By (pemilih kolom) TETAP aktif selama grouping aktif -- jadi sort sekunder/tie-breaker, tidak lagi dikunci", async () => {
      usePageMock.mockReturnValue({
        props: makePageProps({
          dataTableColumns: groupableColumns,
          ziggy: { query: { group: "code", sort: "code" } },
        }),
      });
      await renderDataTable2(<DataTable2 />);

      // Sort By dan Group by sama-sama menampilkan label "code" (keduanya
      // di-set ke kolom yang sama) -- Sort By dirender lebih dulu di DOM.
      const [sortTrigger] = screen.getAllByText("TR:supplier.columns.code");
      expect(sortTrigger.closest("button")).not.toBeDisabled();
    });

    it('memilih "Tidak ada" di Group by mematikan grouping tanpa mereset sort', async () => {
      vi.useRealTimers();
      const user = userEvent.setup({ delay: null, pointerEventsCheck: 0 });
      usePageMock.mockReturnValue({
        props: makePageProps({
          dataTableColumns: groupableColumns,
          ziggy: { query: { group: "code", sort: "code" } },
        }),
      });
      await renderDataTable2(<DataTable2 />);

      // Sort By dirender lebih dulu di DOM -- Group by trigger adalah yang kedua.
      const [, groupTriggerText] = screen.getAllByText(
        "TR:supplier.columns.code",
      );
      const groupTrigger = groupTriggerText.closest("button");
      groupTrigger.focus();
      await user.keyboard("{Enter}");
      const listbox = await screen.findByRole("listbox");
      await user.click(
        within(listbox).getByText("TR:core.datatable.no_grouping"),
      );

      await vi.waitFor(() => {
        const props = table2Props.mock.calls.at(-1)[0];
        expect(props.groupBy).toBeNull();
      });
      const props = table2Props.mock.calls.at(-1)[0];
      // Sort TIDAK direset otomatis -- tetap "code" (posisi terakhir).
      expect(props.options.sort).toBe("code");
    });

    const dateGroupableColumns = {
      ...dataTableColumns,
      due_date: {
        name: "due_date",
        titleTrans: "supplier.columns.due_date",
        type: "date",
        groupable: true,
        show: true,
      },
    };
    const numberGroupableColumns = {
      ...dataTableColumns,
      amount: {
        name: "amount",
        titleTrans: "supplier.columns.amount",
        type: "number",
        groupable: true,
        groupRangeOptions: [10, 50],
        show: true,
      },
    };

    it("groupBy kolom date -- selector granularity muncul, default 'month', meneruskan groupGranularity ke Table2", async () => {
      vi.useRealTimers();
      const user = userEvent.setup({ delay: null, pointerEventsCheck: 0 });
      usePageMock.mockReturnValue({
        props: makePageProps({ dataTableColumns: dateGroupableColumns }),
      });
      await renderDataTable2(<DataTable2 />);

      const groupTrigger = screen
        .getByText("TR:core.datatable.no_grouping")
        .closest("button");
      groupTrigger.focus();
      await user.keyboard("{Enter}");
      const listbox = await screen.findByRole("listbox");
      await user.click(
        within(listbox).getByText("TR:supplier.columns.due_date"),
      );

      await vi.waitFor(() => {
        const props = table2Props.mock.calls.at(-1)[0];
        expect(props.groupBy).toBe("due_date");
      });
      const props = table2Props.mock.calls.at(-1)[0];
      expect(props.groupGranularity).toBe("month");
      expect(props.groupRange).toBeNull();
      // Selector granularity kini terlihat di toolbar (nilai default "month").
      expect(
        screen.getByText("TR:core.datatable.granularity.month"),
      ).toBeInTheDocument();
    });

    it("groupBy kolom number -- selector range muncul dgn opsi dari groupRangeOptions, default opsi pertama", async () => {
      vi.useRealTimers();
      const user = userEvent.setup({ delay: null, pointerEventsCheck: 0 });
      usePageMock.mockReturnValue({
        props: makePageProps({ dataTableColumns: numberGroupableColumns }),
      });
      await renderDataTable2(<DataTable2 />);

      const groupTrigger = screen
        .getByText("TR:core.datatable.no_grouping")
        .closest("button");
      groupTrigger.focus();
      await user.keyboard("{Enter}");
      const listbox = await screen.findByRole("listbox");
      await user.click(within(listbox).getByText("TR:supplier.columns.amount"));

      await vi.waitFor(() => {
        const props = table2Props.mock.calls.at(-1)[0];
        expect(props.groupBy).toBe("amount");
      });
      const props = table2Props.mock.calls.at(-1)[0];
      // Default = opsi PERTAMA dari groupRangeOptions kolom ("amount": [10, 50]).
      expect(props.groupRange).toBe(10);
      expect(props.groupGranularity).toBeNull();
    });

    it("ganti granularity via selector memperbarui options.groupGranularity tanpa reset kolom grup", async () => {
      vi.useRealTimers();
      const user = userEvent.setup({ delay: null, pointerEventsCheck: 0 });
      usePageMock.mockReturnValue({
        props: makePageProps({
          dataTableColumns: dateGroupableColumns,
          ziggy: { query: { group: "due_date", groupGranularity: "month" } },
        }),
      });
      await renderDataTable2(<DataTable2 />);

      const granularityTrigger = screen
        .getByText("TR:core.datatable.granularity.month")
        .closest("button");
      granularityTrigger.focus();
      await user.keyboard("{Enter}");
      const listbox = await screen.findByRole("listbox");
      await user.click(
        within(listbox).getByText("TR:core.datatable.granularity.quarter"),
      );

      await vi.waitFor(() => {
        const props = table2Props.mock.calls.at(-1)[0];
        expect(props.groupGranularity).toBe("quarter");
      });
      const props = table2Props.mock.calls.at(-1)[0];
      expect(props.groupBy).toBe("due_date");
    });

    describe("pencarian di dropdown Sort By & Group by", () => {
      const multiGroupableColumns = {
        ...dataTableColumns,
        name: { ...dataTableColumns.name, groupable: true },
        code: { ...dataTableColumns.code, groupable: true },
      };

      it("desktop -- ketik search di Sort By memfilter daftar & highlight substring cocok", async () => {
        vi.useRealTimers();
        const user = userEvent.setup({ delay: null, pointerEventsCheck: 0 });
        await renderDataTable2(<DataTable2 />);

        const sortTrigger = screen
          .getByText("TR:supplier.columns.name")
          .closest("button");
        sortTrigger.focus();
        await user.keyboard("{Enter}");
        const listbox = await screen.findByRole("listbox");

        // CommandInput (role="combobox") adalah SIBLING dari CommandList
        // (role="listbox"), bukan descendant-nya -- query lewat placeholder.
        await user.type(
          screen.getByPlaceholderText(
            "TR:core.datatable.filter.column.search.placeholder",
          ),
          "cod",
        );

        expect(
          within(listbox).getByRole("option", {
            name: "TR:supplier.columns.code",
          }),
        ).toBeInTheDocument();
        expect(
          within(listbox).queryByRole("option", {
            name: "TR:supplier.columns.name",
          }),
        ).not.toBeInTheDocument();
        expect(document.body.querySelector("mark")).toBeInTheDocument();
      });

      it("desktop -- pilih hasil pencarian Group by menutup popover & menerapkan grup", async () => {
        vi.useRealTimers();
        const user = userEvent.setup({ delay: null, pointerEventsCheck: 0 });
        usePageMock.mockReturnValue({
          props: makePageProps({ dataTableColumns: multiGroupableColumns }),
        });
        await renderDataTable2(<DataTable2 />);

        const groupTrigger = screen
          .getByText("TR:core.datatable.no_grouping")
          .closest("button");
        groupTrigger.focus();
        await user.keyboard("{Enter}");
        const listbox = await screen.findByRole("listbox");
        await user.type(
          screen.getByPlaceholderText(
            "TR:core.datatable.filter.column.search.placeholder",
          ),
          "cod",
        );
        await user.click(
          within(listbox).getByRole("option", {
            name: "TR:supplier.columns.code",
          }),
        );

        await vi.waitFor(() => {
          const props = table2Props.mock.calls.at(-1)[0];
          expect(props.groupBy).toBe("code");
        });
        // Popover tertutup setelah memilih -- listbox tak lagi ada di DOM.
        expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
      });

      // Klik DropdownMenuItem yg dibungkus DialogTrigger asChild (Header.jsx
      // punya pola persis sama utk trigger ColumnsFilter) terbukti fragile
      // disimulasikan lewat RTL/jsdom -- Radix DropdownMenuItem meng-unmount
      // dirinya (auto-close-on-select) di tengah siklus event, balapan
      // dengan onClick hasil Slot-clone dari DialogTrigger. Header.rtl.test
      // sendiri TIDAK menguji klik-sampai-dialog-kebuka utk pola ini, cuma
      // memverifikasi item-nya ada di menu -- ikuti konvensi yang sama di
      // sini, isi Dialog (search+pilih) sudah dites lewat SearchableOptionList
      // sendiri + integrasi Popover desktop di atas. Verifikasi end-to-end
      // klik->Dialog terbuka dilakukan manual di browser (bukan RTL).
      it("mobile -- item 'Group by' & 'Sort By' di menu Ellipsis menampilkan label kolom aktif", async () => {
        const user = userEvent.setup();
        usePageMock.mockReturnValue({
          props: makePageProps({ dataTableColumns: multiGroupableColumns }),
        });
        isMobileMock.mockReturnValue(true);
        await renderDataTable2(<DataTable2 />);

        const ellipsisTrigger = document
          .querySelector("button svg.lucide-ellipsis")
          .closest("button");
        await user.click(ellipsisTrigger);

        expect(
          screen.getByRole("menuitem", {
            name: /core\.datatable\.group_by.*no_grouping/,
          }),
        ).toBeInTheDocument();
        expect(
          screen.getByRole("menuitem", {
            name: /sorting\.sort_by.*supplier\.columns\.name/,
          }),
        ).toBeInTheDocument();
      });

      it("mobile -- toggle arah sort jadi item menu terpisah (bukan submenu per-kolom lagi)", async () => {
        const user = userEvent.setup({
          delay: null,
          pointerEventsCheck: 0,
          advanceTimers: vi.advanceTimersByTime,
        });
        isMobileMock.mockReturnValue(true);
        await renderDataTable2(<DataTable2 />);

        await user.click(
          document
            .querySelector("button svg.lucide-ellipsis")
            .closest("button"),
        );
        await user.click(
          screen.getByText("TR:core.datatable.sorting.ascending"),
        );

        // Table2 tidak dirender di mode mobile (templateItem cards) -- verif
        // lewat loadData/router.get (debounce 500ms), bukan table2Props.
        await vi.advanceTimersByTimeAsync(600);
        expect(routerGet).toHaveBeenCalledTimes(1);
        const [url] = routerGet.mock.calls[0];
        expect(url).toContain("sort=-name");
      });
    });

    describe("pengurutan opsi Sort By & Group by (abjad berdasar label terjemahan)", () => {
      const optionLabels = (listbox) =>
        within(listbox)
          .getAllByRole("option")
          .map((el) => el.textContent);

      it("Sort By diurut abjad berdasar label hasil t(), bukan urutan kolom dari BE", async () => {
        vi.useRealTimers();
        const user = userEvent.setup({ delay: null, pointerEventsCheck: 0 });
        // Fixture: kolom name lebih dulu dari code, tapi abjad label
        // ("...code" < "...name") berlawanan.
        await renderDataTable2(<DataTable2 />);

        const sortTrigger = screen
          .getByText("TR:supplier.columns.name")
          .closest("button");
        sortTrigger.focus();
        await user.keyboard("{Enter}");
        const listbox = await screen.findByRole("listbox");

        expect(optionLabels(listbox)).toEqual([
          "TR:supplier.columns.code",
          "TR:supplier.columns.name",
        ]);
      });

      it("Group by: 'Tidak ada' tetap paling atas, kolom sisanya diurut abjad", async () => {
        vi.useRealTimers();
        const user = userEvent.setup({ delay: null, pointerEventsCheck: 0 });
        // "Aaa Kolom" secara abjad < "TR:core.datatable.no_grouping" -- kalau
        // "Tidak ada" ikut diurut, ia tidak akan di posisi pertama.
        usePageMock.mockReturnValue({
          props: makePageProps({
            dataTableColumns: {
              ...dataTableColumns,
              name: { ...dataTableColumns.name, groupable: true },
              code: { ...dataTableColumns.code, groupable: true },
              aaa: {
                name: "aaa",
                title: "Aaa Kolom",
                groupable: true,
                show: true,
              },
            },
          }),
        });
        await renderDataTable2(<DataTable2 />);

        const groupTrigger = screen
          .getByText("TR:core.datatable.no_grouping")
          .closest("button");
        groupTrigger.focus();
        await user.keyboard("{Enter}");
        const listbox = await screen.findByRole("listbox");

        expect(optionLabels(listbox)).toEqual([
          "TR:core.datatable.no_grouping",
          "Aaa Kolom",
          "TR:supplier.columns.code",
          "TR:supplier.columns.name",
        ]);
      });

      it("mengikuti locale bahasa aktif (currentLocale) -- 'ä' setelah 'z' di sv", async () => {
        vi.useRealTimers();
        const user = userEvent.setup({ delay: null, pointerEventsCheck: 0 });
        currentLocaleMock.mockReturnValue("sv");
        usePageMock.mockReturnValue({
          props: makePageProps({
            dataTableColumns: {
              z_col: { name: "z_col", title: "z", sortable: true, show: true },
              ae_col: {
                name: "ae_col",
                title: "ä",
                sortable: true,
                show: true,
              },
              a_col: { name: "a_col", title: "a", sortable: true, show: true },
            },
            defaultSort: "a_col",
          }),
        });
        await renderDataTable2(<DataTable2 />);

        const sortTrigger = screen
          .getAllByText("a")
          .find((el) => el.closest("button"))
          .closest("button");
        sortTrigger.focus();
        await user.keyboard("{Enter}");
        const listbox = await screen.findByRole("listbox");

        expect(optionLabels(listbox)).toEqual(["a", "z", "ä"]);
      });
    });
  });
});
