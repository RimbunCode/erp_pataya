import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
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

import LanguageSwitcherSub from "./LanguageSwitcherSub";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "./ui/dropdown-menu";

// LanguageSwitcherSub selalu dipakai sebagai DropdownMenuSub di dalam
// DropdownMenuContent milik parent (lihat Navbar/UserInfo.jsx), jadi
// direndernya di sini juga dibungkus struktur yang sama. Parent dibuka
// via prop `open` (bukan klik trigger) supaya konsisten dengan pola yang
// sudah dipakai di ui/dropdown-menu.rtl.test.jsx untuk kasus DropdownMenuSub.
function renderInOpenDropdown() {
  return render(
    <DropdownMenu open>
      <DropdownMenuTrigger>Buka Menu</DropdownMenuTrigger>
      <DropdownMenuContent>
        <LanguageSwitcherSub />
      </DropdownMenuContent>
    </DropdownMenu>,
  );
}

function getSubTrigger() {
  return screen.getByText("TR:lang.language").closest('[role="menuitem"]');
}

// Untuk MENGKLIK opsi radio DI DALAM submenu (DropdownMenuSub), dipakai
// fireEvent.click, bukan userEvent.click. Sudah diverifikasi manual (termasuk
// pada DropdownMenuItem polos milik ui/dropdown-menu.jsx sendiri, tanpa kode
// LanguageSwitcherSub sama sekali) bahwa urutan event pointerdown->pointerup
// penuh dari userEvent.click membuat DismissableLayer bertingkat dua (Content
// root + SubContent) di jsdom keliru menutup submenu SEBELUM handler onSelect
// Radix sempat jalan, sehingga onValueChange tidak pernah terpanggil -- bukan
// bug di LanguageSwitcherSub. fireEvent.click mengirim event "click" murni
// (persis seperti Radix men-trigger select via keyboard Enter/Space, yang
// juga memanggil element.click() secara langsung) dan bekerja konsisten.
// userEvent tetap dipakai untuk membuka dropdown & submenu (itu terbukti
// berfungsi normal) -- hanya langkah pemilihan opsi di dalam submenu yang
// pakai fireEvent.

describe("LanguageSwitcherSub", () => {
  beforeEach(() => {
    routerPost.mockClear();
    usePageMock.mockReturnValue({ props: { lang: "en" } });
  });

  it("render sub-trigger dengan label bahasa dan icon Languages saat dropdown induk terbuka", () => {
    renderInOpenDropdown();

    const subTrigger = getSubTrigger();
    expect(subTrigger).toBeInTheDocument();
    expect(subTrigger.querySelector("svg")).toBeInTheDocument();
  });

  it("submenu belum ada di DOM sebelum sub-trigger diklik", () => {
    renderInOpenDropdown();

    expect(screen.queryByText("English")).not.toBeInTheDocument();
    expect(screen.queryByText("Bahasa Indonesia")).not.toBeInTheDocument();
  });

  it("klik sub-trigger membuka submenu dan menampilkan kedua opsi bahasa dengan icon bendera", async () => {
    const user = userEvent.setup();
    renderInOpenDropdown();

    await user.click(getSubTrigger());

    const englishOption = await screen.findByRole("menuitemradio", {
      name: /English/,
    });
    const indonesiaOption = screen.getByRole("menuitemradio", {
      name: /Bahasa Indonesia/,
    });

    expect(englishOption).toBeInTheDocument();
    expect(indonesiaOption).toBeInTheDocument();
    expect(englishOption.querySelector("span.fi-gb")).toBeInTheDocument();
    expect(indonesiaOption.querySelector("span.fi-id")).toBeInTheDocument();
  });

  it("opsi locale yang sedang aktif (props.lang) berstatus checked, opsi lain tidak", async () => {
    const user = userEvent.setup();
    renderInOpenDropdown();

    await user.click(getSubTrigger());

    const englishOption = await screen.findByRole("menuitemradio", {
      name: /English/,
    });
    const indonesiaOption = screen.getByRole("menuitemradio", {
      name: /Bahasa Indonesia/,
    });

    expect(englishOption).toHaveAttribute("aria-checked", "true");
    expect(indonesiaOption).toHaveAttribute("aria-checked", "false");
  });

  it("memilih bahasa baru (Bahasa Indonesia) memanggil router.post ke lang.set dengan code yang benar", async () => {
    const user = userEvent.setup();
    renderInOpenDropdown();

    await user.click(getSubTrigger());
    const indonesiaOption = await screen.findByRole("menuitemradio", {
      name: /Bahasa Indonesia/,
    });
    fireEvent.click(indonesiaOption);

    expect(routerPost).toHaveBeenCalledTimes(1);
    expect(routerPost).toHaveBeenCalledWith("lang.set", { code: "id" });
  });

  it("memilih bahasa yang sama dengan locale aktif TIDAK memanggil router.post", async () => {
    const user = userEvent.setup();
    renderInOpenDropdown();

    await user.click(getSubTrigger());
    const englishOption = await screen.findByRole("menuitemradio", {
      name: /English/,
    });
    fireEvent.click(englishOption);

    expect(routerPost).not.toHaveBeenCalled();
  });

  it("locale aktif id: opsi Bahasa Indonesia checked dan memilih English memanggil router.post dengan code en", async () => {
    usePageMock.mockReturnValue({ props: { lang: "id" } });
    const user = userEvent.setup();
    renderInOpenDropdown();

    await user.click(getSubTrigger());
    const englishOption = await screen.findByRole("menuitemradio", {
      name: /English/,
    });
    const indonesiaOption = screen.getByRole("menuitemradio", {
      name: /Bahasa Indonesia/,
    });

    expect(indonesiaOption).toHaveAttribute("aria-checked", "true");
    expect(englishOption).toHaveAttribute("aria-checked", "false");

    fireEvent.click(englishOption);

    expect(routerPost).toHaveBeenCalledWith("lang.set", { code: "en" });
  });
});
