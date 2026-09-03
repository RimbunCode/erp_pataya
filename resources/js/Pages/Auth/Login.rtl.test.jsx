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
// context asli, tidak tersedia di test standalone) dan sudah punya test
// terpisah (Layouts/GuestLayout.rtl.test.jsx). Stub jadi passthrough supaya
// test ini fokus ke konten unik Login.jsx. Pola sama dgn
// Pages/Auth/Register.rtl.test.jsx & Pages/Auth/SetupUser.rtl.test.jsx.
vi.mock("@/Layouts/GuestLayout", () => ({
  default: ({ children }) => (
    <div data-testid="stub-guest-layout">{children}</div>
  ),
}));

// useForm asli @inertiajs/react butuh InertiaApp context -- fake stateful
// (pola sama dgn Pages/Auth/Register.rtl.test.jsx) supaya data/setData
// benar-benar reaktif saat user mengetik/klik checkbox. Berbeda dgn
// Register.jsx, Login.jsx TIDAK mengambil `errors` dari useForm -- errors
// adalah prop halaman terpisah (`export default function Login({ errors })`),
// jadi tidak di-include di sini dan diberikan langsung sbg prop komponen
// per-test.
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
    reset: (...a) => resetSpy(...a),
  };
}

// Head asli @inertiajs/react butuh InertiaApp context (head manager) yang
// tidak tersedia di test standalone -- pola sama dgn Pages/Core/Print.rtl.test.jsx
// dan Pages/Auth/Register.rtl.test.jsx.
vi.mock("@inertiajs/react", () => ({
  useForm: (seed) => useFormFake(seed),
  Head: ({ title }) => <title>{title}</title>,
}));

window.route = (name, param) =>
  param !== undefined ? `${name}/${param}` : name;

import Login from "./Login";

describe("Login", () => {
  beforeEach(() => {
    postSpy.mockReset();
    resetSpy.mockReset();
    processingOverride = false;
    i18nState = { t: stableT, loading: false };
  });

  it("merender form tanpa error dengan semua field kosong dari data awal", () => {
    const { container } = render(<Login />);

    expect(container.querySelector("#usernameOrEmail")).toHaveValue("");
    expect(container.querySelector("#password")).toHaveValue("");
    expect(screen.getByRole("forminput")).toHaveAttribute(
      "data-state",
      "unchecked",
    );
    expect(
      screen.getByRole("button", { name: "TR:auth.login.button" }),
    ).toBeInTheDocument();
  });

  it("menampilkan skeleton (bukan teks terjemahan) saat i18n loading=true", () => {
    i18nState = { t: stableT, loading: true };
    const { container } = render(<Login />);

    expect(screen.queryByText("TR:auth.login.title")).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "TR:auth.login.button" }),
    ).not.toBeInTheDocument();
    expect(container.querySelectorAll(".animate-pulse").length).toBeGreaterThan(
      0,
    );
  });

  it("mengetik di usernameOrEmail dan password memanggil setData dan mengubah value terkontrol", async () => {
    const user = userEvent.setup({ delay: null });
    const { container } = render(<Login />);

    await user.type(
      container.querySelector("#usernameOrEmail"),
      "budi@example.com",
    );
    await user.type(container.querySelector("#password"), "Passw0rd!");

    expect(container.querySelector("#usernameOrEmail")).toHaveValue(
      "budi@example.com",
    );
    expect(container.querySelector("#password")).toHaveValue("Passw0rd!");
  });

  it("klik checkbox remember mengubah state via setData (unchecked -> checked)", async () => {
    const user = userEvent.setup({ delay: null });
    render(<Login />);

    const checkbox = screen.getByRole("forminput");
    expect(checkbox).toHaveAttribute("data-state", "unchecked");

    await user.click(checkbox);

    expect(checkbox).toHaveAttribute("data-state", "checked");
    expect(checkbox).toHaveAttribute("aria-checked", "true");
  });

  it("submit memanggil post ke route login, dan onFinish mereset field password saja", async () => {
    // Input usernameOrEmail & password punya atribut HTML `required` -- jsdom
    // menjalankan constraint validation asli sehingga submit native diblokir
    // kalau field kosong. Isi dulu semua field wajib sebelum klik submit
    // (pola sama dgn Register.rtl.test.jsx).
    const user = userEvent.setup({ delay: null });
    const { container } = render(<Login />);

    await user.type(
      container.querySelector("#usernameOrEmail"),
      "budi@example.com",
    );
    await user.type(container.querySelector("#password"), "Passw0rd!");

    await user.click(
      screen.getByRole("button", { name: "TR:auth.login.button" }),
    );

    expect(postSpy).toHaveBeenCalledTimes(1);
    const [url, options] = postSpy.mock.calls[0];
    expect(url).toBe("login");
    expect(typeof options.onFinish).toBe("function");

    options.onFinish();
    expect(resetSpy).toHaveBeenCalledWith("password");
    expect(resetSpy).not.toHaveBeenCalledWith(
      "password",
      "password_confirmation",
    );
  });

  it("menampilkan validation errors dari props.errors (page prop, bukan dari useForm)", () => {
    render(
      <Login
        errors={{
          usernameOrEmail: "Username atau email tidak ditemukan.",
          password: "Password salah.",
        }}
      />,
    );

    expect(
      screen.getByText("Username atau email tidak ditemukan."),
    ).toBeInTheDocument();
    expect(screen.getByText("Password salah.")).toBeInTheDocument();
  });

  it("tidak menampilkan blok error saat props.errors tidak diberikan atau kosong", () => {
    const { rerender } = render(<Login />);
    expect(document.querySelector(".alert.error")).not.toBeInTheDocument();

    rerender(<Login errors={{}} />);
    expect(document.querySelector(".alert.error")).not.toBeInTheDocument();
  });

  it("tombol submit disabled saat processing=true", () => {
    processingOverride = true;
    render(<Login />);

    expect(
      screen.getByRole("button", { name: "TR:auth.login.button" }),
    ).toBeDisabled();
  });

  it("tombol submit tidak disabled saat processing=false", () => {
    render(<Login />);

    expect(
      screen.getByRole("button", { name: "TR:auth.login.button" }),
    ).not.toBeDisabled();
  });

  it("link forgot password mengarah ke route password.request", () => {
    render(<Login />);

    const link = screen.getByRole("link", {
      name: "TR:auth.login.forgotPassword",
    });
    expect(link).toHaveAttribute("href", "password.request");
  });

  it("tombol google mengarah ke route auth.login-provider dengan provider google", () => {
    render(<Login />);

    const googleLink = screen.getByRole("link", {
      name: /TR:auth.login.google/,
    });
    expect(googleLink).toHaveAttribute("href", "auth.login-provider/google");
  });

  // BUG (lihat bugFindings): prop `label` FormCheckbox untuk "remember" dibungkus
  // Fragment (`<>{loading ? <Skeleton/> : t(...)}</>`) alih-alih string polos.
  // FormCheckbox.hasPlainLabel jadi false (Fragment bukan string/number) sehingga
  // labelContent dirender langsung sbg children RunningText asChild=true (Radix
  // Slot). Slot mengkloning satu-satunya child dan menyisipkan className
  // ("running-text ...") ke situ -- tapi child-nya adalah <React.Fragment>, yang
  // tidak menerima prop selain key/children, sehingga React memunculkan console.error
  // "Invalid prop `className` supplied to `React.Fragment`" pada SETIAP render
  // halaman ini (bukan cuma saat loading). Test ini mengunci PERILAKU SAAT INI
  // (warning tetap muncul, tidak menyebabkan crash), bukan perilaku yang seharusnya.
  it("BUG: label checkbox remember (dibungkus Fragment) memicu console.error Invalid prop className pada React.Fragment", () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    render(<Login />);

    expect(errorSpy).toHaveBeenCalledWith(
      expect.stringContaining("Invalid prop `%s` supplied to `React.Fragment`"),
      "className",
    );

    errorSpy.mockRestore();
  });

  it("link register mengarah ke route register", () => {
    render(<Login />);

    const registerLink = screen.getByRole("link", {
      name: "TR:auth.login.registerLink",
    });
    expect(registerLink).toHaveAttribute("href", "register");
  });
});
