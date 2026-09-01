import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createRef } from "react";

import {
  Command,
  CommandDialog,
  CommandInput,
  CommandList,
  CommandEmpty,
  CommandGroup,
  CommandItem,
  CommandShortcut,
  CommandSeparator,
} from "./command";

// Semua primitive cmdk (CommandInput/List/Item/Group/Separator/Empty) butuh
// context yang disediakan oleh <Command> (root) -- render langsung tanpa
// ancestor ini melempar TypeError (context undefined). Helper ini meniru pola
// pemakaian nyata di Select.jsx / MultiSelect.jsx / NestedSelect.jsx.
function renderInCommand(children) {
  return render(<Command>{children}</Command>);
}

describe("Command", () => {
  it("render dengan className default (flex, rounded-md, bg-popover) dan meneruskan className custom", () => {
    render(<Command data-testid="cmd" className="custom-command" />);
    const el = screen.getByTestId("cmd");

    expect(el.className).toContain("flex");
    expect(el.className).toContain("rounded-md");
    expect(el.className).toContain("bg-popover");
    expect(el.className).toContain("custom-command");
  });

  it("meneruskan ref ke elemen DOM asli", () => {
    const ref = createRef();
    render(<Command ref={ref} data-testid="cmd" />);

    expect(ref.current).toBeInstanceOf(HTMLDivElement);
    expect(ref.current).toBe(screen.getByTestId("cmd"));
  });

  it("meneruskan props lain (mis. aria-label) ke elemen root", () => {
    render(<Command aria-label="Command palette" data-testid="cmd" />);
    expect(screen.getByTestId("cmd")).toHaveAttribute(
      "aria-label",
      "Command palette",
    );
  });
});

describe("CommandInput", () => {
  it("default: render icon Search dan wrapper punya class border-b", () => {
    renderInCommand(<CommandInput />);
    const input = screen.getByRole("combobox");
    const wrapper = input.parentElement;

    expect(wrapper.className).toContain("border-b");
    expect(wrapper.querySelector("svg")).toBeInTheDocument();
  });

  it("withoutBorder=true menghilangkan class border-b dari wrapper", () => {
    renderInCommand(<CommandInput withoutBorder />);
    const wrapper = screen.getByRole("combobox").parentElement;

    expect(wrapper.className).not.toContain("border-b");
  });

  it("showIcon=false tidak merender icon Search", () => {
    renderInCommand(<CommandInput showIcon={false} />);
    const wrapper = screen.getByRole("combobox").parentElement;

    expect(wrapper.querySelector("svg")).not.toBeInTheDocument();
  });

  it("wrapper punya atribut custom cmdk-input-wrapper", () => {
    renderInCommand(<CommandInput />);
    const wrapper = screen.getByRole("combobox").parentElement;

    expect(wrapper.getAttribute("cmdk-input-wrapper")).toBe("");
  });

  it("meneruskan ref ke elemen input asli", () => {
    const ref = createRef();
    renderInCommand(<CommandInput ref={ref} />);

    expect(ref.current).toBeInstanceOf(HTMLInputElement);
    expect(ref.current).toBe(screen.getByRole("combobox"));
  });

  it("meneruskan className custom ke elemen input tanpa menghapus default", () => {
    renderInCommand(<CommandInput className="custom-input-class" />);
    const input = screen.getByRole("combobox");

    expect(input.className).toContain("custom-input-class");
    expect(input.className).toContain("bg-background");
  });

  it("meneruskan props lain (mis. disabled, placeholder) ke elemen input", () => {
    renderInCommand(<CommandInput disabled placeholder="Cari..." />);
    const input = screen.getByPlaceholderText("Cari...");

    expect(input).toBeDisabled();
  });

  it("mengetik memicu onValueChange dengan nilai yang diketik", async () => {
    const user = userEvent.setup({ delay: null });
    const onValueChange = vi.fn();
    renderInCommand(
      <CommandInput onValueChange={onValueChange} placeholder="Cari..." />,
    );

    await user.type(screen.getByPlaceholderText("Cari..."), "abc");

    expect(onValueChange).toHaveBeenCalledWith("a");
    expect(onValueChange).toHaveBeenCalledWith("ab");
    expect(onValueChange).toHaveBeenCalledWith("abc");
  });
});

describe("CommandList", () => {
  it("render dengan role listbox, className default overflow, dan className custom digabung", () => {
    renderInCommand(<CommandList data-testid="list" className="custom-list" />);
    const list = screen.getByRole("listbox");

    expect(list.className).toContain("max-h-[300px]");
    expect(list.className).toContain("overflow-y-auto");
    expect(list.className).toContain("custom-list");
  });

  it("meneruskan ref ke elemen DOM asli", () => {
    const ref = createRef();
    renderInCommand(<CommandList ref={ref} />);

    expect(ref.current).toBe(screen.getByRole("listbox"));
  });
});

describe("CommandEmpty", () => {
  it("dirender dengan className default saat tidak ada CommandItem terdaftar (state kosong)", () => {
    renderInCommand(
      <CommandList>
        <CommandEmpty data-testid="empty">Tidak ada hasil</CommandEmpty>
      </CommandList>,
    );
    const empty = screen.getByTestId("empty");

    expect(empty).toHaveTextContent("Tidak ada hasil");
    expect(empty.className).toBe("py-6 text-sm text-center");
  });

  it("tidak dirender saat ada CommandItem terdaftar (state tidak kosong)", () => {
    renderInCommand(
      <CommandList>
        <CommandEmpty data-testid="empty">Tidak ada hasil</CommandEmpty>
        <CommandItem>Item satu</CommandItem>
      </CommandList>,
    );

    expect(screen.queryByTestId("empty")).not.toBeInTheDocument();
  });

  it("meneruskan ref ke elemen DOM asli", () => {
    const ref = createRef();
    renderInCommand(
      <CommandList>
        <CommandEmpty ref={ref} data-testid="empty">
          Kosong
        </CommandEmpty>
      </CommandList>,
    );

    expect(ref.current).toBe(screen.getByTestId("empty"));
  });

  // BUG/QUIRK (didokumentasikan, BUKAN diperbaiki -- lihat bugFindings):
  // Berbeda dari semua komponen Command* lain di file ini yang menggabung
  // className via cn(default, className), CommandEmpty menaruh className
  // default LEBIH DULU lalu men-spread {...props} SETELAHNYA. Karena atribut
  // JSX belakangan menang, className custom MENGGANTI TOTAL default -- bukan
  // digabung. Test ini meng-assert perilaku SAAT INI apa adanya.
  it("BUG/QUIRK: className custom mengganti total className default, bukan digabung", () => {
    renderInCommand(
      <CommandList>
        <CommandEmpty data-testid="empty" className="custom-empty">
          Kosong
        </CommandEmpty>
      </CommandList>,
    );
    const empty = screen.getByTestId("empty");

    expect(empty.className).toBe("custom-empty");
    expect(empty.className).not.toContain("py-6");
  });
});

describe("CommandGroup", () => {
  it("render dengan className default dan className custom digabung", () => {
    renderInCommand(
      <CommandGroup data-testid="group" className="custom-group">
        <CommandItem>Item</CommandItem>
      </CommandGroup>,
    );
    const group = screen.getByTestId("group");

    expect(group.className).toContain("overflow-hidden");
    expect(group.className).toContain("text-foreground");
    expect(group.className).toContain("custom-group");
  });

  it("heading diteruskan dan dirender di dalam group", () => {
    renderInCommand(
      <CommandGroup heading="Judul Grup">
        <CommandItem>Item</CommandItem>
      </CommandGroup>,
    );

    expect(screen.getByText("Judul Grup")).toBeInTheDocument();
  });

  it("meneruskan ref ke elemen DOM asli", () => {
    const ref = createRef();
    renderInCommand(
      <CommandGroup ref={ref} data-testid="group">
        <CommandItem>Item</CommandItem>
      </CommandGroup>,
    );

    expect(ref.current).toBe(screen.getByTestId("group"));
  });
});

describe("CommandSeparator", () => {
  it("render dengan role separator, className default, dan className custom digabung", () => {
    renderInCommand(<CommandSeparator className="custom-sep" />);
    const sep = screen.getByRole("separator");

    expect(sep.className).toContain("-mx-1");
    expect(sep.className).toContain("bg-border");
    expect(sep.className).toContain("custom-sep");
  });

  it("meneruskan ref ke elemen DOM asli", () => {
    const ref = createRef();
    renderInCommand(<CommandSeparator ref={ref} />);

    expect(ref.current).toBe(screen.getByRole("separator"));
  });
});

describe("CommandItem", () => {
  it("render dengan role option, className default, dan className custom digabung", () => {
    renderInCommand(
      <CommandItem className="custom-item">Item Satu</CommandItem>,
    );
    const item = screen.getByRole("option", { name: "Item Satu" });

    expect(item.className).toContain("relative");
    expect(item.className).toContain("cursor-default");
    expect(item.className).toContain("custom-item");
  });

  it("meneruskan ref ke elemen DOM asli", () => {
    const ref = createRef();
    renderInCommand(<CommandItem ref={ref}>Item</CommandItem>);

    expect(ref.current).toBe(screen.getByRole("option", { name: "Item" }));
  });

  it("klik item memanggil onSelect dengan value item", async () => {
    const user = userEvent.setup({ delay: null });
    const onSelect = vi.fn();
    renderInCommand(
      <CommandItem value="alpha" onSelect={onSelect}>
        Alpha
      </CommandItem>,
    );

    await user.click(screen.getByRole("option", { name: "Alpha" }));

    expect(onSelect).toHaveBeenCalledWith("alpha");
  });
});

describe("CommandShortcut", () => {
  it("render dengan className default dan className custom digabung", () => {
    render(
      <CommandShortcut data-testid="shortcut" className="custom-shortcut">
        Ctrl+K
      </CommandShortcut>,
    );
    const el = screen.getByTestId("shortcut");

    expect(el).toHaveTextContent("Ctrl+K");
    expect(el.className).toContain("ml-auto");
    expect(el.className).toContain("text-xs");
    expect(el.className).toContain("custom-shortcut");
  });
});

describe("CommandDialog", () => {
  it("children tidak ada di DOM saat open=false, muncul setelah open=true", () => {
    const { rerender } = render(
      <CommandDialog open={false}>
        <CommandList>
          <CommandItem>Item Dialog</CommandItem>
        </CommandList>
      </CommandDialog>,
    );

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();

    rerender(
      <CommandDialog open>
        <CommandList>
          <CommandItem>Item Dialog</CommandItem>
        </CommandList>
      </CommandDialog>,
    );

    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(
      screen.getByRole("option", { name: "Item Dialog" }),
    ).toBeInTheDocument();
  });

  it("Command internal mendapat className gabungan selector cmdk default + commandProps.className custom", () => {
    render(
      <CommandDialog
        open
        commandProps={{
          className: "custom-cmd-dialog",
          "data-testid": "inner-command",
        }}
      >
        <CommandList>
          <CommandItem>Item</CommandItem>
        </CommandList>
      </CommandDialog>,
    );
    const inner = screen.getByTestId("inner-command");

    expect(inner.className).toContain("[&_[cmdk-group-heading]]:px-2");
    expect(inner.className).toContain("custom-cmd-dialog");
  });

  it("meneruskan restCommandProps (selain className) ke Command internal, mis. id custom", () => {
    render(
      <CommandDialog
        open
        commandProps={{
          id: "custom-command-id",
          "data-testid": "inner-command",
        }}
      >
        <CommandList>
          <CommandItem>Item</CommandItem>
        </CommandList>
      </CommandDialog>,
    );
    const inner = screen.getByTestId("inner-command");

    expect(inner.id).toBe("custom-command-id");
  });

  it("props lain (mis. onOpenChange) tetap diteruskan ke Dialog root", async () => {
    const user = userEvent.setup({ delay: null });
    const onOpenChange = vi.fn();
    render(
      <CommandDialog open onOpenChange={onOpenChange}>
        <CommandList>
          <CommandItem>Item Dialog</CommandItem>
        </CommandList>
      </CommandDialog>,
    );

    await user.keyboard("{Escape}");

    expect(onOpenChange).toHaveBeenCalledWith(false);
  });
});
