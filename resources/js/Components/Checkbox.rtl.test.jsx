import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import Checkbox from "./Checkbox";

describe("Checkbox", () => {
  it("render sebagai input type checkbox", () => {
    render(<Checkbox aria-label="agree" />);
    const input = screen.getByRole("checkbox", { name: "agree" });
    expect(input).toBeInTheDocument();
  });

  it("meneruskan className tambahan tanpa menghapus className default", () => {
    render(<Checkbox aria-label="agree" className="custom-class" />);
    const input = screen.getByRole("checkbox", { name: "agree" });
    expect(input.className).toContain("custom-class");
    expect(input.className).toContain("rounded");
  });

  it("meneruskan props lain (checked, onChange, disabled)", () => {
    render(<Checkbox aria-label="agree" checked readOnly disabled />);
    const input = screen.getByRole("checkbox", { name: "agree" });
    expect(input).toBeChecked();
    expect(input).toBeDisabled();
  });
});
