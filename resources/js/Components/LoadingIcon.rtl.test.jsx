import { describe, expect, it } from "vitest";
import { render } from "@testing-library/react";
import LoadingIcon from "./LoadingIcon";

describe("LoadingIcon", () => {
  it("merender svg tanpa crash", () => {
    const { container } = render(<LoadingIcon />);
    expect(container.querySelector("svg")).toBeInTheDocument();
  });

  it("meneruskan className ke elemen svg", () => {
    const { container } = render(<LoadingIcon className="size-4" />);
    expect(container.querySelector("svg")).toHaveClass("size-4");
  });

  it("meneruskan props HTML lain (mis. aria-label) ke svg", () => {
    const { container } = render(<LoadingIcon aria-label="loading" />);
    expect(container.querySelector("svg")).toHaveAttribute(
      "aria-label",
      "loading",
    );
  });
});
