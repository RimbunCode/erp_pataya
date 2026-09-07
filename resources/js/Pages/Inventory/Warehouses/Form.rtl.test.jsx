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

vi.mock("@/Pages/Users/ManageUsers/UserLinkModel", () => ({
  default: ({ value }) => (
    <div data-testid="user-link-model">pic:{value?.name ?? "none"}</div>
  ),
}));

vi.mock("../Items/FormStockLevels", () => ({
  default: () => <div data-testid="stub-stock-levels" />,
}));

const renderForm = (ui) => render(<TooltipProvider>{ui}</TooltipProvider>);

import Form from "./Form";

describe("Inventory Warehouses Form", () => {
  beforeEach(() => {
    formPageSeed = {};
  });

  it("field branch selalu dirender & prefill currentBranch saat create (akses main branch)", () => {
    const mainBranch = { id: "main", name: "HQ", is_main_branch: true };
    usePageMock.mockReturnValue({
      props: {
        branchSettings: { branches: [mainBranch], currentBranch: mainBranch },
      },
    });
    renderForm(<Form />);

    expect(screen.getByTestId("forminput-branch")).toBeInTheDocument();
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

  it("field branch TIDAK disabled & filter dibatasi daftar akses saat user akses beberapa branch non-main", () => {
    const branchA = { id: "b1", name: "Cabang A", is_main_branch: false };
    const branchB = { id: "b2", name: "Cabang B", is_main_branch: false };
    usePageMock.mockReturnValue({
      props: {
        branchSettings: {
          branches: [branchA, branchB],
          currentBranch: branchA,
        },
      },
    });
    renderForm(<Form />);

    const branchEl = screen.getByTestId("branch-link-model");
    expect(branchEl).toHaveAttribute("data-disabled", "false");
    expect(branchEl).toHaveAttribute(
      "data-filters",
      JSON.stringify({
        branchable_type: null,
        branchable_id: null,
        id: { in: ["b1", "b2"] },
      }),
    );
  });

  it("mengetik code/name memanggil setData", async () => {
    const user = userEvent.setup({ delay: null });
    usePageMock.mockReturnValue({ props: {} });
    renderForm(<Form />);

    const codeInput = screen
      .getByTestId("forminput-code")
      .querySelector("input");
    await user.type(codeInput, "GD1");

    expect(codeInput).toHaveValue("GD1");
  });

  it("memilih pic menampilkan value terkini", () => {
    usePageMock.mockReturnValue({ props: {} });
    formPageSeed = { pic: { name: "Budi" } };
    renderForm(<Form />);

    expect(screen.getByTestId("user-link-model")).toHaveTextContent("pic:Budi");
  });
});
