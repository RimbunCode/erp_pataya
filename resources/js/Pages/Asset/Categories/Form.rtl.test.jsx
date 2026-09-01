import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { TooltipProvider } from "@/Components/ui/tooltip";

const stableT = (key) => key;
vi.mock("laravel-react-i18n", () => ({
  useLaravelReactI18n: () => ({ t: stableT }),
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

const renderForm = (ui) => render(<TooltipProvider>{ui}</TooltipProvider>);

import Form from "./Form";

describe("Asset Categories Form", () => {
  beforeEach(() => {
    formPageSeed = {};
  });

  it("mengetik category_name memanggil setData", async () => {
    const user = userEvent.setup({ delay: null });
    renderForm(<Form />);

    const input = screen
      .getByTestId("forminput-category_name")
      .querySelector("input");
    await user.type(input, "Kendaraan");

    expect(input).toHaveValue("Kendaraan");
  });

  it("3 checkbox (is_rentable, allow_bulk_quantity, non_depreciable_category) independen, toggle satu tidak mempengaruhi lainnya", async () => {
    const user = userEvent.setup({ delay: null });
    formPageSeed = {
      is_rentable: false,
      allow_bulk_quantity: false,
      non_depreciable_category: false,
    };
    renderForm(<Form />);

    const checkboxes = screen.getAllByRole("forminput");
    expect(checkboxes).toHaveLength(3);

    await user.click(checkboxes[1]); // allow_bulk_quantity

    const after = screen.getAllByRole("forminput");
    expect(after[0]).toHaveAttribute("data-state", "unchecked"); // is_rentable
    expect(after[1]).toHaveAttribute("data-state", "checked"); // allow_bulk_quantity
    expect(after[2]).toHaveAttribute("data-state", "unchecked"); // non_depreciable_category
  });
});
