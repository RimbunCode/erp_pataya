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

vi.mock("@/Pages/Settings/Branches/BranchLinkModel", () => ({
  default: ({ value, filters }) => (
    <div data-testid="branch-link-model" data-filters={JSON.stringify(filters ?? {})}>
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

  it("field branch TIDAK dirender saat currentBranch bukan main branch", () => {
    usePageMock.mockReturnValue({
      props: { branchSettings: { currentBranch: { is_main_branch: false } } },
    });
    renderForm(<Form />);

    expect(screen.queryByTestId("forminput-branch")).not.toBeInTheDocument();
  });

  it("field branch dirender saat currentBranch adalah main branch", () => {
    usePageMock.mockReturnValue({
      props: { branchSettings: { currentBranch: { is_main_branch: true } } },
    });
    renderForm(<Form />);

    expect(screen.getByTestId("forminput-branch")).toBeInTheDocument();
    expect(screen.getByTestId("branch-link-model")).toHaveAttribute(
      "data-filters",
      JSON.stringify({ branchable_type: null, branchable_id: null }),
    );
  });

  it("field branch TIDAK dirender saat branchSettings undefined (fallback aman)", () => {
    usePageMock.mockReturnValue({ props: {} });
    renderForm(<Form />);

    expect(screen.queryByTestId("forminput-branch")).not.toBeInTheDocument();
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

    expect(screen.getByTestId("user-link-model")).toHaveTextContent(
      "pic:Budi",
    );
  });
});
