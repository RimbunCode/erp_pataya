import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

// ============================================================================
// ConfirmWorkflowDialog.jsx (Requirement 2/3/4/5, spec
// asset-service-progress-workflow) -- dialog dibuka dari tombol "Confirm"
// (Show.jsx). Komponensi thin: Link (Create PR/PO, existing route),
// router.post (Mulai pekerjaan -> startWork), ActivityFormDialog (Hold,
// prefillStatus="on_hold" -- sudah py test sendiri di
// ServiceActivityLog.rtl.test.jsx, distub di sini sebagai black-box).
// StockAvailabilityCard (fetch async) distub -- di luar scope test ini.
// ============================================================================

const stableT = (key) => key;
vi.mock("laravel-react-i18n", () => ({
  useLaravelReactI18n: () => ({ t: stableT }),
}));

window.route = (name, ids) =>
  ids !== undefined ? `${name}/${JSON.stringify(ids)}` : name;

const routerPost = vi.fn();
vi.mock("@inertiajs/react", () => ({
  router: { post: (...a) => routerPost(...a) },
}));

vi.mock("@/Components/Link", () => ({
  default: ({ href, children }) => <a href={href}>{children}</a>,
}));

vi.mock("./StockAvailabilityCard", () => ({
  default: () => <div data-testid="stub-stock-card" />,
}));

vi.mock("./ServiceActivityLog", () => ({
  ActivityFormDialog: ({ prefillStatus, open }) =>
    open ? (
      <div data-testid="stub-activity-form-dialog">{prefillStatus}</div>
    ) : null,
}));

import ConfirmWorkflowDialog from "./ConfirmWorkflowDialog";

describe("ConfirmWorkflowDialog", () => {
  beforeEach(() => {
    routerPost.mockReset();
  });

  const baseAssetService = (overrides = {}) => ({
    id: 7,
    has_available_stock: true,
    ...overrides,
  });

  it("menampilkan Option Hold, Create PR, Create PO, dan Mulai Pekerjaan (stok tersedia)", () => {
    render(
      <ConfirmWorkflowDialog
        assetService={baseAssetService()}
        open={true}
        onOpenChange={() => {}}
      />,
    );

    const dialog = screen.getByRole("dialog");
    expect(
      within(dialog).getByText("asset.service.confirmWorkflow.hold"),
    ).toBeInTheDocument();
    expect(
      within(dialog).getByText("asset.service.actions.create_pr"),
    ).toBeInTheDocument();
    expect(
      within(dialog).getByText("asset.service.actions.create_po"),
    ).toBeInTheDocument();
    expect(
      within(dialog).getByText("asset.service.confirmWorkflow.start_work"),
    ).toBeInTheDocument();
  });

  it("Requirement 5 AC2: Option 'Mulai Pekerjaan' disembunyikan kalau has_available_stock=false", () => {
    render(
      <ConfirmWorkflowDialog
        assetService={baseAssetService({ has_available_stock: false })}
        open={true}
        onOpenChange={() => {}}
      />,
    );

    expect(
      screen.queryByText("asset.service.confirmWorkflow.start_work"),
    ).not.toBeInTheDocument();
  });

  it("klik 'Mulai Pekerjaan' memanggil router.post ke assetServices.startWork dengan id AssetService", async () => {
    const user = userEvent.setup();
    render(
      <ConfirmWorkflowDialog
        assetService={baseAssetService({ id: 42 })}
        open={true}
        onOpenChange={() => {}}
      />,
    );

    await user.click(
      screen.getByText("asset.service.confirmWorkflow.start_work"),
    );

    expect(routerPost).toHaveBeenCalledWith("assetServices.startWork/42");
  });

  it("tombol Create PR/PO mengarah ke route existing dengan ref=assetService/{id} (reuse asset-service-procurement, TIDAK ada mekanisme baru)", () => {
    render(
      <ConfirmWorkflowDialog
        assetService={baseAssetService({ id: 5 })}
        open={true}
        onOpenChange={() => {}}
      />,
    );

    expect(
      screen.getByText("asset.service.actions.create_pr").closest("a"),
    ).toHaveAttribute(
      "href",
      `purchaseRequests.create/${JSON.stringify({ ref: "assetService/5" })}`,
    );
    expect(
      screen.getByText("asset.service.actions.create_po").closest("a"),
    ).toHaveAttribute(
      "href",
      `purchaseOrders.create/${JSON.stringify({ ref: "assetService/5" })}`,
    );
  });

  it("klik Option Hold membuka ActivityFormDialog dengan prefillStatus='on_hold'", async () => {
    const user = userEvent.setup();
    render(
      <ConfirmWorkflowDialog
        assetService={baseAssetService()}
        open={true}
        onOpenChange={() => {}}
      />,
    );

    expect(
      screen.queryByTestId("stub-activity-form-dialog"),
    ).not.toBeInTheDocument();

    await user.click(screen.getByText("asset.service.confirmWorkflow.hold"));

    expect(screen.getByTestId("stub-activity-form-dialog")).toHaveTextContent(
      "on_hold",
    );
  });
});
