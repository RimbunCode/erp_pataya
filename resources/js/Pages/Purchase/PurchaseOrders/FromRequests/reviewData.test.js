import { describe, expect, it } from "vitest";
import { createInitialState, reconcileDrafts } from "./allocationState";
import { applyDraftData, buildDraftData } from "./draftData";
import { buildSubmissionDrafts, validateSubmissionDrafts } from "./reviewData";

const sources = [
  {
    id: "pr-1",
    code: "PR-001",
    items: [
      {
        id: "item-1",
        item: { id: "variant-1" },
        unit: { id: "unit-1" },
        unordered_quantity: 5,
      },
      {
        id: "item-2",
        item: { id: "variant-2" },
        unit: { id: "unit-1" },
        unordered_quantity: 3,
      },
    ],
  },
];

function completeState() {
  const state = createInitialState(sources);
  state.allocationsById["allocation-1"].supplier_id = "supplier-1";
  state.allocationsById["allocation-2"].supplier_id = "supplier-2";
  const grouped = reconcileDrafts(state);
  return grouped.draftOrder.reduce((current, id) => {
    const data = buildDraftData(current, id, "2026-10-14");
    return applyDraftData(current, id, {
      ...data,
      items: data.items.map((item) => ({
        ...item,
        target_warehouse: { id: "warehouse-1" },
        rate: 12,
      })),
    });
  }, grouped);
}

describe("batch PO review payload", () => {
  it("keeps source identity and editable fields but excludes display-only PR data", () => {
    const drafts = buildSubmissionDrafts(completeState(), "2026-10-14");
    expect(drafts).toHaveLength(2);
    expect(drafts[0].items[0]).toMatchObject({
      id: "allocation-1",
      source_item_id: "item-1",
      item: { id: "variant-1" },
      unit: { id: "unit-1" },
      quantity: 5,
      rate: 12,
    });
    expect(drafts[0].items[0]).not.toHaveProperty("purchase_request_code");
    expect(drafts[0].items[0]).not.toHaveProperty("referenceable_type");
    expect(validateSubmissionDrafts(drafts)).toEqual({});
  });

  it("reports the exact draft and line with invalid required fields without treating quantity warning as an error", () => {
    const state = completeState();
    const second = state.draftOrder[1];
    const data = buildDraftData(state, second, "2026-10-14");
    const next = applyDraftData(state, second, {
      ...data,
      items: data.items.map((item) => ({
        ...item,
        target_warehouse: null,
        quantity: 0,
      })),
    });
    const drafts = buildSubmissionDrafts(next, "2026-10-14");
    expect(validateSubmissionDrafts(drafts)).toMatchObject({
      "drafts.1.items.0.target_warehouse": expect.any(String),
      "drafts.1.items.0.quantity": expect.any(String),
    });
    expect(validateSubmissionDrafts(drafts)).not.toHaveProperty(
      "drafts.0.items.0.quantity",
    );
  });

  it("catches incomplete discount and payment schedule fields in the second draft", () => {
    const state = completeState();
    const draftId = state.draftOrder[1];
    const data = buildDraftData(state, draftId, "2026-10-14");
    const next = applyDraftData(state, draftId, {
      ...data,
      discount_on: "net_total",
      payment_schedules: [{ id: "schedule-1", invoice_portion: null }],
    });
    expect(
      validateSubmissionDrafts(buildSubmissionDrafts(next, "2026-10-14")),
    ).toMatchObject({
      "drafts.1.discount_rate": expect.any(String),
      "drafts.1.discount_amount": expect.any(String),
      "drafts.1.payment_schedules.0.due_date": expect.any(String),
      "drafts.1.payment_schedules.0.invoice_portion": expect.any(String),
    });
  });
});
