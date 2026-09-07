import { describe, expect, it, vi, beforeEach } from "vitest";
import { act, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

// ============================================================================
// ServiceActivityLog.jsx merender 3 komponen:
// - ActivityFormDialog (internal, tidak diexport): dialog add/edit satu
//   activity, submit via router.post (create) / router.put (update).
// - CompleteConfirmDialog (internal): dialog konfirmasi
//   router.post(assetServices.complete).
// - ServiceActivityLog (default export): daftar activity + checkbox toggle
//   is_done (router.put) + tombol "Mark Complete" (tampil hanya kalau semua
//   activity is_done, activities.length > 0).
//
// Dialog (@/Components/ui/dialog, Radix) & Checkbox (@/Components/ui/checkbox)
// DIRENDER SUNGGUHAN (tidak distub) -- pola sama seperti
// AssignDialog.rtl.test.jsx & Asset/Maintenances/Show.rtl.test.jsx. Checkbox
// custom di-set role="forminput" (bukan default "checkbox"), lihat
// Components/ui/checkbox.jsx.
//
// DatetimePicker & UserLinkModel distub jadi tombol yang memanggil
// onValueChange dengan nilai tetap saat diklik -- pola sama seperti
// AssetLinkModel di Asset/Maintenances/Show.rtl.test.jsx.
//
// FIX (sebelumnya BUG, lihat riwayat git): ActivityFormDialog selalu
// dirender oleh parent (tidak dibungkus kondisional oleh `dialogOpen` --
// dialognya sendiri yang punya prop `open`). `useState(activity ?? {...})`
// bukan lazy-initializer function, cuma jalan sekali saat mount pertama --
// tanpa remount, form tidak pernah reset ke data activity yang sedang
// di-edit. Fix: parent (`ServiceActivityLog`) memberi `key={activity.id}` ke
// `<ActivityFormDialog>`, memaksa React unmount+remount tiap ganti activity
// yang diedit, sehingga useState initializer re-run dengan data yang benar.
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
}));

vi.mock("@/Components/Link", () => ({
  default: ({ href, children }) => <a href={href}>{children}</a>,
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
  default: ({ value, onValueChange }) => (
    <button
      type="button"
      data-testid="datetime-picker"
      onClick={() => onValueChange("2026-09-10")}
    >
      date:{value ?? "none"}
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

import ServiceActivityLog from "./ServiceActivityLog";

const baseAssetService = (overrides = {}) => ({
  id: 1,
  activities: [],
  ...overrides,
});

describe("ServiceActivityLog", () => {
  beforeEach(() => {
    routerPut.mockReset();
    routerPost.mockReset();
    routerDelete.mockReset();
  });

  it("activities kosong: menampilkan empty state, tombol Mark Complete tidak tampil", () => {
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

  it("menampilkan daftar activity dengan description, nama pic, dan action_date", () => {
    const assetService = baseAssetService({
      activities: [
        {
          id: 1,
          description: "Cek oli",
          pic: { id: 2, name: "Budi" },
          action_date: "2026-09-01",
          is_done: false,
        },
      ],
    });
    render(<ServiceActivityLog assetService={assetService} />);

    expect(screen.getByText("Cek oli")).toBeInTheDocument();
    expect(screen.getByText("Budi — 2026-09-01")).toBeInTheDocument();
    expect(
      screen.queryByText("asset.service.activity.empty"),
    ).not.toBeInTheDocument();
  });

  it("checkbox baris mengikuti field is_done tiap activity", () => {
    const assetService = baseAssetService({
      activities: [
        {
          id: 1,
          description: "A",
          pic: null,
          action_date: null,
          is_done: true,
        },
        {
          id: 2,
          description: "B",
          pic: null,
          action_date: null,
          is_done: false,
        },
      ],
    });
    render(<ServiceActivityLog assetService={assetService} />);

    const [checkboxA, checkboxB] = screen.getAllByRole("forminput");
    expect(checkboxA).toHaveAttribute("aria-checked", "true");
    expect(checkboxB).toHaveAttribute("aria-checked", "false");
  });

  it("klik checkbox baris memanggil router.put toggleDone dengan is_done dibalik, TIDAK membuka dialog edit", async () => {
    const user = userEvent.setup({ delay: null });
    const assetService = baseAssetService({
      activities: [
        {
          id: 5,
          description: "Cek oli",
          pic: { id: 2, name: "Budi" },
          action_date: "2026-09-01",
          is_done: false,
        },
      ],
    });
    render(<ServiceActivityLog assetService={assetService} />);

    await user.click(screen.getByRole("forminput"));

    expect(routerPut).toHaveBeenCalledTimes(1);
    expect(routerPut).toHaveBeenCalledWith(
      "assetServices.activities.update/5",
      {
        action_date: "2026-09-01",
        pic_id: 2,
        description: "Cek oli",
        is_done: true,
      },
    );
    // stopPropagation di checkbox mencegah klik memicu openEdit (onClick
    // parent row) -- dialog edit tidak boleh terbuka.
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
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

  it("klik baris activity untuk edit membuka dialog dengan title 'edit' dan form TERISI data activity yang diklik", async () => {
    const user = userEvent.setup({ delay: null });
    const assetService = baseAssetService({
      activities: [
        {
          id: 9,
          description: "Cek oli",
          pic: { id: 2, name: "Budi" },
          action_date: "2026-09-01",
          is_done: true,
        },
      ],
    });
    render(<ServiceActivityLog assetService={assetService} />);

    await user.click(screen.getByText("Cek oli"));

    const dialog = screen.getByRole("dialog");
    expect(
      within(dialog).getByText("asset.service.activity.edit"),
    ).toBeInTheDocument();

    // Fix: ActivityFormDialog diberi key={activity.id} di parent supaya
    // React remount komponen (dan re-init useState) tiap ganti activity yang
    // diedit -- form HARUS terisi "Cek oli"/Budi/2026-09-01/is_done=true
    // milik activity yang diklik, bukan kosong.
    expect(
      within(dialog).getByPlaceholderText("asset.service.activity.description"),
    ).toHaveValue("Cek oli");
    expect(within(dialog).getByTestId("datetime-picker")).toHaveTextContent(
      "date:2026-09-01",
    );
    expect(within(dialog).getByTestId("user-link-model")).toHaveTextContent(
      "pic:Budi",
    );
    const isDoneCheckbox = within(dialog).getByRole("forminput");
    expect(isDoneCheckbox).toHaveAttribute("aria-checked", "true");
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
          is_done: true,
        },
        {
          id: 10,
          description: "Ganti ban",
          pic: null,
          action_date: null,
          is_done: false,
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
  });

  it("mengisi form Add lalu submit memanggil router.post ke assetServices.activities.store dengan payload sesuai input", async () => {
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
    await user.click(within(dialog).getByRole("forminput"));

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
        is_done: true,
      },
      expect.objectContaining({ onFinish: expect.any(Function) }),
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

  it("onFinish menutup dialog add/edit setelah submit", async () => {
    let onFinishCb;
    routerPost.mockImplementation((_url, _payload, options) => {
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

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("tombol Mark Complete tampil hanya kalau SEMUA activity is_done=true", () => {
    const allDone = baseAssetService({
      activities: [
        {
          id: 1,
          description: "A",
          pic: null,
          action_date: null,
          is_done: true,
        },
        {
          id: 2,
          description: "B",
          pic: null,
          action_date: null,
          is_done: true,
        },
      ],
    });
    const { rerender } = render(<ServiceActivityLog assetService={allDone} />);
    expect(
      screen.getByRole("button", {
        name: "asset.service.activity.mark_complete",
      }),
    ).toBeInTheDocument();

    const notAllDone = baseAssetService({
      activities: [
        {
          id: 1,
          description: "A",
          pic: null,
          action_date: null,
          is_done: true,
        },
        {
          id: 2,
          description: "B",
          pic: null,
          action_date: null,
          is_done: false,
        },
      ],
    });
    rerender(<ServiceActivityLog assetService={notAllDone} />);
    expect(
      screen.queryByRole("button", {
        name: "asset.service.activity.mark_complete",
      }),
    ).not.toBeInTheDocument();
  });

  it("klik Mark Complete membuka dialog konfirmasi complete", async () => {
    const user = userEvent.setup({ delay: null });
    const assetService = baseAssetService({
      activities: [
        {
          id: 1,
          description: "A",
          pic: null,
          action_date: null,
          is_done: true,
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
      within(dialog).getByText("asset.service.activity.confirm_complete"),
    ).toBeInTheDocument();
    expect(
      within(dialog).getByText(
        "asset.service.activity.confirm_complete_description",
      ),
    ).toBeInTheDocument();
  });

  it("klik confirm pada dialog complete memanggil router.post ke assetServices.complete dengan assetService.id", async () => {
    const user = userEvent.setup({ delay: null });
    const assetService = baseAssetService({
      id: 42,
      activities: [
        {
          id: 1,
          description: "A",
          pic: null,
          action_date: null,
          is_done: true,
        },
      ],
    });
    render(<ServiceActivityLog assetService={assetService} />);

    await user.click(
      screen.getByRole("button", {
        name: "asset.service.activity.mark_complete",
      }),
    );
    await user.click(
      within(screen.getByRole("dialog")).getByRole("button", {
        name: "asset.service.activity.confirm_complete_action",
      }),
    );

    expect(routerPost).toHaveBeenCalledTimes(1);
    expect(routerPost).toHaveBeenCalledWith(
      "assetServices.complete/42",
      {},
      expect.objectContaining({ onFinish: expect.any(Function) }),
    );
  });

  it("tombol confirm complete disabled selagi loading, kembali aktif setelah onFinish", async () => {
    let onFinishCb;
    routerPost.mockImplementation((_url, _payload, options) => {
      onFinishCb = options.onFinish;
    });
    const user = userEvent.setup({ delay: null });
    const assetService = baseAssetService({
      activities: [
        {
          id: 1,
          description: "A",
          pic: null,
          action_date: null,
          is_done: true,
        },
      ],
    });
    render(<ServiceActivityLog assetService={assetService} />);

    await user.click(
      screen.getByRole("button", {
        name: "asset.service.activity.mark_complete",
      }),
    );
    const confirmButton = within(screen.getByRole("dialog")).getByRole(
      "button",
      { name: "asset.service.activity.confirm_complete_action" },
    );
    await user.click(confirmButton);

    expect(confirmButton).toBeDisabled();

    act(() => {
      onFinishCb();
    });

    expect(confirmButton).not.toBeDisabled();
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
            is_done: false,
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
            is_done: false,
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
            is_done: false,
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
            is_done: false,
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
