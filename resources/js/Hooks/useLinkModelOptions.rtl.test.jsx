import { describe, expect, it, vi, beforeEach } from "vitest";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";

vi.mock("laravel-react-i18n", () => ({
  useLaravelReactI18n: () => ({ t: (key) => key }),
}));

const toastErrorMock = vi.fn();
vi.mock("@/lib/gooeyToast", () => ({
  gooeyToast: { error: (...args) => toastErrorMock(...args) },
}));

const axiosPost = vi.fn();
vi.mock("axios", () => ({
  default: { post: (...args) => axiosPost(...args) },
}));

window.route = (name) => name;

import useLinkModelOptions, { buildPersistKey } from "./useLinkModelOptions";

// QueryClient FRESH per pemanggilan -- gcTime: Infinity supaya cache tidak
// dibuang di tengah test, retry: false supaya error langsung propagate tanpa
// backoff. Dua render yang harus BERBAGI cache (test dedup) sengaja pakai
// SATU Wrapper yang sama; dua render yang harus TERISOLASI (test staleTime,
// simulasi "page reload" -- in-memory cache kosong tapi localStorage masih
// ada) sengaja pakai Wrapper BEDA dari createWrapper() terpisah.
function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: Infinity } },
  });

  const Wrapper = ({ children }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
  return { Wrapper, queryClient };
}

describe("useLinkModelOptions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.localStorage.clear();
    window.sessionStorage.clear();
  });

  it("dedup: dua instance dengan params identik (queryKey sama) hanya 1 network call", async () => {
    axiosPost.mockResolvedValue({ data: { data: [{ id: 1 }], total: 1 } });
    const { Wrapper } = createWrapper();
    const params = {
      model: "App\\Models\\Core\\Currency",
      filters: { is_active: true },
      open: true,
    };

    const { result: r1 } = renderHook(() => useLinkModelOptions(params), {
      wrapper: Wrapper,
    });
    const { result: r2 } = renderHook(() => useLinkModelOptions(params), {
      wrapper: Wrapper,
    });

    await waitFor(() => expect(r1.current.options).toHaveLength(1));
    await waitFor(() => expect(r2.current.options).toHaveLength(1));

    expect(axiosPost).toHaveBeenCalledTimes(1);
  });

  it("debounce: rentetan perubahan search cepat hanya menghasilkan 1 fetch tambahan untuk nilai final", async () => {
    axiosPost.mockResolvedValue({ data: { data: [], total: 0 } });
    const { Wrapper } = createWrapper();

    const { rerender } = renderHook(
      ({ search }) =>
        useLinkModelOptions({
          model: "App\\Models\\Inventory\\Item",
          open: true,
          search,
        }),
      { wrapper: Wrapper, initialProps: { search: "" } },
    );

    // fetch awal (search kosong, saat dropdown pertama dibuka) -- di luar
    // yang mau diuji di sini, jadi di-reset dulu sebelum simulasi ketikan.
    await waitFor(() => expect(axiosPost).toHaveBeenCalledTimes(1));
    axiosPost.mockClear();

    rerender({ search: "I" });
    rerender({ search: "It" });
    rerender({ search: "Ite" });
    rerender({ search: "Item" });

    await waitFor(() => expect(axiosPost).toHaveBeenCalledTimes(1), {
      timeout: 2000,
    });
    expect(axiosPost.mock.calls[0][1]).toMatchObject({ search: "Item" });
  });

  it("cache-mode: payload menyertakan filters yang benar (regression bug lama -- dulu filters di-strip saat cacheMode aktif)", async () => {
    axiosPost.mockResolvedValue({ data: { data: [{ id: 1 }], total: 1 } });
    const { Wrapper } = createWrapper();

    renderHook(
      () =>
        useLinkModelOptions({
          model: "App\\Models\\Purchase\\PurchaseReceiptItem",
          filters: { item_id: { in: ["v1"] } },
          cacheMode: true,
          cacheStorage: "memory",
        }),
      { wrapper: Wrapper },
    );

    await waitFor(() => expect(axiosPost).toHaveBeenCalledTimes(1));
    const payload = axiosPost.mock.calls[0][1];
    expect(payload).toMatchObject({
      cacheMode: true,
      filters: { item_id: { in: ["v1"] } },
    });
    // mode cache TETAP tidak mengirim search/order/limit/fields/with -- itu
    // difilter di client, bukan bagian dari fix bug ini.
    expect(payload.search).toBeUndefined();
  });

  it("staleTime: data basi dari localStorage tetap tampil instan (no flicker) lalu refetch otomatis di background", async () => {
    axiosPost.mockResolvedValue({
      data: { data: [{ id: "first" }], total: 1 },
    });
    const params = {
      model: "App\\Models\\Core\\Currency",
      cacheMode: true,
      cacheStorage: "localStorage",
      staleTime: 1000,
    };

    const first = createWrapper();
    const { unmount } = renderHook(() => useLinkModelOptions(params), {
      wrapper: first.Wrapper,
    });
    await waitFor(() => expect(axiosPost).toHaveBeenCalledTimes(1));
    unmount();

    const storedKey = buildPersistKey(params);
    const stored = JSON.parse(window.localStorage.getItem(storedKey));
    expect(stored).toBeTruthy();
    stored.ts = Date.now() - 999_999; // jauh melewati staleTime 1000ms
    window.localStorage.setItem(storedKey, JSON.stringify(stored));

    // Kontrol timing refetch kedua secara manual (bukan mockResolvedValue
    // yang resolve nyaris instan) -- supaya state "instan tampil data lama"
    // bisa ke-capture deterministic oleh waitFor, bukan race dgn axios mock
    // yang resolve terlalu cepat utk ke-poll.
    axiosPost.mockClear();
    let resolveRefetch;
    axiosPost.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolveRefetch = resolve;
        }),
    );

    // QueryClient BARU -- simulasi in-memory cache kosong (mis. page reload),
    // satu-satunya sumber data awal adalah localStorage.
    const second = createWrapper();
    const { result } = renderHook(() => useLinkModelOptions(params), {
      wrapper: second.Wrapper,
    });

    // data lama HARUS tampil instan (no loading flicker) SEBELUM refetch
    // kedua selesai -- inilah inti stale-while-revalidate yang mau diuji.
    await waitFor(() =>
      expect(result.current.options).toEqual([{ id: "first" }]),
    );
    await waitFor(() => expect(axiosPost).toHaveBeenCalledTimes(1));

    resolveRefetch({ data: { data: [{ id: "refreshed" }], total: 1 } });

    await waitFor(() =>
      expect(result.current.options).toEqual([{ id: "refreshed" }]),
    );
  });

  it("staleTime: data yang MASIH fresh dari localStorage TIDAK memicu fetch sama sekali", async () => {
    axiosPost.mockResolvedValue({
      data: { data: [{ id: "first" }], total: 1 },
    });
    const params = {
      model: "App\\Models\\Core\\Currency",
      cacheMode: true,
      cacheStorage: "localStorage",
      staleTime: 60_000,
    };

    const first = createWrapper();
    const { unmount } = renderHook(() => useLinkModelOptions(params), {
      wrapper: first.Wrapper,
    });
    await waitFor(() => expect(axiosPost).toHaveBeenCalledTimes(1));
    unmount();

    axiosPost.mockClear();

    const second = createWrapper();
    const { result } = renderHook(() => useLinkModelOptions(params), {
      wrapper: second.Wrapper,
    });

    await waitFor(() =>
      expect(result.current.options).toEqual([{ id: "first" }]),
    );

    // beri jeda -- pastikan TIDAK ada fetch susulan krn data masih fresh
    await new Promise((resolve) => setTimeout(resolve, 200));
    expect(axiosPost).not.toHaveBeenCalled();
  });
});
