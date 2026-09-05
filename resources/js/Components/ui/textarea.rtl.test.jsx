import { createRef, useState } from "react";
import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { Textarea } from "./textarea";
import { TooltipProvider } from "./tooltip";

const renderWithTooltip = (ui) =>
  render(<TooltipProvider delayDuration={0}>{ui}</TooltipProvider>);

describe("Textarea", () => {
  it("render tanpa crash sebagai elemen <textarea> asli", () => {
    render(<Textarea placeholder="Catatan" />);
    const textarea = screen.getByPlaceholderText("Catatan");
    expect(textarea).toBeInTheDocument();
    expect(textarea.tagName).toBe("TEXTAREA");
  });

  it("value tidak diberikan (undefined) dirender sebagai string kosong (value ?? '')", () => {
    render(<Textarea />);
    expect(screen.getByRole("textbox")).toHaveValue("");
  });

  it("tanpa prop valueBefore, textarea dirender langsung TANPA dibungkus Tooltip apapun", () => {
    const { container } = render(<Textarea value="isi" readOnly />);
    // Elemen root langsung <textarea> itu sendiri, bukan wrapper Tooltip/span lain.
    expect(container.firstChild).toBe(screen.getByRole("textbox"));
    expect(container.firstChild.tagName).toBe("TEXTAREA");
  });

  it("forwardRef meneruskan ref ke elemen <textarea> asli", () => {
    const ref = createRef();
    render(<Textarea ref={ref} />);
    expect(ref.current).toBe(screen.getByRole("textbox"));
    expect(ref.current.tagName).toBe("TEXTAREA");
  });

  it("menggabungkan className custom dengan className default (bukan menggantikan)", () => {
    render(<Textarea className="custom-class" />);
    const textarea = screen.getByRole("textbox");
    expect(textarea.className).toContain("custom-class");
    expect(textarea.className).toContain("rounded-md");
    expect(textarea.className).toContain("border-input");
  });

  it("rows=1 menghasilkan className min-h-8", () => {
    render(<Textarea rows={1} />);
    expect(screen.getByRole("textbox").className.split(/\s+/)).toContain(
      "min-h-8",
    );
  });

  it("rows=2 menghasilkan className min-h-[80px] (menang lewat twMerge atas min-h-16 karena didefinisikan belakangan)", () => {
    render(<Textarea rows={2} />);
    const classes = screen.getByRole("textbox").className.split(/\s+/);
    expect(classes).toContain("min-h-[80px]");
    expect(classes).not.toContain("min-h-16");
  });

  it("rows=5 (>2) menghasilkan className min-h-[80px] saja, tanpa min-h-8/min-h-16", () => {
    render(<Textarea rows={5} />);
    const classes = screen.getByRole("textbox").className.split(/\s+/);
    expect(classes).toContain("min-h-[80px]");
    expect(classes).not.toContain("min-h-8");
    expect(classes).not.toContain("min-h-16");
  });

  it("tanpa prop rows, tidak ada className min-h-* tambahan yang disisipkan", () => {
    render(<Textarea />);
    const classes = screen.getByRole("textbox").className.split(/\s+/);
    expect(classes.some((c) => c.startsWith("min-h-"))).toBe(false);
  });

  it("prop rows diteruskan sebagai atribut rows ke elemen <textarea>", () => {
    render(<Textarea rows={4} />);
    expect(screen.getByRole("textbox")).toHaveAttribute("rows", "4");
  });

  it("mengetik memicu onChange native dan onValueChange dengan value string yang sama", async () => {
    const user = userEvent.setup();
    let changedValue = null;
    let nativeEventValue = null;

    function Controlled() {
      const [value, setValue] = useState("");
      return (
        <Textarea
          value={value}
          onValueChange={(v) => {
            changedValue = v;
            setValue(v);
          }}
          onChange={(e) => {
            nativeEventValue = e.target.value;
          }}
        />
      );
    }

    render(<Controlled />);
    const textarea = screen.getByRole("textbox");
    await user.type(textarea, "abc");

    expect(textarea).toHaveValue("abc");
    expect(changedValue).toBe("abc");
    expect(nativeEventValue).toBe("abc");
  });

  it("onValueChange opsional -- tanpa prop itu, onChange native tetap terpanggil tanpa error", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();

    function Controlled() {
      const [value, setValue] = useState("");
      return (
        <Textarea
          value={value}
          onChange={(e) => {
            onChange(e.target.value);
            setValue(e.target.value);
          }}
        />
      );
    }

    render(<Controlled />);
    await user.type(screen.getByRole("textbox"), "x");

    expect(onChange).toHaveBeenCalledWith("x");
  });

  it("meneruskan props HTML lain (data-testid, name, maxLength) ke elemen textarea", () => {
    render(
      <Textarea data-testid="my-textarea" name="catatan" maxLength={100} />,
    );
    const textarea = screen.getByTestId("my-textarea");
    expect(textarea).toHaveAttribute("name", "catatan");
    expect(textarea).toHaveAttribute("maxlength", "100");
  });

  it("disabled=true menonaktifkan textarea (atribut disabled) dan menyertakan className disabled:opacity-50", () => {
    render(<Textarea disabled />);
    const textarea = screen.getByRole("textbox");
    expect(textarea).toBeDisabled();
    expect(textarea.className).toContain("disabled:opacity-50");
  });

  it("readOnly=true diteruskan sebagai atribut readonly native ke elemen textarea", () => {
    render(<Textarea value="terkunci" readOnly />);
    expect(screen.getByRole("textbox")).toHaveAttribute("readonly");
  });
});

describe("Textarea -- valueBefore & diff highlight (dibungkus Tooltip)", () => {
  it("valueBefore diberikan (walau sama dengan value) -- textarea tetap dibungkus TooltipTrigger asChild, elemen textarea sendiri tidak berubah tag", () => {
    renderWithTooltip(<Textarea value="sama" valueBefore="sama" readOnly />);
    const textarea = screen.getByRole("textbox");
    expect(textarea.tagName).toBe("TEXTAREA");
  });

  it("valueBefore berbeda dari value -- className textarea mendapat highlight diff (bg-yellow-200 dark:bg-yellow-900)", () => {
    renderWithTooltip(<Textarea value="2222" valueBefore="1111" readOnly />);
    const textarea = screen.getByRole("textbox");
    expect(textarea.className).toContain("bg-yellow-200");
    expect(textarea.className).toContain("dark:bg-yellow-900");
  });

  it("valueBefore sama dengan value -- className highlight diff TIDAK ditambahkan", () => {
    renderWithTooltip(<Textarea value="sama" valueBefore="sama" readOnly />);
    const textarea = screen.getByRole("textbox");
    expect(textarea.className).not.toContain("bg-yellow-200");
  });

  it("tanpa prop valueBefore (undefined), highlight diff tidak pernah dihitung walau value terlihat 'berubah'", () => {
    render(<Textarea value="apapun" readOnly />);
    const textarea = screen.getByRole("textbox");
    expect(textarea.className).not.toContain("bg-yellow-200");
  });

  it("forwardRef tetap tersambung ke elemen <textarea> asli walau dibungkus Tooltip (valueBefore diberikan)", () => {
    const ref = createRef();
    renderWithTooltip(
      <Textarea ref={ref} value="2222" valueBefore="1111" readOnly />,
    );
    expect(ref.current).toBe(screen.getByRole("textbox"));
    expect(ref.current.tagName).toBe("TEXTAREA");
  });

  it("hover pada textarea saat valueBefore berbeda memunculkan Tooltip berisi StrikethroughDiff (teks lama dicoret merah, teks baru hijau)", async () => {
    const user = userEvent.setup();
    renderWithTooltip(<Textarea value="2222" valueBefore="1111" readOnly />);
    const textarea = screen.getByRole("textbox");

    await user.hover(textarea);

    const tooltip = await screen.findByRole("tooltip");
    const removed = tooltip.querySelector(".line-through.text-red-500");
    const added = tooltip.querySelector(".text-green-500.font-bold");

    expect(removed).toHaveTextContent("1111");
    expect(added).toHaveTextContent("2222");
  });

  it("hover pada textarea saat valueBefore sama dengan value TIDAK memunculkan Tooltip apapun (TooltipContent tidak dirender sama sekali)", async () => {
    const user = userEvent.setup();
    renderWithTooltip(<Textarea value="sama" valueBefore="sama" readOnly />);
    const textarea = screen.getByRole("textbox");

    await user.hover(textarea);

    expect(screen.queryByRole("tooltip")).not.toBeInTheDocument();
  });
});
