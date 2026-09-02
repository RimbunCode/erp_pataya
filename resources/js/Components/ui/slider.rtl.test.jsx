import { createRef } from "react";
import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { Slider, SliderThumb } from "./slider";

const getRoot = () => document.querySelector('[data-slot="slider"]');

describe("Slider (root)", () => {
  it("render tanpa crash, thumb di dalamnya mendapat role 'slider'", () => {
    render(
      <Slider defaultValue={[50]}>
        <SliderThumb />
      </Slider>,
    );
    const thumb = screen.getByRole("slider");
    expect(thumb).toBeInTheDocument();
  });

  it("className default terpakai (relative, flex, h-4, w-full, touch-none, select-none, items-center)", () => {
    render(
      <Slider defaultValue={[50]}>
        <SliderThumb />
      </Slider>,
    );
    const root = getRoot();
    expect(root.className).toContain("relative");
    expect(root.className).toContain("flex");
    expect(root.className).toContain("h-4");
    expect(root.className).toContain("w-full");
    expect(root.className).toContain("touch-none");
    expect(root.className).toContain("select-none");
    expect(root.className).toContain("items-center");
  });

  it("className custom digabung dengan className default (bukan menggantikan)", () => {
    render(
      <Slider defaultValue={[50]} className="custom-slider">
        <SliderThumb />
      </Slider>,
    );
    const root = getRoot();
    expect(root.className).toContain("custom-slider");
    expect(root.className).toContain("w-full");
  });

  it("defaultValue tidak diberikan -> fallback Radix ke [min] (default min=0) tercermin di aria-valuenow thumb", () => {
    render(
      <Slider>
        <SliderThumb />
      </Slider>,
    );
    expect(screen.getByRole("slider")).toHaveAttribute("aria-valuenow", "0");
  });

  it("value terkontrol tercermin sebagai aria-valuenow pada thumb", () => {
    render(
      <Slider value={[42]} onValueChange={() => {}}>
        <SliderThumb />
      </Slider>,
    );
    expect(screen.getByRole("slider")).toHaveAttribute("aria-valuenow", "42");
  });

  it("min & max custom tercermin sebagai aria-valuemin/aria-valuemax pada thumb", () => {
    render(
      <Slider defaultValue={[20]} min={10} max={90}>
        <SliderThumb />
      </Slider>,
    );
    const thumb = screen.getByRole("slider");
    expect(thumb).toHaveAttribute("aria-valuemin", "10");
    expect(thumb).toHaveAttribute("aria-valuemax", "90");
  });

  it("disabled=true membuat Root & Thumb mendapat atribut disabled Radix, thumb tanpa tabindex (tidak bisa difokus)", () => {
    render(
      <Slider disabled defaultValue={[50]}>
        <SliderThumb />
      </Slider>,
    );
    const root = getRoot();
    expect(root).toHaveAttribute("data-disabled", "");
    expect(root).toHaveAttribute("aria-disabled", "true");
    const thumb = screen.getByRole("slider");
    expect(thumb).toHaveAttribute("data-disabled", "");
    expect(thumb).not.toHaveAttribute("tabindex");
  });

  it("tanpa disabled, thumb mendapat tabindex='0' (bisa difokus)", () => {
    render(
      <Slider defaultValue={[50]}>
        <SliderThumb />
      </Slider>,
    );
    expect(screen.getByRole("slider")).toHaveAttribute("tabindex", "0");
  });

  it("orientation='vertical' tercermin sebagai data-orientation pada Root & Thumb (default: horizontal)", () => {
    const { rerender } = render(
      <Slider defaultValue={[50]}>
        <SliderThumb />
      </Slider>,
    );
    expect(getRoot()).toHaveAttribute("data-orientation", "horizontal");
    expect(screen.getByRole("slider")).toHaveAttribute(
      "data-orientation",
      "horizontal",
    );

    rerender(
      <Slider defaultValue={[50]} orientation="vertical">
        <SliderThumb />
      </Slider>,
    );
    expect(getRoot()).toHaveAttribute("data-orientation", "vertical");
    expect(screen.getByRole("slider")).toHaveAttribute(
      "data-orientation",
      "vertical",
    );
  });

  it("meneruskan props lain (data-testid, id) ke elemen Root", () => {
    render(
      <Slider defaultValue={[50]} data-testid="qty-slider" id="slider-1">
        <SliderThumb />
      </Slider>,
    );
    const root = screen.getByTestId("qty-slider");
    expect(root).toHaveAttribute("id", "slider-1");
  });

  it("forwardRef meneruskan ref ke elemen Root asli", () => {
    const ref = createRef();
    render(
      <Slider ref={ref} defaultValue={[50]}>
        <SliderThumb />
      </Slider>,
    );
    expect(ref.current).toBe(getRoot());
  });

  it("children (SliderThumb) dirender di dalam Root, mendukung lebih dari satu thumb (range slider)", () => {
    render(
      <Slider defaultValue={[20, 80]}>
        <SliderThumb />
        <SliderThumb />
      </Slider>,
    );
    const thumbs = screen.getAllByRole("slider");
    expect(thumbs).toHaveLength(2);
    expect(thumbs[0]).toHaveAttribute("aria-valuenow", "20");
    expect(thumbs[1]).toHaveAttribute("aria-valuenow", "80");
  });

  it("tanpa children, Root tetap render Track & Range tanpa crash (tidak ada thumb)", () => {
    render(<Slider defaultValue={[50]} />);
    expect(getRoot()).toBeInTheDocument();
    expect(screen.queryByRole("slider")).not.toBeInTheDocument();
  });
});

describe("Slider (Track & Range visual)", () => {
  it("className default Track terpakai (relative, h-1.5, w-full, overflow-hidden, rounded-full, bg-accent)", () => {
    const { container } = render(
      <Slider defaultValue={[50]}>
        <SliderThumb />
      </Slider>,
    );
    const track = container.querySelector(".overflow-hidden");
    expect(track).not.toBeNull();
    expect(track.className).toContain("relative");
    expect(track.className).toContain("h-1.5");
    expect(track.className).toContain("w-full");
    expect(track.className).toContain("rounded-full");
    expect(track.className).toContain("bg-accent");
  });

  it("className default Range terpakai (absolute, h-full, bg-primary)", () => {
    const { container } = render(
      <Slider defaultValue={[50]}>
        <SliderThumb />
      </Slider>,
    );
    const range = container.querySelector(".bg-primary.absolute");
    expect(range).not.toBeNull();
    expect(range.className).toContain("h-full");
  });

  it("posisi Range (style.left/right) mencerminkan value relatif terhadap min/max", () => {
    const { container } = render(
      <Slider defaultValue={[30]} min={0} max={100}>
        <SliderThumb />
      </Slider>,
    );
    const range = container.querySelector(".bg-primary.absolute");
    expect(range.style.left).toBe("0%");
    expect(range.style.right).toBe("70%");
  });
});

describe("SliderThumb", () => {
  it("render dengan role 'slider'", () => {
    render(
      <Slider defaultValue={[50]}>
        <SliderThumb />
      </Slider>,
    );
    expect(screen.getByRole("slider").tagName).toBe("SPAN");
  });

  it("className default terpakai (box-content, block, size-4, rounded-full, border-primary, bg-primary-foreground)", () => {
    render(
      <Slider defaultValue={[50]}>
        <SliderThumb />
      </Slider>,
    );
    const thumb = screen.getByRole("slider");
    expect(thumb.className).toContain("box-content");
    expect(thumb.className).toContain("block");
    expect(thumb.className).toContain("size-4");
    expect(thumb.className).toContain("rounded-full");
    expect(thumb.className).toContain("border-primary");
    expect(thumb.className).toContain("bg-primary-foreground");
  });

  it("className custom digabung dengan className default (bukan menggantikan)", () => {
    render(
      <Slider defaultValue={[50]}>
        <SliderThumb className="custom-thumb" />
      </Slider>,
    );
    const thumb = screen.getByRole("slider");
    expect(thumb.className).toContain("custom-thumb");
    expect(thumb.className).toContain("border-primary");
  });

  it("forwardRef meneruskan ref ke elemen thumb asli (role='slider')", () => {
    const ref = createRef();
    render(
      <Slider defaultValue={[50]}>
        <SliderThumb ref={ref} />
      </Slider>,
    );
    expect(ref.current).toBe(screen.getByRole("slider"));
  });

  it("meneruskan props lain (data-testid) ke elemen thumb", () => {
    render(
      <Slider defaultValue={[50]}>
        <SliderThumb data-testid="thumb-1" />
      </Slider>,
    );
    expect(screen.getByTestId("thumb-1")).toBeInTheDocument();
  });

  it("aria-label eksplisit override label default Radix", () => {
    render(
      <Slider defaultValue={[50]}>
        <SliderThumb aria-label="Kuantitas" />
      </Slider>,
    );
    expect(screen.getByRole("slider")).toHaveAttribute(
      "aria-label",
      "Kuantitas",
    );
  });

  it("2 thumb tanpa aria-label eksplisit -> label default Radix 'Minimum'/'Maximum'", () => {
    render(
      <Slider defaultValue={[20, 80]}>
        <SliderThumb />
        <SliderThumb />
      </Slider>,
    );
    const thumbs = screen.getAllByRole("slider");
    expect(thumbs[0]).toHaveAttribute("aria-label", "Minimum");
    expect(thumbs[1]).toHaveAttribute("aria-label", "Maximum");
  });

  it("3 thumb tanpa aria-label eksplisit -> label default Radix 'Value N of 3'", () => {
    render(
      <Slider defaultValue={[10, 50, 90]}>
        <SliderThumb />
        <SliderThumb />
        <SliderThumb />
      </Slider>,
    );
    const thumbs = screen.getAllByRole("slider");
    expect(thumbs[0]).toHaveAttribute("aria-label", "Value 1 of 3");
    expect(thumbs[1]).toHaveAttribute("aria-label", "Value 2 of 3");
    expect(thumbs[2]).toHaveAttribute("aria-label", "Value 3 of 3");
  });
});

describe("Slider (interaksi keyboard)", () => {
  it("ArrowRight pada thumb yang focus memicu onValueChange dengan value bertambah 1 step (default step)", async () => {
    const user = userEvent.setup();
    const onValueChange = vi.fn();
    render(
      <Slider defaultValue={[50]} onValueChange={onValueChange}>
        <SliderThumb />
      </Slider>,
    );
    await user.tab();
    expect(screen.getByRole("slider")).toHaveFocus();
    await user.keyboard("{ArrowRight}");
    expect(onValueChange).toHaveBeenCalledWith([51]);
  });

  it("ArrowLeft pada thumb yang focus memicu onValueChange dengan value berkurang 1 step (default step)", async () => {
    const user = userEvent.setup();
    const onValueChange = vi.fn();
    render(
      <Slider defaultValue={[50]} onValueChange={onValueChange}>
        <SliderThumb />
      </Slider>,
    );
    await user.tab();
    await user.keyboard("{ArrowLeft}");
    expect(onValueChange).toHaveBeenCalledWith([49]);
  });

  it("step custom (mis. 5) dipakai sebagai besar perubahan tiap ArrowRight", async () => {
    const user = userEvent.setup();
    const onValueChange = vi.fn();
    render(
      <Slider defaultValue={[10]} step={5} onValueChange={onValueChange}>
        <SliderThumb />
      </Slider>,
    );
    await user.tab();
    await user.keyboard("{ArrowRight}");
    expect(onValueChange).toHaveBeenCalledWith([15]);
  });

  it("Home menjatuhkan value ke min", async () => {
    const user = userEvent.setup();
    const onValueChange = vi.fn();
    render(
      <Slider defaultValue={[50]} min={0} onValueChange={onValueChange}>
        <SliderThumb />
      </Slider>,
    );
    await user.tab();
    await user.keyboard("{Home}");
    expect(onValueChange).toHaveBeenCalledWith([0]);
  });

  it("End menaikkan value ke max", async () => {
    const user = userEvent.setup();
    const onValueChange = vi.fn();
    render(
      <Slider defaultValue={[50]} max={100} onValueChange={onValueChange}>
        <SliderThumb />
      </Slider>,
    );
    await user.tab();
    await user.keyboard("{End}");
    expect(onValueChange).toHaveBeenCalledWith([100]);
  });

  it("Shift+ArrowRight melompat 10x step (bukan 1x)", async () => {
    const user = userEvent.setup();
    const onValueChange = vi.fn();
    render(
      <Slider defaultValue={[50]} onValueChange={onValueChange}>
        <SliderThumb />
      </Slider>,
    );
    await user.tab();
    await user.keyboard("{Shift>}{ArrowRight}{/Shift}");
    expect(onValueChange).toHaveBeenCalledWith([60]);
  });

  it("PageUp melompat 10x step (multiplier page)", async () => {
    const user = userEvent.setup();
    const onValueChange = vi.fn();
    render(
      <Slider defaultValue={[50]} onValueChange={onValueChange}>
        <SliderThumb />
      </Slider>,
    );
    await user.tab();
    await user.keyboard("{PageUp}");
    expect(onValueChange).toHaveBeenCalledWith([60]);
  });

  it("disabled=true mencegah interaksi keyboard mengubah value (onValueChange tidak terpanggil)", async () => {
    const user = userEvent.setup();
    const onValueChange = vi.fn();
    render(
      <Slider disabled defaultValue={[50]} onValueChange={onValueChange}>
        <SliderThumb />
      </Slider>,
    );
    await user.tab();
    expect(screen.getByRole("slider")).not.toHaveFocus();
    await user.keyboard("{ArrowRight}");
    expect(onValueChange).not.toHaveBeenCalled();
  });

  it("ArrowRight pada thumb kedua (range slider) hanya mengubah value thumb tersebut, thumb pertama tidak berubah", async () => {
    const user = userEvent.setup();
    const onValueChange = vi.fn();
    render(
      <Slider defaultValue={[20, 80]} onValueChange={onValueChange}>
        <SliderThumb />
        <SliderThumb />
      </Slider>,
    );
    await user.tab();
    await user.tab();
    expect(screen.getAllByRole("slider")[1]).toHaveFocus();
    await user.keyboard("{ArrowRight}");
    expect(onValueChange).toHaveBeenCalledWith([20, 81]);
  });
});
