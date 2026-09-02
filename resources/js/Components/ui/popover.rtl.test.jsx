import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { Popover, PopoverContent, PopoverTrigger } from "./popover";

describe("Popover + PopoverTrigger + PopoverContent (alur buka/tutup dasar)", () => {
  it("content tidak ada di DOM sebelum trigger diklik, muncul setelah trigger diklik", async () => {
    const user = userEvent.setup();
    render(
      <Popover>
        <PopoverTrigger>Buka</PopoverTrigger>
        <PopoverContent>Isi popover</PopoverContent>
      </Popover>,
    );

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Buka" }));

    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(screen.getByText("Isi popover")).toBeInTheDocument();
  });

  it("defaultOpen merender content sejak awal", () => {
    render(
      <Popover defaultOpen>
        <PopoverTrigger>Buka</PopoverTrigger>
        <PopoverContent>Isi default terbuka</PopoverContent>
      </Popover>,
    );

    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(screen.getByText("Isi default terbuka")).toBeInTheDocument();
  });
});

describe("PopoverContent", () => {
  it("content dirender via Portal, bukan sebagai descendant container render lokal", () => {
    const { container } = render(
      <Popover defaultOpen>
        <PopoverTrigger>Buka</PopoverTrigger>
        <PopoverContent data-testid="content">Isi</PopoverContent>
      </Popover>,
    );

    const content = screen.getByTestId("content");
    expect(content).toBeInTheDocument();
    expect(container.contains(content)).toBe(false);
    expect(document.body.contains(content)).toBe(true);
  });

  it("className default (ukuran, warna, border, shadow) diterapkan", () => {
    render(
      <Popover defaultOpen>
        <PopoverTrigger>Buka</PopoverTrigger>
        <PopoverContent data-testid="content">Isi</PopoverContent>
      </Popover>,
    );

    const content = screen.getByTestId("content");
    expect(content.className).toContain("w-72");
    expect(content.className).toContain("rounded-md");
    expect(content.className).toContain("border-muted");
    expect(content.className).toContain("bg-popover");
    expect(content.className).toContain("text-popover-foreground");
    expect(content.className).toContain("p-4");
    expect(content.className).toContain("shadow-md");
    expect(content.className).toContain("outline-none");
  });

  it("className custom digabung, bukan menggantikan className default", () => {
    render(
      <Popover defaultOpen>
        <PopoverTrigger>Buka</PopoverTrigger>
        <PopoverContent data-testid="content" className="custom-popover">
          Isi
        </PopoverContent>
      </Popover>,
    );

    const content = screen.getByTestId("content");
    expect(content.className).toContain("custom-popover");
    expect(content.className).toContain("w-72");
    expect(content.className).toContain("bg-popover");
  });

  it("meneruskan ref ke elemen Radix Content asli", () => {
    const ref = { current: null };
    render(
      <Popover defaultOpen>
        <PopoverTrigger>Buka</PopoverTrigger>
        <PopoverContent ref={ref}>Isi</PopoverContent>
      </Popover>,
    );

    expect(ref.current).toBeInstanceOf(HTMLElement);
    expect(ref.current).toBe(screen.getByRole("dialog"));
  });

  it("meneruskan props lain (mis. id) ke elemen Content", () => {
    render(
      <Popover defaultOpen>
        <PopoverTrigger>Buka</PopoverTrigger>
        <PopoverContent id="my-popover-content">Isi</PopoverContent>
      </Popover>,
    );

    expect(screen.getByRole("dialog").id).toBe("my-popover-content");
  });

  it("prop align & sideOffset custom (override default center/4) tidak menyebabkan error render", () => {
    render(
      <Popover defaultOpen>
        <PopoverTrigger>Buka</PopoverTrigger>
        <PopoverContent align="start" sideOffset={10} data-testid="content">
          Isi
        </PopoverContent>
      </Popover>,
    );

    expect(screen.getByTestId("content")).toBeInTheDocument();
  });

  it("event wheel di dalam Content di-stopPropagation, tidak mencapai handler React di ancestor", () => {
    const handleParentWheel = vi.fn();
    render(
      <div onWheel={handleParentWheel}>
        <Popover defaultOpen>
          <PopoverTrigger>Buka</PopoverTrigger>
          <PopoverContent data-testid="content">Isi</PopoverContent>
        </Popover>
      </div>,
    );

    fireEvent.wheel(screen.getByTestId("content"));

    expect(handleParentWheel).not.toHaveBeenCalled();
  });

  it("event touchmove di dalam Content di-stopPropagation, tidak mencapai handler React di ancestor", () => {
    const handleParentTouchMove = vi.fn();
    render(
      <div onTouchMove={handleParentTouchMove}>
        <Popover defaultOpen>
          <PopoverTrigger>Buka</PopoverTrigger>
          <PopoverContent data-testid="content">Isi</PopoverContent>
        </Popover>
      </div>,
    );

    fireEvent.touchMove(screen.getByTestId("content"));

    expect(handleParentTouchMove).not.toHaveBeenCalled();
  });
});
