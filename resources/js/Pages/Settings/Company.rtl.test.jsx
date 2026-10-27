import React from "react";
import { render, screen } from "@testing-library/react";
import { expect, it, vi } from "vitest";
import Company from "./Company";
import { TooltipProvider } from "@/Components/ui/tooltip";

const stableT = (key) => key;

vi.mock("laravel-react-i18n", () => ({
  useLaravelReactI18n: () => ({ t: stableT }),
}));
vi.mock("@inertiajs/react", async (importOriginal) => ({
  ...(await importOriginal()),
  usePage: () => ({
    props: {
      timezones: ["UTC"],
      preferences: {},
      auth: { user: { id: "test-user" } },
    },
  }),
}));
vi.mock("@/Pages/Core/CountryLinkModel", () => ({ default: () => null }));
vi.mock("@/Pages/Core/CurrencyLinkModel", () => ({ default: () => null }));
vi.mock("../Core/FormPage", async () => {
  const { createContext } = await import("react");
  return {
    FormPage: ({ children }) => <div>{children}</div>,
    FormPageContent: ({ children }) => <section>{children}</section>,
    FormPageContext: createContext({}),
    useFormPageMeta: () => ({}),
    useFormPage: () => ({
      data: {
        company_name: "PT Test",
        per_page_options: [],
        num_per_page: 25,
        mail_password: null,
      },
      setData: vi.fn(),
    }),
  };
});

it("keeps the saved mail password blank and optional when editing company settings", () => {
  render(
    <TooltipProvider>
      <Company company={{ company_name: "PT Test", company_image: null }} />
    </TooltipProvider>,
  );

  const password = screen.getByLabelText("core.company.email_setup.password");
  expect(password).toHaveAttribute("type", "password");
  expect(password).toHaveValue("");
  expect(password).not.toBeRequired();
  expect(
    screen.getByText("core.company.email_setup.password_hint"),
  ).toBeVisible();
});
