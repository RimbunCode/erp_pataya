import {
  describe,
  expect,
  it,
  vi,
  beforeAll,
  afterAll,
  beforeEach,
} from "vitest";
import { act, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

// ============================================================================
// ServiceActivityLog.jsx (spec asset-service-progress-workflow) merender:
// - ActivityFormDialog (named export): dialog add/edit satu activity, field
//   `status` (pengganti checkbox is_done, dihapus) via Select, submit via
//   router.post (create) / router.put (update).
// - ServiceActivityLog (default export): daftar activity (badge status,
//   pengganti checkbox) + tombol "Add" + tombol "Complete" (tampil kalau
//   activity TERAKHIR -- action_date terbesar, `.at(-1)` -- BUKAN "completed",
//   bukan lagi "semua activity is_done"). Klik "Complete" membuka
//   ActivityFormDialog YANG SAMA dengan prefillStatus="completed" (BUKAN
//   dialog konfirmasi terpisah -- CompleteConfirmDialog dihapus total).
//
// Dialog (@/Components/ui/dialog, Radix) DIRENDER SUNGGUHAN. Select (Radix)
// distub jadi native <select> (pola sama Form.rtl.test.jsx) -- fokus test di
// sini ada di logic gating tombol Complete & payload submit, bukan detail
// interaksi Radix Select.
//
// DatetimePicker & UserLinkModel distub jadi tombol yang memanggil
// onValueChange dengan nilai tetap saat diklik.
// ============================================================================

const stableT = (key) => key;
vi.mock("laravel-react-i18n", () => ({
  useLaravelReactI18n: () => ({ t: stableT }),
}));

window.route = (name, ...ids) => `${name}/${ids.join(",")}`;

const routerPut = vi.fn();
const routerPost = vi.fn();
const routerDelete = vi.fn();
vi.mock("@inertiajs/react", () => ({
  router: {
    put: (...a) => routerPut(...a),
    post: (...a) => routerPost(...a),
    delete: (...a) => routerDelete(...a),
  },
  usePage: () => ({ props: { lang: "id" } }),
}));

vi.mock("@/Components/Link", () => ({
  default: ({ href, children }) => <a href={href}>{children}</a>,
}));

// ServiceActivityLog kini merender diri sebagai tab terpisah (FormPageContent
// value="activities") -- FormPageContent asli butuh FormPageContext (dari
// <FormPage>) yang tidak dipasang di test ini (render standalone), jadi
// distub jadi passthrough sederhana (pola sama Form.rtl.test.jsx).
vi.mock("@/Pages/Core/FormPage", () => ({
  FormPageContent: ({ title, children }) => (
    <div data-testid={`form-page-content-${title ?? "untitled"}`}>
      {children}
    </div>
  ),
}));

vi.mock("@/Components/BadgeStatus", () => ({
  default: ({ status }) => <span data-testid="badge-status">{status}</span>,
}));

// TooltipContent (real Radix) tidak dirender ke DOM sampai tooltip terbuka
// (hover/focus) -- mock ini meniru itu (return null) supaya teks nama file
// tidak duplikat di DOM (sekali di trigger, sekali lagi di content).
vi.mock("@/Components/ui/tooltip", () => ({
  Tooltip: ({ children }) => <>{children}</>,
  TooltipTrigger: ({ children }) => <>{children}</>,
  TooltipContent: () => null,
}));

// UploadDialog asli (axios/router internal) distub -- fokus test ini cuma
// memverifikasi ActivityFormDialog mengonfigurasinya dengan benar (onBuffer
// vs options.route sesuai mode), bukan perilaku upload UploadDialog sendiri
// (sudah ada test terpisah untuk itu).
vi.mock("@/Pages/Core/Components/UploadDialog", () => ({
  default: ({ onBuffer, options }) => (
    <div data-testid="upload-dialog" data-route={options?.route ?? ""}>
      {onBuffer && (
        <button
          type="button"
          onClick={() => onBuffer([{ id: 99, name: "lampiran-baru.pdf" }])}
        >
          fake-buffer-upload
        </button>
      )}
    </div>
  ),
}));

vi.mock("@/Components/DatetimePicker", () => ({
  // value bisa berupa Date object (prefill now() mode create, Requirement
  // 6 AC5) ATAU string (dari onValueChange mock di bawah, atau data activity
  // existing mode edit) -- String(value) aman utk keduanya, BEDA dari mock
  // lama yang assign `value ?? "none"` langsung sbg child (crash React kalau
  // value Date object mentah).
  default: ({ value, onValueChange }) => (
    <button
      type="button"
      data-testid="datetime-picker"
      onClick={() => onValueChange("2026-09-10")}
    >
      date:{value ? String(value) : "none"}
    </button>
  ),
}));

vi.mock("@/Pages/Users/ManageUsers/UserLinkModel", () => ({
  default: ({ value, onValueChange }) => (
    <button
      type="button"
      data-testid="user-link-model"
      onClick={() => onValueChange({ id: 7, name: "User Baru" })}
    >
      pic:{value?.name ?? "none"}
    </button>
  ),
}));

// Select (Radix, dari @/Components/ui/select) distub jadi native <select> --
// pola sama Form.rtl.test.jsx.
vi.mock("@/Components/ui/select", () => ({
  Select: ({ value, onValueChange, children }) => (
    <select
      data-testid="status-select"
      value={value ?? ""}
      onChange={(e) => onValueChange?.(e.target.value)}
    >
      <option value="" disabled>
        placeholder
      </option>
      {children}
    </select>
  ),
  SelectTrigger: ({ children }) => children,
  SelectValue: () => null,
  SelectContent: ({ children }) => children,
  SelectItem: ({ value, children }) => (
    <option value={value}>{children}</option>
  ),
}));

import ServiceActivityLog, { ActivityFormDialog } from "./ServiceActivityLog";

const baseAssetService = (overrides = {}) => ({
  id: 1,
  activities: [],
  ...overrides,
});

describe("ServiceActivityLog", () => {
  // formatActionDate() (lihat ServiceActivityLog.jsx) memanggil
  // TZDate(value) tanpa argumen timezone eksplisit sejak perbaikan selisih
  // 7 jam pada tampilan log -- hasilnya kini memakai timezone browser,
  // bukan lagi dipaksa UTC. TZ di-stub SEKALI di sini (sebelum test manapun
  // memanggil formatActionDate pertama kali) supaya rendernya deterministic
  // lintas mesin/CI -- lihat catatan cache Intl.DateTimeFormat di
  // Comments.rtl.test.jsx / FormPageDiff.rtl.test.jsx untuk alasan
  // beforeAll (bukan beforeEach/di dalam test) wajib dipakai.
  beforeAll(() => {
    vi.stubEnv("TZ", "Asia/Jakarta");
  });

  afterAll(() => {
    vi.unstubAllEnvs();
  });

  beforeEach(() => {
    routerPut.mockReset();
    routerPost.mockReset();
    routerDelete.mockReset();
  });

  it("exports ActivityFormDialog sebagai named export (dipakai ConfirmWorkflowDialog)", () => {
    expect(typeof ActivityFormDialog).toBe("function");
  });

  it("activities kosong: menampilkan empty state, tombol Complete tidak tampil", () => {
    render(<ServiceActivityLog assetService={baseAssetService()} />);

    expect(
      screen.getByText("asset.service.activity.empty"),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", {
        name: "asset.service.activity.mark_complete",
      }),
    ).not.toBeInTheDocument();
  });

  it("menampilkan daftar activity dengan description, nama pic, action_date, dan badge status", () => {
    const assetService = baseAssetService({
      activities: [
        {
          id: 1,
          description: "Cek oli",
          pic: { id: 2, name: "Budi" },
          action_date: "2026-09-01",
          status: "in_progress",
        },
      ],
    });
    render(<ServiceActivityLog assetService={assetService} />);

    expect(screen.getByText("Cek oli")).toBeInTheDocument();
    // Requirement (permintaan user): timestamp diformat via date-fns
    // (TZDate + format "PPPp", locale dari usePage().props.lang) --
    // bukan lagi raw string action_date dari backend. action_date
    // "2026-09-01" (date-only) di-parse sebagai UTC midnight, dan TZDate
    // tanpa argumen timezone menampilkannya di timezone browser (di-stub
    // Asia/Jakarta/UTC+7 di atas) -- makanya "07.00", bukan "00.00" UTC.
    expect(
      screen.getByText("Budi — 1 September 2026 pukul 07.00"),
    ).toBeInTheDocument();
    expect(screen.getByTestId("badge-status")).toHaveTextContent("in_progress");
    expect(
      screen.queryByText("asset.service.activity.empty"),
    ).not.toBeInTheDocument();
  });

  it("klik tombol Add membuka dialog dengan title 'add' (bukan 'edit')", async () => {
    const user = userEvent.setup({ delay: null });
    render(<ServiceActivityLog assetService={baseAssetService()} />);

    await user.click(
      screen.getByRole("button", { name: "asset.service.activity.add" }),
    );

    const dialog = screen.getByRole("dialog");
    expect(
      within(dialog).getByText("asset.service.activity.add"),
    ).toBeInTheDocument();
    expect(
      within(dialog).queryByText("asset.service.activity.edit"),
    ).not.toBeInTheDocument();
  });

  it("klik baris activity untuk edit membuka dialog dengan title 'edit' dan form TERISI data activity yang diklik (termasuk status)", async () => {
    const user = userEvent.setup({ delay: null });
    const assetService = baseAssetService({
      activities: [
        {
          id: 9,
          description: "Cek oli",
          pic: { id: 2, name: "Budi" },
          action_date: "2026-09-01",
          status: "waiting",
        },
      ],
    });
    render(<ServiceActivityLog assetService={assetService} />);

    await user.click(screen.getByText("Cek oli"));

    const dialog = screen.getByRole("dialog");
    expect(
      within(dialog).getByText("asset.service.activity.edit"),
    ).toBeInTheDocument();
    expect(
      within(dialog).getByPlaceholderText("asset.service.activity.description"),
    ).toHaveValue("Cek oli");
    expect(within(dialog).getByTestId("datetime-picker")).toHaveTextContent(
      "date:2026-09-01",
    );
    expect(within(dialog).getByTestId("user-link-model")).toHaveTextContent(
      "pic:Budi",
    );
    expect(within(dialog).getByTestId("status-select")).toHaveValue("waiting");
  });

  it("ganti activity yang diedit (klik activity lain selagi dialog masih ke-render) me-reset form ke data activity baru", async () => {
    const user = userEvent.setup({ delay: null });
    const assetService = baseAssetService({
      activities: [
        {
          id: 9,
          description: "Cek oli",
          pic: { id: 2, name: "Budi" },
          action_date: "2026-09-01",
          status: "waiting",
        },
        {
          id: 10,
          description: "Ganti ban",
          pic: null,
          action_date: null,
          status: "on_hold",
        },
      ],
    });
    render(<ServiceActivityLog assetService={assetService} />);

    await user.click(screen.getByText("Cek oli"));
    expect(
      within(screen.getByRole("dialog")).getByPlaceholderText(
        "asset.service.activity.description",
      ),
    ).toHaveValue("Cek oli");

    await user.keyboard("{Escape}");
    await user.click(screen.getByText("Ganti ban"));

    expect(
      within(screen.getByRole("dialog")).getByPlaceholderText(
        "asset.service.activity.description",
      ),
    ).toHaveValue("Ganti ban");
    expect(
      within(screen.getByRole("dialog")).getByTestId("status-select"),
    ).toHaveValue("on_hold");
  });

  it("mode create biasa: status ter-prefill dari activity dengan action_date terbesar (activity terakhir milik AssetService)", async () => {
    const user = userEvent.setup({ delay: null });
    const assetService = baseAssetService({
      activities: [
        {
          id: 1,
          description: "A",
          pic: null,
          action_date: "2026-09-01",
          status: "in_progress",
        },
        {
          id: 2,
          description: "B",
          pic: null,
          action_date: "2026-09-05",
          status: "waiting",
        },
      ],
    });
    render(<ServiceActivityLog assetService={assetService} />);

    await user.click(
      screen.getByRole("button", { name: "asset.service.activity.add" }),
    );

    expect(
      within(screen.getByRole("dialog")).getByTestId("status-select"),
    ).toHaveValue("waiting");
  });

  it("mengisi form Add lalu submit memanggil router.post ke assetServices.activities.store dengan payload status terpilih", async () => {
    const user = userEvent.setup({ delay: null });
    const assetService = baseAssetService({ id: 3 });
    render(<ServiceActivityLog assetService={assetService} />);

    await user.click(
      screen.getByRole("button", { name: "asset.service.activity.add" }),
    );
    const dialog = screen.getByRole("dialog");

    await user.type(
      within(dialog).getByPlaceholderText("asset.service.activity.description"),
      "Servis rutin",
    );
    await user.click(within(dialog).getByTestId("datetime-picker"));
    await user.click(within(dialog).getByTestId("user-link-model"));
    await user.selectOptions(
      within(dialog).getByTestId("status-select"),
      "resolved",
    );

    await user.click(
      within(dialog).getByRole("button", {
        name: "asset.service.activity.save",
      }),
    );

    expect(routerPost).toHaveBeenCalledTimes(1);
    expect(routerPost).toHaveBeenCalledWith(
      "assetServices.activities.store/3",
      {
        action_date: "2026-09-10",
        pic_id: 7,
        description: "Servis rutin",
        status: "resolved",
      },
      expect.objectContaining({
        onSuccess: expect.any(Function),
        onFinish: expect.any(Function),
      }),
    );
  });

  it("tombol Save disabled selagi saving=true (sebelum onFinish dipanggil)", async () => {
    routerPost.mockImplementation(() => {
      // sengaja tidak memanggil onFinish supaya state saving bisa diamati
    });
    const user = userEvent.setup({ delay: null });
    render(<ServiceActivityLog assetService={baseAssetService()} />);

    await user.click(
      screen.getByRole("button", { name: "asset.service.activity.add" }),
    );
    const dialog = screen.getByRole("dialog");
    const saveButton = within(dialog).getByRole("button", {
      name: "asset.service.activity.save",
    });
    await user.click(saveButton);

    expect(saveButton).toBeDisabled();
  });

  it("onSuccess menutup dialog add/edit setelah submit berhasil", async () => {
    let onSuccessCb;
    routerPost.mockImplementation((_url, _payload, options) => {
      onSuccessCb = options.onSuccess;
    });
    const user = userEvent.setup({ delay: null });
    render(<ServiceActivityLog assetService={baseAssetService()} />);

    await user.click(
      screen.getByRole("button", { name: "asset.service.activity.add" }),
    );
    expect(screen.getByRole("dialog")).toBeInTheDocument();

    await user.click(
      within(screen.getByRole("dialog")).getByRole("button", {
        name: "asset.service.activity.save",
      }),
    );
    expect(typeof onSuccessCb).toBe("function");

    act(() => {
      onSuccessCb();
    });

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("permintaan user: onFinish TANPA onSuccess (mis. gagal validasi backend) TIDAK menutup dialog", async () => {
    let onFinishCb;
    routerPost.mockImplementation((_url, _payload, options) => {
      // Simulasikan request gagal -- Inertia tetap memanggil onFinish,
      // tapi onSuccess TIDAK pernah terpanggil.
      onFinishCb = options.onFinish;
    });
    const user = userEvent.setup({ delay: null });
    render(<ServiceActivityLog assetService={baseAssetService()} />);

    await user.click(
      screen.getByRole("button", { name: "asset.service.activity.add" }),
    );
    expect(screen.getByRole("dialog")).toBeInTheDocument();

    await user.click(
      within(screen.getByRole("dialog")).getByRole("button", {
        name: "asset.service.activity.save",
      }),
    );
    expect(typeof onFinishCb).toBe("function");

    act(() => {
      onFinishCb();
    });

    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });

  describe("tombol Complete (Requirement 7, revisi -- bukan lagi 'semua is_done')", () => {
    it("tampil kalau activity TERAKHIR bukan completed", () => {
      const assetService = baseAssetService({
        activities: [
          {
            id: 1,
            description: "A",
            pic: null,
            action_date: null,
            status: "in_progress",
          },
        ],
      });
      render(<ServiceActivityLog assetService={assetService} />);

      expect(
        screen.getByRole("button", {
          name: "asset.service.activity.mark_complete",
        }),
      ).toBeInTheDocument();
    });

    it("TIDAK tampil kalau activity terakhir sudah completed", () => {
      const assetService = baseAssetService({
        activities: [
          {
            id: 1,
            description: "A",
            pic: null,
            action_date: "2026-09-01",
            status: "in_progress",
          },
          {
            id: 2,
            description: "B",
            pic: null,
            action_date: "2026-09-05",
            status: "completed",
          },
        ],
      });
      render(<ServiceActivityLog assetService={assetService} />);

      expect(
        screen.queryByRole("button", {
          name: "asset.service.activity.mark_complete",
        }),
      ).not.toBeInTheDocument();
    });

    it("klik Complete membuka ActivityFormDialog YANG SAMA dengan status ter-prefill 'completed', mode create (title 'add')", async () => {
      const user = userEvent.setup({ delay: null });
      const assetService = baseAssetService({
        activities: [
          {
            id: 1,
            description: "A",
            pic: null,
            action_date: null,
            status: "in_progress",
          },
        ],
      });
      render(<ServiceActivityLog assetService={assetService} />);

      await user.click(
        screen.getByRole("button", {
          name: "asset.service.activity.mark_complete",
        }),
      );

      const dialog = screen.getByRole("dialog");
      expect(
        within(dialog).getByText("asset.service.activity.add"),
      ).toBeInTheDocument();
      expect(within(dialog).getByTestId("status-select")).toHaveValue(
        "completed",
      );
    });

    it("submit dialog Complete sukses (onSuccess) memicu router.post KEDUA ke assetServices.complete", async () => {
      let onSuccessCb;
      routerPost.mockImplementation((_url, _payload, options) => {
        // panggilan KEDUA (assetServices.complete) cuma 1 argumen (url),
        // options undefined -- jangan timpa onSuccessCb yang sudah ditangkap
        // dari panggilan PERTAMA (activities.store).
        if (options) {
          onSuccessCb = options.onSuccess;
        }
      });
      const user = userEvent.setup({ delay: null });
      const assetService = baseAssetService({
        id: 42,
        activities: [
          {
            id: 1,
            description: "A",
            pic: null,
            action_date: null,
            status: "in_progress",
          },
        ],
      });
      render(<ServiceActivityLog assetService={assetService} />);

      await user.click(
        screen.getByRole("button", {
          name: "asset.service.activity.mark_complete",
        }),
      );
      const dialog = screen.getByRole("dialog");
      await user.type(
        within(dialog).getByPlaceholderText(
          "asset.service.activity.description",
        ),
        "Selesai",
      );
      await user.click(
        within(dialog).getByRole("button", {
          name: "asset.service.activity.save",
        }),
      );

      expect(typeof onSuccessCb).toBe("function");
      act(() => {
        onSuccessCb();
      });

      expect(routerPost).toHaveBeenCalledTimes(2);
      expect(routerPost).toHaveBeenNthCalledWith(
        2,
        "assetServices.complete/42",
      );
    });
  });

  describe("lampiran", () => {
    it("baris activity dengan files menampilkan indikator jumlah, yang tanpa files tidak", () => {
      const assetService = baseAssetService({
        activities: [
          {
            id: 1,
            description: "Ada lampiran",
            pic: null,
            action_date: null,
            status: "in_progress",
            files: [
              { id: 10, name: "a.pdf" },
              { id: 11, name: "b.pdf" },
            ],
          },
          {
            id: 2,
            description: "Tanpa lampiran",
            pic: null,
            action_date: null,
            status: "in_progress",
            files: [],
          },
        ],
      });
      render(<ServiceActivityLog assetService={assetService} />);

      expect(screen.getByText("2")).toBeInTheDocument();
      expect(screen.getByText("Ada lampiran").closest("div.flex")).toBeTruthy();
    });

    it("mode create: pilih file via UploadDialog (buffer) lalu Simpan mengirim filesId di payload", async () => {
      const user = userEvent.setup({ delay: null });
      const assetService = baseAssetService({ id: 3 });
      render(<ServiceActivityLog assetService={assetService} />);

      await user.click(
        screen.getByRole("button", { name: "asset.service.activity.add" }),
      );
      const dialog = screen.getByRole("dialog");

      await user.type(
        within(dialog).getByPlaceholderText(
          "asset.service.activity.description",
        ),
        "Servis rutin",
      );
      await user.click(within(dialog).getByText("fake-buffer-upload"));
      await user.click(
        within(dialog).getByRole("button", {
          name: "asset.service.activity.save",
        }),
      );

      expect(routerPost).toHaveBeenCalledWith(
        "assetServices.activities.store/3",
        expect.objectContaining({
          description: "Servis rutin",
          filesId: [99],
        }),
        expect.objectContaining({ onFinish: expect.any(Function) }),
      );
    });

    it("mode create tanpa pilih file: payload TIDAK menyertakan filesId sama sekali", async () => {
      const user = userEvent.setup({ delay: null });
      render(<ServiceActivityLog assetService={baseAssetService({ id: 3 })} />);

      await user.click(
        screen.getByRole("button", { name: "asset.service.activity.add" }),
      );
      await user.click(
        within(screen.getByRole("dialog")).getByRole("button", {
          name: "asset.service.activity.save",
        }),
      );

      const [, payload] = routerPost.mock.calls[0];
      expect(payload).not.toHaveProperty("filesId");
    });

    it("mode edit: tombol + UploadDialog dikonfigurasi options.route ke assetServices.activities.addFile milik activity yang benar", async () => {
      const user = userEvent.setup({ delay: null });
      const assetService = baseAssetService({
        activities: [
          {
            id: 9,
            description: "Cek oli",
            pic: null,
            action_date: null,
            status: "in_progress",
            files: [],
          },
        ],
      });
      render(<ServiceActivityLog assetService={assetService} />);

      await user.click(screen.getByText("Cek oli"));
      const dialog = screen.getByRole("dialog");

      expect(within(dialog).getByTestId("upload-dialog")).toHaveAttribute(
        "data-route",
        "assetServices.activities.addFile/9",
      );
      // Mode edit: onBuffer null -> tombol fake-buffer-upload tidak dirender.
      expect(
        within(dialog).queryByText("fake-buffer-upload"),
      ).not.toBeInTheDocument();
    });

    it("mode edit: klik X pada lampiran existing memanggil router.delete ke assetServices.activities.removeFile dengan id activity+file yang benar", async () => {
      const user = userEvent.setup({ delay: null });
      const assetService = baseAssetService({
        activities: [
          {
            id: 9,
            description: "Cek oli",
            pic: null,
            action_date: null,
            status: "in_progress",
            files: [{ id: 55, name: "foto.jpg" }],
          },
        ],
      });
      render(<ServiceActivityLog assetService={assetService} />);

      await user.click(screen.getByText("Cek oli"));
      const dialog = screen.getByRole("dialog");
      expect(within(dialog).getByText("foto.jpg")).toBeInTheDocument();

      const removeButtons = within(dialog)
        .getAllByRole("button")
        .filter((b) => b.querySelector("svg.lucide-x"));
      await user.click(removeButtons[0]);

      expect(routerDelete).toHaveBeenCalledWith(
        "assetServices.activities.removeFile/9,55",
        expect.objectContaining({ preserveScroll: true }),
      );
    });

    it("mode create: hapus file dari daftar SEBELUM Simpan cukup lokal, tidak memanggil router.delete", async () => {
      const user = userEvent.setup({ delay: null });
      render(<ServiceActivityLog assetService={baseAssetService()} />);

      await user.click(
        screen.getByRole("button", { name: "asset.service.activity.add" }),
      );
      const dialog = screen.getByRole("dialog");
      await user.click(within(dialog).getByText("fake-buffer-upload"));
      expect(within(dialog).getByText("lampiran-baru.pdf")).toBeInTheDocument();

      const removeButtons = within(dialog)
        .getAllByRole("button")
        .filter((b) => b.querySelector("svg.lucide-x"));
      await user.click(removeButtons[0]);

      expect(
        within(dialog).queryByText("lampiran-baru.pdf"),
      ).not.toBeInTheDocument();
      expect(routerDelete).not.toHaveBeenCalled();
    });
  });
});
