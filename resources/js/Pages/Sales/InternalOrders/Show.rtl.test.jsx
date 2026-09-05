import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";

// ============================================================================
// Show.jsx (44 baris) adalah halaman detail Internal Order -- JAUH lebih
// sederhana dibanding Show.jsx SalesOrders/DeliveryNotes (tidak ada dialog
// konfirmasi, tidak ada router.post, tidak ada QtyBadge/ItemsQtyTable/banner
// errorItems). Ia MENG-COMPOSE <FormPage><Form/></FormPage> (keduanya sudah
// py test sendiri) PLUS logic UI unik miliknya sendiri:
// - disabled={internalOrder?.submitted_at}, isCreate={!internalOrder},
//   submitable diteruskan ke FormPage.
// - controls(): tombol "Create Delivery Note" (Link ke deliveryNotes.create
//   dengan ref) HANYA muncul kalau SEMUA syarat terpenuhi:
//   1. internalOrder?.submitted_at ada
//   2. isValidStatus(internalOrder?.status) true (status bukan salah satu
//      dari draft/canceled/rejected/deleted/closed/need_approval/inactive)
//   3. calculateArray(internalOrder?.items, "undelivered_quantity", "+") > 0
//      (total undelivered_quantity dari semua item harus positif)
//   -- BERBEDA dari DeliveryNotes/Show.jsx: TIDAK ada pengecekan inArray
//   status spesifik (mis. "delivered") -- cukup isValidStatus + qty > 0.
// - Tidak ada banner flash.errorItems sama sekali di Show.jsx ini (berbeda
//   dari SalesOrders/DeliveryNotes) -- Show hanya menerima prop
//   `internalOrder`.
//
// calculateArray/isValidStatus dari @/lib/utils TIDAK di-mock -- fungsi
// murni, dipakai apa adanya supaya logic gating controls() teruji
// end-to-end (bukan sekadar terverifikasi dipanggil).
//
// FormPage & Form DISTUB sebagai black-box -- test ini TIDAK meretest logic
// internal keduanya, hanya memverifikasi Show.jsx merender & menyambungkan
// props dengan benar, dan bahwa logic UNIK (controls gating) di Show.jsx
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
// bisa diverifikasi tanpa merender FormPage asli yang berat.
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
// Form.jsx InternalOrders sudah py test sendiri -- distub sebagai
// black-box testid, tidak diretest di sini.
vi.mock("./Form", () => ({
  default: () => <div data-testid="stub-form" />,
}));

// --- @/Components/Link ----------------------------------------------------
// Distub jadi <a> sederhana yang menangkap href supaya assertion cukup
// memverifikasi Show.jsx meneruskan route() yang benar.
vi.mock("@/Components/Link", () => ({
  default: ({ href, children }) => <a href={href}>{children}</a>,
}));

import Show from "./Show";

function baseInternalOrder(overrides = {}) {
  return {
    id: 5,
    submitted_at: "2026-08-01T00:00:00Z",
    status: "to_deliver",
    items: [{ id: 1, undelivered_quantity: 3 }],
    ...overrides,
  };
}

describe("Show (InternalOrders)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // --- Compose FormPage + Form dasar ----------------------------------------
  describe("compose FormPage + Form", () => {
    it("mode create (internalOrder undefined): isCreate=true, disabled=false, submitable=true, tidak ada controls", () => {
      render(<Show />);

      expect(screen.getByTestId("form-page-meta")).toHaveTextContent(
        JSON.stringify({ isCreate: true, disabled: false, submitable: true }),
      );
      expect(screen.getByTestId("stub-form")).toBeInTheDocument();
      expect(
        screen.queryByText("sales.internalOrder.actions.create_delivery_note"),
      ).not.toBeInTheDocument();
    });

    it("mode edit belum submit: isCreate=false, disabled=false (submitted_at kosong), tidak ada controls", () => {
      const internalOrder = {
        id: 1,
        submitted_at: null,
        status: "draft",
        items: [],
      };
      render(<Show internalOrder={internalOrder} />);

      expect(screen.getByTestId("form-page-meta")).toHaveTextContent(
        JSON.stringify({ isCreate: false, disabled: false, submitable: true }),
      );
      expect(
        screen.queryByText("sales.internalOrder.actions.create_delivery_note"),
      ).not.toBeInTheDocument();
    });

    it("submitted_at ada: disabled=true diteruskan ke FormPage", () => {
      const internalOrder = baseInternalOrder({ status: "draft" });
      render(<Show internalOrder={internalOrder} />);

      expect(screen.getByTestId("form-page-meta")).toHaveTextContent(
        JSON.stringify({ isCreate: false, disabled: true, submitable: true }),
      );
    });
  });

  // --- controls(): tombol Create Delivery Note (gating 3 syarat) -----------
  describe("controls() -- tombol Create Delivery Note", () => {
    it("semua syarat terpenuhi: tombol muncul dengan href route yang benar", () => {
      const internalOrder = baseInternalOrder({ id: 42 });
      render(<Show internalOrder={internalOrder} />);

      const link = screen.getByText(
        "sales.internalOrder.actions.create_delivery_note",
      );
      expect(link).toBeInTheDocument();
      expect(link.closest("a")).toHaveAttribute(
        "href",
        `deliveryNotes.create/${JSON.stringify({ ref: "internalOrder/42" })}`,
      );
    });

    it("submitted_at kosong: tombol tidak muncul meski status/items memenuhi syarat lain", () => {
      const internalOrder = baseInternalOrder({ submitted_at: null });
      render(<Show internalOrder={internalOrder} />);

      expect(
        screen.queryByText("sales.internalOrder.actions.create_delivery_note"),
      ).not.toBeInTheDocument();
    });

    it("status tidak valid (mis. draft): tombol tidak muncul", () => {
      const internalOrder = baseInternalOrder({ status: "draft" });
      render(<Show internalOrder={internalOrder} />);

      expect(
        screen.queryByText("sales.internalOrder.actions.create_delivery_note"),
      ).not.toBeInTheDocument();
    });

    it("status tidak valid (mis. canceled): tombol tidak muncul", () => {
      const internalOrder = baseInternalOrder({ status: "canceled" });
      render(<Show internalOrder={internalOrder} />);

      expect(
        screen.queryByText("sales.internalOrder.actions.create_delivery_note"),
      ).not.toBeInTheDocument();
    });

    it("status valid apapun (tidak ada pengecekan status spesifik seperti 'delivered'): tombol tetap muncul", () => {
      const internalOrder = baseInternalOrder({ status: "to_bill" });
      render(<Show internalOrder={internalOrder} />);

      expect(
        screen.getByText("sales.internalOrder.actions.create_delivery_note"),
      ).toBeInTheDocument();
    });

    it("total undelivered_quantity === 0: tombol tidak muncul", () => {
      const internalOrder = baseInternalOrder({
        items: [
          { id: 1, undelivered_quantity: 0 },
          { id: 2, undelivered_quantity: 0 },
        ],
      });
      render(<Show internalOrder={internalOrder} />);

      expect(
        screen.queryByText("sales.internalOrder.actions.create_delivery_note"),
      ).not.toBeInTheDocument();
    });

    it("total undelivered_quantity negatif: tombol tidak muncul", () => {
      const internalOrder = baseInternalOrder({
        items: [{ id: 1, undelivered_quantity: -2 }],
      });
      render(<Show internalOrder={internalOrder} />);

      expect(
        screen.queryByText("sales.internalOrder.actions.create_delivery_note"),
      ).not.toBeInTheDocument();
    });

    it("items kosong (calculateArray -> 0): tombol tidak muncul", () => {
      const internalOrder = baseInternalOrder({ items: [] });
      render(<Show internalOrder={internalOrder} />);

      expect(
        screen.queryByText("sales.internalOrder.actions.create_delivery_note"),
      ).not.toBeInTheDocument();
    });

    it("items undefined (calculateArray -> 0): tombol tidak muncul, tidak crash", () => {
      const internalOrder = baseInternalOrder({ items: undefined });
      render(<Show internalOrder={internalOrder} />);

      expect(
        screen.queryByText("sales.internalOrder.actions.create_delivery_note"),
      ).not.toBeInTheDocument();
    });

    it("items dengan sebagian undelivered_quantity nol dan sebagian positif: total > 0, tombol muncul", () => {
      const internalOrder = baseInternalOrder({
        id: 9,
        items: [
          { id: 1, undelivered_quantity: 0 },
          { id: 2, undelivered_quantity: 4 },
        ],
      });
      render(<Show internalOrder={internalOrder} />);

      const link = screen.getByText(
        "sales.internalOrder.actions.create_delivery_note",
      );
      expect(link.closest("a")).toHaveAttribute(
        "href",
        `deliveryNotes.create/${JSON.stringify({ ref: "internalOrder/9" })}`,
      );
    });

    it("internalOrder undefined: controls() tidak crash walau mengakses optional chaining", () => {
      render(<Show />);

      expect(screen.getByTestId("form-page-controls")).toBeInTheDocument();
      expect(
        screen.queryByText("sales.internalOrder.actions.create_delivery_note"),
      ).not.toBeInTheDocument();
    });
  });
});
