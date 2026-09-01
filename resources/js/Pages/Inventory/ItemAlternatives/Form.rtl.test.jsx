import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, within } from "@testing-library/react";
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

vi.mock("../Items/ItemVariantLinkModel", () => ({
  default: ({ value, filters }) => (
    <div data-filters={JSON.stringify(filters ?? {})}>
      value:{value?.name ?? "none"}
    </div>
  ),
}));

const renderForm = (ui) => render(<TooltipProvider>{ui}</TooltipProvider>);

import Form from "./Form";

describe("Inventory ItemAlternatives Form", () => {
  beforeEach(() => {
    formPageSeed = {};
  });

  it("toggle checkbox two_way memanggil setData", async () => {
    const user = userEvent.setup({ delay: null });
    formPageSeed = { two_way: false };
    renderForm(<Form />);

    const checkbox = screen.getByRole("forminput");
    await user.click(checkbox);

    expect(checkbox).toHaveAttribute("data-state", "checked");
  });

  it("filter item selalu berisi kondisi allow_alternative_item (or)", () => {
    renderForm(<Form />);

    const itemModel = within(screen.getByTestId("forminput-item")).getByText(
      /value:/,
    );
    expect(itemModel).toHaveAttribute(
      "data-filters",
      JSON.stringify({
        or: {
          allow_alternative_item: true,
          item: { allow_alternative_item: true },
        },
      }),
    );
  });

  it("filter alternative TIDAK berisi kondisi 'or' saat two_way=false", () => {
    formPageSeed = { two_way: false, item: { id: 1, category_id: 5 } };
    renderForm(<Form />);

    const altModel = within(
      screen.getByTestId("forminput-alternative"),
    ).getByText(/value:/);
    const filters = JSON.parse(altModel.getAttribute("data-filters"));
    expect(filters.or).toBeUndefined();
  });

  it("filter alternative berisi kondisi 'or' saat two_way=true", () => {
    formPageSeed = { two_way: true, item: { id: 1, category_id: 5 } };
    renderForm(<Form />);

    const altModel = within(
      screen.getByTestId("forminput-alternative"),
    ).getByText(/value:/);
    const filters = JSON.parse(altModel.getAttribute("data-filters"));
    expect(filters.or).toEqual({
      allow_alternative_item: true,
      item: { allow_alternative_item: true },
    });
  });

  it("filter alternative selalu exclude id item terpilih dan cocokkan category_id", () => {
    formPageSeed = { item: { id: 10, category_id: 3 } };
    renderForm(<Form />);

    const altModel = within(
      screen.getByTestId("forminput-alternative"),
    ).getByText(/value:/);
    const filters = JSON.parse(altModel.getAttribute("data-filters"));
    expect(filters.id).toEqual({ not: 10 });
    expect(filters.category_id).toBe(3);
  });

  it("filter alternative id.not & category_id undefined saat belum ada item terpilih", () => {
    renderForm(<Form />);

    const altModel = within(
      screen.getByTestId("forminput-alternative"),
    ).getByText(/value:/);
    const filters = JSON.parse(altModel.getAttribute("data-filters"));
    expect(filters.id.not).toBeUndefined();
    expect(filters.category_id).toBeUndefined();
  });
});
