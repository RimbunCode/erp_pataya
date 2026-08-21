import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

// ============================================================================
// Show.jsx (91 baris) adalah halaman detail Asset. Ia MENG-COMPOSE
// <FormPage><Form/></FormPage> (FormPage & Form.jsx Assets sudah py test
// sendiri) PLUS logic UI unik miliknya sendiri:
// - STATUS_ACTIONS: map status asset -> daftar action yang tersedia
//   (active/issued -> scrap/setInMaintenance/setOutOfOrder,
//   in_maintenance -> reactivate, out_of_order -> reactivate/scrap).
// - asset.status adalah ARRAY (flatMap ke semua actions dari tiap status,
//   lalu di-dedupe via Set) -- BUKAN string tunggal.
// - handleAction(action): router.post ke route "assets.action" dengan
//   payload {asset: id, action}, payload body kosong ({}), onFinish
//   men-set loading=false.
// - controls(): return null kalau !asset?.submitted_at ATAU
//   uniqueActions.length === 0 (dropdown TIDAK muncul pada kedua kondisi).
//   Kalau ada, dropdown berisi tombol trigger "core.form.actions" + item
//   per action dengan label t(`asset.asset.actions.${toSnakeCase(action)}`).
// - toSnakeCase(action): mengubah camelCase ("setInMaintenance") jadi
//   snake_case ("set_in_maintenance") untuk key terjemahan.
// - Tidak ada dialog konfirmasi sama sekali -- klik action langsung
//   memanggil router.post (beda dari PurchaseOrders yang pakai dialog).
// - Tidak ada flash/banner, tidak ada tabel item, tidak ada usePermission.
//
// FormPage & Form DISTUB sebagai black-box -- test ini TIDAK meretest logic
// internal keduanya, hanya memverifikasi Show.jsx merender & menyambungkan
// props dengan benar, dan bahwa logic UNIK (STATUS_ACTIONS/dropdown/
// handleAction/toSnakeCase) di Show.jsx sendiri berperilaku benar.
// DropdownMenu (Radix) TIDAK distub -- dirender sungguhan seperti pola di
// PurchaseOrders/Show.rtl.test.jsx (klik trigger lalu screen.findByText).
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
// FormPage asli sudah py test sendiri (FormPage.rtl.test.jsx). Distub jadi
// wrapper sederhana yang merender controls()/children apa adanya, plus
// mengekspos props penting (isCreate/disabled) lewat data-testid.
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
// Form.jsx Assets sudah py test sendiri -- distub sebagai black-box testid,
// tidak diretest di sini.
vi.mock("./Form", () => ({
  default: () => <div data-testid="stub-form" />,
}));

import Show from "./Show";

function baseAsset(overrides = {}) {
  return {
    id: 7,
    submitted_at: "2026-08-01T00:00:00Z",
    status: ["active"],
    ...overrides,
  };
}

describe("Show (Assets)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // --- Compose FormPage + Form ---------------------------------------------
  describe("compose FormPage + Form", () => {
    it("mode create (asset null): isCreate=true, disabled=false, tidak ada dropdown actions", () => {
      render(<Show asset={null} defaultData={{}} />);

      expect(screen.getByTestId("form-page-meta")).toHaveTextContent(
        JSON.stringify({ isCreate: true, disabled: false }),
      );
      expect(screen.getByTestId("stub-form")).toBeInTheDocument();
      expect(
        screen.queryByRole("button", { name: "core.form.actions" }),
      ).not.toBeInTheDocument();
    });

    it("mode edit belum submit: isCreate=false, disabled=false (submitted_at kosong), tidak ada controls", () => {
      const asset = { id: 1, submitted_at: null, status: ["active"] };
      render(<Show asset={asset} defaultData={{}} />);

      expect(screen.getByTestId("form-page-meta")).toHaveTextContent(
        JSON.stringify({ isCreate: false, disabled: false }),
      );
      expect(
        screen.queryByRole("button", { name: "core.form.actions" }),
      ).not.toBeInTheDocument();
    });

    it("submitted_at ada: disabled=true diteruskan ke FormPage", () => {
      const asset = baseAsset();
      render(<Show asset={asset} defaultData={{}} />);

      expect(screen.getByTestId("form-page-meta")).toHaveTextContent(
        JSON.stringify({ isCreate: false, disabled: true }),
      );
    });
  });

  // --- controls(): gating dropdown Actions ---------------------------------
  describe("controls() -- gating dropdown Actions", () => {
    it("submitted_at falsy: dropdown tidak muncul meski status punya action", () => {
      const asset = {
        id: 1,
        submitted_at: null,
        status: ["active"],
      };
      render(<Show asset={asset} defaultData={{}} />);

      expect(
        screen.queryByRole("button", { name: "core.form.actions" }),
      ).not.toBeInTheDocument();
    });

    it("submitted_at ada tapi status tidak dikenal (uniqueActions kosong): dropdown tidak muncul", () => {
      const asset = baseAsset({ status: ["unknown_status"] });
      render(<Show asset={asset} defaultData={{}} />);

      expect(
        screen.queryByRole("button", { name: "core.form.actions" }),
      ).not.toBeInTheDocument();
    });

    it("status null/undefined diperlakukan sebagai array kosong (default ??): dropdown tidak muncul, tidak crash", () => {
      const asset = { id: 1, submitted_at: "2026-08-01T00:00:00Z" };
      render(<Show asset={asset} defaultData={{}} />);

      expect(
        screen.queryByRole("button", { name: "core.form.actions" }),
      ).not.toBeInTheDocument();
    });

    it("submitted_at ada dan status 'active': dropdown muncul dengan 3 action (scrap/setInMaintenance/setOutOfOrder)", async () => {
      const user = userEvent.setup({ delay: null });
      const asset = baseAsset({ status: ["active"] });
      render(<Show asset={asset} defaultData={{}} />);

      await user.click(
        screen.getByRole("button", { name: "core.form.actions" }),
      );

      expect(
        await screen.findByText("asset.asset.actions.scrap"),
      ).toBeInTheDocument();
      expect(
        screen.getByText("asset.asset.actions.set_in_maintenance"),
      ).toBeInTheDocument();
      expect(
        screen.getByText("asset.asset.actions.set_out_of_order"),
      ).toBeInTheDocument();
    });

    it("status 'in_maintenance': dropdown hanya berisi 1 action (reactivate)", async () => {
      const user = userEvent.setup({ delay: null });
      const asset = baseAsset({ status: ["in_maintenance"] });
      render(<Show asset={asset} defaultData={{}} />);

      await user.click(
        screen.getByRole("button", { name: "core.form.actions" }),
      );

      expect(
        await screen.findByText("asset.asset.actions.reactivate"),
      ).toBeInTheDocument();
      expect(
        screen.queryByText("asset.asset.actions.scrap"),
      ).not.toBeInTheDocument();
      expect(
        screen.queryByText("asset.asset.actions.set_in_maintenance"),
      ).not.toBeInTheDocument();
    });

    it("status 'out_of_order': dropdown berisi 2 action (reactivate & scrap)", async () => {
      const user = userEvent.setup({ delay: null });
      const asset = baseAsset({ status: ["out_of_order"] });
      render(<Show asset={asset} defaultData={{}} />);

      await user.click(
        screen.getByRole("button", { name: "core.form.actions" }),
      );

      expect(
        await screen.findByText("asset.asset.actions.reactivate"),
      ).toBeInTheDocument();
      expect(
        screen.getByText("asset.asset.actions.scrap"),
      ).toBeInTheDocument();
    });

    it("status berupa multi-array dengan overlap (active + issued): action di-dedupe (masing-masing muncul 1x)", async () => {
      const user = userEvent.setup({ delay: null });
      const asset = baseAsset({ status: ["active", "issued"] });
      render(<Show asset={asset} defaultData={{}} />);

      await user.click(
        screen.getByRole("button", { name: "core.form.actions" }),
      );

      // scrap muncul di STATUS_ACTIONS baik utk active maupun issued --
      // dedupe via [...new Set(...)] harus menyisakan cuma 1 elemen.
      expect(
        await screen.findAllByText("asset.asset.actions.scrap"),
      ).toHaveLength(1);
      expect(
        screen.getAllByText("asset.asset.actions.set_in_maintenance"),
      ).toHaveLength(1);
      expect(
        screen.getAllByText("asset.asset.actions.set_out_of_order"),
      ).toHaveLength(1);
    });

    it("status gabungan active + out_of_order: union action dari kedua status (scrap/setInMaintenance/setOutOfOrder/reactivate)", async () => {
      const user = userEvent.setup({ delay: null });
      const asset = baseAsset({ status: ["active", "out_of_order"] });
      render(<Show asset={asset} defaultData={{}} />);

      await user.click(
        screen.getByRole("button", { name: "core.form.actions" }),
      );

      expect(
        await screen.findByText("asset.asset.actions.reactivate"),
      ).toBeInTheDocument();
      expect(
        screen.getByText("asset.asset.actions.set_in_maintenance"),
      ).toBeInTheDocument();
      expect(
        screen.getByText("asset.asset.actions.set_out_of_order"),
      ).toBeInTheDocument();
      // scrap ada di kedua status -- tetap cuma 1 (dedupe)
      expect(
        screen.getAllByText("asset.asset.actions.scrap"),
      ).toHaveLength(1);
    });
  });

  // --- handleAction: router.post ------------------------------------------
  describe("handleAction -- router.post ke assets.action", () => {
    it("klik action item memanggil router.post dengan route assets.action, payload {asset, action}, body kosong", async () => {
      const user = userEvent.setup({ delay: null });
      const asset = baseAsset({ id: 55, status: ["active"] });
      render(<Show asset={asset} defaultData={{}} />);

      await user.click(
        screen.getByRole("button", { name: "core.form.actions" }),
      );
      await user.click(
        await screen.findByText("asset.asset.actions.scrap"),
      );

      expect(routerPost).toHaveBeenCalledTimes(1);
      const [url, payload, options] = routerPost.mock.calls[0];
      expect(url).toBe(
        `assets.action/${JSON.stringify({ asset: 55, action: "scrap" })}`,
      );
      expect(payload).toEqual({});
      expect(typeof options.onFinish).toBe("function");
    });

    it("action yang berbeda (reactivate) diteruskan dengan benar ke payload", async () => {
      const user = userEvent.setup({ delay: null });
      const asset = baseAsset({ id: 9, status: ["in_maintenance"] });
      render(<Show asset={asset} defaultData={{}} />);

      await user.click(
        screen.getByRole("button", { name: "core.form.actions" }),
      );
      await user.click(
        await screen.findByText("asset.asset.actions.reactivate"),
      );

      const [url] = routerPost.mock.calls[0];
      expect(url).toBe(
        `assets.action/${JSON.stringify({ asset: 9, action: "reactivate" })}`,
      );
    });

    it("trigger dropdown disabled saat loading=true (setelah action diklik, sebelum onFinish dipanggil)", async () => {
      routerPost.mockImplementation(() => {
        // Sengaja tidak memanggil onFinish supaya state loading bisa diamati.
      });
      const user = userEvent.setup({ delay: null });
      const asset = baseAsset({ status: ["active"] });
      render(<Show asset={asset} defaultData={{}} />);

      await user.click(
        screen.getByRole("button", { name: "core.form.actions" }),
      );
      await user.click(
        await screen.findByText("asset.asset.actions.scrap"),
      );

      expect(
        screen.getByRole("button", { name: "core.form.actions" }),
      ).toBeDisabled();
    });

    it("onFinish men-set loading kembali false", async () => {
      let onFinishCb;
      routerPost.mockImplementation((url, data, options) => {
        onFinishCb = options.onFinish;
      });
      const user = userEvent.setup({ delay: null });
      const asset = baseAsset({ status: ["active"] });
      render(<Show asset={asset} defaultData={{}} />);

      await user.click(
        screen.getByRole("button", { name: "core.form.actions" }),
      );
      await user.click(
        await screen.findByText("asset.asset.actions.scrap"),
      );
      expect(
        screen.getByRole("button", { name: "core.form.actions" }),
      ).toBeDisabled();

      act(() => {
        onFinishCb();
      });

      expect(
        screen.getByRole("button", { name: "core.form.actions" }),
      ).not.toBeDisabled();
    });
  });
});
