/**
 * Tests tab per model AdvanceSearchDialog (spec linkmodel-multi-model, Requirement 11).
 */

import { beforeEach, describe, expect, it, vi } from "vitest";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

vi.mock("laravel-react-i18n", () => ({
  useLaravelReactI18n: () => ({ t: (key) => `TR:${key}` }),
}));
vi.mock("@/Hooks/usePermission", () => ({
  default: () => ({ can: () => true, canGlobal: () => true }),
}));
vi.mock("@inertiajs/react", () => ({
  router: { get: vi.fn(), reload: vi.fn() },
  usePage: () => ({ props: {}, url: "/test" }),
}));

const axiosPost = vi.fn();
const axiosGet = vi.fn();
vi.mock("axios", () => ({
  default: {
    post: (...args) => axiosPost(...args),
    get: (...args) => axiosGet(...args),
  },
}));

window.route = (name) => name;

import AdvanceSearchDialog from "./AdvanceSearchDialog";

const MAIN = "App\\Models\\Purchase\\PurchaseOrderItem";
const SUB = "App\\Models\\Inventory\\ItemVariant";

const responseFor = (model, rows) => ({
  data: {
    model,
    route: "items",
    translateKey: null,
    columns: [{ name: "code", type: "string", linkable: false }],
    templateLinkColumns: ["code"],
    parentColumn: null,
    data: {
      data: rows,
      current_page: 1,
      last_page: 1,
      per_page: 25,
      total: rows.length,
    },
  },
});
const row = (model, id, code) => ({
  id,
  code,
  templateLink: ":code",
  thisModel: model,
});

const callsFor = (model) =>
  axiosPost.mock.calls.filter(([, payload]) => payload.model === model);

const sources = [
  {
    model: MAIN,
    label: "Purchase Order Item",
    filters: { purchase_order_id: "po-1" },
  },
  {
    model: SUB,
    label: "Item Lainnya",
    filters: { id: { notIn: ["x"] } },
  },
];

const renderDialog = (props = {}) => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: Infinity } },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <AdvanceSearchDialog
        open
        onOpenChange={vi.fn()}
        onSelect={vi.fn()}
        sources={sources}
        {...props}
      />
    </QueryClientProvider>,
  );
};

describe("AdvanceSearchDialog -- tab per model", () => {
  beforeEach(() => {
    axiosPost.mockReset();
    axiosGet.mockReset();
    axiosGet.mockResolvedValue({ data: { data: [] } });
    axiosPost.mockImplementation((_url, payload) =>
      Promise.resolve(
        payload.model === MAIN
          ? responseFor(MAIN, [row(MAIN, 1, "PO-ITEM-1")])
          : responseFor(SUB, [row(SUB, 9, "VARIANT-9")]),
      ),
    );
  });

  it(">1 sumber -> tab per model, tab main aktif, hanya main di-fetch", async () => {
    renderDialog();

    const tabs = await screen.findAllByRole("tab");
    expect(tabs.map((tab) => tab.textContent)).toEqual([
      "Purchase Order Item",
      "Item Lainnya",
    ]);
    expect(tabs[0]).toHaveAttribute("data-state", "active");

    await waitFor(() => expect(callsFor(MAIN).length).toBeGreaterThan(0));
    expect(callsFor(SUB)).toHaveLength(0);
    expect(callsFor(MAIN)[0][1].baseFilters).toEqual({
      purchase_order_id: "po-1",
    });
  });

  it("pindah tab -> fetch model sub dengan filters sub (filters main tak bocor)", async () => {
    const user = userEvent.setup({ delay: null });
    renderDialog();

    await user.click(await screen.findByRole("tab", { name: "Item Lainnya" }));

    await waitFor(() => expect(callsFor(SUB).length).toBeGreaterThan(0));
    expect(callsFor(SUB)[0][1].baseFilters).toEqual({ id: { notIn: ["x"] } });
    const table = await screen.findByRole("table");
    expect(await within(table).findByText("VARIANT-9")).toBeInTheDocument();
  });

  it("memilih baris di tab sub -> onSelect (row bermodel sub) lalu dialog ditutup", async () => {
    const user = userEvent.setup({ delay: null });
    const onSelect = vi.fn();
    const onOpenChange = vi.fn();
    renderDialog({ onSelect, onOpenChange });

    await user.click(await screen.findByRole("tab", { name: "Item Lainnya" }));
    const table = await screen.findByRole("table");
    await user.click(await within(table).findByText("VARIANT-9"));

    expect(onSelect).toHaveBeenCalledTimes(1);
    expect(onSelect.mock.calls[0][0]).toMatchObject({
      id: 9,
      thisModel: SUB,
    });
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("teks pencarian dropdown terbawa ke tab main dan tab yang dipilih", async () => {
    const user = userEvent.setup({ delay: null });
    renderDialog({ initialSearch: "abc" });

    await waitFor(() => expect(callsFor(MAIN).length).toBeGreaterThan(0));
    expect(callsFor(MAIN)[0][1].search).toBe("abc");

    await user.click(await screen.findByRole("tab", { name: "Item Lainnya" }));
    await waitFor(() => expect(callsFor(SUB).length).toBeGreaterThan(0));
    expect(callsFor(SUB)[0][1].search).toBe("abc");
  });

  it("satu sumber (atau tanpa sources) -> tanpa tab, perilaku lama", async () => {
    renderDialog({
      sources: undefined,
      model: MAIN,
      filters: { purchase_order_id: "po-1" },
    });

    await waitFor(() => expect(callsFor(MAIN).length).toBeGreaterThan(0));
    expect(screen.queryByRole("tab")).not.toBeInTheDocument();
  });
});
