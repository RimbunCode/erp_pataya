import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";

import DeleteUserForm from "./DeleteUserForm";

// DeleteUserForm saat ini adalah komponen statis: tidak ada useForm/Inertia,
// tidak ada state, dan tombol "Delete Account" tidak punya onClick (modal
// konfirmasi dgn password di-comment-out di source, lihat blok JSX yg
// di-comment). Jadi cakupan test di sini terbatas pada apa yg benar-benar
// dirender: heading, teks deskripsi, tombol, dan penggabungan className.

describe("DeleteUserForm", () => {
  it("merender tanpa error dgn heading, deskripsi, dan tombol Delete Account", () => {
    render(<DeleteUserForm />);

    expect(
      screen.getByRole("heading", { name: "Delete Account" }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/Once your account is deleted, all of its resources/i),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Delete Account" }),
    ).toBeInTheDocument();
  });

  it("tombol Delete Account bertipe 'button' (bukan submit) dan tidak disabled", () => {
    render(<DeleteUserForm />);

    const button = screen.getByRole("button", { name: "Delete Account" });
    expect(button).toHaveAttribute("type", "button");
    expect(button).not.toBeDisabled();
  });

  it("tanpa prop className, section tetap dapat class default 'space-y-6'", () => {
    const { container } = render(<DeleteUserForm />);

    const section = container.querySelector("section");
    expect(section).toHaveClass("space-y-6");
  });

  it("dgn prop className, class custom digabung dgn class default 'space-y-6'", () => {
    const { container } = render(<DeleteUserForm className="custom-class" />);

    const section = container.querySelector("section");
    expect(section).toHaveClass("space-y-6");
    expect(section).toHaveClass("custom-class");
  });

  it("klik tombol Delete Account tidak melempar error (belum ada handler terpasang saat ini)", async () => {
    const { default: userEvent } = await import("@testing-library/user-event");
    const user = userEvent.setup({ delay: null });
    render(<DeleteUserForm />);

    // BUG (lihat bugFindings): tombol "Delete Account" tidak punya onClick
    // sama sekali -- modal konfirmasi password (di-comment di source) belum
    // disambungkan, jadi klik ini murni no-op observable.
    await user.click(screen.getByRole("button", { name: "Delete Account" }));

    expect(
      screen.getByRole("button", { name: "Delete Account" }),
    ).toBeInTheDocument();
  });
});
