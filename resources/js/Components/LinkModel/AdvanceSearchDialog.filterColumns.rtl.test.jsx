/**
 * Test wiring kolom FilterTable di AdvanceSearchDialog: FilterTable menerima
 * SEMUA kolom schema (bukan cuma yang tampil di tabel / linkable-gated).
 * FilterTable2 di-stub supaya prop `columns` yang diterimanya bisa ditangkap.
 *
 * Validates: Requirements 4.3 (filter tambahan via FilterTable)
 */

import { describe, expect, it, vi, beforeEach } from "vitest";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, waitFor, within, screen } from "@testing-library/react";

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

const filterTableProps = vi.hoisted(() => ({ current: null }));
vi.mock("@/Components/Table/Filter/FilterTable2", () => ({
  default: (props) => {
    filterTableProps.current = props;
    return props.trigger ?? null;
  },
}));

const axiosPost = vi.fn();
vi.mock("axios", () => ({
  default: { post: (...args) => axiosPost(...args) },
}));

window.route = (name) => name;

import AdvanceSearchDialog from "./AdvanceSearchDialog";

const response = {
  data: {
    model: "App\\Models\\Sales\\Customer",
    route: "customers",
    translateKey: null,
    columns: [
      { name: "name", type: "string", linkable: false }, // sumber templateLink
      { name: "phone", type: "string", linkable: false },
      { name: "email", type: "string", linkable: false },
    ],
    templateLinkColumns: ["name"],
    parentColumn: null,
    data: {
      data: [{ id: 1, name: "Budi", templateLink: ":name" }],
      current_page: 1,
      last_page: 1,
      per_page: 25,
      total: 1,
    },
  },
};

describe("AdvanceSearchDialog -- kolom FilterTable", () => {
  beforeEach(() => {
    axiosPost.mockReset();
    filterTableProps.current = null;
  });

  it("FilterTable dapat SEMUA kolom schema, sementara tabel hanya kolom aman (templateLink)", async () => {
    axiosPost.mockResolvedValue(response);
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false, gcTime: Infinity } },
    });
    render(
      <QueryClientProvider client={queryClient}>
        <AdvanceSearchDialog
          open
          onOpenChange={vi.fn()}
          model="App\Models\Sales\Customer"
          onSelect={vi.fn()}
        />
      </QueryClientProvider>,
    );

    // Data selesai dimuat (baris tabel desktop muncul).
    const table = await screen.findByRole("table");
    await within(table).findByText("Budi");

    await waitFor(() =>
      expect(Object.keys(filterTableProps.current.columns)).toEqual([
        "name",
        "phone",
        "email",
      ]),
    );
    // Tabel: header hanya kolom aman -- phone/email (non-linkable) tidak tampil.
    expect(within(table).queryByText(/phone/i)).not.toBeInTheDocument();
    expect(within(table).queryByText(/email/i)).not.toBeInTheDocument();
  });
});
