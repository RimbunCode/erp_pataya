import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { Skeleton } from "./skeleton";

describe("Skeleton", () => {
  it("render tanpa crash sebagai elemen <div>", () => {
    render(<Skeleton data-testid="skel" />);
    const el = screen.getByTestId("skel");
    expect(el).toBeInTheDocument();
    expect(el.tagName).toBe("DIV");
  });

  it("className default berisi animate-pulse, rounded-md, dan bg-muted", () => {
    render(<Skeleton data-testid="skel" />);
    const el = screen.getByTestId("skel");
    expect(el.className).toContain("animate-pulse");
    expect(el.className).toContain("rounded-md");
    expect(el.className).toContain("bg-muted");
  });

  it("className custom digabung dengan className default (bukan menggantikan)", () => {
    render(<Skeleton data-testid="skel" className="h-4 w-full" />);
    const el = screen.getByTestId("skel");
    expect(el.className).toContain("h-4");
    expect(el.className).toContain("w-full");
    expect(el.className).toContain("animate-pulse");
    expect(el.className).toContain("bg-muted");
  });

  it("className custom yang konflik (rounded-full) menggantikan rounded-md default via twMerge", () => {
    render(<Skeleton data-testid="skel" className="rounded-full" />);
    const el = screen.getByTestId("skel");
    expect(el.className).toContain("rounded-full");
    expect(el.className).not.toContain("rounded-md");
    // kelas non-konflik tetap dipertahankan
    expect(el.className).toContain("animate-pulse");
    expect(el.className).toContain("bg-muted");
  });

  it("meneruskan props HTML lain (id, aria-label) ke elemen div", () => {
    render(
      <Skeleton data-testid="skel" id="avatar-skeleton" aria-label="Memuat" />,
    );
    const el = screen.getByTestId("skel");
    expect(el).toHaveAttribute("id", "avatar-skeleton");
    expect(el).toHaveAttribute("aria-label", "Memuat");
  });

  it("meneruskan event handler (onClick) ke elemen div", async () => {
    const user = userEvent.setup();
    const handleClick = vi.fn();
    render(<Skeleton data-testid="skel" onClick={handleClick} />);
    await user.click(screen.getByTestId("skel"));
    expect(handleClick).toHaveBeenCalledTimes(1);
  });

  it("children diteruskan lewat props spread dan dirender di dalam div", () => {
    render(<Skeleton data-testid="skel">Loading...</Skeleton>);
    const el = screen.getByTestId("skel");
    expect(el).toHaveTextContent("Loading...");
  });
});
