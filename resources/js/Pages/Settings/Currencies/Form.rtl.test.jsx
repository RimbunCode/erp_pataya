import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { TooltipProvider } from "@/Components/ui/tooltip";

const stableT = (key) => key;
vi.mock("laravel-react-i18n", () => ({
  useLaravelReactI18n: () => ({ t: stableT }),
}));

let formPageSeed = {};
let formPageIsCreate = true;
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
      return { data, setData, isCreate: formPageIsCreate };
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

const renderForm = (ui) => render(<TooltipProvider>{ui}</TooltipProvider>);

import Form from "./Form";

describe("Settings Currencies Form", () => {
  beforeEach(() => {
    formPageSeed = {};
    formPageIsCreate = true;
  });

  it("mengetik code otomatis di-uppercase", async () => {
    const user = userEvent.setup({ delay: null });
    renderForm(<Form />);

    const codeInput = screen
      .getByTestId("forminput-code")
      .querySelector("input");
    await user.type(codeInput, "idr");

    expect(codeInput).toHaveValue("IDR");
  });

  it("field code disabled saat isCreate=false (edit mode)", () => {
    formPageIsCreate = false;
    renderForm(<Form />);

    expect(
      screen.getByTestId("forminput-code").querySelector("input"),
    ).toBeDisabled();
  });

  it("mengetik name/symbol/number_format memanggil setData", async () => {
    const user = userEvent.setup({ delay: null });
    renderForm(<Form />);

    const nameInput = screen
      .getByTestId("forminput-name")
      .querySelector("input");
    await user.type(nameInput, "Rupiah");

    expect(nameInput).toHaveValue("Rupiah");
  });
});
