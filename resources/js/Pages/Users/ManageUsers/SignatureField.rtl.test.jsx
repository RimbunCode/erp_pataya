import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import React from "react";

vi.mock("laravel-react-i18n", () => ({
  useLaravelReactI18n: () => ({ t: (key) => key }),
}));

const routerPost = vi.fn();
const routerDelete = vi.fn();
vi.mock("@inertiajs/react", () => ({
  router: {
    post: (...args) => routerPost(...args),
    delete: (...args) => routerDelete(...args),
  },
}));

vi.mock("./SignatureCanvas", () => ({
  default: ({ onSave, onCancel }) => (
    <div data-testid="signature-canvas-stub">
      <button
        type="button"
        onClick={() => onSave?.(new Blob(["x"], { type: "image/png" }))}
      >
        stub-save
      </button>
      <button type="button" onClick={() => onCancel?.()}>
        stub-cancel
      </button>
    </div>
  ),
}));

beforeEach(() => {
  vi.clearAllMocks();
  globalThis.route = (name, param) => `/${name}/${param}`;
});

import SignatureField from "./SignatureField";

const signedUser = { id: "u1", name: "Budi", has_signature: true };
const unsignedUser = { id: "u2", name: "Ani", has_signature: false };

describe("SignatureField", () => {
  it("menampilkan pratinjau saat user punya tanda tangan", () => {
    render(<SignatureField user={signedUser} canEdit />);

    const image = screen.getByRole("img", {
      name: "user.signature.preview_alt",
    });
    expect(image).toHaveAttribute("src", "/users.showSignature/u1");
  });

  it("menampilkan placeholder saat belum ada tanda tangan", () => {
    render(<SignatureField user={unsignedUser} canEdit />);

    expect(screen.getByText("user.signature.not_signed_yet")).toBeVisible();
    expect(screen.queryByRole("img")).toBeNull();
  });

  it("menyembunyikan tombol hapus saat belum ada tanda tangan", () => {
    render(<SignatureField user={unsignedUser} canEdit />);

    expect(
      screen.queryByRole("button", { name: /user\.signature\.remove/ }),
    ).toBeNull();
  });

  it("menampilkan tombol hapus saat tanda tangan ada", () => {
    render(<SignatureField user={signedUser} canEdit />);

    expect(
      screen.getByRole("button", { name: /user\.signature\.remove/ }),
    ).toBeVisible();
  });

  it("menyembunyikan seluruh tombol aksi saat bukan pemilik akun", () => {
    render(<SignatureField user={signedUser} canEdit={false} />);

    // Pratinjau tetap tampil, aksinya tidak.
    expect(
      screen.getByRole("img", { name: "user.signature.preview_alt" }),
    ).toBeVisible();
    expect(
      screen.queryByRole("button", { name: /user\.signature\.upload/ }),
    ).toBeNull();
    expect(
      screen.queryByRole("button", { name: /user\.signature\.remove/ }),
    ).toBeNull();
  });

  it("mengirim source=upload saat memilih berkas", async () => {
    const user = userEvent.setup();
    render(<SignatureField user={unsignedUser} canEdit />);

    const file = new File(["bytes"], "ttd.png", { type: "image/png" });
    await user.upload(screen.getByTestId("signature-upload-input"), file);

    expect(routerPost).toHaveBeenCalledTimes(1);
    const [, payload, options] = routerPost.mock.calls[0];
    expect(payload.source).toBe("upload");
    expect(payload.signature).toBeInstanceOf(File);
    expect(options.forceFormData).toBe(true);
  });

  it("mengirim source=canvas dari hasil gambar tangan", async () => {
    const user = userEvent.setup();
    render(<SignatureField user={unsignedUser} canEdit />);

    await user.click(
      screen.getByRole("button", { name: /user\.signature\.draw/ }),
    );
    await user.click(screen.getByRole("button", { name: "stub-save" }));

    expect(routerPost).toHaveBeenCalledTimes(1);
    expect(routerPost.mock.calls[0][1].source).toBe("canvas");
  });

  it("memanggil router.delete saat menghapus tanda tangan", async () => {
    const user = userEvent.setup();
    render(<SignatureField user={signedUser} canEdit />);

    await user.click(
      screen.getByRole("button", { name: /user\.signature\.remove/ }),
    );

    expect(routerDelete).toHaveBeenCalledWith(
      "/users.removeSignature/u1",
      expect.objectContaining({ reset: ["user", "auth"] }),
    );
  });
});
