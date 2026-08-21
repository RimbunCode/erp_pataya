import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createContext, useContext, useState } from "react";

// ============================================================================
// Form.jsx (Inventory/Items) adalah form master data Item (734 baris) yang
// dibungkus <FormPageContent>/useFormPage dari @/Pages/Core/FormPage. Logic
// UNIK di file ini adalah manajemen UOM (uoms) -- normalisasi group unit,
// sinkronisasi otomatis dari default_unit, dan penggabungan/penyaringan uoms
// saat FormTable berubah -- serta computed list mention untuk format varian
// dan ringkasan varian (VariantsSummary, checkbox indeterminate).
//
// Semua komponen anak yang SUDAH/AKAN punya test sendiri (FormDetail,
// FormBarcodes, FormStockLevels, FormTable, MultiSelect, Link) di-stub agar
// test ini fokus ke logic milik Form.jsx sendiri: getUnits/handleItemUomsChange
// /ensureDefaultGlobalUom/listFormatVariant/VariantsSummary. FormTable di-stub
// sebagai tombol yang memanggil onValueChange dengan payload terkontrol dari
// test, supaya perilaku Form.jsx terhadap perubahan uoms/attributes bisa
// diuji tanpa merender internal FormTable (2000+ baris, scope terlalu besar).
//
// CATATAN PENTING soal memo(): Form diekspor sebagai `memo(function Form())`
// TANPA props sama sekali. Di produksi, useFormPage() dibaca dari React
// Context asli -- context propagation BYPASS bail-out memo (React tetap
// me-render ulang consumer meski parent tidak mengirim props baru). Supaya
// perilaku "Form bereaksi ke perubahan data setelah mount" (getUnits, dsb)
// bisa diuji dalam mounted instance yang sama, useFormPage di sini
// diimplementasikan lewat Context asli (bukan vi.fn().mockReturnValue yang
// tidak reaktif), dan renderForm() selalu membungkus <Form/> dengan Provider.
// ============================================================================

const stableT = (key) => key;
vi.mock("laravel-react-i18n", () => ({
  useLaravelReactI18n: () => ({ t: stableT }),
}));

const usePageMock = vi.fn();
vi.mock("@inertiajs/react", () => ({
  usePage: () => usePageMock(),
  // WhenVisible dirender langsung sebagai children -- fallback loading bukan
  // concern test ini (VariantsSummary sudah diuji terpisah lewat isinya).
  WhenVisible: ({ children }) => children,
}));

const FormPageTestContext = createContext(undefined);
vi.mock("@/Pages/Core/FormPage", () => ({
  useFormPage: () => useContext(FormPageTestContext),
  FormPageContent: ({ title, show = true, children }) =>
    show ? (
      <section data-testid="form-page-content" data-title={title}>
        {children}
      </section>
    ) : null,
  FormPageContentTitle: ({ children }) => <h3>{children}</h3>,
}));

vi.mock("@/Components/Mention", () => ({
  Mention: () => null,
  MentionsInput: ({ value, onChange, placeholder }) => (
    <input
      aria-label="format-variant"
      placeholder={placeholder}
      value={value ?? ""}
      onChange={(e) => onChange?.(e, e.target.value, e.target.value, [])}
    />
  ),
}));

// FormInput asli membutuhkan useFormPageMeta/useCanUpdate (context lain di
// FormPage.jsx yang tidak ikut di-mock di sini) -- di-stub sebagai
// pass-through sederhana karena bukan fokus test ini (satu-satunya
// pemakaian di Form.jsx adalah membungkus MentionsInput format_variant).
vi.mock("@/Components/FormInput", () => ({
  default: ({ label, children }) => (
    <div>
      <span>{label}</span>
      {children}
    </div>
  ),
}));

vi.mock("../Attributes/AttributeLinkModel", () => ({
  default: () => <div data-testid="attribute-link-model" />,
}));
vi.mock("../Units/UnitLinkModel", () => ({
  default: () => <div data-testid="unit-link-model" />,
}));
vi.mock("@/Components/MultiSelect", () => ({
  default: () => <div data-testid="multi-select" />,
}));
vi.mock("@/Components/Link", () => ({
  default: ({ href, children }) => <a href={href}>{children}</a>,
}));
vi.mock("@/Components/LoadingIcon", () => ({
  default: () => <span data-testid="loading-icon" />,
}));

vi.mock("./FormDetail", () => ({
  default: () => <div data-testid="form-detail" />,
}));
vi.mock("./FormBarcodes", () => ({
  default: (props) => (
    <div
      data-testid="form-barcodes"
      data-uoms={JSON.stringify(props.uoms)}
      data-barcodes={JSON.stringify(props.barcodes)}
    />
  ),
}));
vi.mock("./FormStockLevels", () => ({
  default: () => <div data-testid="form-stock-levels" />,
}));

// FormTable di-stub sebagai kotak yang menampilkan `value` sebagai JSON dan
// menyediakan tombol untuk memicu onValueChange dengan payload yang
// disuntikkan test lewat window.__formTablePayloads (dikeyed oleh `name`).
window.__formTablePayloads = {};
vi.mock("@/Components/FormTable", () => ({
  default: ({ name, value, onValueChange, disabled }) => (
    <div data-testid={`form-table-${name}`}>
      <span data-testid={`form-table-${name}-value`}>
        {JSON.stringify(value)}
      </span>
      <button
        type="button"
        disabled={disabled}
        onClick={() =>
          onValueChange?.(window.__formTablePayloads?.[name] ?? [])
        }
      >
        trigger-{name}
      </button>
    </div>
  ),
}));

const axiosPost = vi.fn();
vi.mock("axios", () => ({
  default: { post: (...a) => axiosPost(...a) },
}));

window.route = (name, params) =>
  params ? `${name}/${JSON.stringify(params)}` : name;

import Form from "./Form";

function makeUnit(overrides = {}) {
  return {
    id: 1,
    code: "PCS",
    name: "Pieces",
    group: null,
    conversion_factor: null,
    ...overrides,
  };
}

/**
 * Render Form dengan useFormPage() STATIS (setData = vi.fn(), tidak
 * memperbarui data). Cocok untuk skenario "kondisi awal saat mount" --
 * bukan untuk menguji efek yang butuh Form re-render dalam mounted
 * instance yang sama (pakai renderFormStateful untuk itu).
 */
function renderForm({
  data = {},
  item = null,
  variants = null,
  disabled = false,
} = {}) {
  const setData = vi.fn();
  usePageMock.mockReturnValue({ props: { item, variants } });
  const value = { dataBefore: {}, data, setData, disabled };
  const utils = render(
    <FormPageTestContext.Provider value={value}>
      <Form />
    </FormPageTestContext.Provider>,
  );
  return { ...utils, setData };
}

/**
 * Render Form dengan useFormPage() STATEFUL sungguhan (useState di
 * wrapper) -- setData yang dipanggil Form.jsx sendiri (mis. dari
 * handleItemUomsChange) ATAU dipanggil langsung dari test lewat
 * setExternalData (mensimulasikan field lain seperti FormDetail yang
 * di-stub, mis. mengubah default_unit) betul-betul memperbarui data dan
 * memicu re-render Form lewat context propagation (bypass bail-out memo).
 * Mengembalikan getData() untuk membaca data terkini dan setExternalData()
 * untuk memicu perubahan data dari luar seolah field lain yang mengubahnya.
 */
function renderFormStateful({ data: initialData = {}, item = null, variants = null }) {
  usePageMock.mockReturnValue({ props: { item, variants } });
  let latestData = initialData;
  let externalSetData = null;

  function Wrapper() {
    const [data, setDataState] = useState(initialData);
    latestData = data;
    const setData = (...args) => {
      if (typeof args[0] === "function") {
        setDataState((prev) => args[0](prev));
      } else if (typeof args[0] === "string") {
        setDataState((prev) => ({ ...prev, [args[0]]: args[1] }));
      } else {
        setDataState((prev) => ({ ...prev, ...args[0] }));
      }
    };
    externalSetData = setData;
    const value = { dataBefore: {}, data, setData, disabled: false };
    return (
      <FormPageTestContext.Provider value={value}>
        <Form />
      </FormPageTestContext.Provider>
    );
  }

  const utils = render(<Wrapper />);
  return {
    ...utils,
    getData: () => latestData,
    setExternalData: (...args) => externalSetData(...args),
  };
}

describe("Inventory/Items Form", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.__formTablePayloads = {};
    axiosPost.mockReset();
    axiosPost.mockResolvedValue({ data: { data: [] } });
  });

  describe("rendering dasar & kondisi tampil", () => {
    it("merender FormDetail, FormBarcodes, dan tabel UOM", () => {
      renderForm({ data: { uoms: [], attributes: [] } });

      expect(screen.getByTestId("form-detail")).toBeInTheDocument();
      expect(screen.getByTestId("form-barcodes")).toBeInTheDocument();
      expect(screen.getByTestId("form-table-ItemUoms")).toBeInTheDocument();
    });

    it("tidak merender FormStockLevels ketika item null", () => {
      renderForm({ data: {}, item: null });

      expect(
        screen.queryByTestId("form-stock-levels"),
      ).not.toBeInTheDocument();
    });

    it("merender FormStockLevels ketika item ada, tanpa attributes, dan form tidak disabled", () => {
      renderForm({ data: {}, item: { id: 1, code: "ITM-1" }, disabled: false });

      expect(screen.getByTestId("form-stock-levels")).toBeInTheDocument();
    });

    it("tidak merender FormStockLevels ketika item punya attributes (varian)", () => {
      renderForm({
        data: {},
        item: { id: 1, code: "ITM-1", attributes: [{ id: 1 }] },
        disabled: false,
      });

      expect(
        screen.queryByTestId("form-stock-levels"),
      ).not.toBeInTheDocument();
    });

    it("tidak merender FormStockLevels ketika form disabled", () => {
      renderForm({ data: {}, item: { id: 1, code: "ITM-1" }, disabled: true });

      expect(
        screen.queryByTestId("form-stock-levels"),
      ).not.toBeInTheDocument();
    });

    it("section Variants disembunyikan ketika category.type == 'service'", () => {
      renderForm({ data: { category: { type: "service" }, attributes: [] } });

      const sections = screen.queryAllByTestId("form-page-content");
      const variantSection = sections.find(
        (el) => el.dataset.title === "inventory.item.menu.variants",
      );
      expect(variantSection).toBeUndefined();
    });

    it("format_variant MentionsInput tidak tampil ketika data.attributes kosong", () => {
      renderForm({ data: { attributes: [] } });

      expect(
        screen.queryByLabelText("format-variant"),
      ).not.toBeInTheDocument();
    });

    it("format_variant MentionsInput tampil ketika data.attributes terisi", () => {
      renderForm({
        data: {
          attributes: [
            { attribute: { id: 9, name: "Warna" }, values: ["Merah"] },
          ],
        },
      });

      expect(screen.getByLabelText("format-variant")).toBeInTheDocument();
    });
  });

  describe("VariantsSummary", () => {
    it("tidak merender apapun ketika variants kosong/null", () => {
      renderForm({ data: {}, variants: [] });

      expect(
        screen.queryByText("inventory.item.columns.sku"),
      ).not.toBeInTheDocument();
    });

    it("merender baris variant dengan link ke itemVariants.show ketika variant punya code", () => {
      renderForm({
        data: {},
        item: { code: "ITEM-BASE" },
        variants: [
          {
            id: 11,
            code: "ITEM-BASE-RED",
            allow_alternative_item: true,
            disabled: false,
            total_stock: 5,
          },
        ],
      });

      const link = screen.getByRole("link", { name: "ITEM-BASE-RED" });
      expect(link).toHaveAttribute(
        "href",
        expect.stringContaining("itemVariants.show"),
      );
      expect(screen.getByText("5")).toBeInTheDocument();
    });

    it("variant tanpa code menampilkan itemCode sebagai teks polos (bukan link)", () => {
      renderForm({
        data: {},
        item: { code: "ITEM-BASE" },
        variants: [
          {
            id: 12,
            code: null,
            allow_alternative_item: false,
            disabled: true,
            total_stock: 0,
          },
        ],
      });

      expect(screen.queryByRole("link")).not.toBeInTheDocument();
      expect(screen.getByText("ITEM-BASE")).toBeInTheDocument();
    });

    it("allow_alternative_item null menghasilkan checkbox indeterminate", () => {
      renderForm({
        data: {},
        item: { code: "ITEM-BASE" },
        variants: [
          {
            id: 13,
            code: "V-13",
            allow_alternative_item: null,
            disabled: false,
            total_stock: 1,
          },
        ],
      });

      const checkboxes = document.querySelectorAll('[role="forminput"]');
      // Checkbox pertama = allow_alternative_item -> indeterminate.
      expect(checkboxes[0]).toHaveAttribute("data-state", "indeterminate");
    });

    it("allow_alternative_item true menghasilkan checkbox checked", () => {
      renderForm({
        data: {},
        item: { code: "ITEM-BASE" },
        variants: [
          {
            id: 14,
            code: "V-14",
            allow_alternative_item: true,
            disabled: false,
            total_stock: 1,
          },
        ],
      });

      const checkboxes = document.querySelectorAll('[role="forminput"]');
      expect(checkboxes[0]).toHaveAttribute("data-state", "checked");
    });

    it("disabled false pada variant menghasilkan checkbox kedua checked (is_disabled.parse.false)", () => {
      renderForm({
        data: {},
        item: { code: "ITEM-BASE" },
        variants: [
          {
            id: 15,
            code: "V-15",
            allow_alternative_item: false,
            disabled: false,
            total_stock: 1,
          },
        ],
      });

      const checkboxes = document.querySelectorAll('[role="forminput"]');
      // Checkbox kedua = representasi "tidak disabled" (checked saat disabled===false).
      expect(checkboxes[1]).toHaveAttribute("data-state", "checked");
    });
  });

  describe("handleItemUomsChange (via tabel UOM)", () => {
    it("meneruskan uoms baru apa adanya ketika tidak ada grup non-Others ganda maupun unit generated yang hilang", async () => {
      const user = userEvent.setup({ delay: null });
      const { setData } = renderForm({ data: { uoms: [], attributes: [] } });
      window.__formTablePayloads.ItemUoms = [
        makeUnit({ id: 2, group: "Weight", conversion_factor: 1 }),
      ];

      await user.click(
        screen.getByRole("button", { name: "trigger-ItemUoms" }),
      );

      expect(setData).toHaveBeenCalledWith(
        "uoms",
        expect.arrayContaining([expect.objectContaining({ id: 2 })]),
      );
    });

    it("menyaring uoms agar hanya satu grup non-Others yang tersisa (enforceSingleNonOthersGroup)", async () => {
      const user = userEvent.setup({ delay: null });
      const { setData } = renderForm({ data: { uoms: [], attributes: [] } });
      window.__formTablePayloads.ItemUoms = [
        makeUnit({ id: 2, group: "Weight", conversion_factor: 1 }),
        makeUnit({ id: 3, group: "Length", conversion_factor: 1 }),
      ];

      await user.click(
        screen.getByRole("button", { name: "trigger-ItemUoms" }),
      );

      const [, nextUoms] = setData.mock.calls.at(-1);
      const groups = nextUoms.map((u) => u.group);
      // Hanya grup pertama (Weight) yang dipertahankan, Length dibuang.
      expect(groups).toContain("Weight");
      expect(groups).not.toContain("Length");
    });

    it("mengembalikan unit generated (generatedByDefaultUnit) yang terhapus dari payload FormTable, meski unit custom lain juga dihapus", async () => {
      const user = userEvent.setup({ delay: null });
      const generatedUnit = makeUnit({
        id: 99,
        group: null,
        generatedByDefaultUnit: true,
        readOnly: true,
      });
      const customUnit = makeUnit({
        id: 42,
        group: "Weight",
        conversion_factor: 1,
        isManual: true,
      });
      const { setData } = renderForm({
        data: {
          uoms: [generatedUnit, customUnit],
          attributes: [],
          default_unit: makeUnit({ id: 99, group: null }),
        },
      });
      // Payload dari FormTable menghapus KEDUA unit (generated & custom) --
      // simulasi user menghapus baris custom lewat UI tabel. Karena hasil
      // akhirnya berbeda dari currentUomsRef awal (customUnit hilang),
      // setUomsSafely tidak short-circuit dan setData terpanggil; unit
      // generated (id 99) tetap harus dikembalikan otomatis.
      window.__formTablePayloads.ItemUoms = [];

      await user.click(
        screen.getByRole("button", { name: "trigger-ItemUoms" }),
      );

      expect(setData).toHaveBeenCalled();
      const [, nextUoms] = setData.mock.calls.at(-1);
      expect(nextUoms.some((u) => u.id === 99)).toBe(true);
      expect(nextUoms.some((u) => u.id === 42)).toBe(false);
    });
  });

  describe("sinkronisasi default_unit -> uoms (getUnits + useDidMountEffect)", () => {
    it("tidak memicu apapun pada render pertama (useDidMountEffect skip mount)", () => {
      renderForm({
        data: {
          uoms: [],
          attributes: [],
          default_unit: makeUnit({ id: 7, group: "Weight" }),
        },
      });

      expect(axiosPost).not.toHaveBeenCalled();
    });

    it("default_unit berubah (punya group) setelah mount memicu axios.post ke route('model') dengan filter group yang benar", async () => {
      axiosPost.mockResolvedValue({
        data: {
          data: [makeUnit({ id: 5, group: "Weight", conversion_factor: 1 })],
        },
      });
      const { setExternalData } = renderFormStateful({
        data: { uoms: [], attributes: [], default_unit: null },
      });
      expect(axiosPost).not.toHaveBeenCalled();

      // Simulasikan field default_unit berubah (di form asli ini dilakukan
      // lewat FormDetail/UnitLinkModel yang di-stub) dengan memanggil
      // setData langsung -- ini memicu re-render Form dalam mounted
      // instance yang sama lewat context, sehingga useDidMountEffect (yang
      // sudah lewat mount pertama) fire.
      setExternalData("default_unit", makeUnit({ id: 5, group: "Weight" }));

      await waitFor(() => expect(axiosPost).toHaveBeenCalled());
      expect(axiosPost).toHaveBeenCalledWith(
        "model",
        expect.objectContaining({
          model: "App\\Models\\Inventory\\Unit",
          filters: { group: "Weight" },
        }),
      );
    });

    it("default_unit berubah tanpa group (Others) TIDAK memicu axios.post, langsung set uom tunggal dari default_unit", async () => {
      const { setExternalData, getData } = renderFormStateful({
        data: { uoms: [], attributes: [], default_unit: null },
      });

      setExternalData("default_unit", makeUnit({ id: 6, group: "Others" }));

      await waitFor(() =>
        expect(getData().uoms.some((u) => u.id === 6)).toBe(true),
      );
      expect(axiosPost).not.toHaveBeenCalled();
    });
  });
});
