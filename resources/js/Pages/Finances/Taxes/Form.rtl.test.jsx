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

const renderForm = (ui) => render(<TooltipProvider>{ui}</TooltipProvider>);

import Form from "./Form";

describe("Finances Taxes Form", () => {
  beforeEach(() => {
    formPageSeed = {};
    usePageMock.mockReturnValue({ props: { preferences: {} } });
  });

  it("mengetik name memanggil setData", async () => {
    const user = userEvent.setup({ delay: null });
    renderForm(<Form />);

    const input = screen.getByTestId("forminput-name").querySelector("input");
    await user.type(input, "PPN 11%");

    expect(input).toHaveValue("PPN 11%");
  });

  it("rate menampilkan suffix '%' dan clamp ke max=100 saat blur", async () => {
    const user = userEvent.setup({ delay: null });
    renderForm(<Form />);

    const input = screen.getByTestId("forminput-rate").querySelector("input");
    await user.type(input, "150");
    await user.tab();

    expect(input.value).toContain("100");
    expect(input.value).toContain("%");
  });

  it("rate clamp ke min=0 saat diketik negatif", async () => {
    const user = userEvent.setup({ delay: null });
    renderForm(<Form />);

    const input = screen.getByTestId("forminput-rate").querySelector("input");
    await user.type(input, "-5");
    await user.tab();

    expect(input.value).toContain("0.00");
  });
});
