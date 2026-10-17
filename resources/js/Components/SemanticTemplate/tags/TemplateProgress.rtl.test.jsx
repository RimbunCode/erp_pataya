import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";

const state = vi.hoisted(() => ({ props: {} }));

vi.mock("@inertiajs/react", () => ({
  usePage: () => ({ props: state.props }),
}));

import TemplateProgress, { normalizeProgress } from "./TemplateProgress";

beforeEach(() => {
  state.props = {};
});

describe("normalizeProgress", () => {
  it("membatasi ke 0-100 dan null untuk nilai kosong/non-angka", () => {
    expect(normalizeProgress(45.25)).toBe(45.25);
    expect(normalizeProgress("50")).toBe(50);
    expect(normalizeProgress(150)).toBe(100);
    expect(normalizeProgress(-5)).toBe(0);
    expect(normalizeProgress(null)).toBeNull();
    expect(normalizeProgress(undefined)).toBeNull();
    expect(normalizeProgress("")).toBeNull();
    expect(normalizeProgress("abc")).toBeNull();
  });
});

describe("TemplateProgress", () => {
  it("default donut dengan nilai di tengah", () => {
    const { container } = render(<TemplateProgress value={45.25} />);

    const bar = screen.getByRole("progressbar");
    expect(bar).toHaveAttribute("data-shape", "donut");
    expect(bar).toHaveAttribute("aria-valuenow", "45.25");
    expect(bar).toHaveTextContent("45.25%");
    expect(container.querySelector("svg")).not.toBeNull();
    expect(container.querySelectorAll("circle")).toHaveLength(2);
  });

  it("mengikuti default_number_format preferensi", () => {
    state.props = { preferences: { default_number_format: "#.###,##" } };
    render(<TemplateProgress value={45.25} />);

    expect(screen.getByRole("progressbar")).toHaveTextContent("45,25%");
  });

  it("donut biru selama < 100 dan hijau saat 100", () => {
    const below = render(<TemplateProgress value={99.99} />);
    expect(below.container.querySelector('[data-slot="arc"]')).toHaveClass(
      "stroke-blue-500",
    );
    below.unmount();

    const full = render(<TemplateProgress value={100} />);
    expect(full.container.querySelector('[data-slot="arc"]')).toHaveClass(
      "stroke-green-500",
    );
    expect(screen.getByRole("progressbar")).toHaveTextContent("100%");
  });

  it("panjang busur donut proporsional dengan nilai", () => {
    const { container } = render(<TemplateProgress value={50} />);
    const [dash, total] = container
      .querySelector('[data-slot="arc"]')
      .getAttribute("stroke-dasharray")
      .split(" ")
      .map(Number);

    expect(dash / total).toBeCloseTo(0.5, 5);
  });

  it("shape bar: batang horizontal + teks, biru/hijau", () => {
    const below = render(<TemplateProgress value={30} shape="bar" />);
    const fill = below.container.querySelector('[data-slot="fill"]');
    expect(screen.getByRole("progressbar")).toBeInTheDocument();
    expect(below.container.querySelector("svg")).toBeNull();
    expect(fill).toHaveStyle({ width: "30%" });
    expect(fill).toHaveClass("bg-blue-500");
    expect(below.container).toHaveTextContent("30%");
    below.unmount();

    const full = render(<TemplateProgress value={100} shape="bar" />);
    expect(full.container.querySelector('[data-slot="fill"]')).toHaveClass(
      "bg-green-500",
    );
  });

  it("nilai di luar rentang dibatasi", () => {
    const over = render(<TemplateProgress value={150} />);
    expect(screen.getByRole("progressbar")).toHaveAttribute(
      "aria-valuenow",
      "100",
    );
    over.unmount();

    render(<TemplateProgress value={-5} />);
    expect(screen.getByRole("progressbar")).toHaveAttribute(
      "aria-valuenow",
      "0",
    );
  });

  it.each([null, undefined, "", "abc"])(
    "nilai %j menampilkan '–' tanpa donut/bar",
    (value) => {
      const { container } = render(<TemplateProgress value={value} />);
      const bar = render(<TemplateProgress value={value} shape="bar" />);

      expect(container).toHaveTextContent("–");
      expect(bar.container).toHaveTextContent("–");
      expect(screen.queryByRole("progressbar")).toBeNull();
      expect(container.querySelector("svg")).toBeNull();
    },
  );
});
