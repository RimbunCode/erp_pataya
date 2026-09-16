/**
 * Tests untuk useAdvanceSearchModel (infinite scroll fetch hook).
 * Task 4.2 (spec linkmodel-advanced-search).
 *
 * Validates: Requirements 2.5, 3.2, 3.4, 5.2, 5.3
 */

import { describe, expect, it, vi, beforeEach } from "vitest";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";

const axiosPost = vi.fn();
vi.mock("axios", () => ({
  default: { post: (...args) => axiosPost(...args) },
}));

window.route = (name) => name;

import useAdvanceSearchModel from "./useAdvanceSearchModel";

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: Infinity } },
  });
  const Wrapper = ({ children }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
  return { Wrapper };
}

function page({ rows = [], currentPage = 1, lastPage = 1, total } = {}) {
  return {
    data: {
      model: "App\\Models\\Inventory\\Item",
      route: "items",
      translateKey: null,
      columns: [{ name: "code", type: "string", linkable: false }],
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

describe("useAdvanceSearchModel", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("mengirim includeAllLinkable:true, baseFilters, DAN filters sekaligus (bukan salah satu)", async () => {
    axiosPost.mockResolvedValue(page());
    const { Wrapper } = createWrapper();

    renderHook(
      () =>
        useAdvanceSearchModel({
          model: "App\\Models\\Inventory\\Item",
          baseFilters: { status: "active" },
          additiveFilters: { root: { k: "and", c: {} } },
          search: "",
          open: true,
        }),
      { wrapper: Wrapper },
    );

    await waitFor(() => expect(axiosPost).toHaveBeenCalledTimes(1));
    const [, payload] = axiosPost.mock.calls[0];
    expect(payload.includeAllLinkable).toBe(true);
    expect(payload.baseFilters).toEqual({ status: "active" });
    expect(payload.filters).toEqual({ root: { k: "and", c: {} } });
  });

  it("fetchNextPage() meminta page berikutnya & rows hasil append (bukan replace)", async () => {
    axiosPost
      .mockResolvedValueOnce(
        page({ rows: [{ id: 1 }], currentPage: 1, lastPage: 2, total: 2 }),
      )
      .mockResolvedValueOnce(
        page({ rows: [{ id: 2 }], currentPage: 2, lastPage: 2, total: 2 }),
      );
    const { Wrapper } = createWrapper();

    const { result } = renderHook(
      () =>
        useAdvanceSearchModel({
          model: "App\\Models\\Inventory\\Item",
          search: "",
          open: true,
        }),
      { wrapper: Wrapper },
    );

    await waitFor(() => expect(result.current.rows).toHaveLength(1));
    expect(result.current.hasNextPage).toBe(true);

    result.current.fetchNextPage();

    await waitFor(() => expect(result.current.rows).toHaveLength(2));
    expect(result.current.rows.map((r) => r.id)).toEqual([1, 2]);
    expect(axiosPost.mock.calls[1][1].page).toBe(2);
  });

  it("open=false -- tidak fetch sama sekali", async () => {
    axiosPost.mockResolvedValue(page());
    const { Wrapper } = createWrapper();

    renderHook(
      () =>
        useAdvanceSearchModel({
          model: "App\\Models\\Inventory\\Item",
          search: "",
          open: false,
        }),
      { wrapper: Wrapper },
    );

    await new Promise((r) => setTimeout(r, 50));
    expect(axiosPost).not.toHaveBeenCalled();
  });

  it("columnMap & lockedColumnNames diturunkan dari halaman pertama (templateLinkColumns response)", async () => {
    axiosPost.mockResolvedValue(page());
    const { Wrapper } = createWrapper();

    const { result } = renderHook(
      () =>
        useAdvanceSearchModel({
          model: "App\\Models\\Inventory\\Item",
          search: "",
          open: true,
        }),
      { wrapper: Wrapper },
    );

    await waitFor(() =>
      expect(result.current.lockedColumnNames).toEqual(["code"]),
    );
    expect(result.current.columnMap.code.locked).toBe(true);
  });
});
