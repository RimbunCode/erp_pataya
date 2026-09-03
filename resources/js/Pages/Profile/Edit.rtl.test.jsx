import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";

// Edit.jsx (Profile) adalah page composer tipis: AppLayout + Head + 3 Partial
// form (UpdateProfileInformationForm, UpdatePasswordForm, DeleteUserForm).
// Edit sendiri TIDAK punya useForm -- logic form ada di masing-masing
// Partial. Ketiganya dirender NYATA (tidak distub) supaya forwarding props
// mustVerifyEmail/status dari Edit ke UpdateProfileInformationForm ikut
// teruji secara integrasi -- inilah satu-satunya logic milik Edit.jsx.
// AppLayout distub passthrough (chrome app penuh, sudah py test sendiri)
// mengikuti pola Auth/*.rtl.test.jsx (GuestLayout stub serupa), tapi tetap
// merender `header` supaya heading judul halaman bisa diverifikasi.
//
// useForm asli @inertiajs/react butuh InertiaApp context -- fake stateful
// per-instance (pola sama dgn Auth/Register.rtl.test.jsx) supaya kedua form
// (profile & password) independen reaktif satu sama lain. errors/processing
// di-override lewat variabel module-level SHARED ke semua instance useForm
// (pola sama) -- aman krn key errors kedua form tidak overlap (name/email
// vs current_password/password/password_confirmation).

vi.mock("@/Layouts/AppLayout", () => ({
  default: ({ header, children }) => (
    <div data-testid="stub-app-layout">
      <div data-testid="stub-app-layout-header">{header}</div>
      {children}
    </div>
  ),
}));

let errorsOverride = {};
let processingOverride = false;
const patchSpy = vi.fn();
const putSpy = vi.fn();
const resetSpy = vi.fn();
const usePageMock = vi.fn();
const headProps = vi.fn();

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
    errors: errorsOverride,
    processing: processingOverride,
    recentlySuccessful: false,
    patch: (...a) => patchSpy(...a),
    put: (...a) => putSpy(...a),
    reset: (...a) => resetSpy(...a),
  };
}

vi.mock("@inertiajs/react", () => ({
  useForm: (seed) => useFormFake(seed),
  usePage: () => usePageMock(),
  Head: (props) => {
    headProps(props);
    return null;
  },
  Link: ({ href, children, ...props }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

window.route = (name) => name;

import Edit from "./Edit";

const baseUser = {
  name: "Budi Santoso",
  email: "budi@example.com",
  email_verified_at: "2026-01-01T00:00:00.000Z",
};

function renderEdit(props = {}, user = baseUser) {
  usePageMock.mockReturnValue({ props: { auth: { user } } });
  return render(<Edit mustVerifyEmail={false} status={null} {...props} />);
}

describe("Profile Edit", () => {
  beforeEach(() => {
    errorsOverride = {};
    processingOverride = false;
    patchSpy.mockReset();
    putSpy.mockReset();
    resetSpy.mockReset();
    usePageMock.mockReset();
    headProps.mockReset();
  });

  it("merender tanpa error: AppLayout, Head title Profile, dan 3 section form", () => {
    renderEdit();

    expect(screen.getByTestId("stub-app-layout")).toBeInTheDocument();
    expect(headProps).toHaveBeenCalledWith(
      expect.objectContaining({ title: "Profile" }),
    );
    expect(
      screen.getByRole("heading", { name: "Profile" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "Profile Information" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "Update Password" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "Delete Account" }),
    ).toBeInTheDocument();
  });

  it("field name & email UpdateProfileInformationForm terisi dari usePage().props.auth.user", () => {
    const { container } = renderEdit();

    expect(container.querySelector("#name")).toHaveValue("Budi Santoso");
    expect(container.querySelector("#email")).toHaveValue("budi@example.com");
  });

  it("field password UpdatePasswordForm kosong dari data awal (bukan diisi dari user)", () => {
    const { container } = renderEdit();

    expect(container.querySelector("#current_password")).toHaveValue("");
    expect(container.querySelector("#password")).toHaveValue("");
    expect(container.querySelector("#password_confirmation")).toHaveValue("");
  });

  it("mengetik di field name/email (profile) memanggil setData & merefleksikan value baru", async () => {
    const user = userEvent.setup({ delay: null });
    const { container } = renderEdit();

    const nameInput = container.querySelector("#name");
    await user.clear(nameInput);
    await user.type(nameInput, "Nama Baru");

    expect(nameInput).toHaveValue("Nama Baru");
  });

  it("mengetik di field password (password form) memanggil setData & merefleksikan value baru", async () => {
    const user = userEvent.setup({ delay: null });
    const { container } = renderEdit();

    await user.type(
      container.querySelector("#current_password"),
      "rahasia-lama",
    );
    await user.type(container.querySelector("#password"), "rahasia-baru");

    expect(container.querySelector("#current_password")).toHaveValue(
      "rahasia-lama",
    );
    expect(container.querySelector("#password")).toHaveValue("rahasia-baru");
  });

  it("submit form profile memanggil patch ke route profile.update", async () => {
    const user = userEvent.setup({ delay: null });
    renderEdit();

    const saveButtons = screen.getAllByRole("button", { name: "Save" });
    await user.click(saveButtons[0]);

    expect(patchSpy).toHaveBeenCalledTimes(1);
    expect(putSpy).not.toHaveBeenCalled();
    expect(patchSpy.mock.calls[0][0]).toBe("profile.update");
  });

  it("submit form password memanggil put ke route password.update dgn preserveScroll & onSuccess mereset field", async () => {
    const user = userEvent.setup({ delay: null });
    renderEdit();

    const saveButtons = screen.getAllByRole("button", { name: "Save" });
    await user.click(saveButtons[1]);

    expect(putSpy).toHaveBeenCalledTimes(1);
    expect(patchSpy).not.toHaveBeenCalled();
    const [url, options] = putSpy.mock.calls[0];
    expect(url).toBe("password.update");
    expect(options.preserveScroll).toBe(true);
    expect(typeof options.onSuccess).toBe("function");
    expect(typeof options.onError).toBe("function");

    options.onSuccess();
    expect(resetSpy).toHaveBeenCalledWith();
  });

  it("menampilkan validation errors dari props.errors di kedua form (name/email & password)", () => {
    errorsOverride = {
      name: "Nama wajib diisi.",
      email: "Email tidak valid.",
      current_password: "Password saat ini salah.",
      password: "Password terlalu lemah.",
      password_confirmation: "Konfirmasi tidak cocok.",
    };
    renderEdit();

    expect(screen.getByText("Nama wajib diisi.")).toBeInTheDocument();
    expect(screen.getByText("Email tidak valid.")).toBeInTheDocument();
    expect(screen.getByText("Password saat ini salah.")).toBeInTheDocument();
    expect(screen.getByText("Password terlalu lemah.")).toBeInTheDocument();
    expect(screen.getByText("Konfirmasi tidak cocok.")).toBeInTheDocument();
  });

  it("kedua tombol Save disabled saat processing=true", () => {
    processingOverride = true;
    renderEdit();

    const saveButtons = screen.getAllByRole("button", { name: "Save" });
    expect(saveButtons[0]).toBeDisabled();
    expect(saveButtons[1]).toBeDisabled();
  });

  it("kedua tombol Save tidak disabled saat processing=false", () => {
    renderEdit();

    const saveButtons = screen.getAllByRole("button", { name: "Save" });
    expect(saveButtons[0]).not.toBeDisabled();
    expect(saveButtons[1]).not.toBeDisabled();
  });

  it("meneruskan mustVerifyEmail=true & email belum diverifikasi -> tampilkan notice + link verification.send", () => {
    renderEdit(
      { mustVerifyEmail: true },
      { ...baseUser, email_verified_at: null },
    );

    expect(
      screen.getByText(/Your email address is unverified\./),
    ).toBeInTheDocument();
    const resendLink = screen.getByRole("link", {
      name: "Click here to re-send the verification email.",
    });
    expect(resendLink).toHaveAttribute("href", "verification.send");
  });

  it("mustVerifyEmail=false -> notice email unverified TIDAK ditampilkan meski email_verified_at null", () => {
    renderEdit(
      { mustVerifyEmail: false },
      { ...baseUser, email_verified_at: null },
    );

    expect(
      screen.queryByText(/Your email address is unverified\./),
    ).not.toBeInTheDocument();
  });

  it("meneruskan status='verification-link-sent' -> tampilkan pesan link terkirim", () => {
    renderEdit(
      { mustVerifyEmail: true, status: "verification-link-sent" },
      { ...baseUser, email_verified_at: null },
    );

    expect(
      screen.getByText(
        "A new verification link has been sent to your email address.",
      ),
    ).toBeInTheDocument();
  });

  it("section Delete Account merender tombol Delete Account (belum ada handler -- modal masih commented-out di source)", () => {
    renderEdit();

    const deleteButton = screen.getByRole("button", {
      name: "Delete Account",
    });
    expect(deleteButton).toBeInTheDocument();
    expect(deleteButton).toHaveAttribute("type", "button");
    expect(deleteButton).not.toBeDisabled();
  });
});
