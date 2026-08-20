import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import PasswordInput from "./PasswordInput";

describe("PasswordInput", () => {
  it("default type='password' (uncontrolled, visible=false)", () => {
    render(<PasswordInput />);
    const input = screen.getByDisplayValue("");
    expect(input).toHaveAttribute("type", "password");
  });

  it("toggle visibility saat tombol mata diklik (uncontrolled)", async () => {
    const user = userEvent.setup({ delay: null });
    render(<PasswordInput />);

    const input = screen.getByDisplayValue("");
    expect(input).toHaveAttribute("type", "password");

    await user.click(screen.getByRole("button"));
    expect(input).toHaveAttribute("type", "text");

    await user.click(screen.getByRole("button"));
    expect(input).toHaveAttribute("type", "password");
  });

  it("mode controlled: visible prop menentukan type, tombol memanggil onVisibleChange", async () => {
    const user = userEvent.setup({ delay: null });
    const onVisibleChange = vi.fn();
    const { rerender } = render(
      <PasswordInput visible={false} onVisibleChange={onVisibleChange} />,
    );

    const input = screen.getByDisplayValue("");
    expect(input).toHaveAttribute("type", "password");

    await user.click(screen.getByRole("button"));
    expect(onVisibleChange).toHaveBeenCalledWith(true);
    // Controlled: internal state TIDAK berubah tanpa prop berubah dari parent.
    expect(input).toHaveAttribute("type", "password");

    rerender(
      <PasswordInput visible={true} onVisibleChange={onVisibleChange} />,
    );
    expect(input).toHaveAttribute("type", "text");
  });

  it("disabled meneruskan atribut disabled ke input", () => {
    render(<PasswordInput disabled />);
    expect(screen.getByDisplayValue("")).toBeDisabled();
  });
});
