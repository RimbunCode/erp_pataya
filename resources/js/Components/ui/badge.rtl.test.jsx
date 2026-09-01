import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Badge } from "./badge";

describe("Badge", () => {
  it("render children tanpa crash sebagai elemen <div>", () => {
    render(<Badge>Active</Badge>);
    const badge = screen.getByText("Active");
    expect(badge).toBeInTheDocument();
    expect(badge.tagName).toBe("DIV");
  });

  it("variant default terpakai ketika prop variant tidak diberikan", () => {
    render(<Badge>Default</Badge>);
    const badge = screen.getByText("Default");
    expect(badge.className).toContain("bg-primary");
    expect(badge.className).toContain("text-primary-foreground");
    expect(badge.className).toContain("border-transparent");
  });

  it("variant secondary menghasilkan className yang sesuai", () => {
    render(<Badge variant="secondary">Secondary</Badge>);
    const badge = screen.getByText("Secondary");
    expect(badge.className).toContain("bg-secondary");
    expect(badge.className).toContain("text-secondary-foreground");
    expect(badge.className).toContain("border-transparent");
  });

  it("variant destructive menghasilkan className yang sesuai", () => {
    render(<Badge variant="destructive">Destructive</Badge>);
    const badge = screen.getByText("Destructive");
    expect(badge.className).toContain("bg-destructive");
    expect(badge.className).toContain("text-destructive-foreground");
    expect(badge.className).toContain("border-transparent");
  });

  it("variant outline menghasilkan text-foreground tanpa border-transparent", () => {
    render(<Badge variant="outline">Outline</Badge>);
    const badge = screen.getByText("Outline");
    expect(badge.className).toContain("text-foreground");
    expect(badge.className).not.toContain("border-transparent");
  });

  it("className custom digabung dengan className default (bukan menggantikan)", () => {
    render(<Badge className="custom-class">Custom</Badge>);
    const badge = screen.getByText("Custom");
    expect(badge.className).toContain("custom-class");
    expect(badge.className).toContain("rounded-full");
  });

  it("meneruskan props HTML lain (data-testid, onClick, id) ke elemen div", async () => {
    const user = userEvent.setup();
    let clicked = false;
    render(
      <Badge
        data-testid="status-badge"
        id="badge-1"
        onClick={() => {
          clicked = true;
        }}
      >
        Klik
      </Badge>,
    );

    const badge = screen.getByTestId("status-badge");
    expect(badge).toHaveAttribute("id", "badge-1");

    await user.click(badge);
    expect(clicked).toBe(true);
  });
});
