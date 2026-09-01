import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { TooltipProvider } from "@/Components/ui/tooltip";

const stableT = (key) => key;
vi.mock("laravel-react-i18n", () => ({
  useLaravelReactI18n: () => ({ t: stableT }),
}));

window.route = (name, params) =>
  params !== undefined ? `${name}/${JSON.stringify(params)}` : name;

let formPageSeed = {};
vi.mock("@/Pages/Core/FormPage", () => ({
  useFormPage: () => {
    const React = require("react");
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
  FormPageContent: ({ title, children }) => (
    <div data-testid={`form-page-content-${title ?? "untitled"}`}>
      {children}
    </div>
  ),
  FormPageContentTitle: ({ children }) => <h2>{children}</h2>,
}));

vi.mock("@/Components/FormInput", () => ({
  default: ({ name, label, children }) => (
    <div data-testid={`forminput-${name}`}>
      <label>{label}</label>
      {children}
    </div>
  ),
}));

vi.mock("@/Components/Select", () => ({
  default: ({ value, onValueChange, options, disabled }) => (
    <select
      data-testid="status-select"
      value={value ?? ""}
      disabled={disabled}
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

vi.mock("@/Pages/Core/LeadSourceLinkModel", () => ({
  default: ({ value }) => (
    <div data-testid="lead-source-link-model">
      source:{value?.name ?? "none"}
    </div>
  ),
}));

vi.mock("@/Pages/Users/ManageUsers/UserLinkModel", () => ({
  default: ({ value }) => (
    <div data-testid="user-link-model">assignee:{value?.name ?? "none"}</div>
  ),
}));

vi.mock("@/Pages/Core/CountryLinkModel", () => ({
  default: ({ value }) => (
    <div data-testid="country-link-model">country:{value?.name ?? "none"}</div>
  ),
}));

vi.mock("./LeadActivities", () => ({
  default: ({ value, onValueChange }) => (
    <div data-testid="lead-activities">
      activities:{value?.length ?? 0}
      <button type="button" onClick={() => onValueChange?.([{ id: 1 }])}>
        add-activity
      </button>
    </div>
  ),
}));

const renderForm = (ui) => render(<TooltipProvider>{ui}</TooltipProvider>);

import Form from "./Form";

describe("CRM Leads Form", () => {
  beforeEach(() => {
    formPageSeed = {};
  });

  it("mengetik company_name/contact_name/email/phone/notes memanggil setData", async () => {
    const user = userEvent.setup({ delay: null });
    renderForm(<Form />);

    const companyInput = within(
      screen.getByTestId("forminput-company_name"),
    ).getByRole("textbox");
    await user.type(companyInput, "PT ABC");

    expect(companyInput).toHaveValue("PT ABC");
  });

  it("status Select TIDAK disabled saat status belum 'converted'", () => {
    formPageSeed = { status: "new" };
    renderForm(<Form />);

    expect(screen.getByTestId("status-select")).not.toBeDisabled();
  });

  it("status Select disabled ketika status sudah 'converted'", () => {
    formPageSeed = { status: "converted" };
    renderForm(<Form />);

    expect(screen.getByTestId("status-select")).toBeDisabled();
  });

  it("mengganti status memanggil setData('status', ...)", async () => {
    const user = userEvent.setup({ delay: null });
    formPageSeed = { status: "new" };
    renderForm(<Form />);

    await user.selectOptions(screen.getByTestId("status-select"), "contacted");

    expect(screen.getByTestId("status-select")).toHaveValue("contacted");
  });

  it("memilih lead_source/assigned_to/country menampilkan value terkini", () => {
    formPageSeed = {
      lead_source: { name: "Website" },
      assigned_to: { name: "Budi" },
      country: { name: "Indonesia" },
    };
    renderForm(<Form />);

    expect(screen.getByTestId("lead-source-link-model")).toHaveTextContent(
      "source:Website",
    );
    expect(screen.getByTestId("user-link-model")).toHaveTextContent(
      "assignee:Budi",
    );
    expect(screen.getByTestId("country-link-model")).toHaveTextContent(
      "country:Indonesia",
    );
  });

  it("mengetik street/city/province/zip_code memanggil setData", async () => {
    const user = userEvent.setup({ delay: null });
    renderForm(<Form />);

    const cityInput = within(screen.getByTestId("forminput-city")).getByRole(
      "textbox",
    );
    await user.type(cityInput, "Jakarta");

    expect(cityInput).toHaveValue("Jakarta");
  });

  it("LeadActivities menerima data.activities dan meneruskan perubahan via setData", async () => {
    const user = userEvent.setup({ delay: null });
    formPageSeed = { activities: [] };
    renderForm(<Form />);

    expect(screen.getByTestId("lead-activities")).toHaveTextContent(
      "activities:0",
    );

    await user.click(screen.getByText("add-activity"));

    expect(screen.getByTestId("lead-activities")).toHaveTextContent(
      "activities:1",
    );
  });

  it("activities default array kosong saat data.activities undefined", () => {
    renderForm(<Form />);
    expect(screen.getByTestId("lead-activities")).toHaveTextContent(
      "activities:0",
    );
  });
});
