import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

// ============================================================================
// Show.jsx (100 baris) adalah halaman detail Sales Invoice. Jauh lebih
// sederhana dibanding Show.jsx PurchaseOrders/SalesOrders (295/402 baris) --
// ia MENG-COMPOSE <FormPage><Form/></FormPage> (FormPage sudah py test
// sendiri di FormPage.rtl.test.jsx, Form.jsx SalesInvoice sudah py test
// sendiri di Form.rtl.test.jsx) PLUS logic UI unik miliknya sendiri:
// - Tidak ada QtyBadge/ItemsQtyTable/RentalDurationTable, tidak ada dialog
//   konfirmasi (Sync Items/Mark Done), tidak ada router.post, tidak ada
//   prop `flash`/banner error. Show.jsx SalesInvoice HANYA berisi satu
//   dropdown "Actions" dengan 2 opsi Link statis (Create Payment Entry,
//   Create Credit Note) yang gating-nya murni kondisional.
// - controls(): dropdown Actions HANYA muncul kalau salesInvoice.submitted_at
//   ada, DAN isValidStatus(status) true (yaitu status BUKAN salah satu dari
//   draft/canceled/rejected/deleted/closed/need_approval/inactive), DAN
//   (opsi Payment Entry ATAU opsi Credit Note bisa ditampilkan):
//   - Opsi "Create Payment Entry": muncul kalau status masuk
//     [unpaid, partially_paid, returned].
//   - Opsi "Create Credit Note": muncul kalau !is_return DAN
//     calculateArray(items, "unreturned_quantity", "+") > 0.
// - disabled={salesInvoice?.submitted_at} diteruskan ke FormPage (nilai raw
//   string tanggal, bukan boolean eksplisit -- FormPage asli menerima truthy
//   value apa adanya).
//
// FormPage & Form DISTUB sebagai black-box -- test ini TIDAK meretest logic
// internal keduanya, hanya memverifikasi Show.jsx merender & menyambungkan
// props dengan benar, dan bahwa logic UNIK (gating dropdown & opsi di
// dalamnya) di Show.jsx sendiri berperilaku benar.
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
// props penting (isCreate/disabled) lewat data-testid supaya bisa
// diverifikasi tanpa merender FormPage asli yang berat (AppLayout, useForm,
// dsb).
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
// Form.jsx SalesInvoice sudah py test sendiri (Form.rtl.test.jsx) -- distub
// sebagai black-box testid, tidak diretest di sini.
vi.mock("./Form", () => ({
  default: () => <div data-testid="stub-form" />,
}));

// --- @/Components/Link ----------------------------------------------------
// Link.jsx (dipakai dropdown "Buat Payment Entry"/"Buat Credit Note")
// memakai router/shouldIntercept dari @inertiajs/core plus
// useIsDirtyForm/useAlertDraftForm -- di luar scope test Show.jsx (Link
// sendiri komponen generik). Distub jadi <a> sederhana yang menangkap href
// supaya assertion cukup memverifikasi Show.jsx meneruskan route() yang
// benar, tanpa menyeret seluruh chain useIsDirtyForm/@inertiajs/core.
vi.mock("@/Components/Link", () => ({
  default: ({ href, children }) => <a href={href}>{children}</a>,
}));

import Show from "./Show";

function baseSalesInvoice(overrides = {}) {
  return {
    id: 7,
    status: "unpaid",
    submitted_at: "2026-08-01T00:00:00Z",
    is_return: false,
    items: [],
    ...overrides,
  };
}

describe("Show (SalesInvoice)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // --- Compose FormPage + Form dasar ----------------------------------------
  describe("compose FormPage + Form", () => {
    it("mode create (salesInvoice null): isCreate=true diteruskan ke FormPage, tidak ada controls", () => {
      render(<Show salesInvoice={null} defaultData={{}} />);

      expect(screen.getByTestId("form-page-meta")).toHaveTextContent(
        JSON.stringify({ isCreate: true, disabled: false }),
      );
      expect(screen.getByTestId("stub-form")).toBeInTheDocument();
      expect(
        screen.queryByRole("button", { name: /core.form.actions/ }),
      ).not.toBeInTheDocument();
    });

    it("mode edit belum submit: isCreate=false, disabled=false (submitted_at kosong), tidak ada controls", () => {
      const salesInvoice = {
        id: 1,
        status: "unpaid",
        submitted_at: null,
        is_return: false,
        items: [],
      };
      render(<Show salesInvoice={salesInvoice} defaultData={{}} />);

      expect(screen.getByTestId("form-page-meta")).toHaveTextContent(
        JSON.stringify({ isCreate: false, disabled: false }),
      );
      expect(
        screen.queryByRole("button", { name: /core.form.actions/ }),
      ).not.toBeInTheDocument();
    });

    it("submitted_at ada: disabled=true diteruskan ke FormPage", () => {
      const salesInvoice = baseSalesInvoice({ status: "draft" });
      render(<Show salesInvoice={salesInvoice} defaultData={{}} />);

      expect(screen.getByTestId("form-page-meta")).toHaveTextContent(
        JSON.stringify({ isCreate: false, disabled: true }),
      );
    });

    it("meneruskan defaultData ke FormPage tanpa crash (props lain seperti ignoreDraft/name/submitable tidak diekspos stub, cukup verifikasi render tetap normal)", () => {
      render(<Show salesInvoice={null} defaultData={{ foo: "bar" }} />);
      expect(screen.getByTestId("stub-form")).toBeInTheDocument();
    });
  });

  // --- controls(): gating utama dropdown Actions -----------------------------
  describe("controls() -- gating dropdown Actions", () => {
    it("tidak submitted_at: dropdown Actions tidak muncul sama sekali", () => {
      const salesInvoice = {
        id: 1,
        status: "unpaid",
        submitted_at: null,
        is_return: false,
        items: [],
      };
      render(<Show salesInvoice={salesInvoice} defaultData={{}} />);

      expect(
        screen.queryByRole("button", { name: /core.form.actions/ }),
      ).not.toBeInTheDocument();
    });

    it.each([
      "draft",
      "canceled",
      "rejected",
      "deleted",
      "closed",
      "need_approval",
      "inactive",
    ])(
      "status tidak valid (isValidStatus false) '%s': dropdown Actions tidak muncul",
      (status) => {
        const salesInvoice = baseSalesInvoice({ status });
        render(<Show salesInvoice={salesInvoice} defaultData={{}} />);

        expect(
          screen.queryByRole("button", { name: /core.form.actions/ }),
        ).not.toBeInTheDocument();
      },
    );

    it("submitted_at ada, status valid tapi bukan status payment (is_return=true): dropdown Actions tidak muncul karena kedua opsi false", () => {
      const salesInvoice = baseSalesInvoice({
        status: "paid",
        is_return: true,
        items: [{ id: 1, unreturned_quantity: 5 }],
      });
      render(<Show salesInvoice={salesInvoice} defaultData={{}} />);

      expect(
        screen.queryByRole("button", { name: /core.form.actions/ }),
      ).not.toBeInTheDocument();
    });

    it("submitted_at ada, status valid, is_return=false, items kosong (calculateArray=0): dropdown Actions tidak muncul karena kedua opsi false", () => {
      const salesInvoice = baseSalesInvoice({
        status: "paid",
        is_return: false,
        items: [],
      });
      render(<Show salesInvoice={salesInvoice} defaultData={{}} />);

      expect(
        screen.queryByRole("button", { name: /core.form.actions/ }),
      ).not.toBeInTheDocument();
    });
  });

  // --- Opsi "Create Payment Entry" -------------------------------------------
  describe("dropdown Actions -- opsi Create Payment Entry", () => {
    it.each(["unpaid", "partially_paid", "returned"])(
      "status '%s': opsi Create Payment Entry muncul, mengarah ke route paymentEntries.create + ref",
      async (status) => {
        const user = userEvent.setup({ delay: null });
        const salesInvoice = baseSalesInvoice({ id: 42, status });
        render(<Show salesInvoice={salesInvoice} defaultData={{}} />);

        await user.click(
          screen.getByRole("button", { name: /core.form.actions/ }),
        );

        const link = await screen.findByText(
          "finances.salesInvoice.actions.create_payment_entry",
        );
        expect(link.closest("a")).toHaveAttribute(
          "href",
          `paymentEntries.create/${JSON.stringify({ ref: "salesInvoice/42" })}`,
        );
      },
    );

    it("status 'paid' (di luar daftar payment): opsi Create Payment Entry tidak muncul", async () => {
      const user = userEvent.setup({ delay: null });
      // Supaya dropdown tetap muncul, penuhi opsi credit note (is_return
      // false + unreturned_quantity > 0).
      const salesInvoice = baseSalesInvoice({
        status: "paid",
        is_return: false,
        items: [{ id: 1, unreturned_quantity: 3 }],
      });
      render(<Show salesInvoice={salesInvoice} defaultData={{}} />);

      await user.click(
        screen.getByRole("button", { name: /core.form.actions/ }),
      );

      expect(
        screen.queryByText(
          "finances.salesInvoice.actions.create_payment_entry",
        ),
      ).not.toBeInTheDocument();
    });
  });

  // --- Opsi "Create Credit Note" ---------------------------------------------
  describe("dropdown Actions -- opsi Create Credit Note", () => {
    it("is_return=false dan ada unreturned_quantity (>0): opsi Create Credit Note muncul, mengarah ke route salesInvoices.create + ref", async () => {
      const user = userEvent.setup({ delay: null });
      const salesInvoice = baseSalesInvoice({
        id: 55,
        status: "paid",
        is_return: false,
        items: [{ id: 1, unreturned_quantity: 4 }],
      });
      render(<Show salesInvoice={salesInvoice} defaultData={{}} />);

      await user.click(
        screen.getByRole("button", { name: /core.form.actions/ }),
      );

      const link = await screen.findByText(
        "finances.salesInvoice.actions.create_credit_note",
      );
      expect(link.closest("a")).toHaveAttribute(
        "href",
        `salesInvoices.create/${JSON.stringify({ ref: "salesInvoice/55" })}`,
      );
    });

    it("is_return=true: opsi Create Credit Note tidak muncul meski unreturned_quantity > 0", async () => {
      const user = userEvent.setup({ delay: null });
      const salesInvoice = baseSalesInvoice({
        status: "unpaid",
        is_return: true,
        items: [{ id: 1, unreturned_quantity: 4 }],
      });
      render(<Show salesInvoice={salesInvoice} defaultData={{}} />);

      // Dropdown tetap muncul karena opsi payment entry (status unpaid).
      await user.click(
        screen.getByRole("button", { name: /core.form.actions/ }),
      );

      expect(
        screen.queryByText("finances.salesInvoice.actions.create_credit_note"),
      ).not.toBeInTheDocument();
    });

    it("is_return=false tapi total unreturned_quantity 0 (semua sudah diretur): opsi Create Credit Note tidak muncul", async () => {
      const user = userEvent.setup({ delay: null });
      const salesInvoice = baseSalesInvoice({
        status: "unpaid",
        is_return: false,
        items: [{ id: 1, unreturned_quantity: 0 }],
      });
      render(<Show salesInvoice={salesInvoice} defaultData={{}} />);

      // Dropdown tetap muncul karena opsi payment entry (status unpaid).
      await user.click(
        screen.getByRole("button", { name: /core.form.actions/ }),
      );

      expect(
        screen.queryByText("finances.salesInvoice.actions.create_credit_note"),
      ).not.toBeInTheDocument();
    });

    it("is_return=false tapi total unreturned_quantity negatif (over-return, edge case): opsi Create Credit Note tidak muncul (hanya > 0 yang menampilkan)", async () => {
      const user = userEvent.setup({ delay: null });
      const salesInvoice = baseSalesInvoice({
        status: "unpaid",
        is_return: false,
        items: [{ id: 1, unreturned_quantity: -2 }],
      });
      render(<Show salesInvoice={salesInvoice} defaultData={{}} />);

      await user.click(
        screen.getByRole("button", { name: /core.form.actions/ }),
      );

      expect(
        screen.queryByText("finances.salesInvoice.actions.create_credit_note"),
      ).not.toBeInTheDocument();
    });

    it("menjumlahkan unreturned_quantity dari banyak item (calculateArray sum, bukan cuma item pertama)", async () => {
      const user = userEvent.setup({ delay: null });
      const salesInvoice = baseSalesInvoice({
        id: 9,
        status: "paid",
        is_return: false,
        items: [
          { id: 1, unreturned_quantity: 0 },
          { id: 2, unreturned_quantity: -1 },
          { id: 3, unreturned_quantity: 2 },
        ],
      });
      render(<Show salesInvoice={salesInvoice} defaultData={{}} />);

      await user.click(
        screen.getByRole("button", { name: /core.form.actions/ }),
      );

      // Total = 0 + (-1) + 2 = 1 > 0 -> opsi Create Credit Note muncul.
      expect(
        await screen.findByText(
          "finances.salesInvoice.actions.create_credit_note",
        ),
      ).toBeInTheDocument();
    });
  });

  // --- Kedua opsi tampil bersamaan --------------------------------------------
  describe("dropdown Actions -- kedua opsi bersamaan", () => {
    it("status 'partially_paid' dan is_return=false dengan unreturned_quantity > 0: kedua opsi (Payment Entry & Credit Note) muncul sekaligus", async () => {
      const user = userEvent.setup({ delay: null });
      const salesInvoice = baseSalesInvoice({
        id: 20,
        status: "partially_paid",
        is_return: false,
        items: [{ id: 1, unreturned_quantity: 6 }],
      });
      render(<Show salesInvoice={salesInvoice} defaultData={{}} />);

      await user.click(
        screen.getByRole("button", { name: /core.form.actions/ }),
      );

      expect(
        await screen.findByText(
          "finances.salesInvoice.actions.create_payment_entry",
        ),
      ).toBeInTheDocument();
      expect(
        screen.getByText("finances.salesInvoice.actions.create_credit_note"),
      ).toBeInTheDocument();
    });
  });
});
