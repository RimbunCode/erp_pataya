import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";

const stableT = (key) => `TR:${key}`;
let i18nState = { t: stableT, loading: false };
vi.mock("laravel-react-i18n", () => ({
  useLaravelReactI18n: () => i18nState,
}));

// GuestLayout butuh usePage().props.preferences.updated_at (InertiaApp
// context asli, tidak tersedia di test standalone) dan sudah py test
// terpisah (Layouts/GuestLayout.rtl.test.jsx). Stub jadi passthrough supaya
// test ini fokus ke konten unik Register.jsx.
vi.mock("@/Layouts/GuestLayout", () => ({
  default: ({ children }) => (
    <div data-testid="stub-guest-layout">{children}</div>
  ),
}));

// useForm asli @inertiajs/react butuh InertiaApp context -- fake stateful
// (pola sama dgn Pages/Core/FormPageDialog.rtl.test.jsx) supaya data/setData
// benar-benar reaktif saat user mengetik. errors/processing di-override per
// test lewat variabel module-level.
let errorsOverride = {};
let processingOverride = false;
const postSpy = vi.fn();
const resetSpy = vi.fn();

function useFormFake(seed) {
  const [data, setDataState] = useState(seed ?? {});
  const setData = (...args) => {
    if (typeof args[0] === "function") {
      setDataState((prev) => args[0](prev));
    } else if (typeof args[0] === "string") {
      setDataState((prev) => ({ ...prev, [args[0]]: args[1] }));
    } else {
      setDataState((prev) => ({ ...prev, ...args[0] }));
    }
  };
  return {
    data,
    setData,
    post: (...a) => postSpy(...a),
    processing: processingOverride,
    errors: errorsOverride,
    reset: (...a) => resetSpy(...a),
  };
}

// Head asli @inertiajs/react butuh InertiaApp context (head manager) yang
// tidak tersedia di test standalone -- pola sama dgn Pages/Core/Print.rtl.test.jsx
// dan Pages/Core/Language/Index.rtl.test.jsx.
vi.mock("@inertiajs/react", () => ({
  useForm: (seed) => useFormFake(seed),
  Head: ({ title }) => <title>{title}</title>,
}));

window.route = (name, param) =>
  param !== undefined ? `${name}/${param}` : name;

import Register from "./Register";

describe("Register", () => {
  beforeEach(() => {
    postSpy.mockReset();
    resetSpy.mockReset();
    errorsOverride = {};
    processingOverride = false;
    i18nState = { t: stableT, loading: false };
  });

  it("merender form tanpa error dengan semua field kosong dari data awal", () => {
    const { container } = render(<Register />);

    expect(container.querySelector("#name")).toHaveValue("");
    expect(container.querySelector("#username")).toHaveValue("");
    expect(container.querySelector("#email")).toHaveValue("");
    expect(container.querySelector("#password")).toHaveValue("");
    expect(container.querySelector("#password_confirmation")).toHaveValue("");
    expect(
      screen.getByRole("button", { name: "TR:auth.register.button" }),
    ).toBeInTheDocument();
  });

  it("menampilkan skeleton (bukan teks terjemahan) saat i18n loading=true", () => {
    i18nState = { t: stableT, loading: true };
    const { container } = render(<Register />);

    expect(
      screen.queryByText("TR:auth.register.title"),
    ).not.toBeInTheDocument();
    expect(container.querySelectorAll(".animate-pulse").length).toBeGreaterThan(
      0,
    );
  });

  it("mengetik di tiap field memanggil setData dan mengubah value terkontrol", async () => {
    const user = userEvent.setup({ delay: null });
    const { container } = render(<Register />);

    await user.type(container.querySelector("#name"), "Budi");
    await user.type(container.querySelector("#username"), "budi123");
    await user.type(container.querySelector("#email"), "budi@example.com");
    await user.type(container.querySelector("#password"), "Passw0rd!");
    await user.type(
      container.querySelector("#password_confirmation"),
      "Passw0rd!",
    );

    expect(container.querySelector("#name")).toHaveValue("Budi");
    expect(container.querySelector("#username")).toHaveValue("budi123");
    expect(container.querySelector("#email")).toHaveValue("budi@example.com");
    expect(container.querySelector("#password")).toHaveValue("Passw0rd!");
    expect(container.querySelector("#password_confirmation")).toHaveValue(
      "Passw0rd!",
    );
  });

  it("submit memanggil post ke route register, dan onFinish mereset field password", async () => {
    // Semua input punya atribut HTML `required` -- jsdom menjalankan
    // constraint validation asli sehingga submit native diblokir kalau
    // field kosong. Isi dulu semua field wajib sebelum klik submit.
    const user = userEvent.setup({ delay: null });
    const { container } = render(<Register />);

    await user.type(container.querySelector("#name"), "Budi");
    await user.type(container.querySelector("#username"), "budi123");
    await user.type(container.querySelector("#email"), "budi@example.com");
    await user.type(container.querySelector("#password"), "Passw0rd!");
    await user.type(
      container.querySelector("#password_confirmation"),
      "Passw0rd!",
    );

    await user.click(
      screen.getByRole("button", { name: "TR:auth.register.button" }),
    );

    expect(postSpy).toHaveBeenCalledTimes(1);
    const [url, options] = postSpy.mock.calls[0];
    expect(url).toBe("register");
    expect(typeof options.onFinish).toBe("function");

    options.onFinish();
    expect(resetSpy).toHaveBeenCalledWith("password", "password_confirmation");
  });

  it("menampilkan validation errors dari props.errors (server-side)", () => {
    errorsOverride = {
      name: "Nama wajib diisi.",
      username: "Username sudah dipakai.",
      email: "Email tidak valid.",
      password: "Password terlalu lemah.",
      password_confirmation: "Konfirmasi password tidak cocok.",
    };
    render(<Register />);

    expect(screen.getByText("Nama wajib diisi.")).toBeInTheDocument();
    expect(screen.getByText("Username sudah dipakai.")).toBeInTheDocument();
    expect(screen.getByText("Email tidak valid.")).toBeInTheDocument();
    expect(screen.getByText("Password terlalu lemah.")).toBeInTheDocument();
    expect(
      screen.getByText("Konfirmasi password tidak cocok."),
    ).toBeInTheDocument();
  });

  it("tombol submit disabled saat processing=true", () => {
    processingOverride = true;
    render(<Register />);

    expect(
      screen.getByRole("button", { name: "TR:auth.register.button" }),
    ).toBeDisabled();
  });

  it("tombol submit tidak disabled saat processing=false", () => {
    render(<Register />);

    expect(
      screen.getByRole("button", { name: "TR:auth.register.button" }),
    ).not.toBeDisabled();
  });

  it("tombol google mengarah ke route auth.login-provider dengan provider google", () => {
    render(<Register />);

    const googleLink = screen.getByRole("link", {
      name: /TR:auth.register.google/,
    });
    expect(googleLink).toHaveAttribute("href", "auth.login-provider/google");
  });

  it("link login mengarah ke route login", () => {
    render(<Register />);

    const loginLink = screen.getByRole("link", {
      name: "TR:auth.register.loginLink",
    });
    expect(loginLink).toHaveAttribute("href", "login");
  });

  it("mengetik password menampilkan indikator kekuatan password (PasswordChecker)", async () => {
    const user = userEvent.setup({ delay: null });
    const { container } = render(<Register />);

    await user.type(container.querySelector("#password"), "Passw0rd!");

    expect(
      screen.getByText("TR:auth.register.password.strengths.status.strong"),
    ).toBeInTheDocument();
  });

  it("klik toggle visibility mengubah type kedua field password sekaligus (shared isVisible)", async () => {
    const user = userEvent.setup({ delay: null });
    const { container } = render(<Register />);
    const passwordInput = container.querySelector("#password");
    const confirmInput = container.querySelector("#password_confirmation");

    expect(passwordInput).toHaveAttribute("type", "password");
    expect(confirmInput).toHaveAttribute("type", "password");

    // Tombol toggle visibility adalah sibling langsung dari Input di dalam
    // wrapper PasswordInput (lihat Components/PasswordInput.jsx).
    const toggleButton = passwordInput.parentElement.querySelector("button");
    await user.click(toggleButton);

    expect(passwordInput).toHaveAttribute("type", "text");
    expect(confirmInput).toHaveAttribute("type", "text");
  });

  // BUG (lihat bugFindings): kedua <Label> untuk field "Nama" (t("auth.register.name"))
  // DAN "Username" (t("auth.register.username")) sama-sama pakai htmlFor="username",
  // padahal input Nama id-nya "name". Akibatnya label Nama tidak pernah berasosiasi
  // dengan input Nama -- getByLabelText utk teks label Nama malah resolve ke input
  // #username (input Username), bukan ke input #name. Test ini mengunci PERILAKU
  // SAAT INI (bug), bukan perilaku yang seharusnya.
  it("BUG: label field Nama (htmlFor salah) resolve ke input #username, bukan #name", () => {
    const { container } = render(<Register />);

    const resolvedByNameLabel = screen.getByLabelText("TR:auth.register.name");
    expect(resolvedByNameLabel).toBe(container.querySelector("#username"));
    expect(resolvedByNameLabel).not.toBe(container.querySelector("#name"));

    // Label Username kebetulan tetap resolve benar ke #username karena
    // keduanya sama-sama menunjuk id yang sama.
    const resolvedByUsernameLabel = screen.getByLabelText(
      "TR:auth.register.username",
    );
    expect(resolvedByUsernameLabel).toBe(container.querySelector("#username"));
  });
});
