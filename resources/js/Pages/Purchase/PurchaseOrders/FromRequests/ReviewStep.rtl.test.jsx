import React, { useState } from "react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { act, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import {
  createInitialState,
  reconcileDrafts,
  setAllocationQuantity,
} from "./allocationState";
import { applyDraftData, buildDraftData } from "./draftData";
import ReviewStep from "./ReviewStep";

const { post } = vi.hoisted(() => ({ post: vi.fn() }));
vi.mock("@inertiajs/react", () => ({ router: { post } }));
vi.mock("laravel-react-i18n", () => ({
  useLaravelReactI18n: () => ({ t: (key) => key }),
}));

window.route = (name, id) => `/${name}/${id ?? ""}`;
const sources = [
  {
    id: "pr-1",
    code: "PR-001",
    items: [
      {
        id: "item-1",
        item: { id: "v-1", name: "Part A" },
        unit: { id: "u-1", name: "PCS", conversion_factor: 1 },
        conversion_factor: 1,
        unordered_quantity: 6,
      },
      {
        id: "item-2",
        item: { id: "v-2", name: "Part B" },
        unit: { id: "u-1", name: "PCS", conversion_factor: 1 },
        conversion_factor: 1,
        unordered_quantity: 3,
      },
    ],
  },
];

function completeState() {
  const state = createInitialState(sources);
  state.allocationsById["allocation-1"].supplier_id = "s-1";
  state.allocationsById["allocation-2"].supplier_id = "s-2";
  const grouped = reconcileDrafts(state);
  const filled = grouped.draftOrder.reduce((current, id, index) => {
    const data = buildDraftData(current, id, "2026-10-14");
    return applyDraftData(current, id, {
      ...data,
      currency: { code: index === 0 ? "usd" : "idr" },
      items: data.items.map((item) => ({
        ...item,
        target_warehouse: { id: "w-1" },
        rate: 20,
      })),
    });
  }, grouped);
  return setAllocationQuantity(filled, "allocation-1", 4);
}

function Fixture({ initial = completeState() }) {
  const [state] = useState(initial);
  return (
    <>
      <ReviewStep
        state={state}
        sources={sources}
        token="token-1"
        defaultDate="2026-10-14"
        onBack={vi.fn()}
        onEditDraft={vi.fn()}
        onRefreshSources={vi.fn()}
        createKey={() => "11111111-1111-4111-8111-111111111111"}
      />
      <output data-testid="state">{JSON.stringify(state)}</output>
    </>
  );
}

describe("batch PO review", () => {
  beforeEach(() => post.mockReset());

  it("shows each currency, source PR, and nonblocking quantity warning", async () => {
    const user = userEvent.setup();
    render(<Fixture />);
    expect(screen.getByText(/USD/)).toBeInTheDocument();
    expect(screen.getByText(/IDR/)).toBeInTheDocument();
    expect(screen.getAllByText(/PR-001 ·/).length).toBeGreaterThanOrEqual(2);
    expect(screen.getByText(/quantity_under/)).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /save_drafts/ }));
    expect(post).toHaveBeenCalledOnce();
    expect(post.mock.calls[0][1]).toMatchObject({
      token: "token-1",
      drafts: [
        { items: [{ source_item_id: "item-1", quantity: 4 }] },
        { items: [{ source_item_id: "item-2" }] },
      ],
    });
  });

  it("shows the selected PO unit and converted warning only beside its source item", async () => {
    const user = userEvent.setup();
    const initial = completeState();
    const firstDraft = buildDraftData(initial, "draft-1", "2026-10-14");
    const changed = applyDraftData(initial, "draft-1", {
      ...firstDraft,
      items: firstDraft.items.map((item) => ({
        ...item,
        quantity: 2,
        unit: { id: "box", name: "Box", conversion_factor: 4 },
      })),
    });
    render(<Fixture initial={changed} />);

    const firstItem = screen.getByText(/PR-001 · Part A/).closest("li");
    const otherItem = screen.getByText(/PR-001 · Part B/).closest("li");
    expect(within(firstItem).getByText(/2 Box × 20/)).toBeInTheDocument();
    expect(within(firstItem).getByRole("alert")).toHaveTextContent(
      "quantity_over",
    );
    expect(within(firstItem).getByRole("alert")).toHaveTextContent("PCS");
    expect(within(otherItem).queryByRole("alert")).not.toBeInTheDocument();
    expect(screen.getAllByRole("alert")).toHaveLength(1);

    await user.click(screen.getByRole("button", { name: /save_drafts/ }));
    expect(post.mock.calls[0][1].drafts[0].items[0]).toMatchObject({
      source_item_id: "item-1",
      quantity: 2,
      unit: { id: "box" },
    });
    expect(post.mock.calls[0][1].drafts[1].items[0].unit.id).toBe("u-1");
  });

  it("uses the PR description when a variant has no display name", () => {
    const initial = completeState();
    initial.sourcesById["item-1"].item = { id: "v-1", code: "PART-1" };
    initial.sourcesById["item-1"].description = "Maintenance part";
    render(<Fixture initial={initial} />);
    expect(screen.getByText(/PR-001 · Maintenance part/)).toBeInTheDocument();
  });

  it("blocks invalid fields, then maps server errors to the affected draft while preserving state and key on retry", async () => {
    const user = userEvent.setup();
    const invalid = completeState();
    invalid.allocationsById["allocation-2"].data.target_warehouse = null;
    const view = render(<Fixture initial={invalid} />);
    expect(screen.getByRole("button", { name: /save_drafts/ })).toBeDisabled();
    expect(post).not.toHaveBeenCalled();
    view.rerender(<Fixture key="valid" />);
    await user.click(screen.getByRole("button", { name: /save_drafts/ }));
    const firstPayload = post.mock.calls[0][1];
    act(() => {
      post.mock.calls[0][2].onError({
        "drafts.1.items.0.rate": "Invalid rate",
      });
      post.mock.calls[0][2].onFinish();
    });
    expect(screen.getByText(/Invalid rate/)).toBeInTheDocument();
    expect(
      JSON.parse(screen.getByTestId("state").textContent).draftOrder,
    ).toHaveLength(2);
    await user.click(screen.getByRole("button", { name: /save_drafts/ }));
    expect(post.mock.calls[1][1].idempotency_key).toBe(
      firstPayload.idempotency_key,
    );
  });

  it("disables repeat submit while request is pending", async () => {
    const user = userEvent.setup();
    render(<Fixture />);
    await user.click(screen.getByRole("button", { name: /save_drafts/ }));
    expect(screen.getByRole("button", { name: /save_drafts/ })).toBeDisabled();
    expect(screen.getByText(/saving/)).toBeInTheDocument();
  });
});
