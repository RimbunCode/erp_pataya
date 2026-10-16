import { act, fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  partitionBulk,
  resolveRowActions,
} from "@/Components/Table/RowActions/rowActions";

const mocks = vi.hoisted(() => ({
  post: vi.fn(),
  canGlobal: vi.fn(),
  error: vi.fn(),
  props: null,
  pending: null,
}));

vi.mock("@inertiajs/react", () => ({ router: { post: mocks.post } }));
vi.mock("@/Hooks/usePermission", () => ({
  default: () => ({ canGlobal: mocks.canGlobal }),
}));
vi.mock("laravel-react-i18n", () => ({
  useLaravelReactI18n: () => ({ t: (key) => key }),
}));
vi.mock("@/lib/gooeyToast", () => ({ gooeyToast: { error: mocks.error } }));
vi.mock("@/Components/Link", () => ({
  default: ({ href, children }) => <a href={href}>{children}</a>,
}));
vi.mock("./Form", () => ({ default: () => null }));
vi.mock("@/Pages/Core/DataTable2", () => ({
  default: (props) => {
    mocks.props = props;
    const rows = [
      { id: "pr-1", canCreatePo: true },
      { id: "pr-2", canCreatePo: false },
      { id: "pr-3", canCreatePo: true },
      { id: "pr-4", canCreatePo: "true" },
      { id: "pr-5" },
    ];
    return (
      <>
        {resolveRowActions(props.rowActions ?? [], rows[0]).map((action) => (
          <button
            key={action.key}
            onClick={() => {
              mocks.pending = action.onAction([rows[0]], { source: "single" });
            }}
          >
            {action.label}
          </button>
        ))}
        {(props.rowActions ?? [])
          .filter((action) => action.bulk)
          .map((action) => (
            <button
              key={action.key}
              onClick={() => {
                mocks.pending = action.onAction(
                  partitionBulk(action, rows).eligible,
                  { source: "bulk" },
                );
              }}
            >
              Selected: {action.label}
            </button>
          ))}
      </>
    );
  },
}));

import Index from "./Index";

const label = "purchase.purchaseRequest.actions.create_po";

function startSingle() {
  fireEvent.click(screen.getByRole("button", { name: label }));
  return mocks.post.mock.calls[0][2];
}

describe("PurchaseRequests Index create PO action", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.canGlobal.mockReturnValue(true);
    mocks.props = null;
    mocks.pending = null;
    window.route = vi.fn((name) => name);
  });

  it("stages a single row with only its ID in the POST body", () => {
    render(<Index />);
    startSingle();
    expect(mocks.post).toHaveBeenCalledWith(
      "purchaseOrders.fromRequests.stage",
      { ids: ["pr-1"] },
      expect.any(Object),
    );
    expect(window.route).toHaveBeenCalledWith(
      "purchaseOrders.fromRequests.stage",
    );
    expect(mocks.props.rowActions[0]).toMatchObject({
      key: "createPo",
      single: true,
      bulk: true,
      requires: ["canCreatePo"],
    });
  });

  it("stages only eligible IDs from mixed bulk selection, including mobile selection", () => {
    render(<Index />);
    fireEvent.click(screen.getByRole("button", { name: `Selected: ${label}` }));
    expect(mocks.post.mock.calls[0][1]).toEqual({ ids: ["pr-1", "pr-3"] });
  });

  it("renders a navigable PR card in the mobile row shell", () => {
    render(<Index />);
    expect(typeof mocks.props.templateItem).toBe("function");
    render(mocks.props.templateItem({ dataRow: { id: "pr-1", code: "PR-001", status: ["to_order"] } }));
    expect(screen.getByRole("link", { name: /PR-001/ })).toHaveAttribute("href", "purchaseRequests.show");
    expect(screen.getByText("status.to_order")).toBeInTheDocument();
  });

  it("requires strictly true metadata, including when visible status/item fields are absent", () => {
    render(<Index />);
    const { enabled } = mocks.props.rowActions[0];
    expect(enabled({ canCreatePo: true })).toBe(true);
    for (const row of [{ canCreatePo: false }, { canCreatePo: "true" }, {}]) {
      expect(enabled(row)).toBe(false);
    }
  });

  it("hides both entry points without PO create permission", () => {
    mocks.canGlobal.mockReturnValue(false);
    render(<Index />);
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
    expect(mocks.canGlobal).toHaveBeenCalledWith(
      "App\\Models\\Purchase\\PurchaseOrder",
      "create",
    );
    expect(mocks.props.rowActions).toEqual([]);
  });

  it("keeps the action pending until Inertia finishes following the stage redirect", async () => {
    render(<Index />);
    const options = startSingle();
    const settled = vi.fn();
    mocks.pending.then(settled);
    await act(async () => {});
    expect(settled).not.toHaveBeenCalled();
    await act(async () => {
      options.onFinish();
      await mocks.pending;
    });
    expect(settled).toHaveBeenCalledOnce();
  });

  it("shows staging validation errors", () => {
    render(<Index />);
    startSingle().onError({ "ids.1": "PR is no longer eligible." });
    expect(mocks.error).toHaveBeenCalledWith("PR is no longer eligible.");
  });

  it.each(["onHttpException", "onNetworkError"])(
    "shows a translated failure for %s",
    (callback) => {
      render(<Index />);
      expect(startSingle()[callback](new Error("failed"))).toBe(false);
      expect(mocks.error).toHaveBeenCalledWith(
        "purchase.purchaseRequest.actions.create_po_failed",
      );
    },
  );
});
