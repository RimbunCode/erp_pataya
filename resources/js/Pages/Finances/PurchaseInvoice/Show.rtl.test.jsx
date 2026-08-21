import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

// ============================================================================
// Show.jsx (100 baris) adalah halaman detail Purchase Invoice. Ia MENG-COMPOSE
// <FormPage><Form/></FormPage> (FormPage sudah py test sendiri di
// FormPage.rtl.test.jsx, Form.jsx PurchaseInvoice sudah py test sendiri di
// Form.rtl.test.jsx) PLUS logic UI unik miliknya sendiri:
// - controls(): dropdown "Actions" berisi 2 opsi KONDISIONAL INDEPENDEN
//   (bukan mutually exclusive seperti SalesOrders to_bill/to_deliver):
//     1. "Buat Payment Entry" -- muncul kalau status masuk
//        ["unpaid", "partially_paid", "returned"]
//     2. "Buat Debit Note" -- muncul kalau !is_return DAN
//        calculateArray(items, "unreturned_quantity", "+") > 0
//   Dropdown ITU SENDIRI (trigger button) hanya muncul kalau SEMUA syarat
//   gerbang luar terpenuhi:
//     - purchaseInvoice.submitted_at ada
//     - isValidStatus(status) true (status BUKAN salah satu dari
//       draft/canceled/rejected/deleted/closed/need_approval/inactive)
//     - (kondisi 2 di atas ATAU status masuk daftar
//       unpaid/partially_paid/returned)
//   -- artinya walau salah satu opsi dalam dropdown terpenuhi, dropdown
//   tetap tidak muncul kalau gerbang luar (submitted_at/isValidStatus) gagal.
// - banner={<AssetCompletionAlert assets={fixedAssets} />} -- diteruskan
//   apa adanya ke FormPage, AssetCompletionAlert sendiri komponen terpisah
//   (distub sebagai black-box, bukan bagian logic unik Show.jsx).
//
// PENTING beda dari referensi PurchaseOrders/SalesOrders:
// - TIDAK ADA dialog konfirmasi apa pun (tidak ada Sync Items, tidak ada
//   Mark Done) -- tidak ada router.post sama sekali di file ini.
// - TIDAK ADA tombol "Mark Done" atau sub-komponen tabel qty
//   (QtyBadge/ItemsQtyTable) -- Show.jsx ini jauh lebih sederhana.
// - calculateArray/inArray/isValidStatus DIPAKAI LANGSUNG dari
//   "@/lib/utils" asli (tidak di-mock) supaya logic gerbang kondisional
//   diuji apa adanya, sama seperti pola referensi.
// - banner prop diteruskan ke FormPage (SalesOrders juga punya banner,
//   tapi isinya beda: flash.errorItems, bukan AssetCompletionAlert).
//
// FormPage, Form, dan AssetCompletionAlert DISTUB sebagai black-box -- test
// ini TIDAK meretest logic internal ketiganya, hanya memverifikasi Show.jsx
// merender & menyambungkan props dengan benar, dan bahwa logic UNIK
// (gerbang dropdown & opsi di dalamnya) di Show.jsx sendiri berperilaku
// benar.
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
// mengekspos props penting (isCreate/disabled) lewat data-testid supaya bisa
// diverifikasi tanpa merender FormPage asli yang berat (AppLayout, useForm,
// dsb).
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
// Form.jsx PurchaseInvoice sudah py test sendiri (Form.rtl.test.jsx) --
// distub sebagai black-box testid, tidak diretest di sini.
vi.mock("./Form", () => ({
  default: () => <div data-testid="stub-form" />,
}));

// --- @/Pages/Asset/Assets/AssetCompletionAlert -----------------------------
// Komponen terpisah dengan logic & state sendiri (dialog complete data,
// filter incomplete/complete asset) -- di luar scope logic unik Show.jsx.
// Distub sebagai black-box yang menangkap prop `assets` supaya assertion
// cukup memverifikasi Show.jsx meneruskan `fixedAssets` dengan benar.
vi.mock("@/Pages/Asset/Assets/AssetCompletionAlert", () => ({
  default: ({ assets }) => (
    <div data-testid="stub-asset-completion-alert">
      {JSON.stringify(assets ?? null)}
    </div>
  ),
}));

// --- @/Components/Link ----------------------------------------------------
// Link.jsx (dipakai dropdown "Buat Payment Entry"/"Buat Debit Note") memakai
// router/shouldIntercept dari @inertiajs/core plus
// useIsDirtyForm/useAlertDraftForm -- di luar scope test Show.jsx (Link
// sendiri komponen generik). Distub jadi <a> sederhana yang menangkap href
// supaya assertion cukup memverifikasi Show.jsx meneruskan route() yang
// benar, tanpa menyeret seluruh chain useIsDirtyForm/@inertiajs/core.
vi.mock("@/Components/Link", () => ({
  default: ({ href, children }) => <a href={href}>{children}</a>,
}));

import Show from "./Show";

function basePurchaseInvoice(overrides = {}) {
  return {
    id: 7,
    status: "unpaid",
    submitted_at: "2026-08-01T00:00:00Z",
    is_return: false,
    items: [],
    ...overrides,
  };
}

describe("Show (PurchaseInvoice)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // --- Compose FormPage/Form dasar ----------------------------------------
  describe("compose FormPage + Form", () => {
    it("mode create (purchaseInvoice null): isCreate=true, disabled=false diteruskan ke FormPage, tidak ada dropdown", () => {
      render(
        <Show purchaseInvoice={null} defaultData={{}} fixedAssets={[]} />,
      );

      expect(screen.getByTestId("form-page-meta")).toHaveTextContent(
        JSON.stringify({ isCreate: true, disabled: false }),
      );
      expect(screen.getByTestId("stub-form")).toBeInTheDocument();
      expect(
        screen.queryByRole("button", { name: /core.form.actions/ }),
      ).not.toBeInTheDocument();
    });

    it("mode edit belum submit (status draft): isCreate=false, disabled=false, tidak ada dropdown", () => {
      const purchaseInvoice = {
        id: 1,
        status: "draft",
        submitted_at: null,
        items: [],
      };
      render(
        <Show
          purchaseInvoice={purchaseInvoice}
          defaultData={{}}
          fixedAssets={[]}
        />,
      );

      expect(screen.getByTestId("form-page-meta")).toHaveTextContent(
        JSON.stringify({ isCreate: false, disabled: false }),
      );
      expect(
        screen.queryByRole("button", { name: /core.form.actions/ }),
      ).not.toBeInTheDocument();
    });

    it("status bukan draft: disabled=true diteruskan ke FormPage", () => {
      const purchaseInvoice = basePurchaseInvoice({ status: "unpaid" });
      render(
        <Show
          purchaseInvoice={purchaseInvoice}
          defaultData={{}}
          fixedAssets={[]}
        />,
      );

      expect(screen.getByTestId("form-page-meta")).toHaveTextContent(
        JSON.stringify({ isCreate: false, disabled: true }),
      );
    });

    it("status draft eksplisit (bukan null/undefined): disabled=false", () => {
      const purchaseInvoice = basePurchaseInvoice({ status: "draft" });
      render(
        <Show
          purchaseInvoice={purchaseInvoice}
          defaultData={{}}
          fixedAssets={[]}
        />,
      );

      expect(screen.getByTestId("form-page-meta")).toHaveTextContent(
        JSON.stringify({ isCreate: false, disabled: false }),
      );
    });

    it("meneruskan fixedAssets ke AssetCompletionAlert lewat banner", () => {
      const fixedAssets = [{ id: 1, asset_name: "Laptop" }];
      render(
        <Show purchaseInvoice={null} defaultData={{}} fixedAssets={fixedAssets} />,
      );

      const banner = screen.getByTestId("form-page-banner");
      expect(
        banner.querySelector('[data-testid="stub-asset-completion-alert"]'),
      ).toHaveTextContent(JSON.stringify(fixedAssets));
    });
  });

  // --- controls(): gerbang luar dropdown Actions --------------------------
  describe("controls() -- gerbang luar dropdown Actions", () => {
    it("tidak submitted_at: dropdown tidak muncul walau status & items memenuhi syarat dalam", () => {
      const purchaseInvoice = basePurchaseInvoice({
        submitted_at: null,
        status: "unpaid",
      });
      render(
        <Show
          purchaseInvoice={purchaseInvoice}
          defaultData={{}}
          fixedAssets={[]}
        />,
      );

      expect(
        screen.queryByRole("button", { name: /core.form.actions/ }),
      ).not.toBeInTheDocument();
    });

    it("status draft (isValidStatus false) meski submitted_at ada: dropdown tidak muncul", () => {
      const purchaseInvoice = basePurchaseInvoice({ status: "draft" });
      render(
        <Show
          purchaseInvoice={purchaseInvoice}
          defaultData={{}}
          fixedAssets={[]}
        />,
      );

      expect(
        screen.queryByRole("button", { name: /core.form.actions/ }),
      ).not.toBeInTheDocument();
    });

    it("status canceled (isValidStatus false): dropdown tidak muncul", () => {
      const purchaseInvoice = basePurchaseInvoice({ status: "canceled" });
      render(
        <Show
          purchaseInvoice={purchaseInvoice}
          defaultData={{}}
          fixedAssets={[]}
        />,
      );

      expect(
        screen.queryByRole("button", { name: /core.form.actions/ }),
      ).not.toBeInTheDocument();
    });

    it("status valid tapi tidak masuk unpaid/partially_paid/returned DAN tidak ada unreturned_quantity: dropdown tidak muncul", () => {
      const purchaseInvoice = basePurchaseInvoice({
        status: "paid",
        is_return: false,
        items: [{ id: 1, unreturned_quantity: 0 }],
      });
      render(
        <Show
          purchaseInvoice={purchaseInvoice}
          defaultData={{}}
          fixedAssets={[]}
        />,
      );

      expect(
        screen.queryByRole("button", { name: /core.form.actions/ }),
      ).not.toBeInTheDocument();
    });

    it("status 'unpaid': dropdown muncul (masuk daftar status pembayaran)", () => {
      const purchaseInvoice = basePurchaseInvoice({ status: "unpaid" });
      render(
        <Show
          purchaseInvoice={purchaseInvoice}
          defaultData={{}}
          fixedAssets={[]}
        />,
      );

      expect(
        screen.getByRole("button", { name: /core.form.actions/ }),
      ).toBeInTheDocument();
    });

    it("status 'partially_paid': dropdown muncul", () => {
      const purchaseInvoice = basePurchaseInvoice({
        status: "partially_paid",
      });
      render(
        <Show
          purchaseInvoice={purchaseInvoice}
          defaultData={{}}
          fixedAssets={[]}
        />,
      );

      expect(
        screen.getByRole("button", { name: /core.form.actions/ }),
      ).toBeInTheDocument();
    });

    it("status 'returned': dropdown muncul", () => {
      const purchaseInvoice = basePurchaseInvoice({ status: "returned" });
      render(
        <Show
          purchaseInvoice={purchaseInvoice}
          defaultData={{}}
          fixedAssets={[]}
        />,
      );

      expect(
        screen.getByRole("button", { name: /core.form.actions/ }),
      ).toBeInTheDocument();
    });

    it("status valid di luar daftar pembayaran, tapi !is_return DAN ada unreturned_quantity > 0: dropdown tetap muncul", () => {
      const purchaseInvoice = basePurchaseInvoice({
        status: "paid",
        is_return: false,
        items: [{ id: 1, unreturned_quantity: 3 }],
      });
      render(
        <Show
          purchaseInvoice={purchaseInvoice}
          defaultData={{}}
          fixedAssets={[]}
        />,
      );

      expect(
        screen.getByRole("button", { name: /core.form.actions/ }),
      ).toBeInTheDocument();
    });

    it("is_return true meski ada unreturned_quantity > 0 dan status di luar daftar pembayaran: dropdown tidak muncul", () => {
      const purchaseInvoice = basePurchaseInvoice({
        status: "paid",
        is_return: true,
        items: [{ id: 1, unreturned_quantity: 3 }],
      });
      render(
        <Show
          purchaseInvoice={purchaseInvoice}
          defaultData={{}}
          fixedAssets={[]}
        />,
      );

      expect(
        screen.queryByRole("button", { name: /core.form.actions/ }),
      ).not.toBeInTheDocument();
    });
  });

  // --- controls(): opsi dalam dropdown Actions ----------------------------
  describe("controls() -- opsi dalam dropdown Actions", () => {
    it("status 'unpaid' + tidak ada unreturned_quantity: hanya opsi 'Buat Payment Entry' yang muncul", async () => {
      const user = userEvent.setup({ delay: null });
      const purchaseInvoice = basePurchaseInvoice({
        id: 42,
        status: "unpaid",
        is_return: false,
        items: [{ id: 1, unreturned_quantity: 0 }],
      });
      render(
        <Show
          purchaseInvoice={purchaseInvoice}
          defaultData={{}}
          fixedAssets={[]}
        />,
      );

      await user.click(
        screen.getByRole("button", { name: /core.form.actions/ }),
      );

      const paymentLink = await screen.findByText(
        "finances.purchaseInvoice.actions.create_payment_entry",
      );
      expect(paymentLink.closest("a")).toHaveAttribute(
        "href",
        `paymentEntries.create/${JSON.stringify({ ref: "purchaseInvoice/42" })}`,
      );
      expect(
        screen.queryByText(
          "finances.purchaseInvoice.actions.create_debit_note",
        ),
      ).not.toBeInTheDocument();
    });

    it("status 'paid' (di luar daftar pembayaran) + unreturned_quantity > 0: hanya opsi 'Buat Debit Note' yang muncul", async () => {
      const user = userEvent.setup({ delay: null });
      const purchaseInvoice = basePurchaseInvoice({
        id: 55,
        status: "paid",
        is_return: false,
        items: [{ id: 1, unreturned_quantity: 4 }],
      });
      render(
        <Show
          purchaseInvoice={purchaseInvoice}
          defaultData={{}}
          fixedAssets={[]}
        />,
      );

      await user.click(
        screen.getByRole("button", { name: /core.form.actions/ }),
      );

      const debitNoteLink = await screen.findByText(
        "finances.purchaseInvoice.actions.create_debit_note",
      );
      expect(debitNoteLink.closest("a")).toHaveAttribute(
        "href",
        `purchaseInvoices.create/${JSON.stringify({ ref: "purchaseInvoice/55" })}`,
      );
      expect(
        screen.queryByText(
          "finances.purchaseInvoice.actions.create_payment_entry",
        ),
      ).not.toBeInTheDocument();
    });

    it("status 'unpaid' + unreturned_quantity > 0 + !is_return: KEDUA opsi muncul sekaligus", async () => {
      const user = userEvent.setup({ delay: null });
      const purchaseInvoice = basePurchaseInvoice({
        id: 9,
        status: "unpaid",
        is_return: false,
        items: [{ id: 1, unreturned_quantity: 2 }],
      });
      render(
        <Show
          purchaseInvoice={purchaseInvoice}
          defaultData={{}}
          fixedAssets={[]}
        />,
      );

      await user.click(
        screen.getByRole("button", { name: /core.form.actions/ }),
      );

      expect(
        await screen.findByText(
          "finances.purchaseInvoice.actions.create_payment_entry",
        ),
      ).toBeInTheDocument();
      expect(
        screen.getByText(
          "finances.purchaseInvoice.actions.create_debit_note",
        ),
      ).toBeInTheDocument();
    });

    it("calculateArray menjumlahkan unreturned_quantity di semua item (bukan hanya item pertama)", async () => {
      const user = userEvent.setup({ delay: null });
      const purchaseInvoice = basePurchaseInvoice({
        id: 3,
        status: "paid",
        is_return: false,
        items: [
          { id: 1, unreturned_quantity: 0 },
          { id: 2, unreturned_quantity: 0 },
          { id: 3, unreturned_quantity: 1 },
        ],
      });
      render(
        <Show
          purchaseInvoice={purchaseInvoice}
          defaultData={{}}
          fixedAssets={[]}
        />,
      );

      await user.click(
        screen.getByRole("button", { name: /core.form.actions/ }),
      );

      expect(
        await screen.findByText(
          "finances.purchaseInvoice.actions.create_debit_note",
        ),
      ).toBeInTheDocument();
    });

    it("items kosong: opsi 'Buat Debit Note' tidak muncul (calculateArray menghasilkan 0)", async () => {
      const user = userEvent.setup({ delay: null });
      const purchaseInvoice = basePurchaseInvoice({
        id: 4,
        status: "unpaid",
        is_return: false,
        items: [],
      });
      render(
        <Show
          purchaseInvoice={purchaseInvoice}
          defaultData={{}}
          fixedAssets={[]}
        />,
      );

      await user.click(
        screen.getByRole("button", { name: /core.form.actions/ }),
      );

      expect(
        await screen.findByText(
          "finances.purchaseInvoice.actions.create_payment_entry",
        ),
      ).toBeInTheDocument();
      expect(
        screen.queryByText(
          "finances.purchaseInvoice.actions.create_debit_note",
        ),
      ).not.toBeInTheDocument();
    });
  });
});
