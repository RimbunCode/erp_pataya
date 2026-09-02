import { createRef, useState } from "react";
import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { Input, InputAddon, InputGroup, InputWrapper } from "./input";

describe("Input", () => {
  it("render tanpa crash sebagai elemen <input> dengan data-slot='input'", () => {
    render(<Input placeholder="Nama" />);
    const input = screen.getByRole("textbox");
    expect(input.tagName).toBe("INPUT");
    expect(input).toHaveAttribute("data-slot", "input");
    expect(input).toHaveAttribute("placeholder", "Nama");
  });

  it("variant default (sm) menghasilkan className yang benar", () => {
    render(<Input placeholder="Default" />);
    const input = screen.getByRole("textbox");
    expect(input.className).toContain("h-8");
    expect(input.className).toContain("px-2.5");
    expect(input.className).toContain("text-xs");
  });

  it("variant md menghasilkan className yang sesuai", () => {
    render(<Input variant="md" placeholder="Md" />);
    const input = screen.getByRole("textbox");
    expect(input.className).toContain("h-9");
    expect(input.className).toContain("px-3");
  });

  it("variant lg menghasilkan className yang sesuai", () => {
    render(<Input variant="lg" placeholder="Lg" />);
    const input = screen.getByRole("textbox");
    expect(input.className).toContain("h-10");
    expect(input.className).toContain("px-4");
  });

  it("prop type diteruskan ke atribut type elemen input", () => {
    const { container } = render(
      <Input type="password" value="" onChange={() => {}} />,
    );
    const input = container.querySelector("input");
    expect(input).toHaveAttribute("type", "password");
  });

  it("menggabungkan className custom dengan className default (bukan menggantikan)", () => {
    render(<Input placeholder="Custom" className="custom-class" />);
    const input = screen.getByRole("textbox");
    expect(input.className).toContain("custom-class");
    expect(input.className).toContain("rounded-md");
  });

  it("meneruskan props HTML lain (data-testid, disabled, name) ke elemen input", () => {
    render(
      <Input
        placeholder="Lain"
        data-testid="my-input"
        name="username"
        disabled
      />,
    );
    const input = screen.getByTestId("my-input");
    expect(input).toHaveAttribute("name", "username");
    expect(input).toBeDisabled();
  });

  it("mengetik memicu onChange native dan onValueChange dengan value string", async () => {
    const user = userEvent.setup();
    let changedValue = null;
    let nativeEventValue = null;

    function Controlled() {
      const [value, setValue] = useState("");
      return (
        <Input
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
    const input = screen.getByRole("textbox");
    await user.type(input, "abc");

    expect(input).toHaveValue("abc");
    expect(changedValue).toBe("abc");
    expect(nativeEventValue).toBe("abc");
  });

  it("valueBefore berbeda dari value menambahkan className highlight diff dan atribut title 'before → after'", () => {
    render(<Input value="Baru" valueBefore="Lama" readOnly />);
    const input = screen.getByRole("textbox");
    expect(input.className).toContain("bg-yellow-200");
    expect(input.className).toContain("dark:bg-yellow-900");
    expect(input).toHaveAttribute("title", "Lama → Baru");
  });

  it("valueBefore sama dengan value TIDAK menambahkan className highlight diff maupun atribut title", () => {
    render(<Input value="Sama" valueBefore="Sama" readOnly />);
    const input = screen.getByRole("textbox");
    expect(input.className).not.toContain("bg-yellow-200");
    expect(input).not.toHaveAttribute("title");
  });

  it("tanpa prop valueBefore (undefined), highlight diff tidak pernah dihitung walau value terlihat 'berubah'", () => {
    render(<Input value="apapun" readOnly />);
    const input = screen.getByRole("textbox");
    expect(input.className).not.toContain("bg-yellow-200");
    expect(input).not.toHaveAttribute("title");
  });

  // Catatan (lihat bugFindings): localRef dibuat via useRef tapi TIDAK PERNAH
  // disambungkan ke elemen <input> asli (JSX <input> tidak punya ref={localRef}).
  // Akibatnya localRef.current selalu null, sehingga efek isFocused (yang
  // memanggil localRef.current?.focus()) menjadi no-op. Test ini
  // mendokumentasikan behavior SAAT INI: isFocused tidak benar-benar
  // memfokuskan input.
  it("isFocused=true TIDAK benar-benar memberi fokus ke input saat mount (dokumentasi bug: localRef dangling, tidak pernah di-attach ke elemen)", () => {
    render(<Input value="" onChange={() => {}} isFocused />);
    expect(screen.getByRole("textbox")).not.toHaveFocus();
  });

  it("tanpa isFocused (default false), input TIDAK otomatis fokus saat mount", () => {
    render(<Input value="" onChange={() => {}} />);
    expect(screen.getByRole("textbox")).not.toHaveFocus();
  });

  it("forwardRef TIDAK meneruskan elemen DOM asli -- hanya object custom { focus } via useImperativeHandle (dokumentasi behavior saat ini)", () => {
    const ref = createRef();
    render(<Input ref={ref} value="" onChange={() => {}} />);

    const input = screen.getByRole("textbox");
    // Berbeda dari Button/Card/Textarea yang forwardRef ke elemen DOM asli,
    // ref.current di sini BUKAN node <input> -- melainkan object custom
    // { focus } yang dibuat oleh useImperativeHandle. Properti DOM lain
    // (mis. value, tagName) tidak tersedia lewat ref.
    expect(ref.current).not.toBe(input);
    expect(ref.current.tagName).toBeUndefined();
    expect(typeof ref.current.focus).toBe("function");
  });

  // Catatan (lihat bugFindings): karena localRef dangling (lihat test isFocused
  // di atas), memanggil ref.current.focus() yang diekspos lewat
  // useImperativeHandle juga menjadi no-op -- TIDAK benar-benar memfokuskan
  // elemen <input>. Test ini mendokumentasikan behavior SAAT INI.
  it("ref.current.focus() (diekspos via useImperativeHandle) TIDAK benar-benar memfokuskan input (dokumentasi bug yang sama: localRef dangling)", () => {
    const ref = createRef();
    render(<Input ref={ref} value="" onChange={() => {}} />);
    const input = screen.getByRole("textbox");

    ref.current.focus();

    expect(input).not.toHaveFocus();
  });
});

describe("InputAddon", () => {
  it("render children sebagai <div data-slot='input-addon'> dengan className variant default (sm)", () => {
    render(<InputAddon data-testid="addon">Rp</InputAddon>);
    const addon = screen.getByTestId("addon");
    expect(addon.tagName).toBe("DIV");
    expect(addon).toHaveAttribute("data-slot", "input-addon");
    expect(addon).toHaveTextContent("Rp");
    expect(addon.className).toContain("h-8");
    expect(addon.className).toContain("min-w-7");
  });

  it("variant lg menghasilkan className yang sesuai", () => {
    render(
      <InputAddon data-testid="addon" variant="lg">
        Rp
      </InputAddon>,
    );
    expect(screen.getByTestId("addon").className).toContain("h-10");
  });

  it("mode icon menghasilkan className px-0 justify-center", () => {
    render(
      <InputAddon data-testid="addon" mode="icon">
        *
      </InputAddon>,
    );
    const addon = screen.getByTestId("addon");
    expect(addon.className).toContain("px-0");
    expect(addon.className).toContain("justify-center");
  });

  it("menggabungkan className custom dengan default (bukan menggantikan)", () => {
    render(
      <InputAddon data-testid="addon" className="custom-addon">
        Rp
      </InputAddon>,
    );
    const addon = screen.getByTestId("addon");
    expect(addon.className).toContain("custom-addon");
    expect(addon.className).toContain("border-input");
  });

  it("meneruskan props HTML lain (mis. title) ke elemen div", () => {
    render(
      <InputAddon data-testid="addon" title="keterangan">
        Rp
      </InputAddon>,
    );
    expect(screen.getByTestId("addon")).toHaveAttribute("title", "keterangan");
  });
});

describe("InputGroup", () => {
  it("render children sebagai <div data-slot='input-group'> dengan className default", () => {
    render(<InputGroup data-testid="group">isi</InputGroup>);
    const group = screen.getByTestId("group");
    expect(group.tagName).toBe("DIV");
    expect(group).toHaveAttribute("data-slot", "input-group");
    expect(group.className).toContain("flex");
    expect(group.className).toContain("items-stretch");
  });

  it("menggabungkan className custom dengan default (bukan menggantikan)", () => {
    render(
      <InputGroup data-testid="group" className="custom-group">
        isi
      </InputGroup>,
    );
    const group = screen.getByTestId("group");
    expect(group.className).toContain("custom-group");
    expect(group.className).toContain("flex");
  });

  it("dapat merangkai InputAddon + Input di dalamnya sesuai urutan", () => {
    render(
      <InputGroup data-testid="group">
        <InputAddon data-testid="addon">Rp</InputAddon>
        <Input placeholder="Jumlah" />
      </InputGroup>,
    );
    const group = screen.getByTestId("group");
    const addon = screen.getByTestId("addon");
    const input = screen.getByRole("textbox");
    expect(Array.from(group.children)).toEqual([addon, input]);
  });
});

describe("InputWrapper", () => {
  it("render children sebagai <div data-slot='input-wrapper'> dengan className gabungan inputVariants + inputWrapperVariants", () => {
    render(<InputWrapper data-testid="wrapper">isi</InputWrapper>);
    const wrapper = screen.getByTestId("wrapper");
    expect(wrapper.tagName).toBe("DIV");
    expect(wrapper).toHaveAttribute("data-slot", "input-wrapper");
    // dari inputVariants (variant sm default)
    expect(wrapper.className).toContain("h-8");
    // dari inputWrapperVariants
    expect(wrapper.className).toContain("gap-1.25");
  });

  it("variant lg menghasilkan className dari kedua sumber variants (inputVariants + inputWrapperVariants)", () => {
    render(
      <InputWrapper data-testid="wrapper" variant="lg">
        isi
      </InputWrapper>,
    );
    const wrapper = screen.getByTestId("wrapper");
    expect(wrapper.className).toContain("h-10");
    expect(wrapper.className).toContain("gap-1.5");
  });

  it("menggabungkan className custom dengan default (bukan menggantikan)", () => {
    render(
      <InputWrapper data-testid="wrapper" className="custom-wrapper">
        isi
      </InputWrapper>,
    );
    const wrapper = screen.getByTestId("wrapper");
    expect(wrapper.className).toContain("custom-wrapper");
    expect(wrapper.className).toContain("border-input");
  });
});
