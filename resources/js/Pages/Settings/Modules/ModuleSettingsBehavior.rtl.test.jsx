import React from "react";
import { act, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { TooltipProvider } from "@/Components/ui/tooltip";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { router } from "@inertiajs/react";
import { gooeyToast } from "@/lib/gooeyToast";
import ModuleSettingsPage from "./ModuleSettingsPage";
import FinanceSettings from "./FinanceSettings";
import SalesSettings from "./SalesSettings";

const stableT = (key, fallback) => fallback ?? key;

vi.mock("@inertiajs/react", async (importOriginal) => ({
  ...(await importOriginal()),
  Head: () => null,
  usePage: () => ({ props: { auth: { user: { id: "review-user" } }, preferences: {}, permissions: {} } }),
}));
vi.mock("@/Layouts/AppLayout", () => ({ default: ({ children }) => <div>{children}</div> }));
vi.mock("laravel-react-i18n", () => ({ useLaravelReactI18n: () => ({ t: stableT }) }));
vi.mock("@/lib/gooeyToast", () => ({ gooeyToast: { success: vi.fn(), error: vi.fn() } }));
vi.mock("@/Pages/Finances/Taxes/TaxLinkModel", () => ({
  default: ({ value, onValueChange, disabled }) => (
    <div>
      <span>{value?.name}</span>
      <button type="button" disabled={disabled} onClick={() => onValueChange({ id: "01ARZ3NDEKTSV4RRFFQ69G5FAV", name: "Selected tax" })}>Choose tax</button>
    </div>
  ),
}));

function Page({ setting = { field: "initial" }, canWrite = true }) {
  return (
    <ModuleSettingsPage title="Settings" name="finance" setting={setting} canWrite={canWrite}>
      {({ data, setData, disabled }) => (
        <label>Setting value<input value={data.field ?? ""} disabled={disabled} onChange={(event) => setData("field", event.target.value)} /></label>
      )}
    </ModuleSettingsPage>
  );
}

describe("module settings behavior with real Inertia useForm", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.clearAllMocks();
    window.route = (name) => `/route/${name}`;
    vi.spyOn(router, "put").mockImplementation(() => {});
  });

  it("submits edited values, preserves scroll and resets dirty state using saved server values", async () => {
    const user = userEvent.setup();
    render(<Page />);
    await user.clear(screen.getByRole("textbox"));
    await user.type(screen.getByRole("textbox"), "edited");
    expect(screen.getByTestId("unsaved-badge")).toBeVisible();
    await user.click(screen.getByRole("button", { name: "Save" }));
    expect(router.put).toHaveBeenCalledWith("/route/moduleSettings.finance.update", { field: "edited" }, expect.objectContaining({ preserveScroll: true }));
    const options = router.put.mock.calls[0][2];
    await act(async () => options.onSuccess({ props: { setting: { field: "saved-normalized" } } }));
    expect(screen.getByRole("textbox")).toHaveValue("saved-normalized");
    expect(screen.queryByTestId("unsaved-badge")).not.toBeInTheDocument();
    expect(gooeyToast.success).toHaveBeenCalledOnce();
  });

  it("shows validation errors and retains edits when the server rejects the update", async () => {
    const user = userEvent.setup();
    render(<Page />);
    await user.type(screen.getByRole("textbox"), " edited");
    await user.click(screen.getByRole("button", { name: "Save" }));
    await act(async () => router.put.mock.calls[0][2].onError({ field: "Invalid setting value" }));
    expect(screen.getByRole("alert")).toHaveTextContent("Invalid setting value");
    expect(screen.getByRole("textbox")).toHaveValue("initial edited");
    expect(gooeyToast.error).toHaveBeenCalledWith("Invalid setting value");
  });

  it("prevents read-only submissions and disables child inputs", () => {
    render(<Page canWrite={false} />);
    expect(screen.getByRole("textbox")).toBeDisabled();
    expect(screen.queryByRole("button", { name: "Save" })).not.toBeInTheDocument();
    fireEvent.submit(screen.getByRole("form"));
    expect(router.put).not.toHaveBeenCalled();
  });

  it("updates clean forms from new props without overwriting unsaved edits", async () => {
    const user = userEvent.setup();
    const { rerender } = render(<Page setting={{ field: "initial" }} />);
    rerender(<Page setting={{ field: "server update" }} />);
    expect(screen.getByRole("textbox")).toHaveValue("server update");
    await user.type(screen.getByRole("textbox"), " pending");
    rerender(<Page setting={{ field: "new external update" }} />);
    expect(screen.getByRole("textbox")).toHaveValue("server update pending");
  });

  it("switches between real form tabs and renders their selected content", async () => {
    const user = userEvent.setup();
    render(
      <ModuleSettingsPage title="Settings" name="finance" setting={{}} tabs={[{ value: "first", title: "First" }, { value: "second", title: "Second" }]}>
        {({ tab }) => <p>{tab === "first" ? "First settings content" : "Second settings content"}</p>}
      </ModuleSettingsPage>,
    );
    expect(screen.getByText("First settings content")).toBeVisible();
    await user.click(screen.getByRole("tab", { name: "Second" }));
    expect(screen.getByText("Second settings content")).toBeVisible();
    expect(screen.queryByText("First settings content")).not.toBeInTheDocument();
  });

  it("applies a pending server update once the user restores the clean value", async () => {
    const user = userEvent.setup();
    const { rerender } = render(<Page setting={{ field: "initial" }} />);
    await user.type(screen.getByRole("textbox"), " pending");
    rerender(<Page setting={{ field: "new server value" }} />);
    await user.clear(screen.getByRole("textbox"));
    await user.type(screen.getByRole("textbox"), "initial");
    expect(screen.getByRole("textbox")).toHaveValue("new server value");
  });

  it("always renders the finance serial counter read-only for writers", () => {
    render(<FinanceSettings canWrite setting={{ tax_invoice_serial_range_start: 10, tax_invoice_serial_range_end: 50, tax_invoice_serial_last_used: 20 }} />);
    expect(screen.getByLabelText("Nomor Seri Terakhir Digunakan")).toBeDisabled();
  });

  it("omits the finance counter and database metadata from the submitted payload", async () => {
    const user = userEvent.setup();
    render(<FinanceSettings canWrite setting={{ id: "metadata", singleton: true, updated_at: "2026-10-19", tax_invoice_serial_range_start: 10, tax_invoice_serial_range_end: 50, tax_invoice_serial_last_used: 20 }} />);
    await user.click(screen.getByRole("button", { name: "Save" }));
    expect(router.put.mock.calls[0][1]).toEqual({ tax_invoice_serial_range_start: 10, tax_invoice_serial_range_end: 50 });
  });

  it("displays the saved sales tax and submits the selected tax ID rather than the LinkModel object", async () => {
    const user = userEvent.setup();
    render(
      <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity } } })}>
        <TooltipProvider delayDuration={0}>
          <SalesSettings setting={{ default_tax_id: "previous-id" }} defaultTax={{ id: "previous-id", name: "Previous tax" }} canWrite />
        </TooltipProvider>
      </QueryClientProvider>,
    );
    expect(screen.getByText("Previous tax")).toBeVisible();
    await user.click(screen.getByRole("button", { name: "Choose tax" }));
    await user.click(screen.getByRole("button", { name: "Save" }));
    expect(router.put.mock.calls[0][1]).toEqual({ default_tax_id: "01ARZ3NDEKTSV4RRFFQ69G5FAV" });
  });
});
