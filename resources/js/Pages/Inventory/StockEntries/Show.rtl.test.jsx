import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";

// ============================================================================
// Show.jsx (35 baris) adalah halaman detail Stock Entry -- PALING sederhana
// di antara Show.jsx modul Inventory/Purchase yang sudah punya test (tidak
// ada banner controls/dialog, tidak ada Link/router, tidak ada sub-komponen
// display). Ia MENG-COMPOSE <FormPage><Form/></FormPage> (keduanya sudah py
// test sendiri) PLUS logic UI unik miliknya sendiri:
// - isCreate={!stockEntry} diteruskan ke FormPage.
// - disabled={stockEntry?.submitted_at} diteruskan ke FormPage (nilai
//   submitted_at string/undefined diteruskan apa adanya, bukan boolean
//   eksplisit -- sama seperti pola Show.jsx lain).
// - ignoreDraft={defaultData} dan defaultValues={defaultData} diteruskan
//   ke FormPage.
// - submitable diteruskan sebagai prop statis (selalu true) ke FormPage.
// - banner: hanya muncul kalau flash.errorItems ada, menampilkan judul +
//   daftar error (masing-masing di-translate lewat t()) -- identik dengan
//   banner Show.jsx DeliveryNotes/PurchaseInvoice.
// - TIDAK ADA controls() sama sekali -- beda dari DeliveryNotes (tombol
//   Create Sales Return) dan PurchaseRequests (tombol Create PO). Tidak ada
//   Link, tidak ada @/lib/utils (calculateArray/inArray/isValidStatus) yang
//   diimpor sama sekali di source.
//
// FormPage & Form DISTUB sebagai black-box -- test ini TIDAK meretest logic
// internal keduanya (Form.jsx StockEntries sudah py test sendiri), hanya
// memverifikasi Show.jsx merender & menyambungkan props dengan benar, dan
// bahwa logic UNIK (banner) di Show.jsx sendiri berperilaku benar.
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
// sederhana yang merender banner/children apa adanya, plus mengekspos props
// penting (isCreate/disabled/submitable/ignoreDraft/defaultValues) lewat
// data-testid supaya bisa diverifikasi tanpa merender FormPage asli yang
// berat (AppLayout, useForm, dsb).
vi.mock("@/Pages/Core/FormPage", () => ({
  FormPage: ({
    isCreate,
    disabled,
    submitable,
    ignoreDraft,
    defaultValues,
    banner,
    children,
  }) => (
    <div data-testid="stub-form-page">
      <div data-testid="form-page-meta">
        {JSON.stringify({
          isCreate: !!isCreate,
          disabled: !!disabled,
          submitable: !!submitable,
          ignoreDraft: ignoreDraft ?? null,
          defaultValues: defaultValues ?? null,
        })}
      </div>
      <div data-testid="form-page-banner">{banner}</div>
      <div data-testid="form-page-children">{children}</div>
    </div>
  ),
}));

// --- ./Form -------------------------------------------------------------
// Form.jsx StockEntries sudah py test sendiri -- distub sebagai black-box
// testid, tidak diretest di sini.
vi.mock("./Form", () => ({
  default: () => <div data-testid="stub-form" />,
}));

import Show from "./Show";

function baseStockEntry(overrides = {}) {
  return {
    id: 5,
    submitted_at: "2026-08-01T00:00:00Z",
    ...overrides,
  };
}

function renderShow(props = {}) {
  return render(
    <Show stockEntry={null} defaultData={{}} flash={{}} {...props} />,
  );
}

describe("Show (StockEntries)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // --- Compose FormPage + Form dasar ----------------------------------------
  describe("compose FormPage + Form", () => {
    it("mode create (stockEntry null): isCreate=true, disabled=false, submitable=true", () => {
      renderShow({ stockEntry: null });

      expect(screen.getByTestId("form-page-meta")).toHaveTextContent(
        JSON.stringify({
          isCreate: true,
          disabled: false,
          submitable: true,
          ignoreDraft: {},
          defaultValues: {},
        }),
      );
      expect(screen.getByTestId("stub-form")).toBeInTheDocument();
    });

    it("mode edit belum submit: isCreate=false, disabled=false (submitted_at kosong)", () => {
      const stockEntry = { id: 1, submitted_at: null };
      renderShow({ stockEntry });

      expect(screen.getByTestId("form-page-meta")).toHaveTextContent(
        JSON.stringify({
          isCreate: false,
          disabled: false,
          submitable: true,
          ignoreDraft: {},
          defaultValues: {},
        }),
      );
    });

    it("submitted_at ada: disabled=true diteruskan ke FormPage", () => {
      const stockEntry = baseStockEntry();
      renderShow({ stockEntry });

      expect(screen.getByTestId("form-page-meta")).toHaveTextContent(
        JSON.stringify({
          isCreate: false,
          disabled: true,
          submitable: true,
          ignoreDraft: {},
          defaultValues: {},
        }),
      );
    });

    it("meneruskan defaultData sebagai ignoreDraft dan defaultValues ke FormPage", () => {
      renderShow({ stockEntry: null, defaultData: { foo: "bar" } });

      expect(screen.getByTestId("form-page-meta")).toHaveTextContent(
        JSON.stringify({
          isCreate: true,
          disabled: false,
          submitable: true,
          ignoreDraft: { foo: "bar" },
          defaultValues: { foo: "bar" },
        }),
      );
    });

    it("merender Form sebagai children lewat FormPage stub", () => {
      renderShow({ stockEntry: null });

      expect(screen.getByTestId("form-page-children")).toContainElement(
        screen.getByTestId("stub-form"),
      );
    });
  });

  // --- banner: flash.errorItems ---------------------------------------------
  describe("banner errorItems", () => {
    it("flash.errorItems kosong/tidak ada: banner tidak merender apa pun", () => {
      renderShow({ stockEntry: null, flash: {} });

      expect(
        screen.queryByText("core.form.errors.title"),
      ).not.toBeInTheDocument();
    });

    it("flash.errorItems ada: menampilkan judul dan daftar error ter-translate", () => {
      renderShow({
        stockEntry: null,
        flash: { errorItems: ["error.one", "error.two"] },
      });

      expect(screen.getByText("core.form.errors.title")).toBeInTheDocument();
      expect(screen.getByText("error.one")).toBeInTheDocument();
      expect(screen.getByText("error.two")).toBeInTheDocument();
      // Masing-masing item error dirender sebagai <li> terpisah.
      const list = screen.getByText("error.one").closest("ul");
      expect(list.querySelectorAll("li")).toHaveLength(2);
    });

    it("flash.errorItems dengan satu item: hanya satu <li> dirender", () => {
      renderShow({
        stockEntry: null,
        flash: { errorItems: ["error.single"] },
      });

      const list = screen.getByText("error.single").closest("ul");
      expect(list.querySelectorAll("li")).toHaveLength(1);
    });
  });
});
