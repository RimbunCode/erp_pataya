import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const mockUseTheme = vi.fn();

vi.mock("laravel-react-i18n", () => ({
  useLaravelReactI18n: () => ({ t: (key) => `TR:${key}` }),
}));

vi.mock("@/Hooks/useTheme", () => ({
  default: () => mockUseTheme(),
}));

import ToggleThemeSub from "./ToggleThemeSub";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "./ui/dropdown-menu";

// ToggleThemeSub selalu dipakai sebagai DropdownMenuSub di dalam
// DropdownMenuContent milik parent (pola sama dengan LanguageSwitcherSub, lihat
// LanguageSwitcherSub.rtl.test.jsx), jadi direndernya di sini juga dibungkus
// struktur yang sama. Parent dibuka via prop `open` (bukan klik trigger) supaya
// konsisten dengan pola yang sudah dipakai di ui/dropdown-menu.rtl.test.jsx
// untuk kasus DropdownMenuSub.
function renderInOpenDropdown() {
  return render(
    <DropdownMenu open>
      <DropdownMenuTrigger>Buka Menu</DropdownMenuTrigger>
      <DropdownMenuContent>
        <ToggleThemeSub />
      </DropdownMenuContent>
    </DropdownMenu>,
  );
}

function getSubTrigger() {
  return screen.getByText("TR:theme.theme").closest('[role="menuitem"]');
}

// Untuk MENGKLIK opsi radio DI DALAM submenu (DropdownMenuSub), dipakai
// fireEvent.click, bukan userEvent.click -- alasan sama persis dengan yang
// didokumentasikan di LanguageSwitcherSub.rtl.test.jsx: urutan event
// pointerdown->pointerup penuh dari userEvent.click membuat DismissableLayer
// bertingkat dua (Content root + SubContent) di jsdom keliru menutup submenu
// SEBELUM handler onSelect Radix sempat jalan, sehingga onValueChange tidak
// pernah terpanggil. userEvent tetap dipakai untuk membuka dropdown & submenu.

describe("ToggleThemeSub", () => {
  beforeEach(() => {
    mockUseTheme.mockReturnValue({
      currentTheme: "light",
      theme: "system",
      setTheme: vi.fn(),
    });
  });

  it("render sub-trigger dengan label theme dan icon Sun saat currentTheme='light'", () => {
    renderInOpenDropdown();

    const subTrigger = getSubTrigger();
    expect(subTrigger).toBeInTheDocument();
    expect(subTrigger.querySelector("svg.lucide-sun")).toBeInTheDocument();
    expect(subTrigger.querySelector("svg.lucide-moon")).not.toBeInTheDocument();
  });

  it("sub-trigger menampilkan icon Moon saat currentTheme='dark'", () => {
    mockUseTheme.mockReturnValue({
      currentTheme: "dark",
      theme: "dark",
      setTheme: vi.fn(),
    });
    renderInOpenDropdown();

    const subTrigger = getSubTrigger();
    expect(subTrigger.querySelector("svg.lucide-moon")).toBeInTheDocument();
    expect(subTrigger.querySelector("svg.lucide-sun")).not.toBeInTheDocument();
  });

  it("submenu belum ada di DOM sebelum sub-trigger diklik", () => {
    renderInOpenDropdown();

    expect(screen.queryByText("TR:theme.light")).not.toBeInTheDocument();
    expect(screen.queryByText("TR:theme.dark")).not.toBeInTheDocument();
    expect(screen.queryByText("TR:theme.system")).not.toBeInTheDocument();
  });

  it("klik sub-trigger membuka submenu dan menampilkan 3 opsi theme dengan icon masing-masing", async () => {
    const user = userEvent.setup();
    renderInOpenDropdown();

    await user.click(getSubTrigger());

    const lightOption = await screen.findByRole("menuitemradio", {
      name: /TR:theme.light/,
    });
    const darkOption = screen.getByRole("menuitemradio", {
      name: /TR:theme.dark/,
    });
    const systemOption = screen.getByRole("menuitemradio", {
      name: /TR:theme.system/,
    });

    expect(lightOption).toBeInTheDocument();
    expect(darkOption).toBeInTheDocument();
    expect(systemOption).toBeInTheDocument();
    expect(lightOption.querySelector("svg.lucide-sun")).toBeInTheDocument();
    expect(darkOption.querySelector("svg.lucide-moon")).toBeInTheDocument();
    expect(
      systemOption.querySelector("svg.lucide-sun-moon"),
    ).toBeInTheDocument();
    expect(screen.getByRole("separator", { hidden: true })).toBeInTheDocument();
  });

  it("opsi yang sesuai dengan theme aktif ('system') berstatus checked, opsi lain tidak", async () => {
    const user = userEvent.setup();
    renderInOpenDropdown();

    await user.click(getSubTrigger());

    const lightOption = await screen.findByRole("menuitemradio", {
      name: /TR:theme.light/,
    });
    const darkOption = screen.getByRole("menuitemradio", {
      name: /TR:theme.dark/,
    });
    const systemOption = screen.getByRole("menuitemradio", {
      name: /TR:theme.system/,
    });

    expect(lightOption).toHaveAttribute("aria-checked", "false");
    expect(darkOption).toHaveAttribute("aria-checked", "false");
    expect(systemOption).toHaveAttribute("aria-checked", "true");
  });

  it("theme aktif 'dark': opsi Dark berstatus checked", async () => {
    mockUseTheme.mockReturnValue({
      currentTheme: "dark",
      theme: "dark",
      setTheme: vi.fn(),
    });
    const user = userEvent.setup();
    renderInOpenDropdown();

    await user.click(getSubTrigger());

    const darkOption = await screen.findByRole("menuitemradio", {
      name: /TR:theme.dark/,
    });
    const lightOption = screen.getByRole("menuitemradio", {
      name: /TR:theme.light/,
    });

    expect(darkOption).toHaveAttribute("aria-checked", "true");
    expect(lightOption).toHaveAttribute("aria-checked", "false");
  });

  it("memilih opsi 'dark' memanggil setTheme dengan value 'dark'", async () => {
    const user = userEvent.setup();
    const setTheme = vi.fn();
    mockUseTheme.mockReturnValue({
      currentTheme: "light",
      theme: "system",
      setTheme,
    });
    renderInOpenDropdown();

    await user.click(getSubTrigger());
    const darkOption = await screen.findByRole("menuitemradio", {
      name: /TR:theme.dark/,
    });
    fireEvent.click(darkOption);

    expect(setTheme).toHaveBeenCalledTimes(1);
    expect(setTheme).toHaveBeenCalledWith("dark");
  });

  it("memilih opsi 'light' memanggil setTheme dengan value 'light'", async () => {
    const user = userEvent.setup();
    const setTheme = vi.fn();
    mockUseTheme.mockReturnValue({
      currentTheme: "light",
      theme: "system",
      setTheme,
    });
    renderInOpenDropdown();

    await user.click(getSubTrigger());
    const lightOption = await screen.findByRole("menuitemradio", {
      name: /TR:theme.light/,
    });
    fireEvent.click(lightOption);

    expect(setTheme).toHaveBeenCalledWith("light");
  });

  it("memilih opsi 'system' memanggil setTheme dengan value 'system'", async () => {
    const user = userEvent.setup();
    const setTheme = vi.fn();
    mockUseTheme.mockReturnValue({
      currentTheme: "dark",
      theme: "dark",
      setTheme,
    });
    renderInOpenDropdown();

    await user.click(getSubTrigger());
    const systemOption = await screen.findByRole("menuitemradio", {
      name: /TR:theme.system/,
    });
    fireEvent.click(systemOption);

    expect(setTheme).toHaveBeenCalledWith("system");
  });
});
