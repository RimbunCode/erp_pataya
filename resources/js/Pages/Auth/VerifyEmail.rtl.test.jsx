import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

// GuestLayout membungkus MasterLayout + Avatar + Card (lihat
// Layouts/GuestLayout.rtl.test.jsx utk test khusus komposisinya sendiri).
// Di sini stub jadi passthrough supaya test fokus ke VerifyEmail saja, pola
// sama dgn Auth/ConfirmPassword.rtl.test.jsx & Auth/ForgotPassword.rtl.test.jsx.
vi.mock("@/Layouts/GuestLayout", () => ({
  default: ({ children }) => (
    <div data-testid="stub-guest-layout">{children}</div>
  ),
}));

// Link (Inertia custom) butuh router @inertiajs/core sungguhan utk
// method="post" as="button" -- stub jadi <a> polos, pola sama dgn
// Pages/Core/Todos/Show.rtl.test.jsx.
vi.mock("@/Components/Link", () => ({
  default: ({ children, href, ...rest }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

const useFormReturn = {
  data: {},
  setData: vi.fn(),
  post: vi.fn(),
  processing: false,
  errors: {},
};
vi.mock("@inertiajs/react", () => ({
  Head: ({ title }) => <title>{title}</title>,
  useForm: () => useFormReturn,
}));

window.route = vi.fn((name) => name);

import VerifyEmail from "./VerifyEmail";

async function renderPage(props = {}) {
  let utils;
  await act(async () => {
    utils = render(<VerifyEmail {...props} />);
  });
  return utils;
}

beforeEach(() => {
  window.route.mockClear();
  useFormReturn.data = {};
  useFormReturn.setData.mockReset();
  useFormReturn.post.mockReset();
  useFormReturn.processing = false;
  useFormReturn.errors = {};
});

describe("Auth VerifyEmail", () => {
  it("merender tanpa error dengan pesan deskripsi & tombol resend", async () => {
    await renderPage();

    expect(screen.getByTestId("stub-guest-layout")).toBeInTheDocument();
    expect(screen.getByText(/Thanks for signing up!/)).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Resend Verification Email" }),
    ).toBeInTheDocument();
  });

  it("mengatur document title lewat Head menjadi 'Email Verification'", async () => {
    await renderPage();

    expect(document.title).toBe("Email Verification");
  });

  it("tidak menampilkan pesan status bila prop status tidak diberikan", async () => {
    await renderPage();

    expect(
      screen.queryByText(/A new verification link has been sent/),
    ).not.toBeInTheDocument();
  });

  it("menampilkan pesan status ketika status='verification-link-sent'", async () => {
    await renderPage({ status: "verification-link-sent" });

    expect(
      screen.getByText(/A new verification link has been sent/),
    ).toBeInTheDocument();
  });

  it("tidak menampilkan pesan status untuk nilai status lain", async () => {
    await renderPage({ status: "some-other-status" });

    expect(
      screen.queryByText(/A new verification link has been sent/),
    ).not.toBeInTheDocument();
  });

  it("submit form memanggil post(route('verification.send'))", async () => {
    const user = userEvent.setup();
    await renderPage();

    const button = screen.getByRole("button", {
      name: "Resend Verification Email",
    });
    await act(async () => {
      await user.click(button);
    });

    expect(window.route).toHaveBeenCalledWith("verification.send");
    expect(useFormReturn.post).toHaveBeenCalledTimes(1);
    expect(useFormReturn.post).toHaveBeenCalledWith("verification.send");
  });

  it("tombol Resend disabled saat processing=true", async () => {
    useFormReturn.processing = true;
    await renderPage();

    expect(
      screen.getByRole("button", { name: "Resend Verification Email" }),
    ).toBeDisabled();
  });

  it("tombol Resend tidak disabled saat processing=false", async () => {
    await renderPage();

    expect(
      screen.getByRole("button", { name: "Resend Verification Email" }),
    ).not.toBeDisabled();
  });

  it("link Log Out mengarah ke route('logout') via method post", async () => {
    await renderPage();

    const logoutLink = screen.getByRole("link", { name: "Log Out" });
    expect(logoutLink).toHaveAttribute("href", "logout");
    expect(logoutLink).toHaveAttribute("method", "post");
    expect(logoutLink).toHaveAttribute("as", "button");
  });
});
