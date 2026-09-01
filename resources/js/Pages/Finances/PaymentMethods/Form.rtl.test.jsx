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

vi.mock("../Accounts/AccountLinkModel", () => ({
  default: ({ value, filters }) => (
    <div
      data-testid="account-link-model"
      data-filters={JSON.stringify(filters ?? {})}
    >
      account:{value?.name ?? "none"}
    </div>
  ),
}));

const renderForm = (ui) => render(<TooltipProvider>{ui}</TooltipProvider>);

import Form from "./Form";

describe("Finances PaymentMethods Form", () => {
  beforeEach(() => {
    formPageSeed = {};
  });

  it("mengetik name/description memanggil setData", async () => {
    const user = userEvent.setup({ delay: null });
    renderForm(<Form />);

    const input = screen.getByTestId("forminput-name").querySelector("input");
    await user.type(input, "Transfer Bank");

    expect(input).toHaveValue("Transfer Bank");
  });

  it("default_account memfilter root_type=asset dan is_group=false", () => {
    renderForm(<Form />);

    expect(screen.getByTestId("account-link-model")).toHaveAttribute(
      "data-filters",
      JSON.stringify({ root_type: "asset", is_group: false }),
    );
  });

  it("memilih default_account menampilkan value terkini", () => {
    formPageSeed = { default_account: { name: "Kas BCA" } };
    renderForm(<Form />);

    expect(screen.getByTestId("account-link-model")).toHaveTextContent(
      "account:Kas BCA",
    );
  });
});
