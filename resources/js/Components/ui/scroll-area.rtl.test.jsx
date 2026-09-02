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

  // BUG (lihat bugFindings): className yang diberikan ke <ScrollArea> semestinya
  // digabung (cn) ke Root -- mengikuti implementasi shadcn/ui asli & seluruh
  // komponen ui/* lain di codebase ini (mis. popover.jsx, drawer.jsx: selalu
  // `cn("...default...", className)`) -- tapi source scroll-area.jsx memanggil
  // `cn("relative overflow-hidden")` TANPA meneruskan `className` sama sekali.
  // Root SELALU persis "relative overflow-hidden", prop className diabaikan total.
  it("BUG: className custom TIDAK pernah diterapkan ke Root, walau diberikan", () => {
    const { container } = render(<ScrollArea className="h-72 w-48 border" />);
    const root = container.firstChild;
    expect(root.className).toBe("relative overflow-hidden");
    expect(root.className).not.toContain("h-72");
  });

  // BUG (lihat bugFindings): className justru "nyasar" ke <div> pembungkus
  // children di dalam Viewport, diterapkan mentah tanpa cn() (tidak digabung
  // dengan default apapun). Konsumen nyata di codebase (DataTable2.jsx,
  // FilterItem.jsx, date-selector.jsx) memberi className seperti "max-h-56"
  // atau "h-[200px] w-full" dengan asumsi itu mengatur tinggi/lebar area
  // scroll (pola shadcn/ui standar: className mengatur Root) -- padahal yang
  // terjadi className itu hanya nempel di div anak dalam Viewport yang tidak
  // overflow-hidden (overflow-hidden ada di Root, bukan di div ini).
  it("BUG: className custom malah diterapkan mentah ke div pembungkus children (bukan ke Root)", () => {
    render(
      <ScrollArea className="h-72 custom-wrap">
        <span data-testid="child">Isi</span>
      </ScrollArea>,
    );
    const wrapper = screen.getByTestId("child").parentElement;
    expect(wrapper.tagName).toBe("DIV");
    expect(wrapper.className).toBe("h-72 custom-wrap");
  });

  it("tanpa className diberikan, div pembungkus children tidak mendapat atribut class", () => {
    render(
      <ScrollArea>
        <span data-testid="child">Isi</span>
      </ScrollArea>,
    );
    const wrapper = screen.getByTestId("child").parentElement;
    expect(wrapper.className).toBe("");
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
