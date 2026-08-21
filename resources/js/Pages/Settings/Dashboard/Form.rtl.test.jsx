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
let formPageDefaultData = {};
let formPageDisabled = false;
vi.mock("@/Pages/Core/FormPage", async () => {
  const React = await import("react");
  return {
    useFormPage: (defaultValue) => {
      const [data, setDataState] = React.useState({
        ...defaultValue,
        ...formPageSeed,
      });
      const setData = (keyOrFn, val) => {
        if (typeof keyOrFn === "function") {
          setDataState((prev) => keyOrFn(prev));
        } else if (typeof keyOrFn === "string") {
          setDataState((prev) => ({ ...prev, [keyOrFn]: val }));
        } else {
          setDataState((prev) => ({ ...prev, ...keyOrFn }));
        }
      };
      return {
        data,
        setData,
        defaultData: formPageDefaultData,
        disabled: formPageDisabled,
      };
    },
    FormPageContent: ({ title, collapsible, defaultOpen, children }) => (
      <div
        data-testid={`form-page-content-${title ?? "untitled"}`}
        data-collapsible={collapsible ? "true" : "false"}
        data-default-open={defaultOpen ? "true" : "false"}
      >
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

vi.mock("../Widget/WidgetLinkModel", () => ({
  default: ({ value, onValueChange }) => (
    <button
      type="button"
      data-testid="widget-link-model"
      onClick={() => onValueChange?.({ id: 1, name: "Widget A" })}
    >
      widget:{value?.name ?? "none"}
    </button>
  ),
}));

vi.mock("@/Components/FormTable", () => ({
  default: ({ columns, value, onValueChange, readOnly }) => {
    const rows = value ?? [];
    const updateRow = (index, keyOrObj, val) => {
      const next = [...rows];
      const row = { ...next[index] };
      if (typeof keyOrObj === "object") {
        Object.assign(row, keyOrObj);
      } else {
        row[keyOrObj] = val;
      }
      next[index] = row;
      onValueChange?.(next);
    };
    return (
      <div data-testid="stub-form-table" data-readonly={readOnly ? "true" : "false"}>
        {rows.map((row, index) => (
          <div key={row.id ?? index} data-testid={`row-${index}`}>
            {columns.map((col) => (
              <div key={col.name} data-testid={`cell-${col.name}-${index}`}>
                {col.cell({
                  dataRow: row,
                  data: row[col.name],
                  setData: (keyOrObj, val) => updateRow(index, keyOrObj, val),
                  attributes: {},
                })}
              </div>
            ))}
          </div>
        ))}
      </div>
    );
  },
}));

const renderForm = (ui) => render(<TooltipProvider>{ui}</TooltipProvider>);

import Form from "./Form";

describe("Settings Dashboard Form", () => {
  beforeEach(() => {
    formPageSeed = {};
    formPageDefaultData = {};
    formPageDisabled = false;
  });

  it("mengetik title memanggil setData", async () => {
    const user = userEvent.setup({ delay: null });
    renderForm(<Form />);

    const input = within(screen.getByTestId("forminput-title")).getByRole(
      "textbox",
    );
    await user.type(input, "Dashboard Sales");

    expect(input).toHaveValue("Dashboard Sales");
  });

  it("kolom is_visible disabled saat baris belum punya widget", () => {
    formPageSeed = { widgets: [{ id: "w1", widget: null }] };
    renderForm(<Form />);

    const cell = screen.getByTestId("cell-is_visible-0");
    expect(cell.querySelector('[role="forminput"]')).toBeDisabled();
  });

  it("kolom is_visible aktif setelah widget dipilih pada baris tsb", () => {
    formPageSeed = {
      widgets: [{ id: "w1", widget: { id: 1, name: "Widget A" } }],
    };
    renderForm(<Form />);

    const cell = screen.getByTestId("cell-is_visible-0");
    expect(cell.querySelector('[role="forminput"]')).not.toBeDisabled();
  });

  it("memilih widget pada baris memanggil setData('widget', ...)", async () => {
    const user = userEvent.setup({ delay: null });
    formPageSeed = { widgets: [{ id: "w1", widget: null }] };
    renderForm(<Form />);

    await user.click(screen.getByTestId("widget-link-model"));

    expect(screen.getByTestId("widget-link-model")).toHaveTextContent(
      "widget:Widget A",
    );
  });

  it("FormTable widgets readOnly mengikuti disabled form", () => {
    formPageDisabled = true;
    formPageSeed = { widgets: [] };
    renderForm(<Form />);

    expect(screen.getByTestId("stub-form-table")).toHaveAttribute(
      "data-readonly",
      "true",
    );
  });

  it("section external_note defaultOpen mengikuti defaultData.external_note", () => {
    formPageDefaultData = { external_note: "catatan lama" };
    renderForm(<Form />);

    const section = screen.getByTestId(
      "form-page-content-settings.dashboard.external_note",
    );
    expect(section).toHaveAttribute("data-default-open", "true");
  });

  it("section external_note TIDAK default-open saat defaultData.external_note kosong", () => {
    formPageDefaultData = {};
    renderForm(<Form />);

    const section = screen.getByTestId(
      "form-page-content-settings.dashboard.external_note",
    );
    expect(section).toHaveAttribute("data-default-open", "false");
  });

  it("mengetik external_note memanggil setData", async () => {
    const user = userEvent.setup({ delay: null });
    renderForm(<Form />);

    const textarea = within(
      screen.getByTestId("forminput-external_note"),
    ).getByRole("textbox");
    await user.type(textarea, "Catatan baru");

    expect(textarea).toHaveValue("Catatan baru");
  });
});
