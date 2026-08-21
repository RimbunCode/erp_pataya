import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

// ============================================================================
// Show.jsx (402 baris) adalah halaman detail Sales Order. Ia MENG-COMPOSE
// <FormPage><Form/></FormPage> (FormPage sudah py test sendiri di
// FormPage.rtl.test.jsx, Form.jsx SalesOrders sudah py test sendiri di
// Form.rtl.test.jsx) PLUS logic UI unik miliknya sendiri:
// - Sub-komponen display: QtyBadge (delta over/under/match/null),
//   RentalStatusBadge (mapping status -> label), RentalDurationTable
//   (kalkulasi totalDays dari sum segments.duration_days, skip item tanpa
//   duration/status), ItemsQtyTable (delta deliver/bill per item).
// - controls(): tombol Sync Items (hanya muncul kalau ada mismatch qty),
//   tombol Mark Done, dropdown actions (create Sales Invoice / Delivery
//   Note) kondisional berdasar status SO -- semuanya hanya muncul kalau
//   salesOrder.submitted_at ada.
// - Dialog konfirmasi Sync Items (memanggil router.post ke
//   salesOrders.syncItems) dan Mark Done (router.post ke
//   salesOrders.markDone, menampilkan mismatchErrors dari onError).
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
// FormPage asli (675 baris) sudah py test sendiri (FormPage.rtl.test.jsx).
// Show.jsx MENG-COMPOSE <FormPage> LANGSUNG sebagai komponen (bukan cuma
// useFormPage hook seperti Form.jsx biasa) -- distub jadi wrapper sederhana
// yang merender banner/controls()/children apa adanya, plus mengekspos
// props penting (isCreate/disabled) lewat data-testid supaya bisa
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
// Form.jsx SalesOrders (819 baris) sudah py test sendiri (Form.rtl.test.jsx)
// -- distub sebagai black-box testid, tidak diretest di sini.
vi.mock("./Form", () => ({
  default: () => <div data-testid="stub-form" />,
}));

// --- @/Components/Link ----------------------------------------------------
// Link.jsx (dipakai dropdown "Buat Sales Invoice"/"Buat Delivery Note")
// memakai router/shouldIntercept dari @inertiajs/core plus
// useIsDirtyForm/useAlertDraftForm -- di luar scope test Show.jsx (Link
// sendiri komponen generik). Distub jadi <a> sederhana yang menangkap href
// supaya assertion cukup memverifikasi Show.jsx meneruskan route() yang
// benar, tanpa menyeret seluruh chain useIsDirtyForm/@inertiajs/core.
vi.mock("@/Components/Link", () => ({
  default: ({ href, children }) => <a href={href}>{children}</a>,
}));

import Show from "./Show";

function baseSalesOrder(overrides = {}) {
  return {
    id: 7,
    status: "to_deliver",
    submitted_at: "2026-08-01T00:00:00Z",
    is_rent: false,
    items: [],
    ...overrides,
  };
}

describe("Show (SalesOrders)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // --- Compose FormPage/Form dasar ----------------------------------------
  describe("compose FormPage + Form", () => {
    it("mode create (salesOrder null): isCreate=true diteruskan ke FormPage, tidak ada controls", () => {
      render(<Show salesOrder={null} defaultData={{}} flash={{}} />);

      expect(screen.getByTestId("form-page-meta")).toHaveTextContent(
        JSON.stringify({ isCreate: true, disabled: false }),
      );
      expect(screen.getByTestId("stub-form")).toBeInTheDocument();
      // controls() mengembalikan undefined ketika !salesOrder?.submitted_at
      expect(
        screen.queryByRole("button", { name: "Mark Done" }),
      ).not.toBeInTheDocument();
    });

    it("mode edit belum submit: isCreate=false, disabled=false (submitted_at kosong), tidak ada controls", () => {
      const salesOrder = { id: 1, submitted_at: null, items: [] };
      render(<Show salesOrder={salesOrder} defaultData={{}} flash={{}} />);

      expect(screen.getByTestId("form-page-meta")).toHaveTextContent(
        JSON.stringify({ isCreate: false, disabled: false }),
      );
      expect(
        screen.queryByRole("button", { name: "Mark Done" }),
      ).not.toBeInTheDocument();
    });

    it("submitted_at ada: disabled=true diteruskan ke FormPage", () => {
      const salesOrder = baseSalesOrder({ status: "draft" });
      render(<Show salesOrder={salesOrder} defaultData={{}} flash={{}} />);

      expect(screen.getByTestId("form-page-meta")).toHaveTextContent(
        JSON.stringify({ isCreate: false, disabled: true }),
      );
    });

    it("flash.errorItems merender banner dengan daftar error", () => {
      render(
        <Show
          salesOrder={null}
          defaultData={{}}
          flash={{ errorItems: ["error.satu", "error.dua"] }}
        />,
      );

      const banner = screen.getByTestId("form-page-banner");
      expect(within(banner).getByText("core.form.errors.title")).toBeInTheDocument();
      expect(within(banner).getByText("error.satu")).toBeInTheDocument();
      expect(within(banner).getByText("error.dua")).toBeInTheDocument();
    });

    it("flash tanpa errorItems tidak merender banner error", () => {
      render(<Show salesOrder={null} defaultData={{}} flash={{}} />);

      expect(
        screen.queryByText("core.form.errors.title"),
      ).not.toBeInTheDocument();
    });
  });

  // --- QtyBadge (lewat ItemsQtyTable) -------------------------------------
  describe("QtyBadge (via ItemsQtyTable, delta deliver/bill)", () => {
    it("delta > 0 menampilkan '+N Over'", () => {
      const salesOrder = baseSalesOrder({
        items: [
          {
            id: 1,
            item_name: "Barang A",
            quantity: 10,
            delivered_quantity: 15,
            billed_quantity: 10,
          },
        ],
      });
      render(<Show salesOrder={salesOrder} defaultData={{}} flash={{}} />);

      expect(screen.getByText("+5 Over")).toBeInTheDocument();
    });

    it("delta < 0 menampilkan 'N Under'", () => {
      const salesOrder = baseSalesOrder({
        items: [
          {
            id: 1,
            item_name: "Barang B",
            quantity: 10,
            delivered_quantity: 4,
            billed_quantity: 10,
          },
        ],
      });
      render(<Show salesOrder={salesOrder} defaultData={{}} flash={{}} />);

      expect(screen.getByText("-6 Under")).toBeInTheDocument();
    });

    it("delta === 0 menampilkan 'Match'", () => {
      const salesOrder = baseSalesOrder({
        items: [
          {
            id: 1,
            item_name: "Barang C",
            quantity: 10,
            delivered_quantity: 10,
            billed_quantity: 10,
          },
        ],
      });
      render(<Show salesOrder={salesOrder} defaultData={{}} flash={{}} />);

      // Dua kolom (deliver & bill) sama-sama Match untuk item ini.
      expect(screen.getAllByText("Match")).toHaveLength(2);
    });

    it("delivered_quantity/billed_quantity null diperlakukan sebagai 0 (bukan crash / render null)", () => {
      const salesOrder = baseSalesOrder({
        items: [
          {
            id: 1,
            item_name: "Barang D",
            quantity: 3,
            delivered_quantity: null,
            billed_quantity: null,
          },
        ],
      });
      render(<Show salesOrder={salesOrder} defaultData={{}} flash={{}} />);

      // delta = 0 - 3 = -3 -> Under, bukan null/undefined (jadi tetap render badge)
      expect(screen.getAllByText("-3 Under")).toHaveLength(2);
    });

    it("tidak submitted_at: ItemsQtyTable tidak dirender sama sekali", () => {
      const salesOrder = {
        id: 1,
        submitted_at: null,
        items: [
          { id: 1, item_name: "Barang E", quantity: 1, delivered_quantity: 5 },
        ],
      };
      render(<Show salesOrder={salesOrder} defaultData={{}} flash={{}} />);

      expect(screen.queryByText("Barang E")).not.toBeInTheDocument();
      expect(screen.queryByText("Qty SO")).not.toBeInTheDocument();
    });
  });

  // --- RentalStatusBadge + RentalDurationTable ----------------------------
  describe("RentalDurationTable & RentalStatusBadge", () => {
    function rentSalesOrder({ items, rental_durations }) {
      return baseSalesOrder({
        is_rent: true,
        items,
        rental_durations,
      });
    }

    // salesOrder.submitted_at (di baseSalesOrder) juga membuat ItemsQtyTable
    // ikut dirender berdampingan dengan RentalDurationTable -- kalau item
    // yang sama muncul di keduanya (nama sama), query harus di-scope ke
    // tabel rental saja (dicari lewat header "Durasi (hari)") supaya tidak
    // "Found multiple elements".
    function getRentalTable() {
      return screen.getByText("Durasi (hari)").closest("table");
    }

    it("tidak is_rent: RentalDurationTable tidak dirender", () => {
      const salesOrder = baseSalesOrder({
        is_rent: false,
        items: [{ id: 1, item_name: "Unit Sewa" }],
        rental_durations: {
          1: { status: "running", segments: [{ duration_days: 3 }] },
        },
      });
      render(<Show salesOrder={salesOrder} defaultData={{}} flash={{}} />);

      expect(screen.queryByText("Durasi (hari)")).not.toBeInTheDocument();
    });

    it("items kosong: RentalDurationTable tidak merender apa pun", () => {
      const salesOrder = rentSalesOrder({ items: [], rental_durations: {} });
      render(<Show salesOrder={salesOrder} defaultData={{}} flash={{}} />);

      expect(screen.queryByText("Durasi (hari)")).not.toBeInTheDocument();
    });

    it("status running: menghitung totalDays dari sum segments.duration_days dan label 'Berjalan' warna biru", () => {
      const salesOrder = rentSalesOrder({
        items: [{ id: 1, item_name: "Unit Sewa A" }],
        rental_durations: {
          1: {
            status: "running",
            segments: [{ duration_days: 3 }, { duration_days: 4 }],
          },
        },
      });
      render(<Show salesOrder={salesOrder} defaultData={{}} flash={{}} />);

      const table = within(getRentalTable());
      expect(table.getByText("Unit Sewa A")).toBeInTheDocument();
      expect(table.getByText("7")).toBeInTheDocument();
      const badge = table.getByText("Berjalan");
      expect(badge).toBeInTheDocument();
      expect(badge).toHaveClass("text-blue-600");
    });

    it("status completed: label 'Selesai' warna hijau", () => {
      const salesOrder = rentSalesOrder({
        items: [{ id: 2, item_name: "Unit Sewa B" }],
        rental_durations: {
          2: { status: "completed", segments: [{ duration_days: 10 }] },
        },
      });
      render(<Show salesOrder={salesOrder} defaultData={{}} flash={{}} />);

      const badge = screen.getByText("Selesai");
      expect(badge).toHaveClass("text-green-600");
    });

    it("status partially_completed: label 'Sebagian Selesai' warna amber", () => {
      const salesOrder = rentSalesOrder({
        items: [{ id: 3, item_name: "Unit Sewa C" }],
        rental_durations: {
          3: {
            status: "partially_completed",
            segments: [{ duration_days: 2 }, { duration_days: 1 }],
          },
        },
      });
      render(<Show salesOrder={salesOrder} defaultData={{}} flash={{}} />);

      const badge = screen.getByText("Sebagian Selesai");
      expect(badge).toHaveClass("text-amber-600");
      expect(screen.getByText("3")).toBeInTheDocument();
    });

    it("status tidak dikenal: baris tetap tampil (totalDays) tapi RentalStatusBadge tidak merender label apa pun", () => {
      const salesOrder = rentSalesOrder({
        items: [{ id: 4, item_name: "Unit Sewa D" }],
        rental_durations: {
          4: { status: "unknown_status", segments: [{ duration_days: 5 }] },
        },
      });
      render(<Show salesOrder={salesOrder} defaultData={{}} flash={{}} />);

      const table = within(getRentalTable());
      expect(table.getByText("Unit Sewa D")).toBeInTheDocument();
      expect(table.getByText("5")).toBeInTheDocument();
      expect(table.queryByText("Berjalan")).not.toBeInTheDocument();
      expect(table.queryByText("Selesai")).not.toBeInTheDocument();
      expect(table.queryByText("Sebagian Selesai")).not.toBeInTheDocument();
    });

    it("item tanpa entry duration di rental_durations di-skip (baris tidak dirender)", () => {
      const salesOrder = rentSalesOrder({
        items: [
          { id: 5, item_name: "Unit Tanpa Durasi" },
          { id: 6, item_name: "Unit Dengan Durasi" },
        ],
        rental_durations: {
          6: { status: "running", segments: [{ duration_days: 1 }] },
        },
      });
      render(<Show salesOrder={salesOrder} defaultData={{}} flash={{}} />);

      const table = within(getRentalTable());
      expect(table.queryByText("Unit Tanpa Durasi")).not.toBeInTheDocument();
      expect(table.getByText("Unit Dengan Durasi")).toBeInTheDocument();
    });

    it("item dengan duration ada tapi tanpa status di-skip juga", () => {
      const salesOrder = rentSalesOrder({
        items: [{ id: 7, item_name: "Unit Status Kosong" }],
        rental_durations: {
          7: { segments: [{ duration_days: 2 }] },
        },
      });
      render(<Show salesOrder={salesOrder} defaultData={{}} flash={{}} />);

      const table = within(getRentalTable());
      expect(table.queryByText("Unit Status Kosong")).not.toBeInTheDocument();
    });

    it("fallback nama item ke item.item.name kalau item_name tidak ada", () => {
      const salesOrder = rentSalesOrder({
        items: [{ id: 8, item: { name: "Nama Dari Relasi" } }],
        rental_durations: {
          8: { status: "running", segments: [{ duration_days: 1 }] },
        },
      });
      render(<Show salesOrder={salesOrder} defaultData={{}} flash={{}} />);

      expect(
        within(getRentalTable()).getByText("Nama Dari Relasi"),
      ).toBeInTheDocument();
    });
  });

  // --- controls(): tombol Sync Items / Mark Done / dropdown actions -------
  describe("controls() -- tombol aksi header", () => {
    it("submitted_at tapi tidak ada mismatch: tombol Sync Items tidak muncul, Mark Done muncul", () => {
      const salesOrder = baseSalesOrder({
        status: "draft",
        items: [
          {
            id: 1,
            quantity: 5,
            delivered_quantity: 5,
            billed_quantity: 5,
          },
        ],
      });
      render(<Show salesOrder={salesOrder} defaultData={{}} flash={{}} />);

      expect(
        screen.queryByRole("button", { name: "Sync Items" }),
      ).not.toBeInTheDocument();
      expect(
        screen.getByRole("button", { name: "Mark Done" }),
      ).toBeInTheDocument();
    });

    it("ada mismatch qty (delta deliver/bill != 0): tombol Sync Items muncul", () => {
      const salesOrder = baseSalesOrder({
        status: "draft",
        items: [
          {
            id: 1,
            quantity: 5,
            delivered_quantity: 8,
            billed_quantity: 5,
          },
        ],
      });
      render(<Show salesOrder={salesOrder} defaultData={{}} flash={{}} />);

      expect(
        screen.getByRole("button", { name: "Sync Items" }),
      ).toBeInTheDocument();
    });

    it("status di luar daftar dropdown (mis. 'draft'): dropdown Actions tidak muncul", () => {
      const salesOrder = baseSalesOrder({ status: "draft" });
      render(<Show salesOrder={salesOrder} defaultData={{}} flash={{}} />);

      expect(
        screen.queryByRole("button", { name: /core.form.actions/ }),
      ).not.toBeInTheDocument();
    });

    it("status 'to_bill': dropdown Actions muncul dengan opsi 'Buat Sales Invoice' mengarah ke route salesInvoices.create + ref", async () => {
      const user = userEvent.setup({ delay: null });
      const salesOrder = baseSalesOrder({ id: 42, status: "to_bill" });
      render(<Show salesOrder={salesOrder} defaultData={{}} flash={{}} />);

      await user.click(
        screen.getByRole("button", { name: /core.form.actions/ }),
      );

      const link = await screen.findByText(
        "sales.salesOrder.actions.create_sales_invoice",
      );
      expect(link.closest("a")).toHaveAttribute(
        "href",
        `salesInvoices.create/${JSON.stringify({ ref: "salesOrder/42" })}`,
      );
      // Opsi delivery note tidak relevan untuk status to_bill
      expect(
        screen.queryByText("sales.salesOrder.actions.create_delivery_note"),
      ).not.toBeInTheDocument();
    });

    it("status 'to_deliver': dropdown Actions muncul dengan opsi 'Buat Delivery Note' mengarah ke route deliveryNotes.create + ref", async () => {
      const user = userEvent.setup({ delay: null });
      const salesOrder = baseSalesOrder({ id: 55, status: "to_deliver" });
      render(<Show salesOrder={salesOrder} defaultData={{}} flash={{}} />);

      await user.click(
        screen.getByRole("button", { name: /core.form.actions/ }),
      );

      const link = await screen.findByText(
        "sales.salesOrder.actions.create_delivery_note",
      );
      expect(link.closest("a")).toHaveAttribute(
        "href",
        `deliveryNotes.create/${JSON.stringify({ ref: "salesOrder/55" })}`,
      );
      expect(
        screen.queryByText("sales.salesOrder.actions.create_sales_invoice"),
      ).not.toBeInTheDocument();
    });

    it("status 'over_billed': kedua opsi dropdown muncul (billed masuk daftar bill, tidak masuk daftar deliver)", async () => {
      const user = userEvent.setup({ delay: null });
      const salesOrder = baseSalesOrder({ id: 9, status: "over_billed" });
      render(<Show salesOrder={salesOrder} defaultData={{}} flash={{}} />);

      await user.click(
        screen.getByRole("button", { name: /core.form.actions/ }),
      );

      expect(
        await screen.findByText(
          "sales.salesOrder.actions.create_sales_invoice",
        ),
      ).toBeInTheDocument();
      expect(
        screen.queryByText("sales.salesOrder.actions.create_delivery_note"),
      ).not.toBeInTheDocument();
    });
  });

  // --- Dialog Sync Items ----------------------------------------------------
  describe("dialog konfirmasi Sync Items", () => {
    function mismatchSalesOrder(overrides = {}) {
      return baseSalesOrder({
        status: "draft",
        items: [
          {
            id: 1,
            item_name: "Barang Mismatch",
            quantity: 5,
            delivered_quantity: 8,
            billed_quantity: 5,
          },
        ],
        ...overrides,
      });
    }

    it("klik tombol Sync Items membuka dialog konfirmasi berisi ItemsQtyTable", async () => {
      const user = userEvent.setup({ delay: null });
      render(
        <Show salesOrder={mismatchSalesOrder()} defaultData={{}} flash={{}} />,
      );

      await user.click(screen.getByRole("button", { name: "Sync Items" }));

      expect(screen.getByRole("dialog")).toBeInTheDocument();
      // "Sync Items" muncul 3x (tombol header, judul dialog, tombol konfirmasi)
      // -- verifikasi judul dialog spesifik lewat role heading.
      expect(
        screen.getByRole("heading", { name: "Sync Items" }),
      ).toBeInTheDocument();
      // ItemsQtyTable direplikasi di dalam dialog -- nama item juga muncul di sana
      expect(screen.getAllByText("Barang Mismatch").length).toBeGreaterThan(0);
    });

    it("tombol Batal menutup dialog tanpa memanggil router.post", async () => {
      const user = userEvent.setup({ delay: null });
      render(
        <Show salesOrder={mismatchSalesOrder()} defaultData={{}} flash={{}} />,
      );

      await user.click(screen.getByRole("button", { name: "Sync Items" }));
      await user.click(screen.getByRole("button", { name: "Batal" }));

      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
      expect(routerPost).not.toHaveBeenCalled();
    });

    it("konfirmasi Sync Items memanggil router.post ke route salesOrders.syncItems dengan id, lalu menutup dialog onFinish", async () => {
      routerPost.mockImplementation((url, data, options) => {
        options?.onFinish?.();
      });
      const user = userEvent.setup({ delay: null });
      const salesOrder = mismatchSalesOrder({ id: 77 });
      render(<Show salesOrder={salesOrder} defaultData={{}} flash={{}} />);

      await user.click(screen.getByRole("button", { name: "Sync Items" }));
      // Ada 2 tombol "Sync Items" saat dialog terbuka (header controls +
      // tombol konfirmasi footer) -- ambil tombol di dalam dialog.
      const dialog = screen.getByRole("dialog");
      await user.click(
        within(dialog).getByRole("button", { name: "Sync Items" }),
      );

      expect(routerPost).toHaveBeenCalledTimes(1);
      const [url, payload, options] = routerPost.mock.calls[0];
      expect(url).toBe(`salesOrders.syncItems/${JSON.stringify(77)}`);
      expect(payload).toEqual({});
      expect(typeof options.onFinish).toBe("function");

      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    });
  });

  // --- Dialog Mark Done -------------------------------------------------
  describe("dialog konfirmasi Mark Done", () => {
    it("klik tombol Mark Done membuka dialog", async () => {
      const user = userEvent.setup({ delay: null });
      const salesOrder = baseSalesOrder({ status: "draft" });
      render(<Show salesOrder={salesOrder} defaultData={{}} flash={{}} />);

      await user.click(screen.getByRole("button", { name: "Mark Done" }));

      expect(screen.getByRole("dialog")).toBeInTheDocument();
      expect(
        screen.getByText(/Validasi bahwa qty delivered/),
      ).toBeInTheDocument();
    });

    it("konfirmasi sukses memanggil router.post ke salesOrders.markDone dan menutup dialog onSuccess", async () => {
      routerPost.mockImplementation((url, data, options) => {
        options?.onSuccess?.();
      });
      const user = userEvent.setup({ delay: null });
      const salesOrder = baseSalesOrder({ id: 12, status: "draft" });
      render(<Show salesOrder={salesOrder} defaultData={{}} flash={{}} />);

      await user.click(screen.getByRole("button", { name: "Mark Done" }));
      const dialog = screen.getByRole("dialog");
      await user.click(
        within(dialog).getByRole("button", { name: "Mark Done" }),
      );

      expect(routerPost).toHaveBeenCalledTimes(1);
      expect(routerPost.mock.calls[0][0]).toBe(
        `salesOrders.markDone/${JSON.stringify(12)}`,
      );
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    });

    it("onError dengan errors.mismatches (array) menampilkan daftar mismatch dan dialog tetap terbuka", async () => {
      routerPost.mockImplementation((url, data, options) => {
        options?.onError?.({
          mismatches: [
            { item_name: "Barang X", delivered_qty: 3, billed_qty: 5 },
          ],
        });
      });
      const user = userEvent.setup({ delay: null });
      const salesOrder = baseSalesOrder({ id: 1, status: "draft" });
      render(<Show salesOrder={salesOrder} defaultData={{}} flash={{}} />);

      await user.click(screen.getByRole("button", { name: "Mark Done" }));
      const dialog = screen.getByRole("dialog");
      await user.click(
        within(dialog).getByRole("button", { name: "Mark Done" }),
      );

      expect(screen.getByText("Barang X")).toBeInTheDocument();
      expect(screen.getByText(/Delivered 3/)).toBeInTheDocument();
      expect(screen.getByText(/Billed 5/)).toBeInTheDocument();
      // Dialog tetap terbuka setelah error (tidak ada onClose di path onError)
      expect(screen.getByRole("dialog")).toBeInTheDocument();
    });

    it("onError dengan errors.mismatches berupa JSON string (bukan array) di-parse dengan benar", async () => {
      routerPost.mockImplementation((url, data, options) => {
        options?.onError?.({
          mismatches: JSON.stringify([
            { item_name: "Barang Y", delivered_qty: 1, billed_qty: 2 },
          ]),
        });
      });
      const user = userEvent.setup({ delay: null });
      const salesOrder = baseSalesOrder({ id: 1, status: "draft" });
      render(<Show salesOrder={salesOrder} defaultData={{}} flash={{}} />);

      await user.click(screen.getByRole("button", { name: "Mark Done" }));
      const dialog = screen.getByRole("dialog");
      await user.click(
        within(dialog).getByRole("button", { name: "Mark Done" }),
      );

      expect(screen.getByText("Barang Y")).toBeInTheDocument();
    });

    it("tombol Batal menutup dialog Mark Done tanpa memanggil router.post", async () => {
      const user = userEvent.setup({ delay: null });
      const salesOrder = baseSalesOrder({ status: "draft" });
      render(<Show salesOrder={salesOrder} defaultData={{}} flash={{}} />);

      await user.click(screen.getByRole("button", { name: "Mark Done" }));
      await user.click(screen.getByRole("button", { name: "Batal" }));

      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
      expect(routerPost).not.toHaveBeenCalled();
    });
  });
});
