import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useState } from "react";

const axiosPost = vi.fn();
vi.mock("axios", () => ({
  default: { post: (...args) => axiosPost(...args) },
}));

import { useDocumentDefaults } from "./documentDefaults";

describe("conditional defaults delivery to document rows", () => {
  const defaults = {
    tax: { id: "module-tax", rate: 11 },
    warehouse: { id: "module-warehouse" },
  };
  const warehouse = { id: "rule-warehouse" };
  const item = (id) => ({
    id: `variant-${id}`,
    item: { id },
    is_stock_item: true,
  });
  let responses;
  beforeEach(() => {
    responses = [];
    axiosPost.mockReset();
    axiosPost.mockImplementation((url) =>
      url === "/defaults/resolve"
        ? new Promise((resolve) => responses.push(resolve))
        : Promise.resolve({ data: { data: [defaults.tax] } }),
    );
  });
  const mount = () =>
    renderHook(() => {
      const [form, setForm] = useState({ items: [] });
      const api = useDocumentDefaults(defaults, "purchase_order", {
        items: form.items,
        setData: setForm,
      });
      return { ...api, form, setForm };
    });
  const respond = async (index, id, taxIds = []) => {
    await waitFor(() => expect(responses[index]).toBeTypeOf("function"));
    await act(async () =>
      responses[index]({
        data: {
          items: {
            [id]: { tax_ids: taxIds, warehouse_id: warehouse.id, warehouse },
          },
        },
      }),
    );
  };

  it("delivers an early result when a new row appears without changing source rows or their order", async () => {
    const { result } = mount();
    act(() => {
      result.current.resolveForNewLine("new-row", item("item-1"), {
        warehouseField: "target_warehouse",
      });
    });
    await respond(0, "item-1");
    expect(result.current.form.items).toEqual([]);
    const source = {
      id: "source-row",
      item: item("item-1"),
      purchase_order_item_id: "source-1",
      tax: { id: "source-tax" },
    };
    act(() =>
      result.current.setForm({
        items: [
          source,
          {
            id: "new-row",
            item: item("item-1"),
            tax: defaults.tax,
            target_warehouse: defaults.warehouse,
          },
        ],
      }),
    );
    expect(result.current.form.items.map((row) => row.id)).toEqual([
      "source-row",
      "new-row",
    ]);
    expect(result.current.form.items[0]).toBe(source);
    expect(result.current.form.items[1]).toMatchObject({
      tax: null,
      tax_rate: 0,
      target_warehouse: warehouse,
    });
  });

  it("does not consume a result while the parent still holds the previous item", async () => {
    const { result } = mount();
    act(() => {
      result.current.setForm({ items: [{ id: "row", item: item("old") }] });
      result.current.resolveForNewLine("row", item("new"), {
        warehouseField: "target_warehouse",
      });
    });
    await respond(0, "new");
    expect(result.current.form.items[0]).not.toHaveProperty("tax");
    act(() =>
      result.current.setForm({ items: [{ id: "row", item: item("new") }] }),
    );
    expect(result.current.form.items[0]).toMatchObject({
      tax: null,
      target_warehouse: warehouse,
    });
  });

  it("waits for the table update even when the same item is reselected", async () => {
    const { result } = mount();
    const line = { id: "row", item: item("item-1"), tax: defaults.tax };
    act(() => result.current.setForm({ items: [line] }));
    act(() => {
      result.current.resolveForNewLine("row", item("item-1"));
    });
    await respond(0, "item-1");
    act(() => result.current.setForm({ items: [{ ...line }] }));
    expect(result.current.form.items[0]).toMatchObject({
      tax: null,
      tax_rate: 0,
    });
  });

  it("keeps manual clears made before a buffered result can be delivered", async () => {
    const { result } = mount();
    act(() => {
      result.current.resolveForNewLine("row", item("item-1"), {
        warehouseField: "target_warehouse",
      });
    });
    await respond(0, "item-1", [defaults.tax.id]);
    act(() => {
      result.current.markFieldEdited("row", "tax");
      result.current.markFieldEdited("row", "target_warehouse");
      result.current.setForm({
        items: [
          {
            id: "row",
            item: item("item-1"),
            tax: null,
            target_warehouse: null,
          },
        ],
      });
    });
    expect(result.current.form.items[0]).toMatchObject({
      tax: null,
      target_warehouse: null,
    });
  });

  it("does not restore a removed row or change a replacement source-linked row", async () => {
    const { result } = mount();
    act(() => {
      result.current.setForm({ items: [{ id: "row", item: item("item-1") }] });
      result.current.resolveForNewLine("row", item("item-1"));
    });
    act(() => result.current.setForm({ items: [] }));
    await respond(0, "item-1");
    expect(result.current.form.items).toEqual([]);
    const source = {
      id: "row",
      item: item("item-1"),
      purchase_receipt_item_id: "receipt-row",
      tax: { id: "source-tax" },
    };
    act(() => result.current.setForm({ items: [source] }));
    expect(result.current.form.items[0]).toBe(source);
  });

  it("waits for resolved defaults to be applied before allowing submission", async () => {
    const { result } = mount();
    act(() => {
      result.current.setForm({
        items: [{ id: "new-row", item: item("item-1") }],
      });
      result.current.resolveForNewLine("new-row", item("item-1"), {
        warehouseField: "target_warehouse",
      });
    });

    let completed = false;
    let waitForDefaults;
    act(() => {
      waitForDefaults = result.current.waitForPendingResolutions().then(() => {
        completed = true;
      });
    });
    expect(completed).toBe(false);

    await respond(0, "item-1");
    await act(async () => waitForDefaults);

    expect(completed).toBe(true);
    expect(result.current.form.items[0]).toMatchObject({
      tax: null,
      target_warehouse: warehouse,
    });
  });

  it("keeps a quick save pending until a new row propagates through RAF and receives its defaults", async () => {
    vi.useFakeTimers();
    try {
      const { result } = mount();
      let completed = false;
      act(() => {
        result.current.resolveForNewLine("new-row", item("item-1"));
        requestAnimationFrame(() => {
          result.current.setForm({
            items: [{ id: "new-row", item: item("item-1"), tax: defaults.tax }],
          });
        });
        result.current.waitForPendingResolutions().then(() => {
          completed = true;
        });
      });
      await act(async () => vi.advanceTimersByTimeAsync(1));
      expect(completed).toBe(false);
      await act(async () => responses[0]({
        data: { items: { "item-1": { tax_ids: [], warehouse_id: null } } },
      }));
      expect(completed).toBe(false);
      await act(async () => vi.advanceTimersToNextFrame());
      expect(completed).toBe(true);
      expect(result.current.form.items[0]).toMatchObject({ tax: null, tax_rate: 0 });
    } finally {
      vi.useRealTimers();
    }
  });

  it.each([
    { asset: { id: "asset-1" }, item: null },
    {
      purchase_receipt_item_id: "receipt-1",
      item: item("other-item"),
      tax: { id: "source-tax" },
    },
  ])(
    "settles submission when a pending manual row becomes %j",
    async (replacement) => {
      const { result } = mount();
      act(() => {
        result.current.resolveForNewLine("row", item("item-1"));
        result.current.setForm({
          items: [{ id: "row", item: item("item-1") }],
        });
      });
      await waitFor(() => expect(responses[0]).toBeTypeOf("function"));
      let completed = false;
      const submission = result.current.waitForPendingResolutions().then(() => {
        completed = true;
      });
      act(() =>
        result.current.setForm({ items: [{ id: "row", ...replacement }] }),
      );
      await waitFor(() => expect(completed).toBe(true));
      await submission;
      await respond(0, "item-1", [defaults.tax.id]);
      expect(result.current.form.items).toEqual([
        { id: "row", ...replacement },
      ]);
    },
  );

  it("settles an already waiting submission when its row is removed", async () => {
    const { result } = mount();
    act(() => {
      result.current.resolveForNewLine("row", item("item-1"));
      result.current.setForm({ items: [{ id: "row", item: item("item-1") }] });
    });
    await waitFor(() => expect(responses[0]).toBeTypeOf("function"));
    let completed = false;
    const submission = result.current.waitForPendingResolutions().then(() => {
      completed = true;
    });
    act(() => result.current.setForm({ items: [] }));
    await waitFor(() => expect(completed).toBe(true));
    await submission;
    await respond(0, "item-1");
    expect(result.current.form.items).toEqual([]);
  });

  it("keeps submission waiting for the replacement manual item's resolution", async () => {
    const { result } = mount();
    act(() => {
      result.current.resolveForNewLine("row", item("item-1"));
      result.current.setForm({ items: [{ id: "row", item: item("item-1") }] });
    });
    await waitFor(() => expect(responses[0]).toBeTypeOf("function"));
    let completed = false;
    const submission = result.current.waitForPendingResolutions().then(() => {
      completed = true;
    });
    await act(async () => {
      result.current.resolveForNewLine("row", item("item-2"));
      result.current.setForm({ items: [{ id: "row", item: item("item-2") }] });
    });
    expect(completed).toBe(false);
    await respond(1, "item-2");
    await submission;
    expect(completed).toBe(true);
    await respond(0, "item-1", [defaults.tax.id]);
    expect(result.current.form.items[0]).toMatchObject({
      item: item("item-2"),
      tax: null,
    });
  });
});

describe("bounded conditional resolution", () => {
  const defaults = { tax: { id: "module-tax", rate: 11 }, warehouse: { id: "module-warehouse" } };
  const item = { id: "item-1", is_stock_item: true };

  beforeEach(() => {
    vi.useFakeTimers();
    axiosPost.mockReset();
  });
  afterEach(() => vi.useRealTimers());

  it.each(["resolution", "tax hydration", "warehouse hydration"])("falls back and releases submission when %s hangs, ignoring late results", async (stage) => {
    let respond;
    let requestSignal;
    axiosPost.mockImplementation((url, _payload, options) => {
      if (stage !== "resolution" && url === "/defaults/resolve") {
        return new Promise((resolve) => setTimeout(() => resolve({ data: { items: { "item-1": {
          tax_ids: stage === "tax hydration" ? ["rule-tax"] : [],
          warehouse_id: stage === "warehouse hydration" ? "rule-warehouse" : null,
        } } } }), 6000));
      }
      requestSignal = options?.signal;
      return new Promise((resolve) => { respond = resolve; });
    });
    const { result } = renderHook(() => {
      const [form, setForm] = useState({ items: [] });
      const api = useDocumentDefaults(defaults, "purchase_order", { items: form.items, setData: setForm });
      return { ...api, form, setForm };
    });
    let completed = false;
    act(() => {
      result.current.resolveForNewLine("row", item, { warehouseField: "target_warehouse" });
      result.current.setForm({ items: [{ id: "row", item }] });
    });
    result.current.waitForPendingResolutions().then(() => { completed = true; });
    await act(async () => vi.advanceTimersByTimeAsync(stage === "resolution" ? 1 : 6001));
    expect(completed).toBe(false);
    expect(respond).toBeTypeOf("function");
    await act(async () => vi.advanceTimersByTimeAsync(stage === "resolution" ? 10000 : 4000));
    expect(completed).toBe(true);
    expect(requestSignal.aborted).toBe(true);
    expect(result.current.form.items[0]).toMatchObject({ tax: defaults.tax, target_warehouse: defaults.warehouse });
    const requestCount = axiosPost.mock.calls.length;
    await act(async () => respond(stage === "resolution"
      ? { data: { items: { "item-1": { tax_ids: ["late-tax"], warehouse_id: "late-warehouse" } } } }
      : { data: { data: [{ id: "rule-tax", rate: 5 }] } }));
    expect(axiosPost).toHaveBeenCalledTimes(requestCount);
    expect(result.current.form.items[0]).toMatchObject({ tax: defaults.tax, target_warehouse: defaults.warehouse });
  });

  it("releases a quick save if a selected row never propagates", async () => {
    axiosPost.mockResolvedValue({ data: { items: { "item-1": { tax_ids: [], warehouse_id: null } } } });
    const { result } = renderHook(() => useDocumentDefaults(defaults, "purchase_order", { items: [], setData: vi.fn() }));
    let completed = false;
    act(() => { result.current.resolveForNewLine("orphan", item); });
    result.current.waitForPendingResolutions().then(() => { completed = true; });
    await act(async () => vi.advanceTimersByTimeAsync(1));
    expect(completed).toBe(false);
    await act(async () => vi.advanceTimersByTimeAsync(10000));
    expect(completed).toBe(true);
  });

  it("aborts active requests and settles queued callers when unmounted", async () => {
    let requestSignal;
    axiosPost.mockImplementation((_url, _payload, options) => {
      requestSignal = options?.signal;
      return new Promise(() => {});
    });
    const { result, unmount } = renderHook(() => useDocumentDefaults(defaults, "purchase_order"));
    const active = result.current.resolveForItem("item-1");
    await act(async () => vi.advanceTimersByTimeAsync(1));
    const queued = result.current.resolveForItem("item-2");
    unmount();
    expect(requestSignal.aborted).toBe(true);
    await expect(active).resolves.toBe(defaults);
    await expect(queued).resolves.toBe(defaults);
    expect(vi.getTimerCount()).toBe(0);
  });
});

describe("useDocumentDefaults conditional resolution", () => {
  beforeEach(() => {
    axiosPost.mockReset();
    window.route = (name) => name;
  });

  it("batches item resolutions and hydrates resolved tax and warehouse records", async () => {
    axiosPost.mockImplementation(async (url) => {
      if (url === "/defaults/resolve") {
        return {
          data: {
            items: {
              "item-1": { tax_ids: ["tax-1"], warehouse_id: "warehouse-1" },
              "item-2": { tax_ids: [], warehouse_id: null },
            },
          },
        };
      }
      if (url === "model") {
        return {
          data: {
            data: [
              { id: "tax-1", name: "VAT", rate: 11 },
              { id: "warehouse-1", name: "Main" },
            ],
          },
        };
      }
      throw new Error(`Unexpected URL: ${url}`);
    });

    const { result } = renderHook(() => useDocumentDefaults({}, "sales_order"));
    let first;
    let second;
    await act(async () => {
      const firstPromise = result.current.resolveForItem("item-1");
      const secondPromise = result.current.resolveForItem("item-2");
      await waitFor(() => expect(axiosPost).toHaveBeenCalled());
      [first, second] = await Promise.all([firstPromise, secondPromise]);
    });

    expect(axiosPost).toHaveBeenCalledWith(
      "/defaults/resolve",
      {
        document_type: "sales_order",
        items: [{ item_id: "item-1" }, { item_id: "item-2" }],
      },
      expect.objectContaining({ signal: expect.any(AbortSignal) }),
    );
    expect(first).toEqual({
      tax: { id: "tax-1", name: "VAT", rate: 11 },
      warehouse: { id: "warehouse-1", name: "Main" },
    });
    expect(second).toEqual({ tax: null, warehouse: null });
  });

  it("uses a globally resolved warehouse reference without a branch-scoped model lookup", async () => {
    const warehouse = {
      id: "warehouse-global",
      name: "Configured warehouse",
      branch_id: "other-branch",
    };
    axiosPost.mockResolvedValue({
      data: {
        items: {
          "item-1": {
            tax_ids: [],
            warehouse_id: warehouse.id,
            warehouse,
          },
        },
      },
    });

    const { result } = renderHook(() =>
      useDocumentDefaults({}, "purchase_order"),
    );
    let resolved;
    await act(async () => {
      const promise = result.current.resolveForItem("item-1");
      await waitFor(() => expect(axiosPost).toHaveBeenCalled());
      resolved = await promise;
    });

    expect(resolved.warehouse).toEqual(warehouse);
    expect(axiosPost).toHaveBeenCalledTimes(1);
  });

  it("falls back to module defaults when resolution fails", async () => {
    const defaults = {
      tax: { id: "tax-default", rate: 11 },
      warehouse: { id: "warehouse-default" },
    };
    axiosPost.mockRejectedValue(new Error("offline"));

    const { result } = renderHook(() =>
      useDocumentDefaults(defaults, "purchase_order"),
    );
    let resolved;
    await act(async () => {
      const promise = result.current.resolveForItem("item-1");
      await waitFor(() => expect(axiosPost).toHaveBeenCalled());
      resolved = await promise;
    });

    expect(resolved).toBe(defaults);
  });

  it("falls back to module tax when resolved tax details cannot be loaded", async () => {
    const defaults = { tax: { id: "module-tax", rate: 11 }, warehouse: null };
    axiosPost.mockImplementation(async (url) => {
      if (url === "/defaults/resolve") {
        return {
          data: {
            items: {
              "item-1": { tax_ids: ["conditional-tax"], warehouse_id: null },
            },
          },
        };
      }

      return { data: { data: [] } };
    });

    const { result } = renderHook(() =>
      useDocumentDefaults(defaults, "sales_invoice"),
    );
    let resolved;
    await act(async () => {
      const promise = result.current.resolveForItem("item-1");
      await waitFor(() => expect(axiosPost).toHaveBeenCalled());
      resolved = await promise;
    });

    expect(resolved).toEqual(defaults);
  });
});
