import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

// ============================================================================
// Show.jsx (295 baris) adalah halaman detail Purchase Order. Ia MENG-COMPOSE
// <FormPage><Form/></FormPage> (FormPage sudah py test sendiri di
// FormPage.rtl.test.jsx, Form.jsx PurchaseOrders sudah py test sendiri di
// Form.rtl.test.jsx) PLUS logic UI unik miliknya sendiri:
// - Sub-komponen display: QtyBadge (delta over/under/match/null),
//   ItemsQtyTable (delta receive/bill per item, dari received_quantity dan
//   billed_quantity -- BUKAN delivered_quantity seperti SalesOrders).
// - controls(): tombol Sync Items (hanya muncul kalau ada mismatch qty
//   receive/bill), tombol Mark Done (SELALU muncul, tidak kondisional
//   status seperti SalesOrders), dropdown actions (create Purchase Receipt
//   / Purchase Invoice) -- SEMUA hanya muncul kalau
//   purchaseOrder.submitted_at ada, dropdown TIDAK kondisional status (beda
//   dari SalesOrders yang kondisional to_bill/to_deliver).
// - Dialog konfirmasi Sync Items (router.post ke purchaseOrders.syncItems)
//   dan Mark Done (router.post ke purchaseOrders.markDone, menampilkan
//   mismatchErrors dari onError, key received_qty/billed_qty).
//
// PENTING beda dari SalesOrders/Show.jsx (versi lama yang jadi acuan pola):
// - Tidak ada prop `flash` / banner error sama sekali di komponen ini.
// - Tidak ada RentalStatusBadge/RentalDurationTable (bukan fitur PO).
// - Dropdown actions SELALU muncul saat submitted_at ada (tidak bergantung
//   status), dengan 2 opsi tetap: create_purchase_receipt &
//   create_purchase_invoice.
// - Tombol Mark Done tidak bergantung pada status tertentu, selalu ada saat
//   submitted_at ada.
//
// FormPage & Form DISTUB sebagai black-box -- test ini TIDAK meretest logic
// internal keduanya, hanya memverifikasi Show.jsx merender & menyambungkan
// props dengan benar, dan bahwa logic UNIK (badge/table/dialog/dropdown) di
// Show.jsx sendiri berperilaku benar.
// ============================================================================

const stableT = (key) => key;
vi.mock("laravel-react-i18n", () => ({
  useLaravelReactI18n: () => ({ t: stableT }),
}));

window.route = (name, params) =>
  params !== undefined ? `${name}/${JSON.stringify(params)}` : name;

const routerPost = vi.fn();
vi.mock("@inertiajs/react", () => ({
  router: {
    post: (...a) => routerPost(...a),
  },
}));

// --- @/Pages/Core/FormPage ---------------------------------------------------
// FormPage asli (675+ baris) sudah py test sendiri (FormPage.rtl.test.jsx).
// Show.jsx MENG-COMPOSE <FormPage> LANGSUNG sebagai komponen (bukan cuma
// useFormPage hook seperti Form.jsx biasa) -- distub jadi wrapper sederhana
// yang merender controls()/children apa adanya, plus mengekspos props
// penting (isCreate/disabled) lewat data-testid supaya bisa diverifikasi
// tanpa merender FormPage asli yang berat (AppLayout, useForm, dsb).
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

// --- ./Form -------------------------------------------------------------
// Form.jsx PurchaseOrders (749 baris) sudah py test sendiri
// (Form.rtl.test.jsx) -- distub sebagai black-box testid, tidak diretest
// di sini.
vi.mock("./Form", () => ({
  default: () => <div data-testid="stub-form" />,
}));

// --- @/Components/Link ----------------------------------------------------
// Link.jsx (dipakai dropdown "Buat Purchase Receipt"/"Buat Purchase
// Invoice") memakai router/shouldIntercept dari @inertiajs/core plus
// useIsDirtyForm/useAlertDraftForm -- di luar scope test Show.jsx (Link
// sendiri komponen generik). Distub jadi <a> sederhana yang menangkap href
// supaya assertion cukup memverifikasi Show.jsx meneruskan route() yang
// benar, tanpa menyeret seluruh chain useIsDirtyForm/@inertiajs/core.
vi.mock("@/Components/Link", () => ({
  default: ({ href, children }) => <a href={href}>{children}</a>,
}));

import Show from "./Show";

function basePurchaseOrder(overrides = {}) {
  return {
    id: 7,
    submitted_at: "2026-08-01T00:00:00Z",
    items: [],
    ...overrides,
  };
}

describe("Show (PurchaseOrders)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // --- Compose FormPage/Form dasar ----------------------------------------
  describe("compose FormPage + Form", () => {
    it("mode create (purchaseOrder null): isCreate=true diteruskan ke FormPage, tidak ada controls", () => {
      render(<Show purchaseOrder={null} defaultData={{}} />);

      expect(screen.getByTestId("form-page-meta")).toHaveTextContent(
        JSON.stringify({ isCreate: true, disabled: false }),
      );
      expect(screen.getByTestId("stub-form")).toBeInTheDocument();
      // controls() mengembalikan undefined ketika !purchaseOrder?.submitted_at
      expect(
        screen.queryByRole("button", { name: "Mark Done" }),
      ).not.toBeInTheDocument();
    });

    it("mode edit belum submit: isCreate=false, disabled=false (submitted_at kosong), tidak ada controls", () => {
      const purchaseOrder = { id: 1, submitted_at: null, items: [] };
      render(<Show purchaseOrder={purchaseOrder} defaultData={{}} />);

      expect(screen.getByTestId("form-page-meta")).toHaveTextContent(
        JSON.stringify({ isCreate: false, disabled: false }),
      );
      expect(
        screen.queryByRole("button", { name: "Mark Done" }),
      ).not.toBeInTheDocument();
    });

    it("submitted_at ada: disabled=true diteruskan ke FormPage", () => {
      const purchaseOrder = basePurchaseOrder();
      render(<Show purchaseOrder={purchaseOrder} defaultData={{}} />);

      expect(screen.getByTestId("form-page-meta")).toHaveTextContent(
        JSON.stringify({ isCreate: false, disabled: true }),
      );
    });
  });

  // --- QtyBadge (lewat ItemsQtyTable) -------------------------------------
  describe("QtyBadge (via ItemsQtyTable, delta receive/bill)", () => {
    it("delta > 0 menampilkan '+N Over'", () => {
      const purchaseOrder = basePurchaseOrder({
        items: [
          {
            id: 1,
            item_name: "Barang A",
            quantity: 10,
            received_quantity: 15,
            billed_quantity: 10,
          },
        ],
      });
      render(<Show purchaseOrder={purchaseOrder} defaultData={{}} />);

      expect(screen.getByText("+5 Over")).toBeInTheDocument();
    });

    it("delta < 0 menampilkan 'N Under'", () => {
      const purchaseOrder = basePurchaseOrder({
        items: [
          {
            id: 1,
            item_name: "Barang B",
            quantity: 10,
            received_quantity: 4,
            billed_quantity: 10,
          },
        ],
      });
      render(<Show purchaseOrder={purchaseOrder} defaultData={{}} />);

      expect(screen.getByText("-6 Under")).toBeInTheDocument();
    });

    it("delta === 0 menampilkan 'Match'", () => {
      const purchaseOrder = basePurchaseOrder({
        items: [
          {
            id: 1,
            item_name: "Barang C",
            quantity: 10,
            received_quantity: 10,
            billed_quantity: 10,
          },
        ],
      });
      render(<Show purchaseOrder={purchaseOrder} defaultData={{}} />);

      // Dua kolom (receive & bill) sama-sama Match untuk item ini.
      expect(screen.getAllByText("Match")).toHaveLength(2);
    });

    it("received_quantity/billed_quantity null diperlakukan sebagai 0 (bukan crash / render null)", () => {
      const purchaseOrder = basePurchaseOrder({
        items: [
          {
            id: 1,
            item_name: "Barang D",
            quantity: 3,
            received_quantity: null,
            billed_quantity: null,
          },
        ],
      });
      render(<Show purchaseOrder={purchaseOrder} defaultData={{}} />);

      // delta = 0 - 3 = -3 -> Under, bukan null/undefined (jadi tetap render badge)
      expect(screen.getAllByText("-3 Under")).toHaveLength(2);
    });

    it("fallback nama item ke item.item?.name kalau item_name tidak ada", () => {
      const purchaseOrder = basePurchaseOrder({
        items: [
          {
            id: 1,
            item: { name: "Nama Dari Relasi" },
            quantity: 5,
            received_quantity: 5,
            billed_quantity: 5,
          },
        ],
      });
      render(<Show purchaseOrder={purchaseOrder} defaultData={{}} />);

      expect(screen.getByText("Nama Dari Relasi")).toBeInTheDocument();
    });

    it("items kosong/null: ItemsQtyTable tidak merender apa pun", () => {
      const purchaseOrder = basePurchaseOrder({ items: [] });
      render(<Show purchaseOrder={purchaseOrder} defaultData={{}} />);

      expect(screen.queryByText("Item")).not.toBeInTheDocument();
      expect(screen.queryByText("Qty PO")).not.toBeInTheDocument();
    });

    it("tidak submitted_at: ItemsQtyTable tidak dirender sama sekali", () => {
      const purchaseOrder = {
        id: 1,
        submitted_at: null,
        items: [
          { id: 1, item_name: "Barang E", quantity: 1, received_quantity: 5 },
        ],
      };
      render(<Show purchaseOrder={purchaseOrder} defaultData={{}} />);

      expect(screen.queryByText("Barang E")).not.toBeInTheDocument();
      expect(screen.queryByText("Qty PO")).not.toBeInTheDocument();
    });
  });

  // --- controls(): tombol Sync Items / Mark Done / dropdown actions -------
  describe("controls() -- tombol aksi header", () => {
    it("submitted_at tapi tidak ada mismatch: tombol Sync Items tidak muncul, Mark Done muncul", () => {
      const purchaseOrder = basePurchaseOrder({
        items: [
          {
            id: 1,
            quantity: 5,
            received_quantity: 5,
            billed_quantity: 5,
          },
        ],
      });
      render(<Show purchaseOrder={purchaseOrder} defaultData={{}} />);

      expect(
        screen.queryByRole("button", { name: "Sync Items" }),
      ).not.toBeInTheDocument();
      expect(
        screen.getByRole("button", { name: "Mark Done" }),
      ).toBeInTheDocument();
    });

    it("ada mismatch qty receive (delta != 0): tombol Sync Items muncul", () => {
      const purchaseOrder = basePurchaseOrder({
        items: [
          {
            id: 1,
            quantity: 5,
            received_quantity: 8,
            billed_quantity: 5,
          },
        ],
      });
      render(<Show purchaseOrder={purchaseOrder} defaultData={{}} />);

      expect(
        screen.getByRole("button", { name: "Sync Items" }),
      ).toBeInTheDocument();
    });

    it("ada mismatch qty bill (delta != 0, receive match): tombol Sync Items tetap muncul", () => {
      const purchaseOrder = basePurchaseOrder({
        items: [
          {
            id: 1,
            quantity: 5,
            received_quantity: 5,
            billed_quantity: 2,
          },
        ],
      });
      render(<Show purchaseOrder={purchaseOrder} defaultData={{}} />);

      expect(
        screen.getByRole("button", { name: "Sync Items" }),
      ).toBeInTheDocument();
    });

    it("dropdown Actions muncul dengan 2 opsi tetap (create Purchase Receipt & Purchase Invoice) mengarah ke route + ref, tidak bergantung status", async () => {
      const user = userEvent.setup({ delay: null });
      const purchaseOrder = basePurchaseOrder({ id: 42 });
      render(<Show purchaseOrder={purchaseOrder} defaultData={{}} />);

      await user.click(
        screen.getByRole("button", { name: /core.form.actions/ }),
      );

      const receiptLink = await screen.findByText(
        "purchase.purchaseOrder.actions.create_purchase_receipt",
      );
      expect(receiptLink.closest("a")).toHaveAttribute(
        "href",
        `purchaseReceipts.create/${JSON.stringify({ ref: "purchaseOrder/42" })}`,
      );

      const invoiceLink = screen.getByText(
        "purchase.purchaseOrder.actions.create_purchase_invoice",
      );
      expect(invoiceLink.closest("a")).toHaveAttribute(
        "href",
        `purchaseInvoices.create/${JSON.stringify({ ref: "purchaseOrder/42" })}`,
      );
    });

    it("tidak submitted_at: dropdown Actions & Mark Done tidak muncul sama sekali", () => {
      const purchaseOrder = { id: 1, submitted_at: null, items: [] };
      render(<Show purchaseOrder={purchaseOrder} defaultData={{}} />);

      expect(
        screen.queryByRole("button", { name: /core.form.actions/ }),
      ).not.toBeInTheDocument();
      expect(
        screen.queryByRole("button", { name: "Mark Done" }),
      ).not.toBeInTheDocument();
    });
  });

  // --- Dialog Sync Items ----------------------------------------------------
  describe("dialog konfirmasi Sync Items", () => {
    function mismatchPurchaseOrder(overrides = {}) {
      return basePurchaseOrder({
        items: [
          {
            id: 1,
            item_name: "Barang Mismatch",
            quantity: 5,
            received_quantity: 8,
            billed_quantity: 5,
          },
        ],
        ...overrides,
      });
    }

    it("klik tombol Sync Items membuka dialog konfirmasi berisi ItemsQtyTable", async () => {
      const user = userEvent.setup({ delay: null });
      render(
        <Show purchaseOrder={mismatchPurchaseOrder()} defaultData={{}} />,
      );

      await user.click(screen.getByRole("button", { name: "Sync Items" }));

      expect(screen.getByRole("dialog")).toBeInTheDocument();
      // "Sync Items" muncul 2x (tombol header, tombol konfirmasi) -- judul
      // dialog spesifik lewat role heading.
      expect(
        screen.getByRole("heading", { name: "Sync Items" }),
      ).toBeInTheDocument();
      // ItemsQtyTable direplikasi di dalam dialog -- nama item juga muncul di sana
      expect(screen.getAllByText("Barang Mismatch").length).toBeGreaterThan(
        0,
      );
    });

    it("tombol Batal menutup dialog tanpa memanggil router.post", async () => {
      const user = userEvent.setup({ delay: null });
      render(
        <Show purchaseOrder={mismatchPurchaseOrder()} defaultData={{}} />,
      );

      await user.click(screen.getByRole("button", { name: "Sync Items" }));
      await user.click(screen.getByRole("button", { name: "Batal" }));

      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
      expect(routerPost).not.toHaveBeenCalled();
    });

    it("konfirmasi Sync Items memanggil router.post ke route purchaseOrders.syncItems dengan id, lalu menutup dialog onFinish", async () => {
      routerPost.mockImplementation((url, data, options) => {
        options?.onFinish?.();
      });
      const user = userEvent.setup({ delay: null });
      const purchaseOrder = mismatchPurchaseOrder({ id: 77 });
      render(<Show purchaseOrder={purchaseOrder} defaultData={{}} />);

      await user.click(screen.getByRole("button", { name: "Sync Items" }));
      // Ada 2 tombol "Sync Items" saat dialog terbuka (header controls +
      // tombol konfirmasi footer) -- ambil tombol di dalam dialog.
      const dialog = screen.getByRole("dialog");
      await user.click(
        within(dialog).getByRole("button", { name: "Sync Items" }),
      );

      expect(routerPost).toHaveBeenCalledTimes(1);
      const [url, payload, options] = routerPost.mock.calls[0];
      expect(url).toBe(`purchaseOrders.syncItems/${JSON.stringify(77)}`);
      expect(payload).toEqual({});
      expect(typeof options.onFinish).toBe("function");

      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    });

    it("loading: tombol Batal & konfirmasi disabled dan label berubah jadi 'Memproses...'", async () => {
      routerPost.mockImplementation(() => {
        // Sengaja tidak memanggil onFinish supaya state loading bisa diamati.
      });
      const user = userEvent.setup({ delay: null });
      render(
        <Show purchaseOrder={mismatchPurchaseOrder()} defaultData={{}} />,
      );

      await user.click(screen.getByRole("button", { name: "Sync Items" }));
      const dialog = screen.getByRole("dialog");
      await user.click(
        within(dialog).getByRole("button", { name: "Sync Items" }),
      );

      expect(
        within(dialog).getByRole("button", { name: "Memproses..." }),
      ).toBeDisabled();
      expect(
        within(dialog).getByRole("button", { name: "Batal" }),
      ).toBeDisabled();
    });
  });

  // --- Dialog Mark Done -------------------------------------------------
  describe("dialog konfirmasi Mark Done", () => {
    it("klik tombol Mark Done membuka dialog", async () => {
      const user = userEvent.setup({ delay: null });
      const purchaseOrder = basePurchaseOrder();
      render(<Show purchaseOrder={purchaseOrder} defaultData={{}} />);

      await user.click(screen.getByRole("button", { name: "Mark Done" }));

      expect(screen.getByRole("dialog")).toBeInTheDocument();
      expect(
        screen.getByText(
          /Validasi bahwa qty receipt sama dengan qty invoice/,
        ),
      ).toBeInTheDocument();
    });

    it("konfirmasi sukses memanggil router.post ke purchaseOrders.markDone dan menutup dialog onSuccess", async () => {
      routerPost.mockImplementation((url, data, options) => {
        options?.onSuccess?.();
      });
      const user = userEvent.setup({ delay: null });
      const purchaseOrder = basePurchaseOrder({ id: 12 });
      render(<Show purchaseOrder={purchaseOrder} defaultData={{}} />);

      await user.click(screen.getByRole("button", { name: "Mark Done" }));
      const dialog = screen.getByRole("dialog");
      await user.click(
        within(dialog).getByRole("button", { name: "Mark Done" }),
      );

      expect(routerPost).toHaveBeenCalledTimes(1);
      const [url, payload, options] = routerPost.mock.calls[0];
      expect(url).toBe(`purchaseOrders.markDone/${JSON.stringify(12)}`);
      expect(payload).toEqual({});
      expect(typeof options.onSuccess).toBe("function");
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    });

    it("onError dengan errors.mismatches (array) menampilkan daftar mismatch dan dialog tetap terbuka", async () => {
      routerPost.mockImplementation((url, data, options) => {
        options?.onError?.({
          mismatches: [
            { item_name: "Barang X", received_qty: 3, billed_qty: 5 },
          ],
        });
      });
      const user = userEvent.setup({ delay: null });
      const purchaseOrder = basePurchaseOrder({ id: 1 });
      render(<Show purchaseOrder={purchaseOrder} defaultData={{}} />);

      await user.click(screen.getByRole("button", { name: "Mark Done" }));
      const dialog = screen.getByRole("dialog");
      await user.click(
        within(dialog).getByRole("button", { name: "Mark Done" }),
      );

      expect(screen.getByText("Barang X")).toBeInTheDocument();
      expect(screen.getByText(/Received 3/)).toBeInTheDocument();
      expect(screen.getByText(/Billed 5/)).toBeInTheDocument();
      // Dialog tetap terbuka setelah error (tidak ada onClose di path onError)
      expect(screen.getByRole("dialog")).toBeInTheDocument();
    });

    it("onError dengan errors.mismatches berupa JSON string (bukan array) di-parse dengan benar", async () => {
      routerPost.mockImplementation((url, data, options) => {
        options?.onError?.({
          mismatches: JSON.stringify([
            { item_name: "Barang Y", received_qty: 1, billed_qty: 2 },
          ]),
        });
      });
      const user = userEvent.setup({ delay: null });
      const purchaseOrder = basePurchaseOrder({ id: 1 });
      render(<Show purchaseOrder={purchaseOrder} defaultData={{}} />);

      await user.click(screen.getByRole("button", { name: "Mark Done" }));
      const dialog = screen.getByRole("dialog");
      await user.click(
        within(dialog).getByRole("button", { name: "Mark Done" }),
      );

      expect(screen.getByText("Barang Y")).toBeInTheDocument();
    });

    it("tombol Batal menutup dialog Mark Done tanpa memanggil router.post", async () => {
      const user = userEvent.setup({ delay: null });
      const purchaseOrder = basePurchaseOrder();
      render(<Show purchaseOrder={purchaseOrder} defaultData={{}} />);

      await user.click(screen.getByRole("button", { name: "Mark Done" }));
      await user.click(screen.getByRole("button", { name: "Batal" }));

      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
      expect(routerPost).not.toHaveBeenCalled();
    });

    it("mismatchErrors direset ke [] saat submit ulang setelah error sebelumnya", async () => {
      let callCount = 0;
      routerPost.mockImplementation((url, data, options) => {
        callCount += 1;
        if (callCount === 1) {
          options?.onError?.({
            mismatches: [
              { item_name: "Barang Z", received_qty: 1, billed_qty: 9 },
            ],
          });
        } else {
          options?.onSuccess?.();
        }
      });
      const user = userEvent.setup({ delay: null });
      const purchaseOrder = basePurchaseOrder({ id: 1 });
      render(<Show purchaseOrder={purchaseOrder} defaultData={{}} />);

      await user.click(screen.getByRole("button", { name: "Mark Done" }));
      const dialog = screen.getByRole("dialog");
      await user.click(
        within(dialog).getByRole("button", { name: "Mark Done" }),
      );
      expect(screen.getByText("Barang Z")).toBeInTheDocument();

      // Submit kedua kali -- kali ini sukses, mismatchErrors sebelumnya
      // dibersihkan di awal handleMarkDone (setMismatchErrors([])).
      await user.click(
        within(dialog).getByRole("button", { name: "Mark Done" }),
      );

      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    });
  });
});
