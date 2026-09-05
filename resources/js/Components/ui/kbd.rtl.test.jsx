import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { Kbd, KbdGroup } from "./kbd";

describe("Kbd", () => {
  it("render children tanpa crash sebagai elemen <kbd> dengan data-slot='kbd'", () => {
    render(<Kbd>Ctrl</Kbd>);
    const kbd = screen.getByText("Ctrl");
    expect(kbd).toBeInTheDocument();
    expect(kbd.tagName).toBe("KBD");
    expect(kbd).toHaveAttribute("data-slot", "kbd");
  });

  it("className default terpakai (bg-muted, inline-flex, rounded-sm, select-none)", () => {
    render(<Kbd>Esc</Kbd>);
    const kbd = screen.getByText("Esc");
    expect(kbd.className).toContain("bg-muted");
    expect(kbd.className).toContain("text-foreground");
    expect(kbd.className).toContain("inline-flex");
    expect(kbd.className).toContain("rounded-sm");
    expect(kbd.className).toContain("select-none");
  });

  it("className custom digabung dengan className default (bukan menggantikan)", () => {
    render(<Kbd className="custom-kbd-class">Alt</Kbd>);
    const kbd = screen.getByText("Alt");
    expect(kbd.className).toContain("custom-kbd-class");
    expect(kbd.className).toContain("bg-muted");
  });

  it("meneruskan props HTML lain (data-testid, onClick, id) ke elemen kbd", async () => {
    const user = userEvent.setup();
    let clicked = false;
    render(
      <Kbd
        data-testid="shortcut-key"
        id="kbd-1"
        onClick={() => {
          clicked = true;
        }}
      >
        Enter
      </Kbd>,
    );

    const kbd = screen.getByTestId("shortcut-key");
    expect(kbd).toHaveAttribute("id", "kbd-1");

    await user.click(kbd);
    expect(clicked).toBe(true);
  });
});

describe("KbdGroup", () => {
  it("render children tanpa crash sebagai elemen <kbd> dengan data-slot='kbd-group'", () => {
    render(
      <KbdGroup data-testid="kbd-group">
        <Kbd>Ctrl</Kbd>
        <Kbd>Shift</Kbd>
      </KbdGroup>,
    );
    const group = screen.getByTestId("kbd-group");
    expect(group).toBeInTheDocument();
    expect(group.tagName).toBe("KBD");
    expect(group).toHaveAttribute("data-slot", "kbd-group");
    expect(screen.getByText("Ctrl")).toBeInTheDocument();
    expect(screen.getByText("Shift")).toBeInTheDocument();
  });

  it("className default terpakai (inline-flex items-center gap-1)", () => {
    render(<KbdGroup data-testid="kbd-group">Grup</KbdGroup>);
    const group = screen.getByTestId("kbd-group");
    expect(group.className).toContain("inline-flex");
    expect(group.className).toContain("items-center");
    expect(group.className).toContain("gap-1");
  });

  it("className custom digabung dengan className default (bukan menggantikan)", () => {
    render(
      <KbdGroup data-testid="kbd-group" className="custom-group-class">
        Grup
      </KbdGroup>,
    );
    const group = screen.getByTestId("kbd-group");
    expect(group.className).toContain("custom-group-class");
    expect(group.className).toContain("inline-flex");
  });

  it("meneruskan props HTML lain (data-testid, onClick, id) ke elemen kbd", async () => {
    const user = userEvent.setup();
    let clicked = false;
    render(
      <KbdGroup
        data-testid="kbd-group"
        id="group-1"
        onClick={() => {
          clicked = true;
        }}
      >
        Grup
      </KbdGroup>,
    );

    const group = screen.getByTestId("kbd-group");
    expect(group).toHaveAttribute("id", "group-1");

    await user.click(group);
    expect(clicked).toBe(true);
  });
});
