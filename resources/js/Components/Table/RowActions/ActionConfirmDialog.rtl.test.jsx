import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

vi.mock("laravel-react-i18n", () => ({
  useLaravelReactI18n: () => ({
    t: (k, p) => (p ? `TR:${k}:${JSON.stringify(p)}` : `TR:${k}`),
  }),
}));

import ActionConfirmDialog from "./ActionConfirmDialog";

function setup(props = {}) {
  const onConfirm = vi.fn();
  const onOpenChange = vi.fn();
  const utils = render(
    <ActionConfirmDialog
      open
      title="Judul"
      description="Deskripsi"
      onConfirm={onConfirm}
      onOpenChange={onOpenChange}
      {...props}
    />,
  );
  return { onConfirm, onOpenChange, ...utils };
}

describe("ActionConfirmDialog", () => {
  it("render title dan description", () => {
    setup();
    expect(screen.getByText("Judul")).toBeInTheDocument();
    expect(screen.getByText("Deskripsi")).toBeInTheDocument();
  });

  it("tidak render apa pun saat open=false", () => {
    setup({ open: false });
    expect(screen.queryByText("Judul")).not.toBeInTheDocument();
  });

  it("label konfirmasi default memakai i18n, bisa di-override", () => {
    const { rerender } = setup();
    expect(
      screen.getByRole("button", { name: "TR:core.datatable.confirm" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "TR:core.datatable.cancel" }),
    ).toBeInTheDocument();

    rerender(
      <ActionConfirmDialog
        open
        title="Judul"
        confirmLabel="Hapus"
        onConfirm={vi.fn()}
        onOpenChange={vi.fn()}
      />,
    );
    expect(screen.getByRole("button", { name: "Hapus" })).toBeInTheDocument();
  });

  it("tanpa requirePassword tidak ada input password", () => {
    setup();
    expect(document.querySelector('input[type="password"]')).toBeNull();
  });

  it("klik konfirmasi memanggil onConfirm(password) dan tidak menutup dialog", async () => {
    const user = userEvent.setup();
    const { onConfirm, onOpenChange } = setup({ requirePassword: true });

    const input = document.querySelector('input[type="password"]');
    expect(input).not.toBeNull();
    await user.type(input, "rahasia");
    await user.click(
      screen.getByRole("button", { name: "TR:core.datatable.confirm" }),
    );

    expect(onConfirm).toHaveBeenCalledWith("rahasia");
    expect(onOpenChange).not.toHaveBeenCalled();
  });

  it("tanpa requirePassword onConfirm dipanggil dengan string kosong", async () => {
    const user = userEvent.setup();
    const { onConfirm } = setup();

    await user.click(
      screen.getByRole("button", { name: "TR:core.datatable.confirm" }),
    );

    expect(onConfirm).toHaveBeenCalledWith("");
  });

  it("tombol batal memanggil onOpenChange(false)", async () => {
    const user = userEvent.setup();
    const { onOpenChange } = setup();

    await user.click(
      screen.getByRole("button", { name: "TR:core.datatable.cancel" }),
    );

    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("menampilkan errors.password, errors.delete, dan errors.ids", () => {
    setup({
      requirePassword: true,
      errors: {
        password: "Password salah",
        delete: "Tidak bisa dihapus",
        ids: "Id tidak valid",
      },
    });

    expect(screen.getByText("Password salah")).toBeInTheDocument();
    expect(screen.getByText("Tidak bisa dihapus")).toBeInTheDocument();
    expect(screen.getByText("Id tidak valid")).toBeInTheDocument();
  });

  it("tombol konfirmasi dan batal disabled saat processing", () => {
    setup({ processing: true });

    expect(
      screen.getByRole("button", { name: "TR:core.datatable.confirm" }),
    ).toBeDisabled();
    expect(
      screen.getByRole("button", { name: "TR:core.datatable.cancel" }),
    ).toBeDisabled();
  });

  it("tombol konfirmasi destruktif memakai variant destructive", () => {
    setup({ destructive: true });

    expect(
      screen.getByRole("button", { name: "TR:core.datatable.confirm" }),
    ).toHaveClass("bg-destructive");
  });

  it("password direset saat dialog ditutup lalu dibuka lagi", async () => {
    const user = userEvent.setup();
    const props = {
      title: "Judul",
      requirePassword: true,
      onConfirm: vi.fn(),
      onOpenChange: vi.fn(),
    };
    const { rerender } = render(<ActionConfirmDialog open {...props} />);

    await user.type(document.querySelector('input[type="password"]'), "abc");
    rerender(<ActionConfirmDialog open={false} {...props} />);
    rerender(<ActionConfirmDialog open {...props} />);

    expect(document.querySelector('input[type="password"]')).toHaveValue("");
  });
});
