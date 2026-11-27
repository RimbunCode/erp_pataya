import { describe, expect, it, vi, beforeEach } from "vitest";
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

let formPageSeed = {};
vi.mock("@/Pages/Core/FormPage", async () => {
  const React = await import("react");
  return {
    useFormPage: () => {
      const [data, setDataState] = React.useState(formPageSeed);
      const setData = (keyOrFn, val) => {
        if (typeof keyOrFn === "function") {
          setDataState((prev) => keyOrFn(prev));
        } else if (typeof keyOrFn === "string") {
          setDataState((prev) => ({ ...prev, [keyOrFn]: val }));
        } else {
          setDataState((prev) => ({ ...prev, ...keyOrFn }));
        }
      };
      return { data, setData };
    },
    FormPageContent: ({ children }) => <div>{children}</div>,
  };
});

vi.mock("@/Components/FormInput", () => ({
  default: ({ name, label, description, children }) => (
    <div data-testid={`forminput-${name}`}>
      <label>{label}</label>
      {children}
      {description ? <p>{description}</p> : null}
    </div>
  ),
}));

// Select asli memakai popover; stub native supaya opsi yang tersedia mudah diperiksa.
vi.mock("@/Components/Select", () => ({
  default: ({ value, onValueChange, options }) => (
    <select
      value={value ?? ""}
      onChange={(e) => onValueChange?.(e.target.value)}
    >
      {(options ?? []).map((opt) => (
        <option key={opt} value={opt}>
          {opt}
        </option>
      ))}
    </select>
  ),
}));

vi.mock("./RuleVersionsTab", () => ({
  default: ({ taxId }) => <div data-testid="rule-versions-tab">{taxId}</div>,
}));

const renderForm = (ui) => render(<TooltipProvider>{ui}</TooltipProvider>);

import Form from "./Form";

describe("Finances Taxes Form", () => {
  beforeEach(() => {
    formPageSeed = {};
    usePageMock.mockReturnValue({ props: { preferences: {} } });
  });

  it("mengetik name memanggil setData", async () => {
    const user = userEvent.setup({ delay: null });
    renderForm(<Form />);

    const input = screen.getByTestId("forminput-name").querySelector("input");
    await user.type(input, "PPN 11%");

    expect(input).toHaveValue("PPN 11%");
  });

  it("rate menampilkan suffix '%' dan clamp ke max=100 saat blur", async () => {
    const user = userEvent.setup({ delay: null });
    renderForm(<Form />);

    const input = screen.getByTestId("forminput-rate").querySelector("input");
    await user.type(input, "150");
    await user.tab();

    expect(input.value).toContain("100");
    expect(input.value).toContain("%");
  });

  it("rate clamp ke min=0 saat diketik negatif", async () => {
    const user = userEvent.setup({ delay: null });
    renderForm(<Form />);

    const input = screen.getByTestId("forminput-rate").querySelector("input");
    await user.type(input, "-5");
    await user.tab();

    expect(input.value).toContain("0.00");
  });

  // Checkbox shadcn memakai role "forminput", jadi dicari lewat labelnya.
  const creditable = () =>
    screen.getByLabelText("finances.taxes.columns.is_creditable");

  const optionsOf = (testId) =>
    Array.from(
      screen.getByTestId(testId).querySelectorAll("option"),
      (option) => option.value,
    );

  it("memakai default migration (unclassified, additive, dapat dikreditkan) untuk pajak baru", () => {
    renderForm(<Form />);

    expect(
      screen.getByTestId("forminput-category").querySelector("select"),
    ).toHaveValue("unclassified");
    expect(
      screen.getByTestId("forminput-behavior").querySelector("select"),
    ).toHaveValue("additive");
    expect(creditable()).toHaveAttribute("data-state", "checked");
    expect(screen.queryByTestId("rule-versions-tab")).not.toBeInTheDocument();
  });

  it("kategori PPN membatasi perilaku ke additive dan mengembalikan withholding", async () => {
    const user = userEvent.setup({ delay: null });
    formPageSeed = { id: "t1", category: "pph_23", behavior: "withholding" };
    renderForm(<Form />);

    expect(optionsOf("forminput-category")).not.toContain("ppn_standard");
    expect(optionsOf("forminput-behavior")).toEqual([
      "additive",
      "withholding",
    ]);

    // Beralih ke additive membuka kategori PPN, lalu memilihnya.
    await user.selectOptions(
      screen.getByTestId("forminput-behavior").querySelector("select"),
      "additive",
    );
    await user.selectOptions(
      screen.getByTestId("forminput-category").querySelector("select"),
      "ppn_standard",
    );

    expect(optionsOf("forminput-behavior")).toEqual(["additive"]);
    expect(
      screen.getByText("finances.taxes.form.withholding_ppn_blocked"),
    ).toBeInTheDocument();
  });

  it("memilih kategori PPN saat perilaku withholding tidak dimungkinkan (opsi PPN disaring)", () => {
    formPageSeed = { id: "t1", category: "pph_23", behavior: "withholding" };
    renderForm(<Form />);

    expect(optionsOf("forminput-category")).toEqual([
      "unclassified",
      "pph_21",
      "pph_22",
      "pph_23",
      "pph_4_2",
      "other",
    ]);
  });

  it("checkbox dapat dikreditkan mengikuti nilai tersimpan dan dapat diubah", async () => {
    const user = userEvent.setup({ delay: null });
    formPageSeed = { id: "t1", is_creditable: false };
    renderForm(<Form />);

    expect(creditable()).toHaveAttribute("data-state", "unchecked");
    await user.click(creditable());
    expect(creditable()).toHaveAttribute("data-state", "checked");
  });

  it("menampilkan peringatan hanya untuk pajak unclassified yang sudah terpakai", () => {
    formPageSeed = { id: "t1", category: "unclassified" };
    usePageMock.mockReturnValue({
      props: { unclassifiedUsage: { sales_invoices: 2, purchase_invoices: 1 } },
    });
    const { unmount } = renderForm(<Form />);
    expect(screen.getByRole("alert")).toBeInTheDocument();
    unmount();

    usePageMock.mockReturnValue({
      props: { unclassifiedUsage: { sales_invoices: 0, purchase_invoices: 0 } },
    });
    const second = renderForm(<Form />);
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    second.unmount();

    formPageSeed = { id: "t1", category: "other" };
    usePageMock.mockReturnValue({ props: { unclassifiedUsage: null } });
    renderForm(<Form />);
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("menampilkan tab Versi Aturan hanya untuk pajak tersimpan", () => {
    formPageSeed = { id: "t1" };
    renderForm(<Form />);

    expect(screen.getByTestId("rule-versions-tab")).toHaveTextContent("t1");
  });
});
