import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import {
  Drawer,
  DrawerOverlay,
  DrawerTrigger,
  DrawerClose,
  DrawerContent,
  DrawerHeader,
  DrawerFooter,
  DrawerTitle,
  DrawerDescription,
} from "./drawer";

// jsdom tidak mengimplementasikan Pointer Capture API
// (setPointerCapture/releasePointerCapture/hasPointerCapture). vaul
// memasang onPointerDown di seluruh DrawerPrimitive.Content untuk fitur
// drag-to-close, dan handler itu memanggil event.target.setPointerCapture()
// -- jadi klik APAPUN di dalam Content (mis. tombol DrawerClose) memicu
// TypeError tak tertangani ("setPointerCapture is not a function") yang
// membuat exit code vitest non-zero (CI merah) meski semua assertion test
// tetap lulus. Polyfill no-op lokal di file test ini saja (bukan
// test-setup.js) supaya interaksi klik di dalam DrawerContent bisa diuji.
if (typeof Element !== "undefined" && !Element.prototype.setPointerCapture) {
  Element.prototype.setPointerCapture = () => {};
  Element.prototype.releasePointerCapture = () => {};
  Element.prototype.hasPointerCapture = () => false;
}

// DrawerPrimitive.Content (dari paket "vaul") dibangun di atas
// @radix-ui/react-dialog persis seperti dialog.jsx -- Content dirender
// dengan role="dialog" dan Title/Description-nya adalah re-export langsung
// dari DialogPrimitive.Title/Description. Sertakan keduanya di test yang
// merender Content supaya console tidak berisik dengan warning
// aksesibilitas yang tak relevan dengan yang sedang diuji.
function renderOpenDrawer(contentProps = {}, contentChildren) {
  return render(
    <Drawer open>
      <DrawerContent {...contentProps}>
        <DrawerHeader>
          <DrawerTitle>Judul Drawer</DrawerTitle>
          <DrawerDescription>Deskripsi drawer.</DrawerDescription>
        </DrawerHeader>
        {contentChildren}
      </DrawerContent>
    </Drawer>,
  );
}

describe("Drawer + DrawerTrigger (alur buka/tutup dasar)", () => {
  it("content tidak ada di DOM sebelum trigger diklik, muncul setelah diklik", async () => {
    const user = userEvent.setup();
    render(
      <Drawer>
        <DrawerTrigger>Buka</DrawerTrigger>
        <DrawerContent>
          <DrawerHeader>
            <DrawerTitle>Judul</DrawerTitle>
            <DrawerDescription>Deskripsi.</DrawerDescription>
          </DrawerHeader>
        </DrawerContent>
      </Drawer>,
    );

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Buka" }));

    expect(screen.getByRole("dialog", { name: "Judul" })).toBeInTheDocument();
  });

  // Beda dengan dialog.jsx: DrawerContent vaul di-unmount lewat Radix
  // Presence yang menunggu event `animationend` dari CSS exit-animation
  // yang di-inject vaul sendiri (elemen [data-vaul-drawer] punya
  // animation-duration di stylesheet global). jsdom tidak pernah
  // menjalankan/menembakkan animationend, jadi elemen TETAP ada di DOM
  // dengan data-state="closed" setelah DrawerClose diklik -- tidak
  // ter-unmount total seperti Dialog. Assert perilaku nyata ini
  // (data-state berubah), bukan asumsi unmount penuh ala Dialog.
  it("klik DrawerClose mengubah data-state Content dari open ke closed", async () => {
    const user = userEvent.setup();
    render(
      <Drawer defaultOpen>
        <DrawerContent>
          <DrawerHeader>
            <DrawerTitle>Judul</DrawerTitle>
            <DrawerDescription>Deskripsi.</DrawerDescription>
          </DrawerHeader>
          <DrawerFooter>
            <DrawerClose>Batal</DrawerClose>
          </DrawerFooter>
        </DrawerContent>
      </Drawer>,
    );

    expect(screen.getByRole("dialog")).toHaveAttribute("data-state", "open");

    await user.click(screen.getByRole("button", { name: "Batal" }));

    expect(screen.getByRole("dialog")).toHaveAttribute("data-state", "closed");
  });
});

describe("Drawer (default modal=false, bisa dioverride)", () => {
  // drawer.jsx menulis `modal={false}` SEBELUM `{...props}` di-spread ke
  // DrawerPrimitive.Root -- artinya modal=false hanya default, bukan
  // dipaksa: consumer tetap bisa override dengan prop `modal` eksplisit.
  // Konsekuensi nyatanya: DrawerOverlay yang otomatis dirender di dalam
  // DrawerContent mengembalikan null saat modal=false (lihat vaul
  // Overlay -- `if (!modal) return null`), jadi overlay TIDAK pernah
  // muncul kecuali <Drawer modal> diset eksplisit.
  it("default: DrawerOverlay otomatis dari DrawerContent TIDAK dirender ke DOM", () => {
    renderOpenDrawer();

    expect(
      document.querySelector("[data-vaul-overlay]"),
    ).not.toBeInTheDocument();
  });

  it("modal={true} eksplisit: DrawerOverlay dirender dengan className default bg-black/80", () => {
    render(
      <Drawer open modal>
        <DrawerContent>
          <DrawerHeader>
            <DrawerTitle>Judul Drawer</DrawerTitle>
            <DrawerDescription>Deskripsi drawer.</DrawerDescription>
          </DrawerHeader>
        </DrawerContent>
      </Drawer>,
    );

    const overlay = document.querySelector("[data-vaul-overlay]");
    expect(overlay).toBeInTheDocument();
    expect(overlay.className).toContain("bg-black/80");
  });
});

describe("DrawerContent", () => {
  it("meneruskan ref ke elemen Radix Content asli", () => {
    const ref = { current: null };
    render(
      <Drawer open>
        <DrawerContent ref={ref}>
          <DrawerHeader>
            <DrawerTitle>Judul</DrawerTitle>
            <DrawerDescription>Deskripsi</DrawerDescription>
          </DrawerHeader>
        </DrawerContent>
      </Drawer>,
    );

    expect(ref.current).toBeInstanceOf(HTMLElement);
    expect(ref.current).toBe(screen.getByRole("dialog"));
  });

  it("merender drag handle bar bawaan wrapper di atas children", () => {
    renderOpenDrawer();
    const content = screen.getByRole("dialog");
    const handle = content.querySelector(".rounded-full.bg-muted");

    expect(handle).toBeInTheDocument();
    expect(handle.className).toContain("mx-auto");
    expect(handle.className).toContain("h-2");
    expect(handle.className).toContain("w-[100px]");
  });

  it("class default (fixed inset-x-0 bottom-0, rounded-t-[10px]) ada, className custom digabung bukan menggantikan", () => {
    renderOpenDrawer({ className: "custom-content-class" });
    const content = screen.getByRole("dialog");

    expect(content.className).toContain("fixed");
    expect(content.className).toContain("inset-x-0");
    expect(content.className).toContain("bottom-0");
    expect(content.className).toContain("rounded-t-[10px]");
    expect(content.className).toContain("custom-content-class");
  });

  it("meneruskan props lain (mis. id) ke elemen Radix Content", () => {
    renderOpenDrawer({ id: "my-drawer-content" });
    const content = screen.getByRole("dialog");

    expect(content.id).toBe("my-drawer-content");
  });

  it("children tetap dirender di dalam Content", () => {
    renderOpenDrawer({}, <p>Konten anak</p>);
    expect(screen.getByText("Konten anak")).toBeInTheDocument();
  });
});

describe("DrawerOverlay", () => {
  it("render dengan className default dan meneruskan className tambahan saat modal true", () => {
    render(
      <Drawer open modal>
        <DrawerOverlay data-testid="overlay" className="custom-overlay" />
      </Drawer>,
    );

    const overlay = screen.getByTestId("overlay");
    expect(overlay).toBeInTheDocument();
    expect(overlay.className).toContain("bg-black/80");
    expect(overlay.className).toContain("custom-overlay");
  });

  it("meneruskan ref ke elemen Radix Overlay asli saat modal true", () => {
    const ref = { current: null };
    render(
      <Drawer open modal>
        <DrawerOverlay ref={ref} data-testid="overlay" />
      </Drawer>,
    );

    expect(ref.current).toBeInstanceOf(HTMLElement);
    expect(ref.current).toBe(screen.getByTestId("overlay"));
  });
});

describe("DrawerHeader", () => {
  it("render children dengan className default dan className custom digabung", () => {
    render(
      <DrawerHeader data-testid="header" className="extra-header-class">
        Header content
      </DrawerHeader>,
    );

    const header = screen.getByTestId("header");
    expect(header).toHaveTextContent("Header content");
    expect(header.className).toContain("grid");
    expect(header.className).toContain("text-center");
    expect(header.className).toContain("extra-header-class");
  });
});

describe("DrawerFooter", () => {
  it("render children dengan className default dan className custom digabung", () => {
    render(
      <DrawerFooter data-testid="footer" className="extra-footer-class">
        Footer content
      </DrawerFooter>,
    );

    const footer = screen.getByTestId("footer");
    expect(footer).toHaveTextContent("Footer content");
    expect(footer.className).toContain("mt-auto");
    expect(footer.className).toContain("flex-col");
    expect(footer.className).toContain("extra-footer-class");
  });
});

describe("DrawerTitle & DrawerDescription", () => {
  it("render teks dan className default, meneruskan ref", () => {
    const titleRef = { current: null };
    const descriptionRef = { current: null };

    render(
      <Drawer open>
        <DrawerContent>
          <DrawerHeader>
            <DrawerTitle ref={titleRef} className="extra-title">
              Judul Drawer
            </DrawerTitle>
            <DrawerDescription ref={descriptionRef} className="extra-desc">
              Deskripsi drawer.
            </DrawerDescription>
          </DrawerHeader>
        </DrawerContent>
      </Drawer>,
    );

    const title = screen.getByText("Judul Drawer");
    const description = screen.getByText("Deskripsi drawer.");

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
