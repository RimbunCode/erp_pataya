import React from "react";
import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import PriceControlWarnings from "./PriceControlWarnings";

describe("PriceControlWarnings", () => {
  it("renders non-blocking pricing messages when present", () => {
    render(
      <PriceControlWarnings
        title="Rate warning"
        warnings={["Price changed", "Below cost"]}
      />,
    );

    expect(screen.getByRole("status")).toHaveTextContent("Rate warning");
    expect(screen.getByText("Price changed")).toBeInTheDocument();
    expect(screen.getByText("Below cost")).toBeInTheDocument();
  });

  it("renders nothing when there are no warnings", () => {
    const { container } = render(<PriceControlWarnings title="Rate warning" />);

    expect(container).toBeEmptyDOMElement();
  });
});
