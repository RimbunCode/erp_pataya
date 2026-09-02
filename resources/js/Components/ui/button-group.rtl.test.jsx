import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import {
  ButtonGroup,
  ButtonGroupSeparator,
  ButtonGroupText,
} from "./button-group";

describe("ButtonGroup", () => {
  it("render sebagai <div> dengan role='group' dan data-slot='button-group'", () => {
    render(<ButtonGroup data-testid="bg" />);
    const el = screen.getByRole("group");
    expect(el.tagName).toBe("DIV");
    expect(el).toHaveAttribute("data-slot", "button-group");
    expect(el).toBe(screen.getByTestId("bg"));
  });

  // Prop `orientation` didestructure tanpa default value di komponen (beda
  // dengan `defaultVariants: { orientation: "horizontal" }` milik cva-nya).
  // Saat prop tidak diberikan, `data-orientation={orientation}` menerima
  // `undefined`, sehingga React TIDAK merender atribut itu sama sekali --
  // walau className tetap memakai varian "horizontal" lewat fallback cva.
  // Didokumentasikan sebagai bugFinding, bukan diperbaiki di sini.
  it("data-orientation TIDAK di-set saat prop orientation tidak diberikan, walau className tetap pakai varian horizontal", () => {
    render(<ButtonGroup data-testid="bg" />);
    const el = screen.getByTestId("bg");
    expect(el).not.toHaveAttribute("data-orientation");
    expect(el.className).toContain("rounded-l-none");
    expect(el.className).not.toContain("flex-col");
  });

  it("orientation='horizontal' eksplisit menghasilkan data-orientation='horizontal'", () => {
    render(<ButtonGroup orientation="horizontal" data-testid="bg" />);
    const el = screen.getByTestId("bg");
    expect(el).toHaveAttribute("data-orientation", "horizontal");
    expect(el.className).toContain("rounded-l-none");
  });

  it("orientation='vertical' menghasilkan data-orientation='vertical' dan className flex-col", () => {
    render(<ButtonGroup orientation="vertical" data-testid="bg" />);
    const el = screen.getByTestId("bg");
    expect(el).toHaveAttribute("data-orientation", "vertical");
    expect(el.className).toContain("flex-col");
    expect(el.className).toContain("rounded-t-none");
  });

  it("className custom digabung dengan className default cva (bukan menggantikan)", () => {
    render(<ButtonGroup className="custom-group" data-testid="bg" />);
    const el = screen.getByTestId("bg");
    expect(el.className).toContain("custom-group");
    expect(el.className).toContain("flex");
    expect(el.className).toContain("items-stretch");
  });

  it("merender children dan meneruskan props HTML lain (onClick) ke elemen div", async () => {
    const user = userEvent.setup();
    let clicked = false;
    render(
      <ButtonGroup
        data-testid="bg"
        onClick={() => {
          clicked = true;
        }}
      >
        <button type="button">A</button>
        <button type="button">B</button>
      </ButtonGroup>,
    );

    expect(screen.getByRole("button", { name: "A" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "B" })).toBeInTheDocument();

    await user.click(screen.getByTestId("bg"));
    expect(clicked).toBe(true);
  });
});

describe("ButtonGroupText", () => {
  it("default (tanpa asChild) render sebagai <div> dengan className default", () => {
    render(<ButtonGroupText data-testid="text">Label</ButtonGroupText>);
    const el = screen.getByTestId("text");
    expect(el.tagName).toBe("DIV");
    expect(el).toHaveTextContent("Label");
    expect(el.className).toContain("bg-muted");
    expect(el.className).toContain("rounded-md");
  });

  it("asChild merender elemen anak (mis. <span>) alih-alih <div>, className digabung ke anak", () => {
    render(
      <ButtonGroupText asChild className="extra-text">
        <span data-testid="custom-child">Custom</span>
      </ButtonGroupText>,
    );
    const el = screen.getByTestId("custom-child");
    expect(el.tagName).toBe("SPAN");
    expect(el.className).toContain("extra-text");
    expect(el.className).toContain("bg-muted");
  });

  it("className custom digabung dengan className default (bukan menggantikan)", () => {
    render(<ButtonGroupText className="custom-text">Teks</ButtonGroupText>);
    const el = screen.getByText("Teks");
    expect(el.className).toContain("custom-text");
    expect(el.className).toContain("rounded-md");
  });

  it("meneruskan props HTML lain (title) ke elemen div", () => {
    render(
      <ButtonGroupText data-testid="text" title="Info">
        Teks
      </ButtonGroupText>,
    );
    expect(screen.getByTestId("text")).toHaveAttribute("title", "Info");
  });
});

describe("ButtonGroupSeparator", () => {
  it("data-slot='button-group-separator' selalu ada", () => {
    render(<ButtonGroupSeparator data-testid="sep" />);
    expect(screen.getByTestId("sep")).toHaveAttribute(
      "data-slot",
      "button-group-separator",
    );
  });

  // Berbeda dengan default milik komponen Separator upstream sendiri
  // (orientation="horizontal"), ButtonGroupSeparator meng-override default
  // lokalnya jadi "vertical" -- karena button group pada umumnya horizontal,
  // separator antar tombol butuh garis vertikal.
  it("default orientation adalah 'vertical' (override dari default Separator upstream)", () => {
    render(<ButtonGroupSeparator data-testid="sep" />);
    const el = screen.getByTestId("sep");
    expect(el).toHaveAttribute("data-orientation", "vertical");
    expect(el.className).toContain("h-full");
    expect(el.className).toContain("w-px");
    expect(el.className).toContain("self-stretch");
    expect(el.className).toContain("bg-input");
  });

  it("orientation='horizontal' eksplisit menghasilkan data-orientation='horizontal' dan className h-px w-full", () => {
    render(<ButtonGroupSeparator orientation="horizontal" data-testid="sep" />);
    const el = screen.getByTestId("sep");
    expect(el).toHaveAttribute("data-orientation", "horizontal");
    expect(el.className).toContain("h-px");
    expect(el.className).toContain("w-full");
  });

  it("className custom digabung dengan className default (bukan menggantikan)", () => {
    render(<ButtonGroupSeparator className="custom-sep" data-testid="sep" />);
    const el = screen.getByTestId("sep");
    expect(el.className).toContain("custom-sep");
    expect(el.className).toContain("bg-input");
  });

  it("meneruskan props HTML lain (id) ke elemen Separator", () => {
    render(<ButtonGroupSeparator id="sep-1" data-testid="sep" />);
    expect(screen.getByTestId("sep")).toHaveAttribute("id", "sep-1");
  });
});
