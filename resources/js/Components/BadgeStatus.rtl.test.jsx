import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";

vi.mock("laravel-react-i18n", () => ({
  useLaravelReactI18n: () => ({ t: (key) => `TR:${key}` }),
}));

import BadgeStatus from "./BadgeStatus";

describe("BadgeStatus", () => {
  it("render label terjemahan status via t()", () => {
    render(<BadgeStatus status="approved" />);
    expect(screen.getByText("TR:status.approved")).toBeInTheDocument();
  });

  it("menerapkan class theme sesuai status yang dikenal", () => {
    render(<BadgeStatus status="approved" />);
    const badge = screen.getByText("TR:status.approved");
    expect(badge.className).toContain("success");
  });

  it("fallback ke theme 'secondary' untuk status tidak dikenal", () => {
    render(<BadgeStatus status="status_aneh" />);
    const badge = screen.getByText("TR:status.status_aneh");
    expect(badge.className).toContain("secondary");
  });

  it("menampilkan animasi svg khusus untuk status 'in_progress'", () => {
    const { container } = render(<BadgeStatus status="in_progress" />);
    expect(container.querySelector("svg")).toBeInTheDocument();
  });

  it("tidak menampilkan svg animasi untuk status lain", () => {
    const { container } = render(<BadgeStatus status="approved" />);
    expect(container.querySelector("svg")).not.toBeInTheDocument();
  });

  it("meneruskan className tambahan", () => {
    render(<BadgeStatus status="draft" className="custom-class" />);
    expect(screen.getByText("TR:status.draft").className).toContain(
      "custom-class",
    );
  });
});
