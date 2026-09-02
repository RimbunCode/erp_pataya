import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetOverlay,
  SheetTitle,
  SheetTrigger,
} from "./sheet";

// Radix Dialog.Content (dasar SheetContent) mewajibkan Title (dan mewarning
// bila tidak ada Description) untuk aksesibilitas -- selalu sertakan
// keduanya di test yang merender Content supaya console tidak berisik
// dengan warning yang tak relevan dengan yang sedang diuji.
function renderOpenSheet(contentProps = {}, contentChildren) {
  return render(
    <Sheet open>
      <SheetContent {...contentProps}>
        <SheetHeader>
          <SheetTitle>Judul Sheet</SheetTitle>
          <SheetDescription>Deskripsi sheet.</SheetDescription>
        </SheetHeader>
        {contentChildren}
      </SheetContent>
    </Sheet>,
  );
}

describe("Sheet + SheetTrigger (alur buka/tutup dasar)", () => {
  it("content tidak ada di DOM sebelum trigger diklik, muncul setelah diklik", async () => {
    const user = userEvent.setup();
    render(
      <Sheet>
        <SheetTrigger>Buka</SheetTrigger>
        <SheetContent>
          <SheetHeader>
            <SheetTitle>Judul</SheetTitle>
            <SheetDescription>Deskripsi.</SheetDescription>
          </SheetHeader>
        </SheetContent>
      </Sheet>,
    );

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Buka" }));

    expect(screen.getByRole("dialog", { name: "Judul" })).toBeInTheDocument();
  });

  it("klik SheetClose menutup sheet", async () => {
    const user = userEvent.setup();
    render(
      <Sheet defaultOpen>
        <SheetContent>
          <SheetHeader>
            <SheetTitle>Judul</SheetTitle>
            <SheetDescription>Deskripsi.</SheetDescription>
          </SheetHeader>
          <SheetFooter>
            <SheetClose>Batal</SheetClose>
          </SheetFooter>
        </SheetContent>
      </Sheet>,
    );

    expect(screen.getByRole("dialog")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Batal" }));

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });
});

describe("SheetOverlay", () => {
  it("render dengan className default dan meneruskan className tambahan", () => {
    render(
      <Sheet open>
        <SheetOverlay data-testid="overlay" className="custom-overlay" />
      </Sheet>,
    );

    const overlay = screen.getByTestId("overlay");
    expect(overlay).toBeInTheDocument();
    expect(overlay.className).toContain("bg-black/80");
    expect(overlay.className).toContain("custom-overlay");
  });
});

describe("SheetContent", () => {
  it("meneruskan ref ke elemen Radix Content asli", () => {
    const ref = { current: null };
    render(
      <Sheet open>
        <SheetContent ref={ref}>
          <SheetHeader>
            <SheetTitle>Judul</SheetTitle>
            <SheetDescription>Deskripsi</SheetDescription>
          </SheetHeader>
        </SheetContent>
      </Sheet>,
    );

    expect(ref.current).toBeInstanceOf(HTMLElement);
    expect(ref.current).toBe(screen.getByRole("dialog"));
  });

  it("default (side tidak diberikan) berperilaku sama seperti side='right'", () => {
    renderOpenSheet();
    const content = screen.getByRole("dialog");

    expect(content.className).toContain("border-l");
    expect(content.className).toContain("w-3/4");
    expect(content.className).toContain(
      "data-[state=open]:slide-in-from-right",
    );
    expect(content.className).not.toContain("slide-in-from-left");
    expect(content.className).not.toContain("slide-in-from-top");
    expect(content.className).not.toContain("slide-in-from-bottom");
  });

  it("side='left' menghasilkan class border-r & slide-in-from-left, bukan right", () => {
    renderOpenSheet({ side: "left" });
    const content = screen.getByRole("dialog");

    expect(content.className).toContain("border-r");
    expect(content.className).toContain("w-3/4");
    expect(content.className).toContain("data-[state=open]:slide-in-from-left");
    expect(content.className).not.toContain("slide-in-from-right");
  });

  it("side='top' menghasilkan class border-b & slide-in-from-top", () => {
    renderOpenSheet({ side: "top" });
    const content = screen.getByRole("dialog");

    expect(content.className).toContain("border-b");
    expect(content.className).toContain("data-[state=open]:slide-in-from-top");
    expect(content.className).not.toContain("slide-in-from-bottom");
  });

  it("side='bottom' menghasilkan class border-t & slide-in-from-bottom", () => {
    renderOpenSheet({ side: "bottom" });
    const content = screen.getByRole("dialog");

    expect(content.className).toContain("border-t");
    expect(content.className).toContain(
      "data-[state=open]:slide-in-from-bottom",
    );
    expect(content.className).not.toContain("slide-in-from-top");
  });

  it("meneruskan className custom tanpa menghapus className default", () => {
    renderOpenSheet({ className: "custom-content-class" });
    const content = screen.getByRole("dialog");

    expect(content.className).toContain("custom-content-class");
    expect(content.className).toContain("shadow-lg");
  });

  it("meneruskan props lain (mis. id) ke elemen Radix Content", () => {
    renderOpenSheet({ id: "my-sheet-content" });
    const content = screen.getByRole("dialog");

    expect(content.id).toBe("my-sheet-content");
  });

  it("tombol close X dirender dengan teks sr-only 'Close'", () => {
    renderOpenSheet();

    expect(screen.getByRole("button", { name: "Close" })).toBeInTheDocument();
  });

  it("klik tombol close X (bawaan wrapper) menutup sheet", async () => {
    const user = userEvent.setup();
    render(
      <Sheet defaultOpen>
        <SheetContent>
          <SheetHeader>
            <SheetTitle>Judul</SheetTitle>
            <SheetDescription>Deskripsi.</SheetDescription>
          </SheetHeader>
        </SheetContent>
      </Sheet>,
    );

    expect(screen.getByRole("dialog")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Close" }));

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("children tetap dirender di dalam content", () => {
    renderOpenSheet({}, <p>Konten anak</p>);
    expect(screen.getByText("Konten anak")).toBeInTheDocument();
  });
});

describe("SheetHeader", () => {
  it("render children dengan className default dan className custom digabung", () => {
    render(
      <SheetHeader data-testid="header" className="extra-header-class">
        Header content
      </SheetHeader>,
    );

    const header = screen.getByTestId("header");
    expect(header).toHaveTextContent("Header content");
    expect(header.className).toContain("flex-col");
    expect(header.className).toContain("text-center");
    expect(header.className).toContain("extra-header-class");
  });
});

describe("SheetFooter", () => {
  it("render children dengan className default dan className custom digabung", () => {
    render(
      <SheetFooter data-testid="footer" className="extra-footer-class">
        Footer content
      </SheetFooter>,
    );

    const footer = screen.getByTestId("footer");
    expect(footer).toHaveTextContent("Footer content");
    expect(footer.className).toContain("flex-col-reverse");
    expect(footer.className).toContain("sm:justify-end");
    expect(footer.className).toContain("extra-footer-class");
  });
});

describe("SheetTitle & SheetDescription", () => {
  it("render teks dan className default, meneruskan ref", () => {
    const titleRef = { current: null };
    const descriptionRef = { current: null };

    render(
      <Sheet open>
        <SheetContent>
          <SheetHeader>
            <SheetTitle ref={titleRef} className="extra-title">
              Judul Sheet
            </SheetTitle>
            <SheetDescription ref={descriptionRef} className="extra-desc">
              Deskripsi sheet.
            </SheetDescription>
          </SheetHeader>
        </SheetContent>
      </Sheet>,
    );

    const title = screen.getByText("Judul Sheet");
    const description = screen.getByText("Deskripsi sheet.");

    expect(title.className).toContain("text-lg");
    expect(title.className).toContain("font-semibold");
    expect(title.className).toContain("extra-title");
    expect(titleRef.current).toBe(title);

    expect(description.className).toContain("text-sm");
    expect(description.className).toContain("text-muted-foreground");
    expect(description.className).toContain("extra-desc");
    expect(descriptionRef.current).toBe(description);
  });
});
