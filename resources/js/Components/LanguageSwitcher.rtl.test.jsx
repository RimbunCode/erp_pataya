import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const routerPost = vi.fn();
const usePageMock = vi.fn();

vi.mock("laravel-react-i18n", () => ({
  useLaravelReactI18n: () => ({ t: (key) => `TR:${key}` }),
}));

vi.mock("@inertiajs/react", () => ({
  router: { post: (...args) => routerPost(...args) },
  usePage: () => usePageMock(),
}));

vi.stubGlobal("route", (name) => name);

import LanguageSwitcher from "./LanguageSwitcher";

describe("LanguageSwitcher", () => {
  beforeEach(() => {
    routerPost.mockClear();
    usePageMock.mockReturnValue({ props: { lang: "en" } });
  });

  it("render trigger dropdown dengan aria-label bahasa aktif", () => {
    render(<LanguageSwitcher />);
    expect(
      screen.getByRole("button", { name: "TR:lang.language" }),
    ).toBeInTheDocument();
  });

  it("membuka dropdown dan menampilkan semua opsi bahasa saat trigger diklik", async () => {
    const user = userEvent.setup({ delay: null });
    render(<LanguageSwitcher />);

    await user.click(screen.getByRole("button", { name: "TR:lang.language" }));

    expect(screen.getByText("English")).toBeInTheDocument();
    expect(screen.getByText("Bahasa Indonesia")).toBeInTheDocument();
  });

  it("memilih bahasa baru memanggil router.post ke lang.set", async () => {
    const user = userEvent.setup({ delay: null });
    render(<LanguageSwitcher />);

    await user.click(screen.getByRole("button", { name: "TR:lang.language" }));
    await user.click(screen.getByText("Bahasa Indonesia"));

    expect(routerPost).toHaveBeenCalledWith("lang.set", { code: "id" });
  });

  it("memilih bahasa yang sama dengan locale aktif TIDAK memanggil router.post", async () => {
    const user = userEvent.setup({ delay: null });
    render(<LanguageSwitcher />);

    await user.click(screen.getByRole("button", { name: "TR:lang.language" }));
    await user.click(screen.getByText("English"));

    expect(routerPost).not.toHaveBeenCalled();
  });
});
