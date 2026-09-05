import { createRef } from "react";
import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { Label } from "./label";

describe("Label", () => {
  it("render children tanpa crash sebagai elemen <label>", () => {
    render(<Label htmlFor="username">Username</Label>);
    const label = screen.getByText("Username");
    expect(label).toBeInTheDocument();
    expect(label.tagName).toBe("LABEL");
  });

  it("className default terpakai (text-base, font-medium, leading-none, peer-disabled)", () => {
    render(<Label htmlFor="email">Email</Label>);
    const label = screen.getByText("Email");
    expect(label.className).toContain("text-base");
    expect(label.className).toContain("font-medium");
    expect(label.className).toContain("leading-none");
    expect(label.className).toContain("peer-disabled:cursor-not-allowed");
    expect(label.className).toContain("peer-disabled:opacity-70");
  });

  it("className custom digabung dengan className default (bukan menggantikan)", () => {
    render(
      <Label htmlFor="password" className="custom-label-class">
        Password
      </Label>,
    );
    const label = screen.getByText("Password");
    expect(label.className).toContain("custom-label-class");
    expect(label.className).toContain("text-base");
    expect(label.className).toContain("font-medium");
  });

  it("meneruskan atribut htmlFor sehingga label terasosiasi dengan input terkait", () => {
    render(
      <>
        <Label htmlFor="fullname">Nama Lengkap</Label>
        <input id="fullname" />
      </>,
    );
    const input = screen.getByLabelText("Nama Lengkap");
    expect(input).toBeInTheDocument();
    expect(input.tagName).toBe("INPUT");
  });

  it("meneruskan props HTML lain (data-testid, id, onClick) ke elemen label", async () => {
    const user = userEvent.setup();
    let clicked = false;
    render(
      <Label
        data-testid="my-label"
        id="label-1"
        onClick={() => {
          clicked = true;
        }}
      >
        Klik
      </Label>,
    );

    const label = screen.getByTestId("my-label");
    expect(label).toHaveAttribute("id", "label-1");

    await user.click(label);
    expect(clicked).toBe(true);
  });

  it("forwardRef meneruskan ref ke elemen <label> DOM asli", () => {
    const ref = createRef();
    render(
      <Label ref={ref} data-testid="ref-label">
        Ref Target
      </Label>,
    );
    expect(ref.current).toBe(screen.getByTestId("ref-label"));
    expect(ref.current.tagName).toBe("LABEL");
  });
});
