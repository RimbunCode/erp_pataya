import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { TooltipProvider } from "@/Components/ui/tooltip";

const stableT = (key) => key;
vi.mock("laravel-react-i18n", () => ({
  useLaravelReactI18n: () => ({ t: stableT }),
}));

let formPageSeed = {};
let formPageDisabled = false;
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
      return { data, setData, disabled: formPageDisabled };
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

vi.mock("@/Pages/Users/ManageUsers/UserLinkModel", () => ({
  default: ({ value }) => (
    <div data-testid="user-link-model">user:{value?.name ?? "none"}</div>
  ),
}));

vi.mock("@/Pages/Settings/Branches/BranchLinkModel", () => ({
  default: ({ value }) => (
    <div data-testid="branch-link-model">branch:{value?.name ?? "none"}</div>
  ),
}));

vi.mock("@/Components/FormTable", () => ({
  default: ({ readOnly, value, mapItem }) => (
    <div
      data-testid="stub-form-table"
      data-readonly={readOnly ? "true" : "false"}
      data-count={(value ?? []).length}
      data-mapped-id={
        mapItem?.({ item: { name: "Budi" } })?.id ? "has-id" : "no-id"
      }
    />
  ),
}));

const renderForm = (ui) => render(<TooltipProvider>{ui}</TooltipProvider>);

import Form from "./Form";

describe("Asset MaintenanceTeams Form", () => {
  beforeEach(() => {
    formPageSeed = {};
    formPageDisabled = false;
  });

  it("mengetik team_name memanggil setData", async () => {
    const user = userEvent.setup({ delay: null });
    renderForm(<Form />);

    const input = screen
      .getByTestId("forminput-team_name")
      .querySelector("input");
    await user.type(input, "Tim Elektrik");

    expect(input).toHaveValue("Tim Elektrik");
  });

  it("memilih manager/branch menampilkan value terkini", () => {
    formPageSeed = {
      manager: { name: "Budi" },
      branch: { name: "Cabang A" },
    };
    renderForm(<Form />);

    expect(screen.getByTestId("user-link-model")).toHaveTextContent(
      "user:Budi",
    );
    expect(screen.getByTestId("branch-link-model")).toHaveTextContent(
      "branch:Cabang A",
    );
  });

  it("FormTable members readOnly mengikuti disabled form", () => {
    formPageDisabled = true;
    formPageSeed = { members: [{ id: "m1" }] };
    renderForm(<Form />);

    const table = screen.getByTestId("stub-form-table");
    expect(table).toHaveAttribute("data-readonly", "true");
    expect(table).toHaveAttribute("data-count", "1");
  });

  it("mapItem menambahkan id fallback via generateRandom saat item belum punya id", () => {
    renderForm(<Form />);

    expect(screen.getByTestId("stub-form-table")).toHaveAttribute(
      "data-mapped-id",
      "has-id",
    );
  });
});
