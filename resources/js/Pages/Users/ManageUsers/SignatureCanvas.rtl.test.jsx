import { describe, expect, it, vi, beforeEach } from "vitest";
import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import React from "react";

// jsdom tidak mengimplementasikan canvas 2D context sama sekali. Yang diuji
// di sini adalah LOGIKA komponen (kapan tombol simpan aktif, apa yang
// dikirim ke onSave), bukan hasil gambarnya, jadi context-nya distub
// seadanya alih-alih memasang `canvas` native yang berat.
const ctxStub = {
  scale: vi.fn(),
  beginPath: vi.fn(),
  moveTo: vi.fn(),
  lineTo: vi.fn(),
  stroke: vi.fn(),
  clearRect: vi.fn(),
  lineCap: "",
  lineJoin: "",
  lineWidth: 0,
  strokeStyle: "",
};

beforeEach(() => {
  vi.clearAllMocks();

  HTMLCanvasElement.prototype.getContext = vi.fn(() => ctxStub);
  HTMLCanvasElement.prototype.toBlob = vi.fn((callback) => {
    callback(new Blob(["png-bytes"], { type: "image/png" }));
  });
  // getBoundingClientRect default jsdom mengembalikan nol semua; beri ukuran
  // supaya perhitungan koordinat tidak NaN.
  HTMLCanvasElement.prototype.getBoundingClientRect = vi.fn(() => ({
    left: 0,
    top: 0,
    width: 300,
    height: 160,
    right: 300,
    bottom: 160,
    x: 0,
    y: 0,
    toJSON: () => {},
  }));
});

vi.mock("laravel-react-i18n", () => ({
  useLaravelReactI18n: () => ({ t: (key) => key }),
}));

import SignatureCanvas from "./SignatureCanvas";

function drawOn(canvas) {
  // pointerdown saja sudah menandai goresan (tap tanpa geser tetap dihitung).
  // dispatchEvent manual, bukan userEvent: jsdom tidak punya PointerEvent
  // pada API userEvent, dan yang diuji memang handler pointer komponen ini.
  // Dibungkus act() supaya setHasStroke ter-flush sebelum assertion.
  act(() => {
    canvas.dispatchEvent(
      new PointerEvent("pointerdown", {
        bubbles: true,
        clientX: 50,
        clientY: 50,
        pointerId: 1,
      }),
    );
  });
}

describe("SignatureCanvas", () => {
  it("menonaktifkan tombol simpan saat kanvas masih kosong", () => {
    render(<SignatureCanvas />);

    expect(
      screen.getByRole("button", { name: "user.signature.save" }),
    ).toBeDisabled();
  });

  it("mengaktifkan tombol simpan setelah ada goresan", () => {
    render(<SignatureCanvas />);

    drawOn(screen.getByRole("img", { name: "user.signature.draw" }));

    expect(
      screen.getByRole("button", { name: "user.signature.save" }),
    ).toBeEnabled();
  });

  it("menonaktifkan lagi setelah dibersihkan", async () => {
    const user = userEvent.setup();
    render(<SignatureCanvas />);

    drawOn(screen.getByRole("img", { name: "user.signature.draw" }));
    await user.click(
      screen.getByRole("button", { name: "user.signature.clear" }),
    );

    expect(
      screen.getByRole("button", { name: "user.signature.save" }),
    ).toBeDisabled();
    expect(ctxStub.clearRect).toHaveBeenCalled();
  });

  it("mengirim blob PNG ke onSave", async () => {
    const user = userEvent.setup();
    const onSave = vi.fn();
    render(<SignatureCanvas onSave={onSave} />);

    drawOn(screen.getByRole("img", { name: "user.signature.draw" }));
    await user.click(
      screen.getByRole("button", { name: "user.signature.save" }),
    );

    expect(onSave).toHaveBeenCalledTimes(1);
    expect(onSave.mock.calls[0][0]).toBeInstanceOf(Blob);
    expect(HTMLCanvasElement.prototype.toBlob).toHaveBeenCalledWith(
      expect.any(Function),
      "image/png",
    );
  });

  it("tidak memanggil onSave saat kanvas kosong", async () => {
    const user = userEvent.setup();
    const onSave = vi.fn();
    render(<SignatureCanvas onSave={onSave} />);

    const saveButton = screen.getByRole("button", {
      name: "user.signature.save",
    });
    await user.click(saveButton).catch(() => {});

    expect(onSave).not.toHaveBeenCalled();
  });

  it("menonaktifkan simpan selagi proses penyimpanan berjalan", () => {
    render(<SignatureCanvas saving />);

    drawOn(screen.getByRole("img", { name: "user.signature.draw" }));

    expect(
      screen.getByRole("button", { name: "user.signature.save" }),
    ).toBeDisabled();
  });

  it("memanggil onCancel dari tombol batal", async () => {
    const user = userEvent.setup();
    const onCancel = vi.fn();
    render(<SignatureCanvas onCancel={onCancel} />);

    await user.click(
      screen.getByRole("button", { name: "user.signature.cancel" }),
    );

    expect(onCancel).toHaveBeenCalledTimes(1);
  });
});
