import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, within } from "@testing-library/react";
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

vi.mock("@/Pages/CRM/Leads/LeadLinkModel", () => ({
  default: ({ value }) => (
    <div data-testid="lead-link-model">lead:{value?.name ?? "none"}</div>
  ),
}));

vi.mock("@/Pages/Sales/Customers/CustomerLinkModel", () => ({
  default: ({ value }) => (
    <div data-testid="customer-link-model">
      customer:{value?.name ?? "none"}
    </div>
  ),
}));

vi.mock("@/Pages/Users/ManageUsers/UserLinkModel", () => ({
  default: ({ value }) => (
    <div data-testid="user-link-model">assignee:{value?.name ?? "none"}</div>
  ),
}));

vi.mock("@/Components/DatetimePicker", () => ({
  default: () => <div data-testid="datetime-picker" />,
}));

const renderForm = (ui) => render(<TooltipProvider>{ui}</TooltipProvider>);

import Form from "./Form";

describe("CRM Opportunities Form", () => {
  beforeEach(() => {
    formPageSeed = {};
    usePageMock.mockReturnValue({ props: { preferences: {} } });
  });

  it("mengetik title/notes memanggil setData", async () => {
    const user = userEvent.setup({ delay: null });
    renderForm(<Form />);

    const titleInput = within(screen.getByTestId("forminput-title")).getByRole(
      "textbox",
    );
    await user.type(titleInput, "Deal Besar");

    expect(titleInput).toHaveValue("Deal Besar");
  });

  it("mengganti stage memanggil setData('stage', ...)", async () => {
    const user = userEvent.setup({ delay: null });
    renderForm(<Form />);

    const select = within(screen.getByTestId("forminput-stage")).getByRole(
      "combobox",
    );
    await user.selectOptions(select, "negotiation");

    expect(select).toHaveValue("negotiation");
  });

  it("memilih lead/customer/assigned_to menampilkan value terkini", () => {
    formPageSeed = {
      lead: { name: "Lead X" },
      customer: { name: "PT Y" },
      assigned_to: { name: "Budi" },
    };
    renderForm(<Form />);

    expect(screen.getByTestId("lead-link-model")).toHaveTextContent(
      "lead:Lead X",
    );
    expect(screen.getByTestId("customer-link-model")).toHaveTextContent(
      "customer:PT Y",
    );
    expect(screen.getByTestId("user-link-model")).toHaveTextContent(
      "assignee:Budi",
    );
  });

  it("mengetik expected_value (NumberInput) memanggil setData", async () => {
    const user = userEvent.setup({ delay: null });
    renderForm(<Form />);

    const input = within(
      screen.getByTestId("forminput-expected_value"),
    ).getByRole("textbox");
    await user.type(input, "1000000");

    expect(input.value).not.toBe("");
  });

  it("probability NumberInput menerima suffix '%' dan batas min/max 0-100", async () => {
    const user = userEvent.setup({ delay: null });
    renderForm(<Form />);

    const input = within(screen.getByTestId("forminput-probability")).getByRole(
      "textbox",
    );
    await user.type(input, "150");
    await user.tab();

    // onBlur clamp ke max=100, suffix "%" tetap tampil.
    expect(input.value).toContain("100");
    expect(input.value).toContain("%");
  });
});
