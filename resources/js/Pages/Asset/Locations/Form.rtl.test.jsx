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

vi.mock("./AssetLocationLinkModel", () => ({
  default: ({ value, filters }) => (
    <div
      data-testid="parent-link-model"
      data-filters={JSON.stringify(filters ?? {})}
    >
      parent:{value?.name ?? "none"}
    </div>
  ),
}));

vi.mock("@/Pages/Settings/Branches/BranchLinkModel", () => ({
  default: ({ value }) => (
    <div data-testid="branch-link-model">branch:{value?.name ?? "none"}</div>
  ),
}));

const renderForm = (ui) => render(<TooltipProvider>{ui}</TooltipProvider>);

import Form from "./Form";

describe("Asset Locations Form", () => {
  beforeEach(() => {
    formPageSeed = {};
  });

  it("mengetik location_name memanggil setData", async () => {
    const user = userEvent.setup({ delay: null });
    renderForm(<Form />);

    const input = screen
      .getByTestId("forminput-location_name")
      .querySelector("input");
    await user.type(input, "Gudang Utama");

    expect(input).toHaveValue("Gudang Utama");
  });

  it("parent memfilter id!=self (mencegah lokasi jadi parent dirinya sendiri)", () => {
    formPageSeed = { id: 5 };
    renderForm(<Form />);

    expect(screen.getByTestId("parent-link-model")).toHaveAttribute(
      "data-filters",
      JSON.stringify({ id: { not: 5 } }),
    );
  });

  it("toggle checkbox is_group memanggil setData", async () => {
    const user = userEvent.setup({ delay: null });
    formPageSeed = { is_group: false };
    renderForm(<Form />);

    const checkbox = screen.getByRole("forminput");
    await user.click(checkbox);

    expect(checkbox).toHaveAttribute("data-state", "checked");
  });

  it("memilih branch/parent menampilkan value terkini", () => {
    formPageSeed = {
      branch: { name: "Cabang A" },
      parent: { name: "Gudang Induk" },
    };
    renderForm(<Form />);

    expect(screen.getByTestId("branch-link-model")).toHaveTextContent(
      "branch:Cabang A",
    );
    expect(screen.getByTestId("parent-link-model")).toHaveTextContent(
      "parent:Gudang Induk",
    );
  });
});
