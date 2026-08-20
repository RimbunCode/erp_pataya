import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";

vi.mock("laravel-react-i18n", () => ({
  useLaravelReactI18n: () => ({ t: (key) => `TR:${key}` }),
}));

import BadgeTodoType from "./BadgeTodoType";

describe("BadgeTodoType", () => {
  it("render label terjemahan type via t()", () => {
    render(<BadgeTodoType type="task" />);
    expect(
      screen.getByText("TR:core.todo.type.options.task"),
    ).toBeInTheDocument();
  });

  it("menerapkan class theme sesuai type yang dikenal", () => {
    render(<BadgeTodoType type="deadline" />);
    const badge = screen.getByText("TR:core.todo.type.options.deadline");
    expect(badge.className).toContain("warning");
  });

  it("fallback ke theme 'secondary' untuk type tidak dikenal", () => {
    render(<BadgeTodoType type="unknown_type" />);
    const badge = screen.getByText("TR:core.todo.type.options.unknown_type");
    expect(badge.className).toContain("secondary");
  });
});
