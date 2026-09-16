/**
 * Tests untuk AdvanceSearchDialog (orkestrator dialog Advance Search LinkModel).
 * Task 10.5 (spec linkmodel-advanced-search).
 *
 * Validates: Requirements 1.5, 2.1-2.9, 3.1-3.4, 4.1-4.6, 5.1-5.4, 6.1-6.3, 7.1-7.3
 */

import { describe, expect, it, vi, beforeEach } from "vitest";
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

function selectDataResponse({ rows = [], total, lastPage = 1, currentPage = 1 } = {}) {
  return {
    data: {
      model: "App\\Models\\Inventory\\Item",
      route: "items",
      translateKey: null,
      columns: [
        { name: "code", type: "string", linkable: false },
        { name: "price", type: "currency", linkable: true },
      ],
      templateLinkColumns: ["code"],
      parentColumn: null,
      data: {
        data: rows,
        current_page: currentPage,
        last_page: lastPage,
        per_page: 25,
        total: total ?? rows.length,
      },
    },
  };
}

const renderDialog = (props = {}) => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: Infinity } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <AdvanceSearchDialog
        open
        onOpenChange={vi.fn()}
        model="App\Models\Inventory\Item"
        onSelect={vi.fn()}
        {...props}
      />
    </QueryClientProvider>,
  );
};

describe("AdvanceSearchDialog", () => {
  beforeEach(() => {
    axiosPost.mockReset();
    axiosGet.mockReset();
    axiosGet.mockResolvedValue({ data: { data: [] } });
  });

  it("badge filter HANYA dari additive -- filters (locked) tidak menaikkan badge", async () => {
    axiosPost.mockResolvedValue(selectDataResponse());
    renderDialog({ filters: { status: "active" } });

    await waitFor(() => expect(axiosPost).toHaveBeenCalled());

    // Tanpa additive filter apapun, tombol filter tidak punya badge angka
    // walau `filters` (locked) terisi.
    const filterButtons = screen.getAllByRole("button");
    const badgeTexts = filterButtons
      .map((b) => b.textContent)
      .filter((t) => /^\d+$/.test(t ?? ""));
    expect(badgeTexts).toHaveLength(0);
  });

  it("klik baris tabel (desktop) memanggil onSelect dengan payload TERPANGKAS sesuai fields", async () => {
    const user = userEvent.setup({ delay: null });
    const onSelect = vi.fn();
    axiosPost.mockResolvedValue(
      selectDataResponse({
        rows: [
          {
            id: 1,
            code: "ITM-1",
            price: 1000,
            valuation_rate: 999, // non-linkable-non-fields, harus terbuang
            templateLink: ":code",
          },
        ],
      }),
    );
    renderDialog({ fields: ["price"], onSelect });

    // "ITM-1" muncul dua kali (tabel desktop + list mobile, CSS-toggle) --
    // scope ke <table> agar tak ambigu.
    const table = await screen.findByRole("table");
    const cell = await within(table).findByText("ITM-1");
    await user.click(cell);

    expect(onSelect).toHaveBeenCalledTimes(1);
    const payload = onSelect.mock.calls[0][0];
    expect(payload.code).toBe("ITM-1"); // kolom sumber templateLink selalu ikut
    expect(payload.price).toBe(1000); // diminta via fields
    expect(payload).not.toHaveProperty("valuation_rate");
  });

  it("tap item (mobile list) memanggil onSelect dengan payload SAMA seperti desktop", async () => {
    const user = userEvent.setup({ delay: null });
    const onSelect = vi.fn();
    axiosPost.mockResolvedValue(
      selectDataResponse({
        rows: [
          {
            id: 2,
            code: "ITM-2",
            price: 2000,
            valuation_rate: 111,
            templateLink: ":code",
          },
        ],
      }),
    );
    renderDialog({ fields: ["price"], onSelect });

    // Mobile list render item juga (CSS-toggle, bukan conditional unmount) --
    // cari button dgn teks "ITM-2" (list mobile pakai <button>, beda dari cell tabel).
    const mobileItem = await screen.findByRole("button", { name: /ITM-2/ });
    await user.click(mobileItem);

    expect(onSelect).toHaveBeenCalledTimes(1);
    const payload = onSelect.mock.calls[0][0];
    expect(payload.code).toBe("ITM-2");
    expect(payload.price).toBe(2000);
    expect(payload).not.toHaveProperty("valuation_rate");
  });

  it("mengirim includeAllLinkable:true DAN baseFilters=props.filters (bukan diabaikan)", async () => {
    axiosPost.mockResolvedValue(selectDataResponse());
    renderDialog({ filters: { status: "active" } });

    await waitFor(() => expect(axiosPost).toHaveBeenCalled());
    const [, payload] = axiosPost.mock.calls[0];
    expect(payload.includeAllLinkable).toBe(true);
    expect(payload.baseFilters).toEqual({ status: "active" });
  });
});
