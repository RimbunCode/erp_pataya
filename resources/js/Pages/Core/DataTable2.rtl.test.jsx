import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import {
  act,
  cleanup,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";

// t harus stabil (konstanta module-level) -- DataTable2 punya beberapa
// useEffect/useCallback ber-dependency `t` (mis. persistFilterTree), fungsi
// baru tiap render dapat memicu infinite loop / re-fetch tak terkendali.
// Param (mis. `{ name: title }` utk placeholder Search Bar) ikut ke output
// supaya test bisa memverifikasi param yang diteruskan.
const stableT = (key, params) =>
  params ? `TR:${key}:${JSON.stringify(params)}` : `TR:${key}`;
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
vi.mock("@/Components/Table/Table2", async () => {
  // `createHeaders` ASLI (bukan stub) -- getSearchColumns() DataTable2
  // memanggilnya utk membaca visibility kolom (cookie) & fungsi aslinya
  // MEMUTASI argumen; stub yang tak meniru dua hal itu tak bisa membuktikan
  // klaim "salinan dangkal / dibaca saat dipanggil". Komponen Table2 sendiri
  // tetap di-stub (sudah ditest di Table2.rtl.test.jsx).
  const { createHeaders, datatableColumnsCookieKey } = await vi.importActual(
    "@/Components/Table/Table2",
  );
  return {
    default: (props) => {
      table2Props(props);
      return (
        <div data-testid="stub-table2">
          <button onClick={() => props.setSort("name")}>
            trigger-set-sort
          </button>
          <button onClick={() => props.resetSorting()}>
            trigger-reset-sort
          </button>
          <button
            onClick={() =>
              props.onOptionsChanged({ ...props.options, page: 9 })
            }
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
    createHeaders,
    datatableColumnsCookieKey,
  };
});

// SearchBar -- komponen sungguhan (chip, saran, panel) sudah ditest sendiri
// (SearchBar.rtl.test.jsx). Stub capture props supaya test DataTable2 fokus ke
// apa yang DITERUSKAN host & apa yang dilakukan host saat callback-nya
// dipanggil (lewat `callSearchBar(...)` di bawah, atau tombol stub utk jalur
// klik sederhana).
const searchBarProps = vi.fn();
vi.mock("@/Components/Table/Search/SearchBar", () => ({
  default: (props) => {
    searchBarProps(props);
    return (
      <div data-testid="stub-search-bar">
        <button onClick={() => props.onOpenBuilder?.()}>
          trigger-open-builder
        </button>
      </div>
    );
  },
}));

// FilterTable2 -- dialog filter builder sudah ditest sendiri
// (FilterTable2.rtl.test.jsx). Stub capture props & expose tombol untuk
// memicu callback onApply/onSaved/onOpenChange dari test. Mode controlled
// (`open`/`onOpenChange`, tanpa `trigger`) tercermin di `data-open`.
const filterTableProps = vi.fn();
vi.mock("@/Components/Table/Filter/FilterTable2", () => ({
  default: (props) => {
    filterTableProps(props);
    return (
      <div
        data-testid={`stub-filter-table2${props.isMobile ? "-mobile" : ""}`}
        data-open={String(props.open)}
      >
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
        <button
          onClick={() =>
            // Named filter dipilih di dialog (useExisting): aktifkan id-nya
            // tanpa POST baru.
            props.onApply(
              { root: { k: "and", c: { b: { k: "code", o: "=", v: "S1" } } } },
              33,
              { useExisting: true, sort: "-code" },
            )
          }
        >
          trigger-apply-existing-filter
        </button>
        <button onClick={() => props.onSaved({ id: 55, filter: {} })}>
          trigger-saved-filter
        </button>
        <button onClick={() => props.onSaved(null)}>
          trigger-clear-saved-filter
        </button>
        <button onClick={() => props.onOpenChange?.(false)}>
          trigger-close-builder
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

// GroupTree -- pohon grup lazy sudah ditest sendiri (GroupTree.rtl.test.jsx);
// dipakai DataTable2 hanya di cabang MOBILE (desktop: lewat Table2 yang di-stub).
// Stub capture props & memanggil render-prop persis seperti GroupTree asli:
// header (GroupHeaderCard sungguhan) + satu baris isi per grup.
const groupTreeProps = vi.fn();
vi.mock("@/Components/Table/Group/GroupTree", () => ({
  default: (props) => {
    groupTreeProps(props);
    return (
      <div data-testid="stub-group-tree">
        {props.rootItems.map((item) => (
          <div key={item.key} data-testid={`group-${item.key}`}>
            {props.renderGroupHeader({
              item,
              depth: 0,
              level: props.levels[0],
              isOpen: true,
              onToggle: () => {},
              pager: null,
            })}
            {props.renderRow(
              { id: `row-${item.key}`, name: `Isi ${item.key}` },
              { depth: 1, index: 0 },
            )}
            {props.renderLoading({ depth: 1 })}
          </div>
        ))}
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
// Dari mock Table2 (pass-through fungsi asli) -- utk seed cookie visibility.
import { datatableColumnsCookieKey } from "@/Components/Table/Table2";

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

const lastTable2Props = () => table2Props.mock.calls.at(-1)[0];
const lastSearchBarProps = () => searchBarProps.mock.calls.at(-1)[0];
const lastFilterTableProps = () => filterTableProps.mock.calls.at(-1)[0];

// Memanggil callback host milik Search Bar (onTreeChange/onPickSaved/
// onGroupChange/...) persis seperti SearchBar sungguhan: DI DALAM act() async
// agar setState + microtask axios mock stabil sebelum assertion. Prop dibaca
// ULANG tiap panggilan -- closure callback berganti setiap state berubah.
// Reject dari callback (mis. onTreeChange gagal) diteruskan ke pemanggil.
async function callSearchBar(name, ...args) {
  let result;
  await act(async () => {
    result = await lastSearchBarProps()[name](...args);
  });
  return result;
}

// Debounce reload options (useDidMountEffect, 500ms) -- utk test ber-fake
// timers (default beforeEach). Test yang butuh timer asli (Radix Popover/
// Dialog/cmdk macet dgn fake timers) pakai `waitForReload()` sbg gantinya.
const flushReload = () => vi.advanceTimersByTimeAsync(600);
const waitForReload = (times = 1) =>
  waitFor(() => expect(routerGet).toHaveBeenCalledTimes(times), {
    timeout: 2000,
  });
// Query string dari URL reload ke-`index` (`?sort=..&group=..`).
const reloadParams = (index = 0) =>
  new URLSearchParams(routerGet.mock.calls[index][0].split("?")[1]);

const simpleTree = {
  root: { k: "and", c: { a: { k: "code", o: "=", v: "S1" } } },
};

// Deskriptor level-0 (`data.data` saat grup aktif di server) + `groupMeta`.
const groupRootData = {
  data: [
    { key: "S1", raw: "S1", count: 3, aggregates: {} },
    { key: "S2", raw: "S2", count: 1, aggregates: {} },
  ],
  last_page: 1,
};
const groupMetaCode = {
  levels: [{ column: "code", granularity: null, range: null, type: "string" }],
  aggregates: [],
};

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
    searchBarProps.mockReset();
    filterTableProps.mockReset();
    paginationProps.mockReset();
    groupTreeProps.mockReset();
    axiosGet.mockResolvedValue({ data: {} });
    axiosPost.mockResolvedValue({ data: { id: 1 } });
    usePageMock.mockReturnValue({ props: makePageProps() });
    // `document.cookie = ""` TIDAK menghapus cookie yang sudah ada (no-op) --
    // expire eksplisit agar datatable_show tidak bocor antar test. Cookie
    // visibility kolom (createHeaders asli, dipakai getSearchColumns) juga --
    // keyed by window.location.pathname, sama utk semua test file ini.
    document.cookie = "datatable_show=; expires=Thu, 01 Jan 1970 00:00:00 UTC";
    document.cookie = `${datatableColumnsCookieKey(window.location.pathname)}=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/`;
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
        reset: ["data", "ziggy", "groupMeta"],
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

  it("info jumlah data (start–end / total) tampil di sebelah kontrol halaman dari from/to/total paginator; tak tampil bila paginator tak memuatnya atau kosong", async () => {
    mockPage({
      data: { ...baseData, from: 51, to: 100, total: 200, last_page: 4 },
    });
    const first = await renderDataTable2(<DataTable2 />);

    const info = screen.getByTestId("page-range");
    expect(info).toHaveTextContent(
      'TR:core.datatable.page_range:{"start":51,"end":100,"total":200}',
    );
    // Sebelah kontrol halaman: satu wadah dgn Pagination.
    expect(info.parentElement).toContainElement(
      screen.getByTestId("stub-pagination"),
    );

    // Tanpa from/to/total (paginator minimal) atau total 0 -> tak ada info.
    first.unmount();
    mockPage({});
    await renderDataTable2(<DataTable2 />);
    expect(screen.queryByTestId("page-range")).toBeNull();
    cleanup();
    mockPage({ data: { ...baseData, from: null, to: null, total: 0 } });
    await renderDataTable2(<DataTable2 />);
    expect(screen.queryByTestId("page-range")).toBeNull();
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

    it("grup aktif (groupMeta): merender GroupTree (bukan daftar datar) dgn deskriptor level-0, level & param expand dari server", async () => {
      usePageMock.mockReturnValue({
        props: makePageProps({
          data: groupRootData,
          groupMeta: groupMetaCode,
          ziggy: { query: { sort: "-name", page: "2" } },
        }),
      });
      const templateItem = ({ dataRow }) => (
        <div>Mobile Row {dataRow.name}</div>
      );
      await renderDataTable2(<DataTable2 templateItem={templateItem} />);

      expect(screen.getByTestId("stub-group-tree")).toBeInTheDocument();
      expect(screen.queryByTestId("stub-table2")).not.toBeInTheDocument();
      const props = groupTreeProps.mock.calls.at(-1)[0];
      expect(props.rootItems).toBe(groupRootData.data);
      expect(props.levels).toBe(groupMetaCode.levels);
      expect(props.pathname).toBe(window.location.pathname);
      expect(props.version).toBe(0);
      // Mobile: isi grup dimuat lewat infinite scroll (bukan pager).
      expect(props.infinite).toBe(true);
      expect(props.baseParams).toEqual({ sort: "-name", group: "code" });

      // Header (kartu) tiap grup menampilkan count; isi grup = templateItem.
      expect(
        within(screen.getByTestId("group-S1")).getByText("(3)"),
      ).toBeInTheDocument();
      expect(
        within(screen.getByTestId("group-S2")).getByText("(1)"),
      ).toBeInTheDocument();
      expect(screen.getByText("Mobile Row Isi S1")).toBeInTheDocument();
      expect(screen.getByText("Mobile Row Isi S2")).toBeInTheDocument();
      // Status loading per node ikut dirender lewat renderLoading.
      expect(screen.getAllByRole("status")).toHaveLength(2);
    });

    it("grup aktif: baris isi grup menerima closure deleteItem yang memanggil deleteItem hook", async () => {
      const user = userEvent.setup({ delay: null });
      usePageMock.mockReturnValue({
        props: makePageProps({ data: groupRootData, groupMeta: groupMetaCode }),
      });
      const templateItem = ({ dataRow, deleteItem }) => (
        <button onClick={deleteItem}>Hapus {dataRow.name}</button>
      );
      await renderDataTable2(<DataTable2 templateItem={templateItem} />);

      await user.click(screen.getByText("Hapus Isi S1"));

      expect(deleteItemSpy).toHaveBeenCalledWith(
        "suppliers.destroy",
        "row-S1",
        expect.objectContaining({ usePasswordConfirmation: undefined }),
      );
    });

    it("grup aktif tapi data kosong -> NoDataImg (bukan GroupTree kosong)", async () => {
      usePageMock.mockReturnValue({
        props: makePageProps({
          data: { data: [], last_page: 1 },
          groupMeta: groupMetaCode,
        }),
      });
      await renderDataTable2(<DataTable2 />);

      expect(screen.getByTestId("stub-no-data-img")).toBeInTheDocument();
      expect(screen.queryByTestId("stub-group-tree")).not.toBeInTheDocument();
    });
  });

  // -----------------------------------------------------------------------
  // Spec datatable2-advanced-search (task 10.3). Search Bar + Panel ▾ jadi
  // pintu Filter/Group by; Sort tetap di DataTable2 (satu baris dgn Search
  // Bar). UI Group by (popover, granularity/range) kini milik SearchPanel/
  // ChipEditor -- test-nya di file masing-masing; di sini hanya batas
  // DataTable2: apa yang diteruskan ke Search Bar & apa yang dilakukan host
  // saat callback-nya dipanggil.
  // -----------------------------------------------------------------------

  const mockPage = (overrides) =>
    usePageMock.mockReturnValue({ props: makePageProps(overrides) });

  // Kolom utk test grouping/saved filter: string (code), date (due_date),
  // number dgn opsi range kolom (amount), currency tanpa opsi (price).
  const groupingColumns = {
    ...dataTableColumns,
    code: { ...dataTableColumns.code, groupable: true },
    due_date: {
      name: "due_date",
      titleTrans: "supplier.columns.due_date",
      type: "date",
      groupable: true,
      show: true,
    },
    amount: {
      name: "amount",
      titleTrans: "supplier.columns.amount",
      type: "number",
      groupable: true,
      groupRangeOptions: [25, 50],
      show: true,
    },
    price: {
      name: "price",
      titleTrans: "supplier.columns.price",
      type: "currency",
      groupable: true,
      show: true,
    },
  };
  const groupableColumns = {
    ...dataTableColumns,
    code: { ...dataTableColumns.code, groupable: true },
  };

  // persistFilterTree memanggil console.error(error) saat gagal -- log app,
  // bukan warning React. Sunyikan HANYA panggilan itu; console.error lain
  // (mis. warning act()) tetap diteruskan supaya tak tersembunyi.
  let errorSpy;
  const silencePersistErrorLog = (error) => {
    const original = console.error;
    errorSpy = vi.spyOn(console, "error").mockImplementation((...args) => {
      if (args[0] === error) return;
      original(...args);
    });
  };
  afterEach(() => errorSpy?.mockRestore());

  describe("Search Bar -- tata letak toolbar & props yang diteruskan", () => {
    it("Search Bar di baris sendiri antara judul & kartu tabel, satu baris dgn Sort (bukan di toolbar judul)", async () => {
      await renderDataTable2(<DataTable2 />);

      const heading = screen.getByRole("heading", { level: 1 });
      const searchBar = screen.getByTestId("stub-search-bar");
      const table = screen.getByTestId("stub-table2");
      const sortTrigger = screen
        .getByText("TR:supplier.columns.name")
        .closest("button");
      const sortIconButton = screen.getByRole("button", {
        name: "TR:core.datatable.sorting.sort_by",
      });

      // Urutan dokumen: judul -> Search Bar -> tabel.
      expect(
        heading.compareDocumentPosition(searchBar) &
          Node.DOCUMENT_POSITION_FOLLOWING,
      ).toBeTruthy();
      expect(
        searchBar.compareDocumentPosition(table) &
          Node.DOCUMENT_POSITION_FOLLOWING,
      ).toBeTruthy();

      // Baris Search Bar = ancestor terdekat yang juga memuat Sort (desktop
      // & ikon mobile): TIDAK memuat judul maupun tabel.
      let row = searchBar.parentElement;
      while (row && !row.contains(sortTrigger)) row = row.parentElement;
      expect(row).toBeTruthy();
      expect(row).toContainElement(sortIconButton);
      expect(row).not.toContainElement(heading);
      expect(row).not.toContainElement(table);
    });

    it("baris judul hanya berisi judul, Reload (+ ⋯ mobile) & Tambah -- tanpa Filter, clear filter, Group by, Sort", async () => {
      // fid aktif + group aktif = kondisi tempat tombol X clear-filter &
      // trigger Group by dulu muncul di toolbar.
      mockPage({
        dataTableColumns: groupableColumns,
        ziggy: { query: { fid: "12", group: "code" } },
      });
      await renderDataTable2(<DataTable2 form={<div>Form Isi</div>} />);

      const titleRow = screen.getByRole("heading", { level: 1 }).parentElement;
      // ⋯ (mobile), Reload (desktop), Tambah -- tidak ada yang lain.
      expect(within(titleRow).getAllByRole("button")).toHaveLength(3);
      expect(within(titleRow).getByText("TR:supplier.add")).toBeInTheDocument();
      expect(titleRow.querySelector("svg.lucide-refresh-cw")).toBeTruthy();
      expect(titleRow.querySelector("svg.lucide-x")).toBeNull();
      expect(titleRow).not.toContainElement(
        screen.getByTestId("stub-search-bar"),
      );

      // Teks/kontrol lama tak lagi ada di mana pun di halaman.
      expect(document.querySelector("button svg.lucide-x")).toBeNull();
      expect(
        screen.queryByText("TR:core.datatable.filter.filter"),
      ).not.toBeInTheDocument();
      expect(
        screen.queryByText("TR:core.datatable.group_by"),
      ).not.toBeInTheDocument();
    });

    it("meneruskan columns (mapColumns terfilter, identitas sama dgn Table2 & FilterTable2), model, placeholder bernama halaman, tree & activeFid awal", async () => {
      await renderDataTable2(<DataTable2 />);

      const props = lastSearchBarProps();
      expect(Object.keys(props.columns)).toEqual(["name", "code"]);
      expect(props.columns).toBe(lastTable2Props().columns);
      expect(props.columns).toBe(lastFilterTableProps().columns);
      expect(props.model).toBe("App\\Models\\Purchase\\Supplier");
      // Placeholder memuat nama halaman agar terbedakan dari search global.
      expect(props.placeholder).toBe(
        'TR:core.datatable.search.placeholder:{"name":"TR:supplier.title"}',
      );
      expect(props.tree).toBeNull();
      expect(props.activeFid).toBeNull();
      expect(props.group).toEqual([]);
      expect(props.onTreeChange).toEqual(expect.any(Function));
      expect(props.onPickSaved).toEqual(expect.any(Function));
      expect(props.getViewSnapshot).toEqual(expect.any(Function));
      expect(props.getSearchColumns).toEqual(expect.any(Function));
      expect(props.onOpenBuilder).toEqual(expect.any(Function));
    });

    it.each([
      ["?fid= di URL", { ziggy: { query: { fid: "12" } } }, "12"],
      [
        "default filter (defaultFilterId) bila tak ada ?fid",
        { defaultFilterId: 9 },
        9,
      ],
    ])(
      "activeFid = %s -- diteruskan ke Search Bar & FilterTable2",
      async (_label, overrides, expected) => {
        mockPage(overrides);
        await renderDataTable2(<DataTable2 />);

        expect(lastSearchBarProps().activeFid).toBe(expected);
        expect(lastFilterTableProps().activeFid).toBe(expected);
      },
    );

    it.each([false, true])(
      "FilterTable2 dirender SEKALI saja & mengikuti isMobile (isMobile=%s)",
      async (mobile) => {
        isMobileMock.mockReturnValue(mobile);
        await renderDataTable2(<DataTable2 />);

        expect(screen.getAllByTestId(/^stub-filter-table2/)).toHaveLength(1);
        expect(lastFilterTableProps().isMobile).toBe(mobile);
      },
    );

    it("onOpenBuilder membuka FilterTable2 (controlled, tanpa trigger) & onOpenChange(false) menutupnya", async () => {
      const user = userEvent.setup({
        delay: null,
        advanceTimers: vi.advanceTimersByTime,
      });
      await renderDataTable2(<DataTable2 />);

      const dialogStub = screen.getByTestId("stub-filter-table2");
      expect(dialogStub).toHaveAttribute("data-open", "false");
      expect(lastFilterTableProps().trigger).toBeUndefined();

      await user.click(screen.getByText("trigger-open-builder"));
      expect(dialogStub).toHaveAttribute("data-open", "true");

      await user.click(screen.getByText("trigger-close-builder"));
      expect(dialogStub).toHaveAttribute("data-open", "false");
    });

    it("membuka lalu menutup builder tidak memicu reload/POST (murni state tampilan)", async () => {
      const user = userEvent.setup({
        delay: null,
        advanceTimers: vi.advanceTimersByTime,
      });
      await renderDataTable2(<DataTable2 />);

      await user.click(screen.getByText("trigger-open-builder"));
      await user.click(screen.getByText("trigger-close-builder"));
      await flushReload();

      expect(routerGet).not.toHaveBeenCalled();
      expect(axiosPost).not.toHaveBeenCalled();
    });
  });

  describe("Search Bar -> onTreeChange (chip = Filter Tree, persist tanpa toast sukses)", () => {
    it("mengembalikan Promise, POST saved-filters.store {model, filter, fid}, TANPA toast sukses; fid response jadi options.fid & tree sampai ke Search Bar/builder", async () => {
      axiosPost.mockResolvedValue({ data: { id: 77 } });
      await renderDataTable2(<DataTable2 />);

      let returned;
      await act(async () => {
        returned = lastSearchBarProps().onTreeChange(simpleTree);
        await returned;
      });

      // Promise -> Search Bar bisa menampilkan spinner & menolak commit beruntun.
      expect(returned).toBeInstanceOf(Promise);
      expect(axiosPost).toHaveBeenCalledTimes(1);
      expect(axiosPost).toHaveBeenCalledWith("saved-filters.store", {
        model: "App\\Models\\Purchase\\Supplier",
        filter: simpleTree,
        fid: null,
      });
      // Tiap ketikan chip -> toast sukses terlalu berisik (silent).
      expect(toastSuccess).not.toHaveBeenCalled();

      expect(lastSearchBarProps().tree).toBe(simpleTree);
      expect(lastSearchBarProps().activeFid).toBe(77);
      expect(lastFilterTableProps().initialFilters).toBe(simpleTree);
      expect(lastFilterTableProps().activeFid).toBe(77);

      await flushReload();
      expect(routerGet).toHaveBeenCalledTimes(1);
      expect(reloadParams().get("fid")).toBe("77");
    });

    it("mengirim fid yang sedang dimuat agar backend UPDATE row itu (bukan menumpuk row baru)", async () => {
      mockPage({ ziggy: { query: { fid: "12" } } });
      axiosPost.mockResolvedValue({ data: { id: 12 } });
      await renderDataTable2(<DataTable2 />);

      await callSearchBar("onTreeChange", simpleTree);

      expect(axiosPost.mock.calls[0][1]).toEqual(
        expect.objectContaining({ fid: "12", filter: simpleTree }),
      );
    });

    it.each([
      [
        "422 dgn pesan filter dari backend",
        {
          response: {
            status: 422,
            data: { errors: { filter: ["Filter kosong"] } },
          },
        },
        "Filter kosong",
      ],
      [
        "422 tanpa pesan -> teks default tree kosong",
        { response: { status: 422, data: {} } },
        "TR:core.datatable.filter.validation.empty_tree",
      ],
      [
        "500 -> teks error umum",
        { response: { status: 500 } },
        "TR:core.datatable.filter.save.error",
      ],
      [
        "error jaringan tanpa response -> teks error umum",
        new Error("Network Error"),
        "TR:core.datatable.filter.save.error",
      ],
    ])(
      "gagal simpan (%s): toast error, Promise reject, tree/fid tak berubah (chip kembali), tanpa toast sukses",
      async (_label, rejection, message) => {
        axiosPost.mockRejectedValue(rejection);
        silencePersistErrorLog(rejection);
        await renderDataTable2(<DataTable2 />);

        await expect(callSearchBar("onTreeChange", simpleTree)).rejects.toBe(
          rejection,
        );

        expect(toastError).toHaveBeenCalledWith(message);
        expect(toastSuccess).not.toHaveBeenCalled();
        // Chip diturunkan dari `tree` prop yang hanya berubah bila simpan sukses.
        expect(lastSearchBarProps().tree).toBeNull();
        expect(lastSearchBarProps().activeFid).toBeNull();
        await flushReload();
        expect(routerGet).not.toHaveBeenCalled();
      },
    );

    it.each([
      ["null (mis. klik × chip sumber)", null],
      ["tree tanpa item (root.c kosong)", { root: { k: "and", c: {} } }],
    ])(
      "%s mengosongkan filter tree & fid TANPA POST, lalu reload tanpa fid",
      async (_label, emptyTree) => {
        mockPage({ ziggy: { query: { fid: "12" } } });
        axiosGet.mockResolvedValue({ data: { filter: simpleTree } });
        await renderDataTable2(<DataTable2 />);
        // Filter aktif dimuat lebih dulu -> chip sudah tampil.
        expect(lastSearchBarProps().tree).toBe(simpleTree);

        await callSearchBar("onTreeChange", emptyTree);

        expect(axiosPost).not.toHaveBeenCalled();
        expect(lastSearchBarProps().tree).toBeNull();
        expect(lastSearchBarProps().activeFid).toBeNull();
        expect(lastFilterTableProps().initialFilters).toBeNull();

        await flushReload();
        expect(routerGet).toHaveBeenCalledTimes(1);
        expect(reloadParams().has("fid")).toBe(false);
      },
    );
  });

  describe("Search Bar -> onPickSaved (terapkan saved filter: tree + fid + sort + group, tanpa POST)", () => {
    const codeAndDate = [
      { column: "code", granularity: null, range: null },
      { column: "due_date", granularity: "year", range: null },
    ];

    it("menerapkan tree, fid, sort, dan group BERTINGKAT sekaligus TANPA POST; page reset ke 1; reload (debounce) membawa semuanya", async () => {
      mockPage({
        dataTableColumns: groupingColumns,
        ziggy: { query: { page: "3", sort: "name" } },
      });
      await renderDataTable2(<DataTable2 />);

      await callSearchBar("onPickSaved", {
        id: 42,
        filter: simpleTree,
        sort: "-code",
        group: codeAndDate,
      });

      expect(axiosPost).not.toHaveBeenCalled();
      expect(lastSearchBarProps().tree).toBe(simpleTree);
      expect(lastFilterTableProps().initialFilters).toBe(simpleTree);
      expect(lastSearchBarProps().activeFid).toBe(42);
      expect(lastSearchBarProps().group).toEqual(codeAndDate);
      expect(lastTable2Props().options).toEqual(
        expect.objectContaining({
          fid: 42,
          sort: "-code",
          page: 1,
          group: codeAndDate,
        }),
      );

      // Reload lewat debounce yang sama dgn perubahan options lain.
      expect(routerGet).not.toHaveBeenCalled();
      await flushReload();
      expect(routerGet).toHaveBeenCalledTimes(1);
      const params = reloadParams();
      expect(params.get("fid")).toBe("42");
      expect(params.get("sort")).toBe("-code");
      expect(params.get("group")).toBe("code,due_date");
      expect(params.get("groupGranularity[due_date]")).toBe("year");
      expect(params.has("groupRange[due_date]")).toBe(false);
      expect(params.get("page")).toBe("1");
      expect(axiosPost).not.toHaveBeenCalled();
    });

    it("objek lama {column, granularity, range} (satu level) tetap dibaca sbg list satu level", async () => {
      mockPage({ dataTableColumns: groupingColumns });
      await renderDataTable2(<DataTable2 />);

      await callSearchBar("onPickSaved", {
        id: 5,
        filter: simpleTree,
        sort: null,
        group: { column: "due_date", granularity: "year", range: null },
      });

      expect(lastSearchBarProps().group).toEqual([
        { column: "due_date", granularity: "year", range: null },
      ]);
    });

    it.each([
      [
        "granularity eksplisit",
        [{ column: "due_date", granularity: "year", range: null }],
        "groupGranularity[due_date]",
        "year",
      ],
      [
        "range eksplisit",
        [{ column: "amount", granularity: null, range: 50 }],
        "groupRange[amount]",
        "50",
      ],
    ])(
      "%s di saved filter dipakai apa adanya",
      async (_label, group, wireKey, wireValue) => {
        mockPage({ dataTableColumns: groupingColumns });
        await renderDataTable2(<DataTable2 />);

        await callSearchBar("onPickSaved", {
          id: 5,
          filter: simpleTree,
          sort: null,
          group,
        });

        expect(lastSearchBarProps().group).toEqual(group);
        await flushReload();
        expect(reloadParams().get(wireKey)).toBe(wireValue);
      },
    );

    it("level tanpa granularity/range TIDAK diisi default oleh host (default efektif dihitung backend), tak crash utk kolom tak dikenal", async () => {
      mockPage({ dataTableColumns: groupingColumns });
      await renderDataTable2(<DataTable2 />);

      await callSearchBar("onPickSaved", {
        id: 5,
        filter: simpleTree,
        sort: null,
        group: [{ column: "due_date" }, { column: "ghost" }],
      });

      expect(lastSearchBarProps().group).toEqual([
        { column: "due_date", granularity: null, range: null },
        { column: "ghost", granularity: null, range: null },
      ]);
      await flushReload();
      const params = reloadParams();
      expect(params.get("group")).toBe("due_date,ghost");
      expect(params.has("groupGranularity[due_date]")).toBe(false);
    });

    it.each([
      ["null", null],
      ["list kosong", []],
    ])(
      "sort null di saved filter TIDAK menimpa sort aktif; group %s TIDAK menimpa group aktif",
      async (_label, savedGroup) => {
        mockPage({
          dataTableColumns: groupingColumns,
          ziggy: {
            query: {
              sort: "-code",
              group: "due_date",
              groupGranularity: { due_date: "year" },
            },
          },
        });
        await renderDataTable2(<DataTable2 />);

        await callSearchBar("onPickSaved", {
          id: 7,
          filter: simpleTree,
          sort: null,
          group: savedGroup,
        });

        expect(lastSearchBarProps().activeFid).toBe(7);
        expect(lastTable2Props().options.sort).toBe("-code");
        expect(lastSearchBarProps().group).toEqual([
          { column: "due_date", granularity: "year", range: null },
        ]);
        await flushReload();
        expect(reloadParams().get("sort")).toBe("-code");
        expect(reloadParams().get("group")).toBe("due_date");
      },
    );

    it("saved tanpa id diabaikan (tak ada perubahan state maupun reload)", async () => {
      await renderDataTable2(<DataTable2 />);

      await callSearchBar("onPickSaved", null);
      await callSearchBar("onPickSaved", { filter: simpleTree });
      await flushReload();

      expect(routerGet).not.toHaveBeenCalled();
      expect(axiosPost).not.toHaveBeenCalled();
      expect(lastSearchBarProps().tree).toBeNull();
      expect(lastSearchBarProps().activeFid).toBeNull();
    });
  });

  describe("Search Bar -> getViewSnapshot (sort + group aktif utk Simpan/Timpa & deteksi dirty)", () => {
    it("tanpa group: { sort, group: null }", async () => {
      await renderDataTable2(<DataTable2 />);

      expect(lastSearchBarProps().getViewSnapshot()).toEqual({
        sort: "name",
        group: null,
      });
    });

    it("dgn group dari URL: list `Groups` -- range string dinormalkan ke Number", async () => {
      mockPage({
        dataTableColumns: groupingColumns,
        ziggy: {
          query: {
            sort: "-name",
            group: "code,amount",
            groupRange: { amount: "50" },
          },
        },
      });
      await renderDataTable2(<DataTable2 />);

      const snapshot = lastSearchBarProps().getViewSnapshot();
      expect(snapshot).toEqual({
        sort: "-name",
        group: [
          { column: "code", granularity: null, range: null },
          { column: "amount", granularity: null, range: 50 },
        ],
      });
      expect(snapshot.group[1].range).toBe(50);
    });

    it("sort null (bukan undefined) bila tak ada sort sama sekali", async () => {
      mockPage({ defaultSort: undefined });
      await renderDataTable2(<DataTable2 />);

      expect(lastSearchBarProps().getViewSnapshot()).toEqual({
        sort: null,
        group: null,
      });
    });

    it("mengikuti perubahan sort & group berikutnya (bukan snapshot basi); group dikosongkan -> null lagi", async () => {
      mockPage({ dataTableColumns: groupingColumns });
      const user = userEvent.setup({
        delay: null,
        advanceTimers: vi.advanceTimersByTime,
      });
      await renderDataTable2(<DataTable2 />);

      const groups = [
        { column: "code", granularity: null, range: null },
        { column: "due_date", granularity: "quarter", range: null },
      ];
      await callSearchBar("onGroupChange", groups);
      // setSort tanpa arg dari Table2: toggle asc -> desc kolom yang sama.
      await user.click(screen.getByText("trigger-set-sort"));

      expect(lastSearchBarProps().getViewSnapshot()).toEqual({
        sort: "-name",
        group: groups,
      });

      await callSearchBar("onGroupChange", []);
      expect(lastSearchBarProps().getViewSnapshot().group).toBeNull();
    });
  });

  describe("Search Bar -> getSearchColumns (kolom yang dicari chip 'Cari')", () => {
    const searchColumns = {
      name: {
        name: "name",
        titleTrans: "supplier.columns.name",
        type: "string",
        show: true,
      },
      code: {
        name: "code",
        titleTrans: "supplier.columns.code",
        type: "string",
        show: true,
      },
      // tidak tampil (show:false) -> bukan kolom pencarian fallback.
      remarks: {
        name: "remarks",
        titleTrans: "supplier.columns.remarks",
        type: "string",
        show: false,
      },
      // searchable:false -> dikecualikan.
      npwp: {
        name: "npwp",
        titleTrans: "supplier.columns.npwp",
        type: "string",
        show: true,
        searchable: false,
      },
      // bukan string -> dikecualikan.
      amount: {
        name: "amount",
        titleTrans: "supplier.columns.amount",
        type: "number",
        show: true,
      },
      // relasi: bukan string level-atas -> dikecualikan.
      customer: {
        name: "customer",
        titleTrans: "supplier.columns.customer",
        type: "relation",
        show: true,
        columns: {
          name: {
            name: "name",
            titleTrans: "customer.columns.name",
            type: "string",
          },
        },
      },
    };

    it("searchScope tidak kosong dipakai apa adanya (termasuk path relasi bertitik)", async () => {
      mockPage({
        dataTableColumns: searchColumns,
        searchScope: ["code", "customer.name"],
      });
      await renderDataTable2(<DataTable2 />);

      expect(lastSearchBarProps().getSearchColumns()).toEqual([
        "code",
        "customer.name",
      ]);
    });

    it.each([
      ["searchScope kosong", { searchScope: [] }],
      ["searchScope tak dikirim backend", {}],
    ])(
      "%s -> fallback kolom TAMPIL ∩ searchable ∩ string level-atas",
      async (_label, overrides) => {
        mockPage({ dataTableColumns: searchColumns, ...overrides });
        await renderDataTable2(<DataTable2 />);

        expect(lastSearchBarProps().getSearchColumns()).toEqual([
          "name",
          "code",
        ]);
      },
    );

    it("visibility kolom dibaca SAAT dipanggil (cookie Table2 berubah tanpa re-render DataTable2)", async () => {
      mockPage({ dataTableColumns: searchColumns });
      await renderDataTable2(<DataTable2 />);
      const { getSearchColumns } = lastSearchBarProps();
      const renderCount = searchBarProps.mock.calls.length;

      expect(getSearchColumns()).toEqual(["name", "code"]);

      // User menyembunyikan "name" di Table2 -> cookie visibility hanya
      // memuat "code".
      document.cookie = `${datatableColumnsCookieKey(window.location.pathname)}={"code":{}}; path=/`;

      expect(getSearchColumns()).toEqual(["code"]);
      expect(searchBarProps.mock.calls.length).toBe(renderCount);
    });

    it("TIDAK memutasi mapColumns (createHeaders dipanggil dgn salinan dangkal): kunci & entri kolom tetap identik", async () => {
      mockPage({ dataTableColumns: searchColumns });
      await renderDataTable2(<DataTable2 />);
      const columns = lastTable2Props().columns;
      const before = { ...columns };

      lastSearchBarProps().getSearchColumns();

      expect(Object.keys(columns)).toEqual(Object.keys(before));
      Object.keys(before).forEach((key) => {
        expect(columns[key]).toBe(before[key]);
      });
      // createHeaders asli menambah `size`/`sort` pada entri yang dimutasinya.
      expect(columns.name).not.toHaveProperty("size");
      expect(columns.name).not.toHaveProperty("sort");
      // Objek yang sama tetap dipegang Search Bar & Table2.
      expect(lastSearchBarProps().columns).toBe(columns);
    });
  });

  describe("Baris Filter Kolom -- prop columnFilter ke Table2 (spec datatable2-column-search-row)", () => {
    it("Table2 menerima columnFilter {columns, draft, onOpenBuilder}; draft SAMA dgn yang diberikan ke Search Bar atas", async () => {
      await renderDataTable2(<DataTable2 />);

      const { columnFilter } = lastTable2Props();
      expect(columnFilter).toBeDefined();
      expect(columnFilter.columns).toBe(lastTable2Props().columns);
      expect(typeof columnFilter.onOpenBuilder).toBe("function");
      // draft terkontrol dibagi dgn Search Bar atas (Requirement 7.3)
      expect(lastSearchBarProps().draft).toBeDefined();
      expect(typeof columnFilter.draft.commitTreeChange).toBe("function");
      expect(columnFilter.draft.draftTree).toBe(
        lastSearchBarProps().draft.draftTree,
      );
    });

    it("commit dari sel (commitTreeChange): POST saved-filters.store dgn tree baru tanpa toast sukses, tree sampai ke Search Bar", async () => {
      axiosPost.mockResolvedValue({ data: { id: 5 } });
      await renderDataTable2(<DataTable2 />);

      await act(async () => {
        await lastTable2Props().columnFilter.draft.commitTreeChange(
          () => simpleTree,
        );
      });

      expect(axiosPost).toHaveBeenCalledTimes(1);
      expect(axiosPost).toHaveBeenCalledWith("saved-filters.store", {
        model: "App\\Models\\Purchase\\Supplier",
        filter: simpleTree,
        fid: null,
      });
      expect(toastSuccess).not.toHaveBeenCalled();
      expect(lastSearchBarProps().tree).toBe(simpleTree);
      expect(lastSearchBarProps().activeFid).toBe(5);
      // badge sel & chip atas membaca draft yang sama -> sudah ter-apply
      expect(lastTable2Props().columnFilter.draft.draftTree).toBe(simpleTree);
    });

    it("draft Search Bar atas yang belum di-apply ikut ter-apply saat commit sel (tak hilang)", async () => {
      axiosPost.mockResolvedValue({ data: { id: 6 } });
      await renderDataTable2(<DataTable2 />);

      await act(async () => {
        lastSearchBarProps().draft.setDraftTree(simpleTree);
      });
      expect(axiosPost).not.toHaveBeenCalled();

      await act(async () => {
        await lastTable2Props().columnFilter.draft.commitTreeChange(
          (draft) => ({
            root: {
              k: "and",
              c: { ...draft.root.c, b: { k: "name", o: "matches", v: "x" } },
            },
          }),
        );
      });

      expect(axiosPost).toHaveBeenCalledTimes(1);
      const sent = axiosPost.mock.calls[0][1].filter;
      expect(
        Object.values(sent.root.c)
          .map((n) => n.k)
          .sort(),
      ).toEqual(["code", "name"]);
    });

    it("onOpenBuilder (badge read-only di sel) membuka Builder dgn draft tree TERKINI", async () => {
      await renderDataTable2(<DataTable2 />);
      expect(screen.getByTestId("stub-filter-table2")).toHaveAttribute(
        "data-open",
        "false",
      );

      await act(async () => {
        lastTable2Props().columnFilter.onOpenBuilder(simpleTree);
      });

      expect(screen.getByTestId("stub-filter-table2")).toHaveAttribute(
        "data-open",
        "true",
      );
      expect(lastFilterTableProps().initialFilters).toBe(simpleTree);
    });

    it("mobile (kartu): Table2 tidak dirender, jadi baris filter tak ada", async () => {
      isMobileMock.mockReturnValue(true);
      table2Props.mockClear();
      await renderDataTable2(<DataTable2 />);

      expect(screen.queryByTestId("stub-table2")).toBeNull();
      expect(table2Props).not.toHaveBeenCalled();
    });
  });

  describe("filter builder (FilterTable2 controlled) & saved filter", () => {
    it("meneruskan mapColumns, model, activeFid, isMobile & mode controlled (open/onOpenChange, tanpa trigger) ke FilterTable2", async () => {
      mockPage({ ziggy: { query: { fid: "12" } } });
      await renderDataTable2(<DataTable2 />);

      const props = lastFilterTableProps();
      expect(props.activeFid).toBe("12");
      expect(Object.keys(props.columns)).toEqual(["name", "code"]);
      expect(props.model).toBe("App\\Models\\Purchase\\Supplier");
      expect(props.isMobile).toBe(false);
      expect(props.open).toBe(false);
      expect(props.onOpenChange).toEqual(expect.any(Function));
      expect(props.trigger).toBeUndefined();
      expect(props.initialFilters).toBeNull();
    });

    it("saat mount dengan ?fid, fetch saved-filters.show; tree hasilnya jadi tree Search Bar (chip) & initialFilters builder", async () => {
      axiosGet.mockResolvedValue({ data: { filter: simpleTree } });
      mockPage({ ziggy: { query: { fid: "12" } } });
      await renderDataTable2(<DataTable2 />);

      await waitFor(() => {
        expect(axiosGet).toHaveBeenCalledWith(
          'saved-filters.show/{"savedFilter":"12"}',
        );
      });
      await waitFor(() => {
        expect(lastSearchBarProps().tree).toBe(simpleTree);
      });
      expect(lastFilterTableProps().initialFilters).toBe(simpleTree);
    });

    it("tanpa fid tidak fetch saved-filters.show", async () => {
      await renderDataTable2(<DataTable2 />);
      expect(axiosGet).not.toHaveBeenCalled();
    });

    it("onApply (bukan useExisting) memanggil axios.post saved-filters.store dengan model & tree, set fid dari response, toast success (jalur builder TIDAK silent) & tree sampai ke Search Bar sbg chip", async () => {
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
      await waitFor(() => {
        expect(toastSuccess).toHaveBeenCalledWith(
          "TR:core.datatable.filter.save.success",
        );
      });
      // Chip = tree yang sama dgn builder (Requirement 2.3).
      expect(lastSearchBarProps().tree.root.c).toEqual({
        a: { k: "status", o: "=", v: "open" },
      });
      expect(lastSearchBarProps().activeFid).toBe(77);
    });

    it("onApply gagal (422) menampilkan toast error dari response.errors.filter", async () => {
      const user = userEvent.setup({ delay: null });
      const rejection = {
        response: {
          status: 422,
          data: { errors: { filter: ["Filter kosong"] } },
        },
      };
      axiosPost.mockRejectedValue(rejection);
      silencePersistErrorLog(rejection);
      await renderDataTable2(<DataTable2 />);

      await user.click(screen.getByText("trigger-apply-filter"));

      await waitFor(() => {
        expect(toastError).toHaveBeenCalledWith("Filter kosong");
      });
    });

    it("onApply gagal non-422 menampilkan toast error umum", async () => {
      const user = userEvent.setup({ delay: null });
      const rejection = { response: { status: 500 } };
      axiosPost.mockRejectedValue(rejection);
      silencePersistErrorLog(rejection);
      await renderDataTable2(<DataTable2 />);

      await user.click(screen.getByText("trigger-apply-filter"));

      await waitFor(() => {
        expect(toastError).toHaveBeenCalledWith(
          "TR:core.datatable.filter.save.error",
        );
      });
    });

    it("onApply useExisting (pilih named filter di dialog) mengaktifkan fid & sort-nya TANPA POST, toast success", async () => {
      const user = userEvent.setup({
        delay: null,
        advanceTimers: vi.advanceTimersByTime,
      });
      await renderDataTable2(<DataTable2 />);

      await user.click(screen.getByText("trigger-apply-existing-filter"));

      expect(axiosPost).not.toHaveBeenCalled();
      expect(toastSuccess).toHaveBeenCalledWith(
        "TR:core.datatable.filter.save.success",
      );
      expect(lastSearchBarProps().activeFid).toBe(33);
      expect(lastSearchBarProps().tree.root.c).toEqual({
        b: { k: "code", o: "=", v: "S1" },
      });
      await flushReload();
      expect(reloadParams().get("fid")).toBe("33");
      expect(reloadParams().get("sort")).toBe("-code");
    });

    it("onSaved dengan item (mis. simpan/pilih named filter di dialog) mengeset options.fid", async () => {
      const user = userEvent.setup({
        delay: null,
        advanceTimers: vi.advanceTimersByTime,
      });
      await renderDataTable2(<DataTable2 />);

      await user.click(screen.getByText("trigger-saved-filter"));
      await flushReload();

      expect(lastSearchBarProps().activeFid).toBe(55);
      expect(reloadParams().get("fid")).toBe("55");
    });

    it("onSaved(null) (mis. named filter aktif dihapus) menghapus fid dari options", async () => {
      const user = userEvent.setup({
        delay: null,
        advanceTimers: vi.advanceTimersByTime,
      });
      mockPage({ ziggy: { query: { fid: "12" } } });
      await renderDataTable2(<DataTable2 />);

      await user.click(screen.getByText("trigger-clear-saved-filter"));
      await flushReload();

      expect(lastSearchBarProps().activeFid).toBeNull();
      expect(reloadParams().has("fid")).toBe(false);
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
      // act() -- bungkus panggilan & polling terpisah supaya microtask
      // promise mock + setState-nya stabil sebelum lanjut.
      await act(async () => {
        ref.current.addFilter("name", "=", "Supplier A");
      });

      await waitFor(() => {
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

    it("hasil addFilter tampil sbg chip: tree ke Search Bar & builder, fid response jadi activeFid, toast sukses TETAP tampil (bukan jalur silent)", async () => {
      axiosPost.mockResolvedValue({ data: { id: 88 } });
      const ref = React.createRef();
      await renderDataTable2(<DataTable2 ref={ref} />);

      await act(async () => {
        ref.current.addFilter("name", "=", "Supplier A");
      });

      await waitFor(() => {
        expect(lastSearchBarProps().activeFid).toBe(88);
      });
      expect(Object.values(lastSearchBarProps().tree.root.c)).toEqual([
        { k: "name", o: "=", v: "Supplier A" },
      ]);
      expect(lastFilterTableProps().initialFilters).toBe(
        lastSearchBarProps().tree,
      );
      expect(toastSuccess).toHaveBeenCalledWith(
        "TR:core.datatable.filter.save.success",
      );
    });

    it("digabung ke tree aktif (bukan menimpa) & fid aktif dikirim agar row itu di-UPDATE", async () => {
      const activeTree = {
        root: { k: "and", c: { existing: { k: "code", o: "=", v: "S1" } } },
      };
      axiosGet.mockResolvedValue({ data: { filter: activeTree } });
      mockPage({ ziggy: { query: { fid: "12" } } });
      const ref = React.createRef();
      await renderDataTable2(<DataTable2 ref={ref} />);
      await waitFor(() => {
        expect(lastSearchBarProps().tree).toBe(activeTree);
      });

      await act(async () => {
        ref.current.addFilter("name", "=", "Supplier A");
      });
      await waitFor(() => {
        expect(axiosPost).toHaveBeenCalledTimes(1);
      });

      const [, payload] = axiosPost.mock.calls[0];
      expect(payload.fid).toBe("12");
      expect(payload.filter.root.c.existing).toEqual({
        k: "code",
        o: "=",
        v: "S1",
      });
      expect(Object.keys(payload.filter.root.c)).toHaveLength(2);
    });

    it("gagal simpan: toast error tampil & rejection ditelan (quick filter tak punya dialog)", async () => {
      const rejection = { response: { status: 500 } };
      axiosPost.mockRejectedValue(rejection);
      silencePersistErrorLog(rejection);
      const ref = React.createRef();
      await renderDataTable2(<DataTable2 ref={ref} />);

      await act(async () => {
        ref.current.addFilter("name", "=", "Supplier A");
      });

      await waitFor(() => {
        expect(toastError).toHaveBeenCalledWith(
          "TR:core.datatable.filter.save.error",
        );
      });
      expect(lastSearchBarProps().tree).toBeNull();
    });
  });

  describe("Group by lewat Search Bar (groupOptions / onGroupChange / group)", () => {
    describe("groupOptions", () => {
      it("tanpa kolom groupable: groupOptions & onGroupChange undefined (Search Bar menyembunyikan seksi Group)", async () => {
        await renderDataTable2(<DataTable2 />);

        expect(lastSearchBarProps().groupOptions).toBeUndefined();
        expect(lastSearchBarProps().onGroupChange).toBeUndefined();
      });

      it("hanya kolom groupable yang masuk, TANPA sentinel 'Tidak ada' (tidak ada = Groups kosong)", async () => {
        mockPage({ dataTableColumns: groupableColumns });
        await renderDataTable2(<DataTable2 />);

        expect(lastSearchBarProps().groupOptions).toEqual([
          { value: "code", label: "TR:supplier.columns.code" },
        ]);
        expect(lastSearchBarProps().onGroupChange).toEqual(
          expect.any(Function),
        );
      });

      it("diurut abjad berdasar label terjemahan, bukan urutan kolom dari BE", async () => {
        mockPage({
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
        });
        await renderDataTable2(<DataTable2 />);

        expect(
          lastSearchBarProps().groupOptions.map((opt) => opt.label),
        ).toEqual([
          "Aaa Kolom",
          "TR:supplier.columns.code",
          "TR:supplier.columns.name",
        ]);
        expect(
          lastSearchBarProps().groupOptions.map((opt) => opt.value),
        ).toEqual(["aaa", "code", "name"]);
      });

      it("mengikuti locale bahasa aktif (currentLocale) -- 'ä' setelah 'z' di sv", async () => {
        currentLocaleMock.mockReturnValue("sv");
        mockPage({
          dataTableColumns: {
            z_col: { name: "z_col", title: "z", groupable: true, show: true },
            ae_col: { name: "ae_col", title: "ä", groupable: true, show: true },
            a_col: { name: "a_col", title: "a", groupable: true, show: true },
          },
          defaultSort: "a_col",
        });
        await renderDataTable2(<DataTable2 />);

        expect(
          lastSearchBarProps().groupOptions.map((opt) => opt.label),
        ).toEqual(["a", "z", "ä"]);
      });
    });

    describe("onGroupChange", () => {
      it("beberapa level: urutan = nesting; sort TIDAK dikunci (grup tak mengubah sort), page reset, reload membawa group=a,b", async () => {
        mockPage({
          dataTableColumns: groupingColumns,
          ziggy: { query: { page: "3" } },
        });
        await renderDataTable2(<DataTable2 />);

        const groups = [
          { column: "code", granularity: null, range: null },
          { column: "due_date", granularity: "quarter", range: null },
        ];
        await callSearchBar("onGroupChange", groups);

        const props = lastTable2Props();
        // Sort TIDAK ikut berubah -- tetap defaultSort ("name"), bukan "code".
        expect(props.options.sort).toBe("name");
        expect(props.options.page).toBe(1);
        expect(props.options.group).toEqual(groups);
        expect(lastSearchBarProps().group).toEqual(groups);

        await flushReload();
        const params = reloadParams();
        expect(params.get("group")).toBe("code,due_date");
        expect(params.get("groupGranularity[due_date]")).toBe("quarter");
        expect(params.has("groupRange[due_date]")).toBe(false);
        expect(params.get("sort")).toBe("name");
        expect(params.get("page")).toBe("1");
      });

      it("mengubah URUTAN level mengubah nesting (group=b,a) dan me-reset page", async () => {
        mockPage({
          dataTableColumns: groupingColumns,
          ziggy: {
            query: { group: "code,due_date", page: "2" },
          },
        });
        await renderDataTable2(<DataTable2 />);

        await callSearchBar("onGroupChange", [
          { column: "due_date", granularity: "month", range: null },
          { column: "code", granularity: null, range: null },
        ]);
        await flushReload();

        const params = reloadParams();
        expect(params.get("group")).toBe("due_date,code");
        expect(params.get("groupGranularity[due_date]")).toBe("month");
        expect(params.get("page")).toBe("1");
      });

      it("granularity/range diterapkan apa adanya (default kolom dihitung Search Bar/BE, bukan host)", async () => {
        mockPage({ dataTableColumns: groupingColumns });
        await renderDataTable2(<DataTable2 />);

        await callSearchBar("onGroupChange", [
          { column: "due_date" },
          { column: "amount", granularity: null, range: 50 },
        ]);

        expect(lastSearchBarProps().group).toEqual([
          { column: "due_date", granularity: null, range: null },
          { column: "amount", granularity: null, range: 50 },
        ]);
        await flushReload();
        const params = reloadParams();
        expect(params.get("group")).toBe("due_date,amount");
        expect(params.has("groupGranularity[due_date]")).toBe(false);
        expect(params.get("groupRange[amount]")).toBe("50");
      });

      it("ganti granularity kolom yang sama tidak mereset kolom grup", async () => {
        mockPage({
          dataTableColumns: groupingColumns,
          ziggy: {
            query: {
              group: "due_date",
              groupGranularity: { due_date: "month" },
            },
          },
        });
        await renderDataTable2(<DataTable2 />);

        await callSearchBar("onGroupChange", [
          { column: "due_date", granularity: "quarter", range: null },
        ]);

        expect(lastSearchBarProps().group).toEqual([
          { column: "due_date", granularity: "quarter", range: null },
        ]);
        await flushReload();
        expect(reloadParams().get("group")).toBe("due_date");
        expect(reloadParams().get("groupGranularity[due_date]")).toBe(
          "quarter",
        );
        expect(reloadParams().has("groupRange[due_date]")).toBe(false);
      });

      it("Groups kosong ('Tidak ada') mematikan grouping, sort TIDAK direset", async () => {
        mockPage({
          dataTableColumns: groupingColumns,
          ziggy: {
            query: {
              group: "due_date",
              groupGranularity: { due_date: "quarter" },
              sort: "code",
            },
          },
        });
        await renderDataTable2(<DataTable2 />);

        await callSearchBar("onGroupChange", []);

        expect(lastTable2Props().options.group).toEqual([]);
        expect(lastTable2Props().options.sort).toBe("code");
        expect(lastSearchBarProps().group).toEqual([]);
      });

      it("'Tidak ada' saat model punya default group -> URL tetap membawa `group=` KOSONG (param hilang = BE pakai default lagi)", async () => {
        mockPage({
          dataTableColumns: groupableColumns,
          defaultGroups: [{ column: "code", granularity: null, range: null }],
        });
        await renderDataTable2(<DataTable2 />);

        await callSearchBar("onGroupChange", []);
        await flushReload();

        expect(routerGet).toHaveBeenCalledTimes(1);
        const params = reloadParams();
        expect(params.has("group")).toBe(true);
        expect(params.get("group")).toBe("");
      });

      it("tanpa default group, 'Tidak ada' -> param group hilang dari URL (tak mengotori URL)", async () => {
        mockPage({
          dataTableColumns: groupableColumns,
          ziggy: { query: { group: "code" } },
        });
        await renderDataTable2(<DataTable2 />);

        await callSearchBar("onGroupChange", []);
        await flushReload();

        expect(routerGet).toHaveBeenCalledTimes(1);
        expect(reloadParams().has("group")).toBe(false);
      });

      it("'Tidak ada' saat filter tersimpan aktif (fid) -> `group=` KOSONG walau defaultGroups kosong (filter bisa ber-group; defaultGroups dimuat sebelum filter dipilih)", async () => {
        mockPage({
          dataTableColumns: groupableColumns,
          ziggy: { query: { group: "code" } },
        });
        await renderDataTable2(<DataTable2 />);

        // Pilih filter tersimpan (tanpa group sendiri -> group aktif tak berubah),
        // lalu hapus chip group.
        await callSearchBar("onPickSaved", {
          id: 42,
          filter: simpleTree,
          sort: null,
          group: null,
        });
        await callSearchBar("onGroupChange", []);
        await flushReload();

        expect(routerGet).toHaveBeenCalledTimes(1);
        const params = reloadParams();
        expect(params.get("fid")).toBe("42");
        expect(params.has("group")).toBe(true);
        expect(params.get("group")).toBe("");
      });

      it("onGroupSortChange hanya diteruskan bila ada kolom groupable; klik `desc` -> reload membawa groupSort=desc, sort tabel & URL TIDAK berubah, page reset", async () => {
        mockPage({
          dataTableColumns: groupingColumns,
          ziggy: { query: { group: "code", sort: "-name", page: "3" } },
        });
        await renderDataTable2(<DataTable2 />);
        expect(lastSearchBarProps().groupSort).toBe("asc");

        await callSearchBar("onGroupSortChange", "desc");
        expect(lastSearchBarProps().groupSort).toBe("desc");
        expect(lastTable2Props().options.sort).toBe("-name");
        await flushReload();

        const params = reloadParams();
        expect(params.get("groupSort")).toBe("desc");
        expect(params.get("sort")).toBe("-name");
        expect(params.get("group")).toBe("code");
        expect(params.get("page")).toBe("1");
      });

      it("groupSort asc (default) tak dikirim ke URL; nilai awal dibaca dari ?groupSort=desc", async () => {
        mockPage({
          dataTableColumns: groupingColumns,
          ziggy: { query: { group: "code", groupSort: "desc" } },
        });
        await renderDataTable2(<DataTable2 />);
        expect(lastSearchBarProps().groupSort).toBe("desc");

        await callSearchBar("onGroupSortChange", "asc");
        await flushReload();
        expect(reloadParams().has("groupSort")).toBe(false);
      });

      it("groupSort tak dikirim bila tidak ada group aktif; tanpa kolom groupable tak ada onGroupSortChange", async () => {
        mockPage({
          dataTableColumns: groupingColumns,
          ziggy: { query: { groupSort: "desc" } },
        });
        await renderDataTable2(<DataTable2 />);
        await callSearchBar("onGroupSortChange", "desc");
        await flushReload();
        expect(reloadParams().has("groupSort")).toBe(false);

        mockPage({});
        await renderDataTable2(<DataTable2 />);
        expect(lastSearchBarProps().onGroupSortChange).toBeUndefined();
      });

      it("input dinormalkan STRUKTURAL (bukan crash): kolom duplikat dibuang; pemotongan maks 4 level dilakukan backend setelah gating", async () => {
        mockPage({ dataTableColumns: groupingColumns });
        await renderDataTable2(<DataTable2 />);

        await callSearchBar("onGroupChange", [
          { column: "code" },
          { column: "code", granularity: "year" },
          { column: "due_date" },
        ]);

        expect(lastSearchBarProps().group).toEqual([
          { column: "code", granularity: null, range: null },
          { column: "due_date", granularity: null, range: null },
        ]);
      });
    });

    describe("group awal (state options)", () => {
      const defaultCode = [{ column: "code", granularity: null, range: null }];

      it("defaultGroups dari model dipakai sbg grup awal saat URL tak punya param group", async () => {
        mockPage({
          dataTableColumns: groupableColumns,
          defaultGroups: defaultCode,
        });
        await renderDataTable2(<DataTable2 />);

        expect(lastTable2Props().options.group).toEqual(defaultCode);
        expect(lastSearchBarProps().group).toEqual(defaultCode);
      });

      it("defaultGroups BERTINGKAT dipakai apa adanya sbg grup awal", async () => {
        const defaults = [
          { column: "code", granularity: null, range: null },
          { column: "due_date", granularity: "quarter", range: null },
        ];
        mockPage({
          dataTableColumns: groupingColumns,
          defaultGroups: defaults,
        });
        await renderDataTable2(<DataTable2 />);

        expect(lastSearchBarProps().group).toEqual(defaults);
      });

      it("tanpa defaultGroups & tanpa param group -> Groups kosong", async () => {
        mockPage({ dataTableColumns: groupableColumns });
        await renderDataTable2(<DataTable2 />);

        expect(lastSearchBarProps().group).toEqual([]);
      });

      it("`?group=` kosong di URL = tanpa grup eksplisit, default TIDAK dipakai", async () => {
        mockPage({
          dataTableColumns: groupableColumns,
          defaultGroups: defaultCode,
          ziggy: { query: { group: "" } },
        });
        await renderDataTable2(<DataTable2 />);

        expect(lastSearchBarProps().group).toEqual([]);
        expect(lastTable2Props().options.group).toEqual([]);
      });

      it.each([
        [
          "?group=<kolom default> tanpa granularity mewarisi granularity default",
          {
            defaultGroups: [
              { column: "due_date", granularity: "quarter", range: null },
            ],
          },
          { group: "due_date" },
          [{ column: "due_date", granularity: "quarter", range: null }],
        ],
        [
          "?group=<kolom default> tanpa range mewarisi range default",
          {
            defaultGroups: [{ column: "amount", granularity: null, range: 50 }],
          },
          { group: "amount" },
          [{ column: "amount", granularity: null, range: 50 }],
        ],
        [
          "?group=<kolom LAIN> TIDAK mewarisi granularity/range default",
          {
            defaultGroups: [
              { column: "due_date", granularity: "quarter", range: 50 },
            ],
          },
          { group: "code" },
          [{ column: "code", granularity: null, range: null }],
        ],
        [
          "param URL granularity menang atas default",
          {
            defaultGroups: [
              { column: "due_date", granularity: "quarter", range: null },
            ],
          },
          { group: "due_date", groupGranularity: { due_date: "year" } },
          [{ column: "due_date", granularity: "year", range: null }],
        ],
        [
          "param URL range (string) menang atas default & dinormalkan ke Number",
          {
            defaultGroups: [{ column: "amount", granularity: null, range: 25 }],
          },
          { group: "amount", groupRange: { amount: "50" } },
          [{ column: "amount", granularity: null, range: 50 }],
        ],
        [
          "beberapa level di URL: tiap level mewarisi dari level default dgn kolom SAMA saja",
          {
            defaultGroups: [
              { column: "due_date", granularity: "quarter", range: null },
              { column: "amount", granularity: null, range: 50 },
            ],
          },
          { group: "amount,code,due_date" },
          [
            { column: "amount", granularity: null, range: 50 },
            { column: "code", granularity: null, range: null },
            { column: "due_date", granularity: "quarter", range: null },
          ],
        ],
        [
          "bentuk kawat skalar lama (group=x&groupGranularity=y) = level pertama",
          {},
          { group: "due_date", groupGranularity: "year" },
          [{ column: "due_date", granularity: "year", range: null }],
        ],
      ])("%s", async (_label, pageProps, query, expectedGroup) => {
        mockPage({
          dataTableColumns: groupingColumns,
          ...pageProps,
          ziggy: { query },
        });
        await renderDataTable2(<DataTable2 />);

        expect(lastSearchBarProps().group).toEqual(expectedGroup);
        expect(lastTable2Props().options.group).toEqual(expectedGroup);
      });

      it("`?group=` kosong (Tidak ada) tak mewarisi granularity/range default apa pun", async () => {
        mockPage({
          dataTableColumns: groupingColumns,
          defaultGroups: [
            { column: "due_date", granularity: "quarter", range: 50 },
          ],
          ziggy: { query: { group: "" } },
        });
        await renderDataTable2(<DataTable2 />);

        expect(lastSearchBarProps().group).toEqual([]);
      });
    });

    describe("groupMeta -> prop `group` Table2 (pohon grup lazy)", () => {
      const meta = {
        levels: [
          { column: "code", granularity: null, range: null, type: "string" },
          {
            column: "due_date",
            granularity: "month",
            range: null,
            type: "date",
          },
        ],
        aggregates: [{ column: "amount", fn: "sum" }],
      };

      it("tanpa groupMeta (grup tak aktif di server): Table2 tak menerima `group` -- tabel datar biasa", async () => {
        await renderDataTable2(<DataTable2 />);

        expect(lastTable2Props().group).toBeUndefined();
      });

      it("dgn groupMeta: levels/aggregates dari server + baseParams eksplisit dari level EFEKTIF tanpa page/group lama", async () => {
        mockPage({
          data: groupRootData,
          groupMeta: meta,
          ziggy: {
            query: {
              sort: "-name",
              page: "4",
              group: "code",
              groupPath: '["x"]',
            },
          },
        });
        await renderDataTable2(<DataTable2 />);

        const group = lastTable2Props().group;
        expect(group.levels).toBe(meta.levels);
        expect(group.aggregates).toBe(meta.aggregates);
        expect(group.pathname).toBe(window.location.pathname);
        expect(group.version).toBe(0);
        // page/group/groupPath lama dibuang; group EKSPLISIT dari level efektif.
        expect(group.baseParams).toEqual({
          sort: "-name",
          group: "code,due_date",
          groupGranularity: { due_date: "month" },
        });
      });

      it("resetKey = URL yang dirender SERVER (ziggy.query), TIDAK ikut berubah oleh options pending yang di-debounce", async () => {
        mockPage({
          data: groupRootData,
          groupMeta: meta,
          dataTableColumns: groupingColumns,
          ziggy: { query: { group: "code" } },
        });
        await renderDataTable2(<DataTable2 />);
        const before = lastTable2Props().group.resetKey;
        expect(before).toBe(JSON.stringify({ group: "code" }));

        await callSearchBar("onGroupChange", [
          { column: "due_date", granularity: "month", range: null },
        ]);

        expect(lastTable2Props().group.resetKey).toBe(before);
      });

      it("version naik HANYA saat identitas `data` level-0 berganti (mis. setelah hapus/reload), bukan tiap render", async () => {
        const props = makePageProps({ data: groupRootData, groupMeta: meta });
        usePageMock.mockReturnValue({ props });
        const { rerender } = await renderDataTable2(<DataTable2 />);
        // DataTable2 dibungkus memo: props baru (`tick`) memaksa re-render, krn
        // usePage() tiruan tak berlangganan context Inertia seperti aslinya.
        let tick = 0;
        const rerenderPage = async () => {
          tick += 1;
          await act(async () => {
            rerender(
              <TooltipProvider>
                <DataTable2 tick={tick} />
              </TooltipProvider>,
            );
          });
        };
        expect(lastTable2Props().group.version).toBe(0);

        // `data` identik (objek props baru, data sama) -> version tetap.
        usePageMock.mockReturnValue({ props: { ...props } });
        await rerenderPage();
        expect(lastTable2Props().group.version).toBe(0);

        usePageMock.mockReturnValue({
          props: { ...props, data: { ...groupRootData } },
        });
        await rerenderPage();
        expect(lastTable2Props().group.version).toBe(1);
      });
    });

    // Requirement 24 (permintaan user): ubah SUB-level grup (level 0 tak
    // berubah) TAK memicu reload Inertia -- cukup diperbarui via TanStack
    // (levels/baseParams baru + subLevelVersion naik, GroupTree menutup paksa
    // node terbuka di kedalaman >=1 & memangkas halamannya sendiri, lihat
    // GroupTree.jsx). Ganti LEVEL 0 tetap reload penuh spt semula.
    describe("Requirement 24: skip reload Inertia (group-sublevel & sort-leaf-only)", () => {
      const twoLevelMeta = {
        levels: [
          { column: "code", granularity: null, range: null, type: "string" },
          {
            column: "due_date",
            granularity: "month",
            range: null,
            type: "date",
          },
        ],
        aggregates: [{ column: "amount", fn: "sum" }],
      };

      it("ganti SUB-level (level 0 identik) -> TANPA router.get, levels/baseParams baru + subLevelVersion naik", async () => {
        mockPage({
          data: groupRootData,
          groupMeta: twoLevelMeta,
          dataTableColumns: groupingColumns,
          ziggy: { query: { group: "code,due_date" } },
        });
        await renderDataTable2(<DataTable2 />);
        const subLevelBefore = lastTable2Props().group.subLevelVersion ?? 0;

        await callSearchBar("onGroupChange", [
          { column: "code", granularity: null, range: null },
          { column: "amount", granularity: null, range: 25 },
        ]);
        // `flushReload()` cuma maju timer -- state hasil setState di dalam
        // callback debounce butuh `waitFor` (act-aware) utk terbaca stabil
        // di `lastTable2Props()`, sama spt pola `waitForReload`.
        await waitFor(() =>
          expect(lastTable2Props().group.subLevelVersion).toBe(
            subLevelBefore + 1,
          ),
        );

        expect(routerGet).not.toHaveBeenCalled();
        const group = lastTable2Props().group;
        expect(group.levels.map((l) => l.column)).toEqual(["code", "amount"]);
        expect(group.baseParams.group).toBe("code,amount");
        // URL bar tetap sinkron (replaceState) walau tanpa fetch server.
        expect(window.location.search).toContain("group=code%2Camount");
      });

      it("ganti LEVEL 0 (bukan sekadar sub-level) -> TETAP reload Inertia penuh", async () => {
        mockPage({
          data: groupRootData,
          groupMeta: twoLevelMeta,
          dataTableColumns: groupingColumns,
          ziggy: { query: { group: "code,due_date" } },
        });
        await renderDataTable2(<DataTable2 />);

        await callSearchBar("onGroupChange", [
          { column: "due_date", granularity: "month", range: null },
          { column: "code", granularity: null, range: null },
        ]);
        await waitForReload();

        expect(reloadParams().get("group")).toBe("due_date,code");
      });

      it("hapus grup jadi 'Tidak ada' -> TETAP reload Inertia penuh (bukan sub-level)", async () => {
        mockPage({
          data: groupRootData,
          groupMeta: twoLevelMeta,
          dataTableColumns: groupingColumns,
          ziggy: { query: { group: "code,due_date" } },
        });
        await renderDataTable2(<DataTable2 />);

        await callSearchBar("onGroupChange", []);
        await waitForReload();

        // Tanpa `defaultGroups`/`fid` aktif di fixture ini, param `group`
        // dihilangkan (bukan `group=` kosong eksplisit) -- lihat
        // groupsToQuery() `hasFallback`. Yang jadi inti tes: reload PENUH
        // sungguhan terjadi (router.get terpanggil), bukan jalur lokal.
        expect(reloadParams().get("group")).toBeNull();
      });

      it("tanpa groupMeta aktif (grup tak dirender server): ganti group TETAP reload penuh", async () => {
        mockPage({
          dataTableColumns: groupingColumns,
          ziggy: { query: { group: "code,due_date" } },
        });
        await renderDataTable2(<DataTable2 />);

        await callSearchBar("onGroupChange", [
          { column: "code", granularity: null, range: null },
          { column: "amount", granularity: null, range: 25 },
        ]);
        await waitForReload();

        expect(reloadParams().get("group")).toBe("code,amount");
      });
    });
  });

  describe("Sort -- desktop (arah + Popover kolom, satu baris dgn Search Bar)", () => {
    const openSortPopover = async (
      user,
      label = "TR:supplier.columns.name",
    ) => {
      const trigger = screen.getByText(label).closest("button");
      trigger.focus();
      await user.keyboard("{Enter}");
      return screen.findByRole("listbox");
    };
    const optionLabels = (listbox) =>
      within(listbox)
        .getAllByRole("option")
        .map((el) => el.textContent);

    it("ketik search di Sort By memfilter daftar & highlight substring cocok", async () => {
      vi.useRealTimers();
      const user = userEvent.setup({ delay: null, pointerEventsCheck: 0 });
      await renderDataTable2(<DataTable2 />);

      const listbox = await openSortPopover(user);

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

    it("memilih kolom menutup popover, mengganti sort (arah dipertahankan) & reset page", async () => {
      vi.useRealTimers();
      const user = userEvent.setup({ delay: null, pointerEventsCheck: 0 });
      mockPage({ ziggy: { query: { sort: "-name", page: "4" } } });
      await renderDataTable2(<DataTable2 />);

      const listbox = await openSortPopover(user);
      await user.click(
        within(listbox).getByRole("option", {
          name: "TR:supplier.columns.code",
        }),
      );

      // Popover tertutup setelah memilih -- listbox tak lagi ada di DOM.
      await waitFor(() => {
        expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
      });
      await waitForReload();
      expect(reloadParams().get("sort")).toBe("-code");
      expect(reloadParams().get("page")).toBe("1");
      // Label tombol Sort mengikuti kolom baru.
      expect(screen.getByText("TR:supplier.columns.code")).toBeInTheDocument();
    });

    it("Sort By diurut abjad berdasar label hasil t(), bukan urutan kolom dari BE", async () => {
      vi.useRealTimers();
      const user = userEvent.setup({ delay: null, pointerEventsCheck: 0 });
      // Fixture: kolom name lebih dulu dari code, tapi abjad label
      // ("...code" < "...name") berlawanan.
      await renderDataTable2(<DataTable2 />);

      const listbox = await openSortPopover(user);

      expect(optionLabels(listbox)).toEqual([
        "TR:supplier.columns.code",
        "TR:supplier.columns.name",
      ]);
    });

    it("mengikuti locale bahasa aktif (currentLocale) -- 'ä' setelah 'z' di sv", async () => {
      vi.useRealTimers();
      const user = userEvent.setup({ delay: null, pointerEventsCheck: 0 });
      currentLocaleMock.mockReturnValue("sv");
      mockPage({
        dataTableColumns: {
          z_col: { name: "z_col", title: "z", sortable: true, show: true },
          ae_col: { name: "ae_col", title: "ä", sortable: true, show: true },
          a_col: { name: "a_col", title: "a", sortable: true, show: true },
        },
        defaultSort: "a_col",
      });
      await renderDataTable2(<DataTable2 />);

      const listbox = await openSortPopover(user, "a");

      expect(optionLabels(listbox)).toEqual(["a", "z", "ä"]);
    });

    it("label tombol Sort = label kolom aktif; key yang tak ada di daftar sortable tampil apa adanya", async () => {
      mockPage({ ziggy: { query: { sort: "-created_at" } } });
      await renderDataTable2(<DataTable2 />);

      expect(screen.getByText("created_at")).toBeInTheDocument();
    });

    it("tombol arah toggle asc <-> desc pada kolom yang sama, ikon mengikuti, reset page", async () => {
      vi.useRealTimers();
      const user = userEvent.setup({ delay: null, pointerEventsCheck: 0 });
      mockPage({ ziggy: { query: { sort: "name", page: "3" } } });
      await renderDataTable2(<DataTable2 />);

      const sortTrigger = screen
        .getByText("TR:supplier.columns.name")
        .closest("button");
      // Grup inline desktop: [tombol arah][trigger popover kolom].
      const [directionButton] = within(sortTrigger.parentElement).getAllByRole(
        "button",
      );
      expect(
        directionButton.querySelector("svg.lucide-arrow-up-narrow-wide"),
      ).toBeTruthy();

      await user.click(directionButton);
      expect(
        directionButton.querySelector("svg.lucide-arrow-down-wide-narrow"),
      ).toBeTruthy();
      await waitForReload(1);
      expect(reloadParams(0).get("sort")).toBe("-name");
      expect(reloadParams(0).get("page")).toBe("1");

      await user.click(directionButton);
      await waitForReload(2);
      expect(reloadParams(1).get("sort")).toBe("name");
    });

    it("Sort TETAP aktif selama grouping aktif (jadi sort sekunder/tie-breaker) -- ganti kolom sort tak menyentuh group", async () => {
      vi.useRealTimers();
      const user = userEvent.setup({ delay: null, pointerEventsCheck: 0 });
      mockPage({
        dataTableColumns: groupableColumns,
        ziggy: { query: { group: "code", sort: "code" } },
      });
      await renderDataTable2(<DataTable2 />);

      // Search Bar di-stub, jadi label "code" hanya ada di trigger Sort.
      const sortTrigger = screen
        .getByText("TR:supplier.columns.code")
        .closest("button");
      expect(sortTrigger).not.toBeDisabled();

      const listbox = await openSortPopover(user, "TR:supplier.columns.code");
      await user.click(
        within(listbox).getByRole("option", {
          name: "TR:supplier.columns.name",
        }),
      );

      await waitForReload();
      expect(reloadParams().get("sort")).toBe("name");
      expect(reloadParams().get("group")).toBe("code");
    });

    // Requirement 24 (permintaan user): beda dgn test di atas -- di sini
    // groupMeta BENAR2 aktif (GroupTree sungguhan merender), jadi sort ke
    // kolom yg bukan kolom grup & bukan groupAggregate cukup diperbarui lewat
    // TanStack (baseParams baru), TANPA reload Inertia.
    it("groupMeta aktif + sort ke kolom BUKAN grup/aggregate -> TANPA router.get, baseParams.sort ikut berubah", async () => {
      vi.useRealTimers();
      const user = userEvent.setup({ delay: null, pointerEventsCheck: 0 });
      mockPage({
        data: groupRootData,
        groupMeta: {
          levels: [
            { column: "code", granularity: null, range: null, type: "string" },
          ],
          aggregates: [{ column: "amount", fn: "sum" }],
        },
        dataTableColumns: groupingColumns,
        ziggy: { query: { group: "code", sort: "code" } },
      });
      await renderDataTable2(<DataTable2 />);

      const listbox = await openSortPopover(user, "TR:supplier.columns.code");
      await user.click(
        within(listbox).getByRole("option", {
          name: "TR:supplier.columns.name",
        }),
      );
      await waitFor(() =>
        expect(lastTable2Props().group.baseParams.sort).toBe("name"),
      );

      expect(routerGet).not.toHaveBeenCalled();
      expect(window.location.search).toContain("sort=name");
    });

    it("groupMeta aktif + sort ke kolom groupAggregate -> TETAP reload Inertia penuh", async () => {
      vi.useRealTimers();
      const user = userEvent.setup({ delay: null, pointerEventsCheck: 0 });
      mockPage({
        data: groupRootData,
        groupMeta: {
          levels: [
            { column: "code", granularity: null, range: null, type: "string" },
          ],
          aggregates: [{ column: "amount", fn: "sum" }],
        },
        dataTableColumns: groupingColumns,
        ziggy: { query: { group: "code", sort: "code" } },
      });
      await renderDataTable2(<DataTable2 />);

      const listbox = await openSortPopover(user, "TR:supplier.columns.code");
      await user.click(
        within(listbox).getByRole("option", {
          name: "TR:supplier.columns.amount",
        }),
      );

      await waitForReload();
      expect(reloadParams().get("sort")).toBe("amount");
    });
  });

  describe("Sort -- mobile (tombol ikon -> Dialog)", () => {
    beforeEach(() => {
      isMobileMock.mockReturnValue(true);
    });

    const openSortDialog = async (user) => {
      await user.click(
        screen.getByRole("button", {
          name: "TR:core.datatable.sorting.sort_by",
        }),
      );
      return screen.findByRole("dialog");
    };

    it("Dialog tertutup awalnya; ikon tombol mengikuti arah sort aktif", async () => {
      mockPage({ ziggy: { query: { sort: "name" } } });
      const { unmount } = await renderDataTable2(<DataTable2 />);

      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
      const iconButton = screen.getByRole("button", {
        name: "TR:core.datatable.sorting.sort_by",
      });
      expect(
        iconButton.querySelector("svg.lucide-arrow-up-narrow-wide"),
      ).toBeTruthy();
      unmount();

      mockPage({ ziggy: { query: { sort: "-name" } } });
      await renderDataTable2(<DataTable2 />);
      expect(
        screen
          .getByRole("button", { name: "TR:core.datatable.sorting.sort_by" })
          .querySelector("svg.lucide-arrow-down-wide-narrow"),
      ).toBeTruthy();
    });

    it("tombol ikon membuka Dialog berjudul 'Sort by' berisi arah asc/desc + daftar kolom sortable (diurut abjad label)", async () => {
      vi.useRealTimers();
      const user = userEvent.setup({ delay: null, pointerEventsCheck: 0 });
      await renderDataTable2(<DataTable2 />);

      const dialog = await openSortDialog(user);

      expect(
        within(dialog).getByRole("heading", {
          name: "TR:core.datatable.sorting.sort_by",
        }),
      ).toBeInTheDocument();
      expect(
        within(dialog).getByRole("button", {
          name: /TR:core\.datatable\.sorting\.ascending/,
        }),
      ).toBeInTheDocument();
      expect(
        within(dialog).getByRole("button", {
          name: /TR:core\.datatable\.sorting\.descending/,
        }),
      ).toBeInTheDocument();
      expect(
        within(dialog)
          .getAllByRole("option")
          .map((el) => el.textContent),
      ).toEqual(["TR:supplier.columns.code", "TR:supplier.columns.name"]);
    });

    it("tombol arah di Dialog memanggil setSort dgn kolom yang SAMA (hanya arah berganti) & Dialog tetap terbuka", async () => {
      vi.useRealTimers();
      const user = userEvent.setup({ delay: null, pointerEventsCheck: 0 });
      mockPage({ ziggy: { query: { sort: "name" } } });
      await renderDataTable2(<DataTable2 />);

      const dialog = await openSortDialog(user);
      await user.click(
        within(dialog).getByRole("button", {
          name: /TR:core\.datatable\.sorting\.descending/,
        }),
      );
      await waitForReload(1);
      expect(reloadParams(0).get("sort")).toBe("-name");
      expect(screen.getByRole("dialog")).toBeInTheDocument();

      await user.click(
        within(screen.getByRole("dialog")).getByRole("button", {
          name: /TR:core\.datatable\.sorting\.ascending/,
        }),
      );
      await waitForReload(2);
      expect(reloadParams(1).get("sort")).toBe("name");
    });

    it("memilih kolom di Dialog mengganti sort (arah dipertahankan), reset page & menutup Dialog", async () => {
      vi.useRealTimers();
      const user = userEvent.setup({ delay: null, pointerEventsCheck: 0 });
      mockPage({ ziggy: { query: { sort: "-name", page: "4" } } });
      await renderDataTable2(<DataTable2 />);

      const dialog = await openSortDialog(user);
      await user.click(
        within(dialog).getByRole("option", {
          name: "TR:supplier.columns.code",
        }),
      );

      await waitFor(() => {
        expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
      });
      await waitForReload();
      expect(reloadParams().get("sort")).toBe("-code");
      expect(reloadParams().get("page")).toBe("1");
    });

    it("ketik search di Dialog memfilter daftar kolom", async () => {
      vi.useRealTimers();
      const user = userEvent.setup({ delay: null, pointerEventsCheck: 0 });
      await renderDataTable2(<DataTable2 />);

      const dialog = await openSortDialog(user);
      await user.type(
        within(dialog).getByPlaceholderText(
          "TR:core.datatable.filter.column.search.placeholder",
        ),
        "cod",
      );

      expect(
        within(dialog).getByRole("option", {
          name: "TR:supplier.columns.code",
        }),
      ).toBeInTheDocument();
      expect(
        within(dialog).queryByRole("option", {
          name: "TR:supplier.columns.name",
        }),
      ).not.toBeInTheDocument();
    });
  });

  describe("menu ⋯ (Reload + Tampilkan per halaman)", () => {
    const openMenu = async (user) => {
      await user.click(
        document.querySelector("button svg.lucide-ellipsis").closest("button"),
      );
      return screen.findByRole("menu");
    };

    it("mobile: hanya Reload + Tampilkan per halaman -- item Filter/Group by/Sorting sudah dihapus", async () => {
      vi.useRealTimers();
      const user = userEvent.setup({ delay: null, pointerEventsCheck: 0 });
      mockPage({ dataTableColumns: groupableColumns });
      isMobileMock.mockReturnValue(true);
      await renderDataTable2(<DataTable2 />);

      const menu = await openMenu(user);

      expect(
        within(menu)
          .getAllByRole("menuitem")
          .map((el) => el.textContent),
      ).toEqual(["TR:core.datatable.reload", "TR:core.datatable.show"]);
      expect(
        within(menu).queryByText("TR:core.datatable.filter.filter"),
      ).not.toBeInTheDocument();
      expect(
        within(menu).queryByText(/core\.datatable\.group_by/),
      ).not.toBeInTheDocument();
      expect(
        within(menu).queryByText(/core\.datatable\.sorting/),
      ).not.toBeInTheDocument();
    });

    it("desktop (isMobile=false): hanya Reload", async () => {
      vi.useRealTimers();
      const user = userEvent.setup({ delay: null, pointerEventsCheck: 0 });
      await renderDataTable2(<DataTable2 />);

      const menu = await openMenu(user);

      expect(
        within(menu)
          .getAllByRole("menuitem")
          .map((el) => el.textContent),
      ).toEqual(["TR:core.datatable.reload"]);
    });

    it("item Reload memanggil loadData langsung", async () => {
      vi.useRealTimers();
      const user = userEvent.setup({ delay: null, pointerEventsCheck: 0 });
      isMobileMock.mockReturnValue(true);
      await renderDataTable2(<DataTable2 />);

      const menu = await openMenu(user);
      await user.click(
        within(menu).getByRole("menuitem", {
          name: "TR:core.datatable.reload",
        }),
      );

      expect(routerGet).toHaveBeenCalledTimes(1);
    });
  });
});
