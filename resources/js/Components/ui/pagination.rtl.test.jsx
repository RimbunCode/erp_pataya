import { createRef } from "react";
import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationButton,
  PaginationNext,
  PaginationPrevious,
} from "./pagination";

describe("Pagination", () => {
  it("render sebagai <nav role='navigation' aria-label='pagination'>", () => {
    render(<Pagination data-testid="nav" />);
    const nav = screen.getByRole("navigation", { name: "pagination" });
    expect(nav).toBeInTheDocument();
    expect(nav.tagName).toBe("NAV");
  });

  it("menggabungkan className custom dengan default (bukan menggantikan)", () => {
    render(<Pagination data-testid="nav" className="custom-nav" />);
    const nav = screen.getByTestId("nav");
    expect(nav.className).toContain("custom-nav");
    expect(nav.className).toContain("justify-center");
  });

  it("meneruskan props HTML lain (mis. data-testid)", () => {
    render(<Pagination data-testid="nav-props" />);
    expect(screen.getByTestId("nav-props")).toBeInTheDocument();
  });
});

describe("PaginationContent", () => {
  it("render sebagai <ul> dengan className default", () => {
    render(<PaginationContent data-testid="content" />);
    const ul = screen.getByTestId("content");
    expect(ul.tagName).toBe("UL");
    expect(ul.className).toContain("flex");
    expect(ul.className).toContain("items-center");
    expect(ul.className).toContain("gap-1");
  });

  it("menggabungkan className custom dengan default", () => {
    render(
      <PaginationContent data-testid="content" className="custom-content" />,
    );
    const ul = screen.getByTestId("content");
    expect(ul.className).toContain("custom-content");
    expect(ul.className).toContain("flex");
  });

  it("forwardRef meneruskan ref ke elemen <ul> asli", () => {
    const ref = createRef();
    render(<PaginationContent ref={ref} />);
    expect(ref.current.tagName).toBe("UL");
  });
});

describe("PaginationItem", () => {
  it("render sebagai <li>", () => {
    render(<PaginationItem data-testid="item" />);
    const li = screen.getByTestId("item");
    expect(li.tagName).toBe("LI");
  });

  it("menggabungkan className custom yang diberikan", () => {
    render(<PaginationItem data-testid="item" className="custom-item" />);
    const li = screen.getByTestId("item");
    expect(li.className).toContain("custom-item");
  });

  it("forwardRef meneruskan ref ke elemen <li> asli", () => {
    const ref = createRef();
    render(<PaginationItem ref={ref} />);
    expect(ref.current.tagName).toBe("LI");
  });
});

describe("PaginationLink", () => {
  it("render sebagai <a> tanpa aria-current saat isActive tidak diberikan", () => {
    render(
      <PaginationLink href="/page/1" data-testid="link-1">
        1
      </PaginationLink>,
    );
    const link = screen.getByTestId("link-1");
    expect(link.tagName).toBe("A");
    expect(link).toHaveAttribute("href", "/page/1");
    expect(link).not.toHaveAttribute("aria-current");
  });

  it("variant ghost terpakai saat isActive false/tidak diberikan (bukan outline)", () => {
    render(
      <PaginationLink href="#" data-testid="link-inactive">
        1
      </PaginationLink>,
    );
    const link = screen.getByTestId("link-inactive");
    expect(link.className).toContain("text-accent-foreground");
    expect(link.className).not.toContain("border-input");
  });

  it("isActive=true menghasilkan aria-current='page' dan variant outline (bg-background, border-input)", () => {
    render(
      <PaginationLink href="#" isActive data-testid="link-active">
        2
      </PaginationLink>,
    );
    const link = screen.getByTestId("link-active");
    expect(link).toHaveAttribute("aria-current", "page");
    expect(link.className).toContain("bg-background");
    expect(link.className).toContain("border-input");
  });

  it("size default ('icon') menghasilkan className size-8.5", () => {
    render(
      <PaginationLink href="#" data-testid="link-default-size">
        3
      </PaginationLink>,
    );
    expect(screen.getByTestId("link-default-size").className).toContain(
      "size-8.5",
    );
  });

  it("prop size dapat di-override (mis. 'lg') menghasilkan className berbeda", () => {
    render(
      <PaginationLink href="#" size="lg" data-testid="link-lg">
        4
      </PaginationLink>,
    );
    const link = screen.getByTestId("link-lg");
    expect(link.className).toContain("h-10");
    expect(link.className).not.toContain("size-8.5");
  });

  it("menggabungkan className custom dengan default", () => {
    render(
      <PaginationLink
        href="#"
        className="custom-link"
        data-testid="link-custom"
      >
        5
      </PaginationLink>,
    );
    expect(screen.getByTestId("link-custom").className).toContain(
      "custom-link",
    );
  });
});

describe("PaginationButton", () => {
  it("render sebagai <button type='button'>", () => {
    render(<PaginationButton data-testid="btn">1</PaginationButton>);
    const btn = screen.getByTestId("btn");
    expect(btn.tagName).toBe("BUTTON");
    expect(btn).toHaveAttribute("type", "button");
  });

  it("variant ghost terpakai saat isActive false/tidak diberikan (bukan secondary)", () => {
    render(<PaginationButton data-testid="btn-inactive">1</PaginationButton>);
    expect(screen.getByTestId("btn-inactive").className).not.toContain(
      "bg-secondary",
    );
  });

  it("isActive=true menghasilkan aria-current='page' dan variant secondary (bg-secondary)", () => {
    render(
      <PaginationButton isActive data-testid="btn-active">
        2
      </PaginationButton>,
    );
    const btn = screen.getByTestId("btn-active");
    expect(btn).toHaveAttribute("aria-current", "page");
    expect(btn.className).toContain("bg-secondary");
  });

  it("tanpa isActive tidak memiliki atribut aria-current", () => {
    render(<PaginationButton data-testid="btn-noactive">1</PaginationButton>);
    expect(screen.getByTestId("btn-noactive")).not.toHaveAttribute(
      "aria-current",
    );
  });

  it("meneruskan onClick dan menjalankannya saat diklik", async () => {
    const user = userEvent.setup();
    const handleClick = vi.fn();
    render(<PaginationButton onClick={handleClick}>Go</PaginationButton>);

    await user.click(screen.getByRole("button", { name: "Go" }));
    expect(handleClick).toHaveBeenCalledTimes(1);
  });
});

describe("PaginationPrevious", () => {
  it("render sebagai link dengan aria-label 'Go to previous page' dan teks 'Previous'", () => {
    render(<PaginationPrevious href="#" />);
    const link = screen.getByRole("link", { name: "Go to previous page" });
    expect(link.tagName).toBe("A");
    expect(link).toHaveTextContent("Previous");
  });

  it("berisi icon chevron (svg)", () => {
    render(<PaginationPrevious href="#" />);
    const link = screen.getByRole("link", { name: "Go to previous page" });
    expect(link.querySelector("svg")).toBeInTheDocument();
  });

  it("menggabungkan className custom dengan default ('gap-1 pl-2.5')", () => {
    render(<PaginationPrevious href="#" className="custom-prev" />);
    const link = screen.getByRole("link", { name: "Go to previous page" });
    expect(link.className).toContain("custom-prev");
    expect(link.className).toContain("pl-2.5");
  });

  // Bug/kejanggalan yang sudah ada di source: PaginationPrevious meneruskan
  // size="default" ke PaginationLink -> buttonVariants({size}), padahal
  // buttonVariants (lihat button.jsx) hanya mendefinisikan size "lg"|"md"|"sm"|"icon",
  // TIDAK ada key "default". Karena size diberikan eksplisit (bukan undefined),
  // cva tidak fallback ke defaultVariants.size ("md") -- hasilnya class ukuran
  // (size-*, w-*, h-*, p-*) sama sekali tidak ditambahkan, sehingga tombol
  // Previous/Next kehilangan sizing yang didapat item pagination lain (yang
  // pakai size="icon" default & jadi size-8.5). Test ini mendokumentasikan
  // perilaku SAAT INI, bukan memperbaikinya.
  it("SAAT INI size='default' bukan key size yang valid di buttonVariants -- tidak ada className ukuran (size-8.5/h-9/dst) yang ditambahkan", () => {
    render(<PaginationPrevious href="#" />);
    const link = screen.getByRole("link", { name: "Go to previous page" });
    expect(link.className).not.toContain("size-8.5");
    expect(link.className).not.toContain("h-10");
  });
});

describe("PaginationNext", () => {
  it("render sebagai link dengan aria-label 'Go to next page' dan teks 'Next'", () => {
    render(<PaginationNext href="#" />);
    const link = screen.getByRole("link", { name: "Go to next page" });
    expect(link.tagName).toBe("A");
    expect(link).toHaveTextContent("Next");
  });

  it("berisi icon chevron (svg)", () => {
    render(<PaginationNext href="#" />);
    const link = screen.getByRole("link", { name: "Go to next page" });
    expect(link.querySelector("svg")).toBeInTheDocument();
  });

  it("menggabungkan className custom dengan default ('gap-1 pr-2.5')", () => {
    render(<PaginationNext href="#" className="custom-next" />);
    const link = screen.getByRole("link", { name: "Go to next page" });
    expect(link.className).toContain("custom-next");
    expect(link.className).toContain("pr-2.5");
  });
});

describe("PaginationEllipsis", () => {
  it("render sebagai <span aria-hidden='true'> berisi icon dan teks sr-only 'More pages'", () => {
    const { container } = render(<PaginationEllipsis />);
    const span = container.querySelector("span");
    expect(span).toHaveAttribute("aria-hidden", "true");
    expect(span.querySelector("svg")).toBeInTheDocument();
    expect(screen.getByText("More pages")).toHaveClass("sr-only");
  });

  it("menggabungkan className custom dengan default", () => {
    const { container } = render(
      <PaginationEllipsis className="custom-ellipsis" />,
    );
    const span = container.querySelector("span");
    expect(span.className).toContain("custom-ellipsis");
    expect(span.className).toContain("flex");
  });
});

describe("Pagination - komposisi penuh", () => {
  it("seluruh sub-komponen dapat dirender bersama membentuk struktur pagination yang valid", () => {
    render(
      <Pagination>
        <PaginationContent>
          <PaginationItem>
            <PaginationPrevious href="#page=1" />
          </PaginationItem>
          <PaginationItem>
            <PaginationLink href="#page=1" isActive>
              1
            </PaginationLink>
          </PaginationItem>
          <PaginationItem>
            <PaginationLink href="#page=2">2</PaginationLink>
          </PaginationItem>
          <PaginationItem>
            <PaginationEllipsis />
          </PaginationItem>
          <PaginationItem>
            <PaginationNext href="#page=3" />
          </PaginationItem>
        </PaginationContent>
      </Pagination>,
    );

    expect(
      screen.getByRole("navigation", { name: "pagination" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "1" })).toHaveAttribute(
      "aria-current",
      "page",
    );
    expect(screen.getByRole("link", { name: "2" })).not.toHaveAttribute(
      "aria-current",
    );
    expect(
      screen.getByRole("link", { name: "Go to previous page" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "Go to next page" }),
    ).toBeInTheDocument();
  });
});
