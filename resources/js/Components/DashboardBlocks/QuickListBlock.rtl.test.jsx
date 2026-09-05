import { describe, expect, it, vi, beforeEach } from "vitest";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

// QuickListBlock komposisi: 2 hook fetch axios berlapis (useModelColumns via
// axios.get "model.columns", dipanggil DUA kali dgn sumber modelClass beda --
// config.model_class utk body block, draft.model_class utk QuickListForm --
// + fetch data axios.post "dashboard.quickList"), BlockEditDialog GENERIK
// (dipakai APA ADANYA/real, pola sama ChartBlock/LinkCardBlock.rtl.test.jsx),
// dan banyak picker berat di luar cakupan file ini: PermissionLinkModel
// (LinkModel penuh), IconPicker, TiptapEditor, FilterTable2, Select (Popover/
// Command internal) -- semua di-stub jadi tombol/elemen pemicu onValueChange,
// sama seperti pola NumberCardBlock/LinkCardBlock.rtl.test.jsx.
//
// ColumnOrderPicker DIKECUALIKAN dari stub penuh: hanya default export (UI
// Dialog drag-drop dnd-kit)-nya yang di-stub, named export `columnLabel` &
// `isSelectableColumn` TETAP ASLI (importOriginal) -- QuickListBlock.jsx
// sendiri memanggil keduanya langsung utk header tabel & visibleColumns,
// bukan cuma dipakai di dalam ColumnOrderPicker.
//
// Cell (dari Table/Table2) juga di-stub -- rendering per-tipe sudah punya
// test sendiri (Table2.rtl.test.jsx); di sini cukup verifikasi PROP yang
// diteruskan QuickListBlock (row, type, name, isLink, route hasil override
// modelRoute).

const usePermissionCanMock = vi.fn();
vi.mock("@/Hooks/usePermission", () => ({
  default: () => ({ can: usePermissionCanMock }),
}));

vi.mock("laravel-react-i18n", () => ({
  useLaravelReactI18n: () => ({ t: (key) => key }),
}));

const axiosGet = vi.fn();
const axiosPost = vi.fn();
vi.mock("axios", () => ({
  default: {
    get: (...args) => axiosGet(...args),
    post: (...args) => axiosPost(...args),
  },
}));

const toastErrorMock = vi.fn();
vi.mock("@/lib/gooeyToast", () => ({
  gooeyToast: { error: (...args) => toastErrorMock(...args) },
}));

const blockDescriptionTooltipSpy = vi.fn();
vi.mock("@/Components/DashboardBlocks/BlockDescriptionTooltip", () => ({
  default: (props) => {
    blockDescriptionTooltipSpy(props);
    return props.description ? (
      <span data-testid="description-tooltip" />
    ) : null;
  },
}));

vi.mock(
  "@/Components/DashboardBlocks/ColumnOrderPicker",
  async (importOriginal) => {
    const actual = await importOriginal();
    return {
      ...actual,
      default: ({ columns, value, onChange }) => (
        <div data-testid="column-order-picker">
          <span data-testid="cop-value">{JSON.stringify(value ?? [])}</span>
          <span data-testid="cop-columns">
            {JSON.stringify((columns ?? []).map((c) => c.name))}
          </span>
          <button type="button" onClick={() => onChange(["name", "code"])}>
            ubah-urutan-kolom
          </button>
          <button type="button" onClick={() => onChange([])}>
            kosongkan-kolom
          </button>
        </div>
      ),
    };
  },
);

vi.mock("@/Components/Table/Filter/FilterTable2", () => ({
  default: ({ columns, model, initialFilters, onApply }) => (
    <div data-testid="filter-table2">
      <span data-testid="ft2-model">{model}</span>
      <span data-testid="ft2-columns">
        {JSON.stringify((columns ?? []).map((c) => c.name))}
      </span>
      <span data-testid="ft2-initial">
        {JSON.stringify(initialFilters ?? null)}
      </span>
      <button
        type="button"
        onClick={() =>
          onApply({ root: { c: { a1: { k: "code", o: "=", v: "ID" } } } })
        }
      >
        terapkan-filter
      </button>
    </div>
  ),
}));

vi.mock("@/Components/IconPicker", () => ({
  default: ({ value, onValueChange }) => (
    <div data-testid="icon-picker">
      <span data-testid="icon-picker-value">{value ?? "kosong"}</span>
      <button type="button" onClick={() => onValueChange("RocketIcon")}>
        pilih-icon
      </button>
    </div>
  ),
}));

vi.mock("@/Components/TiptapEditor", () => ({
  default: ({ value, onValueChange }) => (
    <div data-testid="tiptap-editor">
      <span data-testid="tiptap-value">{JSON.stringify(value ?? null)}</span>
      <button
        type="button"
        onClick={() => onValueChange({ type: "doc" }, "<p>Deskripsi baru</p>")}
      >
        ubah-deskripsi
      </button>
    </div>
  ),
}));

vi.mock("@/Pages/Core/PermissionLinkModel", () => ({
  default: ({ value, onValueChange }) => (
    <div data-testid="permission-link-model">
      <span data-testid="plm-value">{value?.model ?? "kosong"}</span>
      <button
        type="button"
        onClick={() =>
          onValueChange({
            id: 3,
            model: "App\\Models\\Core\\Region",
            label: "Region",
          })
        }
      >
        pilih-model-region
      </button>
      <button type="button" onClick={() => onValueChange(null)}>
        pilih-model-null
      </button>
    </div>
  ),
}));

// Select distub sbg <select> asli (pola sama Units/Form.rtl.test.jsx) supaya
// onValueChange bisa dipicu via userEvent.selectOptions tanpa merender
// internal Popover/Command (punya test sendiri).
vi.mock("@/Components/Select", () => ({
  default: ({ value, onValueChange, options, placeholder, disabled }) => (
    <select
      data-testid="select"
      aria-label={placeholder || "arah-urutan"}
      value={value ?? ""}
      disabled={disabled}
      onChange={(e) => onValueChange?.(e.target.value)}
    >
      <option value="" />
      {(options ?? []).map((opt) => (
        <option key={opt.value} value={opt.value}>
          {opt.label}
        </option>
      ))}
    </select>
  ),
}));

vi.mock("@/Components/Table/Table2", () => ({
  Cell: ({ row, type, name, _parse, _valueTrans, ...colProps }) => (
    <span
      data-testid={`cell-${row.id ?? "row"}-${name}`}
      data-type={type}
      data-islink={colProps.isLink ? "1" : "0"}
      data-route={colProps.route ?? ""}
    >
      {typeof row[name] === "object"
        ? JSON.stringify(row[name])
        : String(row[name] ?? "")}
    </span>
  ),
}));

window.route = (name, params) => {
  if (params && typeof params === "object" && params.model) {
    return `${name}?model=${params.model}`;
  }
  return name;
};

import QuickListBlock from "./QuickListBlock";

const noop = () => {};

const COUNTRY_MODEL = "App\\Models\\Core\\Country";
const REGION_MODEL = "App\\Models\\Core\\Region";

// Order: code=0, name=1, lang_code=2, created_at=3, region=4 -- meniru contoh
// nyata di komentar source (Country: code/name/lang_code).
const countryColumns = [
  {
    name: "code",
    type: "string",
    title: "Kode",
    show: true,
    order: 0,
    sortable: true,
    isLink: true,
  },
  {
    name: "name",
    type: "string",
    title: "Nama",
    show: true,
    order: 1,
    sortable: true,
  },
  {
    name: "lang_code",
    type: "string",
    title: "Kode Bahasa",
    show: false,
    order: 2,
    sortable: true,
  },
  {
    name: "created_at",
    type: "date",
    title: "Dibuat",
    show: false,
    order: 3,
    sortable: true,
  },
  {
    name: "region",
    type: "relation",
    title: "Wilayah",
    show: false,
    order: 4,
    sortable: false,
    isLink: true,
    route: "regions.show",
  },
];

const countryItems = [
  { id: 1, code: "ID", name: "Indonesia" },
  { id: 2, code: "US", name: "United States" },
];

function mockColumnsResponses(map) {
  axiosGet.mockImplementation((url) => {
    for (const [modelClass, payload] of Object.entries(map)) {
      if (url.includes(modelClass)) {
        return Promise.resolve({ data: payload });
      }
    }
    return Promise.resolve({ data: { columns: [], route: null } });
  });
}

const defaultProps = {
  block: { id: "block-1", config: {} },
  canEdit: false,
  onUpdate: noop,
  onDelete: noop,
  editOpen: false,
  onEditOpenChange: noop,
};

// render() RTL polos cuma membungkus bagian SINKRON dgn act() -- axios
// dipanggil lewat TanStack Query (opsi L) saat mount dan resolusinya (walau
// mock instan) lanjut di microtask SESUDAH act() sinkron itu selesai.
// Bungkus render() ITU SENDIRI dgn await act(async () => {...}) supaya React
// menunggu microtask pertama stabil. Untuk chained fetch kedua (get() resolve
// -> query kolom selesai -> effect/query items baru terpicu -> post()),
// assert lanjutan sesudahnya memakai waitFor() (act-safe secara internal
// oleh RTL) -- BUKAN dipakai menggantikan pembungkusan render() awal, cuma
// utk mengejar layer async KEDUA (dan scheduling internal TanStack Query)
// yang tidak mungkin diprediksi selesai dalam satu await act() saja.
//
// `wrapper` (bukan bungkus JSX manual) -- QueryClientProvider WAJIB (opsi L)
// dan RTL otomatis pakai wrapper yang SAMA lagi tiap `rerender()` dipanggil,
// tanpa itu rerender() lepas dari provider dan useQuery() error "No
// QueryClient set". queryClient FRESH tiap renderSettled() supaya cache
// TanStack Query tidak bocor lintas test (gantikan __resetModelColumnsCacheForTests
// lama, yang cuma relevan utk cache Map module-level opsi A yang sudah dihapus).
const renderSettled = async (props = {}) => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: Infinity } },
  });
  const Wrapper = ({ children }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );

  let utils;
  await act(async () => {
    utils = render(<QuickListBlock {...defaultProps} {...props} />, {
      wrapper: Wrapper,
    });
  });
  return utils;
};

beforeEach(() => {
  axiosGet.mockReset();
  axiosPost.mockReset();
  toastErrorMock.mockReset();
  blockDescriptionTooltipSpy.mockClear();
  usePermissionCanMock.mockReset();
  usePermissionCanMock.mockReturnValue(true);
  axiosPost.mockResolvedValue({
    data: { data: countryItems, total: 2, last_page: 1, current_page: 1 },
  });
  mockColumnsResponses({
    [COUNTRY_MODEL]: { columns: countryColumns, route: "countries" },
  });
});

describe("QuickListBlock — header (label, icon, description)", () => {
  it("label default 'Quick List' & tanpa icon kalau config kosong", async () => {
    const { container } = await renderSettled();

    expect(screen.getByText("Quick List")).toBeInTheDocument();
    expect(container.querySelector("svg")).not.toBeInTheDocument();
  });

  it("menampilkan config.label & icon (resolveIcon nyata) kalau config.icon di-set", async () => {
    const { container } = await renderSettled({
      block: {
        id: "b1",
        config: { label: "Daftar Negara", icon: "RocketIcon" },
      },
    });

    expect(screen.getByText("Daftar Negara")).toBeInTheDocument();
    expect(container.querySelector("svg")).toBeInTheDocument();
  });

  it("meneruskan config.description apa adanya ke BlockDescriptionTooltip", async () => {
    const description = { json: { type: "doc" }, html: "<p>Halo</p>" };
    await renderSettled({ block: { id: "b1", config: { description } } });

    expect(blockDescriptionTooltipSpy).toHaveBeenCalledWith(
      expect.objectContaining({ description }),
    );
    expect(screen.getByTestId("description-tooltip")).toBeInTheDocument();
  });
});

describe("QuickListBlock — belum ada Model dipilih", () => {
  it("menampilkan placeholder, tidak fetch apa pun, tidak merender tabel", async () => {
    await renderSettled({ block: { id: "b1", config: {} } });

    expect(screen.getByText("Belum ada Model dipilih.")).toBeInTheDocument();
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
    expect(axiosGet).not.toHaveBeenCalled();
    expect(axiosPost).not.toHaveBeenCalled();
  });
});

describe("QuickListBlock — fetch & render tabel data", () => {
  it("fetch model.columns via useModelColumns dgn modelClass yang benar", async () => {
    await renderSettled({
      block: { id: "b1", config: { model_class: COUNTRY_MODEL } },
    });

    await waitFor(() => expect(axiosGet).toHaveBeenCalled());
    expect(axiosGet).toHaveBeenCalledWith(
      `model.columns?model=${COUNTRY_MODEL}`,
    );
  });

  it("visibleColumns fallback ke kolom show:true (config.columns kosong), dipakai utk header & payload fetch", async () => {
    await renderSettled({
      block: { id: "b1", config: { model_class: COUNTRY_MODEL } },
    });

    await waitFor(() =>
      expect(axiosPost).toHaveBeenCalledWith(
        "dashboard.quickList",
        expect.objectContaining({ columns: ["code", "name"] }),
      ),
    );

    const headers = screen
      .getAllByRole("columnheader")
      .map((h) => h.textContent);
    expect(headers).toEqual(["Kode", "Nama"]);
  });

  it("config.columns eksplisit MENGGANTIKAN fallback show:true, urutan & isi apa adanya", async () => {
    await renderSettled({
      block: {
        id: "b1",
        config: { model_class: COUNTRY_MODEL, columns: ["lang_code", "code"] },
      },
    });

    await waitFor(() =>
      expect(axiosPost).toHaveBeenCalledWith(
        "dashboard.quickList",
        expect.objectContaining({ columns: ["lang_code", "code"] }),
      ),
    );
    const headers = screen
      .getAllByRole("columnheader")
      .map((h) => h.textContent);
    expect(headers).toEqual(["Kode Bahasa", "Kode"]);
  });

  it("mengirim filters (flatten dari config.filters.root), sort_by/sort_direction/limit apa adanya", async () => {
    await renderSettled({
      block: {
        id: "b1",
        config: {
          model_class: COUNTRY_MODEL,
          columns: ["code"],
          filters: {
            root: { c: { a1: { k: "code", o: "=", v: "ID" } } },
          },
          sort_by: "name",
          sort_direction: "asc",
          limit: 10,
        },
      },
    });

    await waitFor(() =>
      expect(axiosPost).toHaveBeenCalledWith("dashboard.quickList", {
        model: COUNTRY_MODEL,
        filters: [["code", "=", "ID"]],
        columns: ["code"],
        sort_by: "name",
        sort_direction: "asc",
        limit: 10,
        page: 1,
      }),
    );
  });

  it("default sort_by null, sort_direction 'desc', limit 5 kalau config tidak menyetelnya", async () => {
    await renderSettled({
      block: {
        id: "b1",
        config: { model_class: COUNTRY_MODEL, columns: ["code"] },
      },
    });

    await waitFor(() =>
      expect(axiosPost).toHaveBeenCalledWith(
        "dashboard.quickList",
        expect.objectContaining({
          sort_by: null,
          sort_direction: "desc",
          limit: 5,
        }),
      ),
    );
  });

  it("merender baris via Cell dgn row & metadata kolom yang benar", async () => {
    await renderSettled({
      block: { id: "b1", config: { model_class: COUNTRY_MODEL } },
    });

    await waitFor(() =>
      expect(screen.getByTestId("cell-1-code")).toBeInTheDocument(),
    );
    expect(screen.getByTestId("cell-1-code")).toHaveTextContent("ID");
    expect(screen.getByTestId("cell-1-name")).toHaveTextContent("Indonesia");
    expect(screen.getByTestId("cell-2-code")).toHaveTextContent("US");
  });

  it("kolom fisik isLink TANPA route sendiri (code) di-override jadi `${modelRoute}.show`", async () => {
    await renderSettled({
      block: { id: "b1", config: { model_class: COUNTRY_MODEL } },
    });

    await waitFor(() =>
      expect(screen.getByTestId("cell-1-code")).toHaveAttribute(
        "data-route",
        "countries.show",
      ),
    );
    expect(screen.getByTestId("cell-1-code")).toHaveAttribute(
      "data-islink",
      "1",
    );
  });

  it("kolom relasi isLink yang SUDAH punya route sendiri (region) TIDAK ditimpa modelRoute", async () => {
    await renderSettled({
      block: {
        id: "b1",
        config: { model_class: COUNTRY_MODEL, columns: ["code", "region"] },
      },
    });

    await waitFor(() =>
      expect(screen.getByTestId("cell-1-region")).toHaveAttribute(
        "data-route",
        "regions.show",
      ),
    );
  });
});

describe("QuickListBlock — state loading & kosong", () => {
  it("Bug FATAL (fixed): baris tetap menampilkan loading selama isLoadingColumns=true, walau fetch data (axios.post) sudah selesai", async () => {
    let resolveGetColumns;
    axiosGet.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveGetColumns = resolve;
        }),
    );

    await renderSettled({
      block: {
        id: "b1",
        config: { model_class: COUNTRY_MODEL, columns: ["code", "name"] },
      },
    });

    // axios.post (fetch data) tidak butuh savedColumns (config.columns sudah
    // eksplisit), jadi ia sudah selesai -- tapi baris TETAP tidak dirender
    // krn metadata kolom (savedColumns) belum siap, mencegah Cell menerima
    // fallback type:"string" yang salah utk kolom relasi.
    await waitFor(() => expect(axiosPost).toHaveBeenCalled());
    expect(screen.getByText("Memuat data...")).toBeInTheDocument();
    expect(screen.queryByTestId("cell-1-code")).not.toBeInTheDocument();

    await act(async () => {
      resolveGetColumns({
        data: { columns: countryColumns, route: "countries" },
      });
    });

    await waitFor(() =>
      expect(screen.queryByText("Memuat data...")).not.toBeInTheDocument(),
    );
    expect(screen.getByTestId("cell-1-code")).toBeInTheDocument();
  });

  it("'Tidak ada data.' saat hasil fetch kosong", async () => {
    axiosPost.mockResolvedValue({
      data: { data: [], total: 0, last_page: 1, current_page: 1 },
    });
    await renderSettled({
      block: { id: "b1", config: { model_class: COUNTRY_MODEL } },
    });

    await waitFor(() =>
      expect(screen.getByText("Tidak ada data.")).toBeInTheDocument(),
    );
  });

  it("fetch gagal -> items kosong & toast.error dipanggil", async () => {
    axiosPost.mockRejectedValue(new Error("network error"));
    await renderSettled({
      block: { id: "b1", config: { model_class: COUNTRY_MODEL } },
    });

    await waitFor(() =>
      expect(toastErrorMock).toHaveBeenCalledWith(
        "Gagal memuat data Quick List.",
      ),
    );
    expect(screen.getByText("Tidak ada data.")).toBeInTheDocument();
  });
});

describe("QuickListBlock — pagination", () => {
  it("Pagination TIDAK dirender kalau last_page <= 1", async () => {
    await renderSettled({
      block: { id: "b1", config: { model_class: COUNTRY_MODEL } },
    });

    await waitFor(() => expect(axiosPost).toHaveBeenCalled());
    expect(screen.queryByRole("navigation")).not.toBeInTheDocument();
  });

  it("klik nomor halaman lain memicu fetch ulang dgn `page` baru", async () => {
    axiosPost.mockImplementation((_url, body) =>
      Promise.resolve({
        data: {
          data: countryItems,
          total: 12,
          last_page: 3,
          current_page: body.page,
        },
      }),
    );
    const user = userEvent.setup({ delay: null });
    await renderSettled({
      block: { id: "b1", config: { model_class: COUNTRY_MODEL } },
    });

    await waitFor(() =>
      expect(screen.getByRole("button", { name: "2" })).toBeInTheDocument(),
    );

    await act(async () => {
      await user.click(screen.getByRole("button", { name: "2", exact: true }));
    });

    await waitFor(() =>
      expect(axiosPost).toHaveBeenLastCalledWith(
        "dashboard.quickList",
        expect.objectContaining({ page: 2 }),
      ),
    );
  });

  it("ganti config (mis. limit) mereset ke halaman 1", async () => {
    axiosPost.mockImplementation((_url, body) =>
      Promise.resolve({
        data: {
          data: countryItems,
          total: 12,
          last_page: 3,
          current_page: body.page,
        },
      }),
    );
    const user = userEvent.setup({ delay: null });
    const { rerender } = await renderSettled({
      block: { id: "b1", config: { model_class: COUNTRY_MODEL, limit: 5 } },
    });

    await waitFor(() =>
      expect(screen.getByRole("button", { name: "2" })).toBeInTheDocument(),
    );
    await act(async () => {
      await user.click(screen.getByRole("button", { name: "2", exact: true }));
    });
    await waitFor(() =>
      expect(axiosPost).toHaveBeenLastCalledWith(
        "dashboard.quickList",
        expect.objectContaining({ page: 2 }),
      ),
    );

    await act(async () => {
      rerender(
        <QuickListBlock
          {...defaultProps}
          block={{
            id: "b1",
            config: { model_class: COUNTRY_MODEL, limit: 10 },
          }}
        />,
      );
    });

    await waitFor(() =>
      expect(axiosPost).toHaveBeenLastCalledWith(
        "dashboard.quickList",
        expect.objectContaining({ page: 1, limit: 10 }),
      ),
    );
  });
});

describe("QuickListBlock — BlockEditDialog (mode edit block)", () => {
  it("TIDAK dirender saat canEdit=false, walau editOpen=true", async () => {
    await renderSettled({ canEdit: false, editOpen: true });

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("terbuka dgn judul 'Edit Quick List', draft awal dari block.config", async () => {
    await renderSettled({
      canEdit: true,
      editOpen: true,
      block: {
        id: "b1",
        config: {
          label: "Sudah Ada",
          model_class: COUNTRY_MODEL,
          columns: ["code"],
        },
      },
    });

    expect(
      screen.getByRole("dialog", { name: "Edit Quick List" }),
    ).toBeInTheDocument();
    expect(screen.getByPlaceholderText("Label")).toHaveValue("Sudah Ada");
  });

  it.each([
    ["label kosong", {}, "Label wajib diisi."],
    ["model_class kosong", { label: "X" }, "Model wajib dipilih."],
  ])(
    "validate(draft): %s -> pesan error yang benar",
    async (_desc, config, expectedError) => {
      await renderSettled({
        canEdit: true,
        editOpen: true,
        block: { id: "b1", config },
      });

      expect(screen.getByText(expectedError)).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Terapkan" })).toBeDisabled();
    },
  );

  it("validate(draft): columns kosong -> pesan error (model tanpa kolom show:true, auto-fill tidak mengisi apa pun)", async () => {
    // Feedback user: draft.columns default TIDAK BOLEH cuma fallback runtime
    // -- validate() harus tetap memaksa user memilih manual kalau model tidak
    // punya satu pun kolom show:true utk di-auto-fill (lihat komentar
    // useEffect auto-fill di QuickListForm).
    mockColumnsResponses({
      [COUNTRY_MODEL]: {
        columns: [
          {
            name: "code",
            type: "string",
            title: "Kode",
            show: false,
            order: 0,
            sortable: true,
          },
          {
            name: "name",
            type: "string",
            title: "Nama",
            show: false,
            order: 1,
            sortable: true,
          },
        ],
        route: "countries",
      },
    });

    await renderSettled({
      canEdit: true,
      editOpen: true,
      block: {
        id: "b1",
        config: { label: "X", model_class: COUNTRY_MODEL, columns: [] },
      },
    });

    await waitFor(() =>
      expect(screen.getByTestId("column-order-picker")).toBeInTheDocument(),
    );
    expect(
      screen.getByText("Pilih minimal satu kolom untuk ditampilkan."),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Terapkan" })).toBeDisabled();
  });

  it("validate(draft): sort_by kosong -> pesan error (model tanpa kolom created_at, auto-fill tidak mengisi apa pun)", async () => {
    mockColumnsResponses({
      [COUNTRY_MODEL]: {
        columns: [
          {
            name: "code",
            type: "string",
            title: "Kode",
            show: true,
            order: 0,
            sortable: true,
          },
          {
            name: "name",
            type: "string",
            title: "Nama",
            show: true,
            order: 1,
            sortable: true,
          },
        ],
        route: "countries",
      },
    });

    await renderSettled({
      canEdit: true,
      editOpen: true,
      block: {
        id: "b1",
        config: { label: "X", model_class: COUNTRY_MODEL, columns: ["code"] },
      },
    });

    await waitFor(() =>
      expect(screen.getByTestId("column-order-picker")).toBeInTheDocument(),
    );
    expect(
      screen.getByText("Urutkan berdasarkan wajib diisi."),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Terapkan" })).toBeDisabled();
  });

  it("draft lengkap (label+model_class+columns+sort_by) -> tidak ada error, Terapkan aktif", async () => {
    await renderSettled({
      canEdit: true,
      editOpen: true,
      block: {
        id: "b1",
        config: {
          label: "Lengkap",
          model_class: COUNTRY_MODEL,
          columns: ["code"],
          sort_by: "code",
        },
      },
    });

    expect(screen.getByRole("button", { name: "Terapkan" })).not.toBeDisabled();
  });

  it("Terapkan -> onUpdate({...block, config: draft, isNew:false})", async () => {
    const user = userEvent.setup({ delay: null });
    const onUpdate = vi.fn();
    const onEditOpenChange = vi.fn();
    const block = {
      id: "b1",
      someOtherField: "keep-me",
      config: {
        label: "Lengkap",
        model_class: COUNTRY_MODEL,
        columns: ["code"],
        sort_by: "code",
      },
      isNew: true,
    };

    await renderSettled({
      canEdit: true,
      editOpen: true,
      onUpdate,
      onEditOpenChange,
      block,
    });

    await act(async () => {
      await user.click(screen.getByRole("button", { name: "Terapkan" }));
    });

    expect(onUpdate).toHaveBeenCalledWith({
      ...block,
      config: block.config,
      isNew: false,
    });
    expect(onEditOpenChange).toHaveBeenCalledWith(false);
  });

  it("Batal saat block baru (isNew:true) memanggil onDelete (onCancelNew), BUKAN onEditOpenChange", async () => {
    const user = userEvent.setup({ delay: null });
    const onDelete = vi.fn();
    const onEditOpenChange = vi.fn();

    await renderSettled({
      canEdit: true,
      editOpen: true,
      onDelete,
      onEditOpenChange,
      block: { id: "b1", config: { label: "X" }, isNew: true },
    });

    await user.click(screen.getByRole("button", { name: "Batal" }));

    expect(onDelete).toHaveBeenCalledTimes(1);
    expect(onEditOpenChange).not.toHaveBeenCalled();
  });
});

describe("QuickListForm — pemilihan Model (PermissionLinkModel)", () => {
  it("Bug (fixed): onValueChange(null) dari LinkModel diabaikan, TIDAK menghapus model_class yang sudah terisi", async () => {
    const user = userEvent.setup({ delay: null });
    await renderSettled({
      canEdit: true,
      editOpen: true,
      block: {
        id: "b1",
        config: {
          label: "X",
          model_class: COUNTRY_MODEL,
          model: { id: 1, model: COUNTRY_MODEL },
          columns: ["code"],
          sort_by: "code",
        },
      },
    });

    expect(screen.getByTestId("plm-value")).toHaveTextContent(COUNTRY_MODEL);
    expect(screen.queryByText("Model wajib dipilih.")).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "pilih-model-null" }));

    // Masih model lama -- dialog TIDAK tiba-tiba invalid krn model_class
    // ditimpa null.
    expect(screen.getByTestId("plm-value")).toHaveTextContent(COUNTRY_MODEL);
    expect(screen.queryByText("Model wajib dipilih.")).not.toBeInTheDocument();
  });

  it("memilih model baru -> patchDraft model/model_id/model_class + columns direset ke []", async () => {
    const user = userEvent.setup({ delay: null });
    mockColumnsResponses({
      [COUNTRY_MODEL]: { columns: countryColumns, route: "countries" },
      [REGION_MODEL]: { columns: [], route: null },
    });
    await renderSettled({
      canEdit: true,
      editOpen: true,
      block: {
        id: "b1",
        config: {
          label: "X",
          model_class: COUNTRY_MODEL,
          model: { id: 1, model: COUNTRY_MODEL },
          columns: ["code", "name"],
          sort_by: "code",
        },
      },
    });

    await waitFor(() =>
      expect(screen.getByTestId("cop-value")).toHaveTextContent(
        JSON.stringify(["code", "name"]),
      ),
    );

    await act(async () => {
      await user.click(
        screen.getByRole("button", { name: "pilih-model-region" }),
      );
    });

    expect(screen.getByTestId("plm-value")).toHaveTextContent(REGION_MODEL);
    // Model wajib dipilih lagi krn columns kosong pasca ganti model.
    expect(
      screen.getByText("Pilih minimal satu kolom untuk ditampilkan."),
    ).toBeInTheDocument();
  });
});

describe("QuickListForm — loading kolom & tampil ColumnOrderPicker/FilterTable2", () => {
  it("indikator 'Memuat kolom model...' tampil selama isLoadingColumns, ColumnOrderPicker & FilterTable2 belum dirender", async () => {
    let resolveGetColumns;
    axiosGet.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveGetColumns = resolve;
        }),
    );

    await renderSettled({
      canEdit: true,
      editOpen: true,
      block: { id: "b1", config: { label: "X", model_class: COUNTRY_MODEL } },
    });

    expect(screen.getByText("Memuat kolom model...")).toBeInTheDocument();
    expect(screen.queryByTestId("column-order-picker")).not.toBeInTheDocument();
    expect(screen.queryByTestId("filter-table2")).not.toBeInTheDocument();

    await act(async () => {
      resolveGetColumns({
        data: { columns: countryColumns, route: "countries" },
      });
    });

    await waitFor(() =>
      expect(
        screen.queryByText("Memuat kolom model..."),
      ).not.toBeInTheDocument(),
    );
    expect(screen.getByTestId("column-order-picker")).toBeInTheDocument();
    expect(screen.getByTestId("filter-table2")).toBeInTheDocument();
  });
});

describe("QuickListForm — auto-fill kolom default & sort_by", () => {
  it("draft.columns kosong -> terisi otomatis kolom show:true terurut by `order` (code, name)", async () => {
    await renderSettled({
      canEdit: true,
      editOpen: true,
      block: { id: "b1", config: { label: "X", model_class: COUNTRY_MODEL } },
    });

    await waitFor(() =>
      expect(screen.getByTestId("cop-value")).toHaveTextContent(
        JSON.stringify(["code", "name"]),
      ),
    );
  });

  it("draft.sort_by kosong & model punya kolom created_at -> auto-fill 'created_at'", async () => {
    await renderSettled({
      canEdit: true,
      editOpen: true,
      block: { id: "b1", config: { label: "X", model_class: COUNTRY_MODEL } },
    });

    await waitFor(() => {
      const selects = screen.getAllByTestId("select");
      const sortBySelect = selects[0];
      expect(sortBySelect).toHaveValue("created_at");
    });
  });

  it("draft.columns yang SUDAH diisi user TIDAK ditimpa auto-fill", async () => {
    await renderSettled({
      canEdit: true,
      editOpen: true,
      block: {
        id: "b1",
        config: {
          label: "X",
          model_class: COUNTRY_MODEL,
          columns: ["lang_code"],
          sort_by: "code",
        },
      },
    });

    await waitFor(() =>
      expect(screen.getByTestId("cop-value")).toHaveTextContent(
        JSON.stringify(["lang_code"]),
      ),
    );
  });
});

describe("QuickListForm — Select sort_by/sort_direction & Input limit", () => {
  it("opsi sort_by hanya kolom sortable!==false (region relasi tidak sortable, disaring)", async () => {
    await renderSettled({
      canEdit: true,
      editOpen: true,
      block: {
        id: "b1",
        config: { label: "X", model_class: COUNTRY_MODEL, columns: ["code"] },
      },
    });

    await waitFor(() =>
      expect(screen.getAllByTestId("select")).toHaveLength(2),
    );
    const sortBySelect = screen.getAllByTestId("select")[0];
    const optionLabels = within(sortBySelect)
      .getAllByRole("option")
      .map((o) => o.textContent);

    expect(optionLabels).toEqual(
      expect.arrayContaining(["Kode", "Nama", "Kode Bahasa", "Dibuat"]),
    );
    expect(optionLabels).not.toContain("Wilayah");
  });

  it("Input limit default 5, ubah nilai memperbarui draft (dites via payload akhir)", async () => {
    const user = userEvent.setup({ delay: null });
    const onUpdate = vi.fn();
    await renderSettled({
      canEdit: true,
      editOpen: true,
      onUpdate,
      block: {
        id: "b1",
        config: {
          label: "X",
          model_class: COUNTRY_MODEL,
          columns: ["code"],
          sort_by: "code",
        },
      },
    });

    // Bukan clear()+type(): value input dikontrol draft.limit yang punya
    // fallback `Number(e.target.value) || 5` -- clear() sendiri sudah memicu
    // onChange("") -> patchDraft({limit: 5}), langsung membuat value balik
    // ke "5" sebelum sempat kosong, sehingga type("8") berikutnya numpuk jadi
    // "58". tripleClick memilih seluruh teks dulu, keyboard("8") mengganti
    // seleksi (bukan menambah).
    const limitInput = screen.getByDisplayValue("5");
    await user.tripleClick(limitInput);
    await user.keyboard("8");

    await user.click(screen.getByRole("button", { name: "Terapkan" }));

    expect(onUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        config: expect.objectContaining({ limit: 8 }),
      }),
    );
  });

  it("Input limit dikosongkan -> fallback ke 5 (Number('') || 5)", async () => {
    const user = userEvent.setup({ delay: null });
    const onUpdate = vi.fn();
    await renderSettled({
      canEdit: true,
      editOpen: true,
      onUpdate,
      block: {
        id: "b1",
        config: {
          label: "X",
          model_class: COUNTRY_MODEL,
          columns: ["code"],
          sort_by: "code",
          limit: 12,
        },
      },
    });

    const limitInput = screen.getByDisplayValue("12");
    await user.clear(limitInput);
    await user.click(screen.getByRole("button", { name: "Terapkan" }));

    expect(onUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        config: expect.objectContaining({ limit: 5 }),
      }),
    );
  });
});

describe("QuickListForm — FilterTable2 wiring", () => {
  it("meneruskan columns/model/initialFilters, onApply -> patchDraft({filters: tree})", async () => {
    const user = userEvent.setup({ delay: null });
    const onUpdate = vi.fn();
    const initialFilters = {
      root: { c: { a0: { k: "code", o: "=", v: "ID" } } },
    };
    await renderSettled({
      canEdit: true,
      editOpen: true,
      onUpdate,
      block: {
        id: "b1",
        config: {
          label: "X",
          model_class: COUNTRY_MODEL,
          columns: ["code"],
          sort_by: "code",
          filters: initialFilters,
        },
      },
    });

    await waitFor(() =>
      expect(screen.getByTestId("ft2-model")).toHaveTextContent(COUNTRY_MODEL),
    );
    expect(screen.getByTestId("ft2-initial")).toHaveTextContent(
      JSON.stringify(initialFilters),
    );

    await user.click(screen.getByRole("button", { name: "terapkan-filter" }));
    await user.click(screen.getByRole("button", { name: "Terapkan" }));

    expect(onUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        config: expect.objectContaining({
          filters: { root: { c: { a1: { k: "code", o: "=", v: "ID" } } } },
        }),
      }),
    );
  });
});

describe("QuickListForm — alur lengkap Label/Icon/Deskripsi", () => {
  it("mengisi Label, pilih Icon, ubah Deskripsi, lalu Terapkan -> onUpdate dgn config final", async () => {
    const user = userEvent.setup({ delay: null });
    const onUpdate = vi.fn();
    await renderSettled({
      canEdit: true,
      editOpen: true,
      onUpdate,
      block: {
        id: "b1",
        config: {
          model_class: COUNTRY_MODEL,
          columns: ["code"],
          sort_by: "code",
        },
      },
    });

    await user.type(screen.getByPlaceholderText("Label"), "Negara Terbaru");
    await user.click(screen.getByRole("button", { name: "pilih-icon" }));
    await user.click(screen.getByRole("button", { name: "ubah-deskripsi" }));
    await user.click(screen.getByRole("button", { name: "Terapkan" }));

    expect(onUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        config: expect.objectContaining({
          label: "Negara Terbaru",
          icon: "RocketIcon",
          description: { json: { type: "doc" }, html: "<p>Deskripsi baru</p>" },
        }),
        isNew: false,
      }),
    );
  });
});
