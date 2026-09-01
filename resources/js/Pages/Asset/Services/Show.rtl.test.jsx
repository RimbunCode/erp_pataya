import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";

// ============================================================================
// Show.jsx (72 baris) adalah halaman detail Asset Service. Jauh lebih
// sederhana dibanding Show.jsx PurchaseOrders (295 baris, jadi referensi
// pola mock): tidak ada QtyBadge/ItemsQtyTable, tidak ada dialog konfirmasi
// (Sync Items / Mark Done), tidak ada dropdown actions -- controls() cuma
// merender 0-2 tombol Link statis (create PR / create PO), masing-masing
// digate oleh canGlobal() permission SENDIRI-SENDIRI (independen satu sama
// lain), semuanya di dalam gate luar canRequestPurchase
// (assetService?.submitted_at).
//
// Logic UNIK Show.jsx ini sendiri:
// - isApproved: (assetService?.status ?? []).includes("approved") --
//   PENTING: status di sini diperlakukan sebagai ARRAY (bukan string
//   tunggal seperti kebanyakan dokumen submitable lain), method .includes()
//   dipanggil langsung ke propnya.
// - canRequestPurchase: assetService?.submitted_at (truthy check biasa).
// - controls(): return null kalau !canRequestPurchase (FormPage stub akan
//   merender null, bukan fragment kosong).
// - Tombol "create_pr" hanya muncul kalau canGlobal(PurchaseRequest,create)
//   true. Tombol "create_po" hanya muncul kalau
//   canGlobal(PurchaseOrder,create) true. Keduanya independen -- kombinasi
//   0/1/2 tombol semua mungkin.
// - href tombol pakai route() dengan params { ref: `assetService/${id}` }.
// - <ServiceActivityLog/> hanya dirender kalau assetService ADA DAN
//   isApproved true (dua syarat AND, bukan cuma submitted_at).
//
// FormPage, Form, dan ServiceActivityLog semua distub sebagai black-box:
// FormPage/Form sudah py test sendiri (FormPage.rtl.test.jsx,
// Form.rtl.test.jsx punya Services), ServiceActivityLog adalah komponen
// terpisah dengan logic sendiri (dialog aktivitas, toggle done, dsb) yang
// di luar scope test Show.jsx ini.
// ============================================================================

const stableT = (key) => key;
vi.mock("laravel-react-i18n", () => ({
  useLaravelReactI18n: () => ({ t: stableT }),
}));

window.route = (name, params) =>
  params !== undefined ? `${name}/${JSON.stringify(params)}` : name;

// --- @/Hooks/usePermission ---------------------------------------------
// usePermission asli membaca usePage().props (permissions, auth.user) lewat
// @inertiajs/react -- di luar scope test Show.jsx (hook generik dipakai di
// banyak halaman). Distub supaya canGlobal bisa dikontrol langsung per
// test case tanpa perlu menyiapkan seluruh Inertia page props.
const canGlobalMock = vi.fn();
vi.mock("@/Hooks/usePermission", () => ({
  default: () => ({ canGlobal: (...a) => canGlobalMock(...a) }),
}));

// --- @/Pages/Core/FormPage ---------------------------------------------------
// FormPage asli sudah py test sendiri (FormPage.rtl.test.jsx). Show.jsx
// meng-compose <FormPage> langsung sebagai komponen -- distub jadi wrapper
// sederhana yang merender controls()/children apa adanya, plus mengekspos
// props penting (isCreate/disabled) lewat data-testid.
vi.mock("@/Pages/Core/FormPage", () => ({
  FormPage: ({ isCreate, disabled, controls, children }) => (
    <div data-testid="stub-form-page">
      <div data-testid="form-page-meta">
        {JSON.stringify({ isCreate: !!isCreate, disabled: !!disabled })}
      </div>
      <div data-testid="form-page-controls">
        {typeof controls === "function" ? controls() : controls}
      </div>
      <div data-testid="form-page-children">{children}</div>
    </div>
  ),
}));

// --- ./Form ---------------------------------------------------------------
// Form.jsx Services sudah py test sendiri (Form.rtl.test.jsx) -- distub
// sebagai black-box testid, tidak diretest di sini.
vi.mock("./Form", () => ({
  default: () => <div data-testid="stub-form" />,
}));

// --- ./ServiceActivityLog ---------------------------------------------------
// Komponen terpisah dengan logic sendiri (dialog aktivitas, toggle done,
// mark complete) -- di luar scope test Show.jsx. Distub sebagai black-box
// yang menangkap assetService yang diteruskan untuk diverifikasi.
vi.mock("./ServiceActivityLog", () => ({
  default: ({ assetService }) => (
    <div data-testid="stub-activity-log">{assetService?.id}</div>
  ),
}));

// --- @/Components/Link ----------------------------------------------------
// Link.jsx memakai router/shouldIntercept dari @inertiajs/core plus
// useIsDirtyForm/useAlertDraftForm -- di luar scope test Show.jsx. Distub
// jadi <a> sederhana yang menangkap href supaya assertion cukup
// memverifikasi Show.jsx meneruskan route() yang benar.
vi.mock("@/Components/Link", () => ({
  default: ({ href, children }) => <a href={href}>{children}</a>,
}));

import Show from "./Show";

function baseAssetService(overrides = {}) {
  return {
    id: 5,
    status: [],
    submitted_at: null,
    ...overrides,
  };
}

describe("Show (Asset/Services)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    canGlobalMock.mockReturnValue(false);
  });

  // --- Compose FormPage/Form dasar ----------------------------------------
  describe("compose FormPage + Form", () => {
    it("mode create (assetService null): isCreate=true, disabled=false, controls null", () => {
      render(<Show assetService={null} defaultData={{}} />);

      expect(screen.getByTestId("form-page-meta")).toHaveTextContent(
        JSON.stringify({ isCreate: true, disabled: false }),
      );
      expect(screen.getByTestId("stub-form")).toBeInTheDocument();
      expect(screen.getByTestId("form-page-controls")).toBeEmptyDOMElement();
    });

    it("mode edit belum submit: isCreate=false, disabled=false (submitted_at kosong)", () => {
      const assetService = baseAssetService({ submitted_at: null });
      render(<Show assetService={assetService} defaultData={{}} />);

      expect(screen.getByTestId("form-page-meta")).toHaveTextContent(
        JSON.stringify({ isCreate: false, disabled: false }),
      );
    });

    it("submitted_at ada: disabled=true diteruskan ke FormPage", () => {
      const assetService = baseAssetService({
        submitted_at: "2026-08-01T00:00:00Z",
      });
      render(<Show assetService={assetService} defaultData={{}} />);

      expect(screen.getByTestId("form-page-meta")).toHaveTextContent(
        JSON.stringify({ isCreate: false, disabled: true }),
      );
    });
  });

  // --- controls(): gating canRequestPurchase + tombol create_pr/create_po --
  describe("controls() -- tombol create PR/PO", () => {
    it("submitted_at kosong: controls() return null, tidak ada tombol sama sekali", () => {
      const assetService = baseAssetService({ submitted_at: null });
      canGlobalMock.mockReturnValue(true);
      render(<Show assetService={assetService} defaultData={{}} />);

      expect(
        screen.queryByText("asset.service.actions.create_pr"),
      ).not.toBeInTheDocument();
      expect(
        screen.queryByText("asset.service.actions.create_po"),
      ).not.toBeInTheDocument();
      expect(canGlobalMock).not.toHaveBeenCalled();
    });

    it("submitted_at ada, canGlobal true untuk keduanya: kedua tombol muncul dengan href benar", () => {
      const assetService = baseAssetService({
        id: 9,
        submitted_at: "2026-08-01T00:00:00Z",
      });
      canGlobalMock.mockReturnValue(true);
      render(<Show assetService={assetService} defaultData={{}} />);

      const prLink = screen.getByText("asset.service.actions.create_pr");
      expect(prLink.closest("a")).toHaveAttribute(
        "href",
        `purchaseRequests.create/${JSON.stringify({ ref: "assetService/9" })}`,
      );

      const poLink = screen.getByText("asset.service.actions.create_po");
      expect(poLink.closest("a")).toHaveAttribute(
        "href",
        `purchaseOrders.create/${JSON.stringify({ ref: "assetService/9" })}`,
      );

      expect(canGlobalMock).toHaveBeenCalledWith(
        "App\\Models\\Purchase\\PurchaseRequest",
        "create",
      );
      expect(canGlobalMock).toHaveBeenCalledWith(
        "App\\Models\\Purchase\\PurchaseOrder",
        "create",
      );
    });

    it("submitted_at ada, canGlobal false untuk keduanya: tidak ada tombol muncul", () => {
      const assetService = baseAssetService({
        submitted_at: "2026-08-01T00:00:00Z",
      });
      canGlobalMock.mockReturnValue(false);
      render(<Show assetService={assetService} defaultData={{}} />);

      expect(
        screen.queryByText("asset.service.actions.create_pr"),
      ).not.toBeInTheDocument();
      expect(
        screen.queryByText("asset.service.actions.create_po"),
      ).not.toBeInTheDocument();
    });

    it("hanya PurchaseRequest yang diizinkan: hanya tombol create_pr yang muncul (independen)", () => {
      const assetService = baseAssetService({
        submitted_at: "2026-08-01T00:00:00Z",
      });
      canGlobalMock.mockImplementation(
        (model) => model === "App\\Models\\Purchase\\PurchaseRequest",
      );
      render(<Show assetService={assetService} defaultData={{}} />);

      expect(
        screen.getByText("asset.service.actions.create_pr"),
      ).toBeInTheDocument();
      expect(
        screen.queryByText("asset.service.actions.create_po"),
      ).not.toBeInTheDocument();
    });

    it("hanya PurchaseOrder yang diizinkan: hanya tombol create_po yang muncul (independen)", () => {
      const assetService = baseAssetService({
        submitted_at: "2026-08-01T00:00:00Z",
      });
      canGlobalMock.mockImplementation(
        (model) => model === "App\\Models\\Purchase\\PurchaseOrder",
      );
      render(<Show assetService={assetService} defaultData={{}} />);

      expect(
        screen.queryByText("asset.service.actions.create_pr"),
      ).not.toBeInTheDocument();
      expect(
        screen.getByText("asset.service.actions.create_po"),
      ).toBeInTheDocument();
    });
  });

  // --- controls(): gating canRequestPurchase + tombol create_so/create_io --
  describe("controls() -- tombol create SalesOrder/InternalOrder", () => {
    it("submitted_at ada, canGlobal true untuk keduanya: kedua tombol muncul dengan href benar", () => {
      const assetService = baseAssetService({
        id: 9,
        submitted_at: "2026-08-01T00:00:00Z",
      });
      canGlobalMock.mockReturnValue(true);
      render(<Show assetService={assetService} defaultData={{}} />);

      const soLink = screen.getByText("asset.service.actions.create_so");
      expect(soLink.closest("a")).toHaveAttribute(
        "href",
        `salesOrders.create/${JSON.stringify({ ref: "assetService/9" })}`,
      );

      const ioLink = screen.getByText("asset.service.actions.create_io");
      expect(ioLink.closest("a")).toHaveAttribute(
        "href",
        `internalOrders.create/${JSON.stringify({ ref: "assetService/9" })}`,
      );

      expect(canGlobalMock).toHaveBeenCalledWith(
        "App\\Models\\Sales\\SalesOrder",
        "create",
      );
      expect(canGlobalMock).toHaveBeenCalledWith(
        "App\\Models\\Sales\\InternalOrder",
        "create",
      );
    });

    it("hanya SalesOrder yang diizinkan: hanya tombol create_so yang muncul (independen)", () => {
      const assetService = baseAssetService({
        submitted_at: "2026-08-01T00:00:00Z",
      });
      canGlobalMock.mockImplementation(
        (model) => model === "App\\Models\\Sales\\SalesOrder",
      );
      render(<Show assetService={assetService} defaultData={{}} />);

      expect(
        screen.getByText("asset.service.actions.create_so"),
      ).toBeInTheDocument();
      expect(
        screen.queryByText("asset.service.actions.create_io"),
      ).not.toBeInTheDocument();
    });

    it("hanya InternalOrder yang diizinkan: hanya tombol create_io yang muncul (independen)", () => {
      const assetService = baseAssetService({
        submitted_at: "2026-08-01T00:00:00Z",
      });
      canGlobalMock.mockImplementation(
        (model) => model === "App\\Models\\Sales\\InternalOrder",
      );
      render(<Show assetService={assetService} defaultData={{}} />);

      expect(
        screen.queryByText("asset.service.actions.create_so"),
      ).not.toBeInTheDocument();
      expect(
        screen.getByText("asset.service.actions.create_io"),
      ).toBeInTheDocument();
    });
  });

  // --- isApproved / ServiceActivityLog gating ------------------------------
  describe("ServiceActivityLog -- gating status approved", () => {
    it("assetService null (create mode): ServiceActivityLog tidak dirender", () => {
      render(<Show assetService={null} defaultData={{}} />);

      expect(screen.queryByTestId("stub-activity-log")).not.toBeInTheDocument();
    });

    it("assetService ada tapi status tidak termasuk 'approved': tidak dirender", () => {
      const assetService = baseAssetService({ status: ["draft"] });
      render(<Show assetService={assetService} defaultData={{}} />);

      expect(screen.queryByTestId("stub-activity-log")).not.toBeInTheDocument();
    });

    it("assetService ada dengan status kosong/null: tidak dirender (bukan crash)", () => {
      const assetService = baseAssetService({ status: null });
      render(<Show assetService={assetService} defaultData={{}} />);

      expect(screen.queryByTestId("stub-activity-log")).not.toBeInTheDocument();
    });

    it("assetService ada dan status termasuk 'approved': ServiceActivityLog dirender dengan assetService diteruskan", () => {
      const assetService = baseAssetService({
        id: 21,
        status: ["approved"],
      });
      render(<Show assetService={assetService} defaultData={{}} />);

      const log = screen.getByTestId("stub-activity-log");
      expect(log).toBeInTheDocument();
      expect(log).toHaveTextContent("21");
    });

    it("status array berisi 'approved' di antara status lain: tetap dirender", () => {
      const assetService = baseAssetService({
        status: ["submitted", "approved", "completed"],
      });
      render(<Show assetService={assetService} defaultData={{}} />);

      expect(screen.getByTestId("stub-activity-log")).toBeInTheDocument();
    });
  });
});
