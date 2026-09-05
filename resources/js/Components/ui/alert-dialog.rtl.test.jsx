import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const useIsMobileMock = vi.fn(() => false);
vi.mock("@/Hooks/use-mobile", () => ({
  useIsMobile: () => useIsMobileMock(),
}));

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogOverlay,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "./alert-dialog";

// Radix AlertDialogContent mewajibkan Title (dan mewarning bila tidak ada
// Description) untuk aksesibilitas -- selalu sertakan keduanya di test yang
// merender Content supaya console tidak berisik dengan warning yang tak
// relevan dengan yang sedang diuji.
function renderOpenDialog(contentProps = {}, contentChildren) {
  return render(
    <AlertDialog open>
      <AlertDialogContent {...contentProps}>
        <AlertDialogHeader>
          <AlertDialogTitle>Judul Alert</AlertDialogTitle>
          <AlertDialogDescription>Deskripsi alert.</AlertDialogDescription>
        </AlertDialogHeader>
        {contentChildren}
      </AlertDialogContent>
    </AlertDialog>,
  );
}

describe("AlertDialog + AlertDialogTrigger (alur buka/tutup dasar)", () => {
  beforeEach(() => {
    useIsMobileMock.mockReturnValue(false);
  });

  it("content tidak ada di DOM sebelum trigger diklik, muncul setelah diklik", async () => {
    const user = userEvent.setup();
    render(
      <AlertDialog>
        <AlertDialogTrigger>Buka</AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Konfirmasi</AlertDialogTitle>
            <AlertDialogDescription>Yakin lanjut?</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Batal</AlertDialogCancel>
            <AlertDialogAction>Lanjut</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>,
    );

    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Buka" }));

    expect(
      screen.getByRole("alertdialog", { name: "Konfirmasi" }),
    ).toBeInTheDocument();
  });

  it("klik AlertDialogCancel menutup dialog", async () => {
    const user = userEvent.setup();
    render(
      <AlertDialog defaultOpen>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Konfirmasi</AlertDialogTitle>
            <AlertDialogDescription>Yakin lanjut?</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Batal</AlertDialogCancel>
            <AlertDialogAction>Lanjut</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>,
    );

    expect(screen.getByRole("alertdialog")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Batal" }));

    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
  });
});

describe("AlertDialogOverlay", () => {
  it("render dengan className default dan meneruskan className tambahan", () => {
    render(
      <AlertDialog open>
        <AlertDialogOverlay data-testid="overlay" className="custom-overlay" />
      </AlertDialog>,
    );

    const overlay = screen.getByTestId("overlay");
    expect(overlay).toBeInTheDocument();
    expect(overlay.className).toContain("bg-black/80");
    expect(overlay.className).toContain("custom-overlay");
  });
});

describe("AlertDialogContent", () => {
  beforeEach(() => {
    useIsMobileMock.mockReturnValue(false);
  });

  it("meneruskan ref ke elemen Radix Content asli", () => {
    const ref = { current: null };
    render(
      <AlertDialog open>
        <AlertDialogContent ref={ref}>
          <AlertDialogHeader>
            <AlertDialogTitle>Judul</AlertDialogTitle>
            <AlertDialogDescription>Deskripsi</AlertDialogDescription>
          </AlertDialogHeader>
        </AlertDialogContent>
      </AlertDialog>,
    );

    expect(ref.current).toBeInstanceOf(HTMLElement);
    expect(ref.current).toBe(screen.getByRole("alertdialog"));
  });

  it("default (align='top', forceAsDialog=false): class h-screen & slide-in-from-top ada", () => {
    renderOpenDialog();
    const content = screen.getByRole("alertdialog");
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
    const content = screen.getByRole("alertdialog");

    expect(content.className).toContain(
      "data-[state=open]:slide-in-from-bottom-[28%]",
    );
    expect(content.className).not.toContain("slide-in-from-top");
  });

  it("align='center' tidak menambahkan class slide-in-from-top maupun slide-in-from-bottom", () => {
    renderOpenDialog({ align: "center" });
    const content = screen.getByRole("alertdialog");

    expect(content.className).not.toContain("slide-in-from-top");
    expect(content.className).not.toContain("slide-in-from-bottom");
  });

  it("forceAsDialog=true menghilangkan class h-screen dari Content", () => {
    renderOpenDialog({ forceAsDialog: true });
    const content = screen.getByRole("alertdialog");
    const classes = content.className.split(" ");

    expect(classes).not.toContain("h-screen");
  });

  it("saat useIsMobile() true dan forceAsDialog=false, class max-w-full! ditambahkan", () => {
    useIsMobileMock.mockReturnValue(true);
    renderOpenDialog();
    const content = screen.getByRole("alertdialog");

    expect(content.className).toContain("max-w-full!");
  });

  it("saat useIsMobile() true tapi forceAsDialog=true, class max-w-full! TIDAK ditambahkan", () => {
    useIsMobileMock.mockReturnValue(true);
    renderOpenDialog({ forceAsDialog: true });
    const content = screen.getByRole("alertdialog");

    expect(content.className).not.toContain("max-w-full!");
  });

  it("meneruskan className custom tanpa menghapus className default", () => {
    renderOpenDialog({ className: "custom-content-class" });
    const content = screen.getByRole("alertdialog");

    expect(content.className).toContain("custom-content-class");
    expect(content.className).toContain("shadow-lg");
  });

  it("meneruskan props lain (mis. id) ke elemen Radix Content", () => {
    renderOpenDialog({ id: "my-alert-content" });
    const content = screen.getByRole("alertdialog");

    expect(content.id).toBe("my-alert-content");
  });

  it("prop asChild tidak diteruskan sebagai atribut DOM (di-strip oleh wrapper)", () => {
    renderOpenDialog({ asChild: true });
    const content = screen.getByRole("alertdialog");

    expect(content.getAttribute("aschild")).toBeNull();
    expect(content.getAttribute("aria-describedby")).not.toBeNull();
  });
});

describe("AlertDialogHeader", () => {
  it("render children dengan className default dan className custom digabung", () => {
    render(
      <AlertDialogHeader data-testid="header" className="extra-header-class">
        Header content
      </AlertDialogHeader>,
    );

    const header = screen.getByTestId("header");
    expect(header).toHaveTextContent("Header content");
    expect(header.className).toContain("flex-col");
    expect(header.className).toContain("text-center");
    expect(header.className).toContain("extra-header-class");
  });
});

describe("AlertDialogFooter", () => {
  it("render children dengan className default dan className custom digabung", () => {
    render(
      <AlertDialogFooter data-testid="footer" className="extra-footer-class">
        Footer content
      </AlertDialogFooter>,
    );

    const footer = screen.getByTestId("footer");
    expect(footer).toHaveTextContent("Footer content");
    expect(footer.className).toContain("flex-col-reverse");
    expect(footer.className).toContain("sm:justify-end");
    expect(footer.className).toContain("extra-footer-class");
  });
});

describe("AlertDialogTitle & AlertDialogDescription", () => {
  it("render teks dan className default, meneruskan ref", () => {
    const titleRef = { current: null };
    const descriptionRef = { current: null };

    render(
      <AlertDialog open>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle ref={titleRef} className="extra-title">
              Judul Alert
            </AlertDialogTitle>
            <AlertDialogDescription ref={descriptionRef} className="extra-desc">
              Deskripsi alert.
            </AlertDialogDescription>
          </AlertDialogHeader>
        </AlertDialogContent>
      </AlertDialog>,
    );

    const title = screen.getByText("Judul Alert");
    const description = screen.getByText("Deskripsi alert.");

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

describe("AlertDialogAction", () => {
  it("default variant='primary' size='lg' menghasilkan className buttonVariants yang sesuai", () => {
    renderOpenDialog(
      {},
      <AlertDialogFooter>
        <AlertDialogAction>Lanjut</AlertDialogAction>
      </AlertDialogFooter>,
    );

    const button = screen.getByRole("button", { name: "Lanjut" });
    expect(button.className).toContain("bg-primary");
    expect(button.className).toContain("h-10");
    expect(button.className).toContain("p-2");
    expect(button.className).toContain("md:size-fit");
  });

  it("variant & size custom mengganti className default", () => {
    renderOpenDialog(
      {},
      <AlertDialogFooter>
        <AlertDialogAction variant="destructive" size="sm">
          Hapus
        </AlertDialogAction>
      </AlertDialogFooter>,
    );

    const button = screen.getByRole("button", { name: "Hapus" });
    expect(button.className).toContain("bg-destructive");
    expect(button.className).toContain("h-7");
    expect(button.className).not.toContain("bg-primary");
  });

  it("meneruskan ref ke elemen button asli dan className custom", () => {
    const ref = { current: null };
    renderOpenDialog(
      {},
      <AlertDialogFooter>
        <AlertDialogAction ref={ref} className="extra-action">
          Lanjut
        </AlertDialogAction>
      </AlertDialogFooter>,
    );

    const button = screen.getByRole("button", { name: "Lanjut" });
    expect(ref.current).toBe(button);
    expect(button.className).toContain("extra-action");
  });
});

describe("AlertDialogCancel", () => {
  it("default variant='outline' size='lg' menghasilkan className buttonVariants yang sesuai", () => {
    renderOpenDialog(
      {},
      <AlertDialogFooter>
        <AlertDialogCancel>Batal</AlertDialogCancel>
      </AlertDialogFooter>,
    );

    const button = screen.getByRole("button", { name: "Batal" });
    expect(button.className).toContain("bg-background");
    expect(button.className).toContain("border-input");
    expect(button.className).toContain("h-10");
    expect(button.className).toContain("mt-2");
  });

  it("variant & size custom mengganti className default", () => {
    renderOpenDialog(
      {},
      <AlertDialogFooter>
        <AlertDialogCancel variant="ghost" size="sm">
          Batal
        </AlertDialogCancel>
      </AlertDialogFooter>,
    );

    const button = screen.getByRole("button", { name: "Batal" });
    expect(button.className).toContain("hover:bg-accent");
    expect(button.className).toContain("h-7");
    expect(button.className).not.toContain("bg-background");
  });

  it("meneruskan ref ke elemen button asli dan className custom", () => {
    const ref = { current: null };
    renderOpenDialog(
      {},
      <AlertDialogFooter>
        <AlertDialogCancel ref={ref} className="extra-cancel">
          Batal
        </AlertDialogCancel>
      </AlertDialogFooter>,
    );

    const button = screen.getByRole("button", { name: "Batal" });
    expect(ref.current).toBe(button);
    expect(button.className).toContain("extra-cancel");
  });
});
