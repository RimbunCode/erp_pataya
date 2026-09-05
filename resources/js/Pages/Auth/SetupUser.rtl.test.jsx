import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, act } from "@testing-library/react";
import { TooltipProvider } from "@/Components/ui/tooltip";
import userEvent from "@testing-library/user-event";

// SetupUser.jsx adalah halaman form Auth standar (useForm + put) yang mirip
// pola ConfirmPassword.rtl.test.jsx di direktori yang sama: GuestLayout
// di-stub passthrough (dia sendiri sudah punya test komposisi terpisah di
// Layouts/GuestLayout.rtl.test.jsx dan butuh usePage() yang tidak kita
// implementasikan di sini). laravel-react-i18n di-mock identity (t: key=>key)
// mengikuti pola Navbar.rtl.test.jsx/ManageUsers Form.rtl.test.jsx.
//
// Select & DatetimePicker di-stub jadi elemen native sederhana mengikuti
// pola established di Users/ManageUsers/Form.rtl.test.jsx -- keduanya
// Radix/Popover kompleks yang sudah punya test sendiri (Select.rtl.test.jsx,
// DatetimePicker.rtl.test.jsx) dan DatetimePicker butuh usePage() dari
// @inertiajs/react yang tidak kita mock di sini. ToggleTheme di-stub kosong
// mengikuti pola Navbar.rtl.test.jsx (sudah punya test sendiri, tidak
// relevan dgn logic SetupUser). PasswordInput & PasswordChecker DIBIARKAN
// nyata -- keduanya wrapper native input sederhana, tidak butuh Radix
// popover, dan justru field password (visibility toggle, strength meter)
// adalah bagian form yang perlu diverifikasi render-nya di sini.

vi.mock("@/Layouts/GuestLayout", () => ({
  default: ({ children }) => (
    <div data-testid="stub-guest-layout">{children}</div>
  ),
}));

vi.mock("laravel-react-i18n", () => ({
  useLaravelReactI18n: () => ({ t: (key) => key, loading: false }),
}));

vi.mock("@/Components/Select", () => ({
  default: ({ id, value, onValueChange, options }) => (
    <select
      data-testid="select"
      id={id}
      value={value ?? ""}
      onChange={(e) => onValueChange?.(e.target.value)}
    >
      <option value="" />
      {(options ?? []).map((opt) => {
        const val = typeof opt === "string" ? opt : opt.value;
        return (
          <option key={val} value={val}>
            {val}
          </option>
        );
      })}
    </select>
  ),
}));

vi.mock("@/Components/DatetimePicker", () => ({
  default: ({ id, value, onValueChange }) => (
    <input
      data-testid="datetime-picker"
      id={id}
      value={value ?? ""}
      onChange={(e) => onValueChange?.(e.target.value)}
    />
  ),
}));

vi.mock("@/Components/ToggleTheme", () => ({
  default: () => <div data-testid="stub-toggle-theme" />,
}));

const useFormReturn = {
  data: {},
  setData: vi.fn(),
  put: vi.fn(),
  processing: false,
  errors: {},
};
vi.mock("@inertiajs/react", () => ({
  Head: ({ title }) => <title>{title}</title>,
  Link: ({ href, children, ...props }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
  useForm: (initial) => {
    useFormReturn.data = { ...initial, ...useFormReturn.data };
    return useFormReturn;
  },
}));

window.route = (name) => name;

import SetupUser from "./SetupUser";

const baseUser = {
  name: "Budi",
  username: "budi",
  gender: "male",
  birthdate: "1990-01-01",
  phone: "08123456789",
  email: "budi@example.com",
  email_verified_at: null,
};

async function renderPage(props = {}) {
  await act(async () => {
    render(
      <TooltipProvider>
        <SetupUser
          user={baseUser}
          hasPassword={true}
          isWaiting={false}
          {...props}
        />
      </TooltipProvider>,
    );
  });
}

describe("Auth SetupUser", () => {
  beforeEach(() => {
    useFormReturn.data = {};
    useFormReturn.setData.mockReset();
    useFormReturn.put.mockReset();
    useFormReturn.processing = false;
    useFormReturn.errors = {};
  });

  it("merender tanpa error dengan field profile terisi dari prop user", async () => {
    await renderPage();

    expect(screen.getByDisplayValue("Budi")).toBeInTheDocument();
    expect(screen.getByDisplayValue("budi")).toBeInTheDocument();
    expect(screen.getByDisplayValue("08123456789")).toBeInTheDocument();
    expect(screen.getByDisplayValue("budi@example.com")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "auth.setupUser.button.save" }),
    ).toBeInTheDocument();
  });

  it("useForm diinisialisasi dengan field kosong bila prop user null/undefined", async () => {
    await renderPage({ user: {} });

    expect(useFormReturn.data).toMatchObject({
      name: "",
      username: "",
      gender: "",
      birthdate: "",
      phone: "",
      email: "",
      current_password: "",
      password: "",
      password_confirmation: "",
    });
  });

  it("mengetik di field name memanggil setData dengan key & value yang benar", async () => {
    const user = userEvent.setup({ delay: null });
    await renderPage();

    const nameInput = screen.getByDisplayValue("Budi");
    await user.type(nameInput, "x");

    expect(useFormReturn.setData).toHaveBeenCalledWith("name", "Budix");
  });

  it("submit memanggil put ke route setup.update", async () => {
    const user = userEvent.setup({ delay: null });
    await renderPage();

    await user.click(
      screen.getByRole("button", { name: "auth.setupUser.button.save" }),
    );

    expect(useFormReturn.put).toHaveBeenCalledTimes(1);
    expect(useFormReturn.put).toHaveBeenCalledWith("setup.update");
  });

  it("menampilkan pesan error validasi bila errors.username terisi", async () => {
    useFormReturn.errors = { username: "Username sudah dipakai." };

    await renderPage();

    expect(screen.getByText("Username sudah dipakai.")).toBeInTheDocument();
  });

  it("tidak menampilkan pesan error apa pun bila errors kosong", async () => {
    await renderPage();

    expect(screen.queryByText(/dipakai/i)).not.toBeInTheDocument();
  });

  it("tombol simpan disabled saat processing=true", async () => {
    useFormReturn.processing = true;

    await renderPage();

    expect(
      screen.getByRole("button", { name: "auth.setupUser.button.save" }),
    ).toBeDisabled();
  });

  it("tombol simpan tidak disabled saat processing=false", async () => {
    await renderPage();

    expect(
      screen.getByRole("button", { name: "auth.setupUser.button.save" }),
    ).not.toBeDisabled();
  });

  it("isWaiting=true menampilkan alert peringatan waiting", async () => {
    await renderPage({ isWaiting: true });

    expect(
      screen.getByText("auth.setupUser.waiting.title"),
    ).toBeInTheDocument();
  });

  it("isWaiting=false tidak menampilkan alert peringatan waiting", async () => {
    await renderPage({ isWaiting: false });

    expect(
      screen.queryByText("auth.setupUser.waiting.title"),
    ).not.toBeInTheDocument();
  });

  it("hasPassword=true menampilkan field current_password", async () => {
    await renderPage({ hasPassword: true });

    expect(
      screen.getByText("user.user.manage_password.columns.current_password"),
    ).toBeInTheDocument();
  });

  it("hasPassword=false TIDAK menampilkan field current_password, tapi tetap menampilkan field password baru", async () => {
    await renderPage({ hasPassword: false });

    expect(
      screen.queryByText("user.user.manage_password.columns.current_password"),
    ).not.toBeInTheDocument();
    // Tanpa password lama, field password baru pakai label "columns.password"
    // (bukan varian "manage_password.columns.password") sesuai kondisi
    // data.current_password ? ... : "user.user.columns.password" di source.
    expect(
      screen.getByText("user.user.columns.password", { exact: false }),
    ).toBeInTheDocument();
  });

  it("hasPassword=true & current_password masih kosong: field password baru TIDAK dirender", async () => {
    useFormReturn.data = { current_password: "" };
    await renderPage({ hasPassword: true });

    expect(
      screen.queryByLabelText("user.user.manage_password.columns.password", {
        exact: false,
      }),
    ).not.toBeInTheDocument();
  });

  it("hasPassword=true & current_password sudah diisi: field password baru dirender dengan label varian manage_password", async () => {
    useFormReturn.data = { current_password: "lama123" };
    await renderPage({ hasPassword: true });

    // exact match (bukan substring) -- label password_confirmation
    // ("...columns.password_confirmation") secara string MENGANDUNG
    // substring "...columns.password", jadi exact:false akan salah
    // menganggap ambigu (multiple match).
    expect(
      screen.getByText("user.user.manage_password.columns.password"),
    ).toBeInTheDocument();
  });

  it("email belum diverifikasi (email_verified_at null) menampilkan tombol ikon verifikasi email tambahan", async () => {
    // TooltipContent ("...email.verify") hanya mount saat tooltip terbuka
    // (hover), jadi diverifikasi lewat KEBERADAAN tombol ikon-nya (bukan
    // accessible name teks) -- tombol ini hanya muncul saat belum
    // terverifikasi (branch !user.email_verified_at di source). Tombol
    // logout pakai Button asChild -> render sbg <a> (role "link", BUKAN
    // "button"). Baseline (hasPassword=true default, current_password
    // kosong -> hanya field current_password yg dirender, 1 tombol toggle
    // show/hide) = current_password-toggle(1) + submit(1) = 2, ditambah 1
    // tombol verify email = 3.
    await renderPage({
      user: { ...baseUser, email_verified_at: null },
    });

    expect(screen.getAllByRole("button")).toHaveLength(3);
  });

  it("email sudah diverifikasi TIDAK menampilkan tombol ikon verifikasi tambahan (ShieldCheckIcon bukan button)", async () => {
    await renderPage({
      user: { ...baseUser, email_verified_at: "2026-01-01" },
    });

    // Baseline 2 tombol (current_password-toggle + submit), tanpa tombol
    // verify email.
    expect(screen.getAllByRole("button")).toHaveLength(2);
  });

  it("link tombol logout mengarah ke route logout", async () => {
    await renderPage();

    const logoutLink = screen.getByRole("link");
    expect(logoutLink).toHaveAttribute("href", "logout");
  });
});
