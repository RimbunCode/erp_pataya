import React, { useState } from "react";
import { describe, expect, it, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import AssetSettings from "./AssetSettings";

vi.mock("laravel-react-i18n", () => ({
  useLaravelReactI18n: () => ({ t: (key) => key }),
}));

const savedData = { current: null };
vi.mock("./ModuleSettingsPage", () => ({
  default: function ModuleSettingsPageStub({
    tabs,
    children,
    setting,
    canWrite,
  }) {
    const [data, setDataState] = useState(setting);
    savedData.current = data;
    const setData = (key, value) =>
      setDataState((prev) => ({ ...prev, [key]: value }));

    return (
      <main>
        {tabs.map((tab) => (
          <section key={tab.value} aria-label={tab.value}>
            {children({
              data,
              setData,
              disabled: !canWrite,
              tab: tab.value,
            })}
          </section>
        ))}
      </main>
    );
  },
}));
vi.mock("@/Components/FormInput", () => ({
  default: ({ name, children }) => (
    <div data-testid={`field-${name}`}>{children}</div>
  ),
}));
vi.mock("@/Components/Select", () => ({
  default: ({ value, onValueChange, options, optionTrans, disabled }) => (
    <select
      value={value ?? ""}
      disabled={disabled}
      data-option-trans={optionTrans}
      onChange={(event) => onValueChange(event.target.value)}
    >
      <option value="" />
      {options.map((option) => (
        <option key={option} value={option}>
          {option}
        </option>
      ))}
    </select>
  ),
}));
vi.mock("@/Components/NumberInput", () => ({
  default: ({ value, onValueChange, disabled, min }) => (
    <input
      value={value ?? ""}
      disabled={disabled}
      data-min={min}
      onChange={(event) =>
        onValueChange(
          event.target.value === "" ? "" : Number(event.target.value),
        )
      }
    />
  ),
}));

const emptySetting = {
  default_depreciation_method: null,
  default_frequency_of_depreciation: null,
  default_total_number_of_depreciations: null,
};
const field = (name) => within(screen.getByTestId(`field-${name}`));

describe("AssetSettings", () => {
  it("renders the three depreciation default fields with the four known methods", () => {
    render(<AssetSettings setting={emptySetting} />);

    expect(screen.getByTestId("asset-settings-defaults")).toBeInTheDocument();
    const select = field("default_depreciation_method").getByRole("combobox");
    expect(
      Array.from(select.querySelectorAll("option")).map((o) => o.value),
    ).toEqual([
      "",
      "straight_line",
      "double_declining_balance",
      "written_down_value",
      "manual",
    ]);
    expect(select).toHaveAttribute(
      "data-option-trans",
      "asset.asset.columns.depreciation_method.options",
    );
    expect(
      field("default_frequency_of_depreciation").getByRole("textbox"),
    ).toHaveAttribute("data-min", "1");
    expect(
      field("default_total_number_of_depreciations").getByRole("textbox"),
    ).toHaveAttribute("data-min", "1");
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("shows the stored values", () => {
    render(
      <AssetSettings
        setting={{
          default_depreciation_method: "manual",
          default_frequency_of_depreciation: 6,
          default_total_number_of_depreciations: 8,
        }}
      />,
    );

    expect(
      field("default_depreciation_method").getByRole("combobox"),
    ).toHaveValue("manual");
    expect(
      field("default_frequency_of_depreciation").getByRole("textbox"),
    ).toHaveValue("6");
    expect(
      field("default_total_number_of_depreciations").getByRole("textbox"),
    ).toHaveValue("8");
  });

  it("updates, and clears the method back to null", async () => {
    const user = userEvent.setup({ delay: null });
    render(<AssetSettings setting={emptySetting} />);

    await user.selectOptions(
      field("default_depreciation_method").getByRole("combobox"),
      "written_down_value",
    );
    await user.type(
      field("default_frequency_of_depreciation").getByRole("textbox"),
      "12",
    );

    expect(savedData.current.default_depreciation_method).toBe(
      "written_down_value",
    );
    expect(savedData.current.default_frequency_of_depreciation).toBe(12);

    await user.selectOptions(
      field("default_depreciation_method").getByRole("combobox"),
      "",
    );

    expect(savedData.current.default_depreciation_method).toBeNull();
  });

  it("warns when the saved method is no longer a valid option (P-O4)", () => {
    render(
      <AssetSettings
        setting={{
          ...emptySetting,
          default_depreciation_method: "sum_of_years",
        }}
      />,
    );

    expect(screen.getByRole("alert")).toHaveTextContent(
      "asset.setting.option_unavailable",
    );
  });

  it("disables every field when the user cannot write", () => {
    render(<AssetSettings setting={emptySetting} canWrite={false} />);

    expect(
      field("default_depreciation_method").getByRole("combobox"),
    ).toBeDisabled();
    expect(
      field("default_frequency_of_depreciation").getByRole("textbox"),
    ).toBeDisabled();
    expect(
      field("default_total_number_of_depreciations").getByRole("textbox"),
    ).toBeDisabled();
  });
});
