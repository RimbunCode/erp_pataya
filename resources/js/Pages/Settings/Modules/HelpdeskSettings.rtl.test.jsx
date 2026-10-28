import React, { useState } from "react";
import { describe, expect, it, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import HelpdeskSettings from "./HelpdeskSettings";

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
  default_type: null,
  default_priority: null,
  default_due_days: null,
};
const field = (name) => within(screen.getByTestId(`field-${name}`));
const optionValues = (select) =>
  Array.from(select.querySelectorAll("option")).map((o) => o.value);

describe("HelpdeskSettings", () => {
  it("renders type, priority and due days with the ticket options", () => {
    render(<HelpdeskSettings setting={emptySetting} />);

    expect(
      screen.getByTestId("helpdesk-settings-defaults"),
    ).toBeInTheDocument();
    const type = field("default_type").getByRole("combobox");
    const priority = field("default_priority").getByRole("combobox");
    expect(optionValues(type)).toEqual([
      "",
      "bug_problem",
      "task",
      "question",
      "other",
    ]);
    expect(optionValues(priority)).toEqual([
      "",
      "low",
      "medium",
      "high",
      "critical",
    ]);
    expect(type).toHaveAttribute(
      "data-option-trans",
      "helpdesk.ticket.type.options",
    );
    expect(priority).toHaveAttribute(
      "data-option-trans",
      "helpdesk.ticket.priority.options",
    );
    expect(field("default_due_days").getByRole("textbox")).toHaveAttribute(
      "data-min",
      "0",
    );
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("shows the stored values", () => {
    render(
      <HelpdeskSettings
        setting={{
          default_type: "question",
          default_priority: "high",
          default_due_days: 3,
        }}
      />,
    );

    expect(field("default_type").getByRole("combobox")).toHaveValue("question");
    expect(field("default_priority").getByRole("combobox")).toHaveValue("high");
    expect(field("default_due_days").getByRole("textbox")).toHaveValue("3");
  });

  it("updates values and clears an option back to null", async () => {
    const user = userEvent.setup({ delay: null });
    render(<HelpdeskSettings setting={emptySetting} />);

    await user.selectOptions(
      field("default_type").getByRole("combobox"),
      "bug_problem",
    );
    await user.selectOptions(
      field("default_priority").getByRole("combobox"),
      "critical",
    );
    await user.type(field("default_due_days").getByRole("textbox"), "0");

    expect(savedData.current).toMatchObject({
      default_type: "bug_problem",
      default_priority: "critical",
      default_due_days: 0,
    });

    await user.selectOptions(
      field("default_priority").getByRole("combobox"),
      "",
    );

    expect(savedData.current.default_priority).toBeNull();
  });

  it.each([
    ["type", { default_type: "incident" }],
    ["priority", { default_priority: "urgent" }],
  ])(
    "warns when the saved %s is no longer a valid option (P-O4)",
    (_name, override) => {
      render(<HelpdeskSettings setting={{ ...emptySetting, ...override }} />);

      expect(screen.getByRole("alert")).toHaveTextContent(
        "helpdesk.setting.option_unavailable",
      );
    },
  );

  it("disables every field when the user cannot write", () => {
    render(<HelpdeskSettings setting={emptySetting} canWrite={false} />);

    expect(field("default_type").getByRole("combobox")).toBeDisabled();
    expect(field("default_priority").getByRole("combobox")).toBeDisabled();
    expect(field("default_due_days").getByRole("textbox")).toBeDisabled();
  });
});
