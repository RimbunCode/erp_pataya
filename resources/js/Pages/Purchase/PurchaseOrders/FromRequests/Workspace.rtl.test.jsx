import React from "react";
import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import Workspace from "./Workspace";

const { reload } = vi.hoisted(() => ({ reload: vi.fn() }));
vi.mock("@inertiajs/react", () => ({ Head: () => null, router: { reload } }));
vi.mock("laravel-react-i18n", () => ({
  useLaravelReactI18n: () => ({ t: (key) => key }),
}));
vi.mock("@/Layouts/AppLayout", () => ({
  default: ({ children, viewportShell }) => (
    <main data-viewport-shell={String(!!viewportShell)}>{children}</main>
  ),
}));
vi.mock("./AllocationStep", () => ({
  default: ({ setState, onContinue, sourceErrors }) => (
    <div>
      {sourceErrors?.missing_items && <p role="alert">{sourceErrors.missing_items}</p>}
      <button
        type="button"
        onClick={() =>
          setState((current) => ({
            ...current,
            draftsById: {
              "draft-1": {
                id: "draft-1",
                supplier_id: "supplier-1",
                data: { supplier: { id: "supplier-1" } },
              },
            },
            draftOrder: ["draft-1"],
            activeDraftId: "draft-1",
          }))
        }
      >
        Assign supplier
      </button>
      <button type="button" onClick={onContinue} disabled={Object.keys(sourceErrors ?? {}).length > 0}>
        Continue allocation
      </button>
    </div>
  ),
}));
vi.mock("./DraftStep", () => ({
  default: ({ state, setState, onBack, onContinue }) => (
    <div>
      <input
        aria-label="Draft note"
        value={state.draftsById["draft-1"]?.data.external_note ?? ""}
        onChange={(event) =>
          setState((current) => ({
            ...current,
            draftsById: {
              ...current.draftsById,
              "draft-1": {
                ...current.draftsById["draft-1"],
                data: {
                  ...current.draftsById["draft-1"].data,
                  external_note: event.target.value,
                },
              },
            },
          }))
        }
      />
      <button type="button" onClick={onBack}>
        Back draft
      </button>
      <button type="button" onClick={onContinue}>
        Continue draft
      </button>
    </div>
  ),
}));
vi.mock("./ReviewStep", () => ({
  default: ({ state, onBack, onRefreshSources }) => (
    <div>
      <p>{state.draftsById["draft-1"].data.external_note}</p>
      <button type="button" onClick={onBack}>
        Back review
      </button>
      <button type="button" onClick={onRefreshSources}>
        Refresh PR
      </button>
    </div>
  ),
}));

const sources = [
  {
    id: "pr-1",
    code: "PR-001",
    items: [{ id: "item-1", unordered_quantity: 2 }],
  },
];

describe("PO from PR workspace navigation", () => {
  it("keeps the shell header and footer outside the content scroll region", () => {
    render(<Workspace token="token-1" sources={sources} />);
    const scrollRegion = screen.getByTestId("workspace-scroll-region");
    const footer = screen.getByTestId("workspace-footer");
    expect(screen.getByRole("main")).toHaveAttribute("data-viewport-shell", "true");
    expect(scrollRegion).toHaveClass("min-h-0");
    expect(scrollRegion).toHaveClass("overflow-y-auto");
    expect(scrollRegion).not.toContainElement(footer);
    expect(footer.parentElement).toContainElement(scrollRegion);
  });
  it("preserves filled draft fields while moving between steps", async () => {
    const user = userEvent.setup();
    render(<Workspace token="token-1" sources={sources} />);
    await user.click(screen.getByRole("button", { name: "Assign supplier" }));
    await user.click(
      screen.getByRole("button", { name: "Continue allocation" }),
    );
    await user.type(
      screen.getByRole("textbox", { name: "Draft note" }),
      "Urgent order",
    );
    await user.click(screen.getByRole("button", { name: "Continue draft" }));
    expect(screen.getByText("Urgent order")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Back review" }));
    expect(screen.getByRole("textbox", { name: "Draft note" })).toHaveValue(
      "Urgent order",
    );
  });

  it("asks before refreshing sources without discarding client state", async () => {
    reload.mockReset();
    const user = userEvent.setup();
    render(<Workspace token="token-1" sources={sources} />);
    await user.click(screen.getByRole("button", { name: "Assign supplier" }));
    await user.click(
      screen.getByRole("button", { name: "Continue allocation" }),
    );
    await user.type(
      screen.getByRole("textbox", { name: "Draft note" }),
      "Keep this",
    );
    await user.click(screen.getByRole("button", { name: "Continue draft" }));
    await user.click(screen.getByRole("button", { name: "Refresh PR" }));
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(reload).not.toHaveBeenCalled();
    await user.click(
      screen.getByRole("dialog").querySelector("button:last-child"),
    );
    expect(reload).toHaveBeenCalledWith(
      expect.objectContaining({
        only: ["sources", "sourceErrors"],
        preserveState: true,
      }),
    );
    expect(screen.getByText("Keep this")).toBeInTheDocument();
  });

  it("blocks continuation when a refreshed PR item disappears", async () => {
    const { rerender } = render(<Workspace token="token-1" sources={sources} />);

    rerender(<Workspace token="token-1" sources={[]} />);

    expect(screen.getByRole("alert")).toHaveTextContent("missing_source_items");
    expect(screen.getByRole("button", { name: "Continue allocation" })).toBeDisabled();
  });
});
