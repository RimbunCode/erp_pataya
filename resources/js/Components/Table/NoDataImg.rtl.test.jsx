import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import NoDataImg from "./NoDataImg";

describe("NoDataImg", () => {
  it("render tanpa crash sebagai elemen <svg>", () => {
    render(<NoDataImg data-testid="no-data-img" />);
    const el = screen.getByTestId("no-data-img");
    expect(el).toBeInTheDocument();
    expect(el.tagName).toBe("svg");
  });

  it("memakai namespace SVG dan viewBox default 0 0 500 500", () => {
    render(<NoDataImg data-testid="no-data-img" />);
    const el = screen.getByTestId("no-data-img");
    expect(el).toHaveAttribute("xmlns", "http://www.w3.org/2000/svg");
    expect(el).toHaveAttribute("viewBox", "0 0 500 500");
  });

  it("tidak menyetel width/height eksplisit selama tidak diberikan lewat props", () => {
    render(<NoDataImg data-testid="no-data-img" />);
    const el = screen.getByTestId("no-data-img");
    expect(el).not.toHaveAttribute("width");
    expect(el).not.toHaveAttribute("height");
  });

  it("props viewBox custom menggantikan default (spread diletakkan setelah atribut default)", () => {
    render(<NoDataImg data-testid="no-data-img" viewBox="0 0 100 100" />);
    const el = screen.getByTestId("no-data-img");
    expect(el).toHaveAttribute("viewBox", "0 0 100 100");
  });

  it("meneruskan className apa adanya ke elemen svg root (tanpa merge, tidak ada className default)", () => {
    render(<NoDataImg data-testid="no-data-img" className="w-32 h-32" />);
    const el = screen.getByTestId("no-data-img");
    expect(el).toHaveAttribute("class", "w-32 h-32");
  });

  it("meneruskan props HTML/ARIA lain (id, aria-hidden, width, height) ke elemen svg", () => {
    render(
      <NoDataImg
        data-testid="no-data-img"
        id="empty-state-illustration"
        aria-hidden="true"
        width={200}
        height={200}
      />,
    );
    const el = screen.getByTestId("no-data-img");
    expect(el).toHaveAttribute("id", "empty-state-illustration");
    expect(el).toHaveAttribute("aria-hidden", "true");
    expect(el).toHaveAttribute("width", "200");
    expect(el).toHaveAttribute("height", "200");
  });

  it("meneruskan event handler (onClick) ke elemen svg", async () => {
    const user = userEvent.setup();
    const handleClick = vi.fn();
    render(<NoDataImg data-testid="no-data-img" onClick={handleClick} />);
    await user.click(screen.getByTestId("no-data-img"));
    expect(handleClick).toHaveBeenCalledTimes(1);
  });

  it("merender 4 grup layer ilustrasi utama (background, shadow, window, character)", () => {
    render(<NoDataImg data-testid="no-data-img" />);
    const el = screen.getByTestId("no-data-img");
    expect(
      el.querySelector("#freepik--background-complete--inject-61"),
    ).toBeInTheDocument();
    expect(el.querySelector("#freepik--Shadow--inject-61")).toBeInTheDocument();
    expect(
      el.querySelector("#freepik--window-no-data--inject-61"),
    ).toBeInTheDocument();
    expect(
      el.querySelector("#freepik--Character--inject-61"),
    ).toBeInTheDocument();
  });
});
