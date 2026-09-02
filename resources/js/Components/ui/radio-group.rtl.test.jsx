import { createRef } from "react";
import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { RadioGroup, RadioGroupItem } from "./radio-group";

describe("RadioGroup", () => {
  it("render tanpa crash dengan role 'radiogroup'", () => {
    render(
      <RadioGroup>
        <RadioGroupItem value="a" />
      </RadioGroup>,
    );
    expect(screen.getByRole("radiogroup")).toBeInTheDocument();
  });

  it("className default 'grid gap-2' terpakai", () => {
    render(
      <RadioGroup>
        <RadioGroupItem value="a" />
      </RadioGroup>,
    );
    const group = screen.getByRole("radiogroup");
    expect(group.className).toContain("grid");
    expect(group.className).toContain("gap-2");
  });

  it("className custom digabung dengan className default (bukan menggantikan)", () => {
    render(
      <RadioGroup className="custom-group-class">
        <RadioGroupItem value="a" />
      </RadioGroup>,
    );
    const group = screen.getByRole("radiogroup");
    expect(group.className).toContain("custom-group-class");
    expect(group.className).toContain("grid");
    expect(group.className).toContain("gap-2");
  });

  it("forwardRef meneruskan ref ke elemen DOM asli (root radiogroup)", () => {
    const ref = createRef();
    render(
      <RadioGroup ref={ref}>
        <RadioGroupItem value="a" />
      </RadioGroup>,
    );
    expect(ref.current).toBe(screen.getByRole("radiogroup"));
  });

  it("meneruskan props lain (value, onValueChange, aria-label) ke elemen asli", () => {
    const onValueChange = vi.fn();
    render(
      <RadioGroup value="b" onValueChange={onValueChange} aria-label="Pilihan">
        <RadioGroupItem value="a" aria-label="a" />
        <RadioGroupItem value="b" aria-label="b" />
      </RadioGroup>,
    );
    const group = screen.getByRole("radiogroup");
    expect(group).toHaveAttribute("aria-label", "Pilihan");
    expect(screen.getByRole("radio", { name: "b" })).toHaveAttribute(
      "aria-checked",
      "true",
    );
  });

  it("klik item lain memicu onValueChange dengan value item yang diklik", async () => {
    const user = userEvent.setup();
    const onValueChange = vi.fn();
    render(
      <RadioGroup value="a" onValueChange={onValueChange}>
        <RadioGroupItem value="a" aria-label="a" />
        <RadioGroupItem value="b" aria-label="b" />
      </RadioGroup>,
    );
    await user.click(screen.getByRole("radio", { name: "b" }));
    expect(onValueChange).toHaveBeenCalledWith("b");
  });

  it("disabled pada Root mencegah interaksi klik pada semua item", async () => {
    const user = userEvent.setup();
    const onValueChange = vi.fn();
    render(
      <RadioGroup value="a" onValueChange={onValueChange} disabled>
        <RadioGroupItem value="a" aria-label="a" />
        <RadioGroupItem value="b" aria-label="b" />
      </RadioGroup>,
    );
    const itemB = screen.getByRole("radio", { name: "b" });
    expect(itemB).toBeDisabled();
    await user.click(itemB);
    expect(onValueChange).not.toHaveBeenCalled();
  });
});

describe("RadioGroupItem", () => {
  it("render sebagai elemen dengan role 'radio'", () => {
    render(
      <RadioGroup>
        <RadioGroupItem value="a" />
      </RadioGroup>,
    );
    const item = screen.getByRole("radio");
    expect(item).toBeInTheDocument();
    expect(item.tagName).toBe("BUTTON");
  });

  it("className default (aspect-square, rounded-full, border-primary) terpakai", () => {
    render(
      <RadioGroup>
        <RadioGroupItem value="a" />
      </RadioGroup>,
    );
    const item = screen.getByRole("radio");
    expect(item.className).toContain("aspect-square");
    expect(item.className).toContain("rounded-full");
    expect(item.className).toContain("border-primary");
  });

  it("className custom digabung dengan className default (bukan menggantikan)", () => {
    render(
      <RadioGroup>
        <RadioGroupItem value="a" className="custom-item-class" />
      </RadioGroup>,
    );
    const item = screen.getByRole("radio");
    expect(item.className).toContain("custom-item-class");
    expect(item.className).toContain("rounded-full");
  });

  it("forwardRef meneruskan ref ke elemen <button> asli", () => {
    const ref = createRef();
    render(
      <RadioGroup>
        <RadioGroupItem value="a" ref={ref} />
      </RadioGroup>,
    );
    expect(ref.current).toBe(screen.getByRole("radio"));
    expect(ref.current.tagName).toBe("BUTTON");
  });

  it("default unchecked: data-state='unchecked', aria-checked='false', indikator Circle TIDAK dirender", () => {
    render(
      <RadioGroup>
        <RadioGroupItem value="a" />
      </RadioGroup>,
    );
    const item = screen.getByRole("radio");
    expect(item).toHaveAttribute("data-state", "unchecked");
    expect(item).toHaveAttribute("aria-checked", "false");
    expect(item.querySelector("svg")).not.toBeInTheDocument();
  });

  it("item yang cocok dengan value Root: data-state='checked', aria-checked='true', indikator Circle dirender", () => {
    render(
      <RadioGroup value="a">
        <RadioGroupItem value="a" />
      </RadioGroup>,
    );
    const item = screen.getByRole("radio");
    expect(item).toHaveAttribute("data-state", "checked");
    expect(item).toHaveAttribute("aria-checked", "true");
    const svg = item.querySelector("svg");
    expect(svg).toBeInTheDocument();
    expect(svg.getAttribute("class")).toContain("fill-current");
  });

  it("disabled=true pada item individual mencegah interaksi klik memicu onValueChange", async () => {
    const user = userEvent.setup();
    const onValueChange = vi.fn();
    render(
      <RadioGroup value="a" onValueChange={onValueChange}>
        <RadioGroupItem value="a" aria-label="a" />
        <RadioGroupItem value="b" aria-label="b" disabled />
      </RadioGroup>,
    );
    const itemB = screen.getByRole("radio", { name: "b" });
    expect(itemB).toBeDisabled();
    await user.click(itemB);
    expect(onValueChange).not.toHaveBeenCalled();
  });

  it("meneruskan props lain (aria-label, data-testid) ke elemen asli", () => {
    render(
      <RadioGroup>
        <RadioGroupItem value="a" aria-label="Opsi A" data-testid="my-radio" />
      </RadioGroup>,
    );
    const item = screen.getByTestId("my-radio");
    expect(item).toHaveAttribute("aria-label", "Opsi A");
  });
});
