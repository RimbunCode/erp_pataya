import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";

// UpdateProfileInformationForm pakai useForm (patch) + usePage (auth.user) dari
// @inertiajs/react. Pola mock sama dgn Pages/Profile/Edit.rtl.test.jsx: useForm
// jadi fake stateful (per render instance, via useState) supaya setData/typing
// benar-benar reaktif, sedangkan patch/usePage jadi spy/mock module-level yg
// direset tiap test. Link distub jadi <a> polos spy supaya href/method/as bisa
// diverifikasi tanpa menyeret router Inertia asli.
// Button/InputError/InputLabel/TextInput/Transition dirender NYATA (ringan,
// tanpa dependency context berat) mengikuti pola Edit.rtl.test.jsx.

let errorsOverride = {};
let processingOverride = false;
const patchSpy = vi.fn();
const usePageMock = vi.fn();

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
  };
}

vi.mock("@inertiajs/react", () => ({
  useForm: (seed) => useFormFake(seed),
  usePage: () => usePageMock(),
  Link: ({ href, children, ...props }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

window.route = (name) => name;

import UpdateProfileInformation from "./UpdateProfileInformationForm";

const baseUser = {
  name: "Budi Santoso",
  email: "budi@example.com",
  email_verified_at: "2026-01-01T00:00:00.000Z",
};

function renderForm(props = {}, user = baseUser) {
  usePageMock.mockReturnValue({ props: { auth: { user } } });
  return render(
    <UpdateProfileInformation
      mustVerifyEmail={false}
      status={null}
      {...props}
    />,
  );
}

describe("UpdateProfileInformationForm", () => {
  beforeEach(() => {
    errorsOverride = {};
    processingOverride = false;
    patchSpy.mockReset();
    usePageMock.mockReset();
  });

  it("merender tanpa error dgn heading, deskripsi, dan field Name/Email", () => {
    renderForm();

    expect(
      screen.getByRole("heading", { name: "Profile Information" }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        "Update your account's profile information and email address.",
      ),
    ).toBeInTheDocument();
    expect(screen.getByLabelText("Name")).toBeInTheDocument();
    expect(screen.getByLabelText("Email")).toBeInTheDocument();
  });

  it("field name & email terisi dari usePage().props.auth.user", () => {
    renderForm();

    expect(screen.getByLabelText("Name")).toHaveValue("Budi Santoso");
    expect(screen.getByLabelText("Email")).toHaveValue("budi@example.com");
  });

  it("mengetik di field name/email memanggil setData & merefleksikan value baru", async () => {
    const user = userEvent.setup({ delay: null });
    renderForm();

    const nameInput = screen.getByLabelText("Name");
    await user.clear(nameInput);
    await user.type(nameInput, "Nama Baru");
    expect(nameInput).toHaveValue("Nama Baru");

    const emailInput = screen.getByLabelText("Email");
    await user.clear(emailInput);
    await user.type(emailInput, "baru@example.com");
    expect(emailInput).toHaveValue("baru@example.com");
  });

  it("submit form memanggil patch ke route profile.update", async () => {
    const user = userEvent.setup({ delay: null });
    renderForm();

    await user.click(screen.getByRole("button", { name: "Save" }));

    expect(patchSpy).toHaveBeenCalledTimes(1);
    expect(patchSpy.mock.calls[0][0]).toBe("profile.update");
  });

  it("menampilkan validation errors dari props.errors utk field name & email", () => {
    errorsOverride = {
      name: "Nama wajib diisi.",
      email: "Email tidak valid.",
    };
    renderForm();

    expect(screen.getByText("Nama wajib diisi.")).toBeInTheDocument();
    expect(screen.getByText("Email tidak valid.")).toBeInTheDocument();
  });

  it("tombol Save disabled saat processing=true, tidak disabled saat processing=false", () => {
    processingOverride = true;
    const { rerender } = renderForm();

    expect(screen.getByRole("button", { name: "Save" })).toBeDisabled();

    processingOverride = false;
    usePageMock.mockReturnValue({ props: { auth: { user: baseUser } } });
    rerender(
      <UpdateProfileInformation mustVerifyEmail={false} status={null} />,
    );

    expect(screen.getByRole("button", { name: "Save" })).not.toBeDisabled();
  });

  it("mustVerifyEmail=true & email belum diverifikasi -> tampilkan notice + link verification.send", () => {
    renderForm(
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
    expect(resendLink).toHaveAttribute("method", "post");
    expect(resendLink).toHaveAttribute("as", "button");
  });

  it("mustVerifyEmail=false -> notice email unverified TIDAK ditampilkan meski email_verified_at null", () => {
    renderForm(
      { mustVerifyEmail: false },
      { ...baseUser, email_verified_at: null },
    );

    expect(
      screen.queryByText(/Your email address is unverified\./),
    ).not.toBeInTheDocument();
  });

  it("mustVerifyEmail=true tapi email sudah terverifikasi -> notice TIDAK ditampilkan", () => {
    renderForm({ mustVerifyEmail: true }, baseUser);

    expect(
      screen.queryByText(/Your email address is unverified\./),
    ).not.toBeInTheDocument();
  });

  it("status='verification-link-sent' -> tampilkan pesan link terkirim", () => {
    renderForm(
      { mustVerifyEmail: true, status: "verification-link-sent" },
      { ...baseUser, email_verified_at: null },
    );

    expect(
      screen.getByText(
        "A new verification link has been sent to your email address.",
      ),
    ).toBeInTheDocument();
  });

  it("status='verification-link-sent' tapi mustVerifyEmail=false -> pesan link terkirim TIDAK ditampilkan", () => {
    renderForm(
      { mustVerifyEmail: false, status: "verification-link-sent" },
      { ...baseUser, email_verified_at: null },
    );

    expect(
      screen.queryByText(
        "A new verification link has been sent to your email address.",
      ),
    ).not.toBeInTheDocument();
  });

  it("tanpa prop className, section tidak melempar error (default className kosong)", () => {
    const { container } = renderForm();

    const section = container.querySelector("section");
    expect(section).toBeInTheDocument();
  });

  it("dgn prop className, class custom diteruskan ke section", () => {
    const { container } = renderForm({ className: "custom-class" });

    const section = container.querySelector("section");
    expect(section).toHaveClass("custom-class");
  });
});
