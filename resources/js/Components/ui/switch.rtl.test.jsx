import { createRef } from "react";
import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { Switch } from "./switch";

describe("Switch", () => {
  it("render tanpa crash dengan role 'switch'", () => {
    render(<Switch />);
    const switchEl = screen.getByRole("switch");
    expect(switchEl).toBeInTheDocument();
    expect(switchEl.tagName).toBe("BUTTON");
    expect(switchEl).toHaveAttribute("type", "button");
  });

  it("default (tanpa checked/defaultChecked): data-state='unchecked', aria-checked='false'", () => {
    render(<Switch />);
    const switchEl = screen.getByRole("switch");
    expect(switchEl).toHaveAttribute("data-state", "unchecked");
    expect(switchEl).toHaveAttribute("aria-checked", "false");
  });

  it("checked=true (controlled): data-state='checked', aria-checked='true'", () => {
    render(<Switch checked={true} onCheckedChange={() => {}} />);
    const switchEl = screen.getByRole("switch");
    expect(switchEl).toHaveAttribute("data-state", "checked");
    expect(switchEl).toHaveAttribute("aria-checked", "true");
  });

  it("checked=false (controlled): data-state='unchecked', aria-checked='false'", () => {
    render(<Switch checked={false} onCheckedChange={() => {}} />);
    const switchEl = screen.getByRole("switch");
    expect(switchEl).toHaveAttribute("data-state", "unchecked");
    expect(switchEl).toHaveAttribute("aria-checked", "false");
  });

  it("defaultChecked=true (uncontrolled): state awal checked tanpa perlu prop checked", () => {
    render(<Switch defaultChecked />);
    const switchEl = screen.getByRole("switch");
    expect(switchEl).toHaveAttribute("data-state", "checked");
    expect(switchEl).toHaveAttribute("aria-checked", "true");
  });

  it("menggabungkan className custom dengan className default (bukan menggantikan)", () => {
    render(<Switch className="custom-switch-class" />);
    const switchEl = screen.getByRole("switch");
    expect(switchEl.className).toContain("custom-switch-class");
    expect(switchEl.className).toContain("inline-flex");
    expect(switchEl.className).toContain("rounded-full");
  });

  it("className default menyertakan warna track per state (data-[state=unchecked]:bg-zinc-300, data-[state=checked]:bg-indigo-600)", () => {
    render(<Switch />);
    const switchEl = screen.getByRole("switch");
    expect(switchEl.className).toContain("data-[state=unchecked]:bg-zinc-300");
    expect(switchEl.className).toContain("data-[state=checked]:bg-indigo-600");
  });

  it("forwardRef meneruskan ref ke elemen <button> asli", () => {
    const ref = createRef();
    render(<Switch ref={ref} />);
    expect(ref.current).toBe(screen.getByRole("switch"));
    expect(ref.current.tagName).toBe("BUTTON");
  });

  it("klik memicu onCheckedChange dengan nilai toggle yang benar (false -> true)", async () => {
    const user = userEvent.setup();
    const onCheckedChange = vi.fn();
    render(<Switch checked={false} onCheckedChange={onCheckedChange} />);
    await user.click(screen.getByRole("switch"));
    expect(onCheckedChange).toHaveBeenCalledWith(true);
  });

  it("klik memicu onCheckedChange dengan nilai toggle yang benar (true -> false)", async () => {
    const user = userEvent.setup();
    const onCheckedChange = vi.fn();
    render(<Switch checked={true} onCheckedChange={onCheckedChange} />);
    await user.click(screen.getByRole("switch"));
    expect(onCheckedChange).toHaveBeenCalledWith(false);
  });

  it("uncontrolled (tanpa prop checked): klik tetap mengubah data-state internal walau tanpa onCheckedChange", async () => {
    const user = userEvent.setup();
    render(<Switch />);
    const switchEl = screen.getByRole("switch");
    expect(switchEl).toHaveAttribute("data-state", "unchecked");
    await user.click(switchEl);
    expect(switchEl).toHaveAttribute("data-state", "checked");
    expect(switchEl).toHaveAttribute("aria-checked", "true");
  });

  it("disabled=true mencegah interaksi klik memicu onCheckedChange", async () => {
    const user = userEvent.setup();
    const onCheckedChange = vi.fn();
    render(
      <Switch checked={false} disabled onCheckedChange={onCheckedChange} />,
    );
    const switchEl = screen.getByRole("switch");
    expect(switchEl).toBeDisabled();
    expect(switchEl).toHaveAttribute("data-disabled", "");
    await user.click(switchEl);
    expect(onCheckedChange).not.toHaveBeenCalled();
  });

  it("className default menyertakan styling disabled (disabled:cursor-not-allowed disabled:opacity-50)", () => {
    render(<Switch disabled />);
    const switchEl = screen.getByRole("switch");
    expect(switchEl.className).toContain("disabled:cursor-not-allowed");
    expect(switchEl.className).toContain("disabled:opacity-50");
  });

  it("required=true menghasilkan atribut aria-required='true'", () => {
    render(<Switch required />);
    expect(screen.getByRole("switch")).toHaveAttribute("aria-required", "true");
  });

  it("tanpa prop required, aria-required TIDAK dirender", () => {
    render(<Switch />);
    expect(screen.getByRole("switch")).not.toHaveAttribute("aria-required");
  });

  it("value default 'on' (bawaan Radix) diteruskan sbg atribut value pada <button>", () => {
    render(<Switch />);
    expect(screen.getByRole("switch")).toHaveAttribute("value", "on");
  });

  it("prop value custom menggantikan default 'on'", () => {
    render(<Switch value="ya" />);
    expect(screen.getByRole("switch")).toHaveAttribute("value", "ya");
  });

  // BUG (lihat bugFindings): prop `name` diserap Radix SwitchPrimitive.Root
  // hanya untuk hidden bubble-input form (yang tak dirender di luar <form>),
  // TIDAK pernah diteruskan ke elemen <button> switch itu sendiri -- ini
  // perilaku default Radix (bukan bug switch.jsx), didokumentasikan di sini
  // supaya konsumen tidak berharap `name` muncul sbg atribut pada <button>.
  it("prop name TIDAK diteruskan sbg atribut pada elemen <button> (diserap utk hidden form input)", () => {
    render(<Switch name="aktif" />);
    expect(screen.getByRole("switch")).not.toHaveAttribute("name");
  });

  it("meneruskan props lain (aria-label, data-testid) ke elemen asli", () => {
    render(<Switch aria-label="Status aktif" data-testid="my-switch" />);
    const switchEl = screen.getByTestId("my-switch");
    expect(switchEl).toHaveAttribute("aria-label", "Status aktif");
  });

  it("render elemen thumb (span) di dalam switch dengan data-state mengikuti state induk", () => {
    const { container } = render(<Switch checked onCheckedChange={() => {}} />);
    const thumb = container.querySelector("span");
    expect(thumb).toBeInTheDocument();
    expect(thumb).toHaveAttribute("data-state", "checked");
  });

  it("className default thumb menyertakan translate-x per state (data-[state=checked]:translate-x-4, data-[state=unchecked]:translate-x-0)", () => {
    const { container } = render(<Switch />);
    const thumb = container.querySelector("span");
    expect(thumb.className).toContain("data-[state=checked]:translate-x-4");
    expect(thumb.className).toContain("data-[state=unchecked]:translate-x-0");
  });
});
