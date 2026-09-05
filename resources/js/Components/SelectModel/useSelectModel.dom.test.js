import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";

const axiosPost = vi.fn();
vi.mock("axios", () => ({
  default: {
    post: (...args) => axiosPost(...args),
    isCancel: () => false,
  },
}));

const toastError = vi.fn();
vi.mock("@/lib/gooeyToast", () => ({
  gooeyToast: { error: (...args) => toastError(...args) },
}));

const tMock = vi.fn((key) => key);
vi.mock("laravel-react-i18n", () => ({
  useLaravelReactI18n: () => ({ t: tMock }),
}));

// Tambahkan route() ke window jsdom yang sudah ada -- JANGAN replace window
// seluruhnya (vi.stubGlobal("window", {...})), karena itu menghapus semua
// property jsdom lain yang dibutuhkan dependency transitive. Lihat juga
// Components/SelectModel.dom.test.js.
window.route = (name) => name;

const {
  default: useSelectModel,
  SELF_OPTION,
  applyColumnAlias,
} = await import("./useSelectModel.js");

/**
 * Helper: bentuk response sukses backend model.selectData.
 * @param overrides
 */
function resolvedResponse(overrides = {}) {
  return {
    data: {
      model: overrides.model ?? "App\\Models\\User",
      translateKey: overrides.translateKey ?? null,
      parentColumn: overrides.parentColumn ?? null,
      columns: overrides.columns ?? [],
      data: {
        data: overrides.rows ?? [],
        current_page: overrides.currentPage ?? 1,
        last_page: overrides.lastPage ?? 1,
        per_page: overrides.perPage ?? 25,
        total: overrides.total ?? 0,
      },
    },
  };
}

describe("applyColumnAlias (pure)", () => {
  it("tanpa alias (undefined/kosong) -> return rows apa adanya (reference sama)", () => {
    const rows = [{ id: 1 }];
    expect(applyColumnAlias(rows, undefined)).toBe(rows);
    expect(applyColumnAlias(rows, {})).toBe(rows);
  });

  it("dengan alias -> set row[target] = row[source] pada salinan baru, tak mutasi asli", () => {
    const rows = [{ id: 1, name: "Budi" }];
    const result = applyColumnAlias(rows, { display_name: "name" });

    expect(result).toEqual([{ id: 1, name: "Budi", display_name: "Budi" }]);
    expect(result).not.toBe(rows);
    expect(result[0]).not.toBe(rows[0]);
    expect(rows[0]).toEqual({ id: 1, name: "Budi" });
  });

  it("source key tidak ada di row -> target diisi undefined", () => {
    const rows = [{ id: 1 }];
    const result = applyColumnAlias(rows, { display_name: "missing" });
    expect(result[0].display_name).toBeUndefined();
  });
});

describe("useSelectModel - config normalization & initial state", () => {
  beforeEach(() => {
    axiosPost.mockReset();
    toastError.mockClear();
    tMock.mockClear();
  });

  it("from berupa string -> modelKeys satu entri, activeModel = string tsb", () => {
    const { result } = renderHook(() =>
      useSelectModel({ from: "App\\Models\\User", onSelected: vi.fn() }),
    );

    expect(result.current.activeModel).toBe("App\\Models\\User");
    expect(result.current.modelOptions).toEqual([
      { value: "App\\Models\\User", label: "User" },
    ]);
  });

  it("from berupa object -> activeModel = key pertama (urutan dipertahankan)", () => {
    const { result } = renderHook(() =>
      useSelectModel({
        from: { "App\\Models\\Role": {}, "App\\Models\\User": {} },
        onSelected: vi.fn(),
      }),
    );

    expect(result.current.activeModel).toBe("App\\Models\\Role");
    expect(result.current.modelOptions.map((o) => o.value)).toEqual([
      "App\\Models\\Role",
      "App\\Models\\User",
    ]);
  });

  it("state awal: dialog tertutup, belum loading, default sort/perPage/pagination/data", () => {
    const { result } = renderHook(() =>
      useSelectModel({ from: "App\\Models\\User", onSelected: vi.fn() }),
    );

    expect(result.current.open).toBe(false);
    expect(result.current.loading).toBe(false);
    expect(result.current.activeView).toBe(SELF_OPTION);
    expect(result.current.sort).toBe("-created_at");
    expect(result.current.perPage).toBe(25);
    expect(result.current.perPageOptions).toEqual([10, 25, 50, 100]);
    expect(result.current.pagination).toEqual({
      currentPage: 1,
      lastPage: 1,
      perPage: 25,
      total: 0,
    });
    expect(result.current.data).toEqual([]);
    expect(result.current.columns).toEqual([]);
    expect(result.current.selectedCount).toBe(0);
    expect(result.current.selectKeys).toEqual([]);
    expect(result.current.viewOptions).toEqual([]);
    expect(axiosPost).not.toHaveBeenCalled();
  });
});

describe("useSelectModel - viewOptions/modelOptions fallback tanpa translateKey", () => {
  it("viewOptions kosong bila config tidak punya selects (directMode)", () => {
    const { result } = renderHook(() =>
      useSelectModel({ from: "App\\Models\\User", onSelected: vi.fn() }),
    );
    expect(result.current.viewOptions).toEqual([]);
  });

  it("viewOptions berisi SELF_OPTION + tiap selectKey, label fallback ke activeModel/key", () => {
    const from = {
      "App\\Models\\PurchaseOrder": { selects: { items: {}, payments: {} } },
    };
    const { result } = renderHook(() =>
      useSelectModel({ from, onSelected: vi.fn() }),
    );

    expect(result.current.selectKeys).toEqual(["items", "payments"]);
    expect(result.current.viewOptions).toEqual([
      { value: SELF_OPTION, label: "App\\Models\\PurchaseOrder" },
      { value: "items", label: "items" },
      { value: "payments", label: "payments" },
    ]);
  });
});

describe("useSelectModel - loadData request payload", () => {
  beforeEach(() => {
    axiosPost.mockReset();
    toastError.mockClear();
  });

  it("tidak fetch selama dialog tertutup", () => {
    renderHook(() =>
      useSelectModel({ from: "App\\Models\\User", onSelected: vi.fn() }),
    );
    expect(axiosPost).not.toHaveBeenCalled();
  });

  it("setOpen(true) memicu axios.post ke model.selectData dengan payload direct-mode default", async () => {
    axiosPost.mockResolvedValue(resolvedResponse());
    const { result } = renderHook(() =>
      useSelectModel({ from: "App\\Models\\User", onSelected: vi.fn() }),
    );

    act(() => {
      result.current.setOpen(true);
    });

    await waitFor(() => expect(axiosPost).toHaveBeenCalledTimes(1));

    const [url, body] = axiosPost.mock.calls[0];
    expect(url).toBe("model.selectData");
    expect(body).toEqual({
      model: "App\\Models\\User",
      select: undefined,
      columns: undefined,
      baseFilters: undefined,
      filters: undefined,
      fid: undefined,
      sort: "-created_at",
      page: 1,
      show: 25,
      with: undefined,
    });
  });

  it("direct mode dengan config filters/columns -> terkirim sebagai baseFilters/columns", async () => {
    axiosPost.mockResolvedValue(resolvedResponse());
    const from = {
      "App\\Models\\User": {
        filters: { root: { k: "active", o: "=", v: true } },
        columns: ["id", "name"],
      },
    };
    const { result } = renderHook(() =>
      useSelectModel({ from, onSelected: vi.fn() }),
    );

    act(() => result.current.setOpen(true));
    await waitFor(() => expect(axiosPost).toHaveBeenCalledTimes(1));

    const [, body] = axiosPost.mock.calls[0];
    expect(body.baseFilters).toEqual({
      root: { k: "active", o: "=", v: true },
    });
    expect(body.columns).toEqual(["id", "name"]);
  });

  it("view self dengan selects config -> with berisi seluruh selectKeys", async () => {
    axiosPost.mockResolvedValue(resolvedResponse());
    const from = {
      "App\\Models\\PurchaseOrder": { selects: { items: {} } },
    };
    const { result } = renderHook(() =>
      useSelectModel({ from, onSelected: vi.fn() }),
    );

    act(() => result.current.setOpen(true));
    await waitFor(() => expect(axiosPost).toHaveBeenCalledTimes(1));

    const [, body] = axiosPost.mock.calls[0];
    expect(body.select).toBeUndefined();
    expect(body.with).toEqual(["items"]);
  });

  it("switch ke view per-item (selectKey) -> select=key, with=undefined, page reset ke 1", async () => {
    axiosPost.mockResolvedValue(resolvedResponse());
    const from = {
      "App\\Models\\PurchaseOrder": {
        selects: { items: { columns: ["id", "qty"], filters: { a: 1 } } },
      },
    };
    const { result } = renderHook(() =>
      useSelectModel({ from, onSelected: vi.fn() }),
    );

    act(() => result.current.setOpen(true));
    await waitFor(() => expect(axiosPost).toHaveBeenCalledTimes(1));

    act(() => result.current.setActiveView("items"));
    await waitFor(() => expect(axiosPost).toHaveBeenCalledTimes(2));

    const [, body] = axiosPost.mock.calls[1];
    expect(body.select).toBe("items");
    expect(body.with).toBeUndefined();
    expect(body.columns).toEqual(["id", "qty"]);
    expect(body.baseFilters).toEqual({ a: 1 });
    expect(body.page).toBe(1);
  });
});

describe("useSelectModel - setters memicu ulang loadData dengan payload sesuai", () => {
  beforeEach(() => {
    axiosPost.mockReset();
    axiosPost.mockResolvedValue(resolvedResponse());
    toastError.mockClear();
  });

  async function openAndWaitFirstCall(hookProps) {
    const { result } = renderHook(() => useSelectModel(hookProps));
    act(() => result.current.setOpen(true));
    await waitFor(() => expect(axiosPost).toHaveBeenCalledTimes(1));
    return result;
  }

  it("setActiveModel: ganti model + reset view/filter/page", async () => {
    const from = { "App\\Models\\User": {}, "App\\Models\\Role": {} };
    const result = await openAndWaitFirstCall({ from, onSelected: vi.fn() });

    act(() => result.current.setActiveModel("App\\Models\\Role"));
    await waitFor(() => expect(axiosPost).toHaveBeenCalledTimes(2));

    expect(result.current.activeModel).toBe("App\\Models\\Role");
    expect(result.current.activeView).toBe(SELF_OPTION);
    const [, body] = axiosPost.mock.calls[1];
    expect(body.model).toBe("App\\Models\\Role");
    expect(body.page).toBe(1);
  });

  it("setPerPage: ubah show + reset page ke 1", async () => {
    const result = await openAndWaitFirstCall({
      from: "App\\Models\\User",
      onSelected: vi.fn(),
    });

    act(() => result.current.setPage(3));
    await waitFor(() => expect(axiosPost).toHaveBeenCalledTimes(2));

    act(() => result.current.setPerPage(50));
    await waitFor(() => expect(axiosPost).toHaveBeenCalledTimes(3));

    expect(result.current.perPage).toBe(50);
    const [, body] = axiosPost.mock.calls[2];
    expect(body.show).toBe(50);
    expect(body.page).toBe(1);
  });

  it("setPage: ubah page tanpa reset field lain", async () => {
    const result = await openAndWaitFirstCall({
      from: "App\\Models\\User",
      onSelected: vi.fn(),
    });

    act(() => result.current.setPage(4));
    await waitFor(() => expect(axiosPost).toHaveBeenCalledTimes(2));

    const [, body] = axiosPost.mock.calls[1];
    expect(body.page).toBe(4);
  });

  it("setSort dan resetSorting", async () => {
    const result = await openAndWaitFirstCall({
      from: "App\\Models\\User",
      onSelected: vi.fn(),
    });

    act(() => result.current.setSort("name"));
    await waitFor(() => expect(axiosPost).toHaveBeenCalledTimes(2));
    expect(result.current.sort).toBe("name");
    expect(axiosPost.mock.calls[1][1].sort).toBe("name");

    act(() => result.current.resetSorting());
    await waitFor(() => expect(axiosPost).toHaveBeenCalledTimes(3));
    expect(result.current.sort).toBe("-created_at");
  });

  it("savedFilterId dikirim sebagai fid", async () => {
    const result = await openAndWaitFirstCall({
      from: "App\\Models\\User",
      onSelected: vi.fn(),
    });

    act(() => result.current.setSavedFilterId(9));
    await waitFor(() => expect(axiosPost).toHaveBeenCalledTimes(2));

    const [, body] = axiosPost.mock.calls[1];
    expect(body.fid).toBe(9);
  });

  it("applyFilters: kirim userFilters sebagai filters + reset page ke 1", async () => {
    const result = await openAndWaitFirstCall({
      from: "App\\Models\\User",
      onSelected: vi.fn(),
    });

    const filterTree = { root: { k: "name", o: "=", v: "Budi" } };
    act(() => result.current.setUserFilters(filterTree));
    act(() => result.current.applyFilters());

    await waitFor(() => expect(axiosPost).toHaveBeenCalledTimes(2));

    expect(result.current.userFilters).toEqual(filterTree);
    const [, body] = axiosPost.mock.calls[1];
    expect(body.filters).toEqual(filterTree);
    expect(body.page).toBe(1);
  });

  it("clearFilters: reset userFilters/savedFilterId + page, filters/fid tak lagi terkirim", async () => {
    const result = await openAndWaitFirstCall({
      from: "App\\Models\\User",
      onSelected: vi.fn(),
    });

    act(() =>
      result.current.setUserFilters({ root: { k: "name", o: "=", v: "Budi" } }),
    );
    act(() => result.current.applyFilters());
    await waitFor(() => expect(axiosPost).toHaveBeenCalledTimes(2));

    act(() => result.current.setSavedFilterId(7));
    act(() => result.current.clearFilters());

    expect(result.current.userFilters).toBeNull();
    expect(result.current.savedFilterId).toBeNull();

    await waitFor(() => expect(axiosPost).toHaveBeenCalledTimes(3));
    const [, body] = axiosPost.mock.calls[2];
    expect(body.filters).toBeUndefined();
    expect(body.fid).toBeUndefined();
    expect(body.page).toBe(1);
  });
});

describe("useSelectModel - abort request saat dialog ditutup", () => {
  beforeEach(() => {
    axiosPost.mockReset();
  });

  it("menutup dialog memanggil abort() pada AbortSignal request yang sedang berjalan", async () => {
    let capturedSignal;
    axiosPost.mockImplementation((_url, _body, opts) => {
      capturedSignal = opts?.signal;
      return new Promise(() => {}); // request sengaja tak pernah resolve
    });

    const { result } = renderHook(() =>
      useSelectModel({ from: "App\\Models\\User", onSelected: vi.fn() }),
    );

    act(() => result.current.setOpen(true));
    await waitFor(() => expect(axiosPost).toHaveBeenCalledTimes(1));
    expect(capturedSignal?.aborted).toBe(false);

    act(() => result.current.setOpen(false));

    expect(capturedSignal?.aborted).toBe(true);
  });
});

describe("useSelectModel - error handling saat loadData gagal", () => {
  beforeEach(() => {
    axiosPost.mockReset();
    toastError.mockClear();
  });

  it("request gagal (bukan cancel) -> data & total direset, toast error ditampilkan", async () => {
    axiosPost.mockRejectedValue(new Error("network down"));
    const { result } = renderHook(() =>
      useSelectModel({ from: "App\\Models\\User", onSelected: vi.fn() }),
    );

    act(() => result.current.setOpen(true));

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.data).toEqual([]);
    expect(result.current.pagination.total).toBe(0);
    expect(toastError).toHaveBeenCalledWith("core.errors.fetch_failed");
  });

  it("request dibatalkan (CanceledError) -> tidak reset data, tidak toast", async () => {
    const cancelErr = new Error("canceled");
    cancelErr.name = "CanceledError";
    axiosPost.mockRejectedValue(cancelErr);

    const { result } = renderHook(() =>
      useSelectModel({ from: "App\\Models\\User", onSelected: vi.fn() }),
    );

    act(() => result.current.setOpen(true));
    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(toastError).not.toHaveBeenCalled();
    expect(result.current.data).toEqual([]);
  });
});

describe("useSelectModel - loadData response sukses", () => {
  beforeEach(() => {
    axiosPost.mockReset();
    toastError.mockClear();
    tMock.mockClear();
  });

  it("menyimpan columns/pagination/parentColumn dari response; columnMap terfilter (hidden/ignore) & terurut by order", async () => {
    axiosPost.mockResolvedValue(
      resolvedResponse({
        model: "App\\Models\\User",
        translateKey: "core.user",
        parentColumn: "user_id",
        columns: [
          { name: "email", order: 2 },
          { name: "id", order: 1 },
          { name: "secret", hidden: true, order: 0 },
          { name: "fk_role", ignore: true, order: 3 },
          { name: "no_order" },
        ],
        rows: [{ id: 1, email: "a@b.com" }],
        currentPage: 2,
        lastPage: 5,
        perPage: 25,
        total: 42,
      }),
    );

    const { result } = renderHook(() =>
      useSelectModel({ from: "App\\Models\\User", onSelected: vi.fn() }),
    );

    act(() => result.current.setOpen(true));
    await waitFor(() => expect(result.current.data).toHaveLength(1));

    expect(result.current.columns).toHaveLength(5);
    expect(Object.keys(result.current.columnMap)).toEqual([
      "id",
      "email",
      "no_order",
    ]);
    expect(result.current.parentColumn).toBe("user_id");
    expect(result.current.pagination).toEqual({
      currentPage: 2,
      lastPage: 5,
      perPage: 25,
      total: 42,
    });
    expect(result.current.modelOptions).toEqual([
      { value: "App\\Models\\User", label: "core.user.title" },
    ]);
  });
});

describe("useSelectModel - confirmSelection", () => {
  beforeEach(() => {
    axiosPost.mockReset();
    axiosPost.mockResolvedValue(resolvedResponse());
    toastError.mockClear();
  });

  async function openAndWaitFirstCall(hookProps) {
    const { result } = renderHook(() => useSelectModel(hookProps));
    act(() => result.current.setOpen(true));
    await waitFor(() => expect(axiosPost).toHaveBeenCalledTimes(1));
    return result;
  }

  it("tidak ada baris terpilih -> no-op, onSelected tidak dipanggil (R5.6)", async () => {
    const onSelected = vi.fn();
    const result = await openAndWaitFirstCall({
      from: "App\\Models\\User",
      onSelected,
    });
    result.current.tableRef.current = { getSelectedItem: () => [] };

    act(() => result.current.confirmSelection());

    expect(onSelected).not.toHaveBeenCalled();
  });

  it("direct mode: rows apa adanya, model=activeModel, dialog ditutup", async () => {
    const onSelected = vi.fn();
    const result = await openAndWaitFirstCall({
      from: "App\\Models\\User",
      onSelected,
    });
    result.current.tableRef.current = {
      getSelectedItem: () => [{ id: 1 }, { id: 2 }],
    };

    act(() => result.current.confirmSelection());

    expect(onSelected).toHaveBeenCalledWith({
      items: [{ id: 1 }, { id: 2 }],
      model: "App\\Models\\User",
      mode: "direct",
      sourceModel: null,
      sourceIds: null,
    });
    expect(result.current.open).toBe(false);
  });

  it("direct mode dengan columnAlias: target diisi dari source sebelum onSelected", async () => {
    const onSelected = vi.fn();
    const from = {
      "App\\Models\\User": { columnAlias: { display_name: "name" } },
    };
    const result = await openAndWaitFirstCall({ from, onSelected });
    result.current.tableRef.current = {
      getSelectedItem: () => [{ id: 1, name: "Budi" }],
    };

    act(() => result.current.confirmSelection());

    expect(onSelected).toHaveBeenCalledWith(
      expect.objectContaining({
        items: [{ id: 1, name: "Budi", display_name: "Budi" }],
      }),
    );
  });

  it("self-extraction: flatMap relasi selectKeys[0], model dari relatedModelOf via server.columns", async () => {
    const onSelected = vi.fn();
    const from = {
      "App\\Models\\PurchaseOrder": { selects: { items: {} } },
    };
    axiosPost.mockResolvedValue(
      resolvedResponse({
        model: "App\\Models\\PurchaseOrder",
        columns: [{ name: "items", related: "App\\Models\\PurchaseOrderItem" }],
      }),
    );
    const result = await openAndWaitFirstCall({ from, onSelected });
    await waitFor(() => expect(result.current.columns).toHaveLength(1));

    result.current.tableRef.current = {
      getSelectedItem: () => [
        { id: 1, items: [{ id: 10 }, { id: 11 }] },
        { id: 2, items: [{ id: 12 }] },
      ],
    };

    act(() => result.current.confirmSelection());

    expect(onSelected).toHaveBeenCalledWith({
      items: [{ id: 10 }, { id: 11 }, { id: 12 }],
      model: "App\\Models\\PurchaseOrderItem",
      mode: "self-extraction",
      sourceModel: "App\\Models\\PurchaseOrder",
      sourceIds: [1, 2],
    });
  });

  it("self-extraction: baris tanpa relasi tsb tidak menyumbang item (default []), model fallback ke activeModel", async () => {
    const onSelected = vi.fn();
    const from = {
      "App\\Models\\PurchaseOrder": { selects: { items: {} } },
    };
    const result = await openAndWaitFirstCall({ from, onSelected });
    result.current.tableRef.current = {
      getSelectedItem: () => [{ id: 1 }], // tidak ada key "items"
    };

    act(() => result.current.confirmSelection());

    expect(onSelected).toHaveBeenCalledWith(
      expect.objectContaining({
        items: [],
        model: "App\\Models\\PurchaseOrder",
      }),
    );
  });

  it("per-item mode: rows apa adanya, model dari server.model (response select spesifik)", async () => {
    const onSelected = vi.fn();
    const from = {
      "App\\Models\\PurchaseOrder": { selects: { items: {} } },
    };
    axiosPost.mockResolvedValue(
      resolvedResponse({ model: "App\\Models\\PurchaseOrderItem" }),
    );
    const result = await openAndWaitFirstCall({ from, onSelected });

    act(() => result.current.setActiveView("items"));
    await waitFor(() => expect(axiosPost).toHaveBeenCalledTimes(2));

    result.current.tableRef.current = {
      getSelectedItem: () => [{ id: 100, name: "Item A" }],
    };

    act(() => result.current.confirmSelection());

    expect(onSelected).toHaveBeenCalledWith({
      items: [{ id: 100, name: "Item A" }],
      model: "App\\Models\\PurchaseOrderItem",
      mode: "per-item",
      sourceModel: null,
      sourceIds: null,
    });
  });

  it("onSelected opsional -- confirmSelection tidak throw walau tidak diberikan", async () => {
    const result = await openAndWaitFirstCall({ from: "App\\Models\\User" });
    result.current.tableRef.current = {
      getSelectedItem: () => [{ id: 1 }],
    };

    expect(() => act(() => result.current.confirmSelection())).not.toThrow();
    expect(result.current.open).toBe(false);
  });
});

describe("useSelectModel - selectedCount polling saat dialog terbuka", () => {
  beforeEach(() => {
    axiosPost.mockReset();
    axiosPost.mockResolvedValue(resolvedResponse());
  });

  it("poll getSelectedItem() secara periodik saat dialog terbuka", async () => {
    const { result } = renderHook(() =>
      useSelectModel({ from: "App\\Models\\User", onSelected: vi.fn() }),
    );

    act(() => result.current.setOpen(true));
    result.current.tableRef.current = {
      getSelectedItem: () => [{ id: 1 }, { id: 2 }],
    };

    await waitFor(() => expect(result.current.selectedCount).toBe(2));
  });

  it("selectedCount reset ke 0 saat dialog ditutup", async () => {
    const { result } = renderHook(() =>
      useSelectModel({ from: "App\\Models\\User", onSelected: vi.fn() }),
    );

    act(() => result.current.setOpen(true));
    result.current.tableRef.current = { getSelectedItem: () => [{ id: 1 }] };
    await waitFor(() => expect(result.current.selectedCount).toBe(1));

    act(() => result.current.setOpen(false));

    expect(result.current.selectedCount).toBe(0);
  });
});
