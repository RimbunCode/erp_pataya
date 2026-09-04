import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

// t stabil TR:<key> -- pola acuan dari BadgeStatus.rtl.test.jsx/Tags.rtl.test.jsx.
const stableT = (key) => `TR:${key}`;
vi.mock("laravel-react-i18n", () => ({
  useLaravelReactI18n: () => ({ t: stableT }),
}));

const usePageMock = vi.fn();
const routerDelete = vi.fn();
vi.mock("@inertiajs/react", () => ({
  usePage: () => usePageMock(),
  router: {
    delete: (...a) => routerDelete(...a),
  },
}));

// window.route asli DeleteDialog.jsx cuma window.route(name, id) -- stub
// deterministik supaya URL yang diteruskan ke router.delete bisa diverifikasi.
window.route = (name, id) => `route:${name}:${id}`;

import DeleteDialog from "./DeleteDialog";
import useDeleteModal from "@/Hooks/useDeleteModal";

// useDeleteModal adalah zustand store SUNGGUHAN (bukan context) -- inilah
// justru concern utama DeleteDialog (konsumsi isOpen/route/id/attributes +
// panggil close()), jadi TIDAK di-mock di sini (beda dgn DataTable2.rtl.test.jsx
// yang men-treat DeleteDialog sbg orkestrasi terpisah). Reset ke state awal
// sebelum & sesudah tiap test spy state store tidak bocor antar test.
function resetStore() {
  act(() => {
    useDeleteModal.setState({
      isOpen: false,
      route: null,
      id: null,
      attributes: {},
    });
  });
}

beforeEach(() => {
  usePageMock.mockReset();
  usePageMock.mockReturnValue({ props: { translateKey: "items" } });
  routerDelete.mockReset();
  resetStore();
});

afterEach(() => {
  resetStore();
});

describe("DeleteDialog — render dasar (tertutup)", () => {
  it("tidak menampilkan alertdialog saat store isOpen=false (state awal)", () => {
    render(<DeleteDialog />);

    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
  });
});

describe("DeleteDialog — render dasar (terbuka)", () => {
  beforeEach(() => {
    act(() => {
      useDeleteModal.getState().deleteItem("items.destroy", 5);
    });
  });

  it("menampilkan title & description hasil t() memakai translateKey dari usePage", () => {
    render(<DeleteDialog />);

    expect(
      screen.getByRole("alertdialog", { name: "TR:items.delete" }),
    ).toBeInTheDocument();
    expect(screen.getByText("TR:items.delete.description")).toBeInTheDocument();
  });

  it("tombol Cancel & Confirm menampilkan label terjemahan yang benar", () => {
    render(<DeleteDialog />);

    expect(
      screen.getByRole("button", { name: "TR:core.form.leave.cancel" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "TR:items.delete.confirm" }),
    ).toBeInTheDocument();
  });

  it("tidak menampilkan input password saat attributes.usePasswordConfirmation falsy (default)", () => {
    render(<DeleteDialog />);

    expect(
      screen.queryByLabelText(/TR:auth\.your_password/),
    ).not.toBeInTheDocument();
  });
});

describe("DeleteDialog — konfirmasi password (attributes.usePasswordConfirmation)", () => {
  beforeEach(() => {
    act(() => {
      useDeleteModal
        .getState()
        .deleteItem("users.destroy", 7, { usePasswordConfirmation: true });
    });
  });

  it("menampilkan FormInput password wajib diisi", () => {
    render(<DeleteDialog />);

    const input = screen.getByLabelText(/TR:auth\.your_password/);
    expect(input).toBeInTheDocument();
    expect(input).toBeRequired();
    expect(input).toHaveAttribute("type", "password");
  });

  it("mengetik di input password memperbarui value yang ditampilkan", async () => {
    const user = userEvent.setup();
    render(<DeleteDialog />);

    const input = screen.getByLabelText(/TR:auth\.your_password/);
    await user.type(input, "rahasia");

    expect(input).toHaveValue("rahasia");
  });

  it("password direset ke string kosong setelah dialog ditutup lalu dibuka lagi", async () => {
    const user = userEvent.setup();
    render(<DeleteDialog />);

    const input = screen.getByLabelText(/TR:auth\.your_password/);
    await user.type(input, "rahasia");
    expect(input).toHaveValue("rahasia");

    act(() => {
      useDeleteModal.getState().close();
    });
    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();

    act(() => {
      useDeleteModal
        .getState()
        .deleteItem("users.destroy", 7, { usePasswordConfirmation: true });
    });

    expect(screen.getByLabelText(/TR:auth\.your_password/)).toHaveValue("");
  });
});

describe("DeleteDialog — submit (onDelete -> router.delete)", () => {
  it("submit tanpa usePasswordConfirmation memanggil router.delete dgn URL & payload data kosong", async () => {
    const user = userEvent.setup();
    act(() => {
      useDeleteModal.getState().deleteItem("items.destroy", 5);
    });
    render(<DeleteDialog />);

    await user.click(
      screen.getByRole("button", { name: "TR:items.delete.confirm" }),
    );

    expect(routerDelete).toHaveBeenCalledTimes(1);
    expect(routerDelete).toHaveBeenCalledWith(
      "route:items.destroy:5",
      expect.objectContaining({
        data: {},
        onSuccess: expect.any(Function),
      }),
    );
  });

  it("submit dgn usePasswordConfirmation menyertakan password yg diketik sbg payload data", async () => {
    const user = userEvent.setup();
    act(() => {
      useDeleteModal
        .getState()
        .deleteItem("users.destroy", 7, { usePasswordConfirmation: true });
    });
    render(<DeleteDialog />);

    await user.type(
      screen.getByLabelText(/TR:auth\.your_password/),
      "rahasia123",
    );
    // Label tombol confirm mengikuti translateKey dari usePage() props
    // ("items", di-set default lewat beforeEach), TIDAK terkait nama route
    // delete ("users.destroy") yang dipakai di kasus ini.
    await user.click(
      screen.getByRole("button", { name: "TR:items.delete.confirm" }),
    );

    expect(routerDelete).toHaveBeenCalledWith(
      "route:users.destroy:7",
      expect.objectContaining({ data: { password: "rahasia123" } }),
    );
  });

  it("memanggil onSuccess dari router.delete membuat store isOpen=false (closeDeleteDialog)", async () => {
    const user = userEvent.setup();
    act(() => {
      useDeleteModal.getState().deleteItem("items.destroy", 5);
    });
    render(<DeleteDialog />);

    await user.click(
      screen.getByRole("button", { name: "TR:items.delete.confirm" }),
    );

    const { onSuccess } = routerDelete.mock.calls[0][1];
    act(() => {
      onSuccess();
    });

    expect(useDeleteModal.getState().isOpen).toBe(false);
  });

  it("dialog TETAP terbuka setelah tombol Confirm diklik, sampai onSuccess/onError dari router.delete direspons", async () => {
    const user = userEvent.setup();
    act(() => {
      useDeleteModal.getState().deleteItem("items.destroy", 5);
    });
    render(<DeleteDialog />);
    expect(screen.getByRole("alertdialog")).toBeInTheDocument();

    await user.click(
      screen.getByRole("button", { name: "TR:items.delete.confirm" }),
    );

    // Request tetap terkirim...
    expect(routerDelete).toHaveBeenCalledTimes(1);
    // ...dan dialog TETAP terlihat, karena penutupan cuma dikendalikan oleh
    // closeDeleteDialog() di callback onSuccess (mock router.delete di test
    // ini tidak meng-invoke callback-nya sendiri).
    expect(screen.getByRole("alertdialog")).toBeInTheDocument();
  });
});

describe("DeleteDialog — guard klausa deleteRoute/deleteId (onDelete)", () => {
  it("deleteRoute null -> submit tidak memanggil router.delete", async () => {
    const user = userEvent.setup();
    act(() => {
      useDeleteModal.setState({
        isOpen: true,
        route: null,
        id: 5,
        attributes: {},
      });
    });
    render(<DeleteDialog />);

    await user.click(
      screen.getByRole("button", { name: "TR:items.delete.confirm" }),
    );

    expect(routerDelete).not.toHaveBeenCalled();
  });

  it("deleteId=0 (falsy tapi bukan null/undefined) TETAP memanggil router.delete -- guard pakai '== null', bukan truthy check", async () => {
    const user = userEvent.setup();
    act(() => {
      useDeleteModal.setState({
        isOpen: true,
        route: "items.destroy",
        id: 0,
        attributes: {},
      });
    });
    render(<DeleteDialog />);

    await user.click(
      screen.getByRole("button", { name: "TR:items.delete.confirm" }),
    );

    expect(routerDelete).toHaveBeenCalledWith(
      "route:items.destroy:0",
      expect.objectContaining({ data: {} }),
    );
  });
});

describe("DeleteDialog — tutup dialog (Cancel & Escape)", () => {
  it("klik Cancel menutup dialog & TIDAK memanggil router.delete", async () => {
    const user = userEvent.setup();
    act(() => {
      useDeleteModal.getState().deleteItem("items.destroy", 5);
    });
    render(<DeleteDialog />);

    await user.click(
      screen.getByRole("button", { name: "TR:core.form.leave.cancel" }),
    );

    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
    expect(useDeleteModal.getState().isOpen).toBe(false);
    expect(routerDelete).not.toHaveBeenCalled();
  });

  it("menekan Escape menutup dialog (closeDeleteDialog via onOpenChange/handleKeyDown)", async () => {
    const user = userEvent.setup();
    act(() => {
      useDeleteModal.getState().deleteItem("items.destroy", 5);
    });
    render(<DeleteDialog />);
    expect(screen.getByRole("alertdialog")).toBeInTheDocument();

    await user.keyboard("{Escape}");

    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
    expect(useDeleteModal.getState().isOpen).toBe(false);
  });
});
