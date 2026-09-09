import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { TooltipProvider } from "@/Components/ui/tooltip";

const stableT = (key) => key;
vi.mock("laravel-react-i18n", () => ({
  useLaravelReactI18n: () => ({ t: stableT }),
}));

const routerPost = vi.fn();
vi.mock("@inertiajs/react", () => ({
  router: { post: (...a) => routerPost(...a) },
  usePage: () => ({
    props: { preferences: { default_number_format: "#,###.##" } },
  }),
}));

window.route = (name, id) => `${name}/${id}`;

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
    FormPageContent: ({ title, children }) => (
      <div data-testid={`form-page-content-${title ?? "untitled"}`}>
        {children}
      </div>
    ),
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

// Select (Radix native, dari @/Components/ui/select) di-stub jadi native
// <select> sederhana -- fokus test ada di logic gating `type`/cascade,
// bukan detail interaksi Radix Select.
vi.mock("@/Components/ui/select", () => ({
  Select: ({ value, onValueChange, disabled, children }) => (
    <select
      data-testid="type-select"
      value={value ?? ""}
      disabled={disabled}
      onChange={(e) => onValueChange?.(e.target.value)}
    >
      {children}
    </select>
  ),
  SelectTrigger: ({ children }) => children,
  SelectValue: () => null,
  SelectContent: ({ children }) => children,
  SelectItem: ({ value, children }) => (
    <option value={value}>{children}</option>
  ),
}));

vi.mock("@/Pages/Asset/Assets/AssetLinkModel", () => ({
  default: ({ value, filters }) => (
    <div
      data-testid="asset-link-model"
      data-filters={JSON.stringify(filters ?? {})}
    >
      asset:{value?.name ?? "none"}
    </div>
  ),
}));

vi.mock("@/Components/DatetimePicker", () => ({
  default: () => <div data-testid="datetime-picker" />,
}));

vi.mock("@/Pages/Inventory/Items/ItemLinkModel", () => ({
  default: () => <div data-testid="item-link-model" />,
}));

vi.mock("@/Pages/Inventory/Items/ItemUnitLinkModel", () => ({
  default: () => <div data-testid="item-unit-link-model" />,
}));

// Ditangkap via captured.formTableProps supaya test bisa memanggil
// consumedItemColumns[].cell(...) langsung (pure logic), sama pola dengan
// Sales/InternalOrders dan Sales/SalesOrders Form.rtl.test.jsx.
const captured = {};
vi.mock("@/Components/FormTable", () => ({
  default: ({ readOnly, value, columns }) => {
    captured.formTableProps = { readOnly, value, columns };
    return (
      <div
        data-testid="stub-form-table"
        data-readonly={readOnly ? "true" : "false"}
        data-count={(value ?? []).length}
      />
    );
  },
}));

const renderForm = (ui) => render(<TooltipProvider>{ui}</TooltipProvider>);

import Form from "./Form";

describe("Asset Services Form", () => {
  beforeEach(() => {
    formPageSeed = {};
    formPageDisabled = false;
    routerPost.mockReset();
  });

  it("type='repair' menampilkan field asset/failure_date/capitalize_repair_cost, TIDAK menampilkan asset_maintenance_task", () => {
    formPageSeed = { type: "repair" };
    renderForm(<Form />);

    expect(screen.getByTestId("forminput-asset")).toBeInTheDocument();
    expect(screen.getByTestId("forminput-failure_date")).toBeInTheDocument();
    expect(
      screen.getByLabelText("asset.service.columns.capitalize_repair_cost"),
    ).toBeInTheDocument();
    expect(
      screen.queryByTestId("forminput-asset_maintenance_task"),
    ).not.toBeInTheDocument();
  });

  it("AssetLinkModel difilter hanya status active/issued/in_maintenance", () => {
    formPageSeed = { type: "repair" };
    renderForm(<Form />);

    const assetLink = screen.getByTestId("asset-link-model");
    expect(JSON.parse(assetLink.dataset.filters)).toEqual({
      status: {
        jsonContains: ["active", "issued", "in_maintenance"],
      },
    });
  });

  it("type='maintenance_task' menampilkan field asset_maintenance_task (read-only), TIDAK menampilkan field repair", () => {
    formPageSeed = {
      type: "maintenance_task",
      assetMaintenanceTask: { task_name: "Ganti Oli" },
    };
    renderForm(<Form />);

    const taskField = within(
      screen.getByTestId("forminput-asset_maintenance_task"),
    ).getByRole("textbox");
    expect(taskField).toHaveValue("Ganti Oli");
    expect(taskField).toBeDisabled();
    expect(screen.queryByTestId("forminput-asset")).not.toBeInTheDocument();
  });

  it("capitalize_repair_cost=true menampilkan field increase_in_asset_life", async () => {
    const user = userEvent.setup({ delay: null });
    formPageSeed = { type: "repair", capitalize_repair_cost: false };
    renderForm(<Form />);

    expect(
      screen.queryByTestId("forminput-increase_in_asset_life"),
    ).not.toBeInTheDocument();

    const checkbox = screen.getByRole("forminput");
    await user.click(checkbox);

    expect(
      screen.getByTestId("forminput-increase_in_asset_life"),
    ).toBeInTheDocument();
  });

  it("canBillToRenter=false (belum approved) TIDAK menampilkan checkbox bill_to_renter", () => {
    formPageSeed = { type: "repair", status: [], has_active_renter: true };
    renderForm(<Form />);

    expect(
      screen.queryByLabelText("asset.service.columns.bill_to_renter"),
    ).not.toBeInTheDocument();
  });

  it("canBillToRenter=false (approved tapi TIDAK has_active_renter) TIDAK menampilkan checkbox bill_to_renter", () => {
    formPageSeed = {
      type: "repair",
      status: ["approved"],
      has_active_renter: false,
    };
    renderForm(<Form />);

    expect(
      screen.queryByLabelText("asset.service.columns.bill_to_renter"),
    ).not.toBeInTheDocument();
  });

  it("canBillToRenter=true (approved + has_active_renter) menampilkan checkbox bill_to_renter", () => {
    formPageSeed = {
      type: "repair",
      status: ["approved"],
      has_active_renter: true,
    };
    renderForm(<Form />);

    expect(
      screen.getByLabelText("asset.service.columns.bill_to_renter"),
    ).toBeInTheDocument();
  });

  it("klik checkbox bill_to_renter memanggil router.post ke assetServices.billToRenter", async () => {
    const user = userEvent.setup({ delay: null });
    formPageSeed = {
      id: 9,
      type: "repair",
      status: ["approved"],
      has_active_renter: true,
      bill_to_renter: false,
    };
    renderForm(<Form />);

    // Ada 2 checkbox di halaman (capitalize_repair_cost & bill_to_renter) --
    // disambiguasi lewat label text (FormCheckbox merender <label htmlFor>
    // sungguhan, bukan lewat testid FormInput lagi).
    const checkbox = screen.getByLabelText(
      "asset.service.columns.bill_to_renter",
    );
    await user.click(checkbox);

    expect(routerPost).toHaveBeenCalledWith("assetServices.billToRenter/9");
  });

  it("uncheck bill_to_renter (val=false) TIDAK memanggil router.post (checkbox disabled saat sudah true, tapi guard tetap ada)", async () => {
    formPageSeed = {
      id: 9,
      type: "repair",
      status: ["approved"],
      has_active_renter: true,
      bill_to_renter: true,
    };
    renderForm(<Form />);

    // Checkbox disabled saat bill_to_renter sudah true -- tidak bisa diklik
    // untuk uncheck (guard `if (!val) return` di source untuk kasus lain).
    const checkbox = screen.getByLabelText(
      "asset.service.columns.bill_to_renter",
    );
    expect(checkbox).toBeDisabled();
    expect(routerPost).not.toHaveBeenCalled();
  });

  it("bill_to_renter=true menampilkan field customer & customer_branch (read-only)", () => {
    formPageSeed = {
      type: "repair",
      status: ["approved"],
      has_active_renter: true,
      bill_to_renter: true,
      customer: { name: "PT Sewa" },
      customerBranch: { name: "Cabang X" },
    };
    renderForm(<Form />);

    const customerField = within(
      screen.getByTestId("forminput-customer"),
    ).getByRole("textbox");
    expect(customerField).toHaveValue("PT Sewa");
    expect(customerField).toBeDisabled();
  });

  it("FormTable consumedItems readOnly mengikuti disabled form", () => {
    formPageDisabled = true;
    formPageSeed = { type: "repair", consumedItems: [{ id: 1 }] };
    renderForm(<Form />);

    const table = screen.getByTestId("stub-form-table");
    expect(table).toHaveAttribute("data-readonly", "true");
    expect(table).toHaveAttribute("data-count", "1");
  });

  it("kolom item consumedItems: filters exclude item.is_fixed_asset=true", () => {
    formPageSeed = { type: "repair" };
    renderForm(<Form />);

    const itemColumn = captured.formTableProps.columns.find(
      (c) => c.name === "item",
    );
    const element = itemColumn.cell({
      data: undefined,
      setData: vi.fn(),
      attributes: {},
    });

    expect(element.props.filters).toEqual({ "item.is_fixed_asset": false });
  });

  it("kolom quantity consumedItems: onValueChange memanggil setData dengan key 'quantity'", () => {
    formPageSeed = { type: "repair" };
    renderForm(<Form />);

    const quantityColumn = captured.formTableProps.columns.find(
      (c) => c.name === "quantity",
    );
    const setData = vi.fn();
    const element = quantityColumn.cell({
      data: 20,
      setData,
      attributes: {},
    });

    element.props.onValueChange(20);

    expect(setData).toHaveBeenCalledWith("quantity", 20);
  });

  it("mengetik description memanggil setData", async () => {
    const user = userEvent.setup({ delay: null });
    formPageSeed = { type: "repair" };
    renderForm(<Form />);

    const input = within(screen.getByTestId("forminput-description")).getByRole(
      "textbox",
    );
    await user.type(input, "Servis rutin");

    expect(input).toHaveValue("Servis rutin");
  });
});
