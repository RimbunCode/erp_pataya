import { createRef } from "react";
import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";

import {
  Breadcrumb,
  BreadcrumbList,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbPage,
  BreadcrumbSeparator,
  BreadcrumbEllipsis,
} from "./breadcrumb";

describe("Breadcrumb", () => {
  it("render sebagai <nav aria-label='breadcrumb'>", () => {
    render(<Breadcrumb data-testid="bc" />);
    const nav = screen.getByRole("navigation", { name: "breadcrumb" });
    expect(nav).toBeInTheDocument();
    expect(nav.tagName).toBe("NAV");
  });

  it("forwardRef meneruskan ref ke elemen <nav> asli", () => {
    const ref = createRef();
    render(<Breadcrumb ref={ref} />);
    expect(ref.current).toBeInstanceOf(HTMLElement);
    expect(ref.current.tagName).toBe("NAV");
  });

  it("meneruskan props lain (mis. data-testid)", () => {
    render(<Breadcrumb data-testid="bc-nav" />);
    expect(screen.getByTestId("bc-nav")).toBeInTheDocument();
  });
});

describe("BreadcrumbList", () => {
  it("render sebagai <ol> dengan className default", () => {
    render(<BreadcrumbList data-testid="bc-list" />);
    const ol = screen.getByTestId("bc-list");
    expect(ol.tagName).toBe("OL");
    expect(ol.className).toContain("flex");
    expect(ol.className).toContain("items-center");
  });

  it("menggabungkan className custom dengan default (bukan menghapusnya)", () => {
    render(<BreadcrumbList data-testid="bc-list" className="custom-list" />);
    const ol = screen.getByTestId("bc-list");
    expect(ol.className).toContain("custom-list");
    expect(ol.className).toContain("flex");
  });

  it("forwardRef meneruskan ref ke elemen <ol> asli", () => {
    const ref = createRef();
    render(<BreadcrumbList ref={ref} />);
    expect(ref.current.tagName).toBe("OL");
  });
});

describe("BreadcrumbItem", () => {
  it("render sebagai <li> dengan className default", () => {
    render(<BreadcrumbItem data-testid="bc-item" />);
    const li = screen.getByTestId("bc-item");
    expect(li.tagName).toBe("LI");
    expect(li.className).toContain("inline-flex");
  });

  it("menggabungkan className custom dengan default", () => {
    render(<BreadcrumbItem data-testid="bc-item" className="custom-item" />);
    const li = screen.getByTestId("bc-item");
    expect(li.className).toContain("custom-item");
    expect(li.className).toContain("inline-flex");
  });

  it("forwardRef meneruskan ref ke elemen <li> asli", () => {
    const ref = createRef();
    render(<BreadcrumbItem ref={ref} />);
    expect(ref.current.tagName).toBe("LI");
  });
});

describe("BreadcrumbLink", () => {
  it("default (tanpa asChild) render sebagai <a>", () => {
    render(<BreadcrumbLink href="/home">Home</BreadcrumbLink>);
    const link = screen.getByRole("link", { name: "Home" });
    expect(link.tagName).toBe("A");
    expect(link).toHaveAttribute("href", "/home");
    expect(link.className).toContain("transition-colors");
  });

  it("asChild merender elemen anak (mis. custom <span>) alih-alih <a>, atribut & className digabung ke anak", () => {
    render(
      <BreadcrumbLink asChild className="extra-class">
        <span data-testid="custom-child">Custom</span>
      </BreadcrumbLink>,
    );
    const el = screen.getByTestId("custom-child");
    expect(el.tagName).toBe("SPAN");
    expect(el.className).toContain("extra-class");
    expect(el.className).toContain("transition-colors");
    // Tidak ada elemen <a> yang dirender saat asChild dipakai.
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
  });

  it("forwardRef meneruskan ref ke elemen <a> asli (default, tanpa asChild)", () => {
    const ref = createRef();
    render(
      <BreadcrumbLink ref={ref} href="/x">
        Link
      </BreadcrumbLink>,
    );
    expect(ref.current.tagName).toBe("A");
  });

  it("menggabungkan className custom dengan default saat tanpa asChild", () => {
    render(
      <BreadcrumbLink href="/x" className="custom-link">
        Link
      </BreadcrumbLink>,
    );
    const link = screen.getByRole("link", { name: "Link" });
    expect(link.className).toContain("custom-link");
    expect(link.className).toContain("transition-colors");
  });
});

describe("BreadcrumbPage", () => {
  it("render sebagai <span> dengan role='link', aria-disabled dan aria-current='page'", () => {
    render(<BreadcrumbPage>Halaman Ini</BreadcrumbPage>);
    const el = screen.getByRole("link", { name: "Halaman Ini" });
    expect(el.tagName).toBe("SPAN");
    expect(el).toHaveAttribute("aria-disabled", "true");
    expect(el).toHaveAttribute("aria-current", "page");
    expect(el.className).toContain("text-foreground");
  });

  it("menggabungkan className custom dengan default", () => {
    render(<BreadcrumbPage className="custom-page">Ini</BreadcrumbPage>);
    const el = screen.getByText("Ini");
    expect(el.className).toContain("custom-page");
    expect(el.className).toContain("text-foreground");
  });

  it("forwardRef meneruskan ref ke elemen <span> asli", () => {
    const ref = createRef();
    render(<BreadcrumbPage ref={ref}>Ini</BreadcrumbPage>);
    expect(ref.current.tagName).toBe("SPAN");
  });
});

describe("BreadcrumbSeparator", () => {
  it("render sebagai <li role='presentation' aria-hidden='true'> berisi ChevronRight default", () => {
    const { container } = render(<BreadcrumbSeparator />);
    const li = container.querySelector("li");
    expect(li).toHaveAttribute("role", "presentation");
    expect(li).toHaveAttribute("aria-hidden", "true");
    // lucide-react ChevronRight dirender sebagai <svg>
    expect(li.querySelector("svg")).toBeInTheDocument();
  });

  it("children custom menggantikan ChevronRight default", () => {
    const { container } = render(
      <BreadcrumbSeparator>
        <span data-testid="custom-sep">/</span>
      </BreadcrumbSeparator>,
    );
    expect(screen.getByTestId("custom-sep")).toBeInTheDocument();
    expect(container.querySelector("svg")).not.toBeInTheDocument();
  });

  it("menggabungkan className custom dengan default", () => {
    const { container } = render(
      <BreadcrumbSeparator className="custom-sep-class" />,
    );
    const li = container.querySelector("li");
    expect(li.className).toContain("custom-sep-class");
    expect(li.className).toContain("[&>svg]:w-3.5");
  });
});

describe("BreadcrumbEllipsis", () => {
  it("render sebagai <span role='presentation' aria-hidden='true'> berisi icon MoreHorizontal dan teks sr-only 'More'", () => {
    const { container } = render(<BreadcrumbEllipsis />);
    const span = container.querySelector("span");
    expect(span).toHaveAttribute("role", "presentation");
    expect(span).toHaveAttribute("aria-hidden", "true");
    expect(span.querySelector("svg")).toBeInTheDocument();
    expect(screen.getByText("More")).toHaveClass("sr-only");
  });

  it("menggabungkan className custom dengan default", () => {
    const { container } = render(
      <BreadcrumbEllipsis className="custom-ellipsis" />,
    );
    const span = container.querySelector("span");
    expect(span.className).toContain("custom-ellipsis");
    expect(span.className).toContain("flex");
  });

  // Bug diketahui di source: displayName di-typo jadi "BreadcrumbElipssis"
  // (harusnya "BreadcrumbEllipsis") -- lihat breadcrumb.jsx baris 84.
  // Test ini mendokumentasikan perilaku SAAT INI, bukan memperbaikinya.
  it("displayName SAAT INI masih typo 'BreadcrumbElipssis' (bukan 'BreadcrumbEllipsis')", () => {
    expect(BreadcrumbEllipsis.displayName).toBe("BreadcrumbElipssis");
  });
});

describe("Breadcrumb - komposisi penuh", () => {
  it("seluruh sub-komponen dapat dirender bersama membentuk struktur breadcrumb yang valid", () => {
    render(
      <Breadcrumb>
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbLink href="/">Home</BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbLink href="/sales">Sales</BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbPage>Detail</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>,
    );

    expect(
      screen.getByRole("navigation", { name: "breadcrumb" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Home" })).toHaveAttribute(
      "href",
      "/",
    );
    expect(screen.getByRole("link", { name: "Sales" })).toHaveAttribute(
      "href",
      "/sales",
    );
    expect(screen.getByRole("link", { name: "Detail" })).toHaveAttribute(
      "aria-current",
      "page",
    );
  });
});
