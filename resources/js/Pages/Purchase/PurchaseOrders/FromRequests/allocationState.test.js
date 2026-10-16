import { describe, expect, it } from "vitest";
import {
  addAllocation,
  changeDraftSupplier,
  createInitialState,
  formatWarningQuantity,
  getQuantityWarnings,
  moveAllocation,
  reconcileDrafts,
  removeAllocation,
  setAllocationQuantity,
  setAllocationUnit,
  splitAllocation,
  splitDraft,
} from "./allocationState";

const sources = [
  {
    id: "pr-a",
    code: "PR-A",
    external_note: "Maintenance",
    items: [
      {
        id: "item-a",
        item: { id: "variant-1" },
        unit: "pcs",
        unordered_quantity: "10",
        rate: 12,
      },
      { id: "done", unordered_quantity: 0 },
    ],
  },
  {
    id: "pr-b",
    code: "PR-B",
    items: [
      {
        id: "item-b",
        item: { id: "variant-1" },
        unit: "pcs",
        unordered_quantity: 4,
      },
    ],
  },
];

it("formats converted warning quantities without floating-point noise", () => {
  expect(formatWarningQuantity(19.978947368421053)).toBe(19.9789);
  expect(formatWarningQuantity(10)).toBe(10);
});

function assignedState() {
  const state = createInitialState(sources);
  const allocations = Object.values(state.allocationsById);
  return reconcileDrafts({
    ...state,
    allocationsById: Object.fromEntries(
      allocations.map((allocation) => [
        allocation.id,
        { ...allocation, supplier_id: "supplier-a" },
      ]),
    ),
  });
}

describe("allocation state", () => {
  it("converts mixed allocation units into the PR unit and isolates warnings per item", () => {
    const unitSources = [
      {
        id: "pr-units",
        code: "PR-UNITS",
        items: [
          {
            id: "first",
            item: { id: "variant-1", item_id: "product-1" },
            unit: { id: "pcs", conversion_factor: 1 },
            conversion_factor: 1,
            unordered_quantity: 10,
          },
          {
            id: "second",
            item: { id: "variant-2", item_id: "product-2" },
            unit: { id: "pcs-2", conversion_factor: 1 },
            conversion_factor: 1,
            unordered_quantity: 4,
          },
        ],
      },
    ];
    let state = createInitialState(unitSources);
    expect(state.allocationsById["allocation-1"].unit).toMatchObject({
      id: "pcs",
    });
    state = setAllocationQuantity(state, "allocation-1", 4);
    state = addAllocation(state, "first", { quantity: 1 });
    state = setAllocationUnit(state, "allocation-3", {
      id: "box",
      item_id: "product-1",
      conversion_factor: 12,
    });
    expect(state.allocationsById["allocation-3"].quantity).toBe(1);
    expect(getQuantityWarnings(state)).toMatchObject([
      {
        purchase_request_item_id: "first",
        allocated_quantity: 16,
        difference: 6,
      },
    ]);
    expect(getQuantityWarnings(state)).toHaveLength(1);
    const split = splitAllocation(state, "allocation-3", 0.25);
    expect(split.allocationsById["allocation-4"].unit.id).toBe("box");
    expect(getQuantityWarnings(split)[0].allocated_quantity).toBe(16);
  });
  it("adds another allocation for a source without changing its existing quantity", () => {
    const state = createInitialState(sources);
    const next = addAllocation(state, "item-a", { quantity: 2 });
    expect(next.allocationsById["allocation-3"]).toMatchObject({
      purchase_request_item_id: "item-a",
      quantity: 2,
      supplier_id: null,
      draft_id: null,
    });
    expect(next.allocationsById["allocation-1"].quantity).toBe(10);
    expect(state.allocationsById["allocation-3"]).toBeUndefined();
    expect(getQuantityWarnings(next)).toMatchObject([
      { allocated_quantity: 12, difference: 2 },
    ]);
  });

  it("initializes a new allocation as editable zero and clones source line data", () => {
    const state = createInitialState(sources);
    const next = addAllocation(state, "item-a");
    expect(next.allocationsById["allocation-3"].quantity).toBe(0);
    expect(next.allocationsById["allocation-3"].data.item).toEqual({
      id: "variant-1",
    });
    expect(next.allocationsById["allocation-3"].data).not.toBe(
      state.sourcesById["item-a"],
    );
  });

  it("adds into an explicitly chosen manual draft without regrouping to the first supplier draft", () => {
    let state = assignedState();
    state = splitDraft(state, state.draftOrder[0], ["allocation-1"]);
    const targetId = state.activeDraftId;
    const next = addAllocation(state, "item-a", {
      quantity: 1,
      draftId: targetId,
    });
    expect(next.allocationsById["allocation-3"]).toMatchObject({
      supplier_id: "supplier-a",
      draft_id: targetId,
    });
    expect(reconcileDrafts(next).allocationsById["allocation-3"].draft_id).toBe(
      targetId,
    );
  });

  it("groups added allocations for a supplier into its existing draft", () => {
    const state = assignedState();
    const next = addAllocation(state, "item-a", {
      quantity: 2,
      supplier: { id: "supplier-a" },
    });
    expect(next.draftOrder).toEqual(state.draftOrder);
    expect(next.allocationsById["allocation-3"].draft_id).toBe(
      state.draftOrder[0],
    );
  });

  it("removes an allocation and retains other draft fields and source warnings", () => {
    const state = assignedState();
    state.draftsById[state.draftOrder[0]].data.external_note = "Keep note";
    const next = removeAllocation(state, "allocation-1");
    expect(next.allocationsById["allocation-1"]).toBeUndefined();
    expect(next.draftsById[state.draftOrder[0]].data.external_note).toBe(
      "Keep note",
    );
    expect(getQuantityWarnings(next)).toMatchObject([
      { purchase_request_item_id: "item-a", difference: -10 },
    ]);
    expect(state.allocationsById["allocation-1"]).toBeDefined();
  });

  it("removes a last allocation and its blank draft without leaving an orphan", () => {
    const state = removeAllocation(assignedState(), "allocation-1");
    const next = removeAllocation(state, "allocation-2");
    expect(next.draftsById).toEqual({});
    expect(next.draftOrder).toEqual([]);
    expect(next.activeDraftId).toBeNull();
  });

  it("does not remove the last line of a filled draft until explicitly confirmed", () => {
    const state = removeAllocation(assignedState(), "allocation-1");
    state.draftsById[state.draftOrder[0]].data.external_note = "Filled draft";
    const pending = removeAllocation(state, "allocation-2");
    expect(pending.confirmationRequired).toBe(true);
    expect(pending.pendingChange).toMatchObject({
      type: "removeAllocation",
      allocationId: "allocation-2",
    });
    expect(pending.allocationsById["allocation-2"]).toBeDefined();
    const next = removeAllocation(pending, "allocation-2", { confirmed: true });
    expect(next.draftOrder).toEqual([]);
    expect(next.allocationsById).toEqual({});
  });

  it("never reuses an allocation ID after removing and adding", () => {
    const state = removeAllocation(
      addAllocation(assignedState(), "item-a"),
      "allocation-3",
    );
    expect(
      addAllocation(state, "item-a").allocationsById["allocation-4"],
    ).toBeDefined();
  });

  it("splits selected lines into a stable same-supplier draft and deep copies its header", () => {
    const state = assignedState();
    const originId = state.draftOrder[0];
    state.draftsById[originId].data = {
      external_note: "Header",
      currency: { id: "USD" },
    };
    const next = splitDraft(state, originId, ["allocation-1"]);
    expect(next.draftOrder).toEqual([originId, "draft-2"]);
    expect(next.activeDraftId).toBe("draft-2");
    expect(next.allocationsById["allocation-1"].draft_id).toBe("draft-2");
    expect(next.allocationsById["allocation-2"].draft_id).toBe(originId);
    expect(next.draftsById["draft-2"]).toMatchObject({
      supplier_id: "supplier-a",
      data: { external_note: "Header", currency: { id: "USD" } },
    });
    expect(next.draftsById["draft-2"].data.currency).not.toBe(
      state.draftsById[originId].data.currency,
    );
    expect(getQuantityWarnings(next)).toEqual([]);
    expect(reconcileDrafts(next)).toEqual(next);
    expect(state.allocationsById["allocation-1"].draft_id).toBe(originId);
  });

  it("does not reuse a removed manual draft ID", () => {
    const split = splitDraft(assignedState(), "draft-1", ["allocation-1"]);
    const merged = moveAllocation(split, "allocation-1", "draft-1");
    expect(splitDraft(merged, "draft-1", ["allocation-1"]).activeDraftId).toBe(
      "draft-3",
    );
  });

  it.each([
    { ids: [] },
    { ids: ["allocation-1", "allocation-2"] },
    { ids: ["missing"] },
    { ids: ["allocation-1", "allocation-1"] },
  ])(
    "rejects invalid split selection $ids without creating an empty draft",
    ({ ids }) => {
      const state = assignedState();
      expect(() => splitDraft(state, "draft-1", ids)).toThrow(RangeError);
      expect(state.draftOrder).toEqual(["draft-1"]);
    },
  );

  it("rejects missing sources, missing drafts, supplier mismatch, and invalid addition quantities", () => {
    const state = assignedState();
    expect(() => addAllocation(state, "missing")).toThrow(RangeError);
    expect(() =>
      addAllocation(state, "item-a", { draftId: "missing" }),
    ).toThrow(RangeError);
    expect(() =>
      addAllocation(state, "item-a", {
        draftId: "draft-1",
        supplier: "supplier-b",
      }),
    ).toThrow(RangeError);
    expect(() => addAllocation(state, "item-a", { quantity: -1 })).toThrow(
      RangeError,
    );
    expect(() => removeAllocation(state, "missing")).toThrow(RangeError);
    expect(() => splitDraft(state, "missing", ["allocation-1"])).toThrow(
      RangeError,
    );
  });
  it("starts one unassigned allocation per positive source item, retaining separate PR identities", () => {
    const state = createInitialState(sources);
    expect(
      Object.values(state.allocationsById).map(
        ({ purchase_request_item_id, quantity, supplier_id, draft_id }) => ({
          purchase_request_item_id,
          quantity,
          supplier_id,
          draft_id,
        }),
      ),
    ).toEqual([
      {
        purchase_request_item_id: "item-a",
        quantity: 10,
        supplier_id: null,
        draft_id: null,
      },
      {
        purchase_request_item_id: "item-b",
        quantity: 4,
        supplier_id: null,
        draft_id: null,
      },
    ]);
    expect(state.sourcesById["item-a"].purchase_request_id).toBe("pr-a");
    expect(state.draftOrder).toEqual([]);
    expect(getQuantityWarnings(state, sources)).toEqual([]);
  });

  it("groups allocations by supplier and preserves stable IDs on repeated reconciliation", () => {
    const state = assignedState();
    expect(state.draftOrder).toHaveLength(1);
    expect(state.draftsById[state.draftOrder[0]].supplier_id).toBe(
      "supplier-a",
    );
    expect(
      Object.values(state.allocationsById).every(
        (allocation) => allocation.draft_id === state.draftOrder[0],
      ),
    ).toBe(true);
    expect(reconcileDrafts(state)).toEqual(state);
  });

  it("creates different drafts for different suppliers including splits of one source", () => {
    let state = splitAllocation(assignedState(), "allocation-1", 3);
    state = {
      ...state,
      allocationsById: {
        ...state.allocationsById,
        "allocation-3": {
          ...state.allocationsById["allocation-3"],
          supplier_id: "supplier-b",
          draft_id: null,
        },
      },
    };
    state = reconcileDrafts(state);
    expect(state.draftOrder).toHaveLength(2);
    expect(getQuantityWarnings(state, sources)).toEqual([]);
    expect(state.allocationsById["allocation-3"].purchase_request_item_id).toBe(
      "item-a",
    );
  });

  it.each([
    [8, -2, "under"],
    [12, 2, "over"],
  ])(
    "warns for edited quantity %s per source",
    (quantity, difference, direction) => {
      const state = setAllocationQuantity(
        assignedState(),
        "allocation-1",
        quantity,
      );
      expect(getQuantityWarnings(state, sources)).toMatchObject([
        {
          purchase_request_item_id: "item-a",
          allocated_quantity: quantity,
          unordered_quantity: 10,
          difference,
          direction,
        },
      ]);
    },
  );

  it("sums one source across drafts and uses refreshed source quantities", () => {
    let state = splitAllocation(assignedState(), "allocation-1", 3);
    state = setAllocationQuantity(state, "allocation-3", 5);
    expect(getQuantityWarnings(state)).toMatchObject([
      { allocated_quantity: 12, difference: 2 },
    ]);
    const refreshed = [
      {
        ...sources[0],
        items: [{ ...sources[0].items[0], unordered_quantity: 15 }],
      },
      sources[1],
    ];
    expect(getQuantityWarnings(state, refreshed)).toMatchObject([
      { allocated_quantity: 12, difference: -3 },
    ]);
  });

  it("warns for a source with all allocations removed", () => {
    const state = assignedState();
    delete state.allocationsById["allocation-1"];
    expect(getQuantityWarnings(state)).toMatchObject([
      {
        purchase_request_item_id: "item-a",
        allocated_quantity: 0,
        difference: -10,
      },
    ]);
  });

  it("splits while retaining source, line fields and total without mutating inputs", () => {
    const state = assignedState();
    state.allocationsById["allocation-1"].data = {
      rate: 12,
      target_warehouse: { id: "warehouse-a" },
    };
    const next = splitAllocation(state, "allocation-1", 3);
    expect(next.allocationsById["allocation-1"].quantity).toBe(7);
    expect(next.allocationsById["allocation-3"]).toMatchObject({
      quantity: 3,
      purchase_request_item_id: "item-a",
      data: { rate: 12 },
    });
    expect(next.allocationsById["allocation-3"].data).not.toBe(
      state.allocationsById["allocation-1"].data,
    );
    expect(state.allocationsById["allocation-1"].quantity).toBe(10);
    expect(getQuantityWarnings(next)).toEqual([]);
  });

  it.each([0, -1, 10, 11, NaN, Infinity])(
    "rejects invalid split %s without changing state",
    (quantity) => {
      const state = assignedState();
      expect(() => splitAllocation(state, "allocation-1", quantity)).toThrow(
        RangeError,
      );
      expect(state.allocationsById["allocation-1"].quantity).toBe(10);
    },
  );

  it("keeps fractional splits free of floating-point warnings", () => {
    const state = createInitialState([
      { id: "pr", items: [{ id: "fraction", unordered_quantity: 0.3 }] },
    ]);
    expect(
      getQuantityWarnings(splitAllocation(state, "allocation-1", 0.1)),
    ).toEqual([]);
  });

  it("moves a line to another draft, adopts its supplier, and retains draft fields", () => {
    const state = assignedState();
    const origin = state.draftOrder[0];
    state.draftsById[origin].data = { external_note: "Original note" };
    state.draftsById.manual = {
      id: "manual",
      supplier_id: "supplier-b",
      data: { currency: { id: "USD" } },
    };
    state.draftOrder.push("manual");
    const next = moveAllocation(state, "allocation-1", "manual");
    expect(next.allocationsById["allocation-1"]).toMatchObject({
      supplier_id: "supplier-b",
      draft_id: "manual",
      quantity: 10,
    });
    expect(next.draftsById[origin].data.external_note).toBe("Original note");
    expect(next.draftsById.manual.data.currency.id).toBe("USD");
    expect(getQuantityWarnings(next)).toEqual([]);
  });

  it("keeps manually separated drafts for the same supplier", () => {
    const state = assignedState();
    state.draftsById.manual = {
      id: "manual",
      supplier_id: "supplier-a",
      data: { date: "2026-11-01" },
    };
    state.draftOrder.push("manual");
    const next = reconcileDrafts(
      moveAllocation(state, "allocation-1", "manual"),
    );
    expect(next.draftOrder).toHaveLength(2);
    expect(next.draftsById.manual.data.date).toBe("2026-11-01");
  });

  it("requests confirmation before changing header supplier and applies it explicitly", () => {
    const state = assignedState();
    const draftId = state.draftOrder[0];
    const supplier = { id: "supplier-b", name: "Supplier B" };
    const pending = changeDraftSupplier(state, draftId, supplier);
    expect(pending.confirmationRequired).toBe(true);
    expect(pending.draftsById[draftId].supplier_id).toBe("supplier-a");
    expect(pending.pendingChange).toMatchObject({
      type: "changeDraftSupplier",
      draftId,
      supplier,
    });
    const next = changeDraftSupplier(pending, draftId, supplier, {
      confirmed: true,
    });
    expect(next.confirmationRequired).toBe(false);
    expect(next.pendingChange).toBeNull();
    expect(next.draftsById[draftId].data.supplier).toEqual(supplier);
    expect(
      Object.values(next.allocationsById).every(
        (allocation) => allocation.supplier_id === "supplier-b",
      ),
    ).toBe(true);
    expect(getQuantityWarnings(next)).toEqual([]);
  });

  it("does not request confirmation for unchanged suppliers", () => {
    const state = assignedState();
    expect(
      changeDraftSupplier(state, state.draftOrder[0], { id: "supplier-a" }),
    ).toEqual(state);
  });

  it("signals confirmation before reconciling edited allocation suppliers and retains unaffected fields", () => {
    const state = assignedState();
    const originalId = state.draftOrder[0];
    state.draftsById[originalId].data = {
      external_note: "Keep",
      payment_schedules: [{ percentage: 100 }],
    };
    state.allocationsById["allocation-1"].supplier_id = "supplier-b";
    const pending = reconcileDrafts(state);
    expect(pending.confirmationRequired).toBe(true);
    expect(pending.allocationsById["allocation-1"].draft_id).toBe(originalId);
    const next = reconcileDrafts(pending, { confirmed: true });
    expect(next.allocationsById["allocation-1"].draft_id).not.toBe(originalId);
    expect(next.draftsById[originalId].data).toEqual(
      state.draftsById[originalId].data,
    );
  });

  it("cleans empty drafts and chooses an existing active draft", () => {
    const state = assignedState();
    state.draftsById.empty = {
      id: "empty",
      supplier_id: "supplier-c",
      data: {},
    };
    state.draftOrder.push("empty");
    state.activeDraftId = "empty";
    const next = reconcileDrafts(state);
    expect(next.draftsById.empty).toBeUndefined();
    expect(next.activeDraftId).toBe(state.draftOrder[0]);
  });

  it("requires confirmation before removing an empty draft with filled fields", () => {
    const state = assignedState();
    delete state.allocationsById["allocation-1"];
    delete state.allocationsById["allocation-2"];
    state.draftsById[state.draftOrder[0]].data = {
      external_note: "Do not discard silently",
    };
    expect(reconcileDrafts(state).confirmationRequired).toBe(true);
    expect(reconcileDrafts(state, { confirmed: true }).draftOrder).toEqual([]);
  });

  it("never reuses removed allocation IDs", () => {
    let state = splitAllocation(assignedState(), "allocation-1", 2);
    delete state.allocationsById["allocation-3"];
    state = splitAllocation(state, "allocation-1", 2);
    expect(state.allocationsById["allocation-4"]).toBeDefined();
  });

  it("rejects missing move targets and nonfinite or negative quantities", () => {
    const state = assignedState();
    expect(() => moveAllocation(state, "allocation-1", "missing")).toThrow(
      RangeError,
    );
    expect(() =>
      setAllocationQuantity(state, "allocation-1", Infinity),
    ).toThrow(RangeError);
    expect(() => setAllocationQuantity(state, "allocation-1", -1)).toThrow(
      RangeError,
    );
    expect(
      setAllocationQuantity(state, "allocation-1", "2.5").allocationsById[
        "allocation-1"
      ].quantity,
    ).toBe(2.5);
  });

  it("computes warnings over two drafts rather than per supplier", () => {
    const state = assignedState();
    state.draftsById.manual = {
      id: "manual",
      supplier_id: "supplier-b",
      data: {},
    };
    state.draftOrder.push("manual");
    let next = moveAllocation(
      splitAllocation(state, "allocation-1", 3),
      "allocation-3",
      "manual",
    );
    expect(getQuantityWarnings(next)).toEqual([]);
    next = setAllocationQuantity(next, "allocation-3", 6);
    expect(getQuantityWarnings(next)).toMatchObject([
      {
        purchase_request_item_id: "item-a",
        allocated_quantity: 13,
        difference: 3,
      },
    ]);
  });

  it("preserves separate drafts when a confirmed supplier change matches another draft", () => {
    const state = assignedState();
    state.draftsById.manual = {
      id: "manual",
      supplier_id: "supplier-b",
      data: { external_note: "Second" },
    };
    state.draftOrder.push("manual");
    let next = moveAllocation(state, "allocation-1", "manual");
    next = changeDraftSupplier(
      next,
      "manual",
      { id: "supplier-a" },
      { confirmed: true },
    );
    expect(reconcileDrafts(next).draftOrder).toHaveLength(2);
    expect(next.draftsById.manual.data.external_note).toBe("Second");
  });

  it("supports flat source items and keeps stored snapshots detached from inputs", () => {
    const flat = [
      {
        id: "source",
        purchase_request_id: "pr",
        unordered_quantity: 5,
        item: { id: "variant" },
      },
    ];
    const state = createInitialState(flat);
    flat[0].item.id = "changed";
    expect(state.sourcesById.source.item.id).toBe("variant");
    expect(state.allocationsById["allocation-1"].data.item.id).toBe("variant");
    expect(
      getQuantityWarnings(setAllocationQuantity(state, "allocation-1", 0)),
    ).toMatchObject([{ difference: -5 }]);
  });

  it("clears the active draft when all allocations are removed", () => {
    const state = assignedState();
    const next = reconcileDrafts({ ...state, allocationsById: {} });
    expect(next.draftOrder).toEqual([]);
    expect(next.activeDraftId).toBeNull();
    expect(next.confirmationRequired).toBe(false);
  });
});
