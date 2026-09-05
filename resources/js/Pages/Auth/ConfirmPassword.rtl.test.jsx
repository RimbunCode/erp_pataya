import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

// GuestLayout membungkus MasterLayout + Avatar + Card (lihat
// Layouts/GuestLayout.rtl.test.jsx utk test khusus komposisinya sendiri).
// Di sini stub jadi passthrough supaya test fokus ke ConfirmPassword saja.
vi.mock("@/Layouts/GuestLayout", () => ({
  default: ({ children }) => (
    <div data-testid="stub-guest-layout">{children}</div>
  ),
}));

const useFormReturn = {
  data: { password: "" },
  setData: vi.fn(),
  post: vi.fn(),
  processing: false,
  errors: {},
  reset: vi.fn(),
};
vi.mock("@inertiajs/react", () => ({
  Head: ({ title }) => <title>{title}</title>,
  useForm: () => useFormReturn,
}));

window.route = (name) => name;

import ConfirmPassword from "./ConfirmPassword";

describe("Auth ConfirmPassword", () => {
  beforeEach(() => {
    useFormReturn.data = { password: "" };
    useFormReturn.setData.mockReset();
    useFormReturn.post.mockReset();
    useFormReturn.processing = false;
    useFormReturn.errors = {};
    useFormReturn.reset.mockReset();
  });

  it("merender tanpa error dengan field password kosong", async () => {
    await act(async () => {
      render(<ConfirmPassword />);
    });

    expect(
      screen.getByText(
        "This is a secure area of the application. Please confirm your password before continuing.",
      ),
    ).toBeInTheDocument();
    expect(screen.getByLabelText("Password")).toHaveValue("");
    expect(screen.getByRole("button", { name: "Confirm" })).toBeInTheDocument();
  });

  it("field password terisi dari data awal useForm", async () => {
    useFormReturn.data = { password: "rahasia123" };

    await act(async () => {
      render(<ConfirmPassword />);
    });

    expect(screen.getByLabelText("Password")).toHaveValue("rahasia123");
  });

  it("mengetik di field password memanggil setData dengan key & value yang benar", async () => {
    const user = userEvent.setup({ delay: null });
    await act(async () => {
      render(<ConfirmPassword />);
    });

    await user.type(screen.getByLabelText("Password"), "x");

    expect(useFormReturn.setData).toHaveBeenCalledWith("password", "x");
  });

  it("submit memanggil post ke route password.confirm dengan onFinish yang me-reset password", async () => {
    const user = userEvent.setup({ delay: null });
    await act(async () => {
      render(<ConfirmPassword />);
    });

    await user.click(screen.getByRole("button", { name: "Confirm" }));

    expect(useFormReturn.post).toHaveBeenCalledTimes(1);
    expect(useFormReturn.post).toHaveBeenCalledWith(
      "password.confirm",
      expect.objectContaining({ onFinish: expect.any(Function) }),
    );

    // Verifikasi efek onFinish memanggil reset("password") sesuai source.
    const options = useFormReturn.post.mock.calls[0][1];
    options.onFinish();
    expect(useFormReturn.reset).toHaveBeenCalledWith("password");
  });

  it("menampilkan pesan error validasi password bila errors.password terisi", async () => {
    useFormReturn.errors = { password: "Password salah." };

    await act(async () => {
      render(<ConfirmPassword />);
    });

    expect(screen.getByText("Password salah.")).toBeInTheDocument();
  });

  it("tidak menampilkan pesan error apa pun bila errors kosong", async () => {
    await act(async () => {
      render(<ConfirmPassword />);
    });

    expect(screen.queryByText(/salah/i)).not.toBeInTheDocument();
  });

  it("tombol Confirm disabled saat processing=true", async () => {
    useFormReturn.processing = true;

    await act(async () => {
      render(<ConfirmPassword />);
    });

    expect(screen.getByRole("button", { name: "Confirm" })).toBeDisabled();
  });

  it("tombol Confirm tidak disabled saat processing=false", async () => {
    await act(async () => {
      render(<ConfirmPassword />);
    });

    expect(screen.getByRole("button", { name: "Confirm" })).not.toBeDisabled();
  });
});
