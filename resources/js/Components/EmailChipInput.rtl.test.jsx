import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import EmailChipInput from "./EmailChipInput";

describe("EmailChipInput", () => {
  it("menambahkan chip saat Enter ditekan pada email valid", async () => {
    const user = userEvent.setup();
    const onValueChange = vi.fn();

    render(<EmailChipInput value={[]} onValueChange={onValueChange} />);

    await user.type(screen.getByRole("textbox"), "customer@example.com{Enter}");

    expect(onValueChange).toHaveBeenCalledWith(["customer@example.com"]);
  });

  it("tidak menambahkan chip untuk email tidak valid", async () => {
    const user = userEvent.setup();
    const onValueChange = vi.fn();

    render(<EmailChipInput value={[]} onValueChange={onValueChange} />);

    await user.type(screen.getByRole("textbox"), "bukan-email{Enter}");

    expect(onValueChange).not.toHaveBeenCalled();
  });

  it("tidak menambahkan duplikat email yang sudah ada di value", async () => {
    const user = userEvent.setup();
    const onValueChange = vi.fn();

    render(
      <EmailChipInput
        value={["customer@example.com"]}
        onValueChange={onValueChange}
      />,
    );

    await user.type(screen.getByRole("textbox"), "customer@example.com{Enter}");

    expect(onValueChange).not.toHaveBeenCalled();
  });

  it("menghapus chip saat tombol hapus diklik", async () => {
    const user = userEvent.setup();
    const onValueChange = vi.fn();

    render(
      <EmailChipInput
        value={["customer@example.com", "other@example.com"]}
        onValueChange={onValueChange}
      />,
    );

    const chip = screen.getByText("customer@example.com").closest("div");
    await user.click(chip.querySelector("button"));

    expect(onValueChange).toHaveBeenCalledWith(["other@example.com"]);
  });

  it("menghapus chip terakhir saat Backspace ditekan pada input kosong", async () => {
    const user = userEvent.setup();
    const onValueChange = vi.fn();

    render(
      <EmailChipInput
        value={["customer@example.com"]}
        onValueChange={onValueChange}
      />,
    );

    await user.click(screen.getByRole("textbox"));
    await user.keyboard("{Backspace}");

    expect(onValueChange).toHaveBeenCalledWith([]);
  });

  it("tidak menampilkan tombol hapus saat disabled", () => {
    render(
      <EmailChipInput value={["customer@example.com"]} disabled />,
    );

    expect(
      screen.getByText("customer@example.com").closest("div").querySelector("button"),
    ).toBeNull();
  });
});
