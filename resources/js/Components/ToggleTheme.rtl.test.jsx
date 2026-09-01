import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const mockUseTheme = vi.fn();

vi.mock("laravel-react-i18n", () => ({
  useLaravelReactI18n: () => ({ t: (key) => `TR:${key}` }),
}));

vi.mock("@/Hooks/useTheme", () => ({
  default: () => mockUseTheme(),
}));

import ToggleTheme from "./ToggleTheme";

describe("ToggleTheme", () => {
  beforeEach(() => {
    mockUseTheme.mockReturnValue({
      currentTheme: "light",
      theme: "system",
      setTheme: vi.fn(),
    });
  });

  it("render trigger dropdown", () => {
    render(<ToggleTheme />);
    expect(screen.getByRole("button")).toBeInTheDocument();
  });

  it("menampilkan icon light saat currentTheme='light'", () => {
    const { container } = render(<ToggleTheme />);
    expect(
      container.querySelector("#theme-toggle-light-icon"),
    ).toBeInTheDocument();
    expect(
      container.querySelector("#theme-toggle-dark-icon"),
    ).not.toBeInTheDocument();
  });

  it("menampilkan icon dark saat currentTheme='dark'", () => {
    mockUseTheme.mockReturnValue({
      currentTheme: "dark",
      theme: "dark",
      setTheme: vi.fn(),
    });
    const { container } = render(<ToggleTheme />);
    expect(
      container.querySelector("#theme-toggle-dark-icon"),
    ).toBeInTheDocument();
  });

  it("memilih opsi theme memanggil setTheme dengan value yang benar", async () => {
    const user = userEvent.setup({ delay: null });
    const setTheme = vi.fn();
    mockUseTheme.mockReturnValue({
      currentTheme: "light",
      theme: "system",
      setTheme,
    });

    render(<ToggleTheme />);
    await user.click(screen.getByRole("button"));
    await user.click(screen.getByText("TR:theme.dark"));

    expect(setTheme).toHaveBeenCalledWith("dark");
  });

  it("menampilkan 3 opsi: light, dark, system", async () => {
    const user = userEvent.setup({ delay: null });
    render(<ToggleTheme />);
    await user.click(screen.getByRole("button"));

    expect(screen.getByText("TR:theme.light")).toBeInTheDocument();
    expect(screen.getByText("TR:theme.dark")).toBeInTheDocument();
    expect(screen.getByText("TR:theme.system")).toBeInTheDocument();
  });
});
