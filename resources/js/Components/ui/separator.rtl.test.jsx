import { createRef } from "react";
import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { Separator } from "./separator";

describe("Separator (default: decorative, horizontal)", () => {
  it("render tanpa crash sebagai div dengan role='none' (decorative default true)", () => {
    render(<Separator data-testid="sep" />);
    const el = screen.getByTestId("sep");
    expect(el).toBeInTheDocument();
    expect(el.tagName).toBe("DIV");
    expect(el).toHaveAttribute("role", "none");
  });

  it("data-orientation default 'horizontal'", () => {
    render(<Separator data-testid="sep" />);
    expect(screen.getByTestId("sep")).toHaveAttribute(
      "data-orientation",
      "horizontal",
    );
  });

  it("className default terpakai untuk orientasi horizontal (h-px, w-full, shrink-0, bg-border)", () => {
    render(<Separator data-testid="sep" />);
    const el = screen.getByTestId("sep");
    expect(el.className).toContain("shrink-0");
    expect(el.className).toContain("bg-border");
    expect(el.className).toContain("h-px");
    expect(el.className).toContain("w-full");
    expect(el.className).not.toContain("h-full");
    expect(el.className).not.toContain("w-px");
  });

  it("className custom digabung dengan className default (bukan menggantikan)", () => {
    render(<Separator data-testid="sep" className="custom-sep" />);
    const el = screen.getByTestId("sep");
    expect(el.className).toContain("custom-sep");
    expect(el.className).toContain("bg-border");
    expect(el.className).toContain("h-px");
  });

  it("forwardRef meneruskan ref ke elemen div DOM asli", () => {
    const ref = createRef();
    render(<Separator ref={ref} data-testid="sep" />);
    expect(ref.current).toBe(screen.getByTestId("sep"));
    expect(ref.current.tagName).toBe("DIV");
  });

  it("meneruskan props HTML lain (id) ke elemen Radix Root", () => {
    render(<Separator data-testid="sep" id="section-divider" />);
    expect(screen.getByTestId("sep")).toHaveAttribute("id", "section-divider");
  });

  it("meneruskan event handler (onClick) ke elemen root", async () => {
    const user = userEvent.setup();
    const handleClick = vi.fn();
    render(<Separator data-testid="sep" onClick={handleClick} />);
    await user.click(screen.getByTestId("sep"));
    expect(handleClick).toHaveBeenCalledTimes(1);
  });
});

describe("Separator orientation='vertical'", () => {
  it("className beralih ke h-full & w-px (bukan h-px/w-full)", () => {
    render(<Separator data-testid="sep" orientation="vertical" />);
    const el = screen.getByTestId("sep");
    expect(el.className).toContain("h-full");
    expect(el.className).toContain("w-px");
    expect(el.className).not.toContain("h-px");
    expect(el.className).not.toContain("w-full");
  });

  it("data-orientation ikut jadi 'vertical'", () => {
    render(<Separator data-testid="sep" orientation="vertical" />);
    expect(screen.getByTestId("sep")).toHaveAttribute(
      "data-orientation",
      "vertical",
    );
  });
});

describe("Separator decorative={false} (semantik: role='separator')", () => {
  it("role berubah jadi 'separator' saat decorative=false", () => {
    render(<Separator data-testid="sep" decorative={false} />);
    expect(screen.getByTestId("sep")).toHaveAttribute("role", "separator");
  });

  it("dapat dicari lewat getByRole('separator') saat decorative=false", () => {
    render(<Separator decorative={false} />);
    expect(screen.getByRole("separator")).toBeInTheDocument();
  });

  it("orientation='vertical' + decorative=false menghasilkan aria-orientation='vertical'", () => {
    render(
      <Separator data-testid="sep" decorative={false} orientation="vertical" />,
    );
    expect(screen.getByTestId("sep")).toHaveAttribute(
      "aria-orientation",
      "vertical",
    );
  });

  it("orientation='horizontal' (default) + decorative=false TIDAK punya atribut aria-orientation", () => {
    render(<Separator data-testid="sep" decorative={false} />);
    expect(screen.getByTestId("sep")).not.toHaveAttribute("aria-orientation");
  });
});
