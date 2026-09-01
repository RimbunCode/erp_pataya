import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";

// ============================================================================
// Show.jsx (50 baris) adalah halaman detail Purchase Receipt -- SANGAT
// sederhana, bahkan lebih sederhana dari DeliveryNotes/Show.jsx (tidak ada
// prop `flash` / banner error, tidak ada dialog konfirmasi, tidak ada
// router.post). Ia MENG-COMPOSE <FormPage><Form/></FormPage> (keduanya
// sudah py test sendiri) PLUS logic UI unik miliknya sendiri:
// - controls(): tombol "Create Purchase Return" (Link ke
//   purchaseReceipts.create dengan ref) HANYA muncul kalau SEMUA syarat
//   terpenuhi:
//   1. purchaseReceipt?.submitted_at ada
//   2. isValidStatus(purchaseReceipt?.status) true (status bukan salah satu
//      dari draft/canceled/rejected/deleted/closed/need_approval/inactive)
//   3. inArray(purchaseReceipt?.status, "received") true (status HARUS
//      "received", bukan status valid lain)
//   4. calculateArray(purchaseReceipt?.items, "unreturned_quantity", "+") > 0
//      (total unreturned_quantity dari semua item harus positif)
// - disabled={(purchaseReceipt?.status ?? "draft") != "draft"} diteruskan ke
//   FormPage -- BEDA dari DeliveryNotes/PurchaseOrders yang pakai
//   `disabled={submitted_at}`. Di sini disabled berbasis STATUS, bukan
//   submitted_at: status "draft" (termasuk saat purchaseReceipt null/status
//   kosong, fallback ke "draft") -> disabled=false; status apa pun selain
//   "draft" -> disabled=true, TERLEPAS dari submitted_at.
// - banner={<AssetCompletionAlert assets={fixedAssets} />} diteruskan
//   sebagai ELEMEN JSX langsung (BUKAN function seperti banner di
//   DeliveryNotes/Show.jsx) -- AssetCompletionAlert selalu dipanggil,
//   internal-nya sendiri yang menghandle assets kosong/null (return null).
// - isCreate={!purchaseReceipt} diteruskan ke FormPage.
// - ignoreDraft={defaultData} diteruskan ke FormPage.
//
// calculateArray/inArray/isValidStatus dari @/lib/utils TIDAK di-mock --
// fungsi murni, dipakai apa adanya supaya logic gating controls() teruji
// end-to-end (bukan sekadar terverifikasi dipanggil).
//
// FormPage, Form, dan AssetCompletionAlert DISTUB sebagai black-box -- test
// ini TIDAK meretest logic internal mereka, hanya memverifikasi Show.jsx
// merender & menyambungkan props dengan benar, dan bahwa logic UNIK
// (disabled berbasis status/controls gating) di Show.jsx sendiri
// berperilaku benar.
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
// Form.jsx PurchaseReceipts sudah py test sendiri (Form.rtl.test.jsx) --
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

// --- @/Pages/Asset/Assets/AssetCompletionAlert -----------------------------
// Komponen terpisah dengan logic sendiri (filter incomplete/complete asset,
// dialog CompleteDataDialog) -- di luar scope test Show.jsx. Distub sebagai
// black-box yang menangkap prop `assets` supaya assertion cukup
// memverifikasi Show.jsx meneruskan fixedAssets dengan benar.
vi.mock("@/Pages/Asset/Assets/AssetCompletionAlert", () => ({
  default: ({ assets }) => (
    <div data-testid="stub-asset-completion-alert">
      {JSON.stringify(assets ?? null)}
    </div>
  ),
}));

import Show from "./Show";

function basePurchaseReceipt(overrides = {}) {
  return {
    id: 5,
    submitted_at: "2026-08-01T00:00:00Z",
    status: "received",
    items: [{ id: 1, unreturned_quantity: 3 }],
    ...overrides,
  };
}

function renderShow(props = {}) {
  return render(
    <Show
      purchaseReceipt={null}
      defaultData={{}}
      fixedAssets={[]}
      {...props}
    />,
  );
}

describe("Show (PurchaseReceipts)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // --- Compose FormPage/Form dasar ----------------------------------------
  describe("compose FormPage + Form", () => {
    it("mode create (purchaseReceipt null): isCreate=true, disabled=false (fallback status draft), tidak ada controls", () => {
      renderShow({ purchaseReceipt: null });

      expect(screen.getByTestId("form-page-meta")).toHaveTextContent(
        JSON.stringify({ isCreate: true, disabled: false }),
      );
      expect(screen.getByTestId("stub-form")).toBeInTheDocument();
      expect(
        screen.queryByText("purchase.purchaseReceipt.create_purchase_return"),
      ).not.toBeInTheDocument();
    });

    it("mode edit status draft: isCreate=false, disabled=false", () => {
      const purchaseReceipt = {
        id: 1,
        submitted_at: null,
        status: "draft",
        items: [],
      };
      renderShow({ purchaseReceipt });

      expect(screen.getByTestId("form-page-meta")).toHaveTextContent(
        JSON.stringify({ isCreate: false, disabled: false }),
      );
    });

    it("mode edit status selain draft (mis. 'received'): disabled=true diteruskan ke FormPage", () => {
      const purchaseReceipt = basePurchaseReceipt();
      renderShow({ purchaseReceipt });

      expect(screen.getByTestId("form-page-meta")).toHaveTextContent(
        JSON.stringify({ isCreate: false, disabled: true }),
      );
    });

    it("status kosong/undefined tapi purchaseReceipt ada: fallback ke 'draft' -> disabled=false", () => {
      const purchaseReceipt = { id: 2, submitted_at: null, items: [] };
      renderShow({ purchaseReceipt });

      expect(screen.getByTestId("form-page-meta")).toHaveTextContent(
        JSON.stringify({ isCreate: false, disabled: false }),
      );
    });

    it("submitted_at ada TAPI status masih 'draft': disabled tetap false (disabled berbasis status, bukan submitted_at)", () => {
      const purchaseReceipt = {
        id: 3,
        submitted_at: "2026-08-01T00:00:00Z",
        status: "draft",
        items: [],
      };
      renderShow({ purchaseReceipt });

      expect(screen.getByTestId("form-page-meta")).toHaveTextContent(
        JSON.stringify({ isCreate: false, disabled: false }),
      );
    });
  });

  // --- banner: AssetCompletionAlert -----------------------------------------
  describe("banner AssetCompletionAlert", () => {
    it("selalu merender AssetCompletionAlert dan meneruskan fixedAssets sebagai prop assets", () => {
      const fixedAssets = [{ id: 1, asset_name: "Laptop" }];
      renderShow({ purchaseReceipt: null, fixedAssets });

      const stub = screen.getByTestId("stub-asset-completion-alert");
      expect(stub).toBeInTheDocument();
      expect(stub).toHaveTextContent(JSON.stringify(fixedAssets));
    });

    it("fixedAssets undefined: AssetCompletionAlert tetap dirender (banner adalah elemen JSX langsung, bukan function kondisional)", () => {
      render(<Show purchaseReceipt={null} defaultData={{}} />);

      expect(
        screen.getByTestId("stub-asset-completion-alert"),
      ).toBeInTheDocument();
    });
  });

  // --- controls(): tombol Create Purchase Return (gating 4 syarat) --------
  describe("controls() -- tombol Create Purchase Return", () => {
    it("semua syarat terpenuhi: tombol muncul dengan href route yang benar", () => {
      const purchaseReceipt = basePurchaseReceipt({ id: 42 });
      renderShow({ purchaseReceipt });

      const link = screen.getByText(
        "purchase.purchaseReceipt.create_purchase_return",
      );
      expect(link).toBeInTheDocument();
      expect(link.closest("a")).toHaveAttribute(
        "href",
        `purchaseReceipts.create/${JSON.stringify({ ref: "purchaseReceipt/42" })}`,
      );
    });

    it("submitted_at kosong: tombol tidak muncul meski status/items memenuhi syarat lain", () => {
      const purchaseReceipt = basePurchaseReceipt({ submitted_at: null });
      renderShow({ purchaseReceipt });

      expect(
        screen.queryByText("purchase.purchaseReceipt.create_purchase_return"),
      ).not.toBeInTheDocument();
    });

    it("status tidak valid (mis. canceled): tombol tidak muncul", () => {
      const purchaseReceipt = basePurchaseReceipt({ status: "canceled" });
      renderShow({ purchaseReceipt });

      expect(
        screen.queryByText("purchase.purchaseReceipt.create_purchase_return"),
      ).not.toBeInTheDocument();
    });

    it("status draft: tombol tidak muncul (juga membuat disabled=false secara bersamaan)", () => {
      const purchaseReceipt = basePurchaseReceipt({ status: "draft" });
      renderShow({ purchaseReceipt });

      expect(
        screen.queryByText("purchase.purchaseReceipt.create_purchase_return"),
      ).not.toBeInTheDocument();
    });

    it("status valid tapi bukan 'received' (mis. 'to_bill'): tombol tidak muncul", () => {
      const purchaseReceipt = basePurchaseReceipt({ status: "to_bill" });
      renderShow({ purchaseReceipt });

      expect(
        screen.queryByText("purchase.purchaseReceipt.create_purchase_return"),
      ).not.toBeInTheDocument();
    });

    it("total unreturned_quantity === 0: tombol tidak muncul", () => {
      const purchaseReceipt = basePurchaseReceipt({
        items: [
          { id: 1, unreturned_quantity: 0 },
          { id: 2, unreturned_quantity: 0 },
        ],
      });
      renderShow({ purchaseReceipt });

      expect(
        screen.queryByText("purchase.purchaseReceipt.create_purchase_return"),
      ).not.toBeInTheDocument();
    });

    it("total unreturned_quantity negatif: tombol tidak muncul", () => {
      const purchaseReceipt = basePurchaseReceipt({
        items: [{ id: 1, unreturned_quantity: -2 }],
      });
      renderShow({ purchaseReceipt });

      expect(
        screen.queryByText("purchase.purchaseReceipt.create_purchase_return"),
      ).not.toBeInTheDocument();
    });

    it("items kosong (calculateArray -> 0): tombol tidak muncul", () => {
      const purchaseReceipt = basePurchaseReceipt({ items: [] });
      renderShow({ purchaseReceipt });

      expect(
        screen.queryByText("purchase.purchaseReceipt.create_purchase_return"),
      ).not.toBeInTheDocument();
    });

    it("items dengan sebagian unreturned_quantity nol dan sebagian positif: total > 0, tombol muncul", () => {
      const purchaseReceipt = basePurchaseReceipt({
        id: 9,
        items: [
          { id: 1, unreturned_quantity: 0 },
          { id: 2, unreturned_quantity: 4 },
        ],
      });
      renderShow({ purchaseReceipt });

      const link = screen.getByText(
        "purchase.purchaseReceipt.create_purchase_return",
      );
      expect(link.closest("a")).toHaveAttribute(
        "href",
        `purchaseReceipts.create/${JSON.stringify({ ref: "purchaseReceipt/9" })}`,
      );
    });

    it("purchaseReceipt null: controls() tidak melempar error dan tidak merender tombol", () => {
      renderShow({ purchaseReceipt: null });

      expect(
        screen.queryByText("purchase.purchaseReceipt.create_purchase_return"),
      ).not.toBeInTheDocument();
    });
  });
});
