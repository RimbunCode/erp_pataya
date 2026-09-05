import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

// GuestLayout membungkus MasterLayout + Avatar + Card (lihat
// Layouts/GuestLayout.rtl.test.jsx utk test khusus komposisinya sendiri).
// Di sini stub jadi passthrough supaya test fokus ke ResetPassword saja.
vi.mock("@/Layouts/GuestLayout", () => ({
  default: ({ children }) => (
    <div data-testid="stub-guest-layout">{children}</div>
  ),
}));

const useFormReturn = {
  data: { token: "", email: "", password: "", password_confirmation: "" },
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

import ResetPassword from "./ResetPassword";

describe("Auth ResetPassword", () => {
  beforeEach(() => {
    useFormReturn.data = {
      token: "",
      email: "",
      password: "",
      password_confirmation: "",
    };
    useFormReturn.setData.mockReset();
    useFormReturn.post.mockReset();
    useFormReturn.processing = false;
    useFormReturn.errors = {};
    useFormReturn.reset.mockReset();
  });

  it("merender tanpa error dengan field kosong", async () => {
    await act(async () => {
      render(<ResetPassword token="tok-123" email="" />);
    });

    expect(screen.getByLabelText("Email")).toHaveValue("");
    expect(screen.getByLabelText("Password")).toHaveValue("");
    expect(screen.getByLabelText("Confirm Password")).toHaveValue("");
    expect(
      screen.getByRole("button", { name: "Reset Password" }),
    ).toBeInTheDocument();
  });

  it("field email terisi dari data awal useForm (token dari props)", async () => {
    useFormReturn.data = {
      token: "tok-123",
      email: "user@example.com",
      password: "",
      password_confirmation: "",
    };

    await act(async () => {
      render(<ResetPassword token="tok-123" email="user@example.com" />);
    });

    expect(screen.getByLabelText("Email")).toHaveValue("user@example.com");
  });

  it("mengetik di field email memanggil setData dengan key & value yang benar", async () => {
    const user = userEvent.setup({ delay: null });
    await act(async () => {
      render(<ResetPassword token="tok-123" email="" />);
    });

    await user.type(screen.getByLabelText("Email"), "a");

    expect(useFormReturn.setData).toHaveBeenCalledWith("email", "a");
  });

  it("mengetik di field password memanggil setData dengan key & value yang benar", async () => {
    const user = userEvent.setup({ delay: null });
    await act(async () => {
      render(<ResetPassword token="tok-123" email="" />);
    });

    await user.type(screen.getByLabelText("Password"), "x");

    expect(useFormReturn.setData).toHaveBeenCalledWith("password", "x");
  });

  it("mengetik di field confirm password memanggil setData dengan key & value yang benar", async () => {
    const user = userEvent.setup({ delay: null });
    await act(async () => {
      render(<ResetPassword token="tok-123" email="" />);
    });

    await user.type(screen.getByLabelText("Confirm Password"), "y");

    expect(useFormReturn.setData).toHaveBeenCalledWith(
      "password_confirmation",
      "y",
    );
  });

  it("submit memanggil post ke route password.store dengan onFinish yang me-reset password & password_confirmation", async () => {
    const user = userEvent.setup({ delay: null });
    await act(async () => {
      render(<ResetPassword token="tok-123" email="user@example.com" />);
    });

    await user.click(screen.getByRole("button", { name: "Reset Password" }));

    expect(useFormReturn.post).toHaveBeenCalledTimes(1);
    expect(useFormReturn.post).toHaveBeenCalledWith(
      "password.store",
      expect.objectContaining({ onFinish: expect.any(Function) }),
    );

    // Verifikasi efek onFinish memanggil reset("password", "password_confirmation")
    // sesuai source.
    const options = useFormReturn.post.mock.calls[0][1];
    options.onFinish();
    expect(useFormReturn.reset).toHaveBeenCalledWith(
      "password",
      "password_confirmation",
    );
  });

  it("menampilkan pesan error validasi utk email, password, dan confirm password", async () => {
    useFormReturn.errors = {
      email: "Email tidak valid.",
      password: "Password terlalu pendek.",
      password_confirmation: "Konfirmasi tidak cocok.",
    };

    await act(async () => {
      render(<ResetPassword token="tok-123" email="user@example.com" />);
    });

    expect(screen.getByText("Email tidak valid.")).toBeInTheDocument();
    expect(screen.getByText("Password terlalu pendek.")).toBeInTheDocument();
    expect(screen.getByText("Konfirmasi tidak cocok.")).toBeInTheDocument();
  });

  it("tidak menampilkan pesan error apa pun bila errors kosong", async () => {
    await act(async () => {
      render(<ResetPassword token="tok-123" email="user@example.com" />);
    });

    expect(
      screen.queryByText(/tidak valid|terlalu pendek|tidak cocok/i),
    ).not.toBeInTheDocument();
  });

  it("tombol Reset Password disabled saat processing=true", async () => {
    useFormReturn.processing = true;

    await act(async () => {
      render(<ResetPassword token="tok-123" email="user@example.com" />);
    });

    expect(
      screen.getByRole("button", { name: "Reset Password" }),
    ).toBeDisabled();
  });

  it("tombol Reset Password tidak disabled saat processing=false", async () => {
    await act(async () => {
      render(<ResetPassword token="tok-123" email="user@example.com" />);
    });

    expect(
      screen.getByRole("button", { name: "Reset Password" }),
    ).not.toBeDisabled();
  });
});
