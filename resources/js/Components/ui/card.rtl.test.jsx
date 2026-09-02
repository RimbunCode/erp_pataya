import { createRef } from "react";
import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import {
  Card,
  CardHeader,
  CardFooter,
  CardTitle,
  CardDescription,
  CardContent,
} from "./card";

describe("Card", () => {
  it("render children tanpa crash sebagai elemen <div> dengan className default", () => {
    render(<Card data-testid="card">Isi card</Card>);
    const card = screen.getByTestId("card");
    expect(card.tagName).toBe("DIV");
    expect(card).toHaveTextContent("Isi card");
    expect(card.className).toContain("rounded-lg");
    expect(card.className).toContain("border");
    expect(card.className).toContain("bg-card");
    expect(card.className).toContain("text-card-foreground");
    expect(card.className).toContain("shadow-sm");
  });

  it("menggabungkan className custom dengan default (bukan menggantikan)", () => {
    render(
      <Card data-testid="card" className="custom-card">
        Isi
      </Card>,
    );
    const card = screen.getByTestId("card");
    expect(card.className).toContain("custom-card");
    expect(card.className).toContain("rounded-lg");
  });

  it("meneruskan props HTML lain (data-testid, id, onClick) ke elemen div", async () => {
    const user = userEvent.setup();
    let clicked = false;
    render(
      <Card
        data-testid="card"
        id="card-1"
        onClick={() => {
          clicked = true;
        }}
      >
        Klik
      </Card>,
    );

    const card = screen.getByTestId("card");
    expect(card).toHaveAttribute("id", "card-1");

    await user.click(card);
    expect(clicked).toBe(true);
  });

  it("forwardRef meneruskan ref ke elemen <div> asli", () => {
    const ref = createRef();
    render(<Card ref={ref} data-testid="card" />);
    expect(ref.current).toBe(screen.getByTestId("card"));
    expect(ref.current.tagName).toBe("DIV");
  });
});

describe("CardHeader", () => {
  it("render children dengan className default", () => {
    render(<CardHeader data-testid="header">Header</CardHeader>);
    const header = screen.getByTestId("header");
    expect(header.tagName).toBe("DIV");
    expect(header).toHaveTextContent("Header");
    expect(header.className).toContain("flex");
    expect(header.className).toContain("flex-col");
    expect(header.className).toContain("space-y-1.5");
    expect(header.className).toContain("p-6");
  });

  it("menggabungkan className custom dengan default", () => {
    render(
      <CardHeader data-testid="header" className="custom-header">
        Header
      </CardHeader>,
    );
    const header = screen.getByTestId("header");
    expect(header.className).toContain("custom-header");
    expect(header.className).toContain("flex-col");
  });

  it("forwardRef meneruskan ref ke elemen <div> asli", () => {
    const ref = createRef();
    render(<CardHeader ref={ref} data-testid="header" />);
    expect(ref.current).toBe(screen.getByTestId("header"));
    expect(ref.current.tagName).toBe("DIV");
  });
});

describe("CardTitle", () => {
  it("render children sebagai <div> (bukan elemen heading) dengan className default", () => {
    render(<CardTitle data-testid="title">Judul Card</CardTitle>);
    const title = screen.getByTestId("title");
    expect(title.tagName).toBe("DIV");
    expect(title).toHaveTextContent("Judul Card");
    expect(title.className).toContain("text-2xl");
    expect(title.className).toContain("font-semibold");
    expect(title.className).toContain("leading-none");
    expect(title.className).toContain("tracking-tight");
  });

  it("menggabungkan className custom dengan default", () => {
    render(
      <CardTitle data-testid="title" className="custom-title">
        Judul
      </CardTitle>,
    );
    const title = screen.getByTestId("title");
    expect(title.className).toContain("custom-title");
    expect(title.className).toContain("text-2xl");
  });

  it("forwardRef meneruskan ref ke elemen <div> asli", () => {
    const ref = createRef();
    render(<CardTitle ref={ref} data-testid="title" />);
    expect(ref.current).toBe(screen.getByTestId("title"));
    expect(ref.current.tagName).toBe("DIV");
  });
});

describe("CardDescription", () => {
  it("render children dengan className default", () => {
    render(<CardDescription data-testid="desc">Deskripsi</CardDescription>);
    const desc = screen.getByTestId("desc");
    expect(desc.tagName).toBe("DIV");
    expect(desc).toHaveTextContent("Deskripsi");
    expect(desc.className).toContain("text-sm");
    expect(desc.className).toContain("text-muted-foreground");
  });

  it("menggabungkan className custom dengan default", () => {
    render(
      <CardDescription data-testid="desc" className="custom-desc">
        Deskripsi
      </CardDescription>,
    );
    const desc = screen.getByTestId("desc");
    expect(desc.className).toContain("custom-desc");
    expect(desc.className).toContain("text-muted-foreground");
  });

  it("forwardRef meneruskan ref ke elemen <div> asli", () => {
    const ref = createRef();
    render(<CardDescription ref={ref} data-testid="desc" />);
    expect(ref.current).toBe(screen.getByTestId("desc"));
    expect(ref.current.tagName).toBe("DIV");
  });
});

describe("CardContent", () => {
  it("render children dengan className default", () => {
    render(<CardContent data-testid="content">Konten</CardContent>);
    const content = screen.getByTestId("content");
    expect(content.tagName).toBe("DIV");
    expect(content).toHaveTextContent("Konten");
    expect(content.className).toContain("p-6");
    expect(content.className).toContain("pt-0");
  });

  it("menggabungkan className custom dengan default", () => {
    render(
      <CardContent data-testid="content" className="custom-content">
        Konten
      </CardContent>,
    );
    const content = screen.getByTestId("content");
    expect(content.className).toContain("custom-content");
    expect(content.className).toContain("p-6");
  });

  it("forwardRef meneruskan ref ke elemen <div> asli", () => {
    const ref = createRef();
    render(<CardContent ref={ref} data-testid="content" />);
    expect(ref.current).toBe(screen.getByTestId("content"));
    expect(ref.current.tagName).toBe("DIV");
  });
});

describe("CardFooter", () => {
  it("render children dengan className default", () => {
    render(<CardFooter data-testid="footer">Footer</CardFooter>);
    const footer = screen.getByTestId("footer");
    expect(footer.tagName).toBe("DIV");
    expect(footer).toHaveTextContent("Footer");
    expect(footer.className).toContain("flex");
    expect(footer.className).toContain("items-center");
    expect(footer.className).toContain("p-6");
    expect(footer.className).toContain("pt-0");
  });

  it("menggabungkan className custom dengan default", () => {
    render(
      <CardFooter data-testid="footer" className="custom-footer">
        Footer
      </CardFooter>,
    );
    const footer = screen.getByTestId("footer");
    expect(footer.className).toContain("custom-footer");
    expect(footer.className).toContain("items-center");
  });

  it("forwardRef meneruskan ref ke elemen <div> asli", () => {
    const ref = createRef();
    render(<CardFooter ref={ref} data-testid="footer" />);
    expect(ref.current).toBe(screen.getByTestId("footer"));
    expect(ref.current.tagName).toBe("DIV");
  });
});

describe("Card composition", () => {
  it("merender komposisi penuh (Header+Title+Description, Content, Footer) sesuai urutan", () => {
    render(
      <Card data-testid="card">
        <CardHeader data-testid="header">
          <CardTitle>Judul Produk</CardTitle>
          <CardDescription>Deskripsi singkat produk</CardDescription>
        </CardHeader>
        <CardContent data-testid="content">Body konten produk</CardContent>
        <CardFooter data-testid="footer">Aksi footer</CardFooter>
      </Card>,
    );

    const card = screen.getByTestId("card");
    const header = screen.getByTestId("header");
    const content = screen.getByTestId("content");
    const footer = screen.getByTestId("footer");

    expect(screen.getByText("Judul Produk")).toBeInTheDocument();
    expect(screen.getByText("Deskripsi singkat produk")).toBeInTheDocument();
    expect(content).toHaveTextContent("Body konten produk");
    expect(footer).toHaveTextContent("Aksi footer");

    // urutan children di dalam Card: header lalu content lalu footer
    const children = Array.from(card.children);
    expect(children).toEqual([header, content, footer]);
  });
});
