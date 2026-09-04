import { createRef } from "react";
import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import * as ScrollAreaPrimitive from "@radix-ui/react-scroll-area";

import { ScrollArea, ScrollBar } from "./scroll-area";

// Helper untuk merender ScrollBar berdiri sendiri di dalam Root+Viewport Radix
// asli (bukan lewat wrapper ScrollArea kita, yang selalu memaksa
// orientation="vertical" untuk ScrollBar bawaannya). type="always" dipakai
// supaya elemen scrollbar langsung ada di DOM tanpa perlu men-trigger state
// hover/scroll Radix (yang butuh dimensi elemen nyata & tidak bisa
// disimulasikan bermakna di jsdom).
function renderScrollBar(props = {}, ref) {
  return render(
    <ScrollAreaPrimitive.Root type="always">
      <ScrollAreaPrimitive.Viewport>Isi</ScrollAreaPrimitive.Viewport>
      <ScrollBar ref={ref} {...props} />
    </ScrollAreaPrimitive.Root>,
  );
}

describe("ScrollArea", () => {
  it("render dasar tanpa crash -- children muncul di dalam DOM", () => {
    render(
      <ScrollArea>
        <div>Konten scroll</div>
      </ScrollArea>,
    );
    expect(screen.getByText("Konten scroll")).toBeInTheDocument();
  });

  it("forwardRef diteruskan ke elemen Root Radix (bukan Viewport atau div pembungkus children)", () => {
    const ref = createRef();
    const { container } = render(<ScrollArea ref={ref} />);
    expect(ref.current).toBeInstanceOf(HTMLElement);
    expect(ref.current).toBe(container.firstChild);
  });

  it("elemen Root selalu berclassName literal 'relative overflow-hidden'", () => {
    const { container } = render(<ScrollArea />);
    expect(container.firstChild.className).toBe("relative overflow-hidden");
  });

  // className yang diberikan ke <ScrollArea> digabung (cn) ke Root --
  // mengikuti implementasi shadcn/ui asli & seluruh komponen ui/* lain di
  // codebase ini (mis. popover.jsx, drawer.jsx: selalu
  // `cn("...default...", className)`).
  it("className custom digabung ke Root bersama default 'relative overflow-hidden'", () => {
    const { container } = render(<ScrollArea className="h-72 w-48 border" />);
    const root = container.firstChild;
    expect(root.className).toContain("relative");
    expect(root.className).toContain("overflow-hidden");
    expect(root.className).toContain("h-72");
    expect(root.className).toContain("w-48");
    expect(root.className).toContain("border");
  });

  // children dirender langsung di dalam Viewport tanpa div wrapper tambahan
  // -- className konsumen (DataTable2.jsx, FilterItem.jsx, date-selector.jsx:
  // "max-h-56", "h-[200px] w-full", dst) mengatur Root sesuai pola shadcn/ui
  // standar, bukan nyasar ke elemen anak.
  it("children dirender langsung di dalam Viewport, tanpa div pembungkus tambahan", () => {
    render(
      <ScrollArea className="h-72 custom-wrap">
        <span data-testid="child">Isi</span>
      </ScrollArea>,
    );
    const child = screen.getByTestId("child");
    // Radix ScrollAreaViewport selalu membungkus children dengan div
    // internalnya sendiri (utk content measurement) -- jadi parent LANGSUNG
    // bukan elemen Viewport, tapi tetap harus ada DI DALAM Viewport, tanpa
    // div wrapper TAMBAHAN dari ScrollArea kita sendiri.
    expect(
      child.closest("[data-radix-scroll-area-viewport]"),
    ).toBeInTheDocument();
  });

  it("Viewport Radix (data-radix-scroll-area-viewport) dirender dengan className default & memuat children di dalamnya", () => {
    const { container } = render(
      <ScrollArea>
        <span data-testid="child">Isi</span>
      </ScrollArea>,
    );
    const viewport = container.querySelector(
      "[data-radix-scroll-area-viewport]",
    );
    expect(viewport).toBeInTheDocument();
    expect(viewport.className).toBe("h-full w-full rounded-[inherit]");
    expect(viewport.contains(screen.getByTestId("child"))).toBe(true);
  });

  it("meneruskan props lain (mis. id, data-testid) ke elemen Root via spread", () => {
    render(<ScrollArea id="my-scroll-area" data-testid="root" />);
    const root = screen.getByTestId("root");
    expect(root.id).toBe("my-scroll-area");
  });

  it("children berupa beberapa elemen sekaligus dirender semua di dalam wrapper", () => {
    render(
      <ScrollArea>
        <p>Baris satu</p>
        <p>Baris dua</p>
      </ScrollArea>,
    );
    expect(screen.getByText("Baris satu")).toBeInTheDocument();
    expect(screen.getByText("Baris dua")).toBeInTheDocument();
  });

  it("ScrollBar orientation vertical selalu ikut dirender sbg bagian dari struktur default (prop type diteruskan ke Root Radix)", () => {
    const { container } = render(<ScrollArea type="always" />);
    const scrollbar = container.querySelector('[data-orientation="vertical"]');
    expect(scrollbar).toBeInTheDocument();
  });
});

describe("ScrollBar", () => {
  it("render dasar tanpa crash dengan orientation default 'vertical' (data-orientation & className)", () => {
    const { container } = renderScrollBar();
    const scrollbar = container.querySelector('[data-orientation="vertical"]');
    expect(scrollbar).toBeInTheDocument();
    expect(scrollbar.className).toContain("h-full");
    expect(scrollbar.className).toContain("w-2.5");
    expect(scrollbar.className).toContain("border-l");
    expect(scrollbar.className).toContain("border-l-transparent");
    expect(scrollbar.className).toContain("p-px");
    // kelas dasar (selalu ada terlepas orientation)
    expect(scrollbar.className).toContain("flex");
    expect(scrollbar.className).toContain("touch-none");
    expect(scrollbar.className).toContain("select-none");
    expect(scrollbar.className).toContain("transition-colors");
  });

  it("orientation='horizontal': data-orientation & className berisi kelas spesifik horizontal, bukan kelas vertical", () => {
    const { container } = renderScrollBar({ orientation: "horizontal" });
    const scrollbar = container.querySelector(
      '[data-orientation="horizontal"]',
    );
    expect(scrollbar).toBeInTheDocument();
    expect(scrollbar.className).toContain("h-2.5");
    expect(scrollbar.className).toContain("flex-col");
    expect(scrollbar.className).toContain("border-t");
    expect(scrollbar.className).toContain("border-t-transparent");
    expect(scrollbar.className.split(/\s+/)).not.toContain("w-2.5");
    expect(scrollbar.className).not.toContain("border-l");
    expect(scrollbar.className).not.toContain("h-full");
  });

  it("className custom digabung dengan className default (bukan menggantikan)", () => {
    const { container } = renderScrollBar({ className: "custom-scrollbar" });
    const scrollbar = container.querySelector('[data-orientation="vertical"]');
    expect(scrollbar.className).toContain("custom-scrollbar");
    expect(scrollbar.className).toContain("flex");
    expect(scrollbar.className).toContain("w-2.5");
  });

  it("forwardRef diteruskan ke elemen scrollbar asli", () => {
    const ref = createRef();
    const { container } = renderScrollBar({}, ref);
    const scrollbar = container.querySelector('[data-orientation="vertical"]');
    expect(ref.current).toBe(scrollbar);
  });

  it("meneruskan props lain (mis. data-testid) ke elemen scrollbar", () => {
    renderScrollBar({ "data-testid": "my-scrollbar" });
    expect(screen.getByTestId("my-scrollbar")).toBeInTheDocument();
  });
});
