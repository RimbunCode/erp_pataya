import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { TooltipProvider } from "@/Components/ui/tooltip";

const stableT = (key) => key;
vi.mock("laravel-react-i18n", () => ({
  useLaravelReactI18n: () => ({ t: stableT }),
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
  default: ({ name, label, children }) => (
    <div data-testid={`forminput-${name}`}>
      <label>{label}</label>
      {children}
    </div>
  ),
}));

vi.mock("@/Components/Select", () => ({
  default: ({ value, onValueChange, options }) => (
    <select
      value={value ?? ""}
      onChange={(e) => onValueChange?.(e.target.value)}
    >
      <option value="" />
      {(options ?? []).map((opt) => (
        <option key={opt} value={opt}>
          opt:{opt}
        </option>
      ))}
    </select>
  ),
}));

vi.mock("../Units/UnitLinkModel", () => ({
  default: ({ value }) => (
    <div data-testid="unit-link-model">unit:{value?.name ?? "none"}</div>
  ),
}));

const renderForm = (ui) => render(<TooltipProvider>{ui}</TooltipProvider>);

import Form from "./Form";

describe("Inventory Categories Form", () => {
  beforeEach(() => {
    formPageSeed = {};
  });

  it("mengetik name memanggil setData", async () => {
    const user = userEvent.setup({ delay: null });
    renderForm(<Form />);

    const input = screen.getByTestId("forminput-name").querySelector("input");
    await user.type(input, "Elektronik");

    expect(input).toHaveValue("Elektronik");
  });

  it("mengganti type memanggil setData", async () => {
    const user = userEvent.setup({ delay: null });
    renderForm(<Form />);

    const select = screen.getByTestId("forminput-type").querySelector("select");
    await user.selectOptions(select, "vehicle");

    expect(select).toHaveValue("vehicle");
  });

  it("memilih default_unit menampilkan value terkini", () => {
    formPageSeed = { default_unit: { name: "PCS" } };
    renderForm(<Form />);

    expect(screen.getByTestId("unit-link-model")).toHaveTextContent("unit:PCS");
  });
});
