import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { createRef } from "react";
import TextInput from "./TextInput";

describe("TextInput", () => {
  it("render sebagai input dengan type default 'text'", () => {
    render(<TextInput aria-label="username" />);
    const input = screen.getByRole("textbox", { name: "username" });
    expect(input).toHaveAttribute("type", "text");
  });

  it("menerima type kustom", () => {
    render(<TextInput aria-label="qty" type="number" />);
    const input = screen.getByRole("spinbutton", { name: "qty" });
    expect(input).toHaveAttribute("type", "number");
  });

  it("auto-focus saat isFocused=true", () => {
    render(<TextInput aria-label="username" isFocused />);
    const input = screen.getByRole("textbox", { name: "username" });
    expect(input).toHaveFocus();
  });

  it("tidak auto-focus saat isFocused=false (default)", () => {
    render(<TextInput aria-label="username" />);
    const input = screen.getByRole("textbox", { name: "username" });
    expect(input).not.toHaveFocus();
  });

  it("mengekspos method focus() via ref", () => {
    const ref = createRef();
    render(<TextInput aria-label="username" ref={ref} />);
    expect(typeof ref.current.focus).toBe("function");

    ref.current.focus();
    const input = screen.getByRole("textbox", { name: "username" });
    expect(input).toHaveFocus();
  });
});
