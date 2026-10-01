import { describe, expect, it, vi, beforeEach } from "vitest";
import React from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

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
      useFormPageCalls.push({ defaultValue, options });
      const [data, setDataState] = React.useState({
        ...defaultValue,
        ...formPageSeed,
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
      return { data, setData, disabled: false };
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

vi.mock("./QuotationItems", () => ({
  default: ({ value, type }) => (
    <div data-testid="quotation-items" data-type={type}>
      items:{(value ?? []).length}
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
    formPageSeed = {};
    useFormPageCalls.length = 0;
    usePageMock.mockReturnValue({ props: { preferences: {} } });
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
      for (const call of useFormPageCalls) {
        expect(call.options).toEqual({ trackDefaultValue: false });
      }
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
