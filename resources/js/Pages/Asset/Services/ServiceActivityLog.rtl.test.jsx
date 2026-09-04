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
// BUG (lihat bugFindings): ActivityFormDialog selalu dirender (tidak
// dibungkus kondisional oleh `dialogOpen`), jadi ia mount SEKALI dengan
// activity=null (nilai awal editingActivity). `useState(activity ?? {...})`
// bukan lazy-initializer function, jadi form TIDAK PERNAH reset ke data
// activity yang sedang di-edit -- form tetap kosong walau membuka dialog
// edit pada activity yang sudah berisi data.
// ============================================================================

const stableT = (key) => key;
vi.mock("laravel-react-i18n", () => ({
  useLaravelReactI18n: () => ({ t: stableT }),
}));

window.route = (name, id) => `${name}/${id}`;

const routerPut = vi.fn();
const routerPost = vi.fn();
vi.mock("@inertiajs/react", () => ({
  router: {
    put: (...a) => routerPut(...a),
    post: (...a) => routerPost(...a),
  },
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

  it("BUG (lihat bugFindings): klik baris activity untuk edit membuka dialog dengan title 'edit', tapi form TETAP KOSONG (data activity tidak ter-load)", async () => {
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

    // Title bilang "edit", tapi field form kosong -- bukan "Cek oli"/Budi/
    // 2026-09-01/is_done=true milik activity yang diklik.
    expect(
      within(dialog).getByPlaceholderText("asset.service.activity.description"),
    ).toHaveValue("");
    expect(within(dialog).getByTestId("datetime-picker")).toHaveTextContent(
      "date:none",
    );
    expect(within(dialog).getByTestId("user-link-model")).toHaveTextContent(
      "pic:none",
    );
    const isDoneCheckbox = within(dialog).getByRole("forminput");
    expect(isDoneCheckbox).toHaveAttribute("aria-checked", "false");
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
});
