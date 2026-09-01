import { createRef } from "react";
import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { Button, ButtonArrow } from "./button";

describe("Button", () => {
  it("render children tanpa crash sebagai elemen <button>", () => {
    render(<Button>Simpan</Button>);
    const button = screen.getByRole("button", { name: "Simpan" });
    expect(button).toBeInTheDocument();
    expect(button.tagName).toBe("BUTTON");
  });

  it("variant & size default (primary, md) menghasilkan className yang benar", () => {
    render(<Button>Default</Button>);
    const button = screen.getByRole("button", { name: "Default" });
    expect(button.className).toContain("bg-primary");
    expect(button.className).toContain("text-primary-foreground");
    expect(button.className).toContain("h-8.5");
  });

  it("variant destructive menghasilkan className yang sesuai", () => {
    render(<Button variant="destructive">Hapus</Button>);
    const button = screen.getByRole("button", { name: "Hapus" });
    expect(button.className).toContain("bg-destructive");
    expect(button.className).toContain("text-destructive-foreground");
  });

  it("variant outline menghasilkan className yang sesuai", () => {
    render(<Button variant="outline">Outline</Button>);
    const button = screen.getByRole("button", { name: "Outline" });
    expect(button.className).toContain("border-input");
    expect(button.className).toContain("bg-background");
  });

  it("size sm menghasilkan className h-7, size lg menghasilkan h-10", () => {
    const { rerender } = render(<Button size="sm">Kecil</Button>);
    expect(screen.getByRole("button", { name: "Kecil" }).className).toContain(
      "h-7",
    );

    rerender(<Button size="lg">Besar</Button>);
    expect(screen.getByRole("button", { name: "Besar" }).className).toContain(
      "h-10",
    );
  });

  it("menggabungkan className custom dengan className default (bukan menggantikan)", () => {
    render(<Button className="custom-class">Custom</Button>);
    const button = screen.getByRole("button", { name: "Custom" });
    expect(button.className).toContain("custom-class");
    expect(button.className).toContain("bg-primary");
  });

  it("forwardRef meneruskan ref ke elemen <button> asli", () => {
    const ref = createRef();
    render(<Button ref={ref}>Ref</Button>);
    expect(ref.current).toBe(screen.getByRole("button", { name: "Ref" }));
    expect(ref.current.tagName).toBe("BUTTON");
  });

  it("meneruskan props HTML lain (type, data-testid, onClick) ke elemen button", async () => {
    const user = userEvent.setup();
    let clicked = false;
    render(
      <Button
        type="submit"
        data-testid="submit-btn"
        onClick={() => {
          clicked = true;
        }}
      >
        Kirim
      </Button>,
    );

    const button = screen.getByTestId("submit-btn");
    expect(button).toHaveAttribute("type", "submit");

    await user.click(button);
    expect(clicked).toBe(true);
  });

  it("prop selected=true menambahkan atribut data-state='open'", () => {
    render(<Button selected>Terpilih</Button>);
    expect(screen.getByRole("button", { name: "Terpilih" })).toHaveAttribute(
      "data-state",
      "open",
    );
  });

  it("tanpa prop selected, atribut data-state tidak ditambahkan", () => {
    render(<Button>Tidak terpilih</Button>);
    expect(
      screen.getByRole("button", { name: "Tidak terpilih" }),
    ).not.toHaveAttribute("data-state");
  });

  it("disabled=true (tanpa asChild) menghasilkan elemen <button> yang benar-benar disabled dan tidak memicu onClick", async () => {
    const user = userEvent.setup();
    let clicked = false;
    render(
      <Button
        disabled
        onClick={() => {
          clicked = true;
        }}
      >
        Nonaktif
      </Button>,
    );

    const button = screen.getByRole("button", { name: "Nonaktif" });
    expect(button).toBeDisabled();

    await user.click(button);
    expect(clicked).toBe(false);
  });

  it("disabled=true tanpa asChild TIDAK menambahkan className literal 'pointer-events-none'/'opacity-50' (hanya varian disabled: bawaan cva)", () => {
    render(<Button disabled>Nonaktif</Button>);
    const classes = screen
      .getByRole("button", { name: "Nonaktif" })
      .className.split(/\s+/);
    expect(classes).not.toContain("pointer-events-none");
    expect(classes).not.toContain("opacity-50");
  });

  it("asChild me-render child aslinya (mis. <a>) alih-alih <button>, sambil menggabungkan className wrapper", () => {
    render(
      <Button asChild>
        <a href="/tujuan">Tautan</a>
      </Button>,
    );

    const link = screen.getByRole("link", { name: "Tautan" });
    expect(link.tagName).toBe("A");
    expect(link).toHaveAttribute("href", "/tujuan");
    expect(link.className).toContain("bg-primary");
  });

  it("asChild meneruskan ref ke elemen child asli", () => {
    const ref = createRef();
    render(
      <Button asChild ref={ref}>
        <a href="/tujuan">Tautan</a>
      </Button>,
    );
    expect(ref.current.tagName).toBe("A");
  });

  it("asChild + disabled=true menambahkan className literal 'pointer-events-none' dan 'opacity-50' pada child", () => {
    render(
      <Button asChild disabled>
        <a href="/tujuan">Tautan nonaktif</a>
      </Button>,
    );

    const classes = screen
      .getByRole("link", { name: "Tautan nonaktif" })
      .className.split(/\s+/);
    expect(classes).toContain("pointer-events-none");
    expect(classes).toContain("opacity-50");
  });

  it("asChild tanpa disabled TIDAK menambahkan className 'pointer-events-none'/'opacity-50'", () => {
    render(
      <Button asChild>
        <a href="/tujuan">Tautan aktif</a>
      </Button>,
    );

    const classes = screen
      .getByRole("link", { name: "Tautan aktif" })
      .className.split(/\s+/);
    expect(classes).not.toContain("pointer-events-none");
    expect(classes).not.toContain("opacity-50");
  });

  // Catatan (lihat bugFindings): berbeda dari <button disabled> native yang
  // benar-benar memblokir event klik di level DOM, kombinasi asChild+disabled
  // di sini HANYA menambahkan className kosmetik ("pointer-events-none
  // opacity-50") -- atribut HTML "disabled" yang ikut ter-spread ke child
  // (mis. <a disabled>) tidak berefek apa pun pada elemen non-form seperti
  // <a>, dan tidak ada guard di level JS (aria-disabled/onClick) yang
  // mencegah handler tetap terpanggil. Test ini mendokumentasikan behavior
  // SAAT INI: onClick tetap terpicu.
  it("asChild + disabled=true TIDAK benar-benar mencegah onClick terpicu pada child non-button (dokumentasi behavior saat ini)", async () => {
    const user = userEvent.setup();
    let clicked = false;
    render(
      <Button
        asChild
        disabled
        onClick={() => {
          clicked = true;
        }}
      >
        <a href="/tujuan">Tautan nonaktif</a>
      </Button>,
    );

    const link = screen.getByRole("link", { name: "Tautan nonaktif" });
    await user.click(link);
    expect(clicked).toBe(true);
  });
});

describe("ButtonArrow", () => {
  it("render ikon default (ChevronDown) sebagai svg dengan data-slot='button-arrow'", () => {
    const { container } = render(<ButtonArrow />);
    const icon = container.querySelector("[data-slot='button-arrow']");
    expect(icon).toBeInTheDocument();
    expect(icon.tagName.toLowerCase()).toBe("svg");
    expect(icon.getAttribute("class")).toContain("ms-auto");
    expect(icon.getAttribute("class")).toContain("-me-1");
  });

  it("prop icon menggantikan ikon default dengan komponen custom", () => {
    const CustomIcon = (props) => <svg data-testid="custom-icon" {...props} />;
    render(<ButtonArrow icon={CustomIcon} />);
    expect(screen.getByTestId("custom-icon")).toBeInTheDocument();
  });

  it("menggabungkan className custom dengan className default (bukan menggantikan)", () => {
    const { container } = render(<ButtonArrow className="text-red-500" />);
    const icon = container.querySelector("[data-slot='button-arrow']");
    expect(icon.getAttribute("class")).toContain("text-red-500");
    expect(icon.getAttribute("class")).toContain("ms-auto");
  });

  it("meneruskan props HTML lain (mis. data-testid) ke elemen ikon", () => {
    render(<ButtonArrow data-testid="arrow-icon" />);
    expect(screen.getByTestId("arrow-icon")).toBeInTheDocument();
  });

  it("forwardRef meneruskan ref ke elemen svg ikon asli", () => {
    const ref = createRef();
    render(<ButtonArrow ref={ref} />);
    expect(ref.current).toBeInstanceOf(SVGElement);
  });
});
