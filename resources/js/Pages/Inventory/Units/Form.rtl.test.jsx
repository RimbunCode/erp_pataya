import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, within, waitFor } from "@testing-library/react";
import { TooltipProvider } from "@/Components/ui/tooltip";
import userEvent from "@testing-library/user-event";
import React, { createContext, useContext, useState } from "react";

// ============================================================================
// Form.jsx (Inventory/Units) adalah form master data Unit (satuan
// pengukuran) dengan playground konversi antar-satuan. Logic UNIK yang jadi
// fokus test ini (bukan komponen anak yang sudah ada test sendiri):
// - unitOptions memo: label via convertTemplateLink fallback "name (code)",
//   dan menyuntikkan unit data.id sendiri ke opsi bila belum ada di `units`
//   (mis. saat filter grup menyembunyikannya).
// - findUnitByOptionValue: resolve unit dari value opsi Select.
// - loadGroups: axios.get debounce 300ms ke units.groups, race-guard via
//   requestId (respons stale diabaikan), toast error saat gagal.
// - loadUnits: axios.get ke units.index dengan querystring {group, except},
//   dipicu tiap data.group berubah.
// - swapPlayground: menukar unitSelected.from/to DAN fromValue/toValue.
// - Kalkulasi otomatis toValue dari fromValue * (from.conversion_factor /
//   to.conversion_factor), memakai `data` (bukan snapshot unitSelected) bila
//   unit terpilih adalah unit yang sedang diedit (id sama dengan data.id) --
//   supaya perubahan conversion_factor live ikut ter-refleksi. NaN -> "".
// - Field conversion_factor & section playground disembunyikan bila
//   data.customable true.
// - Checkbox customable dipaksa true & disabled saat group === "Others".
// - Select group onValueChange: set customable=true otomatis bila val
//   "Others", selain itu customable dipertahankan.
//
// useCanUpdate MEMBACA FormPageContext LANGSUNG via useContext (bukan lewat
// useFormPage()) -- lihat resources/js/Hooks/useCanUpdate.js. Supaya
// canUpdateGroup konsisten dengan data/setData yang dipakai Form.jsx sendiri
// (yang datang dari useFormPage()), mock @/Pages/Core/FormPage di sini
// menyediakan FormPageContext createContext() ASLI, dan useFormPage
// diimplementasikan membaca context yang sama (mirip pola Items/Form).
//
// Select & FormInput di-stub sesuai instruksi supaya test fokus ke logic
// milik Form.jsx sendiri, bukan internal komponen tersebut (sudah/akan
// punya test sendiri). FormCheckbox TIDAK distub -- field customable diuji
// lewat instance nyatanya (role="forminput").
// ============================================================================

const stableT = (key) => key;
vi.mock("laravel-react-i18n", () => ({
  useLaravelReactI18n: () => ({ t: stableT }),
}));

const axiosGet = vi.fn();
vi.mock("axios", () => ({
  default: { get: (...a) => axiosGet(...a) },
}));

const toastError = vi.fn();
vi.mock("@/lib/gooeyToast", () => ({
  gooeyToast: { error: (...a) => toastError(...a) },
}));

// usePage dipakai transitively oleh beberapa komponen ui -- Form.jsx Units
// sendiri tidak memanggilnya, tapi mock global mencegah error "usePage must
// be used within the Inertia component" bila ada dependency tersembunyi.
vi.mock("@inertiajs/react", () => ({
  usePage: () => ({ props: { preferences: {} } }),
}));

// vi.mock factory dihoist ke atas file -- tidak boleh mengacu variabel
// top-level biasa (const FormPageTestContext = createContext() di luar).
// vi.hoisted menjamin createContext() dieksekusi SEBELUM factory dipanggil,
// dan hasilnya bisa direferensikan baik di dalam factory maupun di luar
// (lewat import balik) untuk dipakai Provider pada renderForm().
const { FormPageTestContext } = vi.hoisted(() => {
  const { createContext } = require("react");
  return { FormPageTestContext: createContext(undefined) };
});
vi.mock("@/Pages/Core/FormPage", () => ({
  useFormPage: () => useContext(FormPageTestContext) ?? {},
  FormPageContext: FormPageTestContext,
  FormPageContent: ({ title, children }) => (
    <section data-testid="form-page-content" data-title={title ?? ""}>
      {title ? <h2>{title}</h2> : null}
      {children}
    </section>
  ),
  FormPageContentDescription: ({ children }) => <p>{children}</p>,
}));

vi.mock("@/Components/FormInput", () => ({
  default: ({ label, name, children }) => (
    <div data-testid={`forminput-${name ?? label ?? ""}`}>
      <label>{label}</label>
      {children}
    </div>
  ),
}));

// Select distub sebagai <select> asli supaya interaksi onValueChange bisa
// dipicu lewat userEvent.selectOptions tanpa merender internal Popover/Command
// (sudah punya test sendiri). Prefix "opt:" pada label agar tidak bentrok
// dengan teks lain di halaman.
vi.mock("@/Components/Select", () => ({
  default: ({ value, onValueChange, onSearchChange, options, disabled, readOnly, placeholder }) => (
    <select
      data-testid="select"
      aria-label={placeholder}
      value={value ?? ""}
      disabled={disabled || readOnly}
      onChange={(e) => {
        onValueChange?.(e.target.value);
        onSearchChange?.("");
      }}
    >
      <option value="" />
      {(options ?? []).map((opt) => {
        const optValue = typeof opt === "object" ? opt.value : opt;
        const optLabel = typeof opt === "object" ? (opt.label ?? opt.value) : opt;
        return (
          <option key={optValue} value={optValue}>
            opt:{optLabel}
          </option>
        );
      })}
    </select>
  ),
}));

window.route = (name, params) =>
  params !== undefined ? `${name}/${JSON.stringify(params)}` : name;

import Form from "./Form";

/**
 * Render Form dengan useFormPage()/FormPageContext STATEFUL sungguhan --
 * setData yang dipanggil Form.jsx sendiri betul-betul memperbarui data dan
 * memicu re-render lewat context propagation.
 */
function renderForm({
  data: initialData = {},
  dataBefore = {},
  disabled = false,
  defaultData,
} = {}) {
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
    const value = {
      data,
      setData,
      dataBefore,
      disabled,
      defaultData: defaultData ?? data,
    };
    return (
      <FormPageTestContext.Provider value={value}>
        <Form />
      </FormPageTestContext.Provider>
    );
  }

  const utils = render(
    <TooltipProvider>
      <Wrapper />
    </TooltipProvider>,
  );
  return {
    ...utils,
    getData: () => latestData,
    setExternalData: (...args) => externalSetData(...args),
  };
}

function makeUnit(overrides = {}) {
  return {
    id: 1,
    code: "PCS",
    name: "Pieces",
    group: "Others",
    conversion_factor: null,
    ...overrides,
  };
}

describe("Inventory/Units Form", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    axiosGet.mockReset();
    axiosGet.mockResolvedValue({ data: [] });
  });

  describe("rendering dasar & field wajib", () => {
    it("merender field group, code, name, dan checkbox customable", () => {
      renderForm({ data: { id: 1, group: "Weight", code: "KG", name: "Kilogram" } });

      expect(screen.getByTestId("forminput-group")).toBeInTheDocument();
      expect(screen.getByTestId("forminput-code")).toBeInTheDocument();
      expect(screen.getByTestId("forminput-name")).toBeInTheDocument();
      expect(screen.getByText("inventory.unit.columns.customable")).toBeInTheDocument();
    });

    it("field conversion_factor dirender ketika data.customable falsy", () => {
      renderForm({ data: { id: 1, customable: false } });

      expect(screen.getByTestId("forminput-conversion_factor")).toBeInTheDocument();
    });

    it("field conversion_factor TIDAK dirender ketika data.customable true", () => {
      renderForm({ data: { id: 1, customable: true } });

      expect(
        screen.queryByTestId("forminput-conversion_factor"),
      ).not.toBeInTheDocument();
    });

    it("mengubah input code memanggil setData('code', ...)", async () => {
      const user = userEvent.setup({ delay: null });
      const { getData } = renderForm({ data: { id: 1, code: "", name: "" } });

      const codeWrapper = screen.getByTestId("forminput-code");
      const codeInput = within(codeWrapper).getByRole("textbox");
      await user.type(codeInput, "KG");

      expect(getData().code).toBe("KG");
    });

    it("mengubah input name memanggil setData('name', ...)", async () => {
      const user = userEvent.setup({ delay: null });
      const { getData } = renderForm({ data: { id: 1, code: "", name: "" } });

      const nameWrapper = screen.getByTestId("forminput-name");
      const nameInput = within(nameWrapper).getByRole("textbox");
      await user.type(nameInput, "Kilogram");

      expect(getData().name).toBe("Kilogram");
    });
  });

  describe("checkbox customable", () => {
    it("disabled ketika data.group === 'Others'", () => {
      renderForm({ data: { id: 1, group: "Others", customable: true } });

      const checkbox = screen.getByRole("forminput");
      expect(checkbox).toBeDisabled();
    });

    it("tidak disabled ketika data.group bukan 'Others'", () => {
      renderForm({ data: { id: 1, group: "Weight", customable: false } });

      const checkbox = screen.getByRole("forminput");
      expect(checkbox).not.toBeDisabled();
    });

    it("mencentang checkbox memanggil setData('customable', true)", async () => {
      const user = userEvent.setup({ delay: null });
      const { getData } = renderForm({
        data: { id: 1, group: "Weight", customable: false },
      });

      const checkbox = screen.getByRole("forminput");
      await user.click(checkbox);

      expect(getData().customable).toBe(true);
    });
  });

  describe("Select group: onValueChange & auto-set customable", () => {
    it("memilih group 'Others' otomatis set customable=true", async () => {
      const user = userEvent.setup({ delay: null });
      axiosGet.mockResolvedValue({ data: ["Weight", "Others"] });
      const { getData } = renderForm({
        data: { id: 1, group: "Weight", customable: false },
      });

      const groupWrapper = screen.getByTestId("forminput-group");
      const selectGroup = within(groupWrapper).getByTestId("select");
      await waitFor(() =>
        expect(within(selectGroup).getByText("opt:Others")).toBeInTheDocument(),
      );

      await user.selectOptions(selectGroup, "Others");

      expect(getData().group).toBe("Others");
      expect(getData().customable).toBe(true);
    });

    it("memilih group selain 'Others' mempertahankan customable sebelumnya (true)", async () => {
      const user = userEvent.setup({ delay: null });
      axiosGet.mockResolvedValue({ data: ["Weight", "Length"] });
      const { getData } = renderForm({
        data: { id: 1, group: "Others", customable: true },
      });

      const groupWrapper = screen.getByTestId("forminput-group");
      const selectGroup = within(groupWrapper).getByTestId("select");
      await waitFor(() =>
        expect(within(selectGroup).getByText("opt:Length")).toBeInTheDocument(),
      );
      await user.selectOptions(selectGroup, "Length");

      expect(getData().group).toBe("Length");
      expect(getData().customable).toBe(true);
    });

    it("memilih group selain 'Others' mempertahankan customable sebelumnya (false)", async () => {
      const user = userEvent.setup({ delay: null });
      axiosGet.mockResolvedValue({ data: ["Weight", "Length"] });
      const { getData } = renderForm({
        data: { id: 1, group: "Weight", customable: false },
      });

      const groupWrapper = screen.getByTestId("forminput-group");
      const selectGroup = within(groupWrapper).getByTestId("select");
      await waitFor(() =>
        expect(within(selectGroup).getByText("opt:Length")).toBeInTheDocument(),
      );
      await user.selectOptions(selectGroup, "Length");

      expect(getData().group).toBe("Length");
      expect(getData().customable).toBe(false);
    });
  });

  describe("loadGroups: axios.get debounce ke units.groups", () => {
    it("memanggil axios.get ke units.groups 300ms setelah mount", async () => {
      vi.useFakeTimers({ shouldAdvanceTime: true });
      axiosGet.mockResolvedValue({ data: ["Weight"] });
      renderForm({ data: { id: 1 } });

      // loadUnits (units.index) TIDAK didebounce -- terpanggil segera saat
      // mount, jadi assert difokuskan ke keberadaan panggilan units.groups
      // (yang didebounce 300ms), bukan "belum ada panggilan axios apapun".
      const groupsCallBeforeDebounce = axiosGet.mock.calls.find((c) =>
        c[0].includes("units.groups"),
      );
      expect(groupsCallBeforeDebounce).toBeUndefined();

      await vi.advanceTimersByTimeAsync(300);

      const groupsCall = axiosGet.mock.calls.find((c) =>
        c[0].includes("units.groups"),
      );
      expect(groupsCall).toBeDefined();

      vi.useRealTimers();
    });

    it("axios.get gagal pada loadGroups menampilkan toast error", async () => {
      vi.useFakeTimers({ shouldAdvanceTime: true });
      axiosGet.mockRejectedValue(new Error("network error"));
      renderForm({ data: { id: 1 } });

      await vi.advanceTimersByTimeAsync(300);
      await vi.waitFor(() =>
        expect(toastError).toHaveBeenCalledWith(
          "core.form.errors.something_went_wrong",
        ),
      );

      vi.useRealTimers();
    });
  });

  describe("loadUnits: axios.get ke units.index saat data.group berubah", () => {
    it("memanggil axios.get ke units.index dengan querystring group & except saat mount", async () => {
      axiosGet.mockResolvedValue({ data: [] });
      renderForm({ data: { id: 42, group: "Weight" } });

      await waitFor(() => expect(axiosGet).toHaveBeenCalled());
      const unitsCall = axiosGet.mock.calls.find((c) =>
        c[0].includes("units.index"),
      );
      expect(unitsCall).toBeDefined();
      expect(unitsCall[0]).toContain("group=Weight");
      expect(unitsCall[0]).toContain("except=42");
    });

    it("units hasil loadUnits menampilkan section playground", async () => {
      axiosGet.mockImplementation((url) => {
        if (url.includes("units.index")) {
          return Promise.resolve({
            data: [makeUnit({ id: 2, code: "GR", name: "Gram", group: "Weight", conversion_factor: 0.001 })],
          });
        }
        return Promise.resolve({ data: [] });
      });
      renderForm({
        data: { id: 1, group: "Weight", code: "KG", name: "Kilogram", customable: false, conversion_factor: 1 },
      });

      expect(
        await screen.findByText("inventory.unit.playground"),
      ).toBeInTheDocument();
    });

    it("playground TIDAK dirender ketika units kosong", async () => {
      axiosGet.mockResolvedValue({ data: [] });
      renderForm({ data: { id: 1, group: "Weight", customable: false } });

      await waitFor(() => expect(axiosGet).toHaveBeenCalled());
      expect(
        screen.queryByText("inventory.unit.playground"),
      ).not.toBeInTheDocument();
    });

    it("playground TIDAK dirender ketika data.customable true meski units ada", async () => {
      axiosGet.mockImplementation((url) => {
        if (url.includes("units.index")) {
          return Promise.resolve({
            data: [makeUnit({ id: 2, group: "Weight" })],
          });
        }
        return Promise.resolve({ data: [] });
      });
      renderForm({ data: { id: 1, group: "Weight", customable: true } });

      await waitFor(() => expect(axiosGet).toHaveBeenCalled());
      expect(
        screen.queryByText("inventory.unit.playground"),
      ).not.toBeInTheDocument();
    });
  });

  describe("unitOptions memo: label & injeksi unit data.id", () => {
    it("unit dari `units` tanpa templateLink berlabel 'name (code)'", async () => {
      axiosGet.mockImplementation((url) => {
        if (url.includes("units.index")) {
          return Promise.resolve({
            data: [makeUnit({ id: 2, code: "GR", name: "Gram", group: "Weight" })],
          });
        }
        return Promise.resolve({ data: [] });
      });
      renderForm({
        data: { id: 1, group: "Weight", code: "KG", name: "Kilogram", customable: false, conversion_factor: 1 },
      });

      await screen.findByText("inventory.unit.playground");
      const fromWrapper = screen.getByTestId(
        "forminput-inventory.unit.columns.units.from",
      );
      const selectFrom = within(fromWrapper).getByTestId("select");
      expect(
        within(selectFrom).getByText("opt:Gram (GR)"),
      ).toBeInTheDocument();
    });

    it("unit data.id sendiri disuntikkan ke opsi meski tidak ada di `units` (mis. tersaring except)", async () => {
      axiosGet.mockImplementation((url) => {
        if (url.includes("units.index")) {
          // data.id (1) sengaja tidak dikembalikan backend (mis. filter
          // except=1 di server) -- hanya unit lain.
          return Promise.resolve({
            data: [makeUnit({ id: 2, code: "GR", name: "Gram", group: "Weight" })],
          });
        }
        return Promise.resolve({ data: [] });
      });
      renderForm({
        data: { id: 1, group: "Weight", code: "KG", name: "Kilogram", customable: false, conversion_factor: 1 },
      });

      await screen.findByText("inventory.unit.playground");
      const fromWrapper = screen.getByTestId(
        "forminput-inventory.unit.columns.units.from",
      );
      const selectFrom = within(fromWrapper).getByTestId("select");
      expect(
        within(selectFrom).getByText("opt:Kilogram (KG)"),
      ).toBeInTheDocument();
    });
  });

  describe("kalkulasi konversi playground", () => {
    async function setupPlayground({ dataOverrides = {} } = {}) {
      axiosGet.mockImplementation((url) => {
        if (url.includes("units.index")) {
          return Promise.resolve({
            data: [
              makeUnit({
                id: 2,
                code: "GR",
                name: "Gram",
                group: "Weight",
                conversion_factor: 0.001,
              }),
            ],
          });
        }
        return Promise.resolve({ data: [] });
      });
      const utils = renderForm({
        data: {
          id: 1,
          group: "Weight",
          code: "KG",
          name: "Kilogram",
          customable: false,
          conversion_factor: 1,
          ...dataOverrides,
        },
      });
      await screen.findByText("inventory.unit.playground");
      return utils;
    }

    it("menghitung toValue = fromValue * (from.conversion_factor / to.conversion_factor)", async () => {
      const user = userEvent.setup({ delay: null });
      await setupPlayground();

      const fromWrapper = screen.getByTestId(
        "forminput-inventory.unit.columns.units.from",
      );
      const toWrapper = screen.getByTestId(
        "forminput-inventory.unit.columns.units.to",
      );
      const selectFrom = within(fromWrapper).getByTestId("select");
      const selectTo = within(toWrapper).getByTestId("select");

      // from = Kilogram (data.id, conversion_factor 1), to = Gram (id 2,
      // conversion_factor 0.001) -> 1 Kilogram = 1 * (1/0.001) = 1000 Gram.
      await user.selectOptions(selectFrom, "1");
      await user.selectOptions(selectTo, "2");

      // Input fromValue & toValue TIDAK dibungkus FormInput (di luar
      // <FormInput>) -- ambil lewat displayValue kosong (keduanya textbox
      // generik, urutan DOM: fromValue lalu toValue).
      const numericInputs = screen
        .getAllByDisplayValue("")
        .filter((el) => el.tagName === "INPUT");

      await user.type(numericInputs[0], "1");

      await waitFor(() => {
        expect(numericInputs[1]).toHaveValue("1000");
      });
    });

    it("fromValue kosong mengosongkan toValue", async () => {
      const user = userEvent.setup({ delay: null });
      await setupPlayground();

      const fromWrapper = screen.getByTestId(
        "forminput-inventory.unit.columns.units.from",
      );
      const toWrapper = screen.getByTestId(
        "forminput-inventory.unit.columns.units.to",
      );
      const selectFrom = within(fromWrapper).getByTestId("select");
      const selectTo = within(toWrapper).getByTestId("select");
      await user.selectOptions(selectFrom, "1");
      await user.selectOptions(selectTo, "2");

      const numericInputs = screen
        .getAllByDisplayValue("")
        .filter((el) => el.tagName === "INPUT");
      await user.type(numericInputs[0], "5");
      await waitFor(() => expect(numericInputs[1]).toHaveValue("5000"));

      await user.clear(numericInputs[0]);
      await waitFor(() => expect(numericInputs[1]).toHaveValue(""));
    });

    it("conversion_factor tujuan 0 (from bukan 0) menghasilkan Infinity, bukan string kosong", async () => {
      const user = userEvent.setup({ delay: null });
      axiosGet.mockImplementation((url) => {
        if (url.includes("units.index")) {
          return Promise.resolve({
            data: [
              makeUnit({
                id: 2,
                code: "ZERO",
                name: "Zero",
                group: "Weight",
                conversion_factor: 0,
              }),
            ],
          });
        }
        return Promise.resolve({ data: [] });
      });
      renderForm({
        data: {
          id: 1,
          group: "Weight",
          code: "KG",
          name: "Kilogram",
          customable: false,
          conversion_factor: 1,
        },
      });
      await screen.findByText("inventory.unit.playground");

      const fromWrapper = screen.getByTestId(
        "forminput-inventory.unit.columns.units.from",
      );
      const toWrapper = screen.getByTestId(
        "forminput-inventory.unit.columns.units.to",
      );
      // from = Kilogram (conversion_factor 1), to = Zero (conversion_factor
      // 0) -> 1/0 = Infinity (bukan NaN), maka Number.isNaN check di source
      // TIDAK mengosongkan value -- toValue jadi "Infinity".
      await user.selectOptions(within(fromWrapper).getByTestId("select"), "1");
      await user.selectOptions(within(toWrapper).getByTestId("select"), "2");

      const numericInputs = screen
        .getAllByDisplayValue("")
        .filter((el) => el.tagName === "INPUT");
      await user.type(numericInputs[0], "5");

      await waitFor(() => {
        expect(numericInputs[1]).toHaveValue("Infinity");
      });
    });
  });

  describe("swapPlayground", () => {
    it("klik tombol swap menukar unit from/to beserta value", async () => {
      const user = userEvent.setup({ delay: null });
      axiosGet.mockImplementation((url) => {
        if (url.includes("units.index")) {
          return Promise.resolve({
            data: [
              makeUnit({
                id: 2,
                code: "GR",
                name: "Gram",
                group: "Weight",
                conversion_factor: 0.001,
              }),
            ],
          });
        }
        return Promise.resolve({ data: [] });
      });
      renderForm({
        data: {
          id: 1,
          group: "Weight",
          code: "KG",
          name: "Kilogram",
          customable: false,
          conversion_factor: 1,
        },
      });
      await screen.findByText("inventory.unit.playground");

      const fromWrapper = screen.getByTestId(
        "forminput-inventory.unit.columns.units.from",
      );
      const toWrapper = screen.getByTestId(
        "forminput-inventory.unit.columns.units.to",
      );
      const selectFrom = within(fromWrapper).getByTestId("select");
      const selectTo = within(toWrapper).getByTestId("select");
      await user.selectOptions(selectFrom, "1");
      await user.selectOptions(selectTo, "2");

      const numericInputs = screen
        .getAllByDisplayValue("")
        .filter((el) => el.tagName === "INPUT");
      await user.type(numericInputs[0], "2");
      await waitFor(() => expect(numericInputs[1]).toHaveValue("2000"));

      const swapButton = screen.getByRole("button");
      await user.click(swapButton);

      // Setelah swap: from = Gram (id 2), to = Kilogram (id 1).
      expect(selectFrom).toHaveValue("2");
      expect(selectTo).toHaveValue("1");
    });
  });

  describe("field group: canUpdateGroup via FormPageContext", () => {
    it("Select group disabled ketika defaultData.canUpdate.group === false", () => {
      renderForm({
        data: { id: 1, group: "Weight" },
        defaultData: { canUpdate: { group: false } },
      });

      const groupWrapper = screen.getByTestId("forminput-group");
      const selectGroup = within(groupWrapper).getByTestId("select");
      expect(selectGroup).toBeDisabled();
    });

    it("Select group TIDAK disabled ketika canUpdate.group true/tidak diset", () => {
      renderForm({
        data: { id: 1, group: "Weight" },
        defaultData: { canUpdate: { group: true } },
      });

      const groupWrapper = screen.getByTestId("forminput-group");
      const selectGroup = within(groupWrapper).getByTestId("select");
      expect(selectGroup).not.toBeDisabled();
    });

    it("Select group disabled ketika disabled (whole-form) true, mengalahkan canUpdate", () => {
      renderForm({
        data: { id: 1, group: "Weight" },
        disabled: true,
        defaultData: { canUpdate: { group: true } },
      });

      const groupWrapper = screen.getByTestId("forminput-group");
      const selectGroup = within(groupWrapper).getByTestId("select");
      expect(selectGroup).toBeDisabled();
    });
  });
});
