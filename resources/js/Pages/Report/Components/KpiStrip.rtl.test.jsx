import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";

import KpiStrip from "./KpiStrip";

vi.mock("@inertiajs/react", () => ({
  usePage: () => ({ props: { preferences: { default_number_format: "id" } } }),
}));

describe("KpiStrip", () => {
  it("merender label dan nilai setiap item, dengan format angka", () => {
    render(
      <KpiStrip
        items={[
          {
            key: "total_item",
            label: "Total Item",
            value: 1250,
            type: "number",
          },
          {
            key: "total_value",
            label: "Total Nilai",
            value: 2500000,
            type: "currency",
          },
        ]}
      />,
    );

    expect(screen.getByText("Total Item")).toBeInTheDocument();
    expect(screen.getByText("Total Nilai")).toBeInTheDocument();
    expect(screen.getByText(/1[.,]250(.00)?/)).toBeInTheDocument();
    expect(screen.getByText(/2[.,]500[.,]000(.00)?/)).toBeInTheDocument();
  });

  it("tidak merender apa pun bila tidak ada item", () => {
    const { container } = render(<KpiStrip items={[]} />);

    expect(container).toBeEmptyDOMElement();
  });

  it("memberi penanda pada item hasil hitung ulang", () => {
    render(
      <KpiStrip
        items={[
          {
            key: "total_item",
            label: "Total Item",
            value: 7,
            type: "number",
            recounted: true,
          },
        ]}
      />,
    );

    expect(screen.getByText("Dihitung ulang")).toBeInTheDocument();
  });
});
