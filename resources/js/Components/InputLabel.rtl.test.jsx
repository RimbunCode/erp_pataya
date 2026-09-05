import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import InputLabel from "./InputLabel";

describe("InputLabel", () => {
  it("render value ketika diberikan", () => {
    render(<InputLabel value="Nama Pengguna" />);
    expect(screen.getByText("Nama Pengguna")).toBeInTheDocument();
  });

  it("fallback ke children ketika value tidak diberikan", () => {
    render(<InputLabel>Children Label</InputLabel>);
    expect(screen.getByText("Children Label")).toBeInTheDocument();
  });

  it("mengutamakan value dibanding children saat keduanya ada", () => {
    render(<InputLabel value="Value Label">Children Label</InputLabel>);
    expect(screen.getByText("Value Label")).toBeInTheDocument();
    expect(screen.queryByText("Children Label")).not.toBeInTheDocument();
  });

  it("render sebagai elemen <label>", () => {
    render(<InputLabel value="Nama" htmlFor="name-input" />);
    const label = screen.getByText("Nama");
    expect(label.tagName).toBe("LABEL");
    expect(label).toHaveAttribute("for", "name-input");
  });
});
