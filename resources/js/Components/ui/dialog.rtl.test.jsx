import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const useIsMobileMock = vi.fn(() => false);
vi.mock("@/Hooks/use-mobile", () => ({
  useIsMobile: () => useIsMobileMock(),
}));

import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogOverlay,
  DialogTitle,
  DialogTrigger,
} from "./dialog";

// Radix DialogContent mewajibkan Title (dan mewarning bila tidak ada
// Description) untuk aksesibilitas -- selalu sertakan keduanya di test yang
// merender Content supaya console tidak berisik dengan warning yang tak
// relevan dengan yang sedang diuji.
function renderOpenDialog(contentProps = {}, contentChildren) {
  return render(
    <Dialog open>
      <DialogContent {...contentProps}>
        <DialogHeader>
          <DialogTitle>Judul Dialog</DialogTitle>
          <DialogDescription>Deskripsi dialog.</DialogDescription>
        </DialogHeader>
        {contentChildren}
      </DialogContent>
    </Dialog>,
  );
}

describe("Dialog + DialogTrigger (alur buka/tutup dasar)", () => {
  beforeEach(() => {
    useIsMobileMock.mockReturnValue(false);
  });

  it("content tidak ada di DOM sebelum trigger diklik, muncul setelah diklik", async () => {
    const user = userEvent.setup();
    render(
      <Dialog>
        <DialogTrigger>Buka</DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Judul</DialogTitle>
            <DialogDescription>Deskripsi.</DialogDescription>
          </DialogHeader>
        </DialogContent>
      </Dialog>,
    );

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Buka" }));

    expect(screen.getByRole("dialog", { name: "Judul" })).toBeInTheDocument();
  });

  it("klik DialogClose menutup dialog", async () => {
    const user = userEvent.setup();
    render(
      <Dialog defaultOpen>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Judul</DialogTitle>
            <DialogDescription>Deskripsi.</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <DialogClose>Batal</DialogClose>
          </DialogFooter>
        </DialogContent>
      </Dialog>,
    );

    expect(screen.getByRole("dialog")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Batal" }));

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });
});

describe("DialogOverlay", () => {
  it("render dengan className default dan meneruskan className tambahan", () => {
    render(
      <Dialog open>
        <DialogOverlay data-testid="overlay" className="custom-overlay" />
      </Dialog>,
    );

    const overlay = screen.getByTestId("overlay");
    expect(overlay).toBeInTheDocument();
    expect(overlay.className).toContain("bg-black/80");
    expect(overlay.className).toContain("custom-overlay");
  });
});

describe("DialogContent", () => {
  beforeEach(() => {
    useIsMobileMock.mockReturnValue(false);
  });

  it("meneruskan ref ke elemen Radix Content asli", () => {
    const ref = { current: null };
    render(
      <Dialog open>
        <DialogContent ref={ref}>
          <DialogHeader>
            <DialogTitle>Judul</DialogTitle>
            <DialogDescription>Deskripsi</DialogDescription>
          </DialogHeader>
        </DialogContent>
      </Dialog>,
    );

    expect(ref.current).toBeInstanceOf(HTMLElement);
    expect(ref.current).toBe(screen.getByRole("dialog"));
  });

  it("default (align='top', forceAsDialog=false): class h-screen & slide-in-from-top ada", () => {
    renderOpenDialog();
    const content = screen.getByRole("dialog");
    const classes = content.className.split(" ");

    expect(classes).toContain("h-screen");
    expect(content.className).toContain(
      "data-[state=open]:slide-in-from-top-[28%]",
    );
    expect(content.className).not.toContain("slide-in-from-bottom");
    expect(content.className).not.toContain("max-w-full!");
  });

  it("align='bottom' menghasilkan class slide-in-from-bottom, bukan top", () => {
    renderOpenDialog({ align: "bottom" });
    const content = screen.getByRole("dialog");

    expect(content.className).toContain(
      "data-[state=open]:slide-in-from-bottom-[28%]",
    );
    expect(content.className).not.toContain("slide-in-from-top");
  });

  it("align='center' tidak menambahkan class slide-in-from-top maupun slide-in-from-bottom", () => {
    renderOpenDialog({ align: "center" });
    const content = screen.getByRole("dialog");

    expect(content.className).not.toContain("slide-in-from-top");
    expect(content.className).not.toContain("slide-in-from-bottom");
  });

  it("forceAsDialog=true menghilangkan class h-screen dari Content", () => {
    renderOpenDialog({ forceAsDialog: true });
    const content = screen.getByRole("dialog");
    const classes = content.className.split(" ");

    expect(classes).not.toContain("h-screen");
  });

  it("saat useIsMobile() true dan forceAsDialog=false, class max-w-full! ditambahkan", () => {
    useIsMobileMock.mockReturnValue(true);
    renderOpenDialog();
    const content = screen.getByRole("dialog");

    expect(content.className).toContain("max-w-full!");
  });

  it("saat useIsMobile() true tapi forceAsDialog=true, class max-w-full! TIDAK ditambahkan", () => {
    useIsMobileMock.mockReturnValue(true);
    renderOpenDialog({ forceAsDialog: true });
    const content = screen.getByRole("dialog");

    expect(content.className).not.toContain("max-w-full!");
  });

  it("meneruskan className custom tanpa menghapus className default", () => {
    renderOpenDialog({ className: "custom-content-class" });
    const content = screen.getByRole("dialog");

    expect(content.className).toContain("custom-content-class");
    expect(content.className).toContain("shadow-lg");
  });

  it("meneruskan props lain (mis. id) ke elemen Radix Content", () => {
    renderOpenDialog({ id: "my-dialog-content" });
    const content = screen.getByRole("dialog");

    expect(content.id).toBe("my-dialog-content");
  });

  it("default (hideX bukan true): tombol close X dirender dengan teks sr-only 'Close'", () => {
    renderOpenDialog();

    expect(screen.getByRole("button", { name: "Close" })).toBeInTheDocument();
  });

  it("hideX=true: tombol close X tidak dirender", () => {
    renderOpenDialog({ hideX: true });

    expect(
      screen.queryByRole("button", { name: "Close" }),
    ).not.toBeInTheDocument();
  });

  it("klik tombol close X (bawaan wrapper) menutup dialog", async () => {
    const user = userEvent.setup();
    render(
      <Dialog defaultOpen>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Judul</DialogTitle>
            <DialogDescription>Deskripsi.</DialogDescription>
          </DialogHeader>
        </DialogContent>
      </Dialog>,
    );

    expect(screen.getByRole("dialog")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Close" }));

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("children tetap dirender baik hideX true maupun false", () => {
    renderOpenDialog({ hideX: true }, <p>Konten anak</p>);
    expect(screen.getByText("Konten anak")).toBeInTheDocument();
  });
});

describe("DialogHeader", () => {
  it("render children dengan className default dan className custom digabung", () => {
    render(
      <DialogHeader data-testid="header" className="extra-header-class">
        Header content
      </DialogHeader>,
    );

    const header = screen.getByTestId("header");
    expect(header).toHaveTextContent("Header content");
    expect(header.className).toContain("flex-col");
    expect(header.className).toContain("text-center");
    expect(header.className).toContain("extra-header-class");
  });
});

describe("DialogFooter", () => {
  it("render children dengan className default dan className custom digabung", () => {
    render(
      <DialogFooter data-testid="footer" className="extra-footer-class">
        Footer content
      </DialogFooter>,
    );

    const footer = screen.getByTestId("footer");
    expect(footer).toHaveTextContent("Footer content");
    expect(footer.className).toContain("flex-col-reverse");
    expect(footer.className).toContain("sm:justify-end");
    expect(footer.className).toContain("extra-footer-class");
  });
});

describe("DialogTitle & DialogDescription", () => {
  it("render teks dan className default, meneruskan ref", () => {
    const titleRef = { current: null };
    const descriptionRef = { current: null };

    render(
      <Dialog open>
        <DialogContent>
          <DialogHeader>
            <DialogTitle ref={titleRef} className="extra-title">
              Judul Dialog
            </DialogTitle>
            <DialogDescription ref={descriptionRef} className="extra-desc">
              Deskripsi dialog.
            </DialogDescription>
          </DialogHeader>
        </DialogContent>
      </Dialog>,
    );

    const title = screen.getByText("Judul Dialog");
    const description = screen.getByText("Deskripsi dialog.");

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
