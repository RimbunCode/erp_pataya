import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import ColorInput from "./ColorInput";

describe("ColorInput", () => {
  it("render tanpa crash: textbox menampilkan value dan placeholder diteruskan", () => {
    render(
      <ColorInput
        value="#ff0000"
        placeholder="cth. #FFFFFF"
        onValueChange={() => {}}
      />,
    );

    const input = screen.getByRole("textbox");
    expect(input).toHaveValue("#ff0000");
    expect(input).toHaveAttribute("placeholder", "cth. #FFFFFF");
  });

  it("value null diperlakukan sebagai string kosong: textbox kosong dan tombol reset tidak muncul", () => {
    render(<ColorInput value={null} onValueChange={() => {}} />);

    expect(screen.getByRole("textbox")).toHaveValue("");
    expect(
      screen.queryByRole("button", { name: "Reset warna" }),
    ).not.toBeInTheDocument();
  });

  it("tanpa prop value sama sekali, textbox tetap kosong tanpa crash", () => {
    render(<ColorInput onValueChange={() => {}} />);
    expect(screen.getByRole("textbox")).toHaveValue("");
  });

  it("tombol reset muncul saat value terisi; klik memanggil onValueChange(null) dan mengosongkan textbox", async () => {
    const user = userEvent.setup();
    const onValueChange = vi.fn();
    render(<ColorInput value="#123456" onValueChange={onValueChange} />);

    const resetButton = screen.getByRole("button", { name: "Reset warna" });
    await user.click(resetButton);

    expect(onValueChange).toHaveBeenCalledWith(null);
    expect(screen.getByRole("textbox")).toHaveValue("");
    expect(
      screen.queryByRole("button", { name: "Reset warna" }),
    ).not.toBeInTheDocument();
  });

  it("mengetik hex tidak/belum valid (parsial) menampilkan teks ketikan tapi TIDAK memicu onValueChange", async () => {
    const user = userEvent.setup();
    const onValueChange = vi.fn();
    render(<ColorInput value="" onValueChange={onValueChange} />);

    const input = screen.getByRole("textbox");
    await user.type(input, "#12");

    expect(input).toHaveValue("#12");
    expect(onValueChange).not.toHaveBeenCalled();
  });

  it("mengetik hex pendek valid (3 digit) memicu onValueChange dengan versi dinormalisasi (6 digit, lowercase)", async () => {
    const user = userEvent.setup();
    const onValueChange = vi.fn();
    render(<ColorInput value="" onValueChange={onValueChange} />);

    const input = screen.getByRole("textbox");
    await user.type(input, "#ABC");

    expect(onValueChange).toHaveBeenLastCalledWith("#aabbcc");
  });

  it("mengetik hex 6 digit valid (uppercase) memicu onValueChange dengan value dinormalisasi ke lowercase", async () => {
    const user = userEvent.setup();
    const onValueChange = vi.fn();
    render(<ColorInput value="" onValueChange={onValueChange} />);

    const input = screen.getByRole("textbox");
    await user.type(input, "#A1B2C3");

    expect(onValueChange).toHaveBeenLastCalledWith("#a1b2c3");
  });

  it("memilih warna lewat native color picker langsung memicu onValueChange tanpa validasi format", () => {
    const onValueChange = vi.fn();
    render(<ColorInput value="#000000" onValueChange={onValueChange} />);

    const picker = screen.getByLabelText("Pick color");
    fireEvent.change(picker, { target: { value: "#112233" } });

    expect(onValueChange).toHaveBeenCalledWith("#112233");
    expect(screen.getByRole("textbox")).toHaveValue("#112233");
  });

  it("perubahan prop value dari luar (controlled) menyinkronkan ulang draft yang tampil di textbox", () => {
    const { rerender } = render(
      <ColorInput value="#111111" onValueChange={() => {}} />,
    );
    expect(screen.getByRole("textbox")).toHaveValue("#111111");

    rerender(<ColorInput value="#222222" onValueChange={() => {}} />);
    expect(screen.getByRole("textbox")).toHaveValue("#222222");
  });

  it("className custom digabung dengan className default InputGroup (bukan menggantikan)", () => {
    const { container } = render(
      <ColorInput
        value="#333333"
        onValueChange={() => {}}
        className="custom-color-input"
      />,
    );
    const group = container.querySelector('[data-slot="input-group"]');
    expect(group.className).toContain("custom-color-input");
    expect(group.className).toContain("flex");
  });

  it("swatch warna mengikuti value saat ini ketika valid", () => {
    render(<ColorInput value="#ff00ff" onValueChange={() => {}} />);

    const picker = screen.getByLabelText("Pick color");
    const swatch = picker.parentElement;
    expect(swatch.style.backgroundColor).toBe("rgb(255, 0, 255)");
  });

  it("value bukan format hex valid tidak menghasilkan warna swatch (CSS menolak nilai invalid), picker tetap fallback ke hitam", () => {
    render(<ColorInput value="bukan-hex" onValueChange={() => {}} />);

    const picker = screen.getByLabelText("Pick color");
    const swatch = picker.parentElement;
    expect(swatch.style.backgroundColor).toBe("");
    expect(picker).toHaveValue("#000000");
  });

  it("onValueChange opsional: klik tombol reset tidak crash tanpa handler diberikan", async () => {
    const user = userEvent.setup();
    render(<ColorInput value="#444444" />);

    const resetButton = screen.getByRole("button", { name: "Reset warna" });
    await user.click(resetButton);

    expect(screen.getByRole("textbox")).toHaveValue("");
  });
});
