import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupText,
  InputGroupInput,
  InputGroupTextarea,
} from "./input-group";

describe("InputGroup", () => {
  it("render sebagai <div> dengan role='group' dan data-slot='input-group'", () => {
    render(<InputGroup data-testid="ig" />);
    const el = screen.getByRole("group");
    expect(el.tagName).toBe("DIV");
    expect(el).toHaveAttribute("data-slot", "input-group");
    expect(el).toBe(screen.getByTestId("ig"));
  });

  it("className custom digabung dengan className default (bukan menggantikan)", () => {
    render(<InputGroup data-testid="ig" className="custom-group" />);
    const el = screen.getByTestId("ig");
    expect(el.className).toContain("custom-group");
    expect(el.className).toContain("rounded-md");
    expect(el.className).toContain("border-input");
  });

  it("meneruskan props HTML lain (onClick) ke elemen div", async () => {
    const user = userEvent.setup();
    const handleClick = vi.fn();
    render(<InputGroup data-testid="ig" onClick={handleClick} />);
    await user.click(screen.getByTestId("ig"));
    expect(handleClick).toHaveBeenCalledTimes(1);
  });
});

describe("InputGroupAddon", () => {
  it("default align='inline-start' -> data-align dan className order-first/pl-3", () => {
    render(<InputGroupAddon data-testid="addon">Rp</InputGroupAddon>);
    const el = screen.getByTestId("addon");
    expect(el).toHaveAttribute("role", "group");
    expect(el).toHaveAttribute("data-slot", "input-group-addon");
    expect(el).toHaveAttribute("data-align", "inline-start");
    expect(el.className).toContain("order-first");
    expect(el.className).toContain("pl-3");
  });

  it("align='inline-end' -> data-align dan className order-last/pr-3", () => {
    render(
      <InputGroupAddon align="inline-end" data-testid="addon">
        Rp
      </InputGroupAddon>,
    );
    const el = screen.getByTestId("addon");
    expect(el).toHaveAttribute("data-align", "inline-end");
    expect(el.className).toContain("order-last");
    expect(el.className).toContain("pr-3");
  });

  it("align='block-start' -> data-align dan className w-full/pt-3", () => {
    render(
      <InputGroupAddon align="block-start" data-testid="addon">
        Label
      </InputGroupAddon>,
    );
    const el = screen.getByTestId("addon");
    expect(el).toHaveAttribute("data-align", "block-start");
    expect(el.className).toContain("w-full");
    expect(el.className).toContain("pt-3");
  });

  it("align='block-end' -> data-align dan className w-full/pb-3", () => {
    render(
      <InputGroupAddon align="block-end" data-testid="addon">
        Bantuan
      </InputGroupAddon>,
    );
    const el = screen.getByTestId("addon");
    expect(el).toHaveAttribute("data-align", "block-end");
    expect(el.className).toContain("w-full");
    expect(el.className).toContain("pb-3");
  });

  it("className custom digabung dengan className default (bukan menggantikan)", () => {
    render(
      <InputGroupAddon className="custom-addon" data-testid="addon">
        Rp
      </InputGroupAddon>,
    );
    const el = screen.getByTestId("addon");
    expect(el.className).toContain("custom-addon");
    expect(el.className).toContain("text-muted-foreground");
  });

  it("meneruskan props HTML lain (title) ke elemen div", () => {
    render(
      <InputGroupAddon data-testid="addon" title="Info">
        Rp
      </InputGroupAddon>,
    );
    expect(screen.getByTestId("addon")).toHaveAttribute("title", "Info");
  });

  it("klik pada addon (bukan target <button>) memfokuskan <input> sibling dalam InputGroup yang sama", async () => {
    const user = userEvent.setup();
    render(
      <InputGroup>
        <InputGroupAddon data-testid="addon">
          <InputGroupText>Rp</InputGroupText>
        </InputGroupAddon>
        <InputGroupInput placeholder="Jumlah" />
      </InputGroup>,
    );

    const input = screen.getByPlaceholderText("Jumlah");
    expect(input).not.toHaveFocus();

    await user.click(screen.getByTestId("addon"));
    expect(input).toHaveFocus();
  });

  it("klik pada elemen <button> di dalam addon TIDAK memicu auto-focus ke input (guard e.target.closest('button'))", async () => {
    const user = userEvent.setup();
    render(
      <InputGroup>
        <InputGroupInput placeholder="Cari" />
        <InputGroupAddon align="inline-end" data-testid="addon">
          <InputGroupButton>Go</InputGroupButton>
        </InputGroupAddon>
      </InputGroup>,
    );

    const input = screen.getByPlaceholderText("Cari");
    const button = screen.getByRole("button", { name: "Go" });

    await user.click(button);

    expect(input).not.toHaveFocus();
    expect(button).toHaveFocus();
  });

  // Handler onClick internal (auto-focus input sibling) di-set SEBELUM
  // {...props} pada elemen <div>-nya, sehingga prop `onClick` custom dari
  // caller MENGGANTIKAN TOTAL handler internal itu (bukan berjalan
  // berdampingan) -- lihat bugFindings.
  it("prop onClick custom menggantikan total handler auto-focus internal (bukan menambah) -- lihat bugFindings", async () => {
    const user = userEvent.setup();
    const handleClick = vi.fn();
    render(
      <InputGroup>
        <InputGroupAddon data-testid="addon" onClick={handleClick}>
          <InputGroupText>@</InputGroupText>
        </InputGroupAddon>
        <InputGroupInput placeholder="Username" />
      </InputGroup>,
    );

    await user.click(screen.getByTestId("addon"));

    expect(handleClick).toHaveBeenCalledTimes(1);
    expect(screen.getByPlaceholderText("Username")).not.toHaveFocus();
  });
});

describe("InputGroupButton", () => {
  it("default (tanpa props) render sebagai <button type='button'> dengan data-size='xs' dan variant ghost", () => {
    render(<InputGroupButton>Aksi</InputGroupButton>);
    const btn = screen.getByRole("button", { name: "Aksi" });
    expect(btn).toHaveAttribute("type", "button");
    expect(btn).toHaveAttribute("data-size", "xs");
    expect(btn.className).not.toContain("border-input");
    expect(btn.className).toContain("text-accent-foreground");
    const classes = btn.className.split(/\s+/);
    expect(classes).toContain("h-6");
  });

  it("size='sm' menghasilkan data-size='sm' dan className h-8", () => {
    render(<InputGroupButton size="sm">Aksi</InputGroupButton>);
    const btn = screen.getByRole("button", { name: "Aksi" });
    expect(btn).toHaveAttribute("data-size", "sm");
    const classes = btn.className.split(/\s+/);
    expect(classes).toContain("h-8");
  });

  it("size='icon-xs' menghasilkan data-size='icon-xs' dan className size-6", () => {
    render(<InputGroupButton size="icon-xs">X</InputGroupButton>);
    const btn = screen.getByRole("button", { name: "X" });
    expect(btn).toHaveAttribute("data-size", "icon-xs");
    const classes = btn.className.split(/\s+/);
    expect(classes).toContain("size-6");
  });

  it("size='icon-sm' menghasilkan data-size='icon-sm' dan className size-8", () => {
    render(<InputGroupButton size="icon-sm">X</InputGroupButton>);
    const btn = screen.getByRole("button", { name: "X" });
    expect(btn).toHaveAttribute("data-size", "icon-sm");
    const classes = btn.className.split(/\s+/);
    expect(classes).toContain("size-8");
  });

  it("variant='outline' meneruskan variant custom ke Button (className border-input, bg-background)", () => {
    render(<InputGroupButton variant="outline">Aksi</InputGroupButton>);
    const btn = screen.getByRole("button", { name: "Aksi" });
    expect(btn.className).toContain("border-input");
    expect(btn.className).toContain("bg-background");
  });

  it("type='submit' eksplisit meng-override default type='button'", () => {
    render(<InputGroupButton type="submit">Kirim</InputGroupButton>);
    expect(screen.getByRole("button", { name: "Kirim" })).toHaveAttribute(
      "type",
      "submit",
    );
  });

  it("className custom digabung dengan className default (bukan menggantikan)", () => {
    render(<InputGroupButton className="custom-btn">Aksi</InputGroupButton>);
    const btn = screen.getByRole("button", { name: "Aksi" });
    expect(btn.className).toContain("custom-btn");
    const classes = btn.className.split(/\s+/);
    expect(classes).toContain("h-6");
  });

  it("meneruskan props HTML lain (onClick) dan tetap bisa diklik", async () => {
    const user = userEvent.setup();
    const handleClick = vi.fn();
    render(<InputGroupButton onClick={handleClick}>Aksi</InputGroupButton>);
    await user.click(screen.getByRole("button", { name: "Aksi" }));
    expect(handleClick).toHaveBeenCalledTimes(1);
  });
});

describe("InputGroupText", () => {
  it("render sebagai <span> dengan className default dan menampilkan children", () => {
    render(<InputGroupText data-testid="text">Label</InputGroupText>);
    const el = screen.getByTestId("text");
    expect(el.tagName).toBe("SPAN");
    expect(el).toHaveTextContent("Label");
    expect(el.className).toContain("text-muted-foreground");
    expect(el.className).toContain("flex");
    expect(el.className).toContain("items-center");
  });

  it("className custom digabung dengan className default (bukan menggantikan)", () => {
    render(<InputGroupText className="custom-text">Teks</InputGroupText>);
    const el = screen.getByText("Teks");
    expect(el.className).toContain("custom-text");
    expect(el.className).toContain("text-muted-foreground");
  });

  it("meneruskan props HTML lain (title) ke elemen span", () => {
    render(
      <InputGroupText data-testid="text" title="Info">
        Teks
      </InputGroupText>,
    );
    expect(screen.getByTestId("text")).toHaveAttribute("title", "Info");
  });
});

describe("InputGroupInput", () => {
  it("render sebagai <input> dengan data-slot='input-group-control' (override data-slot='input' bawaan Input)", () => {
    render(<InputGroupInput placeholder="Cari" />);
    const input = screen.getByPlaceholderText("Cari");
    expect(input.tagName).toBe("INPUT");
    expect(input).toHaveAttribute("data-slot", "input-group-control");
  });

  it("className default menggabungkan className wrapper (rounded-none, border-0, bg-transparent) dengan className bawaan Input", () => {
    render(<InputGroupInput placeholder="Cari" />);
    const input = screen.getByPlaceholderText("Cari");
    expect(input.className).toContain("rounded-none");
    expect(input.className).toContain("border-0");
    expect(input.className).toContain("bg-transparent");
    expect(input.className).toContain("flex-1");
  });

  it("className custom digabung dengan className default (bukan menggantikan)", () => {
    render(<InputGroupInput placeholder="Cari" className="custom-input" />);
    const input = screen.getByPlaceholderText("Cari");
    expect(input.className).toContain("custom-input");
    expect(input.className).toContain("rounded-none");
  });

  it("meneruskan props HTML lain (disabled, aria-invalid) ke elemen input", () => {
    render(<InputGroupInput placeholder="Cari" disabled aria-invalid="true" />);
    const input = screen.getByPlaceholderText("Cari");
    expect(input).toBeDisabled();
    expect(input).toHaveAttribute("aria-invalid", "true");
  });

  it("input tidak dikontrol (uncontrolled) saat value/onChange tidak diberikan -- user bisa mengetik langsung", async () => {
    const user = userEvent.setup();
    render(<InputGroupInput placeholder="Cari" />);
    const input = screen.getByPlaceholderText("Cari");
    await user.type(input, "halo");
    expect(input).toHaveValue("halo");
  });

  it("onChange dipanggil saat user mengetik pada mode controlled (value + onChange)", async () => {
    const user = userEvent.setup();
    const handleChange = vi.fn();
    render(
      <InputGroupInput placeholder="Cari" value="" onChange={handleChange} />,
    );
    await user.type(screen.getByPlaceholderText("Cari"), "a");
    expect(handleChange).toHaveBeenCalled();
  });
});

describe("InputGroupTextarea", () => {
  it("render sebagai <textarea> dengan data-slot='input-group-control'", () => {
    render(<InputGroupTextarea placeholder="Catatan" />);
    const textarea = screen.getByPlaceholderText("Catatan");
    expect(textarea.tagName).toBe("TEXTAREA");
    expect(textarea).toHaveAttribute("data-slot", "input-group-control");
  });

  it("className default menggabungkan className wrapper (resize-none, border-0, rounded-none) dengan className bawaan Textarea", () => {
    render(<InputGroupTextarea placeholder="Catatan" />);
    const textarea = screen.getByPlaceholderText("Catatan");
    expect(textarea.className).toContain("resize-none");
    expect(textarea.className).toContain("border-0");
    expect(textarea.className).toContain("rounded-none");
    expect(textarea.className).toContain("flex-1");
  });

  it("className custom digabung dengan className default (bukan menggantikan)", () => {
    render(
      <InputGroupTextarea placeholder="Catatan" className="custom-textarea" />,
    );
    const textarea = screen.getByPlaceholderText("Catatan");
    expect(textarea.className).toContain("custom-textarea");
    expect(textarea.className).toContain("resize-none");
  });

  it("meneruskan props HTML lain (rows, disabled) ke elemen textarea", () => {
    render(<InputGroupTextarea placeholder="Catatan" rows={5} disabled />);
    const textarea = screen.getByPlaceholderText("Catatan");
    expect(textarea).toHaveAttribute("rows", "5");
    expect(textarea).toBeDisabled();
  });

  // Textarea upstream (@/Components/ui/textarea) selalu memasang
  // `value={value ?? ""}` -- artinya <textarea> SELALU controlled dengan
  // fallback string kosong meskipun caller tidak memberi `value`/`onChange`
  // sama sekali. Berbeda dari InputGroupInput (Input upstream memasang
  // `value={value}` mentah -- undefined membuatnya uncontrolled sehingga
  // user bisa mengetik bebas), InputGroupTextarea TANPA value/onChange
  // eksplisit akan selalu ter-reset ke "" setiap render sehingga ketikan
  // user tidak pernah benar-benar tersimpan di value-nya. Didokumentasikan
  // sebagai bugFinding, bukan diperbaiki di sini.
  it("textarea SELALU controlled (value fallback ke '') walau tanpa prop value/onChange -- ketikan user tidak tersimpan (dokumentasi behavior saat ini)", async () => {
    const user = userEvent.setup();
    render(<InputGroupTextarea placeholder="Catatan" />);
    const textarea = screen.getByPlaceholderText("Catatan");
    await user.type(textarea, "halo");
    expect(textarea).toHaveValue("");
  });

  it("onChange dipanggil saat user mengetik pada mode controlled (value + onChange)", async () => {
    const user = userEvent.setup();
    const handleChange = vi.fn();
    render(
      <InputGroupTextarea
        placeholder="Catatan"
        value=""
        onChange={handleChange}
      />,
    );
    await user.type(screen.getByPlaceholderText("Catatan"), "a");
    expect(handleChange).toHaveBeenCalled();
  });
});
