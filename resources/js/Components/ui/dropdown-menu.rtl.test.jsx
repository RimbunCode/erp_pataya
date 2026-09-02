import { describe, expect, it, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createRef } from "react";

import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuPortal,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "./dropdown-menu";

describe("DropdownMenu + DropdownMenuTrigger (alur buka/tutup dasar)", () => {
  it("content tidak ada di DOM sebelum trigger diklik, muncul setelah diklik", async () => {
    const user = userEvent.setup();
    render(
      <DropdownMenu>
        <DropdownMenuTrigger>Buka Menu</DropdownMenuTrigger>
        <DropdownMenuContent>
          <DropdownMenuItem>Item Satu</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>,
    );

    expect(screen.queryByRole("menu")).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Buka Menu" }));

    expect(screen.getByRole("menu")).toBeInTheDocument();
    expect(
      screen.getByRole("menuitem", { name: "Item Satu" }),
    ).toBeInTheDocument();
  });

  it("klik item menutup menu dan memicu onSelect", async () => {
    const user = userEvent.setup();
    const handleSelect = vi.fn();
    render(
      <DropdownMenu>
        <DropdownMenuTrigger>Buka Menu</DropdownMenuTrigger>
        <DropdownMenuContent>
          <DropdownMenuItem onSelect={handleSelect}>Pilih Aku</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>,
    );

    await user.click(screen.getByRole("button", { name: "Buka Menu" }));
    await user.click(screen.getByRole("menuitem", { name: "Pilih Aku" }));

    expect(handleSelect).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
  });

  it("DropdownMenuContent dirender lewat portal ke document.body, bukan sebagai child langsung container render", async () => {
    const user = userEvent.setup();
    const { container } = render(
      <DropdownMenu>
        <DropdownMenuTrigger>Buka Menu</DropdownMenuTrigger>
        <DropdownMenuContent>
          <DropdownMenuItem>Item Satu</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>,
    );

    await user.click(screen.getByRole("button", { name: "Buka Menu" }));

    const menu = screen.getByRole("menu");
    expect(container.contains(menu)).toBe(false);
    expect(document.body.contains(menu)).toBe(true);
  });
});

describe("DropdownMenuContent", () => {
  it("meneruskan ref ke elemen Radix Content asli", async () => {
    const user = userEvent.setup();
    const ref = createRef();
    render(
      <DropdownMenu>
        <DropdownMenuTrigger>Buka</DropdownMenuTrigger>
        <DropdownMenuContent ref={ref}>
          <DropdownMenuItem>Item</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>,
    );

    await user.click(screen.getByRole("button", { name: "Buka" }));

    expect(ref.current).toBeInstanceOf(HTMLElement);
    expect(ref.current).toBe(screen.getByRole("menu"));
  });

  it("className default (mis. z-50, bg-popover) tetap ada saat className custom ditambahkan", async () => {
    const user = userEvent.setup();
    render(
      <DropdownMenu>
        <DropdownMenuTrigger>Buka</DropdownMenuTrigger>
        <DropdownMenuContent className="custom-content-class">
          <DropdownMenuItem>Item</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>,
    );

    await user.click(screen.getByRole("button", { name: "Buka" }));
    const menu = screen.getByRole("menu");

    expect(menu.className).toContain("custom-content-class");
    expect(menu.className).toContain("z-50");
    expect(menu.className).toContain("bg-popover");
  });

  it("meneruskan props lain (mis. id) ke elemen Radix Content", async () => {
    const user = userEvent.setup();
    render(
      <DropdownMenu>
        <DropdownMenuTrigger>Buka</DropdownMenuTrigger>
        <DropdownMenuContent id="my-dropdown-content">
          <DropdownMenuItem>Item</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>,
    );

    await user.click(screen.getByRole("button", { name: "Buka" }));

    expect(screen.getByRole("menu").id).toBe("my-dropdown-content");
  });
});

describe("DropdownMenuItem", () => {
  it("meneruskan ref ke elemen DOM asli", async () => {
    const user = userEvent.setup();
    const ref = createRef();
    render(
      <DropdownMenu>
        <DropdownMenuTrigger>Buka</DropdownMenuTrigger>
        <DropdownMenuContent>
          <DropdownMenuItem ref={ref}>Item</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>,
    );

    await user.click(screen.getByRole("button", { name: "Buka" }));

    expect(ref.current).toBeInstanceOf(HTMLElement);
    expect(ref.current).toBe(screen.getByRole("menuitem"));
  });

  it("prop inset menambahkan class pl-8", async () => {
    const user = userEvent.setup();
    render(
      <DropdownMenu>
        <DropdownMenuTrigger>Buka</DropdownMenuTrigger>
        <DropdownMenuContent>
          <DropdownMenuItem inset>Item Inset</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>,
    );

    await user.click(screen.getByRole("button", { name: "Buka" }));

    expect(screen.getByRole("menuitem").className).toContain("pl-8");
  });

  it("tanpa prop inset, class pl-8 tidak ditambahkan", async () => {
    const user = userEvent.setup();
    render(
      <DropdownMenu>
        <DropdownMenuTrigger>Buka</DropdownMenuTrigger>
        <DropdownMenuContent>
          <DropdownMenuItem>Item Biasa</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>,
    );

    await user.click(screen.getByRole("button", { name: "Buka" }));

    expect(screen.getByRole("menuitem").className).not.toContain("pl-8");
  });

  it("meneruskan className custom tanpa menghapus className default", async () => {
    const user = userEvent.setup();
    render(
      <DropdownMenu>
        <DropdownMenuTrigger>Buka</DropdownMenuTrigger>
        <DropdownMenuContent>
          <DropdownMenuItem className="custom-item-class">
            Item
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>,
    );

    await user.click(screen.getByRole("button", { name: "Buka" }));
    const item = screen.getByRole("menuitem");

    expect(item.className).toContain("custom-item-class");
    expect(item.className).toContain("cursor-pointer");
  });
});

describe("DropdownMenuCheckboxItem", () => {
  it("checked=true: DropdownMenuPrimitive.ItemIndicator merender icon Check", async () => {
    const user = userEvent.setup();
    render(
      <DropdownMenu>
        <DropdownMenuTrigger>Buka</DropdownMenuTrigger>
        <DropdownMenuContent>
          <DropdownMenuCheckboxItem checked>
            Opsi Aktif
          </DropdownMenuCheckboxItem>
        </DropdownMenuContent>
      </DropdownMenu>,
    );

    await user.click(screen.getByRole("button", { name: "Buka" }));
    const item = screen.getByRole("menuitemcheckbox", { name: "Opsi Aktif" });

    expect(item).toHaveAttribute("aria-checked", "true");
    expect(item.querySelector("svg")).toBeInTheDocument();
  });

  it("checked=false: icon Check tidak dirender (ItemIndicator tidak mount)", async () => {
    const user = userEvent.setup();
    render(
      <DropdownMenu>
        <DropdownMenuTrigger>Buka</DropdownMenuTrigger>
        <DropdownMenuContent>
          <DropdownMenuCheckboxItem checked={false}>
            Opsi Nonaktif
          </DropdownMenuCheckboxItem>
        </DropdownMenuContent>
      </DropdownMenu>,
    );

    await user.click(screen.getByRole("button", { name: "Buka" }));
    const item = screen.getByRole("menuitemcheckbox", {
      name: "Opsi Nonaktif",
    });

    expect(item).toHaveAttribute("aria-checked", "false");
    expect(item.querySelector("svg")).not.toBeInTheDocument();
  });

  it("meneruskan ref ke elemen DOM asli dan className custom digabung dengan default", async () => {
    const user = userEvent.setup();
    const ref = createRef();
    render(
      <DropdownMenu>
        <DropdownMenuTrigger>Buka</DropdownMenuTrigger>
        <DropdownMenuContent>
          <DropdownMenuCheckboxItem
            ref={ref}
            checked
            className="custom-checkbox-item"
          >
            Opsi
          </DropdownMenuCheckboxItem>
        </DropdownMenuContent>
      </DropdownMenu>,
    );

    await user.click(screen.getByRole("button", { name: "Buka" }));
    const item = screen.getByRole("menuitemcheckbox");

    expect(ref.current).toBe(item);
    expect(item.className).toContain("custom-checkbox-item");
    expect(item.className).toContain("pl-8");
  });

  it("klik item checkbox memicu onCheckedChange", async () => {
    const user = userEvent.setup();
    const handleCheckedChange = vi.fn();
    render(
      <DropdownMenu>
        <DropdownMenuTrigger>Buka</DropdownMenuTrigger>
        <DropdownMenuContent>
          <DropdownMenuCheckboxItem
            checked={false}
            onCheckedChange={handleCheckedChange}
          >
            Opsi
          </DropdownMenuCheckboxItem>
        </DropdownMenuContent>
      </DropdownMenu>,
    );

    await user.click(screen.getByRole("button", { name: "Buka" }));
    await user.click(screen.getByRole("menuitemcheckbox"));

    expect(handleCheckedChange).toHaveBeenCalledWith(true);
  });
});

describe("DropdownMenuRadioGroup + DropdownMenuRadioItem", () => {
  it("showDot=true: class pl-8 dipakai dan item yang checked menampilkan icon Circle", async () => {
    const user = userEvent.setup();
    render(
      <DropdownMenu>
        <DropdownMenuTrigger>Buka</DropdownMenuTrigger>
        <DropdownMenuContent>
          <DropdownMenuRadioGroup value="a">
            <DropdownMenuRadioItem value="a" showDot>
              Opsi A
            </DropdownMenuRadioItem>
            <DropdownMenuRadioItem value="b" showDot>
              Opsi B
            </DropdownMenuRadioItem>
          </DropdownMenuRadioGroup>
        </DropdownMenuContent>
      </DropdownMenu>,
    );

    await user.click(screen.getByRole("button", { name: "Buka" }));
    const itemA = screen.getByRole("menuitemradio", { name: "Opsi A" });
    const itemB = screen.getByRole("menuitemradio", { name: "Opsi B" });

    expect(itemA).toHaveAttribute("aria-checked", "true");
    expect(itemA.className).toContain("pl-8");
    expect(itemA.querySelector("svg")).toBeInTheDocument();

    expect(itemB).toHaveAttribute("aria-checked", "false");
    expect(itemB.querySelector("svg")).not.toBeInTheDocument();
  });

  it("showDot bukan true (default): class pl-2 dipakai dan icon Circle TIDAK PERNAH dirender walau item checked", async () => {
    const user = userEvent.setup();
    render(
      <DropdownMenu>
        <DropdownMenuTrigger>Buka</DropdownMenuTrigger>
        <DropdownMenuContent>
          <DropdownMenuRadioGroup value="a">
            <DropdownMenuRadioItem value="a">Opsi A</DropdownMenuRadioItem>
          </DropdownMenuRadioGroup>
        </DropdownMenuContent>
      </DropdownMenu>,
    );

    await user.click(screen.getByRole("button", { name: "Buka" }));
    const itemA = screen.getByRole("menuitemradio", { name: "Opsi A" });

    expect(itemA).toHaveAttribute("aria-checked", "true");
    expect(itemA.className).toContain("pl-2");
    expect(itemA.className).not.toContain("pl-8");
    expect(itemA.querySelector("svg")).not.toBeInTheDocument();
  });

  it("meneruskan ref ke elemen DOM asli dan className custom digabung dengan default", async () => {
    const user = userEvent.setup();
    const ref = createRef();
    render(
      <DropdownMenu>
        <DropdownMenuTrigger>Buka</DropdownMenuTrigger>
        <DropdownMenuContent>
          <DropdownMenuRadioGroup value="a">
            <DropdownMenuRadioItem
              ref={ref}
              value="a"
              className="custom-radio-item"
            >
              Opsi A
            </DropdownMenuRadioItem>
          </DropdownMenuRadioGroup>
        </DropdownMenuContent>
      </DropdownMenu>,
    );

    await user.click(screen.getByRole("button", { name: "Buka" }));
    const item = screen.getByRole("menuitemradio");

    expect(ref.current).toBe(item);
    expect(item.className).toContain("custom-radio-item");
  });

  it("klik opsi radio memicu onValueChange pada group dengan value opsi yang diklik", async () => {
    const user = userEvent.setup();
    const handleValueChange = vi.fn();
    render(
      <DropdownMenu>
        <DropdownMenuTrigger>Buka</DropdownMenuTrigger>
        <DropdownMenuContent>
          <DropdownMenuRadioGroup value="a" onValueChange={handleValueChange}>
            <DropdownMenuRadioItem value="a">Opsi A</DropdownMenuRadioItem>
            <DropdownMenuRadioItem value="b">Opsi B</DropdownMenuRadioItem>
          </DropdownMenuRadioGroup>
        </DropdownMenuContent>
      </DropdownMenu>,
    );

    await user.click(screen.getByRole("button", { name: "Buka" }));
    await user.click(screen.getByRole("menuitemradio", { name: "Opsi B" }));

    expect(handleValueChange).toHaveBeenCalledWith("b");
  });
});

describe("DropdownMenuLabel", () => {
  it("render teks dan className default, inset menambahkan pl-8, meneruskan ref", async () => {
    const user = userEvent.setup();
    const ref = createRef();
    render(
      <DropdownMenu>
        <DropdownMenuTrigger>Buka</DropdownMenuTrigger>
        <DropdownMenuContent>
          <DropdownMenuLabel ref={ref} inset className="custom-label">
            Label Grup
          </DropdownMenuLabel>
        </DropdownMenuContent>
      </DropdownMenu>,
    );

    await user.click(screen.getByRole("button", { name: "Buka" }));
    const label = screen.getByText("Label Grup");

    expect(ref.current).toBe(label);
    expect(label.className).toContain("font-semibold");
    expect(label.className).toContain("pl-8");
    expect(label.className).toContain("custom-label");
  });
});

describe("DropdownMenuSeparator", () => {
  it("render dengan role separator, className default, meneruskan ref dan className custom", async () => {
    const user = userEvent.setup();
    const ref = createRef();
    render(
      <DropdownMenu>
        <DropdownMenuTrigger>Buka</DropdownMenuTrigger>
        <DropdownMenuContent>
          <DropdownMenuItem>Item Satu</DropdownMenuItem>
          <DropdownMenuSeparator ref={ref} className="custom-separator" />
        </DropdownMenuContent>
      </DropdownMenu>,
    );

    await user.click(screen.getByRole("button", { name: "Buka" }));
    const separator = screen.getByRole("separator");

    expect(ref.current).toBe(separator);
    expect(separator.className).toContain("bg-muted");
    expect(separator.className).toContain("custom-separator");
  });
});

describe("DropdownMenuShortcut", () => {
  it("render sebagai span dengan className default dan className custom digabung", () => {
    render(
      <DropdownMenuShortcut className="custom-shortcut">
        ⌘K
      </DropdownMenuShortcut>,
    );

    const shortcut = screen.getByText("⌘K");
    expect(shortcut.tagName).toBe("SPAN");
    expect(shortcut.className).toContain("ml-auto");
    expect(shortcut.className).toContain("tracking-widest");
    expect(shortcut.className).toContain("custom-shortcut");
  });

  it("meneruskan props lain (mis. data-testid) ke elemen span", () => {
    render(
      <DropdownMenuShortcut data-testid="shortcut-el">
        ⇧⌘P
      </DropdownMenuShortcut>,
    );

    expect(screen.getByTestId("shortcut-el")).toHaveTextContent("⇧⌘P");
  });
});

describe("DropdownMenuGroup", () => {
  it("mengelompokkan beberapa item, semua tetap ter-render di dalam menu", async () => {
    const user = userEvent.setup();
    render(
      <DropdownMenu>
        <DropdownMenuTrigger>Buka</DropdownMenuTrigger>
        <DropdownMenuContent>
          <DropdownMenuGroup>
            <DropdownMenuItem>Item Satu</DropdownMenuItem>
            <DropdownMenuItem>Item Dua</DropdownMenuItem>
          </DropdownMenuGroup>
        </DropdownMenuContent>
      </DropdownMenu>,
    );

    await user.click(screen.getByRole("button", { name: "Buka" }));
    const menu = screen.getByRole("menu");

    expect(
      within(menu).getByRole("menuitem", { name: "Item Satu" }),
    ).toBeInTheDocument();
    expect(
      within(menu).getByRole("menuitem", { name: "Item Dua" }),
    ).toBeInTheDocument();
  });
});

describe("DropdownMenuSub + DropdownMenuSubTrigger + DropdownMenuSubContent + DropdownMenuPortal", () => {
  it("submenu tidak ada di DOM sebelum sub-trigger diklik, muncul setelah diklik, dan default icon ChevronRight dirender", async () => {
    const user = userEvent.setup();
    render(
      <DropdownMenu open>
        <DropdownMenuTrigger>Buka</DropdownMenuTrigger>
        <DropdownMenuPortal>
          <DropdownMenuContent>
            <DropdownMenuSub>
              <DropdownMenuSubTrigger>Submenu</DropdownMenuSubTrigger>
              <DropdownMenuPortal>
                <DropdownMenuSubContent>
                  <DropdownMenuItem>Item Sub</DropdownMenuItem>
                </DropdownMenuSubContent>
              </DropdownMenuPortal>
            </DropdownMenuSub>
          </DropdownMenuContent>
        </DropdownMenuPortal>
      </DropdownMenu>,
    );

    const subTrigger = screen.getByText("Submenu").closest('[role="menuitem"]');
    expect(subTrigger.querySelector("svg")).toBeInTheDocument();
    expect(
      screen.queryByRole("menuitem", { name: "Item Sub" }),
    ).not.toBeInTheDocument();

    await user.click(subTrigger);

    expect(
      await screen.findByRole("menuitem", { name: "Item Sub" }),
    ).toBeInTheDocument();
  });

  it("useDefaultIcon=false menyembunyikan icon ChevronRight bawaan pada sub-trigger", () => {
    render(
      <DropdownMenu open>
        <DropdownMenuTrigger>Buka</DropdownMenuTrigger>
        <DropdownMenuContent>
          <DropdownMenuSub>
            <DropdownMenuSubTrigger useDefaultIcon={false}>
              Submenu Tanpa Icon
            </DropdownMenuSubTrigger>
            <DropdownMenuSubContent>
              <DropdownMenuItem>Item Sub</DropdownMenuItem>
            </DropdownMenuSubContent>
          </DropdownMenuSub>
        </DropdownMenuContent>
      </DropdownMenu>,
    );

    const subTrigger = screen
      .getByText("Submenu Tanpa Icon")
      .closest('[role="menuitem"]');
    expect(subTrigger.querySelector("svg")).not.toBeInTheDocument();
  });

  it("DropdownMenuSubTrigger meneruskan ref, prop inset menambahkan pl-8, dan className custom digabung", () => {
    const ref = createRef();
    render(
      <DropdownMenu open>
        <DropdownMenuTrigger>Buka</DropdownMenuTrigger>
        <DropdownMenuContent>
          <DropdownMenuSub>
            <DropdownMenuSubTrigger
              ref={ref}
              inset
              className="custom-sub-trigger"
            >
              Submenu
            </DropdownMenuSubTrigger>
            <DropdownMenuSubContent>
              <DropdownMenuItem>Item Sub</DropdownMenuItem>
            </DropdownMenuSubContent>
          </DropdownMenuSub>
        </DropdownMenuContent>
      </DropdownMenu>,
    );

    const subTrigger = screen.getByText("Submenu").closest('[role="menuitem"]');
    expect(ref.current).toBe(subTrigger);
    expect(subTrigger.className).toContain("pl-8");
    expect(subTrigger.className).toContain("custom-sub-trigger");
  });

  it("DropdownMenuSubContent meneruskan ref dan className custom digabung dengan default saat submenu terbuka", async () => {
    const user = userEvent.setup();
    const ref = createRef();
    render(
      <DropdownMenu open>
        <DropdownMenuTrigger>Buka</DropdownMenuTrigger>
        <DropdownMenuContent>
          <DropdownMenuSub>
            <DropdownMenuSubTrigger>Submenu</DropdownMenuSubTrigger>
            <DropdownMenuSubContent ref={ref} className="custom-sub-content">
              <DropdownMenuItem>Item Sub</DropdownMenuItem>
            </DropdownMenuSubContent>
          </DropdownMenuSub>
        </DropdownMenuContent>
      </DropdownMenu>,
    );

    const subTrigger = screen.getByText("Submenu").closest('[role="menuitem"]');
    await user.click(subTrigger);

    const subMenuItem = await screen.findByRole("menuitem", {
      name: "Item Sub",
    });
    const subContent = subMenuItem.closest('[role="menu"]');

    expect(ref.current).toBe(subContent);
    expect(subContent.className).toContain("custom-sub-content");
    expect(subContent.className).toContain("bg-popover");
  });
});
