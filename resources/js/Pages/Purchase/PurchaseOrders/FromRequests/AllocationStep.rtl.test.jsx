import React, { useState } from "react";
import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createInitialState, reconcileDrafts } from "./allocationState";

vi.mock("laravel-react-i18n", () => ({
  useLaravelReactI18n: () => ({
    t: (key, values = {}) => `${key} ${Object.values(values).join(" ")}`.trim(),
  }),
}));
vi.mock("@inertiajs/react", () => ({
  Head: () => null,
  Link: ({ href, children, ...props }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
  usePage: () => ({
    props: { preferences: { default_number_format: "#,###.##" } },
  }),
}));
vi.mock("@/Pages/Core/FormPage", () => ({ useFormPageMeta: () => null }));
vi.mock("@/Hooks/useCanUpdate", () => ({ default: () => true }));
vi.mock("@/Layouts/AppLayout", () => ({
  default: ({ children }) => <main>{children}</main>,
}));
vi.mock("../../Suppliers/SupplierLinkModel", () => ({
  default: ({ id, value, onValueChange, disabled }) => (
    <select
      id={id}
      value={value?.id ?? ""}
      disabled={disabled}
      onChange={(event) =>
        onValueChange(
          event.target.value
            ? { id: event.target.value, name: `Supplier ${event.target.value}` }
            : null,
        )
      }
    >
      <option value="">Select supplier</option>
      <option value="supplier-1">Supplier supplier-1</option>
      <option value="supplier-2">Supplier supplier-2</option>
    </select>
  ),
}));
vi.mock("@/Pages/Inventory/Items/ItemUnitLinkModel", () => ({
  default: ({ value, onValueChange, disabled, fields }) => (
    <select
      aria-label="PO unit"
      data-fields={JSON.stringify(fields)}
      value={value?.id ?? ""}
      disabled={disabled}
      onChange={(event) =>
        onValueChange(event.target.value === "box"
          ? { id: "box", item_id: "product-1", name: "Box", conversion_factor: 12 }
          : { id: "pcs", item_id: "product-1", name: "pcs", conversion_factor: 1 })
      }
    >
      <option value="pcs">pcs</option>
      <option value="box">Box</option>
    </select>
  ),
}));

import AllocationStep from "./AllocationStep";
import Workspace from "./Workspace";

window.route = (name, id) => `/${name}/${id ?? ""}`;
const prefix = "purchase.purchaseOrder.from_requests.";
const sources = [
  {
    id: "pr-1",
    code: "PR-001",
    required_date: "2026-10-20",
    external_note: "Maintenance",
    items: [
      {
        id: "item-1",
        item: { name: "Filter", item_id: "product-1" },
        unit: { id: "pcs", name: "pcs", conversion_factor: 1 },
        conversion_factor: 1,
        description: "Engine filter",
        unordered_quantity: 10,
        quantity: 12,
        ordered_quantity: 2,
      },
    ],
  },
];

function Harness({
  initialState = createInitialState(sources),
  sourceErrors = {},
}) {
  const [state, setState] = useState(initialState);
  return (
    <AllocationStep
      state={state}
      setState={setState}
      sources={sources}
      sourceErrors={sourceErrors}
      onContinue={vi.fn()}
    />
  );
}
const quantities = () => screen.getAllByLabelText(/allocation_quantity/);
const continueButton = () =>
  screen.getByRole("button", { name: `${prefix}continue_drafts` });
async function chooseSupplier(index = 0, supplier = "supplier-1") {
  await userEvent.selectOptions(
    screen.getAllByRole("combobox", { name: /supplier/ })[index],
    supplier,
  );
}

describe("PR allocation", () => {
  it("requests conversion factors for selectable units", () => {
    render(<AllocationStep state={createInitialState(sources)} setState={vi.fn()} sources={sources} />);
    expect(screen.getAllByRole("combobox", { name: "PO unit" })[0])
      .toHaveAttribute("data-fields", JSON.stringify(["conversion_factor"]));
  });
  it("mounts its action footer outside the scrolling content when a footer slot is supplied", () => {
    function PortalHarness() {
      const [footerContainer, setFooterContainer] = useState(null);
      const [state, setState] = useState(() => createInitialState(sources));
      return (
        <>
          <div data-testid="scroll-region">
            <AllocationStep
              state={state}
              setState={setState}
              sources={sources}
              onContinue={vi.fn()}
              footerContainer={footerContainer}
            />
          </div>
          <div data-testid="footer-slot" ref={setFooterContainer} />
        </>
      );
    }
    render(<PortalHarness />);
    expect(screen.getByTestId("footer-slot")).toContainElement(continueButton());
    expect(screen.getByTestId("scroll-region")).not.toContainElement(continueButton());
  });
  it("starts with the remaining quantity and requires a supplier", async () => {
    render(<Harness />);
    expect(Number(quantities()[0].value)).toBe(10);
    expect(screen.getByText("PR-001")).toBeInTheDocument();
    expect(screen.getByText("Engine filter")).toBeInTheDocument();
    expect(continueButton()).toBeDisabled();
    await chooseSupplier();
    expect(continueButton()).toBeEnabled();
  });

  it("allocates a source item to two suppliers without losing its PR", async () => {
    render(<Harness />);
    await chooseSupplier();
    fireEvent.change(quantities()[0], { target: { value: "6" } });
    await userEvent.click(
      screen.getByRole("button", { name: /add_allocation/ }),
    );
    expect(continueButton()).toBeDisabled();
    fireEvent.change(quantities()[1], { target: { value: "4" } });
    await chooseSupplier(1, "supplier-2");
    expect(continueButton()).toBeEnabled();
    expect(
      screen.queryByText(`${prefix}quantity_warning_title`),
    ).not.toBeInTheDocument();
    expect(screen.getAllByRole("combobox", { name: /supplier/ }).map((input) => input.value)).toEqual(
      ["supplier-1", "supplier-2"],
    );
  });

  it.each([5, 15])(
    "shows a nonblocking quantity warning for allocation %i",
    async (quantity) => {
      render(<Harness />);
      await chooseSupplier();
      fireEvent.change(quantities()[0], {
        target: { value: String(quantity) },
      });
      const warning = screen.getByRole("alert", {
        name: `${prefix}quantity_warning_title`,
      });
      expect(warning).toHaveTextContent(
        `10 ${quantity} ${Math.abs(quantity - 10)}`,
      );
      expect(continueButton()).toBeEnabled();
    },
  );

  it("blocks a zero quantity and blocks advancing after removing all allocations", async () => {
    render(<Harness />);
    await chooseSupplier();
    fireEvent.change(quantities()[0], { target: { value: "0" } });
    expect(continueButton()).toBeDisabled();
    await userEvent.click(
      screen.getByRole("button", { name: /remove_allocation/ }),
    );
    expect(continueButton()).toBeDisabled();
    await userEvent.click(
      screen.getByRole("button", { name: /add_allocation/ }),
    );
    expect(quantities()).toHaveLength(1);
  });

  it("keeps two source identities for the same product", () => {
    const second = {
      ...sources[0],
      id: "pr-2",
      code: "PR-002",
      items: [{ ...sources[0].items[0], id: "item-2" }],
    };
    const state = createInitialState([...sources, second]);
    render(
      <AllocationStep
        state={state}
        setState={vi.fn()}
        sources={[...sources, second]}
        onContinue={vi.fn()}
      />,
    );
    expect(screen.getByText("PR-001")).toBeInTheDocument();
    expect(screen.getByText("PR-002")).toBeInTheDocument();
    expect(quantities()).toHaveLength(2);
  });

  it("keeps edits when navigating forward and back through the draft step", async () => {
    render(
      <Workspace
        token="token"
        sources={sources}
        sourceErrors={{}}
        renderDraftStep={({ onBack }) => (
          <section>
            <p>Draft editor</p>
            <button type="button" onClick={onBack}>
              Back to allocation
            </button>
          </section>
        )}
      />,
    );
    await chooseSupplier();
    fireEvent.change(quantities()[0], { target: { value: "7" } });
    await userEvent.click(continueButton());
    expect(screen.getByText("Draft editor")).toBeInTheDocument();
    await userEvent.click(
      screen.getByRole("button", { name: "Back to allocation" }),
    );
    expect(Number(quantities()[0].value)).toBe(7);
    expect(screen.getByRole("combobox", { name: /supplier/ })).toHaveValue("supplier-1");
  });

  it("shows the converted difference inside only the affected PR item", async () => {
    const second = {
      ...sources[0],
      id: "pr-2",
      code: "PR-002",
      items: [{ ...sources[0].items[0], id: "item-2" }],
    };
    render(<Harness initialState={createInitialState([...sources, second])} />);
    await userEvent.selectOptions(screen.getAllByRole("combobox", { name: "PO unit" })[0], "box");
    expect(within(screen.getByTestId("source-item-item-1")).getByRole("alert", {
      name: prefix + "quantity_warning_title",
    })).toHaveTextContent("10 120 110");
    expect(within(screen.getByTestId("source-item-item-2")).queryByRole("alert")).not.toBeInTheDocument();
    expect(screen.getAllByRole("combobox", { name: "PO unit" })[1]).toHaveValue("pcs");
  });

  it("blocks advance when the source resolver returns an error", async () => {
    render(
      <Harness sourceErrors={{ "ids.0": "PR-001 is no longer eligible" }} />,
    );
    await chooseSupplier();
    expect(
      screen.getByText("PR-001 is no longer eligible"),
    ).toBeInTheDocument();
    expect(continueButton()).toBeDisabled();
  });

  it("asks before discarding an edited draft and allows cancellation", async () => {
    let initialState = createInitialState(sources);
    initialState.allocationsById["allocation-1"].supplier_id = "supplier-1";
    initialState = reconcileDrafts(initialState);
    initialState.draftsById[initialState.activeDraftId].data.external_note =
      "Keep this PO note";
    render(<Harness initialState={initialState} />);
    await userEvent.click(
      screen.getByRole("button", { name: /remove_allocation/ }),
    );
    const dialog = screen.getByRole("dialog");
    expect(dialog).toHaveTextContent(`${prefix}confirm_changes_description`);
    await userEvent.click(
      within(dialog).getByRole("button", { name: `${prefix}cancel` }),
    );
    expect(Number(quantities()[0].value)).toBe(10);
    await userEvent.click(
      screen.getByRole("button", { name: /remove_allocation/ }),
    );
    await userEvent.click(
      within(screen.getByRole("dialog")).getByRole("button", {
        name: `${prefix}confirm`,
      }),
    );
    expect(screen.queryAllByLabelText(/allocation_quantity/)).toHaveLength(0);
  });

  it("shows loading and empty source states", () => {
    const { rerender } = render(<Workspace token="token" />);
    expect(screen.getByRole("status")).toHaveTextContent(`${prefix}loading`);
    rerender(<Workspace token="token" sources={[]} />);
    expect(screen.getByText(`${prefix}empty_sources`)).toBeInTheDocument();
  });

  it("retains draft fields through the extension contract and all three steps", async () => {
    render(
      <Workspace
        token="workspace-token"
        sources={sources}
        renderDraftStep={({ token, state, setState, onBack, onContinue }) => (
          <section aria-label="Draft editor">
            <p>{token}</p>
            <input
              aria-label="PO note"
              value={
                state.draftsById[state.activeDraftId].data.external_note ?? ""
              }
              onChange={(event) => {
                const note = event.target.value;
                setState((current) => ({
                  ...current,
                  draftsById: {
                    ...current.draftsById,
                    [current.activeDraftId]: {
                      ...current.draftsById[current.activeDraftId],
                      data: {
                        ...current.draftsById[current.activeDraftId].data,
                        external_note: note,
                      },
                    },
                  },
                }));
              }}
            />
            <button onClick={onBack}>Back to allocation</button>
            <button onClick={onContinue}>Review drafts</button>
          </section>
        )}
        renderReviewStep={({ state, onBack }) => (
          <section aria-label="Draft review">
            <p>{state.draftsById[state.activeDraftId].data.external_note}</p>
            <button onClick={onBack}>Back to drafts</button>
          </section>
        )}
      />,
    );
    await chooseSupplier();
    await userEvent.click(continueButton());
    expect(screen.getByText("workspace-token")).toBeInTheDocument();
    await userEvent.type(
      screen.getByRole("textbox", { name: "PO note" }),
      "Keep draft fields",
    );
    await userEvent.click(
      screen.getByRole("button", { name: "Review drafts" }),
    );
    expect(
      within(screen.getByRole("region", { name: "Draft review" })).getByText(
        "Keep draft fields",
      ),
    ).toBeInTheDocument();
    await userEvent.click(
      screen.getByRole("button", { name: "Back to drafts" }),
    );
    expect(screen.getByRole("textbox", { name: "PO note" })).toHaveValue(
      "Keep draft fields",
    );
    await userEvent.click(
      screen.getByRole("button", { name: "Back to allocation" }),
    );
    await userEvent.click(continueButton());
    expect(screen.getByRole("textbox", { name: "PO note" })).toHaveValue(
      "Keep draft fields",
    );
  });
});
