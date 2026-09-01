import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import InputError from "./InputError";

describe("InputError", () => {
  it("render pesan error ketika message diberikan", () => {
    render(<InputError message="Field wajib diisi" />);
    expect(screen.getByText("Field wajib diisi")).toBeInTheDocument();
  });

  it("tidak render apapun ketika message kosong/falsy", () => {
    const { container } = render(<InputError message="" />);
    expect(container).toBeEmptyDOMElement();
  });

  it("tidak render apapun ketika message undefined", () => {
    const { container } = render(<InputError />);
    expect(container).toBeEmptyDOMElement();
  });

  it("menggabungkan className tambahan dengan default", () => {
    render(<InputError message="Error" className="custom-class" />);
    const el = screen.getByText("Error");
    expect(el.className).toContain("custom-class");
    expect(el.className).toContain("text-red-600");
  });
});
