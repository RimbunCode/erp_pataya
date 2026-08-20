import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";

vi.mock("laravel-react-i18n", () => ({
  useLaravelReactI18n: () => ({
    t: (key) => {
      const map = {
        "auth.register.password.strengths.requirements.length": "8+ chars",
        "auth.register.password.strengths.requirements.num": "number",
        "auth.register.password.strengths.requirements.lowercase": "lowercase",
        "auth.register.password.strengths.requirements.uppercase": "uppercase",
        "auth.register.password.strengths.requirements.special": "special char",
        "auth.register.password.strengths.status.weak": "Weak",
        "auth.register.password.strengths.status.medium": "Medium",
        "auth.register.password.strengths.status.good": "Good",
        "auth.register.password.strengths.status.strong": "Strong",
      };
      return map[key] ?? key;
    },
  }),
}));

import PasswordChecker from "./PasswordChecker";

describe("PasswordChecker", () => {
  it("menampilkan 5 requirement", () => {
    render(<PasswordChecker password="" />);
    expect(screen.getByText("8+ chars")).toBeInTheDocument();
    expect(screen.getByText("number")).toBeInTheDocument();
    expect(screen.getByText("lowercase")).toBeInTheDocument();
    expect(screen.getByText("uppercase")).toBeInTheDocument();
    expect(screen.getByText("special char")).toBeInTheDocument();
  });

  it("progressbar aria-valuenow=0 dan status kosong untuk password kosong", () => {
    render(<PasswordChecker password="" />);
    expect(screen.getByRole("progressbar")).toHaveAttribute(
      "aria-valuenow",
      "0",
    );
  });

  it("status 'Weak' untuk password yang memenuhi <=2 requirement", () => {
    render(<PasswordChecker password="abc" />);
    // "abc": length(<8) gagal, lowercase lulus -> skor 1
    expect(screen.getByRole("progressbar")).toHaveAttribute(
      "aria-valuenow",
      "1",
    );
    expect(screen.getByText("Weak")).toBeInTheDocument();
  });

  it("status 'Strong' untuk password yang memenuhi semua requirement", () => {
    render(<PasswordChecker password="Abcdef1!" />);
    expect(screen.getByRole("progressbar")).toHaveAttribute(
      "aria-valuenow",
      "5",
    );
    expect(screen.getByText("Strong")).toBeInTheDocument();
  });

  it("requirement yang terpenuhi ditandai 'Requirement met'", () => {
    render(<PasswordChecker password="Abcdef1!" />);
    const metLabels = screen.getAllByText("- Requirement met");
    expect(metLabels).toHaveLength(5);
  });
});
