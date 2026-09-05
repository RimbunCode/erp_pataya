import { createRef } from "react";
import { describe, expect, it, vi } from "vitest";
import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
} from "./select";

function renderSelect(rootProps = {}, { withGroup = false } = {}) {
  return render(
    <Select {...rootProps}>
      <SelectTrigger>
        <SelectValue placeholder="Pilih opsi" />
      </SelectTrigger>
      <SelectContent>
        {withGroup ? (
          <SelectGroup>
            <SelectLabel>Grup</SelectLabel>
            <SelectItem value="a">Opsi A</SelectItem>
            <SelectItem value="b">Opsi B</SelectItem>
          </SelectGroup>
        ) : (
          <>
            <SelectItem value="a">Opsi A</SelectItem>
            <SelectItem value="b">Opsi B</SelectItem>
          </>
        )}
      </SelectContent>
    </Select>,
  );
}

describe("Select (root wrapper)", () => {
  it("render trigger tanpa crash dengan placeholder, listbox belum ada di DOM sebelum dibuka", () => {
    renderSelect();
    expect(screen.getByRole("combobox")).toBeInTheDocument();
    expect(screen.getByText("Pilih opsi")).toBeInTheDocument();
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
  });

  it("klik trigger membuka listbox berisi semua item", async () => {
    const user = userEvent.setup();
    renderSelect();

    await user.click(screen.getByRole("combobox"));

    expect(screen.getByRole("listbox")).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "Opsi A" })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "Opsi B" })).toBeInTheDocument();
  });

  it("memilih item menutup listbox, memicu onValueChange dengan value yang dipilih, dan menampilkan label terpilih di trigger", async () => {
    const user = userEvent.setup();
    const handleValueChange = vi.fn();
    renderSelect({ onValueChange: handleValueChange });

    await user.click(screen.getByRole("combobox"));
    await user.click(screen.getByRole("option", { name: "Opsi B" }));

    expect(handleValueChange).toHaveBeenCalledTimes(1);
    expect(handleValueChange).toHaveBeenCalledWith("b");
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
    expect(screen.getByRole("combobox")).toHaveTextContent("Opsi B");
  });

  it("meneruskan onOpenChange milik consumer -- dipanggil true saat listbox dibuka dan false saat ditutup", async () => {
    const user = userEvent.setup();
    const handleOpenChange = vi.fn();
    renderSelect({ onOpenChange: handleOpenChange });

    await user.click(screen.getByRole("combobox"));
    expect(handleOpenChange).toHaveBeenLastCalledWith(true);

    await user.click(screen.getByRole("option", { name: "Opsi A" }));
    expect(handleOpenChange).toHaveBeenLastCalledWith(false);
  });

  it("saat listbox ditutup, fokus tidak tertinggal pada elemen aria-hidden -- kembali ke trigger", async () => {
    // Fokuskan elemen aria-hidden SEBELUM listbox dibuka -- Radix FocusScope
    // aktif menjaga fokus tetap di dalam listbox selama terbuka, jadi
    // mencuri fokus manual ke elemen di luar SAAT terbuka akan langsung
    // ditarik kembali oleh Radix sendiri (bukan skenario realistis).
    const user = userEvent.setup();
    render(
      <>
        <button aria-hidden="true" tabIndex={-1} data-testid="hidden-el">
          Elemen Tersembunyi
        </button>
        <Select>
          <SelectTrigger>
            <SelectValue placeholder="Pilih opsi" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="a">Opsi A</SelectItem>
          </SelectContent>
        </Select>
      </>,
    );

    const hidden = screen.getByTestId("hidden-el");
    act(() => {
      hidden.focus();
    });
    expect(hidden).toHaveFocus();

    await user.click(screen.getByRole("combobox"));
    expect(screen.getByRole("listbox")).toBeInTheDocument();

    await user.click(screen.getByRole("option", { name: "Opsi A" }));

    await waitFor(() => {
      expect(hidden).not.toHaveFocus();
    });
    expect(screen.getByRole("combobox")).toHaveFocus();
  });

  it("forwardRef ke SelectPrimitive.Root: ref.current tetap null karena Root Radix (function component biasa) tidak menerima ref", () => {
    const ref = createRef();
    renderSelect({ ref });

    expect(ref.current).toBeNull();
  });
});

describe("SelectTrigger", () => {
  it("render sebagai elemen dengan role combobox dan className default (h-8, border-input, bg-muted)", () => {
    renderSelect();
    const trigger = screen.getByRole("combobox");

    expect(trigger.className).toContain("h-8");
    expect(trigger.className).toContain("border-input");
    expect(trigger.className).toContain("bg-muted");
  });

  it("className custom digabung dengan className default, bukan menggantikan", () => {
    render(
      <Select>
        <SelectTrigger className="custom-trigger-class">
          <SelectValue placeholder="Pilih" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="a">Opsi A</SelectItem>
        </SelectContent>
      </Select>,
    );
    const trigger = screen.getByRole("combobox");

    expect(trigger.className).toContain("custom-trigger-class");
    expect(trigger.className).toContain("h-8");
  });

  it("forwardRef meneruskan ref ke elemen <button> asli", () => {
    const ref = createRef();
    render(
      <Select>
        <SelectTrigger ref={ref}>
          <SelectValue placeholder="Pilih" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="a">Opsi A</SelectItem>
        </SelectContent>
      </Select>,
    );

    expect(ref.current).toBe(screen.getByRole("combobox"));
  });

  it("icon ChevronDown selalu dirender di dalam trigger", () => {
    renderSelect();
    expect(
      screen.getByRole("combobox").querySelector("svg"),
    ).toBeInTheDocument();
  });

  it("required tanpa prop value: atribut required TIDAK di-set pada trigger (safeRequired undefined)", () => {
    render(
      <Select>
        <SelectTrigger required>
          <SelectValue placeholder="Pilih" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="a">Opsi A</SelectItem>
        </SelectContent>
      </Select>,
    );

    expect(screen.getByRole("combobox")).not.toHaveAttribute("required");
  });

  it("required DENGAN prop value truthy: atribut required di-set pada trigger", () => {
    render(
      <Select>
        <SelectTrigger required value="a">
          <SelectValue placeholder="Pilih" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="a">Opsi A</SelectItem>
        </SelectContent>
      </Select>,
    );

    expect(screen.getByRole("combobox")).toHaveAttribute("required");
  });

  it("tanpa prop required sama sekali: atribut required tidak ada meski prop value truthy", () => {
    render(
      <Select>
        <SelectTrigger value="a">
          <SelectValue placeholder="Pilih" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="a">Opsi A</SelectItem>
        </SelectContent>
      </Select>,
    );

    expect(screen.getByRole("combobox")).not.toHaveAttribute("required");
  });
});

describe("SelectContent", () => {
  it("dirender lewat portal ke document.body, bukan sebagai child langsung container render", async () => {
    const user = userEvent.setup();
    const { container } = renderSelect();

    await user.click(screen.getByRole("combobox"));
    const listbox = screen.getByRole("listbox");

    expect(container.contains(listbox)).toBe(false);
    expect(document.body.contains(listbox)).toBe(true);
  });

  it("forwardRef meneruskan ref ke elemen Radix Content asli", async () => {
    const user = userEvent.setup();
    const ref = createRef();
    render(
      <Select>
        <SelectTrigger>
          <SelectValue placeholder="Pilih" />
        </SelectTrigger>
        <SelectContent ref={ref}>
          <SelectItem value="a">Opsi A</SelectItem>
        </SelectContent>
      </Select>,
    );

    await user.click(screen.getByRole("combobox"));

    expect(ref.current).toBe(screen.getByRole("listbox"));
  });

  it("className custom digabung dengan className default (mis. z-50, bg-popover)", async () => {
    const user = userEvent.setup();
    render(
      <Select>
        <SelectTrigger>
          <SelectValue placeholder="Pilih" />
        </SelectTrigger>
        <SelectContent className="custom-content-class">
          <SelectItem value="a">Opsi A</SelectItem>
        </SelectContent>
      </Select>,
    );

    await user.click(screen.getByRole("combobox"));
    const listbox = screen.getByRole("listbox");

    expect(listbox.className).toContain("custom-content-class");
    expect(listbox.className).toContain("z-50");
    expect(listbox.className).toContain("bg-popover");
  });

  it("position default 'popper': class translate popper-specific ikut ditambahkan", async () => {
    const user = userEvent.setup();
    renderSelect();

    await user.click(screen.getByRole("combobox"));
    const listbox = screen.getByRole("listbox");

    expect(listbox.className).toContain("data-[side=bottom]:translate-y-1");
  });

  it("position='item-aligned': class translate popper-specific TIDAK ditambahkan", async () => {
    const user = userEvent.setup();
    render(
      <Select>
        <SelectTrigger>
          <SelectValue placeholder="Pilih" />
        </SelectTrigger>
        <SelectContent position="item-aligned">
          <SelectItem value="a">Opsi A</SelectItem>
        </SelectContent>
      </Select>,
    );

    await user.click(screen.getByRole("combobox"));
    const listbox = screen.getByRole("listbox");

    expect(listbox.className).not.toContain("data-[side=bottom]:translate-y-1");
  });
});

describe("SelectItem", () => {
  it("item dengan value yang cocok dengan value Select menampilkan icon Check (ItemIndicator)", async () => {
    const user = userEvent.setup();
    renderSelect({ value: "a" });

    await user.click(screen.getByRole("combobox"));
    const itemA = screen.getByRole("option", { name: "Opsi A" });
    const itemB = screen.getByRole("option", { name: "Opsi B" });

    expect(itemA).toHaveAttribute("aria-selected", "true");
    expect(itemA.querySelector("svg")).toBeInTheDocument();
    expect(itemB).toHaveAttribute("aria-selected", "false");
    expect(itemB.querySelector("svg")).not.toBeInTheDocument();
  });

  it("item yang tidak cocok dengan value Select TIDAK menampilkan icon Check", async () => {
    const user = userEvent.setup();
    renderSelect();

    await user.click(screen.getByRole("combobox"));
    const itemA = screen.getByRole("option", { name: "Opsi A" });

    expect(itemA.querySelector("svg")).not.toBeInTheDocument();
  });

  it("forwardRef meneruskan ref ke elemen DOM asli dan className custom digabung dengan default", async () => {
    const user = userEvent.setup();
    const ref = createRef();
    render(
      <Select>
        <SelectTrigger>
          <SelectValue placeholder="Pilih" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem ref={ref} value="a" className="custom-item-class">
            Opsi A
          </SelectItem>
        </SelectContent>
      </Select>,
    );

    await user.click(screen.getByRole("combobox"));
    const item = screen.getByRole("option");

    expect(ref.current).toBe(item);
    expect(item.className).toContain("custom-item-class");
    expect(item.className).toContain("pl-8");
  });

  it("disabled=true mencegah item dipilih (onValueChange tidak terpanggil)", async () => {
    const user = userEvent.setup();
    const handleValueChange = vi.fn();
    render(
      <Select onValueChange={handleValueChange}>
        <SelectTrigger>
          <SelectValue placeholder="Pilih" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="a" disabled>
            Opsi A
          </SelectItem>
        </SelectContent>
      </Select>,
    );

    await user.click(screen.getByRole("combobox"));
    const item = screen.getByRole("option", { name: "Opsi A" });
    expect(item).toHaveAttribute("data-disabled");

    await user.click(item);

    expect(handleValueChange).not.toHaveBeenCalled();
  });
});

describe("SelectGroup + SelectLabel", () => {
  it("SelectLabel tampil di dalam listbox dan mengelompokkan item dengan className default (pl-8, font-semibold)", async () => {
    const user = userEvent.setup();
    renderSelect({}, { withGroup: true });

    await user.click(screen.getByRole("combobox"));
    const label = screen.getByText("Grup");

    expect(label.className).toContain("pl-8");
    expect(label.className).toContain("font-semibold");
    expect(screen.getByRole("option", { name: "Opsi A" })).toBeInTheDocument();
  });

  it("SelectLabel forwardRef dan className custom digabung dengan default", async () => {
    const user = userEvent.setup();
    const ref = createRef();
    render(
      <Select>
        <SelectTrigger>
          <SelectValue placeholder="Pilih" />
        </SelectTrigger>
        <SelectContent>
          <SelectGroup>
            <SelectLabel ref={ref} className="custom-label-class">
              Label Grup
            </SelectLabel>
            <SelectItem value="a">Opsi A</SelectItem>
          </SelectGroup>
        </SelectContent>
      </Select>,
    );

    await user.click(screen.getByRole("combobox"));
    const label = screen.getByText("Label Grup");

    expect(ref.current).toBe(label);
    expect(label.className).toContain("custom-label-class");
  });
});

describe("SelectSeparator", () => {
  it("render dengan className default (h-px, bg-muted), meneruskan ref dan className custom", async () => {
    const user = userEvent.setup();
    const ref = createRef();
    render(
      <Select>
        <SelectTrigger>
          <SelectValue placeholder="Pilih" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="a">Opsi A</SelectItem>
          <SelectSeparator ref={ref} className="custom-separator-class" />
        </SelectContent>
      </Select>,
    );

    await user.click(screen.getByRole("combobox"));
    const separator = ref.current;

    expect(separator).toBeInTheDocument();
    expect(separator.className).toContain("h-px");
    expect(separator.className).toContain("bg-muted");
    expect(separator.className).toContain("custom-separator-class");
  });
});
