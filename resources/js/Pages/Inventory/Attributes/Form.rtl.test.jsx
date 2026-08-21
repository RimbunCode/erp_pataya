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
    FormPageContent: ({ children }) => <div>{children}</div>,
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

vi.mock("@/Components/FormTable", () => ({
  default: ({ label, value }) => (
    <div data-testid="stub-form-table">
      <span>{label}</span>
      <span data-testid="values-count">{(value ?? []).length}</span>
    </div>
  ),
}));

const renderForm = (ui) => render(<TooltipProvider>{ui}</TooltipProvider>);

import Form from "./Form";

describe("Inventory Attributes Form", () => {
  beforeEach(() => {
    formPageSeed = {};
    usePageMock.mockReturnValue({ props: { preferences: {} } });
  });

  it("is_numeric=false menampilkan FormTable values, TIDAK menampilkan range fields", () => {
    formPageSeed = { is_numeric: false, values: [{ value: "Merah" }] };
    renderForm(<Form />);

    expect(screen.getByTestId("stub-form-table")).toBeInTheDocument();
    expect(screen.getByTestId("values-count")).toHaveTextContent("1");
    expect(screen.queryByTestId("forminput-from_range")).not.toBeInTheDocument();
  });

  it("is_numeric=true menampilkan range fields (from_range/to_range/increment), TIDAK menampilkan FormTable values", () => {
    formPageSeed = { is_numeric: true };
    renderForm(<Form />);

    expect(screen.getByTestId("forminput-from_range")).toBeInTheDocument();
    expect(screen.getByTestId("forminput-to_range")).toBeInTheDocument();
    expect(screen.getByTestId("forminput-increment")).toBeInTheDocument();
    expect(screen.queryByTestId("stub-form-table")).not.toBeInTheDocument();
  });

  it("toggle checkbox is_numeric mengganti tampilan dari values ke range fields", async () => {
    const user = userEvent.setup({ delay: null });
    formPageSeed = { is_numeric: false, values: [] };
    renderForm(<Form />);

    expect(screen.getByTestId("stub-form-table")).toBeInTheDocument();

    const checkbox = screen.getByRole("forminput");
    await user.click(checkbox);

    expect(screen.queryByTestId("stub-form-table")).not.toBeInTheDocument();
    expect(screen.getByTestId("forminput-from_range")).toBeInTheDocument();
  });

  it("mengetik name/description memanggil setData", async () => {
    const user = userEvent.setup({ delay: null });
    formPageSeed = { is_numeric: false, values: [] };
    renderForm(<Form />);

    const nameInput = screen
      .getByTestId("forminput-name")
      .querySelector("input");
    await user.type(nameInput, "Warna");

    expect(nameInput).toHaveValue("Warna");
  });
});
