import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

// GuestLayout membungkus MasterLayout (tema, AlertDialogs, context-menu guard)
// dan butuh usePage() dari @inertiajs/react (perlu InertiaApp context sungguhan
// di luar cakupan test ini) -- GuestLayout sendiri sudah punya test terpisah
// (Layouts/GuestLayout.rtl.test.jsx). Stub jadi passthrough supaya test ini
// fokus ke konten unik ForgotPassword.jsx. Pola sama dgn
// Pages/Core/Language/Index.rtl.test.jsx.
vi.mock("@/Layouts/GuestLayout", () => ({
  default: ({ children }) => (
    <div data-testid="stub-guest-layout">{children}</div>
  ),
}));

const tMock = vi.fn((key) => `TR:${key}`);
let i18nState = { t: tMock, loading: false };
vi.mock("laravel-react-i18n", () => ({
  useLaravelReactI18n: () => i18nState,
}));

// useForm asli @inertiajs/react butuh InertiaApp context nyata -- stub dgn
// object mutable yg direset tiap test, pola sama dgn
// Pages/Core/Components/ApproverDecision.rtl.test.jsx. Head asli juga butuh
// head manager context, stub jadi <title> polos (pola Print.rtl.test.jsx).
const useFormReturn = {
  data: { email: "" },
  setData: vi.fn(),
  post: vi.fn(),
  processing: false,
  errors: {},
};
vi.mock("@inertiajs/react", () => ({
  useForm: () => useFormReturn,
  Head: ({ title }) => <title>{title}</title>,
}));

window.route = vi.fn((name) => name);

import ForgotPassword from "./ForgotPassword";

async function renderPage(props = {}) {
  let utils;
  await act(async () => {
    utils = render(<ForgotPassword {...props} />);
  });
  return utils;
}

beforeEach(() => {
  tMock.mockClear();
  window.route.mockClear();
  i18nState = { t: tMock, loading: false };
  useFormReturn.data = { email: "" };
  useFormReturn.setData.mockReset();
  useFormReturn.post.mockReset();
  useFormReturn.processing = false;
  useFormReturn.errors = {};
});

describe("ForgotPassword — render dasar", () => {
  it("merender tanpa error di dalam GuestLayout dgn deskripsi & tombol terjemahan", async () => {
    await renderPage();

    expect(screen.getByTestId("stub-guest-layout")).toBeInTheDocument();
    expect(
      screen.getByText("TR:auth.forgotPassword.description"),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "TR:auth.forgotPassword.button" }),
    ).toBeInTheDocument();
    expect(tMock).toHaveBeenCalledWith("auth.forgotPassword.description");
    expect(tMock).toHaveBeenCalledWith("auth.forgotPassword.button");
  });

  it("mengatur document title lewat Head menjadi 'Forgot Password'", async () => {
    await renderPage();

    expect(document.title).toBe("Forgot Password");
  });

  it("merender Skeleton (bukan teks terjemahan) saat i18n masih loading", async () => {
    i18nState = { t: tMock, loading: true };
    const { container } = await renderPage();

    expect(
      screen.queryByText("TR:auth.forgotPassword.description"),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "TR:auth.forgotPassword.button" }),
    ).not.toBeInTheDocument();
    expect(container.querySelectorAll(".animate-pulse").length).toBe(2);
  });

  it("tidak merender status message bila prop status tidak diberikan", async () => {
    await renderPage();

    expect(screen.queryByText(/berhasil|success/i)).not.toBeInTheDocument();
  });

  it("merender status message dari props.status bila ada", async () => {
    await renderPage({ status: "Tautan reset password telah dikirim." });

    expect(
      screen.getByText("Tautan reset password telah dikirim."),
    ).toBeInTheDocument();
  });
});

describe("ForgotPassword — field email terisi dari data awal", () => {
  it("input email menampilkan value dari data.email milik useForm", async () => {
    useFormReturn.data = { email: "seed@example.com" };
    await renderPage();

    const input = screen.getByRole("textbox");
    expect(input).toHaveValue("seed@example.com");
    expect(input).toHaveAttribute("type", "email");
    expect(input).toHaveAttribute("name", "email");
  });
});

describe("ForgotPassword — input mengubah state via setData", () => {
  it("mengetik di input email memanggil setData('email', value)", async () => {
    const user = userEvent.setup();
    await renderPage();

    const input = screen.getByRole("textbox");
    await act(async () => {
      await user.type(input, "a");
    });

    expect(useFormReturn.setData).toHaveBeenCalledWith("email", "a");
  });
});

describe("ForgotPassword — submit memanggil post dgn route yg benar", () => {
  it("submit form memanggil post(route('password.email'))", async () => {
    const user = userEvent.setup();
    useFormReturn.data = { email: "user@example.com" };
    await renderPage();

    const button = screen.getByRole("button", {
      name: "TR:auth.forgotPassword.button",
    });
    await act(async () => {
      await user.click(button);
    });

    expect(window.route).toHaveBeenCalledWith("password.email");
    expect(useFormReturn.post).toHaveBeenCalledTimes(1);
    expect(useFormReturn.post).toHaveBeenCalledWith("password.email");
  });
});

describe("ForgotPassword — validation errors (props.errors dari useForm)", () => {
  it("menampilkan pesan error email dari errors.email", async () => {
    useFormReturn.errors = { email: "Email tidak valid." };
    await renderPage();

    expect(screen.getByText("Email tidak valid.")).toBeInTheDocument();
  });

  it("tidak menampilkan elemen error bila errors.email kosong", async () => {
    useFormReturn.errors = {};
    await renderPage();

    expect(screen.queryByText(/tidak valid/i)).not.toBeInTheDocument();
  });
});

describe("ForgotPassword — tombol disabled saat processing", () => {
  it("tombol submit disabled ketika processing=true", async () => {
    useFormReturn.processing = true;
    await renderPage();

    expect(
      screen.getByRole("button", { name: "TR:auth.forgotPassword.button" }),
    ).toBeDisabled();
  });

  it("tombol submit tidak disabled ketika processing=false", async () => {
    useFormReturn.processing = false;
    await renderPage();

    expect(
      screen.getByRole("button", { name: "TR:auth.forgotPassword.button" }),
    ).not.toBeDisabled();
  });
});
