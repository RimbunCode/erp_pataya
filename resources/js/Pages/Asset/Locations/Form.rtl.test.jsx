import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { TooltipProvider } from "@/Components/ui/tooltip";

const stableT = (key) => key;
vi.mock("laravel-react-i18n", () => ({
  useLaravelReactI18n: () => ({ t: stableT }),
}));

const usePageMock = vi.fn(() => ({ props: {} }));
vi.mock("@inertiajs/react", () => ({
  usePage: () => usePageMock(),
}));

let formPageSeed = {};
vi.mock("@/Pages/Core/FormPage", async () => {
  const React = await import("react");
  return {
    useFormPage: (defaultValue) => {
      const [data, setDataState] = React.useState(() => ({
        ...(defaultValue ?? {}),
        ...formPageSeed,
      }));
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
  default: ({ value, filters, disabled }) => (
    <div
      data-testid="branch-link-model"
      data-filters={JSON.stringify(filters ?? {})}
      data-disabled={String(!!disabled)}
    >
      branch:{value?.name ?? "none"}
    </div>
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
      JSON.stringify({ id: { not: 5 }, branch_id: null }),
    );
  });

  it("parent difilter oleh branch yang dipilih", () => {
    formPageSeed = { id: 5, branch: { id: "b1", name: "Cabang A" } };
    renderForm(<Form />);

    expect(screen.getByTestId("parent-link-model")).toHaveAttribute(
      "data-filters",
      JSON.stringify({ id: { not: 5 }, branch_id: "b1" }),
    );
  });

  it("field branch selalu dirender & prefill currentBranch saat create (akses main branch)", () => {
    const mainBranch = { id: "main", name: "HQ", is_main_branch: true };
    usePageMock.mockReturnValue({
      props: {
        branchSettings: { branches: [mainBranch], currentBranch: mainBranch },
      },
    });
    renderForm(<Form />);

    const branchEl = screen.getByTestId("branch-link-model");
    expect(branchEl).toHaveTextContent("branch:HQ");
    expect(branchEl).toHaveAttribute("data-disabled", "false");
    expect(branchEl).toHaveAttribute(
      "data-filters",
      JSON.stringify({ branchable_type: null, branchable_id: null }),
    );
  });

  it("field branch disabled & filter id:in ketika user hanya akses 1 branch non-main", () => {
    const branchB = { id: "b1", name: "Cabang B", is_main_branch: false };
    usePageMock.mockReturnValue({
      props: {
        branchSettings: { branches: [branchB], currentBranch: branchB },
      },
    });
    renderForm(<Form />);

    const branchEl = screen.getByTestId("branch-link-model");
    expect(branchEl).toHaveTextContent("branch:Cabang B");
    expect(branchEl).toHaveAttribute("data-disabled", "true");
    expect(branchEl).toHaveAttribute(
      "data-filters",
      JSON.stringify({
        branchable_type: null,
        branchable_id: null,
        id: { in: ["b1"] },
      }),
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
