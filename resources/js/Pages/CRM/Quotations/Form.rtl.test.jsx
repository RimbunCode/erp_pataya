import { describe, expect, it, vi, beforeEach } from "vitest";
import React from "react";
import { act, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import axios from "axios";

vi.mock("axios", () => ({ default: { post: vi.fn() } }));
let conditionalDefaultsMode = false;
let deferTableUpdate;
let currentFormData;

import { TooltipProvider } from "@/Components/ui/tooltip";

const stableT = (key) => key;
vi.mock("laravel-react-i18n", () => ({
  useLaravelReactI18n: () => ({ t: stableT }),
}));

const usePageMock = vi.fn();
vi.mock("@inertiajs/react", () => ({
  usePage: () => usePageMock(),
}));

window.route = (name, params) =>
  params !== undefined ? `${name}/${JSON.stringify(params)}` : name;

let formPageSeed = {};
const useFormPageCalls = [];
vi.mock("@/Pages/Core/FormPage", async () => {
  const React = await import("react");
  return {
    useFormPage: (defaultValue, options) => {
      const [data, setDataState] = React.useState({
        ...(defaultValue ?? {}),
        ...(defaultValue === undefined ? {} : formPageSeed),
      });
      const setData = (keyOrFn, val) => {
        if (typeof keyOrFn === "function") {
          setDataState((prev) => keyOrFn(prev));
        } else if (typeof keyOrFn === "string") {
          setDataState((prev) => ({ ...prev, [keyOrFn]: val }));
        } else {
          setDataState((prev) => ({ ...prev, ...keyOrFn }));
        }
      };
      if (typeof defaultValue === "undefined") {
        return { registerBeforeSubmit: () => () => {} };
      }
      useFormPageCalls.push({ defaultValue, options });
      currentFormData = data;
      return { data, setData, disabled: false, isCreate: true };
    },
    FormPageContent: ({ children }) => <div>{children}</div>,
  };
});

vi.mock("@/Components/FormInput", () => ({
  default: ({ name, label, readOnly, required, children }) => (
    <div
      data-testid={`forminput-${name ?? label}`}
      data-readonly={readOnly ? "true" : "false"}
      data-required={required ? "true" : "false"}
    >
      <label>{label}</label>
      {children}
    </div>
  ),
}));

vi.mock("@/Components/DatetimePicker", () => ({
  default: () => <div data-testid="datetime-picker" />,
}));

vi.mock("@/Pages/Sales/Customers/CustomerLinkModel", () => ({
  default: ({ value }) => (
    <div data-testid="customer-link-model">
      customer:{value?.name ?? "none"}
    </div>
  ),
}));

vi.mock("@/Pages/CRM/Opportunities/OpportunityLinkModel", () => ({
  default: ({ value, disabled }) => (
    <button
      type="button"
      data-testid="opportunity-link-model"
      data-disabled={disabled ? "true" : "false"}
    >
      opportunity:{value?.name ?? "none"}
    </button>
  ),
}));

vi.mock("@/Components/LinkModel", () => ({
  default: ({ value, model }) => (
    <div data-testid="reference-link-model" data-model={model}>
      ref:{value?.name ?? "none"}
    </div>
  ),
}));

vi.mock("./QuotationItems", async (importOriginal) => {
  const actual = await importOriginal();
  return {
    default: (props) =>
      conditionalDefaultsMode ? (
        <actual.default {...props} />
      ) : (
        <div data-testid="quotation-items" data-type={props.type}>
          items:{(props.value ?? []).length}
        </div>
      ),
  };
});

vi.mock("@/Pages/Inventory/Items/ItemVariantLinkModel", () => ({
  default: ({ value, onValueChange }) => (
    <button
      type="button"
      onClick={() => onValueChange(globalThis.__quotationItem)}
    >
      item:{value?.id ?? "none"}
    </button>
  ),
}));
vi.mock("@/Pages/Finances/Taxes/TaxLinkModel", () => ({
  default: ({ value, onValueChange }) => (
    <button
      type="button"
      onClick={() => onValueChange(globalThis.__quotationTax)}
    >
      tax:{value?.id ?? "none"}
    </button>
  ),
}));
vi.mock("@/Pages/Inventory/Items/ItemUnitLinkModel", () => ({
  default: () => null,
}));
vi.mock("@/Components/FormTable", () => ({
  default: ({ columns, value, onValueChange }) => (
    <div>
      <output data-testid="conditional-items">{JSON.stringify(value)}</output>
      {value.map((row) => (
        <div key={row.id} data-testid={`conditional-row-${row.id}`}>
          {columns
            .filter((column) => column && ["item", "tax"].includes(column.name))
            .map((column) => (
              <div key={column.name}>
                {column.cell({
                  dataRow: row,
                  data: row[column.name],
                  attributes: {},
                  setData: (keyOrPatch, fieldValue) => {
                    const publish = () =>
                      onValueChange(
                        value.map((current) =>
                          current.id === row.id
                            ? {
                                ...current,
                                ...(typeof keyOrPatch === "string"
                                  ? { [keyOrPatch]: fieldValue }
                                  : keyOrPatch),
                              }
                            : current,
                        ),
                      );
                    if (deferTableUpdate) deferTableUpdate(publish);
                    else publish();
                  },
                })}
              </div>
            ))}
        </div>
      ))}
    </div>
  ),
}));

vi.mock("./QuotationSections", async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    default: ({ value, type }) => (
      <div data-testid="quotation-sections" data-type={type}>
        {(value ?? []).map((section) => (
          <span key={section.id} data-testid="section-title">
            {section.title}
          </span>
        ))}
      </div>
    ),
  };
});

vi.mock("@/Components/Select", () => ({
  default: ({ value, onValueChange, options, optionTrans }) => (
    <div data-testid="type-select" data-value={value ?? ""}>
      {options.map((option) => (
        <button
          key={option}
          type="button"
          data-testid={`type-option-${option}`}
          onClick={() => onValueChange(option)}
        >
          {optionTrans}.{option}
        </button>
      ))}
    </div>
  ),
}));

const renderForm = (ui) => render(<TooltipProvider>{ui}</TooltipProvider>);

import Form from "./Form";

describe("CRM Quotations Form", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    conditionalDefaultsMode = false;
    delete globalThis.__quotationItem;
    delete globalThis.__quotationTax;
    formPageSeed = {};
    useFormPageCalls.length = 0;
    usePageMock.mockReturnValue({ props: { preferences: {} } });
  });

  describe("conditional defaults integration", () => {
    const moduleTax = { id: "module-tax", rate: 11 };
    const ruleTax = { id: "rule-tax", rate: 5 };
    const manualTax = { id: "manual-tax", rate: 7 };
    const chooseItem = async (id) => {
      globalThis.__quotationItem = {
        id: `variant-${id}`,
        item: { id },
        description: "Selected item",
        is_stock_item: true,
      };
      await userEvent.click(
        within(screen.getByTestId("conditional-row-row-1")).getByRole(
          "button",
          { name: /^item:/ },
        ),
      );
    };
    const rows = () =>
      JSON.parse(screen.getByTestId("conditional-items").textContent);
    const mount = (row = {}) => {
      conditionalDefaultsMode = true;
      deferTableUpdate = undefined;
      formPageSeed = { items: [{ id: "row-1", ...row }] };
      usePageMock.mockReturnValue({
        props: {
          defaults: { tax: moduleTax, warehouse: { id: "module-warehouse" } },
        },
      });
      const responses = new Map();
      axios.post.mockImplementation((url, payload) => {
        if (url === "/defaults/resolve")
          return new Promise((resolve) => {
            responses.set(payload.items[0].item_id, resolve);
          });
        return Promise.resolve({
          data: {
            data: payload.model.endsWith("Tax")
              ? [ruleTax]
              : [{ id: "rule-warehouse" }],
          },
        });
      });
      renderForm(<Form />);
      return async (itemId = "item-1", taxIds = [ruleTax.id]) => {
        await waitFor(() => expect(responses.has(itemId)).toBe(true));
        await act(async () => {
          responses.get(itemId)({
            data: {
              items: {
                [itemId]: { tax_ids: taxIds, warehouse_id: "rule-warehouse" },
              },
            },
          });
        });
      };
    };

    it.each([[[]], [[ruleTax.id]]])(
      "retains early resolution %j until the selected row reaches the parent",
      async (taxIds) => {
        const respond = mount();
        let publish;
        deferTableUpdate = (callback) => {
          publish = callback;
        };
        await chooseItem("item-1");
        await respond("item-1", taxIds);
        expect(rows()[0].item).toBeUndefined();
        deferTableUpdate = undefined;
        act(() => publish());
        expect(rows()[0].tax).toEqual(taxIds.length ? ruleTax : null);
        expect(rows()[0].tax_rate).toBe(taxIds.length ? 5 : 0);
      },
    );

    it("keeps manually cleared tax empty when replacing an item", async () => {
      const respond = mount();
      await chooseItem("item-1");
      globalThis.__quotationTax = null;
      await userEvent.click(
        within(screen.getByTestId("conditional-row-row-1")).getByRole(
          "button",
          { name: /^tax:/ },
        ),
      );
      await chooseItem("item-2");
      expect(rows()[0].tax).toBeNull();
      await respond("item-2");
      expect(rows()[0].tax).toBeNull();
    });

    it("applies hydrated conditional tax to actual QuotationItems and form state", async () => {
      const respond = mount();
      await chooseItem("item-1");
      await waitFor(() =>
        expect(axios.post).toHaveBeenCalledWith(
          "/defaults/resolve",
          {
            document_type: "quotation",
            items: [{ item_id: "item-1" }],
          },
          expect.objectContaining({ signal: expect.any(AbortSignal) }),
        ),
      );
      expect(rows()[0].tax).toEqual(moduleTax);
      await respond();
      await waitFor(() => expect(rows()[0].tax).toEqual(ruleTax));
      expect(currentFormData.items[0].tax_rate).toBe(5);
      expect(rows()[0]).not.toHaveProperty("warehouse");
    });

    it.each([manualTax, null, moduleTax])(
      "preserves user tax selection %j while the resolver is pending",
      async (tax) => {
        const respond = mount();
        await chooseItem("item-1");
        await waitFor(() =>
          expect(axios.post).toHaveBeenCalledWith(
            "/defaults/resolve",
            expect.anything(),
            expect.objectContaining({ signal: expect.any(AbortSignal) }),
          ),
        );
        globalThis.__quotationTax = tax;
        await userEvent.click(
          within(screen.getByTestId("conditional-row-row-1")).getByRole(
            "button",
            { name: /^tax:/ },
          ),
        );
        await respond();
        await waitFor(() =>
          expect(axios.post).toHaveBeenCalledWith(
            "model",
            expect.objectContaining({ model: "App\\Models\\Finances\\Tax" }),
            expect.objectContaining({ signal: expect.any(AbortSignal) }),
          ),
        );
        expect(rows()[0].tax).toEqual(tax);
        expect(currentFormData.items[0].tax_rate).toBe(tax?.rate ?? 0);
      },
    );

    it("preserves source row tax when a matching item is resolved", async () => {
      const respond = mount({
        referenceable_id: "source-1",
        tax: manualTax,
        tax_rate: manualTax.rate,
      });
      await chooseItem("item-1");
      await waitFor(() =>
        expect(axios.post).toHaveBeenCalledWith(
          "/defaults/resolve",
          expect.anything(),
          expect.objectContaining({ signal: expect.any(AbortSignal) }),
        ),
      );
      await respond();
      await waitFor(() =>
        expect(axios.post).toHaveBeenCalledWith(
          "model",
          expect.objectContaining({ model: "App\\Models\\Finances\\Tax" }),
          expect.objectContaining({ signal: expect.any(AbortSignal) }),
        ),
      );
      expect(rows()[0].referenceable_id).toBe("source-1");
      expect(rows()[0].tax).toEqual(manualTax);
    });

    it("ignores a stale response after changing the selected item", async () => {
      const respond = mount();
      await chooseItem("item-1");
      await waitFor(() =>
        expect(axios.post).toHaveBeenCalledWith(
          "/defaults/resolve",
          expect.anything(),
          expect.objectContaining({ signal: expect.any(AbortSignal) }),
        ),
      );
      await chooseItem("item-2");
      await respond("item-2", []);
      await waitFor(() => expect(rows()[0].tax).toBeNull());
      await respond();
      await waitFor(() =>
        expect(axios.post).toHaveBeenCalledWith(
          "model",
          expect.objectContaining({ model: "App\\Models\\Finances\\Tax" }),
          expect.objectContaining({ signal: expect.any(AbortSignal) }),
        ),
      );
      expect(rows()[0].item.item.id).toBe("item-2");
      expect(rows()[0].tax).toBeNull();
    });

    it("applies an explicit tax exemption to the form state", async () => {
      const respond = mount();
      await chooseItem("item-1");
      await waitFor(() =>
        expect(axios.post).toHaveBeenCalledWith(
          "/defaults/resolve",
          expect.anything(),
          expect.objectContaining({ signal: expect.any(AbortSignal) }),
        ),
      );
      await respond("item-1", []);
      await waitFor(() => expect(rows()[0].tax).toBeNull());
      expect(currentFormData.items[0].tax_rate).toBe(0);
    });
  });

  it("amount dihitung dari sum quantity*price seluruh items", () => {
    formPageSeed = {
      items: [
        { quantity: 2, price: 100 },
        { quantity: 3, price: 50 },
      ],
    };
    renderForm(<Form />);

    const amountInput = screen
      .getByTestId(`forminput-crm.quotation.columns.amount`)
      .querySelector("input");
    expect(amountInput).toHaveValue("350.00");
  });

  it("amount 0 saat items kosong", () => {
    formPageSeed = { items: [] };
    renderForm(<Form />);

    const amountInput = screen
      .getByTestId(`forminput-crm.quotation.columns.amount`)
      .querySelector("input");
    expect(amountInput).toHaveValue("0.00");
  });

  it("opportunity TIDAK disabled saat tidak ada referenceable", () => {
    formPageSeed = { referenceable: null };
    renderForm(<Form />);

    expect(screen.getByTestId("opportunity-link-model")).toHaveAttribute(
      "data-disabled",
      "false",
    );
  });

  it("opportunity disabled ketika ada referenceable (carry-over dari dokumen lain)", () => {
    formPageSeed = {
      referenceable: { id: 1, name: "SO-001" },
      referenceable_type: "App\\Models\\Sales\\SalesOrder",
    };
    renderForm(<Form />);

    expect(screen.getByTestId("opportunity-link-model")).toHaveAttribute(
      "data-disabled",
      "true",
    );
  });

  it("field reference_to TIDAK dirender saat tidak ada referenceable", () => {
    formPageSeed = { referenceable: null };
    renderForm(<Form />);

    expect(
      screen.queryByTestId("reference-link-model"),
    ).not.toBeInTheDocument();
  });

  it("field reference_to dirender read-only saat ada referenceable", () => {
    formPageSeed = {
      referenceable: { id: 1, name: "SO-001" },
      referenceable_type: "App\\Models\\Sales\\SalesOrder",
    };
    renderForm(<Form />);

    const refModel = screen.getByTestId("reference-link-model");
    expect(refModel).toHaveTextContent("ref:SO-001");
    expect(refModel).toHaveAttribute(
      "data-model",
      "App\\Models\\Sales\\SalesOrder",
    );
  });

  it("QuotationItems menerima data.items dan readOnly dari disabled form", () => {
    formPageSeed = { items: [{ quantity: 1, price: 1 }] };
    renderForm(<Form />);

    expect(screen.getByTestId("quotation-items")).toHaveTextContent("items:1");
  });

  it("memilih customer menampilkan value terkini", () => {
    formPageSeed = { customer: { name: "PT ABC" } };
    renderForm(<Form />);

    expect(screen.getByTestId("customer-link-model")).toHaveTextContent(
      "customer:PT ABC",
    );
  });

  // Regresi React error #185 (AC1.1-AC1.3): `new Date()` menghasilkan ISO string
  // berbeda tiap render, sehingga guard lastResolvedSerializedRef di useFormPage
  // tidak pernah cocok kalau defaultValue dilacak.
  describe("regresi React error #185", () => {
    it("useFormPage dipanggil dengan { trackDefaultValue: false } (AC1.3)", () => {
      renderForm(<Form />);

      expect(useFormPageCalls.length).toBeGreaterThan(0);
      const formCall = useFormPageCalls.find(
        (call) => typeof call.defaultValue !== "undefined",
      );
      expect(formCall.options).toEqual({ trackDefaultValue: false });
    });

    it("field date terisi otomatis dengan tanggal saat ini (AC1.2)", () => {
      renderForm(<Form />);

      const { defaultValue } = useFormPageCalls[0];
      expect(defaultValue.date).toBeInstanceOf(Date);
      expect(Math.abs(Date.now() - defaultValue.date.getTime())).toBeLessThan(
        5000,
      );
    });

    it("hook asli tidak render berulang dengan default berisi new Date() (AC1.1)", async () => {
      const { FormPageContext, useFormPage: realUseFormPage } =
        await vi.importActual("@/Pages/Core/FormPage");
      const setDefaults = vi.fn();
      // Simulasi new Date() yang berbeda milidetik di tiap render.
      let tick = 0;
      let renderCount = 0;

      function Consumer() {
        renderCount += 1;
        realUseFormPage(
          { date: new Date(1_700_000_000_000 + tick++) },
          { trackDefaultValue: false },
        );
        return null;
      }

      // Host merender ulang Consumer setiap form.setData dipanggil, seperti
      // FormPageProvider yang asli ketika data form berubah.
      function Host() {
        const [, setVersion] = React.useState(0);
        const contextValue = React.useMemo(
          () => ({
            isCreate: true,
            defaultData: null,
            form: {
              setDefaults,
              setData: () => setVersion((version) => version + 1),
            },
          }),
          [],
        );
        return (
          <FormPageContext.Provider value={contextValue}>
            <Consumer />
          </FormPageContext.Provider>
        );
      }

      render(<Host />);

      expect(renderCount).toBeLessThan(10);
      expect(setDefaults).toHaveBeenCalledTimes(1);
      expect(setDefaults.mock.calls[0][0].date).toBeInstanceOf(Date);
    });
  });

  describe("jenis Quotation dan field surat (R2, R3)", () => {
    const isRequired = (name) =>
      screen.getByTestId(`forminput-${name}`).dataset.required === "true";

    it("jenis default spare_part pada form baru", () => {
      renderForm(<Form />);

      expect(useFormPageCalls[0].defaultValue.type).toBe("spare_part");
      expect(screen.getByTestId("type-select")).toHaveAttribute(
        "data-value",
        "spare_part",
      );
    });

    it("pilihan jenis: spare_part, new_unit, rental dengan label dari berkas bahasa", () => {
      renderForm(<Form />);

      for (const type of ["spare_part", "new_unit", "rental"]) {
        expect(screen.getByTestId(`type-option-${type}`)).toHaveTextContent(
          `crm.quotation.columns.type.options.${type}`,
        );
      }
    });

    it("type, attn, introduction, date, dan customer wajib di semua jenis", () => {
      for (const type of ["spare_part", "new_unit", "rental"]) {
        formPageSeed = { type };
        const { unmount } = renderForm(<Form />);

        for (const name of [
          "type",
          "attn",
          "introduction",
          "date",
          "customer",
        ]) {
          expect(isRequired(name), `${name} untuk ${type}`).toBe(true);
        }
        unmount();
      }
    });

    it("subject dan valid_until opsional untuk spare_part", () => {
      formPageSeed = { type: "spare_part" };
      renderForm(<Form />);

      expect(isRequired("subject")).toBe(false);
      expect(isRequired("valid_until")).toBe(false);
    });

    it.each(["new_unit", "rental"])(
      "subject dan valid_until wajib untuk %s",
      (type) => {
        formPageSeed = { type };
        renderForm(<Form />);

        expect(isRequired("subject")).toBe(true);
        expect(isRequired("valid_until")).toBe(true);
      },
    );

    it("mengganti jenis mengubah kewajiban subject dan valid_until", async () => {
      renderForm(<Form />);
      expect(isRequired("subject")).toBe(false);

      await userEvent.click(screen.getByTestId("type-option-new_unit"));
      expect(isRequired("subject")).toBe(true);
      expect(isRequired("valid_until")).toBe(true);

      await userEvent.click(screen.getByTestId("type-option-spare_part"));
      expect(isRequired("subject")).toBe(false);
      expect(isRequired("valid_until")).toBe(false);
    });

    it("jenis diteruskan ke tabel item dan blok teks", async () => {
      renderForm(<Form />);
      expect(screen.getByTestId("quotation-items")).toHaveAttribute(
        "data-type",
        "spare_part",
      );

      await userEvent.click(screen.getByTestId("type-option-rental"));

      expect(screen.getByTestId("quotation-items")).toHaveAttribute(
        "data-type",
        "rental",
      );
      expect(screen.getByTestId("quotation-sections")).toHaveAttribute(
        "data-type",
        "rental",
      );
    });

    it("field kota terbit dan pengantar dirender dengan nilai tersimpan", () => {
      formPageSeed = {
        issued_city: "Surabaya",
        introduction: "Baris 1\nBaris 2",
      };
      renderForm(<Form />);

      expect(screen.getByDisplayValue("Surabaya")).toBeInTheDocument();
      expect(document.querySelector("textarea").value).toBe("Baris 1\nBaris 2");
    });
  });

  describe("usulan blok otomatis saat jenis dipilih (AC5.4)", () => {
    const sectionTemplates = [
      {
        id: "t1",
        quotation_type: "rental",
        title: "Note",
        content: "isi note",
        order: 1,
      },
      {
        id: "t2",
        quotation_type: "rental",
        title: "Owner Obligation",
        content: "isi owner",
        order: 2,
      },
      {
        id: "t3",
        quotation_type: "new_unit",
        title: "Terms & Conditions",
        content: "isi tnc",
        order: 1,
      },
    ];

    beforeEach(() => {
      usePageMock.mockReturnValue({
        props: { preferences: {}, sectionTemplates },
      });
    });

    const sectionTitles = () =>
      screen.queryAllByTestId("section-title").map((el) => el.textContent);

    it("memilih jenis pada dokumen tanpa blok mengusulkan blok jenis itu", async () => {
      renderForm(<Form />);
      expect(sectionTitles()).toEqual([]);

      await userEvent.click(screen.getByTestId("type-option-rental"));

      expect(sectionTitles()).toEqual(["Note", "Owner Obligation"]);
    });

    it("tidak menimpa blok yang sudah ada", async () => {
      formPageSeed = {
        sections: [{ id: "s1", title: "Blok buatan user", content: "x" }],
      };
      renderForm(<Form />);

      await userEvent.click(screen.getByTestId("type-option-rental"));

      expect(sectionTitles()).toEqual(["Blok buatan user"]);
    });

    it("jenis tanpa template tidak menambah blok", async () => {
      renderForm(<Form />);

      await userEvent.click(screen.getByTestId("type-option-spare_part"));

      expect(sectionTitles()).toEqual([]);
    });
  });
});
