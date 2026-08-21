import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";

// ============================================================================
// Show.jsx (49 baris) adalah halaman detail Purchase Request -- paling
// sederhana di antara Show.jsx modul Purchase/Inventory yang sudah punya
// test (tidak ada banner/flash, tidak ada dialog konfirmasi, tidak ada
// router.post, tidak ada sub-komponen display seperti QtyBadge/
// ItemsQtyTable). Ia MENG-COMPOSE <FormPage><Form/></FormPage> (keduanya
// sudah py test sendiri) PLUS logic UI unik miliknya sendiri:
// - disabled={purchaseRequest?.submitted_at} diteruskan ke FormPage
//   (BUKAN hasil boolean eksplisit -- nilai submitted_at string/undefined
//   diteruskan apa adanya, cocok dgn pola isCreate/disabled Show.jsx lain).
// - isCreate={!purchaseRequest} diteruskan ke FormPage.
// - submitable diteruskan sebagai prop statis (selalu true) ke FormPage.
// - controls(): tombol "Create PO" (Link ke purchaseOrders.create dengan
//   ref) HANYA muncul kalau SEMUA syarat terpenuhi:
//   1. purchaseRequest?.submitted_at ada (truthy)
//   2. isValidStatus(purchaseRequest?.status) true (status bukan salah
//      satu dari draft/canceled/rejected/deleted/closed/need_approval/
//      inactive)
//   3. calculateArray(purchaseRequest.items, "unordered_quantity", "+") > 0
//      (total unordered_quantity dari semua item harus positif)
//   Beda dari DeliveryNotes: TIDAK ada syarat inArray(status, ...) untuk
//   status spesifik tertentu -- cukup isValidStatus umum.
//   Beda dari PurchaseOrders: hanya 1 tombol Link biasa (bukan dropdown
//   actions), tidak ada tombol Mark Done, tidak ada dialog sama sekali.
// - calculateArray dipanggil dengan purchaseRequest.items (BUKAN optional
//   chaining purchaseRequest?.items) -- kalau purchaseRequest null maka
//   akses .items akan throw; namun controls() tidak pernah sampai baris
//   itu saat purchaseRequest null karena short-circuit dari syarat 1
//   (purchaseRequest?.submitted_at falsy duluan).
//
// calculateArray/isValidStatus dari @/lib/utils TIDAK di-mock -- fungsi
// murni, dipakai apa adanya supaya logic gating controls() teruji
// end-to-end (bukan sekadar terverifikasi dipanggil).
//
// FormPage & Form DISTUB sebagai black-box -- test ini TIDAK meretest
// logic internal keduanya (Form.jsx PurchaseRequests sudah py test
// sendiri), hanya memverifikasi Show.jsx merender & menyambungkan props
// dengan benar, dan bahwa logic UNIK (controls gating) di Show.jsx
// sendiri berperilaku benar.
// ============================================================================

const stableT = (key) => key;
vi.mock("laravel-react-i18n", () => ({
  useLaravelReactI18n: () => ({ t: stableT }),
}));

window.route = (name, params) =>
  params !== undefined ? `${name}/${JSON.stringify(params)}` : name;

// --- @/Pages/Core/FormPage ---------------------------------------------------
// FormPage asli sudah py test sendiri (FormPage.rtl.test.jsx). Show.jsx
// MENG-COMPOSE <FormPage> LANGSUNG sebagai komponen -- distub jadi wrapper
// sederhana yang merender controls()/children apa adanya, plus mengekspos
// props penting (isCreate/disabled/submitable) lewat data-testid supaya
// bisa diverifikasi tanpa merender FormPage asli yang berat (AppLayout,
// useForm, dsb).
vi.mock("@/Pages/Core/FormPage", () => ({
  FormPage: ({ isCreate, disabled, submitable, controls, children }) => (
    <div data-testid="stub-form-page">
      <div data-testid="form-page-meta">
        {JSON.stringify({
          isCreate: !!isCreate,
          disabled: !!disabled,
          submitable: !!submitable,
        })}
      </div>
      <div data-testid="form-page-controls">
        {typeof controls === "function" ? controls() : controls}
      </div>
      <div data-testid="form-page-children">{children}</div>
    </div>
  ),
}));

// --- ./Form -------------------------------------------------------------
// Form.jsx PurchaseRequests sudah py test sendiri -- distub sebagai
// black-box testid, tidak diretest di sini.
vi.mock("./Form", () => ({
  default: () => <div data-testid="stub-form" />,
}));

// --- @/Components/Link ----------------------------------------------------
// Distub jadi <a> sederhana yang menangkap href supaya assertion cukup
// memverifikasi Show.jsx meneruskan route() yang benar, tanpa menyeret
// seluruh chain useIsDirtyForm/@inertiajs/core.
vi.mock("@/Components/Link", () => ({
  default: ({ href, children }) => <a href={href}>{children}</a>,
}));

import Show from "./Show";

function basePurchaseRequest(overrides = {}) {
  return {
    id: 5,
    submitted_at: "2026-08-01T00:00:00Z",
    status: "pending",
    items: [{ id: 1, unordered_quantity: 3 }],
    ...overrides,
  };
}

describe("Show (PurchaseRequests)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // --- Compose FormPage + Form dasar ----------------------------------------
  describe("compose FormPage + Form", () => {
    it("mode create (purchaseRequest null): isCreate=true, disabled=false, submitable=true, tidak ada controls", () => {
      render(<Show purchaseRequest={null} defaultData={{}} />);

      expect(screen.getByTestId("form-page-meta")).toHaveTextContent(
        JSON.stringify({ isCreate: true, disabled: false, submitable: true }),
      );
      expect(screen.getByTestId("stub-form")).toBeInTheDocument();
      expect(
        screen.queryByText(
          "purchase.purchaseRequest.actions.create_po",
        ),
      ).not.toBeInTheDocument();
    });

    it("mode edit belum submit: isCreate=false, disabled=false (submitted_at kosong), tidak ada controls", () => {
      const purchaseRequest = {
        id: 1,
        submitted_at: null,
        status: "draft",
        items: [],
      };
      render(<Show purchaseRequest={purchaseRequest} defaultData={{}} />);

      expect(screen.getByTestId("form-page-meta")).toHaveTextContent(
        JSON.stringify({ isCreate: false, disabled: false, submitable: true }),
      );
      expect(
        screen.queryByText(
          "purchase.purchaseRequest.actions.create_po",
        ),
      ).not.toBeInTheDocument();
    });

    it("submitted_at ada: disabled=true diteruskan ke FormPage", () => {
      const purchaseRequest = basePurchaseRequest();
      render(<Show purchaseRequest={purchaseRequest} defaultData={{}} />);

      expect(screen.getByTestId("form-page-meta")).toHaveTextContent(
        JSON.stringify({ isCreate: false, disabled: true, submitable: true }),
      );
    });

    it("meneruskan defaultData sebagai children Form (lewat FormPage stub)", () => {
      render(<Show purchaseRequest={null} defaultData={{ foo: "bar" }} />);

      expect(screen.getByTestId("form-page-children")).toContainElement(
        screen.getByTestId("stub-form"),
      );
    });
  });

  // --- controls(): tombol Create PO (gating 3 syarat) -----------------------
  describe("controls() -- tombol Create PO", () => {
    it("semua syarat terpenuhi: tombol muncul dengan href route + ref yang benar", () => {
      const purchaseRequest = basePurchaseRequest({ id: 42 });
      render(<Show purchaseRequest={purchaseRequest} defaultData={{}} />);

      const link = screen.getByText(
        "purchase.purchaseRequest.actions.create_po",
      );
      expect(link).toBeInTheDocument();
      expect(link.closest("a")).toHaveAttribute(
        "href",
        `purchaseOrders.create/${JSON.stringify({ ref: "purchaseRequest/42" })}`,
      );
    });

    it("submitted_at kosong: tombol tidak muncul meski status/items memenuhi syarat lain", () => {
      const purchaseRequest = basePurchaseRequest({ submitted_at: null });
      render(<Show purchaseRequest={purchaseRequest} defaultData={{}} />);

      expect(
        screen.queryByText(
          "purchase.purchaseRequest.actions.create_po",
        ),
      ).not.toBeInTheDocument();
    });

    it("status tidak valid (mis. draft): tombol tidak muncul", () => {
      const purchaseRequest = basePurchaseRequest({ status: "draft" });
      render(<Show purchaseRequest={purchaseRequest} defaultData={{}} />);

      expect(
        screen.queryByText(
          "purchase.purchaseRequest.actions.create_po",
        ),
      ).not.toBeInTheDocument();
    });

    it("status tidak valid (mis. canceled): tombol tidak muncul", () => {
      const purchaseRequest = basePurchaseRequest({ status: "canceled" });
      render(<Show purchaseRequest={purchaseRequest} defaultData={{}} />);

      expect(
        screen.queryByText(
          "purchase.purchaseRequest.actions.create_po",
        ),
      ).not.toBeInTheDocument();
    });

    it("status valid apa pun selain daftar invalid (mis. 'to_order'): tombol tetap muncul (tidak ada syarat inArray status spesifik)", () => {
      const purchaseRequest = basePurchaseRequest({ status: "to_order" });
      render(<Show purchaseRequest={purchaseRequest} defaultData={{}} />);

      expect(
        screen.getByText("purchase.purchaseRequest.actions.create_po"),
      ).toBeInTheDocument();
    });

    it("total unordered_quantity === 0: tombol tidak muncul", () => {
      const purchaseRequest = basePurchaseRequest({
        items: [
          { id: 1, unordered_quantity: 0 },
          { id: 2, unordered_quantity: 0 },
        ],
      });
      render(<Show purchaseRequest={purchaseRequest} defaultData={{}} />);

      expect(
        screen.queryByText(
          "purchase.purchaseRequest.actions.create_po",
        ),
      ).not.toBeInTheDocument();
    });

    it("total unordered_quantity negatif: tombol tidak muncul", () => {
      const purchaseRequest = basePurchaseRequest({
        items: [{ id: 1, unordered_quantity: -2 }],
      });
      render(<Show purchaseRequest={purchaseRequest} defaultData={{}} />);

      expect(
        screen.queryByText(
          "purchase.purchaseRequest.actions.create_po",
        ),
      ).not.toBeInTheDocument();
    });

    it("items kosong (calculateArray -> 0): tombol tidak muncul", () => {
      const purchaseRequest = basePurchaseRequest({ items: [] });
      render(<Show purchaseRequest={purchaseRequest} defaultData={{}} />);

      expect(
        screen.queryByText(
          "purchase.purchaseRequest.actions.create_po",
        ),
      ).not.toBeInTheDocument();
    });

    it("items dengan sebagian unordered_quantity nol dan sebagian positif: total > 0, tombol muncul", () => {
      const purchaseRequest = basePurchaseRequest({
        id: 9,
        items: [
          { id: 1, unordered_quantity: 0 },
          { id: 2, unordered_quantity: 4 },
        ],
      });
      render(<Show purchaseRequest={purchaseRequest} defaultData={{}} />);

      const link = screen.getByText(
        "purchase.purchaseRequest.actions.create_po",
      );
      expect(link.closest("a")).toHaveAttribute(
        "href",
        `purchaseOrders.create/${JSON.stringify({ ref: "purchaseRequest/9" })}`,
      );
    });
  });
});
