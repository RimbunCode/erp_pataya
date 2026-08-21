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
  default: ({ name, label, children }) => (
    <div data-testid={`forminput-${name}`}>
      <label>{label}</label>
      {children}
    </div>
  ),
}));

vi.mock("@/Pages/Asset/Assets/AssetLinkModel", () => ({
  default: ({ value }) => (
    <div data-testid="asset-link-model">asset:{value?.name ?? "none"}</div>
  ),
}));

vi.mock("@/Pages/Finances/Accounts/AccountLinkModel", () => ({
  default: ({ value }) => (
    <div data-testid="account-link-model">
      account:{value?.name ?? "none"}
    </div>
  ),
}));

const renderForm = (ui) => render(<TooltipProvider>{ui}</TooltipProvider>);

import Form from "./Form";

describe("Asset ValueAdjustments Form", () => {
  beforeEach(() => {
    formPageSeed = {};
    usePageMock.mockReturnValue({ props: { preferences: {} } });
  });

  it("memilih asset/difference_account menampilkan value terkini", () => {
    formPageSeed = {
      asset: { name: "Laptop A" },
      difference_account: { name: "Loss on Revaluation" },
    };
    renderForm(<Form />);

    expect(screen.getByTestId("asset-link-model")).toHaveTextContent(
      "asset:Laptop A",
    );
    expect(screen.getByTestId("account-link-model")).toHaveTextContent(
      "account:Loss on Revaluation",
    );
  });

  it("current_asset_value selalu disabled (read-only)", () => {
    formPageSeed = { current_asset_value: 5000000 };
    renderForm(<Form />);

    const input = screen
      .getByTestId("forminput-current_asset_value")
      .querySelector("input");
    expect(input).toBeDisabled();
    expect(input).toHaveValue("5,000,000.00");
  });

  it("mengetik new_asset_value memanggil setData", async () => {
    const user = userEvent.setup({ delay: null });
    renderForm(<Form />);

    const input = screen
      .getByTestId("forminput-new_asset_value")
      .querySelector("input");
    await user.type(input, "1000");

    expect(input.value).not.toBe("");
  });

  it("mengetik date memanggil setData", async () => {
    const user = userEvent.setup({ delay: null });
    renderForm(<Form />);

    const input = screen
      .getByTestId("forminput-date")
      .querySelector('input[type="date"]');
    await user.type(input, "2026-01-15");

    expect(input).toHaveValue("2026-01-15");
  });
});
