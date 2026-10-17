import { describe, expect, it } from "vitest";
import { createInitialState, reconcileDrafts } from "./allocationState";
import { applyDraftData, buildDraftData } from "./draftData";

const sources = [
  {
    id: "pr-1",
    code: "PR-001",
    external_note: "Internal PR note",
    items: [
      {
        id: "item-1",
        item: { id: "variant-1", name: "Part A" },
        unit: { id: "unit-1", name: "PCS" },
        unordered_quantity: 10,
        required_date: "2026-10-20",
      },
      {
        id: "item-2",
        item: { id: "variant-2", name: "Part B" },
        unit: { id: "unit-2", name: "PCS" },
        unordered_quantity: 4,
        required_date: "2026-10-21",
      },
    ],
  },
];

function twoDrafts() {
  const state = createInitialState(sources);
  state.allocationsById["allocation-1"].supplier_id = "supplier-1";
  state.allocationsById["allocation-2"].supplier_id = "supplier-2";
  return reconcileDrafts(state);
}

describe("draft data shared with the PO form", () => {
  it("keeps a cleared unit empty until the user selects another one", () => {
    const state = twoDrafts();
    const data = buildDraftData(state, "draft-1", "2026-10-14");
    const next = applyDraftData(state, "draft-1", {
      ...data,
      items: [{ ...data.items[0], unit: null }],
    });

    expect(next.allocationsById["allocation-1"].unit).toBeNull();
    expect(
      buildDraftData(next, "draft-1", "2026-10-14").items[0].unit,
    ).toBeNull();
  });

  it("builds locked source rows and does not copy PR notes to the PO", () => {
    const state = twoDrafts();
    const draft = buildDraftData(state, "draft-1", "2026-10-14");

    expect(draft.date).toBe("2026-10-14");
    expect(draft.external_note).toBeUndefined();
    expect(draft.items).toMatchObject([
      {
        id: "allocation-1",
        source_item_id: "item-1",
        purchase_request_code: "PR-001",
        item: { id: "variant-1" },
        unit: { id: "unit-1" },
        quantity: 10,
        rate: 0,
      },
    ]);
  });

  it("stores editable header and line fields without changing source identity", () => {
    const state = twoDrafts();
    const firstData = buildDraftData(state, "draft-1", "2026-10-14");
    const next = applyDraftData(state, "draft-1", {
      ...firstData,
      date: "2026-10-18",
      currency: { code: "usd" },
      external_note: "PO note",
      payment_schedules: [{ id: "schedule-1", invoice_portion: 100 }],
      items: [
        {
          ...firstData.items[0],
          item: { id: "tampered" },
          unit: { id: "unit-box", item_id: "product-1", conversion_factor: 12 },
          source_item_id: "tampered",
          quantity: 12,
          rate: 125,
          target_warehouse: { id: "warehouse-1" },
        },
      ],
    });

    const updated = buildDraftData(next, "draft-1", "2026-10-14");
    expect(updated).toMatchObject({
      date: "2026-10-18",
      currency: { code: "usd" },
      external_note: "PO note",
      payment_schedules: [{ id: "schedule-1" }],
      items: [
        {
          source_item_id: "item-1",
          item: { id: "variant-1" },
          unit: { id: "unit-box" },
          quantity: 12,
          rate: 125,
          target_warehouse: { id: "warehouse-1" },
        },
      ],
    });
    expect(buildDraftData(next, "draft-2", "2026-10-14")).toEqual(
      buildDraftData(state, "draft-2", "2026-10-14"),
    );
  });

  it("keeps the edited quantity and price while changing a draft line unit", () => {
    const state = twoDrafts();
    const data = buildDraftData(state, "draft-1", "2026-10-14");
    const next = applyDraftData(state, "draft-1", {
      ...data,
      items: [
        {
          ...data.items[0],
          quantity: 2,
          rate: 125,
          unit: { id: "unit-box", conversion_factor: 12 },
        },
      ],
    });
    expect(
      buildDraftData(next, "draft-1", "2026-10-14").items[0],
    ).toMatchObject({
      unit: { id: "unit-box" },
      quantity: 2,
      rate: 125,
    });
    expect(next.allocationsById["allocation-1"].unit.id).toBe("unit-box");
    expect(next.allocationsById["allocation-1"].data.rate).toBe(125);
  });

  it("allows a quantity field to be cleared for validation and clamps an obsolete source date", () => {
    const state = twoDrafts();
    state.sourcesById["item-1"].required_date = "2026-10-01";
    state.allocationsById["allocation-1"].data.required_date = "2026-10-01";
    const data = buildDraftData(state, "draft-1", "2026-10-14");
    expect(data.items[0].required_date).toBe("2026-10-14");
    const next = applyDraftData(state, "draft-1", {
      ...data,
      items: [{ ...data.items[0], quantity: null }],
    });
    expect(
      buildDraftData(next, "draft-1", "2026-10-14").items[0].quantity,
    ).toBeNull();
  });
});
