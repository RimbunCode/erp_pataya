import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

// Transition dari @headlessui/react cukup di-stub jadi render children saat
// show=true (perilaku animasi sendiri sudah di luar cakupan test komponen ini).
vi.mock("@headlessui/react", async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    Transition: ({ show, children }) => (show ? children : null),
  };
});

const useFormReturn = {
  data: { current_password: "", password: "", password_confirmation: "" },
  setData: vi.fn(),
  errors: {},
  put: vi.fn(),
  reset: vi.fn(),
  processing: false,
  recentlySuccessful: false,
};
vi.mock("@inertiajs/react", () => ({
  useForm: () => useFormReturn,
}));

window.route = (name) => name;

import UpdatePasswordForm from "./UpdatePasswordForm";

describe("Profile UpdatePasswordForm", () => {
  beforeEach(() => {
    useFormReturn.data = {
      current_password: "",
      password: "",
      password_confirmation: "",
    };
    useFormReturn.setData.mockReset();
    useFormReturn.errors = {};
    useFormReturn.put.mockReset();
    useFormReturn.reset.mockReset();
    useFormReturn.processing = false;
    useFormReturn.recentlySuccessful = false;
  });

  it("merender tanpa error dengan heading, deskripsi, dan tiga field kosong", async () => {
    await act(async () => {
      render(<UpdatePasswordForm />);
    });

    expect(
      screen.getByRole("heading", { name: "Update Password" }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/Ensure your account is using a long, random password/i),
    ).toBeInTheDocument();
    expect(screen.getByLabelText("Current Password")).toHaveValue("");
    expect(screen.getByLabelText("New Password")).toHaveValue("");
    expect(screen.getByLabelText("Confirm Password")).toHaveValue("");
    expect(screen.getByRole("button", { name: "Save" })).toBeInTheDocument();
  });

  it("field terisi dari data awal useForm", async () => {
    useFormReturn.data = {
      current_password: "old-secret",
      password: "new-secret",
      password_confirmation: "new-secret",
    };

    await act(async () => {
      render(<UpdatePasswordForm />);
    });

    expect(screen.getByLabelText("Current Password")).toHaveValue("old-secret");
    expect(screen.getByLabelText("New Password")).toHaveValue("new-secret");
    expect(screen.getByLabelText("Confirm Password")).toHaveValue("new-secret");
  });

  it("mengetik di field Current Password memanggil setData dengan key & value yang benar", async () => {
    const user = userEvent.setup({ delay: null });
    await act(async () => {
      render(<UpdatePasswordForm />);
    });

    await user.type(screen.getByLabelText("Current Password"), "a");

    expect(useFormReturn.setData).toHaveBeenCalledWith("current_password", "a");
  });

  it("mengetik di field New Password memanggil setData dengan key & value yang benar", async () => {
    const user = userEvent.setup({ delay: null });
    await act(async () => {
      render(<UpdatePasswordForm />);
    });

    await user.type(screen.getByLabelText("New Password"), "b");

    expect(useFormReturn.setData).toHaveBeenCalledWith("password", "b");
  });

  it("mengetik di field Confirm Password memanggil setData dengan key & value yang benar", async () => {
    const user = userEvent.setup({ delay: null });
    await act(async () => {
      render(<UpdatePasswordForm />);
    });

    await user.type(screen.getByLabelText("Confirm Password"), "c");

    expect(useFormReturn.setData).toHaveBeenCalledWith(
      "password_confirmation",
      "c",
    );
  });

  it("submit memanggil put ke route password.update dengan preserveScroll & onSuccess yang me-reset form", async () => {
    const user = userEvent.setup({ delay: null });
    await act(async () => {
      render(<UpdatePasswordForm />);
    });

    await user.click(screen.getByRole("button", { name: "Save" }));

    expect(useFormReturn.put).toHaveBeenCalledTimes(1);
    expect(useFormReturn.put).toHaveBeenCalledWith(
      "password.update",
      expect.objectContaining({
        preserveScroll: true,
        onSuccess: expect.any(Function),
        onError: expect.any(Function),
      }),
    );

    const options = useFormReturn.put.mock.calls[0][1];
    options.onSuccess();
    expect(useFormReturn.reset).toHaveBeenCalledWith();
  });

  it("onError dengan errors.password mereset password & password_confirmation lalu fokus ke field New Password", async () => {
    const user = userEvent.setup({ delay: null });
    await act(async () => {
      render(<UpdatePasswordForm />);
    });

    await user.click(screen.getByRole("button", { name: "Save" }));

    const options = useFormReturn.put.mock.calls[0][1];
    await act(async () => {
      options.onError({ password: "Password terlalu pendek." });
    });

    expect(useFormReturn.reset).toHaveBeenCalledWith(
      "password",
      "password_confirmation",
    );
    expect(screen.getByLabelText("New Password")).toHaveFocus();
  });

  it("onError dengan errors.current_password mereset current_password lalu fokus ke field Current Password", async () => {
    const user = userEvent.setup({ delay: null });
    await act(async () => {
      render(<UpdatePasswordForm />);
    });

    await user.click(screen.getByRole("button", { name: "Save" }));

    const options = useFormReturn.put.mock.calls[0][1];
    await act(async () => {
      options.onError({ current_password: "Password saat ini salah." });
    });

    expect(useFormReturn.reset).toHaveBeenCalledWith("current_password");
    expect(screen.getByLabelText("Current Password")).toHaveFocus();
  });

  it("menampilkan pesan error validasi utk current_password, password, dan password_confirmation", async () => {
    useFormReturn.errors = {
      current_password: "Password saat ini salah.",
      password: "Password terlalu pendek.",
      password_confirmation: "Konfirmasi tidak cocok.",
    };

    await act(async () => {
      render(<UpdatePasswordForm />);
    });

    expect(screen.getByText("Password saat ini salah.")).toBeInTheDocument();
    expect(screen.getByText("Password terlalu pendek.")).toBeInTheDocument();
    expect(screen.getByText("Konfirmasi tidak cocok.")).toBeInTheDocument();
  });

  it("tidak menampilkan pesan error apa pun bila errors kosong", async () => {
    await act(async () => {
      render(<UpdatePasswordForm />);
    });

    expect(
      screen.queryByText(/salah|terlalu pendek|tidak cocok/i),
    ).not.toBeInTheDocument();
  });

  it("tombol Save disabled saat processing=true", async () => {
    useFormReturn.processing = true;

    await act(async () => {
      render(<UpdatePasswordForm />);
    });

    expect(screen.getByRole("button", { name: "Save" })).toBeDisabled();
  });

  it("tombol Save tidak disabled saat processing=false", async () => {
    await act(async () => {
      render(<UpdatePasswordForm />);
    });

    expect(screen.getByRole("button", { name: "Save" })).not.toBeDisabled();
  });

  it("menampilkan teks 'Saved.' saat recentlySuccessful=true", async () => {
    useFormReturn.recentlySuccessful = true;

    await act(async () => {
      render(<UpdatePasswordForm />);
    });

    expect(screen.getByText("Saved.")).toBeInTheDocument();
  });

  it("tidak menampilkan teks 'Saved.' saat recentlySuccessful=false", async () => {
    await act(async () => {
      render(<UpdatePasswordForm />);
    });

    expect(screen.queryByText("Saved.")).not.toBeInTheDocument();
  });

  it("tanpa prop className, section tidak melempar error saat dirender", async () => {
    const { container } = await act(async () => render(<UpdatePasswordForm />));

    expect(container.querySelector("section")).toBeInTheDocument();
  });

  it("dgn prop className, class custom diterapkan ke section", async () => {
    let container;
    await act(async () => {
      ({ container } = render(<UpdatePasswordForm className="custom-class" />));
    });

    expect(container.querySelector("section")).toHaveClass("custom-class");
  });
});
