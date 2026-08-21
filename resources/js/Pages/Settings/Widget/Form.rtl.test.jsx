import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, within } from "@testing-library/react";
import { TooltipProvider } from "@/Components/ui/tooltip";
import userEvent from "@testing-library/user-event";

// Form.jsx (Settings/Widget) adalah halaman konfigurasi widget dashboard
// (chart/tile). Logic UNIK yang jadi fokus test ini (bukan komponen anak yang
// sudah ada test sendiri):
// - getNameColumns/isValidColumn -- filter kolom model berdasar type
// - useEffect(modelClass) -- debounce 500ms axios.get(model.columns), reset
//   value_based_on/aggregate_function_based_on/time_based_on saat model kosong
// - useDidMountEffect(calculationType) -- reset field berbeda per tipe kalkulasi
//   (group_by vs sum/average vs count)
// - useDidMountEffect(groupByType) -- reset aggregate_function_based_on saat count
// - useDidMountEffect(columns) -- buang value field yang sudah tidak valid
//   terhadap daftar kolom baru
// - Visibility field kondisional: value_based_on (sum/average), section
//   group_by (group_by), aggregate_function_based_on (group_by & type!=count),
//   section time_series (disembunyikan saat calculation_type===group_by)
// - options `type` menambahkan "card" hanya utk sum/count/average
//
// Semua komponen anak yang sudah punya test sendiri di-stub: FormInput,
// Select, PermissionLinkModel (LinkModel). useDidMountEffect & inArray dipakai
// REAL (pure logic, bukan concern test ini utk di-mock).

const stableT = (key) => key;
vi.mock("laravel-react-i18n", () => ({
  useLaravelReactI18n: () => ({ t: stableT }),
}));

const axiosGet = vi.fn();
vi.mock("axios", () => ({
  default: { get: (...a) => axiosGet(...a) },
}));

// useFormPage diimplementasikan via React Context asli (bukan vi.fn statis)
// supaya reaktif terhadap setData di dalam test -- effects Form.jsx bergantung
// pada re-render nyata saat data berubah.
import React, { createContext, useContext, useState } from "react";
const FakeFormPageContext = createContext();
vi.mock("@/Pages/Core/FormPage", () => ({
  useFormPage: (...args) => {
    const ctx = useContext(FakeFormPageContext);
    return typeof ctx === "function" ? ctx(...args) : ctx;
  },
  FormPageContent: ({ title, children }) => (
    <section aria-label={title}>{children}</section>
  ),
}));

vi.mock("@/Components/FormInput", () => ({
  default: ({ name, label, disabled, children }) => (
    <div data-testid={`forminput-${name}`} data-disabled={disabled ? "true" : "false"}>
      <label>{label}</label>
      {children}
    </div>
  ),
}));

vi.mock("@/Components/Select", () => ({
  // Serialisasi options ke data-attribute supaya bisa diverifikasi tanpa perlu
  // membuka dropdown Radix (yang render via Portal ke document.body).
  default: ({ value, onValueChange, options, disabled }) => (
    <select
      data-testid="select"
      data-options={JSON.stringify(
        (options ?? []).map((opt) => (typeof opt === "string" ? opt : opt.value)),
      )}
      disabled={disabled}
      value={value ?? ""}
      onChange={(e) => onValueChange?.(e.target.value)}
    >
      <option value="" />
      {(options ?? []).map((opt) => {
        const val = typeof opt === "string" ? opt : opt.value;
        return (
          <option key={val} value={val}>
            {val}
          </option>
        );
      })}
    </select>
  ),
}));

vi.mock("@/Pages/Core/PermissionLinkModel", () => ({
  default: ({ value, onValueChange }) => (
    <input
      data-testid="permission-link-model"
      value={value?.model ?? ""}
      onChange={(e) => onValueChange?.({ model: e.target.value })}
    />
  ),
}));

window.route = (name, params) =>
  params !== undefined ? `${name}/${JSON.stringify(params)}` : name;

import Form from "./Form";

function FormPageProviderFake({ value, children }) {
  return (
    <FakeFormPageContext.Provider value={value}>
      {children}
    </FakeFormPageContext.Provider>
  );
}

/**
 * Render Form dengan state data terkelola (setData asli, reaktif) supaya
 * useEffect/useDidMountEffect di Form.jsx bisa diverifikasi lewat re-render.
 */
function renderForm({ initialData = {} } = {}) {
  function Wrapper() {
    const [data, setDataState] = useState(initialData);
    const setData = (key, val) => {
      if (typeof key === "object") {
        setDataState((prev) => ({ ...prev, ...key }));
      } else {
        setDataState((prev) => ({ ...prev, [key]: val }));
      }
    };
    return (
      <FormPageProviderFake value={{ data, setData }}>
        <Form />
      </FormPageProviderFake>
    );
  }

  return render(
    <TooltipProvider>
      <Wrapper />
    </TooltipProvider>,
  );
}

function getSelectOptions(testId) {
  const wrapper = screen.getByTestId(testId);
  const select = within(wrapper).getByTestId("select");
  return JSON.parse(select.dataset.options);
}

const sampleColumns = [
  { name: "amount", type: "number", titleTrans: "Amount" },
  { name: "price", type: "currency", titleTrans: "Price" },
  { name: "created_at", type: "datetime", titleTrans: "Created At" },
  { name: "status", type: "formStatus", titleTrans: "Status" },
  { name: "owner", type: "relation", titleTrans: "Owner" },
];

describe("Form (Settings/Widget)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers({ shouldAdvanceTime: true });
    axiosGet.mockResolvedValue({ data: { columns: sampleColumns } });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("field dasar (title, calculation_type, type, model) selalu dirender", () => {
    renderForm({ initialData: {} });

    expect(screen.getByTestId("forminput-title")).toBeInTheDocument();
    expect(screen.getByTestId("forminput-calculation_type")).toBeInTheDocument();
    expect(screen.getByTestId("forminput-type")).toBeInTheDocument();
    expect(screen.getByTestId("forminput-model")).toBeInTheDocument();
  });

  it("field value_based_on, group_by_*, time_series TIDAK dirender saat calculation_type kosong", () => {
    renderForm({ initialData: {} });

    expect(screen.queryByTestId("forminput-value_based_on")).not.toBeInTheDocument();
    expect(screen.queryByTestId("forminput-group_by_type")).not.toBeInTheDocument();
    expect(screen.queryByTestId("forminput-group_by_base_on")).not.toBeInTheDocument();
    // time_series section dirender (calculation_type != "group_by" saat kosong)
    expect(screen.getByTestId("forminput-time_based_on")).toBeInTheDocument();
  });

  describe("options `type`: card hanya utk sum/count/average", () => {
    it("calculation_type='sum' menyertakan opsi card", () => {
      renderForm({ initialData: { calculation_type: "sum" } });
      const options = getSelectOptions("forminput-type");
      expect(options).toEqual(["bar", "pie", "line", "doughnut", "card"]);
    });

    it("calculation_type='group_by' TIDAK menyertakan opsi card", () => {
      renderForm({ initialData: { calculation_type: "group_by" } });
      const options = getSelectOptions("forminput-type");
      expect(options).toEqual(["bar", "pie", "line", "doughnut"]);
    });

    it("calculation_type kosong TIDAK menyertakan opsi card", () => {
      renderForm({ initialData: {} });
      const options = getSelectOptions("forminput-type");
      expect(options).toEqual(["bar", "pie", "line", "doughnut"]);
    });
  });

  describe("visibility field berdasar calculation_type", () => {
    it("calculation_type='sum': value_based_on dirender, group_by fields tidak, time_series dirender", () => {
      renderForm({ initialData: { calculation_type: "sum" } });

      expect(screen.getByTestId("forminput-value_based_on")).toBeInTheDocument();
      expect(screen.queryByTestId("forminput-group_by_type")).not.toBeInTheDocument();
      expect(screen.queryByTestId("forminput-group_by_base_on")).not.toBeInTheDocument();
      expect(screen.getByTestId("forminput-time_based_on")).toBeInTheDocument();
      expect(screen.getByTestId("forminput-timespan")).toBeInTheDocument();
      expect(screen.getByTestId("forminput-time_interval")).toBeInTheDocument();
    });

    it("calculation_type='average': value_based_on dirender", () => {
      renderForm({ initialData: { calculation_type: "average" } });
      expect(screen.getByTestId("forminput-value_based_on")).toBeInTheDocument();
    });

    it("calculation_type='count': value_based_on TIDAK dirender, time_series dirender", () => {
      renderForm({ initialData: { calculation_type: "count" } });

      expect(screen.queryByTestId("forminput-value_based_on")).not.toBeInTheDocument();
      expect(screen.getByTestId("forminput-time_based_on")).toBeInTheDocument();
    });

    it("calculation_type='group_by': group_by_type & group_by_base_on dirender, time_series TIDAK dirender", () => {
      renderForm({
        initialData: { calculation_type: "group_by", group_by_type: "count" },
      });

      expect(screen.getByTestId("forminput-group_by_type")).toBeInTheDocument();
      expect(screen.getByTestId("forminput-group_by_base_on")).toBeInTheDocument();
      expect(screen.queryByTestId("forminput-time_based_on")).not.toBeInTheDocument();
      expect(screen.queryByTestId("forminput-timespan")).not.toBeInTheDocument();
      expect(screen.queryByTestId("forminput-time_interval")).not.toBeInTheDocument();
    });

    it("calculation_type='group_by' & group_by_type='count': aggregate_function_based_on TIDAK dirender", () => {
      renderForm({
        initialData: { calculation_type: "group_by", group_by_type: "count" },
      });

      expect(
        screen.queryByTestId("forminput-aggregate_function_based_on"),
      ).not.toBeInTheDocument();
    });

    it("calculation_type='group_by' & group_by_type='sum': aggregate_function_based_on dirender", () => {
      renderForm({
        initialData: { calculation_type: "group_by", group_by_type: "sum" },
      });

      expect(
        screen.getByTestId("forminput-aggregate_function_based_on"),
      ).toBeInTheDocument();
    });
  });

  describe("useEffect(modelClass): fetch kolom & reset field dependen", () => {
    it("model kosong: tidak memanggil axios", async () => {
      renderForm({ initialData: {} });

      await vi.advanceTimersByTimeAsync(500);

      expect(axiosGet).not.toHaveBeenCalled();
    });

    it("model terisi: memanggil axios.get ke model.columns setelah debounce 500ms", async () => {
      renderForm({
        initialData: { model: { model: "App\\Models\\Sales\\SalesOrder" } },
      });

      expect(axiosGet).not.toHaveBeenCalled();

      await vi.advanceTimersByTimeAsync(500);

      expect(axiosGet).toHaveBeenCalledTimes(1);
      const calledUrl = axiosGet.mock.calls[0][0];
      expect(calledUrl).toContain("model.columns");
      expect(calledUrl).toContain("SalesOrder");
    });

    it("kolom hasil fetch memfilter tipe relation/relations/formStatus/formStatuses/mixed sebelum dipakai sbg options", async () => {
      renderForm({
        initialData: {
          calculation_type: "sum",
          model: { model: "App\\Models\\Sales\\SalesOrder" },
        },
      });

      await vi.advanceTimersByTimeAsync(500);
      // flush promise axios.get
      await vi.waitFor(() => {
        const options = getSelectOptions("forminput-value_based_on");
        expect(options).toEqual(["amount", "price"]);
      });
    });
  });

  describe("useDidMountEffect(calculationType): reset field saat ganti tipe kalkulasi", () => {
    it("ganti ke 'group_by': value_based_on/timespan/time_interval/time_based_on direset null, default group_by_type='count' & group_by_base_on='monthly'", async () => {
      const setDataCalls = [];
      function SpyWrapper() {
        const [data, setDataState] = useState({
          calculation_type: "sum",
          value_based_on: "amount",
        });
        const setData = (key, val) => {
          setDataCalls.push([key, val]);
          setDataState((prev) => ({ ...prev, [key]: val }));
        };
        return (
          <FormPageProviderFake value={{ data, setData }}>
            <Form />
          </FormPageProviderFake>
        );
      }
      render(
        <TooltipProvider>
          <SpyWrapper />
        </TooltipProvider>,
      );

      const select = within(
        screen.getByTestId("forminput-calculation_type"),
      ).getByTestId("select");
      await userEvent.setup({ delay: null }).selectOptions(select, "group_by");

      expect(setDataCalls).toContainEqual(["value_based_on", null]);
      expect(setDataCalls).toContainEqual(["timespan", null]);
      expect(setDataCalls).toContainEqual(["time_interval", null]);
      expect(setDataCalls).toContainEqual(["time_based_on", null]);
      expect(setDataCalls).toContainEqual(["group_by_type", "count"]);
      expect(setDataCalls).toContainEqual(["group_by_base_on", "monthly"]);
    });

    it("ganti dari 'group_by' ke 'sum': group_by_type/group_by_base_on/aggregate_function_based_on direset null, value_based_on TIDAK direset", async () => {
      const setDataCalls = [];
      function SpyWrapper() {
        const [data, setDataState] = useState({
          calculation_type: "group_by",
          group_by_type: "sum",
          group_by_base_on: "monthly",
        });
        const setData = (key, val) => {
          setDataCalls.push([key, val]);
          setDataState((prev) => ({ ...prev, [key]: val }));
        };
        return (
          <FormPageProviderFake value={{ data, setData }}>
            <Form />
          </FormPageProviderFake>
        );
      }
      render(
        <TooltipProvider>
          <SpyWrapper />
        </TooltipProvider>,
      );

      const select = within(
        screen.getByTestId("forminput-calculation_type"),
      ).getByTestId("select");
      await userEvent.setup({ delay: null }).selectOptions(select, "sum");

      expect(setDataCalls).toContainEqual(["group_by_type", null]);
      expect(setDataCalls).toContainEqual(["group_by_base_on", null]);
      expect(setDataCalls).toContainEqual(["aggregate_function_based_on", null]);
      expect(setDataCalls.some(([k]) => k === "value_based_on")).toBe(false);
    });

    it("ganti dari 'sum' ke 'count': value_based_on direset null", async () => {
      const setDataCalls = [];
      function SpyWrapper() {
        const [data, setDataState] = useState({
          calculation_type: "sum",
          value_based_on: "amount",
        });
        const setData = (key, val) => {
          setDataCalls.push([key, val]);
          setDataState((prev) => ({ ...prev, [key]: val }));
        };
        return (
          <FormPageProviderFake value={{ data, setData }}>
            <Form />
          </FormPageProviderFake>
        );
      }
      render(
        <TooltipProvider>
          <SpyWrapper />
        </TooltipProvider>,
      );

      const select = within(
        screen.getByTestId("forminput-calculation_type"),
      ).getByTestId("select");
      await userEvent.setup({ delay: null }).selectOptions(select, "count");

      expect(setDataCalls).toContainEqual(["value_based_on", null]);
    });

    it("group_by_type belum terisi: default 'count' tetap di-set saat masuk group_by", async () => {
      const setDataCalls = [];
      function SpyWrapper() {
        const [data, setDataState] = useState({
          calculation_type: "sum",
        });
        const setData = (key, val) => {
          setDataCalls.push([key, val]);
          setDataState((prev) => ({ ...prev, [key]: val }));
        };
        return (
          <FormPageProviderFake value={{ data, setData }}>
            <Form />
          </FormPageProviderFake>
        );
      }
      render(
        <TooltipProvider>
          <SpyWrapper />
        </TooltipProvider>,
      );

      const select = within(
        screen.getByTestId("forminput-calculation_type"),
      ).getByTestId("select");
      await userEvent.setup({ delay: null }).selectOptions(select, "group_by");

      expect(setDataCalls).toContainEqual(["group_by_type", "count"]);
    });
  });

  describe("useDidMountEffect(groupByType): reset aggregate_function_based_on saat count", () => {
    it("ganti group_by_type ke 'count' mereset aggregate_function_based_on", async () => {
      const setDataCalls = [];
      function SpyWrapper() {
        const [data, setDataState] = useState({
          calculation_type: "group_by",
          group_by_type: "sum",
          group_by_base_on: "monthly",
          aggregate_function_based_on: "amount",
        });
        const setData = (key, val) => {
          setDataCalls.push([key, val]);
          setDataState((prev) => ({ ...prev, [key]: val }));
        };
        return (
          <FormPageProviderFake value={{ data, setData }}>
            <Form />
          </FormPageProviderFake>
        );
      }
      render(
        <TooltipProvider>
          <SpyWrapper />
        </TooltipProvider>,
      );

      const select = within(
        screen.getByTestId("forminput-group_by_type"),
      ).getByTestId("select");
      await userEvent.setup({ delay: null }).selectOptions(select, "count");

      expect(setDataCalls).toContainEqual(["aggregate_function_based_on", null]);
    });

    it("ganti group_by_type ke 'average' TIDAK mereset aggregate_function_based_on", async () => {
      const setDataCalls = [];
      function SpyWrapper() {
        const [data, setDataState] = useState({
          calculation_type: "group_by",
          group_by_type: "sum",
          group_by_base_on: "monthly",
          aggregate_function_based_on: "amount",
        });
        const setData = (key, val) => {
          setDataCalls.push([key, val]);
          setDataState((prev) => ({ ...prev, [key]: val }));
        };
        return (
          <FormPageProviderFake value={{ data, setData }}>
            <Form />
          </FormPageProviderFake>
        );
      }
      render(
        <TooltipProvider>
          <SpyWrapper />
        </TooltipProvider>,
      );

      const select = within(
        screen.getByTestId("forminput-group_by_type"),
      ).getByTestId("select");
      await userEvent.setup({ delay: null }).selectOptions(select, "average");

      expect(
        setDataCalls.some(([k]) => k === "aggregate_function_based_on"),
      ).toBe(false);
    });
  });

  describe("useDidMountEffect(columns): buang value field yang tidak valid lagi", () => {
    it("value_based_on tidak ada di kolom baru (type number) direset null", async () => {
      const setDataCalls = [];
      function SpyWrapper() {
        const [data, setDataState] = useState({
          calculation_type: "sum",
          value_based_on: "old_invalid_column",
          model: { model: "App\\Models\\Sales\\SalesOrder" },
        });
        const setData = (key, val) => {
          setDataCalls.push([key, val]);
          setDataState((prev) => ({ ...prev, [key]: val }));
        };
        return (
          <FormPageProviderFake value={{ data, setData }}>
            <Form />
          </FormPageProviderFake>
        );
      }
      render(
        <TooltipProvider>
          <SpyWrapper />
        </TooltipProvider>,
      );

      await vi.advanceTimersByTimeAsync(500);
      await vi.waitFor(() => {
        expect(setDataCalls).toContainEqual(["value_based_on", null]);
      });
    });

    it("value_based_on valid (ada di kolom number) TIDAK direset", async () => {
      const setDataCalls = [];
      function SpyWrapper() {
        const [data, setDataState] = useState({
          calculation_type: "sum",
          value_based_on: "amount",
          model: { model: "App\\Models\\Sales\\SalesOrder" },
        });
        const setData = (key, val) => {
          setDataCalls.push([key, val]);
          setDataState((prev) => ({ ...prev, [key]: val }));
        };
        return (
          <FormPageProviderFake value={{ data, setData }}>
            <Form />
          </FormPageProviderFake>
        );
      }
      render(
        <TooltipProvider>
          <SpyWrapper />
        </TooltipProvider>,
      );

      await vi.advanceTimersByTimeAsync(500);
      // beri waktu microtask axios resolve
      await vi.waitFor(() => {
        expect(axiosGet).toHaveBeenCalled();
      });

      expect(
        setDataCalls.some(([k, v]) => k === "value_based_on" && v === null),
      ).toBe(false);
    });

    it("time_based_on tidak ada di kolom datetime direset null", async () => {
      const setDataCalls = [];
      function SpyWrapper() {
        const [data, setDataState] = useState({
          calculation_type: "sum",
          time_based_on: "not_a_real_column",
          model: { model: "App\\Models\\Sales\\SalesOrder" },
        });
        const setData = (key, val) => {
          setDataCalls.push([key, val]);
          setDataState((prev) => ({ ...prev, [key]: val }));
        };
        return (
          <FormPageProviderFake value={{ data, setData }}>
            <Form />
          </FormPageProviderFake>
        );
      }
      render(
        <TooltipProvider>
          <SpyWrapper />
        </TooltipProvider>,
      );

      await vi.advanceTimersByTimeAsync(500);
      await vi.waitFor(() => {
        expect(setDataCalls).toContainEqual(["time_based_on", null]);
      });
    });
  });

  describe("getNameColumns/isValidColumn: filter options per Select", () => {
    it("group_by_base_on options adalah kolom SELAIN datetime (isExcept=true)", async () => {
      renderForm({
        initialData: {
          calculation_type: "group_by",
          group_by_type: "count",
          model: { model: "App\\Models\\Sales\\SalesOrder" },
        },
      });

      await vi.advanceTimersByTimeAsync(500);
      await vi.waitFor(() => {
        const options = getSelectOptions("forminput-group_by_base_on");
        expect(options).toEqual(["amount", "price"]);
      });
    });

    it("time_based_on options hanya kolom datetime", async () => {
      renderForm({
        initialData: {
          calculation_type: "sum",
          model: { model: "App\\Models\\Sales\\SalesOrder" },
        },
      });

      await vi.advanceTimersByTimeAsync(500);
      await vi.waitFor(() => {
        const options = getSelectOptions("forminput-time_based_on");
        expect(options).toEqual(["created_at"]);
      });
    });

    it("aggregate_function_based_on options hanya kolom number (bukan currency)", async () => {
      renderForm({
        initialData: {
          calculation_type: "group_by",
          group_by_type: "sum",
          model: { model: "App\\Models\\Sales\\SalesOrder" },
        },
      });

      await vi.advanceTimersByTimeAsync(500);
      await vi.waitFor(() => {
        const options = getSelectOptions("forminput-aggregate_function_based_on");
        expect(options).toEqual(["amount"]);
      });
    });

    it("value_based_on options mencakup number DAN currency", async () => {
      renderForm({
        initialData: {
          calculation_type: "average",
          model: { model: "App\\Models\\Sales\\SalesOrder" },
        },
      });

      await vi.advanceTimersByTimeAsync(500);
      await vi.waitFor(() => {
        const options = getSelectOptions("forminput-value_based_on");
        expect(options).toEqual(["amount", "price"]);
      });
    });
  });

  describe("disabled state field dependen model", () => {
    it("field value_based_on disabled saat model kosong", () => {
      renderForm({ initialData: { calculation_type: "sum" } });

      expect(screen.getByTestId("forminput-value_based_on")).toHaveAttribute(
        "data-disabled",
        "true",
      );
    });

    it("field value_based_on tidak disabled saat model terisi", async () => {
      renderForm({
        initialData: {
          calculation_type: "sum",
          model: { model: "App\\Models\\Sales\\SalesOrder" },
        },
      });

      expect(screen.getByTestId("forminput-value_based_on")).toHaveAttribute(
        "data-disabled",
        "false",
      );
    });
  });

  it("PermissionLinkModel menerima value & memanggil setData('model', ...) saat berubah", async () => {
    const setDataCalls = [];
    function SpyWrapper() {
      const [data, setDataState] = useState({});
      const setData = (key, val) => {
        setDataCalls.push([key, val]);
        setDataState((prev) => ({ ...prev, [key]: val }));
      };
      return (
        <FormPageProviderFake value={{ data, setData }}>
          <Form />
        </FormPageProviderFake>
      );
    }
    render(
      <TooltipProvider>
        <SpyWrapper />
      </TooltipProvider>,
    );

    const input = screen.getByTestId("permission-link-model");
    await userEvent
      .setup({ delay: null })
      .type(input, "App\\Models\\Sales\\SalesOrder");

    expect(setDataCalls.some(([k]) => k === "model")).toBe(true);
  });

  it("mengetik pada title memanggil setData('title', ...)", async () => {
    const setDataCalls = [];
    function SpyWrapper() {
      const [data, setDataState] = useState({});
      const setData = (key, val) => {
        setDataCalls.push([key, val]);
        setDataState((prev) => ({ ...prev, [key]: val }));
      };
      return (
        <FormPageProviderFake value={{ data, setData }}>
          <Form />
        </FormPageProviderFake>
      );
    }
    render(
      <TooltipProvider>
        <SpyWrapper />
      </TooltipProvider>,
    );

    const titleInput = within(
      screen.getByTestId("forminput-title"),
    ).getByRole("textbox");
    await userEvent.setup({ delay: null }).type(titleInput, "X");

    expect(setDataCalls.some(([k]) => k === "title")).toBe(true);
  });
});
