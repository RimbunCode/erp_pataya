import React, { useState } from "react";
import { describe, expect, it, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createInitialState, reconcileDrafts } from "./allocationState";
import DraftStep from "./DraftStep";

window.route = (name, id) => `/${name}/${id}`;
const editItemSpy = vi.hoisted(() => vi.fn());

vi.mock("laravel-react-i18n", () => ({
  useLaravelReactI18n: () => ({
    t: (key, values) =>
      values?.number
        ? `${key} ${values.number}`
        : values?.required != null
          ? `${key} ${Object.values(values).join(" ")}`
          : key,
  }),
}));
vi.mock("@inertiajs/react", () => ({
  usePage: () => ({ props: { preferences: { default_currency_id: "idr" } } }),
  Link: ({ href, children }) => <a href={href}>{children}</a>,
}));
vi.mock("@/Pages/Core/FormPage", () => ({
  FormChildren: ({ children }) => <div>{children}</div>,
}));
vi.mock("../Form", () => ({
  PurchaseOrderFields: ({
    data,
    setData,
    sourceItemActions,
    renderSourceWarning,
  }) => (
    <div>
      <input
        aria-label="PO date"
        value={data.date ?? ""}
        onChange={(event) => setData("date", event.target.value)}
      />
      <input
        aria-label="PO note"
        value={data.external_note ?? ""}
        onChange={(event) => setData("external_note", event.target.value)}
      />
      <input
        aria-label="Currency"
        value={data.currency?.code ?? ""}
        onChange={(event) => setData("currency", { code: event.target.value })}
      />
      <button
        type="button"
        onClick={() =>
          setData("supplier", { id: "supplier-3", name: "Supplier C" })
        }
      >
        Change supplier
      </button>
      <button type="button" onClick={() => setData("supplier", null)}>
        Clear supplier while searching
      </button>
      {data.items.map((item) => (
        <section key={item.id}>
          <span>{item.purchase_request_code}</span>
          <span>{item.item?.name}</span>
          <input
            aria-label={
              "purchase.purchaseOrder.columns.rate " + item.item?.name
            }
            value={item.rate ?? ""}
            onChange={(event) =>
              setData((current) => ({
                ...current,
                items: current.items.map((row) =>
                  row.id === item.id
                    ? { ...row, rate: Number(event.target.value) }
                    : row,
                ),
              }))
            }
          />
          <select
            aria-label={"PO unit " + item.item?.name}
            value={item.unit?.id ?? ""}
            onChange={(event) =>
              setData((current) => ({
                ...current,
                items: current.items.map((row) =>
                  row.id === item.id
                    ? {
                        ...row,
                        unit:
                          event.target.value === "box"
                            ? { id: "box", conversion_factor: 12 }
                            : { id: "u-1", conversion_factor: 1 },
                      }
                    : row,
                ),
              }))
            }
          >
            <option value="u-1">PCS</option>
            <option value="box">Box</option>
          </select>
          {renderSourceWarning?.(item.source_item_id)}
          {sourceItemActions({ row: item, toggleDialog: editItemSpy })}
        </section>
      ))}
    </div>
  ),
}));
vi.mock("@/Components/NumberInput", () => ({
  default: ({ value, onValueChange, ...props }) => (
    <input
      value={value ?? ""}
      onChange={(event) => onValueChange(Number(event.target.value))}
      {...props}
    />
  ),
}));
vi.mock("@/Pages/Inventory/Warehouses/WarehouseLinkModel", () => ({
  default: () => <div>Warehouse picker</div>,
}));
vi.mock("@/Pages/Finances/Taxes/TaxLinkModel", () => ({
  default: () => <div>Tax picker</div>,
}));
vi.mock("@/Components/DatetimePicker", () => ({
  default: () => <div>Date picker</div>,
}));

const sources = [
  {
    id: "pr-1",
    code: "PR-001",
    external_note: "Note one",
    items: [
      {
        id: "item-1",
        item: { id: "v-1", name: "Part A" },
        unit: { id: "u-1", name: "PCS", conversion_factor: 1 },
        conversion_factor: 1,
        unordered_quantity: 10,
      },
      {
        id: "item-2",
        item: { id: "v-2", name: "Part B" },
        unit: { id: "u-1", name: "PCS", conversion_factor: 1 },
        conversion_factor: 1,
        unordered_quantity: 4,
      },
    ],
  },
  {
    id: "pr-2",
    code: "PR-002",
    external_note: "Note two",
    items: [
      {
        id: "item-3",
        item: { id: "v-3", name: "Part C" },
        unit: { id: "u-1", name: "PCS", conversion_factor: 1 },
        conversion_factor: 1,
        unordered_quantity: 3,
      },
    ],
  },
];

function seededState() {
  const state = createInitialState(sources);
  state.allocationsById["allocation-1"].supplier_id = "supplier-1";
  state.allocationsById["allocation-2"].supplier_id = "supplier-1";
  state.allocationsById["allocation-3"].supplier_id = "supplier-2";
  return reconcileDrafts(state);
}

function Fixture({ initial = seededState() }) {
  const [state, setState] = useState(initial);
  return (
    <>
      <DraftStep
        state={state}
        setState={setState}
        sources={sources}
        onBack={vi.fn()}
        onContinue={vi.fn()}
      />
      <output data-testid="state">{JSON.stringify(state)}</output>
    </>
  );
}

describe("draft workspace", () => {
  it("keeps quantity and rate while changing PO unit and updates the source warning", async () => {
    const user = userEvent.setup();
    render(<Fixture />);
    await user.selectOptions(
      screen.getByRole("combobox", { name: "PO unit Part A" }),
      "box",
    );
    const allocation = JSON.parse(screen.getByTestId("state").textContent)
      .allocationsById["allocation-1"];
    expect(allocation.unit.id).toBe("box");
    expect(allocation.quantity).toBe(10);
    expect(
      screen.getByRole("alert", {
        name: "purchase.purchaseOrder.from_requests.quantity_warning_title",
      }),
    ).toHaveTextContent("10 120 110");
  });
  it("preserves each draft's date, currency, note, and source PR identity", async () => {
    const user = userEvent.setup();
    render(<Fixture />);
    await user.clear(screen.getByLabelText("PO date"));
    await user.type(screen.getByLabelText("PO date"), "2026-10-20");
    await user.type(screen.getByLabelText("PO note"), "First PO");
    await user.type(screen.getByLabelText("Currency"), "usd");
    await user.type(
      screen.getByLabelText("purchase.purchaseOrder.columns.rate Part A"),
      "125",
    );
    await user.click(
      screen.getByRole("button", { name: /draft-2|Rancangan PO 2/ }),
    );
    expect(screen.getByText("PR-002")).toBeInTheDocument();
    expect(screen.queryByText("PR-001")).not.toBeInTheDocument();
    await user.type(screen.getByLabelText("PO note"), "Second PO");
    await user.click(
      screen.getByRole("button", { name: /draft-1|Rancangan PO 1/ }),
    );
    expect(screen.getByLabelText("PO date")).toHaveValue("2026-10-20");
    expect(screen.getByLabelText("PO note")).toHaveValue("First PO");
    expect(screen.getByLabelText("Currency")).toHaveValue("usd");
    expect(
      screen.getByLabelText("purchase.purchaseOrder.columns.rate Part A"),
    ).toHaveValue("125");
  });

  it("splits the same supplier into another PO and moves a source line", async () => {
    const user = userEvent.setup();
    render(<Fixture />);
    const partBActions = () =>
      screen.getByRole("button", { name: /row_actions.*Part B/i });
    expect(
      screen.queryByRole("menuitem", { name: /split_to_po/ }),
    ).not.toBeInTheDocument();
    await user.click(partBActions());
    await user.click(screen.getByRole("menuitem", { name: /split_to_po/ }));
    expect(
      JSON.parse(screen.getByTestId("state").textContent).draftOrder,
    ).toHaveLength(3);
    expect(screen.getAllByText("PR-001").length).toBeGreaterThan(0);
    await user.click(partBActions());
    screen.getByRole("menuitem", { name: /move_item/ }).focus();
    await user.keyboard("{ArrowRight}");
    await user.click(
      await screen.findByRole("menuitem", { name: /draft_number 1/ }),
    );
    const state = JSON.parse(screen.getByTestId("state").textContent);
    expect(state.allocationsById["allocation-2"].draft_id).toBe("draft-1");
    expect(state.allocationsById["allocation-2"].purchase_request_item_id).toBe(
      "item-2",
    );
  });

  it("requires confirmation before changing supplier and shows only active PR notes", async () => {
    const user = userEvent.setup();
    render(<Fixture />);
    await user.click(screen.getByRole("button", { name: "Change supplier" }));
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(
      JSON.parse(screen.getByTestId("state").textContent).draftsById["draft-1"]
        .supplier_id,
    ).toBe("supplier-1");
    await user.click(
      within(screen.getByRole("dialog")).getByRole("button", {
        name: /confirm|Terapkan/i,
      }),
    );
    expect(
      JSON.parse(screen.getByTestId("state").textContent).draftsById["draft-1"]
        .supplier_id,
    ).toBe("supplier-3");
    await user.click(screen.getByRole("button", { name: /pr_notes/ }));
    expect(screen.getByText("Note one")).toBeInTheDocument();
    expect(screen.queryByText("Note two")).not.toBeInTheDocument();
  });

  it("ignores a temporary empty supplier while searching before a valid selection", async () => {
    const user = userEvent.setup();
    render(<Fixture />);
    await user.click(
      screen.getByRole("button", { name: "Clear supplier while searching" }),
    );
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(
      JSON.parse(screen.getByTestId("state").textContent).draftsById["draft-1"]
        .supplier_id,
    ).toBe("supplier-1");
    await user.click(screen.getByRole("button", { name: "Change supplier" }));
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    await user.click(
      within(screen.getByRole("dialog")).getByRole("button", {
        name: /confirm|Terapkan/i,
      }),
    );
    expect(
      JSON.parse(screen.getByTestId("state").textContent).draftsById["draft-1"]
        .supplier_id,
    ).toBe("supplier-3");
  });

  it("keeps draft selector and quantity split available on mobile layout", async () => {
    const user = userEvent.setup();
    render(<Fixture />);
    expect(
      screen.getByRole("combobox", { name: /draft_list/ }),
    ).toBeInTheDocument();
    await user.click(
      screen.getByRole("button", { name: /row_actions.*Part A/i }),
    );
    await user.click(screen.getByRole("menuitem", { name: /split_quantity/ }));
    await user.clear(
      within(screen.getByRole("dialog")).getByRole("spinbutton"),
    );
    await user.type(
      within(screen.getByRole("dialog")).getByRole("spinbutton"),
      "3",
    );
    await user.click(
      within(screen.getByRole("dialog")).getByRole("button", {
        name: /confirm/,
      }),
    );
    const allocations = Object.values(
      JSON.parse(screen.getByTestId("state").textContent).allocationsById,
    ).filter((allocation) => allocation.purchase_request_item_id === "item-1");
    expect(
      allocations
        .map((allocation) => allocation.quantity)
        .sort((a, b) => a - b),
    ).toEqual([3, 7]);
  });

  it("opens item actions by keyboard and keeps Edit inside the menu", async () => {
    const user = userEvent.setup();
    editItemSpy.mockClear();
    render(<Fixture />);
    const trigger = screen.getByRole("button", {
      name: /row_actions.*Part A/i,
    });
    expect(
      screen.queryByRole("menuitem", { name: /editing_row/ }),
    ).not.toBeInTheDocument();
    trigger.focus();
    await user.keyboard("{Enter}");
    expect(
      screen.getByRole("menuitem", { name: /editing_row/ }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("menuitem", { name: /split_quantity/ }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("menuitem", { name: /split_to_po/ }),
    ).toBeInTheDocument();
    await user.click(screen.getByRole("menuitem", { name: /editing_row/ }));
    expect(editItemSpy).toHaveBeenCalledOnce();
    await user.click(trigger);
    await user.keyboard("{Escape}");
    expect(
      screen.queryByRole("menuitem", { name: /editing_row/ }),
    ).not.toBeInTheDocument();
  });
});
