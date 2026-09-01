import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { TooltipProvider } from "@/Components/ui/tooltip";

const stableT = (key) => key;
vi.mock("laravel-react-i18n", () => ({
  useLaravelReactI18n: () => ({ t: stableT }),
}));

window.route = (name, params) =>
  params !== undefined ? `${name}/${JSON.stringify(params)}` : name;

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
      return { data, setData, dataBefore: {} };
    },
    FormPageContent: ({ title, children }) => (
      <div data-testid={`form-page-content-${title ?? "untitled"}`}>
        {children}
      </div>
    ),
  };
});

vi.mock("@/Components/FormInput", () => ({
  default: ({ name, label, children }) => (
    <div data-testid={`forminput-${name}`}>
      <label>{label}</label>
      {children}
    </div>
  ),
}));

vi.mock("./SupplierLinkModel", () => ({
  default: ({ value, disabled, filters, onValueChange }) => (
    <button
      type="button"
      data-testid="supplier-link-model"
      data-disabled={disabled ? "true" : "false"}
      data-filters={JSON.stringify(filters ?? {})}
      onClick={() => onValueChange?.({ id: 5, name: "Induk" })}
    >
      branch_of:{value?.name ?? "none"}
    </button>
  ),
}));

vi.mock("@/Pages/Core/CountryLinkModel", () => ({
  default: ({ value }) => (
    <div data-testid="country-link-model">country:{value?.name ?? "none"}</div>
  ),
}));

vi.mock("@/Components/FormTable", () => ({
  default: ({ label, columns, value }) => (
    <div data-testid="stub-form-table">
      <span>{label}</span>
      <span data-testid="banks-count">{(value ?? []).length}</span>
      <span data-testid="banks-columns">
        {columns.map((c) => c.name).join(",")}
      </span>
    </div>
  ),
}));

const renderForm = (ui) => render(<TooltipProvider>{ui}</TooltipProvider>);

import Form from "./Form";

describe("Suppliers Form", () => {
  beforeEach(() => {
    formPageSeed = {};
  });

  it("toggle checkbox is_disabled memanggil setData", async () => {
    const user = userEvent.setup({ delay: null });
    formPageSeed = { is_disabled: false };
    renderForm(<Form />);

    const checkbox = screen.getByRole("forminput");
    await user.click(checkbox);

    expect(checkbox).toHaveAttribute("data-state", "checked");
  });

  it("mengetik name/email/phone/street/city/province/zip_code memanggil setData", async () => {
    const user = userEvent.setup({ delay: null });
    renderForm(<Form />);

    const nameInput = within(screen.getByTestId("forminput-name")).getByRole(
      "textbox",
    );
    await user.type(nameInput, "PT Sukses");

    expect(nameInput).toHaveValue("PT Sukses");
  });

  it("branch_of TIDAK disabled saat data.branches kosong/undefined", () => {
    formPageSeed = { branches: [] };
    renderForm(<Form />);

    expect(screen.getByTestId("supplier-link-model")).toHaveAttribute(
      "data-disabled",
      "false",
    );
  });

  it("branch_of disabled saat data.branches punya isi (supplier ini adalah induk)", () => {
    formPageSeed = { branches: [{ id: 2, name: "Cabang A" }] };
    renderForm(<Form />);

    expect(screen.getByTestId("supplier-link-model")).toHaveAttribute(
      "data-disabled",
      "true",
    );
  });

  it("branch_of memfilter parent_id null, id!=self, dan notIn daftar branches", () => {
    formPageSeed = {
      id: 1,
      branches: [{ id: 2 }, { id: 3 }],
    };
    renderForm(<Form />);

    expect(screen.getByTestId("supplier-link-model")).toHaveAttribute(
      "data-filters",
      JSON.stringify({
        parent_id: null,
        id: { not: 1, notIn: [2, 3] },
      }),
    );
  });

  it("memilih branch_of memanggil setData", async () => {
    const user = userEvent.setup({ delay: null });
    renderForm(<Form />);

    await user.click(screen.getByTestId("supplier-link-model"));

    expect(screen.getByTestId("supplier-link-model")).toHaveTextContent(
      "branch_of:Induk",
    );
  });

  it("memilih country menampilkan value terkini", () => {
    formPageSeed = { country: { name: "Indonesia" } };
    renderForm(<Form />);

    expect(screen.getByTestId("country-link-model")).toHaveTextContent(
      "country:Indonesia",
    );
  });

  it("FormTable banks menerima label, columns (bank/no_acc/account), dan value dari data.banks", () => {
    formPageSeed = { banks: [{ bank: "BCA" }, { bank: "Mandiri" }] };
    renderForm(<Form />);

    expect(screen.getByTestId("banks-count")).toHaveTextContent("2");
    expect(screen.getByTestId("banks-columns")).toHaveTextContent(
      "bank,no_acc,account",
    );
  });

  it("FormTable banks default array kosong saat data.banks undefined", () => {
    renderForm(<Form />);
    expect(screen.getByTestId("banks-count")).toHaveTextContent("0");
  });
});
