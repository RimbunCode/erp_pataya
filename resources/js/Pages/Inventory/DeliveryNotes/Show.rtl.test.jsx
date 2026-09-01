import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";

// ============================================================================
// Show.jsx (66 baris) adalah halaman detail Delivery Note -- JAUH lebih
// sederhana dibanding Show.jsx PurchaseOrders/SalesOrders (tidak ada dialog
// konfirmasi, tidak ada router.post, tidak ada QtyBadge/ItemsQtyTable).
// Ia MENG-COMPOSE <FormPage><Form/></FormPage> (keduanya sudah py test
// sendiri) PLUS logic UI unik miliknya sendiri:
// - banner: hanya muncul kalau flash.errorItems ada, menampilkan judul +
//   daftar error (masing-masing di-translate lewat t()).
// - controls(): tombol "Create Sales Return" (Link ke deliveryNotes.create
//   dengan ref) HANYA muncul kalau SEMUA syarat terpenuhi:
//   1. deliveryNote?.submitted_at ada
//   2. isValidStatus(deliveryNote?.status) true (status bukan salah satu dari
//      draft/canceled/rejected/deleted/closed/need_approval/inactive)
//   3. inArray(deliveryNote?.status, "delivered") true (status HARUS
//      "delivered", bukan status valid lain mis. "to_bill")
//   4. calculateArray(deliveryNote?.items, "unreturned_quantity", "+") > 0
//      (total unreturned_quantity dari semua item harus positif)
// - disabled={deliveryNote?.submitted_at} diteruskan ke FormPage.
// - isCreate={!deliveryNote} diteruskan ke FormPage.
//
// calculateArray/inArray/isValidStatus dari @/lib/utils TIDAK di-mock --
// fungsi murni, dipakai apa adanya supaya logic gating controls() teruji
// end-to-end (bukan sekadar terverifikasi dipanggil).
//
// FormPage & Form DISTUB sebagai black-box -- test ini TIDAK meretest logic
// internal keduanya, hanya memverifikasi Show.jsx merender & menyambungkan
// props dengan benar, dan bahwa logic UNIK (banner/controls gating) di
// Show.jsx sendiri berperilaku benar.
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
// sederhana yang merender banner/controls()/children apa adanya, plus
// mengekspos props penting (isCreate/disabled) lewat data-testid supaya
// bisa diverifikasi tanpa merender FormPage asli yang berat.
vi.mock("@/Pages/Core/FormPage", () => ({
  FormPage: ({ isCreate, disabled, banner, controls, children }) => (
    <div data-testid="stub-form-page">
      <div data-testid="form-page-meta">
        {JSON.stringify({ isCreate: !!isCreate, disabled: !!disabled })}
      </div>
      <div data-testid="form-page-banner">{banner}</div>
      <div data-testid="form-page-controls">
        {typeof controls === "function" ? controls() : controls}
      </div>
      <div data-testid="form-page-children">{children}</div>
    </div>
  ),
}));

// --- ./Form -------------------------------------------------------------
// Form.jsx DeliveryNotes sudah py test sendiri (Form.rtl.test.jsx) --
// distub sebagai black-box testid, tidak diretest di sini.
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

function baseDeliveryNote(overrides = {}) {
  return {
    id: 5,
    submitted_at: "2026-08-01T00:00:00Z",
    status: "delivered",
    items: [{ id: 1, unreturned_quantity: 3 }],
    ...overrides,
  };
}

function renderShow(props = {}) {
  return render(
    <Show deliveryNote={null} defaultData={{}} flash={{}} {...props} />,
  );
}

describe("Show (DeliveryNotes)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // --- Compose FormPage/Form dasar ----------------------------------------
  describe("compose FormPage + Form", () => {
    it("mode create (deliveryNote null): isCreate=true, disabled=false, tidak ada controls", () => {
      renderShow({ deliveryNote: null });

      expect(screen.getByTestId("form-page-meta")).toHaveTextContent(
        JSON.stringify({ isCreate: true, disabled: false }),
      );
      expect(screen.getByTestId("stub-form")).toBeInTheDocument();
      expect(
        screen.queryByText(
          "inventory.deliveryNote.actions.create_sales_return",
        ),
      ).not.toBeInTheDocument();
    });

    it("mode edit belum submit: isCreate=false, disabled=false (submitted_at kosong)", () => {
      const deliveryNote = {
        id: 1,
        submitted_at: null,
        status: "draft",
        items: [],
      };
      renderShow({ deliveryNote });

      expect(screen.getByTestId("form-page-meta")).toHaveTextContent(
        JSON.stringify({ isCreate: false, disabled: false }),
      );
    });

    it("submitted_at ada: disabled=true diteruskan ke FormPage", () => {
      const deliveryNote = baseDeliveryNote();
      renderShow({ deliveryNote });

      expect(screen.getByTestId("form-page-meta")).toHaveTextContent(
        JSON.stringify({ isCreate: false, disabled: true }),
      );
    });
  });

  // --- banner: flash.errorItems ---------------------------------------------
  describe("banner errorItems", () => {
    it("flash.errorItems kosong/tidak ada: banner tidak merender apa pun", () => {
      renderShow({ deliveryNote: null, flash: {} });

      expect(
        screen.queryByText("core.form.errors.title"),
      ).not.toBeInTheDocument();
    });

    it("flash.errorItems ada: menampilkan judul dan daftar error ter-translate", () => {
      renderShow({
        deliveryNote: null,
        flash: { errorItems: ["error.one", "error.two"] },
      });

      expect(screen.getByText("core.form.errors.title")).toBeInTheDocument();
      expect(screen.getByText("error.one")).toBeInTheDocument();
      expect(screen.getByText("error.two")).toBeInTheDocument();
      // Masing-masing item error dirender sebagai <li> terpisah.
      const list = screen.getByText("error.one").closest("ul");
      expect(list.querySelectorAll("li")).toHaveLength(2);
    });
  });

  // --- controls(): tombol Create Sales Return (gating 4 syarat) -----------
  describe("controls() -- tombol Create Sales Return", () => {
    it("semua syarat terpenuhi: tombol muncul dengan href route yang benar", () => {
      const deliveryNote = baseDeliveryNote({ id: 42 });
      renderShow({ deliveryNote });

      const link = screen.getByText(
        "inventory.deliveryNote.actions.create_sales_return",
      );
      expect(link).toBeInTheDocument();
      expect(link.closest("a")).toHaveAttribute(
        "href",
        `deliveryNotes.create/${JSON.stringify({ ref: "deliveryNote/42" })}`,
      );
    });

    it("submitted_at kosong: tombol tidak muncul meski status/items memenuhi syarat lain", () => {
      const deliveryNote = baseDeliveryNote({ submitted_at: null });
      renderShow({ deliveryNote });

      expect(
        screen.queryByText(
          "inventory.deliveryNote.actions.create_sales_return",
        ),
      ).not.toBeInTheDocument();
    });

    it("status tidak valid (mis. draft/canceled): tombol tidak muncul", () => {
      const deliveryNote = baseDeliveryNote({ status: "canceled" });
      renderShow({ deliveryNote });

      expect(
        screen.queryByText(
          "inventory.deliveryNote.actions.create_sales_return",
        ),
      ).not.toBeInTheDocument();
    });

    it("status valid tapi bukan 'delivered' (mis. 'to_bill'): tombol tidak muncul", () => {
      const deliveryNote = baseDeliveryNote({ status: "to_bill" });
      renderShow({ deliveryNote });

      expect(
        screen.queryByText(
          "inventory.deliveryNote.actions.create_sales_return",
        ),
      ).not.toBeInTheDocument();
    });

    it("total unreturned_quantity === 0: tombol tidak muncul", () => {
      const deliveryNote = baseDeliveryNote({
        items: [
          { id: 1, unreturned_quantity: 0 },
          { id: 2, unreturned_quantity: 0 },
        ],
      });
      renderShow({ deliveryNote });

      expect(
        screen.queryByText(
          "inventory.deliveryNote.actions.create_sales_return",
        ),
      ).not.toBeInTheDocument();
    });

    it("total unreturned_quantity negatif: tombol tidak muncul", () => {
      const deliveryNote = baseDeliveryNote({
        items: [{ id: 1, unreturned_quantity: -2 }],
      });
      renderShow({ deliveryNote });

      expect(
        screen.queryByText(
          "inventory.deliveryNote.actions.create_sales_return",
        ),
      ).not.toBeInTheDocument();
    });

    it("items kosong (calculateArray -> 0): tombol tidak muncul", () => {
      const deliveryNote = baseDeliveryNote({ items: [] });
      renderShow({ deliveryNote });

      expect(
        screen.queryByText(
          "inventory.deliveryNote.actions.create_sales_return",
        ),
      ).not.toBeInTheDocument();
    });

    it("items dengan sebagian unreturned_quantity nol dan sebagian positif: total > 0, tombol muncul", () => {
      const deliveryNote = baseDeliveryNote({
        id: 9,
        items: [
          { id: 1, unreturned_quantity: 0 },
          { id: 2, unreturned_quantity: 4 },
        ],
      });
      renderShow({ deliveryNote });

      const link = screen.getByText(
        "inventory.deliveryNote.actions.create_sales_return",
      );
      expect(link.closest("a")).toHaveAttribute(
        "href",
        `deliveryNotes.create/${JSON.stringify({ ref: "deliveryNote/9" })}`,
      );
    });
  });
});
